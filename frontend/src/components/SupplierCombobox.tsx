import { useCallback } from 'react';
import { Combobox } from './ui/combobox';
import { getAllSuppliers } from '@/services/supplier.service';
import { usePickerOptions, PICKER_LIMIT, type PickerPage } from '@/hooks/usePickerOptions';
import type { Supplier } from '@/types/supplier.types';
import { toast } from 'sonner';

interface SupplierComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  categoryFilter?: string; // Optional filter by supplier category
  allowAll?: boolean; // Show "All Suppliers" option for filter use cases
  allLabel?: string; // Custom label for "all" option (default: "All Suppliers")
}

export function SupplierCombobox({
  value,
  onValueChange,
  placeholder = 'Select supplier...',
  className,
  disabled = false,
  categoryFilter,
  allowAll = false,
  allLabel = 'All Suppliers',
}: SupplierComboboxProps) {
  const fetch = useCallback(
    async (search: string): Promise<PickerPage<Supplier>> => {
      const response = await getAllSuppliers({
        limit: PICKER_LIMIT,
        search: search || undefined,
        category: categoryFilter || undefined,
      });
      return { items: response.data ?? [], total: response.pagination?.total };
    },
    [categoryFilter]
  );

  const {
    options: suppliers,
    isLoading,
    initialLoaded,
    loadError,
    load,
    footer,
  } = usePickerOptions<Supplier>({
    fetch,
    toOption: (supplier) => ({
      value: supplier.id,
      label: `${supplier.code} - ${supplier.name}`,
      searchText: `${supplier.code} ${supplier.name} ${supplier.contactPerson || ''} ${Array.isArray(supplier.supplierCategories) ? supplier.supplierCategories.map((c) => (typeof c === 'string' ? c : String(c))).join(' ') : ''}`,
    }),
    narrowHint: 'type a code, name or contact to narrow',
    onError: (error) => {
      console.error('Failed to load suppliers:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load suppliers');
    },
  });

  // Build options list with optional "All" at the top
  const options = allowAll ? [{ value: '', label: allLabel, searchText: 'all suppliers' }, ...suppliers] : suppliers;

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={
        !initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading suppliers...') : placeholder
      }
      searchPlaceholder="Search by code, name, contact..."
      emptyText={categoryFilter ? `No ${categoryFilter.toLowerCase()} suppliers found.` : 'No suppliers found.'}
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
