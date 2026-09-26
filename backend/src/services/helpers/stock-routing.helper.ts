/**
 * Stock Routing Helper
 *
 * Routes stock operations to the appropriate specialized stock table
 * based on material type (detected via FK presence on materials record).
 *
 * Two main functions:
 * 1. routeToSpecializedStock() - For STOCK_IN: creates records in specialized tables
 * 2. routeFromSpecializedStock() - For STOCK_OUT/TRANSFER: deducts from specialized tables using FIFO
 *
 * This ensures manual Stock IN/OUT entries properly sync specialized stock records
 * (greige_stock, fabric_stock, lace_stock, etc.) instead of only updating
 * the generic stock_levels table.
 *
 * CRITICAL: These helpers must be called for every STOCK_IN/OUT operation in
 * stockMovement.service.ts to maintain data consistency across all 11 material types.
 */

import { Prisma, TransactionReferenceType } from '@prisma/client';
import prisma from '../../config/database';
import greigeStockService from '../greige-stock.service';
import { createLaceStock } from '../laceStock.service';
import threadStockService from '../thread-stock.service';
import trimStockService, { TrimType } from '../trim-stock.service';
import { logInfo, logError, logWarn } from '../../utils/logger';
import { systemSettingsService } from '../system-settings.service';
// BUG-GR9 fix: Use centralized quality grade default instead of hardcoding 'A'
import { getQualityGradeOrDefault } from '../../constants/stock.constants';
import { foldActual } from '../../utils/fold-length';
import { isQtyZero, qtyExceeds, snapToLimit } from '../../utils/quantity';
import { BusinessError } from '../../errors';

export interface StockInRoutingData {
  materialId: string;
  /** The COUNTED figure when foldLengthCm is given (converted here, once); otherwise actual. */
  quantity: number;
  rate?: number;
  warehouseId?: string;
  foldLengthCm?: number;
  thanCount?: number;
  rollNumbers?: string; // Comma-separated roll numbers (Greige only)
  invoiceNumber?: string;
  invoiceDate?: Date; // Invoice date for backdated entries
  receivedDate?: Date; // Backdating support (defaults to today if not provided)
  batchNumber?: string;
  lotNumber?: string;
  qualityGrade?: string;
  performedById: string;
  /** GRN receipts: who supplied it and which PO — a GRN reversal finds its lot by the PO */
  supplierId?: string;
  procurementId?: string;
  /** The lot's unit (the stock unit — pieces for buttons bought by the gross) */
  unit?: string;
  sourceType?: 'GRN' | 'MANUAL' | 'ADJUSTMENT' | 'IMPORT';
}

export interface StockInRoutingOptions {
  /** Rethrow instead of logging — a GRN must not approve with its lot silently missing */
  strict?: boolean;
  /** Only trim lots (the GRN's generic path) — greige/fabric/lace/thread have their own GRN branches */
  trimsOnly?: boolean;
}

type TrimFk = 'buttonId' | 'zipperId' | 'elasticId' | 'labelId' | 'packagingId' | 'machinePartId' | 'otherMaterialId';

/** The ONE list of trim lot tables — which materials FK puts a lot in which table. */
export const TRIM_LOT_TABLES: ReadonlyArray<{ fkField: TrimFk; table: string; trimType: TrimType }> = [
  { fkField: 'buttonId', table: 'button_stock', trimType: 'BUTTON' },
  { fkField: 'zipperId', table: 'zipper_stock', trimType: 'ZIPPER' },
  { fkField: 'elasticId', table: 'elastic_stock', trimType: 'ELASTIC' },
  { fkField: 'labelId', table: 'label_stock', trimType: 'LABEL' },
  { fkField: 'packagingId', table: 'packaging_stock', trimType: 'PACKAGING' },
  { fkField: 'machinePartId', table: 'machine_part_stock', trimType: 'MACHINE_PART' },
  { fkField: 'otherMaterialId', table: 'other_material_stock', trimType: 'OTHER_MATERIAL' },
];

