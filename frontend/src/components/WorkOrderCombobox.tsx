import { useCallback, useEffect, useRef } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { workOrderService } from '@/services/workOrder.service';
import { usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
import type { OrderStatus, WorkOrder } from '@/types/production.types';
import { toast } from 'sonner';

interface WorkOrderComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Only runs in this status. */
  status?: OrderStatus;
  /** Only this order's runs — for an order → run cascade. */
  orderId?: string;
  /** Only this style's runs. */
  styleId?: string;
  allowAll?: boolean; // Put an "All …" row (value '') first — for filter use; picking it clears the filter
  allLabel?: string; // Label of that row (default: "All production runs")
}

/** "WO2609-0087 — ESSKY082LS (EB-77)": the run, then the style as the Production Runs list shows it. */
function runLabel(run: WorkOrder): string {
  const style = run.style;
  if (!style?.styleCode) return run.workOrderNumber;
  return style.buyerStyleRef
    ? `${run.workOrderNumber} — ${style.styleCode} (${style.buyerStyleRef})`
    : `${run.workOrderNumber} — ${style.styleCode}`;
}

/** The Order / Source column of the Production Runs list: the order and its customer, or the stock order. */
function runSource(run: WorkOrder): string | undefined {
  if (run.orders) {
    const customer = run.orders.customer?.name;
    return customer ? `${run.orders.orderNumber} · ${customer}` : run.orders.orderNumber;
  }
  if (run.stockProductionOrderId) return `${run.stockProductionOrder?.spoNumber ?? 'Stock production'} · Make-to-stock`;
  return undefined;
}

function runOption(run: WorkOrder): ComboboxOption {
  return {
    value: run.id,
    label: runLabel(run),
    description: runSource(run),
    // Unique per run (the run number leads), so two runs of one order never share a list entry
    searchText: [
      run.workOrderNumber,
      run.style?.styleCode,
      run.style?.buyerStyleRef,
      run.style?.styleName,
      run.orders?.orderNumber,
      run.orders?.customer?.name,
      run.stockProductionOrder?.spoNumber,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

/**
 * Picks a PRODUCTION RUN (a work order — the `work_orders` table; the app calls them production runs).
 * Server-searched: GET /work-orders matches the run number, style code / buyer's code / style name, order
 * number and customer, stock-order (SPO) number and location, so typing any of those narrows it. Newest
 * first, as on the Production Runs page.
 *
 * The endpoint is not paged — it returns every matching run — so what comes back is the whole answer and
 * the picker never says "Showing N of M".
 *
 * A change of the narrowing props is a new list, so the picker remounts (as OrderCombobox does per
 * customer) and never offers the previous list's runs while the new one loads.
 */
export function WorkOrderCombobox(props: WorkOrderComboboxProps) {
  return <WorkOrderPicker key={`${props.status ?? ''}|${props.orderId ?? ''}|${props.styleId ?? ''}`} {...props} />;
}

function WorkOrderPicker({
  value,
  onValueChange,
  placeholder = 'Select production run...',
  className,
  disabled = false,
  status,
  orderId,
  styleId,
  allowAll = false,
  allLabel = 'All production runs',
}: WorkOrderComboboxProps) {
  const fetch = useCallback(
    async (search: string): Promise<PickerPage<WorkOrder>> => {
      const runs = await workOrderService.getAll({
        search: search || undefined,
        status: status || undefined,
        orderId: orderId || undefined,
        styleId: styleId || undefined,
      });
      return { items: runs, total: runs.length };
    },
    [status, orderId, styleId]
  );

  const { options, byId, addItem, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<WorkOrder>({
    fetch,
    toOption: runOption,
    // The server lists newest first — the run people look for is usually a recent one
    sortAlphabetically: false,
    narrowHint: 'type a run number, style or order to narrow',
    onError: (error) => {
      console.error('Failed to load production runs:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load production runs');
    },
  });

  // A chosen run outside the list (a filter restored from the URL while the list is narrowed) is fetched
  // once so the box can name it; after that the combobox remembers its label through later searches.
  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!value || !initialLoaded || byId.has(value) || fetchedFor.current === value) return;
    fetchedFor.current = value;
    // Not cancelled on cleanup: the once-only guard above would then never retry it. A late answer only
    // puts one more run in the list.
    workOrderService
      .getById(value)
      .then((run) => addItem(run))
      .catch((error) => console.error('Failed to fetch the selected production run:', error));
  }, [value, initialLoaded, byId, addItem]);

  return (
    <Combobox
      options={allowAll ? [{ value: '', label: allLabel, searchText: 'all production runs' }, ...options] : options}
      value={value}
      onValueChange={onValueChange}
      placeholder={
        !initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading production runs...') : placeholder
      }
      searchPlaceholder="Search by run number, style, buyer ref, order..."
      emptyText={orderId ? 'No production runs found for this order.' : 'No production runs found.'}
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
