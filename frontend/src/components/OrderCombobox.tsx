import { useCallback, useEffect, useRef } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { getAllOrders, getOrderById } from '@/services/order.service';
import { usePickerOptions, PICKER_LIMIT, type PickerPage } from '@/hooks/usePickerOptions';
import type { Order } from '@/types/order.types';
import { toast } from 'sonner';

interface OrderComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Only this customer's orders — for a customer → order cascade. */
  customerId?: string;
  allowAll?: boolean; // Put an "All …" row (value '') first — for filter use; picking it clears the filter
  allLabel?: string; // Label of that row (default: "All orders")
}

/** Each style on the order once, in line order: its code and the buyer's code for it. */
function styleCodes(order: Order): string[] {
  const codes = new Set<string>();
  for (const item of order.orderItems ?? []) {
    if (item.style?.styleCode) codes.add(item.style.styleCode);
    if (item.style?.buyerStyleRef) codes.add(item.style.buyerStyleRef);
  }
  return [...codes];
}

function orderOption(order: Order): ComboboxOption {
  const customer = order.customer?.name;
  const styles = [
    ...new Set((order.orderItems ?? []).map((item) => item.style?.styleCode).filter((code): code is string => !!code)),
  ];
  return {
    value: order.id,
    label: customer ? `${order.orderNumber} — ${customer}` : order.orderNumber,
    description: styles.length
      ? styles.length > 3
        ? `${styles.slice(0, 3).join(', ')} +${styles.length - 3} more`
        : styles.join(', ')
      : undefined,
    searchText: `${order.orderNumber} ${customer ?? ''} ${order.customer?.code ?? ''} ${styleCodes(order).join(' ')}`,
  };
}

/**
 * Picks a production ORDER (the orders table — not a sale order). Server-searched: the order list's own
 * search matches the order number, customer, style code / buyer's code / style name and sale order, so
 * typing any of those narrows it. Newest first, as on the Orders page.
 *
 * A new customer is a new list, so the picker remounts per customer (as SupplierCombobox does per
 * category) and never offers the previous customer's orders while the new list loads.
 */
export function OrderCombobox(props: OrderComboboxProps) {
  return <OrderPicker key={props.customerId ?? ''} {...props} />;
}

function OrderPicker({
  value,
  onValueChange,
  placeholder = 'Select order...',
  className,
  disabled = false,
  customerId,
  allowAll = false,
  allLabel = 'All orders',
}: OrderComboboxProps) {
  const fetch = useCallback(
    async (search: string): Promise<PickerPage<Order>> => {
      const response = await getAllOrders({
        page: 1,
        limit: PICKER_LIMIT,
        search: search || undefined,
        customerId: customerId || undefined,
      });
      return { items: response.data ?? [], total: response.pagination?.total };
    },
    [customerId]
  );

  const { options, byId, addItem, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<Order>({
    fetch,
    toOption: orderOption,
    // The server lists newest first — the order people look for is usually a recent one
    sortAlphabetically: false,
    narrowHint: 'type an order number, customer or style to narrow',
    onError: (error) => {
      console.error('Failed to load orders:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load orders');
    },
  });

  // A chosen order older than the first page (e.g. a filter restored from the URL) is fetched once so the
  // box can name it; after that the combobox remembers its label through later searches.
  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!value || !initialLoaded || byId.has(value) || fetchedFor.current === value) return;
    fetchedFor.current = value;
    // Not cancelled on cleanup: the once-only guard above would then never retry it. A late answer only
    // puts one more order in the list.
    getOrderById(value)
      .then((order) => {
        if (order) addItem(order);
      })
      .catch((error) => console.error('Failed to fetch the selected order:', error));
  }, [value, initialLoaded, byId, addItem]);

  return (
    <Combobox
      options={allowAll ? [{ value: '', label: allLabel, searchText: 'all orders' }, ...options] : options}
      value={value}
      onValueChange={onValueChange}
      placeholder={!initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading orders...') : placeholder}
      searchPlaceholder="Search by order number, customer, style..."
      emptyText={customerId ? 'No orders found for this customer.' : 'No orders found.'}
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
