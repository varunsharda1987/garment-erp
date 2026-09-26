/**
 * The one PO cancel dialog (2026-09-27). The list's old dialog closed before the request ran, so a refusal
 * wiped the reason that had been typed; the PO page sent a fixed "Cancelled by user" with no reason at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CancelPoDialog, CANCEL_REASON_MAX } from './CancelPoDialog';
import { cancelPurchaseOrder } from '@/services/purchaseOrder.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { queryKeys } from '@/hooks/useQuery';

vi.mock('@/services/purchaseOrder.service', () => ({
  cancelPurchaseOrder: vi.fn(),
}));

vi.mock('@/lib/api-error-handler', () => ({
  handleApiError: vi.fn(() => 'error'),
  handleApiSuccess: vi.fn(),
}));

const cancelMock = cancelPurchaseOrder as ReturnType<typeof vi.fn>;
const PO = { id: 'po-1', poNumber: 'PO2609-0008' };

function Harness({ client, force, onCancelled }: { client: QueryClient; force?: boolean; onCancelled?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <QueryClientProvider client={client}>
      <div data-testid="state">{open ? 'open' : 'closed'}</div>
      <CancelPoDialog open={open} onOpenChange={setOpen} po={PO} force={force} onCancelled={onCancelled} />
    </QueryClientProvider>
  );
}

function setup(props: { force?: boolean; onCancelled?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<Harness client={client} {...props} />);
  return { invalidate };
}

const reasonBox = () => screen.getByLabelText(/Reason/) as HTMLTextAreaElement;
const confirmButton = () => screen.getByRole('button', { name: /Cancel Order|Force Cancel|Cancelling/ });

describe('CancelPoDialog', () => {
  beforeEach(() => {
    cancelMock.mockReset();
    vi.mocked(handleApiError).mockClear();
    vi.mocked(handleApiSuccess).mockClear();
  });

  it('names the PO as "PO2609-0008", never "PO PO2609-0008"', () => {
    setup();
    expect(screen.getByText('Cancel PO2609-0008?')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/PO PO2609/);
  });

  it('needs a reason: Confirm is disabled while the reason is blank or only spaces', () => {
    setup();
    expect(confirmButton()).toBeDisabled();
    fireEvent.change(reasonBox(), { target: { value: '   ' } });
    expect(confirmButton()).toBeDisabled();
    fireEvent.change(reasonBox(), { target: { value: 'Mill closed' } });
    expect(confirmButton()).toBeEnabled();
  });

  it('caps the reason at 500 characters and shows the count', () => {
    setup();
    expect(reasonBox()).toHaveAttribute('maxLength', String(CANCEL_REASON_MAX));
    expect(CANCEL_REASON_MAX).toBe(500);
    fireEvent.change(reasonBox(), { target: { value: 'abc' } });
    expect(screen.getByText('3/500')).toBeInTheDocument();
  });

  it('sends the trimmed reason and closes on success', async () => {
    cancelMock.mockResolvedValue({});
    const onCancelled = vi.fn();
    const { invalidate } = setup({ onCancelled });

    fireEvent.change(reasonBox(), { target: { value: '  Supplier cannot supply  ' } });
    fireEvent.click(confirmButton());

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('closed'));
    expect(cancelMock).toHaveBeenCalledWith('po-1', { reason: 'Supplier cannot supply', force: false });
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(handleApiSuccess).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.purchaseOrders.all });
  });

  it('stays open with the reason intact when the server refuses, and still refreshes the lists', async () => {
    cancelMock.mockRejectedValue(new Error('PO2609-0008 has goods received'));
    const onCancelled = vi.fn();
    const { invalidate } = setup({ onCancelled });

    fireEvent.change(reasonBox(), { target: { value: 'Duplicate order' } });
    fireEvent.click(confirmButton());

    await waitFor(() => expect(handleApiError).toHaveBeenCalled());
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    expect(screen.getByTestId('state')).toHaveTextContent('open');
    expect(reasonBox().value).toBe('Duplicate order');
    expect(onCancelled).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.purchaseOrders.all });
  });

  it('does not close while the request is running, and disables both buttons', async () => {
    let settle: (v: unknown) => void = () => undefined;
    cancelMock.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    setup();

    fireEvent.change(reasonBox(), { target: { value: 'Wrong supplier' } });
    fireEvent.click(confirmButton());

    await waitFor(() => expect(confirmButton()).toHaveTextContent('Cancelling…'));
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep Order' })).toBeDisabled();
    expect(screen.getByTestId('state')).toHaveTextContent('open');

    settle({});
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('closed'));
  });

  it('force variant: admin title, explains received goods, and sends force: true', async () => {
    cancelMock.mockResolvedValue({});
    setup({ force: true });

    expect(screen.getByText('Force cancel (admin)')).toBeInTheDocument();
    expect(screen.getByText(/Goods have already been received against/)).toBeInTheDocument();
    expect(screen.getByText(/logged/)).toBeInTheDocument();

    fireEvent.change(reasonBox(), { target: { value: 'Supplier took the goods back' } });
    fireEvent.click(screen.getByRole('button', { name: 'Force Cancel' }));

    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith('po-1', { reason: 'Supplier took the goods back', force: true })
    );
  });
});
