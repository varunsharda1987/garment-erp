/**
 * A rate-card row's last filled band carries up to every larger quantity (2026-09-28).
 *
 * Aryan Dyeing holds seven bands to 3500 m, but nine greiges were filled only to 1500 m — so a
 * 2000 m job fell into an empty band and every screen said "no rate". The owner's rule: a
 * quantity past the row's last filled band takes that band's rate. Real slabs and cards on tagged
 * fixtures, through lookupRate / lookupLaceRate / explainMissingRate themselves.
 */

import { prisma, createTestUser } from '../helpers/test-utils';
import { lookupRate, lookupLaceRate, explainMissingRate } from '../../services/processor-rate-v2.service';

const RUN = `RCU${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let processorId: string;
let greigeId: string;
let lowGapGreigeId: string;
let laceId: string;
const slabs: Record<string, string> = {};
const slabIds: string[] = [];
const rateCardIds: string[] = [];

const only = (id: string | undefined) => id ?? '__unset__';

const BANDS: Array<[string, number, number]> = [
  ['B0', 0, 500],
  ['B1', 500, 1000],
  ['B2', 1000, 2000],
  ['B3', 2000, 3000],
];

async function makeSlabs(processingType: 'DYEING' | 'PRINTING') {
  for (const [i, [name, min, max]] of BANDS.entries()) {
    const slab = await prisma.processor_quantity_slabs.create({
      data: {
        processorId,
        processingType,
        slabOrder: i + 1,
        minQuantity: min,
        maxQuantity: max,
        slabLabel: `${RUN}-${processingType[0]}${name}`,
        isActive: true,
        createdById: userId,
      },
    });
    slabs[`${processingType[0]}${name}`] = slab.id;
    slabIds.push(slab.id);
  }
}

async function makeCard(
  slabKey: string,
  rate: number,
  row: { greigeId?: string; laceId?: string; printingType?: 'PIGMENT' | 'PROCIAN' }
) {
  const card = await prisma.processor_rate_card.create({
    data: {
      processorId,
      processingType: row.printingType ? 'PRINTING' : 'DYEING',
      printingType: row.printingType ?? null,
      greigeId: row.greigeId ?? null,
      laceId: row.laceId ?? null,
      slabId: slabs[slabKey],
      ratePerMeter: rate,
      effectiveFrom: new Date('2026-01-01'),
      isActive: true,
      createdById: userId,
    },
  });
  rateCardIds.push(card.id);
}

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;

  processorId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-DYER`,
        name: `${RUN} Dyer`,
        supplierCategories: ['DYEING_PRINTING'],
        isActive: true,
        createdById: userId,
      },
    })
  ).id;

  const greige = (code: string) =>
    prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-${code}`,
        greigeName: `${RUN} Poplin ${code}`,
        genericGreigeName: `${RUN} Poplin`,
        composition: '100% Cotton',
        greigeWidth: 63,
        createdById: userId,
      },
    });
  greigeId = (await greige('G1')).id;
  lowGapGreigeId = (await greige('G2')).id;

  laceId = (
    await prisma.lace_master.create({
      data: { laceCode: `${RUN}-L`, laceName: `${RUN} Greige Lace`, isGreige: true, laceType: 'Organza', width: 1 },
    })
  ).id;

  await makeSlabs('DYEING');
  await makeSlabs('PRINTING');

  // Dyeing: G1 filled in the first two bands; the 1000-2000 band holds only a ₹0 placeholder
  await makeCard('DB0', 12, { greigeId });
  await makeCard('DB1', 10, { greigeId });
  await makeCard('DB2', 0, { greigeId });
  // G2 is filled only from 500 m up — nothing below
  await makeCard('DB1', 11, { greigeId: lowGapGreigeId });
  // Printing: Pigment stops at 1000 m, Procian is filled in every band of the SAME slabs
  await makeCard('PB0', 20, { greigeId, printingType: 'PIGMENT' });
  await makeCard('PB1', 18, { greigeId, printingType: 'PIGMENT' });
  for (const [key, rate] of [
    ['PB0', 30],
    ['PB1', 28],
    ['PB2', 26],
    ['PB3', 24],
  ] as const) {
    await makeCard(key, rate, { greigeId, printingType: 'PROCIAN' });
  }
  // Lace: filled in the first two bands
  await makeCard('DB0', 9, { laceId });
  await makeCard('DB1', 8, { laceId });
});

afterAll(async () => {
  await prisma.processor_rate_card.deleteMany({ where: { id: { in: rateCardIds } } });
  await prisma.processor_quantity_slabs.deleteMany({ where: { id: { in: slabIds } } });
  await prisma.lace_master.deleteMany({ where: { id: only(laceId) } });
  await prisma.greige_master.deleteMany({ where: { id: { in: [only(greigeId), only(lowGapGreigeId)] } } });
  await prisma.suppliers.deleteMany({ where: { id: only(processorId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

const dyeing = (quantityMeters: number, g = greigeId) =>
  lookupRate({ processorId, processingType: 'DYEING', greigeId: g, quantityMeters });

describe('lookupRate — the last filled band carries up', () => {
  it('a quantity inside a filled band takes that band, not carried', async () => {
    const r = await dyeing(700);
    expect(r?.ratePerMeter).toBe(10);
    expect(r?.slabId).toBe(slabs.DB1);
    expect(r?.carriedUp).toBe(false);
    expect(r?.slabLabel).toBe(`${RUN}-DB1`);
  });

  it('a quantity in an empty band above takes the last filled band — a ₹0 placeholder there is not a rate', async () => {
    // 1500 m falls in 1000-2000, which holds only the ₹0 card
    const r = await dyeing(1500);
    expect(r?.ratePerMeter).toBe(10);
    expect(r?.slabId).toBe(slabs.DB1);
    expect(r?.carriedUp).toBe(true);
    expect(r?.slabLabel).toBe(`${RUN}-DB1 — last rated band`);
    expect(r?.totalCost).toBe(15000);
  });

  it('a quantity above every band takes the row’s last filled band, not the processor’s top band', async () => {
    const r = await dyeing(5000);
    expect(r?.ratePerMeter).toBe(10);
    expect(r?.slabId).toBe(slabs.DB1);
    expect(r?.carriedUp).toBe(true);
  });

  it('never carries DOWN: below the row’s first filled band there is still no rate, and the reason names where rates start', async () => {
    expect(await dyeing(300, lowGapGreigeId)).toBeNull();

    const why = await explainMissingRate({
      processorId,
      processingType: 'DYEING',
      greigeId: lowGapGreigeId,
      quantityMeters: 300,
    });
    expect(why.code).toBe('NO_SLAB_RATE');
    expect(why.slabLabel).toBe(`${RUN}-DB0`);
    expect(why.message).toContain(`from the ${RUN}-DB1 band up`);
  });

  it('a Pigment row carries its own last rate up and never takes the Procian card of the same band', async () => {
    const pigment = await lookupRate({
      processorId,
      processingType: 'PRINTING',
      printingType: 'PIGMENT',
      greigeId,
      quantityMeters: 2500,
    });
    expect(pigment?.ratePerMeter).toBe(18);
    expect(pigment?.slabId).toBe(slabs.PB1);
    expect(pigment?.printingType).toBe('PIGMENT');
    expect(pigment?.carriedUp).toBe(true);

    const procian = await lookupRate({
      processorId,
      processingType: 'PRINTING',
      printingType: 'PROCIAN',
      greigeId,
      quantityMeters: 2500,
    });
    expect(procian?.ratePerMeter).toBe(24);
    expect(procian?.slabId).toBe(slabs.PB3);
    expect(procian?.carriedUp).toBe(false);
  });
});

describe('lookupLaceRate — same rule for lace', () => {
  it('carries the lace’s last filled band up', async () => {
    const r = await lookupLaceRate({ processorId, laceId, quantityMeters: 1500 });
    expect(r?.ratePerMeter).toBe(8);
    expect(r?.slab.id).toBe(slabs.DB1);
    expect(r?.slab.label).toBe(`${RUN}-DB1 — last rated band`);
    expect(r?.carriedUp).toBe(true);
  });

  it('inside a filled band it is the band’s own rate', async () => {
    const r = await lookupLaceRate({ processorId, laceId, quantityMeters: 200 });
    expect(r?.ratePerMeter).toBe(9);
    expect(r?.carriedUp).toBe(false);
  });
});
