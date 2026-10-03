/**
 * Returning material from a processor UNTOUCHED — the single writer.
 *
 * A job work order has three possible endings, and this is the third:
 *   it came back processed          → GRNService.receiveJwoToStock ("Receive from processor")
 *   some came back, the rest never  → jobWorkOrderService.closeShort ("Close short")
 *   it came back exactly as sent    → here
 *
 * WHY THIS IS A SERVICE AND NOT A CONTROLLER. The behaviour previously lived inline in
 * dyeing.controller and printing.controller, twice, and the Job Work Order screen offered no way
 * to do it at all. Adding a third copy for that screen is how "the same event recorded two ways"
 * starts, so all three doors call this.
 *
 * THREE THINGS FIXED IN THE MOVE — the inline version:
 *  - swallowed a failed challan (logged it, then marked the job returned anyway), leaving stock
 *    credited with no document behind it;
 *  - was not transactional, so a crash between the four writes left the greige back on the shelf
 *    while the job still read as being at the processor;
 *  - only ever credited GREIGE. A lace dyeing job was cancelled with its lace never restored —
 *    harmless while only the Dyeing/Printing pages could reach it, not harmless once the Job
 *    Work Order screen can.
 */

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { createChallan } from '../challan.service';
import greigeStockService from '../greige-stock.service';
import { restoreLaceStock } from '../laceStock.service';
import {
  isJwoDead,
  jwoStockUnit,
  lockJobWorkOrder,
  setJwoStatus,
  JWO_AT_PROCESSOR_STATUSES,
} from './jwo-status.helper';
import { BusinessError, NotFoundError, ValidationError } from '../../errors';
import { ensureMaterialRecord, syncStockLevelQuantity } from './material-sync.helper';
import { roundToCent, toCurrency, toNumber } from '../../utils/currency';
import { toDateInputValue } from '../../utils/date';
import { challanDestination } from './lot-location.helper';
import { recomputeCoveringChallansForJwo } from './jwo-challan-lifecycle.helper';
import fabricStockService from '../fabric-stock.service';
import { bringHeldLaceLotToStore } from '../laceStock.service';
import { settleLotBack } from '../fabric-lot-pieces.service';
import { styleCodeLabel } from '../../utils/style-code';
import {
  isLineOut,
  jobLossRate,
  jobSentForLoss,
  lineIsSent,
  lineLabel,
  lineReceivedSoFar,
  sentColourByColour,
  takeLineOut,
} from './jwo-lines.helper';
import { isQtyZero, qtyExceeds } from '../../utils/quantity';
import { unconsumeReservations } from './stock-reservation.helper';
import { resettleJobRequirements } from './jwo-requirement-settle.helper';
import { closeOutwardChallanForJwo } from './jwo-challan-lifecycle.helper';
import { jobWorkOrderService } from '../job-work-order.service';
import { logWarn } from '../../utils/logger';

export type ReturnedTo = 'GREIGE' | 'LACE' | 'FABRIC' | 'NONE';

export interface ReturnUnprocessedInput {
  jobWorkOrderId: string;
  returnedQty: number;
  returnDate?: Date;
  remarks?: string;
  userId: string;
  /**
   * The store the goods came back into — required when the job took its cloth where it already lay at
   * the processor (nothing travelled out, so there is no store to put it back into).
   */
  storeWarehouseId?: string | null;
}

export interface ReturnUnprocessedResult {
  jobWorkOrderId: string;
  jobWorkNumber: string;
  returnedQty: number;
  creditedTo: ReturnedTo;
  inwardChallanId: string;
  inwardChallanNumber: string;
}

const RETURN_INCLUDE = {
  processor: { select: { id: true, name: true } },
  style: { select: { styleCode: true, buyerStyleRef: true } },
  greigeStockLot: { select: { id: true, warehouseId: true } },
  components: { select: { materialType: true, laceStockId: true, greigeStockId: true, qtySent: true, lineId: true } },
} satisfies Prisma.job_work_ordersInclude;

/**
 * Credit the material back and file the inward challan, in one transaction.
 *
 * Throws BusinessError with a message meant for the person on the screen — the callers surface it
 * verbatim, so it has to name the order and say what to do instead.
 */
