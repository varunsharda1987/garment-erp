/**
 * BOM version lineage — which line of the order's previous BOM each line of a new BOM replaces
 * (order_bom_items.previousItemId, 2026-09-26).
 *
 * Every BOM rebuild (new cost-sheet version, change of width, copy from another order) gives every line a
 * new id. MRP matched existing requirements to BOM lines by that id, so after a rebuild it could not find
 * them: open ones were cancelled and re-created under new numbers (their stock reservations stranded),
 * and PO-linked ones were kept while a FULL new requirement was created beside them. With the lineage,
 * MRP reconciles a line's requirements through previousItemId instead.
 *
 * The ancestor BOM is the order item's latest APPROVED/LOCKED BOM — a draft never produced requirements —
 * and never another order's (a BOM copied from another order is matched to THIS order's previous BOM).
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { GENERIC_TRIM_FK_FIELDS } from '../../schemas/orderBom.schema';

type Db = PrismaClient | Prisma.TransactionClient;

/** The fields of a BOM line the matcher reads */
export interface LineageLine {
  id: string;
  materialType: string;
  selectedCadId?: string | null;
  /** fabric_width_cad.styleFabricId of the selected CAD — the "slot" that survives a greige/width change */
  cadSlot?: string | null;
  greigeId?: string | null;
  fabricId?: string | null;
  laceId?: string | null;
  greigeLaceId?: string | null;
  materialId?: string | null;
  colorName?: string | null;
  componentName?: string | null;
  sortOrder?: number | null;
  [key: string]: unknown;
}

const TRIM_FKS = ['buttonId', 'threadId', 'zipperId', 'elasticId', 'labelId', 'packagingId', ...GENERIC_TRIM_FK_FIELDS];

const norm = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
const same = (a: unknown, b: unknown) => norm(a) !== null && norm(a) === norm(b);
const sameOrBothEmpty = (a: unknown, b: unknown) => (norm(a) ?? '') === (norm(b) ?? '');

function family(line: LineageLine): 'FABRIC' | 'LACE' | 'TRIM' {
  if (norm(line.laceId) || norm(line.greigeLaceId) || line.materialType === 'LACE') return 'LACE';
  if (norm(line.greigeId) || norm(line.fabricId) || line.materialType === 'FABRIC' || line.materialType === 'GREIGE') {
    return 'FABRIC';
  }
  return 'TRIM';
}

/** The trim master a line points at, e.g. "labelId:abc" — falls back to the materials row */
function trimKey(line: LineageLine): string | null {
  for (const fk of TRIM_FKS) {
    const v = norm(line[fk]);
    if (v) return `${fk}:${v}`;
  }
  return norm(line.materialId) ? `materialId:${line.materialId}` : null;
}

type Tier = (next: LineageLine, prev: LineageLine) => boolean;

const TIERS: Record<'FABRIC' | 'LACE' | 'TRIM', Tier[]> = {
  FABRIC: [
    (n, p) => same(n.selectedCadId, p.selectedCadId),
    (n, p) => same(n.cadSlot, p.cadSlot) && sameOrBothEmpty(n.colorName, p.colorName),
    (n, p) =>
      (same(n.greigeId, p.greigeId) || same(n.fabricId, p.fabricId)) &&
      sameOrBothEmpty(n.colorName, p.colorName) &&
      sameOrBothEmpty(n.componentName, p.componentName),
  ],
  LACE: [
    (n, p) =>
      (same(n.laceId, p.laceId) || same(n.greigeLaceId, p.greigeLaceId)) && sameOrBothEmpty(n.colorName, p.colorName),
  ],
  TRIM: [
    (n, p) => trimKey(n) !== null && trimKey(n) === trimKey(p) && sameOrBothEmpty(n.componentName, p.componentName),
    (n, p) => trimKey(n) !== null && trimKey(n) === trimKey(p),
  ],
};

/**
 * Pair each new line with at most one previous line (each previous line used once). Tiers are tried in
 * order; within a tier a unique candidate wins, several candidates are narrowed by sortOrder, and a line
 * that stays ambiguous gets no ancestor (null) rather than a guess.
 */
export function matchBomLineage(prevLines: LineageLine[], nextLines: LineageLine[]): Map<string, string> {
  const result = new Map<string, string>();
  const used = new Set<string>();
  const ordered = [...nextLines].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  for (const tierIndex of [0, 1, 2]) {
    for (const next of ordered) {
      if (result.has(next.id)) continue;
      const tier = TIERS[family(next)][tierIndex];
      if (!tier) continue;
      const candidates = prevLines.filter((p) => !used.has(p.id) && family(p) === family(next) && tier(next, p));
      let pick: LineageLine | undefined;
      if (candidates.length === 1) pick = candidates[0];
      else if (candidates.length > 1) {
        const bySort = candidates.filter((c) => (c.sortOrder ?? 0) === (next.sortOrder ?? 0));
        if (bySort.length === 1) pick = bySort[0];
      }
      if (pick) {
        result.set(next.id, pick.id);
        used.add(pick.id);
      }
    }
  }
  return result;
}

/** The order item's latest APPROVED/LOCKED BOM — the one whose lines carry live requirements */
export async function findAncestorBom(
  db: Db,
  scope: { orderId: string; styleId: string; orderItemId?: string | null }
): Promise<{ id: string } | null> {
  return db.order_bom.findFirst({
    where: {
      orderId: scope.orderId,
      styleId: scope.styleId,
      ...(scope.orderItemId ? { OR: [{ orderItemId: scope.orderItemId }, { orderItemId: null }] } : {}),
      status: { in: ['APPROVED', 'LOCKED'] },
    },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
}

async function withCadSlots(db: Db, lines: LineageLine[]): Promise<LineageLine[]> {
  const cadIds = [...new Set(lines.map((l) => norm(l.selectedCadId)).filter((id): id is string => !!id))];
  if (cadIds.length === 0) return lines;
  const cads = await db.fabric_width_cad.findMany({
    where: { id: { in: cadIds } },
    select: { id: true, styleFabricId: true },
  });
  const slot = new Map(cads.map((c) => [c.id, c.styleFabricId]));
  return lines.map((l) => ({ ...l, cadSlot: norm(l.selectedCadId) ? (slot.get(l.selectedCadId!) ?? null) : null }));
}

/**
 * previousItemId for each line of a BOM about to be created for this order item: new line id → the
 * ancestor BOM line it replaces. Empty when the order item has no approved BOM yet.
 */
export async function resolvePreviousItems(
  db: Db,
  scope: { orderId: string; styleId: string; orderItemId?: string | null },
  nextLines: LineageLine[]
): Promise<Map<string, string>> {
  const ancestor = await findAncestorBom(db, scope);
  if (!ancestor) return new Map();
  const prevLines = (await db.order_bom_items.findMany({
    where: { orderBomId: ancestor.id },
  })) as unknown as LineageLine[];
  const [prev, next] = await Promise.all([withCadSlots(db, prevLines), withCadSlots(db, nextLines)]);
  return matchBomLineage(prev, next);
}

export default { matchBomLineage, resolvePreviousItems, findAncestorBom };
