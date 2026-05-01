/**
 * Stock Routing Helper
 *
 * Routes STOCK_IN operations to the appropriate specialized stock table
 * based on material type (detected via FK presence on materials record).
 *
 * This ensures manual Stock IN entries create proper specialized stock records
 * (greige_stock, fabric_stock, lace_stock, etc.) instead of only updating
 * the generic stock_levels table.
 *
 * CRITICAL: This helper must be called after every STOCK_IN operation in
 * stockMovement.service.ts to maintain data consistency across all 11 material types.
 */

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import greigeStockService from '../greige-stock.service';
import { createLaceStock } from '../laceStock.service';
import threadStockService from '../thread-stock.service';
import trimStockService, { TrimType } from '../trim-stock.service';
import { ensureMaterialRecord, syncStockLevelQuantity } from './material-sync.helper';
import { logInfo, logError } from '../../utils/logger';

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
        },
        data.performedById
      );
      logInfo(`[StockRouting] Routed to greige_stock: ${stock.id}, qty: ${data.quantity}`);
      return { routed: true, stockType: 'GREIGE', stockId: stock.id };
    }

    if (material.fabricId) {
      // Create fabric_stock entry directly (no dedicated createFabricStock method exists)
      const cost = data.rate ?? 0;
      const width = Number(material.fabric_master?.actualWidth) || 44;
      const stock = await client.fabric_stock.create({
        data: {
          fabricId: material.fabricId,
          finishedWidth: new Prisma.Decimal(width),
          cutableWidth: new Prisma.Decimal(width - 2), // Standard 2cm shrinkage
          quantityAvailable: new Prisma.Decimal(data.quantity),
          quantityReserved: new Prisma.Decimal(0),
          quantityConsumed: new Prisma.Decimal(0),
          unit: 'meters',
          purchaseCost: new Prisma.Decimal(cost),
          weightedAvgCost: new Prisma.Decimal(cost),
          qualityGrade: data.qualityGrade || 'A',
          warehouseId: data.warehouseId || null,
          status: 'AVAILABLE',
          stockType: 'GENERIC',
          receivedDate: new Date(),
          createdById: data.performedById,
        },
      });

      // Sync to stock_levels
      const materialId = await ensureMaterialRecord(material.fabricId, 'FABRIC');
      await syncStockLevelQuantity(materialId, data.quantity, data.warehouseId, 'METER', client);

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
        qualityGrade: data.qualityGrade || 'A',
        stockType: 'GENERIC',
        createdById: data.performedById,
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
