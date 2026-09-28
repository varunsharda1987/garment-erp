/**
 * Give the finished-fabric lots booked before 2026-09-28 the rolls / thans their receipt already lists
 * (plans/fabric-lot-rolls-thans.md 1e; owner decision 1: "if you have the list, you do it").
 *
 * Until fabric-lot-pieces.service existed, "Receive from processor" stored the processor's than list on the
 * receipt (grn_item_details) and the lot it booked kept none. This copies each lot's list FROM ITS OWN RECEIPT
 * LINE (fabric_stock.grnItemId — never by searching receipts: the reversed duplicates GRN2609-0478..0482 hold
 * 100 than rows and no lot).
 *
 * Each candidate is classified by what left it (challan lines naming the lot, net of returns; fabric ledger
 * rows; jobs and send-outs drawing it):
 *   UNTOUCHED        on hand = the receipt's actual metres, nothing consumed, no challan line — every piece
 *                    is copied AVAILABLE.
 *   WHOLLY AT CUTTING on hand 0; its last Fabric Store → Cutting issue took the whole lot, for a batch, and no
 *                    return came after it — every piece is copied CONSUMED with one fabric_issue_details row
 *                    naming that challan, its line and its batch (issuedAt = the challan date). An earlier
 *                    round trip that came back whole (CH2609-0580 → CH2609-0595) records nothing.
 *   anything else    skipped, and the reason printed.
 * Guard before writing: the pieces' counted total at the line's fold must be the receipt's actual metres.
 *
 * Usage:
 *   cd backend && npx ts-node scripts/backfill-fabric-lot-pieces.ts            # dry run (default)
 *   cd backend && npx ts-node scripts/backfill-fabric-lot-pieces.ts --apply    # writes, one transaction per lot
 *
 * Idempotent: a lot that already has pieces is skipped. Afterwards the dry run reports no candidates.
 * Moves no stock: the lots' metres, ledger and stock_levels are untouched.
 */
import prisma from '../src/config/database';
import { Prisma } from '@prisma/client';
import { addCurrency } from '../src/utils/currency';
import { foldActual } from '../src/utils/fold-length';
import { isQtyZero, qtyExceeds } from '../src/utils/quantity';

const APPLY = process.argv.includes('--apply');
const ISSUED = ['ISSUED', 'IN_TRANSIT', 'RECEIVED', 'PARTIALLY_RECEIVED'];

type Plan =
  | { kind: 'UNTOUCHED' }
  | {
      kind: 'AT_CUTTING';
      challanId: string;
      challanNumber: string;
      challanItemId: string;
      cuttingBatchId: string;
      batchNumber: string;
      issuedAt: Date;
      issuedById: string;
    }
  | { kind: 'SKIP'; why: string };

