/**
 * Removing a fabric costing option must NOT destroy the CAD entry behind it.
 *
 * fabric_width_cad is a hybrid row: CAD Planning owns the geometry, approval status and
 * children (cad_size_breakdown / cad_pattern_parts, both ON DELETE CASCADE); Fabric
 * Costing only decorates it with cost columns. DELETE /fabric-costing/option/:optionId
 * used to hard-delete the row, wiping approved CAD work — this pins the "un-cost, don't
 * delete" contract, its locked/approved guards, and the costing-run unlink.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `FCD${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let styleId: string;

/** Every costing-owned column deleteCostingOption must clear. */
const COSTING_FIELDS = [
  'costingStyleId',
  'totalCostPerMeter',
  'transportCostPerMeter',
  'processingPricePerMeter',
  'shrinkagePercent',
  'shrinkageCostPerMeter',
  'screenCostPerMeter',
  'screenType',
  'numberOfColors',
  'processorId',
  'rateCardId',
  'orderQuantityPcs',
  'costedAtQuantityMeters', // qty-rate audit 2026-08-24: slab-lookup basis is costing-owned
  'processingBatchGroupColorId',
  'costingRunId',
  // Two-owner split: un-costing also clears the PRICE approval (belt-and-braces)
  'costingApprovalStatus',
  'costingApprovedBy',
  'costingApprovedAt',
] as const;

/** A CAD row carrying both CAD-owned data and a full costing decoration. */
async function createCostedCadRow(overrides: Record<string, any> = {}) {
  return prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      // CAD-owned — must survive
      cutableWidth: 44,
      cadMeters: 1.85,
      cadAverage: 1.9,
      markerEfficiency: 82.5,
      componentName: `${RUN}-BODY`,
      purpose: 'COSTING',
      purposeEnum: 'COSTING',
      approvalStatus: 'PENDING',
      createdById: testUserId,
      sizeBreakdowns: { create: [{ sizeName: 'M', quantity: 10 }] },
      // Costing-owned — must be cleared
      costingStyleId: styleId,
      totalCostPerMeter: 120,
      transportCostPerMeter: 2,
      processingPricePerMeter: 30,
      shrinkagePercent: 5,
      shrinkageCostPerMeter: 4,
      screenCostPerMeter: 3,
      screenType: 'ROTARY',
      numberOfColors: 4,
      orderQuantityPcs: 500,
      costedAtQuantityMeters: 925, // 1.85 cadMeters × 500 pcs — slab-lookup basis
      costedRateIsBatch: true, // must reset to false on un-cost
      greigeCostPerMeter: 81,
      ...overrides,
    },
    include: { sizeBreakdowns: true },
  });
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
  await prisma.cad_size_breakdown.deleteMany({ where: { cad: { componentName: { startsWith: RUN } } } });
  await prisma.fabric_width_cad.deleteMany({ where: { componentName: { startsWith: RUN } } });
  await prisma.fabric_costing_run.deleteMany({ where: { styleId } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  await prisma.$disconnect();
});

