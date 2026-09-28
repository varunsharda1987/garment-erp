/**
 * gstService.resolveGSTRate — a line's GST rate AND the HSN it is billed under (mocked prisma, no DB).
 *
 * PO form bug hunt #2 (2026-09-28): every PO line saved hsnCode = null (13/13) because the HSN returned
 * was the one SENT, though the rate had been looked up from the material's HSN; a 0% rate — typed or on
 * the material — counted as "no rate" and became 5%; and the HSN master's chapter step never matched
 * a 4-digit heading (the `chapter` column is 2 digits) and took an arbitrary row of a mixed chapter.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    materials: { findUnique: jest.fn() },
    hsn_sac_masters: { findMany: jest.fn() },
    tax_masters: { findFirst: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebug: jest.fn(),
}));

jest.mock('../../services/company-profile.service', () => ({
  companyProfileService: { getDefault: jest.fn() },
}));

import prisma from '../../config/database';
import { gstService } from '../../services/gst.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** A slice of the HSN master as it is on the live DB: 2-digit chapters, 4- and 8-digit codes */
const MASTER = [
  { code: '52091100', chapter: '52', defaultGstRate: 5, isActive: true },
  { code: '5208', chapter: '52', defaultGstRate: 5, isActive: true },
  { code: '9606', chapter: '96', defaultGstRate: 18, isActive: true },
  { code: '9607', chapter: '96', defaultGstRate: 18, isActive: true },
  // Chapter 99 mixes rates — no chapter guess may be made from it
  { code: '998821', chapter: '99', defaultGstRate: 5, isActive: true },
  { code: '996511', chapter: '99', defaultGstRate: 18, isActive: true },
];

beforeEach(() => {
  jest.clearAllMocks();
  db.hsn_sac_masters.findMany.mockResolvedValue(MASTER);
  db.tax_masters.findFirst.mockResolvedValue(null);
  db.materials.findUnique.mockResolvedValue(null);
});

describe('resolveGSTRate', () => {
  it('a typed rate is the line rate — 0 included — and the HSN is still the material’s', async () => {
    db.materials.findUnique.mockResolvedValue({ gstRate: null, hsnCode: '96062100' });
    await expect(gstService.resolveGSTRate({ materialId: 'm1', gstRateOverride: 0 })).resolves.toEqual({
      gstRate: 0,
      hsnCode: '96062100',
    });
    await expect(gstService.resolveGSTRate({ materialId: 'm1', gstRateOverride: 18 })).resolves.toEqual({
      gstRate: 18,
      hsnCode: '96062100',
    });
  });

  it('a typed HSN wins over the material’s, and a typed rate with it needs no lookup', async () => {
    await expect(
      gstService.resolveGSTRate({ materialId: 'm1', hsnSacCode: '5208', gstRateOverride: 12 })
    ).resolves.toEqual({ gstRate: 12, hsnCode: '5208' });
    expect(db.materials.findUnique).not.toHaveBeenCalled();
  });

  it('a 0% material is 0%, not the 5% fallback', async () => {
    db.materials.findUnique.mockResolvedValue({ gstRate: 0, hsnCode: null });
    await expect(gstService.resolveGSTRate({ materialId: 'm1' })).resolves.toEqual({ gstRate: 0, hsnCode: null });
  });

  it('returns the material’s HSN with the rate it resolved from (exact code)', async () => {
    db.materials.findUnique.mockResolvedValue({ gstRate: null, hsnCode: '52091100' });
    await expect(gstService.resolveGSTRate({ materialId: 'm1' })).resolves.toEqual({
      gstRate: 5,
      hsnCode: '52091100',
    });
  });

  it('falls back to the 4-digit heading as a code (520811 → 5208)', async () => {
    db.materials.findUnique.mockResolvedValue({ gstRate: null, hsnCode: '520811' });
    await expect(gstService.resolveGSTRate({ materialId: 'm1' })).resolves.toEqual({
      gstRate: 5,
      hsnCode: '520811',
    });
  });

  it('guesses from the chapter only when every code of it has one rate', async () => {
    // 96 is all 18%
    db.materials.findUnique.mockResolvedValue({ gstRate: null, hsnCode: '96050000' });
    await expect(gstService.resolveGSTRate({ materialId: 'm1' })).resolves.toEqual({
      gstRate: 18,
      hsnCode: '96050000',
    });
    // 99 mixes 5% and 18% — no guess; tax_masters is empty, so the 5% fallback, HSN kept
    db.materials.findUnique.mockResolvedValue({ gstRate: null, hsnCode: '998899' });
    await expect(gstService.resolveGSTRate({ materialId: 'm1' })).resolves.toEqual({
      gstRate: 5,
      hsnCode: '998899',
    });
    db.tax_masters.findFirst.mockResolvedValue({ taxRate: 12 });
    await expect(gstService.resolveGSTRate({ materialId: 'm1' })).resolves.toEqual({
      gstRate: 12,
      hsnCode: '998899',
    });
  });

  it('getGSTRate keeps its old shape for its other callers', async () => {
    db.materials.findUnique.mockResolvedValue({ gstRate: null, hsnCode: '9606' });
    await expect(gstService.getGSTRate({ materialId: 'm1' })).resolves.toBe(18);
  });
});

describe('calculateLineItemGST', () => {
  it('saves the resolved HSN on the line (it returned the input, null for every PO line)', async () => {
    db.materials.findUnique.mockResolvedValue({ gstRate: null, hsnCode: '96062100' });
    const gst = await gstService.calculateLineItemGST({
      lineTotal: 1000,
      hsnSacCode: null,
      materialId: 'm1',
      isInterstate: false,
      unitPrice: 10,
    });
    expect(gst).toMatchObject({ hsnCode: '96062100', gstRate: 18, cgstAmount: 90, sgstAmount: 90, taxAmount: 180 });
  });

  it('taxes a typed 0% line at nothing', async () => {
    const gst = await gstService.calculateLineItemGST({
      lineTotal: 1000,
      hsnSacCode: '5208',
      gstRateOverride: 0,
      isInterstate: true,
    });
    expect(gst).toMatchObject({ hsnCode: '5208', gstRate: 0, igstAmount: 0, taxAmount: 0 });
  });
});

describe('hsnMasterRates', () => {
  it('answers a whole page of codes in one query', async () => {
    const rates = await gstService.hsnMasterRates(['52091100', '520811', '96062100', '998899', '52091100', '']);
    expect(db.hsn_sac_masters.findMany).toHaveBeenCalledTimes(1);
    expect(Object.fromEntries(rates)).toEqual({ '52091100': 5, '520811': 5, '96062100': 18 });
  });

  it('asks nothing for no codes', async () => {
    await expect(gstService.hsnMasterRates([])).resolves.toEqual(new Map());
    expect(db.hsn_sac_masters.findMany).not.toHaveBeenCalled();
  });
});
