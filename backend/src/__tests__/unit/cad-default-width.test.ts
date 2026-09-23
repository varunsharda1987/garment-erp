/**
 * When does a CAD row update write the greige default width?
 *
 * The CAD table saves only the fields that changed. Before 2026-09-23 the update endpoint treated
 * "request has no width" as "width is empty", so every later save (layer length, size breakdown,
 * pieces, or the table's own size-breakdown auto-sync) overwrote a typed width with the greige
 * default — KMC's 41.5" became 40", and the cost sheet, Order BOM and MRP were all built on 40".
 */

import { Prisma } from '@prisma/client';
import { defaultCutableWidthForGreige, shouldApplyDefaultCutableWidth } from '../../controllers/cad-planning.utils';

describe('defaultCutableWidthForGreige', () => {
  it('63" and wider greige defaults to 52"', () => {
    expect(defaultCutableWidthForGreige({ greigeWidth: 63, expectedFinishedWidthMin: 50 })).toBe(52);
    expect(defaultCutableWidthForGreige({ greigeWidth: new Prisma.Decimal(66), expectedFinishedWidthMin: null })).toBe(
      52
    );
  });

  it('48" to 62" greige defaults to 40"', () => {
    expect(defaultCutableWidthForGreige({ greigeWidth: 48, expectedFinishedWidthMin: 40 })).toBe(40);
  });

  it('narrower greige falls back to its min finished width, else 44"', () => {
    expect(defaultCutableWidthForGreige({ greigeWidth: 44, expectedFinishedWidthMin: 38 })).toBe(38);
    expect(defaultCutableWidthForGreige({ greigeWidth: null, expectedFinishedWidthMin: null })).toBe(44);
  });
});

describe('shouldApplyDefaultCutableWidth', () => {
  const G1 = 'greige-1';
  const G2 = 'greige-2';

  it('keeps a stored width when a save omits the width (the KMC reset)', () => {
    expect(
      shouldApplyDefaultCutableWidth({
        requestWidth: undefined,
        requestGreigeId: undefined,
        existingGreigeId: G1,
        existingWidth: new Prisma.Decimal(41.5),
      })
    ).toBe(false);
  });

  it('keeps a stored width when the same greige is re-sent', () => {
    expect(
      shouldApplyDefaultCutableWidth({
        requestWidth: undefined,
        requestGreigeId: G1,
        existingGreigeId: G1,
        existingWidth: 41.5,
      })
    ).toBe(false);
  });

  it('never overrides a width the request sends', () => {
    expect(
      shouldApplyDefaultCutableWidth({
        requestWidth: 41.5,
        requestGreigeId: G2,
        existingGreigeId: G1,
        existingWidth: 40,
      })
    ).toBe(false);
  });

  it('applies the default when the greige changes and no width is sent', () => {
    expect(
      shouldApplyDefaultCutableWidth({
        requestWidth: undefined,
        requestGreigeId: G2,
        existingGreigeId: G1,
        existingWidth: 41.5,
      })
    ).toBe(true);
  });

  it('applies the default when the width is explicitly cleared', () => {
    expect(
      shouldApplyDefaultCutableWidth({
        requestWidth: null,
        requestGreigeId: undefined,
        existingGreigeId: G1,
        existingWidth: 41.5,
      })
    ).toBe(true);
  });

  it('applies the default when the row has no width yet — a stored Decimal 0 counts as none', () => {
    expect(
      shouldApplyDefaultCutableWidth({
        requestWidth: undefined,
        requestGreigeId: undefined,
        existingGreigeId: G1,
        existingWidth: new Prisma.Decimal(0),
      })
    ).toBe(true);
  });

  it('never applies without a greige', () => {
    expect(
      shouldApplyDefaultCutableWidth({
        requestWidth: undefined,
        requestGreigeId: undefined,
        existingGreigeId: null,
        existingWidth: 0,
      })
    ).toBe(false);
    expect(
      shouldApplyDefaultCutableWidth({
        requestWidth: null,
        requestGreigeId: null,
        existingGreigeId: G1,
        existingWidth: 41.5,
      })
    ).toBe(false);
  });
});
