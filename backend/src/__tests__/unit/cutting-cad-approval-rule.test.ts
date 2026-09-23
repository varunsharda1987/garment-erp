/**
 * Which CAD row may supply the average a fabric is cut to.
 *
 * Until 2026-09-23 a pending or REJECTED Production CAD supplied it — on the screen chart, on the
 * printed chart (where a rejected Production row even beat an approved raw-material marker) and at
 * the push-to-cutting gate. ESSKY085LS read "ready to cut" on a Production CAD its author had
 * rejected 40 s after making it. Owner decision: cutting needs an approved Production CAD.
 */

import { countsForPurposeAverage } from '../../services/helpers/cad-status.helper';
import { pickCad } from '../../services/document-data/cutting-chart.doc-data';

describe('countsForPurposeAverage', () => {
  it('a Production CAD counts only once approved', () => {
    expect(countsForPurposeAverage('PRODUCTION', 'APPROVED')).toBe(true);
    expect(countsForPurposeAverage('PRODUCTION', 'PENDING')).toBe(false);
    expect(countsForPurposeAverage('PRODUCTION', null)).toBe(false);
    expect(countsForPurposeAverage('PRODUCTION', 'REJECTED')).toBe(false);
  });

  it('planning markers count while pending, never once rejected', () => {
    expect(countsForPurposeAverage('RAW_MATERIAL_CALCULATION', 'PENDING')).toBe(true);
    expect(countsForPurposeAverage('COSTING', null)).toBe(true);
    expect(countsForPurposeAverage('RAW_MATERIAL_CALCULATION', 'REJECTED')).toBe(false);
  });
});

describe('printed cutting chart pickCad', () => {
  const row = (purpose: string, approvalStatus: string | null, cadAverage = 0.7333) =>
    ({
      purpose,
      purposeEnum: purpose,
      approvalStatus,
      cadAverage,
      cadMeters: 4.35,
      cutableWidth: 52,
      isPreferred: false,
    }) as unknown as Parameters<typeof pickCad>[0][number];

  it('prefers an approved Production CAD over the planning marker', () => {
    const production = row('PRODUCTION', 'APPROVED');
    expect(pickCad([row('RAW_MATERIAL_CALCULATION', 'APPROVED'), production])).toBe(production);
  });

  it('falls back to the planning marker when the Production CAD is rejected or pending', () => {
    const rmc = row('RAW_MATERIAL_CALCULATION', 'APPROVED');
    expect(pickCad([row('PRODUCTION', 'REJECTED'), rmc])).toBe(rmc);
    expect(pickCad([row('PRODUCTION', 'PENDING'), rmc])).toBe(rmc);
  });

  it('returns nothing when every row is rejected', () => {
    expect(pickCad([row('PRODUCTION', 'REJECTED'), row('RAW_MATERIAL_CALCULATION', 'REJECTED')])).toBeNull();
  });
});
