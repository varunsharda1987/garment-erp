import { useCallback, useRef } from 'react';
import { Combobox } from './ui/combobox';
import { getProcessorSuppliers, type ProcessorListResponse } from '@/services/vendorSuggestion.service';
import { matchesSearch, usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
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
}

/** Code, name and capabilities ("DYEING PRINTING", "WASHING"…), so "dyeing" finds the dyers. */
const processorSearchText = (processor: Processor) =>
  `${processor.code ?? ''} ${processor.name} ${(processor.supplierCategories ?? []).join(' ').replace(/_/g, ' ')}`;

/**
 * Picks a PROCESSOR — an active supplier that dyes / prints, washes or finishes. The roster is the one the
 * Requirements page's processor filter and the processor-assignment dialog use
 * (GET /mrp/processing-assignment/processors), so every processor filter offers the same list.
 *
 * The endpoint returns the whole roster in one response, so the search is client-side: every typed word
 * must match the code, name or capability. The roster is fetched on the unfiltered loads (first load, a
 * retry, the list reopened) and searched in memory while typing.
 */
export function ProcessorCombobox({
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
      label: processor.code ? `${processor.code} - ${processor.name}` : processor.name,
      searchText: processorSearchText(processor),
    }),
    onError: (error) => {
      console.error('Failed to load processors:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load processors');
    },
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
