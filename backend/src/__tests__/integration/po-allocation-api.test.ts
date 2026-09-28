/**
 * /api/po-allocations over HTTP (docs/plans/po-allocation-design.md §6.5, owner decision D4).
 *
 *  - the schema refuses a bad request with 400 before anything runs;
 *  - reads are open; Link and Undo need the MRP OR the Purchase Orders switch — a role with neither gets 403,
 *    a role with either one gets through. Every role holds both on this deployment, so the test switches
 *    them off for its own SALES user by stubbing PermissionService — the live switches are never touched;
 *  - the refusal shapes the PO page codes against: 422 PO_ALLOCATION_REFUSED (every reason, in `rows`),
 *    409 PO_LINE_OVER_ALLOCATED, 422 PO_UNDO_REFUSED, 404;
 *  - Link (a full cover and a part cover with its balance row) and Undo (the balance row folds back).
 *
 * Tagged fixtures (RUN), everything torn down; nothing real is touched.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { PermissionService } from '../../services/permission.service';

jest.setTimeout(120000);

const RUN = `PAA${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;
const BASE = '/api/po-allocations';

let adminId: string;
let salesId: string;
let admin: Record<string, string>;
let sales: Record<string, string>;
let supplierId: string;
let customerId: string;
let storeId: string;
const masterIds: string[] = [];
const materialIds: string[] = [];
const orderIds: string[] = [];
const poIds: string[] = [];

let m1: string;
const O: Record<string, string> = {};
let poA: string; // SENT
let a1: string; // M1, 1,000 pcs
let a2: string; // M1, 100 pcs — too small for r3
let poD: string; // DRAFT
let d1: string;
const R: Record<string, string> = {};

async function makeOrder(name: string, deliveryInDays: number) {
  const id = randomUUID();
  await prisma.orders.create({
    data: {
      id,
      orderNumber: `${RUN}-${name}`,
      customerId,
      status: 'IN_PRODUCTION',
      expectedDeliveryDate: new Date(Date.now() + deliveryInDays * DAY),
      totalQuantity: 100,
      totalAmount: 1000,
      createdById: adminId,
    },
  });
  orderIds.push(id);
  O[name] = id;
}

async function makePo(suffix: string, status: 'SENT' | 'DRAFT') {
  const id = randomUUID();
  await prisma.purchase_orders.create({
    data: {
      id,
      poNumber: `${RUN}-${suffix}`,
      supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 15 * DAY),
      status,
      poCategory: 'TRIMS',
      createdById: adminId,
    },
  });
  poIds.push(id);
  return id;
}

async function makeLine(poId: string, qty: number) {
  const id = randomUUID();
  await prisma.purchase_order_items.create({
    data: { id, poId, materialId: m1, orderedQuantity: qty, unitPrice: 1, totalPrice: qty, unit: 'PIECE' },
  });
  return id;
}

async function makeRequirement(name: string, orderName: string, need: number) {
  const id = randomUUID();
  await prisma.material_requirements.create({
    data: {
      id,
      requirementNumber: `${RUN}-${name}`,
      source: 'MANUAL',
      unit: 'PIECE',
      materialId: m1,
      orderId: O[orderName],
      orderQuantity: 1,
      quantityPerUnit: need,
      wastagePercent: 0,
      totalRequired: need,
      shortfall: need,
      status: 'PO_REQUIRED',
      requiredDate: new Date(Date.now() + 25 * DAY),
      createdById: adminId,
    },
  });
  R[name] = id;
}

const req = (name: string) => prisma.material_requirements.findUniqueOrThrow({ where: { id: R[name] } });
const linkCount = () => prisma.requirement_po_links.count({ where: { purchaseOrderId: { in: poIds } } });
const row = (purchaseOrderItemId: string, requirementId: string, quantity: unknown) => ({
  purchaseOrderItemId,
  requirementId,
  quantity,
});

/** Switch keys off for this test's own role, leaving the live Permissions page alone */
function denyKeys(keys: string[]) {
  const real = PermissionService.hasPermission.bind(PermissionService);
  return jest
    .spyOn(PermissionService, 'hasPermission')
    .mockImplementation(async (role, key) => (keys.includes(key) ? false : real(role, key)));
}

