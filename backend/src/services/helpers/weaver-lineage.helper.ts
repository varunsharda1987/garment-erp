/**
 * Which weaver's cloth a processed lot is (Phase 1b of the direct-to-processor plan, 2026-09-25).
 *
 * The weaver lives on the purchase and the lot, never on the greige master — the weaver we buy a
 * greige from keeps changing. Dyed / printed fabric is the SAME cloth, so it keeps the weaver of the
 * greige lot(s) its job drew: one weaver → `weaverId`; several → `weaverMix` with each one's share of
 * the metres sent ("Mixed: A 60%, B 40%"); none recorded → both null (shown as "—").
 */
import type { Prisma } from '@prisma/client';
import { addCurrency, divideCurrency, multiplyCurrency, roundToCent, toCurrency, toNumber } from '../../utils/currency';

type Tx = Prisma.TransactionClient;

export interface WeaverShare {
  weaverId: string | null;
  weaverName: string;
  metres: number;
  /** Per cent of the metres sent, 2 decimals. */
  share: number;
}

export interface WeaverLineage {
  weaverId: string | null;
  weaverMix: WeaverShare[] | null;
}

const NONE: WeaverLineage = { weaverId: null, weaverMix: null };

/** Collapse metres-per-weaver into one weaver, a mix, or nothing. */
export function lineageFromParts(
  parts: Array<{ weaverId: string | null; weaverName: string | null; metres: number }>
): WeaverLineage {
  const byWeaver = new Map<string, { weaverId: string | null; weaverName: string; metres: number }>();
  for (const p of parts) {
    const key = p.weaverId ?? '∅';
    const prev = byWeaver.get(key);
    const metres = toNumber(addCurrency(prev?.metres ?? 0, p.metres));
    byWeaver.set(key, { weaverId: p.weaverId, weaverName: p.weaverName ?? 'Not known', metres });
  }
  const groups = [...byWeaver.values()];
  if (groups.length === 0) return NONE;
  if (groups.length === 1) return { weaverId: groups[0].weaverId, weaverMix: null };
  const total = groups.reduce((acc, g) => addCurrency(acc, g.metres), toCurrency(0));
  return {
    weaverId: null,
    weaverMix: groups
      .sort((a, b) => b.metres - a.metres)
      .map((g) => ({
        ...g,
        share: toNumber(roundToCent(multiplyCurrency(divideCurrency(g.metres, total), 100))),
      })),
  };
}

/** "Kalai Mangal", "Mixed: Kalai Mangal 60%, Sharma Weaves 40%", or null. */
export function weaverLabel(
  weaverName: string | null | undefined,
  mix: WeaverShare[] | null | undefined
): string | null {
  if (mix && mix.length > 0) return `Mixed: ${mix.map((m) => `${m.weaverName} ${m.share}%`).join(', ')}`;
  return weaverName ?? null;
}

/**
 * The weaver lineage of what a job sent out: its greige lots (split across lots → the components,
 * else the header lot), or — for a fabric-roll job — the fabric lot's own lineage.
 */
export async function weaverOfJobSource(
  tx: Tx,
  job: { id: string; greigeStockLotId: string | null; fabricStockLotId: string | null },
  isFabricLotJob: boolean
): Promise<WeaverLineage> {
  if (isFabricLotJob) {
    if (!job.fabricStockLotId) return NONE;
    const lot = await tx.fabric_stock.findUnique({
      where: { id: job.fabricStockLotId },
      select: { weaverId: true, weaverMix: true },
    });
    return lot
      ? { weaverId: lot.weaverId, weaverMix: (lot.weaverMix as unknown as WeaverShare[] | null) ?? null }
      : NONE;
  }

  const components = await tx.job_work_order_components.findMany({
    where: { jobWorkOrderId: job.id, materialType: 'GREIGE', greigeStockId: { not: null } },
    select: { qtySent: true, greigeStock: { select: { weaverId: true, weaver: { select: { name: true } } } } },
  });
  if (components.length > 0) {
    return lineageFromParts(
      components.map((c) => ({
        weaverId: c.greigeStock?.weaverId ?? null,
        weaverName: c.greigeStock?.weaver?.name ?? null,
        metres: Number(c.qtySent),
      }))
    );
  }
  if (!job.greigeStockLotId) return NONE;
  const lot = await tx.greige_stock.findUnique({ where: { id: job.greigeStockLotId }, select: { weaverId: true } });
  return { weaverId: lot?.weaverId ?? null, weaverMix: null };
}
