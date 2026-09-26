/**
 * A style's label set — every label on its BOM, each with its sizes — for ordering them together.
 *
 * There is no "label set" table: a style's set is its active LABEL lines in `style_material_bom` (copied once
 * from the customer's accessory preset), and each sized label has one materials row per size
 * (`label_size_variants.id` = that row's id). With an order, the garments per size come from the order's size
 * breakup (summed across colours, matched to label sizes case-insensitively as MRP does), and the labels per
 * garment and extra % from the order's approved BOM; without one, from the style BOM + the trim default extra %
 * — the rule the Order BOM itself uses (order-bom.service `wastagePercent`).
 *
 * The PO form's "Order label set" dialog reads this; ordering from planned requirements (which also links
 * the PO to them) is the Requirements page's By Order & Style view.
 */

import prisma from '../config/database';
import { NotFoundError } from '../errors';
import { compareSizes } from '../utils/sku-generator';
import { systemSettingsService } from './system-settings.service';

export interface LabelSetSize {
  size: string;
  sizeVariantId: string;
  /** The size's materials row (its id is the variant's); null if it was never created */
  materialId: string | null;
  /** Garments of this size on the linked order (null without an order) */
  orderGarments: number | null;
}

export interface LabelSetLabel {
  bomLineId: string;
  labelId: string;
  code: string;
  name: string;
  type: string | null;
  category: string | null;
  quantityPerGarment: number;
  extraPercent: number;
  /** The label's base materials row (its id is the label's) — what an unsized label is ordered as */
  baseMaterialId: string | null;
  /** Sizes in size order; empty for an unsized label */
  sizes: LabelSetSize[];
  /** Order sizes this sized label has no size for (MRP skips them the same way) */
  orderSizesMissing: string[];
  supplierLinks: Array<{ supplierId: string; supplierName: string; isPreferred: boolean }>;
  /** Open requirements for this label on the linked order + style (PO_REQUIRED / PARTIAL_STOCK / SIZE_PENDING) */
  openRequirementCount: number;
}

export interface StyleLabelSet {
  styleId: string;
  styleCode: string;
  styleName: string | null;
  /** Where labels per garment and extra % came from */
  source: 'ORDER_BOM' | 'STYLE_BOM';
  orderBom: { id: string; version: number; status: string } | null;
  order: {
    id: string;
    orderNumber: string;
    hasStyle: boolean;
    hasSizeBreakup: boolean;
    totalGarments: number;
    sizes: Array<{ size: string; garments: number }>;
  } | null;
  labels: LabelSetLabel[];
}

const OPEN_STATUSES = ['PO_REQUIRED', 'PARTIAL_STOCK', 'SIZE_PENDING'] as const;

