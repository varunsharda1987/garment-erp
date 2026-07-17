/**
 * Material Sync Helper
 *
 * Centralizes two critical operations that EVERY stock service must perform:
 * 1. ensureMaterialRecord() — Guarantees a `materials` record exists for a given master
 * 2. syncStockLevelQuantity() — Keeps `stock_levels` in sync after any stock change
 *
 * MANDATORY PATTERN: Every stock service that creates/adjusts/consumes stock MUST
 * import and use these helpers. See CLAUDE.md "Stock Service Pattern" section.
 */

import prisma from '../../config/database';
import { materialService } from '../material.service';
import { logInfo, logError } from '../../utils/logger';

// Master table configuration for each material type
const MASTER_CONFIG: Record<string, { table: string; codeField: string; nameField: string; fkField: string }> = {
  GREIGE: { table: 'greige_master', codeField: 'greigeCode', nameField: 'greigeName', fkField: 'greigeId' },
  FABRIC: { table: 'fabric_master', codeField: 'fabricCode', nameField: 'fabricName', fkField: 'fabricId' },
  LACE: { table: 'lace_master', codeField: 'laceCode', nameField: 'laceName', fkField: 'laceId' },
  THREAD: { table: 'thread_master', codeField: 'threadCode', nameField: 'threadName', fkField: 'threadId' },
  BUTTON: { table: 'button_master', codeField: 'buttonCode', nameField: 'buttonName', fkField: 'buttonId' },
  ZIPPER: { table: 'zipper_master', codeField: 'zipperCode', nameField: 'zipperName', fkField: 'zipperId' },
  ELASTIC: { table: 'elastic_master', codeField: 'elasticCode', nameField: 'elasticName', fkField: 'elasticId' },
  LABEL: { table: 'label_master', codeField: 'labelCode', nameField: 'labelName', fkField: 'labelId' },
  PACKAGING: {
    table: 'packaging_master',
    codeField: 'packagingCode',
    nameField: 'packagingName',
    fkField: 'packagingId',
  },
  MACHINE_PART: {
    table: 'machine_part_master',
    codeField: 'partCode',
    nameField: 'partName',
    fkField: 'machinePartId',
  },
  OTHER_MATERIAL: {
    table: 'other_material_master',
    codeField: 'materialCode',
    nameField: 'materialName',
    fkField: 'otherMaterialId',
  },
};

/**
 * Ensures a `materials` record exists for a given master record.
 * If missing, creates it via materialService.createFromMaster().
 *
 * @param masterId - The ID of the master record (greige_master.id, fabric_master.id, etc.)
 * @param masterType - The type of master (GREIGE, FABRIC, LACE, THREAD, etc.)
 * @returns The materialId (same as masterId by convention from createFromMaster)
 */
export async function ensureMaterialRecord(masterId: string, masterType: string): Promise<string> {
  const config = MASTER_CONFIG[masterType];
  if (!config) throw new Error(`Unknown master type: ${masterType}`);

  // Check if materials record already exists
  const existing = await prisma.materials.findFirst({
    where: { [config.fkField]: masterId },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Fetch master record for code/name
  const master = await (prisma as any)[config.table].findUnique({
    where: { id: masterId },
    select: { id: true, [config.codeField]: true, [config.nameField]: true },
  });
  if (!master) {
    throw new Error(`${masterType} master not found: ${masterId}`);
  }

  // Create materials record (handles P2002 race condition)
  try {
    const material = await materialService.createFromMaster(
      { id: master.id, code: master[config.codeField], name: master[config.nameField] },
      masterType as any
    );
    logInfo(`[MaterialSync] Created materials record for ${masterType} ${master[config.codeField]} (${masterId})`);
    return material.id;
  } catch (err: any) {
    if (err.code === 'P2002') {
      // Race condition — record was just created by another process
      const retried = await prisma.materials.findFirst({
        where: { [config.fkField]: masterId },
        select: { id: true },
      });
      if (retried) return retried.id;
    }
    throw err;
  }
}

/**
 * Syncs stock_levels after a stock quantity change.
 * Uses updateMany for existing records, creates new record if needed.
 *
 * @param materialId - The materials.id (= masterId by convention)
 * @param change - Positive for increase, negative for decrease
 * @param warehouseId - Optional warehouse ID to scope the update (if omitted, updates all warehouses - use with caution)
 * @param unit - Unit for new stock_levels records. If omitted, the material's own unit is used
 *               (NOT a hardcoded 'PIECE', which recorded fabric/greige in pieces — bug-hunt BH-0304)
 * @param tx - Optional Prisma transaction client for atomicity
 */
export async function syncStockLevelQuantity(
  materialId: string,
  change: number,
  warehouseId?: string,
  unit?: string,
  tx?: any
): Promise<void> {
  if (change === 0) return;

  const client = tx || prisma;

  // Build where clause - scope to specific warehouse if provided
  const where: { materialId: string; warehouseId?: string } = { materialId };
  if (warehouseId) {
    where.warehouseId = warehouseId;
  }

  try {
    // First try to update existing record
    const updateResult = await client.stock_levels.updateMany({
      where,
      data: {
        quantity: change > 0 ? { increment: change } : { decrement: Math.abs(change) },
        lastUpdated: new Date(),
      },
    });

    // If no record was updated and we're adding stock, create one
    if (updateResult.count === 0 && change > 0 && warehouseId) {
      // Record the material's REAL unit (fabric/greige in metres, etc.). Only fall back to PIECE
      // if the master genuinely has no unit — never as a blind default (bug-hunt BH-0304).
      let resolvedUnit = unit;
      if (!resolvedUnit) {
        const material = await client.materials.findUnique({
          where: { id: materialId },
          select: { unit: true },
        });
        resolvedUnit = material?.unit || 'PIECE';
      }
      await client.stock_levels.create({
        data: {
          materialId,
          warehouseId,
          quantity: change,
          unit: resolvedUnit as any,
          lastUpdated: new Date(),
        },
      });
      logInfo(
        `[MaterialSync] Created stock_levels for material ${materialId}, warehouse ${warehouseId}, qty: ${change}`
      );
    }
  } catch (err) {
    logError(
      `[MaterialSync] Failed to sync stock_levels for material ${materialId}, warehouse ${warehouseId || 'ALL'}, change: ${change}`,
      err
    );
    // Don't throw — stock_levels sync failure shouldn't block the primary operation
  }
}
