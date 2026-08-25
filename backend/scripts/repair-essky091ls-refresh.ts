/**
 * One-off repair: ESSKY091LS cost sheet drift (2026-08-25).
 *
 * Decision (user, 2026-08-25): the re-priced costing is CORRECT (92.35/m =
 * greige 53 + processing 28 + shrinkage + transport); the APPROVED cost sheet
 * CS-1787573178242-lntimvq still says 93.29/m (greige 50.4 + processing 32),
 * and order ORD2026080030's APPROVED BOM + PO_REQUIRED requirement froze the
 * same stale rate.
 *
 * Repair path = the SANCTIONED endpoints (versioned + audited, all server-side
 * math), driven as the admin user against the live API:
 *   1. POST /style-costing/:v1/create-version          (v1 kept for audit)
 *   2. PUT  /style-costing/:v2  { fabricDetails }       (rate → current CAD;
 *      the update rebuilds relational fabric items from the live CAD row and
 *      recomputes every total server-side)
 *   3. PATCH /style-costing/:v2/approve
 *   4. POST /orders/:orderId/bom { styleId, costSheetId: v2 }   (BOM v+1;
 *      cancels open requirements of the superseded BOM)
 *   5. POST /orders/:orderId/bom/approve-and-calculate          (re-prices
 *      requirements BEFORE any PO is generated)
 *
 *   npx ts-node scripts/repair-essky091ls-refresh.ts            (dry-run)
 *   npx ts-node scripts/repair-essky091ls-refresh.ts --apply
 */

import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';
import { computeCostSheetSourceDrift } from '../src/services/helpers/cad-costing-provenance.helper';

const APPLY = process.argv.includes('--apply');
const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';

const SHEET_V1 = 'CS-1787573178242-lntimvq';
const STYLE_ID = '4914333e-184b-4255-a412-3f08cd4c836c'; // ESSKY091LS
const CAD_ID = 'bc636c7c-048b-4392-9653-fe134f380995'; // Top / 52"
const ORDER_NUMBER = 'ORD2026080030';

const round2 = (n: number) => Math.round(n * 100) / 100;

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

