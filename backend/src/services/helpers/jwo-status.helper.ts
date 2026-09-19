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
 * YDS/GM (mrp.service.ts unitToJwoUom) are deliberately absent: the GRN cannot convert units, so a
 * yard job must stay on the legacy route. No YARD/GRAM material exists today.
 */
export const JWO_GRN_UOMS: string[] = ['MTR'];

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
