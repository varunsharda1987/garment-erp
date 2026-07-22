/**
 * T2-1 Stage B compatibility layer: read on-hand inventory from the DERIVED source (derived_stock_view)
 * instead of the hand-maintained stock_levels.quantity. The view aggregates the 11 per-lot tables by
 * (materialId, warehouseId) and LEFT JOINs stock_settings for policy/valuation config, so it exposes the
 * same shape a stock_levels row does (quantity now derived; reorderLevel/min/max/valuationRate/stockValue
 * from settings). Readers are repointed to these helpers group-by-group during the parallel run.
 *
 * Prisma does not model the DB view, so we query it via $queryRaw. Numeric columns are intentionally NOT
 * cast, so Prisma returns them as Prisma.Decimal (drop-in compatible with stock_levels rows — callers can
 * still do .toNumber()/.toString()).
 */
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

type Dec = Prisma.Decimal;

export interface DerivedStockRow {
  materialId: string;
  warehouseId: string;
  quantity: Dec;
  reorderLevel: Dec | null;
  minLevel: Dec | null;
  maxLevel: Dec | null;
  valuationRate: Dec | null;
  stockValue: Dec | null;
}

export interface DerivedStockDetailedRow extends DerivedStockRow {
  unit: string; // top-level unit (mirrors stock_levels.unit) so display code that reads row.unit still works
  lastUpdated: Date | null; // MAX of the per-lot updatedAt = real last movement (unlike stock_levels.lastUpdated, which reconcile runs bump)
  materials: {
    id: string;
    code: string;
    name: string;
    unit: string;
    materialType: string;
    reorderLevel: number | null; // materials.reorderLevel is Int
    material_categories: { name: string } | null;
  } | null;
  warehouses: { id: string; warehouseCode: string; warehouseName: string; warehouseType: string | null } | null;
}

interface Scope {
  warehouseId?: string;
  materialId?: string;
  materialType?: string;
}

function buildWhere(scope: Scope, prefix = ''): { where: string; params: any[] } {
  const conds: string[] = [];
  const params: any[] = [];
  if (scope.warehouseId) {
    params.push(scope.warehouseId);
    conds.push(`${prefix}"warehouseId" = $${params.length}`);
  }
  if (scope.materialId) {
    params.push(scope.materialId);
    conds.push(`${prefix}"materialId" = $${params.length}`);
  }
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

/** Bare derived on-hand rows (quantity + policy/valuation as Decimal), one per (materialId, warehouseId). */
export async function getDerivedStock(scope: Scope = {}): Promise<DerivedStockRow[]> {
  const { where, params } = buildWhere(scope);
  return prisma.$queryRawUnsafe(
    `SELECT "materialId", "warehouseId", quantity, "reorderLevel", "minLevel", "maxLevel",
            "valuationRate", "stockValue"
     FROM derived_stock_view ${where}`,
    ...params
  );
}

/** Total derived on-hand for a material across warehouses (or a specific warehouse). Replaces the
 *  stock_levels.aggregate(_sum.quantity) pattern used by MRP/requirement/production-blocking readers. */
export async function getDerivedOnHand(materialId: string, warehouseId?: string): Promise<number> {
  const params: any[] = [materialId];
  let where = `"materialId" = $1`;
  if (warehouseId) {
    params.push(warehouseId);
    where += ` AND "warehouseId" = $2`;
  }
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(quantity), 0)::float AS total FROM derived_stock_view WHERE ${where}`,
    ...params
  );
  return rows[0]?.total ?? 0;
}

/** Batch derived on-hand: materialId -> total derived qty across warehouses, for a set of materials.
 *  Replaces a stock_levels.findMany({ where: { materialId: { in } } }) + in-memory sum (e.g. work-order BOM shortage). */
export async function getDerivedOnHandMap(materialIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!materialIds.length) return map;
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT "materialId", COALESCE(SUM(quantity), 0)::float AS total
     FROM derived_stock_view
     WHERE "materialId" = ANY($1::text[])
     GROUP BY "materialId"`,
    materialIds
  );
  for (const r of rows) map.set(r.materialId, Number(r.total));
  return map;
}

/** Count of derived (material,warehouse) on-hand rows below a threshold — replaces the dashboard
 *  stock_levels.count({ where: { quantity: { lt: N } } }) which can't be a column filter on a view. */
