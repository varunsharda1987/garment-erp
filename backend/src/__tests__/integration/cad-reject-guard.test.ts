/**
 * CAD Reject guard + CAD row history (2026-09-26).
 *
 * ESSKY082LS's approved average went 0.7033 → 0.8440 through Reject CAD Plan → edit → approve. The
 * reject cleared the fabric price approval with no check, the approval wiped who had rejected, no save
 * left a trace, and the cost sheets / order BOM / requirement built on 0.7033 were never told. This
 * suite pins:
 *   - a Reject on a CAD that an approved cost sheet is built on answers 409 CAD_IN_USE until the user
 *     confirms, and records the confirmation;
 *   - a style-level Reject resets planning rows but leaves an approved Production CAD approved;
 *   - approve / reject / geometry saves each write a history row, readable from the History endpoint;
 *   - the legacy fabric-master CAD update refuses an approved row.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `CRG${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let testUserEmail: string;
let styleId: string;
let styleFabricId: string;
let componentId: string;
const cadIds: string[] = [];

async function createCadRow(overrides: Record<string, any> = {}) {
  const row = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      styleFabricId,
      cutableWidth: 52,
      cadMeters: 4.17,
      layerMarginMeters: 0.05,
      piecesPerMarker: 5,
      cadAverage: 0.844,
      componentName: `${RUN}-ROW`,
      purpose: 'RAW_MATERIAL_CALCULATION',
      purposeEnum: 'RAW_MATERIAL_CALCULATION',
      approvalStatus: 'APPROVED',
      costingStyleId: styleId,
      totalCostPerMeter: 74.22,
      costingApprovalStatus: 'APPROVED',
      createdById: testUserId,
      ...overrides,
    },
  });
  cadIds.push(row.id);
  return row;
}

let sheetVersion = 0;
/** An APPROVED, current cost sheet with a fabric line frozen from the CAD row. */
async function approvedSheetOn(cadId: string) {
  sheetVersion += 1;
  const sheet = await prisma.style_costing.create({
    data: {
      id: `CS-${RUN}-${randomUUID().slice(0, 8)}`,
      styleId,
      createdById: testUserId,
      purpose: 'RAW_MATERIAL_CALCULATION',
      version: sheetVersion,
      approvalStatus: 'APPROVED',
    },
  });
  await prisma.style_costing_fabric_items.create({
    data: {
      costingId: sheet.id,
      fabricCADId: cadId,
      fabricName: `${RUN} Fabric`,
      width: 52,
      cadMeters: 0.7033,
      costPerMeter: 74.22,
      totalCost: 52.2,
    },
  });
  return sheet;
}

const historyOf = (cadId: string) =>
  prisma.audit_logs.findMany({
    where: { entityType: 'fabric_width_cad', entityId: cadId },
    orderBy: { timestamp: 'asc' },
  });

beforeAll(async () => {
  testUserEmail = `test-${RUN.toLowerCase()}@smoke.test`;
  const user = await createTestUser({ email: testUserEmail, role: 'ADMIN', isActive: true, isApproved: true });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: testUserId },
  });
  styleId = style.id;
  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: `${RUN}-TOP`, componentType: 'MAIN' },
  });
  componentId = component.id;
  const styleFabric = await prisma.style_fabrics.create({ data: { id: randomUUID(), componentId } });
  styleFabricId = styleFabric.id;
});

