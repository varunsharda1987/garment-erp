/**
 * A finished colour settles its MRP requirements (2026-10-03).
 *
 * A job work line (one colour / fabric) is finished when its final delivery is in or the job is closed short
 * (jwo-lines.helper closeLine / closeOpenLinesShort). Until now nothing told MRP: the requirements it serves stayed
 * PARTIALLY_RECEIVED — "still on order" — for ever whenever the processor sent back a little less than allocated
 * (MR2609-0534: 3,683.2 of 3,700 m on a finished DJ-ESSKY075LS-001). The purchase-order twin is
 * purchaseOrder.service shortClosePurchaseOrder → settleAtDelivered.
 *
 * Settled = RECEIVED at what came back, the gap recorded in `shortQuantity` + `shortCloseReason` (null when the
 * colour came back in full). `shortfall` is left alone: on a processing requirement it is in GREIGE metres while
 * the links count fabric. Nothing is re-ordered — the colour is finished; a balance still needed is a new order.
 *
 * ONE entry point, `resettleJobRequirements`, idempotent, called after every write that can change a line's
 * closure or its links' received figures (receipt approval, reversal, Close short). It reads the current state,
 * so a reversal that reopens a colour un-settles it (the MRP credit has just recomputed its status) and a reversal
 * of a middle part of a finished colour re-settles it on the smaller total.
 */

import { MaterialRequirementStatus, Prisma } from '@prisma/client';
import { isQtyZero, qtyExceeds } from '../../utils/quantity';

type Tx = Prisma.TransactionClient;

/** The requirement statuses a job link can hold a requirement in — the only ones settling may move */
const ON_JOB: MaterialRequirementStatus[] = ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'];
/** A purchase order still delivering — a requirement it also serves is not finished */
const PO_DONE = ['RECEIVED', 'SHORT_CLOSED', 'CANCELLED'] as const;

/** The reason recorded on a requirement its job finished short — also how un-settling recognises its own rows */
export const JOB_SETTLE_PREFIX = 'Job work ';
const settleReason = (jobWorkNumber: string, how: 'FINAL' | 'SHORT' | null) =>
  `${JOB_SETTLE_PREFIX}${jobWorkNumber} ${how === 'SHORT' ? 'closed short — nothing more is coming' : 'final delivery in'}`;

export interface SettleOutcome {
  requirementNumber: string;
  change: 'settled' | 'reopened';
  short: number | null;
}

/**
 * Settle the requirements of a job's finished lines, and un-settle those of its open ones. A requirement is
 * settled only when EVERY job line serving it is finished and no purchase order linked to it is still delivering.
 */
export async function resettleJobRequirements(tx: Tx, jobWorkOrderId: string): Promise<SettleOutcome[]> {
  const job = await tx.job_work_orders.findUnique({
    where: { id: jobWorkOrderId },
    select: { jobWorkNumber: true },
  });
  if (!job) return [];
  const links = await tx.requirement_jwo_links.findMany({
    where: { jobWorkOrderId },
    select: { requirementId: true },
  });
  const requirementIds = [...new Set(links.map((l) => l.requirementId))];
  const outcomes: SettleOutcome[] = [];

  for (const requirementId of requirementIds) {
    const requirement = await tx.material_requirements.findUnique({
      where: { id: requirementId },
      select: {
        id: true,
        requirementNumber: true,
        status: true,
        shortQuantity: true,
        shortCloseReason: true,
        // Every job line serving it — a requirement may be split across jobs
        requirement_jwo_links: {
          select: {
            allocatedQuantity: true,
            receivedQuantity: true,
            line: { select: { closedAt: true, closedHow: true, jobWorkOrderId: true } },
            job_work_orders: { select: { jobWorkNumber: true, jwoStatus: true } },
          },
        },
        requirement_po_links: { select: { purchase_orders: { select: { status: true } } } },
      },
    });
    if (!requirement || !ON_JOB.includes(requirement.status)) continue;

    const live = requirement.requirement_jwo_links.filter((l) => l.job_work_orders.jwoStatus !== 'CANCELLED');
    const finished =
      live.length > 0 &&
      live.every((l) => l.line?.closedAt != null) &&
      requirement.requirement_po_links.every((l) => (PO_DONE as readonly string[]).includes(l.purchase_orders.status));
    const ownedBySettle = !!requirement.shortCloseReason?.startsWith(JOB_SETTLE_PREFIX);

    if (finished) {
      const allocated = live.reduce((sum, l) => sum + Number(l.allocatedQuantity), 0);
      const received = live.reduce((sum, l) => sum + Number(l.receivedQuantity), 0);
      const shortBy = qtyExceeds(allocated, received) ? Math.round((allocated - received) * 1000) / 1000 : null;
      // The finished line that decides the wording: a short close anywhere reads as one
      const how = live.some((l) => l.line?.closedHow === 'SHORT') ? 'SHORT' : 'FINAL';
      const reason = shortBy != null ? settleReason(job.jobWorkNumber, how) : null;
      const unchanged =
        requirement.status === 'RECEIVED' &&
        (requirement.shortQuantity == null
          ? shortBy == null
          : Math.abs(Number(requirement.shortQuantity) - (shortBy ?? 0)) < 0.0005) &&
        (requirement.shortCloseReason ?? null) === reason;
      // A short recorded by someone else (a PO short-close) is theirs to keep
      if (unchanged || (requirement.shortCloseReason && !ownedBySettle)) continue;
      await tx.material_requirements.update({
        where: { id: requirement.id },
        data: { status: 'RECEIVED', shortQuantity: shortBy, shortCloseReason: reason },
      });
      outcomes.push({ requirementNumber: requirement.requirementNumber, change: 'settled', short: shortBy });
    } else if (ownedBySettle) {
      // A colour reopened (its closing receipt was reversed): the status the MRP credit just recomputed stands;
      // only the short record this helper wrote goes
      const received = live.reduce((sum, l) => sum + Number(l.receivedQuantity), 0);
      const allocated = live.reduce((sum, l) => sum + Number(l.allocatedQuantity), 0);
      const status: MaterialRequirementStatus =
        requirement.status !== 'RECEIVED' || qtyExceeds(allocated, received)
          ? isQtyZero(received)
            ? 'PO_SENT'
            : 'PARTIALLY_RECEIVED'
          : 'RECEIVED';
      await tx.material_requirements.update({
        where: { id: requirement.id },
        data: { status, shortQuantity: null, shortCloseReason: null },
      });
      outcomes.push({ requirementNumber: requirement.requirementNumber, change: 'reopened', short: null });
    }
  }
  return outcomes;
}
