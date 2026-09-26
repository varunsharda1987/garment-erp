/**
 * Re-cost a CAD row's fabric costing for a corrected average and/or greige — server side (2026-09-26).
 *
 * Fabric Costing builds ₹/m on the page (FabricCostingPage.tsx calculateRowTotals) and the server stores
 * what it sends. The Correct CAD flow has to re-price a row without the page, so this mirrors that
 * build-up exactly:
 *
 *   total ₹/m = greige + transport + (divideByShrinkage(greige, %) − greige) + processing + screen
 *
 *   - the processing rate is looked up again at the NEW metres (average × order pcs; a batch-grouped row
 *     keeps the rest of its batch), because a correction can move the row into another rate slab;
 *   - a new greige takes its live rate (greige-live-rate.helper) and needs a rate card of its own;
 *   - screen cost is a fixed total spread over the metres, so it is re-spread over the new metres;
 *   - transport is stored per metre only (a fixed transport amount is not saved), so it is kept.
 *
 * A LANDED_PRICE row is one typed price: an average change leaves it alone, a greige change is refused
 * (re-cost it in Fabric Costing). Nothing here writes — the caller applies the result.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { BusinessError } from '../../errors';
import { divideByShrinkage, toCurrency, toNumber } from '../../utils/currency';
import { lookupRate } from '../processor-rate-v2.service';
import { greigeRateProvenance, resolveLiveGreigeRates, type GreigeRateProvenance } from './greige-live-rate.helper';

type Db = PrismaClient | Prisma.TransactionClient;

/** The costing-owned columns of a fabric_width_cad row this helper reads */
export interface CostedCadRow {
  id: string;
  cadAverage: Prisma.Decimal | number | null;
  greigeId: string | null;
  processorId: string | null;
  rateCardId: string | null;
  costInputMode: string | null;
  orderQuantityPcs: number | null;
  greigeCostPerMeter: Prisma.Decimal | number | null;
  transportCostPerMeter: Prisma.Decimal | number | null;
  processingPricePerMeter: Prisma.Decimal | number | null;
  shrinkagePercent: Prisma.Decimal | number | null;
  screenCostPerMeter: Prisma.Decimal | number | null;
  totalCostPerMeter: Prisma.Decimal | number | null;
  costedAtQuantityMeters: Prisma.Decimal | number | null;
  costedRateIsBatch: boolean | null;
  processingBatchGroupColorId: string | null;
}

export interface RecostedCosting {
  greigeCostPerMeter: number | null;
  processingPricePerMeter: number | null;
  rateCardId: string | null;
  shrinkagePercent: number | null;
  shrinkageCostPerMeter: number | null;
  screenCostPerMeter: number | null;
  transportCostPerMeter: number | null;
  totalCostPerMeter: number | null;
  costedAtQuantityMeters: number | null;
  /** Set only when the greige changed (a new live rate and its label) */
  greigeProvenance: GreigeRateProvenance | null;
}

export interface RecostResult {
  costing: RecostedCosting;
  /** Metres the slab lookup ran on (batch total for a batch-grouped row) */
  slabMetres: number | null;
  slabLabel: string | null;
  /** ₹/m moved by more than half a paisa → the price approval must be given again */
  priceChanged: boolean;
  notes: string[];
}

const num = (v: Prisma.Decimal | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);
const money = (n: number) => toNumber(toCurrency(n).toDecimalPlaces(2));
const PRICE_EPSILON = 0.005;

