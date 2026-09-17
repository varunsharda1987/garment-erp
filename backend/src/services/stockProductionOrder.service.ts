import prisma from '../config/database';
import { Prisma, StockProductionOrderStatus, Priority, OrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';
import { applySearch } from '../utils/search-filter';
import { NotFoundError, BusinessError, ConflictError } from '../errors';

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
    // Atomic sequence (SPO2607-0001) — the old findFirst+parse+increment raced under concurrency
    return generateAtomicDocNumber('SPO');
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
      applySearch(where, search, ['spoNumber', 'style.styleCode', 'style.buyerStyleRef', 'style.styleName']);
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
              buyerStyleRef: true,
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
      throw new NotFoundError('Stock Production Order', id);
    }

    if (spo.status !== StockProductionOrderStatus.DRAFT) {
      throw new BusinessError(`Can only approve a DRAFT stock production order (this one is ${spo.status})`);
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
      throw new NotFoundError('Stock Production Order', id);
    }

    if (spo.status !== StockProductionOrderStatus.APPROVED) {
      throw new BusinessError(
        spo.status === StockProductionOrderStatus.IN_PRODUCTION
          ? `Work orders have already been generated for ${spo.spoNumber}`
          : `Can only generate work orders for an APPROVED stock production order (${spo.spoNumber} is ${spo.status})`
      );
    }

    // The work order's size breakup must add up to its header quantity (integrity check D12);
    // refuse here rather than mint a run the sweep would flag.
    const breakupTotal = spo.items.reduce((sum, item) => sum + item.quantity, 0);
    if (spo.items.length === 0) {
      throw new BusinessError(`Add the size breakup to ${spo.spoNumber} before generating work orders`);
    }
    if (breakupTotal !== spo.totalQuantity) {
      throw new BusinessError(
        `The size breakup of ${spo.spoNumber} adds up to ${breakupTotal}, not the order quantity of ${spo.totalQuantity}`
      );
    }

    // Generate a single work order with all items as breakup
    const workOrderNumber = await this.generateWorkOrderNumber();

    // Claim, guard and create in ONE transaction. The old sequence created the work order and
    // only then flipped the status, outside any transaction — two clicks (or a retry after a
    // half-failure) produced two runs for one stock order, and nothing looked for an existing
    // one (order-system T1-D, 2026-09-17).
    return prisma.$transaction(async (tx) => {
      // Exactly one caller flips APPROVED → IN_PRODUCTION; a concurrent second call finds no row.
      const claimed = await tx.stock_production_orders.updateMany({
        where: { id, status: StockProductionOrderStatus.APPROVED },
        data: { status: StockProductionOrderStatus.IN_PRODUCTION },
      });
      if (claimed.count === 0) {
        throw new ConflictError(`Work orders are already being generated for ${spo.spoNumber}`);
      }

      const existing = await tx.work_orders.findFirst({
        where: { stockProductionOrderId: id, status: { not: OrderStatus.CANCELLED } },
        select: { workOrderNumber: true },
      });
      if (existing) {
        throw new ConflictError(`Work order ${existing.workOrderNumber} already exists for ${spo.spoNumber}`);
      }

      return tx.work_orders.create({
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
    });
  }

  async search(params: { search?: string; limit?: number; isActive?: boolean }) {
    const { search, limit = 50, isActive = true } = params;

    const where: Prisma.stock_production_ordersWhereInput = {
      isActive,
    };

    if (search) {
      applySearch(where, search, ['spoNumber', 'style.styleCode', 'style.buyerStyleRef', 'style.styleName']);
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
          buyerStyleRef: true,
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
    // Atomic sequence (WO2607-0001) shared with workOrder.service — both write
    // work_orders.workOrderNumber, so both MUST use the same 'WO' prefix
    return generateAtomicDocNumber('WO');
  }
}

export const stockProductionOrderService = new StockProductionOrderService();
