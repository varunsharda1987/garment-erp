// Order Management Controller
import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Create new order with items and breakup
 * POST /api/orders
 */
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      customerId,
      expectedDeliveryDate,
      priority,
      paymentTerms,
      shippingAddress,
      remarks,
      items, // Array of { styleId, unitPrice, deliveryDate, breakup: [{ colorId, sizeId, quantity }] }
    } = req.body;

    const userId = (req as any).user?.userId;

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

    const orderItemsData = items.map((item: any) => {
      const itemTotalQty = item.breakup.reduce((sum: number, b: any) => sum + b.quantity, 0);
      const itemTotal = itemTotalQty * parseFloat(item.unitPrice);

      totalQuantity += itemTotalQty;
      totalAmount += itemTotal;

      return {
        styleId: item.styleId,
        itemDescription: item.itemDescription || null,
        totalQuantity: itemTotalQty,
        unitPrice: parseFloat(item.unitPrice),
        totalPrice: itemTotal,
        deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
        remarks: item.remarks || null,
        orderItemBreakup: {
          create: item.breakup.map((b: any) => ({
            colorId: b.colorId,
            sizeId: b.sizeId,
            quantity: b.quantity,
          })),
        },
      };
    });

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId,
        orderDate: new Date(),
        expectedDeliveryDate: new Date(expectedDeliveryDate),
        priority: priority || 'MEDIUM',
        totalQuantity,
        totalAmount,
        paymentTerms,
        shippingAddress,
        remarks,
        createdById: userId,
        orderItems: {
          create: orderItemsData,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            contactPerson: true,
            phone: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        orderItems: {
          include: {
            style: {
              select: {
                id: true,
                styleCode: true,
                styleName: true,
                image: true,
              },
            },
            orderItemBreakup: {
              include: {
                color: true,
                size: true,
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
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create order',
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
    const where: any = {};

    if (search) {
      where.OR = [
        { orderNumber: { contains: search as string, mode: 'insensitive' } },
        { customer: { name: { contains: search as string, mode: 'insensitive' } } },
        { customer: { code: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (customerId) {
      where.customerId = customerId as string;
    }

    if (status) {
      where.status = status as string;
    }

    if (priority) {
      where.priority = priority as string;
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
      prisma.order.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { orderDate: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
              contactPerson: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { orderItems: true },
          },
        },
      }),
      prisma.order.count({ where }),
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
    console.error('Get orders error:', error);
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

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        orderItems: {
          include: {
            style: true,
            orderItemBreakup: {
              include: {
                color: true,
                size: true,
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
    console.error('Get order error:', error);
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

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        customer: {
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
    console.error('Update order status error:', error);
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
      expectedDeliveryDate,
      priority,
      paymentTerms,
      shippingAddress,
      remarks,
    } = req.body;

    const order = await prisma.order.update({
      where: { id },
      data: {
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
        priority,
        paymentTerms,
        shippingAddress,
        remarks,
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        orderItems: {
          include: {
            style: {
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
    console.error('Update order error:', error);
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
    const order = await prisma.order.findUnique({
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
    await prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to cancel order',
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
  const lastOrder = await prisma.order.findFirst({
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
