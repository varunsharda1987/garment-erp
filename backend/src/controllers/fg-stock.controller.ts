import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';

/**
 * @route GET /api/fg-stock
 * @desc Get all finished goods stock with filters and pagination
 * @access Private
 */
export const getAllFGStock = async (req: Request, res: Response) => {
  const { page = 1, limit = 20, search, styleId, colorId, sizeId, locationId, workOrderId } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Prisma.finished_goods_stockWhereInput = {};

  if (search) {
    where.OR = [
      { styles: { styleCode: { contains: String(search), mode: 'insensitive' } } },
      { styles: { styleName: { contains: String(search), mode: 'insensitive' } } },
      { styles: { buyerStyleRef: { contains: String(search), mode: 'insensitive' } } },
      { color_options: { colorName: { contains: String(search), mode: 'insensitive' } } },
      { size_options: { sizeName: { contains: String(search), mode: 'insensitive' } } },
      { work_orders: { workOrderNumber: { contains: String(search), mode: 'insensitive' } } },
    ];
  }

  if (styleId) where.styleId = String(styleId);
  if (colorId) where.colorId = String(colorId);
  if (sizeId) where.sizeId = String(sizeId);
  if (locationId) where.locationId = String(locationId);
  if (workOrderId) where.workOrderId = String(workOrderId);

  const [items, total] = await Promise.all([
    prisma.finished_goods_stock.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { lastUpdated: 'desc' },
      include: {
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
            buyerStyleRef: true,
          },
        },
        color_options: {
          select: {
            id: true,
            colorCode: true,
            colorName: true,
          },
        },
        size_options: {
          select: {
            id: true,
            sizeName: true,
            sortOrder: true,
          },
        },
        locations: {
          select: {
            id: true,
            locationCode: true,
            locationName: true,
          },
        },
        work_orders: {
          select: {
            id: true,
            workOrderNumber: true,
          },
        },
        style_variants: {
          select: {
            id: true,
            sku: true,
          },
        },
      },
    }),
    prisma.finished_goods_stock.count({ where }),
  ]);

  // Transform to camelCase for frontend
  const data = items.map((item: any) => ({
    id: item.id,
    styleId: item.styleId,
    colorId: item.colorId,
    sizeId: item.sizeId,
    variantId: item.variantId,
    quantity: item.quantity,
    locationId: item.locationId,
    workOrderId: item.workOrderId,
    receivedDate: item.receivedDate,
    lastUpdated: item.lastUpdated,
    style: item.styles,
    color: item.color_options,
    size: item.size_options,
    location: item.locations
      ? {
          id: item.locations.id,
          code: item.locations.locationCode,
          name: item.locations.locationName,
        }
      : null,
    workOrder: item.work_orders,
    variant: item.style_variants
      ? {
          id: item.style_variants.id,
          sku: item.style_variants.sku,
        }
      : null,
  }));

  res.json({
    data,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
};

/**
 * @route GET /api/fg-stock/summary
 * @desc Get FG stock summary by style (aggregated across colors/sizes)
 * @access Private
 */
export const getFGStockSummary = async (req: Request, res: Response) => {
  const { search, locationId } = req.query;

  const where: Prisma.finished_goods_stockWhereInput = {};

  if (search) {
    where.OR = [
      { styles: { styleCode: { contains: String(search), mode: 'insensitive' } } },
      { styles: { styleName: { contains: String(search), mode: 'insensitive' } } },
      { styles: { buyerStyleRef: { contains: String(search), mode: 'insensitive' } } },
    ];
  }

  if (locationId) where.locationId = String(locationId);

  // Group by style
  const grouped = await prisma.finished_goods_stock.groupBy({
    by: ['styleId'],
    where,
    _sum: { quantity: true },
    _count: { id: true },
  });

  // Get style details
  const styleIds = grouped.map((g) => g.styleId);
  const styles = await prisma.styles.findMany({
    where: { id: { in: styleIds } },
    select: {
      id: true,
      styleCode: true,
      styleName: true,
      buyerStyleRef: true,
    },
  });

  const styleMap = new Map(styles.map((s) => [s.id, s]));

  const data = grouped.map((g) => ({
    styleId: g.styleId,
    style: styleMap.get(g.styleId),
    totalQuantity: g._sum.quantity || 0,
    skuCount: g._count.id,
  }));

  res.json({ data });
};

/**
 * @route GET /api/fg-stock/:id
 * @desc Get single FG stock item by ID
 * @access Private
 */
export const getFGStockById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const item = await prisma.finished_goods_stock.findUnique({
    where: { id },
    include: {
      styles: true,
      color_options: true,
      size_options: true,
      locations: true,
      work_orders: true,
      style_variants: true,
      fg_stock_allocations: {
        where: { status: 'ALLOCATED' },
        include: {
          saleOrderItem: {
            include: {
              saleOrder: true,
            },
          },
        },
      },
    },
  });

  if (!item) {
    return res.status(404).json({ message: 'FG stock item not found' });
  }

  const typedItem = item as any;

  res.json({
    data: {
      id: typedItem.id,
      styleId: typedItem.styleId,
      colorId: typedItem.colorId,
      sizeId: typedItem.sizeId,
      variantId: typedItem.variantId,
      quantity: typedItem.quantity,
      locationId: typedItem.locationId,
      workOrderId: typedItem.workOrderId,
      receivedDate: typedItem.receivedDate,
      lastUpdated: typedItem.lastUpdated,
      style: typedItem.styles,
      color: typedItem.color_options,
      size: typedItem.size_options,
      location: typedItem.locations
        ? {
            id: typedItem.locations.id,
            code: typedItem.locations.locationCode,
            name: typedItem.locations.locationName,
          }
        : null,
      workOrder: typedItem.work_orders,
      variant: typedItem.style_variants
        ? {
            id: typedItem.style_variants.id,
            sku: typedItem.style_variants.sku,
          }
        : null,
      allocations: typedItem.fg_stock_allocations.map((a: any) => ({
        id: a.id,
        allocatedQty: a.allocatedQty,
        status: a.status,
        allocatedAt: a.allocatedAt,
        saleOrder: a.saleOrderItem?.saleOrder
          ? {
              id: a.saleOrderItem.saleOrder.id,
              orderNumber: a.saleOrderItem.saleOrder.orderNumber,
            }
          : null,
      })),
    },
  });
};
