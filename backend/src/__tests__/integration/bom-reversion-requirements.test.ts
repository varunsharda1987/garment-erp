/**
 * A new Order BOM version carries the order's requirements over instead of duplicating them (2026-09-26).
 *
 * Before: every BOM rebuild gave each line a new id and MRP matched requirements by that id, so an open
 * requirement was cancelled and re-created under a new number (its stock reservation stranded), and a
 * requirement already on a PO was kept while a FULL new one was planned beside it — the cloth ordered
 * twice. Now each line knows the line it replaces (order_bom_items.previousItemId) and
 * requirement-reconcile.helper updates the row in place, or — beside a committed row — raises ONE
 * "needs X more" decision the team answers (Order the extra / Don't order more). Less needed → surplus.
 *
 * Runs against the live DB; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { calculateRequirementsFromOrder } from '../../services/mrp.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { only } from '../../utils/prisma-test-guard';

const RUN = `BRV${Date.now().toString(36).toUpperCase()}`;
const QTY = 1000;

let userId: string;
let authHeader: Record<string, string>;
let styleA: string;
let styleB: string;
let customerId: string;
let dyerId: string;
let warehouseId: string;
let greigeId: string;
let greige2Id: string; // the greige a later version switches to
let lotId: string;
let orderId: string;
let itemA: string;
let itemB: string;
let base = 0; // greige metres at 1 m per garment — what the formula makes of QTY (shrinkage and all)

const lineData = (qpg: number, lineGreigeId = greigeId) => ({
  materialType: 'GREIGE',
  greigeId: lineGreigeId,
  sourcingStrategy: 'GREIGE_PROCESSED',
  processorId: dyerId,
  componentName: 'Top - Moss',
  usageCategory: 'FABRIC',
  colorName: 'Black',
  quantityPerGarment: qpg,
  orderQuantity: QTY,
  totalQuantity: qpg * QTY,
  totalWithWastage: qpg * QTY,
  unit: 'METER' as const,
  unitPrice: 65,
  totalCost: 65 * qpg * QTY,
  greigeCost: 49,
  processingCost: 10,
  sortOrder: 0,
});

async function createBom(
  styleId: string,
  orderItemId: string,
  version: number,
  qpg: number,
  previousItemId?: string,
  lineGreigeId?: string
) {
  const bom = await prisma.order_bom.create({
    data: { orderId, styleId, orderItemId, createdById: userId, status: 'APPROVED', isActive: true, version },
  });
  const line = await prisma.order_bom_items.create({
    data: {
      id: randomUUID(),
      orderBomId: bom.id,
      ...lineData(qpg, lineGreigeId),
      previousItemId: previousItemId ?? null,
    },
  });
  return { bomId: bom.id, lineId: line.id };
}

/**
 * A new approved BOM version for style A, its line pointing back at the line it replaces — unless `paired` is
 * false (the matcher could not pair it) — optionally on another greige
 */
async function rebuildA(qpg: number, opts: { paired?: boolean; greige?: string } = {}) {
  const prev = await prisma.order_bom.findFirstOrThrow({
    where: { orderId, styleId: styleA, isActive: true },
    include: { items: true },
  });
  await prisma.order_bom.update({ where: { id: prev.id }, data: { isActive: false } });
  return createBom(
    styleA,
    itemA,
    prev.version + 1,
    qpg,
    opts.paired === false ? undefined : prev.items[0].id,
    opts.greige
  );
}

const recalc = () => calculateRequirementsFromOrder({ orderId, checkStock: true }, userId);

const liveOf = (orderItemId: string, requirementType: 'MATERIAL' | 'PROCESSING') =>
  prisma.material_requirements.findMany({
    where: { orderId, orderItemId, requirementType, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'asc' },
  });

const heldBy = async (requirementId: string) =>
  (await prisma.stock_reservations.findMany({ where: { referenceId: requirementId, status: 'ACTIVE' } })).reduce(
    (sum, r) => sum + Number(r.reservedQuantity),
    0
  );

