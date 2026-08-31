/**
 * Cost-sheet CAD-to-fabric pairing (silent-data-loss hunt 2026-08-31, findings #4/#11).
 *
 * updateCostSheet deletes style_costing_fabric_items and rebuilds them by walking fabric_width_cad
 * rows (ordered updatedAt DESC) and pairing the Nth of them with fabricDetails[N] — a raw
 * positional join between two unrelated orderings. Re-saving any CAD row floats it to the front,
 * so the next cost-sheet save writes one fabric's metreage and rate onto the other's line. The
 * sheet's own total is unchanged (the same products are summed), and the screen renders the
 * still-correct fabricDetails JSON, so nothing looks wrong — but style_costing_fabric_items is
 * "the ONLY source Order-BOM trusts", so the greige PO is raised for the wrong fabric at the
 * wrong rate. 7 live sheets are crossed this way today.
 *
 * These fixtures deliberately replicate the LIVE shape rather than a convenient one:
 *   - CAD rows are greige-sourced, so cad.fabricId is NULL (334 of 346 style_fabrics live)
 *   - the stored JSON entries carry NO fabricId key at all
 *   - the JSON fabricName is the SHORT name; the greige master name carries a construction suffix,
 *     so exact name equality never matches
 *   - it is ONE greige at TWO widths (11 of 12 live multi-fabric sheets), so name alone cannot
 *     disambiguate the two lines — only the width can
 * A fixture with fabricId populated would pass through a matching branch that never executes in
 * production, certifying a fix that leaves the live swap alive.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';

const RUN = `CSP${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let greigeId: string;
let componentId: string;
let styleFabricA: string;
let styleFabricB: string;
let cadNarrow: string; // 50"
let cadWide: string; // 52"
let costSheetId: string;

const SHORT_NAME = `${RUN} Viscose Staple`;
const NARROW = { width: 50, average: 0.505, rate: 63.09 };
const WIDE = { width: 52, average: 0.9817, rate: 74.22 };

/** fabricDetails as the form posts them: short name, width, average, rate — and no fabricId. */
function fabricDetailsPayload() {
  return [
    {
      fabricName: SHORT_NAME,
      fabricWidth: NARROW.width,
      fabricAverage: NARROW.average,
      fabricRate: NARROW.rate,
      fabricTotal: NARROW.average * NARROW.rate,
    },
    {
      fabricName: SHORT_NAME,
      fabricWidth: WIDE.width,
      fabricAverage: WIDE.average,
      fabricRate: WIDE.rate,
      fabricTotal: WIDE.average * WIDE.rate,
    },
  ];
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
  });
  styleId = style.id;

  // Descriptive master name with a construction suffix — the JSON short name is only a PREFIX of it
  const greige = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-GRG`,
      greigeName: `${SHORT_NAME} 30x30 / 68x64 / 63" (Super Dyeing)`,
      composition: '100% Viscose',
      greigeWidth: 63,
      createdById: userId,
    },
  });
  greigeId = greige.id;

  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: 'Shirt', componentType: 'MAIN' },
  });
  componentId = component.id;

  // ONE greige fabric costed at TWO widths — the dominant live shape (11 of 12 multi-fabric
  // sheets). Both CAD rows therefore share a styleFabric AND a name; only the width separates
  // them, which is exactly what makes positional pairing undetectable and name matching useless.
  const sf = await prisma.style_fabrics.create({
    data: { id: randomUUID(), componentId, selectedGreigeId: greigeId, fabricName: SHORT_NAME },
  });
  styleFabricA = sf.id;
  styleFabricB = sf.id;

  const narrow = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      greigeId, // fabricId deliberately NULL — greige-sourced, as live
      styleFabricId: styleFabricA,
      componentName: 'Shirt',
      cutableWidth: NARROW.width,
      cadAverage: NARROW.average,
      totalCostPerMeter: NARROW.rate,
      purpose: 'COSTING',
      costingStyleId: styleId,
      createdById: userId,
    },
  });
  cadNarrow = narrow.id;

  const wide = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      greigeId,
      styleFabricId: styleFabricB,
      componentName: 'Shirt',
      cutableWidth: WIDE.width,
      cadAverage: WIDE.average,
      totalCostPerMeter: WIDE.rate,
      purpose: 'COSTING',
      costingStyleId: styleId,
      createdById: userId,
    },
  });
  cadWide = wide.id;

  costSheetId = `CS-${Date.now()}-${RUN.toLowerCase()}`;
  await prisma.style_costing.create({
    data: {
      id: costSheetId,
      styleId,
      createdById: userId,
      approvalStatus: 'PENDING',
      isApproved: false,
      fabricDetails: fabricDetailsPayload(),
    },
  });
});

