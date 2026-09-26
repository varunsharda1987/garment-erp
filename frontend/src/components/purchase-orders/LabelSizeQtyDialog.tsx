import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/currency';
import { formatQuantity } from '@/lib/formatters';

/** One size of a sized label: its own materials row, and the quantity already on the PO (0 if none). */
export interface LabelSizeQtyRow {
  materialId: string;
  size: string;
  qty: number;
}

interface LabelSizeQtyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  name: string;
  unit: string | null;
  unitPrice: number | null;
  /** In size order (XS → XXXL). */
  rows: LabelSizeQtyRow[];
  /** Quantity per size row; 0 means "no line for this size". */
  onSave: (qtyByMaterialId: Record<string, number>) => void;
}

/** Pieces are counted: a blank, negative or unreadable box is 0, a fraction rounds to the nearest piece. */
function toPieces(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * Purchase order size grid for a label that has sizes (e.g. a main-cum-size label). Each size is its
 * own material (LBL-0004-XS …), so each size with a quantity becomes its own PO line. Opening it again
 * pre-fills the quantities already on the PO; setting a size to 0 removes that size's line. Mount it only
 * while open (and keyed by label) — its boxes are seeded on mount.
 */
export function LabelSizeQtyDialog({
  open,
  onOpenChange,
  code,
  name,
  unit,
  unitPrice,
  rows,
  onSave,
}: LabelSizeQtyDialogProps) {
  // Seeded from the PO's current lines when the grid mounts — the form mounts it only while it is open
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.materialId, r.qty > 0 ? String(r.qty) : '']))
  );

  const pieces = rows.map((r) => ({ ...r, pieces: toPieces(values[r.materialId]) }));
  const total = pieces.reduce((sum, r) => sum + r.pieces, 0);
  const filled = pieces.filter((r) => r.pieces > 0).length;
  const alreadyOnPo = rows.some((r) => r.qty > 0);

  const handleSave = () => {
    onSave(Object.fromEntries(pieces.map((r) => [r.materialId, r.pieces])));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {code} - {name}
          </DialogTitle>
          <DialogDescription>
            Enter the quantity for each size. Each size you fill in becomes its own line on this purchase order.
            {unitPrice ? ` Rate ${formatCurrency(unitPrice)} per piece.` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-2">
          {rows.map((r) => (
            <div key={r.materialId} className="space-y-1">
              <Label htmlFor={`size-qty-${r.materialId}`} className="text-sm font-medium">
                {r.size}
              </Label>
              <Input
                id={`size-qty-${r.materialId}`}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="0"
                value={values[r.materialId] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [r.materialId]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
          <span>
            Total: <span className="font-semibold">{formatQuantity(total, unit, 0)}</span>
          </span>
          {unitPrice ? <span className="font-semibold">{formatCurrency(total * unitPrice)}</span> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!alreadyOnPo && filled === 0}>
            {alreadyOnPo ? 'Update lines' : `Add ${filled} ${filled === 1 ? 'line' : 'lines'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
