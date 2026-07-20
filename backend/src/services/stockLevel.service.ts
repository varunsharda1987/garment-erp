// Stock Level Service - Manage current stock balances per material per warehouse
import { Unit, Prisma, MaterialType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { getDerivedStockDetailed } from './helpers/derived-stock.helper';

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
    const results = await prisma.$queryRaw<
      Array<{ materialType: string; totalRecords: bigint; totalQuantity: number; totalValue: number }>
    >`
      SELECT
        "materialType",
        COUNT(*) as "totalRecords",
        SUM(quantity) as "totalQuantity",
        SUM("stockValue") as "totalValue"
      FROM unified_stock_view
      GROUP BY "materialType"
      ORDER BY "materialType"
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
    const stockLevels = await prisma.stock_levels.findMany({
      where: { materialId },
      include: {
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
            city: true,
          },
        },
      },
      orderBy: { quantity: 'desc' },
    });

    const totalQuantity = stockLevels.reduce((sum, level) => {
      return sum + parseFloat(level.quantity.toString());
    }, 0);

    const totalValue = stockLevels.reduce((sum, level) => {
      return sum + (level.stockValue ? parseFloat(level.stockValue.toString()) : 0);
    }, 0);

    return {
      stockLevels,
      totalQuantity,
      totalValue,
    };
  }

  /**
   * Get stock levels by warehouse
   */
  async getStockLevelsByWarehouse(warehouseId: string) {
    const stockLevels = await prisma.stock_levels.findMany({
      where: {
        warehouseId,
        quantity: { gt: 0 },
      },
      include: {
        materials: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            material_categories: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { lastUpdated: 'desc' },
    });

    const totalValue = stockLevels.reduce((sum, level) => {
      return sum + (level.stockValue ? parseFloat(level.stockValue.toString()) : 0);
    }, 0);

    return {
      stockLevels,
      totalMaterials: stockLevels.length,
      totalValue,
    };
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
    // This is a simplified version - in production, you'd track batch-wise aging
    const stockLevels = await prisma.stock_levels.findMany({
      where: {
        warehouseId,
        quantity: { gt: 0 },
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
      },
      orderBy: { lastUpdated: 'asc' },
    });

    const now = new Date();
    const aging = stockLevels.map((level) => {
      const daysSinceUpdate = Math.floor((now.getTime() - level.lastUpdated.getTime()) / (1000 * 60 * 60 * 24));

      let ageCategory = '0-30 days';
      if (daysSinceUpdate > 180) ageCategory = '180+ days';
      else if (daysSinceUpdate > 90) ageCategory = '90-180 days';
      else if (daysSinceUpdate > 60) ageCategory = '60-90 days';
      else if (daysSinceUpdate > 30) ageCategory = '30-60 days';

      return {
        ...level,
        daysSinceUpdate,
        ageCategory,
      };
    });

    return aging;
  }

  /**
   * Get stock valuation report
   */
  async getStockValuationReport(warehouseId?: string) {
    const where: Prisma.stock_levelsWhereInput = {
      quantity: { gt: 0 },
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const stockLevels = await prisma.stock_levels.findMany({
      where,
      include: {
        materials: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            material_categories: {
              select: {
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
          },
        },
      },
      orderBy: { stockValue: 'desc' },
    });

    const totalValue = stockLevels.reduce((sum, level) => {
      return sum + (level.stockValue ? parseFloat(level.stockValue.toString()) : 0);
    }, 0);

    const totalQuantity = stockLevels.reduce((sum, level) => {
      return sum + parseFloat(level.quantity.toString());
    }, 0);

    return {
      stockLevels,
      totalValue,
      totalQuantity,
      totalMaterials: stockLevels.length,
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
