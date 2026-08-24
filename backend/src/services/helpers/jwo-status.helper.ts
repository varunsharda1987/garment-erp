/**
 * JWO status helper — the single authority for writing job_work_orders status.
 *
 * job_work_orders carries TWO status columns: the universal `jwoStatus`
 * (JobWorkOrderStatus, Phase 7) and the legacy `status` (JobWorkStatus), which old
 * screens/gates still read. Before 2026-08-22 different flows wrote different columns,
 * so a cancelled job could keep legacy `READY_TO_SEND` and stay on the "at processor" /
 * receivable lists forever — receiving its returned rolls then double-counted stock
 * (data-ownership landmine №1).
 *
 * The rule now: `jwoStatus` is the single source of truth; the legacy column is a derived
 * MIRROR written only through this helper via JWO_TO_LEGACY_STATUS. Never write either
 * column directly in an update — call setJwoStatus / setJwoStatusMany (creates may still
 * seed the initial DRAFT/READY_TO_SEND pair explicitly). Legacy can be dropped once every
 * reader is on jwoStatus.
 */

import { Prisma, PrismaClient, JobWorkOrderStatus, JobWorkStatus } from '@prisma/client';

type DbClient = Prisma.TransactionClient | PrismaClient;

/**
 * jwoStatus → legacy mirror value. `null` = leave the legacy column untouched
 * (PARTIALLY_RECEIVED keeps legacy at AT_MILL until fully received — the pre-existing
 * external-process convention; CLOSED happens after the legacy chain is already terminal).
 */
export const JWO_TO_LEGACY_STATUS: Record<JobWorkOrderStatus, JobWorkStatus | null> = {
  DRAFT: 'READY_TO_SEND',
  PENDING_APPROVAL: 'READY_TO_SEND',
  APPROVED: 'READY_TO_SEND',
  ISSUED: 'AT_MILL',
  IN_TRANSIT: 'SENT_TO_MILL',
  AT_PROCESSOR: 'AT_MILL',
  PARTIALLY_RECEIVED: null,
  RECEIVED: 'RECEIVED',
  QUALITY_CHECKED: 'QUALITY_CHECKED',
  STOCK_UPDATED: 'STOCK_UPDATED',
  CLOSED: null,
  CANCELLED: 'CANCELLED',
};

/**
 * Prisma where-fragment excluding dead JWOs. Explicit OR because Prisma `not` on a
 * nullable enum silently excludes NULL (legacy) rows — pattern proven in
 * job-work-statutory.service.ts. Spread into a where with `AND: [JWO_ACTIVE_FILTER]`.
 */
export const JWO_ACTIVE_FILTER = {
  OR: [{ jwoStatus: null }, { jwoStatus: { notIn: ['CANCELLED', 'CLOSED'] as JobWorkOrderStatus[] } }],
};

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
 * Set a JWO's status — writes jwoStatus AND its legacy mirror in one update.
 * `extra` carries any other fields the same update must set (receivedDate, remarks, …).
 */
export async function setJwoStatus(
  client: DbClient,
  jwoId: string,
  jwoStatus: JobWorkOrderStatus,
  // Unchecked variant: callers stamp FK scalars (grnId, inwardChallanId, …) alongside status
  extra?: Prisma.job_work_ordersUncheckedUpdateInput
) {
  const legacy = JWO_TO_LEGACY_STATUS[jwoStatus];
  return client.job_work_orders.update({
    where: { id: jwoId },
    data: {
      jwoStatus,
      ...(legacy ? { status: legacy } : {}),
      ...(extra ?? {}),
    },
  });
}

/**
 * Guarded bulk variant for updateMany-style transitions (e.g. GRN's "receive only if
 * still at mill"). Same both-columns contract; returns the updateMany result so callers
 * can assert count.
 */
export async function setJwoStatusMany(
  client: DbClient,
  where: Prisma.job_work_ordersWhereInput,
  jwoStatus: JobWorkOrderStatus,
  // Unchecked variant: callers stamp FK scalars (grnId, inwardChallanId, …) alongside status
  extra?: Prisma.job_work_ordersUncheckedUpdateManyInput
) {
  const legacy = JWO_TO_LEGACY_STATUS[jwoStatus];
  return client.job_work_orders.updateMany({
    where,
    data: {
      jwoStatus,
      ...(legacy ? { status: legacy } : {}),
      ...(extra ?? {}),
    },
  });
}
