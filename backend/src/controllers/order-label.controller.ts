// Order Label Requirements Controller
// Calculates label requirements from order breakup and manages overrides

import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logInfo } from '../utils/logger';
import { NotFoundError } from '../errors';

// ============================================
// Types for Order Label Controller
// ============================================

interface SizeOverrideInput {
  size: string;
  barcodeValue?: string | null;
  mrp?: number | null;
}

interface CreateOverrideInput {
  styleMaterialBomId: string;
  extraPercentage?: number | null;
  notes?: string | null;
  sizeOverrides?: SizeOverrideInput[];
}

interface LabelRequirement {
  labelId: string;
  labelCode: string;
  labelName: string;
  labelCategory: string;
  labelType: string | null;
  componentName: string | null;
  extraPercentage: number;
  sizeRequirements: {
    size: string;
    baseQuantity: number;
    extraQuantity: number;
    totalQuantity: number;
    barcodeValue: string | null;
    mrp: number | null;
  }[];
  totalBaseQuantity: number;
  totalWithExtra: number;
  pricePerPiece: number | null;
  pricePerHundred: number | null;
  estimatedCost: number | null;
}

// ============================================
// Controller Functions
// ============================================

/**
 * Get label requirements for an order item
 * Calculates quantities from order breakup x (1 + extraPercentage/100)
 * GET /api/order-items/:orderItemId/label-requirements
 */