export async function returnJobWorkUnprocessed(input: ReturnUnprocessedInput): Promise<ReturnUnprocessedResult> {
  const { jobWorkOrderId, userId, remarks } = input;
  const returnedQty = Number(input.returnedQty);
  const returnDate = input.returnDate ?? new Date();

  if (!Number.isFinite(returnedQty) || returnedQty <= 0) {
    throw new ValidationError('The returned quantity is required and must be greater than 0');
  }

  return prisma.$transaction(
    async (tx) => {
      // FIRST: lock the job, then read it. A second press waits here until the first commits, then
      // finds the job CANCELLED and is refused below. Read outside the transaction (as this was until
      // 2026-09-25), two presses both saw "at processor" and credited the material twice — the FABRIC
      // branch is a plain increment.
      await lockJobWorkOrder(tx, jobWorkOrderId);
      const job = await tx.job_work_orders.findUnique({
        where: { id: jobWorkOrderId },
        include: RETURN_INCLUDE,
      });
      if (!job) throw new NotFoundError('Job work order', jobWorkOrderId);

      // A cancelled or closed job already had its material credited back; crediting again would
      // invent stock (landmine No.1).
      if (isJwoDead(job.jwoStatus)) {
        throw new BusinessError(
          `${job.jobWorkNumber} is ${job.jwoStatus.toLowerCase()} — its stock was already credited back. Re-open the job first if material physically arrived.`
        );
      }
      if (!JWO_AT_PROCESSOR_STATUSES.includes(job.jwoStatus)) {
        throw new BusinessError(
          `${job.jobWorkNumber} is ${job.jwoStatus.toLowerCase().replace(/_/g, ' ')} — only material still with the processor can be returned unprocessed.`
        );
      }
      // This path zeroes what was received and cancels the order. Run on a job that already had a
      // delivery booked it would erase that receipt while its stock and inward challan stayed.
      if (Number(job.qtyReceivedMeters ?? 0) > 0) {
        throw new BusinessError(
          `${job.jobWorkNumber} has already had ${Number(job.qtyReceivedMeters)} ${job.uom} received back. Close it short instead of returning it unprocessed.`
        );
      }
      // A colour already back undyed or dropped took its own greige and orders with it — the rest comes back colour
      // by colour (returnLineUnprocessed), never as the whole job again
      if ((await tx.job_work_order_lines.count({ where: { jobWorkOrderId: job.id, closedAt: { not: null } } })) > 0) {
        throw new BusinessError(
          `A colour of ${job.jobWorkNumber} has already come back unprocessed or been dropped — return the others colour by colour.`
        );
      }
      // Greige sent colour by colour: the colours not yet sent have nothing at the processor to come back
      if (sentColourByColour(await tx.job_work_order_lines.findMany({ where: { jobWorkOrderId: job.id } }))) {
        throw new BusinessError(
          `${job.jobWorkNumber}'s greige went out colour by colour and some colours are not sent yet — return each sent ` +
            `colour on its own, and drop the ones the job will not do.`
        );
      }
      // A job that took its cloth where it already lay at the processor moved nothing: no outward
      // challan, and nothing can "come back" into our store from it. The cloth is still at the
      // processor — cancelling the job with "At Processor" puts it back on the held lot. Bringing it
      // to our store is its own door (Phase 4b), with an inward challan from the processor.
      const travelled =
        !!job.outwardChallanId ||
        (await tx.challans.count({
          where: {
            challanType: 'OUTWARD',
            status: { not: 'CANCELLED' },
            OR: [{ jobWorkOrderId: job.id }, { items: { some: { jobWorkOrderId: job.id } } }],
          },
        })) > 0;
      // A job that took its cloth where it lay at the processor (no outward challan) moved nothing out of
      // our store — so the goods come back into a store the user names, as a new lot, on this inward
      // challan (Phase 4b; until 2026-09-26 this was refused as RETURN_OF_HELD_CLOTH).
      const heldReturn = !travelled && !!job.sentDate;
      let heldStore: { id: string; warehouseName: string } | null = null;
      if (heldReturn) {
        if (!input.storeWarehouseId) {
          throw new BusinessError(
            `${job.jobWorkNumber} took cloth already lying at ${job.processor?.name ?? 'the processor'} — say which of our ` +
              `stores it came back into.`,
            { reason: 'STORE_REQUIRED_FOR_HELD_RETURN' }
          );
        }
        const store = await tx.warehouses.findUnique({
          where: { id: input.storeWarehouseId },
          select: { id: true, warehouseName: true, warehouseType: true, isActive: true },
        });
        if (!store || !store.isActive || store.warehouseType === 'JOB_WORK') {
          throw new BusinessError('Pick an active store of ours — not a processor’s unit.', { reason: 'NOT_A_STORE' });
        }
        heldStore = store;
      }
      const sent = toNumber(toCurrency(job.qtySentMeters));
      if (returnedQty - sent > 0.005) {
        throw new BusinessError(
          `${job.jobWorkNumber} only sent ${sent} ${job.uom}; ${returnedQty} cannot come back from it.`
        );
      }

      const laceComponent = job.components.find((c) => c.materialType === 'LACE' && c.laceStockId);
      const target: ReturnedTo = job.greigeStockLot
        ? 'GREIGE'
        : laceComponent
          ? 'LACE'
          : job.fabricStockLotId
            ? 'FABRIC'
            : 'NONE';

      // The greige lots it went out on (components when several, else the job's lot), each taking back its share
      // of what came back — the last takes the rounding
      const greigeOut = job.components
        .filter((c) => c.materialType === 'GREIGE' && c.greigeStockId)
        .map((c) => ({ lotId: c.greigeStockId as string, sent: Number(c.qtySent) }));
      const greigeSent = greigeOut.reduce((sum, c) => sum + c.sent, 0);
      const shareOf = (sent: number) => toNumber(roundToCent((returnedQty * sent) / greigeSent));
      const greigeSplit: Array<{ lotId: string; qty: number }> =
        greigeOut.length > 1 && greigeSent > 0
          ? greigeOut.map((c, i) => ({
              lotId: c.lotId,
              qty:
                i < greigeOut.length - 1
                  ? shareOf(c.sent)
                  : toNumber(
                      roundToCent(returnedQty - greigeOut.slice(0, -1).reduce((sum, o) => sum + shareOf(o.sent), 0))
                    ),
            }))
          : job.greigeStockLot
            ? [{ lotId: job.greigeStockLot.id, qty: returnedQty }]
            : [];

      const note = `Unprocessed ${target.toLowerCase()} returned — ${job.jobWorkNumber}${remarks ? ` (${remarks})` : ''}`;
      const styleCodes = styleCodeLabel(job.style, null, ''); // Buyer Style Code first
      const styleLabel = styleCodes ? ` - ${styleCodes}` : '';

      // --- put the material back where it came from ------------------------------------------
      // …and name that store on the inward challan
      let returnedIntoWarehouseId: string | null = heldStore?.id ?? null;
      if (heldStore) {
        // Held cloth: the draw already took it off the held lot and the unit's ledger — it comes back
        // as a new store lot, after the inward challan below exists (the lot names it)
      } else if (target === 'GREIGE' && job.greigeStockLot) {
        returnedIntoWarehouseId = job.greigeStockLot.warehouseId;
        // Each lot gets back its share — a job that went out on several lots recorded them as components, and
        // crediting all of it to the first lot overloaded it (or refused, past what it ever held). 2026-10-03.
        for (const part of greigeSplit) {
          await greigeStockService.returnGreigeStock(part.lotId, part.qty, userId, tx, {
            referenceType: 'JOB_WORK_ORDER',
            referenceId: job.id,
            notes: note,
          });
        }
      } else if (target === 'LACE' && laceComponent?.laceStockId) {
        returnedIntoWarehouseId =
          (await tx.lace_stock.findUnique({ where: { id: laceComponent.laceStockId }, select: { warehouseId: true } }))
            ?.warehouseId ?? null;
        await restoreLaceStock(laceComponent.laceStockId, returnedQty, userId, tx, {
          referenceType: 'JOB_WORK_ORDER',
          referenceId: job.id,
          notes: note,
        });
      } else if (target === 'FABRIC' && job.fabricStockLotId) {
        // Fabric lots have no shared restore helper — the issue path decrements them inline
        // (job-work-issuance.service.ts), so the return mirrors it here, ledger row included.
        const lot = await tx.fabric_stock.update({
          where: { id: job.fabricStockLotId },
          data: { quantityAvailable: { increment: returnedQty }, status: 'AVAILABLE' },
          select: { fabricId: true, warehouseId: true, quantityAvailable: true, weightedAvgCost: true },
        });
        returnedIntoWarehouseId = lot.warehouseId;
        const wac = toNumber(toCurrency(lot.weightedAvgCost));
        await tx.fabric_stock_transaction.create({
          data: {
            stockId: job.fabricStockLotId,
            transactionType: 'RETURN',
            quantity: new Prisma.Decimal(returnedQty),
            referenceType: 'JOB_WORK_ORDER',
            referenceId: job.id,
            costPerUnit: new Prisma.Decimal(wac),
            weightedAvgCost: new Prisma.Decimal(wac),
            totalValue: new Prisma.Decimal(returnedQty * wac),
            balanceAfter: lot.quantityAvailable,
            valueAfter: new Prisma.Decimal(toNumber(toCurrency(lot.quantityAvailable)) * wac),
            notes: note,
            createdById: userId,
          },
        });
        const materialId = await ensureMaterialRecord(lot.fabricId, 'FABRIC', tx);
        await syncStockLevelQuantity(materialId, returnedQty, lot.warehouseId ?? undefined, 'METER', tx);
        // The rolls / thans the job took come back as they went. A part return cannot say which pieces are
        // missing, so the list then reads out of step and the Fabric Stock page offers "Check rolls & thans".
        await settleLotBack(tx, { lotId: job.fabricStockLotId, scope: { jobWorkOrderId: job.id }, mode: 'ALL' });
      }

      // --- the document that says it came back -------------------------------------------------
      // Inside the transaction on purpose: the old code caught a challan failure and carried on,
      // which left credited stock with no paperwork behind it. If the challan cannot be written,
      // the material does not move either.
      const challan = await createChallan(
        {
          challanType: 'INWARD',
          challanDate: returnDate,
          fromType: 'VENDOR',
          fromId: job.processorId,
          fromName: job.processor?.name || 'Processor',
          ...(await challanDestination(tx, [returnedIntoWarehouseId])),
          purchaseOrderId: job.purchaseOrderId ?? undefined,
          jobWorkOrderId: job.id,
          issuedById: userId,
          unit: jwoStockUnit(job.uom),
          remarks: `Unprocessed ${target.toLowerCase()} returned${remarks ? ': ' + remarks : ''}`,
          // One item per greige lot it came back on (one item for everything else)
          items: (target === 'GREIGE' && greigeSplit.length > 1
            ? greigeSplit
            : [{ lotId: job.greigeStockLot?.id, qty: returnedQty }]
          ).map((part) => ({
            itemType: target === 'NONE' ? ('GREIGE' as const) : target,
            fabricId: job.fabricId ?? undefined,
            greigeStockId: part.lotId,
            laceStockId: laceComponent?.laceStockId ?? undefined,
            fabricStockId: job.fabricStockLotId ?? undefined,
            description: `Unprocessed ${target.toLowerCase()} returned${styleLabel}`,
            quantity: part.qty,
            unit: jwoStockUnit(job.uom),
            jobWorkOrderId: job.id,
          })),
        },
        tx
      );

      // Held cloth back in our store: a new lot on this challan (the services keep the ledger)
      const heldLotId =
        target === 'GREIGE'
          ? job.greigeStockLot?.id
          : target === 'LACE'
            ? laceComponent?.laceStockId
            : job.fabricStockLotId;
      if (heldStore && heldLotId) {
        const args = {
          stockId: heldLotId,
          quantity: returnedQty,
          storeWarehouseId: heldStore.id,
          inwardChallanId: challan.id,
          inwardChallanNumber: challan.challanNumber,
          broughtOn: returnDate,
          userId,
          alreadyDrawnByJobId: job.id,
        };
        if (target === 'GREIGE') await greigeStockService.bringHeldLotToStore(tx, args);
        else if (target === 'LACE') await bringHeldLaceLotToStore(tx, args);
        else if (target === 'FABRIC') await fabricStockService.bringHeldLotToStore(tx, args);
      }

      // Every colour leaves the job with it: its orders go back to "needs processing" (until 2026-10-03 the whole
      // return left the requirements linked to a cancelled job, so MRP read them as on order for ever)
      // …each recorded at its share of what really came back (the last colour takes the rounding)
      const openLines = await tx.job_work_order_lines.findMany({
        where: { jobWorkOrderId: job.id, closedAt: null },
        orderBy: { lineNo: 'asc' },
      });
      const linesSent = openLines.reduce((sum, l) => sum + Number(l.qtySent), 0);
      let givenOut = 0;
      for (const [i, line] of openLines.entries()) {
        const share =
          i === openLines.length - 1
            ? toNumber(roundToCent(returnedQty - givenOut))
            : linesSent > 0
              ? toNumber(roundToCent((returnedQty * Number(line.qtySent)) / linesSent))
              : 0;
        givenOut += share;
        await takeLineOut(tx, line, 'RETURNED', returnDate, share);
      }

      // --- close the job ------------------------------------------------------------------------
      // CANCELLED, not RECEIVED: nothing was processed, and it must drop off every "at processor"
      // and receivable list. The remark is what the statement and the job page read back.
      await tx.job_work_orders.update({
        where: { id: job.id },
        data: {
          inwardChallanId: challan.id,
          jwoStatus: 'CANCELLED',
          qtyReceivedMeters: 0,
          receivedDate: returnDate,
          remarks:
            `${job.remarks || ''}\n[RETURNED UNPROCESSED] ${returnedQty} ${job.uom} returned on ${toDateInputValue(
              returnDate
            )}.${remarks ? ` ${remarks}` : ''}`.trim(),
        },
      });

      // The covering challan of held cloth follows (rule 7): part of it is now back in our store
      if (heldStore) await recomputeCoveringChallansForJwo(tx, job.id, returnDate);

      return {
        jobWorkOrderId: job.id,
        jobWorkNumber: job.jobWorkNumber,
        returnedQty,
        creditedTo: target,
        inwardChallanId: challan.id,
        inwardChallanNumber: challan.challanNumber,
      };
    },
    { timeout: 15000, maxWait: 5000 }
  );
}

