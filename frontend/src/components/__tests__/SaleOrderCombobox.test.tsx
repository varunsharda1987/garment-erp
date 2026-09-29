/**
 * SaleOrderCombobox — the shared picker over SALE orders (not production orders). It reads the sale-order
 * LIST (the only endpoint that returns the buyer PO and a total), asks for the list's own cap of 100 — 200
 * would 400 — and follows the shared picker contract: `allowAll` puts an "All …" row whose value is '',
 * a chosen sale order outside the first page is looked up once so its label shows, and a failed first load
 * is retried when the list is opened.
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SaleOrderCombobox } from '@/components/SaleOrderCombobox';
import { getAllSaleOrders, getSaleOrderById } from '@/services/saleOrder.service';

vi.mock('@/services/saleOrder.service', () => ({ getAllSaleOrders: vi.fn(), getSaleOrderById: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const pageOf = <T,>(data: T[], total = data.length) => ({
  data,
  pagination: { page: 1, limit: 100, total, totalPages: 1 },
});

/** The trigger button — `hidden` because the open (modal) list hides the rest of the page from the a11y tree */
const trigger = () => screen.getAllByRole('combobox', { hidden: true }).find((el) => el.tagName === 'BUTTON')!;
/** Longer than the combobox's 300 ms search debounce */
const settle = () => act(() => new Promise((r) => setTimeout(r, 450)));
const searchBox = () => screen.getByPlaceholderText('Search by sale order, buyer PO, customer, style...');

const newer = {
  id: 'so-2',
  saleOrderNumber: 'SO2609-0002',
  buyerPoNumber: '4500123',
  customer: { id: 'cust-1', code: 'CUS-001', name: 'House of Kasya' },
  buyerPos: [
    { id: 'po-1', buyerPoNumber: '4500123', isPrimary: true },
    { id: 'po-2', buyerPoNumber: '4500124', isPrimary: false },
  ],
  items: [{ style: { styleCode: 'LNG001', buyerStyleRef: 'EB-77' } }],
};
const older = {
  id: 'so-1',
  saleOrderNumber: 'SO2608-0001',
  buyerPoNumber: null,
  customer: { id: 'cust-1', code: 'CUS-001', name: 'House of Kasya' },
  buyerPos: [],
  items: [],
};

describe('SaleOrderCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists newest first, names "<number> — <customer>" with the buyer POs on a second line, and "All" clears', async () => {
    mocked(getAllSaleOrders).mockResolvedValue(pageOf([newer, older]));
    const onValue = vi.fn();
    function Filter() {
      const [saleOrderId, setSaleOrderId] = useState('so-2');
      return (
        <SaleOrderCombobox
          value={saleOrderId}
          onValueChange={(v) => {
            onValue(v);
            setSaleOrderId(v);
          }}
          allowAll
          customerId="cust-1"
          className="w-[240px]"
        />
      );
    }
    render(<Filter />);
    await waitFor(() => expect(trigger()).toHaveTextContent('SO2609-0002 — House of Kasya'));
    expect(trigger()).toHaveClass('w-[240px]');
    expect(getAllSaleOrders).toHaveBeenCalledTimes(1);
    expect(getAllSaleOrders).toHaveBeenCalledWith({
      page: 1,
      limit: 100,
      search: undefined,
      customerId: 'cust-1',
      status: undefined,
    });
    expect(getSaleOrderById).not.toHaveBeenCalled(); // on the first page, so no extra fetch

    fireEvent.click(trigger());
    const options = await screen.findAllByRole('option');
    // The "All" row, then the server's order (newest first) — not re-sorted by label
    expect(options.map((o) => o.textContent)).toEqual([
      'All sale orders',
      expect.stringMatching(/^SO2609-0002 — House of KasyaPO 4500123, 4500124/),
      'SO2608-0001 — House of Kasya',
    ]);

    fireEvent.click(screen.getByRole('option', { name: 'All sale orders' }));
    expect(onValue).toHaveBeenLastCalledWith('');
    await waitFor(() => expect(trigger()).toHaveTextContent('All sale orders'));
  });

  it('sends the typed text to the server and hands a form the picked sale order', async () => {
    mocked(getAllSaleOrders).mockResolvedValue(pageOf([newer, older]));
    const onValue = vi.fn();
    const onSaleOrder = vi.fn();
    render(<SaleOrderCombobox value="" onValueChange={onValue} onSaleOrderChange={onSaleOrder} />);
    await waitFor(() => expect(trigger()).toHaveTextContent('Select sale order...'));
    expect(screen.queryByText('All sale orders')).not.toBeInTheDocument();

    mocked(getAllSaleOrders).mockResolvedValue(pageOf([newer]));
    fireEvent.click(trigger());
    fireEvent.change(searchBox(), { target: { value: '4500124' } });
    await settle();
    expect(getAllSaleOrders).toHaveBeenLastCalledWith(expect.objectContaining({ search: '4500124', limit: 100 }));
    await waitFor(() => expect(screen.queryByRole('option', { name: /SO2608-0001/ })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('option', { name: /SO2609-0002/ }));
    expect(onValue).toHaveBeenLastCalledWith('so-2');
    expect(onSaleOrder).toHaveBeenLastCalledWith(newer);
  });

  it('says so when the server holds some back', async () => {
    mocked(getAllSaleOrders).mockResolvedValue(pageOf([newer, older], 340));
    render(<SaleOrderCombobox value="" onValueChange={() => undefined} />);
    fireEvent.click(trigger());
    expect(await screen.findByText(/Showing 2 of 340/)).toBeInTheDocument();
  });

  it('names a chosen sale order that is not on the first page (fetched once)', async () => {
    mocked(getAllSaleOrders).mockResolvedValue(pageOf([newer]));
    mocked(getSaleOrderById).mockResolvedValue({
      id: 'so-9',
      saleOrderNumber: 'SO2601-0009',
      customer: { id: 'cust-2', code: 'CUS-002', name: 'Easybuy' },
      buyerPos: [],
      items: [],
    });
    render(<SaleOrderCombobox value="so-9" onValueChange={() => undefined} />);
    await waitFor(() => expect(trigger()).toHaveTextContent('SO2601-0009 — Easybuy'));
    expect(getSaleOrderById).toHaveBeenCalledTimes(1);
    expect(getSaleOrderById).toHaveBeenCalledWith('so-9');
  });

  it('a failed first load says so and retries when the list is opened', async () => {
    mocked(getAllSaleOrders).mockRejectedValueOnce(new Error('API restarting'));
    render(<SaleOrderCombobox value="" onValueChange={() => undefined} />);
    await waitFor(() => expect(trigger()).toHaveTextContent('Could not load — open to retry'));

    mocked(getAllSaleOrders).mockResolvedValue(pageOf([newer]));
    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: /SO2609-0002/ })).toBeInTheDocument();
    expect(getAllSaleOrders).toHaveBeenCalledTimes(2);
  });

  it('a new customer or status is a new list', async () => {
    mocked(getAllSaleOrders).mockResolvedValue(pageOf([newer]));
    const { rerender } = render(<SaleOrderCombobox value="" onValueChange={() => undefined} customerId="cust-1" />);
    await waitFor(() => expect(getAllSaleOrders).toHaveBeenCalledTimes(1));

    rerender(<SaleOrderCombobox value="" onValueChange={() => undefined} customerId="cust-2" status="CONFIRMED" />);
    await waitFor(() =>
      expect(getAllSaleOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ customerId: 'cust-2', status: 'CONFIRMED' })
      )
    );
    expect(getAllSaleOrders).toHaveBeenCalledTimes(2);
  });
});
