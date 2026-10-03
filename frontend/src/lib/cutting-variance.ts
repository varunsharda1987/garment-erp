import type { IssuedFabricItem } from '@/types/cutting.types';
import { CuttingReturnShortReason } from '@/types/generated/prisma-enums';
import { isQtyZero, qtyRemaining } from '@/lib/quantity';

/** Why fabric the lays say should come back did not (cutting_batch_fabrics.returnShortReason) */
export const RETURN_SHORT_REASON_LABELS: Record<CuttingReturnShortReason, string> = {
  [CuttingReturnShortReason.END_BITS]: 'End bits / cutting waste',
  [CuttingReturnShortReason.DAMAGED]: 'Damaged / faulty fabric',
  [CuttingReturnShortReason.SHORT_IN_ROLL]: 'Roll measured short',
  [CuttingReturnShortReason.NOT_TRACED]: 'Not traced',
  [CuttingReturnShortReason.OTHER]: 'Other',
};

export interface ReturnFabricRow {
  fabricKey: string;
  fabricName: string;
  lots: IssuedFabricItem[];
  issued: number;
  layMetres: number;
  returned: number;
  consumption: number;
  /** issued − used in lays */
  expectedBack: number;
  /** expected back that is not coming back */
  shortQty: number;
  /** more coming back than the lays account for */
  overReturnQty: number;
  cadAverage: number | null;
  actualAverage: number | null;
  variancePercent: number | null;
}

/**
 * The Complete Batch dialog's live reading, fabric by fabric — the same rule as the server's
 * `fabricVarianceRows` (backend controllers/cutting.utils.ts): each fabric's metres per piece against ITS OWN CAD
 * average, and what the lays say should come back but is not.
 */
export function returnFabricRows(
  issued: IssuedFabricItem[],
  returnQtys: Record<string, number>,
  totalCut: number
): ReturnFabricRow[] {
  const groups = new Map<string, IssuedFabricItem[]>();
  for (const f of issued) {
    const key = f.fabricKey ?? `lot:${f.fabricStockId}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups].map(([fabricKey, lots]) => {
    const issuedQty = lots.reduce((s, l) => s + l.issuedQty, 0);
    const layMetres = lots.reduce((s, l) => s + l.consumedInLays, 0);
    const returned = lots.reduce((s, l) => s + (returnQtys[l.fabricStockId] || 0), 0);
    const nothingIssued = isQtyZero(issuedQty);
    // No lays recorded for the fabric: nothing to measure the return against (same as the server)
    const judged = !nothingIssued && !isQtyZero(layMetres);
    const consumption = nothingIssued ? layMetres : qtyRemaining(issuedQty, returned);
    const expectedBack = nothingIssued ? 0 : qtyRemaining(issuedQty, layMetres);
    const cad = lots.find((l) => l.cadAvgUsed != null && l.cadAvgUsed > 0)?.cadAvgUsed ?? null;
    const actualAverage = totalCut > 0 && consumption > 0 ? consumption / totalCut : null;
    return {
      fabricKey,
      fabricName: lots[0].fabricName,
      lots,
      issued: issuedQty,
      layMetres,
      returned,
      consumption,
      expectedBack,
      shortQty: judged ? qtyRemaining(consumption, layMetres) : 0,
      overReturnQty: judged ? qtyRemaining(returned, expectedBack) : 0,
      cadAverage: cad,
      actualAverage,
      variancePercent: actualAverage != null && cad ? ((actualAverage - cad) / cad) * 100 : null,
    };
  });
}
