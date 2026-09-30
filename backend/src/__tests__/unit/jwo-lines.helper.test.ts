/**
 * A job work order's header mirrors its lines (jwo-lines.helper): quantities are the lines' sums, and each
 * output field is the value every line shares, else NULL — never line 1's, which is how DJ-EBEW-002-001's
 * Red, Black and Teal orders were all named the Red fabric (2026-09-30).
 */

import { headerFromLines, impliedShrinkagePercent, splitOneLine } from '../../services/helpers/jwo-lines.helper';

describe('headerFromLines', () => {
  const red = {
    styleId: 'style-a',
    colorName: 'Red',
    finishedFabricId: 'fab-red',
    sentWidthInches: 55,
    expectedShrinkage: 8,
    qtySent: 8252.17,
    qtyExpected: 7592,
  };

  it('a one-line job mirrors its line exactly', () => {
    expect(headerFromLines([red])).toEqual({
      qtySentMeters: 8252.17,
      qtyBillable: 7592,
      styleId: 'style-a',
      colorMasterId: null,
      colorName: 'Red',
      finishedFabricId: 'fab-red',
      finishedLaceId: null,
      sentWidthInches: 55,
      expectedShrinkage: 8,
    });
  });

  it('sums the quantities and keeps only what every line shares (SP27CK130 Red / Black / Teal)', () => {
    const black = { ...red, styleId: 'style-b', colorName: 'Black', finishedFabricId: 'fab-black' };
    const teal = { ...red, styleId: 'style-t', colorName: 'Teal', finishedFabricId: 'fab-teal' };
    const header = headerFromLines([red, black, teal]);
    expect(header.qtySentMeters).toBe(24756.51);
    expect(header.qtyBillable).toBe(22776);
    expect(header.styleId).toBeNull();
    expect(header.colorName).toBeNull();
    expect(header.finishedFabricId).toBeNull();
    // shared by all three lines
    expect(header.sentWidthInches).toBe(55);
    expect(header.expectedShrinkage).toBe(8);
  });

  it('two colours of one style keep the style', () => {
    const header = headerFromLines([red, { ...red, colorName: 'Navy', finishedFabricId: 'fab-navy' }]);
    expect(header.styleId).toBe('style-a');
    expect(header.colorName).toBeNull();
  });

  it('shrinkage the lines do not share is the one the totals imply', () => {
    const header = headerFromLines([
      { ...red, qtySent: 1000, qtyExpected: 900, expectedShrinkage: 10 },
      { ...red, qtySent: 1000, qtyExpected: 950, expectedShrinkage: 5 },
    ]);
    expect(header.expectedShrinkage).toBe(7.5);
  });

  it('billable is unknown when any line has none (piece work)', () => {
    expect(headerFromLines([{ ...red, qtyExpected: null }]).qtyBillable).toBeNull();
  });

  it('treats blank text as missing and reads decimals as numbers', () => {
    const header = headerFromLines([{ ...red, colorName: '  ', qtySent: '100.5', sentWidthInches: '55' }]);
    expect(header.colorName).toBeNull();
    expect(header.qtySentMeters).toBe(100.5);
    expect(header.sentWidthInches).toBe(55);
  });

  it('refuses a job with no line', () => {
    expect(() => headerFromLines([])).toThrow(/at least one line/);
  });
});

describe('impliedShrinkagePercent', () => {
  it('is 1 − expected ÷ sent, in percent', () => {
    expect(impliedShrinkagePercent(8252.17, 7592)).toBe(8);
    expect(impliedShrinkagePercent(1000, null)).toBeNull();
    expect(impliedShrinkagePercent(0, 10)).toBeNull();
  });
});

describe('splitOneLine', () => {
  it('moves the output fields onto the line and leaves the job its own', () => {
    const { header, line } = splitOneLine({
      jobWorkNumber: 'DJ-X-001',
      processType: 'DYEING',
      processorId: 'p1',
      createdById: 'u1',
      qtySentMeters: 500,
      qtyBillable: 460,
      colorName: 'Navy',
      sentWidthInches: 58,
      expectedShrinkage: 8,
      agreedRatePerMeter: 20,
    });
    expect(header).toEqual({
      jobWorkNumber: 'DJ-X-001',
      processType: 'DYEING',
      processorId: 'p1',
      createdById: 'u1',
      agreedRatePerMeter: 20,
    });
    expect(line).toMatchObject({ qtySent: 500, qtyExpected: 460, colorName: 'Navy', sentWidthInches: 58 });
  });
});