beforeAll(async () => {
  adminId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}-admin@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;
  salesId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}-sales@smoke.test`,
      role: 'SALES',
      isActive: true,
      isApproved: true,
    })
  ).id;
  admin = getAuthHeader(adminId, 'ADMIN');
  sales = getAuthHeader(salesId, 'SALES');

  supplierId = (
    await prisma.suppliers.create({ data: { code: `${RUN}-SUP`, name: `${RUN} Supplier`, createdById: adminId } })
  ).id;
  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: adminId },
    })
  ).id;
  storeId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-ST`,
        warehouseName: `${RUN} Store`,
        warehouseType: 'RAW_MATERIAL',
        createdById: adminId,
      },
    })
  ).id;

  const master = await prisma.other_material_master.create({
    data: { materialCode: `${RUN}-M1`, materialName: `${RUN} M1` },
  });
  masterIds.push(master.id);
  m1 = await ensureMaterialRecord(master.id, 'OTHER_MATERIAL');
  materialIds.push(m1);

  await makeOrder('O1', 10);
  await makeOrder('O2', 20);

  poA = await makePo('A', 'SENT');
  a1 = await makeLine(poA, 1000);
  a2 = await makeLine(poA, 100);
  poD = await makePo('D', 'DRAFT');
  d1 = await makeLine(poD, 100);

  await makeRequirement('r1', 'O1', 300);
  await makeRequirement('r2', 'O2', 300);
  await makeRequirement('r3', 'O2', 300);
});

