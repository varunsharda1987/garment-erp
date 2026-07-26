import prisma from '../config/database';
import { Prisma, SaleOrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';

interface SOCreateInput {
  customerId: string;
  expectedShipDate?: Date;
  remarks?: string;
  createdById: string;
  items: Array<{
    styleId: string;
    colorId?: string | null;
    sizeId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

interface SOUpdateInput {
  expectedShipDate?: Date;
  remarks?: string;
  items?: Array<{
    styleId: string;
    colorId?: string | null;
    sizeId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

interface SOQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: SaleOrderStatus;
  customerId?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class SaleOrderService {
  private async generateSONumber(): Promise<string> {
    // Atomic sequence (SO2607-0001) — the old findFirst+parse+increment raced under concurrency
    return generateAtomicDocNumber('SO');
  }

  async create(data: SOCreateInput) {
    const saleOrderNumber = await this.generateSONumber();

    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    return prisma.sale_orders.create({
      data: {
        id: randomUUID(),
        saleOrderNumber,
        customerId: data.customerId,
        expectedShipDate: data.expectedShipDate || null,
        status: SaleOrderStatus.DRAFT,
        subtotal,
        totalAmount: subtotal,
        remarks: data.remarks || null,
        createdById: data.createdById,
        items: {
          create: data.items.map((item) => ({
            id: randomUUID(),
            styleId: item.styleId,
            colorId: item.colorId || null,
            sizeId: item.sizeId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: this.getDefaultIncludes(),
    });
  }

  async getAll(params: SOQueryParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      customerId,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const skip = (page - 1) * limit;
    const where: Prisma.sale_ordersWhereInput = {};

    if (search) {
      where.OR = [
        { saleOrderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await Promise.all([
      prisma.sale_orders.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: { id: true, code: true, name: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { items: true, delivery_notes: true, invoices: true },
          },
        },
      }),
      prisma.sale_orders.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    return prisma.sale_orders.findUnique({
      where: { id },
      include: this.getDefaultIncludes(),
    });
  }

  async update(id: string, data: SOUpdateInput) {
    const so = await prisma.sale_orders.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!so) throw new Error('Sale Order not found');
    if (so.status !== SaleOrderStatus.DRAFT) {
      throw new Error('Can only update Sale Orders in DRAFT status');
    }

    return prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.sale_order_items.deleteMany({
          where: { saleOrderId: id },
        });

        const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

        await tx.sale_order_items.createMany({
          data: data.items.map((item) => ({
            id: randomUUID(),
            saleOrderId: id,
            styleId: item.styleId,
            colorId: item.colorId || null,
            sizeId: item.sizeId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        });

        return tx.sale_orders.update({
          where: { id },
          data: {
            expectedShipDate: data.expectedShipDate,
            remarks: data.remarks,
            subtotal,
            totalAmount: subtotal,
          },
          include: this.getDefaultIncludes(),
        });
      }

      return tx.sale_orders.update({
        where: { id },
        data: {
          expectedShipDate: data.expectedShipDate,
          remarks: data.remarks,
        },
        include: this.getDefaultIncludes(),
      });
    });
  }

  async delete(id: string) {
    const so = await prisma.sale_orders.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!so) throw new Error('Sale Order not found');
    if (so.status !== SaleOrderStatus.DRAFT) {
      throw new Error('Can only delete Sale Orders in DRAFT status');
    }

    return prisma.sale_orders.delete({ where: { id } });
  }

  async confirm(id: string, approvedById: string) {
    const so = await prisma.sale_orders.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!so) throw new Error('Sale Order not found');
    if (so.status !== SaleOrderStatus.DRAFT) {
      throw new Error('Can only confirm Sale Orders in DRAFT status');
    }

    return prisma.sale_orders.update({
      where: { id },
      data: {
        status: SaleOrderStatus.CONFIRMED,
        approvedById,
      },
      include: this.getDefaultIncludes(),
    });
  }

  async allocateStock(saleOrderItemId: string, fgStockId: string, quantity: number, userId: string) {
    // Verify the FG stock has enough available quantity
    const fgStock = await prisma.finished_goods_stock.findUnique({
      where: { id: fgStockId },
      include: {
        fg_stock_allocations: {
          where: { status: 'ALLOCATED' },
        },
      },
    });

    if (!fgStock) throw new Error('Finished goods stock not found');

    const allocatedQty = fgStock.fg_stock_allocations.reduce((sum, a) => sum + a.allocatedQty, 0);
    const availableQty = fgStock.quantity - allocatedQty;

    if (quantity > availableQty) {
      throw new Error(`Only ${availableQty} pcs available (${fgStock.quantity} total - ${allocatedQty} allocated)`);
    }

    // Create allocation and update sale order item
    const allocation = await prisma.$transaction(async (tx) => {
      const alloc = await tx.fg_stock_allocations.create({
        data: {
          id: randomUUID(),
          saleOrderItemId,
          fgStockId,
          allocatedQty: quantity,
          status: 'ALLOCATED',
          allocatedById: userId,
        },
      });

      // Update sale order item allocated qty
      await tx.sale_order_items.update({
        where: { id: saleOrderItemId },
        data: {
          allocatedQty: { increment: quantity },
        },
      });

      // Check if all items in the sale order are fully allocated
      const soItem = await tx.sale_order_items.findUnique({
        where: { id: saleOrderItemId },
        select: { saleOrderId: true },
      });

      if (soItem) {
        const allItems = await tx.sale_order_items.findMany({
          where: { saleOrderId: soItem.saleOrderId },
        });

        const allFullyAllocated = allItems.every((item) => item.allocatedQty >= item.quantity);
        const someAllocated = allItems.some((item) => item.allocatedQty > 0);

        let newStatus: SaleOrderStatus | undefined;
        if (allFullyAllocated) {
          newStatus = SaleOrderStatus.FULLY_ALLOCATED;
        } else if (someAllocated) {
          newStatus = SaleOrderStatus.PARTIALLY_ALLOCATED;
        }

        if (newStatus) {
          await tx.sale_orders.update({
            where: { id: soItem.saleOrderId },
            data: { status: newStatus },
          });
        }
      }

      return alloc;
    });

    return allocation;
  }

  async getAvailableStock(styleId: string, colorId?: string, sizeId?: string) {
    const where: Prisma.finished_goods_stockWhereInput = { styleId };
    if (colorId) where.colorId = colorId;
    if (sizeId) where.sizeId = sizeId;

    const stocks = await prisma.finished_goods_stock.findMany({
      where,
      include: {
        color_options: { select: { id: true, colorName: true } },
        size_options: { select: { id: true, sizeName: true, sizeCode: true } },
        locations: { select: { id: true, locationName: true } },
        fg_stock_allocations: {
          where: { status: 'ALLOCATED' },
          select: { allocatedQty: true },
        },
      },
    });

    return stocks
      .map((stock) => {
        const allocatedQty = stock.fg_stock_allocations.reduce(
          (sum: number, a: { allocatedQty: number }) => sum + a.allocatedQty,
          0
        );
        return {
          ...stock,
          availableQty: stock.quantity - allocatedQty,
          allocatedQty,
        };
      })
      .filter((s) => s.availableQty > 0);
  }

  async search(params: { search?: string; limit?: number }) {
    const { search, limit = 50 } = params;

    const where: Prisma.sale_ordersWhereInput = { isActive: true };

    if (search) {
      where.OR = [
        { saleOrderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return prisma.sale_orders.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        saleOrderNumber: true,
        status: true,
        totalAmount: true,
        customer: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  private getDefaultIncludes() {
    return {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          billingAddress: true,
          shippingAddress: true,
          gstNumber: true,
        },
      },
      items: {
        include: {
          style: {
            select: { id: true, styleCode: true, styleName: true, imageUrl: true },
          },
          color: {
            select: { id: true, colorName: true, colorCode: true },
          },
          size: {
            select: { id: true, sizeName: true, sizeCode: true },
          },
          allocations: {
            include: {
              fgStock: {
                select: {
                  id: true,
                  quantity: true,
                  locations: { select: { id: true, locationName: true } },
                },
              },
            },
          },
        },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      approvedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      _count: {
        select: { items: true, delivery_notes: true, invoices: true },
      },
    };
  }
}

export const saleOrderService = new SaleOrderService();
