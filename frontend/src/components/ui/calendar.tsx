import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      // v9 renamed every one of these keys and v10 kept the new names. The file had been left on
      // the v8 spelling (caption / head_row / head_cell / nav_button_* / table / row / cell), so
      // the whole block was INERT: the weekday header and the nav arrows rendered unstyled.
      // `day` is the <td> and `day_button` the <button> inside it — a shift, not just a rename.
      classNames={{
        // v10 renders <nav> as a sibling of the months rather than inside the caption, so it needs
        // an explicit positioned root to sit against — otherwise the arrows float at mid-height.
        root: 'relative',
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        month_caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'absolute inset-x-1 top-1 flex items-center justify-between z-10',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        // v10 puts data-selected on the <td> itself, so these are direct attribute selectors
        // rather than the old `:has([aria-selected])` descendant probes.
        day: 'h-9 w-9 text-center text-sm p-0 relative data-[selected=true]:bg-accent first:data-[selected=true]:rounded-l-md last:data-[selected=true]:rounded-r-md focus-within:relative focus-within:z-20',
        day_button: cn(buttonVariants({ variant: 'ghost' }), 'h-9 w-9 p-0 font-normal'),
        range_start: 'rounded-l-md',
        range_end: 'rounded-r-md',
        range_middle: 'bg-accent text-accent-foreground',
        selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        today: 'bg-accent text-accent-foreground',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
