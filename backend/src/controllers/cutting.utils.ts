import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { nextSeededSequence } from '../utils/seeded-sequence';
import { isQtyZero } from '../utils/quantity';
import { batchIssuedFabric } from '../services/helpers/run-fabric.helper';
import { USER_NAME_SELECT } from '../types/prisma.types';

// ============================================
// Shared Helper Functions for Cutting Controllers
// ============================================

export const transformCuttingBatch = (batch: any) => ({
  ...batch,
  actualFabricWidth: batch.actualFabricWidth ? Number(batch.actualFabricWidth) : null,
  cadAverageUsed: batch.cadAverageUsed ? Number(batch.cadAverageUsed) : null,
  cadWidthUsed: batch.cadWidthUsed ? Number(batch.cadWidthUsed) : null,
  fabricConsumed: batch.fabricConsumed ? Number(batch.fabricConsumed) : null,
  actualAverage: batch.actualAverage ? Number(batch.actualAverage) : null,
  varianceFromCad: batch.varianceFromCad ? Number(batch.varianceFromCad) : null,
  variancePercent: batch.variancePercent ? Number(batch.variancePercent) : null,
  wastageMeters: batch.wastageMeters ? Number(batch.wastageMeters) : null,
  wastagePercent: batch.wastagePercent != null ? Number(batch.wastagePercent) : null,
  fabricIssued: batch.fabricIssued ? Number(batch.fabricIssued) : null,
  fabricReturned: batch.fabricReturned ? Number(batch.fabricReturned) : null,
  actualConsumption: batch.actualConsumption ? Number(batch.actualConsumption) : null,
  returnChallanId: batch.returnChallanId || null,
  workOrder: batch.workOrder
    ? {
        id: batch.workOrder.id,
        workOrderNumber: batch.workOrder.workOrderNumber,
        styleId: batch.workOrder.styleId,
        orderId: batch.workOrder.orderId,
        style: batch.workOrder.styles
          ? {
              id: batch.workOrder.styles.id,
              styleCode: batch.workOrder.styles.styleCode,
              buyerStyleRef: batch.workOrder.styles.buyerStyleRef ?? null,
              styleName: batch.workOrder.styles.styleName,
            }
          : null,
        order: batch.workOrder.orders
          ? {
              id: batch.workOrder.orders.id,
              orderNumber: batch.workOrder.orders.orderNumber,
              customer: batch.workOrder.orders.customers
                ? {
                    id: batch.workOrder.orders.customers.id,
                    name: batch.workOrder.orders.customers.name,
                  }
                : null,
            }
          : null,
      }
    : null,
  component: batch.component
    ? {
        id: batch.component.id,
        componentName: batch.component.componentName,
        componentType: batch.component.componentType,
      }
    : null,
  fabricStock: batch.fabricStock
    ? {
        id: batch.fabricStock.id,
        rollNumbers: batch.fabricStock.rollNumbers || '',
        quantityAvailable: Number(batch.fabricStock.quantityAvailable),
        finishedWidth: Number(batch.fabricStock.finishedWidth),
        cutableWidth: Number(batch.fabricStock.cutableWidth),
        fabric: batch.fabricStock.fabricMaster
          ? {
              id: batch.fabricStock.fabricMaster.id,
              fabricCode: batch.fabricStock.fabricMaster.fabricCode,
              fabricName: batch.fabricStock.fabricMaster.fabricName,
            }
          : null,
      }
    : null,
  cuttingOperator: batch.cuttingOperator
    ? {
        id: batch.cuttingOperator.id,
        name: `${batch.cuttingOperator.firstName} ${batch.cuttingOperator.lastName}`,
      }
    : null,
  createdBy: batch.createdBy
    ? {
        id: batch.createdBy.id,
        name: `${batch.createdBy.firstName} ${batch.createdBy.lastName}`,
      }
    : null,
  skuOutputs: batch.skuOutputs?.map((sku: any) => ({
    ...sku,
    color: sku.color
      ? {
          id: sku.color.id,
          colorName: sku.color.colorName,
          colorCode: sku.color.colorCode,
        }
      : null,
    size: sku.size
      ? {
          id: sku.size.id,
          sizeName: sku.size.sizeName,
          sortOrder: sku.size.sortOrder,
        }
      : null,
  })),
  defects: batch.defects || [],
});