export const getOrderLabelRequirements = async (req: Request, res: Response): Promise<void> => {
  const { orderItemId } = req.params;

  // Get order item with style and breakup
  const orderItem = await prisma.order_items.findUnique({
    where: { id: orderItemId },
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          style_material_bom: {
            where: { isActive: true, materialType: 'LABEL' },
            include: {
              label_master: {
                select: {
                  id: true,
                  labelCode: true,
                  labelName: true,
                  labelCategory: true,
                  labelType: true,
                  pricePerPiece: true,
                  pricePerHundred: true,
                },
              },
              labelSizeConfigs: true,
            },
          },
        },
      },
      order_item_breakup: {
        select: {
          sizeId: true,
          quantity: true,
          size_options: {
            select: {
              sizeName: true,
            },
          },
        },
      },
      labelOverrides: {
        include: {
          sizeOverrides: true,
        },
      },
    },
  });

  if (!orderItem) {
    throw new NotFoundError('Order item', orderItemId);
  }

  // Build size quantities map from breakup
  const sizeQuantities = new Map<string, number>();
  for (const breakup of orderItem.order_item_breakup) {
    const sizeName = breakup.size_options?.sizeName || breakup.sizeId;
    sizeQuantities.set(sizeName, breakup.quantity);
  }

  // Build overrides map
  const overridesMap = new Map<
    string,
    {
      extraPercentage?: number | null;
      sizeOverrides: Map<string, { barcodeValue?: string | null; mrp?: number | null }>;
    }
  >();

  for (const override of orderItem.labelOverrides) {
    const sizeOverridesMap = new Map<string, { barcodeValue?: string | null; mrp?: number | null }>();
    for (const so of override.sizeOverrides) {
      sizeOverridesMap.set(so.size, {
        barcodeValue: so.barcodeValue,
        mrp: so.mrp ? Number(so.mrp) : null,
      });
    }
    overridesMap.set(override.styleMaterialBomId, {
      extraPercentage: override.extraPercentage != null ? Number(override.extraPercentage) : null,
      sizeOverrides: sizeOverridesMap,
    });
  }

  // Calculate requirements for each label
  const labelRequirements: LabelRequirement[] = [];

  for (const labelConfig of (orderItem.styles as any).style_material_bom) {
    // Get effective extra percentage (order override > style config)
    const orderOverride = overridesMap.get(labelConfig.id);
    const effectiveExtraPercent = orderOverride?.extraPercentage ?? Number(labelConfig.extraPercentage ?? 5);

    // Calculate size requirements
    const sizeRequirements: LabelRequirement['sizeRequirements'] = [];
    let totalBaseQuantity = 0;
    let totalWithExtra = 0;

    // Use sizes from breakup
    for (const [size, baseQty] of sizeQuantities) {
      const extraQty = Math.ceil(baseQty * (effectiveExtraPercent / 100));
      const totalQty = baseQty + extraQty;

      // Get barcode/MRP - order override > style config > null
      let barcodeValue: string | null = null;
      let mrp: number | null = null;

      // Check order-level override first
      const sizeOverride = orderOverride?.sizeOverrides.get(size);
      if (sizeOverride) {
        barcodeValue = sizeOverride.barcodeValue ?? null;
        mrp = sizeOverride.mrp ?? null;
      }

      // Fall back to style config if not overridden
      if (!barcodeValue || !mrp) {
        const styleConfig = labelConfig.labelSizeConfigs.find(
          (sc: (typeof labelConfig.labelSizeConfigs)[0]) => sc.size === size
        );
        if (styleConfig) {
          barcodeValue = barcodeValue ?? styleConfig.barcodeValue;
          mrp = mrp ?? (styleConfig.mrp ? Number(styleConfig.mrp) : null);
        }
      }

      sizeRequirements.push({
        size,
        baseQuantity: baseQty,
        extraQuantity: extraQty,
        totalQuantity: totalQty,
        barcodeValue,
        mrp,
      });

      totalBaseQuantity += baseQty;
      totalWithExtra += totalQty;
    }

    // Calculate estimated cost
    let estimatedCost: number | null = null;
    const pricePerPiece = labelConfig.label_master.pricePerPiece
      ? Number(labelConfig.label_master.pricePerPiece)
      : null;
    const pricePerHundred = labelConfig.label_master.pricePerHundred
      ? Number(labelConfig.label_master.pricePerHundred)
      : null;

    if (pricePerPiece) {
      estimatedCost = totalWithExtra * pricePerPiece;
    } else if (pricePerHundred) {
      estimatedCost = (totalWithExtra / 100) * pricePerHundred;
    }

    labelRequirements.push({
      labelId: labelConfig.label_master.id,
      labelCode: labelConfig.label_master.labelCode,
      labelName: labelConfig.label_master.labelName,
      labelCategory: labelConfig.label_master.labelCategory,
      labelType: labelConfig.label_master.labelType,
      componentName: labelConfig.componentName,
      extraPercentage: effectiveExtraPercent,
      sizeRequirements,
      totalBaseQuantity,
      totalWithExtra,
      pricePerPiece,
      pricePerHundred,
      estimatedCost,
    });
  }

  res.json({
    data: {
      orderItemId,
      styleId: orderItem.styles.id,
      styleCode: orderItem.styles.styleCode,
      styleName: orderItem.styles.styleName,
      breakup: Object.fromEntries(sizeQuantities),
      labelRequirements,
      summary: {
        totalLabels: labelRequirements.length,
        totalEstimatedCost: labelRequirements.reduce((sum, lr) => sum + (lr.estimatedCost || 0), 0),
      },
    },
  });
};

/**
 * Create or update label override for an order item
 * POST /api/order-items/:orderItemId/label-overrides
 */
