/**
 * A costing run keeps its own record (fabric_costing_run_items, 2026-09-26).
 *
 * A run used to be only the CAD rows pointing at it (fabric_width_cad.costingRunId). A row holds ONE
 * run id, so saving the same fabrics into Run 2 emptied Run 1, and re-costing a row rewrote every run
 * that pointed at it. This walks the real endpoints: save a run, re-cost a fabric, save the same
 * fabrics into Run 2, delete a CAD row — Run 1 must still read exactly as it was saved.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `CRR${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let styleId: string;
let cadA: string;
let cadB: string;

async function createCostedCad(name: string, total: number) {
  const cad = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      cutableWidth: 52,
      cadMeters: 2.1,
      cadAverage: 2,
      componentName: `${RUN}-${name}`,
      purpose: 'RAW_MATERIAL_CALCULATION',
      purposeEnum: 'RAW_MATERIAL_CALCULATION',
      approvalStatus: 'APPROVED',
      createdById: testUserId,
      costingStyleId: styleId,
      costInputMode: 'BUILD_UP',
      greigeCostPerMeter: total - 12,
      transportCostPerMeter: 2,
      processingPricePerMeter: 8,
      shrinkagePercent: 5,
      shrinkageCostPerMeter: 2,
      totalCostPerMeter: total,
      orderQuantityPcs: 1000,
      costedAtQuantityMeters: 2100,
    },
  });
  return cad.id;
}

const getRun = async (runId: string) =>
  (await request(app).get(`/api/fabric-costing-runs/${runId}`).set(authHeader).expect(200)).body.data;

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
  cadA = await createCostedCad('BODY', 52);
  cadB = await createCostedCad('YOKE', 40);
});

afterAll(async () => {
  // CAD rows first (items keep their figures: cadId → null), then runs (items cascade)
  await prisma.fabric_width_cad.deleteMany({ where: { componentName: { startsWith: RUN } } });
  await prisma.fabric_costing_run.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  await prisma.$disconnect();
});

describe('costing runs keep their own record', () => {
  let run1Id: string;

  it('freezes each fabric when the run is saved', async () => {
    const res = await request(app)
      .post(`/api/fabric-costing-runs/style/${styleId}`)
      .set(authHeader)
      .send({ purpose: 'RAW_MATERIAL_CALCULATION', fabricCadIds: [cadA, cadB] })
      .expect(201);
    run1Id = res.body.data.id;

    const run = await getRun(run1Id);
    expect(run.fabricCount).toBe(2);
    expect(run.fabrics.map((f: any) => f.componentName)).toEqual([`${RUN}-BODY`, `${RUN}-YOKE`]);
    const body = run.fabrics[0];
    expect(body).toMatchObject({
      cadId: cadA,
      backfilled: false,
      greigeCostPerMeter: 40,
      transportCostPerMeter: 2,
      processingPricePerMeter: 8,
      shrinkagePercent: 5,
      totalCostPerMeter: 52,
      cadAverage: 2,
      orderQuantityPcs: 1000,
      costPerGarment: 104,
      change: null,
    });
    expect(Number(run.totalFabricCost)).toBe(52 * 2 + 40 * 2);
    expect(run.changedCount).toBe(0);
  });

  it('keeps its figures when a fabric is re-costed, and shows today’s beside them', async () => {
    await request(app)
      .post('/api/fabric-costing/save')
      .set(authHeader)
      .send({
        styleId,
        fabricCostings: [
          {
            fabricWidthCadId: cadA,
            greigeCostPerMeter: 48,
            transportCostPerMeter: 2,
            processingCostPerMeter: 8,
            totalCostPerMeter: 60,
            costInputMode: 'BUILD_UP',
            purpose: 'RAW_MATERIAL_CALCULATION',
            orderQuantityPcs: 1000,
          },
        ],
      })
      .expect(200);

    const run = await getRun(run1Id);
    const body = run.fabrics.find((f: any) => f.cadId === cadA);
    expect(body.totalCostPerMeter).toBe(52); // the run's own figure
    expect(body.greigeCostPerMeter).toBe(40);
    expect(body.change).toBe('CHANGED');
    expect(body.now).toMatchObject({ totalCostPerMeter: 60, costPerGarment: 120 });
    expect(run.changedCount).toBe(1);
    expect(Number(run.totalFabricCost)).toBe(52 * 2 + 40 * 2); // totals do not follow the re-cost
  });

  it('is not emptied when the same fabrics are saved into Run 2', async () => {
    const res = await request(app)
      .post(`/api/fabric-costing-runs/style/${styleId}`)
      .set(authHeader)
      .send({ purpose: 'RAW_MATERIAL_CALCULATION', fabricCadIds: [cadA, cadB] })
      .expect(201);
    const run2 = await getRun(res.body.data.id);
    expect(run2.runName).toBe('Run 2');
    expect(run2.fabrics.find((f: any) => f.cadId === cadA).totalCostPerMeter).toBe(60);
    expect(run2.changedCount).toBe(0);

    const run1 = await getRun(run1Id);
    expect(run1.fabricCount).toBe(2);
    expect(run1.fabrics.every((f: any) => f.laterRunName === 'Run 2')).toBe(true);

    const list = await request(app)
      .get(`/api/fabric-costing-runs/style/${styleId}?purpose=RAW_MATERIAL_CALCULATION`)
      .set(authHeader)
      .expect(200);
    expect(list.body.data.map((r: any) => [r.runName, r.fabricCount])).toEqual([
      ['Run 2', 2],
      ['Run 1', 2],
    ]);
  });

  it('keeps a fabric whose CAD row is deleted, marked as removed', async () => {
    await prisma.fabric_width_cad.delete({ where: { id: cadB } });

    const run = await getRun(run1Id);
    const yoke = run.fabrics.find((f: any) => f.componentName === `${RUN}-YOKE`);
    expect(yoke).toMatchObject({ cadId: null, totalCostPerMeter: 40, change: 'REMOVED' });
    expect(run.fabricCount).toBe(2);
  });

  it('deleting a run deletes its record', async () => {
    await request(app).delete(`/api/fabric-costing-runs/${run1Id}`).set(authHeader).expect(200);
    expect(await prisma.fabric_costing_run_items.count({ where: { runId: run1Id } })).toBe(0);
  });
});
