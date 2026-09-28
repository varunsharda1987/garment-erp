/**
 * "For: <buyer>" and each line's whose-and-what on a PO (2026-09-28).
 *
 * PO2609-0231 bought Easybuy's size labels (LBL-0004 XS–XXL, no order, no style) and nothing on the PO page,
 * the list or the print said Easybuy. Walks the same shape on tagged fixtures:
 *  - labels + packaging of ONE buyer, no order / style → forBuyer { name, source 'LINES' }
 *  - lines of two buyers → null (never a guess)
 *  - a linked order → source 'ORDER' (the order's customer wins over the lines'); a linked style → 'STYLE'
 *  - every line's material carries buyerBrand / spec, on GET /:id and the list; the printed PO says "For"
 *    and prints the detail once under a label's heading.
 *
 * Tagged fixtures (RUN prefix) against the live database, torn down in FK order.
 */
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { buildPurchaseOrderDocData } from '../../services/document-data/purchase-order.doc-data';

const RUN = `PFB${Date.now().toString(36).toUpperCase()}`;
const DAY = 86_400_000;

let authHeader: Record<string, string>;
let userId: string;
let supplierId: string;
let categoryId: string;
const customerIds: string[] = [];
const labelIds: string[] = [];
const packagingIds: string[] = [];
const materialIds: string[] = [];
const poIds: string[] = [];
let styleId: string;
let orderId: string;

/** A label of `customerId` with one materials row per size (the same-ID base row, then the size rows) */
async function sizedLabel(key: string, customerId: string, sizes: string[]) {
  const label = await prisma.label_master.create({
    data: {
      labelCode: `${RUN}-${key}`,
      labelName: `${RUN} ${key} Label`,
      labelType: 'Main Cum Size Label',
      material: 'Satin',
      color: 'Black',
      customerId,
    },
  });
  labelIds.push(label.id);
  const base = { categoryId, materialType: 'LABEL' as const, unit: 'PIECE' as const, labelId: label.id };
  await prisma.materials.create({ data: { ...base, id: label.id, code: `${RUN}-${key}`, name: label.labelName } });
  materialIds.push(label.id);
  const sizeRows: string[] = [];
  for (const size of sizes) {
    const v = await prisma.label_size_variants.create({ data: { id: randomUUID(), labelId: label.id, size } });
    await prisma.materials.create({
      data: {
        ...base,
        id: v.id,
        code: `${RUN}-${key}-${size}`,
        name: `${label.labelName} - Size ${size}`,
        sizeVariantId: v.id,
      },
    });
    materialIds.push(v.id);
    sizeRows.push(v.id);
  }
  return sizeRows;
}

async function po(n: number, materials: string[], links: { orderId?: string; styleId?: string } = {}) {
  const id = randomUUID();
  await prisma.purchase_orders.create({
    data: {
      id,
      poNumber: `${RUN}-PO${n}`,
      supplierId,
      expectedDeliveryDate: new Date(Date.now() + 7 * DAY),
      status: 'DRAFT',
      poCategory: 'ACCESSORIES',
      createdById: userId,
      ...links,
    },
  });
  poIds.push(id);
  for (const materialId of materials) {
    await prisma.purchase_order_items.create({
      data: {
        id: randomUUID(),
        poId: id,
        materialId,
        orderedQuantity: 100,
        unitPrice: 0.6,
        totalPrice: 60,
        unit: 'PIECE',
      },
    });
  }
  return id;
}

let linesPo: string;
let mixedPo: string;
let orderPo: string;
let stylePo: string;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@pfb.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
  categoryId = (await prisma.material_categories.findFirstOrThrow({ select: { id: true } })).id;
  supplierId = (
    await prisma.suppliers.create({ data: { code: `${RUN}S`, name: `${RUN} Labels`, createdById: userId } })
  ).id;
  for (const key of ['A', 'B']) {
    const c = await prisma.customers.create({
      data: {
        code: `${RUN}C${key}`,
        name: `${RUN} Buyer ${key}`,
        type: 'BUYER',
        category: 'DOMESTIC',
        createdById: userId,
      },
    });
    customerIds.push(c.id);
  }
  const [buyerA, buyerB] = customerIds;

  const labelA = await sizedLabel('LA', buyerA, ['S', 'M']);
  const labelB = await sizedLabel('LB', buyerB, ['S']);
  const bag = await prisma.packaging_master.create({
    data: {
      packagingCode: `${RUN}-PK`,
      packagingName: `${RUN} Poly Bag`,
      packagingType: 'Poly Bag',
      size: '12X16',
      customerId: buyerA,
    },
  });
  packagingIds.push(bag.id);
  await prisma.materials.create({
    data: {
      id: bag.id,
      code: `${RUN}-PK`,
      name: bag.packagingName,
      categoryId,
      materialType: 'PACKAGING',
      unit: 'PIECE',
      packagingId: bag.id,
    },
  });
  materialIds.push(bag.id);

  styleId = (
    await prisma.styles.create({
      data: {
        id: randomUUID(),
        styleCode: `${RUN}ST`,
        styleName: `${RUN} Style`,
        customerId: buyerB,
        createdById: userId,
      },
    })
  ).id;
  orderId = (
    await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: `${RUN}ORD`,
        customerId: buyerB,
        expectedDeliveryDate: new Date(Date.now() + 30 * DAY),
        totalQuantity: 10,
        totalAmount: 100,
        createdById: userId,
      },
    })
  ).id;

  linesPo = await po(1, [...labelA, bag.id]); // PO2609-0231's shape: one buyer's labels (+ its bag)
  mixedPo = await po(2, [labelA[0], labelB[0]]);
  orderPo = await po(3, labelA, { orderId }); // lines say A, the order says B
  stylePo = await po(4, labelA, { styleId }); // lines say A, the style says B
});

