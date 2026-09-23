/**
 * Re-state PO receipts that were counted at a fold length ("L") in ACTUAL metres.
 *
 * Until 2026-09-23 a GRN line counted at L (grn_items.foldLengthCm, 0 < L < 100) was compared and
 * counted on the supplier's COUNTED figure, while the PO it was received against is in ACTUAL metres
 * (actual = counted × L/100 — utils/fold-length.ts). So the PO's received counter held the counted
 * figure and the line was flagged as an over-receipt by exactly the fold loss. The GRN code now works in
 * actual metres; this script brings the rows written before the fix into line.
 *
 * For every PO line with at least one folded receipt still PENDING_QC:
 *   - purchase_order_items.receivedQuantity = Σ actual received of its live receipts, in the same terms
 *     createGRN / approveGRN now write (PENDING_QC: actual received; ACCEPTED: actual accepted);
 *   - each folded line's isOverReceipt / overReceiptQty / actualQuantity are recomputed in receipt order.
 * PO status is recomputed through purchaseOrderService.updateReceivingStatus.
 *
 * An ACCEPTED folded receipt is reported and left alone: its stock movement and MRP link were written
 * on the counted figure too, and unwinding those is a reversal, not a restatement.
 *
 * Live case (2026-09-23): GRN2609-0250 / PO2609-0006, 10,011 m counted @ L=98 = 9,810.78 m actual.
 *
 *   npx ts-node scripts/repair-fold-length-grn.ts           # dry-run (default)
 *   npx ts-node scripts/repair-fold-length-grn.ts --apply   # write (snapshot JSON first)
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import prisma from '../src/config/database';
import { foldActual, hasFold } from '../src/utils/fold-length';
import { addCurrency, subtractCurrency, toNumber } from '../src/utils/currency';
import { purchaseOrderService } from '../src/services/purchaseOrder.service';

const APPLY = process.argv.includes('--apply');
const LIVE_STATUSES = ['PENDING_QC', 'ACCEPTED', 'PARTIALLY_ACCEPTED'] as const;

async function main() {
  console.log(`=== Fold-length GRN restatement (${APPLY ? 'APPLY' : 'DRY RUN'}) ===\n`);

  const folded = await prisma.grn_items.findMany({
    where: { foldLengthCm: { gt: 0, lt: 100 }, poItemId: { not: null } },
    select: { poItemId: true },
  });
  const poItemIds = [...new Set(folded.map((f) => f.poItemId as string))];

  const snapshot: unknown[] = [];
  const plans: Array<{
    poItemId: string;
    poId: string;
    counter: { from: number; to: number };
    lines: Array<{ id: string; isOverReceipt: boolean; overReceiptQty: number | null; actualQuantity: number | null }>;
  }> = [];

  for (const poItemId of poItemIds) {
    const poItem = await prisma.purchase_order_items.findUniqueOrThrow({
      where: { id: poItemId },
      select: {
        id: true,
        poId: true,
        orderedQuantity: true,
        receivedQuantity: true,
        purchase_orders: { select: { poNumber: true, status: true } },
      },
    });
    const receipts = await prisma.grn_items.findMany({
      where: { poItemId, goods_receiving_notes: { status: { in: [...LIVE_STATUSES] } } },
      include: { goods_receiving_notes: { select: { grnNumber: true, status: true, createdAt: true } } },
      orderBy: { goods_receiving_notes: { createdAt: 'asc' } },
    });

    const acceptedFolded = receipts.filter(
      (r) => hasFold(r.foldLengthCm) && r.goods_receiving_notes.status !== 'PENDING_QC'
    );
    if (acceptedFolded.length > 0) {
      console.log(
        `SKIP ${poItem.purchase_orders.poNumber}: approved folded receipt(s) ` +
          `${acceptedFolded.map((r) => r.goods_receiving_notes.grnNumber).join(', ')} — stock movement and MRP were ` +
          `booked on the counted figure; review by hand (reverse + re-receive).`
      );
      continue;
    }

    const ordered = Number(poItem.orderedQuantity);
    let running = addCurrency(0);
    const lines: (typeof plans)[number]['lines'] = [];
    for (const r of receipts) {
      const pending = toNumber(subtractCurrency(ordered, running));
      const counted = r.goods_receiving_notes.status === 'PENDING_QC' ? r.receivedQuantity : r.acceptedQuantity;
      const actual = foldActual(counted, r.foldLengthCm);
      if (hasFold(r.foldLengthCm)) {
        const actualReceived = foldActual(r.receivedQuantity, r.foldLengthCm).toNumber();
        const isOver = actualReceived > pending;
        lines.push({
          id: r.id,
          isOverReceipt: isOver,
          overReceiptQty: isOver ? toNumber(subtractCurrency(actualReceived, pending)) : null,
          actualQuantity: foldActual(r.acceptedQuantity, r.foldLengthCm).toNumber(),
        });
      }
      running = addCurrency(running, actual);
    }
    const to = toNumber(running);
    const from = Number(poItem.receivedQuantity);

    snapshot.push({ poItem, receipts });
    plans.push({ poItemId, poId: poItem.poId, counter: { from, to }, lines });

    console.log(`${poItem.purchase_orders.poNumber} (${poItem.purchase_orders.status}), ordered ${ordered}`);
    console.log(`  received counter: ${from} → ${to}`);
    for (const l of lines) {
      const r = receipts.find((x) => x.id === l.id)!;
      console.log(
        `  ${r.goods_receiving_notes.grnNumber} [${r.goods_receiving_notes.status}] ${Number(r.receivedQuantity)} counted @ L=${Number(r.foldLengthCm)}` +
          ` → actual ${l.actualQuantity}; over-receipt ${String(r.isOverReceipt)}/${r.overReceiptQty ?? '—'} → ${String(l.isOverReceipt)}/${l.overReceiptQty ?? '—'}`
      );
    }
  }

  if (plans.length === 0) {
    console.log('Nothing to restate.');
    return;
  }
  if (!APPLY) {
    console.log('\nDry run — re-run with --apply to write.');
    return;
  }

  const snapPath = join(__dirname, 'repair-fold-length-grn-snapshot.json');
  writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
  console.log(`\nSnapshot written: ${snapPath}`);

  for (const plan of plans) {
    await prisma.$transaction(async (tx) => {
      await tx.purchase_order_items.update({
        where: { id: plan.poItemId },
        data: { receivedQuantity: plan.counter.to },
      });
      for (const l of plan.lines) {
        await tx.grn_items.update({
          where: { id: l.id },
          data: { isOverReceipt: l.isOverReceipt, overReceiptQty: l.overReceiptQty, actualQuantity: l.actualQuantity },
        });
      }
    });
    await purchaseOrderService.updateReceivingStatus(plan.poId);
  }
  console.log(`Applied ${plans.length} PO line(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
