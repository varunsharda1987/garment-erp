/**
 * Unified Trim Stock Service
 * Handles inventory for all trim types: BUTTON, ZIPPER, ELASTIC, LABEL, PACKAGING
 *
 * Each trim type has its own specialized table but the operations are identical.
 * This service provides a unified interface for all trim stock operations.
 */
import { Prisma, StockStatus } from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';

export type TrimType = 'BUTTON' | 'ZIPPER' | 'ELASTIC' | 'LABEL' | 'PACKAGING' | 'MACHINE_PART' | 'OTHER_MATERIAL';

export interface CreateTrimStockDTO {
  trimType: TrimType;
  masterId: string; // buttonId, zipperId, etc.
  quantity: number;
  unit?: string;
  purchaseCost?: number; // Optional, defaults to 0 for imports
  supplierId?: string;
  batchNumber?: string;
  lotNumber?: string;
  warehouseId?: string; // Preferred: proper FK to warehouses
  warehouseLocation?: string; // Legacy: text location
  rackNumber?: string;
  qualityGrade?: string;
  receivedDate?: Date;
  sourceType?: 'GRN' | 'MANUAL' | 'ADJUSTMENT' | 'IMPORT';
  skipMaterialSync?: boolean; // Skip ensureMaterialRecord/syncStockLevelQuantity when called from stock routing
  tx?: any; // Transaction client - use this instead of global prisma when provided
}

export interface TrimStockItem {
  id: string;
  trimType: TrimType;
  masterId: string;
  masterCode: string;
  masterName: string;
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  unit: string;
  purchaseCost: number;
  weightedAvgCost: number;
  supplierId: string | null;
  batchNumber: string | null;
  warehouseLocation: string | null;
  qualityGrade: string;
  receivedDate: Date;
  status: string;
}

const TRIM_CONFIG: Record<
  TrimType,
  {
    table: string;
    masterTable: string;
    masterIdField: string;
    masterCodeField: string;
    masterNameField: string;
    defaultUnit: string;
  }
> = {
  BUTTON: {
    table: 'button_stock',
    masterTable: 'button_master',
    masterIdField: 'buttonId',
    masterCodeField: 'buttonCode',
    masterNameField: 'buttonName',
    defaultUnit: 'pieces',
  },
  ZIPPER: {
    table: 'zipper_stock',
    masterTable: 'zipper_master',
    masterIdField: 'zipperId',
    masterCodeField: 'zipperCode',
    masterNameField: 'zipperName',
    defaultUnit: 'pieces',
  },
  ELASTIC: {
    table: 'elastic_stock',
    masterTable: 'elastic_master',
    masterIdField: 'elasticId',
    masterCodeField: 'elasticCode',
    masterNameField: 'elasticName',
    defaultUnit: 'METER',
  },
  LABEL: {
    table: 'label_stock',
    masterTable: 'label_master',
    masterIdField: 'labelId',
    masterCodeField: 'labelCode',
    masterNameField: 'labelName',
    defaultUnit: 'pieces',
  },
  PACKAGING: {
    table: 'packaging_stock',
    masterTable: 'packaging_master',
    masterIdField: 'packagingId',
    masterCodeField: 'packagingCode',
    masterNameField: 'packagingName',
    defaultUnit: 'pieces',
  },
  MACHINE_PART: {
    table: 'machine_part_stock',
    masterTable: 'machine_part_master',
    masterIdField: 'machinePartId',
    masterCodeField: 'partCode',
    masterNameField: 'partName',
    defaultUnit: 'pieces',
  },
  OTHER_MATERIAL: {
    table: 'other_material_stock',
    masterTable: 'other_material_master',
    masterIdField: 'otherMaterialId',
    masterCodeField: 'materialCode',
    masterNameField: 'materialName',
    defaultUnit: 'pieces',
  },
};

