/**
 * The Allocate dialog: opens on the server's default split, re-shares the line when a row is unticked, posts the
 * ticked rows, and keeps the user's split when the server refuses a row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AllocateToOrdersDialog } from './AllocateToOrdersDialog';
import { allocatePoToOrders, getPoAllocation } from '@/services/poAllocation.service';
import type { PoAllocationCandidate, PoAllocationLine, PoAllocationView } from '@/types/po-allocation.types';

vi.mock('@/services/poAllocation.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/poAllocation.service')>();
  return { ...actual, getPoAllocation: vi.fn(), allocatePoToOrders: vi.fn() };
});

vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const getMock = getPoAllocation as ReturnType<typeof vi.fn>;
const postMock = allocatePoToOrders as ReturnType<typeof vi.fn>;

const cand = (n: number, need: number, suggested: number, extra: Partial<PoAllocationCandidate> = {}) =>
  ({
    requirementId: `req-${n}`,
    requirementNumber: `MR2609-000${n}`,
    requirementStatus: 'PO_REQUIRED',
    orderId: `ord-${n}`,
    orderNumber: `ORD202609000${n}`,
    orderStatus: 'IN_PRODUCTION',
    customerName: 'Easybuy',
    styleCode: `ESSKY08${n}LS`,
    deliveryDate: `2026-10-0${n}T00:00:00.000Z`,
    requiredDate: null,
    unit: 'PIECE',
    colorName: null,
    needQty: need,
    allocatedFromStock: 0,
    dyer: null,
    suggestedQty: suggested,
    alreadyHereQty: 0,
    arrivesLate: false,
    linkable: true,
    blockedReason: null,
    ...extra,
  }) satisfies PoAllocationCandidate;

const line: PoAllocationLine = {
  itemId: 'item-xs',
  material: {
    id: 'm-xs',
    code: 'LBL-0004-XS',
    name: 'Main label',
    materialType: 'LABEL',
    unit: 'PIECE',
    label: { id: 'lbl-4', code: 'LBL-0004', name: 'Main label', type: null, category: null },
    size: 'XS',
  },
  colorName: null,
  unit: 'PIECE',
  stockUnitsPerUnit: null,
  stockUnit: 'PIECE',
  kind: 'untracked',
  located: false,
  orderedQty: 1000,
  orderedStockQty: 1000,
  arrivedQty: 0,
  linkedQty: 0,
  receivedForOrdersQty: 0,
  heldQty: 0,
  plainQty: 0,
  toComeQty: 1000,
  freeToLink: 1000,
  arrivedFree: 0,
  plainByPlace: [],
  deliversTo: null,
  pendingQcGrnNumber: null,
  linkable: true,
  blockedReason: null,
  links: [],
  candidates: [
    cand(1, 350, 350, { arrivesLate: true }),
    cand(2, 322, 322),
    cand(3, 253, 253),
    cand(4, 200, 75),
    cand(5, 40, 0, { linkable: false, blockedReason: 'the order is completed' }),
  ],
};

const VIEW: PoAllocationView = {
  po: {
    id: 'po-1',
    poNumber: 'PO2609-0231',
    status: 'SENT',
    poCategory: 'ACCESSORIES',
    supplierName: 'Label House',
    expectedDeliveryDate: '2026-10-02T00:00:00.000Z',
    linkable: true,
    blockedReason: null,
  },
  lines: [line],
  unlinkedOrderCount: 5,
};

function setup(onDone = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <AllocateToOrdersDialog poId="po-1" open onOpenChange={onOpenChange} onDone={onDone} />
    </QueryClientProvider>
  );
  return { onOpenChange, onDone };
}

const qtyInput = (order: string) => screen.getByLabelText(`Quantity for ${order}`) as HTMLInputElement;
const tick = (order: string) => screen.getByRole('checkbox', { name: `Allocate to ${order}` });

describe('AllocateToOrdersDialog', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue(VIEW);
  });

  it('opens on the default split, earliest first, with Late and the refused row disabled', async () => {
    setup();
    expect(await screen.findByText('Allocate PO2609-0231 to orders')).toBeInTheDocument();
    expect(qtyInput('ORD2026090001').value).toBe('350');
    expect(qtyInput('ORD2026090002').value).toBe('322');
    expect(qtyInput('ORD2026090003').value).toBe('253');
    expect(qtyInput('ORD2026090004').value).toBe('75');
    expect(qtyInput('ORD2026090001')).toHaveAttribute('step', 'any');
    expect(screen.getByText('Late')).toBeInTheDocument();
    expect(tick('ORD2026090005')).toBeDisabled();
    expect(screen.getByText('the order is completed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allocate to 4 orders' })).toBeEnabled();
  });

  it('unticking the first order gives its share to the next ones and updates what is left free', async () => {
    setup();
    await screen.findByText('Allocate PO2609-0231 to orders');
    fireEvent.click(tick('ORD2026090001'));
    expect(screen.queryByLabelText('Quantity for ORD2026090001')).not.toBeInTheDocument();
    expect(qtyInput('ORD2026090004').value).toBe('200');
    const section = screen.getByRole('region', { name: 'LBL-0004 · Size XS' });
    expect(within(section).getByText('225 pcs')).toBeInTheDocument();
  });

  it('a quantity above the free line disables Save', async () => {
    setup();
    await screen.findByText('Allocate PO2609-0231 to orders');
    fireEvent.change(qtyInput('ORD2026090004'), { target: { value: '200' } });
    fireEvent.change(qtyInput('ORD2026090003'), { target: { value: '253' } });
    fireEvent.change(qtyInput('ORD2026090002'), { target: { value: '322' } });
    fireEvent.change(qtyInput('ORD2026090001'), { target: { value: '350' } });
    expect(screen.getByText(/Over by 125 pcs/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allocate to 4 orders' })).toBeDisabled();
  });

  it('posts the ticked rows and hands the result back', async () => {
    const result = { poId: 'po-1', poNumber: 'PO2609-0231', linked: [], splits: [], allocation: VIEW };
    postMock.mockResolvedValue(result);
    const { onDone, onOpenChange } = setup();
    await screen.findByText('Allocate PO2609-0231 to orders');
    fireEvent.click(screen.getByRole('button', { name: 'Allocate to 4 orders' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(result));
    expect(postMock).toHaveBeenCalledWith('po-1', {
      allocations: [
        { purchaseOrderItemId: 'item-xs', requirementId: 'req-1', quantity: 350 },
        { purchaseOrderItemId: 'item-xs', requirementId: 'req-2', quantity: 322 },
        { purchaseOrderItemId: 'item-xs', requirementId: 'req-3', quantity: 253 },
        { purchaseOrderItemId: 'item-xs', requirementId: 'req-4', quantity: 75 },
      ],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('a refused row shows why, and the split stays as it was', async () => {
    postMock.mockRejectedValue({
      response: {
        status: 422,
        data: {
          error: 'BUSINESS_ERROR',
          message: 'Cannot allocate PO2609-0231: MR2609-0002 the order is on hold.',
          details: {
            code: 'PO_ALLOCATION_REFUSED',
            rows: [
              {
                purchaseOrderItemId: 'item-xs',
                requirementId: 'req-2',
                requirementNumber: 'MR2609-0002',
                reason: 'the order is on hold',
              },
            ],
          },
        },
      },
    });
    const { onDone, onOpenChange } = setup();
    await screen.findByText('Allocate PO2609-0231 to orders');
    fireEvent.click(tick('ORD2026090001'));
    fireEvent.click(screen.getByRole('button', { name: 'Allocate to 3 orders' }));

    expect(await screen.findByText('the order is on hold')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(qtyInput('ORD2026090004').value).toBe('200');
  });
});
