import prisma from '../config/database';
import { Prisma, SaleOrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';

interface SOCreateInput {
  customerId: string;
  styleId?: string | null; // Primary style for the order
  expectedShipDate?: Date | null;
  buyerDeadline?: Date | null; // Buyer's required completion date
  orderDate?: Date | null; // Buyer's PO/order date
  deliveryDate?: Date | null; // Agreed delivery date
  paymentTerms?: string | null;
  deliveryAddress?: string | null;
  remarks?: string;
  createdById: string;
  items: Array<{
    styleId: string;
    colorId?: string | null;
    sizeId: string;
    quantity: number;
    unitPrice: number;
    remarks?: string;
  }>;
}

interface SOUpdateInput {
  customerId?: string; // BUG-ORD5 fix: Allow changing customer on draft orders
  styleId?: string | null; // Primary style for the order
  expectedShipDate?: Date | null;
  buyerDeadline?: Date | null; // Buyer's required completion date
  orderDate?: Date | null; // Buyer's PO/order date (undefined = leave unchanged)
  deliveryDate?: Date | null;
  paymentTerms?: string | null;
  deliveryAddress?: string | null;
  remarks?: string;
  items?: Array<{
    styleId: string;
    colorId?: string | null;
    sizeId: string;
    quantity: number;
    unitPrice: number;
    remarks?: string;
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
        styleId: data.styleId || null,
        expectedShipDate: data.expectedShipDate || null,
        buyerDeadline: data.buyerDeadline || null,
        orderDate: data.orderDate ?? null,
        deliveryDate: data.deliveryDate ?? null,
        paymentTerms: data.paymentTerms ?? null,
        deliveryAddress: data.deliveryAddress ?? null,
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
            // BUG-ORD5 fix: Include customerId in update
            ...(data.customerId && { customerId: data.customerId }),
            styleId: data.styleId,
            expectedShipDate: data.expectedShipDate,
            buyerDeadline: data.buyerDeadline,
            // undefined = leave unchanged (ERP form and B2B don't always send these)
            orderDate: data.orderDate,
            deliveryDate: data.deliveryDate,
            paymentTerms: data.paymentTerms,
            deliveryAddress: data.deliveryAddress,
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
          // BUG-ORD5 fix: Include customerId in update
          ...(data.customerId && { customerId: data.customerId }),
          styleId: data.styleId,
          expectedShipDate: data.expectedShipDate,
          buyerDeadline: data.buyerDeadline,
          // undefined = leave unchanged (ERP form and B2B don't always send these)
          orderDate: data.orderDate,
          deliveryDate: data.deliveryDate,
          paymentTerms: data.paymentTerms,
          deliveryAddress: data.deliveryAddress,
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

    return prisma.$transaction(async (tx) => {
      // P7.2.2: Release any allocations before delete (defensive — DRAFT shouldn't have allocations)
      const items = await tx.sale_order_items.findMany({
        where: { saleOrderId: id },
        select: { id: true },
      });
      const itemIds = items.map((i) => i.id);

      if (itemIds.length > 0) {
        await tx.fg_stock_allocations.updateMany({
          where: {
            saleOrderItemId: { in: itemIds },
            status: 'ALLOCATED',
          },
          data: { status: 'RELEASED' },
        });
      }

      return tx.sale_orders.delete({ where: { id } });
    });
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

  /**
   * Cancel a sale order and release all FG stock allocations.
   * P7.2: Allocation lifecycle — allocations must not stay permanent phantoms.
   */
  async cancel(id: string) {
    const so = await prisma.sale_orders.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!so) throw new Error('Sale Order not found');

    const terminalStatuses: SaleOrderStatus[] = [SaleOrderStatus.DELIVERED, SaleOrderStatus.CANCELLED];
    if (terminalStatuses.includes(so.status as SaleOrderStatus)) {
      throw new Error(`Cannot cancel sale order in ${so.status} status`);
    }

    return prisma.$transaction(async (tx) => {
      // Get all allocations for this sale order's items
      const items = await tx.sale_order_items.findMany({
        where: { saleOrderId: id },
        select: { id: true },
      });

      const itemIds = items.map((i) => i.id);

      // Release all ALLOCATED allocations back to FG stock
      const allocations = await tx.fg_stock_allocations.findMany({
        where: {
          saleOrderItemId: { in: itemIds },
          status: 'ALLOCATED',
        },
      });

      for (const alloc of allocations) {
        // Mark allocation as RELEASED (not deleted, for audit trail)
        await tx.fg_stock_allocations.update({
          where: { id: alloc.id },
          data: { status: 'RELEASED' },
        });
      }

      // Reset allocatedQty on sale order items
      await tx.sale_order_items.updateMany({
        where: { saleOrderId: id },
        data: { allocatedQty: 0 },
      });

      // Update sale order status to CANCELLED
      return tx.sale_orders.update({
        where: { id },
        data: { status: SaleOrderStatus.CANCELLED },
        include: this.getDefaultIncludes(),
      });
    });
  }

  /**
   * Deallocate (release) a specific FG stock allocation.
   * P7.2: Allows partial deallocation when stock needs to go elsewhere.
   */
  async deallocateStock(allocationId: string) {
    const allocation = await prisma.fg_stock_allocations.findUnique({
      where: { id: allocationId },
      include: {
        saleOrderItem: { select: { id: true, saleOrderId: true } },
      },
    });

    if (!allocation) throw new Error('Allocation not found');
    if (allocation.status !== 'ALLOCATED') {
      throw new Error(`Cannot deallocate — allocation is ${allocation.status}`);
    }

    return prisma.$transaction(async (tx) => {
      // Mark allocation as RELEASED
      await tx.fg_stock_allocations.update({
        where: { id: allocationId },
        data: { status: 'RELEASED' },
      });

      // Decrement allocatedQty on the sale order item
      await tx.sale_order_items.update({
        where: { id: allocation.saleOrderItemId },
        data: { allocatedQty: { decrement: allocation.allocatedQty } },
      });

      // Recompute sale order status
      const soItem = allocation.saleOrderItem;
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
        } else {
          newStatus = SaleOrderStatus.CONFIRMED;
        }

        await tx.sale_orders.update({
          where: { id: soItem.saleOrderId },
          data: { status: newStatus },
        });
      }

      return { success: true };
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

  /**
   * Get stock preview for a sale order before confirmation.
   * Shows FG stock availability for each item + style readiness for items needing production.
   */
  async getStockPreview(saleOrderId: string) {
    const so = await prisma.sale_orders.findUnique({
      where: { id: saleOrderId },
      include: {
        items: {
          include: {
            style: {
              select: {
                id: true,
                styleCode: true,
                buyerStyleRef: true,
                styleName: true,
                status: true,
                _count: {
                  select: {
                    style_components: true,
                    size_options: true,
                    style_variants: true,
                  },
                },
              },
            },
            color: { select: { id: true, colorName: true } },
            size: { select: { id: true, sizeName: true, sizeCode: true } },
          },
        },
      },
    });

    if (!so) throw new Error('Sale Order not found');

    // Build item previews with stock availability and style readiness
    const itemPreviews = await Promise.all(
      so.items.map(async (item) => {
        // Get available FG stock for this item
        const stocks = await this.getAvailableStock(item.styleId, item.colorId || undefined, item.sizeId);
        const totalAvailable = stocks.reduce((sum, s) => sum + s.availableQty, 0);
        const availableQty = Math.min(totalAvailable, item.quantity);
        const shortfall = Math.max(0, item.quantity - totalAvailable);

        const status: 'FULL' | 'PARTIAL' | 'NONE' =
          totalAvailable >= item.quantity ? 'FULL' : totalAvailable > 0 ? 'PARTIAL' : 'NONE';

        // For items needing production, check style readiness
        let styleReadiness:
          | {
              status: string;
              hasComponents: boolean;
              hasFabrics: boolean;
              hasSizes: boolean;
              hasVariants: boolean;
              isReady: boolean;
              missingSteps: string[];
            }
          | undefined;

        if (status !== 'FULL' && item.style) {
          // Check if style has fabrics (via style_components -> style_fabrics)
          const fabricCount = await prisma.style_fabrics.count({
            where: {
              style_components: { styleId: item.styleId },
            },
          });

          const hasComponents = (item.style._count?.style_components || 0) > 0;
          const hasFabrics = fabricCount > 0;
          const hasSizes = (item.style._count?.size_options || 0) > 0;
          const hasVariants = (item.style._count?.style_variants || 0) > 0;
          // StyleStatus enum: DRAFT, ACTIVE, ARCHIVED - ACTIVE means ready for production
          const isActive = item.style.status === 'ACTIVE';

          const missingSteps: string[] = [];
          if (!isActive) missingSteps.push('Activate style');
          if (!hasComponents) missingSteps.push('Add components');
          if (!hasFabrics) missingSteps.push('Assign fabrics');
          if (!hasSizes) missingSteps.push('Define sizes');
          if (!hasVariants) missingSteps.push('Create SKU variants');

          styleReadiness = {
            status: item.style.status,
            hasComponents,
            hasFabrics,
            hasSizes,
            hasVariants,
            isReady: missingSteps.length === 0,
            missingSteps,
          };
        }

        return {
          id: item.id,
          style: item.style
            ? {
                id: item.style.id,
                styleCode: item.style.styleCode,
                buyerStyleRef: item.style.buyerStyleRef ?? null,
                styleName: item.style.styleName,
              }
            : null,
          color: item.color,
          size: item.size,
          orderedQty: item.quantity,
          availableQty,
          shortfall,
          status,
          styleReadiness,
        };
      })
    );

    // Calculate summary
    const summary = {
      itemsWithStock: itemPreviews.filter((i) => i.status === 'FULL').length,
      itemsPartialStock: itemPreviews.filter((i) => i.status === 'PARTIAL').length,
      itemsNoStock: itemPreviews.filter((i) => i.status === 'NONE').length,
      quantityAvailable: itemPreviews.reduce((sum, i) => sum + i.availableQty, 0),
      quantityNeedsProduction: itemPreviews.reduce((sum, i) => sum + i.shortfall, 0),
    };

    // Determine recommended action
    let recommendedAction: 'ALLOCATE_ALL' | 'START_PRODUCTION' | 'MIXED';
    if (summary.itemsNoStock === 0 && summary.itemsPartialStock === 0) {
      recommendedAction = 'ALLOCATE_ALL';
    } else if (summary.itemsWithStock === 0 && summary.itemsPartialStock === 0) {
      recommendedAction = 'START_PRODUCTION';
    } else {
      recommendedAction = 'MIXED';
    }

    return {
      saleOrderId: so.id,
      saleOrderNumber: so.saleOrderNumber,
      totalItems: so.items.length,
      totalQuantity: so.items.reduce((sum, i) => sum + i.quantity, 0),
      summary,
      items: itemPreviews,
      recommendedAction,
    };
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
      style: {
        select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true, imageUrl: true },
      },
      items: {
        include: {
          style: {
            select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true, imageUrl: true },
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
