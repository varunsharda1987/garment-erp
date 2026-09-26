/**
 * recostCadRow must price a corrected CAD exactly as the Fabric Costing page would (2026-09-26).
 *
 * A CAD correction re-costs the row server-side (cad-correction.service → recostCadRow) and the admin approves
 * that price; if it drifted from the page's build-up the team would see one ₹/m on the correction and another
 * the next time the row is opened in Fabric Costing. `pageTotal` below is a documented copy of
 * FabricCostingPage.tsx calculateRowTotals (build-up mode): greige + transport/m + shrinkage uplift
 * (divideByShrinkage(greige, s) − greige) + processing + screen total ÷ the ROW's metres (cadAverage × pcs).
 */

jest.mock('../../config/database', () => ({ __esModule: true, default: {} }));
jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
  logDebug: jest.fn(),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../services/processor-rate-v2.service', () => ({ lookupRate: jest.fn() }));
jest.mock('../../services/helpers/greige-live-rate.helper', () => ({
  resolveLiveGreigeRates: jest.fn(),
  greigeRateProvenance: () => ({ greigeRateSource: 'PURCHASE_ORDER', greigeRateSourceRef: 'PO-TEST' }),
}));

import { recostCadRow, type CostedCadRow } from '../../services/helpers/fabric-costing-buildup.helper';
import { lookupRate } from '../../services/processor-rate-v2.service';
import { resolveLiveGreigeRates } from '../../services/helpers/greige-live-rate.helper';
import { divideByShrinkage, toNumber } from '../../utils/currency';

const mockedLookup = lookupRate as jest.MockedFunction<typeof lookupRate>;
const mockedLive = resolveLiveGreigeRates as jest.MockedFunction<typeof resolveLiveGreigeRates>;

/** FabricCostingPage.tsx calculateRowTotals, build-up mode (per-metre transport, as saved rows load) */
function pageTotal(row: {
  greige: number;
  transportPerMeter: number;
  shrinkagePct: number;
  processing: number;
  screenTotal: number;
  cadAverage: number;
  pcs: number;
}): number {
  const totalQuantity = row.cadAverage * row.pcs;
  // the page calls its divideByShrinkage twin (frontend/src/utils/math.ts): same rule, 0 / ≥100 % = unchanged
  const adjusted = toNumber(divideByShrinkage(row.greige, row.shrinkagePct));
  const shrinkageValue = adjusted - row.greige;
  const screenPerMeter = totalQuantity > 0 ? row.screenTotal / totalQuantity : 0;
  return row.greige + row.transportPerMeter + shrinkageValue + row.processing + screenPerMeter;
}

// Plain functions, not jest.fn: the jest config resets mock implementations before every test
const db = {
  processor_rate_card: { findUnique: async () => ({ processingType: 'PRINTING', printingType: 'PIGMENT' }) },
  suppliers: { findUnique: async () => ({ name: 'Test Printers' }) },
  greige_master: { findUnique: async () => ({ greigeCode: 'GRG-T2' }) },
} as never;

const OLD = { avg: 0.7033, pcs: 2760, screenPerMeter: 1.25 };
const baseRow: CostedCadRow = {
  id: 'cad-1',
  cadAverage: OLD.avg,
  greigeId: 'g-1',
  processorId: 'p-1',
  rateCardId: 'card-1',
  costInputMode: 'BUILD_UP',
  orderQuantityPcs: OLD.pcs,
  greigeCostPerMeter: 43,
  transportCostPerMeter: 2,
  processingPricePerMeter: 22,
  shrinkagePercent: 8,
  screenCostPerMeter: OLD.screenPerMeter,
  totalCostPerMeter: 70,
  costedAtQuantityMeters: OLD.avg * OLD.pcs,
  costedRateIsBatch: false,
  processingBatchGroupColorId: null,
};
const screenTotal = OLD.screenPerMeter * OLD.avg * OLD.pcs;

describe('recostCadRow — same ₹/m as the Fabric Costing page', () => {
  it('re-looks-up the processing rate at the corrected metres and re-spreads the screens', async () => {
    mockedLookup.mockResolvedValue({
      id: 'card-2',
      ratePerMeter: 20,
      shrinkagePercent: 9,
      slabLabel: '1500-3000m',
      minQuantity: 1500,
      maxQuantity: 3000,
    } as never);
    const newAvg = 0.844;
    const result = await recostCadRow(db, baseRow, { cadAverage: newAvg, greigeId: 'g-1' }, 'u-1');

    expect(mockedLookup).toHaveBeenCalledWith(
      expect.objectContaining({ processorId: 'p-1', greigeId: 'g-1', quantityMeters: newAvg * OLD.pcs })
    );
    const expected = pageTotal({
      greige: 43,
      transportPerMeter: 2,
      shrinkagePct: 9,
      processing: 20,
      screenTotal,
      cadAverage: newAvg,
      pcs: OLD.pcs,
    });
    expect(result.costing.totalCostPerMeter).toBeCloseTo(expected, 2);
    expect(result.costing.rateCardId).toBe('card-2');
    expect(result.slabLabel).toBe('1500-3000m');
    expect(result.priceChanged).toBe(true);
  });

  it('a greige change takes the new greige’s live rate', async () => {
    mockedLookup.mockResolvedValue({
      id: 'card-3',
      ratePerMeter: 22,
      shrinkagePercent: 8,
      slabLabel: '1500-3000m',
      minQuantity: 1500,
      maxQuantity: 3000,
    } as never);
    mockedLive.mockResolvedValue(new Map([['g-2', { rate: 51 }]]) as never);
    const result = await recostCadRow(db, baseRow, { cadAverage: OLD.avg, greigeId: 'g-2' }, 'u-1');
    const expected = pageTotal({
      greige: 51,
      transportPerMeter: 2,
      shrinkagePct: 8,
      processing: 22,
      screenTotal,
      cadAverage: OLD.avg,
      pcs: OLD.pcs,
    });
    expect(result.costing.greigeCostPerMeter).toBe(51);
    expect(result.costing.totalCostPerMeter).toBeCloseTo(expected, 2);
    expect(result.costing.greigeProvenance).not.toBeNull();
  });

  it('refuses when the processor has no rate at the corrected metres, naming processor and greige', async () => {
    mockedLookup.mockResolvedValue(null);
    await expect(recostCadRow(db, baseRow, { cadAverage: 1.2, greigeId: 'g-1' }, 'u-1')).rejects.toThrow(
      /Test Printers has no PIGMENT rate for GRG-T2 at 3312 m/
    );
  });

  it('keeps a typed landed price on an average change, and refuses a greige change', async () => {
    const landed = { ...baseRow, costInputMode: 'LANDED_PRICE', totalCostPerMeter: 88 };
    const same = await recostCadRow(db, landed, { cadAverage: 0.9, greigeId: 'g-1' }, 'u-1');
    expect(same.costing.totalCostPerMeter).toBe(88);
    expect(same.priceChanged).toBe(false);
    expect(mockedLookup).not.toHaveBeenCalled();
    await expect(recostCadRow(db, landed, { cadAverage: 0.9, greigeId: 'g-2' }, 'u-1')).rejects.toThrow(/landed price/);
  });

  it('leaves a row that was never costed alone', async () => {
    const uncosted = { ...baseRow, totalCostPerMeter: null };
    const result = await recostCadRow(db, uncosted, { cadAverage: 0.9, greigeId: 'g-2' }, 'u-1');
    expect(result.costing.totalCostPerMeter).toBeNull();
    expect(result.priceChanged).toBe(false);
  });
});
