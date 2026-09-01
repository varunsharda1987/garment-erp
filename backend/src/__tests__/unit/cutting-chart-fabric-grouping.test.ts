/**
 * The Cutting Chart must not collapse two different fabrics into one row
 * (silent-data-loss finding #7).
 *
 * Chart rows with no fabricId were deduplicated on fabric NAME alone. 334 of 346 style_fabrics have
 * a NULL fabricId because they are greige-sourced, so that path was the norm, not the exception: a
 * component legitimately using two different fabrics collapsed into ONE row, and the survivor kept
 * only one of the two CAD averages.
 *
 * The consequence was not a missing row on screen — it was a plausible-looking chart. On a style
 * needing 0.4967 m/pc for one panel and 0.9817 m/pc for another, production planned and RESERVED
 * against a single figure, and the ~two-thirds shortfall was discovered on the cutting table.
 *
 * The rule is provenance, not names: two entries from DIFFERENT style_fabrics are two distinct
 * requirements and never merge. Rows enriched from BOM/style data carry a null styleFabricId and
 * still attach by name — that enrichment path is what fills in a CAD row's missing fabric details,
 * and a "does this row have CAD data" rule would have broken it (and would still have merged the
 * live COS009 case, whose CAD rows have a null average AND a 0.00 width).
 */

import { dedupeChartEntries, type ChartFabricEntry } from '../../controllers/cutting.utils';

function entry(over: Partial<ChartFabricEntry> = {}): ChartFabricEntry {
  return {
    part: 'Shirt',
    fabricId: null,
    fabricName: '',
    fabricCode: '',
    costingWidth: null,
    costingAverage: null,
    rawMatCalcWidth: null,
    rawMatCalcAverage: null,
    productionWidth: null,
    productionAverage: null,
    fabricColor: null,
    styleFabricId: null,
    rank: {},
    ...over,
  };
}

describe('dedupeChartEntries', () => {
  it('keeps two greige-sourced fabrics apart even when name and component match', () => {
    // The live EBWW-007 shape: one component, two style_fabrics, same fabric name, no fabricId,
    // each with its own CAD average. Name-only dedupe deleted the second outright.
    const { fabrics } = dedupeChartEntries([
      entry({ styleFabricId: 'sf-1', fabricName: 'Viscose Slub', productionAverage: 0.4967, productionWidth: 54 }),
      entry({ styleFabricId: 'sf-2', fabricName: 'Viscose Slub', productionAverage: 0.9817, productionWidth: 40 }),
    ]);

    expect(fabrics).toHaveLength(2);
    expect(fabrics.map((f) => f.productionAverage).sort()).toEqual([0.4967, 0.9817]);
  });

  it('keeps them apart even when BOTH have no CAD data at all', () => {
    // The live COS009 shape: cadAverage NULL and cutableWidth 0.00 on both rows. Any rule based on
    // "does this row carry CAD data" reads false on both sides and merges them anyway.
    const { fabrics } = dedupeChartEntries([
      entry({ part: 'Blouse', styleFabricId: 'sf-a', fabricName: 'Georgette' }),
      entry({ part: 'Pallazo', styleFabricId: 'sf-b', fabricName: 'Georgette' }),
    ]);

    expect(fabrics).toHaveLength(2);
    expect(fabrics.map((f) => f.part)).toEqual(['Blouse', 'Pallazo']);
  });

  it('still merges an enrichment row into the CAD row it describes', () => {
    // This is why the rule is written on provenance. A BOM/style-derived row carries no
    // styleFabricId; it must still attach, or the CAD row loses its fabric name/code and the
    // Create Batch button would be disabled for want of a production CAD.
    const { fabrics } = dedupeChartEntries([
      entry({ styleFabricId: 'sf-1', fabricName: 'Cotton Twill', productionAverage: 1.2, productionWidth: 58 }),
      entry({ styleFabricId: null, fabricName: 'Cotton Twill', fabricCode: 'FAB-001', fabricColor: 'Navy' }),
    ]);

    expect(fabrics).toHaveLength(1);
    expect(fabrics[0]).toMatchObject({ fabricCode: 'FAB-001', fabricColor: 'Navy', productionAverage: 1.2 });
  });

  it('merges two rows that really are the same style_fabric', () => {
    const { fabrics } = dedupeChartEntries([
      entry({ styleFabricId: 'sf-1', fabricName: 'Linen', costingAverage: 1.1, costingWidth: 44 }),
      entry({ styleFabricId: 'sf-1', fabricName: 'Linen', productionAverage: 1.3, productionWidth: 44 }),
    ]);

    expect(fabrics).toHaveLength(1);
    expect(fabrics[0]).toMatchObject({ costingAverage: 1.1, productionAverage: 1.3 });
  });

  it('still deduplicates by fabricId, which is the unambiguous case', () => {
    const { fabrics } = dedupeChartEntries([
      entry({ fabricId: 'fab-1', fabricName: 'Rayon', costingAverage: 1.0 }),
      entry({ fabricId: 'fab-1', fabricName: 'Rayon', productionAverage: 1.4 }),
    ]);

    expect(fabrics).toHaveLength(1);
    expect(fabrics[0]).toMatchObject({ costingAverage: 1.0, productionAverage: 1.4 });
  });

  it('reports a genuine disagreement instead of silently keeping the first value', () => {
    const { fabrics, warnings } = dedupeChartEntries([
      entry({ styleFabricId: null, fabricName: 'Crepe', productionAverage: 1.0, productionWidth: 44 }),
      entry({ styleFabricId: null, fabricName: 'Crepe', productionAverage: 2.5, productionWidth: 44 }),
    ]);

    expect(fabrics).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/1 m and 2.5 m/);
  });

  it('says nothing when the data is clean', () => {
    const { warnings } = dedupeChartEntries([
      entry({ styleFabricId: 'sf-1', fabricName: 'A', productionAverage: 1 }),
      entry({ styleFabricId: 'sf-2', fabricName: 'B', productionAverage: 2 }),
    ]);
    expect(warnings).toEqual([]);
  });

  it('never lets a value-less row erase one that has a value', () => {
    // The merge only fills NULLs, so the surviving average must be the real one regardless of order.
    const { fabrics } = dedupeChartEntries([
      entry({ styleFabricId: null, fabricName: 'Satin', productionAverage: 1.75, productionWidth: 58 }),
      entry({ styleFabricId: null, fabricName: 'Satin' }),
    ]);
    expect(fabrics[0].productionAverage).toBe(1.75);
  });
});
