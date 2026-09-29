/**
 * A new PO delivers to our store — Kashaya Fabs — unless it is greige or greige lace (owner, 2026-09-29: "Apart
 * from the greige the delivery location of everything has to be Kashaya Fabs by default"; greige lace is treated
 * like greige). ONE rule, helpers/po-default-delivery.helper.ts, on every PO writer:
 *  - the manual create: a place LEFT OUT gets the default, an explicit null stays "to be advised", a place sent
 *    is kept (the Create PO page shows the default and always sends its choice);
 *  - MRP "Generate PO": a requirement with no dyer goes to our store — greige / greige lace stay "to be advised" —
 *    and one at a dyer still goes straight to the dyer's unit;
 *  - GET /purchase-orders/delivery-default, which the Create PO page reads.
 *
 * Runs against the LIVE database (there is no test DB): our store is the real one; everything else is tagged and
 * torn down.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { generatePOFromRequirements } from '../../services/mrp.service';
import { companyStore } from '../../services/helpers/po-default-delivery.helper';

const RUN = `PDD${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;

let userId: string;
let authHeader: Record<string, string>;
let supplierId: string;
let dyerId: string;
let unitId: string;
let otherStoreId: string;
/** Our store — the real Kashaya Fabs */
let storeId: string;
let buttonId: string;
let laceId: string;
let greigeLaceId: string;
let greigeId: string;
let greigeMaterialId: string;
const poIds: string[] = [];
const reqIds: string[] = [];

const createPo = async (body: Record<string, unknown>) => {
  const res = await request(app)
    .post('/api/purchase-orders')
    .set(authHeader)
    .send({ supplierId, expectedDeliveryDate: new Date(Date.now() + 7 * DAY).toISOString(), ...body });
  if (res.status === 201) poIds.push(res.body.data.id);
  return res;
};

const buttonLine = () => ({ materialId: buttonId, orderedQuantity: 2, unit: 'GROSS', unitPrice: 18 });
const metreLine = (materialId: string) => ({ materialId, orderedQuantity: 100, unit: 'METER', unitPrice: 12 });

let n = 0;
/** A requirement to buy; with a processor, a PROCESSING child names the dyer that processes it */
const mkRequirement = async (
  materialId: string,
  unit: 'METER' | 'PIECE',
  qty: number,
  unitPrice: number,
  processorId: string | null = null
) => {
  n += 1;
  const base = {
    source: 'MANUAL' as const,
    unit,
    materialId,
    orderQuantity: 1,
    quantityPerUnit: qty,
    wastagePercent: 0,
    totalRequired: qty,
    shortfall: qty,
    unitPrice,
    requiredDate: new Date(Date.now() + 30 * DAY),
    createdById: userId,
  };
  const material = await prisma.material_requirements.create({
    data: {
      id: randomUUID(),
      ...base,
      requirementNumber: `${RUN}-MR${n}`,
      status: 'PO_REQUIRED',
      requirementType: 'MATERIAL',
    },
  });
  reqIds.push(material.id);
  if (processorId) {
    const child = await prisma.material_requirements.create({
      data: {
        id: randomUUID(),
        ...base,
        requirementNumber: `${RUN}-MR${n}P`,
        status: 'PENDING',
        requirementType: 'PROCESSING',
        processorId,
        linkedRequirementId: material.id,
      },
    });
    reqIds.push(child.id);
  }
  return material.id;
};

