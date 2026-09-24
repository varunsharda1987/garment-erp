/**
 * One-off repair (owner decision 2026-09-24): bring ESSKY085LS in line with ESSKY086LS — same
 * greige, same dyer, same rates — and approve what the chain needs.
 *
 * Found tracing both styles from CAD Planning to stock:
 *   085LS  CAD 1d3da832 priced ₹57/m with NO dyeing cost (086LS's twin row: greige 49 + dyeing 10
 *          + transport 2 + 8 % shrinkage = ₹65.26); cost sheet v1 costed at 55" with no CAD link;
 *          its BOM line copied that (no CAD, 55"); its greige requirement still said PO_REQUIRED
 *          although PO2608-0056's greige was bought and sent on DJ-ESSKY085LS-002.
 *   086LS  greige lot 2726b4f2 still carries the 1,833.25 m reservation made for 086LS on 21-Sep,
 *          though that greige left on DJ-ESSKY086LS-004 minutes later (reserve never settled on
 *          issue — see memory "stock reserved semantics").
 *   both   cost sheets revoked to PENDING on 24-Sep 11:02 IST under APPROVED order BOMs.
 *
 * Sanctioned endpoints (as admin, live API) wherever one exists; direct writes only for the three
 * records no endpoint repairs (BOM-line lineage, the greige requirement, the lot reservation),
 * each checked first and snapshotted. Every step re-reads state and skips if already done.
 *
 *   npx ts-node scripts/repair-essky085-086-align.ts            (dry-run)
 *   npx ts-node scripts/repair-essky085-086-align.ts --apply
 */

import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');
const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';
const SNAPSHOT = path.join(__dirname, 'repair-essky085-086-align-snapshot.json');

