/**
 * The Requirements page's side of allocating a sent PO (docs/plans/po-allocation-design.md §6.4, §6.9, §7):
 *
 *  - GET /api/mrp/requirements carries `openPOSupply` on a row that still needs buying and is on no PO: the sent
 *    PO lines that could cover it, what is free to link and what arrived. A draft PO never appears; the row it
 *    is linked to loses the note; every link shows its rank, credit and what is held for it;
 *  - POST /requirements/:id/link-po (the one-row Link) goes through po-allocation.helper — PO_SENT, ranked,
 *    audited, a part cover leaves a balance row — and needs the MRP OR the Purchase Orders switch;
 *  - a hand status change cannot take a linked row out of a PO status or put an unlinked one into it; Cancel
 *    names Undo;
 *  - Use Stock refuses a row on a PO, and a trim takes only what is on the shelf beyond every order's holds —
 *    goods that arrived for a linked order are theirs; two Use Stocks racing on one row cannot both win;
 *  - a greige row's stock on the page and in Use Stock is read at ONE dyer — its PROCESSING child's — so the page
 *    never offers cloth lying at another dyer that Use Stock then refuses.
 *
 * Tagged fixtures (RUN), everything torn down; nothing real is touched.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { applyLineReceipts } from '../../services/helpers/receipt-allocation.helper';
import { PermissionService } from '../../services/permission.service';

jest.setTimeout(120000);

const RUN = `PAR${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;
const REQUIRED = new Date(Date.now() + 25 * DAY);

let adminId: string;
let salesId: string;
let admin: Record<string, string>;
let sales: Record<string, string>;
let supplierId: string;
let customerId: string;
let storeId: string;
let m1: string;
let master1: string;
const orderIds: string[] = [];
const poIds: string[] = [];
const O: Record<string, string> = {};
const R: Record<string, string> = {};
let poA: string; // SENT, TRIMS
let a1: string; // 1,000 pcs
let poD: string; // DRAFT
let d1: string; // 500 pcs
// Greige, for the dyer rule: 700 m in our store, 1,800 m already at dyer A; the row is dyed at dyer B
let greigeId: string;
let gm: string;
let dyerA: string;
let dyerB: string;
let unitA: string;
let storeLot: string;

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

async function makePo(suffix: string, status: 'SENT' | 'DRAFT', qty: number) {
  const poId = randomUUID();
  await prisma.purchase_orders.create({
    data: {
      id: poId,
      poNumber: `${RUN}-${suffix}`,
      supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 15 * DAY),
      status,
      poCategory: 'TRIMS',
      createdById: adminId,
    },
  });
  poIds.push(poId);
  const itemId = randomUUID();
  await prisma.purchase_order_items.create({
    data: { id: itemId, poId, materialId: m1, orderedQuantity: qty, unitPrice: 1, totalPrice: qty, unit: 'PIECE' },
  });
  return [poId, itemId] as const;
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
      requiredDate: REQUIRED,
      createdById: adminId,
    },
  });
  R[name] = id;
}

/** A trim lot on the shelf (the derived stock view reads it) */
async function shelve(qty: number) {
  await prisma.other_material_stock.create({
    data: {
      otherMaterialId: master1,
      quantityAvailable: qty,
      purchaseCost: 1,
      weightedAvgCost: 1,
      receivedDate: new Date(),
      warehouseId: storeId,
    },
  });
}

/** An approved receipt on a1 into the store, its lot, and the receipt engine run as GRN approval runs it */
async function receive(qty: number) {
  await prisma.goods_receiving_notes.create({
    data: {
      id: randomUUID(),
      grnNumber: `${RUN}-GRN-1`,
      poId: poA,
      supplierId,
      warehouseId: storeId,
      status: 'ACCEPTED',
      receivedById: adminId,
      approvedById: adminId,
      receivingDate: new Date(),
      grn_items: {
        create: [
          {
            id: randomUUID(),
            poItemId: a1,
            materialId: m1,
            orderedQuantity: qty,
            receivedQuantity: qty,
            acceptedQuantity: qty,
            stockQuantity: qty,
            unit: 'PIECE',
          },
        ],
      },
    },
  });
  await shelve(qty);
  await prisma.$transaction((tx) => applyLineReceipts(tx, [a1], { event: 'approve', userId: adminId }), {
    timeout: 30000,
  });
}

