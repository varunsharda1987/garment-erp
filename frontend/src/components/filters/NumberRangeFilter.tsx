/**
 * NumberRangeFilter Component
 *
 * A min/max pair for numeric list filters (width, GSM, shrinkage).
 *
 * Typing is debounced internally, so holding a key does not fire one request per keystroke.
 * A blank box means NO BOUND — it must never be sent as 0, which would silently empty the list.
 *
 * @example
 * <NumberRangeFilter
 *   label='Width (")'
 *   value={{ min: filters.minWidth, max: filters.maxWidth }}
 *   onChange={({ min, max }) => updateURLParams({ minWidth: min, maxWidth: max, page: undefined })}
 * />
 */
import { useEffect, useRef, useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface NumberRangeValue {
  min?: number;
  max?: number;
}

export interface NumberRangeFilterProps {
  /** Filter label */
  label?: string;
  /** Current bounds; undefined means "no bound" */
  value: NumberRangeValue;
  /** Callback when either bound settles (debounced) */
  onChange: (value: NumberRangeValue) => void;
  /** Placeholder for the lower box (default: "Min") */
  minPlaceholder?: string;
  /** Placeholder for the upper box (default: "Max") */
  maxPlaceholder?: string;
  /** Debounce in ms before onChange fires (default: 400) */
  debounceMs?: number;
  /** Native step for both inputs */
  step?: number | string;
  /** Additional CSS class for the container */
  className?: string;
  disabled?: boolean;
}

/** '' / whitespace / unparseable -> undefined ("no bound"), never 0. */
const toBound = (text: string): number | undefined => {
  const t = text.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

const keyOf = (min?: number, max?: number) => `${min ?? ''}|${max ?? ''}`;

export function NumberRangeFilter({
  label,
  value,
  onChange,
  minPlaceholder = 'Min',
  maxPlaceholder = 'Max',
  debounceMs = 400,
  step = 'any',
  className = '',
  disabled = false,
}: NumberRangeFilterProps) {
  const [minText, setMinText] = useState(value.min?.toString() ?? '');
  const [maxText, setMaxText] = useState(value.max?.toString() ?? '');

  // Held in a ref so the debounce effect does NOT list onChange as a dependency. SearchInput.tsx
  // does list it, which restarts its timer on every parent render — don't copy that.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // The last value this component and its parent agree on, so we can tell "the user typed" from
  // "the parent changed underneath us" (Clear Filters, a URL restore, the Back button).
  const settled = useRef(keyOf(value.min, value.max));

  const externalKey = keyOf(value.min, value.max);
  useEffect(() => {
    if (externalKey !== settled.current) {
      settled.current = externalKey;
      setMinText(value.min?.toString() ?? '');
      setMaxText(value.max?.toString() ?? '');
    }
  }, [externalKey, value.min, value.max]);

  useEffect(() => {
    const next = keyOf(toBound(minText), toBound(maxText));
    if (next === settled.current) return; // nothing actually changed — don't fire
    const timer = setTimeout(() => {
      settled.current = next;
      onChangeRef.current({ min: toBound(minText), max: toBound(maxText) });
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [minText, maxText, debounceMs]);

  const inputId = label?.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <div className="flex items-center gap-1.5">
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          step={step}
          value={minText}
          disabled={disabled}
          placeholder={minPlaceholder}
          aria-label={label ? `${label} minimum` : 'Minimum'}
          // A mouse wheel over a focused number input silently rewrites it.
          onWheel={(e) => e.currentTarget.blur()}
          onChange={(e) => setMinText(e.target.value)}
          className="w-[84px]"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          value={maxText}
          disabled={disabled}
          placeholder={maxPlaceholder}
          aria-label={label ? `${label} maximum` : 'Maximum'}
          onWheel={(e) => e.currentTarget.blur()}
          onChange={(e) => setMaxText(e.target.value)}
          className="w-[84px]"
        />
      </div>
    </div>
  );
}

export default NumberRangeFilter;
