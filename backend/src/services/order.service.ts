/**
 * Order Service
 * Business logic for order management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { orders, Prisma, Priority } from '@prisma/client';
import { BusinessError, ConflictError, NotFoundError, ValidationError } from '../errors';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';
import { randomUUID } from 'crypto';
import workOrderService from './workOrder.service';
import { generateAtomicOrderNumber } from '../utils/atomicCodeGenerator';
import { validateTransition } from '../utils/stateMachine';
import { multiplyCurrency, roundToCent, Decimal } from '../utils/currency';

// ============================================
// Types
// ============================================

export type OrderStatus = 'PENDING' | 'IN_PRODUCTION' | 'COMPLETED' | 'DISPATCHED' | 'CANCELLED';
export type OrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface OrderItemBreakup {
  colorId: string;
  sizeId: string;
  quantity: number;
}

export interface OrderItemInput {
  styleId: string;
  unitPrice: string | number;
  totalQuantity?: number; // Direct total quantity (used when breakup is empty)
  deliveryDate?: string;
  itemDescription?: string;
  remarks?: string;
  breakup: OrderItemBreakup[]; // Can be empty for orders without size breakdown
}

export interface CreateOrderDTO {
  customerId: string;
  expectedDeliveryDate: string;
  priority?: OrderPriority;
  totalQuantity?: number; // Direct total quantity (used when no size breakdown)
  paymentTerms?: string;
  shippingAddress?: string;
  remarks?: string;
  items: OrderItemInput[];
}

export interface UpdateOrderDTO {
  expectedDeliveryDate?: string;
  priority?: OrderPriority;
  paymentTerms?: string;
  shippingAddress?: string;
  remarks?: string;
}

export interface OrderQueryOptions extends PaginationOptions {
  customerId?: string;
  status?: OrderStatus;
  priority?: OrderPriority;
  fromDate?: string;
  toDate?: string;
}

export type LaceHandlingOption = 'RELEASE_TO_STOCK' | 'RETURN_TO_SUPPLIER';

export interface OrderCancellationOptions {
  laceHandling?: LaceHandlingOption;
  userId?: string;
  cancellationReason?: string;
}

// ============================================
// Service
// ============================================

class OrderServiceClass extends BaseService<orders, CreateOrderDTO, UpdateOrderDTO> {
  protected readonly modelName = 'orders';
  protected readonly entityName = 'Order';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.orders;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [{ orderNumber: { contains: search, mode: 'insensitive' as const } }];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return undefined; // Use specific includes in each method
  }

  protected getListIncludes(): IncludeConfig {
    return undefined; // Use specific includes in each method
  }

  // ============================================
  // Create Methods
  // ============================================

  /**
   * Create order with items, breakup, and auto-create work orders
   * Uses transaction to ensure consistency
   */
  async createWithItems(data: CreateOrderDTO, userId: string): Promise<orders> {
    logDebug('Creating order with items', { customerId: data.customerId });

    if (!data.items || data.items.length === 0) {
      throw new ValidationError('Order must have at least one item');
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Calculate totals (decimal.js — raw float sums drifted at paise level, bug-hunt orders-17)
    let totalQuantity = 0;
    let totalAmountDec = new Decimal(0);

    // Prepare order items with generated IDs (needed for work order creation)
    const orderItemsData = data.items.map((item) => {
      // Use breakup sum if available, otherwise use direct totalQuantity
      const breakupQty = item.breakup.reduce((sum, b) => sum + b.quantity, 0);
      const itemTotalQty = breakupQty > 0 ? breakupQty : item.totalQuantity || 0;

      // Validate: either breakup or direct totalQuantity must provide a quantity
      if (itemTotalQty <= 0) {
        throw new ValidationError('Order item must have quantity (via breakup or totalQuantity)');
      }

      // Validate: if breakup exists, sum must match totalQuantity (if provided)
      if (breakupQty > 0 && item.totalQuantity && item.totalQuantity > 0 && breakupQty !== item.totalQuantity) {
        logWarn(
          `[Order] Size breakup sum (${breakupQty}) does not match totalQuantity (${item.totalQuantity}) for style ${item.styleId}. Using breakup sum.`
        );
      }

      const unitPriceNum = parseFloat(String(item.unitPrice)) || 0;
      const itemTotalDec = roundToCent(multiplyCurrency(itemTotalQty, unitPriceNum));
      const itemTotal = itemTotalDec.toNumber();

      totalQuantity += itemTotalQty;
      totalAmountDec = totalAmountDec.plus(itemTotalDec);

      // Only create breakup records if there are entries with quantity > 0
      const hasValidBreakup = item.breakup.length > 0 && item.breakup.some((b) => b.quantity > 0);

      return {
        id: randomUUID(),
        styleId: item.styleId,
        itemDescription: item.itemDescription || null,
        totalQuantity: itemTotalQty,
        unitPrice: unitPriceNum,
        totalPrice: itemTotal,
        deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
        remarks: item.remarks || null,
        // Only create breakup records if valid entries exist
        order_item_breakup: hasValidBreakup
          ? {
              create: item.breakup
                .filter((b) => b.quantity > 0) // Only include entries with quantity
                .map((b) => ({
                  id: randomUUID(),
                  colorId: b.colorId || null, // Handle size-only orders
                  sizeId: b.sizeId,
                  quantity: b.quantity,
                })),
            }
          : undefined,
      };
    });

    const orderId = randomUUID();
    const orderDate = new Date();
    const expectedDeliveryDate = new Date(data.expectedDeliveryDate);
    const priority = (data.priority || 'MEDIUM') as Priority;

    // Use transaction to create order and work orders atomically
    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Create the order first (without items - we'll create them separately)
      const createdOrder = await tx.orders.create({
        data: {
          id: orderId,
          orderNumber,
          customers: { connect: { id: data.customerId } },
          orderDate,
          expectedDeliveryDate,
          priority,
          totalQuantity,
          totalAmount: roundToCent(totalAmountDec).toNumber(),
          paymentTerms: data.paymentTerms,
          shippingAddress: data.shippingAddress,
          remarks: data.remarks,
          users_orders_createdByIdTousers: { connect: { id: userId } },
        },
      });

      // 2. Create order items with breakups
      for (const itemData of orderItemsData) {
        await tx.order_items.create({
          data: {
            id: itemData.id,
            orderId: createdOrder.id,
            styleId: itemData.styleId,
            itemDescription: itemData.itemDescription,
            totalQuantity: itemData.totalQuantity,
            unitPrice: itemData.unitPrice,
            totalPrice: itemData.totalPrice,
            deliveryDate: itemData.deliveryDate,
            remarks: itemData.remarks,
            order_item_breakup: itemData.order_item_breakup,
          },
        });
      }

      return createdOrder;
    });

    // 3. Auto-create work orders for each order item.
    // Runs after the order transaction commits (workOrderService is not tx-aware), but failures are
    // now collected PER ITEM and surfaced to the caller instead of one catch silently abandoning the
    // rest of the loop (bug-hunt orders-7). Failed items can be re-created manually.
    const workOrderFailures: { orderItemId: string; styleId: string; reason: string }[] = [];
    for (const itemData of orderItemsData) {
      try {
        await workOrderService.createFromOrderItem(itemData.id, order.id, {
          plannedStartDate: orderDate,
          plannedEndDate: expectedDeliveryDate,
          priority,
          createdById: userId,
        });
      } catch (error) {
        logError('Failed to auto-create work order for order item', {
          orderId: order.id,
          orderItemId: itemData.id,
          styleId: itemData.styleId,
          error,
        });
        workOrderFailures.push({
          orderItemId: itemData.id,
          styleId: itemData.styleId,
          reason: error instanceof Error ? error.message : 'Work order creation failed',
        });
      }
    }
    if (workOrderFailures.length === 0) {
      logInfo('Work orders auto-created for order', { orderId: order.id, itemCount: orderItemsData.length });
    }

    // 4. Fetch and return complete order with all includes
    const completeOrder = await this.prisma.orders.findUnique({
      where: { id: order.id },
      include: {
        customers: {
          select: {
            id: true,
            code: true,
            name: true,
            contactPerson: true,
            phone: true,
            email: true,
          },
        },
        users_orders_createdByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        order_items: {
          include: {
            styles: {
              select: {
                id: true,
                styleCode: true,
                styleName: true,
                image: true,
              },
            },
            order_item_breakup: {
              include: {
                color_options: true,
                size_options: true,
              },
            },
          },
        },
        work_orders: {
          select: {
            id: true,
            workOrderNumber: true,
            status: true,
            totalQuantity: true,
          },
        },
      },
    });

    logInfo('Order created successfully', { id: order.id, orderNumber });
    // Surface any work-order creation failures to the caller (bug-hunt orders-7)
    if (workOrderFailures.length > 0) {
      return { ...completeOrder!, workOrderFailures } as orders;
    }
    return completeOrder!;
  }

  // ============================================
  // Read Methods
  // ============================================

  /**
   * Find all orders with additional filters
   */
  async findAllWithFilters(options: OrderQueryOptions): Promise<PaginatedResult<orders>> {
    const { page = 1, limit = 10, search, sortBy, sortOrder, ...filters } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ordersWhereInput = {};

    if (search) {
      where.OR = this.buildSearchFilter(search);
    }

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.fromDate || filters.toDate) {
      where.orderDate = {};
      if (filters.fromDate) {
        where.orderDate.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        where.orderDate.lte = new Date(filters.toDate);
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy || 'orderDate']: sortOrder || 'desc' },
        include: this.getListIncludes(),
      }),
      this.prisma.orders.count({ where }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get order with full details
   */
  async getFullDetails(id: string): Promise<orders> {
    const order = await this.prisma.orders.findUnique({
      where: { id },
      include: this.getDefaultIncludes(),
    });

    if (!order) {
      throw new NotFoundError('Order', id);
    }

    return order;
  }

  /**
   * Get orders by customer
   */
  async findByCustomer(customerId: string, options: PaginationOptions): Promise<PaginatedResult<orders>> {
    return this.findAllWithFilters({
      ...options,
      customerId,
    });
  }

  /**
   * Get orders by status
   */
  async findByStatus(status: OrderStatus, options: PaginationOptions): Promise<PaginatedResult<orders>> {
    return this.findAllWithFilters({
      ...options,
      status,
    });
  }

  // ============================================
  // Update Methods
  // ============================================

  /**
   * Update order details
   */
  async updateOrder(id: string, data: UpdateOrderDTO): Promise<orders> {
    logDebug('Updating order', { id, data });

    const existing = await this.findByIdOrThrow(id);

    // Prevent updates to cancelled orders
    if (existing.status === 'CANCELLED') {
      throw new Error('Cannot update a cancelled order');
    }

    const order = await this.prisma.orders.update({
      where: { id },
      data: {
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : undefined,
        priority: data.priority,
        paymentTerms: data.paymentTerms,
        shippingAddress: data.shippingAddress,
        remarks: data.remarks,
      },
      include: {
        customers: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        order_items: {
          include: {
            styles: {
              select: {
                id: true,
                styleCode: true,
                styleName: true,
              },
            },
          },
        },
      },
    });

    logInfo('Order updated successfully', { id });
    return order;
  }

  /**
   * Update order status with state machine validation.
   * Normal users: only valid forward transitions allowed.
   * Admin users: can override with reason logged.
   */
  async updateStatus(id: string, status: OrderStatus, userRole?: string, reason?: string): Promise<orders> {
    logDebug('Updating order status', { id, status, userRole });

    const existing = await this.findByIdOrThrow(id);

    // Validate transition
    const transition = validateTransition('order', existing.status, status, userRole);
    if (!transition.valid) {
      throw new ValidationError(transition.message || 'Invalid status transition');
    }

    if (transition.isAdminOverride) {
      logInfo('Admin override: order status change', {
        id,
        from: existing.status,
        to: status,
        reason: reason || 'No reason provided',
      });
    }

    const order = await this.prisma.orders.update({
      where: { id },
      data: { status },
      include: {
        customers: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    logInfo('Order status updated', { id, from: existing.status, to: status });
    return order;
  }

  /**
   * Cancel order (soft delete) and cascade to work orders
   * Also handles lace allocations based on provided options
   */
  async cancelOrder(id: string, options?: OrderCancellationOptions): Promise<void> {
    logDebug('Cancelling order', { id, options });

    const order = await this.prisma.orders.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Order', id);
    }

    // Use transaction to cancel order, work orders, deactivate BOMs, and handle lace
    await this.prisma.$transaction(async (tx) => {
      // Cancel the order
      await tx.orders.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Cancel all related work orders
      await tx.work_orders.updateMany({
        where: {
          orderId: id,
          status: {
            in: ['PENDING', 'IN_PRODUCTION'],
          },
        },
        data: { status: 'CANCELLED' },
      });

      // Deactivate all related Order BOMs
      await tx.order_bom.updateMany({
        where: {
          orderId: id,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Handle ALL lace allocations for this order (not just RESERVED/IN_USE)
      const laceAllocations = await tx.lace_stock_allocation.findMany({
        where: {
          orderId: id,
        },
        include: {
          stock: true,
        },
      });

      if (laceAllocations.length > 0) {
        const laceHandling = options?.laceHandling || 'RELEASE_TO_STOCK';
        const userId = options?.userId;
        const cancellationReason = options?.cancellationReason || 'Order cancelled';

        for (const allocation of laceAllocations) {
          // Skip allocations already in terminal states
          if (['CONSUMED', 'RETURNED', 'TRANSFERRED'].includes(allocation.allocationStatus)) {
            continue;
          }
          // Calculate unreleased quantity (allocated but not yet consumed)
          const unreleasedQty =
            Number(allocation.quantityAllocated) -
            Number(allocation.quantityConsumed) -
            Number(allocation.quantityReturned || 0);

          if (unreleasedQty <= 0) {
            // All allocated quantity was consumed, just close the allocation
            await tx.lace_stock_allocation.update({
              where: { id: allocation.id },
              data: { allocationStatus: 'CONSUMED' },
            });
            continue;
          }

          if (laceHandling === 'RELEASE_TO_STOCK') {
            // Release back to general stock - increase available, decrease reserved
            const updatedStock = await tx.lace_stock.update({
              where: { id: allocation.stockId },
              data: {
                quantityAvailable: { increment: unreleasedQty },
                quantityReserved: { decrement: unreleasedQty },
                status: 'AVAILABLE',
                stockType: 'EXCESS',
              },
            });

            // Update allocation status
            await tx.lace_stock_allocation.update({
              where: { id: allocation.id },
              data: {
                allocationStatus: 'RETURNED',
                quantityReturned: { increment: unreleasedQty },
              },
            });

            // Create audit transaction
            await tx.lace_stock_transaction.create({
              data: {
                stockId: allocation.stockId,
                transactionType: 'RETURN',
                quantity: unreleasedQty,
                balanceAfter: Number(updatedStock.quantityAvailable),
                fromStyleId: allocation.styleId,
                fromStyleCode: allocation.styleCode || undefined,
                referenceType: 'ORDER',
                referenceId: id,
                notes: `${cancellationReason} - released ${unreleasedQty}m to general stock`,
                transactionDate: new Date(),
                performedById: userId || 'system',
              },
            });
          } else if (laceHandling === 'RETURN_TO_SUPPLIER') {
            // Mark for return to supplier
            await tx.lace_stock.update({
              where: { id: allocation.stockId },
              data: {
                returnStatus: 'PENDING_RETURN',
                returnReason: cancellationReason,
                returnRequestDate: new Date(),
              },
            });

            // Update allocation status
            await tx.lace_stock_allocation.update({
              where: { id: allocation.id },
              data: { allocationStatus: 'TRANSFERRED' },
            });

            // Create audit transaction
            await tx.lace_stock_transaction.create({
              data: {
                stockId: allocation.stockId,
                transactionType: 'RETURN_TO_SUPPLIER',
                quantity: unreleasedQty,
                balanceAfter: Number(allocation.stock.quantityAvailable),
                referenceType: 'ORDER',
                referenceId: id,
                notes: `${cancellationReason} - marked for return to supplier (${unreleasedQty}m)`,
                transactionDate: new Date(),
                performedById: userId || 'system',
              },
            });
          }
        }

        logInfo('Lace allocations handled for cancelled order', {
          orderId: id,
          laceHandling,
          allocationCount: laceAllocations.length,
        });
      }
    });

    logInfo('Order, work orders, BOMs, and lace allocations cancelled/deactivated', { id });
  }

  /**
   * Check if an order can be hard deleted
   * Returns { canDelete: true } or { canDelete: false, reason: string }
   */
  async canDeleteOrder(id: string): Promise<{ canDelete: boolean; reason?: string }> {
    const order = await this.prisma.orders.findUnique({
      where: { id },
      include: {
        work_orders: { select: { id: true, status: true } },
        delivery_notes: { select: { id: true, status: true } },
        invoices: {
          select: {
            id: true,
            status: true,
            payments: { select: { id: true } },
          },
        },
        asn_applications: { select: { id: true, status: true } },
      },
    });

    if (!order) {
      return { canDelete: false, reason: 'Order not found' };
    }

    // Only PENDING or CANCELLED orders can be deleted
    if (!['PENDING', 'CANCELLED'].includes(order.status)) {
      return { canDelete: false, reason: `Order is ${order.status}, only PENDING or CANCELLED orders can be deleted` };
    }

    // Check work orders - only PENDING or CANCELLED allowed
    const activeWorkOrders = order.work_orders.filter((wo) => !['PENDING', 'CANCELLED'].includes(wo.status));
    if (activeWorkOrders.length > 0) {
      return { canDelete: false, reason: 'Order has active work orders (production has started)' };
    }

    // Check delivery notes - no in-transit or delivered. Must use the actual DeliveryStatus enum values
    // (PENDING/IN_TRANSIT/DELIVERED) — the old check used 'SHIPPED', which is not a value in the enum,
    // so in-transit deliveries never blocked deletion (bug-hunt dispatch-10).
    const shippedDeliveries = order.delivery_notes.filter((dn) => ['IN_TRANSIT', 'DELIVERED'].includes(dn.status));
    if (shippedDeliveries.length > 0) {
      return { canDelete: false, reason: 'Order has shipped deliveries' };
    }

    // Check invoices - no paid invoices or any payments
    const paidInvoices = order.invoices.filter((inv) => inv.status === 'PAID' || inv.payments.length > 0);
    if (paidInvoices.length > 0) {
      return { canDelete: false, reason: 'Order has paid invoices or payment records' };
    }

    // Check ASN - only PENDING or CANCELLED allowed
    const processedASN = order.asn_applications.filter((asn) => !['PENDING', 'CANCELLED'].includes(asn.status));
    if (processedASN.length > 0) {
      return { canDelete: false, reason: 'Order has processed ASN applications' };
    }

    return { canDelete: true };
  }

  /**
   * Hard delete an order and all related records
   * Only works for orders that pass canDeleteOrder() check
   */
  async hardDeleteOrder(id: string): Promise<void> {
    logDebug('Attempting hard delete of order', { id });

    const { canDelete, reason } = await this.canDeleteOrder(id);
    if (!canDelete) {
      throw new BusinessError(reason || 'Cannot delete this order');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete ASN SKUs first (child of ASN applications)
      await tx.asn_skus.deleteMany({
        where: { asn: { orderId: id } },
      });

      // Delete ASN applications
      await tx.asn_applications.deleteMany({
        where: { orderId: id },
      });

      // Delete delivery note items first (child of delivery notes)
      await tx.delivery_note_items.deleteMany({
        where: { delivery_notes: { orderId: id } },
      });

      // Delete delivery notes
      await tx.delivery_notes.deleteMany({
        where: { orderId: id },
      });

      // Delete invoices (no payments at this point based on canDelete check)
      await tx.invoices.deleteMany({
        where: { orderId: id },
      });

      // Delete work orders (only PENDING/CANCELLED at this point)
      await tx.work_orders.deleteMany({
        where: { orderId: id },
      });

      // Delete material requirements (generated from BOM via MRP)
      await tx.material_requirements.deleteMany({
        where: { orderId: id },
      });

      // Delete order BOM items first (child of order BOMs)
      await tx.order_bom_items.deleteMany({
        where: { orderBom: { orderId: id } },
      });

      // Delete order BOMs
      await tx.order_bom.deleteMany({
        where: { orderId: id },
      });

      // Delete order item breakup (child of order items)
      await tx.order_item_breakup.deleteMany({
        where: { order_items: { orderId: id } },
      });

      // Delete order item costing (child of order items)
      await tx.order_item_costing.deleteMany({
        where: { order_item: { orderId: id } },
      });

      // Delete order items
      await tx.order_items.deleteMany({
        where: { orderId: id },
      });

      // Finally delete the order
      await tx.orders.delete({
        where: { id },
      });
    });

    logInfo('Order hard deleted successfully', { id });
  }

  // ============================================
  // Statistics Methods
  // ============================================

  /**
   * Get order statistics
   */
  async getStatistics(customerId?: string): Promise<{
    totalOrders: number;
    pendingOrders: number;
    inProductionOrders: number;
    completedOrders: number;
    totalValue: number;
  }> {
    const where: Prisma.ordersWhereInput = customerId ? { customerId } : {};

    const [totalOrders, pendingOrders, inProductionOrders, completedOrders, totalValue] = await Promise.all([
      this.prisma.orders.count({ where }),
      this.prisma.orders.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.orders.count({ where: { ...where, status: 'IN_PRODUCTION' } }),
      this.prisma.orders.count({ where: { ...where, status: 'COMPLETED' } }),
      this.prisma.orders.aggregate({
        where,
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      inProductionOrders,
      completedOrders,
      totalValue: totalValue._sum.totalAmount?.toNumber() || 0,
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(): Promise<string> {
    return generateAtomicOrderNumber();
  }
}

// Export singleton instance
export const orderService = new OrderServiceClass();
