/**
 * Costing run items — each run's own record of how its fabrics were costed (2026-09-26).
 *
 * A fabric costing run used to be only a pointer: fabric_width_cad.costingRunId. A CAD row holds ONE
 * run id, so saving the same rows into Run 2 emptied Run 1, and re-costing a row silently rewrote
 * every run that pointed at it — "how was Run 1 done?" had no answer. fabric_costing_run_items
 * freezes each fabric's costing when the run is saved; the frozen figures are never rewritten.
 *
 *   freezeRunItems(tx, runId, cadIds)  — the ONLY writer (run create; the one-off backfill)
 *   presentRunItem(item, runId)        — the run's line as the API returns it, beside today's costing
 *   RUN_ITEM_LIVE_INCLUDE              — the include presentRunItem needs
 *
 * costingRunId stays what it was: the row's LATEST run. The run's record is its items.
 */

import { Prisma } from '@prisma/client';
import { multiplyCurrency, roundToCent } from '../../utils/currency';

type Tx = Prisma.TransactionClient;

const CAD_FREEZE_SELECT = {
  id: true,
  componentName: true,
  cutableWidth: true,
  cadAverage: true,
  orderQuantityPcs: true,
  costedAtQuantityMeters: true,
  costedRateIsBatch: true,
  costInputMode: true,
  greigeCostPerMeter: true,
  greigeRateSource: true,
  greigeRateSourceRef: true,
  greigeRateSourceDate: true,
  greigeRateOverrideReason: true,
  transportCostPerMeter: true,
  processorId: true,
  numberOfColors: true,
  processingPricePerMeter: true,
  shrinkagePercent: true,
  shrinkageCostPerMeter: true,
  screenType: true,
  screenCostPerMeter: true,
  totalCostPerMeter: true,
  costingApprovalStatus: true,
  greige: { select: { greigeCode: true, greigeName: true } },
  processor: { select: { name: true } },
  rateCard: { select: { processingType: true, printingType: true } },
  batchGroupColor: { select: { colorName: true } },
} satisfies Prisma.fabric_width_cadSelect;

/**
 * Freeze the given CAD rows' costing onto the run. Lines keep the caller's order (the order of the
 * rows on the Fabric Costing page). `backfilled` marks lines recorded after the fact.
 */
export async function freezeRunItems(
  tx: Tx,
  runId: string,
  cadIds: string[],
  opts: { backfilled?: boolean } = {}
): Promise<number> {
  if (cadIds.length === 0) return 0;
  const cads = await tx.fabric_width_cad.findMany({ where: { id: { in: cadIds } }, select: CAD_FREEZE_SELECT });
  const position = new Map(cadIds.map((id, i) => [id, i]));
  cads.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));

  await tx.fabric_costing_run_items.createMany({
    data: cads.map((c, i) => ({
      runId,
      cadId: c.id,
      sortOrder: i,
      backfilled: opts.backfilled === true,
      componentName: c.componentName,
      greigeCode: c.greige?.greigeCode ?? null,
      greigeName: c.greige?.greigeName ?? null,
      cutableWidth: c.cutableWidth,
      cadAverage: c.cadAverage,
      orderQuantityPcs: c.orderQuantityPcs,
      costedAtQuantityMeters: c.costedAtQuantityMeters,
      costedRateIsBatch: c.costedRateIsBatch,
      batchColorName: c.costedRateIsBatch ? (c.batchGroupColor?.colorName ?? null) : null,
      costInputMode: c.costInputMode,
      greigeCostPerMeter: c.greigeCostPerMeter,
      greigeRateSource: c.greigeRateSource,
      greigeRateSourceRef: c.greigeRateSourceRef,
      greigeRateSourceDate: c.greigeRateSourceDate,
      greigeRateOverrideReason: c.greigeRateOverrideReason,
      transportCostPerMeter: c.transportCostPerMeter,
      processorId: c.processorId,
      processorName: c.processor?.name ?? null,
      processingType: c.rateCard?.processingType ?? null,
      printingType: c.rateCard?.printingType ?? null,
      numberOfColors: c.numberOfColors,
      processingPricePerMeter: c.processingPricePerMeter,
      shrinkagePercent: c.shrinkagePercent,
      shrinkageCostPerMeter: c.shrinkageCostPerMeter,
      screenType: c.screenType,
      screenCostPerMeter: c.screenCostPerMeter,
      totalCostPerMeter: c.totalCostPerMeter,
      costingApprovalStatus: c.costingApprovalStatus,
    })),
  });
  return cads.length;
}

