/**
 * Where an order's material requirements stand, in words the order page can print (2026-09-28).
 *
 * The order page's "Materials (MRP)" box showed Total / Pending PO / "PO Generated" / "With Shortfall"
 * from GET /mrp/orders/:id/summary. "PO Generated" was Total − Pending PO, so CANCELLED, stock-covered,
 * received and size-pending lines all counted as POs: ORD2026080033 read "36 PO Generated · 90 %"
 * with 30 of its 40 lines CANCELLED and not one PO. Here every live line is counted in exactly one
 * bucket, by its status; CANCELLED and CONVERTED lines are not the order's any more and are left out.
 *
 * Split by requirementType, the way the Requirements page's tabs split them: MATERIAL (bought on a
 * PO) and PROCESSING (dyeing / printing — ordered as job work).
 */

import { MaterialRequirementStatus, Prisma, PrismaClient } from '@prisma/client';
import { isQtyZero } from '../../utils/quantity';

type DbClient = Prisma.TransactionClient | PrismaClient;

export interface RequirementBuckets {
  /** Live lines: every status except CANCELLED / CONVERTED */
  live: number;
  /** Still to be ordered: PO_REQUIRED, or PARTIAL_STOCK short by more than dust (NEEDS_PO_WHERE's rule) */
  toOrder: number;
  /** On a PO / job work, not all in yet */
  onOrder: number;
  /** Received in full */
  received: number;
  /** Covered from stock */
  fromStock: number;
  /** Size-wise lines waiting for the order's size split */
  waitingSizes: number;
  /** A new BOM version needs more than was ordered — the team must choose */
  needDecision: number;
  /** Not worked out yet */
  notChecked: number;
}

const ON_ORDER: MaterialRequirementStatus[] = ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'];

const empty = (): RequirementBuckets => ({
  live: 0,
  toOrder: 0,
  onOrder: 0,
  received: 0,
  fromStock: 0,
  waitingSizes: 0,
  needDecision: 0,
  notChecked: 0,
});

/** One line → its bucket (null when the line is not live). */
export function requirementBucket(
  status: MaterialRequirementStatus,
  shortfall: number
): Exclude<keyof RequirementBuckets, 'live'> | null {
  if (status === 'CANCELLED' || status === 'CONVERTED') return null;
  if (status === 'PO_REQUIRED') return 'toOrder';
  if (status === 'PARTIAL_STOCK') return isQtyZero(shortfall) ? 'fromStock' : 'toOrder';
  if (ON_ORDER.includes(status)) return 'onOrder';
  if (status === 'RECEIVED') return 'received';
  if (status === 'FULFILLED_STOCK') return 'fromStock';
  if (status === 'SIZE_PENDING') return 'waitingSizes';
  if (status === 'DECISION_PENDING') return 'needDecision';
  return 'notChecked'; // PENDING
}

export async function orderRequirementBuckets(
  client: DbClient,
  orderId: string
): Promise<{ material: RequirementBuckets; processing: RequirementBuckets }> {
  const rows = await client.material_requirements.findMany({
    where: { orderId },
    select: { status: true, shortfall: true, requirementType: true },
  });
  const material = empty();
  const processing = empty();
  for (const row of rows) {
    const bucket = requirementBucket(row.status, Number(row.shortfall));
    if (!bucket) continue;
    const target = row.requirementType === 'PROCESSING' ? processing : material;
    target.live += 1;
    target[bucket] += 1;
  }
  return { material, processing };
}
