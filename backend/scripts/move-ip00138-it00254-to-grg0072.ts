/**
 * One-off (owner decision 2026-09-26): IP00138 and IT00254 are made from the NEW Cotton Flex quality,
 * greige GRG-0072 (ordered on PO2609-0004 at ₹67), not GRG-0049 (last bought 25-Jan at ₹58.5) which
 * their three Raw Mat CAD rows pointed at — why Fabric Costing showed "live ₹58.5" and a merchandiser
 * typed ₹65 by hand.
 *
 *   d53ad051  IP00138  Pants 52" (dyed, Aryan Dyeing)
 *   20c3dd0f  IT00254  Top 50"  (printed, Shree Bhavya)
 *   4a5d0131  IT00254  Top 52"  (printed, Shree Bhavya)
 *
 * Per row, through the sanctioned endpoints as the admin (CAD geometry is untouched):
 *   1. PATCH /fabric-costing/option/:id/unapprove   price approval off (confirming the pending cost-sheet
 *                                                   impact — the team refreshes those sheets afterwards)
 *   2. POST  /cad-planning/:styleId/row/:id/reject  CAD approval off (a greige change needs it)
 *   3. PUT   /cad-planning/:styleId/row/:id         greigeId → GRG-0072
 *   4. POST  /cad-planning/:styleId/row/:id/approve the unchanged marker approved again
 * Re-costing at the live rate is then done on the Fabric Costing page itself; the price stays Pending
 * for the merchandiser to approve.
 *
 *   npx ts-node scripts/move-ip00138-it00254-to-grg0072.ts            (dry-run)
 *   npx ts-node scripts/move-ip00138-it00254-to-grg0072.ts --apply
 */

import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');
const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';
const SNAPSHOT = path.join(__dirname, 'move-ip00138-it00254-to-grg0072-snapshot.json');

const GRG_0049 = '85c74fbc-e142-43a4-b0c0-8580a94e9462';
const GRG_0072 = 'b0273f35-4af6-44f1-be17-a3c65477fca6';
const ROWS = [
  { id: 'd53ad051-afc8-4728-a7d9-022007c14f51', styleId: 'f4b04058-137b-4aa0-a2fc-a03999591f95', label: 'IP00138 Pants 52"' },
  { id: '20c3dd0f-9de7-428f-9c25-79a933b5af62', styleId: '86cfc22c-193c-4f66-aff3-7b4e8403d853', label: 'IT00254 Top 50"' },
  { id: '4a5d0131-e03d-4e65-b127-b11ccfbd2790', styleId: '86cfc22c-193c-4f66-aff3-7b4e8403d853', label: 'IT00254 Top 52"' },
];

async function api(method: string, route: string, token: string, body?: unknown) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}
async function must(method: string, route: string, token: string, body?: unknown) {
  const r = await api(method, route, token, body);
  if (!r.ok) throw new Error(`${method} ${route} -> HTTP ${r.status}: ${r.json.message || JSON.stringify(r.json)}`);
  return r.json;
}