export interface ReturnLineUnprocessedInput {
  jobWorkOrderId: string;
  /** The colour (job line) whose greige came back undyed */
  lineId: string;
  returnedQty: number;
  /** The lot(s) it came back as — needed only when the job's greige went out on several lots */
  lots?: Array<{ greigeStockLotId: string; qty: number }>;
  returnDate?: Date;
  remarks?: string;
  userId: string;
  /** The store it came back into, for cloth the job took where it already lay at the processor */
  storeWarehouseId?: string | null;
  /** The last colour out finishes a job that came back short beyond the allowance — asked, then confirmed */
  shortCloseConfirmed?: boolean;
}

export interface ReturnLineUnprocessedResult extends ReturnUnprocessedResult {
  lineLabel: string;
  /** Every colour of the job is now finished (it closed, or was cancelled when nothing was dyed at all) */
  jobClosed: boolean;
}

/**
 * One colour's greige came back undyed (2026-10-03, owner): DJ-EBEW-002-001's Teal back while Red and Black are
 * dyed. The greige goes back on the lot(s) it went out from, on an inward challan; the colour leaves the job — its
 * orders go back to "needs processing" (a new job can be raised) and the returned greige is held for them again;
 * it counts in neither the bill nor the dyer's loss. When it was the last colour still out, the job finishes:
 * received → STOCK_UPDATED with the loss split on what was really dyed; nothing dyed at all → CANCELLED.
 */
