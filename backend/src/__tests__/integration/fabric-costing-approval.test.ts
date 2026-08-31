/**
 * Two-owner approval split on fabric_width_cad (2026-08-22).
 *
 * approvalStatus/approvedBy/approvedAt = CAD-GEOMETRY approval (CAD Planning).
 * costingApprovalStatus/costingApprovedBy/costingApprovedAt = PRICE approval (Fabric Costing).
 *
 * This suite pins the contract that ended the LNG281 incident: a CAD-approved row with no
 * costing must accept its FIRST costing save; an approved PRICE stays locked until
 * unapproved; approval operations never touch the other lifecycle's columns.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `FCA${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let styleId: string;

/** A CAD row carrying CAD-owned data; costing decoration via overrides. */
async function createCadRow(overrides: Record<string, any> = {}) {
  return prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      cutableWidth: 52,
      cadMeters: 2.1,
      cadAverage: 2.16,
      componentName: `${RUN}-BODY`,
      purpose: 'RAW_MATERIAL_CALCULATION',
      purposeEnum: 'RAW_MATERIAL_CALCULATION',
      approvalStatus: 'PENDING',
      createdById: testUserId,
      ...overrides,
    },
  });
}

/** Same row shape with a full costing decoration. */
async function createCostedCadRow(overrides: Record<string, any> = {}) {
  return createCadRow({
    costingStyleId: styleId,
    totalCostPerMeter: 52,
    greigeCostPerMeter: 50,
    transportCostPerMeter: 2,
    orderQuantityPcs: 1000,
    ...overrides,
  });
}

/** A cost sheet on the test style (approvalStatus via overrides).
 *  version auto-increments — style_costing is unique on (styleId, purpose, version). */
let sheetVersionCounter = 0;
async function createCostSheet(overrides: Record<string, any> = {}) {
  sheetVersionCounter += 1;
  return prisma.style_costing.create({
    data: {
      id: `CS-${RUN}-${randomUUID().slice(0, 8)}`,
      styleId,
      createdById: testUserId,
      purpose: 'RAW_MATERIAL_CALCULATION',
      version: sheetVersionCounter,
      ...overrides,
    },
  });
}