export async function countDerivedBelowThreshold(threshold: number): Promise<number> {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM derived_stock_view WHERE quantity < $1`,
    threshold
  );
  return rows[0]?.n ?? 0;
}

/** Derived valuation for a scope: quantity>0 rows sorted by stockValue desc + totals. Replaces the
 *  getStockValuationReport / getWarehouseStockSummary / getStockLevelsBy* stock_levels.stockValue readers. */
export async function getDerivedValuation(
  scope: { warehouseId?: string; materialId?: string } = {}
): Promise<{ rows: DerivedStockDetailedRow[]; totalValue: number; totalQuantity: number }> {
  const rows = (await getDerivedStockDetailed(scope))
    .filter((r) => Number(r.quantity) > 0)
    .sort((a, b) => Number(b.stockValue ?? 0) - Number(a.stockValue ?? 0));
  const totalValue = rows.reduce((s, r) => s + Number(r.stockValue ?? 0), 0);
  const totalQuantity = rows.reduce((s, r) => s + Number(r.quantity), 0);
  return { rows, totalValue, totalQuantity };
}

/** Greige weighted-average cost for the fabric-costing STOCK_WAC fallback. Faithfully reproduces the old
 *  stock_levels.findFirst(materials.greigeId + GREIGE, quantity>0, valuationRate NOT NULL, ORDER BY rate ASC):
 *  on-hand gate from the DERIVED qty, rate + asOf from stock_settings (the live WAC home post-dual-write).
 *  asOf degrades to stock_settings.updatedAt (config time) — acceptable because greigeLastUpdated is display
 *  metadata that never enters the cost math. Returns null when no in-stock greige lot carries a rate. */
export async function getGreigeWAC(greigeId: string): Promise<{ rate: Prisma.Decimal; asOf: Date | null } | null> {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT ss."valuationRate" AS rate, ss."updatedAt" AS as_of
     FROM derived_stock_view dv
     JOIN materials m ON m.id = dv."materialId"
     JOIN stock_settings ss ON ss."materialId" = dv."materialId" AND ss."warehouseId" = dv."warehouseId"
     WHERE m."greigeId" = $1 AND m."materialType" = 'GREIGE'
       AND dv.quantity > 0 AND ss."valuationRate" IS NOT NULL
     ORDER BY ss."valuationRate" ASC
     LIMIT 1`,
    greigeId
  );
  if (!rows.length) return null;
  return { rate: rows[0].rate, asOf: rows[0].as_of ?? null };
}

/** Derived on-hand rows joined to material + warehouse metadata, shaped like a stock_levels findMany result. */
export async function getDerivedStockDetailed(scope: Scope = {}): Promise<DerivedStockDetailedRow[]> {
  const conds: string[] = [];
  const params: any[] = [];
  if (scope.warehouseId) {
    params.push(scope.warehouseId);
    conds.push(`dv."warehouseId" = $${params.length}`);
  }
  if (scope.materialId) {
    params.push(scope.materialId);
    conds.push(`dv."materialId" = $${params.length}`);
  }
  if (scope.materialType) {
    params.push(scope.materialType);
    conds.push(`m."materialType" = $${params.length}::"MaterialType"`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT dv."materialId", dv."warehouseId", dv.quantity, dv."reorderLevel", dv."minLevel", dv."maxLevel",
            dv."valuationRate", dv."stockValue", dv."lastUpdated",
            m.code AS m_code, m.name AS m_name, m.unit AS m_unit, m."materialType" AS m_type, m."reorderLevel" AS m_reorder,
            mc.name AS mc_name, w."warehouseCode" AS w_code, w."warehouseName" AS w_name, w."warehouseType" AS w_type
     FROM derived_stock_view dv
     JOIN materials m ON m.id = dv."materialId"
     LEFT JOIN material_categories mc ON mc.id = m."categoryId"
     JOIN warehouses w ON w.id = dv."warehouseId"
     ${where}`,
    ...params
  );
  return rows.map((r) => ({
    materialId: r.materialId,
    warehouseId: r.warehouseId,
    quantity: r.quantity,
    unit: r.m_unit,
    lastUpdated: r.lastUpdated ?? null,
    reorderLevel: r.reorderLevel,
    minLevel: r.minLevel,
    maxLevel: r.maxLevel,
    valuationRate: r.valuationRate,
    stockValue: r.stockValue,
    materials: {
      id: r.materialId,
      code: r.m_code,
      name: r.m_name,
      unit: r.m_unit,
      materialType: r.m_type,
      reorderLevel: r.m_reorder === null || r.m_reorder === undefined ? null : Number(r.m_reorder),
      material_categories: r.mc_name ? { name: r.mc_name } : null,
    },
    warehouses: {
      id: r.warehouseId,
      warehouseCode: r.w_code,
      warehouseName: r.w_name,
      warehouseType: r.w_type ?? null,
    },
  }));
}
