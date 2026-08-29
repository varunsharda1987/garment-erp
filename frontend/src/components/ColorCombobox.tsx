import { useState, useEffect, useCallback } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { colorService } from '@/services/colorService';
import { toast } from 'sonner';

interface ColorData {
  id: string;
  colorCode: string;
  colorName: string;
  hexCode?: string | null;
  colorFamily?: string | null;
}

interface ColorComboboxProps {
  value?: string;
  onValueChange: (value: string, color?: ColorData) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ColorCombobox({
  value,
  onValueChange,
  placeholder = 'Select color...',
  className,
  disabled = false,
}: ColorComboboxProps) {
  const [colors, setColors] = useState<ComboboxOption[]>([]);
  const [colorMap, setColorMap] = useState<Map<string, ColorData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    loadColors('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the selected color by ID if not in loaded options
  useEffect(() => {
    if (value && initialLoaded && !colorMap.has(value)) {
      // The selected color isn't in the loaded options, fetch it directly
      colorService
        .getById(value)
        .then((color) => {
          if (color) {
            setColorMap((prev) => new Map(prev).set(color.id, color));
            setColors((prev) => {
              // Don't add duplicate
              if (prev.some((opt) => opt.value === color.id)) return prev;
              return [
                {
                  value: color.id,
                  label: `${color.colorCode} - ${color.colorName}`,
                  searchText: `${color.colorCode} ${color.colorName}`,
                },
                ...prev,
              ];
            });
          }
        })
        .catch((err) => console.error('Failed to fetch selected color:', err));
    }
  }, [value, initialLoaded, colorMap]);

  const loadColors = useCallback(async (search: string) => {
    try {
      setIsLoading(true);
      const response = await colorService.search({ search: search || undefined, limit: 50 });

      const map = new Map<string, ColorData>();
      const colorOptions: ComboboxOption[] = response.map((color) => {
        map.set(color.id, color);
        return {
          value: color.id,
          label: `${color.colorCode} - ${color.colorName}`,
          searchText: `${color.colorCode} ${color.colorName} ${color.colorFamily || ''}`,
        };
      });

      setColorMap(map);
      setColors(colorOptions);
      setInitialLoaded(true);
    } catch (error) {
      console.error('Failed to load colors:', error);
      toast.error('Failed to load colors');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleValueChange = (newValue: string) => {
    const color = colorMap.get(newValue);
    onValueChange(newValue, color);
  };

  return (
    <Combobox
      options={colors}
      value={value}
      onValueChange={handleValueChange}
      placeholder={!initialLoaded ? 'Loading colors...' : placeholder}
      searchPlaceholder="Search by code or name..."
      emptyText="No colors found."
      disabled={disabled || !initialLoaded}
      className={className}
      onSearchChange={loadColors}
      isLoading={isLoading}
    />
  );
}