/** Freeze a fabric-item snapshot from a CAD row onto a cost sheet. */
async function linkSheetItem(costingId: string, cadId: string) {
  return prisma.style_costing_fabric_items.create({
    data: {
      costingId,
      fabricCADId: cadId,
      fabricName: `${RUN} Fabric`,
      width: 52,
      cadMeters: 2.16,
      costPerMeter: 52,
      totalCost: 112.32,
    },
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
  // Guard-test fixtures first (FK order: items cascade from sheets/orders)
  await prisma.style_costing.deleteMany({ where: { id: { startsWith: `CS-${RUN}` } } });
  await prisma.orders.deleteMany({ where: { orderNumber: { startsWith: RUN } } });
  await prisma.customers.deleteMany({ where: { code: { startsWith: RUN } } });
  await prisma.fabric_width_cad.deleteMany({ where: { componentName: { startsWith: RUN } } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  await prisma.$disconnect();
});

describe('POST /api/fabric-costing/option/:optionId/approve', () => {
  it('refuses to approve an option with no costing (CAD-approved only)', async () => {
    const cad = await createCadRow({
      componentName: `${RUN}-NOCOST`,
      costingStyleId: styleId,
      approvalStatus: 'APPROVED', // CAD-approved phantom shape from the incident
    });

    const res = await request(app)
      .post(`/api/fabric-costing/option/${cad.id}/approve`)
      .set(authHeader)
      .send({})
      .expect(400);
    expect(res.body.message).toMatch(/no costing yet/i);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after!.costingApprovalStatus).toBeNull();
    expect(after!.approvalStatus).toBe('APPROVED'); // CAD approval untouched
  });

  it('approves a costed option via the costing columns and never touches CAD approval', async () => {
    const cad = await createCostedCadRow({ componentName: `${RUN}-APPR1` });

    const res = await request(app)
      .post(`/api/fabric-costing/option/${cad.id}/approve`)
      .set(authHeader)
      .send({})
      .expect(200);
    // Alias contract: response exposes the price approval under the historical key
    expect(res.body.data.approvalStatus).toBe('APPROVED');

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after!.costingApprovalStatus).toBe('APPROVED');
    expect(after!.costingApprovedBy).toBe(testUserId);
    expect(after!.costingApprovedAt).not.toBeNull();
    expect(after!.isPreferred).toBe(true);
    expect(after!.approvalStatus).toBe('PENDING'); // CAD-geometry approval untouched
  });

  it('demotes the costed sibling to ALTERNATE_APPROVED without touching its CAD approval', async () => {
    const shared = { componentName: `${RUN}-SIB` };
    const a = await createCostedCadRow({ ...shared, cutableWidth: 44 });
    const b = await createCostedCadRow({
      ...shared,
      cutableWidth: 44,
      totalCostPerMeter: 60,
      approvalStatus: 'APPROVED',
    });

    await request(app).post(`/api/fabric-costing/option/${a.id}/approve`).set(authHeader).send({}).expect(200);
    await request(app).post(`/api/fabric-costing/option/${b.id}/approve`).set(authHeader).send({}).expect(200);

    const afterA = await prisma.fabric_width_cad.findUnique({ where: { id: a.id } });
    const afterB = await prisma.fabric_width_cad.findUnique({ where: { id: b.id } });
    // Second approve wins; first becomes the alternate — no P2002 from the partial index
    expect(afterB!.costingApprovalStatus).toBe('APPROVED');
    expect(afterA!.costingApprovalStatus).toBe('ALTERNATE_APPROVED');
    expect(afterA!.isPreferred).toBe(false);
    // Sibling demote must not revoke CAD approvals (the old shared column silently did)
    expect(afterB!.approvalStatus).toBe('APPROVED');
    expect(afterA!.approvalStatus).toBe('PENDING');
  });
});

describe('POST /api/fabric-costing/save — first costing onto a CAD-approved row', () => {
  it('accepts the FIRST costing save onto {approvalStatus: APPROVED, cost: null} (the incident)', async () => {
    const cad = await createCadRow({
      componentName: `${RUN}-FIRSTSAVE`,
      approvalStatus: 'APPROVED',
      approvedBy: testUserId,
      approvedAt: new Date(),
    });

    await request(app)
      .post('/api/fabric-costing/save')
      .set(authHeader)
      .send({
        styleId,
        fabricCostings: [
          {
            fabricWidthCadId: cad.id,
            greigeCostPerMeter: 50,
            transportCostPerMeter: 2,
            totalCostPerMeter: 52,
            costInputMode: 'BUILD_UP',
            purpose: 'RAW_MATERIAL_CALCULATION',
            orderQuantityPcs: 1000,
          },
        ],
      })
      .expect(200);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(Number(after!.totalCostPerMeter)).toBe(52);
    expect(after!.approvalStatus).toBe('APPROVED'); // CAD approval survives the save
    expect(after!.costingApprovalStatus).toBeNull(); // price still needs its own approval
  });

  it('rejects re-pricing a row whose costing is APPROVED, with a human message', async () => {
    const cad = await createCostedCadRow({
      componentName: `${RUN}-LOCKEDPRICE`,
      costingApprovalStatus: 'APPROVED',
    });

    const res = await request(app)
      .post('/api/fabric-costing/save')
      .set(authHeader)
      .send({
        styleId,
        fabricCostings: [{ fabricWidthCadId: cad.id, totalCostPerMeter: 99, purpose: 'RAW_MATERIAL_CALCULATION' }],
      })
      .expect(400);
    expect(res.body.message).toMatch(/approved option/i);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(Number(after!.totalCostPerMeter)).toBe(52); // price unchanged
  });

  it('rejects client-sent costingApprovalStatus on save (approve endpoint only)', async () => {
    const cad = await createCostedCadRow({ componentName: `${RUN}-SNEAK` });

    await request(app)
      .post('/api/fabric-costing/save')
      .set(authHeader)
      .send({
        styleId,
        fabricCostings: [{ fabricWidthCadId: cad.id, totalCostPerMeter: 52, costingApprovalStatus: 'APPROVED' }],
      })
      .expect(403);
  });
});

describe('PATCH /api/fabric-costing/option/:optionId/unapprove', () => {
  it('clears the price approval + isPreferred and leaves CAD approval alone', async () => {
    const cad = await createCostedCadRow({
      componentName: `${RUN}-UNAPPR`,
      approvalStatus: 'APPROVED',
      costingApprovalStatus: 'APPROVED',
      costingApprovedBy: testUserId,
      costingApprovedAt: new Date(),
      isPreferred: true,
    });

    await request(app).patch(`/api/fabric-costing/option/${cad.id}/unapprove`).set(authHeader).send({}).expect(200);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after!.costingApprovalStatus).toBeNull();
    expect(after!.costingApprovedBy).toBeNull();
    expect(after!.costingApprovedAt).toBeNull();
    expect(after!.isPreferred).toBe(false);
    expect(after!.approvalStatus).toBe('APPROVED'); // CAD approval untouched
  });
});

