/**
 * MRP splits a dyed lace into a greige purchase + a dyeing job (phase 2, 2026-09-07).
 *
 * Before this, a GREIGE_PROCESSED lace line produced ONE all-in requirement against the DYED
 * variant — a material with no supplier that cannot be bought, only produced. `hasGreigeProcessing`
 * is gated on `greigeId`, which FKs greige_master (fabric) and is null on a lace line, so lace
 * fell through to the standard branch.
 *
 * The split mirrors the fabric one: both rows sit on the GREIGE LACE's material and both carry
 * GREIGE metres, separated by requirementType.
 *
 * Two things deliberately differ from fabric:
 *  - SHRINKAGE IS DERIVED, NOT LOOKED UP. Nothing ever writes rateCardId for a lace line, so the
 *    shared resolver would return 0% every time. But unitPrice was built as (g + p) / (1 - s) and
 *    all three are frozen on the row, so s is exactly recoverable and always agrees with the
 *    quoted price.
 *  - DYEING IS BILLED PER GREIGE METRE, so the processing row carries the same quantity as the
 *    purchase row rather than the shrunk finished quantity.
 *
 * Canonical numbers used throughout: 0.30 m/garment x 3000 pcs = 900 finished m; greige Rs40/m,
 * dyeing Rs20/m, 10% shrinkage => all-in Rs66.67/m, greige needed 1000 m.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { calculateRequirementsFromOrder } from '../../services/mrp.service';

const RUN = `MGL${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let customerId: string;
let styleId: string;
let orderId: string;
let orderItemId: string;
let orderBomId: string;
let greigeLaceId: string;
let dyedLaceId: string;
let dyerId: string;

const only = (id: string | undefined) => id ?? '__unset__';

const ORDER_QTY = 3000;
const QTY_PER_GARMENT = 0.3;
const FINISHED_M = ORDER_QTY * QTY_PER_GARMENT; // 900
const GREIGE_RATE = 40;
const DYEING_RATE = 20;
const SHRINKAGE = 10;
// Written out rather than derived, so the expected values stay independent of the very helper
// the implementation uses to compute them.
const SHRINKAGE_FACTOR = 0.9; // = 1 − 10%
const ALL_IN = (GREIGE_RATE + DYEING_RATE) / SHRINKAGE_FACTOR; // 66.666…
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

  // The greige lace carries the supplier — that is what makes the purchase row buyable.
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

  const orderItem = await prisma.order_items.create({
    data: {
      id: randomUUID(),
      orderId,
      styleId,
      totalQuantity: ORDER_QTY,
      unitPrice: 100,
      totalPrice: 100 * ORDER_QTY,
    },
  });
  orderItemId = orderItem.id;

  const bom = await prisma.order_bom.create({
    data: { orderId, styleId, createdById: userId, status: 'APPROVED', isActive: true },
  });
  orderBomId = bom.id;

  // The BOM line as the cost sheet freezes it: laceId = the DYED variant (what the garment uses),
  // greigeLaceId = what is bought, and the three prices that encode the shrinkage.
  await prisma.order_bom_items.create({
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
});

afterAll(async () => {
  await prisma.material_requirements.deleteMany({ where: { orderId: only(orderId) } });
  await prisma.order_bom_items.deleteMany({ where: { orderBomId: only(orderBomId) } });
  await prisma.order_bom.deleteMany({ where: { id: only(orderBomId) } });
  await prisma.order_items.deleteMany({ where: { orderId: only(orderId) } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  await prisma.material_suppliers.deleteMany({
    where: { materialId: { in: [only(greigeLaceId), only(dyedLaceId)] } },
  });
  await prisma.materials.deleteMany({ where: { laceId: { in: [only(greigeLaceId), only(dyedLaceId)] } } });
  await prisma.lace_master.deleteMany({ where: { id: { in: [only(dyedLaceId), only(greigeLaceId)] } } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.suppliers.deleteMany({ where: { code: { startsWith: RUN } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('MRP: a dyed lace becomes a greige purchase plus a dyeing job', () => {
  let rows: Awaited<ReturnType<typeof prisma.material_requirements.findMany>>;

  beforeAll(async () => {
    await calculateRequirementsFromOrder({ orderId }, userId);
    rows = await prisma.material_requirements.findMany({ where: { orderId } });
  });

  it('raises exactly two requirements, both against the GREIGE lace', async () => {
    expect(rows).toHaveLength(2);

    const greigeMaterial = await prisma.materials.findFirst({ where: { laceId: greigeLaceId } });
    expect(greigeMaterial).not.toBeNull();

    // Neither row may point at the dyed variant — it has no supplier and cannot be purchased.
    const dyedMaterial = await prisma.materials.findFirst({ where: { laceId: dyedLaceId } });
    for (const r of rows) {
      expect(r.materialId).toBe(greigeMaterial!.id);
      if (dyedMaterial) expect(r.materialId).not.toBe(dyedMaterial.id);
    }

    expect(rows.map((r) => r.requirementType).sort()).toEqual(['MATERIAL', 'PROCESSING']);
  });

  it('grosses the quantity up to greige metres exactly once, on both rows', () => {
    for (const r of rows) {
      expect(Number(r.totalRequired)).toBeCloseTo(GREIGE_M, 2); // 1000, not 900
      expect(Number(r.shrinkagePercentUsed)).toBeCloseTo(SHRINKAGE, 2);
      expect(r.shrinkageSource).toBe('LACE_PRICE_DERIVED');
    }
  });

  it('prices each leg from its own frozen rate, never the all-in rate', () => {
    const purchase = rows.find((r) => r.requirementType === 'MATERIAL')!;
    const dyeing = rows.find((r) => r.requirementType === 'PROCESSING')!;

    expect(Number(purchase.unitPrice)).toBeCloseTo(GREIGE_RATE, 2);
    expect(Number(dyeing.unitPrice)).toBeCloseTo(DYEING_RATE, 2);
    // The all-in rate must appear on neither row — using it would overpay the weaver by the
    // entire dyeing margin.
    for (const r of rows) expect(Number(r.unitPrice)).not.toBeCloseTo(ALL_IN, 2);
  });

  it('reconciles to the frozen cost-sheet total', () => {
    const purchase = rows.find((r) => r.requirementType === 'MATERIAL')!;
    const dyeing = rows.find((r) => r.requirementType === 'PROCESSING')!;

    const split =
      Number(purchase.totalRequired) * Number(purchase.unitPrice) +
      Number(dyeing.totalRequired) * Number(dyeing.unitPrice);

    // 1000 x 40 + 1000 x 20 = 60,000 === 900 x 66.67
    expect(split).toBeCloseTo(FINISHED_M * ALL_IN, 0);
  });

  it('sends the purchase to the weaver and the dyeing to the dyer', () => {
    const purchase = rows.find((r) => r.requirementType === 'MATERIAL')!;
    const dyeing = rows.find((r) => r.requirementType === 'PROCESSING')!;

    expect(purchase.preferredSupplierId).toBeTruthy();
    expect(purchase.preferredSupplierId).not.toBe(dyerId);
    expect(dyeing.preferredSupplierId).toBe(dyerId);
    expect(dyeing.processorId).toBe(dyerId);
  });
});
