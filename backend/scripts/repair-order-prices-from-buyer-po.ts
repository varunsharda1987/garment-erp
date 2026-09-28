/**
 * One-off repair: a production order linked to a sale order is priced at the BUYER PO price
 * (owner, 2026-09-28).
 *
 * The August orders were typed in by hand and priced from the cost sheet's Total Product Cost (the
 * calculated COST), then linked to their sale order — and the link kept the typed price. All nine
 * linked orders read their cost as their price (ORD2026080025 ₹122.64 × 2,300 = ₹2,82,072 against a
 * ₹200 buyer PO). The link now re-prices (saleOrder.service priceOrderFromBuyerPo); this re-prices the
 * orders linked before. Orders with no sale order are left as they are and listed.
 *
 *   npx ts-node scripts/repair-order-prices-from-buyer-po.ts            (dry run)
 *   npx ts-node scripts/repair-order-prices-from-buyer-po.ts --apply
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { buyerPoUnitPrice, lineValue } from '../src/services/helpers/buyer-po-price.helper';
import { priceOrderFromBuyerPo } from '../src/services/saleOrder.service';

function snapshotPath(): string {
  const base = path.join(__dirname, 'repair-order-prices-from-buyer-po-snapshot');
  let file = `${base}.json`;
  for (let n = 2; fs.existsSync(file); n++) file = `${base}-${n}.json`;
  return file;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

async function main() {
  const apply = process.argv.includes('--apply');
  const orders = await prisma.orders.findMany({
    where: { isActive: true, status: { not: 'CANCELLED' } },
    select: {
      id: true,
      orderNumber: true,
      saleOrderId: true,
      totalAmount: true,
      sale_orders: { select: { saleOrderNumber: true } },
      order_items: {
        select: { id: true, styleId: true, totalQuantity: true, unitPrice: true, styles: { select: { styleCode: true } } },
      },
    },
    orderBy: { orderNumber: 'asc' },
  });

  const toFix: Array<{ id: string; orderNumber: string; saleOrderId: string; totalAmount: number; items: unknown[] }> = [];
  for (const o of orders) {
    if (!o.saleOrderId) {
      console.log(`  ${o.orderNumber.padEnd(16)} no sale order — left as is (${fmt(Number(o.order_items[0]?.unitPrice ?? 0))} / pc)`);
      continue;
    }
    const lines = await prisma.sale_order_items.findMany({
      where: { saleOrderId: o.saleOrderId },
      select: { styleId: true, quantity: true, unitPrice: true },
    });
    let newTotal = 0;
    const items = [];
    for (const item of o.order_items) {
      const po = buyerPoUnitPrice(lines.filter((l) => l.styleId === item.styleId));
      const to = po?.unitPrice ?? Number(item.unitPrice);
      newTotal += lineValue(item.totalQuantity, to);
      if (po && po.unitPrice !== Number(item.unitPrice)) {
        items.push({ style: item.styles.styleCode, from: Number(item.unitPrice), to: po.unitPrice, note: po.note });
      }
    }
    if (items.length === 0) continue;
    for (const i of items) {
      console.log(
        `  ${o.orderNumber.padEnd(16)} ${String(i.style).padEnd(12)} ${fmt(i.from)} → ${fmt(i.to)} / pc   (${o.sale_orders?.saleOrderNumber})` +
          (i.note ? ` — ${i.note}` : '')
      );
    }
    console.log(`  ${''.padEnd(16)} order total ${fmt(Number(o.totalAmount))} → ${fmt(newTotal)}`);
    toFix.push({ id: o.id, orderNumber: o.orderNumber, saleOrderId: o.saleOrderId, totalAmount: Number(o.totalAmount), items: o.order_items });
  }

  if (toFix.length === 0) {
    console.log('\nEvery linked order already carries its buyer PO price. Nothing to do.');
    return;
  }
  if (!apply) {
    console.log(`\nDry run — ${toFix.length} order(s) would be re-priced. Re-run with --apply.`);
    return;
  }
  const file = snapshotPath();
  fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), orders: toFix }, null, 2));
  console.log(`\nSnapshot (for undo): ${file}`);
  for (const o of toFix) {
    await prisma.$transaction((tx) => priceOrderFromBuyerPo(tx, o.id, o.saleOrderId));
    console.log(`  ${o.orderNumber}: re-priced`);
  }
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
