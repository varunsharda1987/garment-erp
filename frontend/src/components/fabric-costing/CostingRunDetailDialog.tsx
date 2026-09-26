/**
 * How a costing run was done: every fabric's costing as it was when the run was saved, built up
 * line by line (greige → transport → processing → shrinkage → screen = ₹/m × CAD average = ₹/garment),
 * with today's figure beside any fabric re-costed since.
 *
 * The figures are the run's own frozen record (fabric_costing_run_items), not the live CAD rows —
 * so Run 1 still reads as it was saved after Run 2 re-costs the same fabrics.
 * Opened from the Fabric Costing page's run cards and the Cost Sheet form's run chips.
 */
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, History, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency';
import { formatDate, formatDateTime } from '@/lib/date';
import { formatQuantity } from '@/lib/formatters';
import { getRunById, type CostingRun, type CostingRunFabric } from '../../services/fabricCostingRun.service';
import { PRINTING_TYPE_LABELS, type PrintingTypeV2 } from '../../types/processorRateCardV2.types';

const MODE_LABEL: Record<string, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw Mat Calculation',
};

const GREIGE_SOURCE_TEXT: Record<NonNullable<CostingRunFabric['greigeRateSource']>, string> = {
  PURCHASE_ORDER: 'from PO',
  PROCUREMENT: 'from a purchase',
  STOCK_VALUATION: 'from a stock lot',
  GREIGE_MASTER: 'Greige Master default',
  MANUAL_OVERRIDE: 'typed by hand',
};

const perMeter = (v: number | null) => (v == null ? '—' : `${formatCurrency(v)} / m`);

/** "DYEING" → "Dyeing" */
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

function greigeNote(f: CostingRunFabric): string | null {
  if (!f.greigeRateSource) return null;
  const parts = [GREIGE_SOURCE_TEXT[f.greigeRateSource]];
  if (f.greigeRateSourceRef && f.greigeRateSource === 'PURCHASE_ORDER') parts[0] += ` ${f.greigeRateSourceRef}`;
  if (f.greigeRateSourceDate) parts.push(formatDate(f.greigeRateSourceDate));
  if (f.greigeRateSource === 'MANUAL_OVERRIDE' && f.greigeRateOverrideReason) {
    parts.push(`reason: ${f.greigeRateOverrideReason}`);
  }
  return parts.join(' · ');
}

function processingNote(f: CostingRunFabric): string | null {
  const parts = [
    f.processor?.name ?? null,
    f.processingType ? titleCase(f.processingType) : null,
    f.printingType ? (PRINTING_TYPE_LABELS[f.printingType as PrintingTypeV2] ?? titleCase(f.printingType)) : null,
    f.numberOfColors ? `${f.numberOfColors} colour${f.numberOfColors === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function BreakdownLine({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
      <div className="min-w-0">
        <span className="text-foreground">{label}</span>
        {note && <span className="ml-2 text-xs text-muted-foreground">{note}</span>}
      </div>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

function PriceApprovalBadge({ status }: { status: string | null }) {
  if (status === 'APPROVED') return <Badge className="bg-success-muted text-success text-xs">Price approved</Badge>;
  if (status === 'ALTERNATE_APPROVED')
    return <Badge className="bg-warning-muted text-warning text-xs">Alternate width</Badge>;
  return (
    <Badge variant="outline" className="text-xs">
      Price not yet approved
    </Badge>
  );
}

function FabricBreakdown({ f }: { f: CostingRunFabric }) {
  const landed = f.costInputMode === 'LANDED_PRICE';
  const greigeLabel = f.greige ? [f.greige.greigeCode, f.greige.greigeName].filter(Boolean).join(' — ') : null;
  const qtyParts = [
    f.orderQuantityPcs != null ? `costed for ${formatQuantity(f.orderQuantityPcs, 'PCS', 0)}` : null,
    f.costedAtQuantityMeters != null ? `${formatQuantity(f.costedAtQuantityMeters, 'METER')} of fabric` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">
            {f.componentName || 'Fabric'}
            {f.cutableWidth != null && (
              <span className="text-muted-foreground font-normal"> · {f.cutableWidth}" wide</span>
            )}
          </div>
          {greigeLabel && <div className="text-xs text-muted-foreground">{greigeLabel}</div>}
        </div>
        <div className="flex flex-wrap gap-1">
          <PriceApprovalBadge status={f.costingApprovalStatus} />
          {f.change === 'CHANGED' && (
            <Badge className="bg-warning-muted text-warning border-warning/25 text-xs">Re-costed since this run</Badge>
          )}
          {f.change === 'REMOVED' && (
            <Badge variant="outline" className="text-destructive border-destructive/40 text-xs">
              Costing removed since
            </Badge>
          )}
        </div>
      </div>

      {(qtyParts.length > 0 || f.costedRateIsBatch) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {qtyParts.join(', ')}
          {f.costedRateIsBatch &&
            ` — batch rate: priced together with the style's other ${f.batchColorName ?? 'same-colour'} fabrics`}
        </p>
      )}

      <div className="mt-3 divide-y">
        {landed ? (
          <BreakdownLine
            label="Landed price"
            note="entered as one figure, no build-up"
            value={perMeter(f.totalCostPerMeter)}
          />
        ) : (
          <>
            <BreakdownLine label="Greige" note={greigeNote(f)} value={perMeter(f.greigeCostPerMeter)} />
            {f.transportCostPerMeter != null && (
              <BreakdownLine label="+ Transport" value={perMeter(f.transportCostPerMeter)} />
            )}
            {(f.processingPricePerMeter != null || f.processor) && (
              <BreakdownLine
                label="+ Processing"
                note={processingNote(f)}
                value={perMeter(f.processingPricePerMeter)}
              />
            )}
            {(f.shrinkageCostPerMeter != null || f.shrinkagePercent != null) && (
              <BreakdownLine
                label="+ Shrinkage"
                note={f.shrinkagePercent != null ? `${f.shrinkagePercent}% loss in processing` : null}
                value={perMeter(f.shrinkageCostPerMeter)}
              />
            )}
            {f.screenCostPerMeter != null && (
              <BreakdownLine
                label="+ Screen"
                note={f.screenType ? titleCase(f.screenType) : null}
                value={perMeter(f.screenCostPerMeter)}
              />
            )}
            <div className="flex items-baseline justify-between gap-4 py-1 text-sm font-medium">
              <span>= Fabric cost</span>
              <span className="tabular-nums">{perMeter(f.totalCostPerMeter)}</span>
            </div>
          </>
        )}
        <div className="flex items-baseline justify-between gap-4 pt-2 text-sm">
          <span className="text-muted-foreground">
            × CAD average {f.cadAverage != null ? formatQuantity(f.cadAverage, 'METER', 4) : '—'} per piece
          </span>
          <span className="font-semibold tabular-nums">
            {f.costPerGarment != null ? `${formatCurrency(f.costPerGarment)} / garment` : 'Not costed'}
          </span>
        </div>
      </div>

      {f.change === 'CHANGED' && f.now && (
        <p className="mt-2 rounded bg-warning-muted/50 px-2 py-1 text-xs text-warning">
          Today: {perMeter(f.now.totalCostPerMeter)}
          {f.now.cadAverage != null && ` × ${formatQuantity(f.now.cadAverage, 'METER', 4)}`}
          {f.now.costPerGarment != null && ` = ${formatCurrency(f.now.costPerGarment)} / garment`}
        </p>
      )}
      {f.laterRunName && (
        <p className="mt-1 text-xs text-muted-foreground">This fabric was saved again in {f.laterRunName}.</p>
      )}
    </div>
  );
}

