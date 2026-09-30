/**
 * Replace production runs made on the standalone Create Work Order page — with no link to the order
 * they were meant for — by the run the order itself creates (2026-09-30).
 *
 * KMC (ORD2026090034, 2,550 pcs) got WO2609-0308 and WO2609-0309 from Create Work Order at the same
 * instant: two runs for one order, neither linked to it, so the order still read "no production run"
 * and its BOM / requirements / dispatch would never connect to the cutting. The owner chose to
 * delete both and create the run from the order (what its **Create Production Run** button does:
 * createMissingWorkOrders → workOrderService.createFromOrderItem).
 *
 * Refuses a run that is linked to an order already, or that anything besides its own size rows and
 * status entries points at (a cutting batch, requirement, sample…). Dry run by default.
 *
 *   npx ts-node --files scripts/replace-unlinked-runs-with-order-run.ts --order ORD2026090034 --runs WO2609-0308,WO2609-0309
 *   … --apply
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import workOrderService from '../src/services/workOrder.service';
import { createMissingWorkOrders } from '../src/controllers/order.controller';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes('--apply');
const ORDER = arg('--order');
const RUNS = (arg('--runs') ?? '').split(',').filter(Boolean);
const SNAPSHOT = path.join(__dirname, `replace-unlinked-runs-snapshot-${Date.now()}.json`);

/** Rows a freshly made run owns and that go with it */
const OWN_TABLES = new Set(['work_order_breakup', 'production_tracking']);

async function main() {
  if (!ORDER || RUNS.length === 0) throw new Error('Pass --order <orderNumber> --runs <WO,WO>');

  const order = await prisma.orders.findFirst({
    where: { orderNumber: ORDER },
    select: { id: true, orderNumber: true, order_items: { select: { styleId: true } } },
  });
  if (!order) throw new Error(`Order ${ORDER} not found`);

  const runs = await prisma.work_orders.findMany({ where: { workOrderNumber: { in: RUNS } } });
  if (runs.length !== RUNS.length) throw new Error(`Found ${runs.length} of ${RUNS.length} runs`);

  const columns = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public' and column_name in ('workOrderId', 'parentRunId')`
  );
  for (const run of runs) {
    if (run.orderId || run.orderItemId || run.stockProductionOrderId) {
      throw new Error(`${run.workOrderNumber} is linked to an order already — not touched`);
    }
    if (!order.order_items.some((i) => i.styleId === run.styleId)) {
      throw new Error(`${run.workOrderNumber} is for a style that ${ORDER} does not order`);
    }
    for (const c of columns) {
      if (OWN_TABLES.has(c.table_name)) continue;
      const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
        `select count(*)::int n from "${c.table_name}" where "${c.column_name}" = $1`,
        run.id
      );
      if (n > 0) throw new Error(`${run.workOrderNumber} is used by ${n} ${c.table_name} row(s) — not touched`);
    }
    console.log(`  delete ${run.workOrderNumber} (${run.totalQuantity} pcs, no order link, nothing done on it)`);
  }
  console.log(`  then create ${ORDER}'s own run (Create Production Run)`);

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    return;
  }

  const ids = runs.map((r) => r.id);
  const [breakup, tracking] = await Promise.all([
    prisma.work_order_breakup.findMany({ where: { workOrderId: { in: ids } } }),
    prisma.production_tracking.findMany({ where: { workOrderId: { in: ids } } }),
  ]);
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ at: new Date().toISOString(), runs, breakup, tracking }, null, 2));
  console.log(`Snapshot: ${SNAPSHOT}`);

  await prisma.production_tracking.deleteMany({ where: { workOrderId: { in: ids } } });
  for (const run of runs) await workOrderService.deleteWorkOrder(run.id);

  // As the person who made the runs
  const result = await createMissingWorkOrders(order.id, runs[0].createdById, {});
  console.log('Created:', result.created, 'skipped:', result.skipped, 'failed:', result.failed);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