async function main() {
  // --- Current state ---------------------------------------------------------
  const [sheet, cad, order] = await Promise.all([
    prisma.style_costing.findUnique({
      where: { id: SHEET_V1 },
      select: { id: true, version: true, approvalStatus: true, supersededById: true, fabricTotal: true, totalCostPerPiece: true },
    }),
    prisma.fabric_width_cad.findUnique({
      where: { id: CAD_ID },
      select: {
        totalCostPerMeter: true,
        greigeCostPerMeter: true,
        processingPricePerMeter: true,
        cadAverage: true,
        costingApprovalStatus: true,
      },
    }),
    prisma.orders.findFirst({ where: { orderNumber: ORDER_NUMBER }, select: { id: true, orderNumber: true } }),
  ]);

  if (!sheet || !cad || !order) {
    throw new Error(`Missing fixture: sheet=${!!sheet} cad=${!!cad} order=${!!order}`);
  }
  if (sheet.supersededById) {
    throw new Error(`${SHEET_V1} is already superseded by ${sheet.supersededById} — repair looks done. Aborting.`);
  }
  if (String(sheet.approvalStatus) !== 'APPROVED') {
    throw new Error(`${SHEET_V1} is ${sheet.approvalStatus}, expected APPROVED. Aborting.`);
  }
  if (cad.totalCostPerMeter === null || !['APPROVED', 'ALTERNATE_APPROVED'].includes(String(cad.costingApprovalStatus))) {
    throw new Error(`CAD ${CAD_ID} is not a price-approved costing (status=${cad.costingApprovalStatus}). Aborting.`);
  }

  const newRate = Number(cad.totalCostPerMeter);
  const requirements = await prisma.material_requirements.findMany({
    where: { orderId: order.id },
    select: { requirementNumber: true, status: true, unitPrice: true, requirementType: true },
  });

  console.log(`Sheet ${sheet.id} (v${sheet.version}, ${sheet.approvalStatus})  fabricTotal=${sheet.fabricTotal}  total/pc=${sheet.totalCostPerPiece}`);
  console.log(`CAD ${CAD_ID}: ${newRate}/m (greige ${cad.greigeCostPerMeter} + processing ${cad.processingPricePerMeter}), avg ${cad.cadAverage} m/pc, ${cad.costingApprovalStatus}`);
  console.log(`Order ${order.orderNumber} (${order.id}) — ${requirements.length} requirement(s):`);
  for (const r of requirements) {
    console.log(`   ${r.requirementNumber}  ${r.requirementType}  ${r.status}  unitPrice=${r.unitPrice}`);
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to execute the 5-step repair via the live API.');
    return;
  }

  // --- Auth ------------------------------------------------------------------
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/ so .env loads.');
  const admin =
    (await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } })) ||
    (await prisma.users.findFirst({ where: { role: 'ADMIN', isActive: true } }));
  if (!admin) throw new Error('No ADMIN user found.');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });
  console.log(`\nActing as ${admin.email} (${admin.role})`);

  // --- 1. New cost sheet version --------------------------------------------
  const versionRes = await api('POST', `/style-costing/${SHEET_V1}/create-version`, token, {
    versionReason:
      'Fabric costing re-priced 93.29 -> 92.35/m (greige 53 + processing 28) — refreshing sheet from the current approved costing (ESSKY091LS drift repair)',
  });
  const v2Id: string = versionRes.data?.id;
  if (!v2Id) throw new Error(`create-version returned no id: ${JSON.stringify(versionRes).slice(0, 400)}`);
  console.log(`1. Created version: ${v2Id}`);

  // --- 2. Re-rate fabricDetails; server rebuilds items + totals ---------------
  const v2 = await api('GET', `/style-costing/${v2Id}`, token);
  const fabricDetails: any[] = v2.data?.fabricDetails || [];
  if (fabricDetails.length === 0) throw new Error('v2 has no fabricDetails — aborting before PUT.');
  for (const fd of fabricDetails) {
    fd.fabricRate = newRate;
    fd.fabricTotal = round2((fd.fabricAverage || 0) * newRate);
  }
  await api('PUT', `/style-costing/${v2Id}`, token, { fabricDetails });
  console.log(`2. Re-rated ${fabricDetails.length} fabric line(s) at ${newRate}/m`);

  // --- 3. Approve v2 ----------------------------------------------------------
  await api('PATCH', `/style-costing/${v2Id}/approve`, token, { action: 'approve' });
  console.log('3. v2 approved');

  // --- 4. Regenerate order BOM from v2 ---------------------------------------
  const bomRes = await api('POST', `/orders/${order.id}/bom`, token, {
    styleId: STYLE_ID,
    costSheetId: v2Id,
  });
  console.log(`4. Order BOM regenerated (v${bomRes.data?.version ?? '?'})`);

  // --- 5. Approve BOM + recalculate MRP --------------------------------------
  await api('POST', `/orders/${order.id}/bom/approve-and-calculate`, token, {
    styleId: STYLE_ID,
    calculateMRP: true,
  });
  console.log('5. BOM approved + MRP recalculated');

  // --- Post-verify ------------------------------------------------------------
  const bomItems = await prisma.order_bom_items.findMany({
    where: { selectedCadId: CAD_ID, orderBom: { orderId: order.id, isActive: true } },
    select: { unitPrice: true, greigeCost: true, processingCost: true, orderBom: { select: { version: true, status: true } } },
  });
  for (const item of bomItems) {
    console.log(
      `   BOM v${item.orderBom.version} (${item.orderBom.status}): unitPrice=${item.unitPrice} greige=${item.greigeCost} processing=${item.processingCost}`
    );
  }
  const reqAfter = await prisma.material_requirements.findMany({
    where: { orderId: order.id },
    select: { requirementNumber: true, status: true, unitPrice: true, requirementType: true },
  });
  for (const r of reqAfter) {
    console.log(`   REQ ${r.requirementNumber}  ${r.requirementType}  ${r.status}  unitPrice=${r.unitPrice}`);
  }
  const drift = await computeCostSheetSourceDrift(v2Id);
  console.log(`   v2 drift after repair: hasDrift=${drift.hasDrift} (checked ${drift.summary.itemsChecked})`);
  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
