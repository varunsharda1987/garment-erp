/**
 * WorkOrderCombobox — the production-run filter on Cutting, Stitching, Finishing, Challans and Garment Physical
 * Tests. Same contract as every record picker (2026-09-28 filter standard): `allowAll` puts an "All production
 * runs" row first whose value '' means "no filter"; the list is server-searched over GET /work-orders; a run
 * restored from the URL that the list does not hold is fetched once so the box can name it.
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkOrderCombobox } from '@/components/WorkOrderCombobox';
import { workOrderService } from '@/services/workOrder.service';

vi.mock('@/services/workOrder.service', () => ({ workOrderService: { getAll: vi.fn(), getById: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

/** The trigger button — `hidden` because the open (modal) list hides the rest of the page from the a11y tree */
const trigger = () => screen.getAllByRole('combobox', { hidden: true }).find((el) => el.tagName === 'BUTTON')!;
/** Longer than the combobox's 300 ms search debounce */
const settle = () => act(() => new Promise((r) => setTimeout(r, 450)));

const orderRun = {
  id: 'wo-1',
  workOrderNumber: 'WO2609-0087',
  orderId: 'ord-1',
  stockProductionOrderId: null,
  style: { id: 'sty-1', styleCode: 'ESSKY082LS', styleName: 'Kurta', buyerStyleRef: 'EB-77' },
  orders: { id: 'ord-1', orderNumber: 'ORD2609-0001', customer: { id: 'c-1', name: 'Easybuy', code: 'CUS-001' } },
};
const stockRun = {
  id: 'wo-2',
  workOrderNumber: 'WO2609-0090',
  orderId: null,
  stockProductionOrderId: 'spo-1',
  stockProductionOrder: { id: 'spo-1', spoNumber: 'SPO2609-0003' },
  style: { id: 'sty-2', styleCode: 'LNG001', styleName: 'Palazzo', buyerStyleRef: null },
};

describe('WorkOrderCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('names the chosen run, shows each run with its order or stock order, and "All" hands back ""', async () => {
    mocked(workOrderService.getAll).mockResolvedValue([orderRun, stockRun]);
    const onValue = vi.fn();
    function Filter() {
      const [workOrderId, setWorkOrderId] = useState('wo-1');
      return (
        <WorkOrderCombobox
          value={workOrderId}
          onValueChange={(v) => {
            onValue(v);
            setWorkOrderId(v);
          }}
          allowAll
          placeholder="All production runs"
          className="w-[260px]"
        />
      );
    }
    render(<Filter />);
    await waitFor(() => expect(trigger()).toHaveTextContent('WO2609-0087 — EB-77 (ESSKY082LS)'));
    expect(trigger()).toHaveClass('w-[260px]');
    expect(workOrderService.getAll).toHaveBeenCalledTimes(1);
    expect(workOrderService.getAll).toHaveBeenCalledWith({
      search: undefined,
      status: undefined,
      orderId: undefined,
      styleId: undefined,
    });
    expect(workOrderService.getById).not.toHaveBeenCalled(); // on the list, so no extra fetch

    fireEvent.click(trigger());
    // Second line: the order and its customer, or the stock order for a make-to-stock run
    expect(
      await screen.findByRole('option', { name: /WO2609-0087 — EB-77 \(ESSKY082LS\)\s*ORD2609-0001 · Easybuy/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /WO2609-0090 — LNG001\s*SPO2609-0003 · Make-to-stock/ })
    ).toBeInTheDocument();
    // The endpoint returns every match, so there is no "Showing N of M" footer
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'All production runs' }));
    expect(onValue).toHaveBeenLastCalledWith('');
    await waitFor(() => expect(trigger()).toHaveTextContent('All production runs'));

    // …and picking a run hands back its id
    fireEvent.click(trigger());
    fireEvent.click(await screen.findByRole('option', { name: /WO2609-0090/ }));
    expect(onValue).toHaveBeenLastCalledWith('wo-2');
  });

  it('searches on the server — typed text goes to GET /work-orders as ?search=', async () => {
    mocked(workOrderService.getAll).mockResolvedValue([orderRun, stockRun]);
    render(<WorkOrderCombobox value="" onValueChange={() => undefined} allowAll />);
    fireEvent.click(trigger());
    await screen.findByRole('option', { name: /WO2609-0090/ });

    mocked(workOrderService.getAll).mockResolvedValue([orderRun]);
    fireEvent.change(screen.getByPlaceholderText('Search by run number, buyer style code, style code, order...'), {
      target: { value: 'ORD2609-0001' },
    });
    await settle();
    expect(workOrderService.getAll).toHaveBeenLastCalledWith({
      search: 'ORD2609-0001',
      status: undefined,
      orderId: undefined,
      styleId: undefined,
    });
    await waitFor(() => expect(screen.queryByRole('option', { name: /WO2609-0090/ })).not.toBeInTheDocument());
    expect(screen.getByRole('option', { name: /WO2609-0087/ })).toBeInTheDocument();
  });

  it('passes the narrowing props to the list API', async () => {
    mocked(workOrderService.getAll).mockResolvedValue([orderRun]);
    render(<WorkOrderCombobox value="" onValueChange={() => undefined} status="IN_PRODUCTION" orderId="ord-1" />);
    await waitFor(() =>
      expect(workOrderService.getAll).toHaveBeenCalledWith({
        search: undefined,
        status: 'IN_PRODUCTION',
        orderId: 'ord-1',
        styleId: undefined,
      })
    );
  });

  it('names a chosen run the list does not hold (fetched once)', async () => {
    mocked(workOrderService.getAll).mockResolvedValue([stockRun]);
    mocked(workOrderService.getById).mockResolvedValue(orderRun);
    render(<WorkOrderCombobox value="wo-1" onValueChange={() => undefined} allowAll status="COMPLETED" />);
    await waitFor(() => expect(trigger()).toHaveTextContent('WO2609-0087 — EB-77 (ESSKY082LS)'));
    expect(workOrderService.getById).toHaveBeenCalledTimes(1);
    expect(workOrderService.getById).toHaveBeenCalledWith('wo-1');
  });

  it('a failed first load says so and retries when the list is opened', async () => {
    mocked(workOrderService.getAll).mockRejectedValueOnce(new Error('API restarting'));
    render(<WorkOrderCombobox value="" onValueChange={() => undefined} />);
    await waitFor(() => expect(trigger()).toHaveTextContent('Could not load — open to retry'));

    mocked(workOrderService.getAll).mockResolvedValue([orderRun]);
    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: /WO2609-0087/ })).toBeInTheDocument();
    expect(workOrderService.getAll).toHaveBeenCalledTimes(2);
  });
});