export const generateBatchNumber = async (workOrderNumber: string, componentName?: string): Promise<string> => {
  const prefix = `CB-${workOrderNumber}`;
  const componentPart = componentName ? `-${componentName.substring(0, 3).toUpperCase()}` : '';
  const fullPrefix = `${prefix}${componentPart}`;

  // Race-safe sequence, seeded from the historical max so a deleted batch never
  // causes its number to be reused (bug-hunt production-17)
  const seq = await nextSeededSequence(fullPrefix, async () => {
    const rows = await prisma.$queryRaw<Array<{ max: number | null }>>(
      Prisma.sql`
        SELECT MAX((regexp_match("batchNumber", '-([0-9]+)$'))[1]::int) AS max
        FROM cutting_batches
        WHERE "batchNumber" LIKE ${fullPrefix} || '-%'
      `
    );
    return Number(rows[0]?.max ?? 0);
  });

  return `${fullPrefix}-${seq.toString().padStart(3, '0')}`;
};

/**
 * Generate the next transfer slip number: TS-{YYYYMMDD}-{NNNN}.
 *
 * Race-safe sequence per day, seeded from the historical max for that day —
 * max-based, not count-based: slipNumber is @unique, so a deleted slip plus
 * count+1 regenerated an existing number → P2002 (bug-hunt production-17).
 * The @unique on transfer_slips.slipNumber remains the backstop.
 */
