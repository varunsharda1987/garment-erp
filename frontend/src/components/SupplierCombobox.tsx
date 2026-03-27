import { useState, useEffect, useCallback } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { getAllSuppliers } from '@/services/supplier.service';
import { toast } from 'sonner';

interface SupplierComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  categoryFilter?: string; // Optional filter by supplier category
}

export function SupplierCombobox({
  value,
  onValueChange,
  placeholder = 'Select supplier...',
  className,
  disabled = false,
  categoryFilter,
}: SupplierComboboxProps) {
  const [suppliers, setSuppliers] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load initial suppliers
  useEffect(() => {
    loadSuppliers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  const loadSuppliers = useCallback(
    async (search: string) => {
      try {
        setIsLoading(true);
        // Server-side search with reasonable limit
        const response = await getAllSuppliers({
          limit: 50,
          search: search || undefined,
          category: categoryFilter || undefined,
        });

        const supplierOptions: ComboboxOption[] = (response.data || []).map((supplier) => ({
          value: supplier.id,
          label: `${supplier.code} - ${supplier.name}`,
          searchText: `${supplier.code} ${supplier.name} ${supplier.contactPerson || ''} ${Array.isArray(supplier.supplierCategories) ? supplier.supplierCategories.map((c) => (typeof c === 'string' ? c : String(c))).join(' ') : ''}`,
        }));

        setSuppliers(supplierOptions);
        setInitialLoaded(true);
      } catch (error: unknown) {
        console.error('Failed to load suppliers:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load suppliers');
      } finally {
        setIsLoading(false);
      }
    },
    [categoryFilter]
  );

  return (
    <Combobox
      options={suppliers}
      value={value}
      onValueChange={onValueChange}
      placeholder={!initialLoaded ? 'Loading suppliers...' : placeholder}
      searchPlaceholder="Search by code, name, contact..."
      emptyText={categoryFilter ? `No ${categoryFilter.toLowerCase()} suppliers found.` : 'No suppliers found.'}
      disabled={disabled || !initialLoaded}
      className={className}
      onSearchChange={loadSuppliers}
      isLoading={isLoading}
    />
  );
}
