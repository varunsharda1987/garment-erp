/**
 * The PO page's allocation card: a label's sizes under one heading, each size's orders in fill order, and Undo
 * only where the server allows it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PoAllocationCard } from './PoAllocationCard';
import { undoPoAllocation } from '@/services/poAllocation.service';
import type { PoAllocationLine, PoAllocationLink, PoAllocationView } from '@/types/po-allocation.types';

vi.mock('@/services/poAllocation.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/poAllocation.service')>();
  return { ...actual, undoPoAllocation: vi.fn() };
});

vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const undoMock = undoPoAllocation as ReturnType<typeof vi.fn>;

const link = (n: number, extra: Partial<PoAllocationLink> = {}): PoAllocationLink => ({
  linkId: `link-${n}`,
  requirementId: `req-${n}`,
  requirementNumber: `MR2609-000${n}`,
  requirementStatus: 'PO_SENT',
  orderId: `ord-${n}`,
  orderNumber: `ORD202609000${n}`,
  orderStatus: 'IN_PRODUCTION',
  customerName: 'Easybuy',
  styleCode: `ESSKY08${n}LS`,
  deliveryDate: '2026-10-05T00:00:00.000Z',
  requiredDate: null,
  unit: 'PIECE',
  fillOrder: n,
  allocatedQty: 350,
  receivedQty: 0,
  issuedQty: 0,
  heldQty: 0,
  dyer: null,
  dyerMoved: false,
  deliveryMismatch: false,
  surplusQty: null,
  canUndo: true,
  undoBlockedReason: null,
  ...extra,
});

const sizeLine = (size: string, links: PoAllocationLink[]): PoAllocationLine => ({
  itemId: `item-${size}`,
  material: {
    id: `m-${size}`,
    code: `LBL-0004-${size}`,
    name: 'Main label',
    materialType: 'LABEL',
    unit: 'PIECE',
    label: { id: 'lbl-4', code: 'LBL-0004', name: 'Main label', type: null, category: null },
    size,
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
  linkedQty: links.reduce((s, l) => s + l.allocatedQty, 0),
  receivedForOrdersQty: 0,
  heldQty: 0,
  plainQty: 0,
  toComeQty: 1000,
  freeToLink: 1000 - links.reduce((s, l) => s + l.allocatedQty, 0),
  arrivedFree: 0,
  plainByPlace: [],
  deliversTo: null,
  pendingQcGrnNumber: null,
  linkable: true,
  blockedReason: null,
  links,
  candidates: [],
});

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
  lines: [
    sizeLine('S', [
      link(1),
      link(2, { canUndo: false, undoBlockedReason: '120 pcs already arrived for this order — it can’t be undone' }),
    ]),
    sizeLine('XS', [link(3, { orderStatus: 'CANCELLED' })]),
  ],
  unlinkedOrderCount: 0,
};

function setup(onChanged = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PoAllocationCard allocation={VIEW} canUndo onChanged={onChanged} />
    </QueryClientProvider>
  );
  return { onChanged };
}

describe('PoAllocationCard', () => {
  beforeEach(() => undoMock.mockReset());

  it('puts a label’s sizes under one heading, in size order, with each size’s orders', () => {
    setup();
    expect(screen.getByText('LBL-0004')).toBeInTheDocument();
    const sizes = screen.getAllByText(/^Size (XS|S)$/).map((el) => el.textContent);
    expect(sizes).toEqual(['Size XS', 'Size S']);
    expect(screen.getByText('ORD2026090001')).toBeInTheDocument();
    expect(screen.getByText('Order cancelled — undo to free 350 pcs')).toBeInTheDocument();
  });

  it('Undo is offered only where the server allows it', () => {
    setup();
    const enabled = screen.getAllByRole('button', { name: 'Undo' });
    expect(enabled).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Undo (not allowed)' })).toBeDisabled();
  });

  it('undoes after confirming, and tells the page', async () => {
    undoMock.mockResolvedValue({
      requirementNumber: 'MR2609-0001',
      newStatus: 'PO_REQUIRED',
      foldedBack: [],
      allocation: VIEW,
    });
    const { onChanged } = setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Undo' })[1]);
    expect(await screen.findByText('Undo this allocation?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo allocation' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(undoMock).toHaveBeenCalledWith('po-1', 'link-1');
  });
});
