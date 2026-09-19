import { useCallback, useEffect } from 'react';
import { Combobox } from './ui/combobox';
import { colorService } from '@/services/colorService';
import { usePickerOptions, PICKER_LIMIT, type PickerPage } from '@/hooks/usePickerOptions';
import type { ColorMaster } from '@/types/color.types';
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

const toColorData = (color: ColorMaster): ColorData => ({
  id: color.id,
  colorCode: color.colorCode,
  colorName: color.colorName,
  hexCode: color.hexCode,
  colorFamily: color.colorFamily,
});

export function ColorCombobox({
  value,
  onValueChange,
  placeholder = 'Select color...',
  className,
  disabled = false,
}: ColorComboboxProps) {
  // The paginated list (not /colors/search) so the picker learns how many colours exist in all
  const fetch = useCallback(async (search: string): Promise<PickerPage<ColorMaster>> => {
    const response = await colorService.getAll({
      limit: PICKER_LIMIT,
      search: search || undefined,
      isActive: true,
      sortBy: 'colorCode',
      sortOrder: 'asc',
    });
    return { items: response.data ?? [], total: response.pagination?.total };
  }, []);

  const { options, byId, addItem, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<ColorMaster>({
    fetch,
    toOption: (color) => ({
      value: color.id,
      label: `${color.colorCode} - ${color.colorName}`,
      searchText: `${color.colorCode} ${color.colorName} ${color.colorFamily || ''}`,
    }),
    narrowHint: 'type a code, name or family to narrow',
    onError: (error) => {
      console.error('Failed to load colors:', error);
      toast.error('Failed to load colors');
    },
  });

  // Fetch the selected color by ID if not in loaded options
  useEffect(() => {
    if (!value || !initialLoaded || byId.has(value)) return;
    let cancelled = false;
    colorService
      .getById(value)
      .then((color) => {
        if (!cancelled && color) addItem(color);
      })
      .catch((err) => console.error('Failed to fetch selected color:', err));
    return () => {
      cancelled = true;
    };
  }, [value, initialLoaded, byId, addItem]);

  const handleValueChange = (newValue: string) => {
    const color = byId.get(newValue);
    onValueChange(newValue, color ? toColorData(color) : undefined);
  };

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={handleValueChange}
      placeholder={!initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading colors...') : placeholder}
      searchPlaceholder="Search by code or name..."
      emptyText="No colors found."
      disabled={disabled}
      className={className}
      onOpenChange={(open) => {
        if (open && !initialLoaded && !isLoading) load('');
      }}
      onSearchChange={load}
      isLoading={isLoading}
      footer={footer}
    />
  );
}
