/**
 * What an order's style can USE of each non-fabric Order BOM line — THE availability rule for trims, labels
 * and packaging on a production run (2026-10-03).
 *
 * Until then the run page, the stage gate and the issue screen each read `getDerivedOnHand(bom.materialId)`.
 * That broke three ways:
 *  - A SIZED label's BOM line points at the label's BASE `materials` row, but every label lot is booked on its
 *    SIZE row (`materials.sizeVariantId`; `derived_stock_view` puts each lot on exactly one row). The base row
 *    read 0: WO2609-0278 (ESSKY091LS) showed LBL-0004 "missing" with 2,150 pcs in store, held for its order.
 *  - Total on-hand counted goods HELD for another order as this run's.
 *  - Goods already ISSUED to the run had left the shelf, so a run read short the moment its trims went out.
 *
 * So for every line (and, for a sized label, every size of the order):
 *    have = on hand − held for OTHER orders + already issued to this order's runs of the style
 * A sized label is checked per size against the order's size quantities (`order_item_breakup`), matched to the
 * label's sizes by name, case-insensitively — the same match MRP uses to raise per-size requirements
 * (`matchLabelSize`). A size the label does not come in is short, never skipped. A line no material can be
 * found for is reported as not linked, never counted as available.
 *
 * Fabric and greige are NOT answered here: `availableFabricForBomLine` (productionBlockingValidation.service)
 * answers them by greige lineage.
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { getDerivedOnHandMap } from './derived-stock.helper';
import { untrackedHeldByMaterial } from './stock-reservation.helper';
import { runIdsForOrderStyle } from './run-fabric.helper';
import { BASE_MATERIAL_ROW, MASTER_CONFIG } from './master-config';
import { qtyExceeds, qtyRemaining } from '../../utils/quantity';
import { BusinessError } from '../../errors';

type Db = Prisma.TransactionClient | typeof prisma;

/** One order BOM line as the checks load it. */
export interface RunBomLine {
  id: string;
  materialType: string;
  materialId: string | null;
  quantityPerGarment: Prisma.Decimal | number;
  wastagePercent: Prisma.Decimal | number | null;
  totalQuantity: Prisma.Decimal | number;
  totalWithWastage: Prisma.Decimal | number | null;
  unit: string;
  componentName: string | null;
  [fk: string]: unknown;
}

export interface SizeAvailability {
  sizeName: string;
  /** The label's size row; null when the label does not come in this size */
  materialId: string | null;
  materialCode: string | null;
  need: number;
  have: number;
  short: number;
}

export interface LineAvailability {
  bomItemId: string;
  materialType: string;
  /** The material checked: the line's own, else its master's base row; null when none could be found */
  materialId: string | null;
  materialName: string;
  materialCode: string;
  unit: string;
  need: number;
  have: number;
  short: number;
  /** Per size, for a label that comes in sizes and an order that has sizes */
  sizes?: SizeAvailability[];
  /** The line names no material the store can be checked against */
  unlinked?: boolean;
  /** A label that comes in sizes — enforced per size when pieces go to stitching, not as a whole line */
  sizedLabel?: boolean;
}

/** The order's size quantities for one style (summed across colours and lines), by size name. */
export async function orderSizeQuantities(db: Db, orderId: string, styleId: string): Promise<Map<string, number>> {
  const rows = await db.order_item_breakup.findMany({
    where: { order_items: { orderId, styleId }, quantity: { gt: 0 } },
    select: { quantity: true, size_options: { select: { sizeName: true } } },
    orderBy: { size_options: { sortOrder: 'asc' } }, // the style's size order: XS, S, M…
  });
  const out = new Map<string, number>();
  for (const r of rows) {
    const name = r.size_options?.sizeName;
    if (!name) continue;
    out.set(name, (out.get(name) ?? 0) + r.quantity);
  }
  return out;
}