/** The trim lot table a material's stock lives in (with its master id and label size), or null. */
export function trimLotOf(
  material: Partial<Record<TrimFk, string | null>> & { sizeVariantId?: string | null }
): { fkField: TrimFk; table: string; trimType: TrimType; masterId: string; sizeVariantId: string | null } | null {
  for (const entry of TRIM_LOT_TABLES) {
    const masterId = material[entry.fkField];
    if (masterId) {
      return {
        ...entry,
        masterId,
        sizeVariantId: entry.trimType === 'LABEL' ? (material.sizeVariantId ?? null) : null,
      };
    }
  }
  return null;
}

/**
 * Routes a STOCK_IN operation to the appropriate specialized stock table.
 *
 * Detects material type by checking which FK is present on the materials record:
 * - greigeId → greige_stock
 * - fabricId → fabric_stock
 * - laceId → lace_stock
 * - threadId → thread_stock
 * - buttonId → button_stock (via trimStockService)
 * - zipperId → zipper_stock (via trimStockService)
 * - elasticId → elastic_stock (via trimStockService)
 * - labelId → label_stock (via trimStockService)
 * - packagingId → packaging_stock (via trimStockService)
 * - machinePartId → machine_part_stock (via trimStockService)
 * - otherMaterialId → other_material_stock (via trimStockService)
 *
 * If no FK is present, it's a generic material and stock_levels alone is sufficient.
 */
