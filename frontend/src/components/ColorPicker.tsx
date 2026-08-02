/**
 * ColorPicker Component
 * Reusable dropdown for selecting colors from the Color Master
 * Features: search, family filter, hex swatch display
 */

import { useEffect, useState, useCallback } from 'react';
import { Check, ChevronsUpDown, X, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { colorService } from '@/services/colorService';
import type { ColorSearchResult } from '@/types/color.types';
import { COLOR_FAMILIES } from '@/types/color.types';

interface ColorPickerProps {
  value?: string | null; // Selected color ID
  onChange: (colorId: string | null, color?: ColorSearchResult) => void;
  placeholder?: string;
  disabled?: boolean;
  filterByFamily?: string; // Pre-filter by family
  showFamilyFilter?: boolean; // Show family filter dropdown
  className?: string;
  error?: string;
}

/**
 * Color Swatch component
 */
const ColorSwatch = ({ hexCode, size = 'sm' }: { hexCode: string | null; size?: 'sm' | 'md' }) => {
  const sizeClasses = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  if (!hexCode) {
    return (
      <div className={cn(sizeClasses, 'rounded border border-border bg-muted flex items-center justify-center')}>
        <span className="text-[8px] text-muted-foreground">?</span>
      </div>
    );
  }

  return (
    <div
      className={cn(sizeClasses, 'rounded border border-border flex-shrink-0')}
      style={{ backgroundColor: hexCode }}
      title={hexCode}
    />
  );
};

export default function ColorPicker({
  value,
  onChange,
  placeholder = 'Select color...',
  disabled = false,
  filterByFamily,
  showFamilyFilter = false,
  className,
  error,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState<ColorSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState(filterByFamily || '');
  const [selectedColor, setSelectedColor] = useState<ColorSearchResult | null>(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch colors when dropdown opens or filters change
  const fetchColors = useCallback(async () => {
    try {
      setIsLoading(true);
      const results = await colorService.search({
        search: debouncedSearch || undefined,
        colorFamily: familyFilter || filterByFamily || undefined,
        limit: 50,
      });
      setColors(results);
    } catch (error) {
      console.error('Failed to fetch colors:', error);
      setColors([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, familyFilter, filterByFamily]);

  useEffect(() => {
    if (open) {
      fetchColors();
    }
  }, [open, fetchColors]);

  // BUG-COL5 fix: Load selected color details when value changes.
  // Uses a cancelled flag to prevent stale async responses from updating state
  // when value changes rapidly (race condition protection).
  useEffect(() => {
    // Track if this effect instance has been superseded
    let cancelled = false;

    if (value) {
      const loadSelectedColor = async () => {
        try {
          const color = await colorService.getById(value);
          // Only update state if this effect instance is still current
          if (!cancelled) {
            setSelectedColor({
              id: color.id,
              colorCode: color.colorCode,
              colorName: color.colorName,
              hexCode: color.hexCode,
              colorFamily: color.colorFamily,
            });
          }
        } catch (error) {
          if (!cancelled) {
            console.error('Failed to load selected color:', error);
            setSelectedColor(null);
          }
        }
      };
      loadSelectedColor();
    } else {
      setSelectedColor(null);
    }

    // Cleanup: mark this effect as cancelled when value changes or component unmounts
    return () => {
      cancelled = true;
    };
  }, [value]);

  const handleSelect = (color: ColorSearchResult) => {
    setSelectedColor(color);
    onChange(color.id, color);
    setOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedColor(null);
    onChange(null);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Family Filter (optional) */}
      {showFamilyFilter && (
        <Select value={familyFilter || 'all'} onValueChange={(val) => setFamilyFilter(val === 'all' ? '' : val)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All Families" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Families</SelectItem>
            {COLOR_FAMILIES.map((family) => (
              <SelectItem key={family} value={family}>
                {family}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Color Picker Dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal',
              !selectedColor && 'text-muted-foreground',
              error && 'border-destructive'
            )}
          >
            {selectedColor ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ColorSwatch hexCode={selectedColor.hexCode} />
                <span className="truncate">{selectedColor.colorName}</span>
                {selectedColor.colorFamily && (
                  <span className="text-xs text-muted-foreground">({selectedColor.colorFamily})</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <span>{placeholder}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              {selectedColor && (
                <X
                  className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search colors..." value={searchQuery} onValueChange={setSearchQuery} />
            <CommandList>
              {isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Loading colors...</div>
              ) : colors.length === 0 ? (
                <CommandEmpty>
                  {debouncedSearch
                    ? `No colors found for "${debouncedSearch}"`
                    : 'No colors available. Add colors in Color Master.'}
                </CommandEmpty>
              ) : (
                <CommandGroup>
                  {colors.map((color) => (
                    <CommandItem
                      key={color.id}
                      value={color.id}
                      onSelect={() => handleSelect(color)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <ColorSwatch hexCode={color.hexCode} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{color.colorName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{color.colorCode}</span>
                          {color.colorFamily && (
                            <>
                              <span>•</span>
                              <span>{color.colorFamily}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Check
                        className={cn('h-4 w-4 flex-shrink-0', value === color.id ? 'opacity-100' : 'opacity-0')}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Error message */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/**
 * ColorDisplay component - for showing selected color (read-only)
 */
export function ColorDisplay({
  colorId,
  showCode = false,
  className,
}: {
  colorId: string | null;
  showCode?: boolean;
  className?: string;
}) {
  const [color, setColor] = useState<ColorSearchResult | null>(null);

  // BUG-COL5 fix: Same race condition protection as ColorPicker
  useEffect(() => {
    let cancelled = false;

    if (colorId) {
      colorService
        .getById(colorId)
        .then((c) => {
          if (!cancelled) {
            setColor({
              id: c.id,
              colorCode: c.colorCode,
              colorName: c.colorName,
              hexCode: c.hexCode,
              colorFamily: c.colorFamily,
            });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setColor(null);
          }
        });
    } else {
      setColor(null);
    }

    return () => {
      cancelled = true;
    };
  }, [colorId]);

  if (!color) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ColorSwatch hexCode={color.hexCode} />
      <span>{color.colorName}</span>
      {showCode && <span className="text-xs text-muted-foreground">({color.colorCode})</span>}
    </div>
  );
}
