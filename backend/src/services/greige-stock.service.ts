// Greige Stock Service - Manage raw greige inventory directly
// This service uses the dedicated greige_stock table (not proxy fabric_master records)
import {
  Prisma,
  PrismaClient,
  StockStatus,
  SpecializedStockTransactionType,
  TransactionReferenceType,
} from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logError, logDebug } from '../utils/logger';
import { ensureMaterialRecord, syncStockLevelQuantity, getDefaultWarehouseId } from './helpers/material-sync.helper';
import { systemSettingsService } from './system-settings.service';
// BUG-GRE5 fix: Import decimal.js utilities for precise WAC/valuation calculations
import { toCurrency, toNumber, roundToCent } from '../utils/currency';

// Type for Prisma transaction client (used when operations need to be atomic with caller's transaction)
type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export interface CreateGreigeStockDTO {
  greigeId: string;
  quantity: number; // Nominal quantity (what supplier measured)
  width: number;
  cutableWidth?: number;
  rollNumbers?: string;
  warehouseId?: string; // Preferred: proper FK to warehouses
  warehouseLocation?: string; // Legacy: text location
  qualityGrade?: string;
  purchaseCost?: number;
  receivedDate?: Date;
  supplierId?: string;
  sourceType?: 'GRN' | 'MANUAL' | 'ADJUSTMENT';
  invoiceNumber?: string;
  invoiceDate?: Date;
  // Fold/Than tracking - for calculating actual meters from nominal
  foldLengthCm?: number; // "L" - fold length in cm (e.g., 97)
  thanCount?: number; // Number of thans in this lot
  skipMaterialSync?: boolean; // Skip ensureMaterialRecord/syncStockLevelQuantity when called from stock routing
  tx?: TransactionClient; // Transaction client - use this instead of global prisma when provided
  // P2: Identity-based reversal
  grnItemId?: string; // Link to grn_items for identity-based reversal
}

export interface GreigeStockItem {
  id: string;
  greigeId: string;
  greige: {
    id: string;
    greigeCode: string;
    greigeName: string;
    composition: string;
    yarnCount?: string | null;
    construction?: string | null;
    weaveType?: string | null;
  };
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  greigeWidth: number;
  cutableWidth?: number | null;
  purchaseCost?: number | null;
  weightedAvgCost?: number | null;
  warehouseId?: string | null;
  warehouse?: { id: string; warehouseCode: string; warehouseName: string } | null;
  warehouseLocation?: string | null;
  rollNumbers?: string | null;
  qualityGrade: string;
  receivedDate: Date;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  agingDays: number;
  status: string;
  stockType: string;
  sourceType?: string | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string; code: string } | null;
  processorId?: string | null;
  processor?: { id: string; name: string; code: string } | null;
}

export interface UpdateGreigeStockDTO {
  purchaseCost?: number;
  weightedAvgCost?: number;
  qualityGrade?: string;
  warehouseLocation?: string;
  rollNumbers?: string;
}

export interface GreigeStockSummary {
  totalMeters: number;
  totalValue: number;
  agingStockCount: number;
  totalItems: number;
  byQualityGrade: Record<string, number>;
}

