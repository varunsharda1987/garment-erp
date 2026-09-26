/**
 * The Purchase Orders list, rendered against the API's real shapes (bugs from the 2026-09-26 audit):
 * cards and badges read 0 beside 13 rows, a stale ?tab crashed the app, a failed load said "create your
 * first PO", an ?orderId scope was invisible, a page past the end stranded the user, URL-only filters had
 * no control, and a label's sizes showed as one size "+N more".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PurchaseOrderList from '../PurchaseOrderList';
import { getAllPurchaseOrders, getPOStats } from '@/services/purchaseOrder.service';
import { getOrderById } from '@/services/order.service';
import type { PurchaseOrder, POStats } from '@/types/purchaseOrder.types';

vi.mock('@/services/purchaseOrder.service', () => ({
  getAllPurchaseOrders: vi.fn(),
  getPOStats: vi.fn(),
  deletePurchaseOrder: vi.fn(),
  cancelPurchaseOrder: vi.fn(),
}));
vi.mock('@/services/order.service', () => ({ getOrderById: vi.fn() }));
// The supplier picker fetches suppliers itself; it is not what these tests are about
vi.mock('@/components/SupplierCombobox', () => ({ SupplierCombobox: () => <div data-testid="supplier-picker" /> }));

const listMock = getAllPurchaseOrders as unknown as ReturnType<typeof vi.fn>;
const statsMock = getPOStats as unknown as ReturnType<typeof vi.fn>;
const orderMock = getOrderById as unknown as ReturnType<typeof vi.fn>;

// GET /api/purchase-orders/stats on the live system, 2026-09-26 — enum keys exactly as sent
const LIVE_STATS: POStats = {
  bySource: { MANUAL: 13 },
  byCategory: { GREIGE: 12, TRIMS: 1 },
  byStatus: { SENT: 2, RECEIVED: 10, CANCELLED: 1 },
  totalValue: 5394815.06,
};

function makePO(over: Partial<PurchaseOrder> & { id: string; poNumber: string }): PurchaseOrder {
  return {
    supplierId: 's1',
    poDate: '2026-09-24T00:00:00.000Z',
    expectedDeliveryDate: '2026-10-01T00:00:00.000Z',
    status: 'SENT',
    poSource: 'MANUAL',
    poCategory: 'GREIGE',
    totalAmount: 462000,
    paymentTerms: null,
    remarks: null,
    createdById: 'u1',
    approvedById: null,
    createdAt: '2026-09-24T00:00:00.000Z',
    deliveryLocationId: 'wh-1',
    supplier: {
      id: 's1',
      code: 'SUP-GRG-0006',
      name: 'Hardik International',
      contactPerson: null,
      email: null,
      phone: null,
      paymentTerms: null,
    },
    items: [
      {
        id: `${over.id}-i1`,
        poId: over.id,
        materialId: 'm1',
        orderedQuantity: 10000,
        receivedQuantity: 0,
        unit: 'METER',
        unitPrice: 46.2,
        totalPrice: 462000,
        remarks: null,
        materials: {
          id: 'm1',
          code: 'GRG-0009',
          name: 'Poplin 40×40 / 88×66 / 48" (Printing)',
          materialType: 'GREIGE',
          unit: 'METER',
        },
      },
    ],
    itemCount: 1,
    ...over,
  } as PurchaseOrder;
}

const labelLine = (poId: string, size: string) => ({
  id: `${poId}-${size}`,
  poId,
  materialId: `lbl-${size}`,
  orderedQuantity: 100,
  receivedQuantity: 0,
  unit: 'PIECE',
  unitPrice: 1,
  totalPrice: 100,
  remarks: null,
  materials: {
    id: `lbl-${size}`,
    code: `LBL-0004-${size}`,
    name: `Main Cum Size Label Black - Size ${size}`,
    materialType: 'LABEL',
    unit: 'PIECE',
    labelId: 'lbl',
    labelMaster: { id: 'lbl', labelCode: 'LBL-0004', labelName: 'Main Cum Size Label Black', labelType: null },
    labelSizeVariant: { size },
  },
});

const page = (data: PurchaseOrder[], over: Partial<{ page: number; totalPages: number; total: number }> = {}) => ({
  success: true,
  data,
  pagination: { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0, ...over },
});

/** Where the router is — rendered, so a test can read the URL the page wrote */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location" data-pathname={pathname} data-search={search} />;
}
const currentUrl = () => {
  const el = screen.getByTestId('location');
  return { pathname: el.dataset.pathname, search: el.dataset.search };
};

