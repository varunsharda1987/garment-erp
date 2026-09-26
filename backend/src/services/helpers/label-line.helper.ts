/**
 * Which label — and which size of it — a line's material is, so every list can group a label's sizes.
 *
 * A label bought in sizes has one materials row per size (`materials.labelId` = the label,
 * `label_size_variant.size` = the size) besides its base row (`labelId` set, no size). Requirements, PO lines,
 * GRN lines and the printed PO read the material through these selects and expose `{ label, size }`; the
 * grouping itself is `utils/label-lines.ts` (twin of `frontend/src/lib/label-lines.ts`).
 */

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
