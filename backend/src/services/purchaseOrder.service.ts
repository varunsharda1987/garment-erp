/**
 * Purchase Order Service
 * Business logic for purchase order operations
 */

import {
  PurchaseOrderStatus,
  Prisma,
  POSource,
  ServiceType,
  POCategory,
  DeliveryLocationType,
  MaterialRequirementStatus,
} from '@prisma/client';
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
import { generateAtomicPONumber, generateAtomicDocNumber } from '../utils/atomicCodeGenerator';
import { addCurrency, roundToCent, subtractCurrency, toNumber } from '../utils/currency';
import { validateTransition } from '../utils/stateMachine';
import { BusinessError, NotFoundError } from '../errors';
import { checkProcessingPOReadiness } from './po-status-manager.service';

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

    // Hard precondition, NOT subject to the ADMIN override: a short-closed PO has already been
    // settled at the delivered quantity, and its requirements carry shortQuantity + shortCloseReason.
    // Cancelling on top would claim nothing was delivered while that evidence is still on the books,
    // and cancel's own repair logic is a no-op there (the zero-received links are already gone and
    // the kept link has no remainder), so the contradiction would simply persist.
    if (existingPO.status === PurchaseOrderStatus.SHORT_CLOSED) {
      throw new BusinessError(
        `${existingPO.poNumber} is closed short — it cannot also be cancelled. Goods were delivered ` +
          `against it and the shortfall is already recorded.`
      );
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

      // 2. Free the linked MRP material requirements so the unfulfilled material can be re-ordered.
      //
      // This used to filter on `status: 'PO_GENERATED'` alone, which matched ZERO rows once the
      // PO had been sent (PO_SENT) or part-delivered (PARTIALLY_RECEIVED) — the two states a
      // cancellation actually happens in. Those requirements stayed pinned to the cancelled PO
      // forever: PO generation only accepts PO_REQUIRED/PARTIAL_STOCK, the duplicate guard skips
      // anything still linked, and the MRP "needing PO" tile counts neither — so the shortfall
      // silently vanished from the plan and surfaced as a stock-out at production.
      //
      // Split by what actually arrived, mirroring the job-work-order cancel path:
      //   nothing received → revert the requirement outright and drop the link;
      //   part received    → leave the delivered part booked and carry the balance forward as its
      //                      own orderable requirement (the MRP-12 split-remainder shape).
      const mrpLinks = await tx.requirement_po_links.findMany({
        where: { purchaseOrderId: id },
        select: { requirementId: true, allocatedQuantity: true, receivedQuantity: true },
      });

      const untouched = mrpLinks.filter((l) => Number(l.receivedQuantity) === 0);
      const partiallyReceived = mrpLinks.filter((l) => Number(l.receivedQuantity) > 0);

      if (untouched.length > 0) {
        const ids = untouched.map((l) => l.requirementId);
        const reverted = await tx.material_requirements.updateMany({
          where: { id: { in: ids }, status: { in: ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'] } },
          data: { status: 'PO_REQUIRED' },
        });
        // A silent count:0 is exactly how this bug hid. Say so rather than assume success.
        if (reverted.count !== ids.length) {
          logWarn(
            `[PO ${existingPO.poNumber}] cancel reverted ${reverted.count} of ${ids.length} undelivered ` +
              `requirement(s) — the rest were in an unexpected status and may need manual re-planning`
          );
        }
        // Drop the links too: MRP's duplicate guard skips a requirement that still carries one,
        // so leaving them would keep the requirement un-orderable even in PO_REQUIRED.
        await tx.requirement_po_links.deleteMany({
          where: { purchaseOrderId: id, requirementId: { in: ids } },
        });
      }

      for (const link of partiallyReceived) {
        const requirement = await tx.material_requirements.findUnique({ where: { id: link.requirementId } });
        if (!requirement) continue;

        const received = Number(link.receivedQuantity);
        const remainder = toNumber(subtractCurrency(Number(requirement.shortfall), received));

        // Below a paise of dust there is nothing worth re-ordering (same threshold and reasoning
        // as the MRP split-remainder path).
        if (remainder > 0.01) {
          const childNumber = await generateAtomicDocNumber('MR', tx);
          await tx.material_requirements.create({
            data: {
              requirementNumber: childNumber,
              source: requirement.source,
              orderId: requirement.orderId,
              orderItemId: requirement.orderItemId,
              materialId: requirement.materialId,
              orderBomId: requirement.orderBomId,
              orderBomItemId: requirement.orderBomItemId,
              orderQuantity: requirement.orderQuantity,
              quantityPerUnit: requirement.quantityPerUnit,
              wastagePercent: requirement.wastagePercent,
              totalRequired: remainder,
              unit: requirement.unit,
              availableStock: 0,
              allocatedFromStock: 0,
              shortfall: remainder,
              preferredSupplierId: requirement.preferredSupplierId,
              status: MaterialRequirementStatus.PO_REQUIRED,
              requirementType: requirement.requirementType,
              processorId: requirement.processorId,
              processingCost: requirement.processingCost,
              printingType: requirement.printingType,
              linkedRequirementId: requirement.linkedRequirementId,
              // Shrinkage provenance must survive the split or the child silently re-derives 0%.
              shrinkagePercentUsed: requirement.shrinkagePercentUsed,
              shrinkageSource: requirement.shrinkageSource,
              colorName: requirement.colorName,
              componentName: requirement.componentName,
              requiredDate: requirement.requiredDate,
              createdById: cancelledById ?? requirement.createdById,
              unitPrice: requirement.unitPrice,
              rateSource: requirement.rateSource,
              splitFromId: requirement.id,
            },
          });
          // The original now represents only what was actually delivered.
          await tx.material_requirements.update({
            where: { id: requirement.id },
            data: { shortfall: received },
          });
          logWarn(
            `[PO ${existingPO.poNumber}] cancelled after ${received} of ${Number(requirement.shortfall)} received ` +
              `for ${requirement.requirementNumber}; balance ${remainder} carried forward as ${childNumber}`
          );
        }
        // The link is deliberately KEPT: it is the record of what this PO actually delivered.
      }

      // 3. Revert linked service requirements → PENDING.
      // IN_PROGRESS included for the same reason as above: filtering on PO_GENERATED alone left
      // an in-progress service pinned to a cancelled PO (job-work-order cancel already does this).
      const serviceLinks = await tx.service_requirement_po_links.findMany({
        where: { purchaseOrderItem: { poId: id } },
        select: { serviceRequirementId: true },
      });
      if (serviceLinks.length > 0) {
        const ids = serviceLinks.map((l) => l.serviceRequirementId);
        const revertedServices = await tx.work_order_service_requirements.updateMany({
          where: { id: { in: ids }, status: { in: ['PO_GENERATED', 'IN_PROGRESS'] } },
          data: { status: 'PENDING', purchaseOrderId: null },
        });
        if (revertedServices.count !== ids.length) {
          logWarn(
            `[PO ${existingPO.poNumber}] cancel reverted ${revertedServices.count} of ${ids.length} service ` +
              `requirement(s) — the rest were in an unexpected status and may need manual re-planning`
          );
        }
      }

      return po;
    });

    return purchaseOrder;
  }

  /**
   * Short-close a partially-received purchase order.
   *
   * The supplier delivered less than ordered and we are ending the PO rather than chasing the
   * balance. CANCELLED would claim nothing happened (goods were delivered, invoiced, likely paid);
   * RECEIVED would claim it all arrived and corrupt any three-way match. SHORT_CLOSED is the
   * honest terminal state, and it ends the procurement DEMAND only — it moves no stock, and it is
   * not a way to erase goods. Material short-returned by a processor remains abnormal loss
   * recovered by debit note, which the JWO guard below protects.
   *
   * The undelivered balance is NOT re-planned by default; that is the point of the verb. Pass
   * reorderBalance when the balance genuinely is still needed.
   */
  async shortClosePurchaseOrder(
    id: string,
    reason: string,
    userRole?: string,
    shortClosedById?: string,
    reorderBalance = false
  ) {
    const existingPO = await prisma.purchase_orders.findUnique({ where: { id } });
    if (!existingPO) {
      throw new NotFoundError('Purchase order not found');
    }

    // Hard precondition, NOT subject to the ADMIN override that validateTransition applies. Every
    // other PO transition is a judgement call an admin may force; this one is a statement of fact.
    // Short-closing anything but a part-delivered order fabricates history: on DRAFT/SENT nothing
    // was delivered (that is a cancellation), and on RECEIVED everything was. Either way the
    // shortQuantity written onto the requirements below would be a lie no admin can make true.
    if (existingPO.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      throw new BusinessError(
        `Only a partially-received purchase order can be closed short (${existingPO.poNumber} is ${existingPO.status}).`
      );
    }

    const transition = validateTransition('purchaseOrder', existingPO.status, 'SHORT_CLOSED', userRole);
    if (!transition.valid) {
      throw new BusinessError(transition.message || `${existingPO.poNumber} cannot be closed short.`);
    }

    // A GRN still awaiting QC means the delivered quantity is NOT settled: counters are
    // incremented gross at GRN creation, and the verdict can land days later. Closing over it
    // would freeze shortQuantity from provisional numbers and let the later verdict mutate the
    // requirements this close just finalised.
    const pendingGrn = await prisma.goods_receiving_notes.findFirst({
      where: { poId: id, status: 'PENDING_QC' },
      select: { grnNumber: true },
    });
    if (pendingGrn) {
      throw new BusinessError(
        `Cannot short-close ${existingPO.poNumber}: GRN ${pendingGrn.grnNumber} is still awaiting QC. ` +
          `Complete or reject it first so the delivered quantity is final.`
      );
    }

    // Short-close must never become a side door around the JWO debit-note gate: greige short-returned
    // by a processor is abnormal loss to be recovered, not demand to be closed.
    const openJwo = await prisma.job_work_orders.findFirst({
      where: { purchaseOrderId: id, jwoStatus: { notIn: ['CLOSED', 'CANCELLED'] } },
      select: { jobWorkNumber: true },
    });
    if (openJwo) {
      throw new BusinessError(
        `Cannot short-close ${existingPO.poNumber}: job work order ${openJwo.jobWorkNumber} is still open against it. ` +
          `Close that first — any short-returned material must be settled there.`
      );
    }

    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // Claim the close with the precondition IN the WHERE. The guards above ran outside this
      // transaction, so two operators double-clicking (or a retry) would otherwise both pass them
      // and both run the body — minting two balance requirements for one shortfall. Whoever loses
      // the race matches zero rows and is told the order is already closed.
      const claimed = await tx.purchase_orders.updateMany({
        where: { id, status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
        data: {
          status: PurchaseOrderStatus.SHORT_CLOSED,
          shortClosedById: shortClosedById ?? null,
          shortClosedAt: new Date(),
          shortCloseReason: reason,
          remarks: `${existingPO.remarks || ''}\n\nShort-closed: ${reason}`.trim(),
        },
      });
      if (claimed.count === 0) {
        throw new BusinessError(`${existingPO.poNumber} is no longer partially received — it may already be closed.`);
      }

      const po = await tx.purchase_orders.findUniqueOrThrow({
        where: { id },
        include: this.getMinimalInclude(),
      });

      const rawLinks = await tx.requirement_po_links.findMany({
        where: { purchaseOrderId: id },
        select: { requirementId: true, allocatedQuantity: true, receivedQuantity: true },
      });

      // A requirement can hold SEVERAL links to the same PO (one per PO line it was allocated
      // across). Aggregate them first — handling each link separately would let the last one
      // overwrite the earlier ones' shortfall and shortQuantity, silently losing part of the
      // delivery. A negative receivedQuantity (an over-shot reversal) is floored at zero so a link
      // can never fall between the two branches below and strand its requirement on a closed PO.
      const byRequirement = new Map<string, { allocated: number; received: number }>();
      for (const l of rawLinks) {
        const agg = byRequirement.get(l.requirementId) ?? { allocated: 0, received: 0 };
        agg.allocated += Number(l.allocatedQuantity);
        agg.received += Math.max(0, Number(l.receivedQuantity));
        byRequirement.set(l.requirementId, agg);
      }
      const links = [...byRequirement.entries()].map(([requirementId, agg]) => ({ requirementId, ...agg }));

      // Nothing delivered on this line — the material is still genuinely needed, so free it
      // exactly as cancellation does (revert AND drop the link, or MRP's duplicate guard keeps
      // skipping it).
      const untouched = links.filter((l) => l.received === 0);
      if (untouched.length > 0) {
        const ids = untouched.map((l) => l.requirementId);
        const reverted = await tx.material_requirements.updateMany({
          where: { id: { in: ids }, status: { in: ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'] } },
          data: { status: 'PO_REQUIRED' },
        });
        if (reverted.count !== ids.length) {
          logWarn(
            `[PO ${existingPO.poNumber}] short-close reverted ${reverted.count} of ${ids.length} undelivered ` +
              `requirement(s) — the rest were in an unexpected status and may need manual re-planning`
          );
        }
        await tx.requirement_po_links.deleteMany({ where: { purchaseOrderId: id, requirementId: { in: ids } } });
      }

      // Part-delivered — close at what actually arrived and RECORD the short rather than leaving
      // it to arithmetic. The link is kept: it is the record of what this PO did deliver.
      for (const link of links.filter((l) => l.received > 0)) {
        const requirement = await tx.material_requirements.findUnique({ where: { id: link.requirementId } });
        if (!requirement) continue;

        // Link basis, not the PO item's: one consolidated PO line can serve several requirements.
        const received = link.received;
        const short = toNumber(subtractCurrency(link.allocated, received));

        await tx.material_requirements.update({
          where: { id: requirement.id },
          data: {
            status: MaterialRequirementStatus.RECEIVED,
            shortfall: received,
            // Same 0.01 threshold the re-order branch uses below: an allocation-split rounding
            // sliver is not a short supply, and recording it would show a phantom balance.
            shortQuantity: short > 0.01 ? short : null,
            shortCloseReason: short > 0.01 ? reason : null,
          },
        });

        if (reorderBalance && short > 0.01) {
          const childNumber = await generateAtomicDocNumber('MR', tx);
          await tx.material_requirements.create({
            data: {
              requirementNumber: childNumber,
              source: requirement.source,
              orderId: requirement.orderId,
              orderItemId: requirement.orderItemId,
              materialId: requirement.materialId,
              orderBomId: requirement.orderBomId,
              orderBomItemId: requirement.orderBomItemId,
              orderQuantity: requirement.orderQuantity,
              quantityPerUnit: requirement.quantityPerUnit,
              wastagePercent: requirement.wastagePercent,
              totalRequired: short,
              unit: requirement.unit,
              availableStock: 0,
              allocatedFromStock: 0,
              shortfall: short,
              preferredSupplierId: requirement.preferredSupplierId,
              status: MaterialRequirementStatus.PO_REQUIRED,
              requirementType: requirement.requirementType,
              processorId: requirement.processorId,
              processingCost: requirement.processingCost,
              printingType: requirement.printingType,
              linkedRequirementId: requirement.linkedRequirementId,
              shrinkagePercentUsed: requirement.shrinkagePercentUsed,
              shrinkageSource: requirement.shrinkageSource,
              colorName: requirement.colorName,
              componentName: requirement.componentName,
              requiredDate: requirement.requiredDate,
              createdById: shortClosedById ?? requirement.createdById,
              unitPrice: requirement.unitPrice,
              rateSource: requirement.rateSource,
              splitFromId: requirement.id,
            },
          });
          logWarn(
            `[PO ${existingPO.poNumber}] short-closed ${short} short on ${requirement.requirementNumber}; ` +
              `re-order requested, carried forward as ${childNumber}`
          );
        }
      }

      // Service requirements: same widened filter as cancellation — PO_GENERATED alone left an
      // in-progress service pinned to a closed PO.
      const serviceLinks = await tx.service_requirement_po_links.findMany({
        where: { purchaseOrderItem: { poId: id } },
        select: { serviceRequirementId: true },
      });
      if (serviceLinks.length > 0) {
        const ids = serviceLinks.map((l) => l.serviceRequirementId);
        const revertedServices = await tx.work_order_service_requirements.updateMany({
          where: { id: { in: ids }, status: { in: ['PO_GENERATED', 'IN_PROGRESS'] } },
          data: { status: 'PENDING', purchaseOrderId: null },
        });
        if (revertedServices.count !== ids.length) {
          logWarn(
            `[PO ${existingPO.poNumber}] short-close reverted ${revertedServices.count} of ${ids.length} service ` +
              `requirement(s) — the rest were in an unexpected status and may need manual re-planning`
          );
        }
      }

      return po;
    });

    // A greige PO that is done — short or full — must release its downstream processing POs,
    // reconciled to the greige that actually arrived. Outside the transaction: it is a follow-on
    // reconciliation, and its failure must not undo a legitimate close.
    const warnings: string[] = [];
    if (existingPO.poCategory === 'GREIGE' || existingPO.poCategory === 'GREIGE_LACE') {
      try {
        const readied = await checkProcessingPOReadiness(id);
        if (readied.length > 0) {
          logWarn(`[PO ${existingPO.poNumber}] short-close released ${readied.length} processing PO(s)`);
        }
      } catch (err) {
        // The order IS closed — a reconciliation hiccup must not undo that. But it cannot be
        // retried either: no GRN can ever reach approveGRN on a SHORT_CLOSED PO, and this routine
        // has no other caller. A log line alone would leave the operator unaware that a processing
        // PO is now stranded, so the failure travels back with the response the way grn.service
        // does with its post-commit warnings.
        logWarn(`[PO ${existingPO.poNumber}] short-close: processing-PO readiness check failed`, err);
        warnings.push(
          `${existingPO.poNumber} is closed short, but reconciling its linked processing purchase order(s) ` +
            `failed. Check them — one may still be waiting on greige that is no longer coming.`
        );
      }
    }

    return { ...purchaseOrder, warnings };
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

    // Guarded like the downgrade branch above, and for the same reason one level stronger: this
    // runs after EVERY GRN event (create/approve/reject/reverse), and a GRN's QC verdict can land
    // days after the goods did. A raw update here silently resurrected a TERMINAL purchase order —
    // short-close or cancel a PO with a GRN still awaiting QC, and the verdict flipped it back to
    // PARTIALLY_RECEIVED/RECEIVED, erasing the audit answer and re-admitting new receipts. The
    // state machine cannot help: this path never consults it.
    await prisma.purchase_orders.updateMany({
      where: {
        id: poId,
        status: {
          in: [
            PurchaseOrderStatus.SENT,
            PurchaseOrderStatus.ACKNOWLEDGED,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
            PurchaseOrderStatus.RECEIVED,
          ],
        },
      },
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

    // Cannot amend a PO that is finished — there is nothing left to deliver anywhere.
    const TERMINAL: PurchaseOrderStatus[] = [
      PurchaseOrderStatus.CANCELLED,
      PurchaseOrderStatus.RECEIVED,
      PurchaseOrderStatus.SHORT_CLOSED,
    ];
    if (TERMINAL.includes(existingPO.status)) {
      throw new BusinessError(
        `Cannot change the delivery location of ${existingPO.poNumber} — it is ${existingPO.status}.`
      );
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
