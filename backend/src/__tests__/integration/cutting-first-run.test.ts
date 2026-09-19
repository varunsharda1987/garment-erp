/**
 * The whole loop, once: greige → dyer → GRN → stock → linked to a style → Production CAD →
 * production run → issued to cutting → cutting chart → first batch (2026-09-16).
 *
 * Nothing has ever been cut in this factory. Every downstream table was empty, and the reason was
 * upstream: no processed fabric had ever been booked into stock (jwo-fabric-receive pins that door).
 * This suite pins the NEXT hand-off — the one the code trace said would break next: a lot that
 * exists in fabric_stock is invisible to the cutting chart unless something links it to the style.
 *
 * It follows the team's runbook exactly, including the path that needs the most hand-holding — a
 * STOCK job (no style). That fabric is minted unlinked, so the runbook's phase 7 says: allocate the
 * fabric to the style, then raise a Production CAD against the received lot. The chart then finds
 * the lot two ways (the CAD row's own fabricId, and the style's fabric slot), and the run can cut.
 *
 * What is exercised through the real API: job create/issue, GRN create/approve, allocate-to-style,
 * Production CAD row from stock, work order create, push to cutting, fabric-issuance data, issue
 * fabric, cutting chart, batch create. The CAD marker maths is CAD Planning's own concern: the row
 * gets cadMeters/piecesPerMarker as a fixture and the chart's backfill derives the average.
 *
 * Runs against the LIVE database (there is no test DB). Teardown is per-step; see afterAll.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';

const RUN = `CUT${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let customerId: string;
let dyerId: string;
let greigeId: string;
let greigeMaterialId: string;
let lotId: string;
let styleId: string;
let componentId: string;
let styleFabricId: string;
let sizeS: string;
let sizeM: string;
let jwoId: string;
let grnId: string;
let finishedFabricId: string;
let fabricStockId: string;
let cadRowId: string;
let workOrderId: string;
let cuttingBatchId: string;

const only = (id: string | undefined) => id ?? '__unset__';

/** Fail with the API's own message, not just the status code. */
const expectStatus = (res: request.Response, ok: (s: number) => boolean) => {
  if (!ok(res.status)) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`);
  }
};

const LOT_QTY = 1200;
const SEND_QTY = 1000;
const RECEIVE_QTY = 900; // 1,000 sent at 10% shrinkage
const GREIGE_COST = 40;
const DYEING_RATE = 20;
const RECEIVED_WIDTH = 52;
/** marker: 150 m lays 100 pieces → 1.5 m per piece */
const CAD_METERS = 150;
const PIECES_PER_MARKER = 100;
const CAD_AVERAGE = CAD_METERS / PIECES_PER_MARKER;
const RUN_QTY = 100; // 50 S + 50 M
const ISSUE_METERS = 200; // floor(200 / 1.5) = 133 cuttable ≥ 100

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const warehouse = await prisma.warehouses.create({
    data: {
      warehouseCode: `${RUN}-WH`,
      warehouseName: `${RUN} Warehouse`,
      warehouseType: 'RAW_MATERIAL',
      isActive: true,
      createdById: userId,
    },
  });
  warehouseId = warehouse.id;

  // Samples need a customer even for a stock run (samples.customerId is NOT NULL) — the house
  // brand plays that part. No FPT/GPT flags, no sample-requirement rows → the gates' defaults apply.
  const customer = await prisma.customers.create({
    data: {
      code: `${RUN}-CUS`,
      name: `${RUN} House Brand`,
      type: 'BUYER',
      category: 'DOMESTIC',
      createdById: userId,
    },
  });
  customerId = customer.id;

  const dyer = await prisma.suppliers.create({
    data: {
      code: `${RUN}-DYE`,
      name: `${RUN} Dyer`,
      supplierCategories: ['DYEING_PRINTING'],
      isActive: true,
      createdById: userId,
    },
  });
  dyerId = dyer.id;

  const greige = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-GG`,
      greigeName: `${RUN} Poplin`,
      genericGreigeName: `${RUN} Poplin`,
      composition: '100% Cotton',
      greigeWidth: 54,
      createdById: userId,
    },
  });
  greigeId = greige.id;

  const lot = await prisma.greige_stock.create({
    data: {
      greigeId,
      quantityAvailable: LOT_QTY,
      greigeWidth: 54,
      receivedDate: new Date(),
      purchaseCost: GREIGE_COST,
      weightedAvgCost: GREIGE_COST,
      warehouseId,
      createdById: userId,
    },
  });
  lotId = lot.id;
  greigeMaterialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  await syncStockLevelQuantity(greigeMaterialId, LOT_QTY, warehouseId, 'METER');

  // The style, as StyleForm leaves it: one component, one fabric slot holding a GENERIC greige
  // name and no fabricId (the finished fabric does not exist yet), two sizes.
  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Kurta`, createdById: userId },
  });
  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: 'Top', componentType: 'MAIN' },
  });
  componentId = component.id;
  const sf = await prisma.style_fabrics.create({
    data: { id: randomUUID(), componentId, genericGreigeName: `${RUN} Poplin`, fabricFinishType: 'DYED' },
  });
  styleFabricId = sf.id;
  sizeS = randomUUID();
  sizeM = randomUUID();
  await prisma.size_options.createMany({
    data: [
      { id: sizeS, styleId, sizeName: 'S', sizeCode: 'S' },
      { id: sizeM, styleId, sizeName: 'M', sizeCode: 'M' },
    ],
  });
  await prisma.style_variants.createMany({
    data: [
      { id: randomUUID(), styleId, sku: `${RUN}-STY-S`, sizeId: sizeS, sizeName: 'S' },
      { id: randomUUID(), styleId, sku: `${RUN}-STY-M`, sizeId: sizeM, sizeName: 'M' },
    ],
  });
});

afterAll(async () => {
  // Per-step teardown, never one wrapping try/catch (see jwo-fabric-receive).
  // 1. Cutting
  const batchIds = workOrderId
    ? (await prisma.cutting_batches.findMany({ where: { workOrderId }, select: { id: true } })).map((b) => b.id)
    : [];
  const layIds = (
    await prisma.cutting_lays.findMany({ where: { cuttingBatchId: { in: batchIds } }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.cutting_lay_skus.deleteMany({ where: { cuttingLayId: { in: layIds } } });
  await prisma.cutting_lay_fabrics.deleteMany({ where: { cuttingLayId: { in: layIds } } });
  await prisma.cutting_lays.deleteMany({ where: { id: { in: layIds } } });
  await prisma.cutting_batch_skus.deleteMany({ where: { cuttingBatchId: { in: batchIds } } });
  await prisma.cutting_batch_defects.deleteMany({ where: { cuttingBatchId: { in: batchIds } } });
  await prisma.cutting_batch_fabrics.deleteMany({ where: { batchId: { in: batchIds } } });
  await prisma.fabric_stock_allocation.deleteMany({
    where: { OR: [{ cuttingBatchId: { in: batchIds } }, { stockId: only(fabricStockId) }] },
  });
  await prisma.cutting_batches.deleteMany({ where: { id: { in: batchIds } } });

  // 2. Challans: internal (store → cutting), outward + inward (job work)
  const jwoIds = (
    await prisma.job_work_orders.findMany({ where: { processorId: only(dyerId) }, select: { id: true } })
  ).map((j) => j.id);
  const challanIds = (
    await prisma.challans.findMany({
      where: { OR: [{ jobWorkOrderId: { in: jwoIds } }, { productionRunId: only(workOrderId) }] },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });

  // 3. Production run
  if (workOrderId) {
    await prisma.production_tracking.deleteMany({ where: { workOrderId } });
    await prisma.stage_receipts.deleteMany({ where: { workOrderId } });
    await prisma.stage_transition_overrides.deleteMany({ where: { workOrderId } });
    await prisma.work_orders.deleteMany({ where: { id: workOrderId } }); // breakup cascades
  }

  // 3b. Samples raised on this style (FIT → PP → Size Set) and any override audit rows
  const sampleIds = (await prisma.samples.findMany({ where: { styleId: only(styleId) }, select: { id: true } })).map(
    (s) => s.id
  );
  await prisma.stage_transition_overrides.deleteMany({ where: { sampleId: { in: sampleIds } } });
  await prisma.sample_size_sets.deleteMany({ where: { sampleId: { in: sampleIds } } });
  await prisma.sample_measurements.deleteMany({ where: { sampleId: { in: sampleIds } } });
  await prisma.sample_colorways.deleteMany({ where: { sampleId: { in: sampleIds } } });
  await prisma.samples.deleteMany({ where: { id: { in: sampleIds } } });

  // 4. GRN + job
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { jobWorkOrderId: { in: jwoIds } }, select: { id: true } })
  ).map((g) => g.id);
  await prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } });
  await prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } });
  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } });

  // 5. CAD rows on this style
  const cadIds = (
    await prisma.fabric_width_cad.findMany({
      where: { OR: [{ styleFabricId: only(styleFabricId) }, { costingStyleId: only(styleId) }] },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.cad_size_breakdown.deleteMany({ where: { cadId: { in: cadIds } } });
  await prisma.cad_pattern_parts.deleteMany({ where: { cadId: { in: cadIds } } });
  await prisma.fabric_width_cad.deleteMany({ where: { id: { in: cadIds } } });

  // 6. Fabric minted from this run's greige: lots, ledgers, materials, masters
  const mintedIds = (
    await prisma.fabric_master.findMany({
      where: { OR: [{ fabricName: { contains: RUN } }, { greigeId: only(greigeId) }] },
      select: { id: true },
    })
  ).map((f) => f.id);
  const fabricLotIds = (
    await prisma.fabric_stock.findMany({ where: { fabricId: { in: mintedIds } }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.fabric_stock_transaction.deleteMany({ where: { stockId: { in: fabricLotIds } } });
  await prisma.fabric_stock.deleteMany({ where: { id: { in: fabricLotIds } } });
  await prisma.stock_movements.deleteMany({
    where: { materials: { OR: [{ fabricId: { in: mintedIds } }, { greigeId: only(greigeId) }] } },
  });
  await prisma.stock_levels.deleteMany({
    where: { materials: { OR: [{ fabricId: { in: mintedIds } }, { greigeId: only(greigeId) }] } },
  });
  await prisma.materials.deleteMany({ where: { OR: [{ fabricId: { in: mintedIds } }, { greigeId: only(greigeId) }] } });

  // 7. Style (the fabric slot references the master, so it goes before fabric_master)
  await prisma.style_fabrics.deleteMany({ where: { componentId: only(componentId) } });
  await prisma.style_components.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.style_variants.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.size_options.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.fabric_master.deleteMany({ where: { id: { in: mintedIds } } });

  // 8. Greige, supplier, warehouse, user
  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: only(lotId) } });
  await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: only(lotId) } });
  await prisma.greige_stock.deleteMany({ where: { id: only(lotId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('the first cut: from greige to a cutting batch', () => {
  it('phase 1-2: a stock job is raised and the greige goes to the dyer', async () => {
    const created = await request(app).post('/api/job-work-orders').set(authHeader).send({
      processType: 'DYEING',
      processorId: dyerId,
      quantity: SEND_QTY,
      agreedRate: DYEING_RATE,
      expectedShrinkage: 10,
      colorName: 'Navy',
    });
    expectStatus(created, (s) => s === 201);
    jwoId = created.body.data.id;

    const issued = await request(app)
      .post(`/api/job-work-orders/${jwoId}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lotId, qty: SEND_QTY }] });
    expectStatus(issued, (s) => s === 200);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.jwoStatus).toBe('ISSUED');
  });

  it('phase 4-5: the dyed fabric is received and booked into stock in one action on the job', async () => {
    // What the Receive from processor dialog posts — receipt filed accepted, stock booked, in one call.
    const res = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({
        jobWorkOrderId: jwoId,
        qtyReceivedMeters: RECEIVE_QTY,
        receivedWidthInches: RECEIVED_WIDTH,
        warehouseId,
        receivedChallan: `${RUN}-VCH`,
        processingQC: { qualityGrade: 'A' },
      });
    expectStatus(res, (s) => s === 201);
    grnId = res.body.data.id;

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.jwoStatus).toBe('STOCK_UPDATED');
    finishedFabricId = jwo!.finishedFabricId!;
    expect(finishedFabricId).toBeTruthy();

    const lots = await prisma.fabric_stock.findMany({ where: { fabricId: finishedFabricId } });
    expect(lots).toHaveLength(1);
    fabricStockId = lots[0].id;
    expect(Number(lots[0].quantityAvailable)).toBe(RECEIVE_QTY);
    expect(lots[0].status).toBe('AVAILABLE');
    expect(lots[0].qualityGrade).toBe('A'); // the QC dialog's grade landed on the lot
  });

  it('phase 7a: a stock job leaves the style unlinked — allocate-to-style fills the slot', async () => {
    // The hand-off gap, pinned: fabric_stock exists, but the style's fabric slot is still empty.
    const before = await prisma.style_fabrics.findUnique({ where: { id: styleFabricId } });
    expect(before!.fabricId).toBeNull();

    const res = await request(app)
      .post(`/api/fabric-management/fabric/${finishedFabricId}/allocate-to-style`)
      .set(authHeader)
      .send({ componentId });
    expectStatus(res, (s) => s < 300);

    // The existing placeholder is UPDATED, not a second row created — CAD rows keep their anchor.
    const slots = await prisma.style_fabrics.findMany({ where: { componentId } });
    expect(slots).toHaveLength(1);
    expect(slots[0].id).toBe(styleFabricId);
    expect(slots[0].fabricId).toBe(finishedFabricId);
  });

  it('phase 7b-c: a Production CAD raised against the received lot carries its fabricId', async () => {
    const res = await request(app)
      .post(`/api/cad-planning/${styleId}/row`)
      .set(authHeader)
      .send({ purpose: 'PRODUCTION', styleFabricId, componentId, fabricStockId });
    expectStatus(res, (s) => s < 300);

    const rows = await prisma.fabric_width_cad.findMany({ where: { styleFabricId, purposeEnum: 'PRODUCTION' } });
    expect(rows).toHaveLength(1);
    cadRowId = rows[0].id;
    // The strongest discovery path into the cutting chart: the CAD row's OWN fabricId, taken
    // from the lot it was raised against — plus the lot and the greige it was dyed from.
    expect(rows[0].fabricId).toBe(finishedFabricId);
    expect(rows[0].fabricStockId).toBe(fabricStockId);
    expect(rows[0].greigeId).toBe(greigeId);
    expect(Number(rows[0].cutableWidth)).toBeGreaterThan(0); // taken from the stock lot

    // Marker maths is CAD Planning's own concern; give the row what a marker would have.
    await prisma.fabric_width_cad.update({
      where: { id: cadRowId },
      data: { cadMeters: CAD_METERS, piecesPerMarker: PIECES_PER_MARKER },
    });
  });

  it('phase 7d: the production run is raised, and the Production average is derived from the marker', async () => {
    const today = new Date();
    const nextWeek = new Date(Date.now() + 7 * 86400000);
    const created = await request(app)
      .post('/api/work-orders')
      .set(authHeader)
      .send({
        styleId,
        warehouseId,
        plannedStartDate: today.toISOString(),
        plannedEndDate: nextWeek.toISOString(),
        totalQuantity: RUN_QTY,
        colorSizeBreakup: [
          { colorId: null, sizeId: sizeS, quantity: 50 },
          { colorId: null, sizeId: sizeM, quantity: 50 },
        ],
      });
    expectStatus(created, (s) => s === 201);
    workOrderId = created.body.data.id;

    // Building the chart once derives the Production average from the marker (backfill) and
    // persists it — which is what the push-to-cutting gate checks for.
    const chart = await request(app).get(`/api/cutting/chart-data/${workOrderId}`).set(authHeader);
    expectStatus(chart, (s) => s === 200);
    const cad = await prisma.fabric_width_cad.findUnique({ where: { id: cadRowId } });
    expect(Number(cad!.cadAverage)).toBeCloseTo(CAD_AVERAGE, 4);
  });

  it('phase 7d: cutting is refused until the style has an approved Size Set Sample — FIT → PP → Size Set', async () => {
    // The gate, as the team will meet it: fabric in stock, CAD in place, and still no cutting.
    const blocked = await request(app).post(`/api/work-orders/${workOrderId}/push-to-cutting`).set(authHeader).send({});
    expect(blocked.status).toBe(422);
    expect(blocked.body.message).toMatch(/Size Set Sample/);

    const requiredDate = new Date(Date.now() + 3 * 86400000).toISOString();
    const raiseSample = async (sampleType: string) => {
      const res = await request(app)
        .post('/api/samples')
        .set(authHeader)
        .send({ customerId, styleId, sampleType, requiredDate });
      return res;
    };
    // Approve the way the screen does: Mark Sent, then Record Feedback. A verdict straight from
    // REQUESTED is refused since 2026-09-18 (T4-C) — this walk used to take that shortcut.
    const approve = async (sampleId: string) => {
      const shortcut = await request(app)
        .patch(`/api/samples/${sampleId}/status`)
        .set(authHeader)
        .send({ status: 'APPROVED', feedback: 'approved for the first run' });
      expect(shortcut.status).toBe(422);
      const sent = await request(app)
        .post(`/api/samples/${sampleId}/send`)
        .set(authHeader)
        .send({ courierMode: 'Hand' });
      expectStatus(sent, (s) => s === 200);
      const res = await request(app)
        .post(`/api/samples/${sampleId}/feedback`)
        .set(authHeader)
        .send({ status: 'APPROVED', feedback: 'approved for the first run' });
      expectStatus(res, (s) => s === 200);
    };

    // The samples must come in order: a Size Set cannot even be raised before PP is approved.
    const early = await raiseSample('SIZE_SET_SAMPLE');
    expect(early.status).toBe(400);
    expect(early.body.message).toMatch(/PP Sample must be approved/);

    const fit = await raiseSample('FIT_SAMPLE');
    expectStatus(fit, (s) => s === 201);
    await approve(fit.body.data.id);

    const pp = await raiseSample('PP_SAMPLE');
    expectStatus(pp, (s) => s === 201);
    await approve(pp.body.data.id);

    const sizeSet = await raiseSample('SIZE_SET_SAMPLE');
    expectStatus(sizeSet, (s) => s === 201);
    await approve(sizeSet.body.data.id);

    const pushed = await request(app).post(`/api/work-orders/${workOrderId}/push-to-cutting`).set(authHeader).send({});
    expectStatus(pushed, (s) => s === 200);
    const wo = await prisma.work_orders.findUnique({ where: { id: workOrderId } });
    expect(wo!.status).toBe('IN_PRODUCTION');
  });

  it('phase 7d: the store sees the lot and issues it to cutting', async () => {
    const data = await request(app).get(`/api/work-orders/${workOrderId}/fabric-issuance-data`).set(authHeader);
    expectStatus(data, (s) => s === 200);
    const fabrics = data.body.data?.fabrics ?? data.body.fabrics;
    expect(fabrics.length).toBeGreaterThan(0);
    const ours = fabrics.find((f: any) => f.fabricId === finishedFabricId);
    expect(ours).toBeTruthy();
    const lotIds = (ours.lots ?? []).map((l: any) => l.lotId ?? l.id);
    expect(lotIds).toContain(fabricStockId);

    const issued = await request(app)
      .post(`/api/work-orders/${workOrderId}/issue-fabric`)
      .set(authHeader)
      .send({
        lots: [{ fabricStockId, fabricId: finishedFabricId, quantity: ISSUE_METERS, description: 'first cut' }],
      });
    expectStatus(issued, (s) => s < 300);

    // Metres left the store on an INTERNAL challan.
    const lot = await prisma.fabric_stock.findUnique({ where: { id: fabricStockId } });
    expect(Number(lot!.quantityAvailable)).toBe(RECEIVE_QTY - ISSUE_METERS);
    const internal = await prisma.challans.findFirst({
      where: { productionRunId: workOrderId, challanType: 'INTERNAL' },
    });
    expect(internal).not.toBeNull();
    expect(internal!.status).toBe('ISSUED');
  });

  it('phase 7e: the cutting chart shows the lot with a real cuttable quantity', async () => {
    const chart = await request(app).get(`/api/cutting/chart-data/${workOrderId}`).set(authHeader);
    expectStatus(chart, (s) => s === 200);
    const d = chart.body.data;

    const fabric = d.fabrics.find((f: any) => f.fabricId === finishedFabricId);
    expect(fabric).toBeTruthy();
    expect(Number(fabric.productionAverage)).toBeCloseTo(CAD_AVERAGE, 4);

    const analysis = d.fabricAnalysis.find((a: any) => a.fabricId === finishedFabricId);
    expect(analysis.cadSet).toBe(true);
    // Once fabric is issued, the chart plans against the issued metres, not the store.
    expect(Number(analysis.availableStock)).toBe(ISSUE_METERS);
    expect(analysis.maxPcsFromStock).toBe(Math.floor(ISSUE_METERS / CAD_AVERAGE)); // 133
    expect(d.maxCuttablePcs).toBeGreaterThanOrEqual(RUN_QTY);
    expect(d.warnings ?? []).toHaveLength(0);
  });

  it('phase 7e: the first batch is created — with exactly what the Cutting Chart page sends', async () => {
    // The page (Cutting → New Batch) creates the batch BEFORE any lay is planned: layersPerLay and
    // numberOfLays go up as 0, sizes carry plannedQty only, and every chosen lot rides in
    // fabricStocks. Until 2026-09-17 the schema's .positive() refused the zeros, so this exact
    // request answered "Invalid request data" — the first run had already sent 50 × 2 by hand and
    // never noticed (T4-B). Mirror the page, not the API's happy path.
    const res = await request(app)
      .post('/api/cutting/batches')
      .set(authHeader)
      .send({
        workOrderId,
        cuttingDate: new Date().toISOString(),
        fabricStockId,
        actualFabricWidth: RECEIVED_WIDTH,
        cadAverageUsed: CAD_AVERAGE,
        cadWidthUsed: RECEIVED_WIDTH,
        layersPerLay: 0,
        numberOfLays: 0,
        skuOutputs: [
          { colorId: null, sizeId: sizeS, plannedQty: 50 },
          { colorId: null, sizeId: sizeM, plannedQty: 50 },
        ],
        fabricStocks: [
          { fabricStockId, cadAvgUsed: CAD_AVERAGE, cadWidthUsed: RECEIVED_WIDTH, actualWidth: RECEIVED_WIDTH },
        ],
      });
    expectStatus(res, (s) => s === 201);
    cuttingBatchId = res.body.data.id;

    const batch = await prisma.cutting_batches.findUnique({ where: { id: cuttingBatchId } });
    expect(batch!.workOrderId).toBe(workOrderId);
    expect(batch!.fabricStockId).toBe(fabricStockId);
    expect(Number(batch!.cadAverageUsed)).toBeCloseTo(CAD_AVERAGE, 4);
    expect(batch!.layersPerLay).toBe(0); // lays are recorded on the batch page, afterwards
    expect(batch!.numberOfLays).toBe(0);

    const skus = await prisma.cutting_batch_skus.findMany({ where: { cuttingBatchId } });
    expect(skus).toHaveLength(2);
    expect(skus.map((s) => s.toCut)).toEqual([50, 50]); // from plannedQty

    // The lot the batch will consume is on record — completion sums issued metres through this row.
    const lotRows = await prisma.cutting_batch_fabrics.findMany({ where: { batchId: cuttingBatchId } });
    expect(lotRows.map((r) => r.fabricStockId)).toEqual([fabricStockId]);
  });

  it('phase 7e: a lot with no width in the request still gets a width — from the lot itself', async () => {
    // The page sends `lot.actualWidth || 0`; the API must not turn that into a masked database error.
    const res = await request(app)
      .post('/api/cutting/batches')
      .set(authHeader)
      .send({
        workOrderId,
        cuttingDate: new Date().toISOString(),
        fabricStockId,
        actualFabricWidth: 0,
        cadAverageUsed: CAD_AVERAGE,
        cadWidthUsed: 0,
        skuOutputs: [{ colorId: null, sizeId: sizeS, plannedQty: 10 }],
        fabricStocks: [{ fabricStockId, cadAvgUsed: CAD_AVERAGE, cadWidthUsed: 0, actualWidth: 0 }],
      });
    expectStatus(res, (s) => s === 201);

    const batch = await prisma.cutting_batches.findUnique({ where: { id: res.body.data.id } });
    expect(Number(batch!.actualFabricWidth)).toBe(RECEIVED_WIDTH); // fabric_stock.finishedWidth from the GRN
    expect(Number(batch!.cadWidthUsed)).toBe(RECEIVED_WIDTH);
    expect(batch!.layersPerLay).toBe(0);
  });
});
