/**
 * Raising a job work order by hand prices it from the processor's rate card (2026-09-21).
 *
 * The owner's report: "if someone is creating Job work directly from the job work page, the window
 * that pops up is not showing the shrinkage and the rates as per the processor which has been set,
 * a user has to manually input this."
 *
 * The cards were always there — keyed on processor + process type (+ print type) + greige + a
 * quantity slab — and every other screen reads them. This create surface could not: it never asked
 * which greige was going out, so there was no key to look the card up with, and it wrote
 * `rateSource: 'MANUAL'` unconditionally.
 *
 * What this suite pins:
 *   - a job that names its greige gets the card's shrinkage and is recorded as RATE_CARD when the
 *     agreed rate IS the card's quote, MANUAL with a variance audit when the operator overrides;
 *   - the SLAB is chosen on the BILLABLE metres (sent × (1 − shrinkage)) — the basis every other
 *     writer records, and the difference that decides a boundary job's rate;
 *   - a typed shrinkage still wins, and with no card the greige master's average is the fallback;
 *   - a job with no greige behaves exactly as before, basis quantity included;
 *   - the greige is the job's contract: issuance refuses lots of any other cloth.
 */

import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';

const RUN = `JRC${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let authHeader: Record<string, string>;
let pmAuthHeader: Record<string, string>;
let pmUserId: string;
let dyerId: string;
let printerId: string;
let greigeId: string;
let otherGreigeId: string;
let uncardedGreigeId: string;
let warehouseId: string;
const slabIds: string[] = [];
const rateCardIds: string[] = [];
const createdJwoIds: string[] = [];

const only = (id: string | undefined) => id ?? '__unset__';

/** The card: ₹12/m and 6% shrinkage up to 1,000 billable metres, ₹11/m above it. */
const CARD_RATE_LOW = 12;
const CARD_RATE_HIGH = 11;
const CARD_SHRINKAGE = 6;
/** The greige master's own figure — the fallback when the processor holds no card. */
const MASTER_SHRINKAGE = 11;

const createJwo = (body: Record<string, unknown>, header = authHeader) =>
  request(app).post('/api/job-work-orders').set(header).send(body);

async function makeSlab(processorId: string, processingType: string, order: number, min: number, max: number) {
  const slab = await prisma.processor_quantity_slabs.create({
    data: {
      processorId,
      processingType,
      slabOrder: order,
      minQuantity: min,
      maxQuantity: max,
      slabLabel: `${RUN}-${min}-${max}m`,
      isActive: true,
      createdById: userId,
    },
  });
  slabIds.push(slab.id);
  return slab.id;
}

async function makeCard(params: {
  processorId: string;
  processingType: string;
  slabId: string;
  greige: string;
  rate: number;
  shrinkage: number | null;
  printingType?: 'PIGMENT' | 'PROCIAN' | 'DISCHARGE' | 'PIGMENT_DISCHARGE';
}) {
  const card = await prisma.processor_rate_card.create({
    data: {
      processorId: params.processorId,
      greigeId: params.greige,
      slabId: params.slabId,
      processingType: params.processingType,
      printingType: params.printingType ?? null,
      ratePerMeter: params.rate,
      shrinkagePercent: params.shrinkage,
      effectiveFrom: new Date('2026-01-01'),
      isActive: true,
      createdById: userId,
    },
  });
  rateCardIds.push(card.id);
  return card.id;
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  // The role that raises jobs but never held the costSheets permission the rate lookup used to
  // demand — the reason a production manager saw nothing fill in.
  const pm = await createTestUser({
    email: `test-${RUN.toLowerCase()}-pm@smoke.test`,
    role: 'PRODUCTION_MANAGER',
    isActive: true,
    isApproved: true,
  });
  pmUserId = pm.id;
  pmAuthHeader = getAuthHeader(pm.id, 'PRODUCTION_MANAGER');

  const [dyer, printer] = await Promise.all([
    prisma.suppliers.create({
      data: {
        code: `${RUN}-DYE`,
        name: `${RUN} Dyer`,
        supplierCategories: ['DYEING_PRINTING'],
        isActive: true,
        createdById: userId,
      },
    }),
    prisma.suppliers.create({
      data: {
        code: `${RUN}-PRN`,
        name: `${RUN} Printer`,
        supplierCategories: ['DYEING_PRINTING'],
        isActive: true,
        createdById: userId,
      },
    }),
  ]);
  dyerId = dyer.id;
  printerId = printer.id;

  const mkGreige = (suffix: string, avgShrinkage: number | null) =>
    prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-${suffix}`,
        greigeName: `${RUN} ${suffix} Poplin`,
        genericGreigeName: `${RUN} Poplin`,
        composition: '100% Cotton',
        greigeWidth: 52,
        averageShrinkagePercent: avgShrinkage,
        createdById: userId,
      },
    });
  const [carded, other, uncarded] = await Promise.all([
    mkGreige('GG', MASTER_SHRINKAGE),
    mkGreige('GG2', MASTER_SHRINKAGE),
    mkGreige('GG3', MASTER_SHRINKAGE),
  ]);
  greigeId = carded.id;
  otherGreigeId = other.id;
  uncardedGreigeId = uncarded.id;

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

  const [lowSlab, highSlab] = await Promise.all([
    makeSlab(dyerId, 'DYEING', 1, 0, 1000),
    makeSlab(dyerId, 'DYEING', 2, 1000, 5000),
  ]);
  await Promise.all([
    makeCard({
      processorId: dyerId,
      processingType: 'DYEING',
      slabId: lowSlab,
      greige: greigeId,
      rate: CARD_RATE_LOW,
      shrinkage: CARD_SHRINKAGE,
    }),
    makeCard({
      processorId: dyerId,
      processingType: 'DYEING',
      slabId: highSlab,
      greige: greigeId,
      rate: CARD_RATE_HIGH,
      shrinkage: CARD_SHRINKAGE,
    }),
  ]);

  // Printing is keyed by print type too: two types, two rates, two shrinkages — the shape that
  // reads as "ambiguous" to the processor+greige scan and needs the card's own value.
  const printSlab = await makeSlab(printerId, 'PRINTING', 1, 0, 5000);
  await Promise.all([
    makeCard({
      processorId: printerId,
      processingType: 'PRINTING',
      slabId: printSlab,
      greige: greigeId,
      rate: 20,
      shrinkage: 4,
      printingType: 'PIGMENT',
    }),
    makeCard({
      processorId: printerId,
      processingType: 'PRINTING',
      slabId: printSlab,
      greige: greigeId,
      rate: 26,
      shrinkage: 7,
      printingType: 'DISCHARGE',
    }),
  ]);
});

