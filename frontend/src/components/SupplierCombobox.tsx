import { useCallback, useState } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
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
  /**
   * The record behind `value`, shown as the selected option even when the category filter leaves it out —
   * a Trims PO MRP raised with a packaging supplier opened with a blank supplier box (2026-09-28).
   */
  selectedSupplier?: { id: string; code?: string | null; name: string } | null;
}

/**
 * A new category is a new list. usePickerOptions keeps the old list on screen until the reload lands, so
 * switching a PO from Greige to Greige Lace still offered greige suppliers for a few seconds and one got
 * picked (2026-09-28). Remounting per category starts from an empty "Loading suppliers..." list instead;
 * the fix lives here because the hook and the combobox are shared by every picker.
 */
export function SupplierCombobox(props: SupplierComboboxProps) {
  return <SupplierPicker key={props.categoryFilter ?? ''} {...props} />;
}

function SupplierPicker({
  value,
  onValueChange,
  placeholder = 'Select supplier...',
  className,
  disabled = false,
  categoryFilter,
  allowAll = false,
  allLabel = 'All Suppliers',
  selectedSupplier,
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

  // The typed search, so the pinned supplier below only shows while it matches what was typed
  const [search, setSearch] = useState('');

  const pinned: ComboboxOption | null =
    selectedSupplier && value === selectedSupplier.id && !suppliers.some((s) => s.value === selectedSupplier.id)
      ? {
          value: selectedSupplier.id,
          label: selectedSupplier.code ? `${selectedSupplier.code} - ${selectedSupplier.name}` : selectedSupplier.name,
          searchText: `${selectedSupplier.code ?? ''} ${selectedSupplier.name}`,
        }
      : null;
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shownPinned = pinned && words.every((w) => (pinned.searchText ?? '').toLowerCase().includes(w)) ? pinned : null;

  // Build options list with optional "All" at the top
  const options = [
    ...(allowAll ? [{ value: '', label: allLabel, searchText: 'all suppliers' }] : []),
    ...(shownPinned ? [shownPinned] : []),
    ...suppliers,
  ];

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
      onSearchChange={(text) => {
        setSearch(text);
        load(text);
      }}
      isLoading={isLoading}
      footer={footer}
    />
  );
}
