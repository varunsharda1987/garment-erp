/**
 * JWO status helper — the single authority for writing job_work_orders status.
 *
 * `jwoStatus` is the single status field for job work orders. The legacy `status`
 * column (JobWorkStatus) has been retired. All status reads and writes go through
 * this helper.
 *
 * History: Before 2026-08-22 different flows wrote different columns, so a cancelled
 * job could keep legacy `READY_TO_SEND` and stay on the "at processor" / receivable
 * lists forever — receiving its returned rolls then double-counted stock (data-ownership
 * landmine №1). The dual-column was fixed, then migrated, then the legacy column dropped.
 */

import { Prisma, PrismaClient, JobWorkOrderStatus } from '@prisma/client';
import { BusinessError } from '../../errors';
import { jwoUomToUnit } from '../../utils/units';
import type { Unit } from '../../schemas/generated/prisma-enums';

type DbClient = Prisma.TransactionClient | PrismaClient;

/**
 * Prisma where-fragment excluding dead JWOs. Spread into a where with `AND: [JWO_ACTIVE_FILTER]`.
 */
export const JWO_ACTIVE_FILTER = { jwoStatus: { notIn: ['CANCELLED', 'CLOSED'] as JobWorkOrderStatus[] } };

/** True when this jwoStatus means the order can no longer receive material. */
export function isJwoDead(jwoStatus: JobWorkOrderStatus | null | undefined): boolean {
  return jwoStatus === 'CANCELLED' || jwoStatus === 'CLOSED';
}

/** Statuses before material is issued (can still modify components, delete, etc.) */
export const JWO_PRE_ISSUE_STATUSES: JobWorkOrderStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];

/** Statuses while at processor (can receive material) */
export const JWO_AT_PROCESSOR_STATUSES: JobWorkOrderStatus[] = [
  'ISSUED',
  'IN_TRANSIT',
  'AT_PROCESSOR',
  'PARTIALLY_RECEIVED',
];

/** Statuses after receipt (close allowed) */
export const JWO_RECEIVED_STATUSES: JobWorkOrderStatus[] = ['RECEIVED', 'QUALITY_CHECKED', 'STOCK_UPDATED'];

/**
 * UOMs whose receipt creates a stock lot, so they are received through the GRN and never through
 * POST /job-work-orders/:id/receive (which books no stock). Piece work stays on that legacy route.
 *
 * One home for the split: the guard, the /receivable picker and the GRN's own refusal all read this,
 * because they drifted apart once already — the guard checked lineage columns as well as uom, so a
 * metre job with no greige lot slipped through, was stamped RECEIVED with no stock, and was then
 * locked out of the GRN as "already received".
 *
 * Only MTR: the GRN cannot convert units. MRP no longer mints YDS/GM jobs at all — utils/units.ts
 * `unitToJwoUom` maps a stock unit to MTR / PCS / KG or refuses it.
 */
export const JWO_GRN_UOMS: string[] = ['MTR'];

/**
 * The stock unit a job's goods move in, for its challans and stock movements. One reading for every
 * path: issuance used to make a KG job PIECE (`uom === 'MTR' ? METER : PIECE`) while the unprocessed
 * return made the same job METER (`uom === 'PCS' ? PIECE : METER`).
 */
export function jwoStockUnit(uom: string | null | undefined): Unit {
  const unit = jwoUomToUnit(uom);
  if (!unit) {
    throw new BusinessError(`Job work order unit '${uom ?? ''}' is not one stock can move in (MTR, PCS, KG or TRIP).`);
  }
  return unit;
}

/**
 * Row-lock a job for the rest of the caller's transaction — call it FIRST, before any read the
 * transaction decides on. Every write that adds to the job's running figures (receive a part, return
 * unprocessed, close short, piece-work receive) takes it, so two submits of the same job serialise:
 * the second waits for the first to commit, then reads its totals.
 *
 * Without it, six presses of "Receive from processor" queued behind a stalled server all read
 * "0 received so far", sailed past the over-receipt cap and filed six receipts for one delivery
 * (DJ-ESSKY076LS-001, 2026-09-25). Everything the locked transaction does to this row must go through
 * the SAME `tx` — a write on the global client waits on this lock until the transaction times out.
 */
export async function lockJobWorkOrder(tx: Prisma.TransactionClient, jwoId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM job_work_orders WHERE id = ${jwoId} FOR UPDATE`;
}

/**
 * Set a JWO's status.
 * `extra` carries any other fields the same update must set (receivedDate, remarks, …).
 */
export async function setJwoStatus(
  client: DbClient,
  jwoId: string,
  jwoStatus: JobWorkOrderStatus,
  extra?: Prisma.job_work_ordersUncheckedUpdateInput
) {
  return client.job_work_orders.update({
    where: { id: jwoId },
    data: { jwoStatus, ...(extra ?? {}) },
  });
}

/**
 * Guarded bulk variant for updateMany-style transitions (e.g. GRN's "receive only if
 * still at processor"). Returns the updateMany result so callers can assert count.
 */
export async function setJwoStatusMany(
  client: DbClient,
  where: Prisma.job_work_ordersWhereInput,
  jwoStatus: JobWorkOrderStatus,
  extra?: Prisma.job_work_ordersUncheckedUpdateManyInput
) {
  return client.job_work_orders.updateMany({
    where,
    data: { jwoStatus, ...(extra ?? {}) },
  });
}
