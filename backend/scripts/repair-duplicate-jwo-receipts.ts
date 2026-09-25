/**
 * Reverse the duplicate job-work receipts a stalled server let one delivery file six times.
 *
 * 25-Sep-2026, DJ-ESSKY076LS-001 (Aryan Dyeing): one delivery of 2,318.1 m (20 thans, 57") was
 * pressed through "Receive from processor" several times while the API was stalled. The first POST
 * was answered 503 "Response timeout" while its handler kept running; when the stall cleared every
 * queued request ran at once. Nothing locked the job row, so each read "0 received so far" and the
 * over-receipt cap never fired. Six receipts (GRN2609-0477…0482), six fabric lots (13,908.6 m),
 * six inward challans, stock_levels at 13,908.6 m and the MRP link at 13,908.6 — while the job itself,
 * last writer wins, recorded exactly one receipt's worth.
 *
 * At 13:32 the rest of the delivery came in as its own receipt (GRN2609-0502, 1,614 m, final), which
 * closed the job on 3,932.1 m — correct, because the job had only ever counted one of the six. That
 * receipt is a different delivery and is never touched.
 *
 * Keeps GRN2609-0480 (the one the job pointed to until 0502 arrived) and reverses every EXACT
 * duplicate of it through the one tested writer,
 * `grnService.reverseGRN`: receipt → REVERSED, lot deleted, stock_levels decremented, inward challan
 * CANCELLED, MRP / service-requirement links decremented (status recomputed), job recomputed from the
 * surviving receipts — which must equal what the job already says, and the script proves it did.
 * reverseGRN no longer writes a stock_movements row for a job-work return (it had
 * no STOCK_IN to balance), so the fabric Material Ledger stays clean.
 *
 * A receipt is reversed only when ALL hold — anything short of that is reported and left alone:
 *   - ACCEPTED, same job, one line, identical to the keeper's line (qty, thans, fold, width, date,
 *     than rows) and filed within 10 minutes of it;
 *   - its lot is untouched: available = the line's quantity, nothing reserved or consumed, AVAILABLE,
 *     and no row anywhere references it (every foreign key into fabric_stock is checked, read from the
 *     database itself), and no stock_movements row names it.
 *
 *   npx ts-node scripts/repair-duplicate-jwo-receipts.ts           # dry-run (default)
 *   npx ts-node scripts/repair-duplicate-jwo-receipts.ts --apply   # write
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import prisma from '../src/config/database';
import { grnService } from '../src/services/grn.service';
import { grnLineActualQty } from '../src/services/helpers/grn-line-value.helper';

const APPLY = process.argv.includes('--apply');
const JOB_NUMBER = 'DJ-ESSKY076LS-001';
/** The one of the six identical receipts that stays. */
const KEEP_GRN = 'GRN2609-0480';
/** The account the reversal is recorded against. */
const ADMIN_EMAIL = 'admin@kasya.in';
/** The duplicates were filed within seconds of each other; a genuine second delivery is not. */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

const num = (v: unknown) => (v == null ? null : Number(v));
const sameNum = (a: unknown, b: unknown) =>
  (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.0005);
const fmt = (n: number) => n.toFixed(3).replace(/\.?0+$/, '');

type Receipt = Awaited<ReturnType<typeof loadReceipts>>[number];

async function loadReceipts(jobId: string) {
  return prisma.goods_receiving_notes.findMany({
    where: { jobWorkOrderId: jobId },
    orderBy: { createdAt: 'asc' },
    include: {
      grn_items: { include: { grn_item_details: { orderBy: { sequenceNo: 'asc' } } } },
      inwardChallans: { select: { id: true, challanNumber: true, status: true } },
    },
  });
}

/** One line, the same figures and the same than rows as the keeper. */
function isExactCopy(r: Receipt, keeper: Receipt): string | null {
  if (r.grn_items.length !== 1 || keeper.grn_items.length !== 1) return 'not a single-line receipt';
  const a = r.grn_items[0];
  const k = keeper.grn_items[0];
  if (!sameNum(a.receivedQuantity, k.receivedQuantity)) return 'different quantity';
  if (!sameNum(a.acceptedQuantity, k.acceptedQuantity)) return 'different accepted quantity';
  if (a.thanCount !== k.thanCount) return 'different than count';
  if (!sameNum(a.foldLengthCm, k.foldLengthCm)) return 'different fold length';
  if (!sameNum(a.receivedWidthInches, k.receivedWidthInches)) return 'different width';
  if (a.materialId !== k.materialId) return 'different material';
  if (r.warehouseId !== keeper.warehouseId) return 'different warehouse';
  if (r.receivingDate?.getTime() !== keeper.receivingDate?.getTime()) return 'different receiving date';
  const rows = (x: typeof a) => x.grn_item_details.map((d) => `${d.baleNumber ?? ''}:${Number(d.meters)}`).join('|');
  if (rows(a) !== rows(k)) return 'different than rows';
  if (Math.abs(r.createdAt.getTime() - keeper.createdAt.getTime()) > DUPLICATE_WINDOW_MS) {
    return 'filed more than 10 minutes apart — could be a genuine delivery';
  }
  return null;
}