type Row = {
  id: string;
  requirementNumber: string;
  status: string;
  splitFromId: string | null;
  currentStock: number;
  receiptHeldQty: number;
  openPOSupply: Array<Record<string, unknown>>;
  poLinks: Array<Record<string, any>>;
};

/** What the Requirements page reads — every view calls this one endpoint */
async function listRows(): Promise<Record<string, Row>> {
  const res = await request(app)
    .get(`/api/mrp/requirements?materialId=${m1}&requirementType=MATERIAL&limit=100`)
    .set(admin)
    .expect(200);
  return Object.fromEntries((res.body.data as Row[]).map((r) => [r.id, r]));
}

const linkPo = (requirementId: string, body: Record<string, unknown>, auth = admin) =>
  request(app).post(`/api/mrp/requirements/${requirementId}/link-po`).set(auth).send(body);

const useStock = (requirementId: string, quantity: number) =>
  request(app)
    .post(`/api/mrp/requirements/${requirementId}/allocate-stock`)
    .set(admin)
    .send({ quantity, warehouseId: storeId });

const setStatus = (requirementId: string, status: string) =>
  request(app).patch(`/api/mrp/requirements/${requirementId}/status`).set(admin).send({ status });

const reload = async (name: string) => {
  const r = await prisma.material_requirements.findUniqueOrThrow({ where: { id: R[name] } });
  return { status: r.status, shortfall: Number(r.shortfall), allocated: Number(r.allocatedFromStock) };
};

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
  master1 = (
    await prisma.other_material_master.create({ data: { materialCode: `${RUN}-M1`, materialName: `${RUN} M1` } })
  ).id;
  m1 = await ensureMaterialRecord(master1, 'OTHER_MATERIAL');

  await makeOrder('O1', 10); // needs it before the PO arrives (+15 days)
  await makeOrder('O2', 20);
  [poA, a1] = await makePo('A', 'SENT', 1000);
  [poD, d1] = await makePo('D', 'DRAFT', 500);

  await makeRequirement('r1', 'O1', 300);
  await makeRequirement('r2', 'O2', 300);
  await makeRequirement('r3', 'O2', 50);
  await makeRequirement('r4', 'O2', 100);
  await makeRequirement('r5', 'O1', 40);
});

