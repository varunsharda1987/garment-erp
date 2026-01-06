import { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadMaterials();
  }, [categoryFilter]);

  const loadMaterials = async () => {
    try {
      setIsLoading(true);
      const response = await getAllMaterials({ limit: 500, isActive: true });

      let materialData = response.data || [];

      // Filter by category if provided
      if (categoryFilter) {
        materialData = materialData.filter((material: any) =>
          material.category?.toLowerCase().includes(categoryFilter.toLowerCase())
        );
      }

      const materialOptions: ComboboxOption[] = materialData.map((material: any) => ({
        value: material.id,
        label: `${material.code} - ${material.name}`,
        searchText: `${material.code} ${material.name} ${material.category || ''} ${material.description || ''}`,
      }));

      setMaterials(materialOptions);
    } catch (error: any) {
      console.error('Failed to load materials:', error);
      toast.error(error?.message || 'Failed to load materials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Combobox
      options={materials}
      value={value}
      onValueChange={onValueChange}
      placeholder={isLoading ? "Loading materials..." : placeholder}
      searchPlaceholder="Search by code, name, category..."
      emptyText={categoryFilter ? `No ${categoryFilter.toLowerCase()} materials found.` : "No materials found."}
      disabled={disabled || isLoading}
      className={className}
    />
  );
}