async function fabricStockForeignKeys(): Promise<Array<{ table: string; column: string }>> {
  return prisma.$queryRaw<Array<{ table: string; column: string }>>`
    SELECT kcu.table_name AS "table", kcu.column_name AS "column"
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = rc.constraint_name AND kcu.constraint_schema = rc.constraint_schema
    JOIN information_schema.key_column_usage pk
      ON pk.constraint_name = rc.unique_constraint_name AND pk.constraint_schema = rc.unique_constraint_schema
    WHERE pk.table_name = 'fabric_stock' AND kcu.table_schema = 'public'`;
}

async function referencesTo(lotId: string, fks: Array<{ table: string; column: string }>): Promise<string[]> {
  const found: string[] = [];
  for (const fk of fks) {
    // Identifiers come from information_schema, never from input.
    const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM "${fk.table}" WHERE "${fk.column}" = $1`,
      lotId
    );
    if (rows[0].n > 0) found.push(`${fk.table}.${fk.column} ×${rows[0].n}`);
  }
  const moves = await prisma.stock_movements.count({ where: { referenceId: lotId } });
  if (moves > 0) found.push(`stock_movements.referenceId ×${moves}`);
  return found;
}

async function main() {
  console.log(`=== Duplicate job-work receipt repair — ${JOB_NUMBER} (${APPLY ? 'APPLY' : 'DRY RUN'}) ===\n`);

  const job = await prisma.job_work_orders.findFirst({ where: { jobWorkNumber: JOB_NUMBER } });
  if (!job) throw new Error(`${JOB_NUMBER} not found`);
  if (!job.grnId || !job.finishedFabricId) throw new Error(`${JOB_NUMBER} has no current receipt / finished fabric`);
  const admin = await prisma.users.findFirst({ where: { email: ADMIN_EMAIL }, select: { id: true } });
  if (!admin) throw new Error(`${ADMIN_EMAIL} not found`);

  const receipts = await loadReceipts(job.id);
  const keeper = receipts.find((r) => r.grnNumber === KEEP_GRN);
  if (!keeper || keeper.status !== 'ACCEPTED') throw new Error(`${KEEP_GRN} is missing or not ACCEPTED`);
  const keeperChallan = keeper.inwardChallans.find((c) => c.status !== 'CANCELLED');
  if (!keeperChallan || keeper.inwardChallans.length !== 1) {
    throw new Error(`${KEEP_GRN} should have exactly one live inward challan — needs a human look`);
  }

  console.log(
    `Job: ${job.jwoStatus}, ${Number(job.qtyReceivedMeters)} m received, ${job.thanCount} thans, receivedDate ${job.receivedDate ?? '—'}`
  );
  console.log(`Keep: ${keeper.grnNumber} + ${keeperChallan.challanNumber}\n`);

  const fks = await fabricStockForeignKeys();
  const planned: Array<{ receipt: Receipt; lotId: string; qty: number; challan: string }> = [];
  const skipped: string[] = [];

  for (const r of receipts) {
    if (r.id === keeper.id) continue;
    const label = `${r.grnNumber} (${r.status})`;
    if (r.status !== 'ACCEPTED') {
      skipped.push(`${label}: not ACCEPTED`);
      continue;
    }
    const why = isExactCopy(r, keeper);
    if (why) {
      skipped.push(`${label}: ${why}`);
      continue;
    }
    const item = r.grn_items[0];
    const lots = await prisma.fabric_stock.findMany({ where: { grnItemId: item.id } });
    if (lots.length !== 1) {
      skipped.push(`${label}: expected one lot, found ${lots.length}`);
      continue;
    }
    const lot = lots[0];
    const lineQty = Number(item.acceptedQuantity);
    const problems: string[] = [];
    if (lot.fabricId !== job.finishedFabricId) problems.push('lot is a different fabric');
    if (!sameNum(lot.quantityAvailable, lineQty)) problems.push(`available ${Number(lot.quantityAvailable)} ≠ ${lineQty}`);
    if (Number(lot.quantityReserved) !== 0) problems.push(`${Number(lot.quantityReserved)} reserved`);
    if (Number(lot.quantityConsumed) !== 0) problems.push(`${Number(lot.quantityConsumed)} consumed`);
    if (lot.status !== 'AVAILABLE') problems.push(`status ${lot.status}`);
    problems.push(...(await referencesTo(lot.id, fks)).map((x) => `referenced by ${x}`));
    if (problems.length) {
      skipped.push(`${label}: lot ${lot.id.slice(0, 8)} has been used — ${problems.join('; ')}`);
      continue;
    }
    planned.push({ receipt: r, lotId: lot.id, qty: lineQty, challan: r.inwardChallans[0]?.challanNumber ?? '—' });
  }

  // ── The invariant that makes this safe ───────────────────────────────────────────────────────
  // The job must already count exactly the receipts that survive (the keeper + any genuine other
  // delivery). Reversal recomputes the job from those survivors, so its figures must not move.
  const dupTotal = planned.reduce((s, p) => s + p.qty, 0);
  const survivors = receipts.filter((r) => r.status === 'ACCEPTED' && !planned.some((p) => p.receipt.id === r.id));
  const survivorQty = survivors.reduce(
    (s, r) => s + r.grn_items.reduce((t, i) => t + grnLineActualQty(i).toNumber(), 0),
    0
  );
  const survivorThans = survivors.reduce((s, r) => s + r.grn_items.reduce((t, i) => t + (i.thanCount ?? 0), 0), 0);
  console.log(
    `Surviving receipts: ${survivors.map((r) => r.grnNumber).join(', ')} = ${fmt(survivorQty)} m, ${survivorThans} thans`
  );
  if (!sameNum(survivorQty, job.qtyReceivedMeters) || survivorThans !== job.thanCount) {
    console.log(
      `!! The job says ${Number(job.qtyReceivedMeters)} m / ${job.thanCount} thans — reversing would change it. Stopping.`
    );
    process.exitCode = 1;
    return;
  }

  // ── Expected figures ─────────────────────────────────────────────────────────────────────────
  const level = await prisma.stock_levels.findUnique({
    where: { materialId_warehouseId: { materialId: job.finishedFabricId, warehouseId: keeper.warehouseId! } },
  });
  const links = await prisma.requirement_jwo_links.findMany({
    where: { jobWorkOrderId: job.id },
    include: { material_requirements: { select: { requirementNumber: true, status: true } } },
  });
  const movesSince = await prisma.stock_movements.count({
    where: { materialId: job.finishedFabricId, createdAt: { gte: receipts[0].createdAt } },
  });

  console.log(`Reverse — ${planned.length}`);
  for (const p of planned) {
    console.log(`  ${p.receipt.grnNumber}  ${fmt(p.qty)} m  lot ${p.lotId.slice(0, 8)}  challan ${p.challan}`);
  }
  console.log(`\nLeft alone — ${skipped.length}`);
  for (const s of skipped) console.log(`  ${s}`);

  console.log('\nExpected after:');
  console.log(`  stock_levels  ${fmt(Number(level?.quantity ?? 0))} → ${fmt(Number(level?.quantity ?? 0) - dupTotal)} m`);
  for (const l of links) {
    console.log(
      `  ${l.material_requirements.requirementNumber} link  received ${fmt(Number(l.receivedQuantity))} → ` +
        `${fmt(Number(l.receivedQuantity) - dupTotal)} of ${fmt(Number(l.allocatedQuantity))} allocated ` +
        `(status now ${l.material_requirements.status})`
    );
  }
  console.log(`  job           ${job.jwoStatus}, ${Number(job.qtyReceivedMeters)} m, ${job.thanCount} thans → unchanged`);
  console.log(`  stock_movements for this fabric since the first receipt: ${movesSince} (must stay ${movesSince})`);

  if (!APPLY) {
    console.log(`\nDry run — ${planned.length} receipt(s) would be reversed. Pass --apply to write.`);
    return;
  }
  if (planned.length === 0) {
    console.log('\nNothing to apply.');
    return;
  }

  // Full pre-state of every row the reversal touches, so it can be rebuilt by hand.
  const snapshot = {
    takenAt: new Date().toISOString(),
    job,
    stockLevel: level,
    links,
    receipts: receipts.filter((r) => planned.some((p) => p.receipt.id === r.id)),
    lots: await prisma.fabric_stock.findMany({ where: { id: { in: planned.map((p) => p.lotId) } } }),
    challans: await prisma.challans.findMany({
      where: { grnId: { in: planned.map((p) => p.receipt.id) } },
      include: { items: true },
    }),
  };
  const path = join(__dirname, 'repair-duplicate-jwo-receipts-snapshot.json');
  writeFileSync(path, JSON.stringify(snapshot, null, 2));

  const reason =
    `Duplicate of ${keeper.grnNumber} — Receive from processor was pressed several times while the server ` +
    `was stalled (25-Sep-2026); one delivery, filed ${planned.length + 1} times`;
  for (const p of planned) {
    await grnService.reverseGRN(p.receipt.id, admin.id, reason);
    console.log(`  reversed ${p.receipt.grnNumber}`);
  }

  // ── Post-check: prove the end state rather than assume it ────────────────────────────────────
  const fail = (msg: string) => {
    console.log(`  !! ${msg}`);
    process.exitCode = 1;
  };
  const jobAfter = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: job.id } });
  const accepted = await prisma.goods_receiving_notes.findMany({ where: { jobWorkOrderId: job.id, status: 'ACCEPTED' } });
  const lotsAfter = await prisma.fabric_stock.findMany({ where: { fabricId: job.finishedFabricId } });
  const lotSum = lotsAfter
    .filter((l) => l.warehouseId === keeper.warehouseId)
    .reduce((s, l) => s + Number(l.quantityAvailable), 0);
  const levelAfter = await prisma.stock_levels.findUnique({
    where: { materialId_warehouseId: { materialId: job.finishedFabricId, warehouseId: keeper.warehouseId! } },
  });
  const linksAfter = await prisma.requirement_jwo_links.findMany({
    where: { jobWorkOrderId: job.id },
    include: { material_requirements: { select: { requirementNumber: true, status: true } } },
  });
  const cancelled = await prisma.challans.count({
    where: { grnId: { in: planned.map((p) => p.receipt.id) }, status: 'CANCELLED' },
  });
  const movesAfter = await prisma.stock_movements.count({
    where: { materialId: job.finishedFabricId, createdAt: { gte: receipts[0].createdAt } },
  });
  console.log('\nAfter:');
  console.log(`  ACCEPTED receipts ${accepted.map((g) => g.grnNumber).join(', ')}`);
  console.log(`  lots of this fabric ${lotsAfter.length}, sum in ${keeper.warehouseId?.slice(0, 8)} ${fmt(lotSum)} m`);
  console.log(`  stock_levels ${fmt(Number(levelAfter?.quantity ?? 0))} m`);
  for (const l of linksAfter) {
    console.log(
      `  ${l.material_requirements.requirementNumber} link ${fmt(Number(l.receivedQuantity))} m — ${l.material_requirements.status}`
    );
  }
  console.log(
    `  job ${jobAfter.jwoStatus}, ${Number(jobAfter.qtyReceivedMeters)} m, ${jobAfter.thanCount} thans, ` +
      `normal loss ${Number(jobAfter.qtyNormalLoss)}, abnormal ${Number(jobAfter.qtyAbnormalLoss)}`
  );
  console.log(`  inward challans cancelled ${cancelled}/${planned.length}; stock_movements since ${movesAfter}`);

  const survivorIds = survivors.map((r) => r.id).sort();
  if (accepted.map((g) => g.id).sort().join() !== survivorIds.join()) fail('ACCEPTED receipts are not exactly the survivors');
  if (!sameNum(lotSum, survivorQty)) fail(`lots sum ${lotSum} ≠ surviving receipts ${survivorQty}`);
  if (!sameNum(levelAfter?.quantity, Number(level?.quantity ?? 0) - dupTotal)) {
    fail(`stock_levels ${Number(levelAfter?.quantity)} ≠ ${Number(level?.quantity ?? 0) - dupTotal}`);
  }
  if (!sameNum(levelAfter?.quantity, lotSum)) fail(`stock_levels ${Number(levelAfter?.quantity)} ≠ lots ${lotSum}`);
  for (const l of linksAfter) {
    if (!sameNum(l.receivedQuantity, Number(links.find((b) => b.id === l.id)!.receivedQuantity) - dupTotal)) {
      fail(`${l.material_requirements.requirementNumber} link not decremented by ${dupTotal}`);
    }
  }
  // Reversal recomputes the job from the survivors — which is what it already said.
  for (const k of ['jwoStatus', 'grnId', 'inwardChallanId', 'thanCount', 'qtyNormalLoss', 'qtyAbnormalLoss'] as const) {
    if (String(jobAfter[k]) !== String(job[k])) fail(`job.${k} moved: ${String(job[k])} → ${String(jobAfter[k])}`);
  }
  if (!sameNum(jobAfter.qtyReceivedMeters, job.qtyReceivedMeters)) fail('job received quantity moved');
  if (jobAfter.receivedDate?.getTime() !== job.receivedDate?.getTime()) fail('job receivedDate moved');
  if (cancelled !== planned.length) fail('not every duplicate challan is CANCELLED');
  if (movesAfter !== movesSince) fail('a stock_movements row was written');

  console.log(
    `\n${process.exitCode ? 'Applied WITH MISMATCHES (see !!)' : 'Applied — all checks passed'}. Pre-state snapshot: ${path}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
