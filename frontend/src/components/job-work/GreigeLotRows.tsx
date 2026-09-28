/**
 * Greige lot rows — the CONTROL. Its rules live in ./lot-rows so this file only exports a
 * component (React Fast Refresh requires that split).
 *
 * Supports two issue modes:
 * - Simple mode: Just lot + quantity (internal/cutting issuance)
 * - Than mode (`enableDetailSelection`, processor issuance): when a chosen lot has thans, the
 *   picker opens so the operator ticks the thans that leave. Picking is optional — collapsing the
 *   picker falls back to a typed quantity — but it is the default path, because thans that leave
 *   unnamed leave the godown list wrong.
 *
 * `row.qty` is always ACTUAL metres. With thans picked it is derived from them (counted metres
 * converted once at the lot's fold length), so the totals, the lot-availability check and the
 * order-quantity match below all stay in actual metres.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Wand2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { GreigeLotThans, JwoIssuePreviewLot } from '@/services/jobWorkOrder.service';
import { jobWorkOrderService } from '@/services/jobWorkOrder.service';
import { qtyExceeds } from '@/lib/quantity';
import { usePermissions } from '@/hooks/usePermissions';
import { ThanPicker } from './ThanPicker';
import { RecordLotPiecesDialog } from './RecordLotPiecesDialog';
import {
  autoFillLotRows,
  emptyLotRow,
  groupLotsForIssue,
  lotOptionLabel,
  lotHasThans,
  lotRowTarget,
  noListNote,
  pieceKindOf,
  pieceWord,
  rowHasPicks,
  withPicks,
  type IssueLotRow,
  type LotRowsEvaluation,
  type SelectedDetail,
} from './lot-rows';

export interface GreigeLotRowsProps {
  rows: IssueLotRow[];
  onRowsChange: (rows: IssueLotRow[]) => void;
  lots: JwoIssuePreviewLot[];
  requiredQty: number;
  uom: string;
  evaluation: LotRowsEvaluation;
  /** Greige orders must consume material; optional-lot service work legitimately consumes none. */
  required?: boolean;
  /** Service work with no material at all — the running total is then not a shortfall. */
  allowNoLot?: boolean;
  disabled?: boolean;
  /** Omit the "Greige Lots" heading row when the caller already has its own header. */
  hideHeader?: boolean;
  /** Let the operator pick the bales/thans that leave (processor issuance). */
  enableDetailSelection?: boolean;
  /** The job's processor — names the "Already at …" section of the lot list. */
  processorName?: string;
  /** The quantity is fixed by the caller (Send to Mill: the whole job from one lot) */
  lockQty?: boolean;
}

