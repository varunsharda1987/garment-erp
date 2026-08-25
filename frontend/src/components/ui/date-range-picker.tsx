import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Pick a date range',
  className,
  align = 'start',
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn('w-full justify-start text-left font-normal h-9', !value && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, 'dd MMM')} - {format(value.to, 'dd MMM yy')}
                </>
              ) : (
                format(value.from, 'dd MMM yyyy')
              )
            ) : (
              <span>{placeholder}</span>
            )}
            {value?.from && (
              <X className="ml-auto h-4 w-4 text-muted-foreground hover:text-foreground" onClick={handleClear} />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={(range) => {
              onChange(range);
              if (range?.from && range?.to) {
                setOpen(false);
              }
            }}
            numberOfMonths={2}
          />
          <div className="flex items-center justify-between p-3 border-t border-border">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today);
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  onChange({ from: weekAgo, to: today });
                  setOpen(false);
                }}
              >
                Last 7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const nextWeek = new Date(today);
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  onChange({ from: today, to: nextWeek });
                  setOpen(false);
                }}
              >
                Next 7 days
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
