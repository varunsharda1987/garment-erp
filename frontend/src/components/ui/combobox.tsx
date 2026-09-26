import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ComboboxOption {
  value: string;
  label: string;
  searchText?: string; // Additional text to search by (won't be displayed)
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  hideChevron?: boolean;
  // Server-side search support
  onSearchChange?: (search: string) => void;
  isLoading?: boolean;
  /** Rendered under the list — e.g. "Showing 200 of 1,116 — type to narrow" */
  footer?: React.ReactNode;
  /** Fires when the list opens or closes — wrappers use the open edge to retry a failed first load. */
  onOpenChange?: (open: boolean) => void;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  disabled = false,
  className,
  hideChevron = false,
  onSearchChange,
  isLoading = false,
  footer,
  onOpenChange,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [popoverWidth, setPopoverWidth] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    if (buttonRef.current) {
      setPopoverWidth(buttonRef.current.offsetWidth);
    }
  }, []);

  // Debounced server-side search — sent only when the typed text differs from the last one sent. The
  // owner loads its unfiltered list itself, so the old unconditional send of '' after mount fetched
  // every picker's list twice (2026-09-27), and a new handler identity re-sent the same text.
  const sentSearch = React.useRef('');
  const sendSearch = React.useEffectEvent((search: string) => {
    if (!onSearchChange || search === sentSearch.current) return;
    sentSearch.current = search;
    onSearchChange(search);
  });
  React.useEffect(() => {
    if (searchValue === sentSearch.current) return;
    const timer = setTimeout(() => sendSearch(searchValue), 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // The trigger names the selected value even when a server search has narrowed `options` to rows
  // without it. Before 2026-09-27: pick supplier "Hardik", reopen, type "VSM", Escape — the trigger read
  // "All Suppliers" while the list was still filtered to Hardik. So remember the option last seen for it.
  const listedOption = options.find((option) => option.value === value);
  const [knownOption, setKnownOption] = React.useState(listedOption);
  if (listedOption && (listedOption.value !== knownOption?.value || listedOption.label !== knownOption?.label)) {
    setKnownOption(listedOption);
  }
  const selectedOption = listedOption ?? (knownOption?.value === value ? knownOption : undefined);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    // A closed list keeps no typed text: reopening starts from the full list (the cleared search is sent)
    if (!next) setSearchValue('');
    onOpenChange?.(next);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', !value && 'text-muted-foreground', className)}
          disabled={disabled}
        >
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          {!hideChevron && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" style={{ width: popoverWidth }}>
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={onSearchChange ? searchValue : undefined}
            onValueChange={onSearchChange ? setSearchValue : undefined}
          />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Loading...' : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.searchText || option.label}
                  onSelect={() => {
                    const next = option.value === value ? '' : option.value;
                    if (next) setKnownOption(option);
                    onValueChange(next);
                    changeOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {footer && <div className="border-t px-3 py-2 text-xs text-muted-foreground">{footer}</div>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