const reservedOnLot = async () =>
  Number((await prisma.greige_stock.findUniqueOrThrow({ where: { id: lotId } })).quantityReserved ?? 0);

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const style = async (suffix: string) =>
    (
      await prisma.styles.create({
        data: { id: randomUUID(), styleCode: `${RUN}${suffix}`, styleName: `${RUN} ${suffix}`, createdById: userId },
      })
    ).id;
  styleA = await style('A');
  styleB = await style('B');
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
  warehouseId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-ST`,
        warehouseName: `${RUN} Store`,
        warehouseType: 'RAW_MATERIAL',
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
  greige2Id = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GG2`,
        greigeName: `${RUN} Moss 2`,
        genericGreigeName: `${RUN} Moss 2`,
        composition: '100% Viscose',
        greigeWidth: 63,
        createdById: userId,
      },
    })
  ).id;
  await ensureMaterialRecord(greige2Id, 'GREIGE');
  lotId = (
    await prisma.greige_stock.create({
      data: {
        greigeId,
        quantityAvailable: 600,
        greigeWidth: 63,
        receivedDate: new Date(),
        warehouseId,
        createdById: userId,
      },
    })
  ).id;

  orderId = (
    await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: `${RUN}ORD`,
        customerId,
        expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
        totalQuantity: 2 * QTY,
        totalAmount: 20000,
        createdById: userId,
      },
    })
  ).id;
  const item = async (styleId: string) =>
    (
      await prisma.order_items.create({
        data: { id: randomUUID(), orderId, styleId, totalQuantity: QTY, unitPrice: 10, totalPrice: 10 * QTY },
      })
    ).id;
  itemA = await item(styleA);
  itemB = await item(styleB);
  await createBom(styleA, itemA, 1, 1);
  await createBom(styleB, itemB, 1, 1);
});