export async function returnLineUnprocessed(input: ReturnLineUnprocessedInput): Promise<ReturnLineUnprocessedResult> {
  const { jobWorkOrderId, lineId, userId, remarks } = input;
  const returnedQty = Number(input.returnedQty);
  const returnDate = input.returnDate ?? new Date();
  if (!Number.isFinite(returnedQty) || returnedQty <= 0) {
    throw new ValidationError('The returned quantity is required and must be greater than 0');
  }

  return prisma.$transaction(
    async (tx) => {
      await lockJobWorkOrder(tx, jobWorkOrderId);
      const job = await tx.job_work_orders.findUnique({ where: { id: jobWorkOrderId }, include: RETURN_INCLUDE });
      if (!job) throw new NotFoundError('Job work order', jobWorkOrderId);
      if (isJwoDead(job.jwoStatus) || !JWO_AT_PROCESSOR_STATUSES.includes(job.jwoStatus)) {
        throw new BusinessError(
          `${job.jobWorkNumber} is ${job.jwoStatus.toLowerCase().replace(/_/g, ' ')} — only greige still with the ` +
            `processor can come back undyed.`
        );
      }
      if (job.fabricType === 'LACE' || job.fabricStockLotId) {
        throw new BusinessError(
          `${job.jobWorkNumber} does not send greige — use Return unprocessed for the whole job.`
        );
      }

      const line = await tx.job_work_order_lines.findFirst({ where: { id: lineId, jobWorkOrderId } });
      if (!line) throw new BusinessError(`That colour is not on ${job.jobWorkNumber} — reload the page.`);
      const label = await lineLabel(tx, line);
      if (line.closedAt) {
        throw new BusinessError(
          `${label} on ${job.jobWorkNumber} is already finished — nothing of it can come back undyed.`
        );
      }
      const jobLinesNow = await tx.job_work_order_lines.findMany({ where: { jobWorkOrderId: job.id } });
      if (!lineIsSent(line, job, jobLinesNow)) {
        throw new BusinessError(
          `${label}'s greige has not been sent yet on ${job.jobWorkNumber} — nothing of it is at the processor. ` +
            `Use Drop this colour if the job will not do it.`,
          { reason: 'JWO_LINE_NOT_SENT' }
        );
      }
      if (!isQtyZero(await lineReceivedSoFar(tx, line.id))) {
        throw new BusinessError(
          `Some of ${label} has already come back dyed. Receive the rest, or close it short — it cannot also come ` +
            `back undyed.`
        );
      }
      if (qtyExceeds(returnedQty, Number(line.qtySent))) {
        throw new BusinessError(
          `${label} went out as ${Number(line.qtySent)} ${job.uom} of greige — ${returnedQty} cannot come back from it.`
        );
      }

      // Which lot(s) it comes back on: the ones this job's greige went out from — this colour's own, when it went out
      // on its own (2026-10-03) — each capped at what that lot sent on this job less what already came back on it.
      const sentByLot = new Map<string, number>();
      const ownLots = job.components.some((c) => c.lineId === line.id);
      for (const c of job.components) {
        if (c.materialType !== 'GREIGE' || !c.greigeStockId) continue;
        if (ownLots && c.lineId !== line.id) continue;
        sentByLot.set(c.greigeStockId, (sentByLot.get(c.greigeStockId) ?? 0) + Number(c.qtySent));
      }
      if (sentByLot.size === 0 && job.greigeStockLot) sentByLot.set(job.greigeStockLot.id, Number(job.qtySentMeters));
      if (sentByLot.size === 0) {
        throw new BusinessError(`${job.jobWorkNumber} names no greige lot it went out from — nothing can be put back.`);
      }
      const lots =
        input.lots && input.lots.length > 0
          ? input.lots.filter((l) => !isQtyZero(Number(l.qty)))
          : sentByLot.size === 1
            ? [{ greigeStockLotId: [...sentByLot.keys()][0], qty: returnedQty }]
            : null;
      if (!lots) {
        throw new BusinessError(
          `The greige of ${job.jobWorkNumber} went out on ${sentByLot.size} lots — say which lot(s) ${label} came back on.`,
          { reason: 'RETURN_LOTS_REQUIRED', lots: [...sentByLot.keys()] }
        );
      }
      const lotTotal = lots.reduce((sum, l) => sum + Number(l.qty), 0);
      if (qtyExceeds(lotTotal, returnedQty) || qtyExceeds(returnedQty, lotTotal)) {
        throw new BusinessError(`The lots add up to ${lotTotal} ${job.uom}, not the ${returnedQty} that came back.`);
      }
      for (const l of lots) {
        const sent = sentByLot.get(l.greigeStockLotId);
        if (sent == null) throw new BusinessError(`That lot did not go out on ${job.jobWorkNumber}.`);
        const back = await tx.greige_stock_transaction.aggregate({
          where: {
            stockId: l.greigeStockLotId,
            transactionType: 'RETURN',
            referenceType: 'JOB_WORK_ORDER',
            referenceId: job.id,
          },
          _sum: { quantity: true },
        });
        const left = sent - Number(back._sum.quantity ?? 0);
        if (qtyExceeds(Number(l.qty), left)) {
          throw new BusinessError(
            `Only ${toNumber(toCurrency(left))} ${job.uom} of that lot is still out on ${job.jobWorkNumber}.`
          );
        }
      }

      // Held cloth (taken where it lay at the processor): it comes back into a store we name, as a new lot
      const travelled =
        (await tx.challans.count({
          where: {
            challanType: 'OUTWARD',
            status: { not: 'CANCELLED' },
            OR: [{ jobWorkOrderId: job.id }, { items: { some: { jobWorkOrderId: job.id } } }],
          },
        })) > 0;
      // Sent on its own: its own challan says whether it travelled
      const heldReturn = line.sentDate ? !line.outwardChallanId : !travelled && !!job.sentDate;
      if (heldReturn && !input.storeWarehouseId) {
        throw new BusinessError(
          `${job.jobWorkNumber} took cloth already lying at ${job.processor?.name ?? 'the processor'} — say which of ` +
            `our stores ${label} came back into.`,
          { reason: 'STORE_REQUIRED_FOR_HELD_RETURN' }
        );
      }

      const note = `Undyed greige returned — ${label} of ${job.jobWorkNumber}${remarks ? ` (${remarks})` : ''}`;
      if (!heldReturn) {
        for (const l of lots) {
          await greigeStockService.returnGreigeStock(l.greigeStockLotId, Number(l.qty), userId, tx, {
            referenceType: 'JOB_WORK_ORDER',
            referenceId: job.id,
            notes: note,
          });
        }
      }
      const firstLot = await tx.greige_stock.findUnique({
        where: { id: lots[0].greigeStockLotId },
        select: { warehouseId: true },
      });
      const intoWarehouse = heldReturn ? (input.storeWarehouseId ?? null) : (firstLot?.warehouseId ?? null);

      const challan = await createChallan(
        {
          challanType: 'INWARD',
          challanDate: returnDate,
          fromType: 'VENDOR',
          fromId: job.processorId,
          fromName: job.processor?.name || 'Processor',
          ...(await challanDestination(tx, [intoWarehouse])),
          jobWorkOrderId: job.id,
          issuedById: userId,
          unit: jwoStockUnit(job.uom),
          remarks: `Undyed greige returned — ${label}${remarks ? ': ' + remarks : ''}`,
          items: lots.map((l) => ({
            itemType: 'GREIGE' as const,
            greigeStockId: l.greigeStockLotId,
            description: `Undyed greige returned - ${label}`,
            quantity: Number(l.qty),
            unit: jwoStockUnit(job.uom),
            jobWorkOrderId: job.id,
            jobWorkOrderLineId: line.id,
          })),
        },
        tx
      );

      if (heldReturn && input.storeWarehouseId) {
        for (const l of lots) {
          await greigeStockService.bringHeldLotToStore(tx, {
            stockId: l.greigeStockLotId,
            quantity: Number(l.qty),
            storeWarehouseId: input.storeWarehouseId,
            inwardChallanId: challan.id,
            inwardChallanNumber: challan.challanNumber,
            broughtOn: returnDate,
            userId,
            alreadyDrawnByJobId: job.id,
          });
        }
      }

      // The colour leaves the job; its orders go back to "needs processing" and the greige is held for them again
      const { released, jobClosed } = await takeLineOut(tx, line, 'RETURNED', returnDate, returnedQty);
      await unconsumeReservations(
        tx,
        released,
        returnedQty,
        lots.map((l) => l.greigeStockLotId)
      );
      // The other colours' requirements settle as they always do (a finished colour with no open PO)
      await resettleJobRequirements(tx, job.id);

      await finishJobAfterLineOut(tx, job, {
        label,
        closedAt: returnDate,
        jobClosed,
        noteLine:
          `[RETURNED UNPROCESSED ${toDateInputValue(returnDate)}] ${label}: ${returnedQty} ${job.uom} on ` +
          `${challan.challanNumber}${remarks ? ` — ${remarks}` : ''}`,
        inwardChallanId: challan.id,
        shortCloseConfirmed: input.shortCloseConfirmed,
        userId,
      });

      return {
        jobWorkOrderId: job.id,
        jobWorkNumber: job.jobWorkNumber,
        returnedQty,
        creditedTo: 'GREIGE' as const,
        inwardChallanId: challan.id,
        inwardChallanNumber: challan.challanNumber,
        lineLabel: label,
        jobClosed,
      };
    },
    { timeout: 20000, maxWait: 5000 }
  );
}

