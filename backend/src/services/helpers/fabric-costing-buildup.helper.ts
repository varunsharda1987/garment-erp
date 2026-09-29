/**
 * Re-cost a CAD row's fabric costing for a corrected average and/or greige — server side (2026-09-26).
 *
 * Fabric Costing builds ₹/m on the page (FabricCostingPage.tsx calculateRowTotals) and the server stores
 * what it sends. The Correct CAD flow has to re-price a row without the page, so this mirrors that
 * build-up exactly:
 *
 *   total ₹/m = greige + transport + (divideByShrinkage(greige, %) − greige) + processing + screen
 *
 *   - the processing rate is looked up again at the NEW metres (average × order pcs), because a correction
 *     can move the row into another rate slab. A part dyed / printed together with the style's other parts
 *     is looked up on the whole batch's metres — worked out from the rows (utils/fabric-batch.ts, the page's
 *     own rule), never from the row's stored costedRateIsBatch, which a save without a fresh lookup leaves
 *     false (ESSKY084LS, 29-Sep: refused "no rate at 767 m" for a row whose batch is 2,638 m);
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
import { batchGroupMetres, type BatchRow, type FabricBatch } from '../../utils/fabric-batch';
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
  /** The rate was looked up on the batch's combined metres */
  costedRateIsBatch: boolean;
  /** Set only when the greige changed (a new live rate and its label) */
  greigeProvenance: GreigeRateProvenance | null;
}

export interface RecostResult {
  costing: RecostedCosting;
  /** Metres the slab lookup ran on (batch total for a batch-grouped row) */
  slabMetres: number | null;
  slabLabel: string | null;
  /** The parts priced together with this row (null = priced on its own metres) */
  batch: FabricBatch | null;
  /** ₹/m moved by more than half a paisa → the price approval must be given again */
  priceChanged: boolean;
  notes: string[];
}

const num = (v: Prisma.Decimal | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);
const money = (n: number) => toNumber(toCurrency(n).toDecimalPlaces(2));
const PRICE_EPSILON = 0.005;

interface LoadedBatchRow {
  row: BatchRow;
  processingPricePerMeter: number | null;
  rateCardId: string | null;
}

/**
 * The style's rows for this row's purpose, exactly as Fabric Costing loads them (getStyleFabrics in
 * fabric-costing.controller.ts): rows with an average or a layer length, COSTING also taking rows with no
 * purpose, less rows superseded by a quantity-change clone. Rows not on a style fabric are not listed there,
 * so they are never batched.
 */
async function loadBatchRows(db: Db, cadId: string): Promise<LoadedBatchRow[]> {
  const self = await db.fabric_width_cad.findUnique({
    where: { id: cadId },
    select: { purpose: true, styleFabric: { select: { style_components: { select: { styleId: true } } } } },
  });
  const styleId = self?.styleFabric?.style_components?.styleId;
  if (!self || !styleId) return [];
  const purpose = self.purpose ?? 'COSTING';

  const rows = await db.fabric_width_cad.findMany({
    where: {
      styleFabric: { style_components: { styleId } },
      AND: [
        { OR: [{ cadAverage: { not: null } }, { cadMeters: { not: null } }] },
        { OR: [{ purpose }, ...(purpose === 'COSTING' ? [{ purpose: null }] : [])] },
      ],
    },
    select: {
      id: true,
      styleFabricId: true,
      cutableWidth: true,
      createdAt: true,
      greigeId: true,
      processorId: true,
      cadAverage: true,
      cadMeters: true,
      layerMarginMeters: true,
      orderQuantityPcs: true,
      processingPricePerMeter: true,
      rateCardId: true,
      clonedFromCadId: true,
      clonedFromOrderId: true,
      sizeBreakdowns: { select: { quantity: true } },
      styleFabric: { select: { colorMasterId: true, style_components: { select: { componentName: true } } } },
    },
  });

  // Only the tip of a quantity-change clone chain is live; order clones are per-order copies, not successors
  const superseded = new Set(
    rows.filter((r) => !r.clonedFromOrderId && r.clonedFromCadId).map((r) => `${r.styleFabricId}|${r.clonedFromCadId}`)
  );
  return rows
    .filter((r) => !superseded.has(`${r.styleFabricId}|${r.id}`))
    .map((r) => {
      // Per-piece average as the page gets it: the stored average, else layer + margin (3 % when unset) ÷ pieces
      let average = r.cadAverage ? Number(r.cadAverage) : 0;
      if (!r.cadAverage && r.cadMeters) {
        const layer = Number(r.cadMeters);
        const margin = r.layerMarginMeters ? Number(r.layerMarginMeters) : layer * 0.03;
        const pieces = r.sizeBreakdowns.reduce((n, b) => n + (b.quantity || 0), 0);
        average = pieces > 0 ? (layer + margin) / pieces : 0;
      }
      const width = r.cutableWidth === null ? null : Number(r.cutableWidth);
      const part = r.styleFabric?.style_components?.componentName || 'Fabric';
      return {
        row: {
          id: r.id,
          styleFabricId: r.styleFabricId,
          width,
          greigeId: r.greigeId,
          processorId: r.processorId,
          colourId: r.styleFabric?.colorMasterId ?? null,
          average,
          pieces: r.orderQuantityPcs ?? 0,
          createdAt: r.createdAt.getTime(),
          label: width ? `${part} ${width}″` : part,
        },
        processingPricePerMeter: num(r.processingPricePerMeter),
        rateCardId: r.rateCardId,
      };
    });
}

