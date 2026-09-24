/**
 * POST /api/mrp/requirements/:id/allocate-stock — a full allocation typed at 2 decimals closes the
 * requirement.
 *
 * MR2609-0084 (2026-09-24): 1,340.722 m required, the dialog pre-filled 1340.72, the server
 * compared the 0.002 m left with `=== 0`, and the row read "Partially from Stock" for 2 mm (and sat
 * in the "needs PO" lists). The same dialog pre-filled 2786.60 against a 2786.598 shortfall and
 * refused its own number. The server had no limit check at all.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `MAD${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let materialId: string;
let seq = 0;

async function makeRequirement(totalRequired: number) {
  seq += 1;
  return prisma.material_requirements.create({
    data: {
      id: randomUUID(),
      requirementNumber: `${RUN}-${seq}`,
      source: 'WORK_ORDER',
      unit: 'METER',
      materialId,
      orderQuantity: 2550,
      quantityPerUnit: 0.51,
      wastagePercent: 0,
      totalRequired,
      shortfall: totalRequired,
      status: 'PO_REQUIRED',
      requiredDate: new Date(Date.now() + 30 * 86400000),
      createdById: userId,
    },
  });
}

async function allocate(id: string, quantity: number, expected = 200) {
  return request(app)
    .post(`/api/mrp/requirements/${id}/allocate-stock`)
    .set(authHeader)
    .send({ quantity })
    .expect(expected);
}

async function reload(id: string) {
  const r = await prisma.material_requirements.findUniqueOrThrow({ where: { id } });
  return { status: r.status, shortfall: Number(r.shortfall), allocated: Number(r.allocatedFromStock) };
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

  const categoryId = (await prisma.material_categories.findFirstOrThrow({ select: { id: true } })).id;
  const material = await prisma.materials.create({
    data: {
      id: randomUUID(),
      code: `${RUN}-MAT`,
      name: `${RUN} Material`,
      categoryId,
      materialType: 'OTHER',
      unit: 'METER',
    },
  });
  materialId = material.id;
});

afterAll(async () => {
  const reqIds = (
    await prisma.material_requirements.findMany({ where: { materialId: only(materialId) }, select: { id: true } })
  ).map((r) => r.id);
  if (reqIds.length > 0) {
    await prisma.stock_reservations.deleteMany({ where: { referenceId: { in: reqIds } } });
    await prisma.material_requirements.deleteMany({ where: { id: { in: reqIds } } });
  }
  await prisma.materials.deleteMany({ where: { id: only(materialId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('allocate stock — rounding dust', () => {
  it('closes the requirement when the 2-decimal allocation leaves 2 mm (the MR2609-0084 case)', async () => {
    const req = await makeRequirement(1340.722);
    await allocate(req.id, 1340.72);
    expect(await reload(req.id)).toEqual({ status: 'FULFILLED_STOCK', shortfall: 0, allocated: 1340.722 });
  });

  it('accepts a full allocation rounded UP to 2 decimals and stores exactly the shortfall', async () => {
    const req = await makeRequirement(2786.598);
    await allocate(req.id, 2786.6);
    expect(await reload(req.id)).toEqual({ status: 'FULFILLED_STOCK', shortfall: 0, allocated: 2786.598 });
  });

  it('keeps a real partial allocation partial', async () => {
    const req = await makeRequirement(100);
    await allocate(req.id, 40);
    expect(await reload(req.id)).toEqual({ status: 'PARTIAL_STOCK', shortfall: 60, allocated: 40 });
  });

  it('refuses an allocation genuinely larger than the shortfall', async () => {
    const req = await makeRequirement(100);
    const res = await allocate(req.id, 105, 422);
    expect(res.body.message).toMatch(/still short/);
    expect(await reload(req.id)).toEqual({ status: 'PO_REQUIRED', shortfall: 100, allocated: 0 });
  });
});
