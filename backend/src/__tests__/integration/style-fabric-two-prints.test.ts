/**
 * One part may carry two prints of one greige; a true duplicate is refused with a message.
 *
 * LNG129 (2026-09-30): the Nightgown was saved with Poplin printed "Butta" AND Poplin printed "Border".
 * The style save de-duplicated fabrics on greige + finish + embroidery only, so "Border" was dropped with
 * nothing but a log line — the user saw the fabric vanish on every save. A unique index on the same key
 * (20260806000000) would have refused it anyway. Both now key on greige (else fabric master) + finish +
 * design + colour + embroidery (20260930120000), and a real duplicate is refused, never dropped.
 *
 * Pins: two prints save; a same-design duplicate (any case / spaces) is refused and changes nothing; a new
 * style with a duplicate is refused before it is created; renaming one print keeps each print's CAD on its
 * own print; Allocate to Style links a fabric to the print of its own design and refuses when it cannot tell.
 *
 * Runs against the real app + garment_erp_test; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';

const RUN = `SF2P${Date.now().toString(36).toUpperCase()}`;
const GREIGE = `${RUN} Poplin`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let greigeId: string;
const cadIds: string[] = [];
const fabricIds: string[] = [];

const print = (printDesign: string) => ({
  fabricName: GREIGE,
  fabricId: null,
  genericGreigeName: GREIGE,
  fabricType: 'GENERIC',
  fabricFinishType: 'PRINTED',
  printDesign,
  colorMasterId: null,
  hasEmbroidery: false,
  embroideryId: null,
  patternPartIds: [],
});

/** The payload StyleFormRedesigned builds for one Nightgown with the given printed fabrics. */
const nightgown = (...designs: string[]) => [
  { componentName: 'Nightgown', componentType: 'OTHER', fabrics: designs.map(print) },
];

const slotsOfStyle = async () =>
  (
    await prisma.style_fabrics.findMany({
      where: { style_components: { styleId } },
      select: { id: true, printDesign: true, fabricId: true, componentId: true },
    })
  ).sort((a, b) => (a.printDesign ?? '').localeCompare(b.printDesign ?? ''));

