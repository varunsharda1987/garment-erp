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

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import greigeStockService from '../greige-stock.service';
import { createLaceStock } from '../laceStock.service';
import threadStockService from '../thread-stock.service';
import trimStockService, { TrimType } from '../trim-stock.service';
import { logInfo, logError } from '../../utils/logger';
import { syncStockLevelQuantity } from './material-sync.helper';
import { systemSettingsService } from '../system-settings.service';
// BUG-GR9 fix: Use centralized quality grade default instead of hardcoding 'A'
import { getQualityGradeOrDefault } from '../../constants/stock.constants';

export interface StockInRoutingData {
  materialId: string;
  quantity: number;
  rate?: number;
  warehouseId?: string;
  foldLengthCm?: number;
  thanCount?: number;
  invoiceNumber?: string;
  batchNumber?: string;
  lotNumber?: string;
  qualityGrade?: string;
  performedById: string;
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
  tx?: any
): Promise<{ routed: boolean; stockType?: string; stockId?: string }> {
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
        greige_master: { select: { greigeWidth: true } },
        fabric_master: { select: { actualWidth: true } },
      },
    });

    if (!material) {
      logError(`[StockRouting] Material not found: ${data.materialId}`);
      return { routed: false };
    }

    // Route to appropriate specialized table based on FK presence
    if (material.greigeId) {
      const stock = await greigeStockService.createGreigeStock(
        {
          greigeId: material.greigeId,
          quantity: data.quantity,
          width: Number(material.greige_master?.greigeWidth) || 44,
          purchaseCost: data.rate,
          warehouseId: data.warehouseId,
          sourceType: 'MANUAL',
          foldLengthCm: data.foldLengthCm,
          thanCount: data.thanCount,
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
          quantityAvailable: new Prisma.Decimal(data.quantity),
          quantityReserved: new Prisma.Decimal(0),
          quantityConsumed: new Prisma.Decimal(0),
          unit: 'meters',
          purchaseCost: new Prisma.Decimal(cost),
          weightedAvgCost: new Prisma.Decimal(cost),
          qualityGrade: getQualityGradeOrDefault(data.qualityGrade), // BUG-GR9 fix
          warehouseId: data.warehouseId || null,
          status: 'AVAILABLE',
          stockType: 'GENERIC',
          receivedDate: new Date(),
          createdById: data.performedById,
        },
      });

      logInfo(`[StockRouting] Routed to fabric_stock: ${stock.id}, qty: ${data.quantity}`);
      return { routed: true, stockType: 'FABRIC', stockId: stock.id };
    }

    if (material.laceId) {
      const cost = data.rate ?? 0;
      const stock = await createLaceStock({
        laceId: material.laceId,
        quantityAvailable: data.quantity,
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
      logInfo(`[StockRouting] Routed to lace_stock: ${stock.id}, qty: ${data.quantity}`);
      return { routed: true, stockType: 'LACE', stockId: stock.id };
    }

    if (material.threadId) {
      const stock = await threadStockService.createThreadStock(
        {
          threadId: material.threadId,
          quantity: data.quantity,
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
      logInfo(`[StockRouting] Routed to thread_stock: ${stock.id}, qty: ${data.quantity}`);
      return { routed: true, stockType: 'THREAD', stockId: stock.id };
    }

    // Trim types - all handled by trimStockService
    const trimMapping: Array<{ fkField: keyof typeof material; trimType: TrimType }> = [
      { fkField: 'buttonId', trimType: 'BUTTON' },
      { fkField: 'zipperId', trimType: 'ZIPPER' },
      { fkField: 'elasticId', trimType: 'ELASTIC' },
      { fkField: 'labelId', trimType: 'LABEL' },
      { fkField: 'packagingId', trimType: 'PACKAGING' },
      { fkField: 'machinePartId', trimType: 'MACHINE_PART' },
      { fkField: 'otherMaterialId', trimType: 'OTHER_MATERIAL' },
    ];

    for (const { fkField, trimType } of trimMapping) {
      const masterId = material[fkField];
      if (masterId) {
        const stock = await trimStockService.createTrimStock(
          {
            trimType,
            masterId: masterId as string,
            quantity: data.quantity,
            purchaseCost: data.rate,
            warehouseId: data.warehouseId,
            sourceType: 'MANUAL',
            batchNumber: data.batchNumber,
            lotNumber: data.lotNumber,
            qualityGrade: data.qualityGrade,
            skipMaterialSync: true, // Parent (createStockIn) already handles material/stock_levels sync
            tx: client, // Pass transaction context so records are part of parent transaction
          },
          data.performedById
        );
        logInfo(`[StockRouting] Routed to ${trimType.toLowerCase()}_stock: ${stock.id}, qty: ${data.quantity}`);
        return { routed: true, stockType: trimType, stockId: stock.id };
      }
    }

    // No specialized FK found - generic material, stock_levels is sufficient
    logInfo(`[StockRouting] Material ${data.materialId} is generic - no specialized routing needed`);
    return { routed: false };
  } catch (error) {
    logError(`[StockRouting] Failed to route stock for material ${data.materialId}:`, error);
    // Don't throw - routing failure shouldn't block the primary stock movement
    return { routed: false };
  }
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
  const client = tx || prisma;

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
      },
    });

    if (!material) {
      logError(`[StockRouting] Material not found for OUT: ${data.materialId}`);
      return { routed: false };
    }

    let remainingQty = data.quantity;
    const deductedRecords: Array<{ stockId: string; quantity: number }> = [];

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
        if (remainingQty <= 0) break;
        const available = Number(stock.quantityAvailable);
        const deductQty = Math.min(available, remainingQty);

        await client.greige_stock.update({
          where: { id: stock.id },
          data: {
            quantityAvailable: { decrement: deductQty },
            quantityConsumed: { increment: deductQty },
            status: available - deductQty <= 0 ? 'EXHAUSTED' : 'AVAILABLE',
          },
        });

        // Create transaction record
        await client.greige_stock_transaction.create({
          data: {
            stockId: stock.id,
            transactionType: 'CONSUMPTION',
            quantity: new Prisma.Decimal(-deductQty),
            balanceAfter: new Prisma.Decimal(available - deductQty),
            referenceType: data.referenceType || 'STOCK_OUT',
            referenceId: data.referenceId,
            notes: 'Deducted via stock movement',
            performedById: data.performedById,
          },
        });

        deductedRecords.push({ stockId: stock.id, quantity: deductQty });
        remainingQty -= deductQty;
      }

      if (deductedRecords.length > 0) {
        // BUG-INV3 fix: sync processor consumption to stock_levels
        const totalDeducted = data.quantity - remainingQty;
        await syncStockLevelQuantity(data.materialId, -totalDeducted, data.warehouseId, undefined, client);
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
        if (remainingQty <= 0) break;
        const available = Number(stock.quantityAvailable);
        const deductQty = Math.min(available, remainingQty);

        await client.fabric_stock.update({
          where: { id: stock.id },
          data: {
            quantityAvailable: { decrement: deductQty },
            quantityConsumed: { increment: deductQty },
            lastConsumedDate: new Date(),
            status: available - deductQty <= 0 ? 'EXHAUSTED' : 'AVAILABLE',
          },
        });

        deductedRecords.push({ stockId: stock.id, quantity: deductQty });
        remainingQty -= deductQty;
      }

      if (deductedRecords.length > 0) {
        // BUG-INV3 fix: sync processor consumption to stock_levels
        const totalDeducted = data.quantity - remainingQty;
        await syncStockLevelQuantity(data.materialId, -totalDeducted, data.warehouseId, undefined, client);
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
        if (remainingQty <= 0) break;
        const available = Number(stock.quantityAvailable);
        const deductQty = Math.min(available, remainingQty);

        await client.lace_stock.update({
          where: { id: stock.id },
          data: {
            quantityAvailable: { decrement: deductQty },
            quantityConsumed: { increment: deductQty },
            lastConsumedDate: new Date(),
            status: available - deductQty <= 0 ? 'ISSUED' : 'AVAILABLE',
          },
        });

        // Create transaction record
        await client.lace_stock_transaction.create({
          data: {
            stockId: stock.id,
            transactionType: 'CONSUMPTION',
            quantity: -deductQty,
            balanceAfter: available - deductQty,
            referenceType: data.referenceType || 'STOCK_OUT',
            referenceId: data.referenceId,
            notes: 'Deducted via stock movement',
            performedById: data.performedById,
          },
        });

        deductedRecords.push({ stockId: stock.id, quantity: deductQty });
        remainingQty -= deductQty;
      }

      if (deductedRecords.length > 0) {
        // BUG-INV3 fix: sync processor consumption to stock_levels
        const totalDeducted = data.quantity - remainingQty;
        await syncStockLevelQuantity(data.materialId, -totalDeducted, data.warehouseId, undefined, client);
        logInfo(`[StockRouting] Deducted ${totalDeducted} from lace_stock (${deductedRecords.length} records)`);
        return { routed: true, stockType: 'LACE', deductedRecords };
      }
    }

    if (material.threadId) {
      // Find available thread stock records (FIFO by receivedDate)
      const stocks = await client.thread_stock.findMany({
        where: {
          threadId: material.threadId,
          quantityAvailable: { gt: 0 },
          ...(data.warehouseId && { warehouseId: data.warehouseId }),
        },
        orderBy: { receivedDate: 'asc' },
      });

      for (const stock of stocks) {
        if (remainingQty <= 0) break;
        const available = Number(stock.quantityAvailable);
        const deductQty = Math.min(available, remainingQty);

        await client.thread_stock.update({
          where: { id: stock.id },
          data: {
            quantityAvailable: { decrement: deductQty },
            quantityConsumed: { increment: deductQty },
            lastConsumedDate: new Date(),
            status: available - deductQty <= 0 ? 'ISSUED' : 'AVAILABLE',
          },
        });

        // Create transaction record
        await client.thread_stock_transaction.create({
          data: {
            stockId: stock.id,
            transactionType: 'CONSUMPTION',
            quantity: -deductQty,
            balanceAfter: available - deductQty,
            referenceType: data.referenceType || 'STOCK_OUT',
            referenceId: data.referenceId,
            notes: 'Deducted via stock movement',
            performedById: data.performedById,
          },
        });

        deductedRecords.push({ stockId: stock.id, quantity: deductQty });
        remainingQty -= deductQty;
      }

      if (deductedRecords.length > 0) {
        // BUG-INV3 fix: sync processor consumption to stock_levels
        const totalDeducted = data.quantity - remainingQty;
        await syncStockLevelQuantity(data.materialId, -totalDeducted, data.warehouseId, undefined, client);
        logInfo(`[StockRouting] Deducted ${totalDeducted} from thread_stock (${deductedRecords.length} records)`);
        return { routed: true, stockType: 'THREAD', deductedRecords };
      }
    }

    // Trim types - handle button, zipper, elastic, label, packaging, machine_part, other_material
    // BUG-BTN5 fix: Uses Prisma atomic operations (decrement/increment) for safe decimal arithmetic
    const trimMapping: Array<{ fkField: keyof typeof material; table: string; trimType: string }> = [
      { fkField: 'buttonId', table: 'button_stock', trimType: 'BUTTON' },
      { fkField: 'zipperId', table: 'zipper_stock', trimType: 'ZIPPER' },
      { fkField: 'elasticId', table: 'elastic_stock', trimType: 'ELASTIC' },
      { fkField: 'labelId', table: 'label_stock', trimType: 'LABEL' },
      { fkField: 'packagingId', table: 'packaging_stock', trimType: 'PACKAGING' },
      { fkField: 'machinePartId', table: 'machine_part_stock', trimType: 'MACHINE_PART' },
      { fkField: 'otherMaterialId', table: 'other_material_stock', trimType: 'OTHER_MATERIAL' },
    ];

    for (const { fkField, table, trimType } of trimMapping) {
      const masterId = material[fkField];
      if (masterId) {
        // Find available trim stock records (FIFO by receivedDate)
        const masterIdField = fkField; // e.g., buttonId, zipperId, etc.
        const stocks = await (client as any)[table].findMany({
          where: {
            [masterIdField]: masterId,
            quantityAvailable: { gt: 0 },
            ...(data.warehouseId && { warehouseId: data.warehouseId }),
          },
          orderBy: { receivedDate: 'asc' },
        });

        for (const stock of stocks) {
          if (remainingQty <= 0) break;
          const available = Number(stock.quantityAvailable);
          const deductQty = Math.min(available, remainingQty);

          await (client as any)[table].update({
            where: { id: stock.id },
            data: {
              quantityAvailable: { decrement: deductQty },
              quantityConsumed: { increment: deductQty },
              lastConsumedDate: new Date(),
              status: available - deductQty <= 0 ? 'ISSUED' : 'AVAILABLE',
            },
          });

          deductedRecords.push({ stockId: stock.id, quantity: deductQty });
          remainingQty -= deductQty;
        }

        if (deductedRecords.length > 0) {
          // BUG-INV3 fix: sync processor consumption to stock_levels
          const totalDeducted = data.quantity - remainingQty;
          await syncStockLevelQuantity(data.materialId, -totalDeducted, data.warehouseId, undefined, client);
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
    logError(`[StockRouting] Failed to route stock OUT for material ${data.materialId}:`, error);
    // Don't throw - routing failure shouldn't block the primary stock movement
    return { routed: false };
  }
}
