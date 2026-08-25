/**
 * Purchase Order Service
 * Business logic for purchase order operations
 */

import { PurchaseOrderStatus, Prisma, POSource, ServiceType, POCategory, DeliveryLocationType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { logWarn } from '../utils/logger';
import { gstService } from './gst.service';
import {
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
  PurchaseOrderItemDTO,
  UpdatePurchaseOrderItemDTO,
  PurchaseOrderFilters,
} from '../types/purchaseOrder.types';
import { generateAtomicPONumber } from '../utils/atomicCodeGenerator';
import { addCurrency, roundToCent } from '../utils/currency';
import { validateTransition } from '../utils/stateMachine';

class PurchaseOrderService {
  /**
   * Generate unique PO number - Format: PO2511-0001
   * Uses atomic sequence generator to prevent duplicate numbers under concurrency.
   */
  private async generatePONumber(): Promise<string> {
    return generateAtomicPONumber();
  }

  /**
   * Calculate total price for an item
   */
  private calculateItemTotal(quantity: number, unitPrice: number): number {
    return quantity * unitPrice;
  }

  /**
   * Recalculate PO total from items.
   * Accepts an optional transaction client so item writes + header recompute can be atomic
   * (bug-hunt procurement-19).
   */
  private async recalculatePOTotal(poId: string, tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<void> {
    const items = await tx.purchase_order_items.findMany({
      where: { poId },
    });

    // Use Decimal arithmetic to avoid floating-point rounding errors
    let subtotal = new Decimal(0);
    let totalCgst = new Decimal(0);
    let totalSgst = new Decimal(0);
    let totalIgst = new Decimal(0);

    for (const item of items) {
      if (!item.totalPrice || Number(item.totalPrice) === 0) {
        logWarn(`[PurchaseOrder] PO item ${item.id} has ₹0 total price — PO total will be understated.`);
      }
      subtotal = subtotal.add(item.totalPrice || 0);
      totalCgst = totalCgst.add(item.cgstAmount || 0);
      totalSgst = totalSgst.add(item.sgstAmount || 0);
      totalIgst = totalIgst.add(item.igstAmount || 0);
    }

    const totalTax = totalCgst.add(totalSgst).add(totalIgst);
    const totalAmount = subtotal.add(totalTax);

    await tx.purchase_orders.update({
      where: { id: poId },
      data: {
        subtotal: subtotal.toDecimalPlaces(2),
        totalCgst: totalCgst.toDecimalPlaces(2),
        totalSgst: totalSgst.toDecimalPlaces(2),
        totalIgst: totalIgst.toDecimalPlaces(2),
        totalTax: totalTax.toDecimalPlaces(2),
        totalAmount: totalAmount.toDecimalPlaces(2),
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

        // Calculate GST for this item (unitPrice passed for apparel price-slab logic)
        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          hsnSacCode: null, // Will be resolved from materialId
          materialId: item.materialId || null,
          isInterstate,
          unitPrice: item.unitPrice,
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
          // bug-hunt procurement-18: create path silently dropped fold length that
          // update/add-item paths already persist
          foldLengthCm: item.foldLengthCm ?? null,
        };
      })
    );

    const totalTax = parseFloat((poTotalCgst + poTotalSgst + poTotalIgst).toFixed(2));
    const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

    // Derive delivery location type from warehouse if provided
    let deliveryLocationType: 'WAREHOUSE' | 'PROCESSOR' | null = null;
    if (data.deliveryLocationId) {
      const warehouse = await prisma.warehouses.findUnique({
        where: { id: data.deliveryLocationId },
      });
      if (warehouse) {
        // JOB_WORK warehouses are processor locations
        deliveryLocationType = warehouse.warehouseType === 'JOB_WORK' ? 'PROCESSOR' : 'WAREHOUSE';
      }
    }

    // Create PO with items in transaction
    const purchaseOrder = await prisma.purchase_orders.create({
      data: {
        id: randomUUID(),
        poNumber,
        supplierId: data.supplierId,
        expectedDeliveryDate: new Date(data.expectedDeliveryDate),
        status: PurchaseOrderStatus.DRAFT,
        poSource: POSource.MANUAL,
        poCategory: (data.poCategory as POCategory | undefined) || undefined,
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
        // Optional traceability links (for Manual POs)
        styleId: data.styleId || null,
        orderId: data.orderId || null,
        cadId: data.cadId || null,
        // Delivery location (type derived from warehouse)
        deliveryLocationType,
        deliveryLocationId: data.deliveryLocationId || null,
        originalDeliveryLocationId: data.deliveryLocationId || null, // Same as initial
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

    if (filters?.orderId) {
      where.orderId = filters.orderId;
    }

    if (filters?.serviceWorkOrderId) {
      where.serviceWorkOrderId = filters.serviceWorkOrderId;
    }

    if (filters?.source) {
      where.poSource = filters.source;
    }

    if (filters?.poCategories && filters.poCategories.length > 0) {
      where.poCategory = { in: filters.poCategories as POCategory[] };
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
          // Optional traceability links (for Manual POs)
          styleId: data.styleId !== undefined ? data.styleId : undefined,
          orderId: data.orderId !== undefined ? data.orderId : undefined,
          cadId: data.cadId !== undefined ? data.cadId : undefined,
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
              unitPrice: item.unitPrice,
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
                foldLengthCm: item.foldLengthCm ?? null,
              },
            });
          }

          // Update PO header with GST totals, rounded to 2dp like the create path
          // (bug-hunt procurement-22: unrounded float sums persisted paise-level dust)
          const totalTax = roundToCent(addCurrency(poTotalCgst, poTotalSgst, poTotalIgst)).toNumber();
          await tx.purchase_orders.update({
            where: { id },
            data: {
              subtotal: roundToCent(subtotal).toNumber(),
              totalCgst: roundToCent(poTotalCgst).toNumber(),
              totalSgst: roundToCent(poTotalSgst).toNumber(),
              totalIgst: roundToCent(poTotalIgst).toNumber(),
              totalTax,
              totalAmount: roundToCent(addCurrency(subtotal, totalTax)).toNumber(),
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
   * Handles linked records (JWO, service requirements, requirement_po_links, etc.) first
   */
  async deletePurchaseOrder(id: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
      include: {
        jobWorkOrder: { select: { id: true } }, // 1:1 relation
        work_order_service_requirements: { select: { id: true } },
        requirement_po_links: { select: { id: true } },
      },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    if (existingPO.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error('Can only delete purchase orders in DRAFT status');
    }

    // Use transaction to handle linked records
    await prisma.$transaction(async (tx) => {
      // Delete requirement_po_links that reference this PO
      if (existingPO.requirement_po_links?.length > 0) {
        await tx.requirement_po_links.deleteMany({
          where: { purchaseOrderId: id },
        });
      }

      // Unlink any job_work_orders that reference this PO (1:1 relation)
      if (existingPO.jobWorkOrder) {
        await tx.job_work_orders.update({
          where: { id: existingPO.jobWorkOrder.id },
          data: { purchaseOrderId: null },
        });
      }

      // Unlink any work_order_service_requirements that reference this PO
      if (existingPO.work_order_service_requirements?.length > 0) {
        await tx.work_order_service_requirements.updateMany({
          where: { purchaseOrderId: id },
          data: { purchaseOrderId: null },
        });
      }

      // Now delete the PO (items cascade automatically)
      await tx.purchase_orders.delete({
        where: { id },
      });
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

    // Validate: either materialId OR serviceType is required
    if (!item.materialId && !item.serviceType) {
      throw new Error('Either material ID or service type is required');
    }

    // Validate material exists if materialId is provided
    if (item.materialId) {
      const material = await prisma.materials.findUnique({
        where: { id: item.materialId },
      });

      if (!material) {
        throw new Error('Material not found');
      }
    }

    const totalPrice = this.calculateItemTotal(item.orderedQuantity, item.unitPrice);

    // Calculate GST for this item
    const { isInterstate } = await gstService.isInterstatePO(existingPO.supplierId);
    const gst = await gstService.calculateLineItemGST({
      lineTotal: totalPrice,
      materialId: item.materialId,
      isInterstate,
      unitPrice: item.unitPrice,
    });

    // Item write + header recompute atomically (bug-hunt procurement-19)
    const newItem = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase_order_items.create({
        data: {
          id: randomUUID(),
          poId,
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
          foldLengthCm: item.foldLengthCm ?? null,
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
      await this.recalculatePOTotal(poId, tx);

      return created;
    });

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
      unitPrice,
    });

    // Item write + header recompute atomically (bug-hunt procurement-19)
    const updatedItem = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchase_order_items.update({
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
      await this.recalculatePOTotal(poId, tx);

      return updated;
    });

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

    // Item delete + header recompute atomically (bug-hunt procurement-19)
    await prisma.$transaction(async (tx) => {
      await tx.purchase_order_items.delete({
        where: { id: itemId },
      });

      // Recalculate PO total
      await this.recalculatePOTotal(poId, tx);
    });

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
        // Landmine №7 note: this records WHO SENT the PO (there is no dedicated sentById
        // column). No screen currently renders it as "Approved by" — if one ever does,
        // label it "Sent by" or add a real sentById column first.
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
  async cancelPurchaseOrder(id: string, reason: string, userRole?: string, cancelledById?: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    // State machine validation (strict + admin override)
    const transition = validateTransition('purchaseOrder', existingPO.status, 'CANCELLED', userRole);
    if (!transition.valid) {
      throw new Error(transition.message || 'Cannot cancel this purchase order');
    }

    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // 1. Update PO status (use minimal include to avoid relation validation issues)
      const po = await tx.purchase_orders.update({
        where: { id },
        data: {
          status: PurchaseOrderStatus.CANCELLED,
          remarks: reason ? `${existingPO.remarks || ''}\n\nCancellation reason: ${reason}`.trim() : existingPO.remarks,
          // Who cancelled, and when (owner-approved 2026-08-24) — previously nobody was recorded
          cancelledById: cancelledById ?? null,
          cancelledAt: new Date(),
        },
        include: this.getMinimalInclude(),
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
      // Nothing received. No longer always a no-op: QC rejection now NETS the received counters back
      // down (grn.service approveGRN), so a 100%-rejected PO arrives here with 0 received while still
      // marked RECEIVED/PARTIALLY_RECEIVED — it must RE-OPEN (review catch). Only the receiving pair
      // is downgraded; DRAFT/SENT/CANCELLED etc. are untouched.
      await prisma.purchase_orders.updateMany({
        where: { id: poId, status: { in: [PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.PARTIALLY_RECEIVED] } },
        data: { status: PurchaseOrderStatus.ACKNOWLEDGED },
      });
      return;
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
   * Get minimal include for status update operations (cancel, acknowledge, etc.)
   * Uses fewer nested relations to avoid potential Prisma validation issues
   */
  private getMinimalInclude() {
    return {
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
    };
  }

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
          address: true,
          billingPincode: true,
          billing_city: { select: { cityName: true } },
          billing_state: { select: { stateName: true } },
          gst_numbers: {
            select: {
              id: true,
              gstNumber: true,
              stateName: true,
              stateCode: true,
              isPrimary: true,
            },
          },
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
              // Width of what is being ORDERED: greige loom width for greige buys,
              // the fabric's actual width for ready-fabric buys. The item's own
              // fabricWidth column is the CAD cutable width — planning-internal,
              // never shown bare on purchase surfaces (industry model 2026-08-18).
              greige_master: { select: { greigeWidth: true } },
              fabric_master: { select: { actualWidth: true } },
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
                  styles: { select: { id: true, styleCode: true, buyerStyleRef: true } },
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
                    select: { id: true, styleCode: true, buyerStyleRef: true },
                  },
                },
              },
            },
          },
          productionRun: {
            select: {
              id: true,
              workOrderNumber: true,
              styles: { select: { id: true, styleCode: true, buyerStyleRef: true } },
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
                  styles: { select: { id: true, styleCode: true, buyerStyleRef: true } },
                },
              },
            },
          },
        },
      },
      // Optional traceability relations (for Manual POs)
      style: {
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
          styleName: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          customers: {
            select: { id: true, name: true },
          },
        },
      },
      cad: {
        select: {
          id: true,
          cutableWidth: true,
          cadMeters: true,
          fabric: {
            select: { id: true, fabricName: true, fabricCode: true },
          },
        },
      },
      // Delivery location
      deliveryWarehouse: {
        select: {
          id: true,
          warehouseCode: true,
          warehouseName: true,
          warehouseType: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          contactPerson: true,
          contactPhone: true,
        },
      },
      deliveryLocationAmendedBy: {
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
                          select: { styleCode: true, styleName: true, buyerStyleRef: true },
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
      const buyerStyleRefs = new Set<string>();
      const customerNames = new Set<string>();

      for (const item of po.purchase_order_items) {
        for (const link of item.requirement_po_links) {
          const orderItem = link.material_requirements?.order_items;
          if (orderItem?.styles?.styleCode) {
            styleCodes.add(orderItem.styles.styleCode);
          }
          if (orderItem?.styles?.buyerStyleRef) {
            buyerStyleRefs.add(orderItem.styles.buyerStyleRef);
          }
          if (orderItem?.orders?.customers?.name) {
            customerNames.add(orderItem.orders.customers.name);
          }
        }
      }

      return {
        ...po,
        styleCodes: Array.from(styleCodes),
        buyerStyleRefs: Array.from(buyerStyleRefs),
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

  /**
   * Amend delivery location for a PO
   * Tracks original location for amendment history
   * All locations are warehouses (including processor locations which are JOB_WORK type)
   */
  async amendDeliveryLocation(poId: string, deliveryLocationId: string, amendedById: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id: poId },
    });

    if (!existingPO) {
      throw new Error('Purchase order not found');
    }

    // Cannot amend cancelled or received POs
    if (existingPO.status === PurchaseOrderStatus.CANCELLED || existingPO.status === PurchaseOrderStatus.RECEIVED) {
      throw new Error('Cannot amend delivery location for cancelled or fully received POs');
    }

    // Validate the warehouse exists
    const warehouse = await prisma.warehouses.findUnique({
      where: { id: deliveryLocationId },
    });
    if (!warehouse) {
      throw new Error('Warehouse not found');
    }

    // Derive type from warehouse: JOB_WORK = PROCESSOR location, anything else = WAREHOUSE
    const deliveryLocationType = warehouse.warehouseType === 'JOB_WORK' ? 'PROCESSOR' : 'WAREHOUSE';

    const purchaseOrder = await prisma.purchase_orders.update({
      where: { id: poId },
      data: {
        deliveryLocationType,
        deliveryLocationId,
        // Only set original if this is the first amendment (preserve the very first location)
        originalDeliveryLocationId: existingPO.originalDeliveryLocationId || existingPO.deliveryLocationId,
        deliveryLocationAmendedAt: new Date(),
        deliveryLocationAmendedById: amendedById,
      },
      include: this.getFullInclude(),
    });

    return purchaseOrder;
  }
}

export const purchaseOrderService = new PurchaseOrderService();
export default purchaseOrderService;
