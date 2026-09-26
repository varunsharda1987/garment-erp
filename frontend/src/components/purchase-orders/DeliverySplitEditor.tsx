import { Plus, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import { isQtyZero } from '@/lib/quantity';
import { unitShort } from '@/lib/units';
import {
  emptyPoint,
  fillBalanceIntoFirst,
  lineBalance,
  MAX_DELIVERY_POINTS,
  type SplitLine,
  type SplitPointDraft,
} from '@/lib/delivery-plan';

interface DeliverySplitEditorProps {
  lines: SplitLine[];
  points: SplitPointDraft[];
  onChange: (points: SplitPointDraft[]) => void;
  /** Places that have already received goods: they cannot be removed (the server refuses it too) */
  lockedWarehouseIds?: string[];
  disabled?: boolean;
}

/**
 * Lines × places: how much of each PO line goes to each place, with the balance still to place per
 * line. Point 1 is the first column — the PO header mirrors it, and "Put the balance into point 1"
 * applies the same rule the server uses when a draft line changes (lib/delivery-plan).
 */
export function DeliverySplitEditor({
  lines,
  points,
  onChange,
  lockedWarehouseIds = [],
  disabled,
}: DeliverySplitEditorProps) {
  const setPoint = (key: string, patch: Partial<SplitPointDraft>) =>
    onChange(points.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const setQty = (key: string, lineId: string, value: string) =>
    onChange(points.map((p) => (p.key === key ? { ...p, qty: { ...p.qty, [lineId]: value } } : p)));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium min-w-[180px]">Item</th>
              {points.map((p, i) => {
                const locked = lockedWarehouseIds.includes(p.warehouseId);
                return (
                  <th key={p.key} className="px-2 py-2 text-left font-medium min-w-[210px] align-top">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs text-muted-foreground">
                        Place {i + 1}
                        {i === 0 ? ' (PO header)' : ''}
                      </span>
                      {points.length > 2 && !locked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1"
                          disabled={disabled}
                          onClick={() => onChange(points.filter((x) => x.key !== p.key))}
                          aria-label={`Remove place ${i + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <WarehouseCombobox
                      value={p.warehouseId}
                      onValueChange={(warehouseId) => setPoint(p.key, { warehouseId })}
                      placeholder="Pick a store or a processor's unit"
                      disabled={disabled || locked}
                    />
                    {locked && <p className="text-xs text-muted-foreground mt-1">Has received goods — it stays</p>}
                  </th>
                );
              })}
              <th className="px-3 py-2 text-right font-medium min-w-[120px]">Balance</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const { unplaced, over } = lineBalance(line, points);
              const unit = unitShort(line.unit ?? undefined);
              return (
                <tr key={line.id} className="border-t">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{line.label}</div>
                    <div className="text-xs text-muted-foreground">
                      Ordered {line.ordered.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {unit}
                    </div>
                  </td>
                  {points.map((p) => (
                    <td key={p.key} className="px-2 py-2 align-top">
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        className="h-9 text-right"
                        value={p.qty[line.id] ?? ''}
                        disabled={disabled}
                        onChange={(e) => setQty(p.key, line.id, e.target.value)}
                        aria-label={`${line.label} at place ${points.indexOf(p) + 1}`}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right align-top">
                    {over > 0 ? (
                      <span className="text-destructive font-medium">{over} over</span>
                    ) : isQtyZero(unplaced) ? (
                      <span className="text-success font-medium">All placed</span>
                    ) : (
                      <span className="text-warning font-medium">
                        {unplaced} {unit} left
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || points.length >= MAX_DELIVERY_POINTS}
          onClick={() => onChange([...points, emptyPoint()])}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add a place
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(fillBalanceIntoFirst(lines, points))}
        >
          <Wand2 className="h-3.5 w-3.5 mr-1" /> Put the balance into place 1
        </Button>
      </div>
    </div>
  );
}
