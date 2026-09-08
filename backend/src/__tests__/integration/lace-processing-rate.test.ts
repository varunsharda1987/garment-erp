/**
 * Lace dyeing rate correctness (2026-09-02).
 *
 * Two money bugs this suite pins, both found while designing the MRP greige/processing split:
 *
 * 1. WRONG DYER'S PRICE. When an approved lab dip fixed the processor but that processor had no
 *    lace rate card, the cheapest-rate scan still ran: it took another dyer's ratePerMeter AND
 *    their shrinkage, while leaving processorId on the lab-dip dyer. The quote — and every PO
 *    frozen from it — then billed dyer A's work at dyer B's price, with dyer B's shrinkage
 *    deciding how much greige to buy.
 *
 * 2. RATE BAND ON THE RIGHT QUANTITY. Lace dyers bill per dyed metre RETURNED (confirmed with the
 *    business 2026-09-08), so the rate card's quantity band is picked on the FINISHED metres, and
 *    the greige is grossed up separately only to know how much to buy and send. An intermediate
 *    revision banded on the greige quantity instead — on the assumption, taken from this service's
 *    own arithmetic, that dyers charge per metre processed. This pins the corrected behaviour.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { calculateLaceCost } from '../../services/laceCostingCalculation.service';

const RUN = `LPR${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let greigeLaceId: string;
let dyedLaceId: string;
let labDipDyerId: string;
let cheapDyerId: string;
const slabIds: string[] = [];
const rateCardIds: string[] = [];

const only = (id: string | undefined) => id ?? '__unset__';

/** 0.30 m per garment × 3000 pcs = 900 finished m; at 10% shrinkage the dyer handles 1000 m. */
const QTY_PER_GARMENT = 0.3;
const ORDER_QTY = 3000;
const SHRINKAGE = 10;

/** Slabs belong to a processor, so each dyer needs its own bands. */
async function makeSlab(processorId: string, label: string, order: number, min: number, max: number) {
  const slab = await prisma.processor_quantity_slabs.create({
    data: {
      processorId,
      processingType: 'DYEING',
      slabOrder: order,
      minQuantity: min,
      maxQuantity: max,
      slabLabel: `${RUN}-${label}`,
      isActive: true,
      createdById: userId,
    },
  });
  slabIds.push(slab.id);
  return slab.id;
}

async function makeRateCard(processorId: string, slabId: string, rate: number, shrinkage: number | null) {
  const card = await prisma.processor_rate_card.create({
    data: {
      processorId,
      laceId: greigeLaceId,
      slabId,
      processingType: 'DYEING',
      ratePerMeter: rate,
      shrinkagePercent: shrinkage,
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

  const greige = await prisma.lace_master.create({
    data: {
      laceCode: `${RUN}-G`,
      laceName: `${RUN} Greige`,
      isGreige: true,
      costPerMeterGreige: 40,
      laceType: 'Organza',
      width: 1,
    },
  });
  greigeLaceId = greige.id;

  const dyed = await prisma.lace_master.create({
    data: {
      laceCode: `${RUN}-D`,
      laceName: `${RUN} Navy`,
      isGreige: false,
      color: 'Navy',
      sourceGreigeLaceId: greigeLaceId,
      laceType: 'Organza',
      width: 1,
    },
  });
  dyedLaceId = dyed.id;

  const mk = async (code: string) =>
    prisma.suppliers.create({
      data: {
        code: `${RUN}-${code}`,
        name: `${RUN} ${code}`,
        supplierCategories: ['DYEING_PRINTING'],
        isActive: true,
        createdById: userId,
      },
    });
  labDipDyerId = (await mk('LABDIP')).id;
  cheapDyerId = (await mk('CHEAP')).id;
});

afterAll(async () => {
  await prisma.processor_rate_card.deleteMany({ where: { id: { in: rateCardIds.filter(Boolean) } } });
  await prisma.processor_quantity_slabs.deleteMany({ where: { id: { in: slabIds.filter(Boolean) } } });
  await prisma.lace_lab_dip.deleteMany({ where: { greigeLaceId: only(greigeLaceId) } });
  await prisma.lace_master.deleteMany({ where: { id: { in: [only(dyedLaceId), only(greigeLaceId)] } } });
  await prisma.suppliers.deleteMany({ where: { id: { in: [only(labDipDyerId), only(cheapDyerId)] } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('lace dyeing rate is priced on greige metres', () => {
  it('picks the band on the dyed metres returned, and grosses the greige up separately', async () => {
    // 900 finished m sits in the 500-1000 band. The 1000 greige m that must be SENT would cross
    // into the next band — but the dyer does not bill on what is sent.
    const midBand = await makeSlab(cheapDyerId, 'MID', 1, 500, 999.99);
    const topBand = await makeSlab(cheapDyerId, 'TOP', 2, 1000, 999999);
    await makeRateCard(cheapDyerId, midBand, 20, SHRINKAGE);
    await makeRateCard(cheapDyerId, topBand, 25, SHRINKAGE);

    const result = await calculateLaceCost({
      laceId: dyedLaceId,
      quantityPerGarment: QTY_PER_GARMENT,
      orderQuantity: ORDER_QTY,
      wastagePercent: 0,
    });

    const gp = result.greigeProcessing;
    expect(gp.available).toBe(true);
    // Greige need is grossed up exactly once: 900 / 0.9
    expect(gp.greigeQuantityNeeded).toBeCloseTo(1000, 4);
    // The rate is the 500-1000 band's: 900 returned metres are what gets invoiced.
    expect(gp.costBreakdown.processingCostPerMeter).toBe(20);
    // Per finished metre: greige 40 ÷ 0.9 grossed up, plus dyeing 20 as billed — NOT (40+20) ÷ 0.9.
    expect(gp.costBreakdown.effectiveCostPerMeter).toBeCloseTo(40 / 0.9 + 20, 2);
    // Totals: greige on 1000 m sent, dyeing on 900 m returned.
    expect(gp.greigeCost).toBeCloseTo(1000 * 40, 2);
    expect(gp.processingCost).toBeCloseTo(900 * 20, 2);
  });
});

describe('a fixed dyer is never priced at another card', () => {
  it('reports unavailable when the lab-dip dyer has no rate card, instead of borrowing one', async () => {
    // Only the CHEAP dyer has a card; the lab-dip dyer has none.
    // slabOrder 3 because the previous test already used 1 and 2 for this processor.
    const band = await makeSlab(cheapDyerId, 'ANY', 3, 0, 999999);
    await makeRateCard(cheapDyerId, band, 20, SHRINKAGE);

    await prisma.lace_lab_dip.create({
      data: {
        labDipNumber: `${RUN}-LD`,
        greigeLaceId,
        targetColor: 'Navy',
        processorId: labDipDyerId,
        sampleQuantity: 1,
        status: 'APPROVED',
        buyerDecisionDate: new Date(),
        createdById: userId,
      },
    });

    const result = await calculateLaceCost({
      laceId: dyedLaceId,
      quantityPerGarment: QTY_PER_GARMENT,
      orderQuantity: ORDER_QTY,
      wastagePercent: 0,
    });

    const gp = result.greigeProcessing;
    // Previously: available:true, processorId = lab-dip dyer, rate = the cheap dyer's 20.
    expect(gp.available).toBe(false);
    expect(gp.processingCost).toBeNull();
    expect(gp.details).toMatch(/no rate card/i);
    // The dyer the buyer approved is still the one reported — we just cannot price them.
    expect(gp.processorId).toBe(labDipDyerId);
  });
});
