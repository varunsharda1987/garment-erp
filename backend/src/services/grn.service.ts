/**
 * GRN (Goods Receiving Notes) Service
 * Business logic for goods receiving operations with stock integration
 */

import { GRNStatus, PurchaseOrderStatus, Prisma, MovementType, Unit } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  CreateGRNDTO,
  GRNFilters,
  PendingPOItem,
  ProcessingReceiveData,
  ProcessingQCData,
  GRNItemDetailDTO,
} from '../types/grn.types';
import { createChallan } from './challan.service';
import { purchaseOrderService } from './purchaseOrder.service';
import mrpService from './mrp.service';
import { updateWosrReceivedQuantity } from './work-order-service-requirement.service';
import { checkProcessingPOReadiness } from './po-status-manager.service';
import greigeStockService from './greige-stock.service';
import { systemSettingsService } from './system-settings.service';
import prisma from '../config/database'; // Use singleton to avoid connection pool leak
import { logInfo, logError, logWarn } from '../utils/logger';
import { generateAtomicGRNNumber } from '../utils/atomicCodeGenerator';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';
import { getOrCreateFinishedFabric, determineFinishType } from './helpers/processing-fabric.helper';
import { formatStyleCodeWithRef } from '../utils/style-ref-format';
import { addCurrency, multiplyCurrency, roundToCent, subtractCurrency, toNumber } from '../utils/currency';
import {
  validateSourceMismatchOverride,
  executeSourceMismatchCleanup,
  findFabricForGreige,
  updateCostSheetSourcingStrategy,
} from './helpers/source-mismatch.helper';
// BUG-GR9 fix: Use centralized quality grade default instead of hardcoding 'A'
import { DEFAULT_QUALITY_GRADE } from '../constants/stock.constants';

class GRNService {
  /**
   * Generate unique GRN number - Format: GRN2511-0001
   * Uses atomic sequence generator to prevent duplicate numbers under concurrency.
   */
  private async generateGRNNumber(): Promise<string> {
    return generateAtomicGRNNumber();
  }

  /**
   * Create a new GRN
   */
  async createGRN(data: CreateGRNDTO, userId: string) {
    // Validate PO exists and is in receivable status
    const po = await prisma.purchase_orders.findUnique({
      where: { id: data.poId },
      include: {
        purchase_order_items: {
          include: { materials: { select: { id: true, code: true, name: true } } },
        },
        suppliers: { select: { id: true, name: true, code: true } },
      },
    });

    if (!po) {
      throw new Error('Purchase order not found');
    }

    const receivableStatuses: PurchaseOrderStatus[] = [
      PurchaseOrderStatus.SENT,
      PurchaseOrderStatus.ACKNOWLEDGED,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ];

    if (!receivableStatuses.includes(po.status)) {
      throw new Error(`Cannot receive goods for PO in ${po.status} status`);
    }

    // Fetch over-receipt tolerance from system settings
    const tolerancePercent = await systemSettingsService.getNumber('GRN_OVER_RECEIPT_TOLERANCE_PERCENT', 10);

    // Validate items
    for (const item of data.items) {
      const poItem = po.purchase_order_items.find((pi) => pi.id === item.poItemId);
      if (!poItem) {
        throw new Error(`PO item ${item.poItemId} not found`);
      }

      // Check if receiving more than allowed (ordered + tolerance)
      const orderedQty = Number(poItem.orderedQuantity);
      const alreadyReceived = Number(poItem.receivedQuantity);
      const maxAllowed = orderedQty * (1 + tolerancePercent / 100) - alreadyReceived;
      if (item.receivedQuantity > maxAllowed) {
        const materialCode = poItem.materials?.code || item.materialId;
        throw new Error(
          `Cannot receive ${item.receivedQuantity} units of ${materialCode}. ` +
            `Maximum allowed (with ${tolerancePercent}% tolerance) is ${maxAllowed.toFixed(3)}. ` +
            `Ordered: ${orderedQty}, Already received: ${alreadyReceived}.`
        );
      }

      // Validate accepted + rejected = received (epsilon compare — bug-hunt procurement-8:
      // strict float equality rejected legitimate decimal receipts like 10.1 + 0.2 vs 10.3)
      if (Math.abs(item.acceptedQuantity + item.rejectedQuantity - item.receivedQuantity) > 0.001) {
        throw new Error(
          `Accepted (${item.acceptedQuantity}) + Rejected (${item.rejectedQuantity}) must equal Received (${item.receivedQuantity})`
        );
      }

      // Validate material matches PO item material (prevent cross-linking)
      if (item.materialId && poItem.materialId && item.materialId !== poItem.materialId) {
        throw new Error(
          `GRN material (${item.materialId}) does not match PO item material (${poItem.materialId}). ` +
            `Cannot receive a different material than what was ordered.`
        );
      }
    }

    const grnNumber = await this.generateGRNNumber();

    // PROCESSING PO: validate the linked job work order BEFORE booking anything (bug-hunt
    // procurement-5: these user-facing rejections used to fire AFTER the GRN + PO received-quantity
    // increments had already committed — the receipt existed even though the user saw an error).
    let processingJob: Prisma.job_work_ordersGetPayload<{
      include: { style: { select: { id: true; styleCode: true; buyerStyleRef: true } } };
    }> | null = null;
    // Phase 4a: resolve the JWO for ANY PROCESSING PO (not just when processingData is
    // supplied) so the GRN can be stamped with jobWorkOrderId — 4b groundwork for
    // PO-less receiving. The receive-state validations stay gated on processingData
    // exactly as before.
    if (po.poCategory === 'PROCESSING') {
      processingJob = await prisma.job_work_orders.findFirst({
        where: { purchaseOrderId: po.id },
        include: { style: { select: { id: true, styleCode: true, buyerStyleRef: true } } },
      });
      if (data.processingData) {
        if (!processingJob) {
          logError('No job work order linked to PROCESSING PO', { poId: po.id });
        } else if (processingJob.receivedDate) {
          throw new Error('This processing PO has already been received via the Printing/Dyeing module');
        } else if (processingJob.status !== 'AT_MILL' && processingJob.status !== 'SENT_TO_MILL') {
          throw new Error(`Cannot receive. Job status is ${processingJob.status}, expected AT_MILL`);
        }
      }
    }

    // Create GRN with items in transaction
    const grn = await prisma.$transaction(
      async (tx) => {
        // Create GRN
        const newGRN = await tx.goods_receiving_notes.create({
          data: {
            id: randomUUID(),
            grnNumber,
            poId: data.poId,
            jobWorkOrderId: processingJob?.id ?? null, // Phase 4a: GRN→JWO at creation
            supplierId: po.supplierId,
            warehouseId: data.warehouseId || null, // Target warehouse for received goods
            receivingDate: data.receivingDate ? new Date(data.receivingDate) : new Date(),
            invoiceNumber: data.invoiceNumber || null,
            invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
            status: GRNStatus.PENDING_QC,
            remarks: data.remarks || null,
            receivedById: userId,
            grn_items: {
              create: data.items.map((item) => {
                const poItem = po.purchase_order_items.find((pi) => pi.id === item.poItemId);
                const orderedQty = Number(poItem?.orderedQuantity || 0);
                const alreadyReceived = Number(poItem?.receivedQuantity || 0);
                const pendingQty = orderedQty - alreadyReceived;
                const isOverReceipt = item.receivedQuantity > pendingQty;
                const overReceiptQty = isOverReceipt ? item.receivedQuantity - pendingQty : null;

                // Compute counts from details if provided
                let baleCount: number | null = null;
                let thanCount: number | null = null;
                let rollCount: number | null = null;
                let totalMeters: number | null = null;

                if (item.details && item.details.length > 0) {
                  const thans = item.details.filter((d) => d.detailType === 'THAN');
                  const rolls = item.details.filter((d) => d.detailType === 'ROLL');
                  thanCount = thans.length || null;
                  rollCount = rolls.length || null;
                  totalMeters = item.details.reduce((sum, d) => sum + d.meters, 0);
                  // Count distinct bale numbers for bale count
                  const baleNumbers = new Set(thans.filter((d) => d.baleNumber).map((d) => d.baleNumber));
                  baleCount = baleNumbers.size > 0 ? baleNumbers.size : null;
                }

                return {
                  id: randomUUID(),
                  poItemId: item.poItemId,
                  materialId: item.materialId,
                  orderedQuantity: poItem?.orderedQuantity || 0,
                  receivedQuantity: item.receivedQuantity,
                  acceptedQuantity: item.acceptedQuantity,
                  rejectedQuantity: item.rejectedQuantity,
                  unit: item.unit,
                  remarks: item.remarks || null,
                  componentName: (poItem as any)?.componentName || null,
                  colorName: (poItem as any)?.colorName || null,
                  // Measurement fields
                  foldLengthCm: item.foldLengthCm || null,
                  receivedWidthInches: item.receivedWidthInches || null,
                  entryMode: item.entryMode || null,
                  baleCount,
                  thanCount,
                  rollCount,
                  totalMeters: totalMeters ?? (item.receivedQuantity || null),
                  isOverReceipt,
                  overReceiptQty,
                  // Source mismatch override fields
                  receivedAsReadyFabric: item.receivedAsReadyFabric || false,
                  actualRatePerUnit: item.actualRatePerUnit || null,
                  updateFutureSourcing: item.updateFutureSourcing || false,
                };
              }),
            },
          },
          include: this.getFullInclude(),
        });

        // Create grn_item_details for items with breakdown data
        for (const item of data.items) {
          if (item.details && item.details.length > 0) {
            // Find the created grn_item by poItemId match
            const createdItem = (newGRN as any).grn_items?.find((gi: any) => gi.poItemId === item.poItemId);
            if (createdItem) {
              await tx.grn_item_details.createMany({
                data: item.details.map((detail: GRNItemDetailDTO) => ({
                  id: randomUUID(),
                  grnItemId: createdItem.id,
                  detailType: detail.detailType,
                  baleNumber: detail.baleNumber || null,
                  sequenceNo: detail.sequenceNo,
                  meters: detail.meters,
                  remarks: detail.remarks || null,
                })),
              });
            }
          }
        }

        // Update PO item received quantities
        for (const item of data.items) {
          const poItem = po.purchase_order_items.find((pi) => pi.id === item.poItemId);
          if (poItem) {
            await tx.purchase_order_items.update({
              where: { id: item.poItemId },
              data: {
                receivedQuantity: {
                  increment: item.receivedQuantity,
                },
              },
            });
          }
        }

        // PROCESSING PO: the processing writes (fabric width, inward challan, job receive) are part of
        // THIS transaction (bug-hunt procurement-5: they used to run post-commit on the global client as
        // three separate writes, with the inward-challan failure silently swallowed — a failed challan
        // left the job RECEIVED with no inward document).
        if (processingJob && data.processingData) {
          const { qtyReceivedMeters, receivedWidthInches, thanCount, foldLengthCm, receivedChallan } =
            data.processingData;

          // Calculate actual meters from than measurement
          let calculatedActualMeters: number | null = null;
          let actualMeters = qtyReceivedMeters || 0;
          if (thanCount && foldLengthCm) {
            calculatedActualMeters = (thanCount * foldLengthCm) / 100;
            if (!qtyReceivedMeters) {
              actualMeters = calculatedActualMeters;
            }
          }

          // Calculate shrinkage and width variance
          const sentMeters = Number(processingJob.qtySentMeters);
          const actualShrinkage = sentMeters > 0 ? ((sentMeters - actualMeters) / sentMeters) * 100 : 0;
          const widthVariance = receivedWidthInches - Number(processingJob.sentWidthInches);

          // Update fabric_master actual width if finished fabric exists
          if (processingJob.finishedFabricId && receivedWidthInches) {
            await tx.fabric_master.update({
              where: { id: processingJob.finishedFabricId },
              data: {
                actualWidth: receivedWidthInches,
                cutableWidth: receivedWidthInches > 2 ? receivedWidthInches - 2 : receivedWidthInches,
              },
            });
          }

          // Create INWARD challan in the same tx — a failure now ABORTS the whole receive instead of
          // being swallowed.
          const challan = await createChallan(
            {
              challanType: 'INWARD',
              challanDate: data.receivingDate ? new Date(data.receivingDate as string) : new Date(),
              fromType: 'VENDOR',
              fromId: po.supplierId,
              fromName: po.suppliers?.name || 'Mill',
              toType: 'WAREHOUSE',
              toName: 'Main Warehouse',
              purchaseOrderId: po.id,
              jobWorkOrderId: processingJob.id,
              issuedById: userId,
              unit: Unit.METER,
              remarks: receivedChallan ? `Vendor challan ref: ${receivedChallan}` : undefined,
              items: [
                {
                  itemType: 'FABRIC',
                  fabricId: processingJob.finishedFabricId || processingJob.fabricId || undefined,
                  description: `Processed fabric received via GRN - ${formatStyleCodeWithRef(processingJob.style?.styleCode || '', processingJob.style?.buyerStyleRef)}`,
                  quantity: actualMeters,
                  unit: Unit.METER,
                },
              ],
            },
            tx
          );

          // Guarded receive (receivedDate still null) — a concurrent receive that won the race makes
          // count 0 and aborts this one instead of double-receiving.
          const jobUpdate = await tx.job_work_orders.updateMany({
            // re-check status too (not just receivedDate): a job cancelled between the pre-tx validation
            // and this write must not be force-received
            where: { id: processingJob.id, receivedDate: null, status: { in: ['AT_MILL', 'SENT_TO_MILL'] } },
            data: {
              qtyReceivedMeters: actualMeters,
              receivedWidthInches: receivedWidthInches,
              receivedDate: data.receivingDate ? new Date(data.receivingDate as string) : new Date(),
              receivedChallan: receivedChallan || null,
              invoiceNumber: data.invoiceNumber || null,
              actualShrinkage: actualShrinkage,
              widthVariance: widthVariance,
              thanCount: thanCount || null,
              foldLengthCm: foldLengthCm || null,
              calculatedActualMeters: calculatedActualMeters,
              inwardChallanId: challan.id,
              grnId: newGRN.id,
              status: 'RECEIVED',
            },
          });
          if (jobUpdate.count === 0) {
            throw new Error('This processing PO has already been received via the Printing/Dyeing module');
          }

          logInfo(`Processing PO received via GRN ${newGRN.grnNumber}`, {
            poId: po.id,
            jobId: processingJob.id,
            actualMeters,
            shrinkage: actualShrinkage,
          });
        }

        return newGRN;
      },
      { timeout: 15000, maxWait: 5000 }
    ); // headroom over the 5s default: PROCESSING receives create a challan in-tx and lock-waits count against the clock

    // Update PO status based on receiving
    await purchaseOrderService.updateReceivingStatus(data.poId);

    return grn;
  }

