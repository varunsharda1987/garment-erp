/**
 * Job-work challan lifecycle — the single authority for closing a job's OUTWARD challan.
 *
 * A job work order sends goods out under an OUTWARD challan and gets them back under one or more
 * INWARD challans. Until 2026-09-21 only the first half was ever written: the receive flow created
 * the INWARD challan and left it `DRAFT`, and nothing ever moved the OUTWARD challan off `ISSUED`.
 *
 * The cost of that was not cosmetic. "OUTWARD + ISSUED" is the only cheap signal for *goods still
 * sitting at a vendor*, so once every returned job kept that status forever the signal was dead —
 * the Manufacturing Control Center's overdue-challan alert could not be made to work at all, and a
 * genuinely outstanding challan (CH2607-0001, 500 units at Manish Textiles since 2026-07-29) was
 * indistinguishable from two that had already come back in full.
 *
 * Rules this helper encodes, so no caller has to remember them:
 *
 * 1. **A challan can carry SEVERAL jobs.** A consolidated dispatch files ONE challan for the vehicle
 *    and stamps its id onto every job in the load (`job-work-issuance.service.ts:1044` creates it,
 *    `:786` writes `outwardChallanId` per job). Closing it because the first job came back would
 *    hide the rest of the load from the overdue alert — the exact failure this helper exists to
 *    prevent. So the challan closes only when EVERY job on it is settled.
 * 2. **Returns arrive in PARTS** (Phase 3, migration `20260919112815`). A non-final receipt caps the
 *    challan at `PARTIALLY_RECEIVED`. A short first delivery is not a completed return.
 * 3. **Never write `receivedQuantity` on an OUTWARD challan.** What went out was greige; what came
 *    back is finished fabric — different material, different quantity, often a different unit.
 *    Stamping the return quantity onto the dispatch document corrupts a GST record.
 * 4. **Never resurrect a CANCELLED challan**, and never touch one a human received by hand.
 * 5. **Reversal is symmetric** — see `resyncOutwardChallanAfterReversal`.
 * 6. **Best-effort, never fatal.** A job-work return books stock, an inward challan, the loss split
 *    and MRP in one transaction. A challan whose status could not be advanced is a reporting defect;
 *    failing the whole receipt over it would be worse. Callers log and continue.
 *
 * Deliberately does NOT go through `receiveChallan()` (`challan.service.ts:810-958`): that credits
 * stock, and the GRN transaction has already booked the lot. Routing through it would double-count.
 */

import { Prisma, PrismaClient, ChallanStatus } from '@prisma/client';
import { JWO_RECEIVED_STATUSES } from './jwo-status.helper';

type DbClient = Prisma.TransactionClient | PrismaClient;

/** Statuses an outward challan can still be moved out of. CANCELLED and DRAFT are not ours to move. */
const OUTWARD_OPEN_STATUSES: ChallanStatus[] = ['ISSUED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'];

/** A job that can no longer bring material back: received in full, or dead. */
const SETTLED_JWO_STATUSES = [...JWO_RECEIVED_STATUSES, 'CANCELLED', 'CLOSED'];

/**
 * Advance a job's OUTWARD challan to reflect what has come back.
 *
 * Must run AFTER the job's own status has been written, or the "is every job on this challan
 * settled?" check reads a stale status and downgrades a legitimate close to a part-close.
 *
 * @returns the status it was moved to, or null when there was nothing to move.
 */
export async function closeOutwardChallanForJwo(
  tx: DbClient,
  jobWorkOrderId: string,
  opts: { isFinal: boolean; receivedById: string; receivedAt: Date }
): Promise<ChallanStatus | null> {
  const jwo = await tx.job_work_orders.findUnique({
    where: { id: jobWorkOrderId },
    select: { outwardChallanId: true },
  });
  if (!jwo?.outwardChallanId) return null;

  // Rule 1: every job riding this challan, not just the one we received.
  const unsettled = await tx.job_work_orders.count({
    where: {
      outwardChallanId: jwo.outwardChallanId,
      jwoStatus: { notIn: SETTLED_JWO_STATUSES as never },
    },
  });

  // Rule 2 caps a part-receipt even when this is the only job on the challan.
  const target: ChallanStatus = opts.isFinal && unsettled === 0 ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

  // updateMany with a status guard rather than update: a no-op (count 0) on a CANCELLED or DRAFT
  // challan instead of a throw, which keeps rule 6 honest without a read-then-write race.
  const moved = await tx.challans.updateMany({
    where: { id: jwo.outwardChallanId, status: { in: OUTWARD_OPEN_STATUSES } },
    data: {
      status: target,
      // Only a closed return has a return date and a receiver. Rule 3: no receivedQuantity.
      ...(target === 'RECEIVED' ? { receivedDate: opts.receivedAt, receivedById: opts.receivedById } : {}),
    },
  });

  return moved.count > 0 ? target : null;
}

/**
 * Resync a job's OUTWARD challan after a receipt is reversed.
 *
 * Reversal has THREE outcomes, not two — reversing a middle part of a job that is still closed must
 * not reopen the challan:
 *
 * | remaining receipts | job still final | outward challan |
 * |---|---|---|
 * | 0 | — | back to `ISSUED` — out at the vendor again, receipt facts cleared |
 * | ≥1 | yes | stays as it is (another job on a shared challan may still hold it open) |
 * | ≥1 | no | `PARTIALLY_RECEIVED`, return date cleared |
 *
 * @param remainingReceipts ACCEPTED receipts surviving the reversal.
 * @param stillFinal whether the job remains closed (the reversed receipt was not the final one).
 */
export async function resyncOutwardChallanAfterReversal(
  tx: DbClient,
  jobWorkOrderId: string,
  opts: { remainingReceipts: number; stillFinal: boolean }
): Promise<ChallanStatus | null> {
  const jwo = await tx.job_work_orders.findUnique({
    where: { id: jobWorkOrderId },
    select: { outwardChallanId: true },
  });
  if (!jwo?.outwardChallanId) return null;

  // Still closed: nothing to reopen. The quantity is not ours to correct (rule 3).
  if (opts.stillFinal && opts.remainingReceipts > 0) return null;

  const target: ChallanStatus = opts.remainingReceipts === 0 ? 'ISSUED' : 'PARTIALLY_RECEIVED';

  const moved = await tx.challans.updateMany({
    // Only a challan we previously closed is ours to move back (rule 4).
    where: { id: jwo.outwardChallanId, status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED'] } },
    data: { status: target, receivedDate: null, receivedById: null },
  });

  return moved.count > 0 ? target : null;
}
