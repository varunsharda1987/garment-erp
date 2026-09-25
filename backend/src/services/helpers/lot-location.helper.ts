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
