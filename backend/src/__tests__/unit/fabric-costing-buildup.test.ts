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
const baseDb = {
  processor_rate_card: { findUnique: async () => ({ processingType: 'PRINTING', printingType: 'PIGMENT' }) },
  suppliers: { findUnique: async () => ({ name: 'Test Printers' }) },
  greige_master: { findUnique: async () => ({ greigeCode: 'GRG-T2' }) },
  // Not on a style fabric → never batched
  fabric_width_cad: { findUnique: async () => null, findMany: async () => [] },
};
const db = baseDb as never;

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

/**
 * ESSKY084LS (29-Sep): the 48″ and 52″ Shirt parts are GRG-0038 dyed by one processor in one colour, so Fabric
 * Costing priced them on their combined metres. Correcting the 52″ row to 0.3335 was refused "no rate at 767 m"
 * because the stored costedRateIsBatch was false; the batch is 0.8133 × 2300 + 0.3335 × 2300 m.
 */
describe('recostCadRow — a part processed with the style’s other parts is priced on the whole batch', () => {
  const PCS = 2300;
  const t0 = new Date('2026-08-01T00:00:00Z');
  const cadRow = (over: Record<string, unknown>) => ({
    styleFabricId: 'sf-1',
    cutableWidth: 52,
    createdAt: t0,
    greigeId: 'g-1',
    processorId: 'p-1',
    cadAverage: 0.4,
    cadMeters: 1.95,
    layerMarginMeters: 0.05,
    orderQuantityPcs: PCS,
    processingPricePerMeter: 10,
    rateCardId: 'card-1',
    clonedFromCadId: null,
    clonedFromOrderId: null,
    sizeBreakdowns: [],
    styleFabric: { colorMasterId: 'col-1', style_components: { componentName: 'Shirt' } },
    ...over,
  });
  const batchDb = (rows: ReturnType<typeof cadRow>[]) =>
    ({
      ...baseDb,
      processor_rate_card: { findUnique: async () => ({ processingType: 'DYEING', printingType: null }) },
      suppliers: { findUnique: async () => ({ name: 'Aryan Dyeing' }) },
      greige_master: { findUnique: async () => ({ greigeCode: 'GRG-0038' }) },
      fabric_width_cad: {
        findUnique: async () => ({
          purpose: 'RAW_MATERIAL_CALCULATION',
          styleFabric: { style_components: { styleId: 's-1' } },
        }),
        findMany: async () => rows,
      },
    }) as never;
  const row52: CostedCadRow = {
    ...baseRow,
    id: 'cad-52',
    cadAverage: 0.4,
    orderQuantityPcs: PCS,
    processingPricePerMeter: 10,
    shrinkagePercent: 0,
    screenCostPerMeter: null,
    greigeCostPerMeter: 40,
    transportCostPerMeter: 2,
    totalCostPerMeter: 52,
    costedAtQuantityMeters: null,
    costedRateIsBatch: false,
  };
  const siblings = [
    cadRow({ id: 'cad-52' }),
    cadRow({ id: 'cad-48', cutableWidth: 48, cadAverage: 0.8133, cadMeters: 4.83 }),
  ];
  const card = (rate: number) =>
    ({
      id: 'card-1',
      ratePerMeter: rate,
      shrinkagePercent: null,
      slabLabel: '1000-1500m',
      minQuantity: 1000,
      maxQuantity: 1500,
    }) as never;

  it('looks the rate up on the combined metres even when the stored flags say "not a batch"', async () => {
    mockedLookup.mockResolvedValue(card(10));
    const result = await recostCadRow(batchDb(siblings), row52, { cadAverage: 0.3335, greigeId: 'g-1' }, 'u-1');
    const metres = 0.8133 * PCS + 0.3335 * PCS;
    expect(mockedLookup).toHaveBeenCalledWith(expect.objectContaining({ quantityMeters: metres }));
    expect(result.slabMetres).toBeCloseTo(metres, 6);
    expect(result.batch?.members.map((m) => m.label).sort()).toEqual(['Shirt 48″', 'Shirt 52″']);
    expect(result.costing.costedRateIsBatch).toBe(true);
    expect(result.costing.costedAtQuantityMeters).toBeCloseTo(metres, 6);
    expect(result.priceChanged).toBe(false); // ₹10 before and after
    expect(result.notes).toEqual([]);
  });

  it('refuses naming the batch metres and each part', async () => {
    mockedLookup.mockResolvedValue(null);
    await expect(
      recostCadRow(batchDb(siblings), row52, { cadAverage: 0.3335, greigeId: 'g-1' }, 'u-1')
    ).rejects.toThrow(
      'Aryan Dyeing has no DYEING rate for GRG-0038 at 2638 m (this row 767 m + Shirt 48″ 1871 m, processed together)'
    );
  });

  it('counts neither a superseded quantity-change clone nor an older row of the same fabric and width', async () => {
    mockedLookup.mockResolvedValue(card(10));
    const rows = [
      ...siblings,
      // the 48″ row's older copy at the same width: only the newest of a slot counts
      cadRow({ id: 'cad-48-old', cutableWidth: 48, cadAverage: 0.9, createdAt: new Date('2026-07-01T00:00:00Z') }),
      // a superseded ancestor (another width, so only the clone rule can drop it): a later row of the same
      // fabric names it as clonedFromCadId
      cadRow({ id: 'cad-anc', styleFabricId: 'sf-2', cutableWidth: 58, cadAverage: 5 }),
      cadRow({
        id: 'cad-tip',
        styleFabricId: 'sf-2',
        cutableWidth: 60,
        cadAverage: 0.1,
        clonedFromCadId: 'cad-anc',
        createdAt: new Date('2026-08-02T00:00:00Z'),
      }),
    ];
    const result = await recostCadRow(batchDb(rows), row52, { cadAverage: 0.3335, greigeId: 'g-1' }, 'u-1');
    expect(result.batch?.members.map((m) => m.id).sort()).toEqual(['cad-48', 'cad-52', 'cad-tip']);
  });

  it('leaves out parts of another greige, processor or colour — a greige change joins the new greige’s batch', async () => {
    mockedLookup.mockResolvedValue(card(10));
    mockedLive.mockResolvedValue(new Map([['g-2', { rate: 40 }]]) as never);
    const rows = [
      ...siblings,
      cadRow({ id: 'x-greige', styleFabricId: 'sf-3', greigeId: 'g-2', cadAverage: 1 }),
      cadRow({ id: 'x-proc', styleFabricId: 'sf-4', processorId: 'p-2', cadAverage: 1 }),
      cadRow({
        id: 'x-col',
        styleFabricId: 'sf-5',
        styleFabric: { colorMasterId: 'col-2', style_components: { componentName: 'Pant' } },
      }),
    ];
    const same = await recostCadRow(batchDb(rows), row52, { cadAverage: 0.3335, greigeId: 'g-1' }, 'u-1');
    expect(same.batch?.members.map((m) => m.id).sort()).toEqual(['cad-48', 'cad-52']);

    const moved = await recostCadRow(batchDb(rows), row52, { cadAverage: 0.3335, greigeId: 'g-2' }, 'u-1');
    expect(moved.batch?.members.map((m) => m.id).sort()).toEqual(['cad-52', 'x-greige']);
  });

  it('prices a lone part on its own metres', async () => {
    mockedLookup.mockResolvedValue(card(10));
    const result = await recostCadRow(
      batchDb([cadRow({ id: 'cad-52' })]),
      row52,
      { cadAverage: 0.3335, greigeId: 'g-1' },
      'u-1'
    );
    expect(result.batch).toBeNull();
    expect(result.slabMetres).toBeCloseTo(0.3335 * PCS, 6);
    expect(result.costing.costedRateIsBatch).toBe(false);
  });

  it('keeps the other parts’ price and says when the batch now prices differently', async () => {
    mockedLookup.mockResolvedValue(card(12));
    const result = await recostCadRow(batchDb(siblings), row52, { cadAverage: 0.3335, greigeId: 'g-1' }, 'u-1');
    expect(result.costing.processingPricePerMeter).toBe(12);
    expect(result.notes).toEqual([
      'Shirt 48″ is priced at ₹10/m; the 2638 m batch now prices at ₹12/m — re-cost it in Fabric Costing.',
    ]);
  });
});
