/**
 * Where a lot is — and so where a job-work challan's goods leave from.
 *
 * Until 2026-09-25 every job-work challan printed "From: Main Warehouse", a name that exists
 * nowhere in `warehouses`, even for cloth that had been delivered straight to the dyer weeks
 * earlier (the Aryan lot: at the dyer since 12-Aug-2026, challans CH2609-0056 / CH2609-0144 say
 * it left "Main Warehouse" in September). The challan is the Rule 45 / Rule 55 document, so it
 * names the real store the goods left.
 *
 * Phase 1 of the direct-to-processor plan (C:\Users\NEW\.claude\plans\we-have-recently-made-
 * wondrous-volcano.md). Phase 2 grows this file into the one authority on a lot's location
 * (greigeHolderId, resolveLotLocation, the store / held-by-processor query builders).
 */
import type { Prisma } from '@prisma/client';
import { getDefaultWarehouseId } from './material-sync.helper';

/** Prisma client or transaction client — only the warehouses table is read. */
type WarehouseReader = Pick<Prisma.TransactionClient, 'warehouses'>;

export interface ChallanOrigin {
  fromType: 'WAREHOUSE';
  /** Set only when the goods leave from exactly one store. */
  fromId?: string;
  fromName: string;
}

/** Names shown on one challan header before the rest collapse to "+N more". */
const MAX_NAMED_STORES = 3;

/**
 * The "From" of an outward job-work challan: the store(s) the lots leave. With no lot at all
 * (garments or other work sent without a stock lot) the goods leave our default store — the same
 * fallback the stock-level sync uses (`getDefaultWarehouseId`).
 */
export async function challanOrigin(
  client: WarehouseReader,
  warehouseIds: Array<string | null | undefined>
): Promise<ChallanOrigin> {
  const ids = [...new Set(warehouseIds.filter((id): id is string => !!id))];
  if (ids.length === 0) {
    const fallback = await getDefaultWarehouseId(client);
    if (fallback) ids.push(fallback);
  }
  const rows =
    ids.length > 0
      ? await client.warehouses.findMany({ where: { id: { in: ids } }, select: { id: true, warehouseName: true } })
      : [];
  // Keep the caller's order (largest lot first) rather than the database's.
  const names = ids.map((id) => rows.find((r) => r.id === id)?.warehouseName).filter((n): n is string => !!n);

  if (names.length === 0) return { fromType: 'WAREHOUSE', fromName: 'Our store' };
  const shown = names.slice(0, MAX_NAMED_STORES).join(' + ');
  const rest = names.length - MAX_NAMED_STORES;
  return {
    fromType: 'WAREHOUSE',
    ...(ids.length === 1 && rows.length === 1 ? { fromId: ids[0] } : {}),
    fromName: rest > 0 ? `${shown} +${rest} more` : shown,
  };
}

export interface ChallanDestination {
  toType: 'WAREHOUSE';
  toId?: string;
  toName: string;
}

/**
 * The "To" of an INWARD challan: the store(s) the goods came back into. Until 2026-09-26 every inward
 * challan read "To: Main Warehouse", a name that exists nowhere in `warehouses` — the mirror of the
 * outward "From" that challanOrigin fixed.
 */