function renderAt(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/procurement/purchase-orders"
            element={
              <>
                <PurchaseOrderList />
                <LocationProbe />
              </>
            }
          />
          <Route path="/procurement/purchase-orders/:id" element={<div>PO page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const cardValue = (title: string) => screen.getByText(title).nextElementSibling?.textContent;
const lastListCall = () => listMock.mock.calls[listMock.mock.calls.length - 1][0];

describe('PurchaseOrderList', () => {
  beforeEach(() => {
    listMock.mockReset();
    statsMock.mockReset();
    orderMock.mockReset();
    statsMock.mockResolvedValue(LIVE_STATS);
    listMock.mockResolvedValue(page([makePO({ id: 'po-8', poNumber: 'PO2609-0008' })]));
  });

  it('shows the counts from the real stats payload: 13 POs, 2 awaiting delivery', async () => {
    renderAt('/procurement/purchase-orders');

    await waitFor(() => expect(cardValue('Total POs')).toBe('13'));
    expect(cardValue('Awaiting Delivery')).toBe('2');
    expect(cardValue('Pending Action')).toBe('0');
    expect(within(screen.getByRole('tab', { name: /All/ })).getByText('13')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /Material/ })).getByText('13')).toBeInTheDocument();
  });

  it('opens a stale ?tab=processing link on the All tab instead of crashing', async () => {
    renderAt('/procurement/purchase-orders?tab=processing');

    await screen.findByText('PO2609-0008');
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'true');
    expect(lastListCall().poCategories).toEqual([
      'FABRIC',
      'GREIGE',
      'TRIMS',
      'THREAD',
      'LACE',
      'GREIGE_LACE',
      'GENERAL',
    ]);
  });

  it('says a failed load failed, with a Retry — not "create your first purchase order"', async () => {
    listMock.mockRejectedValue({ response: { status: 400, data: { message: 'Invalid status filter' } } });
    renderAt('/procurement/purchase-orders?status=FOO');

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Could not load purchase orders')).toBeInTheDocument();
    expect(within(alert).getByText('Invalid status filter')).toBeInTheDocument();
    expect(screen.queryByText(/create your first/i)).not.toBeInTheDocument();

    listMock.mockResolvedValue(page([makePO({ id: 'po-8', poNumber: 'PO2609-0008' })]));
    const calls = listMock.mock.calls.length;
    fireEvent.click(within(alert).getByRole('button', { name: /Retry/ }));
    await screen.findByText('PO2609-0008');
    expect(listMock.mock.calls.length).toBe(calls + 1);
  });

  it('names the order a ?orderId= link scopes to, and removes only that filter', async () => {
    listMock.mockResolvedValue(page([]));
    orderMock.mockResolvedValue({ id: 'ord-1', orderNumber: 'ORD2609-0042' });
    renderAt('/procurement/purchase-orders?orderId=ord-1&status=SENT');

    expect(await screen.findByText('Order: ORD2609-0042')).toBeInTheDocument();
    expect(await screen.findByText('No purchase orders for this order')).toBeInTheDocument();
    expect(lastListCall().orderId).toBe('ord-1');

    fireEvent.click(screen.getByRole('button', { name: 'Remove the order filter' }));
    await waitFor(() => expect(lastListCall().orderId).toBeUndefined());
    expect(currentUrl().search).toBe('?status=SENT');
    expect(screen.queryByText(/^Order:/)).not.toBeInTheDocument();
  });

  it('sends a page past the end back to page 1', async () => {
    listMock.mockImplementation(async (f: { page: number }) =>
      page(f.page === 1 ? [makePO({ id: 'po-8', poNumber: 'PO2609-0008' })] : [], {
        page: f.page,
        total: 1,
        totalPages: 1,
      })
    );
    renderAt('/procurement/purchase-orders?page=4');

    await screen.findByText('PO2609-0008');
    await waitFor(() => expect(currentUrl().search).toBe(''));
  });

  it('shows the Source and Category controls whenever their filter is in the URL', async () => {
    renderAt('/procurement/purchase-orders?tab=material&source=MRP');
    await screen.findByText('PO2609-0008');
    expect(screen.getAllByRole('combobox').some((c) => c.textContent?.includes('MRP'))).toBe(true);
    expect(lastListCall().source).toBe('MRP');
  });

  it('shows the category control on the All tab when ?poCategory= is set', async () => {
    renderAt('/procurement/purchase-orders?poCategory=TRIMS');
    await screen.findByText('PO2609-0008');
    expect(screen.getAllByRole('combobox').some((c) => c.textContent?.includes('Trims'))).toBe(true);
    expect(lastListCall().poCategories).toEqual(['TRIMS']);
  });

  it("shows a label's sizes as one item, and the PO number as a real link", async () => {
    listMock.mockResolvedValue(
      page([
        makePO({
          id: 'po-9',
          poNumber: 'PO2609-0009',
          poCategory: 'TRIMS',
          items: ['M', 'XS', 'S'].map((s) => labelLine('po-9', s)) as unknown as PurchaseOrder['items'],
          itemCount: 3,
        }),
      ])
    );
    renderAt('/procurement/purchase-orders');

    expect(await screen.findByText('Main Cum Size Label Black · 3 sizes')).toBeInTheDocument();
    expect(screen.getByText('LBL-0004')).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PO2609-0009' })).toHaveAttribute(
      'href',
      '/procurement/purchase-orders/po-9'
    );
    expect(screen.getByRole('button', { name: 'Actions for PO2609-0009' })).toBeInTheDocument();
  });

  it('offers Cancel on a sent PO (in the shared dialog), and not on a draft or a part-received one', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue(
      page([
        makePO({ id: 'po-1', poNumber: 'PO2609-0001', status: 'DRAFT' }),
        makePO({ id: 'po-2', poNumber: 'PO2609-0002', status: 'SENT' }),
        makePO({ id: 'po-3', poNumber: 'PO2609-0003', status: 'PARTIALLY_RECEIVED' }),
      ])
    );
    renderAt('/procurement/purchase-orders');
    await screen.findByText('PO2609-0001');

    await user.click(screen.getByRole('button', { name: 'Actions for PO2609-0001' }));
    let menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Delete')).toBeInTheDocument();
    expect(within(menu).queryByText('Cancel PO')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Actions for PO2609-0003' }));
    menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Close Short')).toBeInTheDocument();
    expect(within(menu).queryByText('Cancel PO')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Actions for PO2609-0002' }));
    menu = await screen.findByRole('menu');
    await user.click(within(menu).getByText('Cancel PO'));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Cancel PO2609-0002?');
    // The menu's click did not fall through to the row and open the PO
    expect(currentUrl().pathname).toBe('/procurement/purchase-orders');
  });
});