const costingCad = async (styleFabricId: string, cadMeters: number) => {
  const cad = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      costingStyleId: styleId,
      styleFabricId,
      greigeId,
      purpose: 'COSTING',
      purposeEnum: 'COSTING',
      cutableWidth: 44,
      cadMeters,
      cadAverage: cadMeters / 3,
    },
  });
  cadIds.push(cad.id);
  return cad.id;
};

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Nightgown`, createdById: userId },
  });
  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GG`,
        greigeName: GREIGE,
        genericGreigeName: GREIGE,
        composition: '100% Cotton',
        greigeWidth: 44,
        createdById: userId,
      },
    })
  ).id;
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['fabric_width_cad', () => prisma.fabric_width_cad.deleteMany({ where: { id: { in: onlyAll(cadIds) } } })],
    [
      'style_fabrics',
      () => prisma.style_fabrics.deleteMany({ where: { style_components: { styleId: only(styleId) } } }),
    ],
    ['style_components', () => prisma.style_components.deleteMany({ where: { styleId: only(styleId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { styleCode: { startsWith: only(RUN) } } })],
    ['fabric_master', () => prisma.fabric_master.deleteMany({ where: { id: { in: onlyAll(fabricIds) } } })],
    ['greige_master', () => prisma.greige_master.deleteMany({ where: { id: only(greigeId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[style-fabric-two-prints teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('two prints of one greige in one part', () => {
  it('saves both prints (the LNG129 payload)', async () => {
    await request(app)
      .put(`/api/styles/${styleId}`)
      .set(authHeader)
      .send({ components: nightgown('Butta', 'Border') })
      .expect(200);

    const slots = await slotsOfStyle();
    expect(slots.map((s) => s.printDesign)).toEqual(['Border', 'Butta']);
  });

  it('refuses the same print twice with a message, and changes nothing', async () => {
    const res = await request(app)
      .put(`/api/styles/${styleId}`)
      .set(authHeader)
      .send({ components: nightgown('Butta', 'Border', ' butta ') })
      .expect(400);

    expect(res.body.message).toBe(
      `Nightgown has ${GREIGE} (Printed, butta) twice. Remove one, or give it a different design name.`
    );
    expect((await slotsOfStyle()).map((s) => s.printDesign)).toEqual(['Border', 'Butta']);
  });

  it('refuses a new style carrying a duplicate before creating it', async () => {
    const res = await request(app)
      .post('/api/styles')
      .set(authHeader)
      .send({
        styleCode: `${RUN}-NEW`,
        styleName: `${RUN} New`,
        status: 'DRAFT',
        components: nightgown('Butta', 'Butta'),
      })
      .expect(400);

    expect(res.body.message).toMatch(/^Nightgown has .* \(Printed, Butta\) twice\./);
    expect(await prisma.styles.count({ where: { styleCode: `${RUN}-NEW` } })).toBe(0);
  });

  it("keeps each print's CAD on its own print when one print is renamed", async () => {
    const [border, butta] = await slotsOfStyle();
    const borderCad = await costingCad(border.id, 3.1);
    const buttaCad = await costingCad(butta.id, 2.9);

    await request(app)
      .put(`/api/styles/${styleId}`)
      .set(authHeader)
      .send({ components: nightgown('Butta Big', 'Border') })
      .expect(200);

    const after = await slotsOfStyle();
    const bySlot = new Map(after.map((s) => [s.printDesign, s.id]));
    const cads = await prisma.fabric_width_cad.findMany({
      where: { id: { in: [borderCad, buttaCad] } },
      select: { id: true, styleFabricId: true },
    });
    const cadSlot = new Map(cads.map((c) => [c.id, c.styleFabricId]));
    expect(cadSlot.get(borderCad)).toBe(bySlot.get('Border'));
    expect(cadSlot.get(buttaCad)).toBe(bySlot.get('Butta Big'));
  });
});

describe('Allocate to Style with two prints of one greige in one part', () => {
  const makeFabric = async (printDesign: string | null) => {
    const f = await prisma.fabric_master.create({
      data: {
        fabricCode: `${RUN}-F${fabricIds.length}`,
        fabricName: `${GREIGE} - Printed - ${printDesign ?? 'none'}`,
        genericGreigeName: GREIGE,
        printDesign,
        finishType: 'PRINTED',
        styleReference: `${RUN}-STY`,
        createdById: userId,
      },
    });
    fabricIds.push(f.id);
    return f.id;
  };
  const allocate = (fabricId: string, componentId: string) =>
    request(app)
      .post(`/api/fabric-management/fabric/${fabricId}/allocate-to-style`)
      .set(authHeader)
      .send({ componentIds: [componentId] });

  it('refuses a fabric with no design — it cannot tell the prints apart', async () => {
    const [slot] = await slotsOfStyle();
    const res = await allocate(await makeFabric(null), slot.componentId).expect(400);
    expect(res.body.message).toMatch(/^Nightgown has 2 fabric lines not yet linked to a fabric \(/);
    expect((await slotsOfStyle()).every((s) => s.fabricId === null)).toBe(true);
  });

  it('links the fabric to the print of its own design', async () => {
    const [slot] = await slotsOfStyle();
    const borderFabric = await makeFabric('Border');
    await allocate(borderFabric, slot.componentId).expect((r) => {
      if (r.status >= 300) throw new Error(`allocate ${r.status}: ${JSON.stringify(r.body)}`);
    });

    const after = await slotsOfStyle();
    expect(after).toHaveLength(2);
    expect(after.find((s) => s.printDesign === 'Border')?.fabricId).toBe(borderFabric);
    expect(after.find((s) => s.printDesign === 'Butta Big')?.fabricId).toBeNull();
  });
});
