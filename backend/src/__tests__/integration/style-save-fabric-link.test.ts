/**
 * Saving a style must not unlink the dyed fabric its job-work receipt linked to a greige slot.
 *
 * The style save deletes every style_components/style_fabrics row and recreates them from the
 * payload, and the Style form sent `fabricId: null` for every greige slot — so one save wiped the
 * link the receipt stamped (fabric-identity.helper stampStyleFabricLink). CAD re-linking then
 * failed too (its identity key includes fabricId), leaving lot-based Production CADs, whose
 * costingStyleId is null, with no slot: out of the cutting gate and the CAD Planning table.
 * Found while checking ESSKY085LS after its first dyed fabric arrived (2026-09-23).
 *
 * Pins: a null payload keeps the link; sending the link keeps it; a changed greige does not carry
 * it over; the Production CAD follows its slot either way.
 *
 * Runs against the real app + live DB; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SSF${Date.now().toString(36).toUpperCase()}`;
const GREIGE = `${RUN} Moss`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let dyedId: string;
let cadId: string;

/** The payload StyleFormRedesigned builds for one Top component with one greige fabric. */
const componentsPayload = (fabric: { genericGreigeName: string; fabricId: string | null }) => [
  {
    componentName: 'Top',
    componentType: 'OTHER',
    fabrics: [
      {
        fabricName: fabric.genericGreigeName,
        fabricId: fabric.fabricId,
        genericGreigeName: fabric.genericGreigeName,
        fabricType: 'GENERIC',
        fabricFinishType: 'DYED',
        printDesign: null,
        colorMasterId: null,
        hasEmbroidery: false,
        embroideryId: null,
        patternPartIds: [],
      },
    ],
  },
];

const slotsOfStyle = () =>
  prisma.style_fabrics.findMany({
    where: { style_components: { styleId } },
    select: { id: true, fabricId: true, genericGreigeName: true },
  });

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
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Kurta`, createdById: userId },
  });
  const dyed = await prisma.fabric_master.create({
    data: {
      fabricCode: `${RUN}-DYED`,
      fabricName: `${RUN} Moss - Solid/Dyed - Black`,
      colorName: 'Black',
      finishType: 'DYED',
      styleReference: `${RUN}-STY`,
      createdById: userId,
    },
  });
  dyedId = dyed.id;

  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: 'Top', componentType: 'OTHER' },
  });
  // The slot as the receipt leaves it: greige-sourced, linked to the dyed master
  const slot = await prisma.style_fabrics.create({
    data: {
      id: randomUUID(),
      componentId: component.id,
      fabricName: GREIGE,
      fabricType: 'GENERIC',
      genericGreigeName: GREIGE,
      fabricFinishType: 'DYED',
      fabricId: dyedId,
    },
  });
  // A lot-based Production CAD: costingStyleId NULL, so only the slot ties it to the style
  const cad = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      styleFabricId: slot.id,
      fabricId: dyedId,
      purpose: 'PRODUCTION',
      purposeEnum: 'PRODUCTION',
      cutableWidth: 52,
      cadMeters: 4.35,
      cadAverage: 0.7333,
    },
  });
  cadId = cad.id;
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['fabric_width_cad', () => prisma.fabric_width_cad.deleteMany({ where: { id: only(cadId) } })],
    [
      'style_fabrics',
      () => prisma.style_fabrics.deleteMany({ where: { style_components: { styleId: only(styleId) } } }),
    ],
    ['style_components', () => prisma.style_components.deleteMany({ where: { styleId: only(styleId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['fabric_master', () => prisma.fabric_master.deleteMany({ where: { id: only(dyedId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[style-save-fabric-link teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('saving a style keeps the dyed fabric linked to its greige slot', () => {
  it('keeps the link when the payload sends fabricId null (the old form payload)', async () => {
    await request(app)
      .put(`/api/styles/${styleId}`)
      .set(authHeader)
      .send({ components: componentsPayload({ genericGreigeName: GREIGE, fabricId: null }) })
      .expect(200);

    const slots = await slotsOfStyle();
    expect(slots).toHaveLength(1);
    expect(slots[0].fabricId).toBe(dyedId);
    // The Production CAD follows its recreated slot (pass-1 identity re-link)
    const cad = await prisma.fabric_width_cad.findUnique({ where: { id: cadId } });
    expect(cad?.styleFabricId).toBe(slots[0].id);
  });

  it('keeps the link when the payload sends it (the form now does)', async () => {
    await request(app)
      .put(`/api/styles/${styleId}`)
      .set(authHeader)
      .send({ components: componentsPayload({ genericGreigeName: GREIGE, fabricId: dyedId }) })
      .expect(200);

    const slots = await slotsOfStyle();
    expect(slots).toHaveLength(1);
    expect(slots[0].fabricId).toBe(dyedId);
    const cad = await prisma.fabric_width_cad.findUnique({ where: { id: cadId } });
    expect(cad?.styleFabricId).toBe(slots[0].id);
  });

  it('does not carry the link over to a different greige', async () => {
    await request(app)
      .put(`/api/styles/${styleId}`)
      .set(authHeader)
      .send({ components: componentsPayload({ genericGreigeName: `${RUN} Other`, fabricId: null }) })
      .expect(200);

    const slots = await slotsOfStyle();
    expect(slots).toHaveLength(1);
    expect(slots[0].genericGreigeName).toBe(`${RUN} Other`);
    expect(slots[0].fabricId).toBeNull();
  });
});
