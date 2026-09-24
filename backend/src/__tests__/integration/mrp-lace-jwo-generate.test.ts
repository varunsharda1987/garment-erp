/**
 * MRP turns a lace dyeing requirement into a real job work order (2026-09-08).
 *
 * The greige/dyeing split (474e2983) raised the PROCESSING requirement, but generating from it
 * threw: the job-work path built a fabric-shaped header, and the receipt then had no material to
 * stock. Lace now takes the same path as cloth — same trade, same billing basis — carrying its own
 * identity instead of a fabric's.
 *
 * Canonical numbers, unchanged from the split suite: 0.30 m/garment x 3,000 pcs = 900 finished m;
 * greige ₹40/m, dyeing ₹20/m per metre RETURNED, 10% shrinkage ⇒ 1,000 greige m sent, 900 m
 * billed at ₹20 = ₹18,000.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { calculateRequirementsFromOrder, generatePOFromRequirements } from '../../services/mrp.service';

const RUN = `MLJ${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let customerId: string;
let styleId: string;
let orderId: string;
let orderBomId: string;
let greigeLaceId: string;
let dyedLaceId: string;
let dyerId: string;
let weaverId: string;
let laceBomItemId: string;

const only = (id: string | undefined) => id ?? '__unset__';

const ORDER_QTY = 3000;
const QTY_PER_GARMENT = 0.3;
const FINISHED_M = ORDER_QTY * QTY_PER_GARMENT; // 900
const GREIGE_RATE = 40;
const DYEING_RATE = 20;
const SHRINKAGE = 10;
const SHRINKAGE_FACTOR = 0.9;
const ALL_IN = GREIGE_RATE / SHRINKAGE_FACTOR + DYEING_RATE;
const GREIGE_M = FINISHED_M / SHRINKAGE_FACTOR; // 1000

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;

  const weaver = await prisma.suppliers.create({
    data: { code: `${RUN}-WVR`, name: `${RUN} Weaver`, isActive: true, createdById: userId },
  });
  weaverId = weaver.id;

  const dyer = await prisma.suppliers.create({
    data: {
      code: `${RUN}-DYE`,
      name: `${RUN} Dyer`,
      supplierCategories: ['DYEING_PRINTING'],
      isActive: true,
      createdById: userId,
    },
  });
  dyerId = dyer.id;

  const customer = await prisma.customers.create({
    data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  customerId = customer.id;

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
  });
  styleId = style.id;

  const greigeLace = await prisma.lace_master.create({
    data: {
      laceCode: `${RUN}-GL`,
      laceName: `${RUN} Greige Organza`,
      isGreige: true,
      costPerMeterGreige: GREIGE_RATE,
      supplierId: weaver.id,
      laceType: 'Organza',
      width: 1,
    },
  });
  greigeLaceId = greigeLace.id;

  const dyedLace = await prisma.lace_master.create({
    data: {
      laceCode: `${RUN}-DL`,
      laceName: `${RUN} Navy Organza`,
      isGreige: false,
      color: 'Navy',
      sourceGreigeLaceId: greigeLaceId,
      laceType: 'Organza',
      width: 1,
    },
  });
  dyedLaceId = dyedLace.id;

  const order = await prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber: `${RUN}ORD`,
      customerId,
      expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
      totalQuantity: ORDER_QTY,
      totalAmount: 100000,
      createdById: userId,
    },
  });
  orderId = order.id;

  await prisma.order_items.create({
    data: {
      id: randomUUID(),
      orderId,
      styleId,
      totalQuantity: ORDER_QTY,
      unitPrice: 100,
      totalPrice: 100 * ORDER_QTY,
    },
  });

  const bom = await prisma.order_bom.create({
    data: { orderId, styleId, createdById: userId, status: 'APPROVED', isActive: true },
  });
  orderBomId = bom.id;

  const bomItem = await prisma.order_bom_items.create({
    data: {
      id: randomUUID(),
      orderBomId,
      materialType: 'LACE',
      laceId: dyedLaceId,
      greigeLaceId,
      sourcingStrategy: 'GREIGE_PROCESSED',
      processorId: dyerId,
      greigeCost: GREIGE_RATE,
      processingCost: DYEING_RATE,
      unitPrice: ALL_IN,
      componentName: `${RUN} Navy Organza`,
      quantityPerGarment: QTY_PER_GARMENT,
      orderQuantity: ORDER_QTY,
      totalQuantity: FINISHED_M,
      wastagePercent: 0,
      totalWithWastage: FINISHED_M,
      unit: 'METER',
      totalCost: FINISHED_M * ALL_IN,
      sortOrder: 0,
    },
  });
  laceBomItemId = bomItem.id;

  await calculateRequirementsFromOrder({ orderId }, userId);
});

afterAll(async () => {
  const jwoIds = (
    await prisma.job_work_orders.findMany({ where: { processorId: only(dyerId) }, select: { id: true } })
  ).map((j) => j.id);
  await prisma.requirement_jwo_links.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } });
  await prisma.material_requirements.deleteMany({ where: { orderId: only(orderId) } });
  await prisma.order_bom_items.deleteMany({ where: { orderBomId: only(orderBomId) } });
  await prisma.order_bom.deleteMany({ where: { id: only(orderBomId) } });
  await prisma.order_items.deleteMany({ where: { orderId: only(orderId) } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  const laceIds = [only(greigeLaceId), only(dyedLaceId)];
  await prisma.material_suppliers.deleteMany({ where: { materialId: { in: laceIds } } });
  await prisma.materials.deleteMany({ where: { laceId: { in: laceIds } } });
  await prisma.lace_master.deleteMany({ where: { id: only(dyedLaceId) } });
  await prisma.lace_master.deleteMany({ where: { id: only(greigeLaceId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.suppliers.deleteMany({ where: { id: { in: [only(dyerId), only(weaverId)] } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('MRP generates a lace dyeing job work order', () => {
  it('raises a LACE job that sends the greige and expects the dyed variant back', async () => {
    const dyeing = await prisma.material_requirements.findFirst({
      where: { orderId, requirementType: 'PROCESSING' },
    });
    expect(dyeing).not.toBeNull();

    const result = await generatePOFromRequirements(
      {
        requirementIds: [dyeing!.id],
        supplierId: dyerId,
        expectedDeliveryDate: new Date(Date.now() + 20 * 86400000).toISOString(),
      } as never,
      userId
    );

    // PROCESSING work is a job work order only — no purchase order for the dyer.
    expect(result.purchaseOrder).toBeNull();
    expect(result.jobWorkOrder).toBeTruthy();

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: result.jobWorkOrder!.id } });
    expect(jwo!.fabricType).toBe('LACE');
    expect(jwo!.greigeLaceId).toBe(greigeLaceId);
    expect(jwo!.finishedLaceId).toBe(dyedLaceId);
    expect(jwo!.processType).toBe('DYEING');
    expect(jwo!.processorId).toBe(dyerId);
    // No fabric is minted or claimed — this job never produces cloth.
    expect(jwo!.fabricId).toBeNull();
    expect(jwo!.finishedFabricId).toBeNull();

    // Greige metres out, dyed metres billed — the requirement plans what is SENT.
    expect(Number(jwo!.qtySentMeters)).toBeCloseTo(GREIGE_M, 0);
    expect(Number(jwo!.qtyBillable)).toBeCloseTo(FINISHED_M, 0);
    expect(Number(jwo!.agreedRatePerMeter)).toBeCloseTo(DYEING_RATE, 2);
    expect(Number(jwo!.expectedShrinkage)).toBeCloseTo(SHRINKAGE, 1);
    // 900 returned x ₹20 — the dyer bills for what comes back.
    expect(Number(jwo!.subtotal)).toBeCloseTo(FINISHED_M * DYEING_RATE, 0);

    // The requirement is covered by the job, not left orderable.
    const after = await prisma.material_requirements.findUnique({ where: { id: dyeing!.id } });
    expect(after!.status).toBe('PO_GENERATED');
    const links = await prisma.requirement_jwo_links.findMany({ where: { jobWorkOrderId: jwo!.id } });
    expect(links).toHaveLength(1);
    expect(Number(links[0].allocatedQuantity)).toBeCloseTo(FINISHED_M, 0);
  });

  it('refuses to mix lace dyeing with fabric processing on one job', async () => {
    // One document cannot hold both: fabricType is a single column, and the receipt has to know
    // which stock table to write. Both rows are fresh (the first test's requirement is already
    // covered), and only one of them has a lace behind it.
    const mk = (suffix: string, bomItemId: string | null) =>
      prisma.material_requirements.create({
        data: {
          requirementNumber: `${RUN}-MR${suffix}`,
          source: 'SALES_ORDER',
          orderId,
          materialId: greigeLaceId, // materials.id === master.id; the lace check keys on the BOM item
          orderBomId,
          orderBomItemId: bomItemId,
          orderQuantity: ORDER_QTY,
          quantityPerUnit: QTY_PER_GARMENT,
          wastagePercent: 0,
          requiredDate: new Date(Date.now() + 20 * 86400000),
          createdById: userId,
          totalRequired: 100,
          unit: 'METER',
          availableStock: 0,
          allocatedFromStock: 0,
          shortfall: 100,
          status: 'PO_REQUIRED',
          requirementType: 'PROCESSING',
          processorId: dyerId,
          unitPrice: DYEING_RATE,
        },
      });

    const laceProcessing = await mk('8', laceBomItemId);
    const fabricProcessing = await mk('9', null);

    await expect(
      generatePOFromRequirements(
        {
          requirementIds: [fabricProcessing.id, laceProcessing.id],
          supplierId: dyerId,
          expectedDeliveryDate: new Date(Date.now() + 20 * 86400000).toISOString(),
        } as never,
        userId
      )
    ).rejects.toThrow(/mix lace dyeing with fabric processing/i);

    // Neither requirement may have been consumed by the refused attempt.
    for (const id of [laceProcessing.id, fabricProcessing.id]) {
      const row = await prisma.material_requirements.findUnique({ where: { id } });
      expect(row!.status).toBe('PO_REQUIRED');
      await prisma.material_requirements.delete({ where: { id } });
    }
  });
});

describe('one job work order per rate (2026-09-24)', () => {
  // KMC: White at ₹3 and Burgundy at ₹7 were bundled into one job at a value-weighted ₹5.70/m, and
  // the per-colour rates were stored nowhere. Lines at different rates now become one job each.
  const mkLine = (suffix: string) =>
    prisma.material_requirements.create({
      data: {
        requirementNumber: `${RUN}-RATE${suffix}`,
        source: 'SALES_ORDER',
        orderId,
        materialId: greigeLaceId,
        orderBomId,
        orderBomItemId: laceBomItemId,
        orderQuantity: ORDER_QTY,
        quantityPerUnit: QTY_PER_GARMENT,
        wastagePercent: 0,
        requiredDate: new Date(Date.now() + 20 * 86400000),
        createdById: userId,
        totalRequired: 100,
        unit: 'METER',
        availableStock: 0,
        allocatedFromStock: 0,
        shortfall: 100,
        status: 'PO_REQUIRED',
        requirementType: 'PROCESSING',
        processorId: dyerId,
        unitPrice: DYEING_RATE,
      },
    });

  it('splits lines priced differently into one job per rate, each at its exact rate', async () => {
    const white = await mkLine('W');
    const burgundy = await mkLine('B');

    const result = await generatePOFromRequirements(
      {
        requirementIds: [white.id, burgundy.id],
        supplierId: dyerId,
        expectedDeliveryDate: new Date(Date.now() + 20 * 86400000).toISOString(),
        itemPrices: { [white.id]: 3, [burgundy.id]: 7 },
      } as never,
      userId
    );

    expect(result.jobWorkOrders).toHaveLength(2);
    expect(result.linkedRequirements).toBe(2);
    const jobs = await prisma.job_work_orders.findMany({
      where: { id: { in: result.jobWorkOrders!.map((j) => j.id) } },
      include: { requirementLinks: true },
    });
    const rateOf = (reqId: string) =>
      Number(jobs.find((j) => j.requirementLinks.some((l) => l.requirementId === reqId))!.agreedRatePerMeter);
    expect(rateOf(white.id)).toBe(3);
    expect(rateOf(burgundy.id)).toBe(7);
    for (const j of jobs) expect(j.rateVarianceReason ?? '').not.toMatch(/average/i);
  });

  it('keeps lines at the same rate on one job', async () => {
    const a = await mkLine('S1');
    const b = await mkLine('S2');

    const result = await generatePOFromRequirements(
      {
        requirementIds: [a.id, b.id],
        supplierId: dyerId,
        expectedDeliveryDate: new Date(Date.now() + 20 * 86400000).toISOString(),
        itemPrices: { [a.id]: 5, [b.id]: 5 },
      } as never,
      userId
    );

    expect(result.jobWorkOrders ?? [result.jobWorkOrder]).toHaveLength(1);
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: result.jobWorkOrder!.id } });
    expect(Number(jwo!.agreedRatePerMeter)).toBe(5);
  });
});
