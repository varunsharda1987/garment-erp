/**
 * The record pickers are the filter controls on every list page (2026-09-28 filter standard). As a filter a
 * picker takes `allowAll`: an "All …" row first, whose value '' means "no filter" — picking it must hand the
 * page '' so it drops the param. StyleCombobox must work with `onValueChange` alone (it used to require
 * `onChange`), and the new Order / Processor pickers follow the same contract.
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { StyleCombobox } from '@/components/StyleCombobox';
import { OrderCombobox } from '@/components/OrderCombobox';
import { ProcessorCombobox } from '@/components/ProcessorCombobox';
import { GreigeCombobox } from '@/components/GreigeCombobox';
import { customerService } from '@/services/customer.service';
import { styleService } from '@/services/style.service';
import { getAllOrders, getOrderById } from '@/services/order.service';
import { getProcessorSuppliers } from '@/services/vendorSuggestion.service';
import { processorRateCardV2Service } from '@/services/processorRateCardV2.service';

vi.mock('@/services/customer.service', () => ({ customerService: { getAllCustomers: vi.fn() } }));
vi.mock('@/services/style.service', () => ({ styleService: { searchForPicker: vi.fn(), getStyleById: vi.fn() } }));
vi.mock('@/services/order.service', () => ({ getAllOrders: vi.fn(), getOrderById: vi.fn() }));
vi.mock('@/services/vendorSuggestion.service', () => ({ getProcessorSuppliers: vi.fn() }));
vi.mock('@/services/processorRateCardV2.service', () => ({
  processorRateCardV2Service: { getGreigeFabrics: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const pageOf = <T,>(data: T[]) => ({ data, pagination: { page: 1, limit: 200, total: data.length, totalPages: 1 } });

/** The trigger button — `hidden` because the open (modal) list hides the rest of the page from the a11y tree */
const trigger = () => screen.getAllByRole('combobox', { hidden: true }).find((el) => el.tagName === 'BUTTON')!;
/** Longer than the combobox's 300 ms search debounce */
const settle = () => act(() => new Promise((r) => setTimeout(r, 450)));

/** Open the list, pick the "All …" row, and check the page was handed '' and the box reads the All label. */
async function pickAll(allLabel: string, onValue: ReturnType<typeof vi.fn>) {
  fireEvent.click(trigger());
  fireEvent.click(await screen.findByRole('option', { name: allLabel }));
  expect(onValue).toHaveBeenLastCalledWith('');
  await waitFor(() => expect(trigger()).toHaveTextContent(allLabel));
}