function RunSummary({ run }: { run: CostingRun }) {
  const quantities = [...new Set(run.fabrics.map((f) => f.orderQuantityPcs).filter((q): q is number => q != null))];
  const savedBy = run.createdBy ? `${run.createdBy.firstName} ${run.createdBy.lastName}`.trim() : null;
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-4">
      <div>
        <div className="text-xs text-muted-foreground">Saved</div>
        <div>{formatDateTime(run.createdAt)}</div>
        {savedBy && <div className="text-xs text-muted-foreground">by {savedBy}</div>}
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Order quantity</div>
        <div>{quantities.length ? quantities.map((q) => formatQuantity(q, 'PCS', 0)).join(', ') : '—'}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Fabrics</div>
        <div>
          {run.fabricCount}{' '}
          {run.isComplete ? (
            <Badge className="ml-1 bg-success-muted text-success text-xs">Complete</Badge>
          ) : (
            <Badge className="ml-1 bg-warning/10 text-warning text-xs">Incomplete</Badge>
          )}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Fabric cost</div>
        <div className="font-semibold">{formatCurrency(run.totalFabricCost ?? 0)} / garment</div>
      </div>
    </div>
  );
}

interface CostingRunDetailDialogProps {
  /** The run to show; null closes the dialog */
  runId: string | null;
  onClose: () => void;
}

export function CostingRunDetailDialog({ runId, onClose }: CostingRunDetailDialogProps) {
  const {
    data: run,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['fabric-costing-run', runId],
    queryFn: () => getRunById(runId as string),
    enabled: !!runId,
  });

  const recordedOn = run?.fabrics.find((f) => f.backfilled)?.recordedAt;

  return (
    <Dialog open={!!runId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {run ? `${run.runName} — ${MODE_LABEL[run.purpose] ?? run.purpose}` : 'Costing run'}
          </DialogTitle>
          <DialogDescription>
            {run?.style
              ? `${run.style.styleCode}${run.style.styleName ? ` · ${run.style.styleName}` : ''} — how each fabric was costed when this run was saved`
              : 'How each fabric was costed when this run was saved'}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading run…
          </div>
        )}
        {isError && <p className="py-6 text-center text-destructive">Could not load this run.</p>}

        {run && (
          <div className="space-y-4">
            <RunSummary run={run} />

            {run.backfilled && (
              <p className="rounded-md border border-info/20 bg-info-muted px-3 py-2 text-xs text-info">
                This run was saved before runs kept their own record. Its figures were recorded
                {recordedOn ? ` on ${formatDate(recordedOn)}` : ' later'}, from the costing as it stood then.
              </p>
            )}
            {run.changedCount > 0 && (
              <p className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-muted px-3 py-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {run.changedCount} fabric{run.changedCount === 1 ? ' has' : 's have'} been changed since this run. The
                run keeps its own figures; today's are shown beside them.
              </p>
            )}

            {run.fabrics.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No fabrics were recorded for this run.</p>
            ) : (
              run.fabrics.map((f) => <FabricBreakdown key={f.id} f={f} />)
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
