import { useCallback } from 'react';
import { Combobox } from './ui/combobox';
import { customerService } from '@/services/customer.service';
import { usePickerOptions, PICKER_LIMIT, type PickerPage } from '@/hooks/usePickerOptions';
import type { Customer } from '@/types/customer.types';
import { toast } from 'sonner';

interface CustomerComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CustomerCombobox({
  value,
  onValueChange,
  placeholder = 'Select customer...',
  className,
  disabled = false,
}: CustomerComboboxProps) {
  const fetch = useCallback(async (search: string): Promise<PickerPage<Customer>> => {
    const response = await customerService.getAllCustomers({ limit: PICKER_LIMIT, search: search || undefined });
    return { items: response.data ?? [], total: response.pagination?.total };
  }, []);

  const { options, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<Customer>({
    fetch,
    toOption: (customer) => ({
      value: customer.id,
      label: `${customer.code} - ${customer.name}`,
      searchText: `${customer.code} ${customer.name} ${customer.brandNames || ''} ${customer.billingName || ''}`,
    }),
    narrowHint: 'type a code, name or brand to narrow',
    onError: (error) => {
      console.error('Failed to load customers:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load customers');
    },
  });

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={
        !initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading customers...') : placeholder
      }
      searchPlaceholder="Search by code, name, brand..."
      emptyText="No customers found."
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
