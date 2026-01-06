import { useState, useEffect } from 'react';
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
  placeholder = "Select supplier...",
  className,
  disabled = false,
  categoryFilter,
}: SupplierComboboxProps) {
  const [suppliers, setSuppliers] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, [categoryFilter]);

  const loadSuppliers = async () => {
    try {
      setIsLoading(true);
      const response = await getAllSuppliers({ limit: 500, isActive: true });

      let supplierData = response.data || [];

      // Filter by category if provided
      if (categoryFilter) {
        supplierData = supplierData.filter((supplier: any) =>
          supplier.supplierCategories?.some((cat: any) =>
            cat.category === categoryFilter
          )
        );
      }

      const supplierOptions: ComboboxOption[] = supplierData.map((supplier: any) => ({
        value: supplier.id,
        label: `${supplier.code} - ${supplier.name}`,
        searchText: `${supplier.code} ${supplier.name} ${supplier.contactPersonName || ''} ${supplier.supplierCategories?.map((c: any) => c.category).join(' ') || ''}`,
      }));

      setSuppliers(supplierOptions);
    } catch (error: any) {
      console.error('Failed to load suppliers:', error);
      toast.error(error?.message || 'Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Combobox
      options={suppliers}
      value={value}
      onValueChange={onValueChange}
      placeholder={isLoading ? "Loading suppliers..." : placeholder}
      searchPlaceholder="Search by code, name, contact..."
      emptyText={categoryFilter ? `No ${categoryFilter.toLowerCase()} suppliers found.` : "No suppliers found."}
      disabled={disabled || isLoading}
      className={className}
    />
  );
}
