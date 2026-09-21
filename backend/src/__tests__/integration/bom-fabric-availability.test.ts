/**
 * Push-to-cutting must find the dyed fabric an order's BOM line asks for, even though the BOM line
 * carries no fabricId.
 *
 * `order_bom_items.fabricId` is null BY DESIGN at BOM time (the finished fabric does not exist yet);
 * it is stamped later only when the CAD row's style slot already has a fabricId. The first real
 * order-backed run (ORD2026080025 / ESSKY085LS, 2026-09-21) had 1,704 m received for the style and
 * `validateMaterialAvailabilityForStage` still read "Available: 0.00", because it aggregated
 * fabric_stock on `fabricId: ''`. The material-readiness endpoint the run page reads said the same.
 *
 * Pinned contract (`availableFabricForBomLine` in productionBlockingValidation.service.ts):
 *   - a greige line with no fabricId counts AVAILABLE lots of any fabric master made FROM that
 *     greige that belong to the style: received for it (originStyleId), for the order
 *     (originOrderId), or allocated to it in Fabric Master (style_fabrics.fabricId)
 *   - another style's fabric from the same greige never counts
 *   - a line with a stamped fabricId keeps the old rule (that master's lots)
 *   - the shortage message says what to do when nothing could be matched
 *
 * Runs against the LIVE database on tagged fixtures; everything is deleted in afterAll. Samples are
 * deliberately absent, so push-to-cutting is always refused — the assertions are on WHICH blockers
 * the refusal names, exactly as the run page would show them.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `BAV${Date.now().toString(36).toUpperCase()}`;

let adminId: string;
let adminHeader: Record<string, string>;
let customerId: string;
let styleId: string;
let otherStyleId: string;
let componentId: string;
let styleFabricId: string;
let greigeId: string;
let fabricId: string;
let orderId: string;
let orderBomId: string;
let bomItemId: string;
let workOrderId: string;
let lotId: string | null = null;

const REQUIRED = 150; // 100 pcs × 1.5 m
const LOT_METERS = 200;

const expectStatus = (res: request.Response, status: number) => {
  if (res.status !== status) {
    throw new Error(`expected HTTP ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
};

async function readiness() {
  const res = await request(app).get(`/api/work-orders/${workOrderId}/material-readiness`).set(adminHeader);
  expectStatus(res, 200);
  return res.body.data as {
    isReady: boolean;
    hasApprovedBom: boolean;
    missingMaterials: Array<{ materialName: string; available: number; required: number }>;
  };
}

async function pushRefusal() {
  const res = await request(app).post(`/api/work-orders/${workOrderId}/push-to-cutting`).set(adminHeader).send({});
  expectStatus(res, 422);
  return res.body.message as string;
}

async function createLot(originStyle: string | null) {
  const lot = await prisma.fabric_stock.create({
    data: {
      id: randomUUID(),
      fabricId,
      originStyleId: originStyle,
      finishedWidth: 54,
      cutableWidth: 52,
      quantityAvailable: LOT_METERS,
      weightedAvgCost: 100,
      purchaseCost: 100,
      receivedDate: new Date(),
      status: 'AVAILABLE',
      createdById: adminId,
    },
  });
  lotId = lot.id;
}

beforeAll(async () => {
  const admin = await createTestUser({
    email: `test-${RUN.toLowerCase()}-admin@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = admin.id;
  adminHeader = getAuthHeader(admin.id, 'ADMIN');

  const customer = await prisma.customers.create({
    data: { code: `${RUN}-CUST`, name: `${RUN} Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: adminId },
  });
  customerId = customer.id;

  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Dress`, createdById: adminId },
  });
  otherStyleId = randomUUID();
  await prisma.styles.create({
    data: { id: otherStyleId, styleCode: `${RUN}-OTH`, styleName: `${RUN} Other style`, createdById: adminId },
  });

  // The style's Top slot: a generic greige, no finished fabric linked yet (as StyleForm leaves it).
  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: 'Top', componentType: 'MAIN' },
  });
  componentId = component.id;
  const greige = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-GRG`,
      greigeName: `${RUN} Viscose Moss`,
      genericGreigeName: `${RUN} Viscose Moss`,
      composition: '100% Viscose',
      greigeWidth: 56,
      createdById: adminId,
    },
  });
  greigeId = greige.id;
  const slot = await prisma.style_fabrics.create({
    data: { id: randomUUID(), componentId, genericGreigeName: greige.genericGreigeName, fabricId: null },
  });
  styleFabricId = slot.id;

  // The dyed fabric master the job-work return minted FROM that greige (lineage stamped).
  const fabric = await prisma.fabric_master.create({
    data: {
      id: randomUUID(),
      fabricCode: `${RUN}-FAB`,
      fabricName: `${RUN} Viscose Moss dyed`,
      greigeId,
      createdById: adminId,
    },
  });
  fabricId = fabric.id;

  const order = await prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber: `${RUN}-ORD`,
      customerId,
      orderDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
      totalQuantity: 100,
      totalAmount: 100000,
      createdById: adminId,
    },
  });
  orderId = order.id;

  // An approved BOM whose one GREIGE line names the greige and — by design — no fabric.
  const bom = await prisma.order_bom.create({
    data: {
      orderId,
      styleId,
      status: 'APPROVED',
      isActive: true,
      createdById: adminId,
      items: {
        create: [
          {
            materialType: 'GREIGE',
            componentName: 'Top',
            greigeId,
            fabricId: null,
            quantityPerGarment: 1.5,
            orderQuantity: 100,
            totalQuantity: REQUIRED,
            totalWithWastage: REQUIRED,
            unit: 'MTR',
            unitPrice: 0,
            totalCost: 0,
          },
        ],
      },
    },
    include: { items: true },
  });
  orderBomId = bom.id;
  bomItemId = bom.items[0].id;

  const wo = await prisma.work_orders.create({
    data: {
      id: randomUUID(),
      workOrderNumber: `${RUN}-WO`,
      styleId,
      orderId,
      status: 'PENDING',
      plannedStartDate: new Date(),
      plannedEndDate: new Date(Date.now() + 7 * 86400000),
      totalQuantity: 100,
      createdById: adminId,
    },
  });
  workOrderId = wo.id;
});

afterAll(async () => {
  try {
    await prisma.fabric_stock.deleteMany({ where: { fabricId: only(fabricId) } });
    await prisma.production_tracking.deleteMany({ where: { workOrderId: only(workOrderId) } });
    await prisma.stage_transition_overrides.deleteMany({ where: { workOrderId: only(workOrderId) } });
    await prisma.work_orders.deleteMany({ where: { id: only(workOrderId) } });
    await prisma.order_bom.deleteMany({ where: { id: only(orderBomId) } }); // items cascade
    await prisma.orders.deleteMany({ where: { id: only(orderId) } });
    await prisma.customers.deleteMany({ where: { id: only(customerId) } });
    await prisma.style_fabrics.deleteMany({ where: { id: only(styleFabricId) } });
    await prisma.style_components.deleteMany({ where: { id: only(componentId) } });
    await prisma.fabric_master.deleteMany({ where: { id: only(fabricId) } });
    await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
    await prisma.styles.deleteMany({ where: { id: { in: [styleId, otherStyleId].map((id) => only(id)) } } });
    await prisma.users.deleteMany({ where: { id: only(adminId) } });
  } catch (err) {
    console.error(`bom-fabric-availability: teardown failed — look for ${RUN}-* rows`, err);
  }
  await prisma.$disconnect();
});

describe('an order BOM greige line with no fabricId', () => {
  it('with nothing received: short, and the message says what to do', async () => {
    const r = await readiness();
    expect(r.hasApprovedBom).toBe(true);
    expect(r.isReady).toBe(false);
    expect(r.missingMaterials).toHaveLength(1);
    expect(r.missingMaterials[0].available).toBe(0);
    expect(r.missingMaterials[0].required).toBe(REQUIRED);

    const message = await pushRefusal();
    expect(message).toMatch(/Insufficient stock for .*Viscose Moss/);
    expect(message).toMatch(/Available: 0\.00/);
    expect(message).toMatch(/no finished fabric made from this greige has been received for this style/);
  });

  it('counts a lot received for this style, made from this greige', async () => {
    await createLot(styleId);

    const r = await readiness();
    expect(r.isReady).toBe(true);
    expect(r.missingMaterials).toHaveLength(0);

    // Samples still block — but the fabric shortage must be gone from the refusal.
    const message = await pushRefusal();
    expect(message).toMatch(/Sample/);
    expect(message).not.toMatch(/Insufficient stock/);
  });

  it("never counts another style's fabric from the same greige", async () => {
    await prisma.fabric_stock.update({ where: { id: lotId! }, data: { originStyleId: otherStyleId } });

    const r = await readiness();
    expect(r.isReady).toBe(false);
    expect(r.missingMaterials[0].available).toBe(0);
    expect(await pushRefusal()).toMatch(/Insufficient stock/);
  });

  it('counts a lot whose master has been allocated to the style (Fabric Master → Allocate to Style)', async () => {
    // Lot still stamped for the other style; the master is now the style's Top fabric.
    await prisma.style_fabrics.update({ where: { id: styleFabricId }, data: { fabricId } });

    const r = await readiness();
    expect(r.isReady).toBe(true);
    expect(await pushRefusal()).not.toMatch(/Insufficient stock/);

    await prisma.style_fabrics.update({ where: { id: styleFabricId }, data: { fabricId: null } });
    expect((await readiness()).isReady).toBe(false);
  });

  it('counts a lot received for this order', async () => {
    await prisma.fabric_stock.update({
      where: { id: lotId! },
      data: { originStyleId: otherStyleId, originOrderId: orderId },
    });
    expect((await readiness()).isReady).toBe(true);
    await prisma.fabric_stock.update({ where: { id: lotId! }, data: { originOrderId: null } });
    expect((await readiness()).isReady).toBe(false);
  });

  it('a lot that is not AVAILABLE does not count', async () => {
    await prisma.fabric_stock.update({ where: { id: lotId! }, data: { originStyleId: styleId, status: 'ISSUED' } });
    expect((await readiness()).isReady).toBe(false);
    await prisma.fabric_stock.update({ where: { id: lotId! }, data: { status: 'AVAILABLE' } });
    expect((await readiness()).isReady).toBe(true);
  });
});

describe('an order BOM line with a stamped fabricId', () => {
  it('keeps the old rule: that master’s lots, whatever their origin', async () => {
    await prisma.order_bom_items.update({ where: { id: bomItemId }, data: { fabricId } });
    await prisma.fabric_stock.update({ where: { id: lotId! }, data: { originStyleId: otherStyleId } });

    const r = await readiness();
    expect(r.isReady).toBe(true);
    expect(await pushRefusal()).not.toMatch(/Insufficient stock/);
  });

  it('a stamped master with no lots is short, without the lineage hint', async () => {
    await prisma.fabric_stock.update({ where: { id: lotId! }, data: { status: 'EXHAUSTED' } });

    const message = await pushRefusal();
    expect(message).toMatch(/Insufficient stock/);
    expect(message).not.toMatch(/no finished fabric made from this greige/);
  });
});
