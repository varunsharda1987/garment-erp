/**
 * Order BOM field preservation (silent-data-loss hunt 2026-08-31, findings #1/#3/#5).
 *
 * PUT /api/orders/:orderId/bom rebuilds every order_bom_items row (deleteMany + createMany) from
 * the request body. The Zod item schema and the createMany mapping both omitted 19 real columns —
 * selectedCadId, fabricWidthInches, cadAverageSnapshot and the 16 GENERIC trim FKs — so a user
 * merely tabbing out of the inline Wastage % input NULLed them, with a 200 "updated successfully".
 * That already fired on live data: ORD2026080032's "Microdot Fusing" line lost its interliningId
 * (→ MRP drops it from procurement entirely) and its greige line lost the 52" CAD link.
 *
 * The trap this suite is really built for: the rebuild used to mint fresh row ids, while the page
 * keeps optimistic local state carrying the OLD ids. So a fix that only carries values forward by
 * payload id works on the FIRST edit and silently fails on the SECOND — which is exactly the live
 * usage that corrupted ORD2026080032 (every item there carries wastagePercent = 5, i.e. a run of
 * consecutive PUTs). Hence the two-consecutive-edits test.
 *
 * Sibling rebuild paths that dropped the same columns are covered too: copy-from-previous-order,
 * and change-width for BOTH its branches (the changed line must take the new CAD; every other
 * line must keep its generic trim FKs).
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';

const RUN = `OBP${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let customerId: string;
let orderId: string;
let sourceOrderId: string;
let orderBomId: string;
let sourceBomId: string;
let interliningId: string;
let greigeId: string;
let cadId: string;
let altCadId: string;
let styleFabricId: string;
let componentId: string;

const ORDER_QTY = 500;
const WIDTH = 52;
const CAD_AVG = 1.234;

/** The payload shape OrderBOMDetail.handleWastageChange actually sends: ids echoed, the 19 at-risk fields absent. */
function wastagePayload(items: Array<Record<string, unknown>>, targetId: string, wastage: number) {
  return {
    items: items.map((item) => ({
      id: item.id,
      materialType: item.materialType,
      materialId: item.materialId || undefined,
      buttonId: item.buttonId || undefined,
      threadId: item.threadId || undefined,
      labelId: item.labelId || undefined,
      greigeId: item.greigeId || undefined,
      rateCardId: item.rateCardId || undefined,
      quantityPerGarment: Number(item.quantityPerGarment),
      orderQuantity: Number(item.orderQuantity),
      wastagePercent: item.id === targetId ? wastage : Number(item.wastagePercent ?? 0),
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      componentName: item.componentName || undefined,
      sortOrder: item.sortOrder,
    })),
  };
}

