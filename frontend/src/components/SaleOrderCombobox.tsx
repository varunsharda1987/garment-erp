import { useCallback, useEffect, useRef } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { getAllSaleOrders, getSaleOrderById } from '@/services/saleOrder.service';
import { usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
import type { SaleOrder, SaleOrderStatus } from '@/types/saleOrder.types';
import { toast } from 'sonner';

/**
 * The sale-order LIST caps a page at 100 (`saleOrderQuerySchema`), below the pickers' usual
 * PICKER_LIMIT of 200 — asking for 200 makes every load a 400 and the picker sits on
 * "Could not load — open to retry".
 */
const SALE_ORDER_PAGE = 100;

interface SaleOrderComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  /** The picked sale order itself (null when cleared) — for forms that copy its customer, PO or dates. */
  onSaleOrderChange?: (saleOrder: SaleOrder | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Only this customer's sale orders — for a customer → sale order cascade. */
  customerId?: string;
  /** Only sale orders in this status (the list takes one). */
  status?: SaleOrderStatus;
  allowAll?: boolean; // Put an "All …" row (value '') first — for filter use; picking it clears the filter
  allLabel?: string; // Label of that row (default: "All sale orders")
}

/** Every buyer PO on the order, primary first; the header's copy when the list has none. */
function buyerPoNumbers(so: SaleOrder): string[] {
  const numbers = new Set<string>();
  for (const po of so.buyerPos ?? []) {
    const number = po.buyerPoNumber?.trim();
    if (number) numbers.add(number);
  }
  const header = so.buyerPoNumber?.trim();
  if (!numbers.size && header) numbers.add(header);
  return [...numbers];
}

/** Each style on the order once: its code, the buyer's code as taken on the line, and the master's. */
function styleCodes(so: SaleOrder): string[] {
  const codes = new Set<string>();
  if (so.style?.styleCode) codes.add(so.style.styleCode);
  for (const item of so.items ?? []) {
    if (item.style?.styleCode) codes.add(item.style.styleCode);
    if (item.buyerStyleRef) codes.add(item.buyerStyleRef);
    if (item.style?.buyerStyleRef) codes.add(item.style.buyerStyleRef);
  }
  return [...codes];
}

function saleOrderOption(so: SaleOrder): ComboboxOption {
  const customer = so.customer?.name;
  const pos = buyerPoNumbers(so);
  return {
    value: so.id,
    label: customer ? `${so.saleOrderNumber} — ${customer}` : so.saleOrderNumber,
    description: pos.length ? `PO ${pos.join(', ')}` : undefined,
    searchText: `${so.saleOrderNumber} ${customer ?? ''} ${so.customer?.code ?? ''} ${styleCodes(so).join(' ')}`,
  };
}

/**
 * Picks a SALE ORDER (the buyer's order — not a production order). Server-searched through the sale-order
 * LIST, not /sale-orders/search: both match the same fields (sale order number, every buyer PO number,
 * customer, style code / buyer's code / style name, season), but only the list returns the buyer PO for
 * the second line, reports a total for "Showing N of M", and takes `customerId` / `status`.
 * Newest first, as on the Sale Orders page.
 *
 * A new customer or status is a new list, so the picker remounts per filter (as OrderCombobox does per
 * customer) and never offers the previous customer's orders while the new list loads.
 */
export function SaleOrderCombobox(props: SaleOrderComboboxProps) {
  return <SaleOrderPicker key={`${props.customerId ?? ''}|${props.status ?? ''}`} {...props} />;
}

function SaleOrderPicker({
  value,
  onValueChange,
  onSaleOrderChange,
  placeholder = 'Select sale order...',
  className,
  disabled = false,
  customerId,
  status,
  allowAll = false,
  allLabel = 'All sale orders',
}: SaleOrderComboboxProps) {
  const fetch = useCallback(
    async (search: string): Promise<PickerPage<SaleOrder>> => {
      const response = await getAllSaleOrders({
        page: 1,
        limit: SALE_ORDER_PAGE,
        search: search || undefined,
        customerId: customerId || undefined,
        status: status || undefined,
      });
      return { items: response.data ?? [], total: response.pagination?.total };
    },
    [customerId, status]
  );

  const { options, byId, addItem, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<SaleOrder>({
    fetch,
    toOption: saleOrderOption,
    // The picker's own limit, so a full page without a total still reads as "more may exist"
    limit: SALE_ORDER_PAGE,
    // The server lists newest first — the sale order people look for is usually a recent one
    sortAlphabetically: false,
    narrowHint: 'type a sale order or buyer PO number, customer or style to narrow',
    onError: (error) => {
      console.error('Failed to load sale orders:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load sale orders');
    },
  });

  // A chosen sale order older than the first page (an edit form, a filter restored from the URL) is
  // fetched once so the box can name it; after that the combobox remembers its label through later searches.
  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!value || !initialLoaded || byId.has(value) || fetchedFor.current === value) return;
    fetchedFor.current = value;
    // Not cancelled on cleanup: the once-only guard above would then never retry it. A late answer only
    // puts one more sale order in the list.
    getSaleOrderById(value)
      .then((so) => {
        if (so) addItem(so);
      })
      .catch((error) => console.error('Failed to fetch the selected sale order:', error));
  }, [value, initialLoaded, byId, addItem]);

  return (
    <Combobox
      options={allowAll ? [{ value: '', label: allLabel, searchText: 'all sale orders' }, ...options] : options}
      value={value}
      onValueChange={(next) => {
        onValueChange(next);
        onSaleOrderChange?.(next ? (byId.get(next) ?? null) : null);
      }}
      placeholder={
        !initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading sale orders...') : placeholder
      }
      searchPlaceholder="Search by sale order, buyer PO, customer, style..."
      emptyText={customerId ? 'No sale orders found for this customer.' : 'No sale orders found.'}
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