export async function routeToSpecializedStock(
  data: StockInRoutingData,
  tx?: any,
  options: StockInRoutingOptions = {}
): Promise<{ routed: boolean; stockType?: string; stockId?: string }> {
  // Every write here belongs to ONE transaction with the caller's stock_levels + movement: join the caller's,
  // or open one — a lot written without its ledger row (or the reverse) is never left behind
  if (!tx) return prisma.$transaction((own) => routeToSpecializedStock(data, own, options));
  // Actual metres at the fold length (identity when there is none). The greige lot converts itself.
  const actualQty = foldActual(data.quantity, data.foldLengthCm).toNumber();
  const client = tx || prisma;

  // BUG-GR8 fix: Use configurable cutable width deduction from system settings
  const cutableWidthDeduction = await systemSettingsService.getCutableWidthDeductionInches();

  try {
    // Fetch material with all FK fields and related master data
    const material = await client.materials.findUnique({
      where: { id: data.materialId },
      select: {
        id: true,
        greigeId: true,
        fabricId: true,
        laceId: true,
        threadId: true,
        buttonId: true,
        zipperId: true,
        elasticId: true,
        labelId: true,
        packagingId: true,
        machinePartId: true,
        otherMaterialId: true,
        sizeVariantId: true,
        threadPackagingType: true,
        threadPly: true,
        greige_master: { select: { greigeWidth: true } },
        fabric_master: { select: { actualWidth: true } },
      },
    });

    if (!material) {
      if (options.strict) throw new Error(`Material ${data.materialId} not found`);
      logError(`[StockRouting] Material not found: ${data.materialId}`);
      return { routed: false };
    }

    // The GRN's generic path books trims only; a greige/fabric/lace/thread line on a TRIMS/GENERAL PO keeps
    // today's stock_levels-only behaviour — a lot with no link back to the receipt could not be reversed.
    if (options.trimsOnly && (material.greigeId || material.fabricId || material.laceId || material.threadId)) {
      logWarn(
        `[StockRouting] ${data.materialId} is greige/fabric/lace/thread received on a trims/general PO — ` +
          `booked in stock_levels only, no lot`
      );
      return { routed: false };
    }

    // Route to appropriate specialized table based on FK presence
    if (material.greigeId) {
      const stock = await greigeStockService.createGreigeStock(
        {
          greigeId: material.greigeId,
          quantity: data.quantity, // counted — createGreigeStock converts at foldLengthCm
          width: Number(material.greige_master?.greigeWidth) || 44,
          purchaseCost: data.rate,
          warehouseId: data.warehouseId,
          sourceType: 'MANUAL',
          foldLengthCm: data.foldLengthCm,
          thanCount: data.thanCount,
          rollNumbers: data.rollNumbers,
          invoiceNumber: data.invoiceNumber,
          invoiceDate: data.invoiceDate,
          receivedDate: data.receivedDate, // Backdating support
          qualityGrade: data.qualityGrade,
          skipMaterialSync: true, // Parent (createStockIn) already handles material/stock_levels sync
          tx: client, // Pass transaction context so records are part of parent transaction
        },
        data.performedById
      );
      logInfo(`[StockRouting] Routed to greige_stock: ${stock.id}, qty: ${data.quantity}`);
      return { routed: true, stockType: 'GREIGE', stockId: stock.id };
    }

    if (material.fabricId) {
      // Create fabric_stock entry directly (no dedicated createFabricStock method exists)
      // Note: Parent (createStockIn) already handles material/stock_levels sync, so we skip it here
      const cost = data.rate ?? 0;
      const width = Number(material.fabric_master?.actualWidth) || 44;
      const stock = await client.fabric_stock.create({
        data: {
          fabricId: material.fabricId,
          finishedWidth: new Prisma.Decimal(width),
          cutableWidth: new Prisma.Decimal(width - cutableWidthDeduction), // BUG-GR8 fix: configurable deduction
          quantityAvailable: new Prisma.Decimal(actualQty),
          quantityReserved: new Prisma.Decimal(0),
          quantityConsumed: new Prisma.Decimal(0),
          unit: 'meters',
          purchaseCost: new Prisma.Decimal(cost),
          weightedAvgCost: new Prisma.Decimal(cost),
          qualityGrade: getQualityGradeOrDefault(data.qualityGrade), // BUG-GR9 fix
          warehouseId: data.warehouseId || null,
          status: 'AVAILABLE',
          stockType: 'GENERIC',
          receivedDate: data.receivedDate || new Date(), // Backdating support
          createdById: data.performedById,
        },
      });

      logInfo(`[StockRouting] Routed to fabric_stock: ${stock.id}, qty: ${actualQty}`);
      return { routed: true, stockType: 'FABRIC', stockId: stock.id };
    }

    if (material.laceId) {
      const cost = data.rate ?? 0;
      const stock = await createLaceStock({
        laceId: material.laceId,
        quantityAvailable: actualQty,
        purchaseCost: cost,
        weightedAvgCost: cost,
        warehouseId: data.warehouseId,
        lotNumber: data.lotNumber,
        qualityGrade: getQualityGradeOrDefault(data.qualityGrade), // BUG-GR9 fix
        stockType: 'GENERIC',
        createdById: data.performedById,
        skipMaterialSync: true, // Parent (createStockIn) already handles material/stock_levels sync
        tx: client, // Pass transaction context so records are part of parent transaction
      });
      logInfo(`[StockRouting] Routed to lace_stock: ${stock.id}, qty: ${actualQty}`);
      return { routed: true, stockType: 'LACE', stockId: stock.id };
    }

    if (material.threadId) {
      // The lot takes the pack of the row it is received on (Cone 3-ply…) — a base row makes an unpacked lot —
      // so derived_stock_view puts it on the same row the caller's stock_levels write went to
      const stock = await threadStockService.createThreadStock(
        {
          threadId: material.threadId,
          pack: { packagingType: material.threadPackagingType, ply: material.threadPly },
          quantity: actualQty,
          purchaseCost: data.rate,
          warehouseId: data.warehouseId,
          sourceType: 'MANUAL',
          supplierLotNumber: data.lotNumber,
          qualityGrade: data.qualityGrade,
          skipMaterialSync: true, // Parent (createStockIn) already handles material/stock_levels sync
          tx: client, // Pass transaction context so records are part of parent transaction
        },
        data.performedById
      );
      logInfo(`[StockRouting] Routed to thread_stock: ${stock.id}, qty: ${actualQty}`);
      return { routed: true, stockType: 'THREAD', stockId: stock.id };
    }

    // Trim types - all handled by trimStockService (a sized label's lot carries its size)
    const lot = trimLotOf(material);
    if (lot) {
      const stock = await trimStockService.createTrimStock(
        {
          trimType: lot.trimType,
          masterId: lot.masterId,
          sizeVariantId: lot.sizeVariantId,
          quantity: actualQty,
          unit: data.unit,
          purchaseCost: data.rate,
          warehouseId: data.warehouseId,
          supplierId: data.supplierId,
          procurementId: data.procurementId,
          sourceType: data.sourceType || 'MANUAL',
          receivedDate: data.receivedDate,
          batchNumber: data.batchNumber,
          lotNumber: data.lotNumber,
          qualityGrade: data.qualityGrade,
          skipMaterialSync: true, // Parent (createStockIn / the GRN) already handles material/stock_levels sync
          tx: client, // Pass transaction context so records are part of parent transaction
        },
        data.performedById
      );
      logInfo(`[StockRouting] Routed to ${lot.table}: ${stock.id}, qty: ${actualQty}`);
      return { routed: true, stockType: lot.trimType, stockId: stock.id };
    }

    // No specialized FK found - generic material, stock_levels is sufficient
    logInfo(`[StockRouting] Material ${data.materialId} is generic - no specialized routing needed`);
    return { routed: false };
  } catch (error) {
    // Never swallowed (2026-09-26): the caller's transaction must roll back, or it commits stock_levels and a
    // movement with no lot behind them — and the page must see why the receipt failed
    logError(`[StockRouting] Failed to route stock for material ${data.materialId}:`, error);
    throw error;
  }
}

