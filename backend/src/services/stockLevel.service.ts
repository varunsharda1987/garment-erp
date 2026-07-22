// Stock Level Service - Manage current stock balances per material per warehouse
import { Unit, Prisma, MaterialType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { getDerivedStockDetailed, getDerivedValuation } from './helpers/derived-stock.helper';

export interface StockLevelFilters {
  warehouseId?: string;
  materialId?: string;
  belowReorderLevel?: boolean;
  search?: string;
}

export interface UpdateStockLevelDTO {
  quantity?: Decimal;
  reorderLevel?: Decimal;
  maxLevel?: Decimal;
  minLevel?: Decimal;
  valuationRate?: Decimal;
}

/**
 * Unified stock view row shape (from unified_stock_view)
 */
interface UnifiedStockRow {
  materialId: string;
  warehouseId: string | null;
  materialType: string;
  quantity: number;
  unit: string;
  lastUpdated: Date | null;
  stockValue: number;
}

class StockLevelService {
  /**
   * Get stock levels from unified_stock_view (aggregated from all specialized tables)
   * Use this for dashboards and reports - it's the true source of truth
   */
  async getUnifiedStockLevels(filters?: {
    warehouseId?: string;
    materialType?: string;
    materialId?: string;
  }): Promise<UnifiedStockRow[]> {
    let query = `SELECT * FROM unified_stock_view WHERE 1=1`;
    const params: any[] = [];

    if (filters?.warehouseId) {
      params.push(filters.warehouseId);
      query += ` AND "warehouseId" = $${params.length}`;
    }

    if (filters?.materialType) {
      params.push(filters.materialType);
      query += ` AND "materialType" = $${params.length}`;
    }

    if (filters?.materialId) {
      params.push(filters.materialId);
      query += ` AND "materialId" = $${params.length}`;
    }

    query += ` ORDER BY "materialType", quantity DESC`;

    const results = await prisma.$queryRawUnsafe<UnifiedStockRow[]>(query, ...params);
    return results;
  }

  /**
   * Get stock summary by material type from unified view
   */
  async getStockSummaryByType(): Promise<
    Array<{ materialType: string; totalRecords: number; totalQuantity: number; totalValue: number }>
  > {
    // T2-1 bug-fix + repoint: unified_stock_view has NO stockValue column, so the old query 500'd
    // (Postgres 42703). Source per-type on-hand + valuation from the DERIVED view instead
    // (stockValue = derived_qty × stock_settings.valuationRate), joined to materials.id — so counts exclude
    // phantom/RAW/zero-qty rows and quantities are the per-lot truth.
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
   * @deprecated Use getUnifiedStockLevels() for accurate quantities from specialized tables
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
    return rows;
  }

  /**
   * Get stock level by ID
   */
  async getStockLevelById(id: string) {
    const stockLevel = await prisma.stock_levels.findUnique({
      where: { id },
      include: {
        materials: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            unit: true,
            reorderLevel: true,
            material_categories: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!stockLevel) {
      throw new Error(`Stock level not found with ID: ${id}`);
    }

    return stockLevel;
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
   * Update stock level manually (for adjustments)
   */
  async updateStockLevel(id: string, data: UpdateStockLevelDTO) {
    const existing = await prisma.stock_levels.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Stock level not found with ID: ${id}`);
    }

    // Validate quantity is not negative
    if (data.quantity !== undefined && new Decimal(data.quantity.toString()).lt(0)) {
      throw new Error('Stock quantity cannot be negative');
    }

    // Calculate stock value if quantity or valuation rate changed
    let stockValue = existing.stockValue;
    const quantity = data.quantity ?? existing.quantity;
    const valuationRate = data.valuationRate ?? existing.valuationRate;

    if (data.quantity || data.valuationRate) {
      if (valuationRate) {
        stockValue = new Decimal(quantity.toString()).mul(valuationRate.toString());
      }
    }

    const stockLevel = await prisma.stock_levels.update({
      where: { id },
      data: {
        quantity: data.quantity,
        reorderLevel: data.reorderLevel,
        maxLevel: data.maxLevel,
        minLevel: data.minLevel,
        valuationRate: data.valuationRate,
        stockValue,
        lastUpdated: new Date(),
      },
      include: {
        materials: true,
        warehouses: true,
      },
    });

    // T2-1 dual-write: mirror the admin-set WAC rate into stock_settings (the derived view's valuation
    // source) so derived_stock_view.valuationRate/stockValue stay live once valuation readers repoint (Stage C).
    // Update only valuationRate so the reorder/min/max policy config Stage B relies on is never clobbered.
    if (data.valuationRate !== undefined) {
      await prisma.stock_settings.upsert({
        where: { materialId_warehouseId: { materialId: existing.materialId, warehouseId: existing.warehouseId } },
        update: { valuationRate: data.valuationRate },
        create: {
          materialId: existing.materialId,
          warehouseId: existing.warehouseId,
          valuationRate: data.valuationRate,
        },
      });
    }

    return stockLevel;
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
