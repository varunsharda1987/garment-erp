import { useCallback } from 'react';
import { Combobox } from './ui/combobox';
import { warehouseService } from '@/services/warehouse.service';
import { usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
import type { Warehouse, WarehouseType } from '@/types/inventory.types';
import { toast } from 'sonner';

interface WarehouseComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  warehouseTypeFilter?: WarehouseType;
  /**
   * Types to leave out — e.g. ['JOB_WORK', 'TRANSIT'] when the picker chooses where stock is BOOKED:
   * a processor's virtual location or "in transit" is never that. Filtered client-side; the endpoint
   * returns the whole list.
   */
  excludeTypes?: WarehouseType[];
  allowAll?: boolean; // Put an "All …" row (value '') first — for filter use; picking it clears the filter
  allLabel?: string; // Label of that row (default: "All warehouses")
}

export function WarehouseCombobox({
  value,
  onValueChange,
  placeholder = 'Select warehouse...',
  className,
  disabled = false,
  warehouseTypeFilter,
  excludeTypes,
  allowAll = false,
  allLabel = 'All warehouses',
}: WarehouseComboboxProps) {
  // Keyed on the joined string, not the array: an inline array literal from the caller is a new
  // identity every render, which would re-create `fetch` and refetch on every keystroke.
  const excludeKey = (excludeTypes ?? []).join(',');
  const fetch = useCallback(
    async (search: string): Promise<PickerPage<Warehouse>> => {
      // The warehouses endpoint returns every match (no paging), so the list is always complete
      const data = await warehouseService.getAll({
        search: search || undefined,
        warehouseType: warehouseTypeFilter || undefined,
        isActive: true,
      });
      const excluded = new Set(excludeKey ? excludeKey.split(',') : []);
      const items = excluded.size ? data.filter((w) => !excluded.has(w.warehouseType)) : data;
      return { items, total: items.length };
    },
    [warehouseTypeFilter, excludeKey]
  );

  const { options, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<Warehouse>({
    fetch,
    toOption: (warehouse) => ({
      value: warehouse.id,
      label: `${warehouse.warehouseCode} - ${warehouse.warehouseName}`,
      searchText: `${warehouse.warehouseCode} ${warehouse.warehouseName} ${warehouse.city || ''} ${warehouse.state || ''}`,
    }),
    onError: (error) => {
      console.error('Failed to load warehouses:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load warehouses');
    },
  });

  return (
    <Combobox
      options={allowAll ? [{ value: '', label: allLabel, searchText: 'all warehouses' }, ...options] : options}
      value={value}
      onValueChange={onValueChange}
      placeholder={
        !initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading warehouses...') : placeholder
      }
      searchPlaceholder="Search by code, name, city..."
      emptyText="No warehouses found."
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