async function main() {
  const lots = await prisma.fabric_stock.findMany({
    where: {
      grnItemId: { not: null },
      grnItem: {
        goods_receiving_notes: { status: { in: ['ACCEPTED', 'PARTIALLY_ACCEPTED'] } },
        grn_item_details: { some: {} },
      },
    },
    select: {
      id: true,
      quantityAvailable: true,
      quantityConsumed: true,
      foldLengthCm: true,
      fabricMaster: { select: { fabricCode: true } },
      grnItem: {
        select: {
          id: true,
          acceptedQuantity: true,
          actualQuantity: true,
          foldLengthCm: true,
          goods_receiving_notes: { select: { grnNumber: true } },
          grn_item_details: { orderBy: [{ baleNumber: 'asc' }, { sequenceNo: 'asc' }] },
        },
      },
      _count: { select: { pieces: true, stockTransactions: true, job_work_orders: true, external_process_send_outs: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — fabric lots whose receipt lists pieces: ${lots.length}`);
  let lotsWritten = 0;
  let piecesWritten = 0;
  let onRack = 0;
  let atCutting = 0;

  for (const lot of lots) {
    const line = lot.grnItem!;
    const label = `${lot.fabricMaster?.fabricCode ?? 'fabric'} · ${line.goods_receiving_notes?.grnNumber ?? '?'} (${lot.id.slice(0, 8)})`;
    const pieces = line.grn_item_details;
    const fold = line.foldLengthCm;
    const counted = addCurrency(...pieces.map((d) => Number(d.meters))).toNumber();
    const receiptActual = Number(line.actualQuantity ?? line.acceptedQuantity);
    const countedActual = foldActual(counted, fold).toNumber();

    if (lot._count.pieces > 0) {
      console.log(`  SKIP ${label}: already lists ${lot._count.pieces} piece(s)`);
      continue;
    }
    if (qtyExceeds(Math.abs(countedActual - receiptActual), 0)) {
      console.log(
        `  SKIP ${label}: ${pieces.length} pieces come to ${counted} m counted = ${countedActual} m actual at L=${fold ?? '—'}, ` +
          `but the receipt booked ${receiptActual} m`
      );
      continue;
    }

    const plan = await classify(lot, receiptActual);
    if (plan.kind === 'SKIP') {
      console.log(`  SKIP ${label}: ${plan.why}`);
      continue;
    }
    const where =
      plan.kind === 'UNTOUCHED'
        ? 'on the rack'
        : `at cutting — ${plan.challanNumber} → ${plan.batchNumber} (${plan.issuedAt.toISOString().slice(0, 10)})`;
    console.log(`  ${APPLY ? 'WRITE' : 'would write'} ${label}: ${pieces.length} pieces, ${counted} m counted at L=${fold ?? '—'} — ${where}`);

    if (APPLY) {
      await prisma.$transaction(async (tx) => {
        // Re-check inside the transaction: another run (or a count on the page) may have written a list
        const already = await tx.fabric_stock_details.count({ where: { fabricStockId: lot.id } });
        if (already > 0) throw new Error(`${label} gained a list while this ran — re-run the dry run`);
        for (const d of pieces) {
          const created = await tx.fabric_stock_details.create({
            data: {
              fabricStockId: lot.id,
              grnItemDetailId: d.id,
              baleNumber: d.baleNumber,
              sequenceNo: d.sequenceNo,
              meters: d.meters,
              metersRemaining: plan.kind === 'UNTOUCHED' ? d.meters : new Prisma.Decimal(0),
              status: plan.kind === 'UNTOUCHED' ? 'AVAILABLE' : 'CONSUMED',
              detailType: d.detailType === 'ROLL' ? 'ROLL' : 'THAN',
              source: 'RECEIPT',
              baleNo: d.baleNo ?? null,
              thanNo: d.thanNo ?? null,
              remarks: d.remarks ?? null,
            },
            select: { id: true },
          });
          if (plan.kind === 'AT_CUTTING') {
            await tx.fabric_issue_details.create({
              data: {
                fabricStockDetailId: created.id,
                challanId: plan.challanId,
                challanItemId: plan.challanItemId,
                cuttingBatchId: plan.cuttingBatchId,
                metersIssued: d.meters,
                issuedAt: plan.issuedAt,
                issuedById: plan.issuedById,
              },
            });
          }
        }
      });
    }
    lotsWritten += 1;
    piecesWritten += pieces.length;
    if (plan.kind === 'UNTOUCHED') onRack += pieces.length;
    else atCutting += pieces.length;
  }

  console.log(
    `\n${APPLY ? 'Wrote' : 'Would write'} ${lotsWritten} lot(s), ${piecesWritten} piece(s): ${onRack} on the rack, ` +
      `${atCutting} at cutting.`
  );
  if (!APPLY && lotsWritten > 0) console.log('Re-run with --apply to write.');
}

/** What left the lot, from its challan lines, ledger rows, jobs and send-outs. */
async function classify(
  lot: {
    id: string;
    quantityAvailable: Prisma.Decimal;
    quantityConsumed: Prisma.Decimal;
    _count: { stockTransactions: number; job_work_orders: number; external_process_send_outs: number };
  },
  receiptActual: number
): Promise<Plan> {
  if (lot._count.stockTransactions > 0) return { kind: 'SKIP', why: `${lot._count.stockTransactions} fabric ledger row(s) — moved by a door this cannot read` };
  if (lot._count.job_work_orders > 0) return { kind: 'SKIP', why: 'a job work order draws it' };
  if (lot._count.external_process_send_outs > 0) return { kind: 'SKIP', why: 'a send-out drew it' };

  const onHand = Number(lot.quantityAvailable);
  const consumed = Number(lot.quantityConsumed);
  const lines = await prisma.challan_items.findMany({
    where: { fabricStockId: lot.id, challan: { status: { not: 'CANCELLED' } } },
    select: {
      id: true,
      quantity: true,
      challan: {
        select: {
          id: true,
          challanNumber: true,
          challanType: true,
          fromName: true,
          toName: true,
          status: true,
          challanDate: true,
          issuedById: true,
          cuttingBatchId: true,
          cuttingBatch: { select: { batchNumber: true } },
        },
      },
    },
  });

  if (lines.length === 0) {
    if (!isQtyZero(consumed)) return { kind: 'SKIP', why: `${consumed} m consumed with no challan naming it` };
    if (qtyExceeds(Math.abs(onHand - receiptActual), 0)) {
      return { kind: 'SKIP', why: `on hand ${onHand} m ≠ the receipt's ${receiptActual} m with nothing naming it` };
    }
    return { kind: 'UNTOUCHED' };
  }

  const issues = lines
    .filter(
      (l) =>
        l.challan.challanType === 'INTERNAL' && l.challan.toName === 'Cutting' && ISSUED.includes(l.challan.status)
    )
    .sort((a, b) => a.challan.challanDate.getTime() - b.challan.challanDate.getTime());
  const returns = lines.filter(
    (l) => l.challan.challanType === 'INTERNAL' && l.challan.fromName === 'Cutting' && l.challan.status !== 'DRAFT'
  );
  const other = lines.filter((l) => !issues.includes(l) && !returns.includes(l));
  if (other.length > 0) {
    return { kind: 'SKIP', why: `named on ${other.map((l) => l.challan.challanNumber).join(', ')} (not an issue to / return from cutting)` };
  }
  const issued = addCurrency(...issues.map((l) => Number(l.quantity))).toNumber();
  const returned = addCurrency(...returns.map((l) => Number(l.quantity))).toNumber();
  const last = issues[issues.length - 1];
  if (!last) return { kind: 'SKIP', why: 'only returns name it' };
  const lastReturn = returns.reduce<Date | null>(
    (latest, l) => (!latest || l.challan.challanDate > latest ? l.challan.challanDate : latest),
    null
  );

  if (!isQtyZero(onHand)) return { kind: 'SKIP', why: `part of it went to cutting (${onHand} m still on hand)` };
  if (qtyExceeds(Math.abs(Number(last.quantity) - receiptActual), 0)) {
    return { kind: 'SKIP', why: `its last issue ${last.challan.challanNumber} took ${Number(last.quantity)} m, not the whole ${receiptActual} m` };
  }
  if (qtyExceeds(Math.abs(issued - returned - receiptActual), 0)) {
    return { kind: 'SKIP', why: `issued ${issued} m − returned ${returned} m is not the whole lot` };
  }
  if (lastReturn && lastReturn > last.challan.challanDate) {
    return { kind: 'SKIP', why: `a return came after its last issue ${last.challan.challanNumber}` };
  }
  if (!last.challan.cuttingBatchId || !last.challan.cuttingBatch) {
    return { kind: 'SKIP', why: `its last issue ${last.challan.challanNumber} names no cutting batch` };
  }
  return {
    kind: 'AT_CUTTING',
    challanId: last.challan.id,
    challanNumber: last.challan.challanNumber,
    challanItemId: last.id,
    cuttingBatchId: last.challan.cuttingBatchId,
    batchNumber: last.challan.cuttingBatch.batchNumber,
    issuedAt: last.challan.challanDate,
    issuedById: last.challan.issuedById,
  };
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