  /**
   * Get all GRNs with filters and pagination
   */
  async getAllGRNs(filters?: GRNFilters) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.goods_receiving_notesWhereInput = {};

    if (filters?.poId) {
      where.poId = filters.poId;
    }

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { grnNumber: { contains: filters.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
        { purchase_orders: { is: { poNumber: { contains: filters.search, mode: 'insensitive' } } } },
        { suppliers: { is: { name: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    if (filters?.startDate || filters?.endDate) {
      where.receivingDate = {};
      if (filters?.startDate) {
        where.receivingDate.gte = new Date(filters.startDate);
      }
      if (filters?.endDate) {
        where.receivingDate.lte = new Date(filters.endDate);
      }
    }

    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder || 'desc';

    const [grns, total] = await Promise.all([
      prisma.goods_receiving_notes.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          purchase_orders: {
            select: {
              id: true,
              poNumber: true,
              expectedDeliveryDate: true,
              status: true,
            },
          },
          suppliers: {
            select: {
              id: true,
              code: true,
              name: true,
              contactPerson: true,
            },
          },
          // Phase 4b: PO-less GRNs identify by their Job Work Order
          jobWorkOrder: {
            select: { id: true, jobWorkNumber: true, processType: true },
          },
          grn_items: true,
        },
      }),
      prisma.goods_receiving_notes.count({ where }),
    ]);

    return {
      data: grns.map((grn) => ({
        ...grn,
        itemCount: grn.grn_items.length,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single GRN by ID with all relations
   */
  async getGRNById(id: string) {
    const grn = await prisma.goods_receiving_notes.findUnique({
      where: { id },
      include: this.getFullInclude(),
    });

    if (!grn) {
      throw new Error('GRN not found');
    }

    return grn;
  }

  /**
   * Get all GRNs for a specific PO
   */
  async getGRNsByPO(poId: string) {
    const grns = await prisma.goods_receiving_notes.findMany({
      where: { poId },
      include: {
        grn_items: {
          include: {
            materials: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        users_goods_receiving_notes_receivedByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { receivingDate: 'desc' },
    });

    return grns;
  }

  /**
   * Get pending items for a PO (for GRN form)
   */
  async getPendingItemsForPO(poId: string): Promise<PendingPOItem[]> {
    const po = await prisma.purchase_orders.findUnique({
      where: { id: poId },
      include: {
        purchase_order_items: {
          include: {
            materials: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!po) {
      throw new Error('Purchase order not found');
    }

    return po.purchase_order_items
      .filter((item) => item.materialId !== null)
      .map((item) => ({
        poItemId: item.id,
        materialId: item.materialId as string,
        materialCode: item.materials?.code || '',
        materialName: item.materials?.name || '',
        unit: item.unit,
        orderedQuantity: Number(item.orderedQuantity),
        totalReceivedQuantity: Number(item.receivedQuantity),
        pendingQuantity: Number(item.orderedQuantity) - Number(item.receivedQuantity),
        unitPrice: Number(item.unitPrice),
      }));
  }

  /**
   * Approve a GRN and create stock movements
   */
  async approveGRN(id: string, userId: string, warehouseId?: string, processingQC?: ProcessingQCData) {
    const grn = await prisma.goods_receiving_notes.findUnique({
      where: { id },
      include: {
        grn_items: {
          include: {
            purchase_order_items: true,
            grn_item_details: true,
          },
        },
      },
    });

    if (!grn) {
      throw new Error('GRN not found');
    }

    if (grn.status !== GRNStatus.PENDING_QC) {
      throw new Error(`Cannot approve GRN in ${grn.status} status`);
    }

    // Determine target warehouse
    const targetWarehouseId = warehouseId || grn.warehouseId;
    if (!targetWarehouseId) {
      throw new Error('Warehouse ID is required for GRN approval. Please specify a target warehouse.');
    }

    // Verify warehouse exists and is active
    const warehouse = await prisma.warehouses.findUnique({
      where: { id: targetWarehouseId },
    });
    if (!warehouse || !warehouse.isActive) {
      throw new Error('Invalid or inactive warehouse');
    }

    // Collector for non-critical, best-effort work that must run AFTER the transaction commits — its
    // failure must not roll back a valid receipt, and it must never open a nested tx inside ours.
    (grn as any).__postCommit = {
      updateProcessingPOStatus: false,
      sourcingUpdates: [] as Array<{ poId: string; fabricId: string; actualRate: number }>,
    };

    // Update GRN status in transaction with stock movements
    const updatedGRN = await prisma.$transaction(
      async (tx) => {
        // GUARDED status flip (PENDING_QC only): the pre-tx status check races with a concurrent
        // approve/reject — without this guard both could commit, double-netting the PO counters
        // (potentially negative) and double-writing stock (review catch).
        const flip = await tx.goods_receiving_notes.updateMany({
          where: { id, status: GRNStatus.PENDING_QC },
          data: {
            status: GRNStatus.ACCEPTED,
            approvedById: userId,
            warehouseId: targetWarehouseId,
          },
        });
        if (flip.count === 0) {
          throw new Error('GRN is no longer PENDING_QC — it was already approved or rejected');
        }
        const approved = await tx.goods_receiving_notes.findUniqueOrThrow({
          where: { id },
          include: this.getFullInclude(),
        });

        // Check PO category for processing-specific handling (Phase 4b: poId is nullable)
        const po = grn.poId
          ? await tx.purchase_orders.findUnique({
              where: { id: grn.poId },
              select: { id: true, poCategory: true, supplierId: true },
            })
          : null;

        // Phase 4b: PO-less receipt — the GRN keys on jobWorkOrderId alone
        if (!po && grn.jobWorkOrderId) {
          await this.approvePolessJwoGrnInTx(tx, grn, processingQC, targetWarehouseId, userId, id);
          return approved;
        }

        if (po?.poCategory === 'PROCESSING') {
          // For PROCESSING POs: create fabric_stock instead of stock_movements/stock_levels
          const jobWorkOrder = await tx.job_work_orders.findFirst({
            where: { purchaseOrderId: po.id },
            include: {
              greigeStockLot: { select: { id: true, purchaseCost: true } },
              fabricStockLot: { select: { id: true, purchaseCost: true } },
              style: { select: { id: true, styleCode: true } },
            },
          });

          if (jobWorkOrder && jobWorkOrder.finishedFabricId) {
            // Apply QC data if provided
            if (processingQC) {
              await tx.job_work_orders.update({
                where: { id: jobWorkOrder.id },
                data: {
                  qualityGrade: processingQC.qualityGrade,
                  colorMatchStatus: processingQC.colorMatchStatus || null,
                  defectMeters: processingQC.defectMeters || null,
                  defectType: processingQC.defectType || null,
                  actualRate: processingQC.actualRate || null,
                  remarks: processingQC.remarks
                    ? `${jobWorkOrder.remarks || ''}\n[QC via GRN] ${processingQC.remarks}`.trim()
                    : jobWorkOrder.remarks,
                  status: 'QUALITY_CHECKED',
                },
              });
            }

            // Create fabric_stock
            const qtyReceived = Number(jobWorkOrder.qtyReceivedMeters || 0);
            const defectMetersNum = Number(processingQC?.defectMeters || jobWorkOrder.defectMeters || 0);
            const goodQty = qtyReceived - defectMetersNum;
            const receivedWidth = Number(jobWorkOrder.receivedWidthInches || jobWorkOrder.sentWidthInches);
            const cutableWidth = receivedWidth > 2 ? receivedWidth - 2 : receivedWidth;
            const processingRate = Number(
              processingQC?.actualRate || jobWorkOrder.actualRate || jobWorkOrder.agreedRatePerMeter
            );
            const sourceCost = jobWorkOrder.greigeStockLot?.purchaseCost
              ? Number(jobWorkOrder.greigeStockLot.purchaseCost)
              : jobWorkOrder.fabricStockLot?.purchaseCost
                ? Number(jobWorkOrder.fabricStockLot.purchaseCost)
                : 0;
            // Decimal math for stock valuation (bug-hunt procurement-22)
            const totalCostPerMeter = roundToCent(addCurrency(processingRate, sourceCost)).toNumber();
            const qualityGrade = processingQC?.qualityGrade || jobWorkOrder.qualityGrade || 'A';
            const processType = jobWorkOrder.processType;
            const fabricFinishType = processType === 'PRINTING' ? 'PRINTED' : 'DYED';

            // Check if origin style requires embroidery for this fabric
            let styleNeedsEmbroidery = false;
            if (jobWorkOrder.styleId) {
              const embFabric = await tx.style_fabrics.findFirst({
                where: {
                  style_components: { styleId: jobWorkOrder.styleId },
                  hasEmbroidery: true,
                },
              });
              styleNeedsEmbroidery = !!embFabric;
            }

            // Good quality fabric_stock
            if (goodQty > 0) {
              await tx.fabric_stock.create({
                data: {
                  id: randomUUID(),
                  fabricId: jobWorkOrder.finishedFabricId,
                  finishedWidth: receivedWidth,
                  cutableWidth: cutableWidth,
                  quantityAvailable: goodQty,
                  quantityReserved: 0,
                  quantityConsumed: 0,
                  unit: 'meters',
                  originStyleId: jobWorkOrder.styleId,
                  status: 'AVAILABLE',
                  stockType: 'PLANNED_STOCK',
                  fabricFinishType: fabricFinishType,
                  weightedAvgCost: totalCostPerMeter,
                  purchaseCost: totalCostPerMeter,
                  qualityGrade: qualityGrade === 'Reject' ? 'B' : qualityGrade,
                  defectMeters: defectMetersNum,
                  receivedDate: jobWorkOrder.receivedDate || new Date(),
                  agingAlertSent: false,
                  agingDays: 0,
                  needsEmbroidery: styleNeedsEmbroidery,
                  createdById: userId,
                },
              });

              // Sync to stock_levels for unified inventory view
              await ensureMaterialRecord(jobWorkOrder.finishedFabricId, 'FABRIC', tx);
              await syncStockLevelQuantity(jobWorkOrder.finishedFabricId, goodQty, undefined, 'METER', tx);
            }

            // Defect fabric_stock at 50% cost
            if (defectMetersNum > 0 && qualityGrade !== 'B') {
              await tx.fabric_stock.create({
                data: {
                  id: randomUUID(),
                  fabricId: jobWorkOrder.finishedFabricId,
                  finishedWidth: receivedWidth,
                  cutableWidth: cutableWidth,
                  quantityAvailable: defectMetersNum,
                  quantityReserved: 0,
                  quantityConsumed: 0,
                  unit: 'meters',
                  originStyleId: jobWorkOrder.styleId,
                  status: 'AVAILABLE',
                  stockType: 'PLANNED_STOCK',
                  fabricFinishType: fabricFinishType,
                  weightedAvgCost: roundToCent(multiplyCurrency(totalCostPerMeter, 0.5)).toNumber(),
                  purchaseCost: roundToCent(multiplyCurrency(totalCostPerMeter, 0.5)).toNumber(),
                  qualityGrade: 'B',
                  defectMeters: defectMetersNum,
                  receivedDate: jobWorkOrder.receivedDate || new Date(),
                  agingAlertSent: false,
                  agingDays: 0,
                  needsEmbroidery: styleNeedsEmbroidery,
                  createdById: userId,
                },
              });

              // Sync defect fabric to stock_levels
              await ensureMaterialRecord(jobWorkOrder.finishedFabricId, 'FABRIC', tx);
              await syncStockLevelQuantity(jobWorkOrder.finishedFabricId, defectMetersNum, undefined, 'METER', tx);
            }

            // Consume from processor's greige_stock (created when outward challan was issued)
            if (jobWorkOrder.outwardChallanId) {
              const processorGreigeStock = await tx.greige_stock.findFirst({
                where: { sourceChallanId: jobWorkOrder.outwardChallanId },
              });

              if (processorGreigeStock) {
                const processorAvailable = Number(processorGreigeStock.quantityAvailable);
                const qtyToConsume = Math.min(qtyReceived, processorAvailable);

                if (qtyToConsume > 0) {
                  const newAvailable = processorAvailable - qtyToConsume;
                  await tx.greige_stock.update({
                    where: { id: processorGreigeStock.id },
                    data: {
                      quantityAvailable: newAvailable,
                      quantityConsumed: { increment: qtyToConsume },
                      lastConsumedDate: new Date(),
                      status: newAvailable <= 0 ? 'EXHAUSTED' : 'AVAILABLE',
                    },
                  });

                  // Create transaction record for audit trail
                  await tx.greige_stock_transaction.create({
                    data: {
                      stockId: processorGreigeStock.id,
                      transactionType: 'RECEIPT', // Receiving goods returned from processor
                      quantity: -qtyToConsume,
                      balanceAfter: newAvailable,
                      referenceType: 'GRN',
                      referenceId: id,
                      notes: `Consumed via GRN ${grn.grnNumber} - goods returned from processor`,
                      performedById: userId,
                    },
                  });

                  logInfo(`Consumed ${qtyToConsume}m from processor greige_stock`, {
                    grnId: id,
                    processorStockId: processorGreigeStock.id,
                    remaining: newAvailable,
                  });
                }
              }
            }

            // Update job status to STOCK_UPDATED and stamp the GRN link (BUG-JWC3: grnId was
            // never written anywhere, so reverseProcessingGRNInTx could never find the JWO)
            await tx.job_work_orders.update({
              where: { id: jobWorkOrder.id },
              data: { status: 'STOCK_UPDATED', grnId: id },
            });

            // Flip the PO to RECEIVED via a guarded updateMany (bug-hunt procurement-20).
            // RECEIVED-with-shrinkage is intentional for PROCESSING POs (received meters < ordered
            // is normal mill shrinkage), but only flip from receivable statuses.
            await tx.purchase_orders.updateMany({
              where: {
                id: po.id,
                status: {
                  in: [
                    PurchaseOrderStatus.SENT,
                    PurchaseOrderStatus.ACKNOWLEDGED,
                    PurchaseOrderStatus.PARTIALLY_RECEIVED,
                  ],
                },
              },
              data: { status: PurchaseOrderStatus.RECEIVED },
            });

            // Per-item receivedQuantity was already incremented by poItemId at createGRN (bug-hunt
            // procurement-20: this branch used to ASSIGN the job's total meters onto poItems[0]
            // only, clobbering those increments and ignoring any other PO items). Only the
            // degenerate case of a processing GRN created with no item rows still records here.
            if (!grn.grn_items || grn.grn_items.length === 0) {
              const firstPoItem = await tx.purchase_order_items.findFirst({
                where: { poId: po.id },
              });
              if (firstPoItem) {
                await tx.purchase_order_items.update({
                  where: { id: firstPoItem.id },
                  data: { receivedQuantity: { increment: qtyReceived } },
                });
              }
            }

            logInfo(`PROCESSING PO approved via GRN - fabric_stock created`, {
              grnId: id,
              poId: po.id,
              goodQty,
              defectQty: defectMetersNum,
              costPerMeter: totalCostPerMeter,
            });
          } else {
            // P2.8: MRP-generated PROCESSING POs historically have no job_work_orders.
            // BUG-JWC4: also land here when a JWO exists but has no finishedFabricId yet
            // (JWC-bridged JWO received via GRN before the send flow ran) — previously that
            // combination fell through BOTH branches and approved with NO stock created.
            logInfo('PROCESSING PO fallback path (no JWO, or JWO without finishedFabricId)', {
              poId: po.id,
              hasJobWorkOrder: !!jobWorkOrder,
            });

            // Get the linked PROCESSING requirement via requirement_po_links
            const poLink = await tx.requirement_po_links.findFirst({
              where: { purchaseOrderId: po.id },
              include: {
                material_requirements: {
                  include: {
                    materials: {
                      select: { id: true, greigeId: true, materialType: true },
                    },
                    orders: { select: { id: true } },
                    order_items: {
                      select: {
                        styleId: true,
                        styles: { select: { id: true, styleCode: true, buyerStyleRef: true } },
                      },
                    },
                    processor: { select: { id: true, supplierCategories: true } },
                  },
                },
              },
            });

            if (poLink?.material_requirements) {
              const req = poLink.material_requirements;
              const greigeId = req.materials?.greigeId;

              if (greigeId) {
                // Get GRN item quantities
                const grnItem = grn.grn_items?.[0];
                const qtyReceived = grnItem ? Number(grnItem.acceptedQuantity || grnItem.receivedQuantity || 0) : 0;
                const receivedWidth = grnItem ? Number(grnItem.receivedWidthInches || 44) : 44;

                if (qtyReceived > 0) {
                  // Determine finish type from processor category or requirement printingType
                  // supplierCategories is an array; check if DYEING_PRINTING is included
                  const processorCategory = req.processor?.supplierCategories?.includes('DYEING_PRINTING')
                    ? 'DYEING_PRINTING'
                    : null;
                  const finishType = determineFinishType(processorCategory, req.printingType);

                  // Get or create the finished fabric_master
                  const fabricResult = await getOrCreateFinishedFabric(
                    {
                      greigeId,
                      colorName: req.colorName || 'Natural',
                      finishType,
                      widthInches: receivedWidth,
                      styleCode: req.order_items?.styles?.styleCode,
                      styleId: req.order_items?.styleId,
                      buyerStyleRef: req.order_items?.styles?.buyerStyleRef,
                      userId,
                    },
                    tx
                  );

                  // Get processing cost from requirement
                  const processingRate = req.processingCost ? Number(req.processingCost) : 0;
                  // TODO: Get source greige cost from linked greige requirement's GRN
                  const sourceCost = 0; // For now, just use processing cost
                  const totalCostPerMeter = roundToCent(addCurrency(processingRate, sourceCost)).toNumber();

                  const cutableWidth = receivedWidth > 2 ? receivedWidth - 2 : receivedWidth;
                  const fabricFinishType = finishType === 'PRINTED' ? 'PRINTED' : 'DYED';
                  // One timestamp shared by fabric_stock and the JWO stamp — GRN reversal
                  // matches fabric_stock rows by exact receivedDate equality
                  const receivedAt = new Date();

                  // Create fabric_stock
                  await tx.fabric_stock.create({
                    data: {
                      id: randomUUID(),
                      fabricId: fabricResult.fabricId,
                      finishedWidth: receivedWidth,
                      cutableWidth: cutableWidth,
                      quantityAvailable: qtyReceived,
                      quantityReserved: 0,
                      quantityConsumed: 0,
                      unit: 'meters',
                      originStyleId: req.order_items?.styleId || null,
                      status: 'AVAILABLE',
                      stockType: 'PLANNED_STOCK',
                      fabricFinishType: fabricFinishType,
                      weightedAvgCost: totalCostPerMeter,
                      purchaseCost: totalCostPerMeter,
                      qualityGrade: processingQC?.qualityGrade || DEFAULT_QUALITY_GRADE,
                      defectMeters: processingQC?.defectMeters || 0,
                      receivedDate: receivedAt,
                      agingAlertSent: false,
                      agingDays: 0,
                      needsEmbroidery: false,
                      createdById: userId,
                      warehouseId: targetWarehouseId,
                    },
                  });

                  // Sync to stock_levels
                  await syncStockLevelQuantity(fabricResult.fabricId, qtyReceived, targetWarehouseId, 'METER', tx);

                  // Update PO status to RECEIVED
                  await tx.purchase_orders.updateMany({
                    where: {
                      id: po.id,
                      status: {
                        in: [
                          PurchaseOrderStatus.SENT,
                          PurchaseOrderStatus.ACKNOWLEDGED,
                          PurchaseOrderStatus.PARTIALLY_RECEIVED,
                          PurchaseOrderStatus.READY_FOR_PROCESSING,
                        ],
                      },
                    },
                    data: { status: PurchaseOrderStatus.RECEIVED },
                  });

                  // BUG-JWC4: if a (bridged) JWO exists, stamp it so the job-work views and
                  // GRN reversal see the receipt — previously this case created no stock at all
                  if (jobWorkOrder) {
                    await tx.job_work_orders.update({
                      where: { id: jobWorkOrder.id },
                      data: {
                        finishedFabricId: fabricResult.fabricId,
                        qtyReceivedMeters: qtyReceived,
                        receivedDate: receivedAt,
                        grnId: id,
                        status: 'STOCK_UPDATED',
                      },
                    });
                  }

                  logInfo(`MRP PROCESSING PO approved via GRN - fabric_stock created`, {
                    grnId: id,
                    poId: po.id,
                    fabricId: fabricResult.fabricId,
                    fabricCode: fabricResult.fabricCode,
                    isNewFabric: fabricResult.isNew,
                    qtyReceived,
                    costPerMeter: totalCostPerMeter,
                    jwoStamped: !!jobWorkOrder,
                  });
                }
              } else {
                logWarn('PROCESSING requirement has no greigeId - cannot create fabric_stock', {
                  poId: po.id,
                  requirementId: req.id,
                });
              }
            } else {
              logWarn('No requirement linked to PROCESSING PO - cannot create fabric_stock', {
                poId: po.id,
              });
            }
          }

          // BUG-JWC7 (Phase 4a): mirror of the generic loop's MRP bridge below — the PROCESSING
          // branch early-returns before it, so requirements never advanced past PO_GENERATED
          // while reverseGRN still decremented (a reversal could push a never-incremented
          // requirement to PO_SENT). acceptedQuantity only: createGRN enforces
          // accepted+rejected=received and reversal decrements acceptedQuantity — symmetric.
          for (const item of grn.grn_items || []) {
            const acceptedQty = Number(item.acceptedQuantity);
            if (acceptedQty > 0 && item.poItemId) {
              await mrpService.updateReceivedQuantity(item.poItemId, acceptedQty, tx);
            }
          }

          return approved; // Skip normal stock_movements/stock_levels
        }

        // PO categories that have specialized stock tables - their stock_levels
        // are managed by the specialized flow (greige_stock, fabric_stock, etc.)
        // to avoid double-incrementing stock_levels
        const specializedCategories = [
          'GREIGE',
          'FABRIC',
          'LACE',
          'GREIGE_LACE',
          'THREAD',
          'BUTTON',
          'ZIPPER',
          'ELASTIC',
          'LABEL',
          'PACKAGING',
          'MACHINE_PART',
          'OTHER_MATERIAL',
        ];
        const hasSpecializedHandling = specializedCategories.includes(po?.poCategory || '');

        // Create stock movements and update stock levels for accepted items
        for (const item of grn.grn_items) {
          const acceptedQty = Number(item.acceptedQuantity);
          if (acceptedQty > 0) {
            // Get unit price from PO item for stock valuation
            const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

            const totalValue = roundToCent(multiplyCurrency(acceptedQty, unitPrice)).toNumber();

            // Create stock movement record (audit trail - always created)
            await tx.stock_movements.create({
              data: {
                id: randomUUID(),
                movementType: MovementType.STOCK_IN,
                materialId: item.materialId,
                warehouseId: targetWarehouseId,
                supplierId: grn.supplierId, // Direct supplier reference
                quantity: acceptedQty,
                unit: item.unit,
                referenceType: 'GRN',
                referenceId: grn.id,
                referenceNumber: grn.grnNumber,
                rate: unitPrice,
                value: totalValue,
                remarks: `Stock received from GRN ${grn.grnNumber}`,
                performedById: userId,
                movementDate: new Date(),
              },
            });

            // Update stock_levels only for POs WITHOUT specialized handling
            // (GREIGE, FABRIC, LACE, THREAD have their own *_stock tables that sync to stock_levels)
            if (!hasSpecializedHandling) {
              const existingStock = await tx.stock_levels.findFirst({
                where: {
                  materialId: item.materialId,
                  warehouseId: targetWarehouseId,
                },
              });

              if (existingStock) {
                await tx.stock_levels.update({
                  where: { id: existingStock.id },
                  data: {
                    quantity: { increment: acceptedQty },
                    lastUpdated: new Date(),
                  },
                });
              } else {
                await tx.stock_levels.create({
                  data: {
                    id: randomUUID(),
                    materialId: item.materialId,
                    warehouseId: targetWarehouseId,
                    quantity: acceptedQty,
                    unit: item.unit,
                    minLevel: 0,
                    reorderLevel: 0,
                  },
                });
              }
            }

            // MRP received-qty update, now ATOMIC with the approval — updateReceivedQuantity is tx-aware and
            // no longer opens a nested tx, so running it on `tx` closes the over-procurement gap (a committed
            // receipt MRP never saw → duplicate PO) without the second-connection/deadlock risk (F4 #12).
            if (item.poItemId) {
              await mrpService.updateReceivedQuantity(item.poItemId, acceptedQty, tx);
            }
          }

          // Track rejected quantities as audit trail — and NET THEM OUT of the PO's received counter
          // (bug-hunt procurement-7: createGRN increments receivedQuantity by the GROSS receipt pre-QC;
          // without this decrement, QC-rejected quantity stayed counted as "received" forever, the PO
          // closed as RECEIVED, and the rejected goods were never re-procured. This also makes the PO
          // counter agree with the MRP link, which was already updated with ACCEPTED qty only).
          const rejectedQty = Number(item.rejectedQuantity || 0);
          if (rejectedQty > 0) {
            if (item.poItemId) {
              await tx.purchase_order_items.update({
                where: { id: item.poItemId },
                data: { receivedQuantity: { decrement: rejectedQty } },
              });
            }
            await tx.stock_movements.create({
              data: {
                id: randomUUID(),
                movementType: MovementType.ADJUSTMENT_OUT,
                materialId: item.materialId,
                warehouseId: targetWarehouseId,
                supplierId: grn.supplierId, // Direct supplier reference
                quantity: rejectedQty,
                unit: item.unit,
                referenceType: 'GRN_REJECTION',
                referenceId: grn.id,
                referenceNumber: grn.grnNumber,
                rate: item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0,
                value: roundToCent(
                  multiplyCurrency(
                    rejectedQty,
                    item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0
                  )
                ).toNumber(),
                remarks: `Rejected during GRN ${grn.grnNumber} — pending supplier return/credit`,
                performedById: userId,
                movementDate: new Date(),
              },
            });
          }
        }

        // Create the ACTUAL specialized per-lot stock records INSIDE this transaction, so that any
        // stock-write failure rolls back the whole approval (bug-hunt T1-1/F4). Previously these ran
        // AFTER commit with per-category error swallowing, which could leave an ACCEPTED GRN with no
        // stock ("books say received, shelf says empty").
        if (po) {
          await this.createSpecializedStockInTx(tx, grn, po, userId, targetWarehouseId);
        }

        return approved;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Best-effort downstream cascades — run AFTER the transaction commits. These are genuinely
    // non-critical (PO status recompute + future-sourcing cost-sheet update); their failure must
    // NOT roll back a valid receipt, so they only log.
    const postCommit = (grn as any).__postCommit as
      | {
          updateProcessingPOStatus?: boolean;
          sourcingUpdates?: Array<{ poId: string; fabricId: string; actualRate: number }>;
        }
      | undefined;

    // BUG-PROC4 fix: Collect warnings from post-commit operations to notify frontend
    const postCommitWarnings: string[] = [];

    // P2: Recompute PO receiving status FIRST, before processing activation.
    // checkProcessingPOReadiness relies on PO status being RECEIVED, so this must run first.
    // SKIPPED for PROCESSING POs: their approval branch sets RECEIVED itself with shrinkage
    // semantics — received < ordered is NORMAL there, and a naive recompute would wrongly
    // demote every shrinkage-bearing processing PO to PARTIALLY_RECEIVED.
    let poCategory: string | null = null;
    // Phase 4b: PO-less (JWO-keyed) GRNs have no PO status to recompute
    if (grn.poId) {
      try {
        const poCat = await prisma.purchase_orders.findUnique({
          where: { id: grn.poId },
          select: { poCategory: true },
        });
        poCategory = poCat?.poCategory || null;
        if (poCategory !== 'PROCESSING') {
          await purchaseOrderService.updateReceivingStatus(grn.poId);
        }
      } catch (statusErr) {
        const errMsg = 'Failed to recompute PO receiving status';
        logError(errMsg, statusErr);
        postCommitWarnings.push(errMsg);
      }
    }

    // P2: Processing activation — checkProcessingPOReadiness handles BOTH GREIGE and GREIGE_LACE
    // categories, and relies on PO status being RECEIVED.
    if (grn.poId && (postCommit?.updateProcessingPOStatus || poCategory === 'GREIGE' || poCategory === 'GREIGE_LACE')) {
      try {
        const readiedPOs = await checkProcessingPOReadiness(grn.poId);
        if (readiedPOs.length > 0) {
          logInfo(`Processing POs readied after greige receipt: ${readiedPOs.join(', ')}`, {
            grnId: id,
            greigePOId: grn.poId,
            readiedPOs,
          });
        }
      } catch (error) {
        const errMsg = 'Failed to auto-update Processing PO status';
        logError(errMsg, error);
        postCommitWarnings.push(errMsg);
      }
    }

    for (const su of postCommit?.sourcingUpdates ?? []) {
      try {
        const costSheetResult = await updateCostSheetSourcingStrategy(su.poId, su.fabricId, su.actualRate, prisma);
        if (costSheetResult.updatedItems > 0) {
          logInfo(`Updated cost sheet sourcing strategy for ${costSheetResult.affectedStyles.length} style(s)`, {
            grnId: id,
            fabricId: su.fabricId,
            updatedItems: costSheetResult.updatedItems,
            affectedStyles: costSheetResult.affectedStyles,
          });
        }
      } catch (costSheetErr) {
        const errMsg = `Failed to update cost sheet sourcing strategy for fabric ${su.fabricId}`;
        logError(errMsg, costSheetErr);
        postCommitWarnings.push(errMsg);
      }
    }

    // BUG-PROC4 fix: Return warnings with the GRN so frontend can notify user
    return {
      ...updatedGRN,
      _warnings: postCommitWarnings.length > 0 ? postCommitWarnings : undefined,
    };
  }

  /**
   * Create the ACTUAL specialized per-lot stock records for a GRN receipt, INSIDE the approval
   * transaction. Every write uses the passed transaction client (`tx`) so a failure in any category
   * rolls back the entire GRN approval (bug-hunt T1-1/F4) rather than committing an ACCEPTED GRN with
   * no stock behind it.
   *
   * Non-critical downstream cascades (updateProcessingPOStatusOnGreigeGRN + updateCostSheetSourcingStrategy)
   * are NOT executed here — they are collected onto `grn.__postCommit` and run best-effort AFTER commit.
   *
   * `warehouseId` is the validated, non-null target warehouse — every specialized stock row and its
   * stock_levels sync is written against it (Rule A: every stock row has a warehouse).
   */
  private async createSpecializedStockInTx(
    tx: Prisma.TransactionClient,
    grn: any,
    po: { id: string; poCategory: string | null; supplierId: string | null },
    userId: string,
    warehouseId: string
  ): Promise<void> {
    const postCommit = (grn.__postCommit = grn.__postCommit || {
      updateProcessingPOStatus: false,
      sourcingUpdates: [] as Array<{ poId: string; fabricId: string; actualRate: number }>,
    });

    // ===== GREIGE (with receivedAsReadyFabric override support) =====
    if (po.poCategory === 'GREIGE') {
      const overrideItems = grn.grn_items.filter((item: any) => item.receivedAsReadyFabric);
      const normalItems = grn.grn_items.filter((item: any) => !item.receivedAsReadyFabric);

      // Handle receivedAsReadyFabric override items
      if (overrideItems.length > 0) {
        logInfo(`GRN ${grn.grnNumber}: ${overrideItems.length} item(s) received as ready fabric`, {
          grnId: grn.id,
          greigePOId: po.id,
        });

        // Validate the override can be applied (pre-flight checks)
        const validation = await validateSourceMismatchOverride(po.id, tx);
        if (!validation.canOverride) {
          // Log but don't fail - items fall back to the normal greige flow
          logError(`Source mismatch override blocked: ${validation.blockReason}`, {
            grnId: grn.id,
            greigePOId: po.id,
          });
          normalItems.push(...overrideItems);
          overrideItems.length = 0;
        } else {
          // Validation passed - run cleanup on the SAME transaction (no separate inner $transaction)
          const cleanupResult = await executeSourceMismatchCleanup(po.id, tx);
          logInfo(`Source mismatch cleanup completed`, {
            grnId: grn.id,
            greigePOId: po.id,
            cancelledPOs: cleanupResult.cancelledPOs,
            cancelledBatches: cleanupResult.cancelledBatches,
            cancelledChallans: cleanupResult.cancelledChallans,
          });

          // Create fabric_stock for override items
          for (const item of overrideItems) {
            const acceptedQty = Number(item.acceptedQuantity);
            if (acceptedQty <= 0) continue;

            // Get material to find greigeId, then find linked fabric
            const material = await tx.materials.findUnique({
              where: { id: item.materialId },
              include: { greige_master: true },
            });

            if (!material?.greigeId || !material.greige_master) {
              logError(
                `GRN item ${item.id}: material ${item.materialId} has no greige link, cannot create fabric_stock`,
                { itemId: item.id }
              );
              continue;
            }

            const greige = material.greige_master;

            // Find the fabric_master linked to this greige
            const fabric = await findFabricForGreige(greige.id, tx);
            if (!fabric) {
              logError(`No fabric_master linked to greige ${greige.greigeCode}. Cannot create fabric_stock.`, {
                grnId: grn.id,
                greigeId: greige.id,
                itemId: item.id,
              });
              continue;
            }

            // Determine the rate: use actualRatePerUnit if provided, otherwise PO rate
            const actualRate = item.actualRatePerUnit
              ? Number(item.actualRatePerUnit)
              : item.purchase_order_items
                ? Number(item.purchase_order_items.unitPrice)
                : 0;

            // Use per-item received width if available, otherwise default
            const finishedWidth = item.receivedWidthInches ? Number(item.receivedWidthInches) : 44;
            const cutableWidth = finishedWidth > 2 ? finishedWidth - 2 : finishedWidth;

            // Ensure material record exists for this fabric
            await ensureMaterialRecord(fabric.id, 'FABRIC', tx);

            // Create fabric_stock instead of greige_stock
            await tx.fabric_stock.create({
              data: {
                fabricId: fabric.id,
                finishedWidth: finishedWidth,
                cutableWidth: cutableWidth,
                quantityAvailable: acceptedQty,
                quantityReserved: 0,
                quantityConsumed: 0,
                unit: 'meters',
                status: 'AVAILABLE',
                stockType: 'PLANNED_STOCK',
                qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
                weightedAvgCost: actualRate,
                purchaseCost: actualRate,
                receivedDate: grn.receivingDate || new Date(),
                warehouseId: warehouseId,
                createdById: userId,
              },
            });

            // Sync stock_levels for the fabric
            await syncStockLevelQuantity(fabric.id, acceptedQty, warehouseId, undefined, tx);

            // Create fabric_procurement record for audit trail
            await tx.fabric_procurement.create({
              data: {
                fabricId: fabric.id,
                procurementType: 'FINISHED',
                supplierId: grn.supplierId,
                ratePerUnit: actualRate,
                quantityPurchased: acceptedQty,
                width: finishedWidth,
                totalCost: roundToCent(multiplyCurrency(acceptedQty, actualRate)).toNumber(),
                receivedDate: grn.receivingDate || new Date(),
                status: 'COMPLETED',
                createdById: userId,
              },
            });

            logInfo(
              `Created fabric_stock (override): GRN ${grn.grnNumber}, ${acceptedQty}m of ${fabric.fabricCode} at ₹${actualRate}/m`,
              {
                grnId: grn.id,
                fabricId: fabric.id,
                greigeId: greige.id,
                quantity: acceptedQty,
                rate: actualRate,
                wasOverride: true,
              }
            );

            // Defer the cost-sheet sourcing-strategy update (non-critical cascade) to post-commit
            if (item.updateFutureSourcing) {
              postCommit.sourcingUpdates.push({ poId: po.id, fabricId: fabric.id, actualRate });
            }
          }
        }
      }

      // Handle normal greige items (not overridden)
      if (normalItems.length > 0) {
        // Defer Processing PO status recompute (non-critical cascade) to post-commit
        postCommit.updateProcessingPOStatus = true;

        // Auto-create greige_stock entries for accepted greige items
        for (const item of normalItems) {
          const acceptedQty = Number(item.acceptedQuantity);
          if (acceptedQty <= 0) continue;

          // Get material to find greigeId
          const material = await tx.materials.findUnique({
            where: { id: item.materialId },
            include: { greige_master: true },
          });

          if (!material?.greigeId || !material.greige_master) {
            logInfo(
              `GRN item ${item.id}: material ${item.materialId} has no greige link, skipping greige_stock creation`
            );
            continue;
          }

          const greige = material.greige_master;
          const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

          // Use per-item received width if available, otherwise fall back to greige master width
          const greigeWidth = item.receivedWidthInches
            ? Number(item.receivedWidthInches)
            : Number(greige.greigeWidth || 44);

          // skipMaterialSync so createGreigeStock does NOT run its own ensureMaterialRecord /
          // syncStockLevelQuantity on the GLOBAL prisma client (that stock_levels increment would commit
          // OUTSIDE this transaction and survive a rollback). We sync below on `tx` using the actual
          // (fold-length-adjusted) quantity the service computed, so stock_levels rolls back with the
          // receipt like every other category (bug-hunt T1-1).
          const createdGreige = await greigeStockService.createGreigeStock(
            {
              greigeId: greige.id,
              quantity: acceptedQty, // This is nominal quantity from supplier
              width: greigeWidth,
              purchaseCost: unitPrice,
              supplierId: grn.supplierId,
              receivedDate: grn.receivingDate,
              warehouseId: warehouseId,
              qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
              sourceType: 'GRN', // Track that this stock came from GRN receipt
              // Pass fold length for actual quantity calculation
              foldLengthCm: item.foldLengthCm ? Number(item.foldLengthCm) : undefined,
              thanCount: item.thanCount || undefined,
              tx,
              skipMaterialSync: true,
              // P2: Identity-based reversal
              grnItemId: item.id,
            },
            userId
          );

          // P2: Store actualQuantity on the grn_item (physical qty after fold adjustment)
          // Documents stay NOMINAL (receivedQuantity), stock is ACTUAL (quantityAvailable)
          const actualQty = Number(createdGreige.quantityAvailable);
          await tx.grn_items.update({
            where: { id: item.id },
            data: { actualQuantity: new Prisma.Decimal(actualQty) },
          });

          await ensureMaterialRecord(greige.id, 'GREIGE', tx);
          await syncStockLevelQuantity(greige.id, actualQty, warehouseId, undefined, tx);

          logInfo(`Auto-created greige_stock from GRN ${grn.grnNumber}: ${acceptedQty}m of ${greige.greigeCode}`, {
            grnId: grn.id,
            greigeId: greige.id,
            quantity: acceptedQty,
          });
        }
      }
    }

    // ===== FABRIC =====
    if (po.poCategory === 'FABRIC') {
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          select: {
            fabricId: true,
            fabric_master: {
              select: { id: true, actualWidth: true, cutableWidth: true },
            },
          },
        });

        if (!material?.fabricId || !material.fabric_master) {
          logInfo(
            `GRN item ${item.id}: material ${item.materialId} has no fabric link, skipping fabric_stock creation`
          );
          continue;
        }

        const fabric = material.fabric_master;
        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;
        // Use per-item received width if available, otherwise fall back to fabric master width
        const actualWidth = item.receivedWidthInches
          ? Number(item.receivedWidthInches)
          : Number(fabric.actualWidth || 0);
        const cutableWidth = Number(fabric.cutableWidth || (actualWidth > 2 ? actualWidth - 2 : actualWidth));

        await tx.fabric_stock.create({
          data: {
            fabricId: fabric.id,
            finishedWidth: actualWidth,
            cutableWidth: cutableWidth,
            quantityAvailable: acceptedQty,
            quantityReserved: 0,
            quantityConsumed: 0,
            unit: 'meters',
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            weightedAvgCost: unitPrice,
            purchaseCost: unitPrice,
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            createdById: userId,
          },
        });

        // Ensure materials record + sync stock_levels
        await ensureMaterialRecord(fabric.id, 'FABRIC', tx);
        await syncStockLevelQuantity(fabric.id, acceptedQty, warehouseId, undefined, tx);

        logInfo(
          `Auto-created fabric_stock from FABRIC GRN ${grn.grnNumber}: ${acceptedQty}m of fabricId=${fabric.id}`,
          {
            grnId: grn.id,
            fabricId: fabric.id,
            quantity: acceptedQty,
          }
        );
      }
    }

    // ===== LACE / GREIGE_LACE =====
    if (po.poCategory === 'LACE' || po.poCategory === 'GREIGE_LACE') {
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          select: {
            laceId: true,
            lace_master: {
              select: { id: true, laceCode: true },
            },
          },
        });

        if (!material?.laceId || !material.lace_master) {
          logInfo(`GRN item ${item.id}: material ${item.materialId} has no lace link, skipping lace_stock creation`);
          continue;
        }

        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

        await tx.lace_stock.create({
          data: {
            laceId: material.lace_master.id,
            quantityAvailable: acceptedQty,
            quantityReserved: 0,
            quantityConsumed: 0,
            unit: 'meters',
            status: 'AVAILABLE',
            stockType: 'PLANNED_STOCK',
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            weightedAvgCost: unitPrice,
            purchaseCost: unitPrice,
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            procurementId: grn.poId || undefined,
            createdById: userId,
          },
        });

        // Ensure materials record + sync stock_levels
        await ensureMaterialRecord(material.lace_master.id, 'LACE', tx);
        await syncStockLevelQuantity(material.lace_master.id, acceptedQty, warehouseId, undefined, tx);

        logInfo(
          `Auto-created lace_stock from LACE GRN ${grn.grnNumber}: ${acceptedQty}m of laceId=${material.lace_master.id}`,
          { grnId: grn.id, laceId: material.lace_master.id, quantity: acceptedQty }
        );
      }
    }

    // ===== THREAD =====
    if (po.poCategory === 'THREAD') {
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          select: {
            threadId: true,
            thread_master: {
              select: {
                id: true,
                threadCode: true,
                threadName: true,
                ply: true,
                packagingType: true,
                materialComposition: true,
                color: true,
                colorId: true,
                colorMaster: { select: { colorName: true } },
              },
            },
          },
        });

        if (!material?.threadId || !material.thread_master) {
          logInfo(
            `GRN item ${item.id}: material ${item.materialId} has no thread link, skipping thread_stock creation`
          );
          continue;
        }

        const thread = material.thread_master;
        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

        // Determine unit from PO item or thread master
        const poUnit = item.purchase_order_items?.unit || 'SPOOL';
        const packagingType = thread.packagingType || 'SPOOL';

        // Calculate derived quantities from packaging specs
        let metersAvailable: number | null = null;
        let boxesAvailable: number | null = null;

        const spec = await tx.thread_packaging_specs.findFirst({
          where: { ply: thread.ply || undefined, packagingType: packagingType, isActive: true },
        });

        if (spec) {
          metersAvailable = acceptedQty * Number(spec.metersPerUnit);
          boxesAvailable = spec.unitsPerBox > 0 ? acceptedQty / spec.unitsPerBox : null;
        }

        await tx.thread_stock.create({
          data: {
            threadId: thread.id,
            quantityAvailable: acceptedQty,
            quantityReserved: 0,
            quantityConsumed: 0,
            unit: poUnit,
            metersAvailable,
            boxesAvailable,
            purchaseCost: unitPrice,
            weightedAvgCost: unitPrice,
            ply: thread.ply,
            packagingType: thread.packagingType,
            materialComposition: thread.materialComposition,
            colorName: thread.colorMaster?.colorName || thread.color || null,
            status: 'AVAILABLE',
            stockType: 'PLANNED_STOCK',
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            procurementId: grn.poId || undefined,
            createdById: userId,
          },
        });

        // Create stock transaction
        const stockEntry = await tx.thread_stock.findFirst({
          where: { threadId: thread.id, procurementId: grn.poId },
          orderBy: { createdAt: 'desc' },
        });

        if (stockEntry) {
          await tx.thread_stock_transaction.create({
            data: {
              stockId: stockEntry.id,
              transactionType: 'STOCK_IN',
              quantity: acceptedQty,
              balanceAfter: acceptedQty,
              referenceType: 'GRN',
              referenceId: grn.id,
              notes: `GRN ${grn.grnNumber} - ${thread.threadCode}`,
              performedById: userId,
            },
          });
        }

        // Update linked thread requirements status to RECEIVED
        if (item.purchase_order_items?.id) {
          await tx.order_thread_requirements.updateMany({
            where: { poItemId: item.purchase_order_items.id },
            data: { status: 'RECEIVED' },
          });
        }

        // Ensure materials record + sync stock_levels
        await ensureMaterialRecord(thread.id, 'THREAD', tx);
        await syncStockLevelQuantity(thread.id, acceptedQty, warehouseId, undefined, tx);

        logInfo(
          `Auto-created thread_stock from THREAD GRN ${grn.grnNumber}: ${acceptedQty} ${poUnit} of threadId=${thread.id}`,
          { grnId: grn.id, threadId: thread.id, quantity: acceptedQty, meters: metersAvailable }
        );
      }
    }

    // ===== BUTTON =====
    if (po.poCategory === 'BUTTON') {
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          include: { button_master: true },
        });

        if (!material?.buttonId || !material.button_master) {
          logInfo(`GRN item ${item.id}: no button link, skipping button_stock`);
          continue;
        }

        const button = material.button_master;
        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

        // BUG-BTN5 fix: Use Prisma.Decimal for monetary values to avoid floating point errors
        await tx.button_stock.create({
          data: {
            buttonId: button.id,
            quantityAvailable: new Prisma.Decimal(acceptedQty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: item.unit || 'pieces',
            purchaseCost: new Prisma.Decimal(unitPrice),
            weightedAvgCost: new Prisma.Decimal(unitPrice),
            supplierId: grn.supplierId,
            sourceType: 'GRN',
            procurementId: grn.poId,
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            status: 'AVAILABLE',
            stockType: 'PLANNED_STOCK',
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            createdById: userId,
          },
        });

        await ensureMaterialRecord(button.id, 'BUTTON', tx);
        await syncStockLevelQuantity(button.id, acceptedQty, warehouseId, undefined, tx);

        logInfo(`Auto-created button_stock from GRN ${grn.grnNumber}: ${acceptedQty} of ${button.buttonCode}`);
      }
    }

    // ===== ZIPPER =====
    if (po.poCategory === 'ZIPPER') {
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          include: { zipper_master: true },
        });

        if (!material?.zipperId || !material.zipper_master) {
          logInfo(`GRN item ${item.id}: no zipper link, skipping zipper_stock`);
          continue;
        }

        const zipper = material.zipper_master;
        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

        // BUG-LBL5 fix: Use Prisma.Decimal for monetary values to avoid floating point errors (same pattern as button/label)
        await tx.zipper_stock.create({
          data: {
            zipperId: zipper.id,
            quantityAvailable: new Prisma.Decimal(acceptedQty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: item.unit || 'pieces',
            purchaseCost: new Prisma.Decimal(unitPrice),
            weightedAvgCost: new Prisma.Decimal(unitPrice),
            supplierId: grn.supplierId,
            sourceType: 'GRN',
            procurementId: grn.poId,
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            status: 'AVAILABLE',
            stockType: 'PLANNED_STOCK',
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            createdById: userId,
          },
        });

        await ensureMaterialRecord(zipper.id, 'ZIPPER', tx);
        await syncStockLevelQuantity(zipper.id, acceptedQty, warehouseId, undefined, tx);

        logInfo(`Auto-created zipper_stock from GRN ${grn.grnNumber}: ${acceptedQty} of ${zipper.zipperCode}`);
      }
    }

    // ===== ELASTIC =====
    if (po.poCategory === 'ELASTIC') {
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          include: { elastic_master: true },
        });

        if (!material?.elasticId || !material.elastic_master) {
          logInfo(`GRN item ${item.id}: no elastic link, skipping elastic_stock`);
          continue;
        }

        const elastic = material.elastic_master;
        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

        // BUG-LBL5 fix: Use Prisma.Decimal for monetary values to avoid floating point errors (same pattern as button/label)
        await tx.elastic_stock.create({
          data: {
            elasticId: elastic.id,
            quantityAvailable: new Prisma.Decimal(acceptedQty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: item.unit || 'meters',
            purchaseCost: new Prisma.Decimal(unitPrice),
            weightedAvgCost: new Prisma.Decimal(unitPrice),
            supplierId: grn.supplierId,
            sourceType: 'GRN',
            procurementId: grn.poId,
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            status: 'AVAILABLE',
            stockType: 'PLANNED_STOCK',
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            createdById: userId,
          },
        });

        await ensureMaterialRecord(elastic.id, 'ELASTIC', tx);
        await syncStockLevelQuantity(elastic.id, acceptedQty, warehouseId, undefined, tx);

        logInfo(`Auto-created elastic_stock from GRN ${grn.grnNumber}: ${acceptedQty} of ${elastic.elasticCode}`);
      }
    }

    // ===== LABEL =====
    if (po.poCategory === 'LABEL') {
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          include: { label_master: true },
        });