export async function generateTransferSlipNumber(tx?: Prisma.TransactionClient): Promise<string> {
  const today = new Date();
  const datePrefix = `TS-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;

  const seq = await nextSeededSequence(
    datePrefix,
    async () => {
      const client = tx ?? prisma;
      const rows = await client.$queryRaw<Array<{ max: number | null }>>(
        Prisma.sql`
          SELECT MAX((regexp_match("slipNumber", '-([0-9]+)$'))[1]::int) AS max
          FROM transfer_slips
          WHERE "slipNumber" LIKE ${datePrefix} || '-%'
        `
      );
      return Number(rows[0]?.max ?? 0);
    },
    tx
  );

  return `${datePrefix}-${seq.toString().padStart(4, '0')}`;
}

/**
 * Merge duplicate (colorId, sizeId) rows by summing the given numeric fields.
 * Postgres treats NULL colorIds as DISTINCT in the @@unique indexes on cutting_batch_skus /
 * stitching_issue_skus / transfer_slip_skus, so size-only duplicate rows insert freely and
 * double-count every downstream total (bug-hunt production-18). Dedupe server-side before create.
 */
export function dedupeSkuRows<T extends { colorId?: string | null; sizeId: string }>(
  rows: T[],
  sumFields: string[]
): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.colorId ?? ''}|${row.sizeId}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row });
    } else {
      for (const f of sumFields) {
        const prev = Number((existing as any)[f]);
        const next = Number((row as any)[f]);
        if (!isNaN(next)) {
          (existing as any)[f] = (isNaN(prev) ? 0 : prev) + next;
        }
      }
    }
  }
  return Array.from(map.values());
}

// Include options for cutting batch queries
export const batchIncludeOptions = {
  workOrder: {
    include: {
      styles: true,
      orders: {
        include: {
          customers: true,
        },
      },
    },
  },
  component: true,
  fabricStock: {
    include: {
      fabricMaster: true,
    },
  },
  cuttingOperator: USER_NAME_SELECT,
  createdBy: USER_NAME_SELECT,
  skuOutputs: {
    include: {
      color: true,
      size: true,
    },
  },
  defects: true,
  additionalFabrics: {
    include: {
      fabricStock: {
        include: {
          fabricMaster: true,
        },
      },
    },
  },
};

// ============================================
// What a lay cut — the ONE reading of the lay ↔ fabric link (2026-09-28)
// ============================================

/** What the lay rule reads of a lay (what addCuttingLay writes). Spread into any cutting_lays select. */
export const LAY_COVERAGE_SELECT = {
  numberOfLayers: true,
  layerLength: true,
  cuttingBatchFabricId: true,
  layFabrics: { select: { cuttingBatchFabricId: true, layerLength: true } },
} as const;

/** What the lay rule reads of a batch's lots (cutting_batch_fabrics). */
export const BATCH_FABRIC_COVERAGE_SELECT = {
  id: true,
  fabricStockId: true,
  fabricStock: { select: { fabricId: true } },
} as const;

type DecimalLike = Prisma.Decimal | number | string | null;

/** A lot on a batch as the lay rule needs it: the cutting_batch_fabrics row, its lot, and the lot's fabric. */
export interface LayBatchFabric {
  id: string;
  fabricStockId: string;
  /** fabric_stock.fabricId — the lots of one fabric are cut together, in one lay */
  fabricId: string | null;
}

export interface LayForCoverage {
  numberOfLayers: number | null;
  layerLength: DecimalLike;
  cuttingBatchFabricId: string | null;
  layFabrics: Array<{ cuttingBatchFabricId: string; layerLength: DecimalLike }>;
}

export interface LayCoverage {
  /** The batch's lots (cutting_batch_fabrics ids) whose FABRIC has at least one lay */
  coveredBatchFabricIds: Set<string>;
  /** Metres cut per fabric — each fabric counted once per lay */
  metresByFabric: Map<string, number>;
  /** Every lay metre of the batch — cutting_batches.fabricConsumed */
  totalMetres: number;
}

export const toLayBatchFabric = (bf: {
  id: string;
  fabricStockId: string;
  fabricStock?: { fabricId?: string | null } | null;
}): LayBatchFabric => ({ id: bf.id, fabricStockId: bf.fabricStockId, fabricId: bf.fabricStock?.fabricId ?? null });

const fabricKeyOf = (bf: LayBatchFabric): string => bf.fabricId ?? `lot:${bf.fabricStockId}`;

/** True when some fabric has two or more lots on the batch — only then are a fabric's lay metres split. */
export function hasSharedFabric(batchFabrics: LayBatchFabric[]): boolean {
  return new Set(batchFabrics.map(fabricKeyOf)).size < batchFabrics.length;
}

/**
 * What a batch's lays cut, per FABRIC.
 *
 * The lay screen (CuttingDetail) asks for ONE layer length per fabric — the lots of one fabric are merged
 * into one line — and addCuttingLay saves it as:
 *  - a batch of 2+ fabrics: a cutting_lay_fabrics row for EVERY lot of each fabric, each carrying that
 *    fabric's length (one length per fabric, repeated per lot — not one length each);
 *  - a batch whose lots are all ONE fabric: no link at all — the lay's own layerLength is that fabric's;
 *  - an old lay: the legacy cuttingBatchFabricId.
 * Read lot by lot, the first counted a two-lot fabric twice and the second counted no lot at all, so every
 * batch cut from one fabric read "not yet cut" and Issue to stitching was refused (CB-WO2609-0088-003,
 * 2026-09-28). The stitching guard, the batch page and recalculateBatchTotals all read lays through this.
 */
export function layCoverage(batchFabrics: LayBatchFabric[], lays: LayForCoverage[]): LayCoverage {
  const byId = new Map(batchFabrics.map((bf) => [bf.id, bf]));
  const fabricKeys = [...new Set(batchFabrics.map(fabricKeyOf))];
  const coveredKeys = new Set<string>();
  const metresByFabric = new Map<string, number>();
  let totalMetres = 0;

  for (const lay of lays) {
    const layers = lay.numberOfLayers || 1;
    // This lay's layer length per fabric
    const lengths = new Map<string, number>();
    if (lay.layFabrics.length > 0) {
      for (const lf of lay.layFabrics) {
        const bf = byId.get(lf.cuttingBatchFabricId);
        const key = bf ? fabricKeyOf(bf) : `row:${lf.cuttingBatchFabricId}`;
        // The rows of one fabric repeat that fabric's length — count it once (the longest, should they differ)
        lengths.set(key, Math.max(lengths.get(key) ?? 0, Number(lf.layerLength) || 0));
      }
    } else {
      const linked = lay.cuttingBatchFabricId ? byId.get(lay.cuttingBatchFabricId) : undefined;
      const key = linked ? fabricKeyOf(linked) : fabricKeys.length === 1 ? fabricKeys[0] : null;
      const length = Number(lay.layerLength) || 0;
      if (key) lengths.set(key, length);
      // A batch with no fabric lines (or an unlinked lay among several fabrics): the batch total only
      else totalMetres += length * layers;
    }
    for (const [key, length] of lengths) {
      coveredKeys.add(key);
      const metres = length * layers;
      metresByFabric.set(key, (metresByFabric.get(key) ?? 0) + metres);
      totalMetres += metres;
    }
  }

  const coveredBatchFabricIds = new Set(
    batchFabrics.filter((bf) => coveredKeys.has(fabricKeyOf(bf))).map((bf) => bf.id)
  );
  return { coveredBatchFabricIds, metresByFabric, totalMetres };
}

/**
 * A fabric's lay metres per LOT (cutting_batch_fabrics.fabricConsumed). A fabric with one lot on the batch
 * gets them all — exact. Which of a fabric's lots a lay used is not recorded (they are cut together), so
 * its metres are split by what each lot sent to this batch (issued less returned; evenly when nothing was
 * sent), to 2 decimals with the rounding left on the last lot so the lots add up to the fabric exactly.
 * The split only pre-fills the completion's Return to Store — the store types what really comes back.
 */
export function splitFabricMetresByLot(
  batchFabrics: LayBatchFabric[],
  metresByFabric: Map<string, number>,
  sentByLot: Map<string, number>
): Map<string, number> {
  const groups = new Map<string, LayBatchFabric[]>();
  for (const bf of batchFabrics) {
    const key = fabricKeyOf(bf);
    groups.set(key, [...(groups.get(key) ?? []), bf]);
  }
  const perLot = new Map<string, number>();
  for (const [key, lots] of groups) {
    const metres = new Prisma.Decimal(metresByFabric.get(key) ?? 0);
    const weights = lots.map((bf) => Math.max(0, sentByLot.get(bf.fabricStockId) ?? 0));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let given = new Prisma.Decimal(0);
    lots.forEach((bf, i) => {
      const share =
        i === lots.length - 1
          ? metres.minus(given)
          : (isQtyZero(totalWeight)
              ? metres.div(lots.length)
              : metres.mul(weights[i]).div(totalWeight)
            ).toDecimalPlaces(2);
      given = given.plus(share);
      perLot.set(bf.id, share.toDecimalPlaces(2).toNumber());
    });
  }
  return perLot;
}

// Helper: recalculate batch totals from all lays
export async function recalculateBatchTotals(tx: any, batchId: string) {
  // Fetch all lays with their SKUs and per-fabric records, and the batch's lots
  const [lays, batch] = await Promise.all([
    tx.cutting_lays.findMany({
      where: { cuttingBatchId: batchId },
      select: {
        id: true,
        ...LAY_COVERAGE_SELECT,
        skuOutputs: { select: { colorId: true, sizeId: true, pieces: true } },
      },
    }),
    tx.cutting_batches.findUnique({
      where: { id: batchId },
      select: { workOrderId: true, additionalFabrics: { select: BATCH_FABRIC_COVERAGE_SELECT } },
    }),
  ]);

  // cutQty per size = SUM(piecesPerLayer * numberOfLayers) across all lays
  // "pieces" in cutting_lay_skus now represents piecesPerLayer
  const skuTotals = new Map<string, number>();
  for (const lay of lays) {
    const layers = lay.numberOfLayers || 1;
    for (const sku of lay.skuOutputs) {
      const key = `${sku.colorId}|${sku.sizeId}`;
      const totalForSize = sku.pieces * layers;
      skuTotals.set(key, (skuTotals.get(key) || 0) + totalForSize);
    }
  }

  // Update each cutting_batch_skus record
  const batchSkus = await tx.cutting_batch_skus.findMany({
    where: { cuttingBatchId: batchId },
  });

  for (const sku of batchSkus) {
    const key = `${sku.colorId}|${sku.sizeId}`;
    const cutQty = skuTotals.get(key) || 0;
    await tx.cutting_batch_skus.update({
      where: { id: sku.id },
      data: {
        cutQty,
        goodPcs: cutQty - sku.rejectedQty,
      },
    });
  }

  // Fabric consumption, read through layCoverage: each fabric counted once per lay; a fabric's metres go to
  // its lots (split by what each sent to this batch when the fabric has several)
  const batchFabrics: LayBatchFabric[] = (batch?.additionalFabrics ?? []).map(toLayBatchFabric);
  const coverage = layCoverage(batchFabrics, lays);
  const sentByLot: Map<string, number> =
    batch && hasSharedFabric(batchFabrics) ? await batchIssuedFabric(batchId, batch.workOrderId, tx) : new Map();
  const perLot = splitFabricMetresByLot(batchFabrics, coverage.metresByFabric, sentByLot);

  await tx.cutting_batches.update({
    where: { id: batchId },
    data: { fabricConsumed: coverage.totalMetres },
  });
  for (const bf of batchFabrics) {
    await tx.cutting_batch_fabrics.update({
      where: { id: bf.id },
      data: { fabricConsumed: perLot.get(bf.id) ?? 0 },
    });
  }
}

/**
 * How much of each lot a cutting batch holds (fabric_stock_allocation RESERVED rows).
 *
 * A batch needs `pieces × CAD average` metres of each FABRIC it cuts, not of each lot. Lots of the
 * same fabric share that need in the order given (primary first), and no lot holds more than it has
 * (in the store + already at Cutting for the run). The old loop wrote the whole need on EVERY lot:
 * ESSKY085LS's batch held 1,703.5 m on a 851.9 m lot AND on a 852.1 m lot — 3,407 m for 1,704 m
 * of cloth (2026-09-25). Need beyond what the lots hold is not reserved: a hold cannot exceed cloth.
 */
export function splitFabricReservation(
  pieces: number,
  lots: Array<{ stockId: string; fabricId: string | null; cadAvg: number | null; capacity: number }>
): Array<{ stockId: string; quantity: number; cadAvg: number }> {
  if (!(pieces > 0)) return [];
  const out: Array<{ stockId: string; quantity: number; cadAvg: number }> = [];
  const needByFabric = new Map<string, number>();
  for (const lot of lots) {
    if (!lot.cadAvg || lot.cadAvg <= 0) continue;
    const key = lot.fabricId ?? `lot:${lot.stockId}`;
    // A fabric's need is set by its first lot's CAD average (all lots of one fabric share one CAD)
    if (!needByFabric.has(key)) needByFabric.set(key, Math.round(pieces * lot.cadAvg * 1000) / 1000);
    const left = needByFabric.get(key)!;
    const quantity = Math.round(Math.min(left, Math.max(0, lot.capacity)) * 1000) / 1000;
    if (quantity <= 0) continue;
    out.push({ stockId: lot.stockId, quantity, cadAvg: lot.cadAvg });
    needByFabric.set(key, Math.round((left - quantity) * 1000) / 1000);
  }
  return out;
}

/**
 * The fabric lots a cutting batch expects to consume, as `cutting_batch_fabrics` rows.
 *
 * Completion sums issued fabric by walking these rows and looking each lot up in the challan-derived
 * issuedMap. A lot with no row here is invisible to that sum, so its issued metres never count and
 * the "No fabric issue recorded" guard blocks the batch for ever.
 *
 * That is why the PRIMARY lot must always be included. CuttingChart sends its lots in `fabricStocks`,
 * but CuttingForm sends none at all — so before this, a CuttingForm batch had no rows whatsoever and
 * could never be completed no matter how the fabric was issued.
 *
 * The primary may also appear in `extras`; the caller relies on
 * `@@unique([batchId, fabricStockId])` + `skipDuplicates` to collapse that.
 */
export function buildBatchFabricRows(
  batchId: string,
  primary: {
    fabricStockId?: string | null;
    cadAvgUsed?: number | null;
    cadWidthUsed?: number | null;
    actualWidth?: number | null;
  },
  extras:
    | Array<{
        fabricStockId?: string | null;
        cadAvgUsed?: number | null;
        cadWidthUsed?: number | null;
        actualWidth?: number | null;
      }>
    | null
    | undefined
): Array<{
  batchId: string;
  fabricStockId: string;
  cadAvgUsed: number | null;
  cadWidthUsed: number | null;
  actualWidth: number | null;
}> {
  const rows: Array<{
    batchId: string;
    fabricStockId: string;
    cadAvgUsed: number | null;
    cadWidthUsed: number | null;
    actualWidth: number | null;
  }> = [];
  const push = (src: typeof primary) => {
    if (!src?.fabricStockId) return;
    rows.push({
      batchId,
      fabricStockId: src.fabricStockId,
      cadAvgUsed: src.cadAvgUsed != null ? Number(src.cadAvgUsed) : null,
      cadWidthUsed: src.cadWidthUsed != null ? Number(src.cadWidthUsed) : null,
      actualWidth: src.actualWidth != null ? Number(src.actualWidth) : null,
    });
  };
  push(primary);
  for (const e of extras || []) push(e);
  return rows;
}

/** One row of the cutting chart's fabric list, before lot/stock enrichment. */
export interface ChartFabricEntry {
  part: string;
  fabricId: string | null;
  fabricName: string;
  fabricCode: string;
  costingWidth: number | null;
  costingAverage: number | null;
  rawMatCalcWidth: number | null;
  rawMatCalcAverage: number | null;
  productionWidth: number | null;
  productionAverage: number | null;
  fabricColor: string | null;
  /** The style_fabric this row came from; null for rows enriched from BOM/style data. */
  styleFabricId: string | null;
  rank: Partial<Record<'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION', number>>;
}

/**
 * Collapse chart rows that describe the SAME fabric usage, and keep apart the ones that do not.
 *
 * The rule that matters: two entries originating from DIFFERENT `style_fabrics` are two distinct
 * fabric requirements and must never merge, whatever they are called. Before this, rows with no
 * fabricId were deduped on fabric NAME alone — and 334 of 346 style_fabrics have a null fabricId
 * because they are greige-sourced. So one component legitimately using two different fabrics
 * collapsed into a single chart row, the second row's CAD average silently replacing the first's.
 * Production then planned and reserved against the wrong figure, with nothing missing on screen.
 *
 * Rows enriched from BOM/style data carry a null styleFabricId and still attach by name — that is
 * what the enrichment path is for, and keeping it is why the rule is written on provenance rather
 * than on "does this row have CAD data".
 */
export function dedupeChartEntries(allEntries: ChartFabricEntry[]): {
  fabrics: ChartFabricEntry[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const seenFabricIds = new Map<string, ChartFabricEntry>();
  const seenFabricNames = new Map<string, ChartFabricEntry>();
  const fabrics: ChartFabricEntry[] = [];

  const differentStyleFabrics = (a: ChartFabricEntry, b: ChartFabricEntry) =>
    !!a.styleFabricId && !!b.styleFabricId && a.styleFabricId !== b.styleFabricId;

  const mergeCadFields = (target: ChartFabricEntry, source: ChartFabricEntry) => {
    // Non-lossy: a real disagreement is reported, not quietly resolved in favour of whoever
    // happened to arrive first.
    const clash = (t: number | null, sv: number | null) => t !== null && sv !== null && Math.abs(t - sv) > 1e-4;
    if (clash(target.costingAverage, source.costingAverage)) {
      warnings.push(
        `${target.part}: two COSTING CAD rows were combined (${target.costingAverage} m and ${source.costingAverage} m per piece). Using ${target.costingAverage} m.`
      );
    }
    if (clash(target.productionAverage, source.productionAverage)) {
      warnings.push(
        `${target.part}: two PRODUCTION CAD rows were combined (${target.productionAverage} m and ${source.productionAverage} m per piece). Using ${target.productionAverage} m.`
      );
    }
    if (!target.fabricName && source.fabricName) target.fabricName = source.fabricName;
    if (!target.fabricCode && source.fabricCode) target.fabricCode = source.fabricCode;
    if (!target.fabricColor && source.fabricColor) target.fabricColor = source.fabricColor;
    // Fill width and average INDEPENDENTLY. Gating the average on the width meant a source row with
    // a real average but no width contributed nothing — and a width of 0.00 reads as null here
    // (`cutableWidth ? Number(..) : null`), which is exactly the shape of the live COS009 rows. The
    // average is the number production plans against; it must never be dropped because a width is
    // missing.
    const fill = <K extends keyof ChartFabricEntry>(k: K) => {
      if (target[k] === null && source[k] !== null) target[k] = source[k];
    };
    fill('costingWidth');
    fill('costingAverage');
    fill('rawMatCalcWidth');
    fill('rawMatCalcAverage');
    fill('productionWidth');
    fill('productionAverage');
  };

  for (const f of allEntries) {
    if (f.fabricId) {
      const existing = seenFabricIds.get(f.fabricId);
      if (existing) {
        mergeCadFields(existing, f);
        continue;
      }
      if (f.fabricName) {
        const byName = seenFabricNames.get(f.fabricName);
        if (byName && !byName.fabricId && !differentStyleFabrics(byName, f)) {
          byName.fabricId = f.fabricId;
          mergeCadFields(byName, f);
          seenFabricIds.set(f.fabricId, byName);
          continue;
        }
      }
      seenFabricIds.set(f.fabricId, f);
    } else if (f.fabricName) {
      const byName = seenFabricNames.get(f.fabricName);
      if (byName && !differentStyleFabrics(byName, f)) {
        mergeCadFields(byName, f);
        continue;
      }
      const byId = Array.from(seenFabricIds.values()).find(
        (e) => e.fabricName === f.fabricName && !differentStyleFabrics(e, f)
      );
      if (byId) {
        mergeCadFields(byId, f);
        continue;
      }
    }

    if (f.fabricName) seenFabricNames.set(f.fabricName, f);
    fabrics.push(f);
  }

  return { fabrics, warnings };
}
