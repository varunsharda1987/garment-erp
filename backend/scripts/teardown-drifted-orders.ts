/**
 * One-off teardown: drifted-cost-sheet orders (2026-08-25).
 *
 * Decision (user, 2026-08-25): for the drifted styles found by
 * check-costsheet-drift.ts — ESSKY082LS, ESSKY083LS, ESSKY089LS — HARD DELETE
 * their same-day mistaken orders (BOMs + requirements erased with them), then
 * revoke the cost sheets back to PENDING so the team can redo them cleanly.
 * STYEW-001 has no order/BOM and its sheet is already PENDING (no-op entry).
 * ESSKY091LS is EXCLUDED — repaired earlier the other way (sheet v2 @92.35).
 *
 * Verified before planning: zero POs / requirement_po_links / work orders /
 * JWOs / GRNs / delivery notes / invoices / payments / ASN / fabric+lace
 * allocations / sale-order links on all three orders; all orders PENDING.
 * Preflight below re-checks the blocking edges at run time.
 *
 * All mutations go through the sanctioned ADMIN endpoints:
 *   GET  /orders/:id/can-delete   → DELETE /orders/:id/hard-delete
 *   PATCH /style-costing/:id/approve { action: 'revoke' }
 *
 *   npx ts-node scripts/teardown-drifted-orders.ts            (dry-run)
 *   npx ts-node scripts/teardown-drifted-orders.ts --apply
 */

import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');
const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';

interface Target {
  styleCode: string;
  costSheetId: string;
  /** null = nothing to delete (sheet-only entry) */
  orderId: string | null;
  orderNumber: string | null;
  /** revoke only sheets that are currently APPROVED */
  revokeSheet: boolean;
}

const TARGETS: Target[] = [
  {
    styleCode: 'ESSKY082LS',
    costSheetId: 'CS-1787204450830-hm6wegk',
    orderId: '5901fa06-68fe-4a9a-91ce-38749237ed8c',
    orderNumber: 'ORD2026080023',
    revokeSheet: true,
  },
  {
    styleCode: 'ESSKY083LS',
    costSheetId: 'CS-1787571375436-tasw82m',
    orderId: '1d72c1f5-f556-4f8e-aadf-20701350fa5b',
    orderNumber: 'ORD2026080024',
    revokeSheet: true,
  },
  {
    styleCode: 'ESSKY089LS',
    costSheetId: 'CS-1787572023634-ujbktn4',
    orderId: 'e5607651-f4c6-4042-ae6c-89168b834359',
    orderNumber: 'ORD2026080028',
    revokeSheet: true,
  },
  {
    styleCode: 'STYEW-001',
    costSheetId: 'CS-1787201065404-j5whprg',
    orderId: null,
    orderNumber: null,
    revokeSheet: false, // already PENDING — verified, logged as no-op
  },
];