        if (!material?.labelId || !material.label_master) {
          logInfo(`GRN item ${item.id}: no label link, skipping label_stock`);
          continue;
        }

        const label = material.label_master;
        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

        // BUG-LBL5 fix: Use Prisma.Decimal for monetary values to avoid floating point errors
        await tx.label_stock.create({
          data: {
            labelId: label.id,
            quantityAvailable: new Prisma.Decimal(acceptedQty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: item.unit || 'pieces',
            purchaseCost: new Prisma.Decimal(unitPrice),
            weightedAvgCost: new Prisma.Decimal(unitPrice),
            supplierId: grn.supplierId,
            sourceType: 'GRN',
            procurementId: grn.poId,
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            status: 'AVAILABLE',
            stockType: 'PLANNED_STOCK',
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            createdById: userId,
          },
        });

        await ensureMaterialRecord(label.id, 'LABEL', tx);
        await syncStockLevelQuantity(label.id, acceptedQty, warehouseId, undefined, tx);

        logInfo(`Auto-created label_stock from GRN ${grn.grnNumber}: ${acceptedQty} of ${label.labelCode}`);
      }
    }

    // ===== PACKAGING =====
    if (po.poCategory === 'PACKAGING') {
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          include: { packaging_master: true },
        });

        if (!material?.packagingId || !material.packaging_master) {
          logInfo(`GRN item ${item.id}: no packaging link, skipping packaging_stock`);
          continue;
        }

        const packaging = material.packaging_master;
        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

        // BUG-PKG5 fix: Use Prisma.Decimal for stock values to avoid floating point errors
        await tx.packaging_stock.create({
          data: {
            packagingId: packaging.id,
            quantityAvailable: new Prisma.Decimal(acceptedQty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: item.unit || 'pieces',
            purchaseCost: new Prisma.Decimal(unitPrice),
            weightedAvgCost: new Prisma.Decimal(unitPrice),
            supplierId: grn.supplierId,
            sourceType: 'GRN',
            procurementId: grn.poId,
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            status: 'AVAILABLE',
            stockType: 'PLANNED_STOCK',
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            createdById: userId,
          },
        });

        await ensureMaterialRecord(packaging.id, 'PACKAGING', tx);
        await syncStockLevelQuantity(packaging.id, acceptedQty, warehouseId, undefined, tx);

        logInfo(`Auto-created packaging_stock from GRN ${grn.grnNumber}: ${acceptedQty} of ${packaging.packagingCode}`);
      }
    }

    // ===== MACHINE_PART =====
    if (po.poCategory === 'MACHINE_PART') {
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          include: { machine_part_master: true },
        });

        if (!material?.machinePartId || !material.machine_part_master) {
          logInfo(`GRN item ${item.id}: no machine part link, skipping machine_part_stock`);
          continue;
        }

        const machinePart = material.machine_part_master;
        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

        // BUG-MCH5 fix: Use Prisma.Decimal for stock values to avoid floating point errors
        await tx.machine_part_stock.create({
          data: {
            machinePartId: machinePart.id,
            quantityAvailable: new Prisma.Decimal(acceptedQty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: item.unit || 'pieces',
            purchaseCost: new Prisma.Decimal(unitPrice),
            weightedAvgCost: new Prisma.Decimal(unitPrice),
            supplierId: grn.supplierId,
            sourceType: 'GRN',
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            status: 'AVAILABLE',
            stockType: 'PLANNED_STOCK',
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            createdById: userId,
          },
        });

        await ensureMaterialRecord(machinePart.id, 'MACHINE_PART', tx);
        await syncStockLevelQuantity(machinePart.id, acceptedQty, warehouseId, undefined, tx);

        logInfo(`Auto-created machine_part_stock from GRN ${grn.grnNumber}: ${acceptedQty} of ${machinePart.partCode}`);
      }
    }

    // ===== OTHER_MATERIAL =====
    if (po.poCategory === 'OTHER_MATERIAL') {
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          include: { other_material_master: true },
        });

        if (!material?.otherMaterialId || !material.other_material_master) {
          logInfo(`GRN item ${item.id}: no other material link, skipping other_material_stock`);
          continue;
        }

        const otherMaterial = material.other_material_master;
        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

        // BUG-OTH5 fix: Use Prisma.Decimal for monetary values to avoid floating point errors
        await tx.other_material_stock.create({
          data: {
            otherMaterialId: otherMaterial.id,
            quantityAvailable: new Prisma.Decimal(acceptedQty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: item.unit || 'pieces',
            purchaseCost: new Prisma.Decimal(unitPrice),
            weightedAvgCost: new Prisma.Decimal(unitPrice),
            supplierId: grn.supplierId,
            sourceType: 'GRN',
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            status: 'AVAILABLE',
            stockType: 'PLANNED_STOCK',
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            createdById: userId,
          },
        });

        await ensureMaterialRecord(otherMaterial.id, 'OTHER_MATERIAL', tx);
        await syncStockLevelQuantity(otherMaterial.id, acceptedQty, warehouseId, undefined, tx);

        logInfo(
          `Auto-created other_material_stock from GRN ${grn.grnNumber}: ${acceptedQty} of ${otherMaterial.materialCode}`
        );
      }
    }
  }

  /**
   * Reject a GRN
   */
  async rejectGRN(id: string, userId: string, reason: string) {
    const grn = await prisma.goods_receiving_notes.findUnique({
      where: { id },
    });

    if (!grn) {
      throw new Error('GRN not found');
    }

    if (grn.status !== GRNStatus.PENDING_QC) {
      throw new Error(`Cannot reject GRN in ${grn.status} status`);
    }

    // Revert PO item received quantities
    const grnItems = await prisma.grn_items.findMany({
      where: { grnId: id },
    });

    const updatedGRN = await prisma.$transaction(async (tx) => {
      // GUARDED status flip (PENDING_QC only) — same guard as approveGRN: a concurrent approve/reject
      // pair could otherwise both commit and double-decrement the PO counters (potentially negative).
      const flip = await tx.goods_receiving_notes.updateMany({
        where: { id, status: GRNStatus.PENDING_QC },
        data: {
          status: GRNStatus.REJECTED,
          approvedById: userId,
          remarks: reason ? `${grn.remarks || ''}\n\nRejection reason: ${reason}`.trim() : grn.remarks,
        },
      });
      if (flip.count === 0) {
        throw new Error('GRN is no longer PENDING_QC — it was already approved or rejected');
      }
      const rejected = await tx.goods_receiving_notes.findUniqueOrThrow({
        where: { id },
        include: this.getFullInclude(),
      });

      // Revert PO item received quantities (Phase 4b: PO-less GRN items have no poItemId)
      for (const item of grnItems) {
        if (!item.poItemId) continue;
        await tx.purchase_order_items.update({
          where: { id: item.poItemId },
          data: {
            receivedQuantity: {
              decrement: item.receivedQuantity,
            },
          },
        });
      }

      return rejected;
    });

    // Update PO status (skip for PO-less JWO GRNs)
    if (grn.poId) {
      await purchaseOrderService.updateReceivingStatus(grn.poId);
    }

    return updatedGRN;
  }

  /**
   * Get receiving summary by warehouse for a PO
   */
  async getReceivingSummaryByPO(poId: string) {
    // Note: Full implementation requires warehouseId on GRN
    // For now, return basic summary without warehouse breakdown
    const grns = await prisma.goods_receiving_notes.findMany({
      where: {
        poId,
        status: GRNStatus.ACCEPTED,
      },
      include: {
        grn_items: true,
      },
    });

    let totalReceived = 0;
    for (const grn of grns) {
      for (const item of grn.grn_items) {
        totalReceived += Number(item.acceptedQuantity);
      }
    }

    return {
      totalReceived,
      grnCount: grns.length,
      byWarehouse: [], // To be implemented when warehouseId is added to GRN schema
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get full include for GRN queries
   */
  private getFullInclude() {
    return {
      purchase_orders: {
        select: {
          id: true,
          poNumber: true,
          supplierId: true,
          expectedDeliveryDate: true,
          status: true,
          poCategory: true,
        },
      },
      // Phase 4b: PO-less GRNs identify by their Job Work Order
      jobWorkOrder: {
        select: {
          id: true,
          jobWorkNumber: true,
          processType: true,
        },
      },
      suppliers: {
        select: {
          id: true,
          code: true,
          name: true,
          contactPerson: true,
          email: true,
          phone: true,
        },
      },
      grn_items: {
        include: {
          materials: {
            select: {
              id: true,
              code: true,
              name: true,
              materialType: true,
              unit: true,
            },
          },
          purchase_order_items: {
            select: {
              id: true,
              orderedQuantity: true,
              receivedQuantity: true,
              unit: true,
              unitPrice: true,
            },
          },
          grn_item_details: {
            orderBy: [{ baleNumber: Prisma.SortOrder.asc }, { sequenceNo: Prisma.SortOrder.asc }],
          },
        },
      },
      users_goods_receiving_notes_receivedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users_goods_receiving_notes_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    };
  }
  /**
   * Get processing context for a PROCESSING PO (for GRN form pre-population)
   */
  async getProcessingContext(poId: string) {
    const po = await prisma.purchase_orders.findUnique({
      where: { id: poId },
      select: { id: true, poCategory: true },
    });

    if (!po || po.poCategory !== 'PROCESSING') {
      throw new Error('Not a PROCESSING PO');
    }

    const job = await prisma.job_work_orders.findFirst({
      where: { purchaseOrderId: poId },
      include: {
        style: { select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true } },
        fabric: { select: { id: true, fabricCode: true, fabricName: true } },
        processor: { select: { id: true, name: true, code: true } },
        greigeStockLot: { select: { id: true, quantityAvailable: true, purchaseCost: true } },
      },
    });

    if (!job) {
      throw new Error('No job work order linked to this PROCESSING PO');
    }

    return {
      jobId: job.id,
      processType: job.processType,
      qtySentMeters: Number(job.qtySentMeters),
      sentWidthInches: Number(job.sentWidthInches),
      sentDate: job.sentDate,
      expectedReturnDate: job.expectedReturnDate,
      styleName: job.style?.styleName || '',
      styleCode: job.style?.styleCode || '',
      buyerStyleRef: job.style?.buyerStyleRef ?? null,
      fabricName: job.fabric?.fabricName || '',
      fabricCode: job.fabric?.fabricCode || '',
      processorName: job.processor?.name || '',
      agreedRate: Number(job.agreedRatePerMeter),
      greigeStockLotId: job.greigeStockLotId,
      status: job.status,
      receivedDate: job.receivedDate,
    };
  }

  // BUG-GRN6 fix: Comprehensive GRN reversal for ACCEPTED GRNs
  /**
   * Reverse an accepted GRN - fully reverses all stock and transaction entries
   * Only works for ACCEPTED or PARTIALLY_ACCEPTED GRNs
   *
   * Reverses:
   * - GRN status -> REVERSED
   * - PO item received quantities (decremented)
   * - Stock movements (creates reverse STOCK_OUT movements)
   * - Stock levels (decremented)
   * - Specialized stock tables (greige_stock, fabric_stock, etc.)
   * - MRP received quantities
   * - Processing PO specific: job_work_orders, challans, processor greige_stock
   * - Ledger/transaction entries for audit trail
   */
  async reverseGRN(id: string, userId: string, reason: string) {
    const grn = await prisma.goods_receiving_notes.findUnique({
      where: { id },
      include: {
        grn_items: {
          include: {
            purchase_order_items: true,
            materials: {
              include: {
                greige_master: true,
                fabric_master: true,
                lace_master: true,
                thread_master: true,
                button_master: true,
                zipper_master: true,
                elastic_master: true,
                label_master: true,
                packaging_master: true,
                machine_part_master: true,
                other_material_master: true,
              },
            },
          },
        },
        purchase_orders: {
          select: { id: true, poCategory: true, supplierId: true },
        },
      },
    });

    if (!grn) {
      throw new Error('GRN not found');
    }

    // Only ACCEPTED or PARTIALLY_ACCEPTED GRNs can be reversed
    // BUG-GRN6 fix: Use string literals for status check (works before/after migration)
    const reversibleStatuses = ['ACCEPTED', 'PARTIALLY_ACCEPTED'] as const;
    if (!reversibleStatuses.includes(grn.status as (typeof reversibleStatuses)[number])) {
      throw new Error(
        `Cannot reverse GRN in ${grn.status} status. Only ACCEPTED or PARTIALLY_ACCEPTED GRNs can be reversed.`
      );
    }

    const warehouseId = grn.warehouseId;
    if (!warehouseId) {
      throw new Error('GRN has no warehouse assigned - cannot determine which stock to reverse');
    }

    const po = grn.purchase_orders;

    // Execute reversal in a transaction
    const reversedGRN = await prisma.$transaction(
      async (tx) => {
        // 1. GUARDED status flip - prevent concurrent reversal
        // BUG-GRN6 fix: Use string literal for REVERSED status (works before/after migration)
        const flip = await tx.goods_receiving_notes.updateMany({
          where: { id, status: { in: reversibleStatuses as unknown as GRNStatus[] } },
          data: {
            status: 'REVERSED' as GRNStatus, // Type assertion for pre-migration compatibility
            remarks: grn.remarks
              ? `${grn.remarks}\n\n[REVERSED ${new Date().toISOString()}] Reason: ${reason}`
              : `[REVERSED ${new Date().toISOString()}] Reason: ${reason}`,
          },
        });
        if (flip.count === 0) {
          throw new Error('GRN is no longer in reversible status - it was already reversed or modified');
        }

        const reversed = await tx.goods_receiving_notes.findUniqueOrThrow({
          where: { id },
          include: this.getFullInclude(),
        });

        // 2. Process each GRN item for reversal
        for (const item of grn.grn_items) {
          const acceptedQty = Number(item.acceptedQuantity);

          // 2a. Revert PO item received quantities
          if (item.poItemId && acceptedQty > 0) {
            await tx.purchase_order_items.update({
              where: { id: item.poItemId },
              data: {
                receivedQuantity: { decrement: acceptedQty },
              },
            });

            // 2b. Revert MRP received quantity
            await mrpService.updateReceivedQuantity(item.poItemId, -acceptedQty, tx);
          }

          // 2c. Create reverse stock movement for audit trail
          if (acceptedQty > 0) {
            const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;
            const totalValue = roundToCent(multiplyCurrency(acceptedQty, unitPrice)).toNumber();

            await tx.stock_movements.create({
              data: {
                id: randomUUID(),
                movementType: MovementType.STOCK_OUT,
                materialId: item.materialId,
                warehouseId: warehouseId,
                supplierId: grn.supplierId,
                quantity: acceptedQty,
                unit: item.unit,
                referenceType: 'MANUAL_ADJUSTMENT', // GRN reversal adjustment
                referenceId: grn.id,
                referenceNumber: grn.grnNumber,
                rate: unitPrice,
                value: totalValue,
                remarks: `Stock reversed from GRN ${grn.grnNumber} - Reason: ${reason}`,
                performedById: userId,
                movementDate: new Date(),
              },
            });
          }
        }

        // 3. Reverse specialized stock based on PO category
        await this.reverseSpecializedStockInTx(tx, grn, po, userId, warehouseId, reason);

        // 4. Handle Processing PO specific reversal (Phase 4b: also PO-less JWO GRNs)
        if (po?.poCategory === 'PROCESSING' || (!grn.poId && grn.jobWorkOrderId)) {
          await this.reverseProcessingGRNInTx(tx, grn, po ?? null, userId, reason);
          // Phase 4b: mirror the MRP receipt decrement for JWO-keyed GRNs
          if (!grn.poId && grn.jobWorkOrderId) {
            const totalAccepted = (grn.grn_items || []).reduce(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (sum: number, i: any) => sum + Number(i.acceptedQuantity || 0),
              0
            );
            if (totalAccepted > 0) {
              await mrpService.updateJwoReceivedQuantity(grn.jobWorkOrderId, -totalAccepted, tx);
              // Phase 5a: symmetric reversal for service-requirement links (no-op without links)
              await updateWosrReceivedQuantity(grn.jobWorkOrderId, -totalAccepted, tx);
            }
          }
        }

        return reversed;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Recompute PO receiving status (best-effort post-commit; PO-less GRNs have none)
    if (grn.poId) {
      try {
        await purchaseOrderService.updateReceivingStatus(grn.poId);
      } catch (statusErr) {
        logError('Failed to recompute PO receiving status after GRN reversal', statusErr);
      }
    }

    logInfo(`GRN reversed: ${grn.grnNumber}`, {
      grnId: id,
      reason,
      reversedBy: userId,
      itemCount: grn.grn_items.length,
    });

    return reversedGRN;
  }

  /**
   * Phase 4b: create a GRN against a Job Work Order with no purchase order.
   * Only for PO-less JWOs (wizard-created / post-4c) — PO-backed JWOs must go
   * through the normal PO receiving flow to keep a single receipt path per order.
   */
  async createGRNFromJWO(
    data: {
      jobWorkOrderId: string;
      qtyReceivedMeters?: number;
      receivedWidthInches?: number;
      thanCount?: number;
      foldLengthCm?: number;
      receivedChallan?: string;
      invoiceNumber?: string;
      invoiceDate?: string;
      warehouseId?: string;
      remarks?: string;
    },
    userId: string
  ) {
    const jwo = await prisma.job_work_orders.findUnique({
      where: { id: data.jobWorkOrderId },
      include: {
        processor: { select: { id: true, name: true } },
        style: { select: { id: true, styleCode: true, buyerStyleRef: true } },
      },
    });
    if (!jwo) {
      throw new Error('Job work order not found');
    }
    if (jwo.purchaseOrderId) {
      throw new Error(`${jwo.jobWorkNumber} is linked to a purchase order — receive it through the normal PO GRN flow`);
    }
    if (jwo.receivedDate) {
      throw new Error(`${jwo.jobWorkNumber} has already been received`);
    }
    if (jwo.status !== 'AT_MILL' && jwo.status !== 'SENT_TO_MILL') {
      throw new Error(`Cannot receive ${jwo.jobWorkNumber}: status is ${jwo.status}, expected AT_MILL/SENT_TO_MILL`);
    }
    // Phase 5a (D6): GRN receiving is fabric/meters-shaped; piece-based job work
    // (embroidery/handwork/smocking/kaaj) is received on the JWO itself.
    if (jwo.uom !== 'MTR') {
      throw new Error(
        `${jwo.jobWorkNumber} is piece-based (${jwo.uom}) — receive it from the Job Work Order's Receive action, not a GRN`
      );
    }

    // Quantity: direct meters, or than-count × fold-length
    let qtyReceived = data.qtyReceivedMeters || 0;
    if (!qtyReceived && data.thanCount && data.foldLengthCm) {
      qtyReceived = (data.thanCount * data.foldLengthCm) / 100;
    }
    if (qtyReceived <= 0) {
      throw new Error('Received quantity must be greater than 0');
    }

    // grn_items.materialId is required — use the source fabric's materials record
    // (materials.id === master.id invariant; ensureMaterialRecord creates if missing)
    if (!jwo.fabricId) {
      throw new Error(`${jwo.jobWorkNumber} has no fabric reference — cannot create a GRN item`);
    }
    const materialId = await ensureMaterialRecord(jwo.fabricId, 'FABRIC');

    const grnNumber = await this.generateGRNNumber();
    const grn = await prisma.goods_receiving_notes.create({
      data: {
        id: randomUUID(),
        grnNumber,
        poId: null,
        jobWorkOrderId: jwo.id,
        supplierId: jwo.processorId,
        warehouseId: data.warehouseId || null,
        receivingDate: new Date(),
        invoiceNumber: data.invoiceNumber || null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        status: GRNStatus.PENDING_QC,
        remarks:
          [data.remarks, data.receivedChallan ? `Vendor challan ref: ${data.receivedChallan}` : null]
            .filter(Boolean)
            .join('\n') || null,
        receivedById: userId,
        grn_items: {
          create: [
            {
              id: randomUUID(),
              poItemId: null,
              materialId,
              orderedQuantity: jwo.qtySentMeters,
              receivedQuantity: qtyReceived,
              acceptedQuantity: qtyReceived,
              rejectedQuantity: 0,
              unit: Unit.METER,
              receivedWidthInches: data.receivedWidthInches ?? null,
              thanCount: data.thanCount ?? null,
              foldLengthCm: data.foldLengthCm ?? null,
              totalMeters: qtyReceived,
            },
          ],
        },
      },
      include: this.getFullInclude(),
    });

    logInfo('PO-less JWO GRN created', {
      grnId: grn.id,
      grnNumber,
      jobWorkOrderId: jwo.id,
      jobWorkNumber: jwo.jobWorkNumber,
      qtyReceived,
    });
    return grn;
  }

  /**
   * Phase 4b: approve a PO-less GRN keyed on a Job Work Order.
   * Mirrors the PROCESSING approval semantics: derive/reuse the finished fabric,
   * create fabric_stock at (processing rate + source greige cost), stamp the JWO,
   * and advance MRP requirements through requirement_jwo_links.
   */
  private async approvePolessJwoGrnInTx(
    tx: Prisma.TransactionClient,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    grn: any,
    processingQC: ProcessingQCData | undefined,
    targetWarehouseId: string | null,
    userId: string,
    grnId: string
  ): Promise<void> {
    const jobWorkOrder = await tx.job_work_orders.findUnique({
      where: { id: grn.jobWorkOrderId },
      include: {
        greigeStockLot: { select: { id: true, purchaseCost: true, greigeId: true } },
        fabric: { select: { id: true, greigeId: true } },
        style: { select: { id: true, styleCode: true, buyerStyleRef: true } },
      },
    });
    if (!jobWorkOrder) {
      throw new Error(`Job work order ${grn.jobWorkOrderId} not found for PO-less GRN approval`);
    }

    const grnItem = grn.grn_items?.[0];
    const qtyReceived = grnItem ? Number(grnItem.acceptedQuantity || grnItem.receivedQuantity || 0) : 0;
    const receivedWidth = grnItem?.receivedWidthInches ? Number(grnItem.receivedWidthInches) : 44;
    if (qtyReceived <= 0) {
      logWarn('PO-less JWO GRN approved with zero accepted quantity — no stock created', {
        grnId,
        jobWorkOrderId: jobWorkOrder.id,
      });
      return;
    }

    // Finished fabric: reuse the JWO's, else derive from greige lineage
    let finishedFabricId: string | null = jobWorkOrder.finishedFabricId;
    if (!finishedFabricId) {
      const greigeId = jobWorkOrder.greigeStockLot?.greigeId || jobWorkOrder.fabric?.greigeId || null;
      if (!greigeId) {
        logWarn('PO-less JWO GRN has no greige lineage — cannot create fabric_stock', {
          grnId,
          jobWorkOrderId: jobWorkOrder.id,
        });
        return;
      }
      const finishType = determineFinishType(null, jobWorkOrder.processType === 'PRINTING' ? 'PIGMENT' : null);
      const fabricResult = await getOrCreateFinishedFabric(
        {
          greigeId,
          colorName: 'Natural',
          finishType,
          widthInches: receivedWidth,
          styleCode: jobWorkOrder.style?.styleCode,
          styleId: jobWorkOrder.style?.id,
          buyerStyleRef: jobWorkOrder.style?.buyerStyleRef,
          userId,
        },
        tx
      );
      finishedFabricId = fabricResult.fabricId;
    }

    // Cost: processing rate + source greige cost (per-meter)
    const processingRate = Number(
      processingQC?.actualRate ?? jobWorkOrder.actualRate ?? jobWorkOrder.agreedRatePerMeter ?? 0
    );
    const sourceCost = jobWorkOrder.greigeStockLot?.purchaseCost ? Number(jobWorkOrder.greigeStockLot.purchaseCost) : 0;
    const totalCostPerMeter = roundToCent(addCurrency(processingRate, sourceCost)).toNumber();
    const cutableWidth = receivedWidth > 2 ? receivedWidth - 2 : receivedWidth;
    // Shared timestamp: GRN reversal matches fabric_stock by exact receivedDate equality
    const receivedAt = new Date();

    await tx.fabric_stock.create({
      data: {
        id: randomUUID(),
        fabricId: finishedFabricId,
        finishedWidth: receivedWidth,
        cutableWidth,
        quantityAvailable: qtyReceived,
        quantityReserved: 0,
        quantityConsumed: 0,
        unit: 'meters',
        originStyleId: jobWorkOrder.style?.id || null,
        status: 'AVAILABLE',
        stockType: 'PLANNED_STOCK',
        fabricFinishType: jobWorkOrder.processType === 'PRINTING' ? 'PRINTED' : 'DYED',
        weightedAvgCost: totalCostPerMeter,
        purchaseCost: totalCostPerMeter,
        qualityGrade: processingQC?.qualityGrade || DEFAULT_QUALITY_GRADE,
        defectMeters: processingQC?.defectMeters || 0,
        receivedDate: receivedAt,
        agingAlertSent: false,
        agingDays: 0,
        needsEmbroidery: false,
        createdById: userId,
        warehouseId: targetWarehouseId,
      },
    });
    await syncStockLevelQuantity(finishedFabricId, qtyReceived, targetWarehouseId ?? undefined, 'METER', tx);

    await tx.job_work_orders.update({
      where: { id: jobWorkOrder.id },
      data: {
        finishedFabricId,
        qtyReceivedMeters: qtyReceived,
        receivedDate: jobWorkOrder.receivedDate ?? receivedAt,
        grnId,
        status: 'STOCK_UPDATED',
        ...(processingQC
          ? {
              qualityGrade: processingQC.qualityGrade,
              colorMatchStatus: processingQC.colorMatchStatus || null,
              defectMeters: processingQC.defectMeters ?? null,
              defectType: processingQC.defectType || null,
              actualRate: processingQC.actualRate ?? null,
            }
          : {}),
      },
    });

    // Phase 4b receipt bridge: advance MRP requirements via requirement_jwo_links
    await mrpService.updateJwoReceivedQuantity(jobWorkOrder.id, qtyReceived, tx);
    // Phase 5a: same hook for service requirements (no-ops when no links exist)
    await updateWosrReceivedQuantity(jobWorkOrder.id, qtyReceived, tx);

    logInfo('PO-less JWO GRN approved — fabric_stock created', {
      grnId,
      jobWorkOrderId: jobWorkOrder.id,
      jobWorkNumber: jobWorkOrder.jobWorkNumber,
      fabricId: finishedFabricId,
      qtyReceived,
      costPerMeter: totalCostPerMeter,
    });
  }

  // BUG-GRN6 fix: Reverse specialized stock records created during GRN approval
  private async reverseSpecializedStockInTx(
    tx: Prisma.TransactionClient,
    grn: any,
    po: { id: string; poCategory: string | null; supplierId: string | null } | null,
    userId: string,
    warehouseId: string,
    reason: string
  ): Promise<void> {
    if (!po) return;

    const poCategory = po.poCategory;

    // Categories that use stock_levels directly (non-specialized)
    const nonSpecializedCategories = ['GENERAL', 'CONSUMABLE', 'SAMPLE'];
    if (!poCategory || nonSpecializedCategories.includes(poCategory)) {
      // Reverse stock_levels for non-specialized categories
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty > 0) {
          await syncStockLevelQuantity(item.materialId, -acceptedQty, warehouseId, undefined, tx);
        }
      }
      return;
    }

    // Handle specialized categories
    for (const item of grn.grn_items) {
      const acceptedQty = Number(item.acceptedQuantity);
      if (acceptedQty <= 0) continue;

      const material = item.materials;

      // GREIGE - reverse greige_stock
      if (poCategory === 'GREIGE' && material?.greige_master) {
        const greigeId = material.greige_master.id;

        // P2: Identity-based lookup by grnItemId (preferred)
        let greigeStock = await tx.greige_stock.findFirst({
          where: { grnItemId: item.id },
        });

        // P2: Fallback for legacy lots (null grnItemId) — log warning
        if (!greigeStock) {
          greigeStock = await tx.greige_stock.findFirst({
            where: {
              greigeId,
              warehouseId,
              sourceType: 'GRN',
              grnItemId: null, // Only match legacy lots
              quantityAvailable: { gte: 0 }, // Any available qty
            },
            orderBy: { receivedDate: 'desc' },
          });
          if (greigeStock) {
            logInfo(
              `WARNING: GRN reversal using heuristic fallback for legacy lot (no grnItemId). ` +
                `Lot ${greigeStock.id} may not be the exact lot from this GRN item.`,
              { grnId: grn.id, grnItemId: item.id, stockId: greigeStock.id }
            );
          }
        }

        if (greigeStock) {
          // P2: Reverse by ACTUAL quantity stored in the lot, not NOMINAL acceptedQty
          // For lots with grnItemId, we reverse the full quantityAvailable
          // For legacy lots, we use actualQuantity from grn_item if available, else acceptedQty
          const actualQty = item.actualQuantity ? Number(item.actualQuantity) : Number(greigeStock.quantityAvailable);
          const reverseQty = greigeStock.grnItemId ? Number(greigeStock.quantityAvailable) : actualQty;

          const newAvailable = Number(greigeStock.quantityAvailable) - reverseQty;
          if (newAvailable <= 0) {
            // Delete the stock record if fully reversed
            await tx.greige_stock.delete({ where: { id: greigeStock.id } });
          } else {
            await tx.greige_stock.update({
              where: { id: greigeStock.id },
              data: { quantityAvailable: newAvailable },
            });
          }

          // Create reversal transaction
          await tx.greige_stock_transaction.create({
            data: {
              stockId: greigeStock.id,
              transactionType: 'ADJUSTMENT_OUT',
              quantity: -reverseQty,
              balanceAfter: Math.max(0, newAvailable),
              referenceType: 'MANUAL_ADJUSTMENT', // GRN reversal adjustment
              referenceId: grn.id,
              notes: `GRN ${grn.grnNumber} reversed - ${reason}`,
              performedById: userId,
            },
          });

          // Sync stock_levels with the ACTUAL quantity being reversed
          await syncStockLevelQuantity(greigeId, -reverseQty, warehouseId, undefined, tx);

          logInfo(`Reversed greige_stock from GRN ${grn.grnNumber}: ${reverseQty}m (actual)`, {
            grnId: grn.id,
            greigeId,
            stockId: greigeStock.id,
            nominal: acceptedQty,
            actual: reverseQty,
          });
        } else {
          logInfo(
            `WARNING: No greige_stock found to reverse for GRN item ${item.id}. ` +
              `Stock may have been manually consumed or already reversed.`,
            { grnId: grn.id, grnItemId: item.id, greigeId }
          );
        }
      }

      // FABRIC - reverse fabric_stock
      if (poCategory === 'FABRIC' && material?.fabric_master) {
        const fabricId = material.fabric_master.id;
        const fabricStock = await tx.fabric_stock.findFirst({
          where: {
            fabricId,
            warehouseId,
            quantityAvailable: { gte: acceptedQty },
          },
          orderBy: { receivedDate: 'desc' },
        });

        if (fabricStock) {
          const newAvailable = Number(fabricStock.quantityAvailable) - acceptedQty;
          if (newAvailable <= 0) {
            await tx.fabric_stock.delete({ where: { id: fabricStock.id } });
          } else {
            await tx.fabric_stock.update({
              where: { id: fabricStock.id },
              data: { quantityAvailable: newAvailable },
            });
          }

          await syncStockLevelQuantity(fabricId, -acceptedQty, warehouseId, undefined, tx);

          logInfo(`Reversed fabric_stock from GRN ${grn.grnNumber}: ${acceptedQty}m`, {
            grnId: grn.id,
            fabricId,
          });
        }
      }

      // LACE / GREIGE_LACE - reverse lace_stock
      if ((poCategory === 'LACE' || poCategory === 'GREIGE_LACE') && material?.lace_master) {
        const laceId = material.lace_master.id;
        const laceStock = await tx.lace_stock.findFirst({
          where: {
            laceId,
            warehouseId,
            procurementId: grn.poId,
            quantityAvailable: { gte: acceptedQty },
          },
          orderBy: { receivedDate: 'desc' },
        });

        if (laceStock) {
          const newAvailable = Number(laceStock.quantityAvailable) - acceptedQty;
          if (newAvailable <= 0) {
            await tx.lace_stock.delete({ where: { id: laceStock.id } });
          } else {
            await tx.lace_stock.update({
              where: { id: laceStock.id },
              data: { quantityAvailable: newAvailable },
            });
          }

          await syncStockLevelQuantity(laceId, -acceptedQty, warehouseId, undefined, tx);

          logInfo(`Reversed lace_stock from GRN ${grn.grnNumber}: ${acceptedQty}m`, {
            grnId: grn.id,
            laceId,
          });
        }
      }

      // THREAD - reverse thread_stock
      if (poCategory === 'THREAD' && material?.thread_master) {
        const threadId = material.thread_master.id;
        const threadStock = await tx.thread_stock.findFirst({
          where: {
            threadId,
            warehouseId,
            procurementId: grn.poId,
            quantityAvailable: { gte: acceptedQty },
          },
          orderBy: { receivedDate: 'desc' },
        });

        if (threadStock) {
          const newAvailable = Number(threadStock.quantityAvailable) - acceptedQty;
          if (newAvailable <= 0) {
            await tx.thread_stock.delete({ where: { id: threadStock.id } });
          } else {
            await tx.thread_stock.update({
              where: { id: threadStock.id },
              data: { quantityAvailable: newAvailable },
            });
          }

          // Create reversal transaction
          await tx.thread_stock_transaction.create({
            data: {
              stockId: threadStock.id,
              transactionType: 'ADJUSTMENT_OUT',
              quantity: -acceptedQty,
              balanceAfter: Math.max(0, newAvailable),
              referenceType: 'MANUAL_ADJUSTMENT', // GRN reversal adjustment
              referenceId: grn.id,
              notes: `GRN ${grn.grnNumber} reversed - ${reason}`,
              performedById: userId,
            },
          });

          await syncStockLevelQuantity(threadId, -acceptedQty, warehouseId, undefined, tx);

          logInfo(`Reversed thread_stock from GRN ${grn.grnNumber}: ${acceptedQty}`, {
            grnId: grn.id,
            threadId,
          });
        }
      }

      // BUTTON - reverse button_stock
      // BUG-BTN5 fix: Use Prisma.Decimal for proper decimal arithmetic
      if (poCategory === 'BUTTON' && material?.button_master) {
        const buttonId = material.button_master.id;
        const buttonStock = await tx.button_stock.findFirst({
          where: {
            buttonId,
            warehouseId,
            procurementId: grn.poId,
            quantityAvailable: { gte: acceptedQty },
          },
          orderBy: { receivedDate: 'desc' },
        });

        if (buttonStock) {
          const currentAvailable = new Prisma.Decimal(buttonStock.quantityAvailable.toString());
          const newAvailable = currentAvailable.minus(new Prisma.Decimal(acceptedQty));
          if (newAvailable.lte(0)) {
            await tx.button_stock.delete({ where: { id: buttonStock.id } });
          } else {
            await tx.button_stock.update({
              where: { id: buttonStock.id },
              data: { quantityAvailable: newAvailable },
            });
          }

          await syncStockLevelQuantity(buttonId, -acceptedQty, warehouseId, undefined, tx);

          logInfo(`Reversed button_stock from GRN ${grn.grnNumber}: ${acceptedQty}`, {
            grnId: grn.id,
            buttonId,
          });
        }
      }

      // ZIPPER - reverse zipper_stock
      if (poCategory === 'ZIPPER' && material?.zipper_master) {
        const zipperId = material.zipper_master.id;
        const zipperStock = await tx.zipper_stock.findFirst({
          where: {
            zipperId,
            warehouseId,
            procurementId: grn.poId,
            quantityAvailable: { gte: acceptedQty },
          },
          orderBy: { receivedDate: 'desc' },
        });

        if (zipperStock) {
          // BUG-ZIP5 fix: use decimal.js for precision
          const newAvailable = toNumber(subtractCurrency(zipperStock.quantityAvailable, acceptedQty));
          if (newAvailable <= 0) {
            await tx.zipper_stock.delete({ where: { id: zipperStock.id } });
          } else {
            await tx.zipper_stock.update({
              where: { id: zipperStock.id },
              data: { quantityAvailable: newAvailable },
            });
          }

          await syncStockLevelQuantity(zipperId, -acceptedQty, warehouseId, undefined, tx);

          logInfo(`Reversed zipper_stock from GRN ${grn.grnNumber}: ${acceptedQty}`, {
            grnId: grn.id,
            zipperId,
          });
        }
      }

      // ELASTIC - reverse elastic_stock
      if (poCategory === 'ELASTIC' && material?.elastic_master) {
        const elasticId = material.elastic_master.id;
        const elasticStock = await tx.elastic_stock.findFirst({
          where: {
            elasticId,
            warehouseId,
            procurementId: grn.poId,
            quantityAvailable: { gte: acceptedQty },
          },
          orderBy: { receivedDate: 'desc' },
        });

        if (elasticStock) {
          const newAvailable = Number(elasticStock.quantityAvailable) - acceptedQty;
          if (newAvailable <= 0) {
            await tx.elastic_stock.delete({ where: { id: elasticStock.id } });
          } else {
            await tx.elastic_stock.update({
              where: { id: elasticStock.id },
              data: { quantityAvailable: newAvailable },
            });
          }

          await syncStockLevelQuantity(elasticId, -acceptedQty, warehouseId, undefined, tx);

          logInfo(`Reversed elastic_stock from GRN ${grn.grnNumber}: ${acceptedQty}`, {
            grnId: grn.id,
            elasticId,
          });
        }
      }

      // LABEL - reverse label_stock
      if (poCategory === 'LABEL' && material?.label_master) {
        const labelId = material.label_master.id;
        const labelStock = await tx.label_stock.findFirst({
          where: {
            labelId,
            warehouseId,
            procurementId: grn.poId,
            quantityAvailable: { gte: acceptedQty },
          },
          orderBy: { receivedDate: 'desc' },
        });

        if (labelStock) {
          const newAvailable = Number(labelStock.quantityAvailable) - acceptedQty;
          if (newAvailable <= 0) {
            await tx.label_stock.delete({ where: { id: labelStock.id } });
          } else {
            await tx.label_stock.update({
              where: { id: labelStock.id },
              data: { quantityAvailable: newAvailable },
            });
          }

          await syncStockLevelQuantity(labelId, -acceptedQty, warehouseId, undefined, tx);

          logInfo(`Reversed label_stock from GRN ${grn.grnNumber}: ${acceptedQty}`, {
            grnId: grn.id,
            labelId,
          });
        }
      }

      // PACKAGING - reverse packaging_stock
      if (poCategory === 'PACKAGING' && material?.packaging_master) {
        const packagingId = material.packaging_master.id;
        const packagingStock = await tx.packaging_stock.findFirst({
          where: {
            packagingId,
            warehouseId,
            procurementId: grn.poId,
            quantityAvailable: { gte: acceptedQty },
          },
          orderBy: { receivedDate: 'desc' },
        });

        if (packagingStock) {
          // BUG-PKG5 fix: Use decimal arithmetic to avoid floating point errors
          const newAvailable = subtractCurrency(packagingStock.quantityAvailable, acceptedQty);
          if (newAvailable.lte(0)) {
            await tx.packaging_stock.delete({ where: { id: packagingStock.id } });
          } else {
            await tx.packaging_stock.update({
              where: { id: packagingStock.id },
              data: { quantityAvailable: new Prisma.Decimal(toNumber(newAvailable)) },
            });
          }

          await syncStockLevelQuantity(packagingId, -acceptedQty, warehouseId, undefined, tx);

          logInfo(`Reversed packaging_stock from GRN ${grn.grnNumber}: ${acceptedQty}`, {
            grnId: grn.id,
            packagingId,
          });
        }
      }

      // MACHINE_PART - reverse machine_part_stock
      // BUG-MCH5 fix: Use atomic decrement operations for thread safety and precision
      if (poCategory === 'MACHINE_PART' && material?.machine_part_master) {
        const machinePartId = material.machine_part_master.id;
        const machinePartStock = await tx.machine_part_stock.findFirst({
          where: {
            machinePartId,
            warehouseId,
            quantityAvailable: { gte: acceptedQty },
          },
          orderBy: { receivedDate: 'desc' },
        });

        if (machinePartStock) {
          const currentAvailable = Number(machinePartStock.quantityAvailable);
          if (currentAvailable - acceptedQty <= 0) {
            // Delete if resulting quantity would be zero or less
            await tx.machine_part_stock.delete({ where: { id: machinePartStock.id } });
          } else {
            // Use atomic decrement for thread safety and precision
            await tx.machine_part_stock.update({
              where: { id: machinePartStock.id },
              data: { quantityAvailable: { decrement: acceptedQty } },
            });
          }

          await syncStockLevelQuantity(machinePartId, -acceptedQty, warehouseId, undefined, tx);

          logInfo(`Reversed machine_part_stock from GRN ${grn.grnNumber}: ${acceptedQty}`, {
            grnId: grn.id,
            machinePartId,
          });
        }
      }

      // OTHER_MATERIAL - reverse other_material_stock
      if (poCategory === 'OTHER_MATERIAL' && material?.other_material_master) {
        const otherMaterialId = material.other_material_master.id;
        const otherMaterialStock = await tx.other_material_stock.findFirst({
          where: {
            otherMaterialId,
            warehouseId,
            quantityAvailable: { gte: acceptedQty },
          },
          orderBy: { receivedDate: 'desc' },
        });

        if (otherMaterialStock) {
          // BUG-OTH5 fix: Use decimal arithmetic to avoid floating point errors
          const newAvailable = subtractCurrency(otherMaterialStock.quantityAvailable, acceptedQty);
          if (newAvailable.lte(0)) {
            await tx.other_material_stock.delete({ where: { id: otherMaterialStock.id } });
          } else {
            await tx.other_material_stock.update({
              where: { id: otherMaterialStock.id },
              data: { quantityAvailable: new Prisma.Decimal(toNumber(newAvailable)) },
            });
          }

          await syncStockLevelQuantity(otherMaterialId, -acceptedQty, warehouseId, undefined, tx);

          logInfo(`Reversed other_material_stock from GRN ${grn.grnNumber}: ${acceptedQty}`, {
            grnId: grn.id,
            otherMaterialId,
          });
        }
      }
    }
  }

  // BUG-GRN6 fix: Reverse Processing PO specific records
  // Phase 4b: also handles PO-less JWO GRNs (po = null, lookup via grn.jobWorkOrderId)
  private async reverseProcessingGRNInTx(
    tx: Prisma.TransactionClient,
    grn: any,
    po: { id: string; poCategory: string | null; supplierId: string | null } | null,
    userId: string,
    reason: string
  ): Promise<void> {
    // Find the job work order — by direct GRN link (PO-less) or via the shadow PO
    const jobWorkOrder = await tx.job_work_orders.findFirst({
      where: grn.jobWorkOrderId
        ? { id: grn.jobWorkOrderId, grnId: grn.id }
        : { purchaseOrderId: po!.id, grnId: grn.id },
      include: {
        greigeStockLot: true,
        fabricStockLot: true,
      },
    });

    if (!jobWorkOrder) {
      logInfo(`No job work order found for GRN ${grn.grnNumber} reversal - may have been created via different path`);
      return;
    }

    const receivedMeters = Number(jobWorkOrder.qtyReceivedMeters || 0);

    // 1. Reverse fabric_stock created from this job
    if (jobWorkOrder.finishedFabricId) {
      // Find fabric_stock records created by this job (via received date matching)
      const fabricStocks = await tx.fabric_stock.findMany({
        where: {
          fabricId: jobWorkOrder.finishedFabricId,
          originStyleId: jobWorkOrder.styleId,
          ...(jobWorkOrder.receivedDate ? { receivedDate: jobWorkOrder.receivedDate } : {}),
        },
      });

      for (const stock of fabricStocks) {
        const qty = Number(stock.quantityAvailable);
        await tx.fabric_stock.delete({ where: { id: stock.id } });
        await syncStockLevelQuantity(jobWorkOrder.finishedFabricId, -qty, stock.warehouseId ?? undefined, 'METER', tx);

        logInfo(`Reversed processing fabric_stock: ${qty}m`, {
          grnId: grn.id,
          fabricStockId: stock.id,
          fabricId: jobWorkOrder.finishedFabricId,
        });
      }
    }

    // 2. Restore processor's greige_stock (if it was consumed)
    if (jobWorkOrder.outwardChallanId) {
      const processorGreigeStock = await tx.greige_stock.findFirst({
        where: { sourceChallanId: jobWorkOrder.outwardChallanId },
      });

      if (processorGreigeStock) {
        // Restore the consumed quantity
        await tx.greige_stock.update({
          where: { id: processorGreigeStock.id },
          data: {
            quantityAvailable: { increment: receivedMeters },
            quantityConsumed: { decrement: receivedMeters },
            status: 'AVAILABLE',
          },
        });

        // Create restoration transaction
        await tx.greige_stock_transaction.create({
          data: {
            stockId: processorGreigeStock.id,
            transactionType: 'ADJUSTMENT_OUT',
            quantity: receivedMeters,
            balanceAfter: Number(processorGreigeStock.quantityAvailable) + receivedMeters,
            referenceType: 'MANUAL_ADJUSTMENT', // GRN reversal adjustment
            referenceId: grn.id,
            notes: `GRN ${grn.grnNumber} reversed - restored greige at processor`,
            performedById: userId,
          },
        });

        logInfo(`Restored processor greige_stock: ${receivedMeters}m`, {
          grnId: grn.id,
          processorStockId: processorGreigeStock.id,
        });
      }
    }

    // 3. Cancel the inward challan if exists
    if (jobWorkOrder.inwardChallanId) {
      await tx.challans.update({
        where: { id: jobWorkOrder.inwardChallanId },
        data: {
          status: 'CANCELLED',
          remarks: `Cancelled due to GRN ${grn.grnNumber} reversal - ${reason}`,
        },
      });

      logInfo(`Cancelled inward challan for GRN reversal`, {
        grnId: grn.id,
        challanId: jobWorkOrder.inwardChallanId,
      });
    }

    // 4. Reset job work order to pre-receive state
    await tx.job_work_orders.update({
      where: { id: jobWorkOrder.id },
      data: {
        qtyReceivedMeters: null,
        receivedWidthInches: null,
        receivedDate: null,
        receivedChallan: null,
        actualShrinkage: null,
        widthVariance: null,
        thanCount: null,
        foldLengthCm: null,
        calculatedActualMeters: null,
        inwardChallanId: null,
        grnId: null,
        qualityGrade: null,
        colorMatchStatus: null,
        defectMeters: null,
        defectType: null,
        actualRate: null,
        status: 'AT_MILL', // Reset to at-mill status
        remarks: jobWorkOrder.remarks
          ? `${jobWorkOrder.remarks}\n[GRN REVERSED ${new Date().toISOString()}] ${reason}`
          : `[GRN REVERSED ${new Date().toISOString()}] ${reason}`,
      },
    });

    // 5. Reset PO status to allow re-receiving (Phase 4b: PO-less GRNs have no PO)
    if (po) {
      await tx.purchase_orders.updateMany({
        where: { id: po.id, status: 'RECEIVED' },
        data: { status: 'ACKNOWLEDGED' },
      });
    }

    logInfo(`Reset job work order${po ? ' and PO' : ''} for GRN reversal`, {
      grnId: grn.id,
      jobId: jobWorkOrder.id,
      poId: po?.id ?? null,
    });
  }
}

export const grnService = new GRNService();
export default grnService;