async function main() {
  const rows = await prisma.fabric_width_cad.findMany({ where: { id: { in: ROWS.map((r) => r.id) } } });
  for (const t of ROWS) {
    const r = rows.find((x) => x.id === t.id);
    if (!r) throw new Error(`${t.label}: row not found`);
    console.log(
      `${t.label}: greige ${r.greigeId === GRG_0049 ? 'GRG-0049' : r.greigeId === GRG_0072 ? 'GRG-0072' : r.greigeId}, ` +
        `CAD ${r.approvalStatus}, price ${r.costingApprovalStatus ?? '-'}, greige ₹${r.greigeCostPerMeter ?? '—'}, total ₹${r.totalCostPerMeter ?? '—'}`
    );
  }
  const todo = ROWS.filter((t) => rows.find((x) => x.id === t.id)!.greigeId === GRG_0049);
  if (todo.length === 0) {
    // Width restore: put back any marker width the switch changed, from the snapshot of run 1
    const snap = fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) : null;
    const moved = ROWS.flatMap((t) => {
      const before = snap?.rows?.find((x: { id: string }) => x.id === t.id);
      const now = rows.find((x) => x.id === t.id)!;
      return before && Number(before.cutableWidth) !== Number(now.cutableWidth)
        ? [{ t, from: Number(now.cutableWidth), to: Number(before.cutableWidth) }]
        : [];
    });
    if (moved.length === 0) {
      await relinkRateCards(rows);
      return;
    }
    for (const m of moved) console.log(`  ${m.t.label}: width ${m.from}" → restore ${m.to}"`);
    if (!APPLY) {
      console.log('\nDry run. Re-run with --apply to restore the width(s).');
      return;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/ so .env loads.');
    const admin = await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } });
    if (!admin) throw new Error('admin@kasya.in not found');
    const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });
    const note = 'Width restored after the greige change to GRG-0072 reset it, 26-Sep-2026';
    for (const m of moved) {
      await must('POST', `/cad-planning/${m.t.styleId}/row/${m.t.id}/reject`, token, { rejectionNotes: note });
      await must('PUT', `/cad-planning/${m.t.styleId}/row/${m.t.id}`, token, { cutableWidth: m.to });
      await must('POST', `/cad-planning/${m.t.styleId}/row/${m.t.id}/approve`, token, { approvalNotes: note });
      const after = await prisma.fabric_width_cad.findUniqueOrThrow({ where: { id: m.t.id } });
      console.log(
        `  ${m.t.label}: width ${Number(after.cutableWidth)}", CAD ${after.approvalStatus}, avg ${Number(after.cadAverage)}`
      );
    }
    return;
  }
  if (!APPLY) {
    console.log(`\nDry run: ${todo.length} row(s) would move to GRG-0072. Re-run with --apply.`);
    return;
  }

  fs.writeFileSync(SNAPSHOT, JSON.stringify({ takenAt: new Date().toISOString(), rows }, null, 2));
  console.log(`\nSnapshot written: ${SNAPSHOT}`);
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/ so .env loads.');
  const admin = await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } });
  if (!admin) throw new Error('admin@kasya.in not found');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });
  const note = 'Greige changed to GRG-0072 (new Cotton Flex quality, PO2609-0004) per owner, 26-Sep-2026';

  for (const t of todo) {
    const r = rows.find((x) => x.id === t.id)!;
    if (r.costingApprovalStatus === 'APPROVED' || r.costingApprovalStatus === 'ALTERNATE_APPROVED') {
      let un = await api('PATCH', `/fabric-costing/option/${t.id}/unapprove`, token, { reason: note });
      if (un.status === 409) {
        console.log(`  ${t.label}: in use — ${un.json.message}. Confirming (the team refreshes the pending cost sheet).`);
        un = await api('PATCH', `/fabric-costing/option/${t.id}/unapprove`, token, { reason: note, confirmImpact: true });
      }
      if (!un.ok) throw new Error(`${t.label}: unapprove -> HTTP ${un.status}: ${un.json.message}`);
    }
    if (r.approvalStatus === 'APPROVED') {
      // allow-cad-approval — the CAD-side approval a greige change must lift
      await must('POST', `/cad-planning/${t.styleId}/row/${t.id}/reject`, token, { rejectionNotes: note });
    }
    // Send the marker's own width: a greige change with NO width takes the new greige's default
    // (by design on the CAD page). The first --apply missed this and moved IT00254 Top 50" to 52".
    await must('PUT', `/cad-planning/${t.styleId}/row/${t.id}`, token, {
      greigeId: GRG_0072,
      cutableWidth: Number(r.cutableWidth),
    });
    await must('POST', `/cad-planning/${t.styleId}/row/${t.id}/approve`, token, { approvalNotes: note });
    const after = await prisma.fabric_width_cad.findUniqueOrThrow({ where: { id: t.id } });
    console.log(
      `  ${t.label}: greige ${after.greigeId === GRG_0072 ? 'GRG-0072' : after.greigeId}, CAD ${after.approvalStatus}, ` +
        `price ${after.costingApprovalStatus ?? 'Pending'}, width ${Number(after.cutableWidth)}", avg ${Number(after.cadAverage)}`
    );
  }
}