afterAll(async () => {
  const reqIds = orderId
    ? (await prisma.material_requirements.findMany({ where: { orderId }, select: { id: true } })).map((r) => r.id)
    : [];
  const bomIds = orderId
    ? (await prisma.order_bom.findMany({ where: { orderId }, select: { id: true } })).map((b) => b.id)
    : [];
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['stock_reservations', () => prisma.stock_reservations.deleteMany({ where: { referenceId: { in: reqIds } } })],
    ['material_requirements', () => prisma.material_requirements.deleteMany({ where: { orderId: only(orderId) } })],
    ['audit_logs', () => prisma.audit_logs.deleteMany({ where: { userId: only(userId) } })],
    ['order_bom_items', () => prisma.order_bom_items.deleteMany({ where: { orderBomId: { in: bomIds } } })],
    ['order_bom', () => prisma.order_bom.deleteMany({ where: { orderId: only(orderId) } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: only(orderId) } })],
    ['greige_stock', () => prisma.greige_stock.deleteMany({ where: { greigeId: only(greigeId) } })],
    [
      'stock_levels',
      () =>
        prisma.stock_levels.deleteMany({
          where: { materials: { greigeId: { in: [greigeId, greige2Id].filter(Boolean) } } },
        }),
    ],
    [
      'materials',
      () => prisma.materials.deleteMany({ where: { greigeId: { in: [greigeId, greige2Id].filter(Boolean) } } }),
    ],
    [
      'greige_master',
      () => prisma.greige_master.deleteMany({ where: { id: { in: [greigeId, greige2Id].filter(Boolean) } } }),
    ],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } })],
    ['suppliers', () => prisma.suppliers.deleteMany({ where: { id: only(dyerId) } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: { in: [styleA, styleB].filter(Boolean) } } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[bom-reversion-requirements teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('a new Order BOM version and the requirements already planned', () => {
  let mA: { id: string; requirementNumber: string };
  let pA: { id: string; requirementNumber: string };
  let mB: string;
  let pB: string;

  it('updates the same requirement in place — same number, reservation kept, nothing duplicated', async () => {
    await calculateRequirementsFromOrder({ orderId, checkStock: true }, userId);
    [mA] = await liveOf(itemA, 'MATERIAL');
    // MRP suggests the free stock, it claims none: only Use Stock reserves (owner decision 26-Sep-2026)
    const suggested = await prisma.material_requirements.findUniqueOrThrow({ where: { id: mA.id } });
    expect(suggested.status).toBe('PO_REQUIRED');
    expect(Number(suggested.allocatedFromStock)).toBe(0);
    expect(Number(suggested.availableStock)).toBeCloseTo(600, 2);
    expect(Number(suggested.shortfall)).toBeCloseTo(Number(suggested.totalRequired), 3);
    expect(await reservedOnLot()).toBe(0);
    [pA] = await liveOf(itemA, 'PROCESSING');
    mB = (await liveOf(itemB, 'MATERIAL'))[0].id;
    pB = (await liveOf(itemB, 'PROCESSING'))[0].id;
    base = Number((await prisma.material_requirements.findUniqueOrThrow({ where: { id: mA.id } })).totalRequired);
    expect(base).toBeGreaterThan(300);

    await request(app)
      .post(`/api/mrp/requirements/${mA.id}/allocate-stock`)
      .set(authHeader)
      .send({ quantity: 300 })
      .expect(200);

    // Style B's new BOM is still a draft: its approved v1 is replaced, the draft not yet approved
    const bomB = await prisma.order_bom.findFirstOrThrow({ where: { orderId, styleId: styleB } });
    await prisma.order_bom.update({ where: { id: bomB.id }, data: { isActive: false } });
    await prisma.order_bom.create({
      data: {
        orderId,
        styleId: styleB,
        orderItemId: itemB,
        createdById: userId,
        status: 'DRAFT',
        isActive: true,
        version: 2,
      },
    });

    const v2 = await rebuildA(1.1);
    await recalc();

    const material = await liveOf(itemA, 'MATERIAL');
    expect(material).toHaveLength(1);
    expect(material[0].id).toBe(mA.id);
    expect(material[0].requirementNumber).toBe(mA.requirementNumber);
    expect(material[0].orderBomItemId).toBe(v2.lineId);
    expect(Number(material[0].totalRequired)).toBeCloseTo(base * 1.1, 1);
    expect(material[0].status).toBe('PARTIAL_STOCK');
    expect(Number(material[0].allocatedFromStock)).toBeCloseTo(300, 2);
    expect(Number(material[0].shortfall)).toBeCloseTo(base * 1.1 - 300, 1);
    expect(await heldBy(mA.id)).toBeCloseTo(300, 2);

    const processing = await liveOf(itemA, 'PROCESSING');
    expect(processing).toHaveLength(1);
    expect(processing[0].id).toBe(pA.id);
    expect(processing[0].requirementNumber).toBe(pA.requirementNumber);
    expect(processing[0].linkedRequirementId).toBe(mA.id);
    expect(processing[0].orderBomItemId).toBe(v2.lineId);
  });

  it('leaves a sibling style whose new BOM is still a draft alone', async () => {
    const material = await liveOf(itemB, 'MATERIAL');
    const processing = await liveOf(itemB, 'PROCESSING');
    expect(material.map((r) => r.id)).toEqual([mB]);
    expect(processing.map((r) => r.id)).toEqual([pB]);
  });

  it('gives back the reservation the smaller version no longer needs', async () => {
    await rebuildA(0.2);
    await recalc();
    const [row] = await liveOf(itemA, 'MATERIAL');
    expect(row.id).toBe(mA.id);
    expect(Number(row.totalRequired)).toBeCloseTo(base * 0.2, 1);
    expect(row.status).toBe('FULFILLED_STOCK');
    expect(await heldBy(mA.id)).toBeCloseTo(base * 0.2, 1);
    expect(await reservedOnLot()).toBeCloseTo(base * 0.2, 1);
  });

  let decisionId: string;

  it('beside a requirement already on a PO, raises ONE decision for the difference — no second full row', async () => {
    // What happened for real: the reservation was given up and a PO raised for this row
    await prisma.stock_reservations.updateMany({ where: { referenceId: mA.id }, data: { status: 'CANCELLED' } });
    await prisma.greige_stock.update({ where: { id: lotId }, data: { quantityReserved: 0 } });
    await prisma.material_requirements.update({
      where: { id: mA.id },
      data: { status: 'PO_GENERATED', allocatedFromStock: 0, shortfall: base * 0.2 },
    });

    await rebuildA(0.5);
    await recalc();

    const material = await liveOf(itemA, 'MATERIAL');
    expect(material).toHaveLength(2);
    const locked = material.find((r) => r.id === mA.id)!;
    expect(locked.status).toBe('PO_GENERATED');
    expect(Number(locked.totalRequired)).toBeCloseTo(base * 0.2, 1); // the PO row is never grown
    const decision = material.find((r) => r.id !== mA.id)!;
    expect(decision.status).toBe('DECISION_PENDING');
    expect(Number(decision.totalRequired)).toBeCloseTo(base * 0.3, 1);
    decisionId = decision.id;

    // The processing partner is not ordered yet — it follows the new need in place
    const processing = await liveOf(itemA, 'PROCESSING');
    expect(processing.map((r) => r.id)).toEqual([pA.id]);
    expect(processing[0].linkedRequirementId).toBe(mA.id);

    // A second recalculation asks the same question once, on the same row
    await recalc();
    const again = await liveOf(itemA, 'MATERIAL');
    expect(again.map((r) => r.id).sort()).toEqual([mA.id, decisionId].sort());
  });

  it('"Don\'t order more" is remembered — a recalculation does not ask again', async () => {
    const res = await request(app)
      .post(`/api/mrp/requirements/${decisionId}/decline-extra`)
      .set(authHeader)
      .send({ reason: 'Enough on the PO' })
      .expect(200);
    expect(res.body.success).toBe(true);
    const declined = await prisma.material_requirements.findUniqueOrThrow({ where: { id: decisionId } });
    expect(declined.status).toBe('CANCELLED');
    expect(declined.shortCloseReason).toBe('NOT_ORDERED');
    expect(Number(declined.shortQuantity)).toBeCloseTo(base * 0.3, 1);

    await recalc();
    expect((await liveOf(itemA, 'MATERIAL')).map((r) => r.id)).toEqual([mA.id]);
    expect((await prisma.material_requirements.findUniqueOrThrow({ where: { id: decisionId } })).status).toBe(
      'CANCELLED'
    );
  });

  let extraId: string;

  it('"Order the extra" makes only the new difference orderable, and it stays so', async () => {
    await rebuildA(0.7); // need 0.7 = 0.2 on PO + 0.3 declined + 0.2 new
    await recalc();
    const pending = (await liveOf(itemA, 'MATERIAL')).filter((r) => r.status === 'DECISION_PENDING');
    expect(pending).toHaveLength(1);
    expect(Number(pending[0].totalRequired)).toBeCloseTo(base * 0.2, 1);
    extraId = pending[0].id;

    await request(app).post(`/api/mrp/requirements/${extraId}/order-extra`).set(authHeader).expect(200);
    await recalc();
    const material = await liveOf(itemA, 'MATERIAL');
    expect(material.map((r) => r.id).sort()).toEqual([mA.id, extraId].sort());
    const extra = material.find((r) => r.id === extraId)!;
    expect(extra.status).toBe('PO_REQUIRED');
    expect(Number(extra.totalRequired)).toBeCloseTo(base * 0.2, 1);
  });

  it('less needed than the PO holds: the extra is withdrawn and the surplus shown — the PO row untouched', async () => {
    await rebuildA(0.1);
    await recalc();
    const material = await liveOf(itemA, 'MATERIAL');
    expect(material.map((r) => r.id)).toEqual([mA.id]);
    expect(material[0].status).toBe('PO_GENERATED');
    expect(Number(material[0].totalRequired)).toBeCloseTo(base * 0.2, 1);
    expect(Number(material[0].surplusQty)).toBeCloseTo(base * 0.1, 1);
    expect((await prisma.material_requirements.findUniqueOrThrow({ where: { id: extraId } })).status).toBe('CANCELLED');
  });

  it('a line the matcher could not pair still finds the PO row — no second full requirement', async () => {
    const v = await rebuildA(0.4, { paired: false });
    await recalc();
    // 0.4 needed = 0.2 on the PO + 0.3 declined earlier → nothing more to decide, nothing duplicated
    const material = await liveOf(itemA, 'MATERIAL');
    expect(material.map((r) => r.id)).toEqual([mA.id]);
    expect(material[0].surplusQty).toBeNull();
    const processing = await liveOf(itemA, 'PROCESSING');
    expect(processing.map((r) => r.id)).toEqual([pA.id]);
    expect(processing[0].orderBomItemId).toBe(v.lineId);
  });

  it("a greige change leaves the old greige's PO row alone and shows all of it as surplus", async () => {
    await rebuildA(0.4, { greige: greige2Id });
    await recalc();
    const old = await prisma.material_requirements.findUniqueOrThrow({ where: { id: mA.id } });
    expect(old.status).toBe('PO_GENERATED');
    expect(Number(old.surplusQty)).toBeCloseTo(Number(old.totalRequired), 3);
    const newGreige = (await liveOf(itemA, 'MATERIAL')).filter((r) => r.id !== mA.id);
    expect(newGreige).toHaveLength(1);
    expect(newGreige[0].status).toBe('PO_REQUIRED');
  });
});
