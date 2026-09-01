/**
 * A cutting batch must record every fabric lot it expects to consume — the PRIMARY one included
 * (silent-data-loss finding #6, and the trap behind its fix).
 *
 * Completion works out how much fabric was issued by walking `cutting_batch_fabrics` and looking each
 * lot up in a map built from INTERNAL "to Cutting" challans. A lot with no row here is invisible to
 * that sum. So a batch with NO rows can never satisfy the "No fabric issue recorded" guard, however
 * the fabric was actually issued.
 *
 * CuttingChart sends its lots in `fabricStocks`, so it got rows. CuttingForm sends none at all — its
 * batches had no rows whatsoever and could never be completed. That was masked while fabric was
 * never issued anyway; it becomes the blocking defect the moment issuance is real (manual or
 * otherwise), which is why it had to be fixed in the same change that removed auto-issue.
 *
 * Pure unit test on purpose. The controller path runs production-blocking validation and needs an
 * order/BOM/approval chain plus fabric stock to reach this code, and the shared dev database has
 * none of it (0 work orders, 0 fabric_stock) — so an integration test would be an expensive fixture
 * exercise with a large blast radius and little extra signal.
 */

import { buildBatchFabricRows } from '../../controllers/cutting.utils';

const BATCH = 'batch-1';

describe('buildBatchFabricRows', () => {
  it('always includes the primary lot — this is what CuttingForm batches were missing', () => {
    const rows = buildBatchFabricRows(BATCH, { fabricStockId: 'stock-primary', cadAvgUsed: 1.48 }, undefined);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ batchId: BATCH, fabricStockId: 'stock-primary', cadAvgUsed: 1.48 });
  });

  it('includes the primary alongside the extra lots CuttingChart sends', () => {
    const rows = buildBatchFabricRows(
      BATCH,
      { fabricStockId: 'stock-primary', cadAvgUsed: 1.48, cadWidthUsed: 58, actualWidth: 57.5 },
      [
        { fabricStockId: 'stock-a', cadAvgUsed: 1.48 },
        { fabricStockId: 'stock-b', cadAvgUsed: 1.48 },
      ]
    );

    expect(rows.map((r) => r.fabricStockId)).toEqual(['stock-primary', 'stock-a', 'stock-b']);
    expect(rows[0]).toMatchObject({ cadWidthUsed: 58, actualWidth: 57.5 });
  });

  it('emits the primary twice when it is also listed as an extra — the DB unique key collapses it', () => {
    // The caller relies on @@unique([batchId, fabricStockId]) + skipDuplicates. De-duplicating here
    // instead would be a second, divergent rule; this pins that the helper leaves it to the DB.
    const rows = buildBatchFabricRows(BATCH, { fabricStockId: 'same' }, [{ fabricStockId: 'same' }]);
    expect(rows.map((r) => r.fabricStockId)).toEqual(['same', 'same']);
  });

  it('skips entries with no fabric stock id rather than writing a broken row', () => {
    const rows = buildBatchFabricRows(BATCH, { fabricStockId: null }, [
      { fabricStockId: undefined },
      { fabricStockId: '' },
      { fabricStockId: 'real' },
    ]);
    expect(rows.map((r) => r.fabricStockId)).toEqual(['real']);
  });

  it('returns nothing when the batch names no fabric at all', () => {
    expect(buildBatchFabricRows(BATCH, {}, null)).toEqual([]);
  });

  it('normalises absent measurements to null, and keeps a real zero out of the id position', () => {
    const rows = buildBatchFabricRows(BATCH, { fabricStockId: 'stock-x' }, []);
    expect(rows[0]).toEqual({
      batchId: BATCH,
      fabricStockId: 'stock-x',
      cadAvgUsed: null,
      cadWidthUsed: null,
      actualWidth: null,
    });
  });
});
