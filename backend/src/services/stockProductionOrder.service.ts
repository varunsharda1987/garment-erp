import prisma from '../config/database';
import { Prisma, StockProductionOrderStatus, Priority, OrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

interface SPOCreateInput {
  styleId: string;
  totalQuantity: number;
  targetDate?: Date;
  priority?: Priority;
  remarks?: string;
  createdById: string;
  items: Array<{
    colorId?: string | null;
    sizeId: string;
    quantity: number;
  }>;
}

interface SPOUpdateInput {
  totalQuantity?: number;
  targetDate?: Date;
  priority?: Priority;
  remarks?: string;
  items?: Array<{
    colorId?: string | null;
    sizeId: string;
    quantity: number;
  }>;
}

interface SPOQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: StockProductionOrderStatus;
  styleId?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class StockProductionOrderService {
  private async generateSPONumber(): Promise<string> {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `SPO-${yy}${mm}-`;

    const lastSPO = await prisma.stock_production_orders.findFirst({
      where: { spoNumber: { startsWith: prefix } },
      orderBy: { spoNumber: 'desc' },
      select: { spoNumber: true },
    });

    if (!lastSPO) {
      return `${prefix}0001`;
    }

    const lastNumber = parseInt(lastSPO.spoNumber.replace(prefix, ''), 10);
    return `${prefix}${(lastNumber + 1).toString().padStart(4, '0')}`;
  }

  async create(data: SPOCreateInput) {
    const spoNumber = await this.generateSPONumber();

    return prisma.stock_production_orders.create({
      data: {
        id: randomUUID(),
        spoNumber,
        styleId: data.styleId,
        totalQuantity: data.totalQuantity,
        targetDate: data.targetDate || null,
        priority: data.priority || Priority.MEDIUM,
        remarks: data.remarks || null,
        createdById: data.createdById,
        status: StockProductionOrderStatus.DRAFT,
        items: {
          create: data.items.map((item) => ({
            id: randomUUID(),
            colorId: item.colorId || null,
            sizeId: item.sizeId,
            quantity: item.quantity,
          })),
        },
      },
      include: this.getDefaultIncludes(),
    });
  }

  async getAll(params: SPOQueryParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      styleId,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.stock_production_ordersWhereInput = {};

    if (search) {
      where.OR = [
        { spoNumber: { contains: search, mode: 'insensitive' } },
        { style: { styleCode: { contains: search, mode: 'insensitive' } } },
        { style: { styleName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (styleId) {
      where.styleId = styleId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      prisma.stock_production_orders.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          style: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
              imageUrl: true,
            },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { items: true, work_orders: true },
          },
        },
      }),
      prisma.stock_production_orders.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return prisma.stock_production_orders.findUnique({
      where: { id },
      include: this.getDefaultIncludes(),
    });
  }

  async update(id: string, data: SPOUpdateInput) {
    const spo = await prisma.stock_production_orders.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!spo) {
      throw new Error('Stock Production Order not found');
    }

    if (spo.status !== StockProductionOrderStatus.DRAFT) {
      throw new Error('Can only update SPOs in DRAFT status');
    }

    return prisma.$transaction(async (tx) => {
      // If items provided, replace them
      if (data.items) {
        await tx.stock_production_order_items.deleteMany({
          where: { stockProductionOrderId: id },
        });

        await tx.stock_production_order_items.createMany({
          data: data.items.map((item) => ({
            id: randomUUID(),
            stockProductionOrderId: id,
            colorId: item.colorId || null,
            sizeId: item.sizeId,
            quantity: item.quantity,
          })),
        });
      }

      return tx.stock_production_orders.update({
        where: { id },
        data: {
          totalQuantity: data.totalQuantity,
          targetDate: data.targetDate,
          priority: data.priority,
          remarks: data.remarks,
        },
        include: this.getDefaultIncludes(),
      });
    });
  }

  async delete(id: string) {
    const spo = await prisma.stock_production_orders.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!spo) {
      throw new Error('Stock Production Order not found');
    }

    if (spo.status !== StockProductionOrderStatus.DRAFT) {
      throw new Error('Can only delete SPOs in DRAFT status');
    }

    return prisma.stock_production_orders.delete({
      where: { id },
    });
  }

  async approve(id: string, approvedById: string) {
    const spo = await prisma.stock_production_orders.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!spo) {
      throw new Error('Stock Production Order not found');
    }

    if (spo.status !== StockProductionOrderStatus.DRAFT) {
      throw new Error('Can only approve SPOs in DRAFT status');
    }

    return prisma.stock_production_orders.update({
      where: { id },
      data: {
        status: StockProductionOrderStatus.APPROVED,
        approvedById,
      },
      include: this.getDefaultIncludes(),
    });
  }

  async generateWorkOrders(id: string, userId: string) {
    const spo = await prisma.stock_production_orders.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            color: { select: { id: true, colorName: true } },
            size: { select: { id: true, sizeName: true } },
          },
        },
        style: { select: { id: true, styleCode: true, styleName: true } },
      },
    });

    if (!spo) {
      throw new Error('Stock Production Order not found');
    }

    if (spo.status !== StockProductionOrderStatus.APPROVED) {
      throw new Error('Can only generate work orders for APPROVED SPOs');
    }

    // Generate a single work order with all items as breakup
    const workOrderNumber = await this.generateWorkOrderNumber();

    const workOrder = await prisma.work_orders.create({
      data: {
        id: randomUUID(),
        workOrderNumber,
        stockProductionOrderId: id,
        styleId: spo.styleId,
        plannedStartDate: spo.targetDate || new Date(),
        plannedEndDate: spo.targetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalQuantity: spo.totalQuantity,
        completedQuantity: 0,
        status: OrderStatus.PENDING,
        priority: spo.priority,
        remarks: `Stock production from ${spo.spoNumber}`,
        createdById: userId,
        work_order_breakup: {
          create: spo.items.map((item) => ({
            id: randomUUID(),
            colorId: item.colorId || null,
            sizeId: item.sizeId,
            plannedQuantity: item.quantity,
            completedQuantity: 0,
          })),
        },
      },
      include: {
        styles: {
          select: { id: true, styleCode: true, styleName: true },
        },
        work_order_breakup: {
          include: {
            color_options: { select: { id: true, colorName: true } },
            size_options: { select: { id: true, sizeName: true, sizeCode: true } },
          },
        },
      },
    });

    // Update SPO status to IN_PRODUCTION
    await prisma.stock_production_orders.update({
      where: { id },
      data: { status: StockProductionOrderStatus.IN_PRODUCTION },
    });

    return workOrder;
  }

  async search(params: { search?: string; limit?: number; isActive?: boolean }) {
    const { search, limit = 50, isActive = true } = params;

    const where: Prisma.stock_production_ordersWhereInput = {
      isActive,
    };

    if (search) {
      where.OR = [
        { spoNumber: { contains: search, mode: 'insensitive' } },
        { style: { styleCode: { contains: search, mode: 'insensitive' } } },
        { style: { styleName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return prisma.stock_production_orders.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        spoNumber: true,
        totalQuantity: true,
        status: true,
        style: {
          select: { id: true, styleCode: true, styleName: true },
        },
      },
    });
  }

  private getDefaultIncludes() {
    return {
      style: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          imageUrl: true,
          customerName: true,
        },
      },
      items: {
        include: {
          color: {
            select: { id: true, colorName: true, colorCode: true },
          },
          size: {
            select: { id: true, sizeName: true, sizeCode: true },
          },
        },
        orderBy: { size: { sortOrder: 'asc' as const } },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      approvedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      work_orders: {
        select: {
          id: true,
          workOrderNumber: true,
          status: true,
          totalQuantity: true,
          completedQuantity: true,
        },
      },
      _count: {
        select: { items: true, work_orders: true },
      },
    };
  }

  private async generateWorkOrderNumber(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const prefix = `WO${year}${month}`;

    const lastWorkOrder = await prisma.work_orders.findFirst({
      where: { workOrderNumber: { startsWith: prefix } },
      orderBy: { workOrderNumber: 'desc' },
    });

    let sequence = 1;
    if (lastWorkOrder) {
      const lastSequence = parseInt(lastWorkOrder.workOrderNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }
}

export const stockProductionOrderService = new StockProductionOrderService();
