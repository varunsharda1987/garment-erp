// Work Order Service - Production Planning & Work Order Management
import { OrderStatus, Priority, ProductionStage, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../config/database';

export interface CreateWorkOrderDTO {
  orderId?: string | null;
  orderItemId?: string | null;
  stockProductionOrderId?: string | null;
  stockProductionOrderItemId?: string | null;
  styleId: string;
  warehouseId?: string | null; // Made optional for auto-creation
  plannedStartDate: Date;
  plannedEndDate: Date;
  totalQuantity: number;
  priority?: Priority;
  remarks?: string;
  createdById: string;
  colorSizeBreakup: Array<{
    colorId: string | null; // Nullable for size-only orders
    sizeId: string;
    quantity: number;
  }>;
}

export interface SplitWorkOrderDTO {
  plannedDispatchDate: Date;
  breakupToSplit: Array<{
    colorId: string | null;
    sizeId: string;
    quantity: number; // Quantity to move to new work order
  }>;
  remarks?: string;
}

export interface UpdateWorkOrderDTO {
  warehouseId?: string;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  totalQuantity?: number;
  completedQuantity?: number;
  status?: OrderStatus;
  priority?: Priority;
  remarks?: string;
  approvedById?: string;
}

export interface WorkOrderFilters {
  status?: OrderStatus;
  priority?: Priority;
  warehouseId?: string;
  styleId?: string;
  orderId?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ProductionTrackingDTO {
  workOrderId: string;
  productionStage: ProductionStage;
  quantityCompleted: number;
  remarks?: string;
  updatedById: string;
}

class WorkOrderService {
  /**
   * Generate unique work order number
   */
  private async generateWorkOrderNumber(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

    // Find the last work order number for this month (including deleted WOs to avoid gaps in sequence)
    // Note: We include deleted work orders to maintain sequential numbering without gaps.
    // This prevents confusion in auditing and maintains continuous numbering like WO2511-0001, WO2511-0002, etc.
    const lastWorkOrder = await prisma.work_orders.findFirst({
      where: {
        workOrderNumber: {
          startsWith: `WO${year}${month}`,
        },
      },
      orderBy: {
        workOrderNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastWorkOrder) {
      const lastSequence = parseInt(lastWorkOrder.workOrderNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    return `WO${year}${month}${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new work order
   */
  async createWorkOrder(data: CreateWorkOrderDTO) {
    const workOrderNumber = await this.generateWorkOrderNumber();

    const workOrder = await prisma.work_orders.create({
      data: {
        id: randomUUID(),
        workOrderNumber,
        orderId: data.orderId || null,
        orderItemId: data.orderItemId || null,
        stockProductionOrderId: data.stockProductionOrderId || null,
        stockProductionOrderItemId: data.stockProductionOrderItemId || null,
        styleId: data.styleId,
        warehouseId: data.warehouseId || null, // Handle nullable warehouseId
        plannedStartDate: data.plannedStartDate,
        plannedEndDate: data.plannedEndDate,
        totalQuantity: data.totalQuantity,
        completedQuantity: 0,
        status: OrderStatus.PENDING,
        priority: data.priority || Priority.MEDIUM,
        remarks: data.remarks,
        createdById: data.createdById,
        work_order_breakup: {
          create: data.colorSizeBreakup.map((breakup) => ({
            id: randomUUID(),
            colorId: breakup.colorId || null, // Handle nullable colorId
            sizeId: breakup.sizeId,
            plannedQuantity: breakup.quantity,
            completedQuantity: 0,
          })),
        },
      },
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            customers: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        order_items: {
          select: {
            id: true,
            itemDescription: true,
            totalQuantity: true,
            unitPrice: true,
          },
        },
        stock_production_orders: {
          select: {
            id: true,
            spoNumber: true,
            status: true,
            totalQuantity: true,
          },
        },
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
            categoryId: true,
          },
        },
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
            city: true,
          },
        },
        users_work_orders_createdByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        work_order_breakup: {
          include: {
            color_options: {
              select: {
                id: true,
                colorName: true,
                colorCode: true,
              },
            },
            size_options: {
              select: {
                id: true,
                sizeName: true,
                sizeCode: true,
              },
            },
          },
        },
      },
    });

    return workOrder;
  }

  /**
   * Get all work orders with optional filters
   */
  async getAllWorkOrders(filters?: WorkOrderFilters) {
    const where: Prisma.work_ordersWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.priority) {
      where.priority = filters.priority;
    }

    if (filters?.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }

    if (filters?.styleId) {
      where.styleId = filters.styleId;
    }

    if (filters?.orderId) {
      where.orderId = filters.orderId;
    }

    if (filters?.search) {
      where.OR = [
        { workOrderNumber: { contains: filters.search, mode: 'insensitive' } },
        { orders: { orderNumber: { contains: filters.search, mode: 'insensitive' } } },
        { styles: { styleCode: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    if (filters?.startDate || filters?.endDate) {
      where.plannedStartDate = {};
      if (filters?.startDate) {
        where.plannedStartDate.gte = filters.startDate;
      }
      if (filters?.endDate) {
        where.plannedStartDate.lte = filters.endDate;
      }
    }

    const workOrders = await prisma.work_orders.findMany({
      where,
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            customers: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        order_items: {
          select: {
            id: true,
            itemDescription: true,
            totalQuantity: true,
            unitPrice: true,
          },
        },
        stock_production_orders: {
          select: {
            id: true,
            spoNumber: true,
            status: true,
            totalQuantity: true,
          },
        },
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
            categoryId: true,
          },
        },
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
            city: true,
          },
        },
        users_work_orders_createdByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        users_work_orders_approvedByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        work_order_breakup: {
          include: {
            color_options: {
              select: {
                id: true,
                colorName: true,
                colorCode: true,
              },
            },
            size_options: {
              select: {
                id: true,
                sizeName: true,
                sizeCode: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return workOrders;
  }

  /**
   * Get a single work order by ID
   */
  async getWorkOrderById(id: string) {
    const workOrder = await prisma.work_orders.findUnique({
      where: { id },
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            orderDate: true,
            expectedDeliveryDate: true,
            customers: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        order_items: {
          select: {
            id: true,
            itemDescription: true,
            totalQuantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
            categoryId: true,
            description: true,
            imageUrl: true,
          },
        },
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
            address: true,
            city: true,
          },
        },
        users_work_orders_createdByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        users_work_orders_approvedByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        work_order_breakup: {
          include: {
            color_options: {
              select: {
                id: true,
                colorName: true,
                colorCode: true,
              },
            },
            size_options: {
              select: {
                id: true,
                sizeName: true,
                sizeCode: true,
              },
            },
          },
        },
        production_tracking: {
          include: {
            users: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            updateDate: 'desc',
          },
        },
      },
    });

    if (!workOrder) {
      throw new Error('Work order not found');
    }

    return workOrder;
  }

  /**
   * Update a work order
   */
  async updateWorkOrder(id: string, data: UpdateWorkOrderDTO) {
    const workOrder = await prisma.work_orders.update({
      where: { id },
      data: {
        ...data,
      },
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            customers: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
          },
        },
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
          },
        },
      },
    });

    return workOrder;
  }

  /**
   * Delete a work order
   */
  async deleteWorkOrder(id: string) {
    await prisma.work_orders.delete({
      where: { id },
    });

    return { success: true, message: 'Work order deleted successfully' };
  }

  /**
   * Add production tracking update
   */
  async addProductionTracking(data: ProductionTrackingDTO, isAdminOverride: boolean = false, overrideReason?: string) {
    // Import validation service
    const { productionBlockingValidationService } = await import('./productionBlockingValidation.service');

    // HARD BLOCKING VALIDATION
    const validation = await productionBlockingValidationService.validateStageTransition(
      data.workOrderId,
      data.productionStage,
      isAdminOverride
    );

    if (validation.isBlocked) {
      throw new Error(`Stage transition blocked: ${validation.blockers.map((b) => b.message).join('; ')}`);
    }

    // Log override if admin bypassed blocks
    if (isAdminOverride && overrideReason) {
      await productionBlockingValidationService.logOverride({
        blockType: 'STAGE_TRANSITION',
        workOrderId: data.workOrderId,
        toStage: data.productionStage,
        overrideReason,
        overriddenById: data.updatedById,
      });
    }

    const tracking = await prisma.production_tracking.create({
      data: {
        id: randomUUID(),
        workOrderId: data.workOrderId,
        productionStage: data.productionStage,
        quantityCompleted: data.quantityCompleted,
        remarks: data.remarks,
        updatedById: data.updatedById,
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        work_orders: {
          select: {
            id: true,
            workOrderNumber: true,
            totalQuantity: true,
          },
        },
      },
    });

    // Update work order status based on production stage
    const workOrder = await prisma.work_orders.findUnique({
      where: { id: data.workOrderId },
    });

    if (workOrder) {
      let newStatus = workOrder.status;

      if (data.productionStage === ProductionStage.CUTTING && !workOrder.actualStartDate) {
        // Mark as started when cutting begins
        await prisma.work_orders.update({
          where: { id: data.workOrderId },
          data: {
            actualStartDate: new Date(),
            status: OrderStatus.IN_PRODUCTION,
          },
        });
      } else if (
        data.productionStage === ProductionStage.PACKING &&
        data.quantityCompleted >= workOrder.totalQuantity
      ) {
        // Mark as completed when packing is done
        await prisma.work_orders.update({
          where: { id: data.workOrderId },
          data: {
            actualEndDate: new Date(),
            status: OrderStatus.COMPLETED,
            completedQuantity: workOrder.totalQuantity,
          },
        });
      }
    }

    return tracking;
  }

  /**
   * Get production dashboard data
   */
  async getProductionDashboard() {
    // Get work orders summary by status
    const statusSummary = await prisma.work_orders.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
      _sum: {
        totalQuantity: true,
        completedQuantity: true,
      },
    });

    // Get work orders by location
    const locationSummary = await prisma.work_orders.groupBy({
      by: ['warehouseId'],
      _count: {
        id: true,
      },
      where: {
        status: {
          in: [OrderStatus.PENDING, OrderStatus.IN_PRODUCTION],
        },
      },
    });

    // Get recent production tracking updates
    const recentUpdates = await prisma.production_tracking.findMany({
      take: 10,
      orderBy: {
        updateDate: 'desc',
      },
      include: {
        work_orders: {
          select: {
            id: true,
            workOrderNumber: true,
            styles: {
              select: {
                styleCode: true,
                styleName: true,
              },
            },
          },
        },
        users: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Get active work orders with stage breakdown
    const activeWorkOrders = await prisma.work_orders.findMany({
      where: {
        status: {
          in: [OrderStatus.PENDING, OrderStatus.IN_PRODUCTION],
        },
      },
      include: {
        styles: {
          select: {
            styleCode: true,
            styleName: true,
          },
        },
        warehouses: {
          select: {
            warehouseName: true,
          },
        },
        production_tracking: {
          orderBy: {
            updateDate: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        plannedStartDate: 'asc',
      },
    });

    return {
      statusSummary,
      locationSummary,
      recentUpdates,
      activeWorkOrders,
    };
  }

  /**
   * Get work orders by order ID
   */
  async getWorkOrdersByOrderId(orderId: string) {
    return await prisma.work_orders.findMany({
      where: { orderId },
      include: {
        styles: {
          select: {
            styleCode: true,
            styleName: true,
          },
        },
        warehouses: {
          select: {
            warehouseName: true,
            warehouseCode: true,
          },
        },
        work_order_breakup: {
          include: {
            color_options: {
              select: {
                id: true,
                colorName: true,
                colorCode: true,
              },
            },
            size_options: {
              select: {
                id: true,
                sizeName: true,
                sizeCode: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Create work order automatically from order item
   * Used when auto-creating work orders during order creation
   */
  async createFromOrderItem(
    orderItemId: string,
    orderId: string,
    orderData: {
      plannedStartDate: Date;
      plannedEndDate: Date;
      priority: Priority;
      createdById: string;
    }
  ) {
    // Fetch the order item with its breakup
    const orderItem = await prisma.order_items.findUnique({
      where: { id: orderItemId },
      include: {
        order_item_breakup: true,
      },
    });

    if (!orderItem) {
      throw new Error(`Order item not found: ${orderItemId}`);
    }

    // Map order item breakup to work order breakup format
    const colorSizeBreakup = orderItem.order_item_breakup.map((breakup) => ({
      colorId: breakup.colorId, // Can be null for size-only orders
      sizeId: breakup.sizeId,
      quantity: breakup.quantity,
    }));

    // Create work order using existing method
    const workOrder = await this.createWorkOrder({
      orderId,
      orderItemId,
      styleId: orderItem.styleId,
      warehouseId: null, // Warehouse to be assigned later
      plannedStartDate: orderData.plannedStartDate,
      plannedEndDate: orderData.plannedEndDate,
      totalQuantity: orderItem.totalQuantity,
      priority: orderData.priority,
      remarks: 'Auto-created from order',
      createdById: orderData.createdById,
      colorSizeBreakup,
    });

    return workOrder;
  }

  /**
   * Split a work order into two for partial dispatch
   * Creates a new work order with the split quantities and reduces original
   */
  async splitWorkOrder(workOrderId: string, data: SplitWorkOrderDTO, userId: string) {
    // Get the existing work order with breakup
    const originalWorkOrder = await prisma.work_orders.findUnique({
      where: { id: workOrderId },
      include: {
        work_order_breakup: true,
      },
    });

    if (!originalWorkOrder) {
      throw new Error('Work order not found');
    }

    if (originalWorkOrder.status !== OrderStatus.PENDING) {
      throw new Error('Can only split work orders in PENDING status');
    }

    // Validate split quantities
    let totalSplitQty = 0;
    for (const splitItem of data.breakupToSplit) {
      const originalBreakup = originalWorkOrder.work_order_breakup.find(
        (b) => b.colorId === splitItem.colorId && b.sizeId === splitItem.sizeId
      );

      if (!originalBreakup) {
        throw new Error(`Color/Size combination not found in original work order`);
      }

      if (splitItem.quantity > originalBreakup.plannedQuantity) {
        throw new Error(`Split quantity exceeds available quantity for color/size`);
      }

      if (splitItem.quantity <= 0) {
        continue; // Skip zero quantities
      }

      totalSplitQty += splitItem.quantity;
    }

    if (totalSplitQty <= 0) {
      throw new Error('Must specify at least some quantity to split');
    }

    if (totalSplitQty >= originalWorkOrder.totalQuantity) {
      throw new Error('Cannot split entire quantity - some must remain in original');
    }

    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create new work order with split quantities
      const newWorkOrderNumber = await this.generateWorkOrderNumber();

      const newWorkOrder = await tx.work_orders.create({
        data: {
          id: randomUUID(),
          workOrderNumber: newWorkOrderNumber,
          orderId: originalWorkOrder.orderId,
          orderItemId: originalWorkOrder.orderItemId,
          styleId: originalWorkOrder.styleId,
          warehouseId: originalWorkOrder.warehouseId,
          plannedStartDate: originalWorkOrder.plannedStartDate,
          plannedEndDate: data.plannedDispatchDate,
          totalQuantity: totalSplitQty,
          completedQuantity: 0,
          status: OrderStatus.PENDING,
          priority: originalWorkOrder.priority,
          remarks: data.remarks || `Split from ${originalWorkOrder.workOrderNumber}`,
          createdById: userId,
          work_order_breakup: {
            create: data.breakupToSplit
              .filter((item) => item.quantity > 0)
              .map((item) => ({
                id: randomUUID(),
                colorId: item.colorId,
                sizeId: item.sizeId,
                plannedQuantity: item.quantity,
                completedQuantity: 0,
              })),
          },
        },
      });

      // 2. Update original work order breakup quantities
      for (const splitItem of data.breakupToSplit) {
        if (splitItem.quantity <= 0) continue;

        const originalBreakup = originalWorkOrder.work_order_breakup.find(
          (b) => b.colorId === splitItem.colorId && b.sizeId === splitItem.sizeId
        );

        if (originalBreakup) {
          const newQty = originalBreakup.plannedQuantity - splitItem.quantity;

          if (newQty > 0) {
            await tx.work_order_breakup.update({
              where: { id: originalBreakup.id },
              data: { plannedQuantity: newQty },
            });
          } else {
            // Remove breakup entry if quantity is zero
            await tx.work_order_breakup.delete({
              where: { id: originalBreakup.id },
            });
          }
        }
      }

      // 3. Update original work order total quantity
      await tx.work_orders.update({
        where: { id: workOrderId },
        data: {
          totalQuantity: originalWorkOrder.totalQuantity - totalSplitQty,
        },
      });

      return newWorkOrder;
    });

    // Fetch complete new work order with includes
    return await this.getWorkOrderById(result.id);
  }

  /**
   * Cancel all work orders for an order (used when order is cancelled)
   */
  async cancelWorkOrdersByOrderId(orderId: string) {
    const result = await prisma.work_orders.updateMany({
      where: {
        orderId,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.IN_PRODUCTION],
        },
      },
      data: {
        status: OrderStatus.CANCELLED,
      },
    });

    return { cancelled: result.count };
  }
}

export default new WorkOrderService();
