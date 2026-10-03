/**
 * A completed cutting batch, fabric by fabric (owner, 2026-10-03):
 *  - each fabric's actual average is compared with ITS OWN CAD average — a two-fabric batch used to compare both
 *    fabrics' metres added up with the first fabric's average alone;
 *  - "short on return" = what the lays say should come back (issued − lay metres) and did not.
 *    CB-WO2609-0087-002: 1,704 m issued, 1,626.12 m in lays, 0 returned → 77.88 m short; it was recorded nowhere
 *    and `wastageMeters` read 0.
 *  - the lots of one fabric are laid on one marker, so lots with different Production CADs are refused together.
 */
import {
  fabricVarianceRows,
  fabricsWithMixedMarkers,
  splitShortByLot,
  type VarianceLotInput,
} from '../../controllers/cutting.utils';

const lot = (over: Partial<VarianceLotInput>): VarianceLotInput => ({
  fabricStockId: 'lot-1',
  fabricId: 'fab-A',
  fabricName: 'Fabric A',
  cadAvgUsed: 0.7333,
  issued: 0,
  returned: 0,
  layMetres: 0,
  ...over,
});

describe('fabricVarianceRows', () => {
  it('CB-WO2609-0087-002: nothing came back of 77.88 m the lays left — 77.88 m short, the average shows +7.1 %', () => {
    const v = fabricVarianceRows([lot({ issued: 1704, returned: 0, layMetres: 1626.12 })], 2170);
    const f = v.fabrics[0];
    expect(f.expectedBack).toBeCloseTo(77.88, 2);
    expect(f.shortQty).toBeCloseTo(77.88, 2);
    expect(f.consumption).toBe(1704);
    expect(f.actualAverage).toBeCloseTo(0.7853, 4);
    expect(f.variancePercent).toBeCloseTo(7.09, 1);
    expect(v.perGarment.shortQty).toBeCloseTo(77.88, 2);
    expect(v.perGarment.shortPercent).toBeCloseTo(4.57, 2);
  });

  it('everything the lays left came back: nothing short, and a one-fabric batch reads exactly as before', () => {
    const v = fabricVarianceRows([lot({ issued: 100, returned: 10, layMetres: 90 })], 120);
    expect(v.fabrics[0]).toMatchObject({ shortQty: 0, overReturnQty: 0, consumption: 90 });
    expect(v.perGarment.actualAverage).toBeCloseTo(0.75, 4);
    expect(v.perGarment.cadAverage).toBeCloseTo(0.7333, 4);
    expect(v.perGarment.variancePercent).toBeCloseTo(((0.75 - 0.7333) / 0.7333) * 100, 1);
  });

  it('more back than the lays account for is shown, never asked a reason', () => {
    const v = fabricVarianceRows([lot({ issued: 100, returned: 15, layMetres: 90 })], 120);
    expect(v.fabrics[0]).toMatchObject({ shortQty: 0, overReturnQty: 5 });
  });

  it('no lays recorded for the fabric: no shortfall is judged (nothing to measure against)', () => {
    const v = fabricVarianceRows([lot({ issued: 100, returned: 20, layMetres: 0 })], 0);
    expect(v.fabrics[0]).toMatchObject({ shortQty: 0, overReturnQty: 0, consumption: 80 });
  });

  it('two fabrics: each against its OWN CAD average; per garment = the averages added up', () => {
    const v = fabricVarianceRows(
      [
        lot({ fabricStockId: 'a1', fabricId: 'A', fabricName: 'Body', cadAvgUsed: 1.2, issued: 130, layMetres: 120 }),
        lot({
          fabricStockId: 'b1',
          fabricId: 'B',
          fabricName: 'Lining',
          cadAvgUsed: 0.4,
          issued: 45,
          returned: 5,
          layMetres: 40,
        }),
      ],
      100
    );
    const body = v.fabrics.find((f) => f.fabricId === 'A')!;
    const lining = v.fabrics.find((f) => f.fabricId === 'B')!;
    expect(body.actualAverage).toBeCloseTo(1.3, 4);
    expect(body.variancePercent).toBeCloseTo(8.33, 2);
    expect(body.shortQty).toBe(10);
    expect(lining.actualAverage).toBeCloseTo(0.4, 4);
    expect(lining.variancePercent).toBe(0);
    expect(lining.shortQty).toBe(0);
    // Before: (130 + 40) / 100 = 1.7 m/pc against Body's 1.2 alone = +41.7 %. Now against 1.2 + 0.4 = 1.6
    expect(v.perGarment.cadAverage).toBeCloseTo(1.6, 4);
    expect(v.perGarment.actualAverage).toBeCloseTo(1.7, 4);
    expect(v.perGarment.variancePercent).toBeCloseTo(6.25, 2);
  });

  it('the lots of one fabric are read together, and the reason given on any of them is the fabric’s', () => {
    const v = fabricVarianceRows(
      [
        lot({ fabricStockId: 'l1', issued: 60, layMetres: 50 }),
        lot({ fabricStockId: 'l2', issued: 40, layMetres: 30, shortReason: 'END_BITS', shortNote: 'ends' }),
      ],
      100
    );
    expect(v.fabrics).toHaveLength(1);
    expect(v.fabrics[0]).toMatchObject({ issued: 100, layMetres: 80, shortQty: 20, shortReason: 'END_BITS' });
    const byLot = splitShortByLot(
      v.fabrics[0],
      new Map([
        ['l1', 60],
        ['l2', 40],
      ])
    );
    expect(byLot.get('l1')).toBe(12);
    expect(byLot.get('l2')).toBe(8);
  });
});

describe('fabricsWithMixedMarkers', () => {
  it('two lots of one fabric on different markers are flagged; one marker is fine; different fabrics never clash', () => {
    expect(
      fabricsWithMixedMarkers([
        { fabricStockId: 'l1', fabricId: 'A', average: 1.42 },
        { fabricStockId: 'l2', fabricId: 'A', average: 1.47 },
        { fabricStockId: 'l3', fabricId: 'B', average: 0.5 },
      ])
    ).toEqual([{ fabricId: 'A', averages: [1.42, 1.47], lotIds: ['l1', 'l2'] }]);
    expect(
      fabricsWithMixedMarkers([
        { fabricStockId: 'l1', fabricId: 'A', average: 1.42 },
        { fabricStockId: 'l2', fabricId: 'A', average: 1.4203 },
        { fabricStockId: 'l3', fabricId: 'B', average: 0.9 },
      ])
    ).toEqual([]);
  });
});