afterAll(async () => {
  const jwoIds = (
    await prisma.job_work_orders.findMany({
      where: { processorId: { in: [only(dyerId), only(printerId)] } },
      select: { id: true },
    })
  ).map((j) => j.id);
  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  const challanIds = (
    await prisma.challans.findMany({ where: { jobWorkOrderId: { in: jwoIds } }, select: { id: true } })
  ).map((c) => c.id);
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: [...jwoIds, ...createdJwoIds.filter(Boolean)] } } });

  await prisma.processor_rate_card.deleteMany({ where: { id: { in: rateCardIds } } });
  await prisma.processor_quantity_slabs.deleteMany({ where: { id: { in: slabIds } } });

  const greigeIds = [only(greigeId), only(otherGreigeId), only(uncardedGreigeId)];
  const lotIds = (
    await prisma.greige_stock.findMany({ where: { greigeId: { in: greigeIds } }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: { in: lotIds } } });
  await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: { in: lotIds } } });
  await prisma.greige_stock.deleteMany({ where: { id: { in: lotIds } } });
  await prisma.stock_levels.deleteMany({ where: { materials: { greigeId: { in: greigeIds } } } });
  await prisma.stock_movements.deleteMany({ where: { materials: { greigeId: { in: greigeIds } } } });
  await prisma.materials.deleteMany({ where: { greigeId: { in: greigeIds } } });
  await prisma.greige_master.deleteMany({ where: { id: { in: greigeIds } } });

  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.suppliers.deleteMany({ where: { id: { in: [only(dyerId), only(printerId)] } } });
  await prisma.users.deleteMany({ where: { id: { in: [only(userId), only(pmUserId)] } } });
  await prisma.$disconnect();
});

