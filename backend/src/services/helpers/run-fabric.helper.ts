/**
 * THE answer to "how much fabric does this production run have to cut from" (2026-09-24).
 *
 * Issuing fabric to Cutting takes it out of the store: the lot's quantityAvailable falls (to 0 and
 * EXHAUSTED on a full issue) and nothing on the lot says it now sits on the cutting floor. The only
 * record is the challan. Before this helper, seven readers — the Cutting Chart, its print, the Fabric
 * Issuance panel, the cutting gate, batch completion, the issued-fabric view and the integrity sweep —
 * each answered from their own query, and a fully issued run read "no fabric" (ESSKY085LS was BLOCKED
 * from cutting with its 1,704 m on the floor).
 *
 * Per lot, per run (or set of runs):
 *   issued    — INTERNAL challans on the run INTO Cutting, not DRAFT/CANCELLED
 *   returned  — INTERNAL challans on the run OUT OF Cutting (createFabricReturnChallan)
 *   consumed  — actualConsumption of the run's COMPLETED cutting batches
 *   atCutting — issued − returned − consumed (never below 0): on the floor, not yet used
 *   inStore   — the lot's own quantityAvailable while AVAILABLE
 *
 * Every challan movement also carries the cutting batch it was for (challans.cuttingBatchId), so the
 * same numbers exist per batch: what went out FOR a batch and what came back from it.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { qtyRemaining } from '../../utils/quantity';

type Db = Prisma.TransactionClient | typeof prisma;

/** Statuses at which an issue to Cutting has really left the store. */
export const ISSUED_CHALLAN_STATUSES = ['ISSUED', 'IN_TRANSIT', 'RECEIVED', 'PARTIALLY_RECEIVED'] as const;
const CUTTING = 'Cutting';

export interface LotPosition {
  fabricStockId: string;
  fabricId: string | null;
  issued: number;
  returned: number;
  consumed: number;
  atCutting: number;
}

export interface BatchFabricMovement {
  issued: number;
  returned: number;
}

export interface RunFabricPosition {
  /** Lots this run has had issued to Cutting, keyed by fabric_stock id */
  lots: Map<string, LotPosition>;
  /** Per cutting batch → per lot: what went out for it and what came back */
  byBatch: Map<string, Map<string, BatchFabricMovement>>;
}

function bump(map: Map<string, number>, key: string, by: number) {
  map.set(key, (map.get(key) ?? 0) + by);
}

/**
 * The fabric position of one or more production runs (work_orders ids). Several runs are summed —
 * the order-line gate asks for all of an order's runs of a style at once.
 */
