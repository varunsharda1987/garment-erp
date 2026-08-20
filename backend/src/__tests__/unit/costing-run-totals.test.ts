/**
 * Costing run totals (costing-18).
 *
 * Runs derive their totals at read time from the CAD rows currently linked to them.
 * A run whose rows were unlinked (deleted run members, or a costing removed from an
 * option) must NOT read as "Complete" — Array.every() on an empty array is true, which
 * made emptied runs display as complete with 0 fabrics.
 */

import { computeRunTotals } from '../../controllers/fabric-costing-run.controller';

describe('computeRunTotals', () => {
  it('reports a run with no linked CAD rows as incomplete', () => {
    expect(computeRunTotals([])).toEqual({ totalFabricCost: 0, isComplete: false, fabricCount: 0 });
  });

  it('sums cadAverage * totalCostPerMeter and marks a fully-costed run complete', () => {
    const result = computeRunTotals([
      { cadAverage: 2, totalCostPerMeter: 50 },
      { cadAverage: 1.5, totalCostPerMeter: 40 },
    ]);

    expect(result.fabricCount).toBe(2);
    expect(result.totalFabricCost).toBeCloseTo(160); // 2*50 + 1.5*40
    expect(result.isComplete).toBe(true);
  });

  it('is incomplete while any linked row is missing its cost or consumption', () => {
    expect(
      computeRunTotals([
        { cadAverage: 2, totalCostPerMeter: 50 },
        { cadAverage: 1.5, totalCostPerMeter: null },
      ]).isComplete
    ).toBe(false);

    expect(computeRunTotals([{ cadAverage: null, totalCostPerMeter: 50 }]).isComplete).toBe(false);
  });

  it('handles Prisma Decimal-like values (objects that stringify to a number)', () => {
    const decimal = (v: string) => ({ toString: () => v, valueOf: () => v });
    const result = computeRunTotals([{ cadAverage: decimal('2.5'), totalCostPerMeter: decimal('20') }]);

    expect(result.totalFabricCost).toBeCloseTo(50);
    expect(result.isComplete).toBe(true);
  });
});