afterAll(async () => {
  await prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds.map((id) => only(id)) } } });
  await prisma.purchase_orders.deleteMany({ where: { id: { in: poIds.map((id) => only(id)) } } });
  if (orderId) await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  if (styleId) await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.materials.deleteMany({ where: { id: { in: materialIds.map((id) => only(id)) } } });
  await prisma.label_size_variants.deleteMany({ where: { labelId: { in: labelIds.map((id) => only(id)) } } });
  await prisma.label_master.deleteMany({ where: { id: { in: labelIds.map((id) => only(id)) } } });
  await prisma.packaging_master.deleteMany({ where: { id: { in: packagingIds.map((id) => only(id)) } } });
  await prisma.customers.deleteMany({ where: { id: { in: customerIds.map((id) => only(id)) } } });
  if (supplierId) await prisma.suppliers.deleteMany({ where: { id: only(supplierId) } });
  if (userId) await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

const getPo = async (id: string) =>
  (await request(app).get(`/api/purchase-orders/${id}`).set(authHeader).expect(200)).body.data;

describe('PO "For: <buyer>" and line details', () => {
  it('one buyer on every buyer-carrying line, no order or style → that buyer, from the LINES', async () => {
    const data = await getPo(linesPo);
    expect(data.forBuyer).toEqual({ name: `${RUN} Buyer A`, source: 'LINES', orderNumber: null, styleCode: null });

    const byCode = new Map(data.items.map((i: any) => [i.materials.code, i.materials]));
    expect(byCode.get(`${RUN}-LA-S`)).toMatchObject({
      buyerBrand: `${RUN} Buyer A`,
      spec: 'Sewn-in · Main Cum Size Label · Satin · Black',
    });
    expect(byCode.get(`${RUN}-PK`)).toMatchObject({ buyerBrand: `${RUN} Buyer A`, spec: 'Poly Bag · 12X16' });
  });

  it('lines of two buyers → nobody, never a guess', async () => {
    expect((await getPo(mixedPo)).forBuyer).toBeNull();
  });

  it('a linked order names the buyer (over the lines); a linked style does when there is no order', async () => {
    expect((await getPo(orderPo)).forBuyer).toEqual({
      name: `${RUN} Buyer B`,
      source: 'ORDER',
      orderNumber: `${RUN}ORD`,
      styleCode: null,
    });
    expect((await getPo(stylePo)).forBuyer).toEqual({
      name: `${RUN} Buyer B`,
      source: 'STYLE',
      orderNumber: null,
      styleCode: `${RUN}ST`,
    });
  });

  it('the list carries forBuyer and each line material its detail', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .query({ search: RUN, limit: '20' })
      .set(authHeader)
      .expect(200);
    const byNumber = new Map(res.body.data.map((p: any) => [p.poNumber, p]));
    expect((byNumber.get(`${RUN}-PO1`) as any).forBuyer?.source).toBe('LINES');
    expect((byNumber.get(`${RUN}-PO2`) as any).forBuyer).toBeNull();
    expect((byNumber.get(`${RUN}-PO3`) as any).forBuyer?.source).toBe('ORDER');
    const line = (byNumber.get(`${RUN}-PO1`) as any).items.find((i: any) => i.materials.code === `${RUN}-LA-M`);
    expect(line.materials.buyerBrand).toBe(`${RUN} Buyer A`);
    expect(line.materials.spec).toBe('Sewn-in · Main Cum Size Label · Satin · Black');
  });

  it('the printed PO says who it is for and prints the detail once under the label heading', async () => {
    const doc = await buildPurchaseOrderDocData(linesPo);
    expect(doc.forBuyer).toBe(`${RUN} Buyer A`);
    const heading = doc.items.find((i) => i.isGroup);
    expect(heading?.detail).toBe(`${RUN} Buyer A · Sewn-in · Main Cum Size Label · Satin · Black`);
    expect(doc.items.filter((i) => i.isSize).every((i) => i.detail === null)).toBe(true);
    expect(doc.items.find((i) => i.code === `${RUN}-PK`)?.detail).toBe(`${RUN} Buyer A · Poly Bag · 12X16`);

    expect((await buildPurchaseOrderDocData(orderPo)).forBuyer).toBe(`${RUN} Buyer B · Order ${RUN}ORD`);
  });
});