export const createLabelOverride = async (req: Request, res: Response): Promise<void> => {
  const { orderItemId } = req.params;
  const { styleMaterialBomId, extraPercentage, notes, sizeOverrides = [] }: CreateOverrideInput = req.body;

  // Verify order item exists
  const orderItem = await prisma.order_items.findUnique({
    where: { id: orderItemId },
    select: { id: true },
  });

  if (!orderItem) {
    throw new NotFoundError('Order item', orderItemId);
  }

  // Verify style label config exists
  const styleMaterialBom = await prisma.style_material_bom.findUnique({
    where: { id: styleMaterialBomId },
    select: { id: true },
  });

  if (!styleMaterialBom) {
    throw new NotFoundError('Style label configuration', styleMaterialBomId);
  }

  // Check if override already exists
  const existingOverride = await prisma.order_label_override.findFirst({
    where: {
      orderItemId,
      styleMaterialBomId,
    },
  });

  let override;

  if (existingOverride) {
    // Update existing override
    // First delete existing size overrides
    await prisma.order_label_size_override.deleteMany({
      where: { orderLabelOverrideId: existingOverride.id },
    });

    override = await prisma.order_label_override.update({
      where: { id: existingOverride.id },
      data: {
        extraPercentage: extraPercentage ? new Prisma.Decimal(extraPercentage) : null,
        notes: notes || null,
        sizeOverrides: {
          create: sizeOverrides.map((so) => ({
            size: so.size,
            barcodeValue: so.barcodeValue || null,
            mrp: so.mrp ? new Prisma.Decimal(so.mrp) : null,
          })),
        },
      },
      include: {
        styleMaterialBom: {
          include: {
            label_master: {
              select: {
                id: true,
                labelCode: true,
                labelName: true,
                labelCategory: true,
              },
            },
          },
        },
        sizeOverrides: true,
      },
    });

    logInfo(`Label override ${existingOverride.id} updated for order item ${orderItemId}`);
  } else {
    // Create new override
    override = await prisma.order_label_override.create({
      data: {
        orderItemId,
        styleMaterialBomId,
        extraPercentage: extraPercentage ? new Prisma.Decimal(extraPercentage) : null,
        notes: notes || null,
        sizeOverrides: {
          create: sizeOverrides.map((so) => ({
            size: so.size,
            barcodeValue: so.barcodeValue || null,
            mrp: so.mrp ? new Prisma.Decimal(so.mrp) : null,
          })),
        },
      },
      include: {
        styleMaterialBom: {
          include: {
            label_master: {
              select: {
                id: true,
                labelCode: true,
                labelName: true,
                labelCategory: true,
              },
            },
          },
        },
        sizeOverrides: true,
      },
    });

    logInfo(`Label override created for order item ${orderItemId}, config ${styleMaterialBomId}`);
  }

  res.status(existingOverride ? 200 : 201).json({
    data: override,
    message: existingOverride ? 'Label override updated successfully' : 'Label override created successfully',
  });
};

/**
 * Get all label overrides for an order item
 * GET /api/order-items/:orderItemId/label-overrides
 */
export const getOrderLabelOverrides = async (req: Request, res: Response): Promise<void> => {
  const { orderItemId } = req.params;

  const overrides = await prisma.order_label_override.findMany({
    where: { orderItemId },
    include: {
      styleMaterialBom: {
        include: {
          label_master: {
            select: {
              id: true,
              labelCode: true,
              labelName: true,
              labelCategory: true,
              labelType: true,
            },
          },
        },
      },
      sizeOverrides: {
        orderBy: { size: 'asc' },
      },
    },
  });

  res.json({ data: overrides });
};

/**
 * Delete a label override
 * DELETE /api/order-label-overrides/:id
 */
export const deleteLabelOverride = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const override = await prisma.order_label_override.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!override) {
    throw new NotFoundError('Label override', id);
  }

  // Cascade delete will remove size overrides
  await prisma.order_label_override.delete({
    where: { id },
  });

  logInfo(`Label override ${id} deleted`);

  res.json({
    message: 'Label override deleted successfully',
  });
};

/**
 * Get label requirements summary for entire order
 * Aggregates all order items' label requirements
 * GET /api/orders/:orderId/label-requirements
 */
