/**
 * Goods held for another order (D10): the refusal is read, the question is asked, and a yes sends the same
 * request again with takeHeld: true.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { extractHeldStock, heldForLine, heldStockQuestion } from '@/lib/held-stock-confirm';
import { useHeldStockConfirm } from '@/hooks/useHeldStockConfirm';

const refusal = (
  status = 409,
  heldFor: unknown = [{ orderNumber: 'ORD2026080025', styleCode: 'ESSKY085LS', qty: 300 }]
) => ({
  response: {
    status,
    data: {
      error: 'CONFLICT',
      message: '300 pcs of LBL-0004-XS are held for ORD2026080025.',
      details: { code: 'STOCK_HELD_FOR_ORDER', heldFor },
    },
  },
});

describe('extractHeldStock', () => {
  it('reads a 409 or 422 with details.code STOCK_HELD_FOR_ORDER', () => {
    expect(extractHeldStock(refusal(409))?.heldFor).toEqual([
      {
        orderNumber: 'ORD2026080025',
        styleCode: 'ESSKY085LS',
        buyerStyleRef: null,
        qty: 300,
        unit: null,
        requirementNumber: null,
      },
    ]);
    expect(extractHeldStock(refusal(422))).not.toBeNull();
  });

  it('reads the buyer style code the server sends beside the style code', () => {
    const held = extractHeldStock(
      refusal(409, [{ orderNumber: 'ORD2026080025', styleCode: 'ESSKY085LS', buyerStyleRef: 'EB-77', qty: 300 }])
    );
    expect(held?.heldFor[0].buyerStyleRef).toBe('EB-77');
  });

  it('ignores every other error', () => {
    expect(extractHeldStock(new Error('boom'))).toBeNull();
    expect(extractHeldStock(refusal(400))).toBeNull();
    expect(
      extractHeldStock({ response: { status: 409, data: { details: { code: 'PO_ALLOCATION_CHANGED' } } } })
    ).toBeNull();
  });

  it('survives a missing or malformed list', () => {
    expect(extractHeldStock(refusal(409, null))?.heldFor).toEqual([]);
    expect(extractHeldStock(refusal(409, [null, 'x']))?.heldFor).toEqual([]);
  });
});

describe('wording', () => {
  it('names the order, its style and the quantity', () => {
    expect(heldForLine({ orderNumber: 'ORD2026080025', styleCode: 'ESSKY085LS', qty: 300 }, 'PIECE')).toBe(
      'Held for ORD2026080025 · ESSKY085LS: 300 pcs'
    );
    // The buyer style code first, ours in brackets when it differs
    expect(
      heldForLine({ orderNumber: 'ORD2026080025', styleCode: 'ESSKY085LS', buyerStyleRef: 'EB-77', qty: 300 }, 'PIECE')
    ).toBe('Held for ORD2026080025 · EB-77 (ESSKY085LS): 300 pcs');
    expect(heldForLine({ orderNumber: 'ORD1', styleCode: null, qty: 12.5, unit: 'METER' })).toBe(
      'Held for ORD1: 12.5 m'
    );
  });

  it('asks about one order or several', () => {
    const one = extractHeldStock(refusal())!;
    expect(heldStockQuestion(one)).toBe('Take them anyway? That order will need them bought again.');
    const two = extractHeldStock(
      refusal(409, [
        { orderNumber: 'ORD1', styleCode: 'A', qty: 1 },
        { orderNumber: 'ORD2', styleCode: 'B', qty: 2 },
      ])
    )!;
    expect(heldStockQuestion(two)).toBe('Take them anyway? Those orders will need them bought again.');
  });
});

function Harness({ send }: { send: (takeHeld: boolean) => Promise<string> }) {
  const { withHeldStockConfirm, heldStockDialog } = useHeldStockConfirm();
  const [outcome, setOutcome] = useState('idle');
  return (
    <div>
      <button
        onClick={() => {
          withHeldStockConfirm(send, 'PIECE').then(
            (r) => setOutcome(r === undefined ? 'declined' : r),
            (e: Error) => setOutcome(`error: ${e.message}`)
          );
        }}
      >
        Issue
      </button>
      <div data-testid="outcome">{outcome}</div>
      {heldStockDialog}
    </div>
  );
}

describe('useHeldStockConfirm', () => {
  it('asks, and on yes sends again with takeHeld: true', async () => {
    const send = vi.fn((takeHeld: boolean) => (takeHeld ? Promise.resolve('issued') : Promise.reject(refusal())));
    render(<Harness send={send} />);
    fireEvent.click(screen.getByText('Issue'));

    expect(await screen.findByText('Held for ORD2026080025 · ESSKY085LS: 300 pcs.')).toBeInTheDocument();
    expect(screen.getByText('Take them anyway? That order will need them bought again.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Take them anyway' }));

    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('issued'));
    expect(send.mock.calls.map((c) => c[0])).toEqual([false, true]);
  });

  it('on no, sends nothing more and resolves undefined', async () => {
    const send = vi.fn(() => Promise.reject(refusal()));
    render(<Harness send={send} />);
    fireEvent.click(screen.getByText('Issue'));
    fireEvent.click(await screen.findByRole('button', { name: 'No, keep them' }));

    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('declined'));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('passes any other error straight through, without asking', async () => {
    const send = vi.fn(() => Promise.reject(new Error('Warehouse is closed')));
    render(<Harness send={send} />);
    fireEvent.click(screen.getByText('Issue'));

    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('error: Warehouse is closed'));
    expect(screen.queryByText('Take them anyway')).not.toBeInTheDocument();
  });
});