afterAll(async () => {
  await prisma.audit_logs.deleteMany({ where: { entityType: 'fabric_width_cad', entityId: { in: cadIds } } });
  await prisma.style_costing.deleteMany({ where: { id: { startsWith: `CS-${RUN}` } } });
  await prisma.fabric_width_cad.deleteMany({ where: { id: { in: cadIds } } });
  await prisma.style_fabrics.deleteMany({ where: { id: only(styleFabricId) } });
  await prisma.style_components.deleteMany({ where: { id: only(componentId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  await prisma.$disconnect();
});

describe('Row Reject on a CAD in use', () => {
  it('asks for confirmation while an approved cost sheet is built on it, then records who confirmed', async () => {
    const cad = await createCadRow({ componentName: `${RUN}-INUSE` });
    const sheet = await approvedSheetOn(cad.id);

    const refused = await request(app)
      .post(`/api/cad-planning/${styleId}/row/${cad.id}/reject`)
      .set(authHeader)
      .send({ rejectionNotes: 'average was wrong' })
      .expect(409);
    expect(refused.body.details.code).toBe('CAD_IN_USE');
    expect(refused.body.details.requiresConfirmation).toBe(true);
    expect(refused.body.details.inUse[0].costSheets[0].costSheetId).toBe(sheet.id);

    const untouched = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(untouched!.approvalStatus).toBe('APPROVED');
    expect(untouched!.costingApprovalStatus).toBe('APPROVED');

    await request(app)
      .post(`/api/cad-planning/${styleId}/row/${cad.id}/reject`)
      .set(authHeader)
      .send({ rejectionNotes: 'average was wrong', confirmImpact: true })
      .expect(200);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after!.approvalStatus).toBe('REJECTED');

    const events = await historyOf(cad.id);
    const reject = events.find((e) => e.action === 'REJECT');
    expect(reject).toBeDefined();
    expect(reject!.userId).toBe(testUserId);
    const values = reject!.newValues as Record<string, unknown>;
    expect(values.reason).toBe('average was wrong');
    expect(String(values.inUse)).toContain('approved cost sheet v');
  });

  it('rejects at once when nothing approved is built on the row, and History shows it', async () => {
    const cad = await createCadRow({ componentName: `${RUN}-FREE`, costingApprovalStatus: null });

    await request(app)
      .post(`/api/cad-planning/${styleId}/row/${cad.id}/reject`)
      .set(authHeader)
      .send({ rejectionNotes: 'redo the marker' })
      .expect(200);

    const res = await request(app)
      .get(`/api/cad-planning/${styleId}/row/${cad.id}/history`)
      .set(authHeader)
      .expect(200);
    const entry = res.body.data.entries.find((e: { action: string }) => e.action === 'REJECT');
    expect(entry.reason).toBe('redo the marker');
    expect(entry.by.email).toBe(testUserEmail);
    expect(res.body.data.createdBy.email).toBe(testUserEmail);
  });
});

describe('Reject CAD Plan', () => {
  it('resets planning rows, keeps an approved Production CAD approved, and confirms over an approved sheet', async () => {
    const planning = await createCadRow({ componentName: `${RUN}-PLAN` });
    const production = await createCadRow({
      componentName: `${RUN}-PROD`,
      purpose: 'PRODUCTION',
      purposeEnum: 'PRODUCTION',
      costingStyleId: null,
      totalCostPerMeter: null,
      costingApprovalStatus: null,
    });
    await approvedSheetOn(planning.id);
    await prisma.styles.update({ where: { id: styleId }, data: { cadStatus: 'APPROVED' } });

    const refused = await request(app)
      .put(`/api/cad-planning/${styleId}/reject-cad`)
      .set(authHeader)
      .send({ rejectionReason: 'planning rework' })
      .expect(409);
    expect(refused.body.details.code).toBe('CAD_IN_USE');

    const ok = await request(app)
      .put(`/api/cad-planning/${styleId}/reject-cad`)
      .set(authHeader)
      .send({ rejectionReason: 'planning rework', confirmImpact: true })
      .expect(200);
    expect(ok.body.message).toMatch(/Production CAD was kept approved/);

    const [planAfter, prodAfter] = await Promise.all([
      prisma.fabric_width_cad.findUnique({ where: { id: planning.id } }),
      prisma.fabric_width_cad.findUnique({ where: { id: production.id } }),
    ]);
    expect(planAfter!.approvalStatus).toBe('PENDING');
    expect(planAfter!.costingApprovalStatus).toBeNull();
    expect(prodAfter!.approvalStatus).toBe('APPROVED');

    expect((await historyOf(planning.id)).some((e) => e.action === 'REJECT')).toBe(true);
    expect((await historyOf(production.id)).some((e) => e.action === 'REJECT')).toBe(false);
  });
});

describe('CAD saves write history', () => {
  it('records the average change of a spreadsheet save, old → new', async () => {
    const cad = await createCadRow({
      componentName: `${RUN}-EDIT`,
      approvalStatus: 'PENDING',
      costingApprovalStatus: null,
      totalCostPerMeter: null,
      cadMeters: 3.47,
      cadAverage: 0.7033,
    });

    await request(app)
      .put(`/api/cad-planning/${styleId}/row/${cad.id}`)
      .set(authHeader)
      .send({
        layerLengthMeters: 4.17,
        sizeBreakdowns: ['S', 'M', 'L', 'XL', 'XXL'].map((sizeName) => ({ sizeName, quantity: 1 })),
      })
      .expect(200);

    const update = (await historyOf(cad.id)).find((e) => e.action === 'UPDATE');
    expect(update).toBeDefined();
    expect((update!.oldValues as Record<string, unknown>).cadAverage).toBe(0.7033);
    expect((update!.newValues as Record<string, unknown>).cadAverage).toBe(0.844);
    expect(update!.userId).toBe(testUserId);
  });

  it('the legacy fabric-master CAD update refuses an approved row', async () => {
    const cad = await createCadRow({ componentName: `${RUN}-LEGACY` });

    const res = await request(app)
      .put(`/api/fabric-management/cad/${cad.id}`)
      .set(authHeader)
      .send({ cadMeters: 9.99 });
    expect(res.status).toBeGreaterThanOrEqual(400);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(Number(after!.cadMeters)).toBe(4.17);
  });
});
