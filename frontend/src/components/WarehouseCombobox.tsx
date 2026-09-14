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
}

export function WarehouseCombobox({
  value,
  onValueChange,
  placeholder = 'Select warehouse...',
  className,
  disabled = false,
  warehouseTypeFilter,
}: WarehouseComboboxProps) {
  const fetch = useCallback(
    async (search: string): Promise<PickerPage<Warehouse>> => {
      // The warehouses endpoint returns every match (no paging), so the list is always complete
      const data = await warehouseService.getAll({
        search: search || undefined,
        warehouseType: warehouseTypeFilter || undefined,
        isActive: true,
      });
      return { items: data, total: data.length };
    },
    [warehouseTypeFilter]
  );

  const { options, isLoading, initialLoaded, load, footer } = usePickerOptions<Warehouse>({
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
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={!initialLoaded ? 'Loading warehouses...' : placeholder}
      searchPlaceholder="Search by code, name, city..."
      emptyText="No warehouses found."
      disabled={disabled || !initialLoaded}
      className={className}
      onSearchChange={load}
      isLoading={isLoading}
      footer={footer}
    />
  );
}
