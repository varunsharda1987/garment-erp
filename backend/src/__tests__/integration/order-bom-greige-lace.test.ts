/**
 * GREIGE_PROCESSED lace → order BOM (greige-lace dual-use, 2026-09-01).
 *
 * order_bom_items.greigeId is an enforced FK to greige_master (fabric). Order-BOM generation used
 * to copy a lace costing row's greigeLaceId — a lace_master id — straight into that column, so the
 * FIRST order ever placed against a cost sheet containing a Greige + Dyeing lace line would die
 * with a P2003 foreign-key violation. No test covered that path, which is why it shipped; the live
 * DB simply had no GREIGE_PROCESSED lace rows yet, so it had never fired.
 *
 * The greige lace source now lives in its own column, order_bom_items.greigeLaceId → lace_master.
 *
 * This suite also locks the surrounding dual-use contract:
 *   - the dyed variant endpoint is deduped on (greige, colour), because two masters for one
 *     greige+colour would split the dyed stock pool that lace_stock keys by laceId alone;
 *   - a dyed variant is never created against a finished lace, or a foreign greige.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';

const RUN = `OGL${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let customerId: string;
let orderId: string;
let orderBomId: string;
let greigeLaceId: string;
let dyedLaceId: string;

const ORDER_QTY = 300;

/** Never hand Prisma a possibly-undefined id: `where: { id: undefined }` matches EVERY row. */
const only = (id: string | undefined) => id ?? '__unset__';

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

  const greigeLace = await prisma.lace_master.create({
    data: {
      laceCode: `${RUN}-GLACE`,
      laceName: `${RUN} Greige Organza`,
      isGreige: true,
      costPerMeterGreige: 18.5,
      laceType: 'Organza',
      width: 1,
    },
  });
  greigeLaceId = greigeLace.id;

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

  const bom = await prisma.order_bom.create({
    data: { orderId, styleId, createdById: userId, status: 'DRAFT', isActive: true },
  });
  orderBomId = bom.id;
});

afterAll(async () => {
  await prisma.order_bom_items.deleteMany({ where: { orderBomId: only(orderBomId) } });
  await prisma.order_bom.deleteMany({ where: { id: only(orderBomId) } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  // Dyed variants are created by the endpoint under test — clear whatever it minted.
  await prisma.materials.deleteMany({ where: { laceId: { in: [only(greigeLaceId), only(dyedLaceId)] } } });
  await prisma.lace_master.deleteMany({ where: { sourceGreigeLaceId: only(greigeLaceId) } });
  await prisma.lace_master.deleteMany({ where: { id: only(greigeLaceId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('dyed lace variant creation', () => {
  it('creates the finished variant from a greige lace and links it back to its source', async () => {
    const res = await request(app)
      .post('/api/materials/lace/dyed-variant')
      .set(authHeader)
      .send({ greigeLaceId, color: 'Navy' })
      .expect(201);

    expect(res.body.created).toBe(true);
    dyedLaceId = res.body.lace.id;

    const variant = await prisma.lace_master.findUnique({ where: { id: dyedLaceId } });
    expect(variant?.isGreige).toBe(false);
    expect(variant?.sourceGreigeLaceId).toBe(greigeLaceId);
    expect(variant?.color).toBe('Navy');
    // Physical attributes are inherited: dyeing changes the colour, not the lace.
    expect(Number(variant?.width)).toBe(1);
    expect(variant?.laceType).toBe('Organza');
    // No style is known at creation, so the name must not carry a dangling "→ ?" placeholder.
    expect(variant?.laceName).not.toContain('?');

    // Material-identity invariant: materials.id === master.id
    const material = await prisma.materials.findUnique({ where: { id: dyedLaceId } });
    expect(material).not.toBeNull();
  });

  it('reuses the existing variant for the same greige and colour instead of minting a twin', async () => {
    const res = await request(app)
      .post('/api/materials/lace/dyed-variant')
      .set(authHeader)
      .send({ greigeLaceId, color: 'navy' }) // different case on purpose
      .expect(200);

    expect(res.body.created).toBe(false);
    expect(res.body.lace.id).toBe(dyedLaceId);

    const all = await prisma.lace_master.findMany({ where: { sourceGreigeLaceId: greigeLaceId } });
    expect(all).toHaveLength(1);
  });

  it('refuses to dye a lace that is not greige', async () => {
    await request(app)
      .post('/api/materials/lace/dyed-variant')
      .set(authHeader)
      .send({ greigeLaceId: dyedLaceId, color: 'Red' })
      .expect(400);
  });
});

describe('GREIGE_PROCESSED lace in the order BOM', () => {
  it('stores the greige lace in greigeLaceId — never in greigeId, which FKs greige_master', async () => {
    // This is the exact row shape order-bom.service builds for a GREIGE_PROCESSED lace line.
    // Writing greigeLaceId into greigeId here would raise P2003 instead of inserting.
    const item = await prisma.order_bom_items.create({
      data: {
        id: randomUUID(),
        orderBomId,
        materialType: 'LACE',
        laceId: dyedLaceId,
        greigeLaceId, // lace_master id — the column that now exists for it
        componentName: `${RUN} Navy Organza`,
        quantityPerGarment: 2,
        orderQuantity: ORDER_QTY,
        totalQuantity: 2 * ORDER_QTY,
        unit: 'METER',
        unitPrice: 31.5,
        totalCost: 2 * ORDER_QTY * 31.5,
        sourcingStrategy: 'GREIGE_PROCESSED',
        greigeCost: 18.5,
        processingCost: 13,
        sortOrder: 0,
      },
    });

    const stored = await prisma.order_bom_items.findUnique({
      where: { id: item.id },
      select: { greigeId: true, greigeLaceId: true, laceId: true },
    });

    expect(stored?.greigeLaceId).toBe(greigeLaceId);
    expect(stored?.laceId).toBe(dyedLaceId);
    // The fabric-greige column must stay empty for a lace line.
    expect(stored?.greigeId).toBeNull();
  });

  it('resolves the greige lace relation back to a lace master', async () => {
    const item = await prisma.order_bom_items.findFirst({
      where: { orderBomId, materialType: 'LACE' },
      include: { greigeLace: { select: { id: true, isGreige: true } } },
    });

    expect(item?.greigeLace?.id).toBe(greigeLaceId);
    expect(item?.greigeLace?.isGreige).toBe(true);
  });

  it('rejects a lace_master id written into greigeId (the bug this column exists to prevent)', async () => {
    await expect(
      prisma.order_bom_items.create({
        data: {
          id: randomUUID(),
          orderBomId,
          materialType: 'LACE',
          laceId: dyedLaceId,
          greigeId: greigeLaceId, // a lace id in the FABRIC greige column — must not be accepted
          componentName: `${RUN} Wrong Column`,
          quantityPerGarment: 1,
          orderQuantity: ORDER_QTY,
          totalQuantity: ORDER_QTY,
          unit: 'METER',
          unitPrice: 10,
          totalCost: ORDER_QTY * 10,
          sortOrder: 1,
        },
      })
    ).rejects.toThrow();
  });
});
