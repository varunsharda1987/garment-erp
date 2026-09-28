/**
 * What a lay cut — the ONE reading of the lay ↔ fabric link (cutting.utils layCoverage, 2026-09-28).
 *
 * The lay screen asks for one layer length per FABRIC (the lots of one fabric are merged into one line) and
 * saves it three ways: rows repeated for every lot of a fabric (a batch of 2+ fabrics), no link at all (a
 * batch cut from one fabric), or the legacy single link. Read lot by lot, a two-lot fabric counted twice and
 * a one-fabric batch counted no lot at all — so Issue to stitching refused every batch cut from one fabric
 * (CB-WO2609-0088-003, one lay recorded, "has no lays recorded").
 */

import {
  hasSharedFabric,
  layCoverage,
  splitFabricMetresByLot,
  type LayBatchFabric,
  type LayForCoverage,
} from '../../controllers/cutting.utils';

const lot = (id: string, fabricId: string | null, fabricStockId = `stock-${id}`): LayBatchFabric => ({
  id,
  fabricStockId,
  fabricId,
});
const lay = (over: Partial<LayForCoverage> = {}): LayForCoverage => ({
  numberOfLayers: 10,
  layerLength: 5,
  cuttingBatchFabricId: null,
  layFabrics: [],
  ...over,
});

describe('layCoverage — what a lay cut', () => {
  it('a one-lot batch: the unlinked lay the page saves covers the lot, length × layers counted once', () => {
    const c = layCoverage([lot('bf1', 'fab')], [lay()]);
    expect(c.coveredBatchFabricIds).toEqual(new Set(['bf1']));
    expect(c.metresByFabric.get('fab')).toBe(50);
    expect(c.totalMetres).toBe(50);
  });

  it('two lots of ONE fabric (as CB-WO2609-0087-002): the unlinked lay covers both lots and counts once', () => {
    const c = layCoverage([lot('a', 'fab'), lot('b', 'fab')], [lay({ numberOfLayers: 2, layerLength: '1.5' })]);
    expect(c.coveredBatchFabricIds).toEqual(new Set(['a', 'b']));
    expect(c.metresByFabric.get('fab')).toBe(3);
    expect(c.totalMetres).toBe(3);
  });

  it('no lay yet: nothing is covered and nothing is cut', () => {
    const c = layCoverage([lot('a', 'fab')], []);
    expect(c.coveredBatchFabricIds.size).toBe(0);
    expect(c.totalMetres).toBe(0);
  });

  it("two fabrics, one in two lots: the rows repeat a fabric's length per lot — each fabric counts once", () => {
    const c = layCoverage(
      [lot('a1', 'A'), lot('a2', 'A'), lot('b1', 'B')],
      [
        lay({
          numberOfLayers: 4,
          layerLength: 2,
          layFabrics: [
            { cuttingBatchFabricId: 'a1', layerLength: 2 },
            { cuttingBatchFabricId: 'a2', layerLength: 2 },
            { cuttingBatchFabricId: 'b1', layerLength: 1.25 },
          ],
        }),
      ]
    );
    expect(c.coveredBatchFabricIds).toEqual(new Set(['a1', 'a2', 'b1']));
    expect(c.metresByFabric.get('A')).toBe(8); // not 16
    expect(c.metresByFabric.get('B')).toBe(5);
    expect(c.totalMetres).toBe(13);
  });

  it('two fabrics, a lay of only one of them: the other is still uncut', () => {
    const c = layCoverage(
      [lot('a1', 'A'), lot('b1', 'B')],
      [lay({ layFabrics: [{ cuttingBatchFabricId: 'a1', layerLength: 5 }] })]
    );
    expect(c.coveredBatchFabricIds).toEqual(new Set(['a1']));
  });

  it("a legacy lay linked to one lot covers that lot's fabric", () => {
    const c = layCoverage([lot('a1', 'A'), lot('b1', 'B')], [lay({ cuttingBatchFabricId: 'b1' })]);
    expect(c.coveredBatchFabricIds).toEqual(new Set(['b1']));
    expect(c.metresByFabric.get('B')).toBe(50);
  });

  it('an unlinked lay among several fabrics covers none (it cannot say which) but counts in the batch total', () => {
    const c = layCoverage([lot('a1', 'A'), lot('b1', 'B')], [lay()]);
    expect(c.coveredBatchFabricIds.size).toBe(0);
    expect(c.totalMetres).toBe(50);
  });

  it('a batch with no fabric lines (an old batch): the lay still counts in the batch total', () => {
    expect(layCoverage([], [lay()]).totalMetres).toBe(50);
  });
});

describe("splitFabricMetresByLot — a fabric's lay metres on its lots", () => {
  it('one lot per fabric: exact', () => {
    const per = splitFabricMetresByLot(
      [lot('a1', 'A'), lot('b1', 'B')],
      new Map([
        ['A', 12.5],
        ['B', 3],
      ]),
      new Map()
    );
    expect(per.get('a1')).toBe(12.5);
    expect(per.get('b1')).toBe(3);
  });

  it('two lots of one fabric: split by what each sent to the batch, adding up to the fabric exactly', () => {
    const per = splitFabricMetresByLot(
      [lot('a', 'fab', 'lotA'), lot('b', 'fab', 'lotB')],
      new Map([['fab', 100]]),
      new Map([
        ['lotA', 852.1],
        ['lotB', 851.9],
      ])
    );
    expect(per.get('a')).toBe(50.01);
    expect(per.get('b')).toBe(49.99);
  });

  it('nothing sent yet: evenly, the rounding left on the last lot', () => {
    const per = splitFabricMetresByLot(
      [lot('a', 'fab'), lot('b', 'fab'), lot('c', 'fab')],
      new Map([['fab', 10]]),
      new Map()
    );
    expect([per.get('a'), per.get('b'), per.get('c')]).toEqual([3.33, 3.33, 3.34]);
  });

  it('a fabric with no lays: 0 on every lot', () => {
    const per = splitFabricMetresByLot([lot('a', 'fab'), lot('b', 'fab')], new Map(), new Map([['stock-a', 5]]));
    expect([per.get('a'), per.get('b')]).toEqual([0, 0]);
  });
});

describe('hasSharedFabric', () => {
  it('is true only when some fabric has two or more lots on the batch', () => {
    expect(hasSharedFabric([lot('a', 'A'), lot('b', 'B')])).toBe(false);
    expect(hasSharedFabric([lot('a', 'A'), lot('b', 'A')])).toBe(true);
    expect(hasSharedFabric([])).toBe(false);
  });
});