export function GreigeLotRows({
  rows,
  onRowsChange,
  lots,
  requiredQty,
  uom,
  evaluation,
  required = true,
  allowNoLot = false,
  disabled = false,
  hideHeader = false,
  enableDetailSelection = false,
  processorName = 'the processor',
  lockQty = false,
}: GreigeLotRowsProps) {
  const { can } = usePermissions();
  // The lot whose bales / thans / rolls are being recorded ("Record bales & thans")
  const [recordLotId, setRecordLotId] = useState<string | null>(null);

  // Pieces per lot, one query per chosen lot. The key is shared with "Record bales & thans" and the
  // job's "Record thans sent", so a count reaches every open screen that shows the lot.
  const lotIds = [...new Set(rows.map((r) => r.lotId).filter(Boolean))];
  const pieceQueries = useQueries({
    queries: lotIds.map((lotId) => ({
      queryKey: ['greige-lot-thans', lotId],
      queryFn: () => jobWorkOrderService.getAvailableDetails(lotId),
      enabled: enableDetailSelection,
      staleTime: 0,
      retry: false,
    })),
  });
  const thansByLot: Record<string, GreigeLotThans> = {};
  const loadingLots = new Set<string>();
  lotIds.forEach((lotId, i) => {
    const query = pieceQueries[i];
    if (query?.data) thansByLot[lotId] = query.data;
    else if (query?.isLoading) loadingLots.add(lotId);
  });

  // A lot whose pieces could not be loaded still goes by quantity — say so once per lot
  const failedLots = useRef<Set<string>>(new Set());
  useEffect(() => {
    lotIds.forEach((lotId, i) => {
      const query = pieceQueries[i];
      if (!query?.isError || failedLots.current.has(lotId)) return;
      failedLots.current.add(lotId);
      toast.error('Could not load the bales / thans of this lot', {
        description: `${query.error instanceof Error ? query.error.message : 'The request failed'} — you can still send it by quantity.`,
      });
    });
  }, [lotIds, pieceQueries]);

  const updateRow = useCallback(
    (index: number, patch: Partial<IssueLotRow>) =>
      onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))),
    [rows, onRowsChange]
  );

  // Attach loaded pieces to their rows — and re-attach when they change (a count, another issue). A lot
  // that goes from no pieces to some opens its picker; picks that no longer exist are dropped.
  useEffect(() => {
    if (!enableDetailSelection) return;
    if (!rows.some((r) => r.lotId && thansByLot[r.lotId] && r.lotThans !== thansByLot[r.lotId])) return;
    onRowsChange(
      rows.map((r) => {
        const loaded = r.lotId ? thansByLot[r.lotId] : undefined;
        if (!loaded || r.lotThans === loaded) return r;
        const hadPieces = (r.lotThans?.details.length ?? 0) > 0;
        const live = new Set(loaded.details.map((d) => d.id));
        const kept = (r.selectedDetails ?? []).filter((d) => live.has(d.detailId));
        const next: IssueLotRow = {
          ...r,
          lotThans: loaded,
          detailsExpanded: hadPieces ? r.detailsExpanded : loaded.details.length > 0,
        };
        return kept.length > 0
          ? withPicks(next, kept)
          : { ...next, selectedDetails: r.selectedDetails ? [] : undefined };
      })
    );
  }, [enableDetailSelection, rows, thansByLot, onRowsChange]);

  const addRow = () => onRowsChange([...rows, emptyLotRow()]);
  const removeRow = (index: number) => onRowsChange(rows.filter((_, i) => i !== index));
  // Sections by where the lots are; headings only when there is something to tell apart
  const lotGroups = groupLotsForIssue(lots, processorName);
  const showGroupLabels = lotGroups.length > 1 || lots.some((lot) => lot.location);

  const autoFill = () => {
    const filled = autoFillLotRows(lots, requiredQty, rows);
    if (filled) onRowsChange(filled);
  };

  /**
   * The ACTUAL metres "Pick thans for me" aims for on a row: the quantity typed on it, else what the
   * order still needs after the other rows — never more than the lot holds.
   */
  const rowTarget = (index: number): number => lotRowTarget(rows, index, requiredQty, lots);

  const setPicks = (index: number, selected: SelectedDetail[]) =>
    onRowsChange(rows.map((row, i) => (i === index ? withPicks(row, selected) : row)));

  // Collapsing the picker means "send by quantity": the picks go, the actual quantity stays editable.
  const toggleDetails = (index: number) => {
    const row = rows[index];
    if (row.detailsExpanded) updateRow(index, { detailsExpanded: false, selectedDetails: [] });
    else updateRow(index, { detailsExpanded: true });
  };

  return (
    <div className="space-y-2">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <Label>
            Greige Lots {required ? '*' : '(optional)'}
            {enableDetailSelection && (
              <span className="ml-1 text-xs text-muted-foreground">(pick bales, thans or rolls)</span>
            )}
          </Label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={autoFill} disabled={disabled || lots.length === 0}>
              <Wand2 className="mr-1 h-3.5 w-3.5" />
              Auto-fill
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              disabled={disabled || evaluation.unusedLotCount === 0}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add lot
            </Button>
          </div>
        </div>
      )}

      {rows.map((row, index) => {
        const lot = row.lotId ? lots.find((l) => l.id === row.lotId) : undefined;
        const rowQty = parseFloat(row.qty);
        const overAvailable = !!lot && qtyExceeds(rowQty, lot.quantityAvailable);
        const isLoading = row.lotId ? loadingLots.has(row.lotId) : false;
        const picking = rowHasPicks(row);
        const canPick = enableDetailSelection && lotHasThans(row);
        // Loaded, and nothing to tick: the lot goes by quantity — say so, never block
        const nothingToPick = enableDetailSelection && !!row.lotId && !!row.lotThans && !lotHasThans(row);
        const pieces = pieceWord(pieceKindOf(row.lotThans), 2);

        // Disabling lots taken by another row is what keeps LOT_DUPLICATE from ever reaching the server
        const takenElsewhere = new Set(
          rows
            .filter((_, i) => i !== index)
            .map((other) => other.lotId)
            .filter(Boolean)
        );

        return (
          <div key={index} className="space-y-1">
            <div className="flex items-start gap-2">
              {/* Than picker toggle — only for a lot that has thans */}
              {enableDetailSelection && row.lotId && (isLoading || canPick) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => toggleDetails(index)}
                  disabled={disabled || isLoading}
                  aria-label={row.detailsExpanded ? `Hide the ${pieces}` : `Show the ${pieces}`}
                >
                  {isLoading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : row.detailsExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}

              <div className="flex-1">
                <Select
                  value={row.lotId || 'none'}
                  onValueChange={(v) => {
                    const newLotId = v === 'none' ? '' : v;
                    // Thans belong to a lot: a new lot starts with none picked
                    updateRow(index, {
                      lotId: newLotId,
                      lotThans: undefined,
                      selectedDetails: undefined,
                      detailsExpanded: false,
                    });
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select greige lot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Select a lot --</SelectItem>
                    {lotGroups.map((group) => (
                      <SelectGroup key={group.key}>
                        {showGroupLabels && <SelectLabel>{group.label}</SelectLabel>}
                        {group.lots.map((option) => (
                          <SelectItem key={option.id} value={option.id} disabled={takenElsewhere.has(option.id)}>
                            {lotOptionLabel(option, uom)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                type="number"
                step="any"
                min="0"
                className="w-32"
                value={row.qty}
                // Picked thans decide the quantity; untick them (or collapse the picker) to type one
                disabled={disabled || picking || lockQty}
                onChange={(e) => updateRow(index, { qty: e.target.value })}
                placeholder={`Qty ${uom}`}
                aria-label={`Quantity for lot ${index + 1}`}
              />

              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(index)}
                  disabled={disabled}
                  aria-label="Remove this lot"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {overAvailable && lot && (
              <p className="text-xs text-red-600">
                Only {lot.quantityAvailable.toFixed(2)} {uom} available in {lot.greigeCode ?? 'this lot'} — reduce this
                row or add another lot.
              </p>
            )}

            {canPick && !row.detailsExpanded && (
              <p className="ml-11 text-xs text-muted-foreground">
                Sending by quantity — {pieces} not picked.{' '}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => toggleDetails(index)}
                  disabled={disabled}
                >
                  Pick the {pieces}
                </button>
              </p>
            )}

            {nothingToPick && row.lotThans && (
              <p className="ml-11 text-xs text-muted-foreground">
                {noListNote(row.lotThans, uom)}
                {can('greigeFabricStock') && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:text-foreground"
                      onClick={() => setRecordLotId(row.lotId)}
                      disabled={disabled}
                    >
                      Record bales &amp; thans
                    </button>
                  </>
                )}
              </p>
            )}

            {canPick && row.detailsExpanded && row.lotThans && (
              <div className="ml-11 mt-2 rounded-md border bg-muted/30 p-3">
                <ThanPicker
                  lotThans={row.lotThans}
                  selected={row.selectedDetails ?? []}
                  onChange={(selected) => setPicks(index, selected)}
                  targetActual={rowTarget(index)}
                  uom={uom}
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Nothing picked on an optional-lot order is a valid answer, not a shortfall */}
      {!(allowNoLot && evaluation.noLotChosen) && (
        <div
          className={`flex items-center justify-between text-sm font-medium ${
            evaluation.totalMatches ? 'text-green-600' : evaluation.qtyDelta < 0 ? 'text-amber-600' : 'text-red-600'
          }`}
        >
          <span>
            Total {evaluation.totalQty.toFixed(2)} / {requiredQty.toFixed(2)} {uom}
          </span>
          <span>
            {evaluation.totalMatches
              ? '✓ matches the order'
              : evaluation.qtyDelta < 0
                ? `${Math.abs(evaluation.qtyDelta).toFixed(2)} ${uom} short`
                : `${evaluation.qtyDelta.toFixed(2)} ${uom} over`}
          </span>
        </div>
      )}

      {evaluation.hasThanErrors && (
        <p className="text-xs text-red-600">
          A picked piece is blank or asks for more metres than it has left — fix it or untick it.
        </p>
      )}

      {evaluation.hasMixedGreige && (
        <p className="text-xs text-red-600">All rows must be the same greige — one job work order sends one cloth.</p>
      )}

      {recordLotId && (
        <RecordLotPiecesDialog
          open={!!recordLotId}
          onOpenChange={(open) => !open && setRecordLotId(null)}
          stockId={recordLotId}
        />
      )}
    </div>
  );
}

export default GreigeLotRows;