/** "this row 767 m + Shirt 48″ 1871 m" */
function describeBatch(batch: FabricBatch, cadId: string): string {
  return batch.members.map((m) => `${m.id === cadId ? 'this row' : m.label} ${Math.round(m.metres)} m`).join(' + ');
}

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
    costedRateIsBatch: cad.costedRateIsBatch ?? false,
    greigeProvenance: null,
  };

  // Not costed yet: nothing to re-price (Fabric Costing will cost it at the corrected average)
  if (oldTotal === null) {
    return { costing: unchanged, slabMetres: null, slabLabel: null, batch: null, priceChanged: false, notes };
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
    return { costing: unchanged, slabMetres: null, slabLabel: null, batch: null, priceChanged: false, notes };
  }

  // Metres for the slab: the corrected average × the pieces it was costed at — or, for a part processed
  // together with the style's other parts, the whole batch with this row at its corrected average and greige
  const pcs = cad.orderQuantityPcs ?? 0;
  const oldAverage = num(cad.cadAverage) ?? 0;
  const oldRowMetres = oldAverage * pcs;
  const newRowMetres = after.cadAverage * pcs;
  let batch: FabricBatch | null = null;
  let batchRows: LoadedBatchRow[] = [];
  if (pcs > 0 && cad.processorId) {
    batchRows = await loadBatchRows(db, cad.id);
    const rows = batchRows.map(({ row }) =>
      row.id === cad.id
        ? { ...row, greigeId: after.greigeId, average: after.cadAverage, pieces: pcs }
        : { ...row, pieces: row.pieces || pcs }
    );
    const grouped = batchGroupMetres(rows, cad.id);
    batch = grouped && grouped.members.length > 1 ? grouped : null;
  }
  const slabMetres = pcs > 0 ? (batch?.metres ?? newRowMetres) : null;

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
      const [processor, greige] = await Promise.all([
        db.suppliers.findUnique({ where: { id: cad.processorId }, select: { name: true } }),
        after.greigeId
          ? db.greige_master.findUnique({ where: { id: after.greigeId }, select: { greigeCode: true } })
          : Promise.resolve(null),
      ]);
      throw new BusinessError(
        `${processor?.name ?? 'The processor'} has no ${card?.printingType ?? card?.processingType ?? ''} rate for ` +
          `${greige?.greigeCode ?? 'this greige'} at ${Math.round(slabMetres)} m` +
          (batch ? ` (${describeBatch(batch, cad.id)}, processed together)` : '') +
          '. Add it on the Processor Rate Card page first, then correct again.'
      );
    }
    processing = found.ratePerMeter;
    if (found.shrinkagePercent != null) shrinkagePct = found.shrinkagePercent;
    rateCardId = found.id;
    slabLabel = found.slabLabel || `${found.minQuantity}-${found.maxQuantity}m`;

    // The other parts of the batch keep their price — a correction re-prices only its own row
    for (const member of batch?.members ?? []) {
      if (member.id === cad.id) continue;
      const other = batchRows.find((r) => r.row.id === member.id);
      const price = other?.rateCardId ? other.processingPricePerMeter : null;
      if (price !== null && price !== undefined && Math.abs(price - found.ratePerMeter) > PRICE_EPSILON) {
        notes.push(
          `${member.label} is priced at ₹${price}/m; the ${Math.round(batch!.metres)} m batch now prices at ` +
            `₹${found.ratePerMeter}/m — re-cost it in Fabric Costing.`
        );
      }
    }
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
    costedRateIsBatch: batch !== null,
    greigeProvenance,
  };
  const priceChanged = Math.abs(total - oldTotal) > PRICE_EPSILON;
  return { costing, slabMetres, slabLabel, batch, priceChanged, notes };
}