describe('PATCH unapprove — downstream dependents guard (ESSKY091LS)', () => {
  it('hard-blocks when an active APPROVED cost sheet froze this price — even with confirmImpact', async () => {
    const cad = await createCostedCadRow({
      componentName: `${RUN}-GUARD1`,
      costingApprovalStatus: 'APPROVED',
      costingApprovedBy: testUserId,
      costingApprovedAt: new Date(),
      isPreferred: true,
    });
    const sheet = await createCostSheet({ approvalStatus: 'APPROVED' });
    await linkSheetItem(sheet.id, cad.id);

    const res = await request(app)
      .patch(`/api/fabric-costing/option/${cad.id}/unapprove`)
      .set(authHeader)
      .send({})
      .expect(409);
    expect(res.body.details.code).toBe('COSTING_OPTION_IN_USE');
    expect(res.body.details.blocking).toBe(true);
    expect(res.body.details.dependents.blockingCostSheets.map((s: any) => s.costSheetId)).toContain(sheet.id);

    // The hard block is not bypassable by the confirm flag
    await request(app)
      .patch(`/api/fabric-costing/option/${cad.id}/unapprove`)
      .set(authHeader)
      .send({ confirmImpact: true })
      .expect(409);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after!.costingApprovalStatus).toBe('APPROVED'); // DB untouched
    expect(after!.isPreferred).toBe(true);
  });

  it('draft (PENDING) sheet dependents require confirmImpact, then unapprove succeeds', async () => {
    const cad = await createCostedCadRow({
      componentName: `${RUN}-GUARD2`,
      costingApprovalStatus: 'APPROVED',
      costingApprovedBy: testUserId,
      costingApprovedAt: new Date(),
    });
    const sheet = await createCostSheet({}); // approvalStatus defaults to PENDING
    await linkSheetItem(sheet.id, cad.id);

    const res = await request(app)
      .patch(`/api/fabric-costing/option/${cad.id}/unapprove`)
      .set(authHeader)
      .send({})
      .expect(409);
    expect(res.body.details.blocking).toBe(false);
    expect(res.body.details.requiresConfirmation).toBe(true);

    await request(app)
      .patch(`/api/fabric-costing/option/${cad.id}/unapprove`)
      .set(authHeader)
      .send({ confirmImpact: true })
      .expect(200);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after!.costingApprovalStatus).toBeNull();
  });

  it('a superseded APPROVED sheet is history — unapprove stays one click', async () => {
    const cad = await createCostedCadRow({
      componentName: `${RUN}-GUARD3`,
      costingApprovalStatus: 'APPROVED',
      costingApprovedBy: testUserId,
      costingApprovedAt: new Date(),
    });
    const v2 = await createCostSheet({});
    const v1 = await createCostSheet({ approvalStatus: 'APPROVED', supersededById: v2.id });
    await linkSheetItem(v1.id, cad.id); // only the superseded sheet points at the CAD

    await request(app).patch(`/api/fabric-costing/option/${cad.id}/unapprove`).set(authHeader).send({}).expect(200);
  });

  it('an active order BOM dependent warns + confirms (frozen rate stays on the BOM)', async () => {
    const cad = await createCostedCadRow({
      componentName: `${RUN}-GUARD4`,
      costingApprovalStatus: 'APPROVED',
      costingApprovedBy: testUserId,
      costingApprovedAt: new Date(),
    });
    const customer = await prisma.customers.create({
      data: {
        code: `${RUN}C`,
        name: `${RUN} Customer`,
        type: 'BUYER',
        category: 'DOMESTIC',
        createdById: testUserId,
      },
    });
    const order = await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: `${RUN}ORD1`,
        customerId: customer.id,
        expectedDeliveryDate: new Date(),
        totalQuantity: 100,
        totalAmount: 10000,
        createdById: testUserId,
      },
    });
    const bom = await prisma.order_bom.create({
      data: { orderId: order.id, styleId, createdById: testUserId, status: 'APPROVED' },
    });
    await prisma.order_bom_items.create({
      data: {
        orderBomId: bom.id,
        materialType: 'FABRIC',
        selectedCadId: cad.id,
        quantityPerGarment: 2.16,
        orderQuantity: 100,
        totalQuantity: 216,
        unit: 'METERS',
        unitPrice: 52,
        totalCost: 11232,
      },
    });

    const res = await request(app)
      .patch(`/api/fabric-costing/option/${cad.id}/unapprove`)
      .set(authHeader)
      .send({})
      .expect(409);
    expect(res.body.details.blocking).toBe(false);
    expect(res.body.details.requiresConfirmation).toBe(true);
    expect(res.body.details.dependents.orderBoms.map((b: any) => b.orderNumber)).toContain(`${RUN}ORD1`);

    await request(app)
      .patch(`/api/fabric-costing/option/${cad.id}/unapprove`)
      .set(authHeader)
      .send({ confirmImpact: true })
      .expect(200);

    // The BOM keeps its frozen rate — the guard never rewrites snapshots
    const bomItem = await prisma.order_bom_items.findFirst({ where: { selectedCadId: cad.id } });
    expect(Number(bomItem!.unitPrice)).toBe(52);
  });
});

