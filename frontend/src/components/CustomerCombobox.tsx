import { useState, useEffect, useCallback } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { customerService } from '@/services/customer.service';
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
  const [customers, setCustomers] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load initial customers (small set for immediate display)
  useEffect(() => {
    loadCustomers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCustomers = useCallback(async (search: string) => {
    try {
      setIsLoading(true);
      // Server-side search with reasonable limit
      const response = await customerService.getAllCustomers({
        limit: 50,
        search: search || undefined,
      });

      const customerOptions: ComboboxOption[] = (response.data ?? []).map(
        (customer: { id: string; code: string; name: string; brandNames?: string; billingName?: string }) => ({
          value: customer.id,
          label: `${customer.code} - ${customer.name}`,
          searchText: `${customer.code} ${customer.name} ${customer.brandNames || ''} ${customer.billingName || ''}`,
        })
      );

      setCustomers(customerOptions);
      setInitialLoaded(true);
    } catch (error: unknown) {
      console.error('Failed to load customers:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <Combobox
      options={customers}
      value={value}
      onValueChange={onValueChange}
      placeholder={!initialLoaded ? 'Loading customers...' : placeholder}
      searchPlaceholder="Search by code, name, brand..."
      emptyText="No customers found."
      disabled={disabled || !initialLoaded}
      className={className}
      onSearchChange={loadCustomers}
      isLoading={isLoading}
    />
  );
}
