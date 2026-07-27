// Stock Level Service - Manage current stock balances per material per warehouse
import { Unit, Prisma, MaterialType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { AppError, NotFoundError, ValidationError } from '../errors';
import { getDerivedStockDetailed, getDerivedValuation } from './helpers/derived-stock.helper';

export interface StockLevelFilters {
  warehouseId?: string;
  materialId?: string;
  belowReorderLevel?: boolean;
  search?: string;
}

export interface UpdateStockLevelDTO {
  /** Rejected — quantity is derived from the per-lot tables; use the stock adjustment flow. */
  quantity?: Decimal;
  reorderLevel?: Decimal;
  maxLevel?: Decimal;
  minLevel?: Decimal;
  valuationRate?: Decimal;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse the synthetic composite id `${materialId}_${warehouseId}` that the list endpoints emit for
 * derived rows. Split at the LAST underscore: materialId is app-supplied (trim materials use
 * non-UUID ids like 'mat-btn-0001', which may themselves contain underscores), while the warehouse
 * half is always a UUID (warehouses.id is @default(uuid())).
 */
function parseCompositeStockLevelId(id: string): { materialId: string; warehouseId: string } | null {
  const cut = id.lastIndexOf('_');
  if (cut <= 0) return null;
  const materialId = id.slice(0, cut);
  const warehouseId = id.slice(cut + 1);
  if (!UUID_RE.test(warehouseId)) return null;
  return { materialId, warehouseId };
}

class StockLevelService {
  /**
   * Get stock summary by material type from the derived view
   */
  async getStockSummaryByType(): Promise<
    Array<{ materialType: string; totalRecords: number; totalQuantity: number; totalValue: number }>
  > {
    // T2-1: sourced from derived_stock_view (stockValue = derived_qty × stock_settings.valuationRate),
    // joined to materials.id — counts exclude phantom/RAW/zero-qty rows; quantities are per-lot truth.
    // (Historical: this once read the broken unified_stock_view, which had no stockValue column and
    // 500'd every call; that view was dropped entirely in migration 20260727100000.)
    const results = await prisma.$queryRaw<
      Array<{ materialType: string; totalRecords: bigint; totalQuantity: number; totalValue: number }>
    >`
      SELECT
        m."materialType" as "materialType",
        COUNT(*) as "totalRecords",
        SUM(dv.quantity) as "totalQuantity",
        SUM(dv."stockValue") as "totalValue"
      FROM derived_stock_view dv
      JOIN materials m ON m.id = dv."materialId"
      GROUP BY m."materialType"
      ORDER BY m."materialType"
    `;

    return results.map((r) => ({
      materialType: r.materialType,
      totalRecords: Number(r.totalRecords),
      totalQuantity: Number(r.totalQuantity) || 0,
      totalValue: Number(r.totalValue) || 0,
    }));
  }

  /**
   * Get all stock levels with filters
   */
  async getAllStockLevels(filters?: StockLevelFilters) {
    // T2-1 Stage B: on-hand quantity + valuation now come from the DERIVED source (derived_stock_view +
    // stock_settings) instead of the hand-maintained stock_levels.quantity, so the list can no longer show
    // drifted balances or 0-qty phantom/RAW-proxy rows. Same row shape; filters applied over derived rows.
    let rows = await getDerivedStockDetailed({ warehouseId: filters?.warehouseId, materialId: filters?.materialId });
    if (filters?.belowReorderLevel) {
      rows = rows.filter((r) => r.reorderLevel != null && Number(r.quantity) <= Number(r.reorderLevel));
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      rows = rows.filter(
        (r) => r.materials?.code?.toLowerCase().includes(s) || r.materials?.name?.toLowerCase().includes(s)
      );
    }
    // Synthetic composite id, same scheme as the sibling by-material/by-warehouse endpoints — the
    // frontend list keys on stock.id and the detail/update routes accept exactly this format.
    return rows.map((r) => ({ ...r, id: `${r.materialId}_${r.warehouseId}` }));
  }

  /**
   * Get stock level by ID
   * T2-1 Stage C: the list endpoints emit synthetic composite ids (`${materialId}_${warehouseId}`) for derived
   * rows, so detail lookups parse the composite and serve the matching DERIVED row (same shape as the list rows,
   * synthetic id included). Legacy stock_levels row ids are no longer served — the ledger is writer-internal.
   */
  async getStockLevelById(id: string) {
    const composite = parseCompositeStockLevelId(id);
    if (!composite) {
      throw new AppError(
        404,
        'NOT_FOUND',
        `Stock level not found: '${id}' looks like a legacy stock_levels row id. Stock level ids are now composite 'materialId_warehouseId' as returned by the stock level list endpoints.`
      );
    }

    const row = (await getDerivedStockDetailed({ materialId: composite.materialId })).find(
      (r) => r.warehouseId === composite.warehouseId
    );

    if (!row) {
      throw new NotFoundError('Stock level', id);
    }

    return { ...row, id };
  }

  /**
   * Get stock level by material and warehouse
   * @param tx Optional transaction client for atomic operations
   */
  async getStockLevel(materialId: string, warehouseId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const stockLevel = await db.stock_levels.findUnique({
      where: {
        materialId_warehouseId: {
          materialId,
          warehouseId,
        },
      },
      include: {
        materials: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
          },
        },
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
          },
        },
      },
    });

    return stockLevel;
  }

  /**
   * Get stock levels by material (across all warehouses)
   */
  async getStockLevelsByMaterial(materialId: string) {
    // T2-1 Stage C: derived on-hand across warehouses (per-lot truth) instead of hand-maintained stock_levels.
    // Returns a BARE StockLevel[] (matches the declared frontend contract + sibling getStockLevelsByMaterialType;
    // the old wrapper {stockLevels,totals} was consumed by nobody — getByMaterial has zero live callers). Synthetic
    // composite id keeps any React key / DOM-id usage stable & unique (no write path consumes the row id).
    const rows = (await getDerivedStockDetailed({ materialId })).sort(
      (a, b) => Number(b.quantity) - Number(a.quantity)
    );
    return rows.map((r) => ({ ...r, id: `${r.materialId}_${r.warehouseId}` }));
  }

  /**
   * Get stock levels by warehouse
   */
  async getStockLevelsByWarehouse(warehouseId: string) {
    // T2-1 Stage C: on-hand + valuation from the DERIVED source (derived_stock_view + stock_settings), so drifted
    // or missing ledger balances (e.g. BTN-0001 75→300) no longer show on the transaction forms this feeds
    // (Adjustment / Stock-Out / Transfer / Count). Returns a BARE StockLevel[] — the old wrapper broke those forms
    // (they call .filter/.map on the result), so this also fixes a long-standing frontend crash. Preserves the old
    // quantity>0 filter + lastUpdated-desc order; synthetic composite id keeps React keys / checkbox DOM ids stable.
    const rows = (await getDerivedStockDetailed({ warehouseId }))
      .filter((r) => Number(r.quantity) > 0)
      .sort((a, b) => (b.lastUpdated?.getTime() ?? 0) - (a.lastUpdated?.getTime() ?? 0));
    return rows.map((r) => ({ ...r, id: `${r.materialId}_${r.warehouseId}` }));
  }

  /**
   * Update stock policy/valuation for a (material, warehouse) pair, addressed by the synthetic composite id
   * `${materialId}_${warehouseId}` that the list endpoints emit.
   * T2-1 Stage C: reorder/min/max policy + the admin-set WAC rate now live in stock_settings (the derived
   * view's config source). Quantity is DERIVED from the per-lot tables and can no longer be set here — use
   * the stock adjustment flow, which moves actual lots.
   */
  async updateStockLevel(id: string, data: UpdateStockLevelDTO) {
    if (data.quantity !== undefined) {
      throw new ValidationError('quantity is derived from per-lot stock; use the stock adjustment flow');
    }

    const composite = parseCompositeStockLevelId(id);
    if (!composite) {
      throw new AppError(
        404,
        'NOT_FOUND',
        `Stock level not found: '${id}' looks like a legacy stock_levels row id. Stock level ids are now composite 'materialId_warehouseId' as returned by the stock level list endpoints.`
      );
    }
    const { materialId, warehouseId } = composite;

    const current = (await getDerivedStockDetailed({ materialId })).find((r) => r.warehouseId === warehouseId);
    if (!current) {
      throw new NotFoundError('Stock level', id);
    }

    // Policy + valuation config live in stock_settings, keyed (materialId, warehouseId). Only touch the
    // fields the caller actually sent so partial updates never clobber existing config.
    await prisma.stock_settings.upsert({
      where: { materialId_warehouseId: { materialId, warehouseId } },
      update: {
        ...(data.reorderLevel !== undefined && { reorderLevel: data.reorderLevel }),
        ...(data.minLevel !== undefined && { minLevel: data.minLevel }),
        ...(data.maxLevel !== undefined && { maxLevel: data.maxLevel }),
        ...(data.valuationRate !== undefined && { valuationRate: data.valuationRate }),
      },
      create: {
        materialId,
        warehouseId,
        reorderLevel: data.reorderLevel,
        minLevel: data.minLevel,
        maxLevel: data.maxLevel,
        valuationRate: data.valuationRate,
      },
    });

    // Shim maintenance (writer-internal): mirror an admin-set WAC rate into the stock_levels ledger so
    // increaseStock's blended-WAC math (which reads shim stockValue/valuationRate) stays consistent.
    // Shim quantity is untouched.
    if (data.valuationRate !== undefined) {
      const shim = await prisma.stock_levels.findUnique({
        where: { materialId_warehouseId: { materialId, warehouseId } },
      });
      if (shim) {
        await prisma.stock_levels.update({
          where: { id: shim.id },
          data: {
            valuationRate: data.valuationRate,
            stockValue: new Decimal(shim.quantity.toString()).mul(data.valuationRate.toString()),
            lastUpdated: new Date(),
          },
        });
      }
    }

    // Return the fresh derived row, shaped like the list rows (synthetic composite id included).
    const updated = (await getDerivedStockDetailed({ materialId })).find((r) => r.warehouseId === warehouseId);
    return { ...(updated ?? current), id };
  }

  /**
   * Increase stock level (internal use by stock movement service)
   * @param tx Optional transaction client for atomic operations with parent transaction
   */
  async increaseStock(
    materialId: string,
    warehouseId: string,
    quantity: Decimal,
    unit: Unit,
    rate?: Decimal,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const existing = await this.getStockLevel(materialId, warehouseId, tx);

    if (existing) {
      // Update existing stock level
      const newQuantity = new Decimal(existing.quantity.toString()).add(quantity.toString());

      // Update valuation rate using weighted average
      let newValuationRate = existing.valuationRate;
      let newStockValue = existing.stockValue;

      if (rate) {
        const oldValue = existing.stockValue ? new Decimal(existing.stockValue.toString()) : new Decimal(0);
        const newValue = new Decimal(quantity.toString()).mul(rate.toString());
        const totalValue = oldValue.add(newValue);
        newValuationRate = totalValue.div(newQuantity);
        newStockValue = totalValue;
      }

      const updated = await db.stock_levels.update({
        where: { id: existing.id },
        data: {
          quantity: newQuantity,
          valuationRate: newValuationRate,
          stockValue: newStockValue,
          lastUpdated: new Date(),
        },
      });

      // T2-1 dual-write: mirror the recomputed WAC rate into stock_settings within the caller's tx (db = tx||prisma).
      if (rate) {
        await db.stock_settings.upsert({
          where: { materialId_warehouseId: { materialId, warehouseId } },
          update: { valuationRate: newValuationRate },
          create: { materialId, warehouseId, valuationRate: newValuationRate },
        });
      }

      return updated;
    } else {
      // Create new stock level
      const stockValue = rate ? new Decimal(quantity.toString()).mul(rate.toString()) : null;

      const created = await db.stock_levels.create({
        data: {
          materialId,
          warehouseId,
          quantity,
          unit,
          valuationRate: rate,
          stockValue,
        },
      });

      // T2-1 dual-write: seed stock_settings with the WAC rate for this new (material,warehouse) within the caller's tx.
      if (rate) {
        await db.stock_settings.upsert({
          where: { materialId_warehouseId: { materialId, warehouseId } },
          update: { valuationRate: rate },
          create: { materialId, warehouseId, valuationRate: rate },
        });
      }

      return created;
    }
  }

  /**
   * Decrease stock level (internal use by stock movement service)
   * @param tx Optional transaction client for atomic operations with parent transaction
   */
  async decreaseStock(materialId: string, warehouseId: string, quantity: Decimal, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const existing = await this.getStockLevel(materialId, warehouseId, tx);

    if (!existing) {
      throw new Error('Stock level not found. Cannot decrease stock.');
    }

    const currentQty = new Decimal(existing.quantity.toString());
    const decreaseQty = new Decimal(quantity.toString());

    if (currentQty.lt(decreaseQty)) {
      throw new Error(`Insufficient stock. Available: ${currentQty}, Requested: ${decreaseQty}`);
    }

    const newQuantity = currentQty.sub(decreaseQty);

    // Update stock value proportionally
    let newStockValue = existing.stockValue;
    if (existing.stockValue && existing.valuationRate) {
      newStockValue = new Decimal(newQuantity.toString()).mul(existing.valuationRate.toString());
    }

    const updated = await db.stock_levels.update({
      where: { id: existing.id },
      data: {
        quantity: newQuantity,
        stockValue: newStockValue,
        lastUpdated: new Date(),
      },
    });

    return updated;
  }

  /**
   * Get materials below reorder level
   */
  async getMaterialsBelowReorderLevel(warehouseId?: string) {
    // T2-1 Stage B: on-hand quantity + the per-warehouse reorderLevel now come from the DERIVED source
    // (derived_stock_view + stock_settings) rather than the hand-maintained stock_levels.quantity, so drift
    // can no longer produce phantom/stale reorder alerts. Same output shape (materials/warehouses nested).
    const rows = await getDerivedStockDetailed(warehouseId ? { warehouseId } : {});
    return rows.filter((r) => r.reorderLevel != null && Number(r.quantity) <= Number(r.reorderLevel));
  }

  /**
   * Get stock aging report
   */
  async getStockAgingReport(warehouseId: string) {
    // T2-1: derived per-warehouse on-hand instead of hand-maintained stock_levels. lastUpdated is now the real
    // last-movement time (MAX per-lot updatedAt); the ledger's lastUpdated was bumped by reconcile runs without
    // stock actually moving, which made everything look freshly-touched and hid genuine aging.
    // Derived per-warehouse on-hand: lastUpdated is the real last movement (MAX per-lot updatedAt), not the
    // reconcile-bumped ledger timestamp — so aging reflects genuine stagnation. The frontend StockAgingReport
    // type's field is literally "daysSinceLastMovement", confirming last-movement (not received-date) is intended.
    const stockLevels = (await getDerivedStockDetailed({ warehouseId }))
      .filter((r) => Number(r.quantity) > 0)
      .sort((a, b) => (a.lastUpdated?.getTime() ?? 0) - (b.lastUpdated?.getTime() ?? 0));

    const now = new Date();
    const aging = stockLevels.map((level) => {
      const daysSinceLastMovement = level.lastUpdated
        ? Math.floor((now.getTime() - level.lastUpdated.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      let ageCategory = '0-30 days';
      if (daysSinceLastMovement > 180) ageCategory = '180+ days';
      else if (daysSinceLastMovement > 90) ageCategory = '90-180 days';
      else if (daysSinceLastMovement > 60) ageCategory = '60-90 days';
      else if (daysSinceLastMovement > 30) ageCategory = '30-60 days';

      // Shape aligned to the frontend StockAgingReport contract (was previously mismatched), + ageCategory bonus.
      return {
        materialId: level.materialId,
        materialCode: level.materials?.code ?? level.materialId,
        materialName: level.materials?.name ?? 'N/A',
        quantity: Number(level.quantity),
        daysSinceLastMovement,
        lastMovementDate: level.lastUpdated ?? undefined,
        ageCategory,
      };
    });

    return aging;
  }

  /**
   * Get stock valuation report
   */
  async getStockValuationReport(warehouseId?: string) {
    // T2-1 Stage C: derived valuation (quantity>0, sorted stockValue desc) instead of hand-maintained
    // stock_levels.stockValue. The view recomputes stockValue = derived_qty × stock_settings.valuationRate, so
    // it auto-corrects drifted stored values (e.g. PKG-0001: stale 1500 → correct 31500).
    const { rows, totalValue, totalQuantity } = await getDerivedValuation(warehouseId ? { warehouseId } : {});
    return {
      stockLevels: rows,
      totalValue,
      totalQuantity,
      totalMaterials: rows.length,
    };
  }

  /**
   * Get stock levels filtered by material type
   */
  async getStockLevelsByMaterialType(materialType: MaterialType) {
    // T2-1 Stage B: derived on-hand filtered by material type, ordered by quantity asc (same as before).
    const rows = await getDerivedStockDetailed({ materialType });
    return rows.sort((a, b) => Number(a.quantity) - Number(b.quantity));
  }
}

export default new StockLevelService();
