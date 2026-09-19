import { useCallback } from 'react';
import { Combobox } from './ui/combobox';
import { getAllMaterials } from '@/services/material.service';
import { usePickerOptions, PICKER_LIMIT, type PickerPage } from '@/hooks/usePickerOptions';
import type { Material } from '@/types/material.types';
import { toast } from 'sonner';

interface MaterialComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  categoryFilter?: string; // Optional filter by material category/type
  supplierId?: string; // Optional filter by supplier
}

export function MaterialCombobox({
  value,
  onValueChange,
  placeholder = 'Select material...',
  className,
  disabled = false,
  categoryFilter,
  supplierId,
}: MaterialComboboxProps) {
  // 352 materials exceed one picker page, so the server must hand back the alphabetically FIRST
  // 200 — otherwise "A…" codes would be the ones missing.
  const fetch = useCallback(
    async (search: string): Promise<PickerPage<Material>> => {
      const response = await getAllMaterials({
        limit: PICKER_LIMIT,
        search: search || undefined,
        supplierId: supplierId || undefined,
        sortBy: 'code',
        sortOrder: 'asc',
      });
      return { items: response.data ?? [], total: response.pagination?.total };
    },
    [supplierId]
  );

  const { options, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<Material>({
    fetch,
    toOption: (material) => ({
      value: material.id,
      label: `${material.code} - ${material.name}`,
      searchText: `${material.code} ${material.name} ${material.category?.name || ''} ${material.description || ''}`,
    }),
    narrowHint: 'type a code, name or category to narrow',
    onError: (error) => {
      console.error('Failed to load materials:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load materials');
    },
  });

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={
        !initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading materials...') : placeholder
      }
      searchPlaceholder="Search by code, name, category..."
      emptyText={categoryFilter ? `No ${categoryFilter.toLowerCase()} materials found.` : 'No materials found.'}
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
