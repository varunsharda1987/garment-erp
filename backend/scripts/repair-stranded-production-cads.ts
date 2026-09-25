/**
 * One-off repair: remove three wrong CAD rows the owner asked to delete (2026-09-25).
 *
 *   dcd56333  IP00138 (STYFW-005)  PRODUCTION 52", rejected 21-Sep "worng entry"
 *   e7693adc  IP00138 (STYFW-005)  RAW MAT copy it was promoted from, rejected 25-Sep "incorrect"
 *   018933e8  LNG279  (STYSW-001)  PRODUCTION 52", rejected 21-Aug "worng entry"
 *
 * Both Production rows came from Fabric Costing → Promote to Production: a priced, isLocked row with
 * no fabric lot, which validateCADModification then refused to edit or delete ("costed PRODUCTION
 * CAD"). retire-production-costing.ts cleared their costing and lock and deleted LNG279's Production
 * cost sheet, so nothing references them now. None has a lot, a price approval or any link.
 *
 * Repair path = the SANCTIONED endpoints, driven as the admin user against the live API:
 *   1. DELETE /fabric-costing/option/:id       clears a costing still on the row (deleteCostingOption)
 *   2. DELETE /cad-planning/:styleId/row/:id   deletes the row + its sizes, recomputes CAD status
 *
 *   npx ts-node scripts/repair-stranded-production-cads.ts            (dry-run)
 *   npx ts-node scripts/repair-stranded-production-cads.ts --apply
 */

import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');
const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';
const SNAPSHOT = path.join(__dirname, 'repair-stranded-production-cads-snapshot.json');

const ROWS = [
  {
    id: 'dcd56333-6800-4b47-ac92-2510a85eba8c',
    styleId: 'f4b04058-137b-4aa0-a2fc-a03999591f95', // IP00138
    label: 'IP00138 Production 52"',
    purpose: 'PRODUCTION',
  },
  {
    id: 'e7693adc-d92b-4bf7-9cba-ab8076674d80',
    styleId: 'f4b04058-137b-4aa0-a2fc-a03999591f95', // IP00138
    label: 'IP00138 Raw Mat copy 52"',
    purpose: 'RAW_MATERIAL_CALCULATION',
  },
  {
    id: '018933e8-0d94-4d85-b6f9-ff49c031bd10',
    styleId: '83b5f7bc-5ef6-4bda-9749-9c5e92a12aed', // LNG279
    label: 'LNG279 Production 52"',
    purpose: 'PRODUCTION',
  },
];

async function api(method: string, route: string, token: string) {
  const res = await fetch(`${API}${route}`, { method, headers: { Authorization: `Bearer ${token}` } });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${route} -> HTTP ${res.status}: ${json.message || JSON.stringify(json)}`);
  return json;
}

async function loadRow(id: string) {
  return prisma.fabric_width_cad.findUnique({
    where: { id },
    include: {
      sizeBreakdowns: true,
      cadPatternParts: true,
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
}

async function main() {
  const found = [];
  let refused = false;

  for (const target of ROWS) {
    const row = await loadRow(target.id);
    if (!row) {
      console.log(`\n${target.label} (${target.id}) no longer exists — nothing to do.`);
      continue;
    }
    // material_requirements.cadId is a soft reference with no foreign key
    const mrRefs = await prisma.material_requirements.count({ where: { cadId: target.id } });
    const refs = Object.entries(row._count).filter(([, n]) => n > 0);
    const checks: Array<[string, boolean]> = [
      ['belongs to the style', row.styleFabric?.style_components?.styleId === target.styleId],
      [`is a ${target.purpose} row`, (row.purposeEnum ?? row.purpose) === target.purpose],
      ['is REJECTED', row.approvalStatus === 'REJECTED'], // allow-cad-approval
      ['has no fabric lot', row.fabricStockId === null],
      ['has no price approval', row.costingApprovalStatus === null],
      ['is not locked', row.isLocked === false],
      [
        `nothing references it${refs.length ? ` (found ${refs.map(([k, n]) => `${k}=${n}`).join(', ')})` : ''}`,
        refs.length === 0,
      ],
      [`no material requirement points at it${mrRefs ? ` (found ${mrRefs})` : ''}`, mrRefs === 0],
    ];
    console.log(`\n${target.label} (${target.id})`);
    for (const [label, ok] of checks) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
    if (checks.some(([, ok]) => !ok)) {
      refused = true;
      continue;
    }
    console.log(
      `  will remove: ${row.sizeBreakdowns.length} size row(s), ${row.cadPatternParts.length} part(s), ` +
        `price ${row.totalCostPerMeter ?? '—'}/m`
    );
    found.push({ target, row });
  }

  if (refused) throw new Error('A row is not in the expected state — refusing to touch any of them.');
  if (found.length === 0) return;
  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to execute via the live API.');
    return;
  }

  fs.writeFileSync(
    SNAPSHOT,
    JSON.stringify({ takenAt: new Date().toISOString(), rows: found.map((f) => f.row) }, null, 2)
  );
  console.log(`\nSnapshot written: ${SNAPSHOT}`);

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/ so .env loads.');
  const admin =
    (await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } })) ||
    (await prisma.users.findFirst({ where: { role: 'ADMIN', isActive: true } }));
  if (!admin) throw new Error('No ADMIN user found.');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });
  console.log(`Acting as ${admin.email} (${admin.role})`);

  for (const { target, row } of found) {
    if (row.totalCostPerMeter !== null || row.costingStyleId !== null) {
      await api('DELETE', `/fabric-costing/option/${target.id}`, token);
      console.log(`  ${target.label}: costing cleared`);
    }
    await api('DELETE', `/cad-planning/${target.styleId}/row/${target.id}`, token);
    const gone = !(await prisma.fabric_width_cad.findUnique({ where: { id: target.id } }));
    console.log(`  ${target.label}: ${gone ? 'removed' : 'STILL PRESENT'}`);
  }

  const styles = await prisma.styles.findMany({
    where: { id: { in: [...new Set(ROWS.map((r) => r.styleId))] } },
    select: { styleCode: true, buyerStyleRef: true, cadStatus: true },
  });
  for (const s of styles) console.log(`${s.styleCode} (${s.buyerStyleRef}) cadStatus is now ${s.cadStatus}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
