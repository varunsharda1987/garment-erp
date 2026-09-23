/**
 * resolveManualJobStyleFabricAnchor — which style_fabrics row a MANUAL dyeing/printing job
 * (no requirement chain) is anchored to.
 *
 * "One concept, two homes": the greige a style uses lives on its CAD rows
 * (fabric_width_cad.greigeId, what CAD Planning writes) and, historically, on
 * style_fabrics.selectedGreigeId (written only by a retired flow — 0/350 rows). Until 2026-09-17
 * the anchor read only the empty column, so a manual job on a style's greige never found the
 * style's fabric slot (order-system E4). This pins: a CAD-row match resolves, the legacy column
 * still resolves, an unknown greige does not, and two candidates stay ambiguous (null).
 *
 * Runs against the LIVE database; tagged fixtures, per-step teardown.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import {
  getOrCreateFinishedFabricV2,
  resolveFinishedFabricIdentity,
  resolveManualJobStyleFabricAnchor,
  stampStyleFabricLink,
} from '../../services/helpers/fabric-identity.helper';

const RUN = `FIA${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let styleId: string;
let greigeA: string;
let greigeB: string;
let greigeC: string;
let componentId: string;
let sfCad: string; // anchored through a CAD row on greige A
let sfLegacy: string; // anchored through selectedGreigeId = greige B
let sfTwin1: string; // two rows on greige C → ambiguous
let sfTwin2: string;

async function greige(suffix: string) {
  const g = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-${suffix}`,
      greigeName: `${RUN} ${suffix}`,
      genericGreigeName: `${RUN} ${suffix}`,
      composition: '100% Cotton',
      greigeWidth: 54,
      createdById: userId,
    },
  });
  return g.id;
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  greigeA = await greige('A');
  greigeB = await greige('B');
  greigeC = await greige('C');

  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Kurta`, createdById: userId },
  });
  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: 'Top', componentType: 'MAIN' },
  });
  componentId = component.id;

  // style_fabrics is unique on (componentId, genericGreigeName, hasEmbroidery, embroideryId):
  // one component cannot carry two slots for the same generic greige, so each gets its own name.
  const slot = (genericGreigeName: string, extra: Record<string, unknown> = {}) =>
    prisma.style_fabrics.create({
      data: { id: randomUUID(), componentId, fabricFinishType: 'DYED', genericGreigeName, ...extra },
    });
  sfCad = (await slot(`${RUN} A`)).id;
  sfLegacy = (await slot(`${RUN} B`, { selectedGreigeId: greigeB })).id;
  sfTwin1 = (await slot(`${RUN} C1`)).id;
  sfTwin2 = (await slot(`${RUN} C2`)).id;

  // CAD rows carry the greige — the column CAD Planning's Greige/Fabric picker writes.
  const cad = (styleFabricId: string, greigeId: string) =>
    prisma.fabric_width_cad.create({
      data: {
        id: randomUUID(),
        styleFabricId,
        greigeId,
        purpose: 'RAW_MATERIAL_CALCULATION',
        purposeEnum: 'RAW_MATERIAL_CALCULATION',
        cutableWidth: 52,
      },
    });
  await cad(sfCad, greigeA);
  await cad(sfTwin1, greigeC);
  await cad(sfTwin2, greigeC);
});

afterAll(async () => {
  const sfIds = [sfCad, sfLegacy, sfTwin1, sfTwin2].map((id) => only(id));
  const masterWhere = { styleReference: `${RUN}-STY` };
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['fabric_width_cad', () => prisma.fabric_width_cad.deleteMany({ where: { styleFabricId: { in: sfIds } } })],
    ['style_fabrics', () => prisma.style_fabrics.deleteMany({ where: { id: { in: sfIds } } })],
    [
      'materials',
      async () => {
        const masters = await prisma.fabric_master.findMany({ where: masterWhere, select: { id: true } });
        await prisma.materials.deleteMany({ where: { id: { in: masters.map((m) => only(m.id)) } } });
      },
    ],
    ['fabric_master', () => prisma.fabric_master.deleteMany({ where: masterWhere })],
    ['style_components', () => prisma.style_components.deleteMany({ where: { id: only(componentId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['greige_master', () => prisma.greige_master.deleteMany({ where: { greigeCode: { startsWith: `${RUN}-` } } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[fabric-identity-anchor teardown] could not clean ${label} — fixtures left behind:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('manual-job style fabric anchor', () => {
  it('resolves through the CAD row greige (the column CAD Planning writes)', async () => {
    expect(await resolveManualJobStyleFabricAnchor(styleId, greigeA, 'DYED')).toBe(sfCad);
  });

  it('still resolves through the legacy selectedGreigeId column', async () => {
    expect(await resolveManualJobStyleFabricAnchor(styleId, greigeB, 'DYED')).toBe(sfLegacy);
  });

  it('does not resolve a greige the style never used, nor the wrong finish', async () => {
    const other = await greige('X');
    try {
      expect(await resolveManualJobStyleFabricAnchor(styleId, other, 'DYED')).toBeNull();
      expect(await resolveManualJobStyleFabricAnchor(styleId, greigeA, 'PRINTED')).toBeNull();
    } finally {
      await prisma.greige_master.deleteMany({ where: { id: other } });
    }
  });

  it('stays ambiguous when two slots share the greige', async () => {
    expect(await resolveManualJobStyleFabricAnchor(styleId, greigeC, 'DYED')).toBeNull();
  });
});

/**
 * The same anchor as a FALLBACK inside resolveFinishedFabricIdentity — for the MRP mint and the
 * job-work receipt, whose BOM line may carry no CAD (ESSKY085LS, 2026-09-23: selectedCadId NULL,
 * so the style's slot was never linked to the dyed fabric and CAD Planning's Create CAD had
 * nothing to hang the received lot on).
 */