/** Generate ONE PO from these requirements and read back where it delivers */
const generate = async (ids: string[]) => {
  const result = await generatePOFromRequirements(
    {
      requirementIds: ids,
      supplierId,
      expectedDeliveryDate: new Date(Date.now() + 7 * DAY).toISOString(),
      consolidate: true,
    } as never,
    userId
  );
  const created = result.purchaseOrders ?? (result.purchaseOrder ? [result.purchaseOrder] : []);
  poIds.push(...created.map((po) => po.id));
  expect(created).toHaveLength(1);
  return prisma.purchase_orders.findUniqueOrThrow({
    where: { id: created[0].id },
    include: { deliveryPoints: { include: { lines: true }, orderBy: { sequence: 'asc' } } },
  });
};

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;
  authHeader = getAuthHeader(userId, 'ADMIN');

  const store = await companyStore(prisma);
  if (!store) throw new Error('No company store (WH-RM) to default to — the live database should have Kashaya Fabs');
  storeId = store.id;

  supplierId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-SUP`,
        name: `${RUN} Trims & Lace`,
        supplierCategories: ['TRIMS_SUPPLIER', 'LACE_SUPPLIER', 'GREIGE_SUPPLIER'],
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  dyerId = (
    await prisma.suppliers.create({
      data: { code: `${RUN}-DY`, name: `${RUN} Dyer`, supplierCategories: ['DYEING_PRINTING'], createdById: userId },
    })
  ).id;
  unitId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-JW`,
        warehouseName: `${RUN} Dyer - Processing Unit`,
        warehouseType: 'JOB_WORK',
        supplierId: dyerId,
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  otherStoreId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-ANX`,
        warehouseName: `${RUN} Annexe`,
        warehouseType: 'RAW_MATERIAL',
        isActive: true,
        createdById: userId,
      },
    })
  ).id;

  buttonId = (
    await prisma.button_master.create({
      data: { buttonCode: `${RUN}-BTN`, buttonName: `${RUN} Shell Button`, pricePerPiece: 0.125, pricePerGross: 18 },
    })
  ).id;
  laceId = (
    await prisma.lace_master.create({ data: { laceCode: `${RUN}-LC`, laceName: `${RUN} Dyed Lace`, isGreige: false } })
  ).id;
  greigeLaceId = (
    await prisma.lace_master.create({
      data: { laceCode: `${RUN}-GLC`, laceName: `${RUN} Greige Lace`, isGreige: true },
    })
  ).id;
  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GRG`,
        greigeName: `${RUN} Cotton Flex 63"`,
        genericGreigeName: `${RUN} Cotton Flex`,
        composition: '100% Cotton',
        greigeWidth: 63,
        createdById: userId,
      },
    })
  ).id;
  await ensureMaterialRecord(buttonId, 'BUTTON');
  await ensureMaterialRecord(laceId, 'LACE');
  await ensureMaterialRecord(greigeLaceId, 'LACE');
  greigeMaterialId = await ensureMaterialRecord(greigeId, 'GREIGE');
});

afterAll(async () => {
  const materialIds = onlyAll([buttonId, laceId, greigeLaceId, greigeMaterialId]);
  const allReqIds = onlyAll(reqIds).length
    ? (
        await prisma.material_requirements.findMany({
          where: {
            OR: [
              { id: { in: onlyAll(reqIds) } },
              { splitFromId: { in: onlyAll(reqIds) } },
              { linkedRequirementId: { in: onlyAll(reqIds) } },
            ],
          },
          select: { id: true },
        })
      ).map((r) => r.id)
    : [];
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['links', () => prisma.requirement_po_links.deleteMany({ where: { requirementId: { in: allReqIds } } })],
    ['source links', () => prisma.po_source_links.deleteMany({ where: { purchaseOrderId: { in: onlyAll(poIds) } } })],
    ['revisions', () => prisma.po_delivery_plan_revisions.deleteMany({ where: { poId: { in: onlyAll(poIds) } } })],
    ['points', () => prisma.po_delivery_points.deleteMany({ where: { poId: { in: onlyAll(poIds) } } })],
    ['po items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: onlyAll(poIds) } } })],
    ['po', () => prisma.purchase_orders.deleteMany({ where: { id: { in: onlyAll(poIds) } } })],
    [
      'child requirements',
      () => prisma.material_requirements.deleteMany({ where: { linkedRequirementId: { in: allReqIds } } }),
    ],
    [
      'split requirements',
      () => prisma.material_requirements.deleteMany({ where: { splitFromId: { in: allReqIds } } }),
    ],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { id: { in: allReqIds } } })],
    ['material_suppliers', () => prisma.material_suppliers.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['lace_master', () => prisma.lace_master.deleteMany({ where: { id: { in: onlyAll([laceId, greigeLaceId]) } } })],
    ['button_master', () => prisma.button_master.deleteMany({ where: { id: only(buttonId) } })],
    ['greige_master', () => prisma.greige_master.deleteMany({ where: { id: only(greigeId) } })],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: { in: onlyAll([unitId, otherStoreId]) } } })],
    ['suppliers', () => prisma.suppliers.deleteMany({ where: { id: { in: onlyAll([supplierId, dyerId]) } } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[po-default-delivery teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('the default the Create PO page shows', () => {
  it('names our store (a WH-RM store, never a processor unit) and the categories that start "to be advised"', async () => {
    const res = await request(app).get('/api/purchase-orders/delivery-default').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.warehouse).toMatchObject({ id: storeId });
    expect(res.body.data.warehouse.warehouseCode).toMatch(/^WH-RM/);
    expect(res.body.data.exceptCategories).toEqual(['GREIGE', 'GREIGE_LACE']);
    const store = await prisma.warehouses.findUniqueOrThrow({ where: { id: storeId } });
    expect(store.isActive).toBe(true);
    expect(['JOB_WORK', 'TRANSIT']).not.toContain(store.warehouseType);
  });
});

describe('a PO made by hand (POST /purchase-orders)', () => {
  it('a Trims PO with no place delivers to our store', async () => {
    const res = await createPo({ poCategory: 'TRIMS', items: [buttonLine()] });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      deliveryLocationId: storeId,
      deliveryLocationType: 'WAREHOUSE',
      originalDeliveryLocationId: storeId,
    });
  });

  it('a Lace PO with no place delivers to our store', async () => {
    const res = await createPo({ poCategory: 'LACE', items: [metreLine(laceId)] });
    expect(res.status).toBe(201);
    expect(res.body.data.deliveryLocationId).toBe(storeId);
  });

  it('a PO with no category — as the AI assistant posts it — is General and delivers to our store', async () => {
    const res = await createPo({ items: [buttonLine()] });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ poCategory: 'GENERAL', deliveryLocationId: storeId });
  });

  it('Greige and Greige Lace POs with no place stay "to be advised"', async () => {
    const greige = await createPo({ poCategory: 'GREIGE', items: [metreLine(greigeMaterialId)] });
    expect(greige.status).toBe(201);
    expect(greige.body.data).toMatchObject({ deliveryLocationId: null, deliveryLocationType: null });

    const greigeLace = await createPo({ poCategory: 'GREIGE_LACE', items: [metreLine(greigeLaceId)] });
    expect(greigeLace.status).toBe(201);
    expect(greigeLace.body.data).toMatchObject({ deliveryLocationId: null, deliveryLocationType: null });
  });

  it('an explicit null stays "to be advised" — chosen on purpose', async () => {
    const res = await createPo({ poCategory: 'TRIMS', deliveryLocationId: null, items: [buttonLine()] });
    expect(res.status).toBe(201);
    expect(res.body.data.deliveryLocationId).toBeNull();
  });

  it('a place that is sent is kept — another store, or a processor unit', async () => {
    const annexe = await createPo({ poCategory: 'TRIMS', deliveryLocationId: otherStoreId, items: [buttonLine()] });
    expect(annexe.status).toBe(201);
    expect(annexe.body.data).toMatchObject({ deliveryLocationId: otherStoreId, deliveryLocationType: 'WAREHOUSE' });

    const atDyer = await createPo({ poCategory: 'LACE', deliveryLocationId: unitId, items: [metreLine(laceId)] });
    expect(atDyer.status).toBe(201);
    expect(atDyer.body.data).toMatchObject({ deliveryLocationId: unitId, deliveryLocationType: 'PROCESSOR' });
  });
});