afterAll(async () => {
  jest.restoreAllMocks();
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['audit', () => prisma.audit_logs.deleteMany({ where: { userId: { in: [only(adminId), only(salesId)] } } })],
    ['reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['links', () => prisma.requirement_po_links.deleteMany({ where: { purchaseOrderId: { in: poIds } } })],
    ['grn items', () => prisma.grn_items.deleteMany({ where: { goods_receiving_notes: { poId: { in: poIds } } } })],
    ['grns', () => prisma.goods_receiving_notes.deleteMany({ where: { poId: { in: poIds } } })],
    ['po items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } })],
    ['pos', () => prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } })],
    [
      'balance rows',
      () =>
        prisma.material_requirements.deleteMany({
          where: { materialId: { in: materialIds }, splitFromId: { not: null } },
        }),
    ],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['customer', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['stock levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: only(storeId) } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['masters', () => prisma.other_material_master.deleteMany({ where: { id: { in: masterIds } } })],
    ['supplier', () => prisma.suppliers.deleteMany({ where: { id: only(supplierId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: { in: [only(adminId), only(salesId)] } } })],
  ];
  for (const [label, step] of steps) {
    try {
      await step();
    } catch (err) {
      console.error(`[po-allocation-api teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('the request is checked before anything runs (400)', () => {
  it('needs a signed-in user', async () => {
    await request(app).get(`${BASE}/${poA}`).expect(401);
  });

  it('refuses ids that are not UUIDs', async () => {
    const bad = await request(app).get(`${BASE}/not-a-po`).set(admin).expect(400);
    expect(bad.body).toMatchObject({ message: 'Invalid URL parameters', details: [{ field: 'poId' }] });

    const badQuery = await request(app).get(`${BASE}/${poA}?itemIds=nope`).set(admin).expect(400);
    expect(badQuery.body.message).toBe('Invalid query parameters');

    const badLink = await request(app).delete(`${BASE}/${poA}/links/nope`).set(admin).expect(400);
    expect(badLink.body.details).toEqual([expect.objectContaining({ field: 'linkId' })]);
  });

  it('refuses an empty, over-long or malformed allocation list', async () => {
    const cases: Array<[unknown, string]> = [
      [[], 'allocations'],
      [Array.from({ length: 501 }, () => row(a1, R.r1, 1)), 'allocations'],
      [[row('nope', R.r1, 1)], 'allocations.0.purchaseOrderItemId'],
      [[row(a1, 'nope', 1)], 'allocations.0.requirementId'],
      [[row(a1, R.r1, '')], 'allocations.0.quantity'],
      [[row(a1, R.r1, 0)], 'allocations.0.quantity'],
      [[row(a1, R.r1, -5)], 'allocations.0.quantity'],
      [[row(a1, R.r1, 'abc')], 'allocations.0.quantity'],
    ];
    for (const [allocations, field] of cases) {
      const res = await request(app).post(`${BASE}/${poA}`).set(admin).send({ allocations }).expect(400);
      expect(res.body.message).toBe('Invalid request data');
      expect(res.body.details.map((d: { field: string }) => d.field)).toContain(field);
    }
    const zero = await request(app)
      .post(`${BASE}/${poA}`)
      .set(admin)
      .send({ allocations: [row(a1, R.r1, 0)] });
    expect(zero.body.details[0].message).toBe('Each order needs a quantity above 0');
    expect(await linkCount()).toBe(0);
    expect((await req('r1')).status).toBe('PO_REQUIRED');
  });

  it('narrows the view to the lines asked for, repeated or comma-separated', async () => {
    const one = await request(app).get(`${BASE}/${poA}?itemIds=${a2}`).set(admin).expect(200);
    expect(one.body.data.lines.map((l: { itemId: string }) => l.itemId)).toEqual([a2]);
    const both = await request(app).get(`${BASE}/${poA}?itemIds=${a1},${a2}`).set(admin).expect(200);
    expect(both.body.data.lines).toHaveLength(2);
    const repeated = await request(app).get(`${BASE}/${poA}?itemIds=${a1}&itemIds=${a2}`).set(admin).expect(200);
    expect(repeated.body.data.lines).toHaveLength(2);
    const all = await request(app).get(`${BASE}/${poA}?itemIds=`).set(admin).expect(200);
    expect(all.body.data.lines).toHaveLength(2);
  });
});

describe('who may allocate (D4: MRP or Purchase Orders)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('a role with neither switch cannot link or undo, but can still read', async () => {
    denyKeys(['mrp', 'purchaseOrders']);
    const post = await request(app)
      .post(`${BASE}/${poA}`)
      .set(sales)
      .send({ allocations: [row(a1, R.r1, 10)] });
    expect(post.status).toBe(403);
    expect(post.body).toMatchObject({ error: 'Forbidden', code: 'PERMISSION_DENIED', permission: 'mrp' });
    expect(post.body.message).toMatch(/ or /);

    const del = await request(app).delete(`${BASE}/${poA}/links/${randomUUID()}`).set(sales);
    expect(del.status).toBe(403);
    expect(del.body.code).toBe('PERMISSION_DENIED');

    await request(app).get(`${BASE}/${poA}`).set(sales).expect(200);
    expect(await linkCount()).toBe(0);
  });

  it.each([['mrp'], ['purchaseOrders']])('a role holding only %s gets through the gate', async (held) => {
    denyKeys(['mrp', 'purchaseOrders'].filter((k) => k !== held));
    // More than r1 needs: past the gate, the helper refuses it — nothing is written either way
    const res = await request(app)
      .post(`${BASE}/${poA}`)
      .set(sales)
      .send({ allocations: [row(a1, R.r1, 400)] });
    expect(res.status).toBe(422);
    expect(res.body.details.code).toBe('PO_ALLOCATION_REFUSED');
  });
});

describe('refusals the PO page shows', () => {
  it('404 for a PO or a link that does not exist', async () => {
    const get = await request(app).get(`${BASE}/${randomUUID()}`).set(admin).expect(404);
    expect(get.body.error).toBe('NOT_FOUND');
    await request(app)
      .post(`${BASE}/${randomUUID()}`)
      .set(admin)
      .send({ allocations: [row(a1, R.r1, 10)] })
      .expect(404);
    await request(app).delete(`${BASE}/${poA}/links/${randomUUID()}`).set(admin).expect(404);
  });

  it('422 PO_ALLOCATION_REFUSED lists every row that cannot go, and writes nothing', async () => {
    const ghost = randomUUID();
    const res = await request(app)
      .post(`${BASE}/${poA}`)
      .set(admin)
      .send({ allocations: [row(a1, R.r1, 400), row(a1, ghost, 10)] })
      .expect(422);
    expect(res.body).toMatchObject({
      error: 'BUSINESS_ERROR',
      details: {
        code: 'PO_ALLOCATION_REFUSED',
        rows: [
          {
            purchaseOrderItemId: a1,
            requirementId: R.r1,
            requirementNumber: `${RUN}-r1`,
            reason: expect.stringMatching(/more than it needs/),
          },
          { purchaseOrderItemId: a1, requirementId: ghost, requirementNumber: null, reason: 'requirement not found' },
        ],
      },
    });
    expect(res.body.message).toMatch(/and 1 more/);
    expect(await linkCount()).toBe(0);
  });

  it('422 on a PO that has not been sent', async () => {
    const view = await request(app).get(`${BASE}/${poD}`).set(admin).expect(200);
    expect(view.body.data.po).toMatchObject({
      linkable: false,
      blockedReason: expect.stringMatching(/only a sent PO/),
    });
    const res = await request(app)
      .post(`${BASE}/${poD}`)
      .set(admin)
      .send({ allocations: [row(d1, R.r1, 10)] })
      .expect(422);
    expect(res.body.details.rows[0].reason).toMatch(/only a sent PO/);
  });

  it('409 PO_LINE_OVER_ALLOCATED when the line has less free than asked', async () => {
    const res = await request(app)
      .post(`${BASE}/${poA}`)
      .set(admin)
      .send({ allocations: [row(a2, R.r3, 200)] })
      .expect(409);
    expect(res.body).toMatchObject({
      error: 'CONFLICT',
      details: { code: 'PO_LINE_OVER_ALLOCATED', purchaseOrderItemId: a2, free: 100, requested: 200 },
    });
    expect(await linkCount()).toBe(0);
    expect((await req('r3')).status).toBe('PO_REQUIRED');
  });
});

describe('Link and Undo', () => {
  let r1Link: string;
  let r2Link: string;
  let childNumber: string;

  it('links a full cover and a part cover; the part cover leaves a balance row', async () => {
    const view = await request(app).get(`${BASE}/${poA}?itemIds=${a1}`).set(admin).expect(200);
    const line = view.body.data.lines[0];
    expect(
      line.candidates
        .slice(0, 2)
        .map((c: { requirementId: string; suggestedQty: number }) => [c.requirementId, c.suggestedQty])
    ).toEqual([
      [R.r1, 300],
      [R.r2, 300],
    ]);

    // The dialog's typed quantity posts as a string
    const res = await request(app)
      .post(`${BASE}/${poA}`)
      .set(admin)
      .send({ allocations: [row(a1, R.r1, '300'), row(a1, R.r2, 200)] })
      .expect(201);
    const data = res.body.data;
    expect(res.body.success).toBe(true);
    expect(data).toMatchObject({ poId: poA, poNumber: `${RUN}-A` });
    expect(data.linked).toEqual([
      expect.objectContaining({
        purchaseOrderItemId: a1,
        requirementId: R.r1,
        orderNumber: `${RUN}-O1`,
        quantity: 300,
        heldAtOnce: 0,
      }),
      expect.objectContaining({
        purchaseOrderItemId: a1,
        requirementId: R.r2,
        orderNumber: `${RUN}-O2`,
        quantity: 200,
        heldAtOnce: 0,
      }),
    ]);
    r1Link = data.linked[0].linkId;
    r2Link = data.linked[1].linkId;
    expect(data.splits).toEqual([{ requirementNumber: `${RUN}-r2`, childNumber: expect.any(String), balance: 100 }]);
    childNumber = data.splits[0].childNumber;

    const after = data.allocation.lines.find((l: { itemId: string }) => l.itemId === a1);
    expect(after).toMatchObject({ linkedQty: 500, freeToLink: 500 });
    expect(
      after.links.map((l: { linkId: string; fillOrder: number; canUndo: boolean }) => [
        l.linkId,
        l.fillOrder,
        l.canUndo,
      ])
    ).toEqual([
      [r1Link, 1, true],
      [r2Link, 2, true],
    ]);

    expect((await req('r1')).status).toBe('PO_SENT');
    const r2 = await req('r2');
    expect([r2.status, Number(r2.shortfall)]).toEqual(['PO_SENT', 200]);
    const child = await prisma.material_requirements.findFirstOrThrow({ where: { splitFromId: R.r2 } });
    expect([child.requirementNumber, child.status, Number(child.shortfall)]).toEqual([childNumber, 'PO_REQUIRED', 100]);
    const audit = await prisma.audit_logs.findMany({
      where: { userId: adminId, entityType: 'purchase_order', entityId: poA },
    });
    expect(audit).toHaveLength(1);
  });

  it('a second submit of the same rows is refused, not linked twice', async () => {
    const res = await request(app)
      .post(`${BASE}/${poA}`)
      .set(admin)
      .send({ allocations: [row(a1, R.r1, 300)] })
      .expect(422);
    expect(res.body.details.rows[0].reason).toMatch(/already on/);
    expect(await linkCount()).toBe(2);
  });

  it('Undo returns the requirement to demand and folds its balance row back', async () => {
    const res = await request(app).delete(`${BASE}/${poA}/links/${r2Link}`).set(admin).expect(200);
    expect(res.body.data).toMatchObject({
      requirementNumber: `${RUN}-r2`,
      newStatus: 'PO_REQUIRED',
      foldedBack: [childNumber],
    });
    const line = res.body.data.allocation.lines.find((l: { itemId: string }) => l.itemId === a1);
    expect(line.links.map((l: { linkId: string }) => l.linkId)).toEqual([r1Link]);

    const r2 = await req('r2');
    expect([r2.status, Number(r2.shortfall)]).toEqual(['PO_REQUIRED', 300]);
    const child = await prisma.material_requirements.findFirstOrThrow({ where: { splitFromId: R.r2 } });
    expect(child.status).toBe('CANCELLED');

    // Gone now
    await request(app).delete(`${BASE}/${poA}/links/${r2Link}`).set(admin).expect(404);
  });

  it('a link is found only under its own PO', async () => {
    await request(app).delete(`${BASE}/${poD}/links/${r1Link}`).set(admin).expect(404);
    expect(await linkCount()).toBe(1);
  });

  it('422 PO_UNDO_REFUSED while a GRN on the line awaits QC', async () => {
    const grnId = randomUUID();
    await prisma.goods_receiving_notes.create({
      data: {
        id: grnId,
        grnNumber: `${RUN}-GRN-1`,
        poId: poA,
        supplierId,
        warehouseId: storeId,
        status: 'PENDING_QC',
        receivedById: adminId,
        receivingDate: new Date(),
        grn_items: {
          create: [
            {
              id: randomUUID(),
              poItemId: a1,
              materialId: m1,
              orderedQuantity: 100,
              receivedQuantity: 100,
              acceptedQuantity: 0,
              unit: 'PIECE',
            },
          ],
        },
      },
    });

    const view = await request(app).get(`${BASE}/${poA}?itemIds=${a1}`).set(admin).expect(200);
    const line = view.body.data.lines[0];
    expect(line).toMatchObject({ linkable: false, pendingQcGrnNumber: `${RUN}-GRN-1` });
    expect(line.links[0]).toMatchObject({
      linkId: r1Link,
      canUndo: false,
      undoBlockedReason: expect.stringMatching(/awaiting QC/),
    });

    const res = await request(app).delete(`${BASE}/${poA}/links/${r1Link}`).set(admin).expect(422);
    expect(res.body).toMatchObject({
      error: 'BUSINESS_ERROR',
      details: { code: 'PO_UNDO_REFUSED', linkId: r1Link, reason: expect.stringMatching(/awaiting QC/) },
    });
    expect(await linkCount()).toBe(1);
    expect((await req('r1')).status).toBe('PO_SENT');
  });
});
