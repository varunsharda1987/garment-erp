/**
 * Requirement reservations hold named lots, and every cancel / shrink gives them back (2026-09-26).
 *
 * Before: allocateStock bumped lots' quantityReserved and wrote one stock_reservations row with no lot;
 * a cancelled requirement (new BOM version, requirement cancel, order cancel) kept its cloth reserved for
 * ever, so every later netting saw less free stock than was on the shelf. A lot's cap ignored what it
 * already had reserved, so two allocations could reserve more than a lot held.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { releaseReservations } from '../../services/helpers/stock-reservation.helper';

const RUN = `MRR${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let warehouseId: string;
let greigeId: string;
let materialId: string;
let oldLotId: string; // received 10 days ago — FIFO first
let newLotId: string;
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
      orderQuantity: 1000,
      quantityPerUnit: 0.35,
      wastagePercent: 0,
      totalRequired,
      shortfall: totalRequired,
      status: 'PO_REQUIRED',
      requiredDate: new Date(Date.now() + 30 * 86400000),
      createdById: userId,
    },
  });
}

const allocate = (id: string, quantity: number, expected = 200) =>
  request(app).post(`/api/mrp/requirements/${id}/allocate-stock`).set(authHeader).send({ quantity }).expect(expected);

const reservedOn = async (lotId: string) =>
  Number((await prisma.greige_stock.findUniqueOrThrow({ where: { id: lotId } })).quantityReserved ?? 0);

const activeRowsOf = (requirementId: string) =>
  prisma.stock_reservations.findMany({
    where: { referenceId: requirementId, status: 'ACTIVE' },
    orderBy: { reservedAt: 'asc' },
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
  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GRG`,
        greigeName: `${RUN} Viscose 63"`,
        genericGreigeName: `${RUN} Viscose`,
        composition: '100% Viscose',
        greigeWidth: 63,
        createdById: userId,
      },
    })
  ).id;
  materialId = await ensureMaterialRecord(greigeId, 'GREIGE');

  const lot = (quantityAvailable: number, daysAgo: number) =>
    prisma.greige_stock.create({
      data: {
        greigeId,
        quantityAvailable,
        greigeWidth: 63,
        receivedDate: new Date(Date.now() - daysAgo * 86400000),
        warehouseId,
        createdById: userId,
      },
    });
  oldLotId = (await lot(200, 10)).id;
  newLotId = (await lot(300, 0)).id;
});

afterAll(async () => {
  const reqIds = (
    await prisma.material_requirements.findMany({ where: { materialId: only(materialId) }, select: { id: true } })
  ).map((r) => r.id);
  if (reqIds.length > 0) {
    await prisma.stock_reservations.deleteMany({ where: { referenceId: { in: reqIds } } });
    await prisma.material_requirements.deleteMany({ where: { id: { in: reqIds } } });
  }
  await prisma.greige_stock.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.stock_levels.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.materials.deleteMany({ where: { id: only(materialId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('requirement reservations', () => {
  let reqA: string;
  let reqB: string;

  it('reserving across two lots writes one row per lot, each lot up by exactly its share', async () => {
    reqA = (await makeRequirement(350)).id;
    await allocate(reqA, 350);

    const rows = await activeRowsOf(reqA);
    expect(rows.map((r) => [r.greigeStockId, Number(r.reservedQuantity)])).toEqual([
      [oldLotId, 200],
      [newLotId, 150],
    ]);
    expect(await reservedOn(oldLotId)).toBe(200);
    expect(await reservedOn(newLotId)).toBe(150);
  });

  it('never reserves more than a lot has free, counting what is already reserved on it', async () => {
    reqB = (await makeRequirement(200)).id;
    const refused = await allocate(reqB, 200, 422);
    expect(refused.body.message).toMatch(/free/i);
    expect(await reservedOn(newLotId)).toBe(150);

    await allocate(reqB, 150);
    expect(await reservedOn(newLotId)).toBe(300);
    expect(await reservedOn(oldLotId)).toBe(200);
  });

  it('a shrink gives back the newest reservation first, to its own lot', async () => {
    const released = await prisma.$transaction((tx) => releaseReservations(tx, [reqA], 100));
    expect(released).toBe(100);
    expect(await reservedOn(newLotId)).toBe(200); // A's newest row (150 on the new lot) → 50
    expect(await reservedOn(oldLotId)).toBe(200);
    const rows = await activeRowsOf(reqA);
    expect(rows.map((r) => [r.greigeStockId, Number(r.reservedQuantity)])).toEqual([
      [oldLotId, 200],
      [newLotId, 50],
    ]);
  });

  it('cancelling a requirement returns all its lots, and leaves the other requirement’s hold alone', async () => {
    await request(app).delete(`/api/mrp/requirements/${reqA}`).set(authHeader).expect(200);

    expect(await reservedOn(oldLotId)).toBe(0);
    expect(await reservedOn(newLotId)).toBe(150); // B's hold only
    expect(await activeRowsOf(reqA)).toHaveLength(0);
    const closed = await prisma.stock_reservations.findMany({ where: { referenceId: reqA } });
    expect(closed.every((r) => r.status === 'CANCELLED')).toBe(true);
  });
});
