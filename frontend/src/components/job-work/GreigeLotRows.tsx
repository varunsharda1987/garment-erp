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
import { ThanPicker } from './ThanPicker';
import {
  autoFillLotRows,
  emptyLotRow,
  groupLotsForIssue,
  lotOptionLabel,
  lotHasThans,
  lotRowTarget,
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
}: GreigeLotRowsProps) {
  // Thans per lot, loaded once per lot. Kept here (not only on the row) so two loads finishing in
  // the same tick can never overwrite each other's row patch.
  const [thansByLot, setThansByLot] = useState<Record<string, GreigeLotThans>>({});
  const [loadingLots, setLoadingLots] = useState<Set<string>>(new Set());
  const failedLots = useRef<Set<string>>(new Set());

  const updateRow = useCallback(
    (index: number, patch: Partial<IssueLotRow>) =>
      onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))),
    [rows, onRowsChange]
  );

  // Load the thans of every chosen lot we have not seen yet.
  useEffect(() => {
    if (!enableDetailSelection) return;
    const wanted = [...new Set(rows.map((r) => r.lotId).filter(Boolean))].filter(
      (lotId) => !thansByLot[lotId] && !loadingLots.has(lotId) && !failedLots.current.has(lotId)
    );
    if (wanted.length === 0) return;
    setLoadingLots((prev) => new Set([...prev, ...wanted]));
    for (const lotId of wanted) {
      jobWorkOrderService
        .getAvailableDetails(lotId)
        .then((data) => setThansByLot((prev) => ({ ...prev, [lotId]: data })))
        .catch((err) => {
          failedLots.current.add(lotId);
          toast.error('Could not load the thans of this lot', {
            description: `${err instanceof Error ? err.message : 'The request failed'} — you can still send it by quantity.`,
          });
        })
        .finally(() =>
          setLoadingLots((prev) => {
            const next = new Set(prev);
            next.delete(lotId);
            return next;
          })
        );
    }
  }, [enableDetailSelection, rows, thansByLot, loadingLots]);

  // Attach loaded thans to their rows; a lot that has thans opens its picker by default.
  useEffect(() => {
    if (!enableDetailSelection) return;
    if (!rows.some((r) => r.lotId && !r.lotThans && thansByLot[r.lotId])) return;
    onRowsChange(
      rows.map((r) => {
        const loaded = r.lotId && !r.lotThans ? thansByLot[r.lotId] : undefined;
        return loaded ? { ...r, lotThans: loaded, detailsExpanded: loaded.details.length > 0 } : r;
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
            {enableDetailSelection && <span className="ml-1 text-xs text-muted-foreground">(Bale/Than mode)</span>}
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
                  aria-label={row.detailsExpanded ? 'Hide bales/thans' : 'Show bales/thans'}
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
                disabled={disabled || picking}
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
                Sending by quantity — thans not picked.{' '}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => toggleDetails(index)}
                  disabled={disabled}
                >
                  Pick the thans
                </button>
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
          A picked than is blank or asks for more metres than it has left — fix it or untick it.
        </p>
      )}

      {evaluation.hasMixedGreige && (
        <p className="text-xs text-red-600">All rows must be the same greige — one job work order sends one cloth.</p>
      )}
    </div>
  );
}

export default GreigeLotRows;
