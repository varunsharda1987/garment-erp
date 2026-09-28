/**
 * A style with NO colour goes from stitching to dispatch (2026-09-28).
 *
 * Colour is optional (owner): recorded when the style has one, left blank when it does not
 * (services/helpers/sku-colour.helper.ts). Until then the output tables demanded a colour, so a
 * style with no colour could be cut but never stitched — and most styles have none. Posts what the
 * pages post (`colorId: null`) through every writer that used to refuse it:
 *   stitching: receive (stage_receipt_skus) → daily output → Generate Transfer Slip
 *   finishing: receive → output → polybag → carton → Complete → Generate Transfer Slip (FG stock)
 *   finished goods: a second booking of the same blank-colour size adds to the SAME row (NULLS NOT
 *                   DISTINCT unique index, migration 20260928170000)
 *   dispatch: a delivery note draws the blank-colour stock; an ASN plans blank-colour lines
 *
 * Runs against the real app + live DB; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { addFinishedGoods } from '../../services/helpers/finished-goods.helper';

const RUN = `CLS${Date.now().toString(36).toUpperCase()}`;
const SPLIT: Array<[string, number]> = [
  ['S', 6],
  ['M', 4],
];
const TOTAL = SPLIT.reduce((sum, [, q]) => sum + q, 0);

let authHeader: Record<string, string>;
let userId: string;
let customerId: string;
let styleId: string;
const sizeIds: Record<string, string> = {};
let orderId: string;
let workOrderId: string;
let stitchingIssueId: string;
let finishingIssueId: string;
let stitchSlipId: string;

const skus = <K extends string>(qtyKey: K) =>
  SPLIT.map(([size, qty]) => ({ colorId: null, sizeId: sizeIds[size], [qtyKey]: qty })) as Array<
    { colorId: null; sizeId: string } & Record<K, number>
  >;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  // A style with NO colour: no Primary Color, no color_options row
  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} No-colour Top`, createdById: userId },
    })
  ).id;
  for (const [name] of SPLIT) {
    sizeIds[name] = (
      await prisma.size_options.create({ data: { id: randomUUID(), styleId, sizeName: name, sizeCode: name } })
    ).id;
  }

  orderId = randomUUID();
  await prisma.orders.create({
    data: {
      id: orderId,
      orderNumber: `${RUN}ORD`,
      customerId,
      expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
      totalQuantity: TOTAL,
      totalAmount: 10 * TOTAL,
      createdById: userId,
      order_items: {
        create: {
          id: randomUUID(),
          styleId,
          totalQuantity: TOTAL,
          unitPrice: 10,
          totalPrice: 10 * TOTAL,
          order_item_breakup: {
            create: SPLIT.map(([size, quantity]) => ({
              id: randomUUID(),
              colorId: null,
              sizeId: sizeIds[size],
              quantity,
            })),
          },
        },
      },
    },
  });
  workOrderId = randomUUID();
  await prisma.work_orders.create({
    data: {
      id: workOrderId,
      workOrderNumber: `${RUN}-WO`,
      styleId,
      orderId,
      status: 'IN_PRODUCTION',
      plannedStartDate: new Date(),
      plannedEndDate: new Date(Date.now() + 7 * 86400000),
      totalQuantity: TOTAL,
      createdById: userId,
    },
  });
  // What cutting hands to stitching for a blank-colour style
  const cutSlip = await prisma.transfer_slips.create({
    data: {
      slipNumber: `${RUN}-TS-CUT`,
      workOrderId,
      fromStage: 'CUTTING',
      toStage: 'STITCHING',
      fromDepartment: 'Cutting',
      toDepartment: 'Stitching',
      totalGoodPieces: TOTAL,
      preparedById: userId,
      skuBreakdown: {
        create: SPLIT.map(([size, quantity]) => ({ colorId: null, sizeId: sizeIds[size], quantity })),
      },
    },
  });
  stitchSlipId = cutSlip.id;
});

afterAll(async () => {
  const wo = { workOrderId: only(workOrderId) };
  const steps: Array<[string, () => Promise<unknown>]> = [
    [
      'delivery_note_fg_allocations',
      () => prisma.delivery_note_fg_allocations.deleteMany({ where: { delivery_note: { orderId: only(orderId) } } }),
    ],
    [
      'delivery_note_items',
      () => prisma.delivery_note_items.deleteMany({ where: { delivery_notes: { orderId: only(orderId) } } }),
    ],
    ['delivery_notes', () => prisma.delivery_notes.deleteMany({ where: { orderId: only(orderId) } })],
    ['asn_skus', () => prisma.asn_skus.deleteMany({ where: { asn: { orderId: only(orderId) } } })],
    ['asn_applications', () => prisma.asn_applications.deleteMany({ where: { orderId: only(orderId) } })],
    ['finished_goods_stock', () => prisma.finished_goods_stock.deleteMany({ where: { styleId: only(styleId) } })],
    [
      'carton_skus',
      () =>
        prisma.carton_skus.deleteMany({ where: { carton: { finishingIssue: { workOrderId: only(workOrderId) } } } }),
    ],
    [
      'carton_packings',
      () => prisma.carton_packings.deleteMany({ where: { finishingIssue: { workOrderId: only(workOrderId) } } }),
    ],
    [
      'polybag_entries',
      () => prisma.polybag_entries.deleteMany({ where: { finishingIssue: { workOrderId: only(workOrderId) } } }),
    ],
    ['stage_receipts', () => prisma.stage_receipts.deleteMany({ where: wo })],
    ['transfer_slips', () => prisma.transfer_slips.deleteMany({ where: wo })],
    [
      'finishing_daily_outputs',
      () =>
        prisma.finishing_daily_outputs.deleteMany({ where: { finishingIssue: { workOrderId: only(workOrderId) } } }),
    ],
    ['finishing_issues', () => prisma.finishing_issues.deleteMany({ where: wo })],
    [
      'stitching_daily_outputs',
      () =>
        prisma.stitching_daily_outputs.deleteMany({ where: { stitchingIssue: { workOrderId: only(workOrderId) } } }),
    ],
    ['stitching_issues', () => prisma.stitching_issues.deleteMany({ where: wo })],
    ['production_tracking', () => prisma.production_tracking.deleteMany({ where: wo })],
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { id: only(workOrderId) } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: only(orderId) } })], // cascades items + breakup
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: only(styleId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[colourless-style-chain teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('a style with no colour goes from stitching to dispatch', () => {
  it('stitching: receive, output and the slip to finishing all keep the blank colour', async () => {
    const issue = await request(app)
      .post('/api/stitching/issues')
      .set(authHeader)
      .send({ workOrderId, issueDate: '2026-09-28', transferSlipIds: [stitchSlipId], skuBreakdown: skus('issuedQty') });
    // The body is in the assertion so a refusal shows the API's message
    expect({ status: issue.status, body: issue.body }).toMatchObject({ status: 201 });
    stitchingIssueId = issue.body.data.id;

    await request(app)
      .post(`/api/stitching/issues/${stitchingIssueId}/receive`)
      .set(authHeader)
      .send({ transferSlipId: stitchSlipId, skuReceived: skus('receivedQty') })
      .expect(200);
    // Blank-colour rows used to be dropped here (NOT NULL column) — now they are the receipt
    const received = await prisma.stage_receipt_skus.findMany({ where: { stageReceipt: { workOrderId } } });
    expect(received).toHaveLength(SPLIT.length);
    expect(received.every((r) => r.colorId === null && r.deviation === 0)).toBe(true);

    await request(app).post(`/api/stitching/issues/${stitchingIssueId}/start`).set(authHeader).send({}).expect(200);
    await request(app)
      .post(`/api/stitching/issues/${stitchingIssueId}/daily-output`)
      .set(authHeader)
      .send({ outputDate: '2026-09-28', skuOutputs: skus('goodQty').map((s) => ({ ...s, defectQty: 0 })) })
      .expect(200);
    const output = await prisma.stitching_output_skus.findMany({
      where: { dailyOutput: { stitchingIssueId } },
    });
    expect(output.map((o) => o.colorId)).toEqual([null, null]);

    await request(app).post(`/api/stitching/issues/${stitchingIssueId}/complete`).set(authHeader).send({}).expect(200);
    await request(app)
      .post(`/api/stitching/issues/${stitchingIssueId}/generate-transfer-slip`)
      .set(authHeader)
      .send({})
      .expect(200);
    const toFinishing = await prisma.transfer_slips.findFirstOrThrow({
      where: { stitchingIssueId },
      include: { skuBreakdown: true },
    });
    expect(toFinishing.totalGoodPieces).toBe(TOTAL);
    expect(toFinishing.skuBreakdown.every((s) => s.colorId === null)).toBe(true);
  });

  it('finishing: output, polybag, carton and the finished-goods booking keep the blank colour', async () => {
    const slip = await prisma.transfer_slips.findFirstOrThrow({ where: { stitchingIssueId } });
    const issue = await request(app)
      .post('/api/finishing/issues')
      .set(authHeader)
      .send({ workOrderId, issueDate: '2026-09-28', skuBreakdown: skus('issuedQty') });
    // The body is in the assertion so a refusal shows the API's message
    expect({ status: issue.status, body: issue.body }).toMatchObject({ status: 201 });
    finishingIssueId = issue.body.data.id;

    await request(app)
      .post(`/api/finishing/issues/${finishingIssueId}/receive`)
      .set(authHeader)
      .send({ transferSlipId: slip.id, receivedQty: TOTAL })
      .expect(200);
    await request(app).post(`/api/finishing/issues/${finishingIssueId}/start`).set(authHeader).send({}).expect(200);
    await request(app)
      .post(`/api/finishing/issues/${finishingIssueId}/record-output`)
      .set(authHeader)
      .send({ outputDate: '2026-09-28', skuOutputs: skus('finishedQty').map((s) => ({ ...s, defectQty: 0 })) })
      .expect(200);
    await request(app)
      .post(`/api/finishing/issues/${finishingIssueId}/polybag-entry`)
      .set(authHeader)
      .send({ packingDate: '2026-09-28', skuBreakdown: skus('packedQty') })
      .expect(201);
    await request(app)
      .post(`/api/finishing/issues/${finishingIssueId}/carton-packing`)
      .set(authHeader)
      .send({ cartonNumber: `${RUN}-CTN1`, cartonDate: '2026-09-28', skuBreakdown: skus('quantity') })
      .expect(201);
    expect(
      (await prisma.polybag_skus.findMany({ where: { polybagEntry: { finishingIssueId } } })).map((r) => r.colorId)
    ).toEqual([null, null]);
    expect(
      (await prisma.carton_skus.findMany({ where: { carton: { finishingIssueId } } })).map((r) => r.colorId)
    ).toEqual([null, null]);

    await request(app).post(`/api/finishing/issues/${finishingIssueId}/complete`).set(authHeader).send({}).expect(200);
    await request(app)
      .post(`/api/finishing/issues/${finishingIssueId}/generate-transfer-slip`)
      .set(authHeader)
      .send({})
      .expect(200);

    const fg = await prisma.finished_goods_stock.findMany({ where: { styleId }, orderBy: { quantity: 'desc' } });
    expect(fg).toHaveLength(SPLIT.length);
    expect(fg.every((row) => row.colorId === null)).toBe(true);
    expect(fg.map((row) => row.quantity)).toEqual(SPLIT.map(([, q]) => q));
  });

  it('a second booking of the same blank-colour size adds to the SAME finished-goods row', async () => {
    const before = await prisma.finished_goods_stock.findFirstOrThrow({ where: { styleId, sizeId: sizeIds.S } });
    await prisma.$transaction((tx) =>
      addFinishedGoods(tx, {
        styleId,
        colorId: null,
        sizeId: sizeIds.S,
        locationId: before.locationId,
        quantity: 3,
        workOrderId,
      })
    );
    const rows = await prisma.finished_goods_stock.findMany({ where: { styleId, sizeId: sizeIds.S } });
    expect(rows).toHaveLength(1); // NULLS NOT DISTINCT: no second blank-colour row
    expect(rows[0].id).toBe(before.id);
    expect(rows[0].quantity).toBe(before.quantity + 3);
  });

  it('a delivery note draws the blank-colour stock', async () => {
    const before = await prisma.finished_goods_stock.findFirstOrThrow({ where: { styleId, sizeId: sizeIds.S } });
    const res = await request(app)
      .post('/api/dispatch/delivery-notes')
      .set(authHeader)
      .send({
        orderId,
        customerId,
        deliveryDate: '2026-09-28',
        items: [{ styleId, colorId: null, sizeId: sizeIds.S, quantity: 5 }],
      });
    expect(res.status).toBe(201);
    const item = await prisma.delivery_note_items.findFirstOrThrow({ where: { delivery_notes: { orderId } } });
    expect(item.colorId).toBeNull();
    const after = await prisma.finished_goods_stock.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.quantity).toBe(before.quantity - 5);
  });

  it('an ASN plans blank-colour lines, and refuses the same blank-colour size twice', async () => {
    const dup = await request(app)
      .post('/api/dispatch/asn')
      .set(authHeader)
      .send({
        orderId,
        plannedDispatchQty: 6,
        cartonsPlanned: 1,
        requestedShipDate: '2026-10-05',
        skus: [
          { colorId: null, sizeId: sizeIds.S, plannedQty: 3 },
          { colorId: null, sizeId: sizeIds.S, plannedQty: 3 },
        ],
      });
    expect(dup.status).toBe(400);

    await request(app)
      .post('/api/dispatch/asn')
      .set(authHeader)
      .send({
        orderId,
        plannedDispatchQty: TOTAL,
        cartonsPlanned: 1,
        requestedShipDate: '2026-10-05',
        skus: skus('plannedQty'),
      })
      .expect(201);
    const lines = await prisma.asn_skus.findMany({ where: { asn: { orderId } } });
    expect(lines).toHaveLength(SPLIT.length);
    expect(lines.every((l) => l.colorId === null)).toBe(true);
  });
});