describe('a hand-raised job work order is priced from the processor rate card', () => {
  it('takes the shrinkage and the rate from the card, and records which card it was', async () => {
    // 800 sent at the card's 6% = 752 billable, inside the 0-1000 slab → ₹12/m.
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeId,
      quantity: 800,
      agreedRate: CARD_RATE_LOW,
      colorName: 'Navy',
    });
    expect(res.status).toBe(201);
    createdJwoIds.push(res.body.data.id);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: res.body.data.id } });
    expect(jwo!.greigeId).toBe(greigeId);
    expect(Number(jwo!.expectedShrinkage)).toBe(CARD_SHRINKAGE); // never typed — the card's
    expect(Number(jwo!.qtyBillable)).toBe(752);
    expect(Number(jwo!.agreedRatePerMeter)).toBe(CARD_RATE_LOW);
    // The agreed rate IS the card's quote, so the document says so.
    expect(jwo!.rateSource).toBe('RATE_CARD');
    expect(rateCardIds).toContain(jwo!.rateCardId);
    expect(slabIds).toContain(jwo!.slabId);
    expect(Number(jwo!.rateBasisQuantity)).toBe(752); // billable, not the 800 sent
    expect(jwo!.rateVarianceReason).toBeNull();

    // And the job reads back with its greige, so the page can name the cloth before any lot exists.
    const read = await request(app).get(`/api/job-work-orders/${res.body.data.id}`).set(authHeader);
    expect(read.status).toBe(200);
    expect(read.body.data.greige.greigeCode).toBe(`${RUN}-GG`);
  });

  it('keeps a negotiated rate but files the card rate as the variance', async () => {
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeId,
      quantity: 800,
      agreedRate: 15, // negotiated above the card
      colorName: 'Navy',
    });
    expect(res.status).toBe(201);
    createdJwoIds.push(res.body.data.id);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: res.body.data.id } });
    expect(Number(jwo!.agreedRatePerMeter)).toBe(15); // what we actually pay
    expect(jwo!.rateSource).toBe('MANUAL');
    expect(Number(jwo!.costedRatePerMeter)).toBe(CARD_RATE_LOW); // the rate it did NOT take
    expect(jwo!.rateVarianceReason).toMatch(/15/);
    expect(jwo!.rateVarianceReason).toMatch(/12/);
    expect(Number(jwo!.expectedShrinkage)).toBe(CARD_SHRINKAGE);
  });

  it('lets a typed shrinkage win over the card', async () => {
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeId,
      quantity: 800,
      agreedRate: CARD_RATE_LOW,
      expectedShrinkage: 9,
      colorName: 'Navy',
    });
    expect(res.status).toBe(201);
    createdJwoIds.push(res.body.data.id);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: res.body.data.id } });
    expect(Number(jwo!.expectedShrinkage)).toBe(9);
    expect(Number(jwo!.qtyBillable)).toBe(728); // 800 × 0.91 — from the typed figure
  });

  it('chooses the slab on the BILLABLE metres, not the metres sent', async () => {
    // 1,050 sent is in the 1000-5000 slab (₹11), but 6% shrinkage bills 987 — the 0-1000 slab
    // at ₹12. Quoting at the metres sent would file an honest ₹12 as a manual variance.
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeId,
      quantity: 1050,
      agreedRate: CARD_RATE_LOW,
      colorName: 'Navy',
    });
    expect(res.status).toBe(201);
    createdJwoIds.push(res.body.data.id);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: res.body.data.id } });
    expect(Number(jwo!.qtyBillable)).toBe(987);
    expect(Number(jwo!.rateBasisQuantity)).toBe(987);
    expect(jwo!.rateSource).toBe('RATE_CARD');
    expect(Number(jwo!.costedRatePerMeter ?? 0)).toBe(0); // no variance: it IS the card rate
  });

  it('falls back to the greige master average when the processor holds no card for that cloth', async () => {
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeId: uncardedGreigeId,
      quantity: 800,
      agreedRate: 14,
      colorName: 'Navy',
    });
    expect(res.status).toBe(201);
    createdJwoIds.push(res.body.data.id);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: res.body.data.id } });
    expect(Number(jwo!.expectedShrinkage)).toBe(MASTER_SHRINKAGE);
    expect(jwo!.rateSource).toBe('MANUAL');
    expect(jwo!.rateCardId).toBeNull();
    expect(Number(jwo!.rateBasisQuantity)).toBe(712); // 800 × 0.89 — the basis is still recorded
  });

  it('prices a printing job on the print type — and finds no card without one', async () => {
    const withType = await createJwo({
      processType: 'PRINTING',
      processorId: printerId,
      greigeId,
      printingType: 'DISCHARGE',
      quantity: 500,
      agreedRate: 26,
      colorName: 'Navy',
    });
    expect(withType.status).toBe(201);
    createdJwoIds.push(withType.body.data.id);
    const priced = await prisma.job_work_orders.findUnique({ where: { id: withType.body.data.id } });
    // The DISCHARGE card's own 7%, not the "ambiguous" 4%/7% the processor+greige scan sees.
    expect(Number(priced!.expectedShrinkage)).toBe(7);
    expect(priced!.rateSource).toBe('RATE_CARD');

    const withoutType = await createJwo({
      processType: 'PRINTING',
      processorId: printerId,
      greigeId,
      quantity: 500,
      agreedRate: 26,
      colorName: 'Navy',
    });
    expect(withoutType.status).toBe(201);
    createdJwoIds.push(withoutType.body.data.id);
    const unpriced = await prisma.job_work_orders.findUnique({ where: { id: withoutType.body.data.id } });
    expect(unpriced!.rateCardId).toBeNull();
    expect(unpriced!.rateSource).toBe('MANUAL');
  });

  it('leaves a job with no greige exactly as it was, basis quantity included', async () => {
    const res = await createJwo({
      processType: 'STITCHING',
      processorId: dyerId,
      quantity: 200,
      agreedRate: 35,
    });
    expect(res.status).toBe(201);
    createdJwoIds.push(res.body.data.id);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: res.body.data.id } });
    expect(jwo!.greigeId).toBeNull();
    expect(jwo!.rateSource).toBe('MANUAL');
    expect(jwo!.rateCardId).toBeNull();
    // A piece job has no shrinkage, so the basis is the quantity itself — it must not go null.
    expect(Number(jwo!.rateBasisQuantity)).toBe(200);
    expect(Number(jwo!.agreedRatePerMeter)).toBe(35);
  });

  it('refuses a greige on a process that returns no cloth, and on a lace job', async () => {
    const onPieces = await createJwo({
      processType: 'STITCHING',
      processorId: dyerId,
      greigeId,
      quantity: 200,
      agreedRate: 35,
    });
    expect(onPieces.status).toBe(400);
    expect(JSON.stringify(onPieces.body)).toMatch(/fabric processes/i);

    const printTypeOnDyeing = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeId,
      printingType: 'PIGMENT',
      quantity: 500,
      agreedRate: 12,
      colorName: 'Navy',
    });
    expect(printTypeOnDyeing.status).toBe(400);
    expect(JSON.stringify(printTypeOnDyeing.body)).toMatch(/printingType/i);
  });

  it('answers the rate lookup for a production manager — the role that raises jobs', async () => {
    // Until 2026-09-21 both lookup routes sat behind the costSheets write guard
    // (ADMIN/MERCHANDISER/ACCOUNTS), so this returned 403 and the dialog silently filled nothing.
    const res = await request(app)
      .post('/api/processor-rate-cards/v2/lookup')
      .set(pmAuthHeader)
      .send({ processorId: dyerId, processingType: 'DYEING', greigeId, quantityMeters: 752 });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.ratePerMeter)).toBe(CARD_RATE_LOW);
    expect(Number(res.body.data.shrinkagePercent)).toBe(CARD_SHRINKAGE);

    // And a production manager can raise the job the figures belong to.
    const created = await createJwo(
      {
        processType: 'DYEING',
        processorId: dyerId,
        greigeId,
        quantity: 800,
        agreedRate: CARD_RATE_LOW,
        colorName: 'Navy',
      },
      pmAuthHeader
    );
    expect(created.status).toBe(201);
    createdJwoIds.push(created.body.data.id);
  });

  it('holds the job to its greige: a lot of another cloth cannot be issued against it', async () => {
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeId,
      quantity: 500,
      agreedRate: CARD_RATE_LOW,
      colorName: 'Navy',
    });
    expect(res.status).toBe(201);
    const jwoId = res.body.data.id as string;
    createdJwoIds.push(jwoId);
    await request(app).post(`/api/job-work-orders/${jwoId}/approve`).set(authHeader).send({});

    const mkLot = (greige: string) =>
      prisma.greige_stock.create({
        data: {
          greigeId: greige,
          quantityAvailable: 600,
          greigeWidth: 52,
          receivedDate: new Date(),
          purchaseCost: 40,
          weightedAvgCost: 40,
          warehouseId,
          createdById: userId,
        },
      });
    const [rightLot, wrongLot] = await Promise.all([mkLot(greigeId), mkLot(otherGreigeId)]);

    const wrong = await request(app)
      .post(`/api/job-work-orders/${jwoId}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: wrongLot.id, qty: 500 }] });
    expect(wrong.status).toBe(422);
    expect(wrong.body.message).toMatch(/was raised for/);
    expect(wrong.body.message).toMatch(new RegExp(`${RUN}-GG`));
    expect(wrong.body.message).toMatch(/Pick a lot of that greige/);

    // The preview offers only lots of the job's own greige.
    const preview = await request(app).get(`/api/job-work-orders/${jwoId}/issue-preview`).set(authHeader);
    expect(preview.status).toBe(200);
    expect(preview.body.data.expectedGreige.greigeCode).toBe(`${RUN}-GG`);
    const offered: Array<{ id: string }> = preview.body.data.availableLots ?? [];
    expect(offered.some((l) => l.id === rightLot.id)).toBe(true);
    expect(offered.some((l) => l.id === wrongLot.id)).toBe(false);

    // The right cloth issues.
    const right = await request(app)
      .post(`/api/job-work-orders/${jwoId}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: rightLot.id, qty: 500 }] });
    expect(right.status).toBe(200);
  });
});
