/**
 * The fold-length result as a field of its own, read-only and the same size as the Quantity and L inputs
 * beside it. The rule itself lives in lib/fold-length; this only shows it.
 *
 * - FoldActualField: a receipt or issue types the COUNTED figure → the ACTUAL metres (counted × L/100) that
 *   stock, value and over-receipt use.
 * - FoldCountedField: a PO line is typed in ACTUAL metres → the figure the mill will count at L.
 *
 * Without a fold (no L, or L ≥ 100) both figures are the same.
 */
import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { foldActual, foldCounted, hasFold } from '@/lib/fold-length';
import { formatQuantity } from '@/lib/formatters';
import { cn } from '@/lib/utils';

type Qty = number | string | null | undefined;

interface FoldFieldProps {
  foldLengthCm: Qty;
  unit?: string | null;
  id?: string;
  className?: string;
  /** Extra line under the box (e.g. the value at actual). */
  note?: ReactNode;
}

function positive(v: Qty): boolean {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return n != null && !Number.isNaN(n) && n > 0;
}

function CalculatedQtyBox({
  value,
  folded,
  hint,
  id,
  className,
  note,
}: {
  value: string;
  folded: boolean;
  hint: string | null;
  id?: string;
  className?: string;
  note?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Input
        id={id}
        type="text"
        readOnly
        tabIndex={-1}
        aria-readonly
        value={value}
        placeholder="—"
        title="Worked out from the quantity and L — not typed"
        className={cn(
          'bg-muted font-medium cursor-default focus-visible:ring-0',
          folded && value && 'border-info/40 text-info',
          className
        )}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {note}
    </div>
  );
}

/** Counted (typed) → actual metres. */
export function FoldActualField({ counted, foldLengthCm, ...rest }: FoldFieldProps & { counted: Qty }) {
  const has = positive(counted);
  const folded = hasFold(foldLengthCm);
  const l = folded ? Number(foldLengthCm) : null;
  return (
    <CalculatedQtyBox
      {...rest}
      folded={folded}
      value={has ? formatQuantity(foldActual(counted, foldLengthCm), rest.unit) : ''}
      hint={has ? (l !== null ? `counted × ${l}/100` : 'same as counted (no fold)') : null}
    />
  );
}

/** Actual metres (typed on a PO line) → the figure the mill will count at L. */
export function FoldCountedField({ actual, foldLengthCm, ...rest }: FoldFieldProps & { actual: Qty }) {
  const has = positive(actual);
  const folded = hasFold(foldLengthCm);
  const l = folded ? Number(foldLengthCm) : null;
  return (
    <CalculatedQtyBox
      {...rest}
      folded={folded}
      value={has ? formatQuantity(foldCounted(actual, foldLengthCm), rest.unit) : ''}
      hint={has ? (l !== null ? `actual × 100/${l}` : 'same as actual (no fold)') : null}
    />
  );
}
