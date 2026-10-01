/**
 * Approve CAD Plan approves the PLAN — every Costing and Raw Mat row the table shows (2026-10-01).
 *
 * Until then it took one arbitrary row per fabric (the last mapping sent), flipped REJECTED rows straight back to
 * APPROVED, accepted Production rows (skipping their own checks) and other styles' rows, and read a legacy
 * "All Parts" row as having no part. Reject CAD Plan, for its part, ran on a style whose only approved row was a
 * Production CAD and relinked nothing it kept.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ALL_PARTS_LEGACY_MARKER } from '../../controllers/cad-planning.utils';

const RUN = `CPA${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let otherStyleId: string;
let componentId: string;
let styleFabricId: string;
let greigeId: string;
const cadIds: string[] = [];

async function row(overrides: Record<string, unknown> = {}) {
  const r = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      styleFabricId,
      costingStyleId: styleId,
      greigeId,
      cutableWidth: 52,
      cadMeters: 4.17,
      layerMarginMeters: 0.05,
      piecesPerMarker: 5,
      cadAverage: 0.844,
      // a legacy "All Parts" row: its part is the marker in componentName, no part link
      componentName: ALL_PARTS_LEGACY_MARKER,
      purpose: 'COSTING',
      purposeEnum: 'COSTING',
      approvalStatus: 'PENDING',
      createdById: userId,
      ...overrides,
    },
  });
  cadIds.push(r.id);
  return r;
}

const approvePlan = (mappings: Array<{ fabricId: string; fabricCADId: string }>) =>
  request(app).put(`/api/cad-planning/${styleId}/approve-cad`).set(authHeader).send({ fabricCADMappings: mappings });

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
  const greige = await prisma.greige_master.findFirst({ select: { id: true } });
  if (!greige) throw new Error('The test database has no greige');
  greigeId = greige.id;

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
  });
  styleId = style.id;
  const other = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}O`, styleName: `${RUN} Other`, createdById: userId },
  });
  otherStyleId = other.id;
  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: `${RUN}-TOP`, componentType: 'MAIN' },
  });
  componentId = component.id;
  styleFabricId = (await prisma.style_fabrics.create({ data: { id: randomUUID(), componentId } })).id;
});

afterAll(async () => {
  await prisma.audit_logs.deleteMany({ where: { entityType: 'fabric_width_cad', entityId: { in: cadIds } } });
  await prisma.style_fabrics.updateMany({ where: { id: only(styleFabricId) }, data: { fabricCADId: null } });
  await prisma.fabric_width_cad.deleteMany({ where: { id: { in: cadIds } } });
  await prisma.style_fabrics.deleteMany({ where: { id: only(styleFabricId) } });
  await prisma.style_components.deleteMany({ where: { id: only(componentId) } });
  await prisma.styles.deleteMany({ where: { id: { in: [styleId, otherStyleId] } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('Approve CAD Plan', () => {
  it("refuses a Production row, a rejected row, and another style's row in the plan", async () => {
    const costing = await row();
    const production = await row({ purpose: 'PRODUCTION', purposeEnum: 'PRODUCTION', cutableWidth: 51 });
    const rejected = await row({ approvalStatus: 'REJECTED', cutableWidth: 50 });
    const foreign = await row({ costingStyleId: otherStyleId, styleFabricId: null, cutableWidth: 49 });

    for (const extra of [production, rejected, foreign]) {
      const res = await approvePlan([
        { fabricId: styleFabricId, fabricCADId: costing.id },
        { fabricId: styleFabricId, fabricCADId: extra.id },
      ]);
      expect(res.status).toBe(400);
    }
    expect((await prisma.fabric_width_cad.findUnique({ where: { id: costing.id } }))?.approvalStatus).toBe('PENDING');
  });

  it('approves every planning row sent and links the fabric to its Raw Mat row', async () => {
    const costing = await row({ cutableWidth: 48 });
    const rawMat = await row({
      purpose: 'RAW_MATERIAL_CALCULATION',
      purposeEnum: 'RAW_MATERIAL_CALCULATION',
      cutableWidth: 47,
      // a Raw Mat row needs its marker image or a reason (cad-marker.helper): saved by hand with a reason
      markerOverrideReason: 'hand-laid marker',
      markerOverrideDifferences: JSON.stringify([
        { field: 'image', label: 'No marker image — the values are not checked against one', image: null, row: null },
      ]),
    });
    // Raw Mat sent FIRST: "the last mapping wins" would have linked the Costing row
    await approvePlan([
      { fabricId: styleFabricId, fabricCADId: rawMat.id },
      { fabricId: styleFabricId, fabricCADId: costing.id },
    ]).expect(200);

    const [c, r, sf] = await Promise.all([
      prisma.fabric_width_cad.findUnique({ where: { id: costing.id } }),
      prisma.fabric_width_cad.findUnique({ where: { id: rawMat.id } }),
      prisma.style_fabrics.findUnique({ where: { id: styleFabricId } }),
    ]);
    expect(c?.approvalStatus).toBe('APPROVED');
    expect(r?.approvalStatus).toBe('APPROVED');
    expect(sf?.fabricCADId).toBe(rawMat.id);
  });
});

describe('Approve CAD Plan leaves approved rows and their twins as they are', () => {
  it('an older approved Raw Mat row with no image does not block the plan; a costing twin stays pending', async () => {
    // approved before CAD images were required: no image, no reason
    const oldRawMat = await row({
      purpose: 'RAW_MATERIAL_CALCULATION',
      purposeEnum: 'RAW_MATERIAL_CALCULATION',
      approvalStatus: 'APPROVED',
      cutableWidth: 45,
    });
    const newCosting = await row({ cutableWidth: 44 });
    // a Fabric Costing clone of an approved row: same part, fabric, width and purpose, never CAD-approved
    const approvedCosting = await row({ cutableWidth: 43, approvalStatus: 'APPROVED' });
    const clone = await row({ cutableWidth: 43, approvalStatus: null });

    await approvePlan([
      { fabricId: styleFabricId, fabricCADId: oldRawMat.id },
      { fabricId: styleFabricId, fabricCADId: newCosting.id },
      { fabricId: styleFabricId, fabricCADId: approvedCosting.id },
      { fabricId: styleFabricId, fabricCADId: clone.id },
    ]).expect(200);

    const [n, c, sf] = await Promise.all([
      prisma.fabric_width_cad.findUnique({ where: { id: newCosting.id } }),
      prisma.fabric_width_cad.findUnique({ where: { id: clone.id } }),
      prisma.style_fabrics.findUnique({ where: { id: styleFabricId } }),
    ]);
    expect(n?.approvalStatus).toBe('APPROVED');
    expect(c?.approvalStatus).toBeNull();
    expect(sf?.fabricCADId).not.toBe(clone.id);
  });
});

describe('Reject CAD Plan', () => {
  it('keeps a kept Production CAD linked, and refuses when no planning row is approved', async () => {
    const production = await row({
      purpose: 'PRODUCTION',
      purposeEnum: 'PRODUCTION',
      approvalStatus: 'APPROVED',
      cutableWidth: 46,
    });
    await prisma.style_fabrics.update({ where: { id: styleFabricId }, data: { fabricCADId: production.id } });
    await prisma.styles.update({ where: { id: styleId }, data: { cadStatus: 'APPROVED' } });

    await request(app)
      .put(`/api/cad-planning/${styleId}/reject-cad`)
      .set(authHeader)
      .send({ rejectionReason: 'planning rework' })
      .expect(200);
    expect((await prisma.style_fabrics.findUnique({ where: { id: styleFabricId } }))?.fabricCADId).toBe(production.id);

    // the style is still APPROVED (its Production CAD), but the plan is not
    const again = await request(app)
      .put(`/api/cad-planning/${styleId}/reject-cad`)
      .set(authHeader)
      .send({ rejectionReason: 'again' });
    expect(again.status).toBe(400);
  });
});
