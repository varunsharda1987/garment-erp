/**
 * One-off (owner decision 2026-09-26): give greige GRG-0072 the processing rates GRG-0049 has at the
 * two processors IP00138 / IT00254 use, so the styles can be re-costed on the new quality.
 *
 *   Aryan Dyeing          DYEING            every slab ₹10/m, shrinkage 5 %
 *   Shree Bhavya Fabrics  PRINTING PIGMENT  ₹20/m, shrinkage 5 %   (PROCIAN ₹28 is NOT copied — not asked)
 *
 * Driven through the Processor Rate Card screen's own endpoints, as the admin:
 *   1. POST /processor-rate-cards/v2/processors/:id/greiges/:greigeId   adds the row (₹0 per slab)
 *   2. PUT  /processor-rate-cards/v2/processors/:id/matrix              sets GRG-0072's cells + shrinkage
 *   3. POST /processor-rate-cards/v2/lookup                             proves a rate resolves
 *
 * DANGER handled here: the matrix save DELETES every existing slab the request does not list (and the
 * rate cards on it, for every greige). So the request carries the processor's FULL slab list exactly
 * as stored, and rates ONLY for GRG-0072 — no other greige's cells are sent or touched.
 *
 *   npx ts-node scripts/copy-greige-rate-cards-grg0072.ts            (dry-run)
 *   npx ts-node scripts/copy-greige-rate-cards-grg0072.ts --apply
 */

import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');
const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';

const FROM_GREIGE = '85c74fbc-e142-43a4-b0c0-8580a94e9462'; // GRG-0049
const TO_GREIGE = 'b0273f35-4af6-44f1-be17-a3c65477fca6'; // GRG-0072

const COPIES = [
  { label: 'Aryan Dyeing DYEING', processorId: 'a15c11b6-1fe2-4d5c-8d18-4b52bd2b544b', processingType: 'DYEING' as const, printingType: null, lookupQty: 1000 },
  { label: 'Shree Bhavya PRINTING PIGMENT', processorId: 'c1535c75-4b57-494a-966a-1e8f48467f81', processingType: 'PRINTING' as const, printingType: 'PIGMENT' as const, lookupQty: 2000 },
];

async function api(method: string, route: string, token: string, body?: unknown) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${route} -> HTTP ${res.status}: ${json.message || JSON.stringify(json)}`);
  return json;
}

async function main() {
  const plans = [];
  for (const c of COPIES) {
    const where = {
      processorId: c.processorId,
      processingType: c.processingType,
      printingType: c.printingType,
      laceId: null,
      effectiveTo: null,
    };
    const source = await prisma.processor_rate_card.findMany({ where: { ...where, greigeId: FROM_GREIGE } });
    const already = await prisma.processor_rate_card.findMany({ where: { ...where, greigeId: TO_GREIGE } });
    const slabs = await prisma.processor_quantity_slabs.findMany({
      where: { processorId: c.processorId, processingType: c.processingType },
      orderBy: { slabOrder: 'asc' },
    });
    console.log(`\n${c.label}: ${slabs.length} slab(s); GRG-0049 has ${source.length} active card(s); GRG-0072 has ${already.length}`);
    for (const s of source) {
      const slab = slabs.find((x) => x.id === s.slabId);
      console.log(`  slab ${slab?.minQuantity}-${slab?.maxQuantity} m: ₹${Number(s.ratePerMeter)}  shrinkage ${s.shrinkagePercent ?? '—'} %`);
    }
    if (already.some((a) => Number(a.ratePerMeter) > 0)) {
      console.log('  GRG-0072 already priced here — skipping.');
      continue;
    }
    if (source.length === 0) throw new Error(`${c.label}: GRG-0049 has no active cards to copy`);
    plans.push({ c, source, slabs });
  }
  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to create the GRG-0072 cards through the rate-card endpoints.');
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/ so .env loads.');
  const admin = await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } });
  if (!admin) throw new Error('admin@kasya.in not found');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });
  const base = '/processor-rate-cards/v2';

  for (const { c, source, slabs } of plans) {
    const typeBody = { processingType: c.processingType, ...(c.printingType ? { printingType: c.printingType } : {}) };
    await api('POST', `${base}/processors/${c.processorId}/greiges/${TO_GREIGE}`, token, typeBody);
    await api('PUT', `${base}/processors/${c.processorId}/matrix`, token, {
      ...typeBody,
      // EVERY stored slab, unchanged — a slab missing here would be deleted with all its rate cards
      slabs: slabs.map((s) => ({
        id: s.id,
        slabOrder: s.slabOrder,
        minQuantity: Number(s.minQuantity),
        maxQuantity: s.maxQuantity == null ? null : Number(s.maxQuantity),
        ...(s.slabLabel ? { slabLabel: s.slabLabel } : {}),
      })),
      rates: source.map((s) => ({ greigeId: TO_GREIGE, slabId: s.slabId, ratePerMeter: Number(s.ratePerMeter) })),
      shrinkages: [{ greigeId: TO_GREIGE, shrinkagePercent: source[0].shrinkagePercent == null ? null : Number(source[0].shrinkagePercent) }],
    });
    const look = await api('POST', `${base}/lookup`, token, {
      processorId: c.processorId,
      ...typeBody,
      greigeId: TO_GREIGE,
      quantityMeters: c.lookupQty,
    });
    const d = look.data ?? look;
    console.log(`  ${c.label}: GRG-0072 at ${c.lookupQty} m → ₹${d.ratePerMeter ?? d.rate} (shrinkage ${d.shrinkagePercent ?? '—'} %)`);
  }

  // Nothing else of those processors changed: GRG-0049's cards still as they were
  for (const { c, source } of plans) {
    const after = await prisma.processor_rate_card.count({
      where: { id: { in: source.map((s) => s.id) }, effectiveTo: null },
    });
    console.log(`  ${c.label}: GRG-0049 cards still active ${after}/${source.length}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
