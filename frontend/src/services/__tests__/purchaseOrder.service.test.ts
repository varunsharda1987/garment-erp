/**
 * Every PO list filter reaches the API. The hand-written params whitelist this replaced dropped `delivery`,
 * so "Delivery: to be advised" (and the Control Center link to it) listed every PO (2026-09-26).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api';
import { getAllPurchaseOrders, toPurchaseOrderListParams } from '../purchaseOrder.service';
import type { PurchaseOrderFilters } from '@/types/purchaseOrder.types';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
}));

const get = api.get as unknown as ReturnType<typeof vi.fn>;

// Required<>: a key added to PurchaseOrderFilters must be added here too, or the type-check fails —
// and the test below then proves it is sent.
const EVERY_FILTER: Required<PurchaseOrderFilters> = {
  status: 'SENT',
  source: 'MANUAL',
  poCategories: ['GREIGE', 'TRIMS'],
  supplierId: 'sup-1',
  orderId: 'ord-1',
  delivery: 'TO_BE_ADVISED',
  search: 'poplin',
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  page: 3,
  limit: 50,
  sortBy: 'poNumber',
  sortOrder: 'asc',
};

describe('getAllPurchaseOrders', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: { success: true, data: [], pagination: {} } });
  });

  it('sends every filter key (the list is joined with commas)', async () => {
    await getAllPurchaseOrders(EVERY_FILTER);

    expect(get).toHaveBeenCalledTimes(1);
    const [url, config] = get.mock.calls[0];
    expect(url).toBe('/purchase-orders');
    expect(Object.keys(config.params).sort()).toEqual(Object.keys(EVERY_FILTER).sort());
    expect(config.params).toEqual({ ...EVERY_FILTER, poCategories: 'GREIGE,TRIMS' });
  });

  it('sends the delivery filter the old whitelist dropped', async () => {
    await getAllPurchaseOrders({ delivery: 'TO_BE_ADVISED' });
    expect(get.mock.calls[0][1].params).toEqual({ page: 1, limit: 20, delivery: 'TO_BE_ADVISED' });
  });
});

describe('toPurchaseOrderListParams', () => {
  it('defaults page and limit, and leaves out blanks and empty lists', () => {
    expect(
      toPurchaseOrderListParams({ search: '', supplierId: undefined, poCategories: [], status: undefined })
    ).toEqual({ page: 1, limit: 20 });
    expect(toPurchaseOrderListParams()).toEqual({ page: 1, limit: 20 });
  });
});
