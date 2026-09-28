/**
 * One-off repair: an order line's ESTIMATED cost per piece is its cost before markup (2026-09-28).
 *
 * createCostingSnapshots copied the cost sheet's totalCostPerPiece — its PRICE (subtotal + value loss
 * + markup) — into order_item_costing.estimatedCostPerPiece, so every estimate carried the 15 % markup
 * (ESSKY085LS: 122.64 instead of 106.65) and the Finished Goods stock page valued stock at the price.
 * New snapshots use costBeforeMarkup (helpers/order-costing.helper); this fixes the rows written before.
 * Rows that already have an actual cost are left alone (none on 28-Sep) — their variance was computed
 * against the old estimate and is reported instead.
 *
 *   npx ts-node scripts/repair-order-costing-estimate.ts            (dry run)
 *   npx ts-node scripts/repair-order-costing-estimate.ts --apply
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { costBeforeMarkup, type CostBuildUp } from '../src/services/helpers/order-costing.helper';
import { isQtyZero } from '../src/utils/quantity';

function snapshotPath(): string {
  const base = path.join(__dirname, 'repair-order-costing-estimate-snapshot');
  let file = `${base}.json`;
  for (let n = 2; fs.existsSync(file); n++) file = `${base}-${n}.json`;
  return file;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const rows = await prisma.order_item_costing.findMany({
    select: {
      id: true,
      estimatedCostPerPiece: true,
      actualCostPerPiece: true,
      totalCostPerPiece: true,
      costingSnapshot: true,
      order_item: { select: { orders: { select: { orderNumber: true } }, styles: { select: { styleCode: true } } } },
    },
  });

  const fixes = [];
  const skipped = [];
  for (const r of rows) {
    const target = costBeforeMarkup(r.costingSnapshot as CostBuildUp | null);
    const current = Number(r.estimatedCostPerPiece ?? 0);
    if (!target || isQtyZero(target - current)) continue;
    const label = `${r.order_item.orders.orderNumber} ${r.order_item.styles.styleCode}`;
    if (r.actualCostPerPiece !== null) {
      skipped.push(`${label}: has an actual cost already — estimate ${current} left as is`);
      continue;
    }
    fixes.push({ id: r.id, label, from: current, to: target, price: Number(r.totalCostPerPiece) });
  }

  if (fixes.length === 0 && skipped.length === 0) {
    console.log('Every order line estimate is already its cost before markup. Nothing to do.');
    return;
  }
  for (const f of fixes) console.log(`  ${f.label.padEnd(28)} estimate ${f.from} → ${f.to}   (price ${f.price})`);
  for (const s of skipped) console.log(`  SKIPPED ${s}`);

  if (!apply) {
    console.log(`\nDry run — ${fixes.length} row(s) would change. Re-run with --apply.`);
    return;
  }
  const file = snapshotPath();
  fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), rows: fixes }, null, 2));
  console.log(`\nSnapshot (for undo): ${file}`);
  for (const f of fixes) {
    await prisma.order_item_costing.update({ where: { id: f.id }, data: { estimatedCostPerPiece: f.to } });
  }
  console.log(`Done — ${fixes.length} row(s) updated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