export async function challanDestination(
  client: WarehouseReader,
  warehouseIds: Array<string | null | undefined>
): Promise<ChallanDestination> {
  const origin = await challanOrigin(client, warehouseIds);
  return { toType: 'WAREHOUSE', ...(origin.fromId ? { toId: origin.fromId } : {}), toName: origin.fromName };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Where a lot IS (Phase 2). One authority, so no reader re-derives it from a single column.
//
// greige_stock has two homes for "which processor holds this": processorId (set for DIRECT lots a
// supplier delivered straight to a processor, and for TRANSFER lots a Stock-Out challan parked
// there) and the lot's warehouse (a processor's "… - Processing Unit", warehouseType JOB_WORK,
// supplierId = the processor). Lace and fabric lots have only the warehouse. Read both, here.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Select this on a lot's `warehouse` relation so the helpers below can place it. */
export const LOT_WAREHOUSE_SELECT = {
  id: true,
  warehouseName: true,
  warehouseType: true,
  supplierId: true,
  supplier: { select: { name: true } },
} as const;

export interface LotWarehouseInfo {
  id?: string;
  warehouseName: string;
  warehouseType: string;
  supplierId: string | null;
  supplier?: { name: string } | null;
}

export type LotLocationCategory = 'AT_THIS_PROCESSOR' | 'OUR_STORE' | 'AT_OTHER_PROCESSOR';

export interface LotLocation {
  category: LotLocationCategory;
  /** The processor physically holding the lot, or null when it is in our store. */
  holderProcessorId: string | null;
  /** Its name when known (from the lot's processor or its unit's supplier). */
  holderName: string | null;
  warehouseName: string | null;
  /**
   * In a processor's unit with no processorId: greige a supplier delivered straight to a processor
   * before such deliveries were booked as held there (the Aug-2026 lots). Converted by
   * scripts/backfill-direct-delivery.ts; until then it issues like store stock, on a challan.
   */
  legacyUnitLot: boolean;
}

interface LocatableLot {
  processorId?: string | null;
  processor?: { name: string } | null;
  warehouse?: LotWarehouseInfo | null;
}

function unitHolder(warehouse: LotWarehouseInfo | null | undefined): string | null {
  if (!warehouse || warehouse.warehouseType !== 'JOB_WORK') return null;
  return warehouse.supplierId ?? 'UNLINKED_UNIT';
}

/** Who physically holds a greige lot: its processorId, else the processor whose unit it sits in. */
export function greigeHolderId(lot: LocatableLot): string | null {
  const unit = unitHolder(lot.warehouse);
  return lot.processorId ?? (unit && unit !== 'UNLINKED_UNIT' ? unit : null);
}

/**
 * Does this lot's quantity sit in the stock ledger (stock_levels / derived_stock_view)? A TRANSFER lot
 * is a shadow of metres already taken off a store lot by a Stock-Out challan — never added to the
 * ledger, so it must never be taken off it either. Every other lot (GRN, DIRECT, MANUAL…) is on it.
 */
export function lotCountsOnHand(lot: { sourceType?: string | null }): boolean {
  return lot.sourceType !== 'TRANSFER';
}

/** What a planning reader (MRP) selects on a greige lot, so `greigeCountsForPlanning` can place it. */
export const PLANNING_LOT_SELECT = {
  id: true,
  greigeId: true,
  processorId: true,
  sourceType: true,
  quantityAvailable: true,
  quantityReserved: true,
  receivedDate: true,
  warehouse: { select: LOT_WAREHOUSE_SELECT },
} as const;

/**
 * May MRP plan a requirement against this greige lot? Owner, 2026-09-25: greige held at a dyer counts.
 * A requirement to be processed at `requirementProcessorId` may use our stores and the cloth already at
 * THAT processor; one with no processor yet may use cloth at any processor. Never another processor's
 * cloth when the processor is known — it would have to travel between job workers first.
 * A TRANSFER lot with no holder is a Stock-Out leftover at our store and never counts.
 */
export function greigeCountsForPlanning(
  lot: LocatableLot & { sourceType?: string | null },
  requirementProcessorId: string | null
): boolean {
  if (lot.sourceType === 'TRANSFER' && !lot.processorId) return false;
  const holder = greigeHolderId(lot);
  const inUnit = lot.warehouse?.warehouseType === 'JOB_WORK';
  if (!holder) return !inUnit; // our store — or a unit linked to no processor, which cannot be placed
  return requirementProcessorId == null || holder === requirementProcessorId;
}

/**
 * Is this lot sitting in a processor's unit? Lace and fabric lots have no processorId, so their unit
 * is the only place signal. Such a lot is physically at the processor: it can be drawn there by that
 * processor's job, but it cannot be allocated or issued to our production floor from where it lies.
 */
export function lotInProcessorUnit(lot: { warehouse?: Pick<LotWarehouseInfo, 'warehouseType'> | null }): boolean {
  return lot.warehouse?.warehouseType === 'JOB_WORK';
}

/**
 * Prisma `where` for lace / fabric lots NOT in a processor's unit — our stores, or no warehouse
 * recorded. A fresh object each call: Prisma's `OR` takes a mutable array.
 */
export function notInProcessorUnitWhere() {
  return {
    OR: [{ warehouseId: null }, { warehouse: { warehouseType: { not: 'JOB_WORK' as const } } }],
  };
}

/** What a planning reader (MRP) selects on a lace lot, so `laceCountsForPlanning` can place it. */
export const PLANNING_LACE_LOT_SELECT = {
  id: true,
  laceId: true,
  quantityAvailable: true,
  quantityReserved: true,
  receivedDate: true,
  warehouse: { select: LOT_WAREHOUSE_SELECT },
} as const;

/**
 * May MRP plan a lace requirement against this lace lot? The same rule as greige
 * (`greigeCountsForPlanning`): our stores, plus lace already at the requirement's own processor (at any
 * processor while none is chosen), never another processor's lace. Lace has no processorId, so the
 * lot's unit is what places it.
 */
export function laceCountsForPlanning(
  lot: { warehouse?: LotWarehouseInfo | null },
  requirementProcessorId: string | null
): boolean {
  return greigeCountsForPlanning({ warehouse: lot.warehouse }, requirementProcessorId);
}

/** The processor whose unit a lace / fabric lot sits in, or null for our store. */
export function unitLotHolderId(lot: { warehouse?: LotWarehouseInfo | null }): string | null {
  return greigeHolderId({ warehouse: lot.warehouse });
}

/**
 * Place a lot relative to the processor a job is for. Conflicting signals (processorId says one
 * processor, the unit another) take the conservative answer: AT_OTHER_PROCESSOR — never issued.
 */
export function resolveLotLocation(lot: LocatableLot, targetProcessorId: string | null): LotLocation {
  const unit = unitHolder(lot.warehouse);
  const warehouseName = lot.warehouse?.warehouseName ?? null;
  const unitName = lot.warehouse?.supplier?.name ?? warehouseName;

  if (lot.processorId) {
    const conflict = unit != null && unit !== lot.processorId;
    const atThis = !conflict && targetProcessorId != null && lot.processorId === targetProcessorId;
    return {
      category: atThis ? 'AT_THIS_PROCESSOR' : 'AT_OTHER_PROCESSOR',
      holderProcessorId: lot.processorId,
      holderName: lot.processor?.name ?? unitName,
      warehouseName,
      legacyUnitLot: false,
    };
  }
  if (unit) {
    const atThis = unit !== 'UNLINKED_UNIT' && targetProcessorId != null && unit === targetProcessorId;
    return {
      category: atThis ? 'AT_THIS_PROCESSOR' : 'AT_OTHER_PROCESSOR',
      holderProcessorId: unit === 'UNLINKED_UNIT' ? null : unit,
      holderName: unitName,
      warehouseName,
      legacyUnitLot: true,
    };
  }
  return { category: 'OUR_STORE', holderProcessorId: null, holderName: null, warehouseName, legacyUnitLot: false };
}