export const getOrderTotalLabelRequirements = async (req: Request, res: Response): Promise<void> => {
  const { orderId } = req.params;

  // Get order with all items and their label configs
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      order_items: {
        include: {
          styles: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
              style_material_bom: {
                where: { isActive: true, materialType: 'LABEL' },
                include: {
                  label_master: {
                    select: {
                      id: true,
                      labelCode: true,
                      labelName: true,
                      labelCategory: true,
                      labelType: true,
                      pricePerPiece: true,
                      pricePerHundred: true,
                    },
                  },
                  labelSizeConfigs: true,
                },
              },
            },
          },
          order_item_breakup: {
            select: {
              sizeId: true,
              quantity: true,
              size_options: {
                select: {
                  sizeName: true,
                },
              },
            },
          },
          labelOverrides: {
            include: {
              sizeOverrides: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  // Aggregate label requirements across all order items
  const aggregatedLabels = new Map<
    string,
    {
      labelId: string;
      labelCode: string;
      labelName: string;
      labelCategory: string;
      labelType: string | null;
      totalQuantity: number;
      sizeQuantities: Map<string, number>;
      pricePerPiece: number | null;
      pricePerHundred: number | null;
    }
  >();

  for (const orderItem of order.order_items) {
    // Build size quantities map from breakup
    const sizeQuantities = new Map<string, number>();
    for (const breakup of orderItem.order_item_breakup) {
      const sizeName = breakup.size_options?.sizeName || breakup.sizeId;
      sizeQuantities.set(sizeName, breakup.quantity);
    }

    // Build overrides map
    const overridesMap = new Map<string, { extraPercentage?: number | null }>();
    for (const override of orderItem.labelOverrides) {
      overridesMap.set(override.styleMaterialBomId, {
        extraPercentage: override.extraPercentage != null ? Number(override.extraPercentage) : null,
      });
    }

    // Process each label config
    for (const labelConfig of (orderItem.styles as any).style_material_bom) {
      const orderOverride = overridesMap.get(labelConfig.id);
      const effectiveExtraPercent = orderOverride?.extraPercentage ?? Number(labelConfig.extraPercentage ?? 5);

      // Calculate total with extra
      let itemTotalWithExtra = 0;
      const itemSizeQuantities = new Map<string, number>();

      for (const [size, baseQty] of sizeQuantities) {
        const extraQty = Math.ceil(baseQty * (effectiveExtraPercent / 100));
        const totalQty = baseQty + extraQty;
        itemTotalWithExtra += totalQty;
        itemSizeQuantities.set(size, totalQty);
      }

      // Aggregate
      const labelKey = labelConfig.label_master.id;
      const existing = aggregatedLabels.get(labelKey);

      if (existing) {
        existing.totalQuantity += itemTotalWithExtra;
        for (const [size, qty] of itemSizeQuantities) {
          existing.sizeQuantities.set(size, (existing.sizeQuantities.get(size) || 0) + qty);
        }
      } else {
        aggregatedLabels.set(labelKey, {
          labelId: labelConfig.label_master.id,
          labelCode: labelConfig.label_master.labelCode,
          labelName: labelConfig.label_master.labelName,
          labelCategory: labelConfig.label_master.labelCategory,
          labelType: labelConfig.label_master.labelType,
          totalQuantity: itemTotalWithExtra,
          sizeQuantities: itemSizeQuantities,
          pricePerPiece: labelConfig.label_master.pricePerPiece ? Number(labelConfig.label_master.pricePerPiece) : null,
          pricePerHundred: labelConfig.label_master.pricePerHundred
            ? Number(labelConfig.label_master.pricePerHundred)
            : null,
        });
      }
    }
  }

  // Convert to array and calculate costs
  const labelSummary = Array.from(aggregatedLabels.values()).map((label) => {
    let estimatedCost: number | null = null;
    if (label.pricePerPiece) {
      estimatedCost = label.totalQuantity * label.pricePerPiece;
    } else if (label.pricePerHundred) {
      estimatedCost = (label.totalQuantity / 100) * label.pricePerHundred;
    }

    return {
      labelId: label.labelId,
      labelCode: label.labelCode,
      labelName: label.labelName,
      labelCategory: label.labelCategory,
      labelType: label.labelType,
      totalQuantity: label.totalQuantity,
      sizeBreakdown: Object.fromEntries(label.sizeQuantities),
      pricePerPiece: label.pricePerPiece,
      pricePerHundred: label.pricePerHundred,
      estimatedCost,
    };
  });

  res.json({
    data: {
      orderId,
      orderNumber: order.orderNumber,
      orderItemCount: order.order_items.length,
      labelSummary,
      grandTotal: {
        totalLabelTypes: labelSummary.length,
        totalLabelPieces: labelSummary.reduce((sum, l) => sum + l.totalQuantity, 0),
        totalEstimatedCost: labelSummary.reduce((sum, l) => sum + (l.estimatedCost || 0), 0),
      },
    },
  });
};