async function seedBomItems(bomId: string) {
  const interliningItem = await prisma.order_bom_items.create({
    data: {
      id: randomUUID(),
      orderBomId: bomId,
      materialType: 'INTERLINING',
      interliningId, // a GENERIC trim FK — the class the schema omitted
      componentName: 'Microdot Fusing',
      quantityPerGarment: 0.15,
      orderQuantity: ORDER_QTY,
      totalQuantity: 0.15 * ORDER_QTY,
      unit: 'METER',
      unitPrice: 22,
      totalCost: 0.15 * ORDER_QTY * 22,
      sortOrder: 0,
    },
  });

  const greigeItem = await prisma.order_bom_items.create({
    data: {
      id: randomUUID(),
      orderBomId: bomId,
      materialType: 'GREIGE',
      greigeId,
      componentName: 'Shirt - Viscose Staple',
      quantityPerGarment: CAD_AVG,
      orderQuantity: ORDER_QTY,
      totalQuantity: CAD_AVG * ORDER_QTY,
      unit: 'METER',
      unitPrice: 63.09,
      totalCost: CAD_AVG * ORDER_QTY * 63.09,
      sortOrder: 1,
      // The CAD provenance trio
      selectedCadId: cadId,
      fabricWidthInches: WIDTH,
      cadAverageSnapshot: CAD_AVG,
    },
  });

  return { interliningItemId: interliningItem.id, greigeItemId: greigeItem.id };
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

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
  });
  styleId = style.id;

  const customer = await prisma.customers.create({
    data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  customerId = customer.id;

  const interlining = await prisma.interlining_master.create({
    data: { interliningCode: `${RUN}-INT`, interliningName: `${RUN} Microdot Fusing` },
  });
  interliningId = interlining.id;

  const greige = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-GRG`,
      greigeName: `${RUN} Viscose Staple`,
      composition: '100% Viscose',
      greigeWidth: 63,
      createdById: userId,
    },
  });
  greigeId = greige.id;

  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: 'Shirt', componentType: 'MAIN' },
  });
  componentId = component.id;

  const styleFabric = await prisma.style_fabrics.create({
    data: { id: randomUUID(), componentId, selectedGreigeId: greigeId, fabricName: `${RUN} Viscose Staple` },
  });
  styleFabricId = styleFabric.id;

  const cad = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      greigeId,
      styleFabricId,
      cutableWidth: WIDTH,
      cadAverage: CAD_AVG,
      purpose: 'COSTING',
      costingStyleId: null,
      createdById: userId,
    },
  });
  cadId = cad.id;

  // A second approved width option, used by the change-width path
  const altCad = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      greigeId,
      styleFabricId,
      cutableWidth: 50,
      cadAverage: 1.4,
      totalCostPerMeter: 65,
      purpose: 'COSTING',
      createdById: userId,
    },
  });
  altCadId = altCad.id;

  const order = await prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber: `${RUN}ORD`,
      customerId,
      expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
      totalQuantity: ORDER_QTY,
      totalAmount: 1000,
      createdById: userId,
    },
  });
  orderId = order.id;
  await prisma.order_items.create({
    data: { id: randomUUID(), orderId, styleId, totalQuantity: ORDER_QTY, unitPrice: 10, totalPrice: 5000 },
  });

  const bom = await prisma.order_bom.create({
    data: { orderId, styleId, createdById: userId, status: 'DRAFT', isActive: true },
  });
  orderBomId = bom.id;
  await seedBomItems(orderBomId);

  // A separate, APPROVED source order+BOM for the copy-from-previous-order path
  const sourceOrder = await prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber: `${RUN}SRC`,
      customerId,
      expectedDeliveryDate: new Date(Date.now() + 60 * 86400000),
      totalQuantity: ORDER_QTY,
      totalAmount: 1000,
      createdById: userId,
    },
  });
  sourceOrderId = sourceOrder.id;
  await prisma.order_items.create({
    data: {
      id: randomUUID(),
      orderId: sourceOrderId,
      styleId,
      totalQuantity: ORDER_QTY,
      unitPrice: 10,
      totalPrice: 5000,
    },
  });
  const sourceBom = await prisma.order_bom.create({
    data: { orderId: sourceOrderId, styleId, createdById: userId, status: 'APPROVED', isActive: true },
  });
  sourceBomId = sourceBom.id;
  await seedBomItems(sourceBomId);
});

/**
 * Prisma treats `where: { id: undefined }` as NO FILTER, so `deleteMany({ where: { id: someVar } })`
 * with an unset variable DELETES EVERY ROW IN THE TABLE. That is not hypothetical: a sibling
 * suite's unguarded cleanup wiped every style_costing row in the dev database when its beforeAll
 * threw partway through. These suites run against the REAL database — never hand Prisma a
 * possibly-undefined id. `only()` degrades to a sentinel that matches nothing.
 */
const only = (id: string | undefined) => id ?? '__unset__';
const onlyAll = (ids: Array<string | undefined>) => ids.filter((v): v is string => typeof v === 'string');

afterAll(async () => {
  const orderIds = onlyAll([orderId, sourceOrderId]);
  const bomIds = (
    await prisma.order_bom.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true },
    })
  ).map((b) => b.id);
  await prisma.material_requirements.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order_bom_items.deleteMany({ where: { orderBomId: { in: bomIds } } });
  await prisma.order_bom.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orders.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.fabric_width_cad.deleteMany({ where: { id: { in: onlyAll([cadId, altCadId]) } } });
  await prisma.style_fabrics.deleteMany({ where: { id: only(styleFabricId) } });
  await prisma.style_components.deleteMany({ where: { id: only(componentId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.interlining_master.deleteMany({ where: { id: only(interliningId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('Order BOM wastage edit preserves CAD link and generic trim FKs', () => {
  it('keeps interliningId, selectedCadId, fabricWidthInches and cadAverageSnapshot across a wastage edit', async () => {
    const before = await prisma.order_bom_items.findMany({ where: { orderBomId }, orderBy: { sortOrder: 'asc' } });
    const target = before.find((i) => i.materialType === 'INTERLINING')!;

    const res = await request(app)
      .put(`/api/orders/${orderId}/bom`)
      .set(authHeader)
      .send(wastagePayload(before as unknown as Array<Record<string, unknown>>, target.id, 5));

    expect(res.status).toBe(200);

    const after = await prisma.order_bom_items.findMany({ where: { orderBomId }, orderBy: { sortOrder: 'asc' } });
    const interliningRow = after.find((i) => i.materialType === 'INTERLINING')!;
    const greigeRow = after.find((i) => i.materialType === 'GREIGE')!;

    // The wastage edit itself must have landed
    expect(Number(interliningRow.wastagePercent)).toBe(5);

    // ...without taking the undeclared columns with it
    expect(interliningRow.interliningId).toBe(interliningId);
    expect(greigeRow.selectedCadId).toBe(cadId);
    expect(Number(greigeRow.fabricWidthInches)).toBe(WIDTH);
    expect(Number(greigeRow.cadAverageSnapshot)).toBeCloseTo(CAD_AVG, 4);
  });

  it('keeps row ids stable so a SECOND consecutive edit (stale optimistic ids) still preserves them', async () => {
    const afterFirst = await prisma.order_bom_items.findMany({ where: { orderBomId }, orderBy: { sortOrder: 'asc' } });

    // The page never refetched, so it re-sends the ids it had before the first PUT. Those are only
    // still valid if the rebuild reused them — which is the whole point of this assertion.
    const firstEditIds = afterFirst.map((i) => i.id).sort();

    const target = afterFirst.find((i) => i.materialType === 'INTERLINING')!;
    const res = await request(app)
      .put(`/api/orders/${orderId}/bom`)
      .set(authHeader)
      .send(wastagePayload(afterFirst as unknown as Array<Record<string, unknown>>, target.id, 7));

    expect(res.status).toBe(200);

    const afterSecond = await prisma.order_bom_items.findMany({ where: { orderBomId }, orderBy: { sortOrder: 'asc' } });
    expect(afterSecond.map((i) => i.id).sort()).toEqual(firstEditIds);

    const interliningRow = afterSecond.find((i) => i.materialType === 'INTERLINING')!;
    const greigeRow = afterSecond.find((i) => i.materialType === 'GREIGE')!;

    expect(Number(interliningRow.wastagePercent)).toBe(7);
    expect(interliningRow.interliningId).toBe(interliningId);
    expect(greigeRow.selectedCadId).toBe(cadId);
    expect(Number(greigeRow.fabricWidthInches)).toBe(WIDTH);
    expect(Number(greigeRow.cadAverageSnapshot)).toBeCloseTo(CAD_AVG, 4);
  });

  it('accepts the fields when a client does send them, instead of silently stripping them', async () => {
    const current = await prisma.order_bom_items.findMany({ where: { orderBomId }, orderBy: { sortOrder: 'asc' } });
    const greigeRow = current.find((i) => i.materialType === 'GREIGE')!;

    const payload = wastagePayload(current as unknown as Array<Record<string, unknown>>, greigeRow.id, 3);
    const greigeEntry = payload.items.find((i) => i.id === greigeRow.id)!;
    // Client explicitly moves the line to the other width option
    (greigeEntry as Record<string, unknown>).selectedCadId = altCadId;
    (greigeEntry as Record<string, unknown>).fabricWidthInches = 50;

    const res = await request(app).put(`/api/orders/${orderId}/bom`).set(authHeader).send(payload);
    expect(res.status).toBe(200);

    const after = await prisma.order_bom_items.findFirstOrThrow({
      where: { orderBomId, materialType: 'GREIGE' },
    });
    expect(after.selectedCadId).toBe(altCadId);
    expect(Number(after.fabricWidthInches)).toBe(50);

    // restore for later assertions
    await prisma.order_bom_items.update({
      where: { id: after.id },
      data: { selectedCadId: cadId, fabricWidthInches: WIDTH },
    });
  });
});

describe('Sibling rebuild paths preserve the same columns', () => {
  it('change-width keeps trim FKs on untouched lines and applies the NEW CAD to the changed one', async () => {
    // Both branches of createVersionWithWidthChange were rewritten to use the shared carry-forward
    // helper. The changed branch spreads it and then overrides the CAD trio with the new width, so
    // this asserts the override wins (key order) rather than the old CAD being carried through —
    // exactly the ordering mistake the rest of this work exists to prevent.
    const bom = await prisma.order_bom.findFirstOrThrow({
      where: { orderId, styleId, isActive: true },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    const greigeItem = bom.items.find((i) => i.materialType === 'GREIGE')!;

    const res = await request(app)
      .post(`/api/order-bom/${bom.id}/change-width`)
      .set(authHeader)
      .send({ fabricItemChanges: [{ bomItemId: greigeItem.id, newCadId: altCadId }] });

    expect([200, 201]).toContain(res.status);

    const newBom = await prisma.order_bom.findFirstOrThrow({
      where: { orderId, styleId, isActive: true },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    const changed = newBom.items.find((i) => i.materialType === 'GREIGE')!;
    expect(changed.selectedCadId).toBe(altCadId);
    expect(Number(changed.fabricWidthInches)).toBe(50);

    // ...while every OTHER line keeps its generic trim FK, which the unchanged branch used to drop
    const untouched = newBom.items.find((i) => i.materialType === 'INTERLINING')!;
    expect(untouched.interliningId).toBe(interliningId);
  });

  it('copy-from-previous-order carries the generic trim FK and CAD provenance', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/bom/copy/${sourceOrderId}`)
      .set(authHeader)
      .send({ styleId });

    expect([200, 201]).toContain(res.status);

    const copiedBom = await prisma.order_bom.findFirstOrThrow({
      where: { orderId, styleId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    const items = await prisma.order_bom_items.findMany({ where: { orderBomId: copiedBom.id } });

    const interliningRow = items.find((i) => i.materialType === 'INTERLINING')!;
    const greigeRow = items.find((i) => i.materialType === 'GREIGE')!;

    expect(interliningRow.interliningId).toBe(interliningId);
    expect(greigeRow.selectedCadId).toBe(cadId);
    expect(Number(greigeRow.fabricWidthInches)).toBe(WIDTH);
  });
});