const S085 = '37d6da2a-e45a-4417-b905-40315169bb33';
const S086_CODE = 'ESSKY086LS';
const CAD085 = '1d3da832-fe59-4158-8815-613b4781fe7a';
const CAD086 = '9c5f67d3-2249-471c-9b18-2c040a616be9';
const SHEET085 = 'CS-1786450557861-00ovxc2';
const SHEET086 = 'CS-1786708963491-fjvqgpg';
const REQ085_GREIGE_PREFIX = '9b6dcbbc';
const LOT_PREFIX = '2726b4f2';

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function api(method: string, route: string, token: string, body?: unknown) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${route} -> HTTP ${res.status}: ${json.message || JSON.stringify(json)}`);
  return json;
}

async function main() {
  const style086 = await prisma.styles.findFirst({ where: { styleCode: S086_CODE }, select: { id: true } });
  const [cad085, cad086, sheet085, sheet086, req, lot, bomLine085, sheet086Item] = await Promise.all([
    prisma.fabric_width_cad.findUniqueOrThrow({ where: { id: CAD085 } }),
    prisma.fabric_width_cad.findUniqueOrThrow({ where: { id: CAD086 } }),
    prisma.style_costing.findUniqueOrThrow({ where: { id: SHEET085 } }),
    prisma.style_costing.findUniqueOrThrow({ where: { id: SHEET086 } }),
    prisma.material_requirements.findFirstOrThrow({ where: { id: { startsWith: REQ085_GREIGE_PREFIX } } }),
    prisma.greige_stock.findFirstOrThrow({ where: { id: { startsWith: LOT_PREFIX } } }),
    prisma.order_bom_items.findFirstOrThrow({
      where: { usageCategory: 'FABRIC', orderBom: { styleId: S085, isActive: true } },
      include: { orderBom: { select: { id: true, orderId: true } } },
    }),
    prisma.style_costing_fabric_items.findFirstOrThrow({ where: { costingId: SHEET086 } }),
  ]);
  const issued086 = await prisma.job_work_orders.findFirstOrThrow({
    where: { jobWorkNumber: 'DJ-ESSKY086LS-004' },
    select: { qtySentMeters: true, greigeStockLotId: true, jwoStatus: true },
  });

  console.log('BEFORE');
  console.log(`  085 CAD ₹${num(cad085.totalCostPerMeter)} (greige ${num(cad085.greigeCostPerMeter)}, dyeing ${num(cad085.processingPricePerMeter)}) price=${cad085.costingApprovalStatus}`);
  console.log(`  086 CAD ₹${num(cad086.totalCostPerMeter)} (greige ${num(cad086.greigeCostPerMeter)}, dyeing ${num(cad086.processingPricePerMeter)}, shrink ${num(cad086.shrinkagePercent)}%)`);
  console.log(`  sheets: 085 ${sheet085.approvalStatus} superseded=${sheet085.supersededById ?? '-'} | 086 ${sheet086.approvalStatus}`);
  console.log(`  085 BOM line: CAD ${bomLine085.selectedCadId ?? 'none'} ${num(bomLine085.fabricWidthInches)}" "${bomLine085.componentName}" sheet ${'?'}`);
  console.log(`  085 greige requirement ${req.status} allocated ${num(req.allocatedFromStock)} shortfall ${num(req.shortfall)}`);
  console.log(`  lot ${lot.id.slice(0, 8)} available ${num(lot.quantityAvailable)} reserved ${num(lot.quantityReserved)}; 086 job sent ${num(issued086.qtySentMeters)} m from ${issued086.greigeStockLotId?.slice(0, 8)} (${issued086.jwoStatus})`);

  // Guards: refuse unless the world still looks the way the investigation found it
  if (issued086.greigeStockLotId !== lot.id) throw new Error('086 job did not draw from this lot — refusing the reservation release');
  if (req.orderId !== bomLine085.orderBom.orderId) throw new Error('requirement is not on the 085 order');

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply.');
    return;
  }

  fs.writeFileSync(
    SNAPSHOT,
    JSON.stringify({ takenAt: new Date().toISOString(), cad085, sheet085: { id: sheet085.id, approvalStatus: sheet085.approvalStatus, supersededById: sheet085.supersededById }, sheet086: { id: sheet086.id, approvalStatus: sheet086.approvalStatus }, req, lot, bomLine085 }, null, 2)
  );
  console.log(`\nSnapshot: ${SNAPSHOT}`);

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/');
  const admin = (await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } }))!;
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });
  console.log(`Acting as ${admin.email}\n`);

  // 1. 085 CAD costing = 086's rates (unapprove → save → approve, the Fabric Costing flow)
  if (num(cad085.totalCostPerMeter) !== num(cad086.totalCostPerMeter) || cad085.processingPricePerMeter === null) {
    if (cad085.costingApprovalStatus === 'APPROVED') {
      await api('PATCH', `/fabric-costing/option/${CAD085}/unapprove`, token, {
        reason: 'Align ESSKY085LS with ESSKY086LS: same greige, dyer and rates — ₹57 row had no dyeing cost',
        confirmImpact: true,
      });
      console.log('1a. 085 costing unapproved');
    }
    await api('POST', '/fabric-costing/save', token, {
      styleId: S085,
      fabricCostings: [
        {
          fabricWidthCadId: CAD085,
          greigeId: cad085.greigeId,
          greigeCostPerMeter: num(cad086.greigeCostPerMeter),
          transportCostPerMeter: num(cad086.transportCostPerMeter),
          processorId: cad086.processorId,
          rateCardId: sheet086Item.rateCardId ?? cad086.rateCardId ?? null,
          processingCostPerMeter: num(cad086.processingPricePerMeter),
          shrinkagePercent: num(cad086.shrinkagePercent),
          shrinkageCostPerMeter: num(cad086.shrinkageCostPerMeter),
          totalCostPerMeter: num(cad086.totalCostPerMeter),
          costInputMode: cad086.costInputMode ?? 'BUILD_UP',
          orderQuantityPcs: cad086.orderQuantityPcs,
          purpose: 'RAW_MATERIAL_CALCULATION',
          processingBatchGroupColorId: cad085.processingBatchGroupColorId, // 085's own colour (Black)
        },
      ],
    });
    console.log('1b. 085 costing saved at 086 rates');
  }
  const cadNow = await prisma.fabric_width_cad.findUniqueOrThrow({ where: { id: CAD085 } });
  if (cadNow.costingApprovalStatus !== 'APPROVED') {
    await api('POST', `/fabric-costing/option/${CAD085}/approve`, token, { remarks: 'Aligned with ESSKY086LS' });
    console.log('1c. 085 costing approved');
  }

  // 2. 086 cost sheet re-approved
  if (String((await prisma.style_costing.findUniqueOrThrow({ where: { id: SHEET086 } })).approvalStatus) !== 'APPROVED') {
    await api('PATCH', `/style-costing/${SHEET086}/approve`, token, { action: 'approve' });
    console.log('2. 086 cost sheet approved');
  }

  // 3. 085 cost sheet: re-approve v1, then v2 linked to the CAD at 52", approve v2
  let sheet085Now = await prisma.style_costing.findUniqueOrThrow({ where: { id: SHEET085 } });
  let v2Id = sheet085Now.supersededById;
  if (!v2Id) {
    if (String(sheet085Now.approvalStatus) !== 'APPROVED') {
      await api('PATCH', `/style-costing/${SHEET085}/approve`, token, { action: 'approve' });
      console.log('3a. 085 cost sheet v1 approved');
    }
    const ver = await api('POST', `/style-costing/${SHEET085}/create-version`, token, {
      versionReason: 'Link the fabric line to its CAD row at 52" (v1 was costed at 55" with no CAD link) — same rates as ESSKY086LS',
    });
    v2Id = ver.data?.id as string;
    if (!v2Id) throw new Error('create-version returned no id');
    console.log(`3b. 085 cost sheet v2 ${v2Id}`);
  }
  const v2 = await api('GET', `/style-costing/${v2Id}`, token);
  const fabricDetails: any[] = v2.data?.fabricDetails || [];
  const v2Item = await prisma.style_costing_fabric_items.findFirst({ where: { costingId: v2Id! } });
  if (v2Item?.fabricCADId !== CAD085 || num(v2Item?.width) !== 52) {
    if (fabricDetails.length !== 1) throw new Error(`v2 has ${fabricDetails.length} fabric lines — expected 1`);
    fabricDetails[0] = { ...fabricDetails[0], fabricWidth: 52, fabricCADId: CAD085 };
    await api('PUT', `/style-costing/${v2Id}`, token, { fabricDetails });
    console.log('3c. v2 fabric line → CAD 1d3da832 at 52"');
  }
  if (String((await prisma.style_costing.findUniqueOrThrow({ where: { id: v2Id! } })).approvalStatus) !== 'APPROVED') {
    await api('PATCH', `/style-costing/${v2Id}/approve`, token, { action: 'approve' });
    console.log('3d. v2 approved');
  }
  const v2ItemNow = await prisma.style_costing_fabric_items.findFirstOrThrow({ where: { costingId: v2Id! } });

  // 4. 085 BOM line lineage (prices already equal: ₹65.26, greige 49, dyeing 10). No MRP re-run —
  //    regenerating the BOM would cancel the dyeing requirement the finished job is linked to.
  await prisma.$transaction([
    prisma.order_bom_items.update({
      where: { id: bomLine085.id },
      data: {
        selectedCadId: CAD085,
        fabricWidthInches: 52,
        componentName: 'Top - Viscose Moss',
        rateCardId: v2ItemNow.rateCardId ?? bomLine085.rateCardId,
      },
    }),
    prisma.order_bom.update({ where: { id: bomLine085.orderBom.id }, data: { sourceCostSheetId: v2Id } }),
  ]);
  console.log('4. 085 BOM line → CAD 1d3da832, 52", "Top - Viscose Moss"; BOM source → v2');

  // 5. 085 greige requirement: met from stock (greige bought on PO2608-0056 and already sent on
  //    DJ-ESSKY085LS-002 — no reservation, the metres have left the lot)
  if (req.status !== 'FULFILLED_STOCK') {
    await prisma.material_requirements.update({
      where: { id: req.id },
      data: { allocatedFromStock: req.totalRequired, shortfall: 0, status: 'FULFILLED_STOCK' },
    });
    console.log('5. 085 greige requirement → FULFILLED_STOCK (1,833.25 m)');
  }

  // 6. Settle 086's reservation on the lot — its greige left on DJ-ESSKY086LS-004
  const lotNow = await prisma.greige_stock.findUniqueOrThrow({ where: { id: lot.id } });
  const release = Math.min(Number(lotNow.quantityReserved), Number(issued086.qtySentMeters));
  if (release > 0) {
    await prisma.greige_stock.update({ where: { id: lot.id }, data: { quantityReserved: { decrement: release } } });
    console.log(`6. lot ${lot.id.slice(0, 8)} reservation released: ${release} m`);
  }

  // 7. Production CAD per received lot, pre-filled, then approved (085: 2 lots, 086: 1 lot)
  for (const [code, styleId] of [['ESSKY085LS', S085], ['ESSKY086LS', style086!.id]] as const) {
    const lots = await prisma.fabric_stock.findMany({ where: { originStyleId: styleId, status: 'AVAILABLE' }, select: { id: true } });
    for (const l of lots) {
      let row = await prisma.fabric_width_cad.findFirst({
        where: { fabricStockId: l.id, purposeEnum: 'PRODUCTION', NOT: { approvalStatus: 'REJECTED' } },
      });
      if (!row) {
        const created = await api('POST', `/cad-planning/${styleId}/production-from-stock`, token, { fabricStockId: l.id });
        if (created.warning) console.log(`   warning: ${created.warning}`);
        row = await prisma.fabric_width_cad.findUniqueOrThrow({ where: { id: created.data.id } });
      }
      if (row.approvalStatus !== 'APPROVED') {
        await api('POST', `/cad-planning/${styleId}/row/${row.id}/approve`, token, {});
      }
      const r = await prisma.fabric_width_cad.findUniqueOrThrow({ where: { id: row.id } });
      console.log(`7. ${code} lot ${l.id.slice(0, 8)} → Production CAD ${r.id.slice(0, 8)} ${num(r.cutableWidth)}" ${r.piecesPerMarker} pcs avg ${num(r.cadAverage)} ${r.approvalStatus}`);
    }
  }
  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
