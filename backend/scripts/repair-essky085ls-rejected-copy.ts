/**
 * One-off repair: remove ESSKY085LS's stranded Production CAD e9b968e1 (owner decision 2026-09-23).
 *
 * Made with "Copy to Production" from the approved planning row at 16:36 IST on 23-Sep and rejected
 * by its author 40 s later (note "Z"). Copy used to carry the planning row's PRICE (₹57/m), and a
 * costed PRODUCTION row can never be edited or deleted (validateCADModification), so nobody could
 * remove it from the page. It has no lot, no fabric and nothing references it; it only made the order
 * read "ready to cut" (fixed separately: cutting now needs an APPROVED Production CAD).
 *
 * Repair path = the SANCTIONED endpoints, driven as the admin user against the live API:
 *   1. DELETE /fabric-costing/option/:id         clears the copied costing (deleteCostingOption)
 *   2. DELETE /cad-planning/:styleId/row/:id     deletes the row + its sizes, recomputes CAD status
 *
 *   npx ts-node scripts/repair-essky085ls-rejected-copy.ts            (dry-run)
 *   npx ts-node scripts/repair-essky085ls-rejected-copy.ts --apply
 */

import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');
const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';
const SNAPSHOT = path.join(__dirname, 'repair-essky085ls-rejected-copy-snapshot.json');

const STYLE_ID = '37d6da2a-e45a-4417-b905-40315169bb33'; // ESSKY085LS
const ROW_ID = 'e9b968e1-b6f3-4fa1-aec0-22f6419012da';
const LOT_IDS = ['f84b2d63-275b-4ee7-be6a-cc5269a121f5', '166b285f-49bb-4612-a95c-803678c94b0e'];

async function api(method: string, route: string, token: string) {
  const res = await fetch(`${API}${route}`, { method, headers: { Authorization: `Bearer ${token}` } });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${route} -> HTTP ${res.status}: ${json.message || JSON.stringify(json)}`);
  return json;
}

async function main() {
  const row = await prisma.fabric_width_cad.findUnique({
    where: { id: ROW_ID },
    include: {
      sizeBreakdowns: true,
      styleFabric: { select: { style_components: { select: { styleId: true } } } },
      _count: {
        select: {
          stockAllocations: true,
          orderBomItems: true,
          order_items: true,
          order_item_costings: true,
          costingFabricItems: true,
          styleFabrics: true,
          purchaseOrders: true,
          embroideryPartCads: true,
          clonedCads: true,
          copiedTo: true,
          supersededBy: true,
        },
      },
    },
  });
  if (!row) {
    console.log('Row e9b968e1 no longer exists — nothing to do.');
    return;
  }

  // Refuse unless it is still exactly the stranded row described above
  const refs = Object.entries(row._count).filter(([, n]) => n > 0);
  const checks: Array<[string, boolean]> = [
    ['belongs to ESSKY085LS', row.styleFabric?.style_components?.styleId === STYLE_ID],
    ['is a PRODUCTION row', (row.purposeEnum ?? row.purpose) === 'PRODUCTION'],
    ['is REJECTED', row.approvalStatus === 'REJECTED'], // allow-cad-approval
    ['has no stock lot', row.fabricStockId === null],
    ['has no price approval', row.costingApprovalStatus === null],
    [`nothing references it${refs.length ? ` (found ${refs.map(([k, n]) => `${k}=${n}`).join(', ')})` : ''}`, refs.length === 0],
  ];
  for (const [label, ok] of checks) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (checks.some(([, ok]) => !ok)) throw new Error('Row is not in the expected state — refusing to touch it.');

  const orphans = await prisma.fabric_width_cad.findMany({
    where: { fabricStockId: { in: LOT_IDS }, styleFabricId: null },
    select: { id: true, approvalStatus: true },
  });
  console.log(`  Orphan Production CADs on the two lots: ${orphans.length}`);

  console.log(
    `\nWill remove ${ROW_ID} (${row.sizeBreakdowns.length} size rows, ₹${row.totalCostPerMeter ?? '—'}/m copied price).`
  );
  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to execute via the live API.');
    return;
  }

  fs.writeFileSync(SNAPSHOT, JSON.stringify({ takenAt: new Date().toISOString(), row }, null, 2));
  console.log(`Snapshot written: ${SNAPSHOT}`);

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/ so .env loads.');
  const admin =
    (await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } })) ||
    (await prisma.users.findFirst({ where: { role: 'ADMIN', isActive: true } }));
  if (!admin) throw new Error('No ADMIN user found.');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });
  console.log(`Acting as ${admin.email} (${admin.role})`);

  if (row.totalCostPerMeter !== null || row.costingStyleId !== null) {
    await api('DELETE', `/fabric-costing/option/${ROW_ID}`, token);
    console.log('  1. costing cleared');
  }
  await api('DELETE', `/cad-planning/${STYLE_ID}/row/${ROW_ID}`, token);
  console.log('  2. row deleted');

  const gone = await prisma.fabric_width_cad.findUnique({ where: { id: ROW_ID } });
  const style = await prisma.styles.findUnique({ where: { id: STYLE_ID }, select: { cadStatus: true } });
  console.log(`\n${gone ? 'STILL PRESENT' : 'Removed'}. ESSKY085LS cadStatus is now ${style?.cadStatus}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
