/**
 * Than picker — tick which thans (pieces, grouped in bales) of ONE greige lot leave the godown.
 *
 * Than metres are COUNTED (the tag figure at the lot's fold length L); lots and jobs are ACTUAL.
 * Per-than checks stay counted-vs-counted; the running total is shown both ways and converted once,
 * the same way the server converts the picks (see `thanPickActual` in ./lot-rows).
 *
 * Used by the issue lot rows (Issue dialog, Dispatch to Processor) and by "Record thans sent".
 */
import { useState } from 'react';
import { Boxes, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { GreigeLotThans, GreigeStockDetail } from '@/services/jobWorkOrder.service';
import { hasFold } from '@/lib/fold-length';
import { formatQuantity } from '@/lib/formatters';
import { isQtyZero, prefillQty, qtyExceeds, qtyRemaining } from '@/lib/quantity';
import {
  autoPickThans,
  bestFitThans,
  THAN_PICK_TOLERANCE_PCT,
  baleCountOf,
  groupDetailsByBale,
  hasDetailOverSelection,
  thanLabel,
  thanPickActual,
  totalDetailMeters,
  type SelectedDetail,
} from './lot-rows';

export interface ThanPickerProps {
  lotThans: GreigeLotThans;
  selected: SelectedDetail[];
  onChange: (selected: SelectedDetail[]) => void;
  /** ACTUAL metres "Pick thans for me" aims for (0 disables it) */
  targetActual: number;
  uom: string;
  disabled?: boolean;
  /**
   * false when recording thans on a job already issued by quantity: the lot's stock has already
   * left, so taking every than must not snap the total to what the lot now holds.
   */
  snapToLot?: boolean;
}

export function ThanPicker({
  lotThans,
  selected,
  onChange,
  targetActual,
  uom,
  disabled = false,
  snapToLot = true,
}: ThanPickerProps) {
  const [fitNote, setFitNote] = useState<string | null>(null);
  const groups = groupDetailsByBale(lotThans.details);
  const selectedById = new Map(selected.map((d) => [d.detailId, d]));
  const overSelections = hasDetailOverSelection(selected, lotThans.details);
  const pickedCounted = totalDetailMeters(selected);
  const pickedActual = thanPickActual(selected, lotThans, snapToLot);
  const folded = hasFold(lotThans.foldLengthCm);
  const thanCount = lotThans.details.length;
  const baleCount = baleCountOf(lotThans);

  const toggle = (detail: GreigeStockDetail, checked: boolean) => {
    if (checked) {
      onChange([...selected, { detailId: detail.id, metersToIssue: prefillQty(detail.metersRemaining) }]);
    } else {
      onChange(selected.filter((d) => d.detailId !== detail.id));
    }
  };

  const setMeters = (detailId: string, metersToIssue: string) =>
    onChange(selected.map((d) => (d.detailId === detailId ? { ...d, metersToIssue } : d)));

  if (thanCount === 0) {
    return <p className="text-sm text-muted-foreground">No thans of this lot are left in the godown.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-md text-xs text-muted-foreground">
          This lot has {thanCount} thans in {baleCount} bales — tick the thans you&apos;re sending so the godown list
          stays right.
          {folded && <> Than metres are counted at fold L={lotThans.foldLengthCm} cm; the job is in actual metres.</>}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(autoPickThans(lotThans, targetActual))}
          disabled={disabled || isQtyZero(targetActual)}
        >
          <Wand2 className="mr-1 h-3.5 w-3.5" />
          Pick thans for me
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const fit = bestFitThans(lotThans, targetActual);
            if (!fit) {
              setFitNote(
                `No set of whole thans lands within ${THAN_PICK_TOLERANCE_PCT}% of the job — use Pick thans for me (it cuts the last than).`
              );
              return;
            }
            onChange(fit.picks);
            const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
            const parts = [plural(fit.balesWhole, 'whole bale')];
            if (fit.balesBroken > 0) parts.push(plural(fit.balesBroken, 'bale') + ' broken');
            if (fit.openBalesFinished > 0) parts.push(plural(fit.openBalesFinished, 'opened bale') + ' finished');
            setFitNote(
              `${parts.join(', ')} — ${formatQuantity(fit.actual, uom)} actual (within ${THAN_PICK_TOLERANCE_PCT}%), no than cut.`
            );
          }}
          disabled={disabled || isQtyZero(targetActual)}
        >
          <Boxes className="mr-1 h-3.5 w-3.5" />
          Best fit (whole thans)
        </Button>
      </div>
      {fitNote && <p className="text-xs text-muted-foreground">{fitNote}</p>}

      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.baleNumber ?? 'unbaled'} className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              {group.baleLabel ? `Bale ${group.baleLabel}` : 'Thans outside a bale'}
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {group.thans.map((detail) => {
                const selection = selectedById.get(detail.id);
                const over = overSelections.find((o) => o.detailId === detail.id);
                return (
                  <div key={detail.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`than-${detail.id}`}
                      checked={!!selection}
                      disabled={disabled}
                      onCheckedChange={(checked) => toggle(detail, checked === true)}
                    />
                    <label htmlFor={`than-${detail.id}`} className="flex-1 cursor-pointer text-sm">
                      {thanLabel(detail)}
                      <span className="ml-1 text-muted-foreground">
                        ({formatQuantity(detail.metersRemaining, uom)}
                        {qtyExceeds(detail.meters, detail.metersRemaining) &&
                          ` of ${formatQuantity(detail.meters, uom)}`}
                        {folded ? ' counted' : ''})
                      </span>
                    </label>
                    {selection && (
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        max={detail.metersRemaining}
                        className="h-7 w-24 text-sm"
                        value={selection.metersToIssue}
                        disabled={disabled}
                        onChange={(e) => setMeters(detail.id, e.target.value)}
                        aria-label={`Counted metres to send from ${thanLabel(detail)}`}
                      />
                    )}
                    {over && <span className="text-xs text-red-600">{formatQuantity(over.over, uom, 3)} over</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
        <span className="font-medium">
          Selected: {selected.length} than{selected.length === 1 ? '' : 's'} ·{' '}
          {folded
            ? `${formatQuantity(pickedCounted, uom)} counted = ${formatQuantity(pickedActual, uom)} actual`
            : formatQuantity(pickedActual, uom)}
        </span>
        {!isQtyZero(targetActual) && (
          <span className="text-xs text-muted-foreground">
            Needed: {formatQuantity(targetActual, uom)}
            {folded ? ' actual' : ''}
            {selected.length > 0 && qtyExceeds(targetActual, pickedActual)
              ? ` · ${formatQuantity(qtyRemaining(targetActual, pickedActual), uom)} still to pick`
              : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export default ThanPicker;