/**
 * Prisma treats `where: { id: undefined }` as NO FILTER, so `deleteMany({ where: { id: someVar } })`
 * with an unset variable DELETES EVERY ROW IN THE TABLE. That is not hypothetical: when this
 * suite's beforeAll threw partway through, the unguarded cleanup below wiped every style_costing
 * row in the dev database. These suites run against the REAL database — never hand Prisma a
 * possibly-undefined id. `only()` degrades to a sentinel that matches nothing.
 */
const only = (id: string | undefined) => id ?? '__unset__';
const onlyAll = (ids: Array<string | undefined>) => ids.filter((v): v is string => typeof v === 'string');

afterAll(async () => {
  await prisma.style_costing_fabric_items.deleteMany({ where: { costingId: only(costSheetId) } });
  await prisma.style_costing.deleteMany({ where: { id: only(costSheetId) } });
  await prisma.fabric_width_cad.deleteMany({ where: { id: { in: onlyAll([cadNarrow, cadWide]) } } });
  await prisma.style_fabrics.deleteMany({ where: { id: { in: onlyAll([...new Set([styleFabricA, styleFabricB])]) } } });
  await prisma.style_components.deleteMany({ where: { id: only(componentId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('Cost-sheet update pairs each CAD row with its OWN fabric line', () => {
  it('does not swap metreage/rate when a CAD row is re-saved and reorders the query', async () => {
    // The real trigger: re-costing the WIDE row floats it to the front of `orderBy updatedAt desc`,
    // while fabricDetails keeps its form order [narrow, wide].
    await prisma.fabric_width_cad.update({
      where: { id: cadWide },
      data: { updatedAt: new Date() },
    });

    const res = await request(app)
      .put(`/api/style-costing/${costSheetId}`)
      .set(authHeader)
      .send({ fabricDetails: fabricDetailsPayload() });

    expect(res.status).toBe(200);

    const items = await prisma.style_costing_fabric_items.findMany({
      where: { costingId: costSheetId },
    });
    expect(items).toHaveLength(2);

    const narrowItem = items.find((i) => i.fabricCADId === cadNarrow)!;
    const wideItem = items.find((i) => i.fabricCADId === cadWide)!;
    expect(narrowItem).toBeDefined();
    expect(wideItem).toBeDefined();

    // Each row's money must belong to the CAD row it is attached to — the internal-consistency
    // check, not merely "the total is unchanged" (a swap preserves the total).
    expect(Number(narrowItem.width)).toBe(NARROW.width);
    expect(Number(narrowItem.cadMeters)).toBeCloseTo(NARROW.average, 4);
    expect(Number(narrowItem.costPerMeter)).toBeCloseTo(NARROW.rate, 2);

    expect(Number(wideItem.width)).toBe(WIDE.width);
    expect(Number(wideItem.cadMeters)).toBeCloseTo(WIDE.average, 4);
    expect(Number(wideItem.costPerMeter)).toBeCloseTo(WIDE.rate, 2);
  });

  it('stays correct when the payload order is reversed relative to the CAD ordering', async () => {
    await prisma.fabric_width_cad.update({
      where: { id: cadNarrow },
      data: { updatedAt: new Date() },
    });

    const reversed = [...fabricDetailsPayload()].reverse();
    const res = await request(app)
      .put(`/api/style-costing/${costSheetId}`)
      .set(authHeader)
      .send({ fabricDetails: reversed });

    expect(res.status).toBe(200);

    const items = await prisma.style_costing_fabric_items.findMany({ where: { costingId: costSheetId } });
    const narrowItem = items.find((i) => i.fabricCADId === cadNarrow)!;
    const wideItem = items.find((i) => i.fabricCADId === cadWide)!;

    expect(Number(narrowItem.cadMeters)).toBeCloseTo(NARROW.average, 4);
    expect(Number(narrowItem.costPerMeter)).toBeCloseTo(NARROW.rate, 2);
    expect(Number(wideItem.cadMeters)).toBeCloseTo(WIDE.average, 4);
    expect(Number(wideItem.costPerMeter)).toBeCloseTo(WIDE.rate, 2);
  });

  it('writes fabricCADId back into the stored JSON so later saves pair by id', async () => {
    const sheet = await prisma.style_costing.findUniqueOrThrow({ where: { id: costSheetId } });
    const stored = sheet.fabricDetails as Array<Record<string, unknown>>;

    expect(stored).toHaveLength(2);
    const ids = stored.map((entry) => entry.fabricCADId);
    expect(ids).toContain(cadNarrow);
    expect(ids).toContain(cadWide);

    // and the id travels with the right width
    const narrowEntry = stored.find((e) => e.fabricCADId === cadNarrow)!;
    expect(Number(narrowEntry.fabricWidth)).toBe(NARROW.width);
  });

  it('never lets an identity-only match cross widths (50" CAD must not claim the 52" line)', async () => {
    // A sheet costed for ONE width only, while the style has two approved width options. The
    // narrow CAD row sorts first and, with no width veto on the name leg, used to claim the 52"
    // line — producing a row whose width/rateCard came from the 50" option and whose metreage and
    // rate came from the 52" one, then freezing that pairing into fabricCADId.
    await prisma.fabric_width_cad.update({ where: { id: cadNarrow }, data: { updatedAt: new Date() } });

    const wideOnly = [fabricDetailsPayload()[1]]; // the 52" line only
    const res = await request(app).put(`/api/style-costing/${costSheetId}`).set(authHeader).send({
      fabricDetails: wideOnly,
    });
    expect(res.status).toBe(200);

    const items = await prisma.style_costing_fabric_items.findMany({ where: { costingId: costSheetId } });
    expect(items).toHaveLength(1);

    // The single line must belong to the 52" CAD row, not the 50" one that sorted first.
    expect(items[0].fabricCADId).toBe(cadWide);
    expect(Number(items[0].width)).toBe(WIDE.width);
    expect(Number(items[0].cadMeters)).toBeCloseTo(WIDE.average, 4);

    // ...and the unused 50" CAD row must be reported, not silently dropped.
    expect(Array.isArray(res.body.warnings)).toBe(true);
    expect(res.body.warnings.join(' ')).toMatch(/no cost line|left out/i);

    // restore both lines for any later test
    await request(app)
      .put(`/api/style-costing/${costSheetId}`)
      .set(authHeader)
      .send({ fabricDetails: fabricDetailsPayload() });
  });

  it('warns when two fabric lines match one CAD row equally well instead of guessing silently', async () => {
    // Same name AND same width on both lines: nothing distinguishes them, so whichever is chosen
    // is decided by array order. That is a guess, and it gets stamped into fabricCADId — it must
    // not pass as a confident match.
    const ambiguous = [
      { ...fabricDetailsPayload()[0], fabricWidth: WIDE.width },
      { ...fabricDetailsPayload()[1], fabricWidth: WIDE.width },
    ];
    const res = await request(app)
      .put(`/api/style-costing/${costSheetId}`)
      .set(authHeader)
      .send({ fabricDetails: ambiguous });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.warnings)).toBe(true);
    expect(res.body.warnings.join(' ')).toMatch(/equally well|matched \d+ fabric lines/i);

    await request(app)
      .put(`/api/style-costing/${costSheetId}`)
      .set(authHeader)
      .send({ fabricDetails: fabricDetailsPayload() });
  });

  it('reports a warning instead of silently dropping a CAD row with no cost line', async () => {
    const res = await request(app)
      .put(`/api/style-costing/${costSheetId}`)
      .set(authHeader)
      .send({ fabricDetails: [fabricDetailsPayload()[0]] }); // only one line for two CAD rows

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.warnings)).toBe(true);
    expect(res.body.warnings.length).toBeGreaterThan(0);
    expect(res.body.warnings.join(' ')).toMatch(/no cost line|not matched|unmatched/i);
  });
});
