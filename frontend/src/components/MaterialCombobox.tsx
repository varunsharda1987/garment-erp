import { useState, useEffect, useCallback } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { getAllMaterials } from '@/services/material.service';
import { toast } from 'sonner';

interface MaterialComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  categoryFilter?: string; // Optional filter by material category/type
}

export function MaterialCombobox({
  value,
  onValueChange,
  placeholder = "Select material...",
  className,
  disabled = false,
  categoryFilter,
}: MaterialComboboxProps) {
  const [materials, setMaterials] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load initial materials
  useEffect(() => {
    loadMaterials('');
  }, [categoryFilter]);

  const loadMaterials = useCallback(async (search: string) => {
    try {
      setIsLoading(true);
      // Server-side search with reasonable limit
      const response = await getAllMaterials({
        limit: 50,
        isActive: true,
        search: search || undefined,
        category: categoryFilter || undefined
      });

      const materialOptions: ComboboxOption[] = (response.data || []).map((material: any) => ({
        value: material.id,
        label: `${material.code} - ${material.name}`,
        searchText: `${material.code} ${material.name} ${material.category || ''} ${material.description || ''}`,
      }));

      setMaterials(materialOptions);
      setInitialLoaded(true);
    } catch (error: any) {
      console.error('Failed to load materials:', error);
      toast.error(error?.message || 'Failed to load materials');
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter]);

  return (
    <Combobox
      options={materials}
      value={value}
      onValueChange={onValueChange}
      placeholder={!initialLoaded ? "Loading materials..." : placeholder}
      searchPlaceholder="Search by code, name, category..."
      emptyText={categoryFilter ? `No ${categoryFilter.toLowerCase()} materials found.` : "No materials found."}
      disabled={disabled || !initialLoaded}
      className={className}
      onSearchChange={loadMaterials}
      isLoading={isLoading}
    />
  );
}
