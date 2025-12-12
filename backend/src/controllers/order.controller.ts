// Order Management Controller
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

// ============================================
// Types for Order Controller
// ============================================

interface OrderItemBreakup {
  colorId: string | null;  // Can be null or empty for size-only orders
  sizeId: string;
  quantity: number;
}

interface OrderItem {
  styleId: string;
  unitPrice: string | number;
  deliveryDate?: string;
  itemDescription?: string;
  remarks?: string;
  breakup: OrderItemBreakup[];
}

/**
 * Create new order with items and breakup
 * POST /api/orders
 */
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      customerId,
      orderDate,
      expectedDeliveryDate,
      priority,
      paymentTerms,
      shippingAddress,
      remarks,
      items, // Array of { styleId, unitPrice, deliveryDate, breakup: [{ colorId, sizeId, quantity }] }
    } = req.body;

    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    // Generate order number
    const orderNumber = await generateOrderNumber();

    // Calculate totals
    let totalQuantity = 0;
    let totalAmount = 0;

    const orderItemsData = (items as OrderItem[]).map((item) => {
      const itemTotalQty = item.breakup.reduce((sum: number, b) => sum + b.quantity, 0);
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
            colorId: b.colorId && b.colorId !== '' ? b.colorId : null, // Handle empty or null colorId
            sizeId: b.sizeId,
            quantity: b.quantity,
          })),
        },
      };
    });

    const order = await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber,
        customerId,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        expectedDeliveryDate: new Date(expectedDeliveryDate),
        priority: priority || 'MEDIUM',
        totalQuantity,
        totalAmount,
        paymentTerms,
        shippingAddress,
        remarks,
        createdById: userId,
        order_items: {
          create: orderItemsData,
        },
      } as any,
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

    res.status(201).json({
      data: order,
      message: 'Order created successfully',
    });
  } catch (error: unknown) {
    logError('Create order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logError('Error details:', errorMessage);
    logError('Error stack:', errorStack);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create order',
      details: errorMessage,
    });
  }
};

/**
 * Get all orders with pagination, search, and filters
 * GET /api/orders
 */
export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      customerId,
      status,
      priority,
      fromDate,
      toDate,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.ordersWhereInput = {};

    if (search) {
      where.OR = [
        { orderNumber: { contains: search as string, mode: 'insensitive' } },
        { customers: { name: { contains: search as string, mode: 'insensitive' } } },
        { customers: { code: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (customerId) {
      where.customerId = customerId as string;
    }

    if (status) {
      where.status = status as 'PENDING' | 'IN_PRODUCTION' | 'COMPLETED' | 'DISPATCHED' | 'CANCELLED';
    }

    if (priority) {
      where.priority = priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    }

    if (fromDate || toDate) {
      where.orderDate = {};
      if (fromDate) {
        where.orderDate.gte = new Date(fromDate as string);
      }
      if (toDate) {
        where.orderDate.lte = new Date(toDate as string);
      }
    }

    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { orderDate: 'desc' },
        include: {
          customers: {
            select: {
              id: true,
              code: true,
              name: true,
              contactPerson: true,
            },
          },
          users_orders_createdByIdTousers: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { order_items: true },
          },
        },
      }),
      prisma.orders.count({ where }),
    ]);

    res.json({
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logError('Get orders error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch orders',
    });
  }
};

/**
 * Get single order by ID with full details
 * GET /api/orders/:id
 */
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const order = await prisma.orders.findUnique({
      where: { id },
      include: {
        customers: true,
        users_orders_createdByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        users_orders_approvedByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        order_items: {
          include: {
            styles: true,
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

    if (!order) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Order not found',
      });
      return;
    }

    res.json({ data: order });
  } catch (error) {
    logError('Get order error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch order',
    });
  }
};

/**
 * Update order status
 * PATCH /api/orders/:id/status
 */
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await prisma.orders.update({
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

    res.json({
      data: order,
      message: 'Order status updated successfully',
    });
  } catch (error) {
    logError('Update order status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update order status',
    });
  }
};

/**
 * Update order
 * PUT /api/orders/:id
 */
export const updateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      orderDate,
      expectedDeliveryDate,
      priority,
      paymentTerms,
      shippingAddress,
      remarks,
    } = req.body;

    const order = await prisma.orders.update({
      where: { id },
      data: {
        orderDate: orderDate ? new Date(orderDate) : undefined,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
        priority,
        paymentTerms,
        shippingAddress,
        remarks,
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

    res.json({
      data: order,
      message: 'Order updated successfully',
    });
  } catch (error) {
    logError('Update order error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update order',
    });
  }
};

/**
 * Delete/Cancel order
 * DELETE /api/orders/:id
 */
export const deleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if order exists
    const order = await prisma.orders.findUnique({
      where: { id },
    });

    if (!order) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Order not found',
      });
      return;
    }

    // Cancel order instead of hard delete
    await prisma.orders.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    logError('Delete order error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to cancel order',
    });
  }
};

/**
 * Get order statistics grouped by customer
 * GET /api/orders/statistics/by-customer
 */
export const getOrderStatisticsByCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get statistics for orders that are not cancelled
    const statistics = await prisma.orders.groupBy({
      by: ['customerId'],
      where: {
        status: {
          not: 'CANCELLED',
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        totalQuantity: true,
        totalAmount: true,
      },
    });

    // Get customer details for each statistic
    const customerIds = statistics.map(s => s.customerId);
    const customers = await prisma.customers.findMany({
      where: {
        id: { in: customerIds },
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    const customerMap = new Map(customers.map(c => [c.id, c]));

    // Combine statistics with customer info
    const result = statistics.map(stat => ({
      customerId: stat.customerId,
      customerCode: customerMap.get(stat.customerId)?.code || '',
      customerName: customerMap.get(stat.customerId)?.name || '',
      orderCount: stat._count.id,
      totalPieces: stat._sum.totalQuantity || 0,
      totalAmount: stat._sum.totalAmount || 0,
    }));

    // Calculate totals
    const totals = {
      totalOrders: result.reduce((sum, r) => sum + r.orderCount, 0),
      totalPieces: result.reduce((sum, r) => sum + r.totalPieces, 0),
      totalAmount: result.reduce((sum, r) => sum + Number(r.totalAmount), 0),
    };

    res.json({
      data: result,
      totals,
    });
  } catch (error) {
    logError('Get order statistics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch order statistics',
    });
  }
};

/**
 * Generate unique order number
 */
async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Find the last order number for this month
  const lastOrder = await prisma.orders.findFirst({
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
