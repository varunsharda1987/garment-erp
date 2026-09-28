/**
 * Put the sale order's sizes onto production orders that Link to Production Order left sizeless
 * (2026-09-28).
 *
 * On 24-Sep eight Easybuy production orders were linked to their sale orders. Linking copies the buyer
 * PO's size split, but it refused any style with no colour — so only ESSKY085LS / 086LS got sizes, and
 * ESSKY075, 076, 087, 090, 091 and 092LS stayed sizeless: their size-wise labels read "Size Split
 * Pending" on Requirements (or, planned before 29-Aug, sat orderable at full quantity with no size)
 * while the sale orders listed every size. Colour is optional now (sku-colour.helper), so the copy
 * the link would have made can be made.
 *
 * Repair path = the SANCTIONED endpoint, driven as the admin user against the live API — exactly the
 * call Link to Production Order makes (applyOrderItemSizeBreakup, confirmQuantityChange: true — the
 * production order makes the buyer PO exactly): sizes, pending-run sync, MRP re-run, production run.
 *   PUT /orders/:orderId/items/:orderItemId/size-breakup
 *
 * `findSizelessLinkedItems` is also the invariant sweep (check-order-system-integrity D27): after
 * --apply it must find nothing.
 *
 *   npx ts-node scripts/apply-sale-order-sizes.ts            (dry-run: lists order, style, sizes)
 *   npx ts-node scripts/apply-sale-order-sizes.ts --apply    (writes via the API; snapshot saved first)
 */
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';
import { findSizelessLinkedItems } from '../src/services/helpers/sale-order-sizes.helper';

const APPLY = process.argv.includes('--apply');
const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';

// One snapshot per run, never overwritten: a later run must not erase an earlier undo record
function snapshotPath(): string {
  const base = path.join(__dirname, 'apply-sale-order-sizes-snapshot');
  let file = `${base}.json`;
  for (let n = 2; fs.existsSync(file); n++) file = `${base}-${n}.json`;
  return file;
}

async function main() {
  const items = await findSizelessLinkedItems(prisma);
  if (items.length === 0) {
    console.log('Every linked production order already carries its sale order sizes. Nothing to do.');
    return;
  }

  const sizeNames = new Map(
    (
      await prisma.size_options.findMany({
        where: { id: { in: items.flatMap((i) => i.split.map((b) => b.sizeId)) } },
        select: { id: true, sizeName: true },
      })
    ).map((s) => [s.id, s.sizeName])
  );

  console.log(`${items.length} sizeless order item(s) whose sale order lists sizes:\n`);
  for (const item of items) {
    const total = item.split.reduce((sum, b) => sum + b.quantity, 0);
    const sizes = item.split.map((b) => `${sizeNames.get(b.sizeId) ?? b.sizeId} ${b.quantity}`).join(' · ');
    const qty = total === item.orderQuantity ? `${total} pcs` : `${item.orderQuantity} → ${total} pcs`;
    console.log(`  ${item.orderNumber}  ${item.styleCode.padEnd(11)} ${item.saleOrderNumber}  ${qty}  ${sizes}`);
  }

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to copy these sizes via the live API.');
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/ so .env loads.');
  const admin =
    (await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } })) ||
    (await prisma.users.findFirst({ where: { role: 'ADMIN', isActive: true } }));
  if (!admin) throw new Error('No ADMIN user found.');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });
  console.log(`\nActing as ${admin.email} (${admin.role})`);

  // Undo record: what each order carried before — quantities, money, requirements, runs
  const orderIds = [...new Set(items.map((i) => i.orderId))];
  const file = snapshotPath();
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        items,
        orders: await prisma.orders.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, orderNumber: true, status: true, totalQuantity: true, totalAmount: true },
        }),
        orderItems: await prisma.order_items.findMany({
          where: { id: { in: items.map((i) => i.orderItemId) } },
          select: { id: true, totalQuantity: true, totalPrice: true, unitPrice: true },
        }),
        requirements: await prisma.material_requirements.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true, requirementNumber: true, orderId: true, materialId: true, status: true, totalRequired: true },
        }),
        workOrders: await prisma.work_orders.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true, workOrderNumber: true, orderId: true, status: true },
        }),
      },
      null,
      2
    )
  );
  console.log(`Snapshot (for undo): ${file}\n`);

  let failed = 0;
  for (const item of items) {
    const res = await fetch(`${API}/orders/${item.orderId}/items/${item.orderItemId}/size-breakup`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ breakup: item.split, confirmQuantityChange: true }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      failed++;
      console.error(`  ${item.orderNumber} ${item.styleCode}: HTTP ${res.status} — ${json.message || JSON.stringify(json)}`);
      continue;
    }
    console.log(`  ${item.orderNumber} ${item.styleCode}: ${json.message}`);
  }

  const left = await findSizelessLinkedItems(prisma);
  if (failed > 0 || left.length > 0) {
    console.error(`\n${left.length} item(s) still sizeless after --apply.`);
    process.exitCode = 1;
    return;
  }
  console.log('\nDone — every linked order carries its sale order sizes.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