export async function getStyleLabelSet(styleId: string, orderId?: string): Promise<StyleLabelSet> {
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    select: { id: true, styleCode: true, styleName: true },
  });
  if (!style) throw new NotFoundError('Style', styleId);

  const bomLines = await prisma.style_material_bom.findMany({
    where: { styleId, isActive: true, labelId: { not: null } },
    orderBy: [{ usageCategory: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      labelId: true,
      quantityPerGarment: true,
      extraPercentage: true,
      label_master: {
        select: {
          id: true,
          labelCode: true,
          labelName: true,
          labelType: true,
          labelCategory: true,
          sizeVariants: {
            where: { isActive: true },
            select: { id: true, size: true, material: { select: { id: true } } },
          },
          labelSuppliers: {
            where: { isActive: true },
            select: { supplierId: true, isPreferred: true, supplier: { select: { name: true } } },
            orderBy: [{ isPreferred: 'desc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  });
  // One line per label (the Style form never saves a label twice; be safe anyway)
  const lines = bomLines.filter((l, i) => l.label_master && bomLines.findIndex((x) => x.labelId === l.labelId) === i);
  const labelIds = lines.map((l) => l.labelId!);

  const baseRows = await prisma.materials.findMany({ where: { id: { in: labelIds } }, select: { id: true } });
  const hasBaseRow = new Set(baseRows.map((r) => r.id));

  // ── Order: garments per size, the order BOM, open requirements ─────────────
  let order: StyleLabelSet['order'] = null;
  let orderBom: StyleLabelSet['orderBom'] = null;
  const orderBomLine = new Map<string, { quantityPerGarment: number; wastagePercent: number }>();
  const orderSizes = new Map<string, { size: string; garments: number }>(); // key: lower-cased size
  const openCount = new Map<string, number>();

  if (orderId) {
    const o = await prisma.orders.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true } });
    if (!o) throw new NotFoundError('Order', orderId);
    const items = await prisma.order_items.findMany({
      where: { orderId, styleId },
      select: {
        totalQuantity: true,
        order_item_breakup: { select: { quantity: true, size_options: { select: { sizeName: true } } } },
      },
    });
    for (const item of items) {
      for (const b of item.order_item_breakup) {
        const name = b.size_options?.sizeName?.trim();
        if (!name || !(b.quantity > 0)) continue;
        const key = name.toLowerCase();
        const entry = orderSizes.get(key) ?? { size: name, garments: 0 };
        entry.garments += b.quantity;
        orderSizes.set(key, entry);
      }
    }
    order = {
      id: o.id,
      orderNumber: o.orderNumber,
      hasStyle: items.length > 0,
      hasSizeBreakup: orderSizes.size > 0,
      totalGarments: items.reduce((sum, i) => sum + (i.totalQuantity || 0), 0),
      sizes: [...orderSizes.values()].sort((a, b) => compareSizes(a.size, b.size)),
    };

    // The BOM MRP plans from: approved or locked, highest version
    const bom = await prisma.order_bom.findFirst({
      where: { orderId, styleId, status: { in: ['APPROVED', 'LOCKED'] } },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        status: true,
        items: {
          where: { labelId: { in: labelIds } },
          select: { labelId: true, quantityPerGarment: true, wastagePercent: true },
        },
      },
    });
    if (bom) {
      orderBom = { id: bom.id, version: bom.version, status: bom.status };
      for (const it of bom.items) {
        if (it.labelId && !orderBomLine.has(it.labelId)) {
          orderBomLine.set(it.labelId, {
            quantityPerGarment: Number(it.quantityPerGarment),
            wastagePercent: Number(it.wastagePercent ?? 0),
          });
        }
      }
    }

    const open = await prisma.material_requirements.findMany({
      where: {
        orderId,
        order_items: { styleId },
        status: { in: [...OPEN_STATUSES] },
        materials: { labelId: { in: labelIds } },
      },
      select: { materials: { select: { labelId: true } } },
    });
    for (const r of open) {
      const id = r.materials?.labelId;
      if (id) openCount.set(id, (openCount.get(id) ?? 0) + 1);
    }
  }

  const defaultExtra = await systemSettingsService.getNumberDefault('TRIM_DEFAULT_WASTAGE_PERCENT');

  const labels: LabelSetLabel[] = lines.map((line) => {
    const lm = line.label_master!;
    const fromOrderBom = orderBomLine.get(lm.id);
    const sizes: LabelSetSize[] = lm.sizeVariants
      .map((v) => ({
        size: v.size,
        sizeVariantId: v.id,
        materialId: v.material?.id ?? null,
        orderGarments: order ? (orderSizes.get(v.size.trim().toLowerCase())?.garments ?? 0) : null,
      }))
      .sort((a, b) => compareSizes(a.size, b.size));
    const labelSizeKeys = new Set(sizes.map((s) => s.size.trim().toLowerCase()));
    return {
      bomLineId: line.id,
      labelId: lm.id,
      code: lm.labelCode,
      name: lm.labelName,
      type: lm.labelType ?? null,
      category: lm.labelCategory ?? null,
      quantityPerGarment: fromOrderBom?.quantityPerGarment ?? Number(line.quantityPerGarment),
      extraPercent:
        fromOrderBom?.wastagePercent ?? (line.extraPercentage != null ? Number(line.extraPercentage) : defaultExtra),
      baseMaterialId: hasBaseRow.has(lm.id) ? lm.id : null,
      sizes,
      orderSizesMissing:
        sizes.length > 0
          ? [...orderSizes.entries()].filter(([key]) => !labelSizeKeys.has(key)).map(([, s]) => s.size)
          : [],
      supplierLinks: lm.labelSuppliers.map((s) => ({
        supplierId: s.supplierId,
        supplierName: s.supplier.name,
        isPreferred: s.isPreferred,
      })),
      openRequirementCount: openCount.get(lm.id) ?? 0,
    };
  });

  return {
    styleId: style.id,
    styleCode: style.styleCode,
    styleName: style.styleName ?? null,
    source: orderBom ? 'ORDER_BOM' : 'STYLE_BOM',
    orderBom,
    order,
    labels,
  };
}