/** What presentRunItem compares each frozen line against: the CAD row as it is today. */
export const RUN_ITEM_LIVE_INCLUDE = {
  cad: {
    select: {
      cadAverage: true,
      totalCostPerMeter: true,
      costingStyleId: true,
      costingRunId: true,
      costingRun: { select: { runName: true } },
    },
  },
} satisfies Prisma.fabric_costing_run_itemsInclude;

type RunItemWithLive = Prisma.fabric_costing_run_itemsGetPayload<{ include: typeof RUN_ITEM_LIVE_INCLUDE }>;

const num = (v: Prisma.Decimal | null | undefined): number | null => (v == null ? null : Number(v));

function perGarment(avg: Prisma.Decimal | null, rate: Prisma.Decimal | null): number | null {
  if (avg == null || rate == null) return null;
  return Number(roundToCent(multiplyCurrency(avg, rate)));
}

const sameDecimal = (a: Prisma.Decimal | null, b: Prisma.Decimal | null) =>
  a == null || b == null ? a == b : a.equals(b);

/**
 * One frozen line as the API returns it. Keeps the old run-fabric keys (componentName, greige,
 * cutableWidth, cadAverage, totalCostPerMeter, processor) that the Cost Sheet's "load from run" reads,
 * so loading a run loads the run's own figures.
 *
 * change: null = today's costing of that row still says the same; 'CHANGED' = re-costed since
 * (rate or CAD average differs — `now` holds today's); 'REMOVED' = the row's costing was removed or
 * the row deleted.
 */
export function presentRunItem(item: RunItemWithLive, runId: string) {
  const live = item.cad;
  const liveCosted = live != null && live.costingStyleId != null && live.totalCostPerMeter != null;
  const change: 'CHANGED' | 'REMOVED' | null = !liveCosted
    ? 'REMOVED'
    : !sameDecimal(item.totalCostPerMeter, live.totalCostPerMeter) || !sameDecimal(item.cadAverage, live.cadAverage)
      ? 'CHANGED'
      : null;

  return {
    id: item.id,
    cadId: item.cadId,
    backfilled: item.backfilled,
    /** When this line was frozen — the run's save, or the later backfill when `backfilled` */
    recordedAt: item.createdAt,
    componentName: item.componentName,
    greige: item.greigeCode || item.greigeName ? { greigeCode: item.greigeCode, greigeName: item.greigeName } : null,
    cutableWidth: num(item.cutableWidth),
    cadAverage: num(item.cadAverage),
    orderQuantityPcs: item.orderQuantityPcs,
    costedAtQuantityMeters: num(item.costedAtQuantityMeters),
    costedRateIsBatch: item.costedRateIsBatch,
    batchColorName: item.batchColorName,
    costInputMode: item.costInputMode,
    greigeCostPerMeter: num(item.greigeCostPerMeter),
    greigeRateSource: item.greigeRateSource,
    greigeRateSourceRef: item.greigeRateSourceRef,
    greigeRateSourceDate: item.greigeRateSourceDate,
    greigeRateOverrideReason: item.greigeRateOverrideReason,
    transportCostPerMeter: num(item.transportCostPerMeter),
    processor: item.processorId ? { id: item.processorId, name: item.processorName } : null,
    processingType: item.processingType,
    printingType: item.printingType,
    numberOfColors: item.numberOfColors,
    processingPricePerMeter: num(item.processingPricePerMeter),
    shrinkagePercent: num(item.shrinkagePercent),
    shrinkageCostPerMeter: num(item.shrinkageCostPerMeter),
    screenType: item.screenType,
    screenCostPerMeter: num(item.screenCostPerMeter),
    totalCostPerMeter: num(item.totalCostPerMeter),
    costPerGarment: perGarment(item.cadAverage, item.totalCostPerMeter),
    costingApprovalStatus: item.costingApprovalStatus,
    change,
    now:
      change === 'CHANGED' && live
        ? {
            totalCostPerMeter: num(live.totalCostPerMeter),
            cadAverage: num(live.cadAverage),
            costPerGarment: perGarment(live.cadAverage, live.totalCostPerMeter),
          }
        : null,
    // The row was saved again into a later run (its latest-run pointer moved on)
    laterRunName: live?.costingRunId && live.costingRunId !== runId ? (live.costingRun?.runName ?? null) : null,
  };
}