describe('a PO made from Requirements (MRP Generate PO)', () => {
  it('a Trims requirement delivers to our store', async () => {
    const po = await generate([await mkRequirement(buttonId, 'PIECE', 288, 0.125)]);
    expect(po.poCategory).toBe('TRIMS');
    expect(po).toMatchObject({ deliveryLocationId: storeId, deliveryLocationType: 'WAREHOUSE' });
    expect(po.deliveryPoints).toHaveLength(0);
  });

  it('a Lace requirement with no dyer delivers to our store', async () => {
    const po = await generate([await mkRequirement(laceId, 'METER', 100, 12)]);
    expect(po.poCategory).toBe('LACE');
    expect(po).toMatchObject({ deliveryLocationId: storeId, deliveryLocationType: 'WAREHOUSE' });
  });

  it('a Greige Lace requirement with no dyer stays "to be advised"', async () => {
    const po = await generate([await mkRequirement(greigeLaceId, 'METER', 100, 8)]);
    expect(po.poCategory).toBe('GREIGE_LACE');
    expect(po.deliveryLocationId).toBeNull();
    expect(po.deliveryPoints).toHaveLength(0);
  });

  it('a Greige Lace requirement at a dyer still goes straight to its unit', async () => {
    const po = await generate([await mkRequirement(greigeLaceId, 'METER', 100, 8, dyerId)]);
    expect(po).toMatchObject({ deliveryLocationId: unitId, deliveryLocationType: 'PROCESSOR' });
  });

  it("a Lace PO over one requirement at a dyer and one with none is split: the dyer's unit and our store", async () => {
    const atDyer = await mkRequirement(laceId, 'METER', 300, 12, dyerId);
    const noDyer = await mkRequirement(laceId, 'METER', 200, 12);
    const po = await generate([atDyer, noDyer]);
    const metresAt = Object.fromEntries(
      po.deliveryPoints.map((p) => [p.warehouseId, p.lines.reduce((sum, l) => sum + Number(l.quantity), 0)])
    );
    expect(metresAt).toEqual({ [unitId]: 300, [storeId]: 200 });
    // The header mirrors place 1
    expect(po.deliveryLocationId).toBe(po.deliveryPoints[0].warehouseId);
  });
});
