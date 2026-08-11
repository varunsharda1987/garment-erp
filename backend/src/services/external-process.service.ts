/**
 * External Process Service
 * Handles send-out/receive workflows for Smocking, Handwork, and Piece-Level Embroidery.
 * These are external processes where material is sent to vendors and received back.
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ExternalProcessType,
  ExternalProcessSourceType,
  ExternalProcessStatus,
  ProductionStage,
  Prisma,
  ChallanType,
} from '@prisma/client';
import { logInfo, logError, logDebug } from '../utils/logger';
import { createChallan } from './challan.service';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';
import { randomUUID } from 'crypto';
// Phase 5b: the Job Work Order is the commercial document for piece send-outs
import { jobWorkOrderService } from './job-work-order.service';
import { updateWosrReceivedQuantity } from './work-order-service-requirement.service';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';

// Phase 5b: send-out processType → JWO processType (service JWOs are keyed on ServiceType codes)
const SENDOUT_TO_JWO_PROCESS: Record<ExternalProcessType, string> = {
  EMBROIDERY_PIECE: 'EMBROIDERY',
  SMOCKING: 'SMOCKING',
  HANDWORK: 'HANDWORK',
};

// ============================================
// Types
// ============================================

export interface SendOutSkuDTO {
  colorId?: string;
  sizeId: string;
  sentQty: number;
}

export interface SendOutDTO {
  processType: ExternalProcessType;
  sourceType: ExternalProcessSourceType;
  workOrderId: string;
  orderId?: string;
  styleId?: string;
  cuttingBatchId?: string;
  fabricStockId?: string;
  stitchingIssueId?: string;
  supplierId: string;
  quantitySent: number;
  unit: string; // PCS or MTR
  agreedRate: number;
  sendDate: Date;
  expectedReturnDate?: Date;
  // Phase 5b: the commercial doc is a Job Work Order (POs are material-only)
  jobWorkOrderId: string;
  serviceRequirementId?: string;
  embroideryId?: string;
  remarks?: string;
  createdById: string;
  skus?: SendOutSkuDTO[];
}

export interface ReceiveDTO {
  sendOutId: string;
  quantityReceived: number;
  quantityDamaged?: number;
  actualReturnDate: Date;
  actualCost?: number;
  invoiceNumber?: string;
  invoiceDate?: Date;
  remarks?: string;
  createdById: string;
  skus?: {
    sendOutSkuId: string;
    receivedQty: number;
    damagedQty: number;
  }[];
}

export interface SendOutFilters {
  processType?: ExternalProcessType;
  status?: ExternalProcessStatus;
  supplierId?: string;
  workOrderId?: string;
  orderId?: string;
  styleId?: string;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
  search?: string;
}

// ============================================
// Service
// ============================================

class ExternalProcessService {
  /**
   * Generate batch number with prefix based on process type.
   * Atomic monthly series per prefix: SM2607-0001, HW2607-0001, EP2607-0001.
   */
  private async generateBatchNumber(processType: ExternalProcessType, tx?: Prisma.TransactionClient): Promise<string> {
    const prefixMap: Record<ExternalProcessType, string> = {
      SMOCKING: 'SM',
      HANDWORK: 'HW',
      EMBROIDERY_PIECE: 'EP',
    };
    return generateAtomicDocNumber(prefixMap[processType], tx);
  }

  /**
   * Get the challan item type based on process type and source type
   */
  private getChallanItemType(processType: ExternalProcessType, sourceType: ExternalProcessSourceType): string {
    if (sourceType === 'FABRIC_STOCK') return 'FABRIC';
    if (processType === 'HANDWORK') return 'STITCHED_PIECE';
    return 'CUT_PIECE'; // SMOCKING and EMBROIDERY_PIECE from cutting batch
  }

  /**
   * Create a send-out record
   * Validates source, PO, creates record + SKU breakdown, auto-creates OUTWARD challan
   */
  async createSendOut(data: SendOutDTO) {
    logDebug('Creating external process send-out', {
      processType: data.processType,
      sourceType: data.sourceType,
      workOrderId: data.workOrderId,
      quantity: data.quantitySent,
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify work order exists
      const workOrder = await tx.work_orders.findUnique({
        where: { id: data.workOrderId },
        select: { id: true, workOrderNumber: true, styleId: true, orderId: true },
      });
      if (!workOrder) throw new Error('Work order not found');

      // 2. Verify supplier exists
      const supplier = await tx.suppliers.findUnique({
        where: { id: data.supplierId },
        select: { id: true, name: true },
      });
      if (!supplier) throw new Error('Supplier not found');

      // 3. Phase 5b: verify the Job Work Order (the commercial doc) exists and matches
      const jwo = await tx.job_work_orders.findUnique({
        where: { id: data.jobWorkOrderId },
        select: {
          id: true,
          jobWorkNumber: true,
          processType: true,
          processorId: true,
          jwoStatus: true,
          qtySentMeters: true,
          sentDate: true,
          statutoryDueDate: true,
        },
      });
      if (!jwo) throw new Error('Job work order not found');
      if (jwo.processorId !== data.supplierId) {
        throw new Error('Job work order processor does not match selected vendor');
      }
      if (jwo.jwoStatus === 'CANCELLED' || jwo.jwoStatus === 'CLOSED') {
        throw new Error(
          `Job work order ${jwo.jobWorkNumber} is ${jwo.jwoStatus.toLowerCase()} — cannot send against it`
        );
      }
      const expectedProcess = SENDOUT_TO_JWO_PROCESS[data.processType];
      if (jwo.processType !== expectedProcess) {
        throw new Error(`Job work order ${jwo.jobWorkNumber} is for ${jwo.processType}, not ${expectedProcess}`);
      }
      // Over-send guard: 1 JWO can back N send-out batches, but never beyond its ordered qty
      const siblingAgg = await tx.external_process_send_outs.aggregate({
        where: { jobWorkOrderId: jwo.id, status: { not: 'CANCELLED' }, isActive: true },
        _sum: { quantitySent: true },
      });
      const alreadySent = Number(siblingAgg._sum.quantitySent ?? 0);
      const orderedQty = Number(jwo.qtySentMeters);
      if (alreadySent + data.quantitySent > orderedQty) {
        throw new Error(
          `Send quantity exceeds the job work order: ${alreadySent} of ${orderedQty} already sent on ${jwo.jobWorkNumber}, requested ${data.quantitySent}`
        );
      }

      // Default the service requirement from the JWO's 5a execution pointer
      let serviceRequirementId = data.serviceRequirementId;
      if (!serviceRequirementId) {
        const linkedWosr = await tx.work_order_service_requirements.findFirst({
          where: { jobWorkOrderId: jwo.id },
          select: { id: true },
        });
        serviceRequirementId = linkedWosr?.id;
      }

      // 4. Validate source based on sourceType
      if (data.sourceType === 'CUTTING_BATCH') {
        if (!data.cuttingBatchId) throw new Error('Cutting batch ID is required for this source type');
        const batch = await tx.cutting_batches.findUnique({
          where: { id: data.cuttingBatchId },
          select: { id: true, batchNumber: true, status: true },
        });
        if (!batch) throw new Error('Cutting batch not found');
      } else if (data.sourceType === 'FABRIC_STOCK') {
        if (!data.fabricStockId) throw new Error('Fabric stock ID is required for this source type');
        const stock = await tx.fabric_stock.findUnique({
          where: { id: data.fabricStockId },
          select: { id: true, quantityAvailable: true },
        });
        if (!stock) throw new Error('Fabric stock not found');
        const available = parseFloat(stock.quantityAvailable.toString());
        if (available < data.quantitySent) {
          throw new Error(`Insufficient fabric stock. Available: ${available}, Requested: ${data.quantitySent}`);
        }
        // Phase 5b ledger fix: guarded deduct + transaction row + stock_levels sync
        // (the bare decrement left no fabric_stock_transaction and stale stock_levels)
        const deducted = await tx.fabric_stock.updateMany({
          where: { id: data.fabricStockId, quantityAvailable: { gte: data.quantitySent } },
          data: { quantityAvailable: { decrement: data.quantitySent } },
        });
        if (deducted.count === 0) {
          throw new Error('Fabric stock changed concurrently — not enough quantity available');
        }
        const stockRow = await tx.fabric_stock.findUnique({
          where: { id: data.fabricStockId },
          select: { fabricId: true, warehouseId: true, weightedAvgCost: true, quantityAvailable: true },
        });
        const wac = Number(stockRow?.weightedAvgCost ?? 0);
        const balanceAfter = Number(stockRow?.quantityAvailable ?? 0);
        await tx.fabric_stock_transaction.create({
          data: {
            stockId: data.fabricStockId,
            transactionType: 'ISSUE',
            quantity: new Decimal(data.quantitySent),
            referenceType: 'EXTERNAL_PROCESS',
            referenceId: data.jobWorkOrderId,
            costPerUnit: new Decimal(wac),
            weightedAvgCost: new Decimal(wac),
            totalValue: new Decimal(data.quantitySent * wac),
            balanceAfter: new Decimal(balanceAfter),
            valueAfter: new Decimal(balanceAfter * wac),
            notes: `External process send-out (${data.processType})`,
            createdById: data.createdById,
          },
        });
        if (stockRow?.fabricId) {
          const materialId = await ensureMaterialRecord(stockRow.fabricId, 'FABRIC');
          await syncStockLevelQuantity(materialId, -data.quantitySent, stockRow.warehouseId ?? undefined, 'METER', tx);
        }
      } else if (data.sourceType === 'STITCHING_ISSUE') {
        if (!data.stitchingIssueId) throw new Error('Stitching issue ID is required for this source type');
        const issue = await tx.stitching_issues.findUnique({
          where: { id: data.stitchingIssueId },
          select: { id: true, issueNumber: true, status: true },
        });
        if (!issue) throw new Error('Stitching issue not found');
      }

      // 5. Validate embroidery master for EMBROIDERY_PIECE
      if (data.processType === 'EMBROIDERY_PIECE' && data.embroideryId) {
        const emb = await tx.embroidery_master.findUnique({
          where: { id: data.embroideryId },
          select: { id: true },
        });
        if (!emb) throw new Error('Embroidery design not found');
      }

      // 6. Generate batch number
      const batchNumber = await this.generateBatchNumber(data.processType, tx);

      // 7. Create send-out record
      const sendOut = await tx.external_process_send_outs.create({
        data: {
          batchNumber,
          processType: data.processType,
          sourceType: data.sourceType,
          workOrderId: data.workOrderId,
          orderId: data.orderId || workOrder.orderId,
          styleId: data.styleId || workOrder.styleId,
          cuttingBatchId: data.cuttingBatchId,
          fabricStockId: data.fabricStockId,
          stitchingIssueId: data.stitchingIssueId,
          supplierId: data.supplierId,
          quantitySent: data.quantitySent,
          unit: data.unit,
          agreedRate: data.agreedRate,
          sendDate: data.sendDate,
          expectedReturnDate: data.expectedReturnDate,
          jobWorkOrderId: data.jobWorkOrderId,
          serviceRequirementId,
          embroideryId: data.embroideryId,
          remarks: data.remarks,
          status: 'SENT',
          createdById: data.createdById,
        },
        include: {
          workOrder: { select: { workOrderNumber: true } },
          supplier: { select: { name: true } },
          jobWorkOrder: { select: { jobWorkNumber: true } },
          order: { select: { orderNumber: true } },
          style: { select: { styleCode: true, buyerStyleRef: true, styleName: true } },
        },
      });

      // 8. Create SKU breakdown if pieces
      if (data.skus && data.skus.length > 0) {
        await tx.external_process_send_out_skus.createMany({
          data: data.skus.map((sku) => ({
            sendOutId: sendOut.id,
            colorId: sku.colorId || null,
            sizeId: sku.sizeId,
            sentQty: sku.sentQty,
          })),
        });
      }

      // 9. Update service requirement status if linked
      if (serviceRequirementId) {
        await tx.work_order_service_requirements.update({
          where: { id: serviceRequirementId },
          data: { status: 'IN_PROGRESS' },
        });
      }

      // 9b. Phase 5b first-send stamping (§143 parity with /:id/issue): the first dispatch
      // against a JWO marks it issued and locks the statutory due date
      if (!jwo.sentDate) {
        await tx.job_work_orders.update({
          where: { id: jwo.id },
          data: { sentDate: data.sendDate, status: 'SENT_TO_MILL', jwoStatus: 'ISSUED' },
        });
        if (!jwo.statutoryDueDate) {
          await jobWorkOrderService.setStatutoryDueDate(jwo.id, data.sendDate, tx);
        }
      }

      logInfo('External process send-out created', {
        id: sendOut.id,
        batchNumber,
        processType: data.processType,
        quantity: data.quantitySent,
        supplier: supplier.name,
      });

      // Create the OUTWARD job-work challan INSIDE the same transaction. Shipping material to a vendor
      // without a challan is a GST / goods-movement violation, so if the challan can't be created the whole
      // send-out (including the stock deduction) must roll back — it was previously created after commit in
      // a swallowed try/catch, leaving material shipped with outwardChallanId=null and no challan (F4 #13).
      const itemType = this.getChallanItemType(data.processType, data.sourceType);
      const processLabel = data.processType.replace('_', ' ').toLowerCase();

      const challan = await createChallan(
        {
          challanType: ChallanType.OUTWARD,
          challanDate: data.sendDate,
          orderId: sendOut.orderId || undefined,
          productionRunId: data.workOrderId,
          jobWorkOrderId: data.jobWorkOrderId,
          fromType: 'WAREHOUSE',
          fromName: data.processType === 'HANDWORK' ? 'Stitching Floor' : 'Cutting Floor',
          toType: 'VENDOR',
          toId: data.supplierId,
          toName: supplier.name,
          unit: data.unit,
          remarks: `${processLabel} send-out: ${sendOut.batchNumber} (${data.quantitySent} ${data.unit})`,
          issuedById: data.createdById,
          items: [
            {
              itemType,
              quantity: data.quantitySent,
              unit: data.unit,
              description: `Material for ${processLabel} — Batch ${sendOut.batchNumber}`,
              serviceRequirementId,
              jobWorkOrderId: data.jobWorkOrderId,
            },
          ],
        },
        tx
      );

      await tx.external_process_send_outs.update({
        where: { id: sendOut.id },
        data: { outwardChallanId: challan.id },
      });

      logInfo('Created external process outward challan', {
        challanId: challan.id,
        sendOutId: sendOut.id,
      });

      return { sendOut, supplierName: supplier.name, trackingStyleId: data.styleId || workOrder.styleId };
    });

    // Dashboard rollups run POST-COMMIT on the global client: a swallowed failure inside a
    // Postgres transaction aborts it (25P02) and poisons every later statement, so "best-effort
    // inside the tx" was never actually best-effort (cleanup-74 review NIT).
    await this.updateProductionTracking(
      prisma,
      result.trackingStyleId,
      data.processType,
      'SEND',
      Math.round(data.quantitySent)
    );
    await this.createProductionTrackingRecord(
      prisma,
      data.workOrderId,
      data.processType,
      'SEND',
      Math.round(data.quantitySent),
      data.createdById
    );

    return result.sendOut;
  }

  /**
   * Receive material back from external process
   */
  async receiveSendOut(data: ReceiveDTO) {
    logDebug('Receiving external process material', {
      sendOutId: data.sendOutId,
      quantityReceived: data.quantityReceived,
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get send-out record
      const sendOut = await tx.external_process_send_outs.findUnique({
        where: { id: data.sendOutId },
        include: {
          supplier: { select: { name: true } },
          workOrder: { select: { workOrderNumber: true } },
          skuBreakdown: true,
        },
      });

      if (!sendOut) throw new Error('Send-out record not found');
      if (sendOut.status === 'RECEIVED' || sendOut.status === 'CANCELLED') {
        throw new Error(`Send-out is already ${sendOut.status.toLowerCase()}`);
      }

      const quantityDamaged = data.quantityDamaged || 0;
      if (quantityDamaged > data.quantityReceived) {
        throw new Error(
          `Damaged quantity (${quantityDamaged}) cannot exceed received quantity (${data.quantityReceived}) — received is INCLUSIVE of damaged pieces`
        );
      }
      const quantityGood = data.quantityReceived - quantityDamaged;

      // 2. Update SKU breakdown if provided
      if (data.skus && data.skus.length > 0) {
        for (const sku of data.skus) {
          await tx.external_process_send_out_skus.update({
            where: { id: sku.sendOutSkuId },
            data: {
              receivedQty: sku.receivedQty,
              damagedQty: sku.damagedQty,
              goodQty: sku.receivedQty - sku.damagedQty, // allow-assign — derived absolute, not read-modify-write
            },
          });
        }
      }

      // 3. Determine new status. quantityReceived is INCLUSIVE of damaged (quantityGood above is
      // received − damaged), so received alone accounts for every piece back from the vendor — the old
      // `received + damaged` double-counted damage and flipped the send-out to RECEIVED (and the linked
      // service requirement to COMPLETED) while pieces were still at the vendor (bug-hunt production-11).
      const totalAccountedFor = data.quantityReceived;
      const quantitySent = parseFloat(sendOut.quantitySent.toString());
      const newStatus: ExternalProcessStatus = totalAccountedFor >= quantitySent ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

      // 4. Calculate actual cost
      const agreedRate = parseFloat(sendOut.agreedRate.toString());
      const actualCost = data.actualCost || data.quantityReceived * agreedRate;

      // 5. Update send-out record
      const updatedSendOut = await tx.external_process_send_outs.update({
        where: { id: data.sendOutId },
        data: {
          quantityReceived: data.quantityReceived,
          quantityDamaged: quantityDamaged,
          quantityGood: quantityGood,
          actualReturnDate: data.actualReturnDate,
          actualCost: actualCost,
          invoiceNumber: data.invoiceNumber,
          invoiceDate: data.invoiceDate,
          status: newStatus,
          remarks: data.remarks || sendOut.remarks,
        },
        include: {
          workOrder: { select: { workOrderNumber: true } },
          supplier: { select: { name: true } },
          jobWorkOrder: { select: { jobWorkNumber: true } },
          order: { select: { orderNumber: true } },
          style: { select: { styleCode: true, buyerStyleRef: true, styleName: true } },
          skuBreakdown: true,
        },
      });

      // 6. Phase 5b: aggregate receipt back onto the JWO (1 JWO : N send-out batches).
      // WOSR completion flows through updateWosrReceivedQuantity via the JWO links,
      // keeping ONE COMPLETED writer (5a single fulfilment track).
      if (sendOut.jobWorkOrderId) {
        const agg = await tx.external_process_send_outs.aggregate({
          where: { jobWorkOrderId: sendOut.jobWorkOrderId, status: { not: 'CANCELLED' }, isActive: true },
          _sum: { quantityReceived: true, quantitySent: true },
        });
        const totalReceived = Number(agg._sum.quantityReceived ?? 0);
        const totalSent = Number(agg._sum.quantitySent ?? 0);
        const jwoRow = await tx.job_work_orders.findUnique({
          where: { id: sendOut.jobWorkOrderId },
          select: { qtySentMeters: true, receivedDate: true },
        });
        const ordered = Number(jwoRow?.qtySentMeters ?? totalSent);
        const fullyReceived = totalReceived >= ordered;
        await tx.job_work_orders.update({
          where: { id: sendOut.jobWorkOrderId },
          data: {
            qtyReceivedMeters: totalReceived,
            jwoStatus: fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
            ...(fullyReceived
              ? { status: 'RECEIVED', receivedDate: jwoRow?.receivedDate ?? data.actualReturnDate }
              : {}),
          },
        });
        // Advance service requirements by this receipt's delta
        const previouslyReceived = Number(sendOut.quantityReceived ?? 0);
        const delta = data.quantityReceived - previouslyReceived;
        if (delta !== 0) {
          await updateWosrReceivedQuantity(sendOut.jobWorkOrderId, delta, tx);
        }
      } else if (sendOut.serviceRequirementId && newStatus === 'RECEIVED') {
        // Legacy (pre-5b) rows without a JWO: keep the old direct flip
        await tx.work_order_service_requirements.update({
          where: { id: sendOut.serviceRequirementId },
          data: { status: 'COMPLETED' },
        });
      }

      // 7. If fabric stock source was used (smocking on fabric), add stock back
      // Phase 5b ledger fix: transaction row + stock_levels sync (cost uplift on the
      // credited lot is explicitly DEFERRED — process cost lives on the JWO side)
      if (sendOut.sourceType === 'FABRIC_STOCK' && sendOut.fabricStockId && quantityGood > 0) {
        await tx.fabric_stock.update({
          where: { id: sendOut.fabricStockId },
          data: { quantityAvailable: { increment: quantityGood } },
        });
        const stockRow = await tx.fabric_stock.findUnique({
          where: { id: sendOut.fabricStockId },
          select: { fabricId: true, warehouseId: true, weightedAvgCost: true, quantityAvailable: true },
        });
        const wac = Number(stockRow?.weightedAvgCost ?? 0);
        const balanceAfter = Number(stockRow?.quantityAvailable ?? 0);
        await tx.fabric_stock_transaction.create({
          data: {
            stockId: sendOut.fabricStockId,
            transactionType: 'RETURN',
            quantity: new Decimal(quantityGood),
            referenceType: 'EXTERNAL_PROCESS',
            referenceId: sendOut.jobWorkOrderId ?? sendOut.id,
            costPerUnit: new Decimal(wac),
            weightedAvgCost: new Decimal(wac),
            totalValue: new Decimal(quantityGood * wac),
            balanceAfter: new Decimal(balanceAfter),
            valueAfter: new Decimal(balanceAfter * wac),
            notes: `External process receive (${sendOut.processType})`,
            createdById: data.createdById,
          },
        });
        if (stockRow?.fabricId) {
          const materialId = await ensureMaterialRecord(stockRow.fabricId, 'FABRIC');
          await syncStockLevelQuantity(materialId, quantityGood, stockRow.warehouseId ?? undefined, 'METER', tx);
        }
      }

      // 8. Create the INWARD job-work challan INSIDE the same transaction — receiving material back
      // without a challan leaves the goods-movement ledger disagreeing with the send-out (same
      // split-ledger disease as the outward challan, F4 #13), so a challan failure rolls the
      // receive back instead of being silently swallowed.
      const itemType = this.getChallanItemType(sendOut.processType, sendOut.sourceType);
      const processLabel = sendOut.processType.replace('_', ' ').toLowerCase();

      const challan = await createChallan(
        {
          challanType: ChallanType.INWARD,
          challanDate: data.actualReturnDate,
          orderId: sendOut.orderId || undefined,
          productionRunId: sendOut.workOrderId,
          jobWorkOrderId: sendOut.jobWorkOrderId || undefined,
          fromType: 'VENDOR',
          fromId: sendOut.supplierId,
          fromName: sendOut.supplier?.name || 'Vendor',
          toType: 'WAREHOUSE',
          toName: sendOut.processType === 'HANDWORK' ? 'Finishing Floor' : 'Stitching Floor',
          unit: sendOut.unit,
          remarks: `${processLabel} receive: ${sendOut.batchNumber} (${data.quantityReceived} ${sendOut.unit})`,
          issuedById: data.createdById,
          items: [
            {
              itemType,
              quantity: data.quantityReceived,
              unit: sendOut.unit,
              description: `Received from ${processLabel} — Batch ${sendOut.batchNumber}`,
              serviceRequirementId: sendOut.serviceRequirementId || undefined,
              jobWorkOrderId: sendOut.jobWorkOrderId || undefined,
            },
          ],
        },
        tx
      );

      await tx.external_process_send_outs.update({
        where: { id: data.sendOutId },
        data: { inwardChallanId: challan.id },
      });

      logInfo('Created external process inward challan', {
        challanId: challan.id,
        sendOutId: data.sendOutId,
      });

      logInfo('External process material received', {
        sendOutId: sendOut.id,
        batchNumber: sendOut.batchNumber,
        quantityReceived: data.quantityReceived,
        quantityGood,
        quantityDamaged,
      });

      return {
        updatedSendOut,
        supplierName: sendOut.supplier?.name,
        trackingStyleId: sendOut.styleId || '',
        trackingWorkOrderId: sendOut.workOrderId,
        trackingProcessType: sendOut.processType,
        trackingNewStatus: newStatus,
        trackingQuantityGood: quantityGood,
      };
    });

    // Dashboard rollups POST-COMMIT (see createSendOut — swallowing inside a Postgres tx aborts it).
    await this.updateProductionTracking(
      prisma,
      result.trackingStyleId,
      result.trackingProcessType,
      'RECEIVE',
      Math.round(result.trackingQuantityGood)
    );
    if (result.trackingNewStatus === 'RECEIVED') {
      await this.createProductionTrackingRecord(
        prisma,
        result.trackingWorkOrderId,
        result.trackingProcessType,
        'RECEIVE',
        Math.round(result.trackingQuantityGood),
        data.createdById
      );
    }

    return result.updatedSendOut;
  }

  /**
   * Update production tracking piece counts
   */
  private async updateProductionTracking(
    tx: any,
    styleId: string,
    processType: ExternalProcessType,
    action: 'SEND' | 'RECEIVE' | 'CANCEL',
    quantity: number
  ) {
    if (!styleId || quantity <= 0) return;

    try {
      const tracking = await tx.style_production_tracking.findFirst({
        where: { styleId },
      });

      if (!tracking) return;

      const updateData: any = {};

      // CANCEL restores pieces to the ORIGIN stage (the stage SEND took them from), not the next
      // stage like RECEIVE does — cancelling used to push pieces forward (bug-hunt production-12).
      if (processType === 'SMOCKING') {
        if (action === 'SEND') {
          updateData.piecesInSmocking = { increment: quantity };
          updateData.piecesInCutting = { decrement: Math.min(quantity, tracking.piecesInCutting) };
        } else if (action === 'RECEIVE') {
          updateData.piecesInSmocking = { decrement: Math.min(quantity, tracking.piecesInSmocking) };
          updateData.piecesInStitching = { increment: quantity };
        } else {
          updateData.piecesInSmocking = { decrement: Math.min(quantity, tracking.piecesInSmocking) };
          updateData.piecesInCutting = { increment: quantity };
        }
      } else if (processType === 'HANDWORK') {
        if (action === 'SEND') {
          updateData.piecesInHandwork = { increment: quantity };
          updateData.piecesInStitching = { decrement: Math.min(quantity, tracking.piecesInStitching) };
        } else if (action === 'RECEIVE') {
          updateData.piecesInHandwork = { decrement: Math.min(quantity, tracking.piecesInHandwork) };
          updateData.piecesInFinishing = { increment: quantity };
        } else {
          updateData.piecesInHandwork = { decrement: Math.min(quantity, tracking.piecesInHandwork) };
          updateData.piecesInStitching = { increment: quantity };
        }
      } else if (processType === 'EMBROIDERY_PIECE') {
        if (action === 'SEND') {
          updateData.piecesInEmbroidery = { increment: quantity };
          updateData.piecesInCutting = { decrement: Math.min(quantity, tracking.piecesInCutting) };
        } else if (action === 'RECEIVE') {
          updateData.piecesInEmbroidery = { decrement: Math.min(quantity, tracking.piecesInEmbroidery) };
          updateData.piecesInStitching = { increment: quantity };
        } else {
          updateData.piecesInEmbroidery = { decrement: Math.min(quantity, tracking.piecesInEmbroidery) };
          updateData.piecesInCutting = { increment: quantity };
        }
      }

      if (Object.keys(updateData).length > 0) {
        await tx.style_production_tracking.update({
          where: { id: tracking.id },
          data: updateData,
        });
      }
    } catch (err) {
      // allow-swallow — style-level dashboard piece counts (timeline rollup), called POST-COMMIT
      // on the global client; the send/receive/cancel itself has already committed
      logError('Failed to update production tracking (non-critical)', err);
    }
  }

  /**
   * Map external process type to ProductionStage for tracking
   */
  private getProductionStage(processType: ExternalProcessType, action: 'SEND' | 'RECEIVE'): ProductionStage {
    if (action === 'SEND') {
      switch (processType) {
        case 'SMOCKING':
          return 'IN_SMOCKING';
        case 'HANDWORK':
          return 'IN_HANDWORK';
        case 'EMBROIDERY_PIECE':
          return 'IN_EMBROIDERY';
      }
    }
    // On receive, advance to next stage
    switch (processType) {
      case 'SMOCKING':
        return 'IN_STITCHING';
      case 'EMBROIDERY_PIECE':
        return 'IN_STITCHING';
      case 'HANDWORK':
        return 'IN_FINISHING';
    }
  }

  /**
   * Create a production_tracking record to update currentStage on the dashboard.
   * The dashboard reads the latest production_tracking record per work order to determine stage.
   */
  private async createProductionTrackingRecord(
    tx: any,
    workOrderId: string,
    processType: ExternalProcessType,
    action: 'SEND' | 'RECEIVE',
    quantity: number,
    userId: string
  ) {
    try {
      const stage = this.getProductionStage(processType, action);
      await tx.production_tracking.create({
        data: {
          id: randomUUID(),
          workOrderId,
          productionStage: stage,
          quantityCompleted: quantity,
          updatedById: userId,
          updateDate: new Date(),
        },
      });
      logDebug('Created production_tracking record', { workOrderId, stage, quantity });
    } catch (err) {
      // allow-swallow — pure timeline production_tracking entry (dashboard currentStage), called
      // POST-COMMIT on the global client; the send/receive itself has already committed
      logError('Failed to create production_tracking record (non-critical)', err);
    }
  }

  /**
   * Get all send-outs with filters and pagination
   */
  async getSendOuts(filters?: SendOutFilters) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.external_process_send_outsWhereInput = {};

    if (filters?.processType) where.processType = filters.processType;
    if (filters?.status) where.status = filters.status;
    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.workOrderId) where.workOrderId = filters.workOrderId;
    if (filters?.orderId) where.orderId = filters.orderId;
    if (filters?.styleId) where.styleId = filters.styleId;

    if (filters?.fromDate || filters?.toDate) {
      where.sendDate = {};
      if (filters?.fromDate) where.sendDate.gte = filters.fromDate;
      if (filters?.toDate) where.sendDate.lte = filters.toDate;
    }

    if (filters?.search) {
      where.OR = [
        { batchNumber: { contains: filters.search, mode: 'insensitive' } },
        { supplier: { name: { contains: filters.search, mode: 'insensitive' } } },
        { workOrder: { workOrderNumber: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.external_process_send_outs.findMany({
        where,
        include: {
          workOrder: { select: { workOrderNumber: true, totalQuantity: true } },
          supplier: { select: { name: true, code: true } },
          purchaseOrder: { select: { poNumber: true } },
          jobWorkOrder: { select: { jobWorkNumber: true, jwoStatus: true } },
          order: { select: { orderNumber: true } },
          style: { select: { styleCode: true, buyerStyleRef: true, styleName: true } },
          embroidery: { select: { designName: true, embroideryCode: true } },
          skuBreakdown: {
            include: {
              color: { select: { colorName: true } },
              size: { select: { sizeName: true } },
            },
          },
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.external_process_send_outs.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single send-out by ID with full details
   */
  async getSendOutById(id: string) {
    return await prisma.external_process_send_outs.findUnique({
      where: { id },
      include: {
        workOrder: { select: { workOrderNumber: true, totalQuantity: true, styleId: true } },
        supplier: { select: { name: true, code: true, phone: true } },
        purchaseOrder: { select: { poNumber: true, poCategory: true, status: true } },
        jobWorkOrder: { select: { jobWorkNumber: true, jwoStatus: true } },
        order: { select: { orderNumber: true } },
        style: { select: { styleCode: true, buyerStyleRef: true, styleName: true } },
        embroidery: { select: { designName: true, embroideryCode: true } },
        serviceRequirement: { select: { serviceType: true, status: true, quantityRequired: true } },
        skuBreakdown: {
          include: {
            color: { select: { colorName: true } },
            size: { select: { sizeName: true } },
          },
          orderBy: { sizeId: 'asc' },
        },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Cancel a send-out — reverses stock deductions and updates tracking
   */
  async cancelSendOut(id: string, reason: string, userId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const sendOut = await tx.external_process_send_outs.findUnique({
        where: { id },
        include: { supplier: { select: { name: true } } },
      });

      if (!sendOut) throw new Error('Send-out record not found');
      if (sendOut.status === 'RECEIVED' || sendOut.status === 'CANCELLED') {
        throw new Error(`Cannot cancel — send-out is already ${sendOut.status.toLowerCase()}`);
      }

      // Reverse fabric stock deduction if applicable
      // Phase 5b ledger fix: reversal transaction row + stock_levels sync
      if (sendOut.sourceType === 'FABRIC_STOCK' && sendOut.fabricStockId) {
        const qty = parseFloat(sendOut.quantitySent.toString());
        await tx.fabric_stock.update({
          where: { id: sendOut.fabricStockId },
          data: { quantityAvailable: { increment: qty } },
        });
        const stockRow = await tx.fabric_stock.findUnique({
          where: { id: sendOut.fabricStockId },
          select: { fabricId: true, warehouseId: true, weightedAvgCost: true, quantityAvailable: true },
        });
        const wac = Number(stockRow?.weightedAvgCost ?? 0);
        const balanceAfter = Number(stockRow?.quantityAvailable ?? 0);
        await tx.fabric_stock_transaction.create({
          data: {
            stockId: sendOut.fabricStockId,
            transactionType: 'RETURN',
            quantity: new Decimal(qty),
            referenceType: 'EXTERNAL_PROCESS',
            referenceId: sendOut.jobWorkOrderId ?? sendOut.id,
            costPerUnit: new Decimal(wac),
            weightedAvgCost: new Decimal(wac),
            totalValue: new Decimal(qty * wac),
            balanceAfter: new Decimal(balanceAfter),
            valueAfter: new Decimal(balanceAfter * wac),
            notes: `External process send-out cancelled (${sendOut.processType})`,
            createdById: userId,
          },
        });
        if (stockRow?.fabricId) {
          const materialId = await ensureMaterialRecord(stockRow.fabricId, 'FABRIC');
          await syncStockLevelQuantity(materialId, qty, stockRow.warehouseId ?? undefined, 'METER', tx);
        }
      }

      // Update service requirement: JWO-linked rows go back to PO_GENERATED (the JWO still
      // exists); legacy rows without a JWO revert to PENDING as before
      if (sendOut.serviceRequirementId) {
        await tx.work_order_service_requirements.update({
          where: { id: sendOut.serviceRequirementId },
          data: { status: sendOut.jobWorkOrderId ? 'PO_GENERATED' : 'PENDING' },
        });
      }

      const updated = await tx.external_process_send_outs.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          remarks: `Cancelled: ${reason}. Original remarks: ${sendOut.remarks || 'None'}`,
        },
        include: {
          workOrder: { select: { workOrderNumber: true } },
          supplier: { select: { name: true } },
        },
      });

      logInfo('External process send-out cancelled', {
        id,
        batchNumber: sendOut.batchNumber,
        reason,
      });

      return {
        updated,
        trackingStyleId: sendOut.styleId || '',
        trackingProcessType: sendOut.processType,
        trackingQuantity: Math.round(parseFloat(sendOut.quantitySent.toString())),
      };
    });

    // Reverse production tracking POST-COMMIT — CANCEL restores pieces to the origin stage; the old
    // 'RECEIVE' action advanced them to the NEXT stage instead (bug-hunt production-12). Outside the
    // tx because a swallowed failure inside a Postgres tx aborts it (25P02).
    await this.updateProductionTracking(
      prisma,
      result.trackingStyleId,
      result.trackingProcessType,
      'CANCEL',
      result.trackingQuantity
    );

    return result.updated;
  }

  /**
   * Get WIP dashboard data for a specific process type
   */
  async getDashboard(processType: ExternalProcessType) {
    const now = new Date();

    // Get all active (non-cancelled) send-outs for this process type
    const sendOuts = await prisma.external_process_send_outs.findMany({
      where: {
        processType,
        status: { notIn: ['CANCELLED'] },
      },
      include: {
        workOrder: { select: { workOrderNumber: true, totalQuantity: true } },
        supplier: { select: { name: true, code: true } },
        order: { select: { orderNumber: true } },
        style: { select: { styleCode: true, buyerStyleRef: true, styleName: true } },
        skuBreakdown: true,
      },
      orderBy: { sendDate: 'desc' },
    });

    // Summary counts
    const totalSent = sendOuts.length;
    const pending = sendOuts.filter((s) => s.status === 'SENT').length;
    const partiallyReceived = sendOuts.filter((s) => s.status === 'PARTIALLY_RECEIVED').length;
    const received = sendOuts.filter((s) => s.status === 'RECEIVED').length;
    const overdue = sendOuts.filter(
      (s) =>
        (s.status === 'SENT' || s.status === 'PARTIALLY_RECEIVED') && s.expectedReturnDate && s.expectedReturnDate < now
    ).length;

    // Total quantities
    const totalQtySent = sendOuts.reduce((sum, s) => sum + parseFloat(s.quantitySent.toString()), 0);
    const totalQtyReceived = sendOuts.reduce(
      (sum, s) => sum + (s.quantityReceived ? parseFloat(s.quantityReceived.toString()) : 0),
      0
    );
    const totalQtyPending = totalQtySent - totalQtyReceived;

    // Group by vendor
    const byVendor: Record<
      string,
      { supplierId: string; supplierName: string; sent: number; pending: number; received: number; overdue: number }
    > = {};
    for (const s of sendOuts) {
      const key = s.supplierId;
      if (!byVendor[key]) {
        byVendor[key] = {
          supplierId: key,
          supplierName: s.supplier?.name || 'Unknown',
          sent: 0,
          pending: 0,
          received: 0,
          overdue: 0,
        };
      }
      byVendor[key].sent++;
      if (s.status === 'SENT' || s.status === 'PARTIALLY_RECEIVED') byVendor[key].pending++;
      if (s.status === 'RECEIVED') byVendor[key].received++;
      if (
        (s.status === 'SENT' || s.status === 'PARTIALLY_RECEIVED') &&
        s.expectedReturnDate &&
        s.expectedReturnDate < now
      )
        byVendor[key].overdue++;
    }

    // Group by order
    const byOrder: Record<
      string,
      { orderId: string; orderNumber: string; styleName: string; sent: number; qtySent: number; qtyReceived: number }
    > = {};
    for (const s of sendOuts) {
      const key = s.orderId || 'no-order';
      if (!byOrder[key]) {
        byOrder[key] = {
          orderId: key,
          orderNumber: s.order?.orderNumber || 'Stock Production',
          styleName: s.style?.styleName || '',
          sent: 0,
          qtySent: 0,
          qtyReceived: 0,
        };
      }
      byOrder[key].sent++;
      byOrder[key].qtySent += parseFloat(s.quantitySent.toString());
      byOrder[key].qtyReceived += s.quantityReceived ? parseFloat(s.quantityReceived.toString()) : 0;
    }

    return {
      summary: {
        totalSent,
        pending,
        partiallyReceived,
        received,
        overdue,
        totalQtySent,
        totalQtyReceived,
        totalQtyPending,
      },
      byVendor: Object.values(byVendor),
      byOrder: Object.values(byOrder),
    };
  }

  /**
   * Get WIP for a specific work order
   */
  async getWipByWorkOrder(workOrderId: string, processType?: ExternalProcessType) {
    const where: Prisma.external_process_send_outsWhereInput = {
      workOrderId,
      status: { notIn: ['CANCELLED'] },
    };
    if (processType) where.processType = processType;

    return await prisma.external_process_send_outs.findMany({
      where,
      include: {
        supplier: { select: { name: true, code: true } },
        purchaseOrder: { select: { poNumber: true } },
        jobWorkOrder: { select: { jobWorkNumber: true, jwoStatus: true } },
        skuBreakdown: {
          include: {
            color: { select: { colorName: true } },
            size: { select: { sizeName: true } },
          },
        },
      },
      orderBy: { sendDate: 'desc' },
    });
  }
}

export const externalProcessService = new ExternalProcessService();
export default externalProcessService;
