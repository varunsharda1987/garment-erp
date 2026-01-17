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

    // Debug logging
    logInfo('[createOrder] Request body:', JSON.stringify({
      customerId,
      orderDate,
      expectedDeliveryDate,
      priority,
      items: items?.map((item: OrderItem) => ({
        styleId: item.styleId,
        unitPrice: item.unitPrice,
        breakupCount: item.breakup?.length,
        breakup: item.breakup?.slice(0, 3), // Log first 3 breakup items
      })),
    }, null, 2));

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
      // Handle empty/undefined unitPrice - default to 0 for orders without pricing
      const parsedUnitPrice = parseFloat(String(item.unitPrice)) || 0;
      const itemTotal = itemTotalQty * parsedUnitPrice;

      totalQuantity += itemTotalQty;
      totalAmount += itemTotal;

      logInfo('[createOrder] Processing item:', JSON.stringify({
        styleId: item.styleId,
        breakupCount: item.breakup?.length,
        itemTotalQty,
        parsedUnitPrice,
        itemTotal,
      }));

      return {
        id: randomUUID(),
        styleId: item.styleId,
        itemDescription: item.itemDescription || null,
        totalQuantity: itemTotalQty,
        unitPrice: parsedUnitPrice,
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

    // =====================================================
    // CREATE COST SHEET SNAPSHOTS FOR EACH ORDER ITEM
    // This captures the cost sheet data at order creation time
    // for accurate pricing and variance tracking later
    // =====================================================
    const costingSnapshots: string[] = [];

    for (const orderItem of order.order_items) {
      try {
        // Find the approved cost sheet for this style (latest version)
        const costSheet = await prisma.style_costing.findFirst({
          where: {
            styleId: orderItem.styleId,
            isApproved: true,
            supersededById: null, // Only get the current active version
          },
          orderBy: { version: 'desc' },
        });

        if (costSheet) {
          // Create the costing snapshot
          const costingSnapshot = {
            id: costSheet.id,
            version: costSheet.version,
            versionDate: costSheet.versionDate,
            fabricDetails: costSheet.fabricDetails,
            fabricTotal: costSheet.fabricTotal,
            trimsDetails: costSheet.trimsDetails,
            trimsTotal: costSheet.trimsTotal,
            cmtTotal: costSheet.cmtTotal,
            cuttingCost: costSheet.cuttingCost,
            stitchingCost: costSheet.stitchingCost,
            finishingCost: costSheet.finishingCost,
            embroideryDetails: costSheet.embroideryDetails,
            embroideryTotal: costSheet.embroideryTotal,
            accessoriesDetails: costSheet.accessoriesDetails,
            accessoriesTotal: costSheet.accessoriesTotal,
            valueLossPercent: costSheet.valueLossPercent,
            valueLossAmount: costSheet.valueLossAmount,
            markupPercent: costSheet.markupPercent,
            markupAmount: costSheet.markupAmount,
            subtotal: costSheet.subtotal,
            totalProductCost: costSheet.totalProductCost,
            totalCostPerPiece: costSheet.totalCostPerPiece,
            sellingPricePerPiece: costSheet.sellingPricePerPiece,
            profitMargin: costSheet.profitMargin,
          };

          // Create order_item_costing record with snapshot
          // Note: Using type assertion for fields that use @map in schema
          await prisma.order_item_costing.create({
            data: {
              orderItemId: orderItem.id,
              baseCostingId: costSheet.id,
              fabricTotal: costSheet.fabricTotal || 0,
              trimsTotal: costSheet.trimsTotal || 0,
              cmtTotal: costSheet.cmtTotal || 0,
              embroideryTotal: costSheet.embroideryTotal || 0,
              accessoriesTotal: costSheet.accessoriesTotal || 0,
              totalCostPerPiece: costSheet.totalCostPerPiece || costSheet.totalProductCost || 0,
              profitMargin: costSheet.profitMargin,
              sellingPricePerPiece: costSheet.sellingPricePerPiece,
              // Fields with @map need to use the Prisma model name (camelCase)
              costingSnapshot: costingSnapshot as any,
              snapshotCreatedAt: new Date(),
              originalCostSheetVersion: costSheet.version,
              estimatedCostPerPiece: costSheet.totalCostPerPiece || costSheet.totalProductCost || 0,
            } as any,
          });

          costingSnapshots.push(orderItem.id);
          logInfo(`[createOrder] Created cost sheet snapshot for order item ${orderItem.id} from cost sheet v${costSheet.version}`);
        } else {
          logWarn(`[createOrder] No approved cost sheet found for style ${orderItem.styleId}`);
        }
      } catch (snapshotError) {
        // Don't fail the order if snapshot fails - just log warning
        logWarn(`[createOrder] Failed to create cost sheet snapshot for order item ${orderItem.id}:`, snapshotError);
      }
    }

    res.status(201).json({
      data: order,
      message: 'Order created successfully',
      costingInfo: {
        snapshotsCreated: costingSnapshots.length,
        totalItems: order.order_items.length,
      },
    });
  } catch (error: unknown) {
    logError('[createOrder] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logError('[createOrder] Error details:', errorMessage);
    logError('[createOrder] Error stack:', errorStack);

    // Check for Prisma-specific errors
    const prismaError = error as { code?: string; meta?: { field_name?: string; target?: string[] } };
    if (prismaError.code) {
      logError('[createOrder] Prisma error code:', prismaError.code);
      logError('[createOrder] Prisma error meta:', JSON.stringify(prismaError.meta));
    }

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

    // Debug logging
    logInfo('[getOrderById] Order found:', order.orderNumber);
    logInfo('[getOrderById] Order items count:', order.order_items?.length || 0);
    if (order.order_items && order.order_items.length > 0) {
      logInfo('[getOrderById] First item breakup count:', order.order_items[0].order_item_breakup?.length || 0);
      logInfo('[getOrderById] First breakup sample:', JSON.stringify(order.order_items[0].order_item_breakup?.[0]));
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

    // Get the current order with items to check for status change
    const currentOrder = await prisma.orders.findUnique({
      where: { id },
      include: {
        order_items: {
          select: {
            id: true,
            styleId: true,
          },
        },
      },
    });

    if (!currentOrder) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const previousStatus = currentOrder.status;

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
        order_items: {
          select: {
            id: true,
            styleId: true,
          },
        },
      },
    });

    // =====================================================
    // AUTO-TRIGGER RAW_MATERIAL_CALCULATION CAD
    // When order status changes to IN_PRODUCTION (confirmation)
    // Clone COSTING CAD rows to RAW_MATERIAL_CALCULATION purpose
    // =====================================================
    const rawMatResults: { styleId: string; clonedCount: number; skipped: boolean; reason?: string }[] = [];

    if (status === 'IN_PRODUCTION' && previousStatus !== 'IN_PRODUCTION') {
      logInfo(`[updateOrderStatus] Order ${id} confirmed (IN_PRODUCTION) - triggering RAW_MATERIAL_CALCULATION CAD creation`);

      for (const orderItem of order.order_items) {
        try {
          // Check if RAW_MATERIAL_CALCULATION CAD already exists for this style+order
          // Using raw query due to field name mapping in Prisma schema
          const existingRawMat = await prisma.fabric_width_cad.findFirst({
            where: {
              purpose: 'RAW_MATERIAL_CALCULATION',
              styleFabric: {
                style_components: {
                  styleId: orderItem.styleId,
                },
              },
            } as any,
          });

          // Check if this specific order has already triggered RAW_MAT
          if (existingRawMat && (existingRawMat as any).clonedFromOrderId === id) {
            rawMatResults.push({
              styleId: orderItem.styleId,
              clonedCount: 0,
              skipped: true,
              reason: 'RAW_MATERIAL_CALCULATION already exists for this order',
            });
            continue;
          }

          // Find approved COSTING CAD rows for this style
          // approvedBy is set when CAD is approved (not null means approved)
          const costingCadRows = await prisma.fabric_width_cad.findMany({
            where: {
              purpose: 'COSTING',
              approvedBy: { not: null }, // CAD is approved when approvedBy is set
              styleFabric: {
                style_components: {
                  styleId: orderItem.styleId,
                },
              },
            },
            include: {
              styleFabric: {
                select: {
                  id: true,
                  componentId: true,
                  fabricId: true,
                  genericFabricName: true,
                },
              },
              sizeBreakdowns: true, // Correct relation name
            },
          });

          if (costingCadRows.length === 0) {
            rawMatResults.push({
              styleId: orderItem.styleId,
              clonedCount: 0,
              skipped: true,
              reason: 'No approved COSTING CAD found',
            });
            continue;
          }

          // Clone each COSTING CAD row to RAW_MATERIAL_CALCULATION
          let clonedCount = 0;
          for (const costingCad of costingCadRows) {
            const newCadId = randomUUID();

            // Use type assertion for fields with @map
            await prisma.fabric_width_cad.create({
              data: {
                id: newCadId,
                styleFabricId: costingCad.styleFabricId,
                greigeId: costingCad.greigeId,
                cutableWidth: costingCad.cutableWidth,
                cadMeters: costingCad.cadMeters,
                cadYards: costingCad.cadYards,
                cadAverage: costingCad.cadAverage,
                cadWastagePercent: costingCad.cadWastagePercent,
                markerEfficiency: costingCad.markerEfficiency,
                // RAW_MATERIAL_CALCULATION purpose
                purpose: 'RAW_MATERIAL_CALCULATION',
                // Link to order - these fields use @map in schema
                clonedFromOrderId: id,
                clonedFromCadId: costingCad.id,
                notes: `Cloned from COSTING CAD ${costingCad.id} when order ${order.orderNumber} was confirmed`,
                // Cost data
                greigeCostPerMeter: costingCad.greigeCostPerMeter,
                processingPricePerMeter: costingCad.processingPricePerMeter,
                totalCostPerMeter: costingCad.totalCostPerMeter,
                costInputMode: costingCad.costInputMode,
                // Clone size breakdowns if they exist
                sizeBreakdowns: costingCad.sizeBreakdowns.length > 0
                  ? {
                      create: costingCad.sizeBreakdowns.map((sb: any) => ({
                        sizeName: sb.sizeName,
                        sizeId: sb.sizeId,
                        quantity: sb.quantity,
                        cadMeters: sb.cadMeters,
                        cadYards: sb.cadYards,
                      })),
                    }
                  : undefined,
              } as any,
            });
            clonedCount++;
          }

          rawMatResults.push({
            styleId: orderItem.styleId,
            clonedCount,
            skipped: false,
          });

          logInfo(`[updateOrderStatus] Cloned ${clonedCount} COSTING CAD rows to RAW_MATERIAL_CALCULATION for style ${orderItem.styleId}`);
        } catch (rawMatError) {
          logWarn(`[updateOrderStatus] Failed to create RAW_MATERIAL_CALCULATION CAD for style ${orderItem.styleId}:`, rawMatError);
          rawMatResults.push({
            styleId: orderItem.styleId,
            clonedCount: 0,
            skipped: true,
            reason: 'Error during cloning',
          });
        }
      }
    }

    res.json({
      data: order,
      message: 'Order status updated successfully',
      rawMaterialCalculation: rawMatResults.length > 0 ? {
        triggered: true,
        results: rawMatResults,
      } : undefined,
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
