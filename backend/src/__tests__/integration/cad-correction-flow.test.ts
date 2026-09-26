/**
 * Correct CAD — fixing an approved CAD after cost sheets and orders were built on it (2026-09-26).
 *
 * ESSKY082LS's average went 0.7033 → 0.8440 by Reject → edit → approve, and stopped at the CAD: the cost
 * sheets, the order BOM and the requirement stayed on 0.7033. Correct carries the change down:
 *   - nothing approved built on the row → applied at once;
 *   - an approved cost sheet built on it → the CAD waits; a new PENDING cost-sheet version carries the
 *     corrected line; the admin's approval applies the CAD, grants the price approval and rebuilds the
 *     order's BOM, whose requirements MRP carries over (same number); the admin's rejection restores the
 *     old sheet and leaves the CAD alone.
 *
 * Runs against the live DB; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { orderBomService } from '../../services/order-bom.service';
import { calculateRequirementsFromOrder } from '../../services/mrp.service';

const RUN = `CCF${Date.now().toString(36).toUpperCase()}`;
const QTY = 1000;
const OLD_AVG = 0.7033; // (3.4665 + 0.05 margin) ÷ 5 pieces
const NEW_AVG = 0.844; // (4.17 + 0.05) ÷ 5
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'].map((sizeName) => ({ sizeName, quantity: 1 }));
const CORRECTION = { layerLengthMeters: 4.17, sizeBreakdowns: SIZES, reason: 'layer was measured short' };

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let customerId: string;
let dyerId: string;
let greigeId: string;
let orderId: string;
let orderItemId: string;
const componentIds: string[] = [];
const styleFabricIds: string[] = [];
const cadIds: string[] = [];

async function cadRow(label: string, width: number) {
  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: `${RUN}-${label}`, componentType: 'MAIN' },
  });
  componentIds.push(component.id);
  const styleFabric = await prisma.style_fabrics.create({ data: { id: randomUUID(), componentId: component.id } });
  styleFabricIds.push(styleFabric.id);
  const cad = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      styleFabricId: styleFabric.id,
      componentName: `${RUN}-${label}`,
      cutableWidth: width,
      cadMeters: 3.4665,
      layerMarginMeters: 0.05,
      piecesPerMarker: 5,
      cadAverage: OLD_AVG,
      purpose: 'RAW_MATERIAL_CALCULATION',
      purposeEnum: 'RAW_MATERIAL_CALCULATION',
      approvalStatus: 'APPROVED',
      greigeId,
      processorId: dyerId,
      costingStyleId: styleId,
      costInputMode: 'BUILD_UP',
      greigeCostPerMeter: 50,
      processingPricePerMeter: 20,
      totalCostPerMeter: 70,
      orderQuantityPcs: QTY,
      costingApprovalStatus: 'APPROVED',
      createdById: userId,
      sizeBreakdowns: { create: SIZES },
    },
  });
  cadIds.push(cad.id);
  return cad;
}

/** A cost sheet whose fabric line was frozen from the CAD at the old average (APPROVED unless a draft) */
async function approvedSheetOn(cadId: string, width: number, draft = false) {
  const sheet = await prisma.style_costing.create({
    data: {
      id: `CS-${RUN}-${randomUUID().slice(0, 8)}`,
      styleId,
      createdById: userId,
      purpose: draft ? 'RAW_MATERIAL_CALCULATION' : 'COSTING',
      version: 1,
      approvalStatus: draft ? 'PENDING' : 'APPROVED',
      isApproved: !draft,
      fabricDetails: [
        { fabricCADId: cadId, fabricName: `${RUN} Moss`, fabricWidth: width, fabricAverage: OLD_AVG, fabricRate: 70 },
      ],
    },
  });
  await prisma.style_costing_fabric_items.create({
    data: {
      costingId: sheet.id,
      fabricCADId: cadId,
      fabricName: `${RUN} Moss`,
      colorName: 'Black',
      width,
      cadMeters: OLD_AVG,
      effectiveCad: OLD_AVG,
      costPerMeter: 70,
      totalCost: 49.23,
      sourcingStrategy: 'GREIGE_PROCESSED',
      greigeId,
      processorId: dyerId,
      greigeCost: 50,
      processingCost: 20,
    },
  });
  return sheet;
}

