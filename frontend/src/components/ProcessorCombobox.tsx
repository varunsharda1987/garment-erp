import { useCallback, useEffect, useRef } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { getProcessorSuppliers, type ProcessorListResponse } from '@/services/vendorSuggestion.service';
import { getAllSuppliers, getSupplierById } from '@/services/supplier.service';
import { matchesSearch, usePickerOptions, PICKER_LIMIT, type PickerPage } from '@/hooks/usePickerOptions';
import type { Supplier, SupplierCategory } from '@/types/supplier.types';
import { toast } from 'sonner';

type Processor = ProcessorListResponse['processorList'][number];

interface ProcessorComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowAll?: boolean; // Put an "All …" row (value '') first — for filter use; picking it clears the filter
  allLabel?: string; // Label of that row (default: "All processors")
  /**
   * List the suppliers holding ANY of these categories instead of the dye / print / wash / finish roster —
   * e.g. every job-work category, so embroiderers, smockers and CMT units are offered too. Server-searched
   * (GET /suppliers?category=A,B). Leave it out (or empty) for the roster.
   */
  categories?: SupplierCategory[];
}

/** Code, name and capabilities ("DYEING PRINTING", "WASHING"…), so "dyeing" finds the dyers. */
const processorSearchText = (processor: {
  code?: string | null;
  name: string;
  supplierCategories?: readonly string[] | null;
}) => `${processor.code ?? ''} ${processor.name} ${(processor.supplierCategories ?? []).join(' ').replace(/_/g, ' ')}`;

const processorLabel = (processor: { code?: string | null; name: string }) =>
  processor.code ? `${processor.code} - ${processor.name}` : processor.name;

const onLoadError = (error: unknown) => {
  console.error('Failed to load processors:', error);
  toast.error(error instanceof Error ? error.message : 'Failed to load processors');
};

/**
 * Picks a PROCESSOR. Two sources:
 *   - by default, an active supplier that dyes / prints, washes or finishes — the roster the Requirements
 *     page's processor filter and the processor-assignment dialog use (GET /mrp/processing-assignment/processors);
 *   - with `categories`, every supplier holding any of those categories (GET /suppliers?category=…) — the
 *     Job Work Orders list offers all job-work processors this way, not only the dyers.
 */
export function ProcessorCombobox(props: ProcessorComboboxProps) {
  if (props.categories?.length) {
    // A new category set is a new list: remount (as SupplierCombobox does per category) so the previous
    // set's processors are never offered while the new list loads.
    return <CategoryProcessorPicker key={[...props.categories].sort().join(',')} {...props} />;
  }
  return <RosterProcessorPicker {...props} />;
}

/**
 * The roster endpoint returns the whole list in one response, so the search is client-side: every typed word
 * must match the code, name or capability. The roster is fetched on the unfiltered loads (first load, a
 * retry, the list reopened) and searched in memory while typing.
 */
function RosterProcessorPicker({
  value,
  onValueChange,
  placeholder = 'Select processor...',
  className,
  disabled = false,
  allowAll = false,
  allLabel = 'All processors',
}: ProcessorComboboxProps) {
  const rosterRef = useRef<Processor[] | null>(null);

  const fetch = useCallback(async (search: string): Promise<PickerPage<Processor>> => {
    if (!search || !rosterRef.current) {
      const response = await getProcessorSuppliers();
      rosterRef.current = response.processorList ?? [];
    }
    const roster = rosterRef.current;
    const items = search ? roster.filter((processor) => matchesSearch(processorSearchText(processor), search)) : roster;
    return { items, total: items.length };
  }, []);

  const { options, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<Processor>({
    fetch,
    toOption: (processor) => ({
      value: processor.id,
      label: processorLabel(processor),
      searchText: processorSearchText(processor),
    }),
    onError: onLoadError,
  });

  return (
    <Combobox
      options={allowAll ? [{ value: '', label: allLabel, searchText: 'all processors' }, ...options] : options}
      value={value}
      onValueChange={onValueChange}
      placeholder={
        !initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading processors...') : placeholder
      }
      searchPlaceholder="Search by code, name, dyeing, washing..."
      emptyText="No processors found."
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

function categoryProcessorOption(supplier: Supplier): ComboboxOption {
  return {
    value: supplier.id,
    label: processorLabel(supplier),
    // Only reachable through the selected-record lookup below: the list itself holds active suppliers only
    description: supplier.isActive === false ? 'Deactivated' : undefined,
    searchText: processorSearchText(supplier),
  };
}

/**
 * The suppliers list, narrowed to the categories and searched on the server (code, name, contact, phone,
 * GST number…). It lists active suppliers only; a chosen processor outside the first page — or one
 * deactivated since its jobs were raised — is fetched once by id so the box can still name it.
 */
function CategoryProcessorPicker({
  value,
  onValueChange,
  placeholder = 'Select processor...',
  className,
  disabled = false,
  allowAll = false,
  allLabel = 'All processors',
  categories = [],
}: ProcessorComboboxProps) {
  const category = categories.join(',');

  const fetch = useCallback(
    async (search: string): Promise<PickerPage<Supplier>> => {
      const response = await getAllSuppliers({ limit: PICKER_LIMIT, search: search || undefined, category });
      return { items: response.data ?? [], total: response.pagination?.total };
    },
    [category]
  );

  const { options, byId, addItem, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<Supplier>({
    fetch,
    toOption: categoryProcessorOption,
    narrowHint: 'type a code, name or contact to narrow',
    onError: onLoadError,
  });

  // The typed search: a narrowed list leaving the chosen processor out is expected, not a reason to look it up
  // (the lookup would also put it among results it does not match).
  const searchRef = useRef('');

  // Not cancelled on cleanup: the once-only guard would then never retry it. A late answer only puts one
  // more processor in the list.
  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!value || !initialLoaded || searchRef.current || byId.has(value) || fetchedFor.current === value) return;
    fetchedFor.current = value;
    getSupplierById(value)
      .then((supplier) => {
        if (supplier) addItem(supplier);
      })
      .catch((error) => console.error('Failed to fetch the selected processor:', error));
  }, [value, initialLoaded, byId, addItem]);

  return (
    <Combobox
      options={allowAll ? [{ value: '', label: allLabel, searchText: 'all processors' }, ...options] : options}
      value={value}
      onValueChange={onValueChange}
      placeholder={
        !initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading processors...') : placeholder
      }
      searchPlaceholder="Search by code, name, contact..."
      emptyText="No processors found."
      disabled={disabled}
      className={className}
      onOpenChange={(open) => {
        if (open && !initialLoaded && !isLoading) load('');
      }}
      onSearchChange={(text) => {
        searchRef.current = text;
        load(text);
      }}
      isLoading={isLoading}
      footer={footer}
    />
  );
}
