/**
 * Label sets — a style's labels ordered together, all sizes, and shown grouped (2026-09-26).
 *
 * A style's label set is its BOM's label lines; a sized label is one materials row per size. This walks:
 *  - GET /api/styles/:id/label-set, without an order (style BOM + default extra %) and with one (the order's
 *    garments per size summed across colours, the approved order BOM's labels per garment / extra %, sizes a
 *    label lacks, open requirements);
 *  - GET /api/mrp/requirements?materialType=LABEL — every row names its label and size;
 *  - the PO preview lists a label's sizes together in size order, and a generated PO keeps componentName
 *    (every MRP-made PO line used to store null);
 *  - the printed PO shows one heading per label with its sizes beneath, totals unchanged.
 *
 * Tagged fixtures (RUN prefix) against the live database, torn down in FK order.
 */
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import {
  calculateRequirementsFromOrder,
  generatePOFromRequirements,
  previewPOsFromRequirements,
} from '../../services/mrp.service';
import { buildPurchaseOrderDocData } from '../../services/document-data/purchase-order.doc-data';
import { systemSettingsService } from '../../services/system-settings.service';

const RUN = `LSET${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let supplierId: string;
let customerId: string;
let styleId: string;
let orderId: string;
let orderBomId: string;
let poId: string | null = null;
const labelIds: string[] = [];
const materialIds: string[] = [];
const colorIds: string[] = [];

// L1: XS/S/M · L2: S/M (no XS) · L3: unsized
const LABELS = [
  { key: 'L1', sizes: ['XS', 'S', 'M'], styleExtra: null, bomQty: 1, bomExtra: 5, price: 1 },
  { key: 'L2', sizes: ['S', 'M'], styleExtra: 7, bomQty: 2, bomExtra: 10, price: 2 },
  { key: 'L3', sizes: [] as string[], styleExtra: 0, bomQty: 1, bomExtra: 0, price: 0.5 },
];
// Black: XS 10, S 20, M 30 · Beige: XS 5, S 5 → XS 15, S 25, M 30 (70 garments)
const BREAKUP: Array<[colour: 'Black' | 'Beige', size: string, qty: number]> = [
  ['Black', 'XS', 10],
  ['Black', 'S', 20],
  ['Black', 'M', 30],
  ['Beige', 'XS', 5],
  ['Beige', 'S', 5],
];

const code = (key: string) => `${RUN}-${key}`;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@lset.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
  const categoryId = (await prisma.material_categories.findFirstOrThrow({ select: { id: true } })).id;

  supplierId = (
    await prisma.suppliers.create({ data: { code: `${RUN}S`, name: `${RUN} Labels`, createdById: userId } })
  ).id;
  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}ST`, styleName: `${RUN} Style`, createdById: userId },
    })
  ).id;
  const sizeIdByName = new Map<string, string>();
  for (const s of ['XS', 'S', 'M']) {
    const so = await prisma.size_options.create({ data: { id: randomUUID(), styleId, sizeName: s, sizeCode: s } });
    sizeIdByName.set(s, so.id);
  }
  const colorIdByName = new Map<string, string>();
  for (const c of ['Black', 'Beige']) {
    const co = await prisma.color_options.create({ data: { id: randomUUID(), styleId, colorName: c } });
    colorIdByName.set(c, co.id);
    colorIds.push(co.id);
  }

  for (const [idx, l] of LABELS.entries()) {
    const label = await prisma.label_master.create({
      data: { labelCode: code(l.key), labelName: `${RUN} ${l.key} Label`, labelType: `${l.key} Type` },
    });
    labelIds.push(label.id);
    await prisma.materials.create({
      data: {
        id: label.id,
        code: code(l.key),
        name: label.labelName,
        categoryId,
        materialType: 'LABEL',
        unit: 'PIECE',
        labelId: label.id,
      },
    });
    materialIds.push(label.id);
    if (l.key !== 'L3')
      await prisma.label_suppliers.create({ data: { labelId: label.id, supplierId, isPreferred: true } });
    // Sizes created in REVERSE, so size order comes from compareSizes, not insertion
    for (const size of [...l.sizes].reverse()) {
      const v = await prisma.label_size_variants.create({ data: { id: randomUUID(), labelId: label.id, size } });
      await prisma.materials.create({
        data: {
          id: v.id,
          code: `${code(l.key)}-${size}`,
          name: `${label.labelName} - Size ${size}`,
          categoryId,
          materialType: 'LABEL',
          unit: 'PIECE',
          labelId: label.id,
          sizeVariantId: v.id,
        },
      });
      materialIds.push(v.id);
    }
    await prisma.style_material_bom.create({
      data: {
        styleId,
        materialType: 'LABEL',
        labelId: label.id,
        materialId: label.id,
        usageCategory: 'PACKAGING',
        componentName: label.labelName,
        quantityPerGarment: 1,
        extraPercentage: l.styleExtra,
        unit: 'PIECE',
        sortOrder: idx,
      },
    });
  }

  orderId = (
    await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: `${RUN}ORD`,
        customerId,
        expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
        totalQuantity: 70,
        totalAmount: 700,
        createdById: userId,
      },
    })
  ).id;
  const orderItemId = (
    await prisma.order_items.create({
      data: { id: randomUUID(), orderId, styleId, totalQuantity: 70, unitPrice: 10, totalPrice: 700 },
    })
  ).id;
  for (const [colour, size, qty] of BREAKUP) {
    await prisma.order_item_breakup.create({
      data: {
        id: randomUUID(),
        orderItemId,
        colorId: colorIdByName.get(colour)!,
        sizeId: sizeIdByName.get(size)!,
        quantity: qty,
      },
    });
  }
  orderBomId = (
    await prisma.order_bom.create({
      data: { orderId, styleId, createdById: userId, status: 'APPROVED', isActive: true },
    })
  ).id;
  for (const [idx, l] of LABELS.entries()) {
    await prisma.order_bom_items.create({
      data: {
        id: randomUUID(),
        orderBomId,
        materialType: 'LABEL',
        labelId: labelIds[idx],
        materialId: labelIds[idx],
        componentName: `${RUN} ${l.key} Label`,
        quantityPerGarment: l.bomQty,
        wastagePercent: l.bomExtra,
        orderQuantity: 70,
        totalQuantity: 70 * l.bomQty,
        unit: 'PIECE',
        unitPrice: l.price,
        totalCost: 70 * l.bomQty * l.price,
        sortOrder: idx,
      },
    });
  }
});