describe('POST /api/fabric-costing/option/:optionId/promote', () => {
  it('refuses to promote an unapproved-costing option', async () => {
    const cad = await createCostedCadRow({ componentName: `${RUN}-PROM1` });

    const res = await request(app)
      .post(`/api/fabric-costing/option/${cad.id}/promote`)
      .set(authHeader)
      .send({ targetPurpose: 'PRODUCTION' })
      .expect(400);
    expect(res.body.message).toMatch(/approved costing/i);
  });

  it('promoted copy is not born price-approved', async () => {
    const cad = await createCostedCadRow({
      componentName: `${RUN}-PROM2`,
      costingApprovalStatus: 'APPROVED',
      costingApprovedBy: testUserId,
      costingApprovedAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/fabric-costing/option/${cad.id}/promote`)
      .set(authHeader)
      .send({ targetPurpose: 'PRODUCTION' })
      .expect(200);

    const promoted = await prisma.fabric_width_cad.findUnique({ where: { id: res.body.data.id } });
    expect(promoted!.purpose).toBe('PRODUCTION');
    expect(promoted!.isLocked).toBe(true);
    expect(promoted!.costingApprovalStatus).toBeNull();
    expect(promoted!.costingApprovedBy).toBeNull();
    expect(promoted!.approvalStatus).toBe('PENDING');
  });
});

describe('rejectCADPlan cascade', () => {
  it('style-level CAD rejection also resets price approvals (numbers kept)', async () => {
    // Build the full chain: component -> style_fabric -> CAD row, style CAD approved
    const component = await prisma.style_components.create({
      data: { id: randomUUID(), styleId, componentName: `${RUN}-COMP`, componentType: 'MAIN' },
    });
    const styleFabric = await prisma.style_fabrics.create({
      data: { id: randomUUID(), componentId: component.id },
    });
    const cad = await createCostedCadRow({
      componentName: `${RUN}-REJ`,
      styleFabricId: styleFabric.id,
      approvalStatus: 'APPROVED',
      costingApprovalStatus: 'APPROVED',
      costingApprovedBy: testUserId,
      costingApprovedAt: new Date(),
      isPreferred: true,
    });
    await prisma.styles.update({ where: { id: styleId }, data: { cadStatus: 'APPROVED' } });

    await request(app)
      .put(`/api/cad-planning/${styleId}/reject-cad`)
      .set(authHeader)
      .send({ rejectionReason: 'geometry rework needed' })
      .expect(200);

    const after = await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } });
    expect(after!.approvalStatus).toBe('PENDING'); // CAD side reset (pre-existing behavior)
    expect(after!.costingApprovalStatus).toBeNull(); // NEW: price approval reset too
    expect(after!.isPreferred).toBe(false);
    expect(Number(after!.totalCostPerMeter)).toBe(52); // cost numbers kept
  });
});
