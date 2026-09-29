/**
 * Processing batches — the project's ONE rule for "which fabric rows are dyed / printed together,
 * and on how many metres is their processing rate looked up".
 *
 * Why it exists (2026-09-29): a style's parts cut from the same greige, sent to the same processor
 * in the same colour go to the processor as ONE batch, so Fabric Costing prices each of them on the
 * batch's combined metres. That rule lived only inside FabricCostingPage.tsx, and Correct CAD
 * re-priced a row on its own metres unless the row happened to be saved right after a fresh
 * lookup: ESSKY084LS's 52″ row (767 m alone, 2,638 m with its 48″ part) was refused "no rate at
 * 767 m" although its saved ₹10 WAS the batch rate.
 *
 * The rule (as the Fabric Costing page has always applied it):
 *  - rows are the style's rows for ONE costing purpose (the caller loads them);
 *  - only the newest row per `styleFabricId|width` counts — older same-fabric same-width rows are
 *    quantity-change clones of it — and the row being priced always wins its slot;
 *  - the batch is the rows with the target's greige, processor and colour group;
 *  - a row's metres are its average × its pieces.
 * A row with no colour group or no processor is not batched (null).
 *
 * This file is identical to `frontend/src/lib/fabric-batch.ts` (asserted by
 * `backend/src/__tests__/unit/fabric-batch.test.ts`). It has no imports so both copies stay identical.
 */

export interface BatchRow {
  id: string;
  /** Same fabric line of the style — rows sharing it and the width are one slot */
  styleFabricId: string | null;
  width: number | null;
  greigeId: string | null;
  processorId: string | null;
  /** The style fabric's colour — the batch group (null = not batched) */
  colourId: string | null;
  /** Average per piece, metres */
  average: number;
  pieces: number;
  /** ms since epoch; null = not saved yet (newer than any saved row) */
  createdAt: number | null;
  /** How the row reads in a sentence, e.g. "Shirt 48″" */
  label: string;
}

export interface BatchMember {
  id: string;
  label: string;
  metres: number;
}

export interface FabricBatch {
  /** Combined metres the processing rate is looked up on */
  metres: number;
  /** Every row in the batch, the target included */
  members: BatchMember[];
}

export function batchGroupMetres(rows: BatchRow[], targetId: string): FabricBatch | null {
  const target = rows.find((r) => r.id === targetId);
  if (!target || !target.colourId || !target.processorId) return null;

  const newestPerSlot = new Map<string, { row: BatchRow; t: number }>();
  for (const row of rows) {
    const key = `${row.styleFabricId ?? row.id}|${row.width}`;
    const t =
      row.id === targetId
        ? Number.MAX_SAFE_INTEGER // the row being priced always wins its slot
        : (row.createdAt ?? Number.MAX_SAFE_INTEGER - 1); // unsaved rows are newer than any saved one
    const prev = newestPerSlot.get(key);
    if (!prev || t >= prev.t) newestPerSlot.set(key, { row, t });
  }

  const members: BatchMember[] = [];
  for (const { row } of newestPerSlot.values()) {
    if (
      row.greigeId === target.greigeId &&
      row.processorId === target.processorId &&
      row.colourId === target.colourId
    ) {
      members.push({ id: row.id, label: row.label, metres: row.average * row.pieces });
    }
  }
  return { metres: members.reduce((sum, m) => sum + m.metres, 0), members };
}