/**
 * A lot ledger row's reference type (the TransactionReferenceType enum) for a stock-out's free-text reference.
 * The FIFO loops used to write `referenceType || 'STOCK_OUT'` — not an enum value, so Prisma refused the audit row
 * AFTER the first lot was decremented, the catch below swallowed it, and a stock-out spanning two lots stopped at
 * the first while stock_levels took the full quantity (found by thread-stock-per-pack.test, 2026-09-26).
 */
function lotReferenceType(reference: string | undefined): TransactionReferenceType {
  return reference && (Object.values(TransactionReferenceType) as string[]).includes(reference)
    ? (reference as TransactionReferenceType)
    : TransactionReferenceType.MANUAL;
}

/**
 * A lot-backed material's stock-out must be drawn from its lots in full. When the lots at that warehouse hold less
 * than asked, stock_levels and the lots already disagree: refuse, so the caller's transaction rolls back — the FIFO
 * loops used to take what the lots had and return as if done, while stock_levels dropped by the whole quantity.
 */
function refuseUncoveredStockOut(remainingQty: number, data: StockOutRoutingData, lotKind: string): void {
  if (!qtyExceeds(remainingQty, 0)) return;
  const round = (x: number) => Math.round(x * 1000) / 1000;
  const inLots = round(data.quantity - remainingQty);
  throw new BusinessError(
    `Only ${inLots} of the ${round(data.quantity)} asked for is in this material's ${lotKind} lots at that ` +
      `warehouse — its stock level and its lots disagree. Nothing was taken out; check its Material Ledger first.`,
    { reason: 'STOCK_LOTS_SHORT', materialId: data.materialId, asked: data.quantity, inLots }
  );
}

export interface StockOutRoutingData {
  materialId: string;
  quantity: number;
  warehouseId?: string;
  performedById: string;
  referenceType?: string;
  referenceId?: string;
}

/**
 * Routes a STOCK_OUT operation to deduct from the appropriate specialized stock table.
 * Uses FIFO (First-In-First-Out) ordering based on receivedDate/createdAt.
 *
 * Detects material type by checking which FK is present on the materials record,
 * then finds available stock records and deducts using FIFO.
 *
 * If no FK is present or no available stock found, returns routed: false.
 */