describe('DELETE /api/fabric-costing/option/:optionId', () => {
  it('clears the costing but keeps the CAD entry and its size breakdowns', async () => {
    const cad = await createCostedCadRow();

    await request(app).delete(`/api/fabric-costing/option/${cad.id}`).set(authHeader).expect(200);

    const after = await prisma.fabric_width_cad.findUnique({
      where: { id: cad.id },
      include: { sizeBreakdowns: true },
    });

    // The CAD entry still exists, untouched
    expect(after).not.toBeNull();
    expect(Number(after!.cutableWidth)).toBe(44);
    expect(Number(after!.cadMeters)).toBe(1.85);
    expect(Number(after!.markerEfficiency)).toBe(82.5);
    expect(after!.componentName).toBe(`${RUN}-BODY`);
    expect(after!.purpose).toBe('COSTING');
    expect(after!.approvalStatus).toBe('PENDING');
    // Children were not cascade-deleted
    expect(after!.sizeBreakdowns).toHaveLength(1);
    expect(after!.sizeBreakdowns[0].sizeName).toBe('M');

    // Every costing-owned column is cleared
    for (const field of COSTING_FIELDS) {
      expect(after![field as keyof typeof after]).toBeNull();
    }
    // Boolean costing flag resets to its default rather than null
    expect(after!.costedRateIsBatch).toBe(false);
  });

  it('drops the row out of the style costing options list', async () => {
    const cad = await createCostedCadRow({ componentName: `${RUN}-SLEEVE` });

    const before = await request(app).get(`/api/fabric-costing/style/${styleId}/options`).set(authHeader).expect(200);
    expect(JSON.stringify(before.body)).toContain(cad.id);

    await request(app).delete(`/api/fabric-costing/option/${cad.id}`).set(authHeader).expect(200);

    const after = await request(app).get(`/api/fabric-costing/style/${styleId}/options`).set(authHeader).expect(200);
    expect(JSON.stringify(after.body)).not.toContain(cad.id);
  });

  it('refuses to touch a locked PRODUCTION option', async () => {
    const cad = await createCostedCadRow({ componentName: `${RUN}-LOCKED`, isLocked: true });

    await request(app).delete(`/api/fabric-costing/option/${cad.id}`).set(authHeader).expect(400);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after!.totalCostPerMeter).not.toBeNull();
    expect(after!.costingStyleId).toBe(styleId);
  });

  it('refuses to un-cost an option with an APPROVED costing (unapprove first)', async () => {
    // Two-owner split: the guard keys on the PRICE approval, not the CAD-geometry one
    const cad = await createCostedCadRow({
      componentName: `${RUN}-APPROVED`,
      costingApprovalStatus: 'APPROVED',
      costingApprovedBy: testUserId,
      costingApprovedAt: new Date(),
    });

    const res = await request(app).delete(`/api/fabric-costing/option/${cad.id}`).set(authHeader).expect(400);
    expect(res.body.message || res.body.error?.message).toMatch(/unapprove/i);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after!.costingApprovalStatus).toBe('APPROVED');
    expect(after!.totalCostPerMeter).not.toBeNull();
  });

  it('refuses to un-cost an ALTERNATE_APPROVED option too', async () => {
    const cad = await createCostedCadRow({
      componentName: `${RUN}-ALT`,
      costingApprovalStatus: 'ALTERNATE_APPROVED',
    });

    await request(app).delete(`/api/fabric-costing/option/${cad.id}`).set(authHeader).expect(400);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after!.costingApprovalStatus).toBe('ALTERNATE_APPROVED');
    expect(after!.totalCostPerMeter).not.toBeNull();
  });

  it('un-costs a CAD-geometry-APPROVED row whose costing is unapproved — and keeps the CAD approval', async () => {
    // Regression pin for the incident: CAD approval alone must never block costing operations
    const cad = await createCostedCadRow({
      componentName: `${RUN}-CADAPPR`,
      approvalStatus: 'APPROVED',
      approvedBy: testUserId,
      approvedAt: new Date(),
    });

    await request(app).delete(`/api/fabric-costing/option/${cad.id}`).set(authHeader).expect(200);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after).not.toBeNull();
    expect(after!.approvalStatus).toBe('APPROVED'); // CAD-geometry approval survives un-costing
    expect(after!.totalCostPerMeter).toBeNull();
    expect(after!.costingStyleId).toBeNull();
  });

  it('unlinks the row from its costing run, leaving the run in place', async () => {
    const run = await prisma.fabric_costing_run.create({
      data: {
        styleId,
        purpose: 'COSTING',
        runNumber: 1,
        runName: `${RUN} Run 1`,
        createdById: testUserId,
      },
    });
    const cad = await createCostedCadRow({ componentName: `${RUN}-RUNLINKED`, costingRunId: run.id });

    await request(app).delete(`/api/fabric-costing/option/${cad.id}`).set(authHeader).expect(200);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after).not.toBeNull();
    expect(after!.costingRunId).toBeNull();

    // The run survives, and now honestly reports zero fabrics / not complete
    const runRes = await request(app).get(`/api/fabric-costing-runs/${run.id}`).set(authHeader).expect(200);
    const runBody = runRes.body.data ?? runRes.body;
    expect(runBody.fabricCount).toBe(0);
    expect(runBody.isComplete).toBe(false);
  });
});