export async function getRunFabricPosition(workOrderIds: string[], db: Db = prisma): Promise<RunFabricPosition> {
  const lots = new Map<string, LotPosition>();
  const byBatch = new Map<string, Map<string, BatchFabricMovement>>();
  if (workOrderIds.length === 0) return { lots, byBatch };

  const [issuedRows, returnedRows, completed] = await Promise.all([
    db.challan_items.findMany({
      where: {
        fabricStockId: { not: null },
        challan: {
          productionRunId: { in: workOrderIds },
          challanType: 'INTERNAL',
          toName: CUTTING,
          status: { in: [...ISSUED_CHALLAN_STATUSES] },
        },
      },
      select: { fabricStockId: true, quantity: true, challan: { select: { cuttingBatchId: true } } },
    }),
    db.challan_items.findMany({
      where: {
        fabricStockId: { not: null },
        challan: {
          productionRunId: { in: workOrderIds },
          challanType: 'INTERNAL',
          fromName: CUTTING,
          status: { notIn: ['DRAFT', 'CANCELLED'] },
        },
      },
      select: {
        fabricStockId: true,
        quantity: true,
        challan: { select: { cuttingBatchId: true, cuttingBatchReturn: { select: { id: true } } } },
      },
    }),
    db.cutting_batch_fabrics.findMany({
      where: { batch: { workOrderId: { in: workOrderIds }, status: 'COMPLETED' } },
      select: { fabricStockId: true, actualConsumption: true },
    }),
  ]);

  const issued = new Map<string, number>();
  const returned = new Map<string, number>();
  const consumed = new Map<string, number>();

  const batchMove = (
    batchId: string | null | undefined,
    lotId: string,
    field: keyof BatchFabricMovement,
    qty: number
  ) => {
    if (!batchId) return;
    const perLot = byBatch.get(batchId) ?? new Map<string, BatchFabricMovement>();
    const move = perLot.get(lotId) ?? { issued: 0, returned: 0 };
    move[field] += qty;
    perLot.set(lotId, move);
    byBatch.set(batchId, perLot);
  };

  for (const r of issuedRows) {
    const qty = Number(r.quantity);
    bump(issued, r.fabricStockId!, qty);
    batchMove(r.challan.cuttingBatchId, r.fabricStockId!, 'issued', qty);
  }
  for (const r of returnedRows) {
    const qty = Number(r.quantity);
    bump(returned, r.fabricStockId!, qty);
    // A completion return is linked from the batch side (returnChallanId); newer ones carry the column
    batchMove(r.challan.cuttingBatchId ?? r.challan.cuttingBatchReturn?.id, r.fabricStockId!, 'returned', qty);
  }
  for (const c of completed) {
    if (c.actualConsumption != null) bump(consumed, c.fabricStockId, Number(c.actualConsumption));
  }

  const lotIds = [...new Set([...issued.keys(), ...returned.keys()])];
  const lotRows = lotIds.length
    ? await db.fabric_stock.findMany({ where: { id: { in: lotIds } }, select: { id: true, fabricId: true } })
    : [];
  const fabricOf = new Map(lotRows.map((l) => [l.id, l.fabricId]));

  for (const id of lotIds) {
    const i = issued.get(id) ?? 0;
    const r = returned.get(id) ?? 0;
    const c = consumed.get(id) ?? 0;
    lots.set(id, {
      fabricStockId: id,
      fabricId: fabricOf.get(id) ?? null,
      issued: i,
      returned: r,
      consumed: c,
      atCutting: qtyRemaining(i, r + c),
    });
  }
  return { lots, byBatch };
}

/** The runs (work orders) of one order line — what the order-level gate asks about. */
export async function runIdsForOrderStyle(orderId: string, styleId: string, db: Db = prisma): Promise<string[]> {
  const runs = await db.work_orders.findMany({ where: { orderId, styleId }, select: { id: true } });
  return runs.map((r) => r.id);
}

/** What went out for one cutting batch and has not come back, per lot (never below 0). */
export async function batchFabricAtCutting(
  batchId: string,
  workOrderId: string,
  db: Db = prisma
): Promise<Map<string, number>> {
  const position = await getRunFabricPosition([workOrderId], db);
  const perLot = position.byBatch.get(batchId) ?? new Map<string, BatchFabricMovement>();
  return new Map([...perLot].map(([lotId, m]) => [lotId, qtyRemaining(m.issued, m.returned)]));
}

/**
 * The fabric a batch has to account for, per lot: what went out FOR it less what already came back.
 * Issues made before they carried a batch (legacy) belong to the run, so a batch with no linked issue
 * falls back to the run's fabric still at Cutting — never the run's gross issue, which credited every
 * batch on a run with the whole lot and double-counted consumption.
 */
export async function batchIssuedFabric(
  batchId: string,
  workOrderId: string,
  db: Db = prisma
): Promise<Map<string, number>> {
  const position = await getRunFabricPosition([workOrderId], db);
  const mine = position.byBatch.get(batchId);
  if (mine && mine.size > 0) {
    return new Map([...mine].map(([lotId, m]) => [lotId, qtyRemaining(m.issued, m.returned)]));
  }
  return new Map([...position.lots].map(([lotId, l]) => [lotId, l.atCutting]));
}
