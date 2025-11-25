// Work Order Service - Production Planning & Work Order Management
import { PrismaClient, OrderStatus, Priority, ProductionStage } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface CreateWorkOrderDTO {
  orderId: string;
  orderItemId: string;
  styleId: string;
  locationId: string;
  plannedStartDate: Date;
  plannedEndDate: Date;
  totalQuantity: number;
  priority?: Priority;
  remarks?: string;
  createdById: string;
  colorSizeBreakup: Array<{
    colorId: string;
    sizeId: string;
    quantity: number;
  }>;
}

export interface UpdateWorkOrderDTO {
  locationId?: string;
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
  locationId?: string;
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

    // Find the last work order number for this month
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
        orderId: data.orderId,
        orderItemId: data.orderItemId,
        styleId: data.styleId,
        locationId: data.locationId,
        plannedStartDate: data.plannedStartDate,
        plannedEndDate: data.plannedEndDate,
        totalQuantity: data.totalQuantity,
        completedQuantity: 0,
        status: OrderStatus.PENDING,
        priority: data.priority || Priority.MEDIUM,
        remarks: data.remarks,
        createdById: data.createdById,
        work_order_breakup: {
          create: data.colorSizeBreakup.map(breakup => ({
            id: randomUUID(),
            colorId: breakup.colorId,
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
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
            categoryId: true,
          },
        },
        locations: {
          select: {
            id: true,
            locationCode: true,
            locationName: true,
            locationType: true,
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
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.priority) {
      where.priority = filters.priority;
    }

    if (filters?.locationId) {
      where.locationId = filters.locationId;
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
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
            categoryId: true,
          },
        },
        locations: {
          select: {
            id: true,
            locationCode: true,
            locationName: true,
            locationType: true,
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
        locations: {
          select: {
            id: true,
            locationCode: true,
            locationName: true,
            locationType: true,
            address: true,
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
        locations: {
          select: {
            id: true,
            locationCode: true,
            locationName: true,
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
  async addProductionTracking(data: ProductionTrackingDTO) {
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
      } else if (data.productionStage === ProductionStage.PACKING && data.quantityCompleted >= workOrder.totalQuantity) {
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
      by: ['locationId'],
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
        locations: {
          select: {
            locationName: true,
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
        locations: {
          select: {
            locationName: true,
          },
        },
        work_order_breakup: {
          include: {
            color_options: {
              select: {
                colorName: true,
              },
            },
            size_options: {
              select: {
                sizeName: true,
              },
            },
          },
        },
      },
    });
  }
}

export default new WorkOrderService();
