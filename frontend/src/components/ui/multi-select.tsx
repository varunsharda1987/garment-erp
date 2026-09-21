import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optional right-aligned hint, e.g. the row count for this value ("42"). */
  count?: number;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  /** Currently ticked values. Treat as immutable — onValueChange always gets a new array. */
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  /** Hide the type-to-narrow box. Auto-hidden below `searchThreshold` options. */
  searchThreshold?: number;
}

/**
 * Multi-select dropdown built from the same primitives as ui/combobox.tsx (Popover + Command),
 * which is the repo's precedent for a non-official composite living in ui/.
 *
 * The trigger summarises the selection as "Dyeing +2" so the state is visible without opening it —
 * that is what makes a separate row of filter chips unnecessary.
 */
export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = 'All',
  searchPlaceholder = 'Search...',
  emptyText = 'No options.',
  disabled = false,
  className,
  searchThreshold = 8,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [popoverWidth, setPopoverWidth] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    if (buttonRef.current) {
      setPopoverWidth(buttonRef.current.offsetWidth);
    }
  }, []);

  const toggle = (optionValue: string) => {
    // Never mutate: the parent may hold this array in a memo/query key.
    onValueChange(value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue]);
  };

  const selectedLabel = React.useMemo(() => {
    if (value.length === 0) return null;
    const first = options.find((o) => o.value === value[0]);
    // Fall back to the raw value: options load asynchronously, and a filter restored from the URL
    // must still read as something before they arrive.
    return first?.label ?? value[0];
  }, [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', value.length === 0 && 'text-muted-foreground', className)}
          disabled={disabled}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{selectedLabel ?? placeholder}</span>
            {value.length > 1 && (
              <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-xs font-medium">
                +{value.length - 1}
              </Badge>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" style={{ width: popoverWidth }}>
        <Command>
          {options.length >= searchThreshold && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option, index) => {
                const checked = value.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    // cmdk keys items case-insensitively, so two options differing only in case
                    // ("Poplin" / "poplin") would collide and highlight as one. The index prefix
                    // guarantees a unique key WITHOUT case-folding the options — the API matches
                    // these values exactly, so folding would silently drop one variant's rows.
                    // Typing is matched against `keywords`, so this key never pollutes search.
                    value={`${index}-${option.value}`}
                    keywords={[option.label]}
                    onSelect={() => toggle(option.value)}
                  >
                    {/* A live Checkbox here double-toggles (its own click plus cmdk's onSelect), so
                        this is a presentational tick, matching ui/combobox.tsx. */}
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', checked ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="ml-auto pl-2 text-xs tabular-nums text-muted-foreground">{option.count}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {value.length > 0 && (
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start text-muted-foreground hover:text-foreground"
                onClick={() => onValueChange([])}
              >
                <X className="mr-2 h-3.5 w-3.5" />
                Clear selection
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default MultiSelect;
