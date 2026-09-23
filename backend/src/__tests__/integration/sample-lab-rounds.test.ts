/**
 * Sample ↔ lab testing — walk the loop the sample page's Lab Tests tab drives (2026-09-23).
 *
 * The owner's process: the GARMENT test (GPT) is done on the PP sample before it is sent — no work
 * order exists yet — and the FABRIC test (FPT) on the fabric lot after inward.
 *
 *   PP sample → TRF (round 1) → garment result FAIL (no work order) → retest prefill (RETEST +
 *   previous report no.) → TRF (round 2) → garment retest PASS → verdicts newest-first
 *   fabric lot → FPT FAIL (cutting blocked) → FPT retest PASS (unblocked)
 *
 * Plus the Shipment Sample dispatch gate (owner: bulk ships on an APPROVED Shipment Sample, and the
 * latest lab round on any of the style's samples PASSED; opt-in per customer) and the guards that keep
 * the chain honest.
 *
 * Posts what the UI posts: the result dialog sends blanks as '' for text and omits empty numbers,
 * dates as yyyy-MM-dd. Runs against the real app and the LIVE database on tagged fixtures that are
 * torn down in FK order (retests → tests → TRFs → samples → the rest).
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { productionBlockingValidationService } from '../../services/productionBlockingValidation.service';
import { UNRESOLVED_TEST_FAILURE } from '../../services/helpers/test-failure.helper';

const RUN = `LAB${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

let userId: string;
let authHeader: Record<string, string>;
let gatedCustomerId: string; // has an explicit SHIPMENT_SAMPLE requirement (required + blocks)
let openCustomerId: string; // no sample requirements at all — like House of Kasya
let styleId: string;
let otherStyleId: string;
let saleOrderId: string;
let ppSampleId: string;
let shipmentSampleId: string;
let otherStyleSampleId: string;
let sameStyleWorkOrderId: string;
let otherStyleWorkOrderId: string;
let deliveryNoteId: string;

let trf1: string;
let trf2: string;
let trf3: string;
let gpt1: string;
let gpt2: string;

const TRF = '/api/buyer-trfs';
const FPT = '/api/fabric-physical-tests';
const GPT = '/api/garment-physical-tests';

/** Fail with the API's own message, not just the status code. */
function expectStatus(res: request.Response, status: number) {
  if (res.status !== status) throw new Error(`expected ${status}, got HTTP ${res.status}: ${JSON.stringify(res.body)}`);
}