export async function recostCadRow(
  db: Db,
  cad: CostedCadRow,
  after: { cadAverage: number; greigeId: string | null },
  userId: string
): Promise<RecostResult> {
  const notes: string[] = [];
  const oldTotal = num(cad.totalCostPerMeter);
  const unchanged: RecostedCosting = {
    greigeCostPerMeter: num(cad.greigeCostPerMeter),
    processingPricePerMeter: num(cad.processingPricePerMeter),
    rateCardId: cad.rateCardId,
    shrinkagePercent: num(cad.shrinkagePercent),
    shrinkageCostPerMeter: null,
    screenCostPerMeter: num(cad.screenCostPerMeter),
    transportCostPerMeter: num(cad.transportCostPerMeter),
    totalCostPerMeter: oldTotal,
    costedAtQuantityMeters: num(cad.costedAtQuantityMeters),
    greigeProvenance: null,
  };

  // Not costed yet: nothing to re-price (Fabric Costing will cost it at the corrected average)
  if (oldTotal === null) {
    return { costing: unchanged, slabMetres: null, slabLabel: null, priceChanged: false, notes };
  }

  const greigeChanged = after.greigeId !== cad.greigeId;

  if (cad.costInputMode === 'LANDED_PRICE') {
    if (greigeChanged) {
      throw new BusinessError(
        'This fabric is costed as one landed price. After changing its greige, re-cost it in Fabric Costing — ' +
          'the landed price for the old greige does not carry over.'
      );
    }
    notes.push('Landed price kept — an average change does not change a typed landed price.');
    return { costing: unchanged, slabMetres: null, slabLabel: null, priceChanged: false, notes };
  }

  // Metres for the slab: the corrected average × the pieces it was costed at. A batch-grouped row was
  // priced on its whole batch — swap only this row's share.
  const pcs = cad.orderQuantityPcs ?? 0;
  const oldAverage = num(cad.cadAverage) ?? 0;
  const oldRowMetres = oldAverage * pcs;
  const newRowMetres = after.cadAverage * pcs;
  const costedAt = num(cad.costedAtQuantityMeters);
  const slabMetres =
    pcs > 0
      ? cad.costedRateIsBatch && cad.processingBatchGroupColorId && costedAt !== null
        ? Math.max(0, costedAt - oldRowMetres + newRowMetres)
        : newRowMetres
      : null;

  // Greige: kept, or the live rate of the new greige
  let greigeCost = num(cad.greigeCostPerMeter) ?? 0;
  let greigeProvenance: GreigeRateProvenance | null = null;
  if (greigeChanged && after.greigeId) {
    const live = (await resolveLiveGreigeRates([after.greigeId], db)).get(after.greigeId);
    if (!live) {
      throw new BusinessError(
        'The new greige has no rate yet — no purchase, PO or greige-master cost. Set a cost on the greige master ' +
          '(or raise its PO) first.'
      );
    }
    greigeCost = live.rate;
    greigeProvenance = greigeRateProvenance({ rate: live.rate, live, userId });
  }

  // Processing: looked up again at the new metres, on the card's own processing and print type
  let processing = num(cad.processingPricePerMeter) ?? 0;
  let shrinkagePct = num(cad.shrinkagePercent) ?? 0;
  let rateCardId = cad.rateCardId;
  let slabLabel: string | null = null;
  if (cad.processorId && cad.rateCardId && slabMetres !== null && slabMetres > 0) {
    const card = await db.processor_rate_card.findUnique({
      where: { id: cad.rateCardId },
      select: { processingType: true, printingType: true },
    });
    const found = card
      ? await lookupRate({
          processorId: cad.processorId,
          processingType: card.processingType as never,
          printingType: (card.printingType ?? undefined) as never,
          greigeId: after.greigeId ?? '',
          quantityMeters: slabMetres,
        })
      : null;
    if (!found) {
      throw new BusinessError(
        `The processor has no ${card?.printingType ?? card?.processingType ?? ''} rate for this greige at ` +
          `${Math.round(slabMetres)} m. Add it on the Processor Rate Card page first, then correct again.`
      );
    }
    processing = found.ratePerMeter;
    if (found.shrinkagePercent != null) shrinkagePct = found.shrinkagePercent;
    rateCardId = found.id;
    slabLabel = found.slabLabel || `${found.minQuantity}-${found.maxQuantity}m`;
  } else if (cad.processorId && !cad.rateCardId) {
    notes.push('No rate card on this row — its processing price is kept as typed.');
  }

  // Screen: a fixed total, re-spread over the new metres
  let screen = num(cad.screenCostPerMeter);
  if (screen !== null && screen > 0 && oldRowMetres > 0 && newRowMetres > 0) {
    screen = (screen * oldRowMetres) / newRowMetres;
  }

  const transport = num(cad.transportCostPerMeter) ?? 0;
  const shrinkageCost = toNumber(divideByShrinkage(greigeCost, shrinkagePct)) - greigeCost;
  const total = greigeCost + transport + shrinkageCost + processing + (screen ?? 0);

  const costing: RecostedCosting = {
    greigeCostPerMeter: money(greigeCost),
    processingPricePerMeter: money(processing),
    rateCardId,
    shrinkagePercent: shrinkagePct,
    shrinkageCostPerMeter: money(shrinkageCost),
    screenCostPerMeter: screen === null ? null : money(screen),
    transportCostPerMeter: num(cad.transportCostPerMeter),
    totalCostPerMeter: money(total),
    costedAtQuantityMeters: slabMetres,
    greigeProvenance,
  };
  const priceChanged = Math.abs(total - oldTotal) > PRICE_EPSILON;
  return { costing, slabMetres, slabLabel, priceChanged, notes };
}