/**
 * A colour has just left the job (back unprocessed, or dropped): finish the job when it was the last colour still
 * open. Every colour out → CANCELLED (nothing was processed); some received → STOCK_UPDATED with the loss split on
 * what was really processed — after the same short-close question Close short asks; else the job carries on. The
 * note goes on the job's remarks either way, and a job that went out has its outward challan(s) brought up to date.
 */
async function finishJobAfterLineOut(
  tx: Prisma.TransactionClient,
  job: {
    id: string;
    jobWorkNumber: string;
    uom: string;
    remarks: string | null;
    qtyReceivedMeters: Prisma.Decimal | number | null;
    receivedDate: Date | null;
    sentDate: Date | null;
  },
  o: {
    label: string;
    closedAt: Date;
    jobClosed: boolean;
    noteLine: string;
    inwardChallanId?: string | null;
    shortCloseConfirmed?: boolean;
    userId: string;
  }
): Promise<void> {
  const lines = await tx.job_work_order_lines.findMany({ where: { jobWorkOrderId: job.id } });
  const nothingProcessed = lines.every((l) => isLineOut(l));
  const withNote = `${job.remarks || ''}\n${o.noteLine}`.trim();
  if (o.jobClosed && nothingProcessed) {
    // Every colour came back unprocessed or was dropped: as the whole-job return, cancelled with nothing received
    await setJwoStatus(tx, job.id, 'CANCELLED', {
      ...(o.inwardChallanId ? { inwardChallanId: o.inwardChallanId } : {}),
      qtyReceivedMeters: 0,
      ...(job.sentDate ? { receivedDate: o.closedAt } : {}),
      remarks: withNote,
    });
  } else if (o.jobClosed) {
    // The other colours are all in: the job finishes on what was really processed (loss split on effective totals).
    // Finishing it short beyond the allowance must be said out loud — the same question Close short asks.
    const after = await tx.job_work_orders.findUniqueOrThrow({
      where: { id: job.id },
      select: {
        qtySentMeters: true,
        qtyBillable: true,
        expectedShrinkage: true,
        tolerancePercent: true,
        agreedRatePerMeter: true,
        processTypeMaster: { select: { tolerancePercent: true } },
      },
    });
    const received = Number(job.qtyReceivedMeters ?? 0);
    const split = jobWorkOrderService.calculateLossSplit({
      qtySent: await jobSentForLoss(tx, job.id, after.qtySentMeters),
      qtyReceived: received,
      qtyExpected: after.qtyBillable,
      expectedShrinkagePercent: after.expectedShrinkage,
      tolerancePercent: Number(after.tolerancePercent ?? after.processTypeMaster?.tolerancePercent ?? 0),
      ratePerMeter: await jobLossRate(tx, job.id, after.agreedRatePerMeter),
    });
    if (split.isOverTolerance && !o.shortCloseConfirmed) {
      const uom = job.uom;
      throw new BusinessError(
        `${o.label} was the last colour still open, so this finishes ${job.jobWorkNumber} — but the colours that came ` +
          `back are short: ${received.toFixed(2)} ${uom} received against ${split.qtyExpected.toFixed(2)} ${uom} ` +
          `expected, ${split.qtyAbnormalLoss.toFixed(2)} ${uom} beyond the ${split.tolerancePercent.toNumber()}% ` +
          `allowance. Confirm only if nothing more is coming on them.`,
        {
          reason: 'SHORT_CLOSE_UNCONFIRMED',
          cumulative: received,
          expected: split.qtyExpected.toNumber(),
          shortfall: split.shortfall.toNumber(),
          beyondAllowance: split.qtyAbnormalLoss.toNumber(),
          tolerancePercent: split.tolerancePercent.toNumber(),
          debitNoteAmount: split.debitNoteAmount ? split.debitNoteAmount.toNumber() : null,
        }
      );
    }
    await jobWorkOrderService.applyLossSplit(job.id, received, tx);
    await setJwoStatus(tx, job.id, 'STOCK_UPDATED', {
      receivedDate: job.receivedDate ?? o.closedAt,
      remarks: withNote,
    });
  } else {
    await tx.job_work_orders.update({ where: { id: job.id }, data: { remarks: withNote } });
  }
  if (!job.sentDate) return;
  try {
    await closeOutwardChallanForJwo(tx, job.id, {
      isFinal: o.jobClosed,
      receivedById: o.userId,
      receivedAt: o.closedAt,
    });
  } catch (challanError) {
    logWarn('[JWO] Could not advance the outward challan after a colour left the job', {
      jobWorkOrderId: job.id,
      error: challanError instanceof Error ? challanError.message : challanError,
    });
  }
}