/**
 * After the page re-costed the rows at ₹67 it kept each row's SAVED processing rate card — GRG-0049's
 * (same ₹10 / ₹20, 5 %) — because the page restores a saved card rather than looking one up again.
 * The card is what carries shrinkage down the chain, so point each row at GRG-0072's card: look it up
 * as the page does (/fabric-costing/lookup-rate) and re-save the row with every other field unchanged.
 */
async function relinkRateCards(rows: Awaited<ReturnType<typeof prisma.fabric_width_cad.findMany>>) {
  const withCards = await prisma.fabric_width_cad.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: { rateCard: { select: { greigeId: true, printingType: true, processingType: true } } },
  });
  const stale = withCards.filter((r) => r.greigeId === GRG_0072 && r.rateCard && r.rateCard.greigeId !== GRG_0072);
  if (stale.length === 0) {
    console.log('\nAll three are on GRG-0072 at their own widths, priced from GRG-0072 rate cards — nothing to do.');
    return;
  }
  console.log(`\n${stale.length} row(s) still carry a GRG-0049 processing rate card.`);
  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to re-link them to GRG-0072\'s cards.');
    return;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/ so .env loads.');
  const admin = await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } });
  if (!admin) throw new Error('admin@kasya.in not found');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });
  const num = (v: unknown) => (v == null ? null : Number(v));

  for (const r of stale) {
    const label = ROWS.find((t) => t.id === r.id)!.label;
    const look = await must('POST', '/fabric-costing/lookup-rate', token, {
      processorId: r.processorId,
      processingType: r.rateCard!.processingType,
      ...(r.rateCard!.printingType ? { printingType: r.rateCard!.printingType } : {}),
      greigeId: GRG_0072,
      quantityMeters: Number(r.costedAtQuantityMeters),
    });
    const card = look.data;
    const newCardId: string = card.rateCardId ?? card.id;
    if (Number(card.ratePerMeter ?? card.rate) !== Number(r.processingPricePerMeter)) {
      throw new Error(`${label}: GRG-0072 card rate ₹${card.ratePerMeter ?? card.rate} ≠ saved ₹${r.processingPricePerMeter}`);
    }
    await must('POST', '/fabric-costing/save', token, {
      styleId: r.costingStyleId,
      fabricCostings: [
        {
          fabricWidthCadId: r.id,
          styleFabricId: r.styleFabricId,
          fabricId: r.fabricId,
          greigeId: r.greigeId,
          greigeCostPerMeter: num(r.greigeCostPerMeter),
          transportCostPerMeter: num(r.transportCostPerMeter),
          processorId: r.processorId,
          rateCardId: newCardId,
          processingCostPerMeter: num(r.processingPricePerMeter),
          shrinkagePercent: num(r.shrinkagePercent),
          shrinkageCostPerMeter: num(r.shrinkageCostPerMeter),
          screenCostPerMeter: num(r.screenCostPerMeter),
          screenType: r.screenType,
          numberOfColors: r.numberOfColors,
          totalCostPerMeter: num(r.totalCostPerMeter),
          costInputMode: r.costInputMode,
          orderQuantityPcs: r.orderQuantityPcs,
          costedAtQuantityMeters: num(r.costedAtQuantityMeters),
          costedRateIsBatch: r.costedRateIsBatch,
          purpose: r.purposeEnum ?? r.purpose,
          processingBatchGroupColorId: r.processingBatchGroupColorId,
        },
      ],
    });
    const after = await prisma.fabric_width_cad.findUniqueOrThrow({
      where: { id: r.id },
      include: { rateCard: { select: { greigeId: true } } },
    });
    console.log(
      `  ${label}: rate card ${after.rateCardId?.slice(0, 8)} (${after.rateCard?.greigeId === GRG_0072 ? 'GRG-0072' : after.rateCard?.greigeId}), ` +
        `greige ₹${after.greigeCostPerMeter} ${after.greigeRateSource} ${after.greigeRateSourceRef ?? ''}, total ₹${after.totalCostPerMeter}, ` +
        `price ${after.costingApprovalStatus ?? 'Pending'}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
