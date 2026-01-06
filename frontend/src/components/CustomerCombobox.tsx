import { useState, useEffect } from 'react';
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
  placeholder = "Select customer...",
  className,
  disabled = false,
}: CustomerComboboxProps) {
  const [customers, setCustomers] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const response = await customerService.getAllCustomers({ limit: 1000, isActive: 'true' });

      const customerOptions: ComboboxOption[] = (response.data || []).map((customer: any) => ({
        value: customer.id,
        label: `${customer.code} - ${customer.name}`,
        searchText: `${customer.code} ${customer.name} ${customer.brandNames || ''} ${customer.billingName || ''}`,
      }));

      setCustomers(customerOptions);
    } catch (error: any) {
      console.error('Failed to load customers:', error);
      toast.error(error?.message || 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Combobox
      options={customers}
      value={value}
      onValueChange={onValueChange}
      placeholder={isLoading ? "Loading customers..." : placeholder}
      searchPlaceholder="Search by code, name, brand..."
      emptyText="No customers found."
      disabled={disabled || isLoading}
      className={className}
    />
  );
}
