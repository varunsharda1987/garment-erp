import { useState, useEffect, useCallback } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { searchAgencies } from '@/services/agency.service';
import { toast } from 'sonner';

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
  placeholder = "Select agency...",
  className,
  disabled = false,
}: AgencyComboboxProps) {
  const [agencies, setAgencies] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load initial agencies
  useEffect(() => {
    loadAgencies('');
  }, []);

  const loadAgencies = useCallback(async (search: string) => {
    try {
      setIsLoading(true);
      const agencyList = await searchAgencies({
        search: search || undefined,
        limit: 50,
      });

      const agencyOptions: ComboboxOption[] = agencyList.map((agency) => ({
        value: agency.id,
        label: `${agency.code} - ${agency.name}`,
        searchText: `${agency.code} ${agency.name} ${agency.phone || ''}`,
      }));

      setAgencies(agencyOptions);
      setInitialLoaded(true);
    } catch (error: any) {
      console.error('Failed to load agencies:', error);
      toast.error(error?.message || 'Failed to load agencies');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <Combobox
      options={agencies}
      value={value}
      onValueChange={onValueChange}
      placeholder={!initialLoaded ? "Loading agencies..." : placeholder}
      searchPlaceholder="Search by code, name..."
      emptyText="No agencies found."
      disabled={disabled || !initialLoaded}
      className={className}
      onSearchChange={loadAgencies}
      isLoading={isLoading}
    />
  );
}
