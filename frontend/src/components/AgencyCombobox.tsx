import { useCallback } from 'react';
import { Combobox } from './ui/combobox';
import { searchAgencies } from '@/services/agency.service';
import { usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
import type { AgencySearchResult } from '@/types/agency.types';
import { toast } from 'sonner';

/** /agencies/search returns a plain array, so a full page is the only sign that more exist. */
const AGENCY_PICKER_LIMIT = 100;

interface AgencyComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AgencyCombobox({
  value,
  onValueChange,
  placeholder = 'Select agency...',
  className,
  disabled = false,
}: AgencyComboboxProps) {
  const fetch = useCallback(async (search: string): Promise<PickerPage<AgencySearchResult>> => {
    const items = await searchAgencies({ search: search || undefined, limit: AGENCY_PICKER_LIMIT });
    return { items };
  }, []);

  const { options, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<AgencySearchResult>({
    fetch,
    limit: AGENCY_PICKER_LIMIT,
    toOption: (agency) => ({
      value: agency.id,
      label: `${agency.code} - ${agency.name}`,
      searchText: `${agency.code} ${agency.name} ${agency.phone || ''}`,
    }),
    narrowHint: 'type a code or name to narrow',
    onError: (error) => {
      console.error('Failed to load agencies:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load agencies');
    },
  });

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={
        !initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading agencies...') : placeholder
      }
      searchPlaceholder="Search by code, name..."
      emptyText="No agencies found."
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
