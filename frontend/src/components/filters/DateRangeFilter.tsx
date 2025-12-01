/**
 * DateRangeFilter Component
 *
 * A date range picker filter with from/to date inputs.
 *
 * @example
 * <DateRangeFilter
 *   label="Date Range"
 *   from={fromDate}
 *   to={toDate}
 *   onChange={({ from, to }) => {
 *     setFromDate(from);
 *     setToDate(to);
 *   }}
 * />
 */
import React from 'react';
import { Calendar } from 'lucide-react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

export interface DateRangeValue {
  from: string;
  to: string;
}

export interface DateRangeFilterProps {
  /** Filter label */
  label?: string;
  /** From date value (ISO string format: YYYY-MM-DD) */
  from: string;
  /** To date value (ISO string format: YYYY-MM-DD) */
  to: string;
  /** Callback when dates change */
  onChange: (value: DateRangeValue) => void;
  /** From date placeholder */
  fromPlaceholder?: string;
  /** To date placeholder */
  toPlaceholder?: string;
  /** Additional CSS class */
  className?: string;
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Minimum selectable date */
  minDate?: string;
  /** Maximum selectable date */
  maxDate?: string;
}

export function DateRangeFilter({
  label = 'Date Range',
  from,
  to,
  onChange,
  fromPlaceholder = 'From',
  toPlaceholder = 'To',
  className = '',
  disabled = false,
  minDate,
  maxDate,
}: DateRangeFilterProps) {
  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = e.target.value;
    // If from date is after to date, also update to date
    const newTo = to && newFrom > to ? newFrom : to;
    onChange({ from: newFrom, to: newTo });
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTo = e.target.value;
    // If to date is before from date, also update from date
    const newFrom = from && newTo < from ? newTo : from;
    onChange({ from: newFrom, to: newTo });
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Input
            type="date"
            value={from}
            onChange={handleFromChange}
            placeholder={fromPlaceholder}
            disabled={disabled}
            min={minDate}
            max={to || maxDate}
            className="w-[150px] pr-8"
          />
          <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <span className="text-muted-foreground">to</span>
        <div className="relative">
          <Input
            type="date"
            value={to}
            onChange={handleToChange}
            placeholder={toPlaceholder}
            disabled={disabled}
            min={from || minDate}
            max={maxDate}
            className="w-[150px] pr-8"
          />
          <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

export default DateRangeFilter;
