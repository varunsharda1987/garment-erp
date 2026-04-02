/**
 * GRN (Goods Receiving Notes) Service
 * Business logic for goods receiving operations with stock integration
 */

import { GRNStatus, PurchaseOrderStatus, Prisma, MovementType } from '@prisma/client';
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
import { costSheetPOGenerationService } from './costSheetPOGeneration.service';
import greigeStockService from './greige-stock.service';
import { systemSettingsService } from './system-settings.service';
import prisma from '../config/database'; // Use singleton to avoid connection pool leak
import { logInfo, logError } from '../utils/logger';
import { generateAtomicGRNNumber } from '../utils/atomicCodeGenerator';

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

      // Validate accepted + rejected = received
      if (item.acceptedQuantity + item.rejectedQuantity !== item.receivedQuantity) {
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

    // Create GRN with items in transaction
    const grn = await prisma.$transaction(async (tx) => {
      // Create GRN
      const newGRN = await tx.goods_receiving_notes.create({
        data: {
          id: randomUUID(),
          grnNumber,
          poId: data.poId,
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

      return newGRN;
    });

    // PROCESSING PO: handle processing-specific receive
    if (po.poCategory === 'PROCESSING' && data.processingData) {
      try {
        const jobWorkOrder = await prisma.job_work_orders.findFirst({
          where: { purchaseOrderId: po.id },
          include: {
            style: { select: { id: true, styleCode: true } },
          },
        });

        if (!jobWorkOrder) {
          logError('No job work order linked to PROCESSING PO', { poId: po.id });
        } else if (jobWorkOrder.receivedDate) {
          throw new Error('This processing PO has already been received via the Printing/Dyeing module');
        } else if (jobWorkOrder.status !== 'AT_MILL' && jobWorkOrder.status !== 'SENT_TO_MILL') {
          throw new Error(`Cannot receive. Job status is ${jobWorkOrder.status}, expected AT_MILL`);
        } else {
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
          const sentMeters = Number(jobWorkOrder.qtySentMeters);
          const actualShrinkage = sentMeters > 0 ? ((sentMeters - actualMeters) / sentMeters) * 100 : 0;
          const widthVariance = receivedWidthInches - Number(jobWorkOrder.sentWidthInches);

          // Update fabric_master actual width if finished fabric exists
          if (jobWorkOrder.finishedFabricId && receivedWidthInches) {
            await prisma.fabric_master.update({
              where: { id: jobWorkOrder.finishedFabricId },
              data: {
                actualWidth: receivedWidthInches,
                cutableWidth: receivedWidthInches > 2 ? receivedWidthInches - 2 : receivedWidthInches,
              },
            });
          }

          // Create INWARD challan
          let inwardChallanId: string | null = null;
          try {
            const challan = await createChallan({
              challanType: 'INWARD',
              challanDate: data.receivingDate ? new Date(data.receivingDate as string) : new Date(),
              fromType: 'VENDOR',
              fromId: po.supplierId,
              fromName: po.suppliers?.name || 'Mill',
              toType: 'WAREHOUSE',
              toName: 'Main Warehouse',
              purchaseOrderId: po.id,
              issuedById: userId,
              unit: 'METERS',
              remarks: receivedChallan ? `Vendor challan ref: ${receivedChallan}` : undefined,
              items: [
                {
                  itemType: 'FABRIC',
                  fabricId: jobWorkOrder.finishedFabricId || jobWorkOrder.fabricId,
                  description: `Processed fabric received via GRN - ${jobWorkOrder.style?.styleCode || ''}`,
                  quantity: actualMeters,
                  unit: 'METERS',
                },
              ],
            });
            inwardChallanId = challan.id;
          } catch (challanError) {
            logError('Failed to create inward challan from GRN', challanError);
          }

          // Update job_work_orders with received data
          await prisma.job_work_orders.update({
            where: { id: jobWorkOrder.id },
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
              inwardChallanId: inwardChallanId,
              grnId: grn.id,
              status: 'RECEIVED',
            },
          });

          logInfo(`Processing PO received via GRN ${grn.grnNumber}`, {
            poId: po.id,
            jobId: jobWorkOrder.id,
            actualMeters,
            shrinkage: actualShrinkage,
          });
        }
      } catch (processingError) {
        // If it's a user-facing error (conflict/validation), re-throw
        if (
          processingError instanceof Error &&
          (processingError.message.includes('already been received') ||
            processingError.message.includes('Cannot receive'))
        ) {
          throw processingError;
        }
        logError('Failed to process PROCESSING PO receive via GRN', processingError);
      }
    }

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

    // Update GRN status in transaction with stock movements
    const updatedGRN = await prisma.$transaction(async (tx) => {
      // Update GRN status and warehouseId if provided
      const approved = await tx.goods_receiving_notes.update({
        where: { id },
        data: {
          status: GRNStatus.ACCEPTED,
          approvedById: userId,
          warehouseId: targetWarehouseId,
        },
        include: this.getFullInclude(),
      });

      // Check PO category for processing-specific handling
      const po = await tx.purchase_orders.findUnique({
        where: { id: grn.poId },
        select: { id: true, poCategory: true, supplierId: true },
      });

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
          const totalCostPerMeter = processingRate + sourceCost;
          const qualityGrade = processingQC?.qualityGrade || jobWorkOrder.qualityGrade || 'A';
          const processType = jobWorkOrder.processType;
          const fabricFinishType = processType === 'PRINTING' ? 'PRINTED' : 'DYED';

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
                createdById: userId,
              },
            });
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
                weightedAvgCost: totalCostPerMeter * 0.5,
                purchaseCost: totalCostPerMeter * 0.5,
                qualityGrade: 'B',
                defectMeters: defectMetersNum,
                receivedDate: jobWorkOrder.receivedDate || new Date(),
                agingAlertSent: false,
                agingDays: 0,
                createdById: userId,
              },
            });
          }

          // Update job status to STOCK_UPDATED
          await tx.job_work_orders.update({
            where: { id: jobWorkOrder.id },
            data: { status: 'STOCK_UPDATED' },
          });

          // Update PO status to RECEIVED and items receivedQuantity
          await tx.purchase_orders.update({
            where: { id: po.id },
            data: { status: 'RECEIVED' },
          });

          const poItems = await tx.purchase_order_items.findMany({
            where: { poId: po.id },
          });
          if (poItems.length > 0) {
            await tx.purchase_order_items.update({
              where: { id: poItems[0].id },
              data: { receivedQuantity: qtyReceived },
            });
          }

          logInfo(`PROCESSING PO approved via GRN - fabric_stock created`, {
            grnId: id,
            poId: po.id,
            goodQty,
            defectQty: defectMetersNum,
            costPerMeter: totalCostPerMeter,
          });
        }

        return approved; // Skip normal stock_movements/stock_levels
      }

      // Create stock movements and update stock levels for accepted items
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty > 0) {
          // Get unit price from PO item for stock valuation
          const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

          const totalValue = acceptedQty * unitPrice;

          // Create stock movement record
          await tx.stock_movements.create({
            data: {
              id: randomUUID(),
              movementType: MovementType.STOCK_IN,
              materialId: item.materialId,
              warehouseId: targetWarehouseId,
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

          // Update or create stock level
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

          // Update MRP requirement status via PO item link
          if (item.poItemId) {
            try {
              await mrpService.updateReceivedQuantity(item.poItemId, acceptedQty);
            } catch (err) {
              // MRP update is non-critical - log but don't fail the approval
              console.warn(`MRP update warning for PO item ${item.poItemId}:`, err);
            }
          }
        }

        // Track rejected quantities as audit trail
        const rejectedQty = Number(item.rejectedQuantity || 0);
        if (rejectedQty > 0) {
          await tx.stock_movements.create({
            data: {
              id: randomUUID(),
              movementType: MovementType.ADJUSTMENT_OUT,
              materialId: item.materialId,
              warehouseId: targetWarehouseId,
              quantity: rejectedQty,
              unit: item.unit,
              referenceType: 'GRN_REJECTION',
              referenceId: grn.id,
              referenceNumber: grn.grnNumber,
              rate: item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0,
              value: rejectedQty * (item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0),
              remarks: `Rejected during GRN ${grn.grnNumber} — pending supplier return/credit`,
              performedById: userId,
              movementDate: new Date(),
            },
          });
        }
      }

      return approved;
    });

    // Auto-update Processing PO status when Greige GRN is approved
    // This is done outside the transaction to avoid blocking
    try {
      const po = await prisma.purchase_orders.findUnique({
        where: { id: grn.poId },
        select: { id: true, poCategory: true },
      });

      if (po?.poCategory === 'GREIGE') {
        await costSheetPOGenerationService.updateProcessingPOStatusOnGreigeGRN(po.id);
        logInfo('Processing PO status check triggered for Greige GRN', {
          grnId: id,
          greigePOId: po.id,
        });

        // Auto-create greige_stock entries for accepted greige items
        for (const item of grn.grn_items) {
          const acceptedQty = Number(item.acceptedQuantity);
          if (acceptedQty <= 0) continue;

          try {
            // Get material to find greigeId
            const material = await prisma.materials.findUnique({
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

            await greigeStockService.createGreigeStock(
              {
                greigeId: greige.id,
                quantity: acceptedQty,
                width: greigeWidth,
                purchaseCost: unitPrice,
                supplierId: grn.supplierId,
                receivedDate: grn.receivingDate,
                warehouseLocation: grn.warehouseId || undefined,
                qualityGrade: 'A',
              },
              userId
            );

            logInfo(`Auto-created greige_stock from GRN ${grn.grnNumber}: ${acceptedQty}m of ${greige.greigeCode}`, {
              grnId: id,
              greigeId: greige.id,
              quantity: acceptedQty,
            });
          } catch (greigeErr) {
            // Non-critical: log but don't fail GRN approval
            logError(`Failed to auto-create greige_stock for GRN item ${item.id}`, greigeErr);
          }
        }
      }

      // Auto-create fabric_stock for FABRIC PO GRNs
      if (po?.poCategory === 'FABRIC') {
        for (const item of grn.grn_items) {
          const acceptedQty = Number(item.acceptedQuantity);
          if (acceptedQty <= 0) continue;

          try {
            const material = await prisma.materials.findUnique({
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

            await prisma.fabric_stock.create({
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
                qualityGrade: 'A',
                weightedAvgCost: unitPrice,
                purchaseCost: unitPrice,
                receivedDate: grn.receivingDate || new Date(),
                createdById: userId,
              },
            });

            logInfo(
              `Auto-created fabric_stock from FABRIC GRN ${grn.grnNumber}: ${acceptedQty}m of fabricId=${fabric.id}`,
              {
                grnId: id,
                fabricId: fabric.id,
                quantity: acceptedQty,
              }
            );
          } catch (fabricErr) {
            // Non-critical: log but don't fail GRN approval
            logError(`Failed to auto-create fabric_stock for GRN item ${item.id}`, fabricErr);
          }
        }
      }
      // Auto-create lace_stock for LACE PO GRNs
      if (po?.poCategory === 'LACE' || po?.poCategory === 'GREIGE_LACE') {
        for (const item of grn.grn_items) {
          const acceptedQty = Number(item.acceptedQuantity);
          if (acceptedQty <= 0) continue;

          try {
            const material = await prisma.materials.findUnique({
              where: { id: item.materialId },
              select: {
                laceId: true,
                lace_master: {
                  select: { id: true, laceCode: true },
                },
              },
            });

            if (!material?.laceId || !material.lace_master) {
              logInfo(
                `GRN item ${item.id}: material ${item.materialId} has no lace link, skipping lace_stock creation`
              );
              continue;
            }

            const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

            await prisma.lace_stock.create({
              data: {
                laceId: material.lace_master.id,
                quantityAvailable: acceptedQty,
                quantityReserved: 0,
                quantityConsumed: 0,
                unit: 'meters',
                status: 'AVAILABLE',
                stockType: 'PLANNED_STOCK',
                qualityGrade: 'A',
                weightedAvgCost: unitPrice,
                purchaseCost: unitPrice,
                receivedDate: grn.receivingDate || new Date(),
                warehouseLocation: grn.warehouseId || undefined,
                procurementId: grn.poId || undefined,
                createdById: userId,
              },
            });

            logInfo(
              `Auto-created lace_stock from LACE GRN ${grn.grnNumber}: ${acceptedQty}m of laceId=${material.lace_master.id}`,
              { grnId: id, laceId: material.lace_master.id, quantity: acceptedQty }
            );
          } catch (laceErr) {
            logError(`Failed to auto-create lace_stock for GRN item ${item.id}`, laceErr);
          }
        }
      }

      // Auto-create thread_stock for THREAD PO GRNs
      if (po?.poCategory === 'THREAD') {
        for (const item of grn.grn_items) {
          const acceptedQty = Number(item.acceptedQuantity);
          if (acceptedQty <= 0) continue;

          try {
            const material = await prisma.materials.findUnique({
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

            const spec = await prisma.thread_packaging_specs.findFirst({
              where: { ply: thread.ply || undefined, packagingType: packagingType, isActive: true },
            });

            if (spec) {
              metersAvailable = acceptedQty * Number(spec.metersPerUnit);
              boxesAvailable = spec.unitsPerBox > 0 ? acceptedQty / spec.unitsPerBox : null;
            }

            await prisma.thread_stock.create({
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
                qualityGrade: 'A',
                receivedDate: grn.receivingDate || new Date(),
                warehouseLocation: grn.warehouseId || undefined,
                procurementId: grn.poId || undefined,
                createdById: userId,
              },
            });

            // Create stock transaction
            const stockEntry = await prisma.thread_stock.findFirst({
              where: { threadId: thread.id, procurementId: grn.poId },
              orderBy: { createdAt: 'desc' },
            });

            if (stockEntry) {
              await prisma.thread_stock_transaction.create({
                data: {
                  stockId: stockEntry.id,
                  transactionType: 'STOCK_IN',
                  quantity: acceptedQty,
                  balanceAfter: acceptedQty,
                  referenceType: 'GRN',
                  referenceId: id,
                  notes: `GRN ${grn.grnNumber} - ${thread.threadCode}`,
                  performedById: userId,
                },
              });
            }

            // Update linked thread requirements status to RECEIVED
            if (item.purchase_order_items?.id) {
              await prisma.order_thread_requirements.updateMany({
                where: { poItemId: item.purchase_order_items.id },
                data: { status: 'RECEIVED' },
              });
            }

            logInfo(
              `Auto-created thread_stock from THREAD GRN ${grn.grnNumber}: ${acceptedQty} ${poUnit} of threadId=${thread.id}`,
              { grnId: id, threadId: thread.id, quantity: acceptedQty, meters: metersAvailable }
            );
          } catch (threadErr) {
            logError(`Failed to auto-create thread_stock for GRN item ${item.id}`, threadErr);
          }
        }
      }
    } catch (error) {
      // Log error but don't fail the GRN approval
      logError('Failed to auto-update Processing PO status', error);
    }

    return updatedGRN;
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
      // Update GRN status
      const rejected = await tx.goods_receiving_notes.update({
        where: { id },
        data: {
          status: GRNStatus.REJECTED,
          approvedById: userId,
          remarks: reason ? `${grn.remarks || ''}\n\nRejection reason: ${reason}`.trim() : grn.remarks,
        },
        include: this.getFullInclude(),
      });

      // Revert PO item received quantities
      for (const item of grnItems) {
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

    // Update PO status
    await purchaseOrderService.updateReceivingStatus(grn.poId);

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
        style: { select: { id: true, styleCode: true, styleName: true } },
        fabric: { select: { id: true, fabricCode: true, fabricName: true } },
        mill: { select: { id: true, name: true, code: true } },
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
      fabricName: job.fabric?.fabricName || '',
      fabricCode: job.fabric?.fabricCode || '',
      millName: job.mill?.name || '',
      agreedRate: Number(job.agreedRatePerMeter),
      greigeStockLotId: job.greigeStockLotId,
      status: job.status,
      receivedDate: job.receivedDate,
    };
  }
}

export const grnService = new GRNService();
export default grnService;
