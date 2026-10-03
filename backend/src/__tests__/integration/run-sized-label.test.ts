/**
 * A label that comes in sizes, on a production run (2026-10-03).
 *
 * WO2609-0278 (ESSKY091LS) showed its Main Cum Size Label "missing" with 2,150 pcs in store, held for its order:
 * the Order BOM line points at the label's BASE materials row, every label lot sits on a SIZE row, and the run
 * page, the stage gate and Trim Issuance all read the base row (0). Owner decisions: a size label is needed at
 * stitching — a size whose labels are not there cannot be issued to stitching; at cutting it only warns.
 *
 * Walks: the run page's Material Readiness (per size, other orders' holds netted, fabric-only isReady), the stage
 * gate (labels never block cutting or a stage move; they warn), Trim Issuance (one row per size), the stitching
 * form's label cover and the stitching issue's refusal per size.
 *
 * Runs against the real app on garment_erp_test; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';
import { ensureLabelSizeMaterialRecord, ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { productionBlockingValidationService } from '../../services/productionBlockingValidation.service';

const RUN = `RSL${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let orderId: string;
let otherOrderId: string;
let workOrderId: string;
let warehouseId: string;
let labelId: string;
let labelBaseRow: string;
let priceTagId: string;
let priceTagBaseRow: string;
const priceTagRows: string[] = [];
let washcareId: string;
let washcareBaseRow: string;
const washcareRows: string[] = [];
let otherRequirementId: string;
const sizeRow: Record<string, string> = {}; // label size → materials.id
const sizeIds: Record<string, string> = {}; // style size → size_options.id

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  warehouseId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-WH`,
        warehouseName: `${RUN} Store`,
        warehouseType: 'RAW_MATERIAL',
        isActive: true,
        createdById: userId,
      },
    })
  ).id;

  // A label made in S and M only — the order also has XS
  labelId = (
    await prisma.label_master.create({
      data: {
        labelCode: `${RUN}-LBL`,
        labelName: `${RUN} Main Cum Size Label`,
        labelType: 'Main Cum Size Label',
        pricePerPiece: 0.6,
      },
    })
  ).id;
  for (const size of ['S', 'M']) {
    const v = await prisma.label_size_variants.create({ data: { labelId, size } });
    sizeRow[size] = await ensureLabelSizeMaterialRecord(v.id);
  }
  labelBaseRow = await ensureMaterialRecord(labelId, 'LABEL');
  // A price tag that also comes in sizes, none in store — it goes on at finishing, never holds back stitching
  priceTagId = (
    await prisma.label_master.create({
      data: { labelCode: `${RUN}-TAG`, labelName: `${RUN} Price Tag`, labelType: 'Price Tag', pricePerPiece: 1 },
    })
  ).id;
  for (const size of ['S', 'M']) {
    const v = await prisma.label_size_variants.create({ data: { labelId: priceTagId, size } });
    priceTagRows.push(await ensureLabelSizeMaterialRecord(v.id));
  }
  priceTagBaseRow = await ensureMaterialRecord(priceTagId, 'LABEL');
  // In store: S 8, M 6 — each on its SIZE row, as a receipt books it
  for (const [size, qty] of [
    ['S', 8],
    ['M', 6],
  ] as const) {
    const variant = await prisma.materials.findUniqueOrThrow({ where: { id: sizeRow[size] } });
    await prisma.label_stock.create({
      data: {
        labelId,
        sizeVariantId: variant.sizeVariantId,
        quantityAvailable: qty,
        purchaseCost: 0.6,
        weightedAvgCost: 0.6,
        receivedDate: new Date(),
        warehouseId,
      },
    });
  }

  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Kurta`, createdById: userId },
    })
  ).id;
  for (const [name, order] of [
    ['XS', 1],
    ['S', 2],
    ['M', 3],
  ] as const) {
    sizeIds[name] = (
      await prisma.size_options.create({
        data: { id: randomUUID(), styleId, sizeName: name, sizeCode: name, sortOrder: order },
      })
    ).id;
  }

  const customer = await prisma.customers.findFirstOrThrow({ select: { id: true } });
  const makeOrder = async (suffix: string, sizes: Record<string, number>) => {
    const id = randomUUID();
    const itemId = randomUUID();
    const total = Object.values(sizes).reduce((s, q) => s + q, 0);
    await prisma.orders.create({
      data: {
        id,
        orderNumber: `${RUN}-${suffix}`,
        customerId: customer.id,
        expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
        totalQuantity: total,
        totalAmount: total * 10,
        createdById: userId,
        order_items: {
          create: { id: itemId, styleId, totalQuantity: total, unitPrice: 10, totalPrice: total * 10 },
        },
      },
    });
    for (const [size, quantity] of Object.entries(sizes)) {
      await prisma.order_item_breakup.create({
        data: { id: randomUUID(), orderItemId: itemId, sizeId: sizeIds[size], quantity },
      });
    }
    return id;
  };
  orderId = await makeOrder('ORD', { XS: 2, S: 10, M: 6 });
  otherOrderId = await makeOrder('OTHER', { M: 3 });

  // The approved Order BOM: one label line on the BASE row, one garment = one label
  await prisma.order_bom.create({
    data: {
      orderId,
      styleId,
      status: 'APPROVED',
      createdById: userId,
      items: {
        create: [
          {
            id: randomUUID(),
            materialType: 'LABEL',
            materialId: labelBaseRow,
            labelId,
            quantityPerGarment: 1,
            orderQuantity: 18,
            totalQuantity: 18,
            wastagePercent: 0,
            totalWithWastage: 18,
            unit: 'PIECE',
            unitPrice: 0.6,
            totalCost: 10.8,
          },
          {
            id: randomUUID(),
            materialType: 'LABEL',
            materialId: priceTagBaseRow,
            labelId: priceTagId,
            quantityPerGarment: 1,
            orderQuantity: 18,
            totalQuantity: 18,
            wastagePercent: 0,
            totalWithWastage: 18,
            unit: 'PIECE',
            unitPrice: 1,
            totalCost: 18,
          },
        ],
      },
    },
  });

  // The OTHER order holds 3 of the M labels (a receipt hold, lot-less like every trim hold)
  otherRequirementId = (
    await prisma.material_requirements.create({
      data: {
        requirementNumber: `${RUN}-MR`,
        source: 'SALES_ORDER',
        orderId: otherOrderId,
        materialId: sizeRow.M,
        orderQuantity: 3,
        quantityPerUnit: 1,
        wastagePercent: 0,
        totalRequired: 3,
        unit: 'PIECE',
        shortfall: 3,
        requiredDate: new Date(),
        createdById: userId,
      },
    })
  ).id;
  await prisma.stock_reservations.create({
    data: {
      materialId: sizeRow.M,
      warehouseId,
      reservationType: 'ORDER',
      referenceType: 'MATERIAL_REQUIREMENT',
      referenceId: otherRequirementId,
      reservedQuantity: 3,
      unit: 'PIECE',
      status: 'ACTIVE',
      reservedById: userId,
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
      totalQuantity: 18,
      createdById: userId,
    },
  });
});

afterAll(async () => {
  const orders = onlyAll([orderId, otherOrderId]);
  const materialIds = onlyAll([
    labelBaseRow,
    ...Object.values(sizeRow),
    priceTagBaseRow,
    ...priceTagRows,
    washcareBaseRow,
    ...washcareRows,
  ]);
  const labelIds = onlyAll([labelId, priceTagId, washcareId]);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['stitching_issues', () => prisma.stitching_issues.deleteMany({ where: { workOrderId: only(workOrderId) } })],
    ['production_tracking', () => prisma.production_tracking.deleteMany({ where: { workOrderId: only(workOrderId) } })],
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { id: only(workOrderId) } })],
    [
      'stock_reservations',
      () => prisma.stock_reservations.deleteMany({ where: { referenceId: only(otherRequirementId) } }),
    ],
    ['material_requirements', () => prisma.material_requirements.deleteMany({ where: { orderId: { in: orders } } })],
    ['order_bom', () => prisma.order_bom.deleteMany({ where: { orderId: { in: orders } } })], // cascades its lines
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orders } } })], // cascades items + breakup
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: only(styleId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['label_stock', () => prisma.label_stock.deleteMany({ where: { labelId: { in: labelIds } } })],
    ['stock_levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['stock_settings', () => prisma.stock_settings.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['label_size_variants', () => prisma.label_size_variants.deleteMany({ where: { labelId: { in: labelIds } } })],
    ['label_master', () => prisma.label_master.deleteMany({ where: { id: { in: labelIds } } })],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[run-sized-label teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('the run page reads a sized label per size', () => {
  it('Material Readiness: fabric-only isReady, the label short per size, other orders’ holds netted', async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}/material-readiness`)
      .set(authHeader)
      .expect(200);
    const r = res.body.data;
    expect(r).toMatchObject({ isReady: true, allAvailable: false, hasApprovedBom: true, totalMaterials: 2 });
    expect(r.missingMaterials).toHaveLength(2);
    const label = r.missingMaterials.find((m: { materialCode: string }) => m.materialCode === `${RUN}-LBL`);
    expect(label).toMatchObject({ materialCode: `${RUN}-LBL`, blocksCutting: false, sizedLabel: true, required: 18 });
    // S: need 10, have 8. M: need 6, have 6 − 3 held for the other order = 3. XS: the label is not made in XS.
    expect(label.sizes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizeName: 'S', need: 10, have: 8, short: 2 }),
        expect.objectContaining({ sizeName: 'M', need: 6, have: 3, short: 3 }),
        expect.objectContaining({ sizeName: 'XS', materialId: null, need: 2, have: 0, short: 2 }),
      ])
    );
  });

  it('the stage gate never blocks on a sized label — it warns at cutting and at stitching', async () => {
    const cutting = await productionBlockingValidationService.validateMaterialAvailabilityForStage(
      workOrderId,
      'IN_CUTTING'
    );
    expect(cutting.isBlocked).toBe(false);
    expect(cutting.warnings?.[0]?.message).toMatch(/XS: no label in this size, S short 2, M short 3/);

    const stitching = await productionBlockingValidationService.validateMaterialAvailabilityForStage(
      workOrderId,
      'IN_STITCHING'
    );
    expect(stitching.isBlocked).toBe(false);
    expect(stitching.warnings).toHaveLength(2); // the size label and the price tag
  });

  it('Trim Issuance offers the label size by size, each on its own size row', async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}/trim-issuance-data`)
      .set(authHeader)
      .expect(200);
    const rows = (res.body.data.items as Array<Record<string, unknown>>).filter((i) => i.bomItemId);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizeName: 'S', materialId: sizeRow.S, requiredQty: 10, availableStock: 8 }),
        expect.objectContaining({
          sizeName: 'M',
          materialId: sizeRow.M,
          requiredQty: 6,
          availableStock: 3,
          heldForOthers: 3,
        }),
        expect.objectContaining({ sizeName: 'XS', materialId: null }),
      ])
    );
    expect(rows.some((r) => r.materialId === labelBaseRow)).toBe(false);
  });
});

describe('a size cannot go to stitching without its labels', () => {
  const issue = (rows: Array<[string, number]>) =>
    request(app)
      .post('/api/stitching/issues')
      .set(authHeader)
      .send({
        workOrderId,
        issueDate: '2026-10-03',
        operatorRatePerPiece: 20,
        skuBreakdown: rows.map(([size, qty]) => ({ colorId: null, sizeId: sizeIds[size], issuedQty: qty })),
      });

  it('the form is told what each size’s labels cover', async () => {
    const res = await request(app)
      .get('/api/stitching/label-availability')
      .query({ workOrderId })
      .set(authHeader)
      .expect(200);
    const bySize = Object.fromEntries(
      (res.body.data.sizes as Array<{ sizeName: string; canIssue: number }>).map((s) => [s.sizeName, s.canIssue])
    );
    expect(bySize).toEqual({ XS: 0, S: 8, M: 3 });
  });

  it('refuses more pieces of a size than its labels cover, and a size the label is not made in', async () => {
    const over = await issue([['S', 9]]);
    expect(over.status).toBe(422);
    expect(over.body.details).toMatchObject({ reason: 'LABEL_SHORT_FOR_SIZE' });
    expect(over.body.message).toMatch(/S \(asked 9, labels cover 8 more/);

    const noSize = await issue([['XS', 1]]);
    expect(noSize.status).toBe(422);
    expect(noSize.body.message).toMatch(/not made in XS/);
  });

  it('issues what the labels cover, and counts it against the next issue', async () => {
    const ok = await issue([
      ['S', 8],
      ['M', 3],
    ]);
    expect({ status: ok.status, body: ok.body }).toMatchObject({ status: 201 });

    const again = await issue([['S', 1]]);
    expect(again.status).toBe(422);
    expect(again.body.message).toMatch(/labels cover 0 more/);
  });
});

describe('a washcare label is sewn at stitching too; a price tag is not', () => {
  it('a washcare label that comes in sizes counts in the stitching cover, the price tag never does', async () => {
    washcareId = (
      await prisma.label_master.create({
        data: { labelCode: `${RUN}-WC`, labelName: `${RUN} Washcare`, labelType: 'Washcare Label', pricePerPiece: 1 },
      })
    ).id;
    for (const size of ['S', 'M']) {
      const v = await prisma.label_size_variants.create({ data: { labelId: washcareId, size } });
      washcareRows.push(await ensureLabelSizeMaterialRecord(v.id));
    }
    washcareBaseRow = await ensureMaterialRecord(washcareId, 'LABEL');
    const bom = await prisma.order_bom.findFirstOrThrow({ where: { orderId }, select: { id: true } });
    await prisma.order_bom_items.create({
      data: {
        id: randomUUID(),
        orderBomId: bom.id,
        materialType: 'LABEL',
        materialId: washcareBaseRow,
        labelId: washcareId,
        quantityPerGarment: 1,
        orderQuantity: 18,
        totalQuantity: 18,
        wastagePercent: 0,
        totalWithWastage: 18,
        unit: 'PIECE',
        unitPrice: 1,
        totalCost: 18,
      },
    });

    const res = await request(app)
      .get('/api/stitching/label-availability')
      .query({ workOrderId })
      .set(authHeader)
      .expect(200);
    const s = (res.body.data.sizes as Array<{ sizeName: string; labels: Array<{ materialCode: string }> }>).find(
      (x) => x.sizeName === 'S'
    )!;
    const codes = s.labels.map((l) => l.materialCode);
    expect(codes.some((c) => c.startsWith(`${RUN}-WC`))).toBe(true);
    expect(codes.some((c) => c.startsWith(`${RUN}-TAG`))).toBe(false);
  });
});
