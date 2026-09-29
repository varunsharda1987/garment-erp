/**
 * The states of a goods-in-transit challan (2026-09-29) — ONE definition every reader imports.
 *
 * A transit challan is our Rule 45 challan for goods a supplier despatches STRAIGHT to a processor, issued before
 * they arrive (the dyer will not inward goods without it). Its marker is `supplierDispatchedAt`; the status alone
 * is not one — receiveChallan writes IN_TRANSIT on ordinary challans too (challan.service receiveChallan).
 *
 *   OPEN      on the way, no receipt yet                 status IN_TRANSIT, directSupplyGrnId null
 *   CLAIMED   a receipt against it waits for QC           status IN_TRANSIT, directSupplyGrnId = that receipt
 *   ADOPTED   the receipt was approved: lots linked,      status ISSUED / PARTIALLY_RECEIVED / RECEIVED
 *             arrivedQty on its lines, return clock from arrival
 *   CANCELLED the truck never came / the goods went elsewhere
 *
 * The writers are in direct-supply-challan.helper.ts. This file imports nothing that could import it back
 * (po-delivery-plan.helper and the readers use it).
 */
import type { Prisma } from '@prisma/client';
import { toDateInputValue } from '../../utils/date';
import { BusinessError } from '../../errors';

export type TransitState = 'OPEN' | 'CLAIMED' | 'ADOPTED' | 'CANCELLED';

interface TransitMarked {
  supplierDispatchedAt?: Date | string | null;
  status?: string | null;
  directSupplyGrnId?: string | null;
}

/** Was this challan issued while the goods were in transit (whatever has happened since)? */
export function isTransitChallan(c: TransitMarked): boolean {
  return c.supplierDispatchedAt != null;
}

export function transitStateOf(c: TransitMarked): TransitState | null {
  if (!isTransitChallan(c)) return null;
  if (c.status === 'CANCELLED') return 'CANCELLED';
  if (c.status === 'IN_TRANSIT') return c.directSupplyGrnId ? 'CLAIMED' : 'OPEN';
  return 'ADOPTED';
}

/** Every transit-issued challan, in any state */
export const TRANSIT_WHERE = { supplierDispatchedAt: { not: null } } satisfies Prisma.challansWhereInput;

/** On the way, no receipt against it yet */
export const OPEN_TRANSIT_WHERE = {
  supplierDispatchedAt: { not: null },
  status: 'IN_TRANSIT',
  directSupplyGrnId: null,
} satisfies Prisma.challansWhereInput;

/** A receipt against it waits for QC */
export const CLAIMED_TRANSIT_WHERE = {
  supplierDispatchedAt: { not: null },
  status: 'IN_TRANSIT',
  directSupplyGrnId: { not: null },
} satisfies Prisma.challansWhereInput;

/** Not yet adopted: open or claimed — the goods are not booked at the processor yet */
export const PENDING_TRANSIT_WHERE = {
  supplierDispatchedAt: { not: null },
  status: 'IN_TRANSIT',
} satisfies Prisma.challansWhereInput;

/** The IST calendar day of a moment, as UTC midnight — how receipt dates are stored (a YYYY-MM-DD input) */
export function istDay(value: Date | string): Date {
  return new Date(`${toDateInputValue(value)}T00:00:00.000Z`);
}

/** A PO with goods on the way under a transit challan cannot be cancelled or closed short. */
export async function assertNoPendingTransit(
  client: Pick<Prisma.TransactionClient, 'challans'>,
  poId: string,
  action: string
): Promise<void> {
  const pending = await client.challans.findMany({
    where: { ...PENDING_TRANSIT_WHERE, purchaseOrderId: poId },
    select: { challanNumber: true },
  });
  if (pending.length > 0) {
    const numbers = pending.map((c) => c.challanNumber).join(', ');
    throw new BusinessError(
      `Cannot ${action}: goods are on the way under ${numbers}. Receive them, or cancel the challan if they never came.`,
      { code: 'PO_HAS_GOODS_IN_TRANSIT', reason: 'PO_HAS_GOODS_IN_TRANSIT', challans: numbers }
    );
  }
}

/**
 * The same day one calendar year on — the Sec 143 return date from the day the job worker received the goods.
 * Calendar, not 365 days: the print reads the arrival back as expectedDate − 1 year, and job due dates use a
 * calendar year too (a 365-day step put the two a day apart across a 29-Feb).
 */
export function yearAfter(day: Date): Date {
  const d = new Date(day);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}
