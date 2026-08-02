/**
 * Material Sync Helper
 *
 * Centralizes critical operations for keeping `materials` and `stock_levels` in sync:
 * 1. ensureMaterialRecord() — Guarantees a `materials` record exists for a given master
 * 2. syncStockLevelQuantity() — Keeps `stock_levels` in sync after any stock change
 * 3. syncMasterToMaterials() — Syncs code/name changes from master to materials (BUG-MM13)
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
export async function ensureMaterialRecord(masterId: string, masterType: string, tx?: any): Promise<string> {
  const config = MASTER_CONFIG[masterType];
  if (!config) throw new Error(`Unknown master type: ${masterType}`);

  // When a transaction client is supplied, do every read/write on it — otherwise, called from inside an
  // interactive $transaction, these would borrow a SECOND pooled connection and can starve the pool /
  // deadlock, and any create would commit outside the caller's transaction (bug-hunt T1-1).
  const client = tx || prisma;

  // Check if materials record already exists
  const existing = await client.materials.findFirst({
    where: { [config.fkField]: masterId },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Fetch master record for code/name
  const master = await (client as any)[config.table].findUnique({
    where: { id: masterId },
    select: { id: true, [config.codeField]: true, [config.nameField]: true },
  });
  if (!master) {
    throw new Error(
      `Cannot create materials record: ${masterType} master with id "${masterId}" does not exist. ` +
        `Ensure the ${masterType.toLowerCase()} item is created in ${config.table} before attempting stock operations.`
    );
  }

  // Create materials record (handles P2002 race condition)
  try {
    const material = await materialService.createFromMaster(
      { id: master.id, code: master[config.codeField], name: master[config.nameField] },
      masterType as any,
      tx
    );
    logInfo(`[MaterialSync] Created materials record for ${masterType} ${master[config.codeField]} (${masterId})`);
    return material.id;
  } catch (err: any) {
    if (err.code === 'P2002') {
      // Race condition — record was just created by another process
      const retried = await client.materials.findFirst({
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
 * @param warehouseId - Warehouse to scope the update. ALWAYS pass one when known. If omitted,
 *                      the helper resolves a SINGLE target row (never an unscoped multi-warehouse
 *                      update — bug-hunt BH-0030) and logs an error when the choice was ambiguous
 * @param unit - Unit for new stock_levels records. If omitted, the material's own unit is used
 *               (NOT a hardcoded 'PIECE', which recorded fabric/greige in pieces — bug-hunt BH-0304)
 * @param tx - Optional Prisma transaction client for atomicity
 */
// The company's own (raw-material) warehouse — "Kashaya Fabs" (WH-RM-*). Used as the fallback when
// a stock operation doesn't name a warehouse, so a receipt is never dropped for lack of one
// (bug-hunt BH-0310). Cached for the process lifetime; falls back to the oldest active warehouse.
// Exported so lot-creating services can stamp the SAME warehouse on the specialized-table row —
// a NULL-warehouse lot is invisible to derived_stock_view (GRG-0006 class).
let cachedDefaultWarehouseId: string | null | undefined;
export async function getDefaultWarehouseId(client: any): Promise<string | undefined> {
  if (cachedDefaultWarehouseId !== undefined) return cachedDefaultWarehouseId || undefined;
  const wh =
    (await client.warehouses.findFirst({
      where: { isActive: true, warehouseCode: { startsWith: 'WH-RM' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })) ||
    (await client.warehouses.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }));
  cachedDefaultWarehouseId = wh?.id ?? null;
  return cachedDefaultWarehouseId || undefined;
}

