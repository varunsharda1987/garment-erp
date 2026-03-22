/**
 * Purchase Order Service
 * Business logic for purchase order operations
 */

import { PurchaseOrderStatus, Prisma, POSource, ServiceType } from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { gstService } from './gst.service';
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

    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const item of items) {
      subtotal += Number(item.totalPrice);
      totalCgst += Number(item.cgstAmount || 0);
      totalSgst += Number(item.sgstAmount || 0);
      totalIgst += Number(item.igstAmount || 0);
    }

    const totalTax = totalCgst + totalSgst + totalIgst;
    const totalAmount = subtotal + totalTax;

    await prisma.purchase_orders.update({
      where: { id: poId },
      data: {
        subtotal: parseFloat(subtotal.toFixed(2)),
        totalCgst: parseFloat(totalCgst.toFixed(2)),
        totalSgst: parseFloat(totalSgst.toFixed(2)),
        totalIgst: parseFloat(totalIgst.toFixed(2)),
        totalTax: parseFloat(totalTax.toFixed(2)),
        totalAmount: parseFloat(totalAmount.toFixed(2)),
      },
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

    // Validate items: each must have either materialId OR serviceType
    for (const item of data.items) {
      if (!item.materialId && !item.serviceType) {
        throw new Error('Each item must have either a materialId or a serviceType');
      }
    }

    // Validate materials exist for material-based items (batch query to avoid N+1)
    const materialIds = data.items.filter((item) => item.materialId).map((item) => item.materialId!);
    if (materialIds.length > 0) {
      const existingMaterials = await prisma.materials.findMany({
        where: { id: { in: materialIds } },
        select: { id: true },
      });
      const existingMaterialIds = new Set(existingMaterials.map((m) => m.id));
      for (const materialId of materialIds) {
        if (!existingMaterialIds.has(materialId)) {
          throw new Error(`Material with ID ${materialId} not found`);
        }
      }
    }

    // Determine interstate status for GST calculation
    const { isInterstate } = await gstService.isInterstatePO(data.supplierId);

    // Calculate totals with GST per item
    let subtotal = 0;
    let poTotalCgst = 0;
    let poTotalSgst = 0;
    let poTotalIgst = 0;

    const itemsWithTotals = await Promise.all(
      data.items.map(async (item) => {
        const totalPrice = this.calculateItemTotal(item.orderedQuantity, item.unitPrice);
        subtotal += totalPrice;

        // Calculate GST for this item
        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          hsnSacCode: null, // Will be resolved from materialId
          materialId: item.materialId || null,
          isInterstate,
        });

        poTotalCgst += gst.cgstAmount;
        poTotalSgst += gst.sgstAmount;
        poTotalIgst += gst.igstAmount;

        return {
          id: randomUUID(),
          materialId: item.materialId || null,
          serviceType: (item.serviceType as ServiceType) || null,
          serviceDescription: item.serviceDescription || null,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: 0,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks: item.remarks || null,
        };
      })
    );

    const totalTax = parseFloat((poTotalCgst + poTotalSgst + poTotalIgst).toFixed(2));
    const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

    // Create PO with items in transaction
    const purchaseOrder = await prisma.purchase_orders.create({
      data: {
        id: randomUUID(),
        poNumber,
        supplierId: data.supplierId,
        expectedDeliveryDate: new Date(data.expectedDeliveryDate),
        status: PurchaseOrderStatus.DRAFT,
        poSource: POSource.MANUAL,
        poCategory: (data.poCategory as any) || undefined,
        subtotal: parseFloat(subtotal.toFixed(2)),
        totalCgst: parseFloat(poTotalCgst.toFixed(2)),
        totalSgst: parseFloat(poTotalSgst.toFixed(2)),
        totalIgst: parseFloat(poTotalIgst.toFixed(2)),
        totalTax,
        totalAmount,
        isInterstate,
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

    if (filters?.source) {
      where.poSource = filters.source;
    }

    if (filters?.poCategories && filters.poCategories.length > 0) {
      where.poCategory = { in: filters.poCategories as any };
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
   * Update a purchase order (DRAFT, PENDING_GREIGE, or READY_FOR_PROCESSING)
   * If items are provided, replaces all existing items
   */
  async updatePurchaseOrder(id: string, data: UpdatePurchaseOrderDTO) {
    const editableStatuses: string[] = [
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.PENDING_GREIGE,
      PurchaseOrderStatus.READY_FOR_PROCESSING,
    ];

    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    if (!editableStatuses.includes(existingPO.status)) {
      throw new Error('Can only update purchase orders in Draft, Pending Greige, or Ready for Processing status');
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
      // Validate items: each must have either materialId OR serviceType
      for (const item of data.items) {
        if (!item.materialId && !item.serviceType) {
          throw new Error('Each item must have either a materialId or a serviceType');
        }
      }

      // Validate materials exist for material-based items (batch query to avoid N+1)
      const materialIds = data.items.filter((item) => item.materialId).map((item) => item.materialId!);
      if (materialIds.length > 0) {
        const existingMaterials = await prisma.materials.findMany({
          where: { id: { in: materialIds } },
          select: { id: true },
        });
        const existingMaterialIds = new Set(existingMaterials.map((m) => m.id));
        for (const materialId of materialIds) {
          if (!existingMaterialIds.has(materialId)) {
            throw new Error(`Material with ID ${materialId} not found`);
          }
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
          expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : undefined,
          paymentTerms: data.paymentTerms,
          remarks: data.remarks,
        },
      });

      // If items are provided, delete existing and create new ones
      if (data.items) {
        // Clean up linked records before deleting items
        const existingItems = await tx.purchase_order_items.findMany({
          where: { poId: id },
          select: { id: true },
        });
        const itemIds = existingItems.map((i) => i.id);
        if (itemIds.length > 0) {
          await tx.requirement_po_links.deleteMany({
            where: { purchaseOrderItemId: { in: itemIds } },
          });
          await tx.grn_items.deleteMany({
            where: { poItemId: { in: itemIds } },
          });
        }

        // Delete all existing items
        await tx.purchase_order_items.deleteMany({
          where: { poId: id },
        });

        // Create new items with GST
        if (data.items.length > 0) {
          const supplierId = data.supplierId || existingPO.supplierId;
          const { isInterstate } = await gstService.isInterstatePO(supplierId);

          let subtotal = 0;
          let poTotalCgst = 0;
          let poTotalSgst = 0;
          let poTotalIgst = 0;

          for (const item of data.items) {
            const totalPrice = this.calculateItemTotal(item.orderedQuantity, item.unitPrice);
            subtotal += totalPrice;

            // Calculate GST based on material or service type
            const gst = await gstService.calculateLineItemGST({
              lineTotal: totalPrice,
              materialId: item.materialId || null,
              hsnSacCode: item.serviceType
                ? (await gstService.getSACCodeForService(item.serviceType as ServiceType)).sacCode
                : null,
              isInterstate,
            });

            poTotalCgst += gst.cgstAmount;
            poTotalSgst += gst.sgstAmount;
            poTotalIgst += gst.igstAmount;

            await tx.purchase_order_items.create({
              data: {
                id: randomUUID(),
                poId: id,
                materialId: item.materialId || null,
                serviceType: (item.serviceType as ServiceType) || null,
                serviceDescription: item.serviceDescription || null,
                orderedQuantity: item.orderedQuantity,
                receivedQuantity: 0,
                unit: item.unit,
                unitPrice: item.unitPrice,
                totalPrice,
                hsnCode: gst.hsnCode,
                gstRate: gst.gstRate,
                cgstRate: gst.cgstRate,
                cgstAmount: gst.cgstAmount,
                sgstRate: gst.sgstRate,
                sgstAmount: gst.sgstAmount,
                igstRate: gst.igstRate,
                igstAmount: gst.igstAmount,
                taxAmount: gst.taxAmount,
                remarks: item.remarks || null,
              },
            });
          }

          // Update PO header with GST totals
          const totalTax = poTotalCgst + poTotalSgst + poTotalIgst;
          await tx.purchase_orders.update({
            where: { id },
            data: {
              subtotal,
              totalCgst: poTotalCgst,
              totalSgst: poTotalSgst,
              totalIgst: poTotalIgst,
              totalTax,
              totalAmount: subtotal + totalTax,
              isInterstate,
            },
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

    // Calculate GST for this item
    const { isInterstate } = await gstService.isInterstatePO(existingPO.supplierId);
    const gst = await gstService.calculateLineItemGST({
      lineTotal: totalPrice,
      materialId: item.materialId,
      isInterstate,
    });

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
        hsnCode: gst.hsnCode,
        gstRate: gst.gstRate,
        cgstRate: gst.cgstRate,
        cgstAmount: gst.cgstAmount,
        sgstRate: gst.sgstRate,
        sgstAmount: gst.sgstAmount,
        igstRate: gst.igstRate,
        igstAmount: gst.igstAmount,
        taxAmount: gst.taxAmount,
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

    // Recalculate PO total (now includes GST)
    await this.recalculatePOTotal(poId);

    return newItem;
  }

  /**
   * Update a purchase order item
   */
  async updatePurchaseOrderItem(poId: string, itemId: string, data: UpdatePurchaseOrderItemDTO) {
    const editableStatuses: string[] = [
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.PENDING_GREIGE,
      PurchaseOrderStatus.READY_FOR_PROCESSING,
    ];

    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id: poId },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    if (!editableStatuses.includes(existingPO.status)) {
      throw new Error(
        'Can only update items on purchase orders in Draft, Pending Greige, or Ready for Processing status'
      );
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

    // Recalculate GST if price changed
    const { isInterstate } = await gstService.isInterstatePO(existingPO.supplierId);
    const gst = await gstService.calculateLineItemGST({
      lineTotal: totalPrice,
      materialId: existingItem.materialId || undefined,
      isInterstate,
    });

    const updatedItem = await prisma.purchase_order_items.update({
      where: { id: itemId },
      data: {
        orderedQuantity: data.orderedQuantity,
        unit: data.unit,
        unitPrice: data.unitPrice,
        totalPrice,
        gstRate: gst.gstRate,
        cgstRate: gst.cgstRate,
        cgstAmount: gst.cgstAmount,
        sgstRate: gst.sgstRate,
        sgstAmount: gst.sgstAmount,
        igstRate: gst.igstRate,
        igstAmount: gst.igstAmount,
        taxAmount: gst.taxAmount,
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
    if (
      existingPO.status !== PurchaseOrderStatus.DRAFT &&
      existingPO.status !== PurchaseOrderStatus.READY_FOR_PROCESSING
    ) {
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

    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // 1. Update PO status
      const po = await tx.purchase_orders.update({
        where: { id },
        data: {
          status: PurchaseOrderStatus.CANCELLED,
          remarks: reason ? `${existingPO.remarks || ''}\n\nCancellation reason: ${reason}`.trim() : existingPO.remarks,
        },
        include: this.getFullInclude(),
      });

      // 2. Revert linked MRP material requirements → PO_REQUIRED
      const mrpLinks = await tx.requirement_po_links.findMany({
        where: { purchaseOrderId: id },
        select: { requirementId: true },
      });
      if (mrpLinks.length > 0) {
        await tx.material_requirements.updateMany({
          where: {
            id: { in: mrpLinks.map((l) => l.requirementId) },
            status: 'PO_GENERATED',
          },
          data: { status: 'PO_REQUIRED' },
        });
      }

      // 3. Revert linked service requirements → PENDING
      const serviceLinks = await tx.service_requirement_po_links.findMany({
        where: { purchaseOrderItem: { poId: id } },
        select: { serviceRequirementId: true },
      });
      if (serviceLinks.length > 0) {
        await tx.work_order_service_requirements.updateMany({
          where: {
            id: { in: serviceLinks.map((l) => l.serviceRequirementId) },
            status: 'PO_GENERATED',
          },
          data: { status: 'PENDING', purchaseOrderId: null },
        });
      }

      return po;
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

    const allFullyReceived = items.every((item) => Number(item.receivedQuantity) >= Number(item.orderedQuantity));
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
      po_source_links: {
        select: {
          id: true,
          sourceType: true,
          materialRequirement: {
            select: {
              id: true,
              requirementNumber: true,
              order_items: {
                select: {
                  styles: { select: { id: true, styleCode: true } },
                },
              },
            },
          },
          serviceRequirement: {
            select: {
              id: true,
              serviceType: true,
              workOrder: {
                select: {
                  styles: {
                    select: { id: true, styleCode: true },
                  },
                },
              },
            },
          },
          productionRun: {
            select: {
              id: true,
              workOrderNumber: true,
              styles: { select: { id: true, styleCode: true } },
            },
          },
        },
      },
      requirement_po_links: {
        select: {
          id: true,
          requirementId: true,
          material_requirements: {
            select: {
              id: true,
              requirementNumber: true,
              order_items: {
                select: {
                  styles: { select: { id: true, styleCode: true } },
                },
              },
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
        in: [PurchaseOrderStatus.SENT, PurchaseOrderStatus.ACKNOWLEDGED, PurchaseOrderStatus.PARTIALLY_RECEIVED],
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
                materialType: true,
              },
            },
            requirement_po_links: {
              select: {
                material_requirements: {
                  select: {
                    order_items: {
                      select: {
                        styles: {
                          select: { styleCode: true, styleName: true },
                        },
                        orders: {
                          select: {
                            customers: {
                              select: { name: true, code: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { expectedDeliveryDate: 'asc' },
    });

    // Extract unique style codes and customer names per PO
    return purchaseOrders.map((po) => {
      const styleCodes = new Set<string>();
      const customerNames = new Set<string>();

      for (const item of po.purchase_order_items) {
        for (const link of item.requirement_po_links) {
          const orderItem = link.material_requirements?.order_items;
          if (orderItem?.styles?.styleCode) {
            styleCodes.add(orderItem.styles.styleCode);
          }
          if (orderItem?.orders?.customers?.name) {
            customerNames.add(orderItem.orders.customers.name);
          }
        }
      }

      return {
        ...po,
        styleCodes: Array.from(styleCodes),
        customerNames: Array.from(customerNames),
      };
    });
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