afterAll(async () => {
  if (poId) {
    await prisma.requirement_po_links.deleteMany({ where: { purchaseOrderId: only(poId) } });
    await prisma.purchase_order_items.deleteMany({ where: { poId: only(poId) } });
    await prisma.purchase_orders.deleteMany({ where: { id: only(poId) } });
  }
  await prisma.material_requirements.deleteMany({ where: { orderId: only(orderId) } });
  await prisma.order_bom_items.deleteMany({ where: { orderBomId: only(orderBomId) } });
  await prisma.order_bom.deleteMany({ where: { id: only(orderBomId) } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } }); // cascades items + breakup
  await prisma.style_material_bom.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.materials.deleteMany({ where: { labelId: { in: labelIds.map((id) => only(id)) } } });
  await prisma.materials.deleteMany({ where: { id: { in: materialIds.map((id) => only(id)) } } });
  await prisma.label_size_variants.deleteMany({ where: { labelId: { in: labelIds.map((id) => only(id)) } } });
  await prisma.label_master.deleteMany({ where: { id: { in: labelIds.map((id) => only(id)) } } }); // cascades label_suppliers
  await prisma.size_options.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.color_options.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(supplierId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

const labelOf = (set: any, key: string) => set.labels.find((l: any) => l.code === code(key));

describe('label sets', () => {
  it('label-set without an order: the style BOM, the default extra %, sizes in size order', async () => {
    const res = await request(app).get(`/api/styles/${styleId}/label-set`).set(authHeader).expect(200);
    const set = res.body.data;
    const defaultExtra = await systemSettingsService.getNumberDefault('TRIM_DEFAULT_WASTAGE_PERCENT');
    expect(set.source).toBe('STYLE_BOM');
    expect(set.order).toBeNull();
    expect(set.labels.map((l: any) => l.code)).toEqual([code('L1'), code('L2'), code('L3')]);
    expect(labelOf(set, 'L1').extraPercent).toBe(defaultExtra);
    expect(labelOf(set, 'L2').extraPercent).toBe(7);
    expect(labelOf(set, 'L1').sizes.map((s: any) => s.size)).toEqual(['XS', 'S', 'M']);
    expect(labelOf(set, 'L3').sizes).toEqual([]);
    expect(labelOf(set, 'L3').baseMaterialId).toBe(labelIds[2]);
    expect(labelOf(set, 'L1').supplierLinks.map((s: any) => s.supplierId)).toEqual([supplierId]);
  });

  it('MRP requirements carry their label and size; ?materialType filters by the material', async () => {
    await calculateRequirementsFromOrder({ orderId, checkStock: false }, userId);
    const res = await request(app)
      .get('/api/mrp/requirements')
      .query({ orderId, materialType: 'LABEL', limit: '100' })
      .set(authHeader)
      .expect(200);
    const rows: any[] = res.body.data;
    // L1: 5 breakup rows (XS/S black+beige, M black) · L2: 3 (XS has no size) · L3: 1
    expect(rows).toHaveLength(9);
    for (const r of rows) expect(r.label?.id).toBeDefined();
    expect(rows.filter((r) => r.label.code === code('L3')).map((r) => r.size)).toEqual([null]);
    expect(
      rows
        .filter((r) => r.label.code === code('L1'))
        .map((r) => r.size)
        .sort()
    ).toEqual(['M', 'S', 'S', 'XS', 'XS']);
    const none = await request(app)
      .get('/api/mrp/requirements')
      .query({ orderId, materialType: 'BUTTON' })
      .set(authHeader)
      .expect(200);
    expect(none.body.data).toHaveLength(0);
  });

  it('label-set with the order: sizes summed across colours, the order BOM, missing sizes, open requirements', async () => {
    const res = await request(app)
      .get(`/api/styles/${styleId}/label-set`)
      .query({ orderId })
      .set(authHeader)
      .expect(200);
    const set = res.body.data;
    expect(set.source).toBe('ORDER_BOM');
    expect(set.order.sizes).toEqual([
      { size: 'XS', garments: 15 },
      { size: 'S', garments: 25 },
      { size: 'M', garments: 30 },
    ]);
    expect(set.order.totalGarments).toBe(70);
    expect(labelOf(set, 'L1').sizes.map((s: any) => s.orderGarments)).toEqual([15, 25, 30]);
    expect(labelOf(set, 'L2').quantityPerGarment).toBe(2);
    expect(labelOf(set, 'L2').extraPercent).toBe(10);
    expect(labelOf(set, 'L2').orderSizesMissing).toEqual(['XS']);
    expect(labelOf(set, 'L3').orderSizesMissing).toEqual([]); // unsized takes the total
    expect(set.labels.map((l: any) => l.openRequirementCount)).toEqual([5, 3, 1]);
  });

  it('the PO preview lists each label’s sizes together, in size order, and names label + size', async () => {
    const reqs = await prisma.material_requirements.findMany({ where: { orderId }, select: { id: true } });
    const [group] = await previewPOsFromRequirements({
      groups: [
        {
          supplierId,
          requirementIds: reqs.map((r) => r.id),
          expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        },
      ],
    });
    expect(group.items.map((i) => i.materialCode)).toEqual([
      `${code('L1')}-XS`,
      `${code('L1')}-S`,
      `${code('L1')}-M`,
      `${code('L2')}-S`,
      `${code('L2')}-M`,
      code('L3'),
    ]);
    expect(group.items.map((i) => i.size)).toEqual(['XS', 'S', 'M', 'S', 'M', null]);
    expect(group.items[0].label?.code).toBe(code('L1'));
    expect(group.items[0].quantity).toBeCloseTo(15 * 1.05, 3); // XS black 10 + beige 5, +5% (MRP keeps fractions)
  });

  it('a generated PO keeps componentName, and prints each label as a heading with its sizes beneath', async () => {
    const reqs = await prisma.material_requirements.findMany({ where: { orderId }, select: { id: true } });
    const result = await generatePOFromRequirements(
      {
        requirementIds: reqs.map((r) => r.id),
        supplierId,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        consolidate: true,
      },
      userId
    );
    poId = result.purchaseOrder!.id;
    const lines = await prisma.purchase_order_items.findMany({ where: { poId }, select: { componentName: true } });
    expect(lines).toHaveLength(6);
    // Every size line says which label and size it is (MRP names only size lines; L3's plain line has none)
    const named = lines.map((l) => l.componentName).filter(Boolean);
    expect(named).toHaveLength(5);
    for (const n of named) {
      expect(n!.startsWith(`${RUN} L`)).toBe(true);
      expect(n).toMatch(/ Label \((XS|S|M)\)$/);
    }

    const doc = await buildPurchaseOrderDocData(poId);
    expect(doc.items.map((i) => i.sn)).toEqual([1, null, null, null, 2, null, null, 3]);
    expect(doc.items.map((i) => (i.isGroup ? 'H' : i.isSize ? i.name : 'line'))).toEqual([
      'H',
      'Size XS',
      'Size S',
      'Size M',
      'H',
      'Size S',
      'Size M',
      'line',
    ]);
    expect(doc.items[0].name).toBe(`${RUN} L1 Label`);
    expect(doc.items[0].code).toBe(`${code('L1')} · 3 sizes`);
  });

  it('the PO page and the GRN form get each line’s label and size', async () => {
    const detail = await request(app).get(`/api/purchase-orders/${poId}`).set(authHeader).expect(200);
    const po = detail.body.data ?? detail.body;
    const sized = (po.items as any[]).filter((i) => i.materials?.labelSizeVariant?.size);
    expect(sized).toHaveLength(5);
    expect(sized.every((i) => labelIds.includes(i.materials.labelMaster.id))).toBe(true);

    const pending = await request(app).get(`/api/grn/po/${poId}/pending`).set(authHeader).expect(200);
    const rows: any[] = pending.body.data ?? pending.body;
    expect(
      rows
        .filter((r) => r.labelCode === code('L1'))
        .map((r) => r.size)
        .sort()
    ).toEqual(['M', 'S', 'XS']);
    const plain = rows.find((r) => r.labelCode === code('L3'));
    expect(plain).toBeDefined();
    expect(plain.size).toBeNull();
    expect(rows.filter((r) => r.componentName).length).toBe(5);
  });
});
