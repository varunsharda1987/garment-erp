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
            dv."valuationRate", dv."stockValue",
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