const correct = (cadId: string, expected: number) =>
  request(app)
    .post(`/api/cad-planning/${styleId}/row/${cadId}/correction`)
    .set(authHeader)
    .send(CORRECTION)
    .expect(expected);

const decide = (sheetId: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/style-costing/${sheetId}/approve`).set(authHeader).send(body).expect(200);

const cadOf = (id: string) => prisma.fabric_width_cad.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
    })
  ).id;
  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  dyerId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-DYE`,
        name: `${RUN} Dyer`,
        supplierCategories: ['DYEING_PRINTING'],
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GG`,
        greigeName: `${RUN} Moss`,
        genericGreigeName: `${RUN} Moss`,
        composition: '100% Viscose',
        greigeWidth: 63,
        createdById: userId,
      },
    })
  ).id;
  await ensureMaterialRecord(greigeId, 'GREIGE');
});

afterAll(async () => {
  const reqIds = orderId
    ? (await prisma.material_requirements.findMany({ where: { orderId }, select: { id: true } })).map((r) => r.id)
    : [];
  const bomIds = orderId
    ? (await prisma.order_bom.findMany({ where: { orderId }, select: { id: true } })).map((b) => b.id)
    : [];
  const sheetWhere = { styleId: only(styleId) };
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['stock_reservations', () => prisma.stock_reservations.deleteMany({ where: { referenceId: { in: reqIds } } })],
    ['material_requirements', () => prisma.material_requirements.deleteMany({ where: { id: { in: reqIds } } })],
    ['order_bom_items', () => prisma.order_bom_items.deleteMany({ where: { orderBomId: { in: bomIds } } })],
    ['order_bom', () => prisma.order_bom.deleteMany({ where: { id: { in: bomIds } } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: only(orderId) } })],
    ['cad_corrections', () => prisma.cad_corrections.deleteMany({ where: { cadId: { in: cadIds } } })],
    ['audit_logs', () => prisma.audit_logs.deleteMany({ where: { userId: only(userId) } })],
    [
      'style_costing supersede links',
      () => prisma.style_costing.updateMany({ where: sheetWhere, data: { supersededById: null } }),
    ],
    ['style_costing', () => prisma.style_costing.deleteMany({ where: sheetWhere })],
    ['style_material_bom', () => prisma.style_material_bom.deleteMany({ where: sheetWhere })],
    ['fabric_width_cad', () => prisma.fabric_width_cad.deleteMany({ where: { id: { in: cadIds } } })],
    ['style_fabrics', () => prisma.style_fabrics.deleteMany({ where: { id: { in: styleFabricIds } } })],
    ['style_components', () => prisma.style_components.deleteMany({ where: { id: { in: componentIds } } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['stock_levels', () => prisma.stock_levels.deleteMany({ where: { materials: { greigeId: only(greigeId) } } })],
    ['materials', () => prisma.materials.deleteMany({ where: { greigeId: only(greigeId) } })],
    ['greige_master', () => prisma.greige_master.deleteMany({ where: { id: only(greigeId) } })],
    ['suppliers', () => prisma.suppliers.deleteMany({ where: { id: only(dyerId) } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[cad-correction-flow teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('Correct a CAD nothing approved is built on', () => {
  it('applies at once, keeps the price approval when ₹/m did not move, and records it', async () => {
    const cad = await cadRow('FREE', 52);

    const preview = await request(app)
      .post(`/api/cad-planning/${styleId}/row/${cad.id}/correction/preview`)
      .set(authHeader)
      .send(CORRECTION)
      .expect(200);
    expect(preview.body.data.needsApproval).toBe(false);
    expect(preview.body.data.after.cadAverage).toBeCloseTo(NEW_AVG, 4);

    const res = await correct(cad.id, 201);
    expect(res.body.data.status).toBe('APPLIED');

    const after = await cadOf(cad.id);
    expect(Number(after.cadAverage)).toBeCloseTo(NEW_AVG, 4);
    expect(Number(after.cadMeters)).toBeCloseTo(4.17, 4);
    expect(Number(after.totalCostPerMeter)).toBe(70); // no rate card, same greige → same ₹/m
    expect(after.costingApprovalStatus).toBe('APPROVED');

    const events = await prisma.audit_logs.findMany({ where: { entityType: 'fabric_width_cad', entityId: cad.id } });
    expect(events.some((e) => e.action === 'CORRECT')).toBe(true);
  });
});

describe('Correct a CAD an approved cost sheet and an order are built on', () => {
  let cadId: string;
  let sheetV1: string;
  let draftSheet: string; // an unapproved sheet on the same CAD — follows it only once the admin approves
  const draftLine = () => prisma.style_costing_fabric_items.findFirstOrThrow({ where: { costingId: draftSheet } });
  let greigeReq: { id: string; requirementNumber: string; totalRequired: unknown };

  beforeAll(async () => {
    const cad = await cadRow('USED', 54);
    cadId = cad.id;
    sheetV1 = (await approvedSheetOn(cad.id, 54)).id;
    draftSheet = (await approvedSheetOn(cad.id, 54, true)).id;

    orderId = (
      await prisma.orders.create({
        data: {
          id: randomUUID(),
          orderNumber: `${RUN}ORD`,
          customerId,
          expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
          totalQuantity: QTY,
          totalAmount: 10 * QTY,
          createdById: userId,
        },
      })
    ).id;
    orderItemId = (
      await prisma.order_items.create({
        data: { id: randomUUID(), orderId, styleId, totalQuantity: QTY, unitPrice: 10, totalPrice: 10 * QTY },
      })
    ).id;
    const bom = await orderBomService.createFromCostSheet({
      orderId,
      styleId,
      orderItemId,
      costSheetId: sheetV1,
      createdById: userId,
    });
    await orderBomService.approve(bom.id, { approvedById: userId });
    await calculateRequirementsFromOrder({ orderId, checkStock: false }, userId);
    const reqs = await prisma.material_requirements.findMany({
      where: { orderId, requirementType: 'MATERIAL', status: { not: 'CANCELLED' } },
    });
    expect(reqs).toHaveLength(1);
    greigeReq = reqs[0];
  });

  let pendingSheet: string;

  it('leaves the CAD alone and puts the corrected line on a new PENDING cost-sheet version', async () => {
    const preview = await request(app)
      .post(`/api/cad-planning/${styleId}/row/${cadId}/correction/preview`)
      .set(authHeader)
      .send(CORRECTION)
      .expect(200);
    expect(preview.body.data.needsApproval).toBe(true);
    expect(preview.body.data.costSheets.map((s: { costSheetId: string }) => s.costSheetId)).toContain(sheetV1);
    expect(preview.body.data.orders.map((o: { orderNumber: string }) => o.orderNumber)).toContain(`${RUN}ORD`);

    const res = await correct(cadId, 201);
    expect(res.body.data.status).toBe('PENDING_APPROVAL');
    const correction = await prisma.cad_corrections.findFirstOrThrow({ where: { cadId, status: 'PENDING_APPROVAL' } });
    expect(correction.newCostSheetIds).toHaveLength(1);
    pendingSheet = correction.newCostSheetIds[0];

    expect(Number((await cadOf(cadId)).cadAverage)).toBeCloseTo(OLD_AVG, 4);
    const v2 = await prisma.style_costing.findUniqueOrThrow({
      where: { id: pendingSheet },
      include: { fabricItems: true },
    });
    expect(v2.approvalStatus).toBe('PENDING');
    expect(Number(v2.fabricItems[0].cadMeters)).toBeCloseTo(NEW_AVG, 4);

    // The draft sheet waits for the admin's decision too
    expect(Number((await draftLine()).cadMeters)).toBeCloseTo(OLD_AVG, 4);

    // A correction's version is rejected, never deleted (the correction would wait for ever)
    const del = await request(app).delete(`/api/style-costing/${pendingSheet}`).set(authHeader).expect(409);
    expect(del.body.details.code).toBe('COST_SHEET_OF_CAD_CORRECTION');

    // One correction at a time
    const again = await correct(cadId, 409);
    expect(again.body.details.code).toBe('CAD_CORRECTION_PENDING');

    const pending = await request(app)
      .get(`/api/cad-planning/${styleId}/corrections/pending`)
      .set(authHeader)
      .expect(200);
    expect(JSON.stringify(pending.body.data)).toContain(cadId);
    const banner = await request(app)
      .get(`/api/cad-planning/corrections/by-cost-sheet/${pendingSheet}`)
      .set(authHeader)
      .expect(200);
    expect(banner.body.data.id).toBe(correction.id);
  });

  it('the admin rejecting the version drops the correction and restores the old sheet', async () => {
    await decide(pendingSheet, { action: 'reject', rejectionNotes: 'keep 0.7033 for now' });

    const correction = await prisma.cad_corrections.findFirstOrThrow({
      where: { cadId },
      orderBy: { correctedAt: 'desc' },
    });
    expect(correction.status).toBe('REJECTED');
    const v1 = await prisma.style_costing.findUniqueOrThrow({ where: { id: sheetV1 } });
    expect(v1.supersededById).toBeNull();
    expect(v1.approvalStatus).toBe('APPROVED');
    expect(Number((await cadOf(cadId)).cadAverage)).toBeCloseTo(OLD_AVG, 4);
    expect(Number((await draftLine()).cadMeters)).toBeCloseTo(OLD_AVG, 4);
  });

  it('the admin approving the version corrects the CAD, rebuilds the order BOM and carries the requirement over', async () => {
    await correct(cadId, 201);
    const correction = await prisma.cad_corrections.findFirstOrThrow({ where: { cadId, status: 'PENDING_APPROVAL' } });
    const sheet = correction.newCostSheetIds[0];

    const res = await decide(sheet, { action: 'approve' });
    expect(res.body.warning).toBeUndefined();

    const cad = await cadOf(cadId);
    expect(Number(cad.cadAverage)).toBeCloseTo(NEW_AVG, 4);
    expect(cad.costingApprovalStatus).toBe('APPROVED');
    expect(cad.costingApprovedBy).toBe(userId);
    expect(Number((await draftLine()).cadMeters)).toBeCloseTo(NEW_AVG, 4);

    const done = await prisma.cad_corrections.findUniqueOrThrow({ where: { id: correction.id } });
    expect(done.status).toBe('APPLIED');
    const orders = (done.appliedOrders as { orders?: Array<{ status: string; newBomVersion?: number }> }).orders ?? [];
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe('UPDATED');

    const activeBom = await prisma.order_bom.findFirstOrThrow({
      where: { orderId, isActive: true },
      include: { items: true },
    });
    expect(activeBom.status).toBe('APPROVED');
    expect(activeBom.sourceCostSheetId).toBe(sheet);
    expect(Number(activeBom.items[0].quantityPerGarment)).toBeCloseTo(NEW_AVG, 4);
    expect(activeBom.items[0].previousItemId).not.toBeNull();

    // Same requirement, same number, the new need
    const live = await prisma.material_requirements.findMany({
      where: { orderId, requirementType: 'MATERIAL', status: { not: 'CANCELLED' } },
    });
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe(greigeReq.id);
    expect(live[0].requirementNumber).toBe(greigeReq.requirementNumber);
    expect(live[0].orderBomItemId).toBe(activeBom.items[0].id);
    expect(Number(live[0].totalRequired)).toBeCloseTo((Number(greigeReq.totalRequired) * NEW_AVG) / OLD_AVG, 1);
  });
});