async function api(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${json.message || JSON.stringify(json)}`);
  }
  return json;
}

/** Run-time re-check of everything that must be zero/true before a hard delete. */
async function preflight(t: Target): Promise<{ ok: boolean; lines: string[] }> {
  const lines: string[] = [];
  if (!t.orderId) return { ok: true, lines: ['   no order — nothing to delete'] };

  const [order, bomCount, bomItemCount, reqCount, poLinks, fabricAlloc, laceAlloc, laceIssues, pos] =
    await Promise.all([
      prisma.orders.findUnique({ where: { id: t.orderId }, select: { orderNumber: true, status: true } }),
      prisma.order_bom.count({ where: { orderId: t.orderId } }),
      prisma.order_bom_items.count({ where: { orderBom: { orderId: t.orderId } } }),
      prisma.material_requirements.count({ where: { orderId: t.orderId } }),
      prisma.requirement_po_links.count({ where: { material_requirements: { orderId: t.orderId } } }),
      prisma.fabric_stock_allocation.count({ where: { orderId: t.orderId } }),
      prisma.lace_stock_allocation.count({ where: { orderId: t.orderId } }),
      prisma.lace_issue_note.count({ where: { orderId: t.orderId } }),
      prisma.purchase_orders.count({ where: { orderId: t.orderId } }),
    ]);

  if (!order) return { ok: false, lines: [`   ORDER NOT FOUND (${t.orderId}) — already deleted?`] };
  if (order.orderNumber !== t.orderNumber) {
    return { ok: false, lines: [`   order number mismatch: expected ${t.orderNumber}, got ${order.orderNumber} — ABORT`] };
  }

  lines.push(`   order ${order.orderNumber}  status=${order.status}`);
  lines.push(`   will erase: ${bomCount} BOM(s), ${bomItemCount} BOM item(s), ${reqCount} requirement(s)`);

  const blockers: string[] = [];
  if (!['PENDING', 'CANCELLED'].includes(String(order.status))) blockers.push(`order status ${order.status}`);
  if (poLinks > 0) blockers.push(`${poLinks} requirement→PO link(s)`);
  if (pos > 0) blockers.push(`${pos} purchase order(s)`);
  if (fabricAlloc > 0) blockers.push(`${fabricAlloc} fabric stock allocation(s)`);
  if (laceAlloc > 0) blockers.push(`${laceAlloc} lace stock allocation(s)`);
  if (laceIssues > 0) blockers.push(`${laceIssues} lace issue note(s)`);
  if (blockers.length > 0) {
    lines.push(`   BLOCKED: ${blockers.join(', ')}`);
    return { ok: false, lines };
  }
  return { ok: true, lines };
}

async function main() {
  console.log(`Teardown of drifted-cost-sheet orders ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);

  // Preflight everything first — apply nothing unless requested
  const flights = new Map<string, boolean>();
  for (const t of TARGETS) {
    const sheet = await prisma.style_costing.findUnique({
      where: { id: t.costSheetId },
      select: { approvalStatus: true, supersededById: true },
    });
    console.log(`${t.styleCode}`);
    if (!sheet) {
      console.log(`   COST SHEET ${t.costSheetId} NOT FOUND — skipping style`);
      flights.set(t.styleCode, false);
      continue;
    }
    console.log(`   sheet ${t.costSheetId}  status=${sheet.approvalStatus}${sheet.supersededById ? ' (superseded!)' : ''}`);
    const { ok, lines } = await preflight(t);
    lines.forEach((l) => console.log(l));
    if (t.revokeSheet) console.log(`   plan: hard-delete order, then revoke sheet -> PENDING`);
    else if (t.orderId) console.log(`   plan: hard-delete order (sheet untouched)`);
    else console.log(`   plan: nothing to change (sheet already ${sheet.approvalStatus})`);
    flights.set(t.styleCode, ok);
    console.log('');
  }

  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to execute.');
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/.');
  const admin =
    (await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } })) ||
    (await prisma.users.findFirst({ where: { role: 'ADMIN', isActive: true } }));
  if (!admin) throw new Error('No ADMIN user found.');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });
  console.log(`Acting as ${admin.email} (${admin.role})\n`);

  let failures = 0;
  for (const t of TARGETS) {
    console.log(`${t.styleCode}:`);
    if (!flights.get(t.styleCode)) {
      console.log('   skipped (preflight failed)');
      failures += 1;
      continue;
    }
    try {
      if (t.orderId) {
        const check: any = await api('GET', `/orders/${t.orderId}/can-delete`, token);
        const canDelete = check.canDelete ?? check.data?.canDelete;
        if (!canDelete) {
          throw new Error(`can-delete says no: ${check.reason ?? check.data?.reason ?? 'no reason given'}`);
        }
        await api('DELETE', `/orders/${t.orderId}/hard-delete`, token);

        const [orderAfter, bomAfter, reqAfter] = await Promise.all([
          prisma.orders.findUnique({ where: { id: t.orderId }, select: { id: true } }),
          prisma.order_bom.count({ where: { orderId: t.orderId } }),
          prisma.material_requirements.count({ where: { orderId: t.orderId } }),
        ]);
        if (orderAfter || bomAfter > 0 || reqAfter > 0) {
          throw new Error(`post-verify failed: order=${!!orderAfter} boms=${bomAfter} reqs=${reqAfter}`);
        }
        console.log(`   ${t.orderNumber} hard-deleted (order + BOM + requirements gone)`);
      }

      if (t.revokeSheet) {
        await api('PATCH', `/style-costing/${t.costSheetId}/approve`, token, { action: 'revoke' });
        const after = await prisma.style_costing.findUnique({
          where: { id: t.costSheetId },
          select: { approvalStatus: true, isApproved: true },
        });
        if (String(after?.approvalStatus) !== 'PENDING' || after?.isApproved) {
          throw new Error(`revoke post-verify failed: status=${after?.approvalStatus} isApproved=${after?.isApproved}`);
        }
        console.log(`   sheet ${t.costSheetId} revoked -> PENDING`);
      } else {
        console.log('   sheet untouched (already PENDING / no revoke planned)');
      }
    } catch (e: any) {
      failures += 1;
      console.log(`   FAILED: ${e.message}`);
    }
  }

  console.log(
    failures === 0
      ? '\nDone. Note: check-costsheet-drift.ts will now report these sheets under D2 (drift on PENDING sheets) until the team redoes them — expected.'
      : `\nDone with ${failures} failure(s) — see above.`
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
