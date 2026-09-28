/**
 * One-off repair: an order line's ESTIMATED cost per piece is the cost sheet's Total Product Cost
 * (2026-09-28, owner: a name means the same on every page — the cost sheet calls it the cost).
 *
 * A same-day change (95073a8f) set the estimate to the Total After Value Loss (cost before markup);
 * the owner ruled the cost sheet's own terms stand, so this puts every estimate back on the Total
 * Product Cost (helpers/order-costing.helper totalProductCostOf). Rows that already have an actual cost
 * are left alone (none on 28-Sep).
 *
 *   npx ts-node scripts/repair-order-costing-estimate.ts            (dry run)
 *   npx ts-node scripts/repair-order-costing-estimate.ts --apply
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { totalProductCostOf, type CostBuildUp } from '../src/services/helpers/order-costing.helper';
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
    const target = totalProductCostOf(r.costingSnapshot as CostBuildUp | null);
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
    console.log('Every order line estimate is already its Total Product Cost. Nothing to do.');
    return;
  }
  for (const f of fixes) console.log(`  ${f.label.padEnd(28)} estimate ${f.from} → ${f.to}   (Total Product Cost ${f.price})`);
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