export async function syncStockLevelQuantity(
  materialId: string,
  change: number,
  warehouseId?: string,
  unit?: string,
  tx?: any
): Promise<void> {
  if (change === 0) return;

  const client = tx || prisma;

  try {
    // NEVER apply the change unscoped across all of a material's warehouses. When a caller
    // omitted the warehouse and the material had rows in N warehouses, every row moved by the
    // full amount — corrupting N-1 of them (bug-hunt BH-0030/BH-0049). Resolve ONE target row:
    // the material's only row if it has exactly one, else the default warehouse, else the
    // largest holding — and log so the callsite gets fixed to pass a warehouse explicitly.
    let targetWarehouseId = warehouseId;
    if (!targetWarehouseId) {
      const rows = await client.stock_levels.findMany({
        where: { materialId },
        select: { warehouseId: true, quantity: true },
      });
      if (rows.length === 1) {
        targetWarehouseId = rows[0].warehouseId;
      } else if (rows.length > 1) {
        const defaultWh = await getDefaultWarehouseId(client);
        targetWarehouseId =
          defaultWh && rows.some((r: any) => r.warehouseId === defaultWh)
            ? defaultWh
            : rows.reduce((a: any, b: any) => (Number(a.quantity) >= Number(b.quantity) ? a : b)).warehouseId;
        logError(
          `[MaterialSync] Ambiguous warehouse for material ${materialId} (${rows.length} warehouse rows, none specified) — ` +
            `applied ${change} to warehouse ${targetWarehouseId} only. Fix the callsite to pass warehouseId.`,
          new Error('ambiguous warehouse in syncStockLevelQuantity')
        );
      }
      // rows.length === 0 → no row to update; the create path below resolves a warehouse for receipts
    }

    const updateResult = await client.stock_levels.updateMany({
      where: targetWarehouseId ? { materialId, warehouseId: targetWarehouseId } : { materialId },
      data: {
        quantity: change > 0 ? { increment: change } : { decrement: Math.abs(change) },
        lastUpdated: new Date(),
      },
    });

    // A deduction that matched no row is LOST — the ledger now overstates stock. Surface it
    // instead of silently succeeding (this was invisible drift before).
    if (updateResult.count === 0 && change < 0) {
      logError(
        `[MaterialSync] Deduction of ${Math.abs(change)} for material ${materialId} matched NO stock_levels row ` +
          `(warehouse ${targetWarehouseId || 'unresolved'}) — stock_levels now overstates stock.`,
        new Error('stock_levels deduction lost')
      );
    }

    // If no record was updated and we're adding stock, create one. A stock_levels row needs a
    // warehouse; when the caller doesn't supply one, fall back to the company's default warehouse
    // (Kashaya Fabs) so a receipt is never dropped (bug-hunt BH-0310).
    // BUG-TH10 fix: Use upsert to handle race condition where concurrent requests both see
    // updateResult.count === 0 and both try to create — one wins, one gets P2002 and loses
    // the stock receipt. Upsert guarantees exactly-once semantics.
    if (updateResult.count === 0 && change > 0) {
      const createWarehouseId = targetWarehouseId || (await getDefaultWarehouseId(client));
      if (!createWarehouseId) {
        logError(
          `[MaterialSync] No warehouse available to record ${change} of material ${materialId} — ` +
            `receipt NOT recorded. Create a warehouse (or pass one) so stock can be tracked.`,
          new Error('no warehouse available for stock_levels create')
        );
      } else {
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
        // BUG-TH10 fix: upsert instead of create to handle concurrent insert race
        await client.stock_levels.upsert({
          where: {
            materialId_warehouseId: { materialId, warehouseId: createWarehouseId },
          },
          create: {
            materialId,
            warehouseId: createWarehouseId,
            quantity: change,
            unit: resolvedUnit as any,
            lastUpdated: new Date(),
          },
          update: {
            quantity: { increment: change },
            lastUpdated: new Date(),
          },
        });
        logInfo(
          `[MaterialSync] Created/updated stock_levels for material ${materialId}, warehouse ${createWarehouseId}, qty: ${change}`
        );
      }
    }
  } catch (err) {
    logError(
      `[MaterialSync] Failed to sync stock_levels for material ${materialId}, warehouse ${warehouseId || 'ALL'}, change: ${change}`,
      err
    );
    // Don't throw — stock_levels sync failure shouldn't block the primary operation
  }
}

/**
 * BUG-MM13 fix: sync code to materials
 * Syncs code and/or name changes from a master table to the materials table.
 * Call this after updating a master record if code or name changed.
 *
 * @param masterId - The ID of the master record
 * @param masterType - The type of master (GREIGE, FABRIC, LACE, THREAD, etc.)
 * @param updates - Object with optional code and/or name to sync
 * @param tx - Optional Prisma transaction client
 */
export async function syncMasterToMaterials(
  masterId: string,
  masterType: string,
  updates: { code?: string; name?: string },
  tx?: any
): Promise<void> {
  const config = MASTER_CONFIG[masterType];
  if (!config) {
    logError(`[MaterialSync] Unknown master type for syncMasterToMaterials: ${masterType}`, new Error('unknown type'));
    return;
  }

  // Skip if no updates to sync
  if (!updates.code && !updates.name) return;

  const client = tx || prisma;

  try {
    const updateData: { code?: string; name?: string } = {};
    if (updates.code) updateData.code = updates.code;
    if (updates.name) updateData.name = updates.name;

    const result = await client.materials.updateMany({
      where: { [config.fkField]: masterId },
      data: updateData,
    });

    if (result.count > 0) {
      logInfo(
        `[MaterialSync] BUG-MM13 fix: synced ${Object.keys(updateData).join(', ')} to materials for ${masterType} ${masterId}`
      );
    }
  } catch (err) {
    logError(`[MaterialSync] Failed to sync master changes to materials for ${masterType} ${masterId}`, err);
    // Don't throw — sync failure shouldn't block the primary operation
  }
}
