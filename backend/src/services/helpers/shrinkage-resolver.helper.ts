/**
 * Shrinkage resolution — the single rule for "how much does this greige lose in processing".
 *
 * MRP-31/48: shared by MRP planning (which turns it into a purchase quantity) and the Order BOM
 * view (which shows the buyer what that quantity will be). They previously disagreed: MRP applied
 * shrinkage, the BOM page did not, so the BOM understated the greige an order actually consumes.
 * One helper, one answer.
 *
 * Authority order:
 *  1. the attached **processor rate card** — the only record keyed on what actually determines
 *     loss (which processor, dyeing vs printing, which print type, which greige);
 *  2. the card resolvable from processor + greige, when the BOM line carries no rateCardId;
 *  3. the **greige master average** — a labelled fallback;
 *  4. none — plan flat, and let the caller say so.
 *
 * There is deliberately no hard-coded literal here. A missing value returns 0 with source 'NONE'
 * rather than inventing an allowance.
 */
import { findRateCardsForShrinkage } from '../processor-rate-v2.service';

export type ShrinkageSource = 'RATE_CARD' | 'RATE_CARD_RESOLVED' | 'GREIGE_MASTER_FALLBACK' | 'NONE';

export interface ShrinkageResolution {
  percent: number;
  source: ShrinkageSource;
  /** Populated only when several cards disagree and we refused to pick — for the caller's warning. */
  competingValues?: string[];
}

export async function resolveShrinkagePercent(bomItem: {
  rateCard?: { shrinkagePercent?: unknown } | null;
  greige?: { averageShrinkagePercent?: unknown } | null;
  greigeId?: string | null;
  processorId?: string | null;
}): Promise<ShrinkageResolution> {
  // 1. The rate card explicitly attached to this BOM line.
  const cardValue = bomItem.rateCard?.shrinkagePercent;
  if (cardValue !== null && cardValue !== undefined) {
    return { percent: Number(cardValue), source: 'RATE_CARD' };
  }

  // 2. No rateCardId on the line, but it still names the processor and the greige — enough to
  // find the card. Only accepted when unambiguous: if a processor holds several different
  // shrinkage values for one greige there is no safe way to choose, because the BOM line has no
  // print-type column, and a wrong pick changes the quantity purchased.
  let competingValues: string[] | undefined;
  if (bomItem.greigeId && bomItem.processorId) {
    const { cards, distinctPercents, unambiguous } = await findRateCardsForShrinkage(
      bomItem.processorId,
      bomItem.greigeId
    );
    if (unambiguous) {
      return { percent: unambiguous.shrinkagePercent, source: 'RATE_CARD_RESOLVED' };
    }
    if (distinctPercents.length > 1) {
      competingValues = cards.map(
        (c) => `${c.processingType}${c.printingType ? '/' + c.printingType : ''}=${c.shrinkagePercent}%`
      );
    }
  }

  // 3. Labelled fallback.
  const masterValue = bomItem.greige?.averageShrinkagePercent;
  if (masterValue !== null && masterValue !== undefined) {
    return { percent: Number(masterValue), source: 'GREIGE_MASTER_FALLBACK', competingValues };
  }
  return { percent: 0, source: 'NONE', competingValues };
}

/**
 * MRP-48i: the expected shrinkage to stamp on a job work order.
 *
 * `job_work_orders.expectedShrinkage` is what the processor is held to — the challan prints the
 * expected return quantity from it (`1 - expectedShrinkage/100`), so a null means the document
 * says "return 100% of what I sent", which no dyer can do. The dyeing/printing create endpoints
 * took this straight from the request body, so an API call that simply omitted it produced
 * exactly that.
 *
 * An explicitly supplied value still wins — there are legitimate reasons to override for one job.
 * This only fills the gap, from the processor's own committed rate, instead of leaving it blank.
 */
export async function resolveJwoExpectedShrinkage(params: {
  supplied?: number | null;
  processorId?: string | null;
  greigeId?: string | null;
}): Promise<number | null> {
  if (params.supplied !== undefined && params.supplied !== null) {
    return Number(params.supplied);
  }
  if (!params.processorId || !params.greigeId) return null;
  const { unambiguous } = await findRateCardsForShrinkage(params.processorId, params.greigeId);
  return unambiguous ? unambiguous.shrinkagePercent : null;
}
