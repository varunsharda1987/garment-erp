/**
 * What of a cutting batch is not yet on a slip to stitching — ONE rule (2026-09-30).
 *
 * A batch may reach stitching on several slips: **Issue to Stitching** sends part of it while it is
 * still being cut (one slip per call, per contractor), and **Generate Transfer Slip** sends the rest
 * once it is completed. The limit is the batch's good pieces per colour + size, never "one slip per
 * batch": that rule (a partial unique index on transfer_slips.cuttingBatchId, bug-hunt production-8)
 * refused every second Issue to Stitching and made Generate refuse after a partial issue, so the rest
 * of the batch could never reach stitching. The index is gone; the batch row lock taken here stops two
 * slips being cut from the same pieces at once.
 *
 * Quantities are whole pieces (Int columns).
 */

import { Prisma } from '@prisma/client';
import { skuKey } from './sku-colour.helper';

type Db = Prisma.TransactionClient;

/** A batch's slips to stitching (active ones — an inactive slip gave its pieces back). */
const SLIPS_TO_STITCHING = { isActive: true, fromStage: 'CUTTING', toStage: 'STITCHING' } as const;

export interface BatchSkuBalance {
  colorId: string | null;
  sizeId: string;
  /** Good pieces the batch cut */
  goodPcs: number;
  /** Already on slips to stitching */
  onSlips: number;
  /** Still to send */
  left: number;
}

/** Per colour + size: good pieces, what is on slips already, and what is left. */
export function batchSkuBalances(
  skuOutputs: Array<{ colorId: string | null; sizeId: string; goodPcs: number }>,
  slips: Array<{ skuBreakdown: Array<{ colorId: string | null; sizeId: string; quantity: number }> }>
): BatchSkuBalance[] {
  const onSlips = new Map<string, number>();
  for (const slip of slips) {
    for (const sku of slip.skuBreakdown) {
      const key = skuKey(sku.colorId, sku.sizeId);
      onSlips.set(key, (onSlips.get(key) || 0) + sku.quantity);
    }
  }
  // Legacy batches can hold two rows for one blank-colour size (bug-hunt production-18): add them up
  const good = new Map<string, BatchSkuBalance>();
  for (const sku of skuOutputs) {
    const key = skuKey(sku.colorId, sku.sizeId);
    const row = good.get(key) ?? { colorId: sku.colorId, sizeId: sku.sizeId, goodPcs: 0, onSlips: 0, left: 0 };
    row.goodPcs += sku.goodPcs;
    good.set(key, row);
  }
  return [...good.entries()].map(([key, row]) => {
    const sent = onSlips.get(key) || 0;
    return { ...row, onSlips: sent, left: Math.max(0, row.goodPcs - sent) };
  });
}

/** Pieces of the batch not yet on a slip to stitching. */
export function batchPiecesLeft(balances: BatchSkuBalance[]): number {
  return balances.reduce((sum, b) => sum + b.left, 0);
}

/**
 * Load a batch with what is left to send. With `lock`, the batch row is locked for the caller's
 * transaction so a concurrent Issue to Stitching / Generate waits and then sees this one's slip.
 */
export async function loadBatchSlipBalance(db: Db, batchId: string, { lock = false } = {}) {
  if (lock) {
    await db.$queryRaw`SELECT id FROM cutting_batches WHERE id = ${batchId} FOR UPDATE`;
  }
  const batch = await db.cutting_batches.findUnique({
    where: { id: batchId },
    include: {
      skuOutputs: { select: { colorId: true, sizeId: true, goodPcs: true } },
      transferSlips: {
        where: SLIPS_TO_STITCHING,
        select: { slipNumber: true, skuBreakdown: { select: { colorId: true, sizeId: true, quantity: true } } },
      },
    },
  });
  if (!batch) return null;
  return { batch, balances: batchSkuBalances(batch.skuOutputs, batch.transferSlips) };
}

/** Pieces left to send, per batch — for list pages (no lock). */
export async function piecesLeftByBatch(db: Db, batchIds: string[]): Promise<Map<string, number>> {
  if (batchIds.length === 0) return new Map();
  const [outputs, slips] = await Promise.all([
    db.cutting_batch_skus.findMany({
      where: { cuttingBatchId: { in: batchIds } },
      select: { cuttingBatchId: true, colorId: true, sizeId: true, goodPcs: true },
    }),
    db.transfer_slips.findMany({
      where: { ...SLIPS_TO_STITCHING, cuttingBatchId: { in: batchIds } },
      select: { cuttingBatchId: true, skuBreakdown: { select: { colorId: true, sizeId: true, quantity: true } } },
    }),
  ]);
  const out = new Map<string, number>();
  for (const batchId of batchIds) {
    const balances = batchSkuBalances(
      outputs.filter((o) => o.cuttingBatchId === batchId),
      slips.filter((s) => s.cuttingBatchId === batchId)
    );
    out.set(batchId, batchPiecesLeft(balances));
  }
  return out;
}
