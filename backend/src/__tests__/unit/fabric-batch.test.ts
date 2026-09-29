/**
 * The processing-batch rule (utils/fabric-batch.ts) — which of a style's fabric rows are processed together,
 * and on how many metres their rate is looked up. It is the rule the Fabric Costing page has always applied;
 * Correct CAD now applies the same one (ESSKY084LS, 29-Sep).
 */

import { batchGroupMetres, type BatchRow } from '../../utils/fabric-batch';

const row = (over: Partial<BatchRow> & { id: string }): BatchRow => ({
  styleFabricId: 'sf-1',
  width: 52,
  greigeId: 'g-1',
  processorId: 'p-1',
  colourId: 'col-1',
  average: 1,
  pieces: 100,
  createdAt: 1000,
  label: 'Shirt',
  ...over,
});

describe('batchGroupMetres', () => {
  it('sums average × pieces over the rows with the target’s greige, processor and colour', () => {
    const batch = batchGroupMetres(
      [
        row({ id: 'a', average: 0.8133, pieces: 2300, width: 48 }),
        row({ id: 'b', average: 0.3335, pieces: 2300 }),
        row({ id: 'other-greige', styleFabricId: 'sf-2', greigeId: 'g-2' }),
        row({ id: 'other-processor', styleFabricId: 'sf-3', processorId: 'p-2' }),
        row({ id: 'other-colour', styleFabricId: 'sf-4', colourId: 'col-2' }),
      ],
      'b'
    );
    expect(batch?.members.map((m) => m.id)).toEqual(['a', 'b']);
    expect(batch?.metres).toBeCloseTo(0.8133 * 2300 + 0.3335 * 2300, 9);
  });

  it('counts only the newest row of a fabric and width, and the target always wins its slot', () => {
    const rows = [
      row({ id: 'old', createdAt: 1000, average: 9 }),
      row({ id: 'new', createdAt: 2000, average: 2 }),
      row({ id: 'unsaved', createdAt: null, width: 60, average: 3 }),
      row({ id: 'saved-60', createdAt: 5000, width: 60, average: 7 }),
    ];
    expect(
      batchGroupMetres(rows, 'saved-60')
        ?.members.map((m) => m.id)
        .sort()
    ).toEqual(['new', 'saved-60']);
    // an unsaved row is newer than any saved one
    expect(
      batchGroupMetres(rows, 'new')
        ?.members.map((m) => m.id)
        .sort()
    ).toEqual(['new', 'unsaved']);
    // the target wins even over a newer row
    expect(
      batchGroupMetres(rows, 'old')
        ?.members.map((m) => m.id)
        .sort()
    ).toEqual(['old', 'unsaved']);
  });

  it('is null for a row with no colour group or no processor, or not in the list', () => {
    expect(batchGroupMetres([row({ id: 'a', colourId: null })], 'a')).toBeNull();
    expect(batchGroupMetres([row({ id: 'a', processorId: null })], 'a')).toBeNull();
    expect(batchGroupMetres([row({ id: 'a' })], 'missing')).toBeNull();
  });
});