describe('filter pickers — the "All …" row clears the filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CustomerCombobox', async () => {
    mocked(customerService.getAllCustomers).mockResolvedValue(
      pageOf([{ id: 'cust-1', code: 'CUS-001', name: 'Kasya Retail' }])
    );
    const onValue = vi.fn();
    function Filter() {
      const [customerId, setCustomerId] = useState('cust-1');
      return (
        <CustomerCombobox
          value={customerId}
          onValueChange={(v) => {
            onValue(v);
            setCustomerId(v);
          }}
          allowAll
        />
      );
    }
    render(<Filter />);
    await waitFor(() => expect(trigger()).toHaveTextContent('CUS-001 - Kasya Retail'));
    await pickAll('All customers', onValue);
  });

  it('StyleCombobox with only onValueChange', async () => {
    const style = {
      id: 'sty-1',
      styleCode: 'LNG001',
      styleName: 'Kurta',
      buyerStyleRef: 'EB-77',
      customerName: 'Kasya',
    };
    mocked(styleService.searchForPicker).mockResolvedValue(pageOf([style]));
    mocked(styleService.getStyleById).mockResolvedValue(style);
    const onValue = vi.fn();
    function Filter() {
      const [styleId, setStyleId] = useState('sty-1');
      return (
        <StyleCombobox
          value={styleId}
          onValueChange={(v) => {
            onValue(v);
            setStyleId(v);
          }}
          allowAll
          className="w-[220px]"
        />
      );
    }
    render(<Filter />);
    await waitFor(() => expect(trigger()).toHaveTextContent('EB-77 (LNG001) - Kurta (Kasya)'));
    expect(trigger()).toHaveClass('w-[220px]');
    await pickAll('All styles', onValue);

    // …and picking a style hands back its id
    fireEvent.click(trigger());
    fireEvent.click(await screen.findByRole('option', { name: /LNG001/ }));
    expect(onValue).toHaveBeenLastCalledWith('sty-1');
  });

  it('StyleCombobox still calls onChange with the record for form callers', async () => {
    const style = { id: 'sty-1', styleCode: 'LNG001', styleName: 'Kurta', buyerStyleRef: null, customerName: 'Kasya' };
    mocked(styleService.searchForPicker).mockResolvedValue(pageOf([style]));
    const onChange = vi.fn();
    render(<StyleCombobox value="" onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.click(await screen.findByRole('option', { name: /LNG001/ }));
    expect(onChange).toHaveBeenCalledWith('sty-1', style);
  });

  it('OrderCombobox', async () => {
    const order = {
      id: 'ord-1',
      orderNumber: 'ORD2609-0001',
      customer: { id: 'cust-1', code: 'CUS-001', name: 'Kasya Retail' },
      orderItems: [{ style: { styleCode: 'LNG001', buyerStyleRef: 'EB-77' } }],
    };
    mocked(getAllOrders).mockResolvedValue(pageOf([order]));
    const onValue = vi.fn();
    function Filter() {
      const [orderId, setOrderId] = useState('ord-1');
      return (
        <OrderCombobox
          value={orderId}
          onValueChange={(v) => {
            onValue(v);
            setOrderId(v);
          }}
          allowAll
          customerId="cust-1"
        />
      );
    }
    render(<Filter />);
    await waitFor(() => expect(trigger()).toHaveTextContent('ORD2609-0001 — Kasya Retail'));
    expect(getAllOrders).toHaveBeenCalledWith({ page: 1, limit: 200, search: undefined, customerId: 'cust-1' });
    expect(getOrderById).not.toHaveBeenCalled(); // on the first page, so no extra fetch

    fireEvent.click(trigger());
    // The styles on the order are its second line — Buyer Style Code first
    expect(
      await screen.findByRole('option', { name: /ORD2609-0001 — Kasya Retail\s*EB-77 \(LNG001\)/ })
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByPlaceholderText('Search by order number, customer, style...'), { key: 'Escape' });

    await pickAll('All orders', onValue);
  });

  it('OrderCombobox names a chosen order that is not on the first page', async () => {
    mocked(getAllOrders).mockResolvedValue(pageOf([]));
    mocked(getOrderById).mockResolvedValue({
      id: 'ord-9',
      orderNumber: 'ORD2601-0009',
      customer: { id: 'cust-2', code: 'CUS-002', name: 'Easybuy' },
      orderItems: [],
    });
    render(<OrderCombobox value="ord-9" onValueChange={() => undefined} allowAll />);
    await waitFor(() => expect(trigger()).toHaveTextContent('ORD2601-0009 — Easybuy'));
    expect(getOrderById).toHaveBeenCalledTimes(1);
  });

  it('ProcessorCombobox searches the roster in memory, every word must match', async () => {
    mocked(getProcessorSuppliers).mockResolvedValue({
      processorList: [
        { id: 'p-1', code: 'SUP-010', name: 'Kiran Dyers', supplierCategories: ['DYEING_PRINTING'], isActive: true },
        { id: 'p-2', code: 'SUP-011', name: 'Shree Washers', supplierCategories: ['WASHING'], isActive: true },
      ],
      count: 2,
    });
    const onValue = vi.fn();
    function Filter() {
      const [processorId, setProcessorId] = useState('p-1');
      return (
        <ProcessorCombobox
          value={processorId}
          onValueChange={(v) => {
            onValue(v);
            setProcessorId(v);
          }}
          allowAll
        />
      );
    }
    render(<Filter />);
    await waitFor(() => expect(trigger()).toHaveTextContent('SUP-010 - Kiran Dyers'));

    fireEvent.click(trigger());
    fireEvent.change(screen.getByPlaceholderText('Search by code, name, dyeing, washing...'), {
      target: { value: 'washing shree' },
    });
    await settle();
    expect(screen.getByRole('option', { name: /Shree Washers/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Kiran Dyers/ })).not.toBeInTheDocument();
    expect(getProcessorSuppliers).toHaveBeenCalledTimes(1); // the typed search did not refetch
    fireEvent.keyDown(screen.getByPlaceholderText('Search by code, name, dyeing, washing...'), { key: 'Escape' });

    await pickAll('All processors', onValue);
  });

  it('GreigeCombobox narrows its list as you type (it used to ignore the typed text)', async () => {
    mocked(processorRateCardV2Service.getGreigeFabrics).mockResolvedValue([
      { id: 'g-1', greigeCode: 'GRG-0001', greigeName: 'Cotton Poplin', composition: '100% cotton' },
      { id: 'g-2', greigeCode: 'GRG-0002', greigeName: 'Rayon Slub', composition: '100% rayon' },
    ]);
    render(<GreigeCombobox value="" onValueChange={() => undefined} allowAll />);
    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: /Rayon Slub/ })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search by code, name, composition...'), {
      target: { value: 'poplin' },
    });
    await settle();
    expect(screen.getByRole('option', { name: /Cotton Poplin/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Rayon Slub/ })).not.toBeInTheDocument();
  });
});
