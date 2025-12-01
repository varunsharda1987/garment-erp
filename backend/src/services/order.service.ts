/**
 * Order Service
 * Business logic for order management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { orders, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';
import { randomUUID } from 'crypto';

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
  deliveryDate?: string;
  itemDescription?: string;
  remarks?: string;
  breakup: OrderItemBreakup[];
}

export interface CreateOrderDTO {
  customerId: string;
  expectedDeliveryDate: string;
  priority?: OrderPriority;
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
    return [
      { orderNumber: { contains: search, mode: 'insensitive' as const } },
    ];
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
   * Create order with items and breakup
   */
  async createWithItems(data: CreateOrderDTO, userId: string): Promise<orders> {
    logDebug('Creating order with items', { customerId: data.customerId });

    if (!data.items || data.items.length === 0) {
      throw new ValidationError('Order must have at least one item');
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Calculate totals
    let totalQuantity = 0;
    let totalAmount = 0;

    const orderItemsData = data.items.map((item) => {
      const itemTotalQty = item.breakup.reduce((sum, b) => sum + b.quantity, 0);
      const itemTotal = itemTotalQty * parseFloat(String(item.unitPrice));

      totalQuantity += itemTotalQty;
      totalAmount += itemTotal;

      return {
        id: randomUUID(),
        styleId: item.styleId,
        itemDescription: item.itemDescription || null,
        totalQuantity: itemTotalQty,
        unitPrice: parseFloat(String(item.unitPrice)),
        totalPrice: itemTotal,
        deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
        remarks: item.remarks || null,
        order_item_breakup: {
          create: item.breakup.map((b) => ({
            id: randomUUID(),
            colorId: b.colorId,
            sizeId: b.sizeId,
            quantity: b.quantity,
          })),
        },
      };
    });

    const order = await this.prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber,
        customers: { connect: { id: data.customerId } },
        orderDate: new Date(),
        expectedDeliveryDate: new Date(data.expectedDeliveryDate),
        priority: data.priority || 'MEDIUM',
        totalQuantity,
        totalAmount,
        paymentTerms: data.paymentTerms,
        shippingAddress: data.shippingAddress,
        remarks: data.remarks,
        users_orders_createdByIdTousers: { connect: { id: userId } },
      },
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
      },
    });

    logInfo('Order created successfully', { id: order.id, orderNumber });
    return order;
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
  async findByCustomer(
    customerId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<orders>> {
    return this.findAllWithFilters({
      ...options,
      customerId,
    });
  }

  /**
   * Get orders by status
   */
  async findByStatus(
    status: OrderStatus,
    options: PaginationOptions
  ): Promise<PaginatedResult<orders>> {
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

    await this.findByIdOrThrow(id);

    const order = await this.prisma.orders.update({
      where: { id },
      data: {
        expectedDeliveryDate: data.expectedDeliveryDate
          ? new Date(data.expectedDeliveryDate)
          : undefined,
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
   * Update order status
   */
  async updateStatus(id: string, status: OrderStatus): Promise<orders> {
    logDebug('Updating order status', { id, status });

    await this.findByIdOrThrow(id);

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

    logInfo('Order status updated', { id, status });
    return order;
  }

  /**
   * Cancel order (soft delete)
   */
  async cancelOrder(id: string): Promise<void> {
    logDebug('Cancelling order', { id });

    const order = await this.prisma.orders.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Order', id);
    }

    await this.prisma.orders.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    logInfo('Order cancelled', { id });
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

    const [totalOrders, pendingOrders, inProductionOrders, completedOrders, totalValue] =
      await Promise.all([
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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Find the last order number for this month
    const lastOrder = await this.prisma.orders.findFirst({
      where: {
        orderNumber: {
          startsWith: `ORD${year}${month}`,
        },
      },
      orderBy: {
        orderNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    return `ORD${year}${month}${String(sequence).padStart(4, '0')}`;
  }
}

// Export singleton instance
export const orderService = new OrderServiceClass();
