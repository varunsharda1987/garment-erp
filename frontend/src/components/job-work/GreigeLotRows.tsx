/**
 * Greige lot rows — the CONTROL. Its rules live in ./lot-rows so this file only exports a
 * component (React Fast Refresh requires that split).
 *
 * Supports two issue modes:
 * - Simple mode: Just lot + quantity (internal/cutting issuance)
 * - Detail mode: Select specific bales/thans (processor issuance)
 */
import { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Wand2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import type { GreigeStockDetail, JwoIssuePreviewLot } from '@/services/jobWorkOrder.service';
import { jobWorkOrderService } from '@/services/jobWorkOrder.service';
import {
  ISSUE_QTY_TOLERANCE,
  autoFillLotRows,
  emptyLotRow,
  groupDetailsByBale,
  hasDetailOverSelection,
  totalDetailMeters,
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
  /** Enable bale/than detail selection (for processor dispatch). */
  enableDetailSelection?: boolean;
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
}: GreigeLotRowsProps) {
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  const updateRow = useCallback(
    (index: number, patch: Partial<IssueLotRow>) =>
      onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))),
    [rows, onRowsChange]
  );

  const addRow = () => onRowsChange([...rows, emptyLotRow()]);
  const removeRow = (index: number) => onRowsChange(rows.filter((_, i) => i !== index));
  const autoFill = () => {
    const filled = autoFillLotRows(lots, requiredQty, rows);
    if (filled) onRowsChange(filled);
  };

  // Load bale/than details for a lot when expanding
  const loadDetails = useCallback(
    async (index: number, lotId: string) => {
      if (loadingDetails.has(lotId)) return;
      setLoadingDetails((prev) => new Set(prev).add(lotId));
      try {
        const details = await jobWorkOrderService.getAvailableDetails(lotId);
        updateRow(index, { availableDetails: details, detailsExpanded: true });
      } catch (err) {
        toast({
          title: 'Failed to load bale/than details',
          description: err instanceof Error ? err.message : 'Unable to fetch details for this lot',
          variant: 'destructive',
        });
      } finally {
        setLoadingDetails((prev) => {
          const next = new Set(prev);
          next.delete(lotId);
          return next;
        });
      }
    },
    [loadingDetails, updateRow]
  );

  // Toggle detail expansion
  const toggleDetails = useCallback(
    (index: number, row: IssueLotRow) => {
      if (!row.lotId) return;
      if (row.detailsExpanded) {
        // Collapse
        updateRow(index, { detailsExpanded: false });
      } else if (row.availableDetails) {
        // Already loaded, just expand
        updateRow(index, { detailsExpanded: true });
      } else {
        // Load and expand
        loadDetails(index, row.lotId);
      }
    },
    [loadDetails, updateRow]
  );

  // Toggle a detail selection
  const toggleDetail = useCallback(
    (rowIndex: number, detail: GreigeStockDetail, checked: boolean) => {
      const row = rows[rowIndex];
      const currentSelections = row.selectedDetails ?? [];

      if (checked) {
        // Add selection with full available meters
        const newSelection: SelectedDetail = {
          detailId: detail.id,
          metersToIssue: detail.metersRemaining.toFixed(2),
        };
        const updatedSelections = [...currentSelections, newSelection];
        const totalFromDetails = totalDetailMeters(updatedSelections);
        updateRow(rowIndex, {
          selectedDetails: updatedSelections,
          qty: totalFromDetails.toFixed(2),
        });
      } else {
        // Remove selection
        const updatedSelections = currentSelections.filter((d) => d.detailId !== detail.id);
        const totalFromDetails = totalDetailMeters(updatedSelections);
        updateRow(rowIndex, {
          selectedDetails: updatedSelections,
          qty: totalFromDetails.toFixed(2),
        });
      }
    },
    [rows, updateRow]
  );

  // Update meters for a selected detail
  const updateDetailMeters = useCallback(
    (rowIndex: number, detailId: string, metersStr: string) => {
      const row = rows[rowIndex];
      const updatedSelections = (row.selectedDetails ?? []).map((d) =>
        d.detailId === detailId ? { ...d, metersToIssue: metersStr } : d
      );
      const totalFromDetails = totalDetailMeters(updatedSelections);
      updateRow(rowIndex, {
        selectedDetails: updatedSelections,
        qty: totalFromDetails.toFixed(2),
      });
    },
    [rows, updateRow]
  );

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
        const overAvailable = !!lot && rowQty > lot.quantityAvailable + ISSUE_QTY_TOLERANCE;
        const isLoading = row.lotId ? loadingDetails.has(row.lotId) : false;
        const groupedDetails = row.availableDetails ? groupDetailsByBale(row.availableDetails) : [];
        const selectedIds = new Set((row.selectedDetails ?? []).map((d) => d.detailId));
        const detailOverSelections = hasDetailOverSelection(row.selectedDetails, row.availableDetails);

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
              {/* Expand/collapse toggle for detail mode */}
              {enableDetailSelection && row.lotId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => toggleDetails(index, row)}
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
                    // Clear details when lot changes
                    updateRow(index, {
                      lotId: newLotId,
                      availableDetails: undefined,
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
                    {lots.map((option) => (
                      <SelectItem key={option.id} value={option.id} disabled={takenElsewhere.has(option.id)}>
                        {option.greigeCode ?? 'Lot'} — {option.greigeName ?? 'unnamed greige'} (
                        {option.quantityAvailable.toFixed(1)}m avail
                        {option.greigeWidth != null ? `, ${option.greigeWidth}″` : ''})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                type="number"
                step="0.01"
                min="0"
                className="w-32"
                value={row.qty}
                disabled={disabled || (enableDetailSelection && row.detailsExpanded)}
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

            {/* Detail picker when expanded */}
            {enableDetailSelection && row.detailsExpanded && row.availableDetails && (
              <div className="ml-9 mt-2 rounded-md border bg-muted/30 p-3">
                {groupedDetails.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bale/than details available for this lot.</p>
                ) : (
                  <div className="space-y-3">
                    {groupedDetails.map((group) => (
                      <div key={group.baleNumber ?? 'unbaled'} className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">
                          {group.baleNumber ? `Bale ${group.baleNumber}` : 'Unbaled Thans'}
                        </div>
                        <div className="space-y-1">
                          {group.thans.map((detail) => {
                            const isSelected = selectedIds.has(detail.id);
                            const selection = (row.selectedDetails ?? []).find((d) => d.detailId === detail.id);
                            const overSelection = detailOverSelections.find((o) => o.detailId === detail.id);

                            return (
                              <div key={detail.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`detail-${detail.id}`}
                                  checked={isSelected}
                                  disabled={disabled || (detail.status !== 'AVAILABLE' && detail.status !== 'PARTIAL')}
                                  onCheckedChange={(checked) => toggleDetail(index, detail, checked === true)}
                                />
                                <label htmlFor={`detail-${detail.id}`} className="flex-1 text-sm cursor-pointer">
                                  Than {detail.sequenceNo}
                                  <span className="ml-1 text-muted-foreground">
                                    ({detail.metersRemaining.toFixed(2)}m avail
                                    {detail.status === 'PARTIAL' && ` of ${detail.meters.toFixed(2)}m`})
                                  </span>
                                </label>
                                {isSelected && (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={detail.metersRemaining}
                                    className="h-7 w-24 text-sm"
                                    value={selection?.metersToIssue ?? ''}
                                    disabled={disabled}
                                    onChange={(e) => updateDetailMeters(index, detail.id, e.target.value)}
                                    aria-label={`Meters to issue from than ${detail.sequenceNo}`}
                                  />
                                )}
                                {overSelection && (
                                  <span className="text-xs text-red-600">{overSelection.over.toFixed(2)}m over</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 text-sm font-medium">
                      Selected: {totalDetailMeters(row.selectedDetails).toFixed(2)} m
                    </div>
                  </div>
                )}
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

      {evaluation.hasMixedGreige && (
        <p className="text-xs text-red-600">All rows must be the same greige — one job work order sends one cloth.</p>
      )}
    </div>
  );
}

export default GreigeLotRows;
