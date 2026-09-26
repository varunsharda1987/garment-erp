/**
 * Which label — and which size of it — a line's material is, so every list can group a label's sizes.
 *
 * A label bought in sizes has one materials row per size (`materials.labelId` = the label,
 * `label_size_variant.size` = the size) besides its base row (`labelId` set, no size). Requirements, PO lines,
 * GRN lines and the printed PO read the material through these selects and expose `{ label, size }`; the
 * grouping itself is `utils/label-lines.ts` (twin of `frontend/src/lib/label-lines.ts`).
 */

import type { Prisma } from '@prisma/client';

/**
 * A fixed order for a PO's lines: purchase_order_items has no line number or createdAt, so the database hands
 * them back in storage order, which is NOT the order they were written once rows have been deleted and their
 * space reused. Item code, then id — a label's size rows are then regrouped in size order by groupLabelLines.
 */
export const PO_LINE_ORDER: Prisma.purchase_order_itemsOrderByWithRelationInput[] = [
  { materials: { code: 'asc' } },
  { id: 'asc' },
];

/** Relations to add to a materials `include` (`materials: true` already brings `labelId`). */
export const LABEL_LINE_MATERIAL_INCLUDE = {
  label_master: { select: { id: true, labelCode: true, labelName: true, labelType: true, labelCategory: true } },
  label_size_variant: { select: { size: true } },
} as const;

/** The same, for a materials `select`. */
export const LABEL_LINE_MATERIAL_SELECT = { labelId: true, ...LABEL_LINE_MATERIAL_INCLUDE } as const;

export interface LabelLineInfo {
  label: { id: string; code: string; name: string; type: string | null; category: string | null } | null;
  size: string | null;
}

/** `{ label, size }` for a material read with one of the selects above (anything else → nulls). */
export function toLabelLine(material: any): LabelLineInfo {
  const lm = material?.label_master;
  return {
    label: lm
      ? {
          id: lm.id,
          code: lm.labelCode,
          name: lm.labelName,
          type: lm.labelType ?? null,
          category: lm.labelCategory ?? null,
        }
      : null,
    size: material?.label_size_variant?.size ?? null,
  };
}

/** The key `groupLabelLines` wants, for a material read with the selects above. */
export function labelLineKeyOf(material: any) {
  const { label, size } = toLabelLine(material);
  return label ? { labelId: label.id, code: label.code, name: label.name, type: label.type, size } : null;
}