class GreigeStockService {
  /**
   * Create greige stock entry directly in greige_stock table
   * No more proxy fabric_master records!
   */
  async createGreigeStock(data: CreateGreigeStockDTO, userId: string) {
    // Use transaction client if provided, otherwise use global prisma
    const client = data.tx || prisma;

    try {
      // Validate greige exists
      const greige = await client.greige_master.findUnique({
        where: { id: data.greigeId },
      });
      if (!greige) {
        throw new Error(`Greige with ID ${data.greigeId} not found`);
      }

      // Resolve supplier for procurement record (required field) vs stock record (optional)
      const userSupplierId = data.supplierId || null;

      // fabric_procurement requires a supplierId - use provided or find a system default
      let procurementSupplierId = userSupplierId;
      if (!procurementSupplierId) {
        const fallback = await client.suppliers.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        if (!fallback) {
          throw new Error('No suppliers found in the system. Please create a supplier first.');
        }
        procurementSupplierId = fallback.id;
      }

      // Calculate actual quantity from fold length
      // Nominal = what supplier measured, Actual = nominalQty × (foldLengthCm / 100)
      const nominalQty = data.quantity;
      const actualQty =
        data.foldLengthCm && data.foldLengthCm > 0 && data.foldLengthCm < 100
          ? nominalQty * (data.foldLengthCm / 100)
          : nominalQty; // If no fold length or L=100, actual = nominal

      // BUG-GR8 fix: Cutable width deduction is configurable via system settings
      // Default: 2 (i.e., cutableWidth = greigeWidth - 2)
      const cutableWidthDeduction = await systemSettingsService.getCutableWidthDeductionInches();
      // BUG-GR9 fix: Quality grade default is configurable via system settings
      // Default: 'A' (i.e., Grade A quality)
      const defaultQualityGrade = await systemSettingsService.getDefaultQualityGrade();

      // A lot MUST carry a warehouse: NULL-warehouse lots are invisible to derived_stock_view
      // (every stock page reads it), and the ledger sync then lands at a warehouse the lot
      // doesn't reference — permanent lot↔ledger disagreement (GRG-0006 class). When the form
      // doesn't name one, use the same company-default fallback the sync helper uses.
      const lotWarehouseId = data.warehouseId || (await getDefaultWarehouseId(client)) || null;

      // Create procurement record for traceability
      // Use ACTUAL quantity for financial calculation
      const procurement = await client.fabric_procurement.create({
        data: {
          id: `PROC-GRG-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          procurementType: 'GREIGE',
          supplierId: procurementSupplierId,
          greigeId: data.greigeId,
          quantityPurchased: new Prisma.Decimal(actualQty), // ACTUAL (billable)
          unit: 'meters',
          width: new Prisma.Decimal(data.width),
          ratePerUnit: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : new Prisma.Decimal(0),
          // BUG-GRE5 fix: Use decimal.js for precise total cost calculation
          totalCost: data.purchaseCost
            ? new Prisma.Decimal(toNumber(toCurrency(actualQty).times(toCurrency(data.purchaseCost))))
            : new Prisma.Decimal(0), // ACTUAL × rate
          orderedForStyleId: null, // Generic, not style-specific
          isStockPurchase: true,
          processingRequired: false,
          status: 'RECEIVED',
          purchaseDate: data.receivedDate || new Date(),
          receivedDate: data.receivedDate || new Date(),
          invoiceNumber: data.invoiceNumber || null,
          invoiceDate: data.invoiceDate || null,
          createdById: userId,
        },
      });

      // Create greige stock record directly (no more proxy fabric_master!)
      // Store ACTUAL quantity as available, NOMINAL as reference
      const greigeStock = await client.greige_stock.create({
        data: {
          greigeId: data.greigeId,
          quantityAvailable: new Prisma.Decimal(actualQty), // ACTUAL (what's really available)
          quantityReserved: new Prisma.Decimal(0),
          quantityConsumed: new Prisma.Decimal(0),
          unit: 'meters',
          greigeWidth: new Prisma.Decimal(data.width),
          cutableWidth: data.cutableWidth
            ? new Prisma.Decimal(data.cutableWidth)
            : new Prisma.Decimal(data.width - cutableWidthDeduction), // Default cutable = width - configurable deduction
          purchaseCost: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : null,
          weightedAvgCost: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : null,
          procurementId: procurement.id,
          supplierId: userSupplierId,
          sourceType: data.sourceType || 'MANUAL', // Track source: GRN, MANUAL, or ADJUSTMENT
          warehouseId: lotWarehouseId,
          warehouseLocation: data.warehouseLocation || null,
          rollNumbers: data.rollNumbers || null,
          qualityGrade: data.qualityGrade || defaultQualityGrade,
          receivedDate: data.receivedDate || new Date(),
          invoiceNumber: data.invoiceNumber || null,
          invoiceDate: data.invoiceDate || null,
          // Fold/Than tracking
          foldLengthCm: data.foldLengthCm ? new Prisma.Decimal(data.foldLengthCm) : null,
          thanCount: data.thanCount || null,
          nominalQuantity: new Prisma.Decimal(nominalQty), // What supplier measured
          calculatedActualMeters: new Prisma.Decimal(actualQty), // nominalQty × L/100
          // P2: Identity-based reversal
          grnItemId: data.grnItemId || null,
          agingDays: 0,
          status: 'AVAILABLE',
          stockType: 'GENERIC',
          createdById: userId,
        },
        include: {
          greige: {
            select: {
              id: true,
              greigeCode: true,
              greigeName: true,
              composition: true,
            },
          },
        },
      });

      // Ensure materials record exists + sync stock_levels with ACTUAL quantity — at the SAME
      // warehouse the lot was stamped with, so lot and ledger can never disagree on location.
      // Skip when called from stock routing (parent already handles this)
      if (!data.skipMaterialSync) {
        await ensureMaterialRecord(data.greigeId, 'GREIGE', data.tx);
        await syncStockLevelQuantity(data.greigeId, actualQty, lotWarehouseId || undefined, undefined, data.tx);
      }

      logInfo(
        `Created greige stock for ${greige.greigeCode}: ${actualQty} meters (nominal: ${nominalQty}, L=${data.foldLengthCm || 100})`
      );

      return greigeStock;
    } catch (error: unknown) {
      logError('Error creating greige stock:', error);
      throw new Error(`Failed to create greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all available greige stock
   */
  async getGreigeStock(filters?: {
    greigeId?: string;
    status?: StockStatus;
    minQuantity?: number;
    supplierId?: string;
    processorId?: string;
    sourceType?: string;
    warehouseLocation?: string;
    excludeTransferred?: boolean;
  }): Promise<GreigeStockItem[]> {
    try {
      const where: Prisma.greige_stockWhereInput = {
        status: filters?.status || 'AVAILABLE',
      };

      if (filters?.greigeId) {
        where.greigeId = filters.greigeId;
      }

      if (filters?.minQuantity !== undefined) {
        where.quantityAvailable = { gte: filters.minQuantity };
      }

      if (filters?.supplierId) {
        where.supplierId = filters.supplierId;
      }

      if (filters?.processorId) {
        where.processorId = filters.processorId;
      }

      if (filters?.sourceType) {
        where.sourceType = filters.sourceType;
      }

      if (filters?.warehouseLocation) {
        where.warehouseLocation = filters.warehouseLocation;
      }

      if (filters?.excludeTransferred) {
        // Exclude transferred stock - include null sourceType (regular stock) and non-TRANSFER types
        where.OR = [{ sourceType: null }, { sourceType: { not: 'TRANSFER' } }];
      }

      const stocks = await prisma.greige_stock.findMany({
        where,
        include: {
          greige: {
            select: {
              id: true,
              greigeCode: true,
              greigeName: true,
              composition: true,
              yarnCount: true,
              construction: true,
              weaveType: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              warehouseCode: true,
              warehouseName: true,
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          processor: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          sourceChallan: {
            select: {
              id: true,
              challanNumber: true,
              challanDate: true,
            },
          },
        },
        orderBy: { receivedDate: 'desc' },
      });

      return stocks.map((stock) => {
        const agingDays = stock.receivedDate
          ? Math.floor((Date.now() - new Date(stock.receivedDate).getTime()) / (1000 * 60 * 60 * 24))
          : stock.agingDays;

        return {
          id: stock.id,
          greigeId: stock.greigeId,
          greige: stock.greige,
          quantityAvailable: Number(stock.quantityAvailable),
          quantityReserved: Number(stock.quantityReserved),
          quantityConsumed: Number(stock.quantityConsumed),
          greigeWidth: Number(stock.greigeWidth),
          cutableWidth: stock.cutableWidth ? Number(stock.cutableWidth) : null,
          purchaseCost: stock.purchaseCost ? Number(stock.purchaseCost) : null,
          weightedAvgCost: stock.weightedAvgCost ? Number(stock.weightedAvgCost) : null,
          warehouseId: stock.warehouseId,
          warehouse: stock.warehouse,
          warehouseLocation: stock.warehouseLocation,
          rollNumbers: stock.rollNumbers,
          qualityGrade: stock.qualityGrade,
          receivedDate: new Date(stock.receivedDate),
          agingDays,
          status: stock.status,
          stockType: stock.stockType,
          sourceType: stock.sourceType,
          supplierId: stock.supplierId,
          supplier: stock.supplier,
          processorId: stock.processorId,
          processor: stock.processor,
          sourceChallanId: stock.sourceChallanId,
          sourceChallan: stock.sourceChallan,
        };
      });
    } catch (error: unknown) {
      logError('Error getting greige stock:', error);
      throw new Error(`Failed to get greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get greige stock summary for dashboard
   */
  async getGreigeStockSummary(): Promise<GreigeStockSummary> {
    try {
      // BUG-GR10 fix: Aging threshold is configurable via system settings.
      // Setting key: STOCK_AGING_THRESHOLD_DAYS (default: 180 days)
      // Stock older than this threshold is flagged as "aging" in dashboard summaries.
      const agingThresholdDays = await systemSettingsService.getNumberDefault('STOCK_AGING_THRESHOLD_DAYS');
      const defaultQualityGrade = await systemSettingsService.getDefaultQualityGrade();

      const stocks = await prisma.greige_stock.findMany({
        where: {
          status: 'AVAILABLE',
          quantityAvailable: { gt: 0 },
        },
        select: {
          quantityAvailable: true,
          purchaseCost: true,
          weightedAvgCost: true,
          receivedDate: true,
          qualityGrade: true,
        },
      });

      // BUG-GRE5 fix: Use decimal.js for precise valuation calculations to avoid floating point errors
      let totalMetersDec = toCurrency(0);
      let totalValueDec = toCurrency(0);
      let agingStockCount = 0;
      const byQualityGrade: Record<string, number> = {};

      stocks.forEach((stock) => {
        // BUG-GRE5 fix: Convert Prisma Decimal to decimal.js for precise arithmetic
        const quantity = toCurrency(Number(stock.quantityAvailable));
        const cost = toCurrency(Number(stock.weightedAvgCost || stock.purchaseCost || 0));

        totalMetersDec = totalMetersDec.plus(quantity);
        totalValueDec = totalValueDec.plus(quantity.times(cost));

        // Track by quality grade
        const grade = stock.qualityGrade || defaultQualityGrade;
        byQualityGrade[grade] = (byQualityGrade[grade] || 0) + toNumber(quantity);

        // Check aging using configurable threshold
        const agingDays = stock.receivedDate
          ? Math.floor((Date.now() - new Date(stock.receivedDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        if (agingDays >= agingThresholdDays) {
          agingStockCount++;
        }
      });

      return {
        totalMeters: toNumber(roundToCent(totalMetersDec)),
        totalValue: toNumber(roundToCent(totalValueDec)),
        agingStockCount,
        totalItems: stocks.length,
        byQualityGrade,
      };
    } catch (error: unknown) {
      logError('Error getting greige stock summary:', error);
      throw new Error(
        `Failed to get greige stock summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Reserve greige stock for processing
   */
  async reserveGreigeStock(stockId: string, quantity: number, userId: string) {
    try {
      const stock = await prisma.greige_stock.findUnique({
        where: { id: stockId },
      });

      if (!stock) {
        throw new Error(`Greige stock with ID ${stockId} not found`);
      }

      const available = Number(stock.quantityAvailable);

      // Guarded atomic reserve: the availability check and the decrement happen in ONE statement,
      // so two concurrent reservations cannot both pass a stale check and oversell the lot.
      const reserveResult = await prisma.greige_stock.updateMany({
        where: { id: stockId, quantityAvailable: { gte: quantity } },
        data: {
          quantityAvailable: { decrement: quantity },
          quantityReserved: { increment: quantity },
        },
      });

      if (reserveResult.count === 0) {
        throw new Error(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
      }

      const updatedStock = await prisma.greige_stock.findUnique({
        where: { id: stockId },
        include: {
          greige: {
            select: {
              greigeCode: true,
              greigeName: true,
            },
          },
        },
      });

      logInfo(`Reserved ${quantity} meters of greige stock ${stockId}`);

      return updatedStock;
    } catch (error: unknown) {
      logError('Error reserving greige stock:', error);
      throw new Error(`Failed to reserve greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Consume greige stock (issue to processor / challan issuance).
   *
   * SEMANTICS (2026-08-19): consumes AVAILABLE only — quantityReserved is NEVER touched.
   * MRP's reservation overlay only increments quantityReserved (advisory, goods stay in
   * available), and hard reserves (reserveGreigeStock) REMOVE qty from available — so an
   * available-only consume is correct under both and can never steal another order's
   * reservation. The availability check and the decrement are ONE guarded statement,
   * so concurrent consumers cannot both pass a stale check (no read-then-write).
   */
  async consumeGreigeStock(
    stockId: string,
    quantity: number,
    userId: string,
    tx?: TransactionClient,
    options?: { referenceType?: 'CHALLAN' | 'JOB_WORK_ORDER'; referenceId?: string; notes?: string }
  ) {
    try {
      // When a caller's transaction is supplied, run every write on it so the consumption commits/rolls
      // back atomically with the caller (e.g. challan issuance); otherwise use the global client.
      const client = tx || prisma;

      // Guarded atomic consume — the check IS the write (same pattern as reserveGreigeStock)
      const consumeResult = await client.greige_stock.updateMany({
        where: { id: stockId, quantityAvailable: { gte: quantity } },
        data: {
          quantityAvailable: { decrement: quantity },
          quantityConsumed: { increment: quantity },
          lastConsumedDate: new Date(),
        },
      });
      if (consumeResult.count === 0) {
        const row = await client.greige_stock.findUnique({ where: { id: stockId } });
        if (!row) throw new Error(`Greige stock with ID ${stockId} not found`);
        const available = Number(row.quantityAvailable);
        const reserved = Number(row.quantityReserved);
        throw new Error(
          `Insufficient stock. Available: ${available}, Requested: ${quantity}` +
            (reserved > 0 ? ` (${reserved} is hard-reserved and cannot be consumed here)` : '')
        );
      }

      // Exhausted only when nothing remains in either bucket
      await client.greige_stock.updateMany({
        where: { id: stockId, quantityAvailable: { lte: 0 }, quantityReserved: { lte: 0 } },
        data: { status: 'EXHAUSTED' },
      });

      const updatedStock = await client.greige_stock.findUnique({ where: { id: stockId } });
      if (!updatedStock) {
        throw new Error(`Greige stock with ID ${stockId} not found after consumption`);
      }

      // Create audit trail for consumption
      const costPerUnit = updatedStock.purchaseCost
        ? Number(updatedStock.purchaseCost)
        : updatedStock.weightedAvgCost
          ? Number(updatedStock.weightedAvgCost)
          : null;
      await client.greige_stock_transaction.create({
        data: {
          stockId,
          transactionType: 'CONSUMPTION',
          quantity: new Prisma.Decimal(-quantity),
          balanceAfter: updatedStock.quantityAvailable,
          costPerUnit: costPerUnit !== null ? new Prisma.Decimal(costPerUnit) : null,
          // BUG-GRE5 fix: Use decimal.js for precise totalValue calculation
          totalValue:
            costPerUnit !== null
              ? new Prisma.Decimal(toNumber(toCurrency(quantity).times(toCurrency(costPerUnit))))
              : null,
          referenceType: options?.referenceType ?? 'CHALLAN',
          referenceId: options?.referenceId ?? null,
          notes: options?.notes ?? `Consumed via challan issuance`,
          performedById: userId,
        },
      });

      // BUG-INV3 fix: find materials.id instead of using greigeId directly
      // (greigeId is a FK to greige_master, but syncStockLevelQuantity expects materials.id)
      const material = await client.materials.findFirst({
        where: { greigeId: updatedStock.greigeId },
        select: { id: true },
      });
      if (material) {
        // Pass `client` (not the possibly-undefined outer tx var) so the sync always joins the tx
        await syncStockLevelQuantity(material.id, -quantity, updatedStock.warehouseId || undefined, 'METER', client);
      } else {
        logError(
          `[GreigeStock] No materials shim row for greige ${updatedStock.greigeId} — stock_levels NOT synced for ` +
            `${quantity}m consumption (stock ${stockId}). Run backfill-greige-materials-mirror.ts.`,
          new Error('missing materials mirror')
        );
      }

      logInfo(`Consumed ${quantity} meters of greige stock ${stockId}`);

      return updatedStock;
    } catch (error: unknown) {
      logError('Error consuming greige stock:', error);
      throw new Error(`Failed to consume greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get greige stock by ID
   */
  async getGreigeStockById(stockId: string): Promise<GreigeStockItem | null> {
    try {
      const stock = await prisma.greige_stock.findUnique({
        where: { id: stockId },
        include: {
          greige: {
            select: {
              id: true,
              greigeCode: true,
              greigeName: true,
              composition: true,
              yarnCount: true,
              construction: true,
              weaveType: true,
            },
          },
        },
      });

      if (!stock) {
        return null;
      }

      const agingDays = stock.receivedDate
        ? Math.floor((Date.now() - new Date(stock.receivedDate).getTime()) / (1000 * 60 * 60 * 24))
        : stock.agingDays;

      return {
        id: stock.id,
        greigeId: stock.greigeId,
        greige: stock.greige,
        quantityAvailable: Number(stock.quantityAvailable),
        quantityReserved: Number(stock.quantityReserved),
        quantityConsumed: Number(stock.quantityConsumed),
        greigeWidth: Number(stock.greigeWidth),
        cutableWidth: stock.cutableWidth ? Number(stock.cutableWidth) : null,
        purchaseCost: stock.purchaseCost ? Number(stock.purchaseCost) : null,
        weightedAvgCost: stock.weightedAvgCost ? Number(stock.weightedAvgCost) : null,
        warehouseLocation: stock.warehouseLocation,
        rollNumbers: stock.rollNumbers,
        qualityGrade: stock.qualityGrade,
        receivedDate: new Date(stock.receivedDate),
        agingDays,
        status: stock.status,
        stockType: stock.stockType,
      };
    } catch (error: unknown) {
      logError('Error getting greige stock by ID:', error);
      throw new Error(`Failed to get greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update aging days for all stock (called by scheduled job)
   */
  async updateAgingDays() {
    try {
      const stocks = await prisma.greige_stock.findMany({
        where: { status: 'AVAILABLE' },
        select: { id: true, receivedDate: true },
      });

      for (const stock of stocks) {
        const agingDays = stock.receivedDate
          ? Math.floor((Date.now() - new Date(stock.receivedDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        await prisma.greige_stock.update({
          where: { id: stock.id },
          data: { agingDays },
        });
      }

      logDebug(`Updated aging days for ${stocks.length} greige stock records`);
    } catch (error: unknown) {
      logError('Error updating aging days:', error);
      throw new Error(`Failed to update aging days: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a greige stock entry
   */
  async updateGreigeStock(stockId: string, data: UpdateGreigeStockDTO) {
    const existing = await prisma.greige_stock.findUnique({ where: { id: stockId } });
    if (!existing) {
      throw new Error(`Greige stock with ID ${stockId} not found`);
    }

    const updateData: Prisma.greige_stockUpdateInput = {};
    if (data.purchaseCost !== undefined) updateData.purchaseCost = new Prisma.Decimal(data.purchaseCost);
    if (data.weightedAvgCost !== undefined) updateData.weightedAvgCost = new Prisma.Decimal(data.weightedAvgCost);
    if (data.qualityGrade !== undefined) updateData.qualityGrade = data.qualityGrade;
    if (data.warehouseLocation !== undefined) updateData.warehouseLocation = data.warehouseLocation;
    if (data.rollNumbers !== undefined) updateData.rollNumbers = data.rollNumbers;

    const updated = await prisma.greige_stock.update({
      where: { id: stockId },
      data: updateData,
      include: {
        greige: {
          select: { id: true, greigeCode: true, greigeName: true, composition: true },
        },
        supplier: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    logInfo(`Updated greige stock ${stockId}`);
    return updated;
  }

  /**
   * Delete a greige stock entry (checks dependencies first)
   * BUG-INV2 fix: Syncs stock_levels before deletion to prevent orphan quantities
   */
  async deleteGreigeStock(stockId: string) {
    const existing = await prisma.greige_stock.findUnique({
      where: { id: stockId },
      include: {
        _count: {
          select: {
            challanItems: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error(`Greige stock with ID ${stockId} not found`);
    }

    if (existing._count.challanItems > 0) {
      throw new Error(`Cannot delete: ${existing._count.challanItems} challan item(s) reference this stock entry`);
    }

    // BUG-INV2 fix: Sync stock_levels before deleting greige_stock
    // Find the materials record linked to this greige and decrement stock_levels
    const material = await prisma.materials.findFirst({
      where: { greigeId: existing.greigeId },
      select: { id: true },
    });
    if (material) {
      const quantityToRemove = -Number(existing.quantityAvailable);
      await syncStockLevelQuantity(material.id, quantityToRemove, existing.warehouseId || undefined);
      logInfo(`Stock levels synced: removed ${-quantityToRemove}m for material ${material.id}`);
    } else {
      logDebug(`No materials record found for greigeId ${existing.greigeId} - stock_levels not synced`);
    }

    await prisma.greige_stock.delete({ where: { id: stockId } });
    logInfo(`Deleted greige stock ${stockId}`);
  }

  /**
   * Adjust greige stock quantity (increase/decrease with reason for audit trail)
   */
  async adjustGreigeStock(
    stockId: string,
    data: { adjustmentType: 'INCREASE' | 'DECREASE'; quantity: number; reason: string; remarks?: string },
    userId: string
  ) {
    const existing = await prisma.greige_stock.findUnique({
      where: { id: stockId },
      include: { greige: { select: { greigeCode: true, greigeName: true } } },
    });

    if (!existing) {
      throw new Error(`Greige stock with ID ${stockId} not found`);
    }

    const currentQty = Number(existing.quantityAvailable);

    if (data.adjustmentType === 'DECREASE') {
      if (data.quantity > currentQty) {
        throw new Error(`Cannot decrease by ${data.quantity}. Only ${currentQty} meters available.`);
      }
    }

    const newQty = data.adjustmentType === 'INCREASE' ? currentQty + data.quantity : currentQty - data.quantity;

    const updated = await prisma.greige_stock.update({
      where: { id: stockId },
      data: {
        quantityAvailable: new Prisma.Decimal(newQty),
        status: newQty <= 0 ? 'EXHAUSTED' : 'AVAILABLE',
      },
    });

    // Create audit trail in greige_stock_transaction table
    const costPerUnit = existing.purchaseCost
      ? Number(existing.purchaseCost)
      : existing.weightedAvgCost
        ? Number(existing.weightedAvgCost)
        : null;
    await prisma.greige_stock_transaction.create({
      data: {
        stockId,
        transactionType: data.adjustmentType === 'INCREASE' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        quantity: new Prisma.Decimal(data.adjustmentType === 'INCREASE' ? data.quantity : -data.quantity),
        balanceAfter: new Prisma.Decimal(newQty),
        costPerUnit: costPerUnit !== null ? new Prisma.Decimal(costPerUnit) : null,
        // BUG-GRE5 fix: Use decimal.js for precise totalValue calculation
        totalValue:
          costPerUnit !== null
            ? new Prisma.Decimal(toNumber(toCurrency(data.quantity).times(toCurrency(costPerUnit))))
            : null,
        referenceType: 'MANUAL',
        notes: `${data.reason}${data.remarks ? ' - ' + data.remarks : ''}`,
        performedById: userId,
      },
    });

    // Sync stock_levels - find materialId by greigeId FK
    const adjustChange = data.adjustmentType === 'INCREASE' ? data.quantity : -data.quantity;
    const material = await prisma.materials.findFirst({
      where: { greigeId: existing.greigeId },
      select: { id: true },
    });
    if (material) {
      await syncStockLevelQuantity(material.id, adjustChange, existing.warehouseId || undefined);
    }

    logInfo(
      `Stock adjustment: ${data.adjustmentType} ${data.quantity}m on ${existing.greige.greigeCode} (${stockId}). ` +
        `Reason: ${data.reason}. ${data.remarks || ''}. New qty: ${newQty}. By user: ${userId}`
    );

    return {
      stockId,
      adjustmentType: data.adjustmentType,
      quantity: data.quantity,
      reason: data.reason,
      remarks: data.remarks,
      previousQuantity: currentQty,
      newQuantity: newQty,
    };
  }

  /**
   * Get processors that have available greige stock from transfers
   * Used for processor return flow in Stock In
   */
  async getProcessorsWithGreigeStock(): Promise<
    Array<{
      processorId: string;
      processorName: string;
      processorCode: string;
      warehouseName: string | null;
      totalQuantity: number;
      stockEntries: number;
    }>
  > {
    try {
      // Find all greige stock at processor warehouses (sourceType = TRANSFER)
      // BUG-INV2 fix: Group by warehouseId (FK) instead of warehouseLocation (text field)
      const processorStock = await prisma.greige_stock.groupBy({
        by: ['processorId', 'warehouseId'],
        where: {
          processorId: { not: null },
          sourceType: 'TRANSFER',
          status: 'AVAILABLE',
          quantityAvailable: { gt: 0 },
        },
        _sum: { quantityAvailable: true },
        _count: { id: true },
      });

      // Get processor details (processors are suppliers with processor categories)
      const processorIds = processorStock.map((s) => s.processorId).filter((id): id is string => id !== null);
      const warehouseIds = processorStock.map((s) => s.warehouseId).filter((id): id is string => id !== null);

      const [processors, warehouses] = await Promise.all([
        prisma.suppliers.findMany({
          where: { id: { in: processorIds } },
          select: { id: true, name: true, code: true },
        }),
        prisma.warehouses.findMany({
          where: { id: { in: warehouseIds } },
          select: { id: true, warehouseName: true },
        }),
      ]);

      const processorMap = new Map(processors.map((p) => [p.id, p]));
      const warehouseMap = new Map(warehouses.map((w) => [w.id, w.warehouseName]));

      return processorStock
        .filter((s) => s.processorId && processorMap.has(s.processorId))
        .map((s) => {
          const processor = processorMap.get(s.processorId!)!;
          return {
            processorId: s.processorId!,
            processorName: processor.name,
            processorCode: processor.code,
            warehouseName: s.warehouseId ? warehouseMap.get(s.warehouseId) || null : null,
            totalQuantity: Number(s._sum.quantityAvailable) || 0,
            stockEntries: s._count.id,
          };
        });
    } catch (error: unknown) {
      logError('Error getting processors with greige stock:', error);
      throw new Error(
        `Failed to get processors with greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get greige stock at a specific processor (for processor return)
   */
  async getProcessorGreigeStock(processorId: string): Promise<GreigeStockItem[]> {
    return this.getGreigeStock({
      processorId: processorId,
      sourceType: 'TRANSFER',
      status: 'AVAILABLE',
      minQuantity: 0.01,
    });
  }

  /**
   * Consume greige from processor's stock when receiving processed goods
   * Creates audit trail with shrinkage tracking
   */
  async consumeFromProcessor(
    stockId: string,
    sentQuantity: number,
    receivedQuantity: number,
    userId: string,
    options?: {
      notes?: string;
      referenceType?: TransactionReferenceType;
      referenceId?: string;
    }
  ): Promise<{
    sentQuantity: number;
    receivedQuantity: number;
    shrinkageQuantity: number;
    shrinkagePercent: number;
  }> {
    const stock = await prisma.greige_stock.findUnique({
      where: { id: stockId },
      include: { greige: { select: { greigeCode: true, greigeName: true } } },
    });

    if (!stock) {
      throw new Error(`Greige stock with ID ${stockId} not found`);
    }

    // Validate stock is at a processor
    if (!stock.processorId || stock.sourceType !== 'TRANSFER') {
      throw new Error('Stock is not at a processor warehouse. Cannot consume from processor.');
    }

    const available = Number(stock.quantityAvailable);

    // Calculate shrinkage
    const shrinkageQuantity = sentQuantity - receivedQuantity;
    const shrinkagePercent = sentQuantity > 0 ? (shrinkageQuantity / sentQuantity) * 100 : 0;

    // Consume the sent quantity from processor's stock.
    // Guarded atomic decrement: the availability check and the write happen in ONE statement,
    // so a concurrent consumption cannot pass a stale check and drive the balance negative.
    const newAvailable = available - sentQuantity;
    const consumeResult = await prisma.greige_stock.updateMany({
      where: { id: stockId, quantityAvailable: { gte: sentQuantity } },
      data: {
        quantityAvailable: { decrement: sentQuantity },
        quantityConsumed: { increment: sentQuantity },
        lastConsumedDate: new Date(),
      },
    });
    if (consumeResult.count === 0) {
      throw new Error(`Cannot consume ${sentQuantity}. Only ${available} meters available at processor.`);
    }
    // Mark exhausted based on the ACTUAL stored balance (not the pre-read snapshot)
    await prisma.greige_stock.updateMany({
      where: { id: stockId, quantityAvailable: { lte: 0 } },
      data: { status: 'EXHAUSTED' },
    });

    // Create audit trail
    const costPerUnit = stock.purchaseCost
      ? Number(stock.purchaseCost)
      : stock.weightedAvgCost
        ? Number(stock.weightedAvgCost)
        : null;

    await prisma.greige_stock_transaction.create({
      data: {
        stockId,
        transactionType: 'RECEIPT', // Receiving greige back from processor
        quantity: new Prisma.Decimal(-sentQuantity),
        balanceAfter: new Prisma.Decimal(newAvailable),
        costPerUnit: costPerUnit !== null ? new Prisma.Decimal(costPerUnit) : null,
        // BUG-GRE5 fix: Use decimal.js for precise totalValue calculation
        totalValue:
          costPerUnit !== null
            ? new Prisma.Decimal(toNumber(toCurrency(sentQuantity).times(toCurrency(costPerUnit))))
            : null,
        referenceType: options?.referenceType || 'PROCESSING_DELIVERY',
        referenceId: options?.referenceId,
        notes:
          `Processor return: Sent ${sentQuantity}m, Received ${receivedQuantity}m. ` +
          `Shrinkage: ${shrinkageQuantity.toFixed(2)}m (${shrinkagePercent.toFixed(2)}%). ` +
          (options?.notes || ''),
        performedById: userId,
      },
    });

    // Keep the central ledger in sync — this stock left the processor's warehouse. Without it the
    // Stock Levels page OVERSTATES greige (GRG-0034 was +17,080m). Guarded by warehouseId so we
    // decrement the specific warehouse, never all of them (bug-hunt BH-0305).
    // BUG-INV3 fix: find materials.id instead of using greigeId directly
    if (stock.warehouseId) {
      const material = await prisma.materials.findFirst({
        where: { greigeId: stock.greigeId },
        select: { id: true },
      });
      if (material) {
        await syncStockLevelQuantity(material.id, -sentQuantity, stock.warehouseId);
      }
    }

    logInfo(
      `Processor return: ${stock.greige.greigeCode} - Sent ${sentQuantity}m, Received ${receivedQuantity}m, ` +
        `Shrinkage: ${shrinkagePercent.toFixed(2)}%`
    );

    return {
      sentQuantity,
      receivedQuantity,
      shrinkageQuantity,
      shrinkagePercent,
    };
  }

  /**
   * Receive partial quantity from processor's stock
   * Used for partial returns - NO shrinkage calculation (shrinkage is a reconciliation exercise)
   *
   * @param stockId - The processor's greige stock entry ID
   * @param receivedQuantity - Quantity being received now (partial)
   * @param userId - User performing the action
   * @param options - Additional options (notes, reference)
   */
  async receiveFromProcessor(
    stockId: string,
    receivedQuantity: number,
    userId: string,
    options?: {
      notes?: string;
      referenceType?: TransactionReferenceType;
      referenceId?: string;
    }
  ): Promise<{
    receivedQuantity: number;
    remainingAtProcessor: number;
  }> {
    const stock = await prisma.greige_stock.findUnique({
      where: { id: stockId },
      include: { greige: { select: { greigeCode: true, greigeName: true } } },
    });

    if (!stock) {
      throw new Error(`Greige stock with ID ${stockId} not found`);
    }

    // Validate stock is at a processor
    if (!stock.processorId || stock.sourceType !== 'TRANSFER') {
      throw new Error('Stock is not at a processor warehouse. Cannot receive from processor.');
    }

    const available = Number(stock.quantityAvailable);

    // Consume the received quantity from processor's stock.
    // Guarded atomic decrement: the availability check and the write happen in ONE statement,
    // so a concurrent receipt cannot pass a stale check and drive the balance negative.
    const remainingAtProcessor = available - receivedQuantity;
    const receiveResult = await prisma.greige_stock.updateMany({
      where: { id: stockId, quantityAvailable: { gte: receivedQuantity } },
      data: {
        quantityAvailable: { decrement: receivedQuantity },
        quantityConsumed: { increment: receivedQuantity },
        lastConsumedDate: new Date(),
      },
    });
    if (receiveResult.count === 0) {
      throw new Error(`Cannot receive ${receivedQuantity}. Only ${available} meters available at processor.`);
    }
    // Mark exhausted based on the ACTUAL stored balance (not the pre-read snapshot)
    await prisma.greige_stock.updateMany({
      where: { id: stockId, quantityAvailable: { lte: 0 } },
      data: { status: 'EXHAUSTED' },
    });

    // Create audit trail
    const costPerUnit = stock.purchaseCost
      ? Number(stock.purchaseCost)
      : stock.weightedAvgCost
        ? Number(stock.weightedAvgCost)
        : null;

    await prisma.greige_stock_transaction.create({
      data: {
        stockId,
        transactionType: 'RECEIPT', // Receiving greige back from processor
        quantity: new Prisma.Decimal(-receivedQuantity),
        balanceAfter: new Prisma.Decimal(remainingAtProcessor),
        costPerUnit: costPerUnit !== null ? new Prisma.Decimal(costPerUnit) : null,
        // BUG-GRE5 fix: Use decimal.js for precise totalValue calculation
        totalValue:
          costPerUnit !== null
            ? new Prisma.Decimal(toNumber(toCurrency(receivedQuantity).times(toCurrency(costPerUnit))))
            : null,
        referenceType: options?.referenceType || 'PROCESSING_DELIVERY',
        referenceId: options?.referenceId,
        notes:
          `Partial receipt from processor: ${receivedQuantity}m received. ` +
          `Remaining at processor: ${remainingAtProcessor.toFixed(2)}m. ` +
          (options?.notes || ''),
        performedById: userId,
      },
    });

    // Keep the central ledger in sync — this stock left the processor's warehouse (bug-hunt BH-0305).
    // Guarded by warehouseId so we decrement the specific warehouse, never all of them.
    // BUG-INV3 fix: find materials.id instead of using greigeId directly
    if (stock.warehouseId) {
      const material = await prisma.materials.findFirst({
        where: { greigeId: stock.greigeId },
        select: { id: true },
      });
      if (material) {
        await syncStockLevelQuantity(material.id, -receivedQuantity, stock.warehouseId);
      }
    }

    logInfo(
      `Processor receipt: ${stock.greige.greigeCode} - Received ${receivedQuantity}m, ` +
        `Remaining at processor: ${remainingAtProcessor.toFixed(2)}m`
    );

    return {
      receivedQuantity,
      remainingAtProcessor,
    };
  }
}

export default new GreigeStockService();
