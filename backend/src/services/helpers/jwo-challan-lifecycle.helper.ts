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
 * 7. **A job that took cloth already at the processor has no outward challan of its own.** The cloth
 *    is there under a COVERING challan — the Rule 45 challan for goods a supplier delivered straight
 *    to the processor, or a Stock-Out that parked it there (`greige_stock.sourceChallanId`). Those
 *    challans follow the jobs that draw from their lots: see `recomputeCoveringChallan`. Both entry
 *    points below recompute them, so every receipt, reversal and close-short keeps them true.
 * 6. **Best-effort, never fatal.** A job-work return books stock, an inward challan, the loss split
 *    and MRP in one transaction. A challan whose status could not be advanced is a reporting defect;
 *    failing the whole receipt over it would be worse. Callers log and continue.
 *
 * Deliberately does NOT go through `receiveChallan()` (`challan.service.ts:810-958`): that credits
 * stock, and the GRN transaction has already booked the lot. Routing through it would double-count.
 */

import { Prisma, PrismaClient, ChallanStatus } from '@prisma/client';
import { JWO_RECEIVED_STATUSES } from './jwo-status.helper';
import { isQtyZero } from '../../utils/quantity';
import { coveringChallanWhere, isCoveringChallan } from './lot-location.helper';

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
  opts: { isFinal: boolean; receivedById: string | null; receivedAt: Date }
): Promise<ChallanStatus | null> {
  // Rule 7: the challan(s) covering cloth this job took where it lay follow it too.
  await recomputeCoveringChallansForJwo(tx, jobWorkOrderId, opts.receivedAt);

  // Rule 8: colours that went out on challans of their own move them by their own colours
  const byColour = await moveColourChallans(tx, jobWorkOrderId, 'RECEIVE', opts.receivedAt, opts.receivedById);
  if (byColour !== undefined) return byColour;

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
      ...(target === 'RECEIVED'
        ? { receivedDate: opts.receivedAt, ...(opts.receivedById ? { receivedById: opts.receivedById } : {}) }
        : {}),
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
  // Rule 7: a covering challan moves back with the job's receipts.
  await recomputeCoveringChallansForJwo(tx, jobWorkOrderId, new Date());

  // Rule 8: colours that went out on challans of their own move them back by their own colours
  const byColour = await moveColourChallans(tx, jobWorkOrderId, 'REVERSE', new Date(), null);
  if (byColour !== undefined) return byColour;

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

/**
 * Rule 8 (2026-10-03): a job's greige may go out colour by colour, each colour on its own OUTWARD challan
 * (`job_work_order_lines.outwardChallanId`). Each such challan is recomputed from ITS colours:
 *
 * | its colours | other jobs on it | status |
 * |---|---|---|
 * | all finished (received in full, closed short, back unprocessed) | all settled | `RECEIVED` |
 * | something back, or one finished | — | `PARTIALLY_RECEIVED` |
 * | nothing back yet | — | `ISSUED` |
 *
 * A receipt only moves a challan forward out of its open statuses; a reversal only moves one we closed back
 * (rule 4 either way). A job whose lines name no challan (sent whole before lines kept theirs, or drawn where the
 * cloth lay) returns `undefined` — the job-level rule above applies.
 */
async function moveColourChallans(
  tx: DbClient,
  jobWorkOrderId: string,
  mode: 'RECEIVE' | 'REVERSE',
  at: Date,
  receivedById: string | null
): Promise<ChallanStatus | null | undefined> {
  const lines = await tx.job_work_order_lines.findMany({
    where: { jobWorkOrderId, outwardChallanId: { not: null } },
    select: { id: true, outwardChallanId: true, closedAt: true },
  });
  if (lines.length === 0) return undefined;

  let moved: ChallanStatus | null = null;
  for (const challanId of new Set(lines.map((l) => l.outwardChallanId as string))) {
    const onIt = lines.filter((l) => l.outwardChallanId === challanId);
    const allFinished = onIt.every((l) => l.closedAt != null);
    const somethingBack =
      allFinished ||
      onIt.some((l) => l.closedAt != null) ||
      (await tx.grn_items.count({
        where: { jobWorkOrderLineId: { in: onIt.map((l) => l.id) }, goods_receiving_notes: { status: 'ACCEPTED' } },
      })) > 0;
    // A consolidated dispatch can carry other jobs on the same challan (rule 1)
    const othersOut = await tx.job_work_orders.count({
      where: {
        id: { not: jobWorkOrderId },
        outwardChallanId: challanId,
        jwoStatus: { notIn: SETTLED_JWO_STATUSES as never },
      },
    });
    const target: ChallanStatus =
      allFinished && othersOut === 0 ? 'RECEIVED' : somethingBack ? 'PARTIALLY_RECEIVED' : 'ISSUED';
    const from: ChallanStatus[] =
      mode === 'RECEIVE'
        ? OUTWARD_OPEN_STATUSES.filter((s) => s !== target)
        : (['RECEIVED', 'PARTIALLY_RECEIVED'] as ChallanStatus[]).filter((s) => s !== target);
    if (mode === 'RECEIVE' && target === 'ISSUED') continue;
    const result = await tx.challans.updateMany({
      where: { id: challanId, status: { in: from } },
      data:
        target === 'RECEIVED'
          ? { status: target, receivedDate: at, ...(receivedById ? { receivedById } : {}) }
          : { status: target, receivedDate: null, receivedById: null },
    });
    if (result.count > 0) moved = target;
  }
  return moved;
}

/** A covering challan's statuses this helper may move between (never CANCELLED or DRAFT). */
const COVERING_MOVABLE_STATUSES: ChallanStatus[] = ['ISSUED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED'];

/** A drawing job that has brought something back, or never will. */
const RETURNED_JWO_STATUSES: string[] = [...JWO_RECEIVED_STATUSES, 'CLOSED'];

/**
 * Put a COVERING challan (rule 7) where its goods actually are, recomputed from scratch so a
 * reversal moves it back as surely as a receipt moves it on:
 *
 * | still lying at the processor (on no job) | jobs that drew from it | status |
 * |---|---|---|
 * | none | all returned (or none drew) | `RECEIVED` |
 * | any, or a job still out | at least one has returned something | `PARTIALLY_RECEIVED` |
 * | any, or a job still out | none has returned anything | `ISSUED` |
 *
 * A cancelled job put its metres back on the lot, so it counts as neither holding nor returning.
 * The lots a challan covers: greige lots naming it (`sourceChallanId`), and the lace and fabric lots
 * its lines name (`challan_items.laceStockId` / `fabricStockId` — a direct-supply challan). A line
 * with no lot (trims) can never be shown back, so such a challan stops at `PARTIALLY_RECEIVED`.
 *
 * @returns the status it was moved to, or null when nothing moved.
 */
export async function recomputeCoveringChallan(
  tx: DbClient,
  challanId: string,
  at: Date = new Date()
): Promise<ChallanStatus | null> {
  const challan = await tx.challans.findUnique({
    where: { id: challanId },
    select: { status: true, challanType: true, directSupplyGrnId: true, fromType: true, toType: true },
  });
  if (!challan || challan.challanType !== 'OUTWARD' || !COVERING_MOVABLE_STATUSES.includes(challan.status)) {
    return null;
  }

  const [lots, lines] = await Promise.all([
    tx.greige_stock.findMany({
      where: { sourceChallanId: challanId },
      select: { id: true, quantityAvailable: true },
    }),
    tx.challan_items.findMany({
      where: { challanId },
      select: { greigeStockId: true, laceStockId: true, fabricStockId: true, arrivedQty: true },
    }),
  ]);
  // Only a direct-supply challan COVERS the lace / fabric its lines name — an ordinary job challan's
  // lines name the store lots that travelled on it, and those are not held anywhere
  const covers = isCoveringChallan(challan);
  const laceIds = covers ? lines.map((l) => l.laceStockId).filter((id): id is string => !!id) : [];
  const fabricIds = covers ? lines.map((l) => l.fabricStockId).filter((id): id is string => !!id) : [];
  const [laceLots, fabricLots] = await Promise.all([
    laceIds.length
      ? tx.lace_stock.findMany({ where: { id: { in: laceIds } }, select: { id: true, quantityAvailable: true } })
      : [],
    fabricIds.length
      ? tx.fabric_stock.findMany({ where: { id: { in: fabricIds } }, select: { id: true, quantityAvailable: true } })
      : [],
  ]);
  if (lots.length + laceLots.length + fabricLots.length === 0) return null;
  const stillHeld = [...lots, ...laceLots, ...fabricLots].some((lot) => !isQtyZero(Number(lot.quantityAvailable)));
  // A line naming no lot (trims under a direct-supply challan) is never shown as back. A goods-in-transit line of
  // which nothing arrived (arrivedQty 0) has nothing to come back, so it does not hold the challan open.
  const untrackedLine =
    covers &&
    lines.some(
      (l) =>
        !l.greigeStockId &&
        !l.laceStockId &&
        !l.fabricStockId &&
        !(l.arrivedQty != null && isQtyZero(Number(l.arrivedQty)))
    );

  const [greigeDraws, laceDraws, fabricDraws] = await Promise.all([
    lots.length
      ? tx.greige_stock_transaction.findMany({
          where: {
            stockId: { in: lots.map((lot) => lot.id) },
            transactionType: 'CONSUMPTION',
            referenceType: 'JOB_WORK_ORDER',
          },
          select: { referenceId: true },
        })
      : [],
    laceLots.length
      ? tx.lace_stock_transaction.findMany({
          where: {
            stockId: { in: laceLots.map((l) => l.id) },
            transactionType: 'CONSUMPTION',
            referenceType: 'JOB_WORK_ORDER',
          },
          select: { referenceId: true },
        })
      : [],
    fabricLots.length
      ? tx.fabric_stock_transaction.findMany({
          where: { stockId: { in: fabricLots.map((l) => l.id) }, referenceType: 'JOB_WORK_ORDER' },
          select: { referenceId: true },
        })
      : [],
  ]);
  const draws = [...greigeDraws, ...laceDraws, ...fabricDraws];
  const jobIds = [...new Set(draws.map((d) => d.referenceId).filter((id): id is string => !!id))];
  // Goods brought back to our store from these lots (Phase 4b "Bring to store"): an INWARD challan whose
  // line names the held lot — a return like a job's, even with no job
  const heldIds = [...lots.map((l) => l.id), ...laceLots.map((l) => l.id), ...fabricLots.map((l) => l.id)];
  const [inwardLines, greigeOut, laceOut, fabricOut] = await Promise.all([
    tx.challan_items.count({
      where: {
        OR: [{ greigeStockId: { in: heldIds } }, { laceStockId: { in: heldIds } }, { fabricStockId: { in: heldIds } }],
        challan: { challanType: 'INWARD', status: { not: 'CANCELLED' } },
      },
    }),
    // Metres that left the held lot with no job — brought to our store or moved to another processor
    lots.length
      ? tx.greige_stock_transaction.count({
          where: {
            stockId: { in: lots.map((l) => l.id) },
            transactionType: 'RECEIPT',
            referenceType: 'PROCESSING_DELIVERY',
          },
        })
      : 0,
    laceLots.length
      ? tx.lace_stock_transaction.count({
          where: {
            stockId: { in: laceLots.map((l) => l.id) },
            transactionType: 'TRANSFER_OUT',
            referenceType: 'CHALLAN',
          },
        })
      : 0,
    fabricLots.length
      ? tx.fabric_stock_transaction.count({
          where: {
            stockId: { in: fabricLots.map((l) => l.id) },
            transactionType: 'TRANSFER_OUT',
            referenceType: 'CHALLAN',
          },
        })
      : 0,
  ]);
  const broughtBack = inwardLines + greigeOut + laceOut + fabricOut > 0;
  const jobs = jobIds.length
    ? await tx.job_work_orders.findMany({ where: { id: { in: jobIds } }, select: { jwoStatus: true } })
    : [];
  const live = jobs.filter((job) => job.jwoStatus !== 'CANCELLED');
  const returned = live.filter((job) => job.jwoStatus != null && RETURNED_JWO_STATUSES.includes(job.jwoStatus));
  const partlyBack = live.some((job) => job.jwoStatus === 'PARTIALLY_RECEIVED');

  const target: ChallanStatus =
    !stillHeld && !untrackedLine && returned.length === live.length
      ? 'RECEIVED'
      : returned.length > 0 || partlyBack || broughtBack
        ? 'PARTIALLY_RECEIVED'
        : 'ISSUED';
  if (target === challan.status) return null;

  const moved = await tx.challans.updateMany({
    where: { id: challanId, status: { in: COVERING_MOVABLE_STATUSES } },
    // Rule 3 holds here too: no receivedQuantity — what came back is processed fabric.
    data: target === 'RECEIVED' ? { status: target, receivedDate: at } : { status: target, receivedDate: null },
  });
  return moved.count > 0 ? target : null;
}

/**
 * Recompute the covering challans of these held lots (rule 7) — after goods were brought back to our
 * store, or moved to another processor, with no job involved (Phase 4b / 4c).
 */
export async function recomputeCoveringChallansForLots(
  tx: DbClient,
  lots: { greigeIds?: string[]; laceIds?: string[]; fabricIds?: string[] },
  at: Date = new Date()
): Promise<void> {
  const greigeIds = lots.greigeIds ?? [];
  const otherIds = [...(lots.laceIds ?? []), ...(lots.fabricIds ?? [])];
  const [greige, lines] = await Promise.all([
    greigeIds.length
      ? tx.greige_stock.findMany({ where: { id: { in: greigeIds } }, select: { sourceChallanId: true } })
      : [],
    otherIds.length
      ? tx.challan_items.findMany({
          where: {
            OR: [{ laceStockId: { in: otherIds } }, { fabricStockId: { in: otherIds } }],
            challan: coveringChallanWhere(),
          },
          select: { challanId: true },
        })
      : [],
  ]);
  const challanIds = [
    ...new Set(
      [...greige.map((g) => g.sourceChallanId), ...lines.map((l) => l.challanId)].filter((id): id is string => !!id)
    ),
  ];
  for (const challanId of challanIds) {
    await recomputeCoveringChallan(tx, challanId, at);
  }
}

/** Recompute every covering challan whose lots this job drew from (rule 7). */
export async function recomputeCoveringChallansForJwo(
  tx: DbClient,
  jobWorkOrderId: string,
  at: Date = new Date()
): Promise<void> {
  const [greigeDraws, laceDraws, fabricDraws] = await Promise.all([
    tx.greige_stock_transaction.findMany({
      where: { referenceType: 'JOB_WORK_ORDER', referenceId: jobWorkOrderId, transactionType: 'CONSUMPTION' },
      select: { stock: { select: { sourceChallanId: true } } },
    }),
    tx.lace_stock_transaction.findMany({
      where: { referenceType: 'JOB_WORK_ORDER', referenceId: jobWorkOrderId, transactionType: 'CONSUMPTION' },
      select: { stockId: true },
    }),
    tx.fabric_stock_transaction.findMany({
      where: { referenceType: 'JOB_WORK_ORDER', referenceId: jobWorkOrderId },
      select: { stockId: true },
    }),
  ]);
  // Lace and fabric lots are covered by the direct-supply challan whose lines name them
  const heldLotIds = [...new Set([...laceDraws, ...fabricDraws].map((d) => d.stockId))];
  const lineChallans = heldLotIds.length
    ? await tx.challan_items.findMany({
        where: {
          OR: [{ laceStockId: { in: heldLotIds } }, { fabricStockId: { in: heldLotIds } }],
          challan: coveringChallanWhere(),
        },
        select: { challanId: true },
      })
    : [];
  const challanIds = [
    ...new Set(
      [...greigeDraws.map((d) => d.stock?.sourceChallanId), ...lineChallans.map((c) => c.challanId)].filter(
        (id): id is string => !!id
      )
    ),
  ];
  for (const challanId of challanIds) {
    await recomputeCoveringChallan(tx, challanId, at);
  }
}
