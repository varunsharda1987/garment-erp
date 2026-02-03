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
} from '../types/grn.types';
import { purchaseOrderService } from './purchaseOrder.service';
import mrpService from './mrp.service';
import { costSheetPOGenerationService } from './costSheetPOGeneration.service';
import prisma from '../config/database';  // Use singleton to avoid connection pool leak
import { logInfo, logError } from '../utils/logger';

class GRNService {
  /**
   * Generate unique GRN number - Format: GRN2511-0001
   */
  private async generateGRNNumber(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const prefix = `GRN${year}${month}`;

    // Find the last GRN number for this month (including deleted GRNs to avoid gaps in sequence)
    // Note: We include deleted GRNs to maintain sequential numbering without gaps.
    // This prevents confusion in auditing and maintains continuous numbering like GRN2511-0001, GRN2511-0002, etc.
    const lastGRN = await prisma.goods_receiving_notes.findFirst({
      where: {
        grnNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        grnNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastGRN) {
      // Extract sequence from format GRN2511-0001
      const lastSequence = parseInt(lastGRN.grnNumber.split('-')[1] || '0');
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new GRN
   */
  async createGRN(data: CreateGRNDTO, userId: string) {
    // Validate PO exists and is in receivable status
    const po = await prisma.purchase_orders.findUnique({
      where: { id: data.poId },
      include: { purchase_order_items: true },
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

    // Validate items
    for (const item of data.items) {
      const poItem = po.purchase_order_items.find((pi) => pi.id === item.poItemId);
      if (!poItem) {
        throw new Error(`PO item ${item.poItemId} not found`);
      }

      // Check if receiving more than ordered
      const pendingQty = Number(poItem.orderedQuantity) - Number(poItem.receivedQuantity);
      if (item.receivedQuantity > pendingQty) {
        throw new Error(
          `Cannot receive ${item.receivedQuantity} units. Only ${pendingQty} pending for item ${item.poItemId}`
        );
      }

      // Validate accepted + rejected = received
      if (item.acceptedQuantity + item.rejectedQuantity !== item.receivedQuantity) {
        throw new Error(
          `Accepted (${item.acceptedQuantity}) + Rejected (${item.rejectedQuantity}) must equal Received (${item.receivedQuantity})`
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
            create: data.items.map((item) => ({
              id: randomUUID(),
              poItemId: item.poItemId,
              materialId: item.materialId,
              orderedQuantity: po.purchase_order_items.find((pi) => pi.id === item.poItemId)
                ?.orderedQuantity || 0,
              receivedQuantity: item.receivedQuantity,
              acceptedQuantity: item.acceptedQuantity,
              rejectedQuantity: item.rejectedQuantity,
              unit: item.unit,
              remarks: item.remarks || null,
            })),
          },
        },
        include: this.getFullInclude(),
      });

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

    return po.purchase_order_items.map((item) => ({
      poItemId: item.id,
      materialId: item.materialId,
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
  async approveGRN(id: string, userId: string, warehouseId?: string) {
    const grn = await prisma.goods_receiving_notes.findUnique({
      where: { id },
      include: {
        grn_items: {
          include: {
            purchase_order_items: true,
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

      // Create stock movements and update stock levels for accepted items
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty > 0) {
          // Get unit price from PO item for stock valuation
          const unitPrice = item.purchase_order_items
            ? Number(item.purchase_order_items.unitPrice)
            : 0;

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
          remarks: reason
            ? `${grn.remarks || ''}\n\nRejection reason: ${reason}`.trim()
            : grn.remarks,
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
}

export const grnService = new GRNService();
export default grnService;