export interface DropLineInput {
  jobWorkOrderId: string;
  /** The colour (job line) never sent that the job will not do */
  lineId: string;
  userId: string;
  remarks?: string;
  /** Dropping the last open colour finishes a job whose other colours came back short — asked, then confirmed */
  shortCloseConfirmed?: boolean;
}

export interface DropLineResult {
  jobWorkOrderId: string;
  jobWorkNumber: string;
  lineLabel: string;
  /** Every colour of the job is now finished (it closed, or was cancelled when nothing was processed at all) */
  jobClosed: boolean;
}

/**
 * Drop a colour whose greige was never sent (2026-10-03, owner): the job will not do it. Its orders go back to
 * "needs processing" so a new job can be raised; it counts in neither the bill nor the processor's loss; when it was
 * the last colour still open the job finishes on the colours it did (or is cancelled when it did none). A colour
 * already at the processor comes back through Return unprocessed instead; a job of one colour is cancelled instead.
 */
export async function dropLine(input: DropLineInput): Promise<DropLineResult> {
  const { jobWorkOrderId, lineId, userId, remarks } = input;
  return prisma.$transaction(
    async (tx) => {
      await lockJobWorkOrder(tx, jobWorkOrderId);
      const job = await tx.job_work_orders.findUnique({ where: { id: jobWorkOrderId }, include: RETURN_INCLUDE });
      if (!job) throw new NotFoundError('Job work order', jobWorkOrderId);
      if (isJwoDead(job.jwoStatus)) {
        throw new BusinessError(`${job.jobWorkNumber} is ${job.jwoStatus.toLowerCase()} — there is nothing to drop.`);
      }
      const lines = await tx.job_work_order_lines.findMany({ where: { jobWorkOrderId: job.id } });
      const line = lines.find((l) => l.id === lineId);
      if (!line) throw new BusinessError(`That colour is not on ${job.jobWorkNumber} — reload the page.`);
      const label = await lineLabel(tx, line);
      if (lines.length === 1) {
        throw new BusinessError(`${label} is the only colour on ${job.jobWorkNumber} — cancel the job instead.`);
      }
      if (line.closedAt) {
        throw new BusinessError(`${label} on ${job.jobWorkNumber} is already finished — there is nothing to drop.`);
      }
      if (lineIsSent(line, job, lines)) {
        throw new BusinessError(
          `${label}'s greige already went to ${job.processor?.name ?? 'the processor'} — if it comes back untouched, ` +
            `record it with Return unprocessed.`,
          { reason: 'JWO_LINE_ALREADY_SENT' }
        );
      }

      const closedAt = new Date();
      const { jobClosed } = await takeLineOut(tx, line, 'DROPPED', closedAt, null);
      if (job.sentDate) await resettleJobRequirements(tx, job.id);
      await finishJobAfterLineOut(tx, job, {
        label,
        closedAt,
        jobClosed,
        noteLine: `[DROPPED ${toDateInputValue(closedAt)}] ${label} — never sent${remarks ? `: ${remarks}` : ''}`,
        shortCloseConfirmed: input.shortCloseConfirmed,
        userId,
      });
      return { jobWorkOrderId: job.id, jobWorkNumber: job.jobWorkNumber, lineLabel: label, jobClosed };
    },
    { timeout: 20000, maxWait: 5000 }
  );
}
