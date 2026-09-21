/**
 * explainMissingRate — why a processor rate lookup found nothing (mocked prisma, no DB).
 *
 * lookupRate returns a bare null from five different places. That reached the Fabric Costing
 * page as "No rate found for this combination", which left the operator with no way to tell
 * which of processor / greige / printing type / quantity was the one not set up — the row
 * simply refused to cost. These tests pin each verdict, and in particular pin NO_SLAB_RATE,
 * the case the previous ad-hoc diagnostic could not express at all: when greige and printing
 * type both matched it produced "Rate for the given criteria." and then trailed off.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    suppliers: { findFirst: jest.fn(), findUnique: jest.fn() },
    greige_master: { findUnique: jest.fn() },
    processor_quantity_slabs: { findFirst: jest.fn() },
    processor_rate_card: { findMany: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebug: jest.fn(),
}));

import prisma from '../../config/database';
import { explainMissingRate } from '../../services/processor-rate-v2.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const PROCESSOR_ID = 'proc-aryan';
const GREIGE_ID = 'greige-0035';

const SLAB = {
  id: 'slab-2',
  slabLabel: '1000-1500m',
  minQuantity: 1000,
  maxQuantity: 1500,
};

/** A rate-card row as the diagnosis selects it. */
const card = (overrides: Record<string, unknown> = {}) => ({
  greigeId: GREIGE_ID,
  printingType: null,
  slabId: SLAB.id,
  greige: { greigeName: 'Cotton 60x60' },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  db.suppliers.findUnique.mockResolvedValue({ name: 'Aryan Dyeing' });
  db.greige_master.findUnique.mockResolvedValue({ greigeName: 'Cotton 60x60' });
  db.processor_quantity_slabs.findFirst.mockResolvedValue(SLAB);
  db.processor_rate_card.findMany.mockResolvedValue([card()]);
});

const query = (overrides: Record<string, unknown> = {}) =>
  ({
    processorId: PROCESSOR_ID,
    processingType: 'DYEING',
    greigeId: GREIGE_ID,
    quantityMeters: 1200,
    ...overrides,
  }) as Parameters<typeof explainMissingRate>[0];

describe('explainMissingRate', () => {
  it('NO_SLABS when the processor has no quantity slabs — nothing can resolve without them', async () => {
    db.processor_quantity_slabs.findFirst.mockResolvedValue(null);

    const result = await explainMissingRate(query());

    expect(result.code).toBe('NO_SLABS');
    expect(result.message).toContain('Aryan Dyeing');
    expect(result.message).toContain('quantity slabs');
    // Checked BEFORE the rate cards: slabs are the precondition, so don't even ask
    expect(db.processor_rate_card.findMany).not.toHaveBeenCalled();
  });

  it('NO_RATES_AT_ALL when the processor holds no cards for this processing type', async () => {
    db.processor_rate_card.findMany.mockResolvedValue([]);

    const result = await explainMissingRate(query());

    expect(result.code).toBe('NO_RATES_AT_ALL');
    expect(result.message).toContain('no dyeing rates at all');
    expect(result.slabLabel).toBe('1000-1500m');
  });

  it('NO_GREIGE_RATE names the greige asked for AND the ones that are rated', async () => {
    db.processor_rate_card.findMany.mockResolvedValue([
      card({ greigeId: 'other-1', greige: { greigeName: 'Rayon 30s' } }),
      card({ greigeId: 'other-2', greige: { greigeName: 'Poplin 40s' } }),
    ]);

    const result = await explainMissingRate(query());

    expect(result.code).toBe('NO_GREIGE_RATE');
    expect(result.message).toContain('Cotton 60x60'); // what was asked for
    expect(result.message).toContain('Rayon 30s'); // what it does have
    expect(result.availableGreiges).toEqual(['Rayon 30s', 'Poplin 40s']);
  });

  it('NO_PRINTING_TYPE_RATE when the greige is rated but not for the print type asked for', async () => {
    db.processor_rate_card.findMany.mockResolvedValue([card({ printingType: 'DISCHARGE' })]);

    const result = await explainMissingRate(query({ processingType: 'PRINTING', printingType: 'PIGMENT' }));

    expect(result.code).toBe('NO_PRINTING_TYPE_RATE');
    expect(result.message).toContain('PIGMENT');
    expect(result.message).toContain('DISCHARGE'); // the one it DOES rate
    expect(result.availablePrintingTypes).toEqual(['DISCHARGE']);
  });

  it('NO_SLAB_RATE — rated for this greige, just not at this quantity (the case the old code could not express)', async () => {
    // A card exists for the greige, but on a different slab than the one 1200m fell into
    db.processor_rate_card.findMany.mockResolvedValue([card({ slabId: 'slab-1' })]);

    const result = await explainMissingRate(query());

    expect(result.code).toBe('NO_SLAB_RATE');
    expect(result.message).toContain('1000-1500m'); // the band
    expect(result.message).toContain('1,200 m'); // the quantity that fell into it
    expect(result.slabLabel).toBe('1000-1500m');
  });

  it('a printing query whose greige AND print type both match falls through to NO_SLAB_RATE', async () => {
    db.processor_rate_card.findMany.mockResolvedValue([card({ printingType: 'PIGMENT', slabId: 'slab-1' })]);

    const result = await explainMissingRate(query({ processingType: 'PRINTING', printingType: 'PIGMENT' }));

    expect(result.code).toBe('NO_SLAB_RATE');
  });

  it('falls back to SYSTEM_DEFAULT like lookupRate does, so it diagnoses the processor actually used', async () => {
    db.suppliers.findFirst.mockResolvedValue({ id: 'sys-default' });
    db.suppliers.findUnique.mockResolvedValue({ name: 'System Defaults' });
    db.processor_rate_card.findMany.mockResolvedValue([]);

    const result = await explainMissingRate(query({ processorId: undefined }));

    expect(db.suppliers.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { code: 'SYSTEM_DEFAULT' } }));
    expect(result.processorId).toBe('sys-default');
    expect(result.message).toContain('system default rate card');
  });

  it('no processor and no SYSTEM_DEFAULT configured: says so instead of naming a null processor', async () => {
    db.suppliers.findFirst.mockResolvedValue(null);

    const result = await explainMissingRate(query({ processorId: undefined }));

    expect(result.code).toBe('NO_RATES_AT_ALL');
    expect(result.processorId).toBeNull();
    expect(result.message).toContain('No system default rates are configured');
  });

  it('carries the context the page needs to deep-link the Rate Card page', async () => {
    db.processor_rate_card.findMany.mockResolvedValue([]);

    const result = await explainMissingRate(query({ processingType: 'PRINTING', printingType: 'PIGMENT' }));

    expect(result.processorId).toBe(PROCESSOR_ID);
    expect(result.processorName).toBe('Aryan Dyeing');
    expect(result.processingType).toBe('PRINTING');
    expect(result.printingType).toBe('PIGMENT');
    expect(result.greigeId).toBe(GREIGE_ID);
    expect(result.greigeName).toBe('Cotton 60x60');
    expect(result.quantityMeters).toBe(1200);
  });

  it('an unnamed slab still reads as a range rather than "null"', async () => {
    db.processor_quantity_slabs.findFirst.mockResolvedValue({ ...SLAB, slabLabel: null });
    db.processor_rate_card.findMany.mockResolvedValue([card({ slabId: 'slab-1' })]);

    const result = await explainMissingRate(query());

    expect(result.slabLabel).toBe('1000-1500m');
    expect(result.message).not.toContain('null');
  });
});
