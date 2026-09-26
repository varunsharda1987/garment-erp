/**
 * validateCostSheetRates — the RATES_OUTDATED gate on Order BOM creation (mocked prisma, no DB).
 *
 * A processor quotes PIGMENT, PROCIAN and DISCHARGE printing as separate cards in the SAME slab,
 * all open-ended. The "current rate" lookup ignored printingType, so ESSKY082LS (costed Pigment
 * ₹20) was compared against the newer Procian ₹28 card and blocked as "+40%" — and a new cost
 * sheet version could not clear it, because it re-copies the same correct ₹20. The findFirst mock
 * below filters the in-memory cards by the real where clause, so these tests fail if the
 * printingType filter is ever dropped again.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    style_costing: { findUnique: jest.fn() },
    processor_rate_card: { findFirst: jest.fn() },
  },
}));

jest.mock('../../services/processor-rate-v2.service', () => ({ lookupRate: jest.fn() }));

import prisma from '../../config/database';
import { validateCostSheetRates } from '../../services/processor-rate-validation.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const PROCESSOR_ID = 'proc-bhavya';
const GREIGE_ID = 'greige-0053';
const SLAB_ID = 'slab-1';

type Card = {
  id: string;
  processorId: string;
  processingType: string;
  printingType: string | null;
  greigeId: string | null;
  laceId: string | null;
  slabId: string;
  ratePerMeter: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  shrinkagePercent: number | null;
};

const card = (overrides: Partial<Card>): Card => ({
  id: 'card',
  processorId: PROCESSOR_ID,
  processingType: 'PRINTING',
  printingType: 'PIGMENT',
  greigeId: GREIGE_ID,
  laceId: null,
  slabId: SLAB_ID,
  ratePerMeter: 20,
  effectiveFrom: new Date('2026-08-20'),
  effectiveTo: null,
  isActive: true,
  shrinkagePercent: 10,
  ...overrides,
});

let cards: Card[] = [];

/** findFirst over `cards`, honouring every where key the lookup sends (undefined = no filter). */
function findFirstByWhere({ where }: { where: Record<string, unknown> }) {
  const hits = cards.filter((c) =>
    Object.entries(where).every(([k, v]) => v === undefined || (c as Record<string, unknown>)[k] === v)
  );
  hits.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return Promise.resolve(hits[0] ?? null);
}

/** A cost sheet with one GREIGE_PROCESSED fabric line priced off `rateCard`. */
function sheetWithFabricLine(processingCost: number, rateCard: Card) {
  return {
    id: 'cs-1',
    fabricItems: [
      {
        id: 'fi-1',
        fabricName: 'Viscose Staple',
        processorId: PROCESSOR_ID,
        greigeId: GREIGE_ID,
        processingCost,
        processor: { id: PROCESSOR_ID, name: 'Shree Bhavya' },
        greige: { id: GREIGE_ID, greigeName: 'GRG-0053' },
        rateCard: {
          id: rateCard.id,
          effectiveFrom: rateCard.effectiveFrom,
          slabId: rateCard.slabId,
          processingType: rateCard.processingType,
          printingType: rateCard.printingType,
        },
      },
    ],
    laceItems: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  db.processor_rate_card.findFirst.mockImplementation(findFirstByWhere);
});

describe('validateCostSheetRates — printing type', () => {
  it('a Pigment line is CURRENT even when a newer Procian card shares its slab', async () => {
    const pigment = card({ id: 'pigment', printingType: 'PIGMENT', ratePerMeter: 20 });
    const procian = card({
      id: 'procian',
      printingType: 'PROCIAN',
      ratePerMeter: 28,
      effectiveFrom: new Date('2026-09-10'),
    });
    cards = [pigment, procian];
    db.style_costing.findUnique.mockResolvedValue(sheetWithFabricLine(20, pigment));

    const result = await validateCostSheetRates('cs-1');

    expect(result.status).toBe('CURRENT');
    expect(result.requiresNewCostSheet).toBe(false);
    expect(result.blockingItems).toEqual([]);
    expect(db.processor_rate_card.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ printingType: 'PIGMENT' }) })
    );
  });

  it('a real Pigment rise (₹20 → ₹22) still blocks', async () => {
    const oldPigment = card({ id: 'pigment-old', ratePerMeter: 20 });
    const newPigment = card({ id: 'pigment-new', ratePerMeter: 22, effectiveFrom: new Date('2026-09-15') });
    cards = [card({ ...oldPigment, effectiveTo: new Date('2026-09-15') }), newPigment];
    db.style_costing.findUnique.mockResolvedValue(sheetWithFabricLine(20, oldPigment));

    const result = await validateCostSheetRates('cs-1');

    expect(result.status).toBe('OUTDATED');
    expect(result.suggestedAction).toBe('CREATE_NEW_VERSION');
    expect(result.blockingItems).toHaveLength(1);
    expect(result.blockingItems[0]).toMatchObject({ costSheetRate: 20, currentRate: 22, rateCardIdNew: 'pigment-new' });
  });

  it('a dyeing line looks up cards with printingType null, never a printing card', async () => {
    const dyeing = card({ id: 'dyeing', processingType: 'DYEING', printingType: null, ratePerMeter: 15 });
    cards = [dyeing];
    db.style_costing.findUnique.mockResolvedValue(sheetWithFabricLine(15, dyeing));

    const result = await validateCostSheetRates('cs-1');

    expect(result.status).toBe('CURRENT');
    expect(db.processor_rate_card.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ processingType: 'DYEING', printingType: null }) })
    );
  });
});