afterAll(async () => {
  jest.restoreAllMocks();
  const users = [only(adminId), only(salesId)];
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['audit', () => prisma.audit_logs.deleteMany({ where: { userId: { in: users } } })],
    ['reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: only(m1) } })],
    ['greige reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: only(gm) } })],
    [
      'greige processing rows',
      () => prisma.material_requirements.deleteMany({ where: { materialId: only(gm), requirementType: 'PROCESSING' } }),
    ],
    ['greige requirements', () => prisma.material_requirements.deleteMany({ where: { materialId: only(gm) } })],
    ['greige lots', () => prisma.greige_stock.deleteMany({ where: { greigeId: only(greigeId) } })],
    ['greige material', () => prisma.materials.deleteMany({ where: { id: only(gm) } })],
    ['greige master', () => prisma.greige_master.deleteMany({ where: { id: only(greigeId) } })],
    ['dyer unit', () => prisma.warehouses.deleteMany({ where: { id: only(unitA) } })],
    ['dyers', () => prisma.suppliers.deleteMany({ where: { id: { in: [only(dyerA), only(dyerB)] } } })],
    ['links', () => prisma.requirement_po_links.deleteMany({ where: { purchaseOrderId: { in: poIds } } })],
    ['grn items', () => prisma.grn_items.deleteMany({ where: { goods_receiving_notes: { poId: { in: poIds } } } })],
    ['grns', () => prisma.goods_receiving_notes.deleteMany({ where: { poId: { in: poIds } } })],
    ['trim lots', () => prisma.other_material_stock.deleteMany({ where: { otherMaterialId: only(master1) } })],
    ['po items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } })],
    ['pos', () => prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } })],
    [
      'balance rows',
      () => prisma.material_requirements.deleteMany({ where: { materialId: only(m1), splitFromId: { not: null } } }),
    ],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { materialId: only(m1) } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['customer', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['stock levels', () => prisma.stock_levels.deleteMany({ where: { materialId: only(m1) } })],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: only(storeId) } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: only(m1) } })],
    ['master', () => prisma.other_material_master.deleteMany({ where: { id: only(master1) } })],
    ['supplier', () => prisma.suppliers.deleteMany({ where: { id: only(supplierId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: { in: users } } })],
  ];
  for (const [label, step] of steps) {
    try {
      await step();
    } catch (err) {
      console.error(`[po-allocation-requirements teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('the Requirements list shows the open PO that is not linked', () => {
  it('an unlinked row that still needs buying carries the sent PO line; a draft PO never appears', async () => {
    const rows = await listRows();
    expect(rows[R.r3].openPOSupply).toEqual([
      {
        purchaseOrderId: poA,
        poNumber: `${RUN}-A`,
        poStatus: 'SENT',
        poCategory: 'TRIMS',
        supplierName: `${RUN} Supplier`,
        expectedDeliveryDate: expect.any(String),
        purchaseOrderItemId: a1,
        lineUnit: 'PIECE',
        stockUnitsPerUnit: null,
        orderedStockQty: 1000,
        arrivedQty: 0,
        allocatedQty: 0,
        freeToLink: 1000,
        arrivedFree: 0,
        toCome: 1000,
        // every unlinked row of this material that could take it: 300 + 300 + 50 + 100 + 40
        unlinkedDemandQty: 790,
        deliversTo: null,
        linkable: true,
        blockedReason: null,
        arrivesLate: false,
      },
    ]);
    // O1 needs it before the PO is due
    expect(rows[R.r5].openPOSupply[0]).toMatchObject({ purchaseOrderId: poA, arrivesLate: true });
    for (const row of Object.values(rows)) {
      expect(row.openPOSupply.map((s) => s.purchaseOrderId)).not.toContain(poD);
      expect(row.poLinks).toEqual([]);
      expect(row.receiptHeldQty).toBe(0);
    }
  });
});

describe('Link from the Requirements page (POST link-po)', () => {
  it('goes through the allocation helper: PO_SENT, ranked on the line, audited', async () => {
    const res = await linkPo(R.r1, { purchaseOrderId: poA, purchaseOrderItemId: a1, allocatedQuantity: 300 }).expect(
      200
    );
    expect(res.body.data.status).toBe('PO_SENT');
    expect(res.body.data.poLinks).toEqual([
      expect.objectContaining({
        purchaseOrderId: poA,
        purchaseOrderItemId: a1,
        allocatedQuantity: 300,
        receivedQuantity: 0,
        fillOrder: 1,
        heldQuantity: 0,
        issuedQuantity: 0,
        purchaseOrderItem: expect.objectContaining({ orderedQuantity: 1000, unit: 'PIECE', stockUnitsPerUnit: null }),
      }),
    ]);
    const audit = await prisma.audit_logs.findMany({
      where: { userId: adminId, entityType: 'purchase_order', entityId: poA },
    });
    expect(audit).toHaveLength(1);
  });

  it('a part cover leaves a balance row that can still be bought', async () => {
    await linkPo(R.r2, { purchaseOrderId: poA, purchaseOrderItemId: a1, allocatedQuantity: 200 }).expect(200);
    expect(await reload('r2')).toMatchObject({ status: 'PO_SENT', shortfall: 200 });
    const child = await prisma.material_requirements.findFirstOrThrow({ where: { splitFromId: R.r2 } });
    expect([child.status, Number(child.shortfall)]).toEqual(['PO_REQUIRED', 100]);
    R.r2b = child.id;
    // O1's earlier delivery ranks it first on the line, whatever order they were linked in
    const links = await prisma.requirement_po_links.findMany({
      where: { purchaseOrderItemId: a1 },
      orderBy: { fillOrder: 'asc' },
    });
    expect(links.map((l) => [l.requirementId, l.fillOrder])).toEqual([
      [R.r1, 1],
      [R.r2, 2],
    ]);
  });

  it('refuses a draft PO, a line of another PO and more than the row needs — and links nothing', async () => {
    const draft = await linkPo(R.r3, { purchaseOrderId: poD, purchaseOrderItemId: d1, allocatedQuantity: 10 }).expect(
      422
    );
    expect(draft.body.details.code).toBe('PO_ALLOCATION_REFUSED');
    expect(draft.body.message).toMatch(/only a sent PO/);

    const otherPo = await linkPo(R.r3, { purchaseOrderId: poA, purchaseOrderItemId: d1, allocatedQuantity: 10 }).expect(
      422
    );
    expect(otherPo.body.details.rows[0].reason).toMatch(/not on/);

    const tooMuch = await linkPo(R.r3, { purchaseOrderId: poA, purchaseOrderItemId: a1, allocatedQuantity: 60 }).expect(
      422
    );
    expect(tooMuch.body.details.rows[0].reason).toMatch(/more than it needs/);

    const again = await linkPo(R.r1, { purchaseOrderId: poA, purchaseOrderItemId: a1, allocatedQuantity: 10 }).expect(
      422
    );
    expect(again.body.message).toMatch(/covered by an existing PO/);

    expect(await reload('r3')).toMatchObject({ status: 'PO_REQUIRED' });
    expect(await prisma.requirement_po_links.count({ where: { purchaseOrderId: { in: poIds } } })).toBe(2);
  });

  it('needs the MRP or the Purchase Orders switch (D4)', async () => {
    try {
      denyKeys(['mrp', 'purchaseOrders']);
      const none = await linkPo(R.r3, { purchaseOrderId: poA, purchaseOrderItemId: a1, allocatedQuantity: 60 }, sales);
      expect(none.status).toBe(403);
      expect(none.body.code).toBe('PERMISSION_DENIED');
      jest.restoreAllMocks();

      // Purchase Orders alone gets past the gate (the MRP router's own write gate does not stop it); the
      // helper then refuses the quantity, so nothing is written
      denyKeys(['mrp']);
      const po = await linkPo(R.r3, { purchaseOrderId: poA, purchaseOrderItemId: a1, allocatedQuantity: 60 }, sales);
      expect(po.status).toBe(422);
      expect(po.body.details.code).toBe('PO_ALLOCATION_REFUSED');
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('the linked rows lose the note; the others show what is left free on the line', async () => {
    const rows = await listRows();
    expect(rows[R.r1].openPOSupply).toEqual([]);
    expect(rows[R.r2].openPOSupply).toEqual([]);
    for (const name of ['r2b', 'r3', 'r4', 'r5']) {
      expect(rows[R[name]].openPOSupply).toEqual([
        expect.objectContaining({
          purchaseOrderItemId: a1,
          allocatedQty: 500,
          freeToLink: 500,
          // 100 (r2's balance) + 50 + 100 + 40
          unlinkedDemandQty: 290,
          linkable: true,
        }),
      ]);
    }
  });
});

describe('a hand status change keeps a row and its PO link together', () => {
  it('a linked row cannot leave its PO status — undo it on the PO', async () => {
    for (const status of ['PO_REQUIRED', 'CANCELLED']) {
      const res = await setStatus(R.r1, status).expect(422);
      expect(res.body.details.code).toBe('REQUIREMENT_ON_PO');
      expect(res.body.message).toMatch(new RegExp(`undo it on ${RUN}-A`));
    }
    expect(await reload('r1')).toMatchObject({ status: 'PO_SENT' });
  });

  it('an unlinked row cannot be put into a PO status by hand', async () => {
    const res = await setStatus(R.r3, 'PO_GENERATED').expect(422);
    expect(res.body.details.code).toBe('REQUIREMENT_NOT_ON_PO');
    expect(await reload('r3')).toMatchObject({ status: 'PO_REQUIRED' });
  });

  it('Cancel on a linked row names Undo', async () => {
    const res = await request(app).delete(`/api/mrp/requirements/${R.r1}`).set(admin).expect(422);
    expect(res.body.message).toMatch(/undo its allocation on the PO/);
  });
});

describe('Use Stock', () => {
  it('refuses a row on a PO — by status, and by its link even when the status disagrees', async () => {
    const sent = await useStock(R.r1, 10).expect(422);
    expect(sent.body.details.code).toBe('USE_STOCK_REFUSED');

    // An older row left PO_REQUIRED beside a live link
    const link = await prisma.requirement_po_links.create({
      data: { requirementId: R.r5, purchaseOrderId: poA, purchaseOrderItemId: a1, allocatedQuantity: 40 },
    });
    try {
      const linked = await useStock(R.r5, 10).expect(422);
      expect(linked.body.message).toMatch(/undo its allocation on the PO/);
    } finally {
      await prisma.requirement_po_links.delete({ where: { id: link.id } });
    }
    expect(await reload('r5')).toMatchObject({ status: 'PO_REQUIRED', allocated: 0 });
  });

  it('goods that arrived for a linked order are held for it — not free for Use Stock', async () => {
    await receive(200);
    const rows = await listRows();
    // Earliest delivery first: r1 (O1) takes the 200, r2 nothing yet
    expect(rows[R.r1]).toMatchObject({ status: 'PARTIALLY_RECEIVED', receiptHeldQty: 200 });
    expect(rows[R.r1].poLinks[0]).toMatchObject({
      receivedQuantity: 200,
      heldQuantity: 200,
      issuedQuantity: 0,
      fillOrder: 1,
    });
    expect(rows[R.r2].poLinks[0]).toMatchObject({ receivedQuantity: 0, heldQuantity: 0 });
    expect(rows[R.r4].currentStock).toBe(0);
    expect(rows[R.r4].openPOSupply[0]).toMatchObject({ arrivedQty: 200, arrivedFree: 0, toCome: 800, freeToLink: 500 });

    const res = await useStock(R.r4, 10).expect(422);
    expect(res.body.details).toMatchObject({ code: 'USE_STOCK_SHORT', free: 0, onHand: 200, held: 200 });
    expect(res.body.message).toMatch(/held for other orders/);
    expect(await reload('r4')).toMatchObject({ status: 'PO_REQUIRED', allocated: 0 });
  });

  it('takes what is free beyond the holds, and holds it', async () => {
    await shelve(100);
    expect((await listRows())[R.r4].currentStock).toBe(100);
    await useStock(R.r4, 60).expect(200);
    expect(await reload('r4')).toEqual({ status: 'PARTIAL_STOCK', shortfall: 40, allocated: 60 });
    const holds = await prisma.stock_reservations.findMany({ where: { referenceId: R.r4, status: 'ACTIVE' } });
    expect(holds.map((h) => [Number(h.reservedQuantity), h.poLinkId])).toEqual([[60, null]]);
    expect((await listRows())[R.r4].currentStock).toBe(40);
  });

  it('two Use Stocks racing on one row: exactly one wins', async () => {
    const results = await Promise.all([useStock(R.r4, 40), useStock(R.r4, 40)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
    expect(await reload('r4')).toEqual({ status: 'FULFILLED_STOCK', shortfall: 0, allocated: 100 });
    expect((await listRows())[R.r4].currentStock).toBe(0);
  });
});

describe('greige: the page and Use Stock read the same dyer', () => {
  beforeAll(async () => {
    const mkDyer = async (tag: string) =>
      (
        await prisma.suppliers.create({
          data: {
            code: `${RUN}-${tag}`,
            name: `${RUN} Dyer ${tag}`,
            supplierCategories: ['DYEING_PRINTING'],
            createdById: adminId,
          },
        })
      ).id;
    dyerA = await mkDyer('DA');
    dyerB = await mkDyer('DB');
    unitA = (
      await prisma.warehouses.create({
        data: {
          warehouseCode: `${RUN}-JWA`,
          warehouseName: `${RUN} Dyer A - Processing Unit`,
          warehouseType: 'JOB_WORK',
          supplierId: dyerA,
          isActive: true,
          createdById: adminId,
        },
      })
    ).id;
    greigeId = (
      await prisma.greige_master.create({
        data: {
          greigeCode: `${RUN}-GRG`,
          greigeName: `${RUN} Cambric 63"`,
          genericGreigeName: `${RUN} Cambric`,
          composition: '100% Cotton',
          greigeWidth: 63,
          createdById: adminId,
        },
      })
    ).id;
    gm = await ensureMaterialRecord(greigeId, 'GREIGE');
    const lot = (quantityAvailable: number, warehouseId: string, extra: Record<string, unknown> = {}) =>
      prisma.greige_stock.create({
        data: {
          greigeId,
          quantityAvailable,
          greigeWidth: 63,
          receivedDate: new Date(Date.now() - DAY),
          warehouseId,
          createdById: adminId,
          ...extra,
        },
      });
    storeLot = (await lot(700, storeId, { sourceType: 'GRN' })).id;
    await lot(1800, unitA, { sourceType: 'DIRECT', processorId: dyerA });

    // The MATERIAL row names no dyer (live: null); its PROCESSING child is dyed at dyer B
    await makeOrder('OG', 30);
    const id = randomUUID();
    await prisma.material_requirements.create({
      data: {
        id,
        requirementNumber: `${RUN}-g1`,
        source: 'MANUAL',
        unit: 'METER',
        materialId: gm,
        orderId: O.OG,
        orderQuantity: 1,
        quantityPerUnit: 3000,
        wastagePercent: 0,
        totalRequired: 3000,
        shortfall: 3000,
        status: 'PO_REQUIRED',
        requiredDate: REQUIRED,
        createdById: adminId,
      },
    });
    R.g1 = id;
    await prisma.material_requirements.create({
      data: {
        id: randomUUID(),
        requirementNumber: `${RUN}-g1P`,
        requirementType: 'PROCESSING',
        source: 'MANUAL',
        unit: 'METER',
        materialId: gm,
        orderId: O.OG,
        linkedRequirementId: id,
        processorId: dyerB,
        orderQuantity: 1,
        quantityPerUnit: 3000,
        wastagePercent: 0,
        totalRequired: 3000,
        shortfall: 3000,
        status: 'PENDING',
        requiredDate: REQUIRED,
        createdById: adminId,
      },
    });
  });

  const greigeStock = async () => {
    const res = await request(app)
      .get(`/api/mrp/requirements?materialId=${gm}&requirementType=MATERIAL&limit=100`)
      .set(admin)
      .expect(200);
    return (res.body.data as Row[]).find((r) => r.id === R.g1)!.currentStock;
  };

  it("counts our store only — dyer A's cloth is not the row's to use", async () => {
    // Until 2026-09-29 the page read the row's own processorId (null), so it showed 2,500 m here
    expect(await greigeStock()).toBe(700);
  });

  it('Use Stock takes exactly what the page offered, from the store lot, and no more', async () => {
    const res = await useStock(R.g1, 701).expect(422);
    expect(res.body.message).toMatch(/Only 700 is free on the lots/);
    await useStock(R.g1, 700).expect(200);
    expect(await reload('g1')).toEqual({ status: 'PARTIAL_STOCK', shortfall: 2300, allocated: 700 });
    expect(Number((await prisma.greige_stock.findUniqueOrThrow({ where: { id: storeLot } })).quantityReserved)).toBe(
      700
    );
    expect(await greigeStock()).toBe(0);
  });
});
