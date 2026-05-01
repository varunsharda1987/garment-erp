import { useState, useEffect, useCallback } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { warehouseService } from '@/services/warehouse.service';
import { toast } from 'sonner';

interface WarehouseComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  warehouseTypeFilter?: string;
}

export function WarehouseCombobox({
  value,
  onValueChange,
  placeholder = 'Select warehouse...',
  className,
  disabled = false,
  warehouseTypeFilter,
}: WarehouseComboboxProps) {
  const [warehouses, setWarehouses] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    loadWarehouses('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseTypeFilter]);

  const loadWarehouses = useCallback(
    async (search: string) => {
      try {
        setIsLoading(true);
        const data = await warehouseService.getAll({
          search: search || undefined,
          warehouseType: warehouseTypeFilter || undefined,
          isActive: true,
        });

        const warehouseOptions: ComboboxOption[] = data.map((warehouse) => ({
          value: warehouse.id,
          label: `${warehouse.warehouseCode} - ${warehouse.warehouseName}`,
          searchText: `${warehouse.warehouseCode} ${warehouse.warehouseName} ${warehouse.city || ''} ${warehouse.state || ''}`,
        }));

        setWarehouses(warehouseOptions);
        setInitialLoaded(true);
      } catch (error: unknown) {
        console.error('Failed to load warehouses:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load warehouses');
      } finally {
        setIsLoading(false);
      }
    },
    [warehouseTypeFilter]
  );

  return (
    <Combobox
      options={warehouses}
      value={value}
      onValueChange={onValueChange}
      placeholder={!initialLoaded ? 'Loading warehouses...' : placeholder}
      searchPlaceholder="Search by code, name, city..."
      emptyText="No warehouses found."
      disabled={disabled || !initialLoaded}
      className={className}
      onSearchChange={loadWarehouses}
      isLoading={isLoading}
    />
  );
}
