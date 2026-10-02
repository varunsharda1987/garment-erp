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
import { lookupRate } from '../../services/processor-rate-v2.service';
import { validateCostSheetRates, validateQuantitySlabs } from '../../services/processor-rate-validation.service';

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

  it('a line with no rate card is not checked against the DYEING card — its process is unknown', async () => {
    cards = [card({ id: 'dyeing', processingType: 'DYEING', printingType: null, ratePerMeter: 10 })];
    const sheet = sheetWithFabricLine(20, card({}));
    (sheet.fabricItems[0] as { rateCard: unknown }).rateCard = null;
    db.style_costing.findUnique.mockResolvedValue(sheet);

    const result = await validateCostSheetRates('cs-1');

    expect(result.status).toBe('CURRENT');
    expect(db.processor_rate_card.findFirst).not.toHaveBeenCalled();
  });
});

/**
 * validateQuantitySlabs batch basis (LNG186, 02-Oct-2026): a Dyed and a Procian line on the same greige,
 * processor and batch colour are DIFFERENT processes — each is re-checked on its OWN metres, never on the
 * two added together.
 */
describe('validateQuantitySlabs — a batch is one process and print type', () => {
  const line = (
    id: string,
    effectiveCad: number,
    rateCard: { processingType: string; printingType: string | null }
  ) => ({
    id,
    fabricName: id,
    processorId: PROCESSOR_ID,
    greigeId: GREIGE_ID,
    effectiveCad,
    processingCost: 10,
    processor: { id: PROCESSOR_ID, name: 'Manish Textiles' },
    greige: { id: GREIGE_ID, greigeName: 'GRG-0009' },
    rateCard: { id: `card-${id}`, slabId: SLAB_ID, slab: { slabLabel: '0-500m' }, ...rateCard },
    fabricCAD: { processingBatchGroupColorId: 'purple', costedAtQuantityMeters: null, costedRateIsBatch: true },
  });

  it('a Dyed line and a Procian line in one batch colour are each looked up on their own metres', async () => {
    db.style_costing.findUnique.mockResolvedValue({
      id: 'cs-1',
      fabricItems: [
        line('printed', 2.6767, { processingType: 'PRINTING', printingType: 'PROCIAN' }),
        line('dyed', 0.18, { processingType: 'DYEING', printingType: null }),
      ],
    });
    (lookupRate as jest.Mock).mockResolvedValue({ id: 'x', slabId: SLAB_ID, slabLabel: '0-500m', ratePerMeter: 10 });

    await validateQuantitySlabs('cs-1', 200);

    const calls = (lookupRate as jest.Mock).mock.calls.map(([q]) => [q.processingType, q.quantityMeters]);
    expect(calls).toEqual([
      ['PRINTING', expect.closeTo(535.34, 2)],
      ['DYEING', expect.closeTo(36, 2)],
    ]);
  });

  it('two Procian lines in one batch colour are still priced on their combined metres', async () => {
    db.style_costing.findUnique.mockResolvedValue({
      id: 'cs-1',
      fabricItems: [
        line('top', 2, { processingType: 'PRINTING', printingType: 'PROCIAN' }),
        line('bottom', 1, { processingType: 'PRINTING', printingType: 'PROCIAN' }),
      ],
    });
    (lookupRate as jest.Mock).mockResolvedValue({ id: 'x', slabId: SLAB_ID, slabLabel: '0-500m', ratePerMeter: 10 });

    await validateQuantitySlabs('cs-1', 100);

    const meters = (lookupRate as jest.Mock).mock.calls.map(([q]) => q.quantityMeters);
    expect(meters).toEqual([300, 300]);
  });
});
