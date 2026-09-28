/**
 * One-off backfill: give every production order the status its runs and delivery notes say (2026-09-28).
 *
 * Until 2026-09-28 nothing moved `orders.status` — every order read PENDING, including ORD2026080025
 * and ORD2026080026 whose runs (WO2609-0087 / WO2609-0088) were IN_PRODUCTION on the cutting table.
 * From now on every run / delivery-note writer calls syncOrderStatus (services/helpers/order-status.helper);
 * this brings the orders written before that into line.
 *
 * Each order is re-derived by the SAME syncOrderStatus the writers call, one transaction per order.
 * CANCELLED and SPLIT orders are never touched. `findOrderStatusDrift` is also the invariant sweep
 * (check-order-system-integrity D26): after --apply it must find nothing.
 *
 *   npx ts-node scripts/repair-order-status.ts            (dry-run: lists stored → derived, and why)
 *   npx ts-node scripts/repair-order-status.ts --apply    (writes; snapshot saved for undo)
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { findOrderStatusDrift, syncOrderStatus } from '../src/services/helpers/order-status.helper';

// One snapshot per run, never overwritten: a later run must not erase an earlier undo record
function snapshotPath(): string {
  const base = path.join(__dirname, 'repair-order-status-snapshot');
  let file = `${base}.json`;
  for (let n = 2; fs.existsSync(file); n++) file = `${base}-${n}.json`;
  return file;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const drift = await findOrderStatusDrift(prisma);

  if (drift.length === 0) {
    console.log('Every production order already reads what its runs and delivery notes say. Nothing to do.');
    return;
  }

  console.log(`${drift.length} production order(s) read a status their facts do not support:\n`);
  for (const d of drift) {
    console.log(`  ${d.orderNumber.padEnd(16)} ${d.stored.padEnd(14)} → ${d.derived.padEnd(14)} (${d.reason})`);
  }

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to set these.');
    return;
  }

  const file = snapshotPath();
  fs.writeFileSync(
    file,
    JSON.stringify({ takenAt: new Date().toISOString(), orders: drift.map(({ orderId, orderNumber, stored }) => ({ orderId, orderNumber, stored })) }, null, 2)
  );
  console.log(`\nSnapshot (for undo): ${file}`);

  for (const d of drift) {
    const status = await prisma.$transaction((tx) => syncOrderStatus(tx, d.orderId));
    console.log(`  ${d.orderNumber}: now ${status}`);
  }

  const left = await findOrderStatusDrift(prisma);
  if (left.length > 0) {
    console.error(`\n${left.length} order(s) still drift after --apply:`);
    for (const d of left) console.error(`  ${d.orderNumber} ${d.stored} → ${d.derived} (${d.reason})`);
    process.exitCode = 1;
    return;
  }
  console.log('\nDone — no order drifts.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