describe('greige-lineage fallback in resolveFinishedFabricIdentity', () => {
  const requirementOn = (greigeId: string, colorName: string) => ({
    colorName,
    orderBomItem: { greigeId, colorName, fabricId: null, selectedCad: null },
    order_items: { styleId, styles: { id: styleId, styleCode: `${RUN}-STY`, buyerStyleRef: null } },
  });

  it('finds the style slot by greige when the BOM line has no CAD', async () => {
    const identity = await resolveFinishedFabricIdentity({
      requirement: requirementOn(greigeA, 'Black'),
      finishType: 'DYED',
    });
    expect(identity?.styleFabricId).toBe(sfCad);
  });

  it('leaves the slot unresolved when two slots share the greige', async () => {
    const identity = await resolveFinishedFabricIdentity({
      requirement: requirementOn(greigeC, 'Black'),
      finishType: 'DYED',
    });
    expect(identity).not.toBeNull();
    expect(identity!.styleFabricId).toBeNull();
  });

  it('refuses a slot that already claims a master of another colour', async () => {
    const black = await prisma.fabric_master.create({
      data: {
        fabricCode: `${RUN}-BLK`,
        fabricName: `${RUN} Black`,
        greigeId: greigeA,
        colorName: 'Black',
        finishType: 'DYED',
        styleReference: `${RUN}-STY`,
        createdById: userId,
      },
    });
    await prisma.style_fabrics.update({ where: { id: sfCad }, data: { fabricId: black.id } });
    try {
      const navy = await resolveFinishedFabricIdentity({
        requirement: requirementOn(greigeA, 'Navy'),
        finishType: 'DYED',
      });
      expect(navy?.styleFabricId).toBeNull();
      const again = await resolveFinishedFabricIdentity({
        requirement: requirementOn(greigeA, 'black'),
        finishType: 'DYED',
      });
      expect(again?.styleFabricId).toBe(sfCad);
    } finally {
      await prisma.style_fabrics.update({ where: { id: sfCad }, data: { fabricId: null } });
      await prisma.fabric_master.delete({ where: { id: black.id } });
    }
  });

  it('a mint links the slot, and a receipt against an existing master links it too', async () => {
    const identity = await resolveFinishedFabricIdentity({
      requirement: requirementOn(greigeA, 'Olive'),
      finishType: 'DYED',
    });
    expect(identity?.styleFabricId).toBe(sfCad);

    const minted = await getOrCreateFinishedFabricV2(identity!, userId, 'AUTO_FROM_MRP_JWO');
    expect(minted.isNew).toBe(true);
    expect((await prisma.style_fabrics.findUnique({ where: { id: sfCad } }))?.fabricId).toBe(minted.fabricId);

    // Receipt against a master minted before the link existed: grn.service stamps identity.styleFabricId
    await prisma.style_fabrics.update({ where: { id: sfCad }, data: { fabricId: null } });
    const atReceipt = await resolveFinishedFabricIdentity({
      requirement: requirementOn(greigeA, 'Olive'),
      finishType: 'DYED',
    });
    await stampStyleFabricLink(atReceipt?.styleFabricId, minted.fabricId);
    expect((await prisma.style_fabrics.findUnique({ where: { id: sfCad } }))?.fabricId).toBe(minted.fabricId);

    await prisma.style_fabrics.update({ where: { id: sfCad }, data: { fabricId: null } });
  });
});
