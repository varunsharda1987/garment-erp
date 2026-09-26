/**
 * Cost-sheet totals — ONE calculation (2026-09-26).
 *
 * The same arithmetic was copied into createCostSheet, updateCostSheet and the lace recompute, on raw
 * floats. The Correct CAD flow also has to re-total a sheet on the server (a new version with a corrected
 * fabric line), so it lives here, in decimal.js, and every caller uses it.
 *
 *   subtotal          = fabric + trims + CMT + embroidery + accessories + lace
 *   value loss        = subtotal × valueLoss%
 *   markup            = (subtotal + value loss) × markup%
 *   total product     = subtotal + value loss + markup   (= cost per piece = base selling price)
 *   material cost     = fabric + trims + accessories + lace
 *   processing cost   = embroidery + CMT
 */

import { Prisma } from '@prisma/client';
import { toCurrency, toNumber } from '../../utils/currency';

export interface CostSheetParts {
  fabricTotal: number;
  trimsTotal: number;
  cmtTotal: number;
  embroideryTotal: number;
  accessoriesTotal: number;
  laceTotal: number;
  valueLossPercent: number;
  markupPercent: number;
}

export interface CostSheetTotals {
  subtotal: number;
  valueLossAmount: number;
  markupAmount: number;
  totalProductCost: number;
  totalMaterialCost: number;
  totalProcessingCost: number;
  totalCostPerPiece: number;
  sellingPricePerPiece: number;
}

export function computeCostSheetTotals(p: CostSheetParts): CostSheetTotals {
  const subtotal = toCurrency(p.fabricTotal)
    .plus(p.trimsTotal)
    .plus(p.cmtTotal)
    .plus(p.embroideryTotal)
    .plus(p.accessoriesTotal)
    .plus(p.laceTotal);
  const valueLoss = subtotal.times(p.valueLossPercent || 0).div(100);
  const afterValueLoss = subtotal.plus(valueLoss);
  const markup = afterValueLoss.times(p.markupPercent || 0).div(100);
  const totalProductCost = toNumber(afterValueLoss.plus(markup));
  return {
    subtotal: toNumber(subtotal),
    valueLossAmount: toNumber(valueLoss),
    markupAmount: toNumber(markup),
    totalProductCost,
    totalMaterialCost: toNumber(
      toCurrency(p.fabricTotal).plus(p.trimsTotal).plus(p.accessoriesTotal).plus(p.laceTotal)
    ),
    totalProcessingCost: toNumber(toCurrency(p.embroideryTotal).plus(p.cmtTotal)),
    totalCostPerPiece: totalProductCost,
    sellingPricePerPiece: totalProductCost,
  };
}

/** A fabricDetails JSON entry, as far as the fabric total is concerned */
interface FabricDetailTotal {
  fabricTotal?: number | null;
  isNotApplicable?: boolean | null;
}

/** fabricTotal of a sheet = Σ its fabricDetails[].fabricTotal, Not-Applicable lines excluded (as the form) */
export function fabricTotalOf(fabricDetails: unknown): number {
  if (!Array.isArray(fabricDetails)) return 0;
  return toNumber(
    (fabricDetails as FabricDetailTotal[])
      .filter((f) => !f.isNotApplicable)
      .reduce((sum, f) => sum.plus(Number(f.fabricTotal) || 0), toCurrency(0))
  );
}

/**
 * Re-total a stored sheet after its fabricDetails changed on the server: fabricTotal from the JSON, the
 * other section totals and percentages as stored, then every derived total.
 */
export async function recomputeStoredCostSheetTotals(tx: Prisma.TransactionClient, costingId: string): Promise<void> {
  const sheet = await tx.style_costing.findUniqueOrThrow({
    where: { id: costingId },
    select: {
      fabricDetails: true,
      trimsTotal: true,
      cmtTotal: true,
      embroideryTotal: true,
      accessoriesTotal: true,
      laceTotal: true,
      valueLossPercent: true,
      markupPercent: true,
    },
  });
  const fabricTotal = fabricTotalOf(sheet.fabricDetails);
  const totals = computeCostSheetTotals({
    fabricTotal,
    trimsTotal: Number(sheet.trimsTotal ?? 0),
    cmtTotal: Number(sheet.cmtTotal ?? 0),
    embroideryTotal: Number(sheet.embroideryTotal ?? 0),
    accessoriesTotal: Number(sheet.accessoriesTotal ?? 0),
    laceTotal: Number(sheet.laceTotal ?? 0),
    valueLossPercent: Number(sheet.valueLossPercent ?? 0),
    markupPercent: Number(sheet.markupPercent ?? 0),
  });
  await tx.style_costing.update({ where: { id: costingId }, data: { fabricTotal, ...totals } });
}
