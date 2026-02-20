/**
 * Purchase Order Service
 * Business logic for purchase order operations
 */

import { PurchaseOrderStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import {
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
  PurchaseOrderItemDTO,
  UpdatePurchaseOrderItemDTO,
  PurchaseOrderFilters,
} from '../types/purchaseOrder.types';

class PurchaseOrderService {
  /**
   * Generate unique PO number - Format: PO2511-0001
   */
  private async generatePONumber(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const prefix = `PO${year}${month}`;

    // Find the last PO number for this month (including deleted POs to avoid gaps in sequence)
    // Note: We include deleted POs to maintain sequential numbering without gaps.
    // This prevents confusion in auditing and maintains continuous numbering like PO2511-0001, PO2511-0002, etc.
    const lastPO = await prisma.purchase_orders.findFirst({
      where: {
        poNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        poNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastPO) {
      // Extract sequence from format PO2511-0001
      const lastSequence = parseInt(lastPO.poNumber.split('-')[1] || '0');
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Calculate total price for an item
   */
  private calculateItemTotal(quantity: number, unitPrice: number): number {
    return quantity * unitPrice;
  }

  /**
   * Recalculate PO total from items
   */
  private async recalculatePOTotal(poId: string): Promise<void> {
    const items = await prisma.purchase_order_items.findMany({
      where: { poId },
    });

    const totalAmount = items.reduce((sum, item) => {
      return sum + Number(item.totalPrice);
    }, 0);

    await prisma.purchase_orders.update({
      where: { id: poId },
      data: { totalAmount },
    });
  }

  /**
   * Create a new purchase order with items
   */
  async createPurchaseOrder(data: CreatePurchaseOrderDTO, userId: string) {
    const poNumber = await this.generatePONumber();

    // Validate supplier exists
    const supplier = await prisma.suppliers.findUnique({
      where: { id: data.supplierId },
    });

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // Validate all materials exist
    for (const item of data.items) {
      const material = await prisma.materials.findUnique({
        where: { id: item.materialId },
      });
      if (!material) {
        throw new Error(`Material with ID ${item.materialId} not found`);
      }
    }

    // Calculate totals
    let totalAmount = 0;
    const itemsWithTotals = data.items.map((item) => {
      const totalPrice = this.calculateItemTotal(item.orderedQuantity, item.unitPrice);
      totalAmount += totalPrice;
      return {
        id: randomUUID(),
        materialId: item.materialId,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: 0,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice,
        remarks: item.remarks || null,
      };
    });

    // Create PO with items in transaction
    const purchaseOrder = await prisma.purchase_orders.create({
      data: {
        id: randomUUID(),
        poNumber,
        supplierId: data.supplierId,
        expectedDeliveryDate: new Date(data.expectedDeliveryDate),
        status: PurchaseOrderStatus.DRAFT,
        totalAmount,
        paymentTerms: data.paymentTerms || supplier.paymentTerms || null,
        remarks: data.remarks || null,
        createdById: userId,
        purchase_order_items: {
          create: itemsWithTotals,
        },
      },
      include: this.getFullInclude(),
    });

    return purchaseOrder;
  }

  /**
   * Get all purchase orders with filters and pagination
   */
  async getAllPurchaseOrders(filters?: PurchaseOrderFilters) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.purchase_ordersWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.search) {
      where.OR = [
        { poNumber: { contains: filters.search, mode: 'insensitive' } },
        { suppliers: { is: { name: { contains: filters.search, mode: 'insensitive' } } } },
        { suppliers: { is: { code: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    if (filters?.startDate || filters?.endDate) {
      where.poDate = {};
      if (filters?.startDate) {
        where.poDate.gte = new Date(filters.startDate);
      }
      if (filters?.endDate) {
        where.poDate.lte = new Date(filters.endDate);
      }
    }

    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder || 'desc';

    const [purchaseOrders, total] = await Promise.all([
      prisma.purchase_orders.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          suppliers: {
            select: {
              id: true,
              code: true,
              name: true,
              contactPerson: true,
              email: true,
              phone: true,
              paymentTerms: true,
            },
          },
          purchase_order_items: true,
        },
      }),
      prisma.purchase_orders.count({ where }),
    ]);

    return {
      data: purchaseOrders.map((po) => ({
        ...po,
        itemCount: po.purchase_order_items.length,
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
   * Get a single purchase order by ID with all relations
   */
  async getPurchaseOrderById(id: string) {
    const purchaseOrder = await prisma.purchase_orders.findUnique({
      where: { id },
      include: this.getFullInclude(),
    });

    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    return purchaseOrder;
  }

  /**
   * Get purchase orders by supplier
   */
  async getPurchaseOrdersBySupplier(supplierId: string, filters?: PurchaseOrderFilters) {
    return this.getAllPurchaseOrders({ ...filters, supplierId });
  }

  /**
   * Update a purchase order (only in DRAFT status)
   * If items are provided, replaces all existing items
   */
  async updatePurchaseOrder(id: string, data: UpdatePurchaseOrderDTO) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    if (existingPO.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error('Can only update purchase orders in DRAFT status');
    }

    // Validate supplier if being changed
    if (data.supplierId && data.supplierId !== existingPO.supplierId) {
      const supplier = await prisma.suppliers.findUnique({
        where: { id: data.supplierId },
      });
      if (!supplier) {
        throw new Error('Supplier not found');
      }
    }

    // If items are provided, validate and replace all existing items
    if (data.items && data.items.length > 0) {
      // Validate all materials exist
      for (const item of data.items) {
        const material = await prisma.materials.findUnique({
          where: { id: item.materialId },
        });
        if (!material) {
          throw new Error(`Material with ID ${item.materialId} not found`);
        }
      }
    }

    // Use transaction to update PO and replace items atomically
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // Update PO header
      const updatedPO = await tx.purchase_orders.update({
        where: { id },
        data: {
          supplierId: data.supplierId,
          expectedDeliveryDate: data.expectedDeliveryDate
            ? new Date(data.expectedDeliveryDate)
            : undefined,
          paymentTerms: data.paymentTerms,
          remarks: data.remarks,
        },
      });

      // If items are provided, delete existing and create new ones
      if (data.items) {
        // Delete all existing items
        await tx.purchase_order_items.deleteMany({
          where: { poId: id },
        });

        // Create new items
        if (data.items.length > 0) {
          const itemsData = data.items.map((item) => ({
            id: randomUUID(),
            poId: id,
            materialId: item.materialId,
            orderedQuantity: item.orderedQuantity,
            receivedQuantity: 0,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: this.calculateItemTotal(item.orderedQuantity, item.unitPrice),
            remarks: item.remarks || null,
          }));

          await tx.purchase_order_items.createMany({
            data: itemsData,
          });

          // Recalculate total
          const totalAmount = itemsData.reduce((sum, item) => sum + item.totalPrice, 0);
          await tx.purchase_orders.update({
            where: { id },
            data: { totalAmount },
          });
        }
      }

      // Fetch and return the updated PO with all includes
      return tx.purchase_orders.findUnique({
        where: { id },
        include: this.getFullInclude(),
      });
    });

    return purchaseOrder;
  }

  /**
   * Delete a purchase order (only in DRAFT status)
   */
  async deletePurchaseOrder(id: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    if (existingPO.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error('Can only delete purchase orders in DRAFT status');
    }

    await prisma.purchase_orders.delete({
      where: { id },
    });

    return { message: 'Purchase order deleted successfully' };
  }

  // ============================================
  // Item Management
  // ============================================

  /**
   * Add an item to a purchase order
   */
  async addPurchaseOrderItem(poId: string, item: PurchaseOrderItemDTO) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id: poId },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    if (existingPO.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error('Can only add items to purchase orders in DRAFT status');
    }

    // Validate material exists
    const material = await prisma.materials.findUnique({
      where: { id: item.materialId },
    });

    if (!material) {
      throw new Error('Material not found');
    }

    const totalPrice = this.calculateItemTotal(item.orderedQuantity, item.unitPrice);

    const newItem = await prisma.purchase_order_items.create({
      data: {
        id: randomUUID(),
        poId,
        materialId: item.materialId,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: 0,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice,
        remarks: item.remarks || null,
      },
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
      },
    });

    // Recalculate PO total
    await this.recalculatePOTotal(poId);

    return newItem;
  }

  /**
   * Update a purchase order item
   */
  async updatePurchaseOrderItem(
    poId: string,
    itemId: string,
    data: UpdatePurchaseOrderItemDTO
  ) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id: poId },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    if (existingPO.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error('Can only update items on purchase orders in DRAFT status');
    }

    const existingItem = await prisma.purchase_order_items.findFirst({
      where: { id: itemId, poId },
    });

    if (!existingItem) {
      throw new Error('Purchase order item not found');
    }

    const orderedQuantity = data.orderedQuantity ?? Number(existingItem.orderedQuantity);
    const unitPrice = data.unitPrice ?? Number(existingItem.unitPrice);
    const totalPrice = this.calculateItemTotal(orderedQuantity, unitPrice);

    const updatedItem = await prisma.purchase_order_items.update({
      where: { id: itemId },
      data: {
        orderedQuantity: data.orderedQuantity,
        unit: data.unit,
        unitPrice: data.unitPrice,
        totalPrice,
        remarks: data.remarks,
      },
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
      },
    });

    // Recalculate PO total
    await this.recalculatePOTotal(poId);

    return updatedItem;
  }

  /**
   * Remove an item from a purchase order
   */
  async removePurchaseOrderItem(poId: string, itemId: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id: poId },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    if (existingPO.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error('Can only remove items from purchase orders in DRAFT status');
    }

    const existingItem = await prisma.purchase_order_items.findFirst({
      where: { id: itemId, poId },
    });

    if (!existingItem) {
      throw new Error('Purchase order item not found');
    }

    await prisma.purchase_order_items.delete({
      where: { id: itemId },
    });

    // Recalculate PO total
    await this.recalculatePOTotal(poId);

    return { message: 'Item removed successfully' };
  }

  // ============================================
  // Status Transitions
  // ============================================

  /**
   * Send purchase order to supplier (DRAFT -> SENT or READY_FOR_PROCESSING -> SENT)
   */
  async sendPurchaseOrder(id: string, userId: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
      include: { purchase_order_items: true },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    // Allow sending from DRAFT or READY_FOR_PROCESSING status
    if (existingPO.status !== PurchaseOrderStatus.DRAFT && existingPO.status !== PurchaseOrderStatus.READY_FOR_PROCESSING) {
      throw new Error('Can only send purchase orders in DRAFT or READY_FOR_PROCESSING status');
    }

    if (existingPO.purchase_order_items.length === 0) {
      throw new Error('Cannot send purchase order with no items');
    }

    const purchaseOrder = await prisma.purchase_orders.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.SENT,
        approvedById: userId,
      },
      include: this.getFullInclude(),
    });

    return purchaseOrder;
  }

  /**
   * Acknowledge purchase order (SENT -> ACKNOWLEDGED)
   */
  async acknowledgePurchaseOrder(id: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    if (existingPO.status !== PurchaseOrderStatus.SENT) {
      throw new Error('Can only acknowledge purchase orders in SENT status');
    }

    const purchaseOrder = await prisma.purchase_orders.update({
      where: { id },
      data: { status: PurchaseOrderStatus.ACKNOWLEDGED },
      include: this.getFullInclude(),
    });

    return purchaseOrder;
  }

  /**
   * Cancel purchase order
   */
  async cancelPurchaseOrder(id: string, reason: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    if (existingPO.status === PurchaseOrderStatus.RECEIVED) {
      throw new Error('Cannot cancel a received purchase order');
    }

    if (existingPO.status === PurchaseOrderStatus.CANCELLED) {
      throw new Error('Purchase order is already cancelled');
    }

    const purchaseOrder = await prisma.purchase_orders.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.CANCELLED,
        remarks: reason
          ? `${existingPO.remarks || ''}\n\nCancellation reason: ${reason}`.trim()
          : existingPO.remarks,
      },
      include: this.getFullInclude(),
    });

    return purchaseOrder;
  }

  /**
   * Update PO status based on receiving (called from GRN service)
   */
  async updateReceivingStatus(poId: string) {
    const items = await prisma.purchase_order_items.findMany({
      where: { poId },
    });

    if (items.length === 0) {
      return;
    }

    const allFullyReceived = items.every(
      (item) => Number(item.receivedQuantity) >= Number(item.orderedQuantity)
    );
    const anyPartiallyReceived = items.some((item) => Number(item.receivedQuantity) > 0);

    let newStatus: PurchaseOrderStatus;
    if (allFullyReceived) {
      newStatus = PurchaseOrderStatus.RECEIVED;
    } else if (anyPartiallyReceived) {
      newStatus = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    } else {
      return; // No change needed
    }

    await prisma.purchase_orders.update({
      where: { id: poId },
      data: { status: newStatus },
    });
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get full include for PO queries
   */
  private getFullInclude() {
    return {
      suppliers: {
        select: {
          id: true,
          code: true,
          name: true,
          contactPerson: true,
          email: true,
          phone: true,
          paymentTerms: true,
        },
      },
      purchase_order_items: {
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
        },
      },
      users_purchase_orders_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users_purchase_orders_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      goods_receiving_notes: {
        select: {
          id: true,
          grnNumber: true,
          receivingDate: true,
          status: true,
          grn_items: {
            select: {
              receivedQuantity: true,
              acceptedQuantity: true,
            },
          },
        },
      },
    };
  }

  /**
   * Get receivable POs for GRN creation
   * Returns POs in SENT, ACKNOWLEDGED, or PARTIALLY_RECEIVED status
   */
  async getReceivablePurchaseOrders(supplierId?: string) {
    const where: Prisma.purchase_ordersWhereInput = {
      status: {
        in: [
          PurchaseOrderStatus.SENT,
          PurchaseOrderStatus.ACKNOWLEDGED,
          PurchaseOrderStatus.PARTIALLY_RECEIVED,
        ],
      },
    };

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const purchaseOrders = await prisma.purchase_orders.findMany({
      where,
      include: {
        suppliers: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        purchase_order_items: {
          include: {
            materials: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
      orderBy: { expectedDeliveryDate: 'asc' },
    });

    return purchaseOrders;
  }

  /**
   * Get pending quantities for PO items (for GRN form)
   */
  async getPendingItemsForPO(poId: string) {
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
                unit: true,
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
      receivedQuantity: Number(item.receivedQuantity),
      pendingQuantity: Number(item.orderedQuantity) - Number(item.receivedQuantity),
      unitPrice: Number(item.unitPrice),
    }));
  }
}

export const purchaseOrderService = new PurchaseOrderService();
export default purchaseOrderService;
