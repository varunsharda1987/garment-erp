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

        const supplierOptions: ComboboxOption[] = (response.data || []).map((supplier: any) => ({
          value: supplier.id,
          label: `${supplier.code} - ${supplier.name}`,
          searchText: `${supplier.code} ${supplier.name} ${supplier.contactPersonName || ''} ${supplier.supplierCategories?.map((c: any) => c.category).join(' ') || ''}`,
        }));

        setSuppliers(supplierOptions);
        setInitialLoaded(true);
      } catch (error: any) {
        console.error('Failed to load suppliers:', error);
        toast.error(error?.message || 'Failed to load suppliers');
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
