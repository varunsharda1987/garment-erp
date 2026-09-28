/**
 * POST /api/mrp/requirements/:id/allocate-stock — a full allocation typed at 2 decimals closes the
 * requirement.
 *
 * MR2609-0084 (2026-09-24): 1,340.722 m required, the dialog pre-filled 1340.72, the server
 * compared the 0.002 m left with `=== 0`, and the row read "Partially from Stock" for 2 mm (and sat
 * in the "needs PO" lists). The same dialog pre-filled 2786.60 against a 2786.598 shortfall and
 * refused its own number. The server had no limit check at all.
 *
 * Use Stock on a trim is capped by what is free on the shelf (po-allocation D2), so the fixture is a real
 * trim — an other-material master, its materials row and a 5,000 m lot — not a bare materials row.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';

const RUN = `MAD${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let materialId: string;
let masterId: string;
let warehouseId: string;
let seq = 0;

/** On the shelf: enough for every allocation below together (1,340.722 + 2,786.598 + 40) */
const ON_HAND = 5000;

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

  warehouseId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-ST`,
        warehouseName: `${RUN} Store`,
        warehouseType: 'RAW_MATERIAL',
        createdById: userId,
      },
    })
  ).id;
  masterId = (
    await prisma.other_material_master.create({
      data: { materialCode: `${RUN}-OTH`, materialName: `${RUN} Tape`, unit: 'METER' },
    })
  ).id;
  materialId = await ensureMaterialRecord(masterId, 'OTHER_MATERIAL');
  // Counted in metres, like the requirements below (a line's unit is its material's unit)
  await prisma.materials.update({ where: { id: materialId }, data: { unit: 'METER' } });
  await prisma.other_material_stock.create({
    data: {
      otherMaterialId: masterId,
      quantityAvailable: ON_HAND,
      unit: 'METER',
      purchaseCost: 1,
      weightedAvgCost: 1,
      receivedDate: new Date(),
      warehouseId,
    },
  });
});

afterAll(async () => {
  const reqIds = (
    await prisma.material_requirements.findMany({ where: { materialId: only(materialId) }, select: { id: true } })
  ).map((r) => r.id);
  if (reqIds.length > 0) {
    await prisma.stock_reservations.deleteMany({ where: { referenceId: { in: reqIds } } });
    await prisma.material_requirements.deleteMany({ where: { id: { in: reqIds } } });
  }
  await prisma.other_material_stock.deleteMany({ where: { otherMaterialId: only(masterId) } });
  await prisma.materials.deleteMany({ where: { id: only(materialId) } });
  await prisma.other_material_master.deleteMany({ where: { id: only(masterId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
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

  it('refuses more than the shelf holds (USE_STOCK_SHORT) and leaves the requirement as it was', async () => {
    const req = await makeRequirement(ON_HAND + 1000);
    const res = await allocate(req.id, ON_HAND + 500, 422);
    expect(res.body.details).toMatchObject({ code: 'USE_STOCK_SHORT', onHand: ON_HAND });
    expect(res.body.message).toMatch(/cannot be allocated from stock/);
    expect(await reload(req.id)).toEqual({ status: 'PO_REQUIRED', shortfall: ON_HAND + 1000, allocated: 0 });
  });
});