export async function routeFromSpecializedStock(
  data: StockOutRoutingData,
  tx?: any
): Promise<{ routed: boolean; stockType?: string; deductedRecords?: Array<{ stockId: string; quantity: number }> }> {
  // Lot decrements and their audit rows commit together with the caller's stock_levels + movement, or not at all
  if (!tx) return prisma.$transaction((own) => routeFromSpecializedStock(data, own));
  const client = tx;

  try {
    // Fetch material with all FK fields
    const material = await client.materials.findUnique({
      where: { id: data.materialId },
      select: {
        id: true,
        greigeId: true,
        fabricId: true,
        laceId: true,
        threadId: true,
        buttonId: true,
        zipperId: true,
        elasticId: true,
        labelId: true,
        packagingId: true,
        machinePartId: true,
        otherMaterialId: true,
        sizeVariantId: true,
        threadPackagingType: true,
        threadPly: true,
      },
    });

    if (!material) {
      logError(`[StockRouting] Material not found for OUT: ${data.materialId}`);
      return { routed: false };
    }

    let remainingQty = data.quantity;
    const deductedRecords: Array<{ stockId: string; quantity: number }> = [];
    // Quantity rule (utils/quantity), applied in every FIFO loop below: a remainder within dust of a
    // lot takes the whole lot (no 0.002 m left behind on an EXHAUSTED/ISSUED lot), and a remainder
    // that is itself dust opens no further lot.

    // Route to appropriate specialized table based on FK presence
    if (material.greigeId) {
      // BUG-INV1 fix: sync to specialized tables
      // Find available greige stock records (FIFO by receivedDate)
      const stocks = await client.greige_stock.findMany({
        where: {
          greigeId: material.greigeId,
          quantityAvailable: { gt: 0 },
          // BUG-INV1 fix: use warehouseId field (FK to warehouses) instead of warehouseLocation string
          ...(data.warehouseId && { warehouseId: data.warehouseId }),
        },
        orderBy: { receivedDate: 'asc' },
      });

      for (const stock of stocks) {
        if (isQtyZero(remainingQty) || remainingQty < 0) break;
        const available = Number(stock.quantityAvailable);
        const deductQty = Math.min(available, snapToLimit(remainingQty, available));

        await client.greige_stock.update({
          where: { id: stock.id },
          data: {
            quantityAvailable: { decrement: deductQty },
            quantityConsumed: { increment: deductQty },
            status: isQtyZero(available - deductQty) || available - deductQty < 0 ? 'EXHAUSTED' : 'AVAILABLE',
          },
        });

        // Create transaction record
        await client.greige_stock_transaction.create({
          data: {
            stockId: stock.id,
            transactionType: 'CONSUMPTION',
            quantity: new Prisma.Decimal(-deductQty),
            balanceAfter: new Prisma.Decimal(available - deductQty),
            referenceType: lotReferenceType(data.referenceType),
            referenceId: data.referenceId,
            notes: 'Deducted via stock movement',
            performedById: data.performedById,
          },
        });

        deductedRecords.push({ stockId: stock.id, quantity: deductQty });
        remainingQty -= deductQty;
      }

      refuseUncoveredStockOut(remainingQty, data, 'greige');
      if (deductedRecords.length > 0) {
        // stock_levels is the CALLER's (decreaseStockInTx) — syncing it here too took it out twice (2026-09-26)
        const totalDeducted = data.quantity - remainingQty;
        logInfo(`[StockRouting] Deducted ${totalDeducted} from greige_stock (${deductedRecords.length} records)`);
        return { routed: true, stockType: 'GREIGE', deductedRecords };
      }
    }

    if (material.fabricId) {
      // Find available fabric stock records (FIFO by receivedDate)
      const stocks = await client.fabric_stock.findMany({
        where: {
          fabricId: material.fabricId,
          quantityAvailable: { gt: 0 },
          ...(data.warehouseId && { warehouseId: data.warehouseId }),
        },
        orderBy: { receivedDate: 'asc' },
      });

      for (const stock of stocks) {
        if (isQtyZero(remainingQty) || remainingQty < 0) break;
        const available = Number(stock.quantityAvailable);
        const deductQty = Math.min(available, snapToLimit(remainingQty, available));

        await client.fabric_stock.update({
          where: { id: stock.id },
          data: {
            quantityAvailable: { decrement: deductQty },
            quantityConsumed: { increment: deductQty },
            lastConsumedDate: new Date(),
            status: isQtyZero(available - deductQty) || available - deductQty < 0 ? 'EXHAUSTED' : 'AVAILABLE',
          },
        });

        deductedRecords.push({ stockId: stock.id, quantity: deductQty });
        remainingQty -= deductQty;
      }

      refuseUncoveredStockOut(remainingQty, data, 'fabric');
      if (deductedRecords.length > 0) {
        // stock_levels is the CALLER's (decreaseStockInTx) — syncing it here too took it out twice (2026-09-26)
        const totalDeducted = data.quantity - remainingQty;
        logInfo(`[StockRouting] Deducted ${totalDeducted} from fabric_stock (${deductedRecords.length} records)`);
        return { routed: true, stockType: 'FABRIC', deductedRecords };
      }
    }

    if (material.laceId) {
      // Find available lace stock records (FIFO by receivedDate)
      const stocks = await client.lace_stock.findMany({
        where: {
          laceId: material.laceId,
          quantityAvailable: { gt: 0 },
          ...(data.warehouseId && { warehouseId: data.warehouseId }),
        },
        orderBy: { receivedDate: 'asc' },
      });

      for (const stock of stocks) {
        if (isQtyZero(remainingQty) || remainingQty < 0) break;
        const available = Number(stock.quantityAvailable);
        const deductQty = Math.min(available, snapToLimit(remainingQty, available));

        await client.lace_stock.update({
          where: { id: stock.id },
          data: {
            quantityAvailable: { decrement: deductQty },
            quantityConsumed: { increment: deductQty },
            lastConsumedDate: new Date(),
            status: isQtyZero(available - deductQty) || available - deductQty < 0 ? 'ISSUED' : 'AVAILABLE',
          },
        });

        // Create transaction record
        await client.lace_stock_transaction.create({
          data: {
            stockId: stock.id,
            transactionType: 'CONSUMPTION',
            quantity: -deductQty,
            balanceAfter: available - deductQty,
            referenceType: lotReferenceType(data.referenceType),
            referenceId: data.referenceId,
            notes: 'Deducted via stock movement',
            performedById: data.performedById,
          },
        });

        deductedRecords.push({ stockId: stock.id, quantity: deductQty });
        remainingQty -= deductQty;
      }

      refuseUncoveredStockOut(remainingQty, data, 'lace');
      if (deductedRecords.length > 0) {
        // stock_levels is the CALLER's (decreaseStockInTx) — syncing it here too took it out twice (2026-09-26)
        const totalDeducted = data.quantity - remainingQty;
        logInfo(`[StockRouting] Deducted ${totalDeducted} from lace_stock (${deductedRecords.length} records)`);
        return { routed: true, stockType: 'LACE', deductedRecords };
      }
    }

    if (material.threadId) {
      // Find available thread stock records (FIFO by receivedDate)
      const stocks = await client.thread_stock.findMany({
        where: {
          threadId: material.threadId,
          // Only this row's pack: cones are never drawn for tubes (nor packed lots for the base row)
          packagingType: material.threadPackagingType,
          ply: material.threadPly,
          quantityAvailable: { gt: 0 },
          ...(data.warehouseId && { warehouseId: data.warehouseId }),
        },
        orderBy: { receivedDate: 'asc' },
      });

      for (const stock of stocks) {
        if (isQtyZero(remainingQty) || remainingQty < 0) break;
        const available = Number(stock.quantityAvailable);
        const deductQty = Math.min(available, snapToLimit(remainingQty, available));

        await client.thread_stock.update({
          where: { id: stock.id },
          data: {
            quantityAvailable: { decrement: deductQty },
            quantityConsumed: { increment: deductQty },
            lastConsumedDate: new Date(),
            status: isQtyZero(available - deductQty) || available - deductQty < 0 ? 'ISSUED' : 'AVAILABLE',
          },
        });

        // Create transaction record
        await client.thread_stock_transaction.create({
          data: {
            stockId: stock.id,
            transactionType: 'CONSUMPTION',
            quantity: -deductQty,
            balanceAfter: available - deductQty,
            referenceType: lotReferenceType(data.referenceType),
            referenceId: data.referenceId,
            notes: 'Deducted via stock movement',
            performedById: data.performedById,
          },
        });

        deductedRecords.push({ stockId: stock.id, quantity: deductQty });
        remainingQty -= deductQty;
      }

      refuseUncoveredStockOut(remainingQty, data, 'thread');
      if (deductedRecords.length > 0) {
        // stock_levels is the CALLER's (decreaseStockInTx) — syncing it here too took it out twice (2026-09-26)
        const totalDeducted = data.quantity - remainingQty;
        logInfo(`[StockRouting] Deducted ${totalDeducted} from thread_stock (${deductedRecords.length} records)`);
        return { routed: true, stockType: 'THREAD', deductedRecords };
      }
    }

    // Trim types - handle button, zipper, elastic, label, packaging, machine_part, other_material
    // BUG-BTN5 fix: Uses Prisma atomic operations (decrement/increment) for safe decimal arithmetic
    const lot = trimLotOf(material);
    if (lot) {
      const { fkField: masterIdField, table, trimType, masterId } = lot;
      {
        // Find available trim stock records (FIFO by receivedDate). A label draws only lots of ITS size
        // (a size row takes that size; the base row takes unsized lots).
        const stocks = await (client as any)[table].findMany({
          where: {
            [masterIdField]: masterId,
            ...(trimType === 'LABEL' ? { sizeVariantId: lot.sizeVariantId } : {}),
            quantityAvailable: { gt: 0 },
            ...(data.warehouseId && { warehouseId: data.warehouseId }),
          },
          orderBy: { receivedDate: 'asc' },
        });

        for (const stock of stocks) {
          if (isQtyZero(remainingQty) || remainingQty < 0) break;
          const available = Number(stock.quantityAvailable);
          const deductQty = Math.min(available, snapToLimit(remainingQty, available));

          await (client as any)[table].update({
            where: { id: stock.id },
            data: {
              quantityAvailable: { decrement: deductQty },
              quantityConsumed: { increment: deductQty },
              lastConsumedDate: new Date(),
              status: isQtyZero(available - deductQty) || available - deductQty < 0 ? 'ISSUED' : 'AVAILABLE',
            },
          });

          deductedRecords.push({ stockId: stock.id, quantity: deductQty });
          remainingQty -= deductQty;
        }

        refuseUncoveredStockOut(remainingQty, data, 'trim');
        if (deductedRecords.length > 0) {
          // stock_levels is the CALLER's (decreaseStockInTx) — syncing it here too took it out twice (2026-09-26)
          const totalDeducted = data.quantity - remainingQty;
          logInfo(`[StockRouting] Deducted ${totalDeducted} from ${table} (${deductedRecords.length} records)`);
          return { routed: true, stockType: trimType, deductedRecords };
        }
      }
    }

    // No specialized FK found or no available stock - generic material
    logInfo(
      `[StockRouting] Material ${data.materialId} is generic or no specialized stock available - no specialized routing for OUT`
    );
    return { routed: false };
  } catch (error) {
    // Never swallowed (2026-09-26). It was: a lot decremented, its audit row refused (an invalid reference type),
    // the error caught here — and the caller's transaction COMMITTED the half-done stock-out: one lot drawn,
    // stock_levels down by the full quantity, no ledger row. Rethrowing rolls every write back and shows the page.
    logError(`[StockRouting] Failed to route stock OUT for material ${data.materialId}:`, error);
    throw error;
  }
}
