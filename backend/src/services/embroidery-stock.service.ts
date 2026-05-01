/**
 * Embroidery Stock Service
 * Handles the send-out/receive workflow for fabric embroidery
 * Creates embroidered fabric stock as a new inventory item
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import { ChallanType, Unit } from '@prisma/client';
import { logInfo, logError, logDebug } from '../utils/logger';
import { createChallan } from './challan.service';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';

// ============================================
// Types
// ============================================

export interface SendOutDTO {
  sourceFabricStockId: string;
  embroideryId: string;
  supplierId: string;
  quantitySent: number;
  sentWidth: number;
  sendDate: Date;
  expectedReturnDate?: Date;
  agreedRate: number;
  forStyleId?: string;
  forOrderId?: string;
  remarks?: string;
  createdById: string;
}

export interface ReceiveDTO {
  sendOutId: string;
  quantityReceived: number;
  quantityDamaged?: number;
  receivedWidth: number;
  actualReturnDate: Date;
  actualCost?: number;
  invoiceNumber?: string;
  invoiceDate?: Date;
  qualityGrade?: string;
  warehouseLocation?: string;
  remarks?: string;
  createdById: string;
}

export interface SendOutFilters {
  status?: string;
  embroideryId?: string;
  supplierId?: string;
  forStyleId?: string;
  forOrderId?: string;
  fromDate?: Date;
  toDate?: Date;
}

// ============================================
// Service Class
// ============================================

class EmbroideryStockService {
  /**
   * Send fabric out for embroidery
   * Deducts from source stock and creates send-out record
   */
  async sendOut(data: SendOutDTO) {
    logDebug('Sending fabric for embroidery', {
      sourceStockId: data.sourceFabricStockId,
      embroideryId: data.embroideryId,
      quantity: data.quantitySent,
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify source stock exists and has enough quantity
      const sourceStock = await tx.fabric_stock.findUnique({
        where: { id: data.sourceFabricStockId },
        include: {
          fabricMaster: true,
        },
      });

      if (!sourceStock) {
        throw new Error('Source fabric stock not found');
      }

      const availableQty = parseFloat(sourceStock.quantityAvailable.toString());
      if (availableQty < data.quantitySent) {
        throw new Error(`Insufficient stock. Available: ${availableQty}, Requested: ${data.quantitySent}`);
      }

      // 2. Verify embroidery design exists
      const embroidery = await tx.embroidery_master.findUnique({
        where: { id: data.embroideryId },
      });

      if (!embroidery) {
        throw new Error('Embroidery design not found');
      }

      // 3. Verify supplier exists
      const supplier = await tx.suppliers.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // 4. Deduct from source stock and clear needsEmbroidery flag
      await tx.fabric_stock.update({
        where: { id: data.sourceFabricStockId },
        data: {
          quantityAvailable: {
            decrement: data.quantitySent,
          },
          needsEmbroidery: false,
        },
      });

      // 5. Create stock transaction for the deduction
      const costPerUnit = parseFloat(sourceStock.weightedAvgCost.toString());
      const totalValue = data.quantitySent * costPerUnit;
      const balanceAfterValue = (availableQty - data.quantitySent) * costPerUnit;

      await tx.fabric_stock_transaction.create({
        data: {
          stockId: data.sourceFabricStockId,
          transactionType: 'EMBROIDERY_SEND_OUT',
          quantity: new Decimal(data.quantitySent),
          referenceType: 'EMBROIDERY_SEND_OUT',
          costPerUnit: sourceStock.weightedAvgCost,
          weightedAvgCost: sourceStock.weightedAvgCost,
          totalValue: new Decimal(totalValue),
          balanceAfter: new Decimal(availableQty - data.quantitySent),
          valueAfter: new Decimal(balanceAfterValue),
          notes: `Sent for embroidery: ${embroidery.designName}`,
          createdById: data.createdById,
        },
      });

      // 5b. Sync stock_levels for the fabric deduction
      await syncStockLevelQuantity(sourceStock.fabricId, -data.quantitySent, undefined, tx);

      // 6. Create send-out record
      const sendOut = await tx.embroidery_send_out.create({
        data: {
          sourceFabricStockId: data.sourceFabricStockId,
          embroideryId: data.embroideryId,
          supplierId: data.supplierId,
          quantitySent: data.quantitySent,
          sentFinishedWidth: data.sentWidth,
          sendDate: data.sendDate,
          expectedReturnDate: data.expectedReturnDate,
          agreedRate: data.agreedRate,
          forStyleId: data.forStyleId,
          forOrderId: data.forOrderId,
          remarks: data.remarks,
          status: 'SENT',
          createdById: data.createdById,
        },
        include: {
          sourceFabricStock: {
            include: { fabricMaster: true },
          },
          embroidery: true,
          supplier: true,
          forStyle: true,
          forOrder: true,
        },
      });

      logInfo('Fabric sent for embroidery', {
        sendOutId: sendOut.id,
        quantity: data.quantitySent,
        embroideryDesign: embroidery.designName,
      });

      return sendOut;
    });

    // Create OUTWARD challan for document trail OUTSIDE transaction
    // Stock was already deducted above — challan is for audit/traceability only
    try {
      const challan = await createChallan({
        challanType: ChallanType.OUTWARD,
        challanDate: data.sendDate,
        orderId: data.forOrderId || undefined,
        fromType: 'WAREHOUSE',
        fromName: 'Fabric Store',
        toType: 'VENDOR',
        toId: data.supplierId,
        toName: result.supplier?.name || 'Embroidery Vendor',
        remarks: `Embroidery send-out: ${result.embroidery?.designName || 'Design'} (${data.quantitySent}m)`,
        issuedById: data.createdById,
        items: [
          {
            itemType: 'FABRIC',
            quantity: data.quantitySent,
            unit: Unit.METER,
            description: `Fabric for embroidery — ${result.embroidery?.designName || 'Design'}`,
          },
        ],
      });
      logInfo('Created embroidery outward challan', { challanId: challan.id, sendOutId: result.id });
    } catch (challanErr) {
      logError('Failed to create embroidery outward challan (non-critical)', challanErr);
    }

    return result;
  }

  /**
   * Receive embroidered fabric back
   * Creates new embroidered fabric stock entry
   */
  async receive(data: ReceiveDTO) {
    logDebug('Receiving embroidered fabric', {
      sendOutId: data.sendOutId,
      quantityReceived: data.quantityReceived,
    });

    return await prisma.$transaction(async (tx) => {
      // 1. Get send-out record
      const sendOut = await tx.embroidery_send_out.findUnique({
        where: { id: data.sendOutId },
        include: {
          sourceFabricStock: {
            include: { fabricMaster: true },
          },
          embroidery: true,
        },
      });

      if (!sendOut) {
        throw new Error('Send-out record not found');
      }

      if (sendOut.status === 'RECEIVED' || sendOut.status === 'CANCELLED') {
        throw new Error(`Send-out is already ${sendOut.status.toLowerCase()}`);
      }

      const sourceStock = sendOut.sourceFabricStock;
      const embroidery = sendOut.embroidery;

      // 2. Calculate costs
      const fabricCostPerMeter = parseFloat(sourceStock.weightedAvgCost.toString());
      const embroideryCostPerMeter = data.actualCost
        ? data.actualCost / data.quantityReceived
        : parseFloat(sendOut.agreedRate.toString());
      const totalCostPerMeter = fabricCostPerMeter + embroideryCostPerMeter;

      // 3. Create new embroidered fabric stock
      const embroideredStock = await tx.fabric_stock.create({
        data: {
          fabricId: sourceStock.fabricId,
          finishedWidth: parseFloat(sendOut.sentFinishedWidth.toString()),
          cutableWidth: data.receivedWidth,
          embroideryId: sendOut.embroideryId,
          quantityAvailable: data.quantityReceived,
          quantityReserved: 0,
          quantityConsumed: 0,
          unit: sourceStock.unit,
          procurementId: sourceStock.procurementId,
          originStyleId: sendOut.forStyleId || sourceStock.originStyleId,
          originOrderId: sendOut.forOrderId || sourceStock.originOrderId,
          status: 'AVAILABLE',
          stockType: 'PLANNED_STOCK', // Embroidered fabric (embroideryId links to embroidery_master)
          weightedAvgCost: totalCostPerMeter,
          purchaseCost: totalCostPerMeter,
          qualityGrade: data.qualityGrade || 'A',
          warehouseLocation: data.warehouseLocation,
          receivedDate: data.actualReturnDate,
          createdById: data.createdById,
        },
        include: {
          fabricMaster: true,
          embroidery: true,
        },
      });

      // 4. Create stock transaction for the receipt
      const receiptTotalValue = data.quantityReceived * totalCostPerMeter;

      await tx.fabric_stock_transaction.create({
        data: {
          stockId: embroideredStock.id,
          transactionType: 'EMBROIDERY_RECEIPT',
          quantity: new Decimal(data.quantityReceived),
          referenceType: 'EMBROIDERY_SEND_OUT',
          referenceId: sendOut.id,
          costPerUnit: new Decimal(totalCostPerMeter),
          weightedAvgCost: new Decimal(totalCostPerMeter),
          totalValue: new Decimal(receiptTotalValue),
          balanceAfter: new Decimal(data.quantityReceived),
          valueAfter: new Decimal(receiptTotalValue),
          notes: `Received from embroidery: ${embroidery.designName}`,
          createdById: data.createdById,
        },
      });

      // 4b. Ensure materials record exists and sync stock_levels for the embroidered fabric
      await ensureMaterialRecord(sourceStock.fabricId, 'FABRIC');
      await syncStockLevelQuantity(sourceStock.fabricId, data.quantityReceived, undefined, tx);

      // 5. Update send-out record
      const totalReceived = data.quantityReceived + (data.quantityDamaged || 0);
      const quantitySent = parseFloat(sendOut.quantitySent.toString());
      const newStatus = totalReceived >= quantitySent ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

      const updatedSendOut = await tx.embroidery_send_out.update({
        where: { id: data.sendOutId },
        data: {
          quantityReceived: data.quantityReceived,
          quantityDamaged: data.quantityDamaged || 0,
          receivedCutableWidth: data.receivedWidth,
          actualReturnDate: data.actualReturnDate,
          actualCost: data.actualCost || data.quantityReceived * embroideryCostPerMeter,
          invoiceNumber: data.invoiceNumber,
          invoiceDate: data.invoiceDate,
          status: newStatus,
          remarks: data.remarks || sendOut.remarks,
          resultFabricStockId: embroideredStock.id,
        },
        include: {
          sourceFabricStock: {
            include: { fabricMaster: true },
          },
          resultFabricStock: {
            include: { fabricMaster: true, embroidery: true },
          },
          embroidery: true,
          supplier: true,
        },
      });

      logInfo('Embroidered fabric received', {
        sendOutId: sendOut.id,
        newStockId: embroideredStock.id,
        quantityReceived: data.quantityReceived,
        embroideryDesign: embroidery.designName,
      });

      return updatedSendOut;
    });
  }

  /**
   * Get all send-out records with filters
   */
  async getSendOuts(filters?: SendOutFilters) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.embroideryId) {
      where.embroideryId = filters.embroideryId;
    }

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.forStyleId) {
      where.forStyleId = filters.forStyleId;
    }

    if (filters?.forOrderId) {
      where.forOrderId = filters.forOrderId;
    }

    if (filters?.fromDate || filters?.toDate) {
      where.sendDate = {};
      if (filters?.fromDate) {
        where.sendDate.gte = filters.fromDate;
      }
      if (filters?.toDate) {
        where.sendDate.lte = filters.toDate;
      }
    }

    return await prisma.embroidery_send_out.findMany({
      where,
      include: {
        sourceFabricStock: {
          include: { fabricMaster: true },
        },
        resultFabricStock: {
          include: { fabricMaster: true, embroidery: true },
        },
        embroidery: true,
        supplier: true,
        forStyle: { select: { styleCode: true, styleName: true } },
        forOrder: { select: { orderNumber: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { sendDate: 'desc' },
    });
  }

  /**
   * Get single send-out record by ID
   */
  async getSendOutById(id: string) {
    return await prisma.embroidery_send_out.findUnique({
      where: { id },
      include: {
        sourceFabricStock: {
          include: { fabricMaster: true },
        },
        resultFabricStock: {
          include: { fabricMaster: true, embroidery: true },
        },
        embroidery: true,
        supplier: true,
        forStyle: { select: { styleCode: true, styleName: true } },
        forOrder: { select: { orderNumber: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Get embroidered fabric stock for a style
   */
  async getEmbroideredStockForStyle(styleId: string) {
    return await prisma.fabric_stock.findMany({
      where: {
        embroideryId: { not: null },
        originStyleId: styleId,
        status: 'AVAILABLE',
      },
      include: {
        fabricMaster: true,
        embroidery: true,
      },
      orderBy: { receivedDate: 'desc' },
    });
  }

  /**
   * Get available embroidered fabric stock by embroidery design
   */
  async getStockByEmbroidery(embroideryId: string) {
    return await prisma.fabric_stock.findMany({
      where: {
        embroideryId,
        status: 'AVAILABLE',
        quantityAvailable: { gt: 0 },
      },
      include: {
        fabricMaster: true,
        embroidery: true,
        originStyle: { select: { styleCode: true, styleName: true } },
        originOrder: { select: { orderNumber: true } },
      },
      orderBy: { receivedDate: 'desc' },
    });
  }

  /**
   * Cancel a send-out (return fabric to source stock)
   */
  async cancelSendOut(sendOutId: string, reason: string, userId: string) {
    logDebug('Cancelling embroidery send-out', { sendOutId, reason });

    return await prisma.$transaction(async (tx) => {
      const sendOut = await tx.embroidery_send_out.findUnique({
        where: { id: sendOutId },
        include: { sourceFabricStock: true },
      });

      if (!sendOut) {
        throw new Error('Send-out record not found');
      }

      if (sendOut.status !== 'SENT') {
        throw new Error(`Cannot cancel send-out with status: ${sendOut.status}`);
      }

      // Return quantity to source stock
      const quantitySent = parseFloat(sendOut.quantitySent.toString());
      const sourceStock = await tx.fabric_stock.update({
        where: { id: sendOut.sourceFabricStockId },
        data: {
          quantityAvailable: { increment: quantitySent },
        },
      });

      // Create reversal transaction
      const costPerUnit = parseFloat(sourceStock.weightedAvgCost.toString());
      const cancelTotalValue = quantitySent * costPerUnit;
      const balanceAfter = parseFloat(sourceStock.quantityAvailable.toString());
      const valueAfter = balanceAfter * costPerUnit;

      await tx.fabric_stock_transaction.create({
        data: {
          stockId: sendOut.sourceFabricStockId,
          transactionType: 'EMBROIDERY_CANCELLED',
          quantity: new Decimal(quantitySent),
          referenceType: 'EMBROIDERY_SEND_OUT',
          referenceId: sendOut.id,
          costPerUnit: sourceStock.weightedAvgCost,
          weightedAvgCost: sourceStock.weightedAvgCost,
          totalValue: new Decimal(cancelTotalValue),
          balanceAfter: sourceStock.quantityAvailable,
          valueAfter: new Decimal(valueAfter),
          notes: `Embroidery cancelled: ${reason}`,
          createdById: userId,
        },
      });

      // Sync stock_levels for the fabric return
      if (sendOut.sourceFabricStock?.fabricId) {
        await syncStockLevelQuantity(sendOut.sourceFabricStock.fabricId, quantitySent, undefined, tx);
      }

      // Update send-out status
      const cancelled = await tx.embroidery_send_out.update({
        where: { id: sendOutId },
        data: {
          status: 'CANCELLED',
          remarks: `Cancelled: ${reason}`,
        },
      });

      logInfo('Embroidery send-out cancelled', { sendOutId, reason });

      return cancelled;
    });
  }

  /**
   * Get pending send-outs (overdue)
   */
  async getPendingSendOuts() {
    const today = new Date();

    return await prisma.embroidery_send_out.findMany({
      where: {
        status: { in: ['SENT', 'IN_PROGRESS'] },
        expectedReturnDate: { lt: today },
      },
      include: {
        sourceFabricStock: {
          include: { fabricMaster: true },
        },
        embroidery: true,
        supplier: true,
        forStyle: { select: { styleCode: true, styleName: true } },
      },
      orderBy: { expectedReturnDate: 'asc' },
    });
  }

  /**
   * Get embroidery stock summary
   */
  async getStockSummary() {
    // Get all embroidered stock grouped by embroidery design
    const embroideredStock = await prisma.fabric_stock.groupBy({
      by: ['embroideryId'],
      where: {
        embroideryId: { not: null },
        status: 'AVAILABLE',
      },
      _sum: {
        quantityAvailable: true,
        quantityReserved: true,
      },
      _count: {
        id: true,
      },
    });

    // Get pending send-outs
    const pendingSendOuts = await prisma.embroidery_send_out.aggregate({
      where: {
        status: { in: ['SENT', 'IN_PROGRESS'] },
      },
      _sum: {
        quantitySent: true,
      },
      _count: {
        id: true,
      },
    });

    // Get embroidery details for the grouped stock
    const embroideryIds = embroideredStock.map((s) => s.embroideryId).filter((id): id is string => id !== null);

    const embroideries = await prisma.embroidery_master.findMany({
      where: { id: { in: embroideryIds } },
      select: { id: true, embroideryCode: true, designName: true },
    });

    const embroideryMap = new Map(embroideries.map((e) => [e.id, e]));

    return {
      embroideredStock: embroideredStock.map((s) => ({
        embroidery: embroideryMap.get(s.embroideryId!),
        totalAvailable: s._sum.quantityAvailable,
        totalReserved: s._sum.quantityReserved,
        stockCount: s._count.id,
      })),
      pendingSendOuts: {
        totalQuantity: pendingSendOuts._sum.quantitySent,
        count: pendingSendOuts._count.id,
      },
    };
  }
  /**
   * Get fabric stock that needs embroidery but hasn't been sent yet
   */
  async getStockPendingEmbroidery(params?: { styleId?: string; page?: number; limit?: number }) {
    const where: any = {
      needsEmbroidery: true,
      status: 'AVAILABLE',
      quantityAvailable: { gt: 0 },
    };
    if (params?.styleId) where.originStyleId = params.styleId;

    const page = params?.page || 1;
    const limit = params?.limit || 20;

    const [data, total] = await Promise.all([
      prisma.fabric_stock.findMany({
        where,
        include: {
          fabricMaster: { select: { fabricCode: true, fabricName: true, colorName: true } },
          originStyle: { select: { id: true, styleCode: true, styleName: true } },
          originOrder: { select: { id: true, orderNumber: true } },
        },
        orderBy: { receivedDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.fabric_stock.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

export const embroideryStockService = new EmbroideryStockService();
export default embroideryStockService;