class TrimStockService {
  /**
   * Create a trim stock entry
   */
  async createTrimStock(data: CreateTrimStockDTO, userId: string) {
    const config = TRIM_CONFIG[data.trimType];
    if (!config) {
      throw new Error(`Unknown trim type: ${data.trimType}`);
    }

    // The stock row + its stock_levels sync must be atomic. Join a caller's tx when supplied; otherwise
    // open our own so a sync failure can't leave stock with no stock_levels entry (bug-hunt T1/F4).
    const run = async (tx: any) => {
      // Validate master exists
      const master = await (tx as any)[config.masterTable].findUnique({
        where: { id: data.masterId },
      });
      if (!master) {
        throw new Error(`${data.trimType} master with ID ${data.masterId} not found`);
      }

      // Create stock entry using the appropriate table
      const cost = data.purchaseCost ?? 0;
      const stockData = {
        [config.masterIdField]: data.masterId,
        quantityAvailable: new Prisma.Decimal(data.quantity),
        quantityReserved: new Prisma.Decimal(0),
        quantityConsumed: new Prisma.Decimal(0),
        unit: data.unit || config.defaultUnit,
        purchaseCost: new Prisma.Decimal(cost),
        weightedAvgCost: new Prisma.Decimal(cost),
        supplierId: data.supplierId || null,
        batchNumber: data.batchNumber || null,
        lotNumber: data.lotNumber || null,
        sourceType: data.sourceType || 'MANUAL',
        warehouseId: data.warehouseId || null,
        warehouseLocation: data.warehouseLocation || null,
        rackNumber: data.rackNumber || null,
        qualityGrade: data.qualityGrade || 'A',
        status: 'AVAILABLE',
        stockType: data.sourceType === 'GRN' ? 'PLANNED_STOCK' : 'GENERIC',
        receivedDate: data.receivedDate || new Date(),
        agingDays: 0,
        createdById: userId,
      };

      const stock = await (tx as any)[config.table].create({
        data: stockData,
      });

      // Ensure materials record exists + sync stock_levels (on this tx)
      // Skip when called from stock routing (parent already handles this)
      if (!data.skipMaterialSync) {
        const materialId = await ensureMaterialRecord(data.masterId, data.trimType, tx);
        const unitMap: Record<string, string> = {
          METERS: 'METER',
          PIECES: 'PIECE',
        };
        const upperUnit = stockData.unit.toUpperCase();
        const unitForStockLevel = unitMap[upperUnit] || upperUnit;
        await syncStockLevelQuantity(materialId, data.quantity, data.warehouseId, unitForStockLevel, tx);
      }

      logInfo(
        `Created ${data.trimType.toLowerCase()}_stock for ${master[config.masterCodeField]}: ${data.quantity} ${stockData.unit}`
      );

      return {
        ...stock,
        trimType: data.trimType,
        masterCode: master[config.masterCodeField],
        masterName: master[config.masterNameField],
      };
    };

    try {
      return data.tx ? await run(data.tx) : await prisma.$transaction(run);
    } catch (error: unknown) {
      logError(`Error creating ${data.trimType.toLowerCase()} stock:`, error);
      throw new Error(
        `Failed to create ${data.trimType.toLowerCase()} stock: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get trim stock by type
   */
  async getTrimStock(
    trimType: TrimType,
    filters?: {
      masterId?: string;
      status?: StockStatus;
      minQuantity?: number;
      warehouseLocation?: string;
    }
  ): Promise<TrimStockItem[]> {
    const config = TRIM_CONFIG[trimType];
    if (!config) {
      throw new Error(`Unknown trim type: ${trimType}`);
    }

    try {
      const where: any = {
        status: filters?.status || 'AVAILABLE',
      };

      if (filters?.masterId) {
        where[config.masterIdField] = filters.masterId;
      }
      if (filters?.minQuantity !== undefined) {
        where.quantityAvailable = { gte: filters.minQuantity };
      }
      if (filters?.warehouseLocation) {
        where.warehouseLocation = filters.warehouseLocation;
      }

      // Map snake_case relation keys to camelCase Prisma relation names
      const RELATION_NAME_MAP: Record<string, string> = {
        machine_part: 'machinePart',
        other_material: 'otherMaterial',
      };
      const relationKey = config.masterTable.replace('_master', '');
      const actualRelation = RELATION_NAME_MAP[relationKey] || relationKey;

      const stocks = await (prisma as any)[config.table].findMany({
        where,
        include: {
          [actualRelation]: {
            select: {
              id: true,
              [config.masterCodeField]: true,
              [config.masterNameField]: true,
            },
          },
        },
        orderBy: { receivedDate: 'desc' },
      });

      return stocks.map((s: any) => {
        const master = s[actualRelation] || {};
        return {
          id: s.id,
          trimType,
          masterId: s[config.masterIdField],
          masterCode: master[config.masterCodeField] || '',
          masterName: master[config.masterNameField] || '',
          quantityAvailable: Number(s.quantityAvailable),
          quantityReserved: Number(s.quantityReserved),
          quantityConsumed: Number(s.quantityConsumed),
          unit: s.unit,
          purchaseCost: Number(s.purchaseCost),
          weightedAvgCost: Number(s.weightedAvgCost),
          supplierId: s.supplierId,
          batchNumber: s.batchNumber,
          warehouseLocation: s.warehouseLocation,
          qualityGrade: s.qualityGrade,
          receivedDate: s.receivedDate,
          status: s.status,
        };
      });
    } catch (error) {
      logError(`Error fetching ${trimType.toLowerCase()} stock:`, error);
      throw error;
    }
  }

  /**
   * Get stock summary for all trim types
   */
  async getAllTrimStockSummary() {
    const summaries: Record<TrimType, { totalQuantity: number; totalValue: number; entryCount: number }> = {
      BUTTON: { totalQuantity: 0, totalValue: 0, entryCount: 0 },
      ZIPPER: { totalQuantity: 0, totalValue: 0, entryCount: 0 },
      ELASTIC: { totalQuantity: 0, totalValue: 0, entryCount: 0 },
      LABEL: { totalQuantity: 0, totalValue: 0, entryCount: 0 },
      PACKAGING: { totalQuantity: 0, totalValue: 0, entryCount: 0 },
      MACHINE_PART: { totalQuantity: 0, totalValue: 0, entryCount: 0 },
      OTHER_MATERIAL: { totalQuantity: 0, totalValue: 0, entryCount: 0 },
    };

    for (const trimType of Object.keys(TRIM_CONFIG) as TrimType[]) {
      try {
        const result = await (prisma as any)[TRIM_CONFIG[trimType].table].aggregate({
          where: { status: 'AVAILABLE' },
          _sum: { quantityAvailable: true },
          _count: true,
        });

        const valueResult = await (prisma as any).$queryRawUnsafe(`
          SELECT COALESCE(SUM("quantityAvailable" * "weightedAvgCost"), 0) as "totalValue"
          FROM ${TRIM_CONFIG[trimType].table}
          WHERE status = 'AVAILABLE'
        `);

        summaries[trimType] = {
          totalQuantity: Number(result._sum.quantityAvailable || 0),
          totalValue: Number(valueResult[0]?.totalValue || 0),
          entryCount: result._count || 0,
        };
      } catch (err) {
        logError(`Error getting ${trimType} summary:`, err);
      }
    }

    return summaries;
  }
}

export const trimStockService = new TrimStockService();
export default trimStockService;