const trfBody = (sampleId: string, extra: Record<string, unknown> = {}) => ({
  styleId,
  saleOrderId,
  sampleId,
  buyingDepartment: 'WOMENS_WEAR',
  fibreContent: '100% RAYON', // a hand edit the retest round must carry over
  season: 'S10-26',
  ...extra,
});

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@lab.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const gated = await prisma.customers.create({
    data: { code: `${RUN}-G`, name: `${RUN} Gated Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  gatedCustomerId = gated.id;
  await prisma.customer_sample_requirements.create({
    data: { customerId: gatedCustomerId, sampleType: 'SHIPMENT_SAMPLE', isRequired: true, blocksProduction: true },
  });
  const open = await prisma.customers.create({
    data: { code: `${RUN}-O`, name: `${RUN} Open Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  openCustomerId = open.id;

  styleId = randomUUID();
  otherStyleId = randomUUID();
  await prisma.styles.createMany({
    data: [
      {
        id: styleId,
        styleCode: `${RUN}-S1`,
        styleName: `${RUN} Tunic`,
        customerName: gated.name,
        gender: 'WOMEN',
        createdById: userId,
      },
      {
        id: otherStyleId,
        styleCode: `${RUN}-S2`,
        styleName: `${RUN} Other`,
        customerName: gated.name,
        gender: 'WOMEN',
        createdById: userId,
      },
    ],
  });

  const so = await prisma.sale_orders.create({
    data: {
      saleOrderNumber: `${RUN}-SO`,
      buyerPoNumber: `${RUN}-PO`,
      customerId: gatedCustomerId,
      createdById: userId,
      items: { create: [{ id: randomUUID(), styleId, quantity: 100 }] },
    },
  });
  saleOrderId = so.id;

  const sample = (sampleType: 'PP_SAMPLE' | 'SHIPMENT_SAMPLE', forStyle: string, suffix: string) => ({
    id: randomUUID(),
    sampleNumber: `${RUN}-${suffix}`,
    customerId: gatedCustomerId,
    styleId: forStyle,
    sampleType,
    requiredDate: new Date(),
    createdById: userId,
  });
  const pp = sample('PP_SAMPLE', styleId, 'PP');
  const ship = sample('SHIPMENT_SAMPLE', styleId, 'SHIP');
  const other = sample('PP_SAMPLE', otherStyleId, 'PP2');
  await prisma.samples.createMany({ data: [pp, ship, other] });
  ppSampleId = pp.id;
  shipmentSampleId = ship.id;
  otherStyleSampleId = other.id;

  const workOrder = (forStyle: string, suffix: string) => ({
    id: randomUUID(),
    workOrderNumber: `${RUN}-WO${suffix}`,
    styleId: forStyle,
    plannedStartDate: new Date(),
    plannedEndDate: new Date(),
    totalQuantity: 100,
    createdById: userId,
  });
  const woSame = workOrder(styleId, '1');
  const woOther = workOrder(otherStyleId, '2');
  await prisma.work_orders.createMany({ data: [woSame, woOther] });
  sameStyleWorkOrderId = woSame.id;
  otherStyleWorkOrderId = woOther.id;

  // A PENDING sale-order delivery note for the style, to dispatch against the gate.
  const colorId = randomUUID();
  const sizeId = randomUUID();
  await prisma.color_options.create({ data: { id: colorId, styleId, colorName: `${RUN} Blue` } });
  await prisma.size_options.create({ data: { id: sizeId, styleId, sizeName: 'M', sizeCode: 'M' } });
  deliveryNoteId = randomUUID();
  await prisma.delivery_notes.create({
    data: {
      id: deliveryNoteId,
      deliveryNumber: `${RUN}-DN`,
      customerId: gatedCustomerId,
      saleOrderId,
      createdById: userId,
      delivery_note_items: { create: [{ id: randomUUID(), styleId, colorId, sizeId, quantity: 10 }] },
    },
  });
});

afterAll(async () => {
  const styleIds = [only(styleId), only(otherStyleId)];
  // Retests before originals (originalTestId is RESTRICT, checked per row), tests before TRFs (trfId RESTRICT).
  await prisma.fabric_physical_tests.deleteMany({ where: { styleId: { in: styleIds }, isRetest: true } });
  await prisma.fabric_physical_tests.deleteMany({ where: { styleId: { in: styleIds } } });
  await prisma.garment_physical_tests.deleteMany({ where: { styleId: { in: styleIds }, isRetest: true } });
  await prisma.garment_physical_tests.deleteMany({ where: { styleId: { in: styleIds } } });
  await prisma.buyer_test_requirement_forms.deleteMany({ where: { styleId: { in: styleIds } } });
  await prisma.delivery_notes.deleteMany({ where: { id: only(deliveryNoteId) } });
  await prisma.samples.deleteMany({ where: { styleId: { in: styleIds } } });
  await prisma.work_orders.deleteMany({ where: { styleId: { in: styleIds } } });
  await prisma.sale_orders.deleteMany({ where: { id: only(saleOrderId) } });
  await prisma.color_options.deleteMany({ where: { styleId: { in: styleIds } } });
  await prisma.size_options.deleteMany({ where: { styleId: { in: styleIds } } });
  await prisma.styles.deleteMany({ where: { id: { in: styleIds } } });
  await prisma.customers.deleteMany({ where: { id: { in: [only(gatedCustomerId), only(openCustomerId)] } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('sample lab rounds — the garment test on the PP sample (no work order)', () => {
  it('a TRF raised for a sample records it and ticks the sample stage from the sample type', async () => {
    const res = await request(app).post(TRF).set(authHeader).send(trfBody(ppSampleId));
    expectStatus(res, 201);
    trf1 = res.body.data.id;

    const fetched = (await request(app).get(`${TRF}/${trf1}`).set(authHeader).expect(200)).body.data;
    expect(fetched.sampleId).toBe(ppSampleId);
    expect(fetched.sampleStage).toBe('PP');
    expect(fetched.customerId).toBe(gatedCustomerId);
    expect(fetched.labResult).toBe('NO_RESULT');
    expect(fetched.sample.sampleNumber).toBe(`${RUN}-PP`);
  });

  it("refuses another style's sample, on create and on update (400, not 500)", async () => {
    expectStatus(await request(app).post(TRF).set(authHeader).send(trfBody(otherStyleSampleId)), 400);
    expectStatus(await request(app).put(`${TRF}/${trf1}`).set(authHeader).send({ sampleId: otherStyleSampleId }), 400);
  });

  it('records round 1 as ONE POST with no work order; buyer and lab come from the TRF; blanks accepted', async () => {
    // Exactly what the Lab Tests tab posts for a sample's garment result.
    const res = await request(app)
      .post(GPT)
      .set(authHeader)
      .send({
        trfId: trf1,
        styleId,
        customerId: gatedCustomerId,
        overallTestResult: 'FAIL',
        testReportNumber: `${RUN}-R1`,
        failureReason: 'Colour fastness to washing grade 2',
        testResultReceivedDate: '2026-09-20',
        testReportUrl: '', // a cleared input
        remarks: '',
      });
    expectStatus(res, 201);
    gpt1 = res.body.data.id;

    expect(res.body.data.workOrderId).toBeNull();
    expect(res.body.data.trfId).toBe(trf1);
    expect(res.body.data.customerId).toBe(gatedCustomerId);
    expect(res.body.data.testReportUrl).toBeNull();
    expect(res.body.data.overallTestResult).toBe('FAIL');
  });

  it('a garment test with neither a work order nor a round is refused (400, not the DB CHECK as a 500)', async () => {
    expectStatus(await request(app).post(GPT).set(authHeader).send({ styleId, overallTestResult: 'PASS' }), 400);
  });

  it('a second garment result on the same round is a 409 — a second test needs a second TRF', async () => {
    expectStatus(
      await request(app).post(GPT).set(authHeader).send({ trfId: trf1, styleId, overallTestResult: 'PASS' }),
      409
    );
  });

  it('a round with a recorded result cannot be removed', async () => {
    expectStatus(await request(app).delete(`${TRF}/${trf1}`).set(authHeader), 400);
  });

  it('the retest prefill carries the previous sheet over and switches it to RETEST', async () => {
    const res = await request(app)
      .get(`${TRF}/prefill`)
      .query({ styleId, saleOrderId, sampleId: ppSampleId, retestOfTrfId: trf1 })
      .set(authHeader);
    expectStatus(res, 200);
    const values = res.body.data.values;
    expect(values.packageType).toBe('RETEST');
    expect(values.previousReportNo).toBe(`${RUN}-R1`);
    expect(values.fibreContent).toBe('100% RAYON'); // hand edit survived, not re-derived
    expect(values.season).toBe('S10-26');
    expect(values.sampleId).toBe(ppSampleId);
    expect(res.body.data.missingFields).not.toContain('Season (buyer code)');
  });

  it('round 2: the garment retest is recorded against the new TRF and chains to round 1', async () => {
    const prefill = await request(app)
      .get(`${TRF}/prefill`)
      .query({ styleId, saleOrderId, sampleId: ppSampleId, retestOfTrfId: trf1 })
      .set(authHeader);
    // The form posts the prefilled values plus its own picks.
    const created = await request(app)
      .post(TRF)
      .set(authHeader)
      .send({ ...prefill.body.data.values, styleId, saleOrderId, buyingDepartment: 'WOMENS_WEAR' });
    expectStatus(created, 201);
    trf2 = created.body.data.id;
    expect(created.body.data.packageType).toBe('RETEST');
    expect(created.body.data.previousReportNo).toBe(`${RUN}-R1`);

    const retest = await request(app)
      .post(`${GPT}/retest`)
      .set(authHeader)
      .send({
        originalTestId: gpt1,
        trfId: trf2,
        retestReason: 'Re-dyed with a better fixing agent',
        overallTestResult: 'PASS',
        testReportNumber: `${RUN}-R2`,
      });
    expectStatus(retest, 201);
    gpt2 = retest.body.data.id;
    expect(retest.body.data.isRetest).toBe(true);
    expect(retest.body.data.retestCount).toBe(1);
    expect(retest.body.data.trfId).toBe(trf2);
    expect(retest.body.data.workOrderId).toBeNull();
  });

  it('a second retest of the same test is a 409 (a double-click used to make two)', async () => {
    expectStatus(
      await request(app).post(`${GPT}/retest`).set(authHeader).send({ originalTestId: gpt1, retestReason: 'again' }),
      409
    );
  });

  it("the sample's rounds read back newest first, each with the API's verdict", async () => {
    const res = await request(app)
      .get(TRF)
      .query({ sampleId: ppSampleId, sortBy: 'createdAt', sortOrder: 'desc' })
      .set(authHeader);
    expectStatus(res, 200);
    const rows = res.body.data;
    expect(rows.map((r: { id: string }) => r.id)).toEqual([trf2, trf1]);
    expect(rows[0].labResult).toBe('PASS');
    expect(rows[0].garmentTest.testReportNumber).toBe(`${RUN}-R2`);
    expect(rows[1].labResult).toBe('FAIL');
    expect(rows[1].garmentTest.failureReason).toBe('Colour fastness to washing grade 2');
  });

  it('round 1 no longer counts as an unresolved failure (Manufacturing Control Center)', async () => {
    const unresolved = await prisma.garment_physical_tests.count({ where: { id: gpt1, ...UNRESOLVED_TEST_FAILURE } });
    expect(unresolved).toBe(0);
  });

  it('a retest round after a PASS is refused', async () => {
    const res = await request(app)
      .get(`${TRF}/prefill`)
      .query({ styleId, saleOrderId, sampleId: ppSampleId, retestOfTrfId: trf2 })
      .set(authHeader);
    expectStatus(res, 400);
  });

  it('an override cannot be set by editing a test — only through /approve', async () => {
    const res = await request(app).put(`${GPT}/${gpt2}`).set(authHeader).send({ adminOverride: true, remarks: 'x' });
    expectStatus(res, 200);
    const fetched = await prisma.garment_physical_tests.findUnique({ where: { id: gpt2 } });
    expect(fetched?.adminOverride).toBe(false);
    expect(fetched?.remarks).toBe('x');
  });

  it('a later edit stores the lab report number (stripped by the GPT update schema until 2026-09-23)', async () => {
    expectStatus(
      await request(app)
        .put(`${GPT}/${gpt2}`)
        .set(authHeader)
        .send({ testReportNumber: `${RUN}-R2-REV`, testResultReceivedDate: '2026-09-21' }),
      200
    );
    const fetched = await prisma.garment_physical_tests.findUnique({ where: { id: gpt2 } });
    expect(fetched?.testReportNumber).toBe(`${RUN}-R2-REV`);
    expect(fetched?.testResultReceivedDate).not.toBeNull();
  });

  it('a sample with an active lab round cannot be deleted', async () => {
    expectStatus(await request(app).delete(`/api/samples/${ppSampleId}`).set(authHeader), 400);
  });

  it("refuses a garment result whose work order is another style than the round's", async () => {
    const res = await request(app).post(GPT).set(authHeader).send({
      workOrderId: otherStyleWorkOrderId,
      styleId: otherStyleId,
      trfId: trf2,
      overallTestResult: 'PASS',
    });
    expectStatus(res, 400);
  });

  it('a production garment test with a work order and no round still works', async () => {
    const res = await request(app)
      .post(GPT)
      .set(authHeader)
      .send({ workOrderId: sameStyleWorkOrderId, styleId, overallTestResult: 'PASS' });
    expectStatus(res, 201);
    expect(res.body.data.workOrderId).toBe(sameStyleWorkOrderId);
  });
});

describe('fabric test on the inwarded lot (no sample)', () => {
  let fabricFail: string;

  it('a failed fabric test blocks cutting for the style (D2)', async () => {
    const res = await request(app)
      .post(FPT)
      .set(authHeader)
      .send({
        styleId,
        overallTestResult: 'FAIL',
        testReportNumber: `${RUN}-F1`,
        failureReason: 'GSM below tolerance',
        testedGSM: '', // a cleared number input
      });
    expectStatus(res, 201);
    fabricFail = res.body.data.id;
    expect(res.body.data.testedGSM).toBeNull();
    const gate = await productionBlockingValidationService.validateFPTForStage(styleId, 'IN_CUTTING', true);
    expect(gate.isBlocked).toBe(true);
  });

  it('a retest on its own form (no sample) passes and unblocks cutting; the form never counts for dispatch', async () => {
    // A fabric retest's form: style + order, no sample.
    const form = await request(app)
      .post(TRF)
      .set(authHeader)
      .send({ styleId, saleOrderId, buyingDepartment: 'WOMENS_WEAR', packageType: 'RETEST' });
    expectStatus(form, 201);
    expect(form.body.data.sampleId).toBeNull();

    const retest = await request(app).post(`${FPT}/retest`).set(authHeader).send({
      originalTestId: fabricFail,
      trfId: form.body.data.id,
      retestReason: 'New lot from the mill',
      overallTestResult: 'PASS',
    });
    expectStatus(retest, 201);

    const gate = await productionBlockingValidationService.validateFPTForStage(styleId, 'IN_CUTTING', true);
    expect(gate.isBlocked).toBe(false);
  });
});

describe('Shipment Sample dispatch gate (D3, opt-in per customer)', () => {
  it('with the latest sample round passed, only the Shipment Sample approval is missing', async () => {
    const gate = await productionBlockingValidationService.validateShipmentSampleForDispatch(
      [styleId],
      gatedCustomerId
    );
    expect(gate.blockers.map((b) => b.type)).toEqual(['SHIPMENT_SAMPLE_NOT_APPROVED']);
  });

  it('refuses to dispatch a SALE-ORDER delivery note with the gate message', async () => {
    const res = await request(app)
      .post(`/api/dispatch/delivery-notes/${deliveryNoteId}/dispatch`)
      .set(authHeader)
      .send({});
    expectStatus(res, 400);
    expect(JSON.stringify(res.body)).toContain('Shipment Sample');
    const note = await prisma.delivery_notes.findUnique({ where: { id: deliveryNoteId } });
    expect(note?.status).toBe('PENDING');
  });

  it('approving the Shipment Sample clears it — the PP sample round is the lab evidence', async () => {
    await prisma.samples.update({ where: { id: shipmentSampleId }, data: { status: 'APPROVED' } });
    const gate = await productionBlockingValidationService.validateShipmentSampleForDispatch(
      [styleId],
      gatedCustomerId
    );
    expect(gate.isBlocked).toBe(false);
  });

  it('if the Shipment Sample IS sent to a lab, its round becomes the one that counts', async () => {
    const created = await request(app).post(TRF).set(authHeader).send(trfBody(shipmentSampleId));
    expectStatus(created, 201);
    trf3 = created.body.data.id;
    expect(created.body.data.sampleStage).toBe('SHIPMENT');
    let gate = await productionBlockingValidationService.validateShipmentSampleForDispatch([styleId], gatedCustomerId);
    expect(gate.blockers.map((b) => b.type)).toEqual(['SAMPLE_LAB_NOT_PASSED']);
    expect(gate.blockers[0].message).toContain('no result recorded yet');

    expectStatus(
      await request(app)
        .post(GPT)
        .set(authHeader)
        .send({ trfId: trf3, styleId, overallTestResult: 'PASS', testReportNumber: `${RUN}-S1` }),
      201
    );
    gate = await productionBlockingValidationService.validateShipmentSampleForDispatch([styleId], gatedCustomerId);
    expect(gate.isBlocked).toBe(false);
  });

  it('a style with no Shipment Sample is blocked with a readable reason', async () => {
    const gate = await productionBlockingValidationService.validateShipmentSampleForDispatch(
      [otherStyleId],
      gatedCustomerId
    );
    expect(gate.isBlocked).toBe(true);
    expect(gate.blockers[0].message).toContain('No Shipment Sample exists');
  });

  it('never blocks a customer with no Shipment Sample requirement row', async () => {
    const gate = await productionBlockingValidationService.validateShipmentSampleForDispatch([styleId], openCustomerId);
    expect(gate.isBlocked).toBe(false);
  });
});
