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

import { Prisma, Unit } from '@prisma/client';
import prisma from '../../config/database';
import { createChallan } from '../challan.service';
import greigeStockService from '../greige-stock.service';
import { restoreLaceStock } from '../laceStock.service';
import { isJwoDead, jwoStockUnit, lockJobWorkOrder, JWO_AT_PROCESSOR_STATUSES } from './jwo-status.helper';
import { BusinessError, NotFoundError, ValidationError } from '../../errors';
import { ensureMaterialRecord, syncStockLevelQuantity } from './material-sync.helper';
import { toCurrency, toNumber } from '../../utils/currency';
import { toDateInputValue } from '../../utils/date';

export type ReturnedTo = 'GREIGE' | 'LACE' | 'FABRIC' | 'NONE';

export interface ReturnUnprocessedInput {
  jobWorkOrderId: string;
  returnedQty: number;
  returnDate?: Date;
  remarks?: string;
  userId: string;
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
  components: { select: { materialType: true, laceStockId: true, greigeStockId: true, qtySent: true } },
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

      const note = `Unprocessed ${target.toLowerCase()} returned — ${job.jobWorkNumber}${remarks ? ` (${remarks})` : ''}`;
      const styleLabel = job.style?.styleCode ? ` - ${job.style.styleCode}` : '';

      // --- put the material back where it came from ------------------------------------------
      if (target === 'GREIGE' && job.greigeStockLot) {
        await greigeStockService.returnGreigeStock(job.greigeStockLot.id, returnedQty, userId, tx, {
          referenceType: 'JOB_WORK_ORDER',
          referenceId: job.id,
          notes: note,
        });
      } else if (target === 'LACE' && laceComponent?.laceStockId) {
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
          toType: 'WAREHOUSE',
          toName: 'Main Warehouse',
          purchaseOrderId: job.purchaseOrderId ?? undefined,
          jobWorkOrderId: job.id,
          issuedById: userId,
          unit: jwoStockUnit(job.uom),
          remarks: `Unprocessed ${target.toLowerCase()} returned${remarks ? ': ' + remarks : ''}`,
          items: [
            {
              itemType: target === 'NONE' ? 'GREIGE' : target,
              fabricId: job.fabricId ?? undefined,
              greigeStockId: job.greigeStockLot?.id,
              laceStockId: laceComponent?.laceStockId ?? undefined,
              fabricStockId: job.fabricStockLotId ?? undefined,
              description: `Unprocessed ${target.toLowerCase()} returned${styleLabel}`,
              quantity: returnedQty,
              unit: jwoStockUnit(job.uom),
              jobWorkOrderId: job.id,
            },
          ],
        },
        tx
      );

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