/** A label size that matches an order size — case-insensitive on the name (the MRP rule). */
export function matchLabelSize<T extends { size: string }>(variants: T[], sizeName: string): T | undefined {
  const want = sizeName.trim().toLowerCase();
  return variants.find((v) => v.size.trim().toLowerCase() === want);
}

/** Size rows of each label: labelId → [{ size, materialId, code }]. Only labels that come in sizes appear. */
async function labelSizeRows(
  db: Db,
  labelIds: string[]
): Promise<Map<string, Array<{ size: string; materialId: string; code: string }>>> {
  const out = new Map<string, Array<{ size: string; materialId: string; code: string }>>();
  if (labelIds.length === 0) return out;
  const rows = await db.materials.findMany({
    where: { labelId: { in: labelIds }, sizeVariantId: { not: null }, label_size_variant: { isActive: true } },
    select: { id: true, code: true, labelId: true, label_size_variant: { select: { size: true } } },
  });
  for (const r of rows) {
    if (!r.labelId || !r.label_size_variant) continue;
    const list = out.get(r.labelId) ?? [];
    list.push({ size: r.label_size_variant.size, materialId: r.id, code: r.code });
    out.set(r.labelId, list);
  }
  return out;
}

/** Quantities of each material issued to these runs (INTERNAL challans that were not cancelled). */
export async function issuedToRuns(db: Db, runIds: string[], materialIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (runIds.length === 0 || materialIds.length === 0) return out;
  const items = await db.challan_items.findMany({
    where: {
      materialId: { in: materialIds },
      challan: { productionRunId: { in: runIds }, challanType: 'INTERNAL', status: { not: 'CANCELLED' } },
    },
    select: { materialId: true, quantity: true },
  });
  for (const i of items) {
    if (!i.materialId) continue;
    out.set(i.materialId, (out.get(i.materialId) ?? 0) + Number(i.quantity));
  }
  return out;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * What an order's style can use of each material: on hand − held for OTHER orders + already issued to the
 * order's runs of the style. THE "have" of every check in this file.
 */
async function usableByMaterial(
  db: Db,
  run: { orderId: string; styleId: string },
  ids: string[]
): Promise<Map<string, number>> {
  const runIds = await runIdsForOrderStyle(run.orderId, run.styleId, db);
  const [onHand, heldForOthers, issued] = await Promise.all([
    getDerivedOnHandMap(ids, db),
    untrackedHeldByMaterial(db, ids, { excludeOrderId: run.orderId }),
    issuedToRuns(db, runIds, ids),
  ]);
  return new Map(
    ids.map((id) => [
      id,
      round3(Math.max(0, (onHand.get(id) ?? 0) - (heldForOthers.get(id) ?? 0)) + (issued.get(id) ?? 0)),
    ])
  );
}

export interface SizeLabelCover {
  sizeName: string;
  /** Pieces of this size the labels can cover (the scarcest label decides) */
  piecesCovered: number;
  /** Pieces of this size already issued to stitching on the order's runs of the style */
  piecesIssued: number;
  labels: Array<{ materialCode: string; perGarment: number; have: number; inThisSize: boolean }>;
}

/** Label types sewn into the garment at stitching (label_master.labelType, matched as text, any case) */
export const STITCHED_LABEL_TYPES = ['size', 'washcare', 'wash care', 'traceability'] as const;

/**
 * How many pieces of each size the order's STITCHED labels (size, washcare, traceability — STITCHED_LABEL_TYPES)
 * cover for stitching — they are sewn at stitching, so a size whose label is not there cannot be issued to
 * stitching (owner, 2026-10-03).
 * Covered = for every sized label on the approved Order BOM, what the order can use of that size's label
 * (`usableByMaterial`) ÷ labels per garment; the scarcest label decides. A label that does not come in the
 * size covers nothing. Returns null when nothing is enforced: a stock run (no order), no approved Order BOM,
 * or no label on it that comes in sizes. Keyed by size name, lower-case.
 */
export async function labelCoverForStitching(db: Db, workOrderId: string): Promise<Map<string, SizeLabelCover> | null> {
  const run = await db.work_orders.findUnique({ where: { id: workOrderId }, select: { orderId: true, styleId: true } });
  if (!run?.orderId || !run.styleId) return null;
  const orderRun = { orderId: run.orderId, styleId: run.styleId };

  const bom = await db.order_bom.findFirst({
    where: { orderId: run.orderId, styleId: run.styleId, isActive: true, status: { in: ['APPROVED', 'LOCKED'] } },
    select: { items: { where: { materialType: 'LABEL' } } },
  });
  if (!bom || bom.items.length === 0) return null;

  // The label each line is about (its base row), and which of them come in sizes
  const labelOf = new Map<string, { labelId: string; perGarment: number; code: string }>();
  for (const line of bom.items) {
    const where: Prisma.materialsWhereInput = line.materialId
      ? { id: line.materialId }
      : line.labelId
        ? { labelId: line.labelId, ...BASE_MATERIAL_ROW }
        : { id: '' };
    const material = await db.materials.findFirst({
      where,
      select: { labelId: true, sizeVariantId: true, code: true },
    });
    if (!material?.labelId || material.sizeVariantId) continue;
    labelOf.set(line.id, {
      labelId: material.labelId,
      perGarment: Number(line.quantityPerGarment || 0),
      code: material.code,
    });
  }
  const labelIds = [...new Set([...labelOf.values()].map((l) => l.labelId))];
  // Only a label SEWN at stitching holds pieces back: a size label (Main Cum Size Label, Size Label), a washcare
  // label and a traceability label (owner, 2026-10-03). A price tag, hang tag or other label that also comes in
  // sizes goes on at finishing and never holds pieces back from stitching.
  const stitchLabels = new Set(
    (
      await db.label_master.findMany({
        where: {
          id: { in: labelIds },
          OR: STITCHED_LABEL_TYPES.map((t) => ({ labelType: { contains: t, mode: 'insensitive' as const } })),
        },
        select: { id: true },
      })
    ).map((l) => l.id)
  );
  const sizeRows = await labelSizeRows(db, [...stitchLabels]);
  const sizedLines = [...labelOf.values()].filter(
    (l) => stitchLabels.has(l.labelId) && (sizeRows.get(l.labelId)?.length ?? 0) > 0 && l.perGarment > 0
  );
  if (sizedLines.length === 0) return null;

  const allRowIds = sizedLines.flatMap((l) => sizeRows.get(l.labelId)!.map((r) => r.materialId));
  const usable = await usableByMaterial(db, orderRun, [...new Set(allRowIds)]);

  // Sizes to answer: the order's, plus any size already sent to stitching
  const runIds = await runIdsForOrderStyle(run.orderId, run.styleId, db);
  const issuedSkus = await db.stitching_issue_skus.findMany({
    where: { stitchingIssue: { workOrderId: { in: runIds }, isActive: true } },
    select: { issuedQty: true, size: { select: { sizeName: true } } },
  });
  const piecesIssued = new Map<string, number>();
  for (const s of issuedSkus) {
    const key = s.size.sizeName.trim().toLowerCase();
    piecesIssued.set(key, (piecesIssued.get(key) ?? 0) + s.issuedQty);
  }
  const sizeNames = new Map<string, string>();
  for (const name of (await orderSizeQuantities(db, run.orderId, run.styleId)).keys()) {
    sizeNames.set(name.trim().toLowerCase(), name);
  }
  for (const s of issuedSkus) sizeNames.set(s.size.sizeName.trim().toLowerCase(), s.size.sizeName);

  const out = new Map<string, SizeLabelCover>();
  for (const [key, sizeName] of sizeNames) {
    const labels = sizedLines.map((l) => {
      const row = matchLabelSize(sizeRows.get(l.labelId)!, sizeName);
      return {
        materialCode: row?.code ?? l.code,
        perGarment: l.perGarment,
        have: row ? (usable.get(row.materialId) ?? 0) : 0,
        inThisSize: !!row,
      };
    });
    const piecesCovered = Math.min(...labels.map((l) => Math.floor((l.have + 0.005) / l.perGarment)));
    out.set(key, { sizeName, piecesCovered, piecesIssued: piecesIssued.get(key) ?? 0, labels });
  }
  return out;
}

/**
 * Availability of non-fabric Order BOM lines for one order + style. `lines` are the order BOM's lines (fabric
 * lines are ignored). Stock runs (no order) have no Order BOM and are never passed here.
 */
export async function runLineAvailability(
  run: { orderId: string; styleId: string },
  lines: RunBomLine[],
  db: Db = prisma
): Promise<LineAvailability[]> {
  // 1. The material each line is about: its own, else its master's BASE row (a line saved without materialId)
  const resolved = new Map<string, string | null>();
  for (const line of lines) {
    if (line.materialId) {
      resolved.set(line.id, line.materialId);
      continue;
    }
    const fk = MASTER_CONFIG[line.materialType]?.fkField;
    const masterId = fk ? (line[fk] as string | null | undefined) : null;
    if (!fk || !masterId) {
      resolved.set(line.id, null);
      continue;
    }
    const base = await db.materials.findFirst({
      where: { [fk]: masterId, ...BASE_MATERIAL_ROW } as Prisma.materialsWhereInput,
      select: { id: true },
    });
    resolved.set(line.id, base?.id ?? null);
  }

  const materialIds = [...new Set([...resolved.values()].filter((v): v is string => !!v))];
  const materials = await db.materials.findMany({
    where: { id: { in: materialIds } },
    select: { id: true, code: true, name: true, labelId: true, sizeVariantId: true },
  });
  const materialById = new Map(materials.map((m) => [m.id, m]));

  // 2. Sized labels: a base label row whose label comes in sizes is checked per size
  const baseLabelIds = materials.filter((m) => m.labelId && !m.sizeVariantId).map((m) => m.labelId!);
  const sizeRows = await labelSizeRows(db, [...new Set(baseLabelIds)]);
  const orderSizes = sizeRows.size > 0 ? await orderSizeQuantities(db, run.orderId, run.styleId) : new Map();

  // 3. Every material row any line may draw on
  const checkIds = new Set(materialIds);
  for (const list of sizeRows.values()) for (const r of list) checkIds.add(r.materialId);
  const ids = [...checkIds];
  const usable = await usableByMaterial(db, run, ids);
  const haveOf = (id: string) => usable.get(id) ?? 0;

  return lines.map((line): LineAvailability => {
    const need = Number(line.totalWithWastage ?? line.totalQuantity ?? 0);
    const materialId = resolved.get(line.id) ?? null;
    const material = materialId ? materialById.get(materialId) : undefined;
    const base = {
      bomItemId: line.id,
      materialType: line.materialType,
      materialId,
      materialName: material?.name || line.componentName || 'Unknown material',
      materialCode: material?.code || '',
      unit: line.unit,
      need: round3(need),
    };
    if (!materialId || !material) {
      return { ...base, have: 0, short: round3(need), unlinked: true };
    }

    const sizes = material.labelId && !material.sizeVariantId ? sizeRows.get(material.labelId) : undefined;
    if (sizes && sizes.length > 0) {
      if (orderSizes.size === 0) {
        // The order has no sizes yet: the label's whole stock across its sizes answers the whole line
        const have = round3(sizes.reduce((sum, s) => sum + haveOf(s.materialId), 0) + haveOf(materialId));
        return { ...base, have, short: qtyRemaining(need, have), sizedLabel: true };
      }
      const perGarment = Number(line.quantityPerGarment || 0);
      const wastage = Number(line.wastagePercent || 0);
      const sizeLines: SizeAvailability[] = [...orderSizes].map(([sizeName, pcs]) => {
        const sizeNeed = round3(pcs * perGarment * (1 + wastage / 100));
        const row = matchLabelSize(sizes, sizeName);
        const have = row ? haveOf(row.materialId) : 0;
        return {
          sizeName,
          materialId: row?.materialId ?? null,
          materialCode: row?.code ?? null,
          need: sizeNeed,
          have,
          short: qtyRemaining(sizeNeed, have),
        };
      });
      const have = round3(sizeLines.reduce((sum, s) => sum + Math.min(s.have, s.need), 0));
      const short = round3(sizeLines.reduce((sum, s) => sum + s.short, 0));
      return {
        ...base,
        need: round3(sizeLines.reduce((sum, s) => sum + s.need, 0)),
        have,
        short,
        sizes: sizeLines,
        sizedLabel: true,
      };
    }

    const have = haveOf(materialId);
    return { ...base, have, short: qtyRemaining(need, have) };
  });
}

/** True when the line is short beyond the tolerance the checks allow (0.5% of the need, else rounding dust). */
export function lineIsShort(line: LineAvailability, tolerance: number): boolean {
  if (line.unlinked) return true;
  return qtyExceeds(line.short, line.need * tolerance);
}

/** "XS short 314, M short 38" — the sizes of a line that are short. */
export function describeShortSizes(line: LineAvailability): string {
  return (line.sizes ?? [])
    .filter((s) => qtyExceeds(s.short, 0))
    .map((s) => (s.materialId ? `${s.sizeName} short ${s.short}` : `${s.sizeName}: no label in this size`))
    .join(', ');
}

/**
 * Refuses a stitching issue that sends more pieces of a size than that size's labels cover
 * (`labelCoverForStitching`). Call inside the issue's transaction, before writing it.
 */
export async function refuseSizesWithoutLabels(
  db: Db,
  workOrderId: string,
  rows: Array<{ sizeId: string; issuedQty: number }>
): Promise<void> {
  const cover = await labelCoverForStitching(db, workOrderId);
  if (!cover) return;

  const sizes = await db.size_options.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.sizeId))] } },
    select: { id: true, sizeName: true },
  });
  const nameOf = new Map(sizes.map((s) => [s.id, s.sizeName]));
  const asked = new Map<string, { sizeName: string; pieces: number }>();
  for (const r of rows) {
    const sizeName = nameOf.get(r.sizeId) ?? r.sizeId;
    const key = sizeName.trim().toLowerCase();
    const cur = asked.get(key) ?? { sizeName, pieces: 0 };
    cur.pieces += r.issuedQty;
    asked.set(key, cur);
  }

  const short: Array<{ size: string; pieces: number; canIssue: number; labels: string }> = [];
  for (const [key, { sizeName, pieces }] of asked) {
    const c = cover.get(key);
    const canIssue = c ? Math.max(0, c.piecesCovered - c.piecesIssued) : 0;
    if (pieces <= canIssue) continue;
    const labels = (c?.labels ?? [])
      .map((l) => (l.inThisSize ? `${l.materialCode}: ${l.have}` : `${l.materialCode}: not made in ${sizeName}`))
      .join(', ');
    short.push({ size: sizeName, pieces, canIssue, labels });
  }
  if (short.length === 0) return;

  throw new BusinessError(
    `Size labels are not in store for ${short
      .map((s) => `${s.size} (asked ${s.pieces}, labels cover ${s.canIssue} more — ${s.labels || 'no label'})`)
      .join(
        '; '
      )}. A size label is sewn at stitching: receive or allocate the labels, issue them from Trim Issuance, then issue these pieces.`,
    { reason: 'LABEL_SHORT_FOR_SIZE', sizes: short }
  );
}
