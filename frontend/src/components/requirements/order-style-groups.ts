/**
 * Requirements as label sets: Order → Style → Label → Size.
 *
 * MRP plans a sized label as one requirement per order size-breakup row — per COLOUR × size — so a two-colour
 * order lists XS twice. For ordering, a size is one line: rows of the same material within one order + style
 * are merged into one size row (it keeps every requirement, so selecting it selects them all). The size rows
 * are then grouped by label (lib/label-lines): base / SIZE_PENDING row first, sizes in size order.
 */
import { groupLabelLines, type GroupedLine } from '@/lib/label-lines';
import { requirementLabelKey } from '@/lib/label-line-keys';
import type { MaterialRequirement } from '@/types/mrp.types';

/** One material within one order + style: its requirements (one per colour) added up. */
export interface MergedRequirementRow {
  key: string;
  materialId: string;
  requirements: MaterialRequirement[];
  totalRequired: number;
  shortfall: number;
  unit: string;
  /** The first requirement — carries the label, size, material and order fields */
  head: MaterialRequirement;
}

export interface OrderStyleGroup {
  key: string;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string | null;
  styleId: string | null;
  styleCode: string | null;
  buyerStyleRef: string | null;
  styleName: string | null;
  lines: GroupedLine<MergedRequirementRow>[];
  requirements: MaterialRequirement[];
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function groupRequirementsByOrderStyle(requirements: readonly MaterialRequirement[]): OrderStyleGroup[] {
  const groups = new Map<string, { group: OrderStyleGroup; rows: Map<string, MergedRequirementRow> }>();
  for (const r of requirements) {
    const key = `${r.orderId ?? 'no-order'}|${r.orderItem?.styleId ?? 'no-style'}`;
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        group: {
          key,
          orderId: r.orderId,
          orderNumber: r.order?.orderNumber ?? null,
          customerName: r.order?.customerName ?? null,
          styleId: r.orderItem?.styleId ?? null,
          styleCode: r.orderItem?.styleCode ?? null,
          buyerStyleRef: r.orderItem?.buyerStyleRef ?? null,
          styleName: r.orderItem?.styleName ?? null,
          lines: [],
          requirements: [],
        },
        rows: new Map(),
      };
      groups.set(key, entry);
    }
    entry.group.requirements.push(r);
    const row = entry.rows.get(r.materialId);
    if (row) {
      row.requirements.push(r);
      row.totalRequired = round3(row.totalRequired + Number(r.totalRequired || 0));
      row.shortfall = round3(row.shortfall + Number(r.shortfall || 0));
    } else {
      entry.rows.set(r.materialId, {
        key: `${key}|${r.materialId}`,
        materialId: r.materialId,
        requirements: [r],
        totalRequired: round3(Number(r.totalRequired || 0)),
        shortfall: round3(Number(r.shortfall || 0)),
        unit: r.unit,
        head: r,
      });
    }
  }
  return [...groups.values()].map(({ group, rows }) => ({
    ...group,
    lines: groupLabelLines([...rows.values()], (row) => requirementLabelKey(row.head)),
  }));
}
