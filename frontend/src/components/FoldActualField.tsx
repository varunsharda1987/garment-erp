/**
 * The fold-length result as a field of its own: the ACTUAL metres (counted × L/100) that stock, value and
 * over-receipt use, shown read-only and the same size as the Quantity and L inputs beside it. Without a
 * fold (no L, or L ≥ 100) actual is the counted figure. The rule itself lives in lib/fold-length.
 */
import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { foldActual, hasFold } from '@/lib/fold-length';
import { formatQuantity } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface FoldActualFieldProps {
  counted: number | string | null | undefined;
  foldLengthCm: number | string | null | undefined;
  unit?: string | null;
  id?: string;
  className?: string;
  /** Extra line under the box (e.g. the value at actual). */
  note?: ReactNode;
}

export function FoldActualField({ counted, foldLengthCm, unit, id, className, note }: FoldActualFieldProps) {
  const typed = typeof counted === 'string' ? parseFloat(counted) : counted;
  const hasCounted = typed != null && !Number.isNaN(typed) && typed > 0;
  const folded = hasFold(foldLengthCm);
  const l = folded ? Number(foldLengthCm) : null;
  return (
    <div className="space-y-1">
      <Input
        id={id}
        type="text"
        readOnly
        tabIndex={-1}
        aria-readonly
        value={hasCounted ? formatQuantity(foldActual(counted, foldLengthCm), unit) : ''}
        placeholder="—"
        title="Worked out from the quantity and L — not typed"
        className={cn(
          'bg-muted font-medium cursor-default focus-visible:ring-0',
          folded && hasCounted && 'border-info/40 text-info',
          className
        )}
      />
      {hasCounted && (
        <p className="text-xs text-muted-foreground">
          {l !== null ? `counted × ${l}/100` : 'same as counted (no fold)'}
        </p>
      )}
      {note}
    </div>
  );
}
