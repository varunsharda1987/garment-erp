/**
 * Label lines, grouped — a label's sizes under one heading, in size order.
 *
 * A label bought in sizes is one materials row per size (`LBL-0004-XS` …, `materials.labelId` = the label),
 * so every list of lines — requirements, PO lines, GRN lines, the printed PO — held it as N loose rows in
 * whatever order they were written. `groupLabelLines` gives every such list the same shape: a heading per
 * label and its rows beneath, the label's base (unsized) row first and then its sizes by `compareSizes`
 * (the one size-order rule). Anything that is not a label stays a single line where it was.
 *
 * Grouping is display and ordering only — every row keeps its own quantity, rate and id, and `index` is the
 * row's position in the input so index-based updaters keep working.
 *
 * This file is identical to its twin (`frontend/src/lib/label-lines.ts` ⇄ `backend/src/utils/label-lines.ts`)
 * except for the `compareSizes` import line; a backend unit test asserts it.
 */
import { compareSizes } from '@/utils/sku-generator';

export interface LabelLineKey {
  labelId: string;
  code: string;
  name: string;
  type?: string | null;
  /** The size this line is for; null for the label's base (unsized) row */
  size: string | null;
}

export interface LabelGroupRow<T> {
  line: T;
  /** Position of this line in the input */
  index: number;
  size: string | null;
}

export interface LabelGroup<T> {
  kind: 'label';
  key: string;
  labelId: string;
  code: string;
  name: string;
  type: string | null;
  rows: LabelGroupRow<T>[];
}

export interface SingleLine<T> {
  kind: 'single';
  key: string;
  line: T;
  index: number;
  label: LabelLineKey | null;
}

export type GroupedLine<T> = LabelGroup<T> | SingleLine<T>;

/**
 * Group a list of lines by label. A label becomes a group when any of its lines is for a size, or when it
 * has two lines or more; a lone unsized label line stays single. A group sits where its first line was.
 */
export function groupLabelLines<T>(lines: readonly T[], labelOf: (line: T) => LabelLineKey | null): GroupedLine<T>[] {
  const keys = lines.map(labelOf);
  const lineCount = new Map<string, number>();
  const sized = new Set<string>();
  for (const key of keys) {
    if (!key) continue;
    lineCount.set(key.labelId, (lineCount.get(key.labelId) ?? 0) + 1);
    if (key.size) sized.add(key.labelId);
  }
  const isGroup = (labelId: string) => sized.has(labelId) || (lineCount.get(labelId) ?? 0) > 1;

  const out: GroupedLine<T>[] = [];
  const groups = new Map<string, LabelGroup<T>>();
  lines.forEach((line, index) => {
    const key = keys[index];
    if (!key || !isGroup(key.labelId)) {
      out.push({ kind: 'single', key: `line-${index}`, line, index, label: key });
      return;
    }
    let group = groups.get(key.labelId);
    if (!group) {
      group = {
        kind: 'label',
        key: `label-${key.labelId}`,
        labelId: key.labelId,
        code: key.code,
        name: key.name,
        type: key.type ?? null,
        rows: [],
      };
      groups.set(key.labelId, group);
      out.push(group);
    }
    group.rows.push({ line, index, size: key.size });
  });

  // The base (unsized) row first, then sizes in size order; equal sizes keep their input order (stable sort)
  for (const group of groups.values()) {
    group.rows.sort((a, b) => {
      if (a.size === null || b.size === null) return a.size === b.size ? 0 : a.size === null ? -1 : 1;
      return compareSizes(a.size, b.size);
    });
  }
  return out;
}

/** The lines in grouped order: each label's rows together, sizes in order. */
export function flattenGroups<T>(groups: readonly GroupedLine<T>[]): T[] {
  return groups.flatMap((g) => (g.kind === 'label' ? g.rows.map((r) => r.line) : [g.line]));
}

/** Sum of a figure over a group's rows, to 3 decimals — for a heading's total. */
export function sumRows<T>(rows: readonly LabelGroupRow<T>[], pick: (line: T) => number): number {
  const total = rows.reduce((sum, r) => sum + (Number(pick(r.line)) || 0), 0);
  return Math.round(total * 1000) / 1000;
}
