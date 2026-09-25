/**
 * "New Version" re-issues the same cost sheet — it must not change what the sheet IS.
 *
 * Until 2026-09-23 create-version left `purpose`, the closed (customer-agreed) cost, the budgets and
 * buffers out of the clone, so every new version silently became a COSTING sheet with no closed
 * cost: ESSKY091LS v1 RAW_MATERIAL_CALCULATION ₹290 → v2 COSTING, no closed cost (2026-08-25).
 * It also numbered the clone source.version + 1, which collides with (styleId, purpose, version)
 * once the purpose is kept and another width combination already holds that number.
 *
 * And a version exists to be edited: when its fabric widths change, the width-combination label
 * must follow (update used to keep the label from creation, so a 41.5" sheet was filed under 40").
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `CSV${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let styleId: string;

// Route params only accept the real id shape CS-<digits>-<alnum>; teardown is by styleId.
let sheetSeq = 0;
function sheetId(tag: string) {
  sheetSeq += 1;
  return `CS-${Date.now()}${sheetSeq}-${tag}${RUN}`;
}

function fabricLine(width: number) {
  return {
    fabricName: `${RUN} Poplin`,
    fabricWidth: width,
    fabricAverage: 1.06,
    fabricRate: 62.58,
    fabricTotal: 66.33,
    isNotApplicable: false,
  };
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: testUserId },
  });
  styleId = style.id;
});

afterAll(async () => {
  // Children (fabric/trim/accessory/lace/thread items) cascade from the sheet
  await prisma.style_costing.updateMany({ where: { styleId: only(styleId) }, data: { supersededById: null } });
  await prisma.style_costing.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  await prisma.$disconnect();
});

describe('POST /api/style-costing/:id/create-version', () => {
  it('keeps purpose, closed cost and budgets, takes the next free version, and supersedes the source', async () => {
    const v1 = await prisma.style_costing.create({
      data: {
        id: sheetId('v1'),
        styleId,
        createdById: testUserId,
        purpose: 'RAW_MATERIAL_CALCULATION',
        version: 1,
        isApproved: true,
        approvalStatus: 'APPROVED',
        fabricDetails: [fabricLine(40)],
        fabricTotal: 66.33,
        totalProductCost: 178,
        closedCost: 210,
        closedCostNotes: `${RUN} agreed with buyer`,
        fabricBudget: 70,
        fabricBufferPercent: 7,
        smockingCost: 4,
        widthCombinationHash: '40',
        widthCombinationDescription: '40"',
      },
    });
    // Another width combination in the same purpose already holds version 2
    await prisma.style_costing.create({
      data: {
        id: sheetId('w44'),
        styleId,
        createdById: testUserId,
        purpose: 'RAW_MATERIAL_CALCULATION',
        version: 2,
        widthCombinationHash: '44',
      },
    });

    const res = await request(app)
      .post(`/api/style-costing/${v1.id}/create-version`)
      .set(authHeader)
      .send({ versionReason: `${RUN} width corrected` })
      .expect(201);
    const newId: string = res.body.data.id;

    const v2 = await prisma.style_costing.findUnique({ where: { id: newId } });
    expect(v2).toMatchObject({
      purpose: 'RAW_MATERIAL_CALCULATION',
      version: 3,
      approvalStatus: 'PENDING',
      isApproved: false,
      closedCostNotes: `${RUN} agreed with buyer`,
      closedCostApprovedAt: null,
    });
    expect(Number(v2!.closedCost)).toBe(210);
    expect(Number(v2!.fabricBudget)).toBe(70);
    expect(Number(v2!.fabricBufferPercent)).toBe(7);
    expect(Number(v2!.smockingCost)).toBe(4);

    const oldV1 = await prisma.style_costing.findUnique({ where: { id: v1.id } });
    expect(oldV1!.supersededById).toBe(newId);
  });
});

describe('PUT /api/style-costing/:id — width combination label', () => {
  it('re-files the sheet under its new widths when the fabric lines change', async () => {
    const sheet = await prisma.style_costing.create({
      data: {
        id: sheetId('edit'),
        styleId,
        createdById: testUserId,
        purpose: 'COSTING',
        version: 1,
        fabricDetails: [fabricLine(40), fabricLine(40)],
        widthCombinationHash: '40-40',
        widthCombinationDescription: '40" + 40"',
      },
    });

    await request(app)
      .put(`/api/style-costing/${sheet.id}`)
      .set(authHeader)
      .send({ fabricDetails: [fabricLine(41.5), fabricLine(41.5)] })
      .expect(200);

    const after = await prisma.style_costing.findUnique({ where: { id: sheet.id } });
    expect(after!.widthCombinationHash).toBe('41.5-41.5');
    expect(after!.widthCombinationDescription).toBe('41.5" + 41.5"');
  });

  it('leaves the label alone on a save that does not send fabric lines', async () => {
    const sheet = await prisma.style_costing.create({
      data: {
        id: sheetId('nofab'),
        styleId,
        createdById: testUserId,
        purpose: 'PRODUCTION',
        version: 1,
        fabricDetails: [fabricLine(52)],
        widthCombinationHash: '52',
        widthCombinationDescription: '52"',
      },
    });

    await request(app)
      .put(`/api/style-costing/${sheet.id}`)
      .set(authHeader)
      .send({ notes: `${RUN} note` })
      .expect(200);

    const after = await prisma.style_costing.findUnique({ where: { id: sheet.id } });
    expect(after!.widthCombinationHash).toBe('52');
  });
});

// A saved sheet's purpose is its identity. The Cost Sheet page auto-switched its mode to whichever
// mode had fabric costing runs — in edit mode too — so ESSKY082LS's Raw Material v1 was saved with
// purpose COSTING and hit the (styleId, purpose, version) key (2026-09-25). With no clash, the same
// save would have silently turned the Raw Material sheet into a quotation.
describe('PUT /api/style-costing/:id — purpose is fixed once a sheet exists', () => {
  it('refuses a save that would change the purpose, and leaves the sheet as it was', async () => {
    await prisma.style_costing.create({
      data: {
        id: sheetId('qte'),
        styleId,
        createdById: testUserId,
        purpose: 'COSTING',
        version: 10,
        isApproved: true,
        approvalStatus: 'APPROVED',
      },
    });
    const raw = await prisma.style_costing.create({
      data: { id: sheetId('raw'), styleId, createdById: testUserId, purpose: 'RAW_MATERIAL_CALCULATION', version: 10 },
    });

    const res = await request(app)
      .put(`/api/style-costing/${raw.id}`)
      .set(authHeader)
      .send({ purpose: 'COSTING', closedCost: 200 })
      .expect(422);
    expect(res.body.message).toMatch(/Raw Material Calculation cost sheet — its mode can't be changed/);

    const after = await prisma.style_costing.findUnique({ where: { id: raw.id } });
    expect(after!.purpose).toBe('RAW_MATERIAL_CALCULATION');
    expect(after!.closedCost).toBeNull();
  });

  it('saves the closed cost when the page sends the sheet its own purpose', async () => {
    const raw = await prisma.style_costing.create({
      data: { id: sheetId('raw2'), styleId, createdById: testUserId, purpose: 'RAW_MATERIAL_CALCULATION', version: 11 },
    });

    await request(app)
      .put(`/api/style-costing/${raw.id}`)
      .set(authHeader)
      .send({ purpose: 'RAW_MATERIAL_CALCULATION', closedCost: 200 })
      .expect(200);

    const after = await prisma.style_costing.findUnique({ where: { id: raw.id } });
    expect(after!.purpose).toBe('RAW_MATERIAL_CALCULATION');
    expect(Number(after!.closedCost)).toBe(200);
  });
});
