/**
 * Greige lot rows — the CONTROL. Its rules live in ./lot-rows so this file only exports a
 * component (React Fast Refresh requires that split).
 */
import { Plus, Wand2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { JwoIssuePreviewLot } from '@/services/jobWorkOrder.service';
import {
  ISSUE_QTY_TOLERANCE,
  autoFillLotRows,
  emptyLotRow,
  type IssueLotRow,
  type LotRowsEvaluation,
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
}: GreigeLotRowsProps) {
  const updateRow = (index: number, patch: Partial<IssueLotRow>) =>
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const addRow = () => onRowsChange([...rows, emptyLotRow()]);
  const removeRow = (index: number) => onRowsChange(rows.filter((_, i) => i !== index));
  const autoFill = () => {
    const filled = autoFillLotRows(lots, requiredQty, rows);
    if (filled) onRowsChange(filled);
  };

  return (
    <div className="space-y-2">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <Label>Greige Lots {required ? '*' : '(optional)'}</Label>
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
        // Disabling lots taken by another row is what keeps LOT_DUPLICATE from ever reaching the
        // server — the operator simply cannot pick the same lot twice.
        const takenElsewhere = new Set(
          rows
            .filter((_, i) => i !== index)
            .map((other) => other.lotId)
            .filter(Boolean)
        );
        return (
          <div key={index} className="space-y-1">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Select
                  value={row.lotId || 'none'}
                  onValueChange={(v) => updateRow(index, { lotId: v === 'none' ? '' : v })}
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
                disabled={disabled}
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
