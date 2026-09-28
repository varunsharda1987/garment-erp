/**
 * The invoice goods came on (owner, 2026-09-28: "make sure that we are recording invoice number also while
 * inwarding goods"). A receipt carries the invoice number AND date, or says "Invoice not received yet"; a
 * lot reads its invoice through its receipt, never a copy — so the Greige Stock page stops reading "-".
 */

import {
  GRN_INVOICE_REQUIRED,
  greigeLotInvoice,
  isInvoiceOpenStatus,
  resolveReceiptInvoice,
} from '../../services/helpers/receipt-invoice.helper';
import { BusinessError } from '../../errors';

const reasonOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    if (e instanceof BusinessError) return (e.details as { reason?: string } | undefined)?.reason;
    throw e;
  }
  return undefined;
};

describe('resolveReceiptInvoice', () => {
  it('is switched on', () => {
    expect(GRN_INVOICE_REQUIRED).toBe(true);
  });

  it('files a trimmed number with its date', () => {
    const r = resolveReceiptInvoice({ invoiceNumber: '  1051 ', invoiceDate: '2026-08-20' }, 'supplier');
    expect(r.invoiceNumber).toBe('1051');
    expect(r.invoiceDate?.toISOString().slice(0, 10)).toBe('2026-08-20');
  });

  it('refuses a receipt with neither an invoice nor the tick — and says how to go on', () => {
    expect(reasonOf(() => resolveReceiptInvoice({}, 'supplier'))).toBe('GRN_INVOICE_REQUIRED');
    expect(() => resolveReceiptInvoice({ invoiceNumber: '   ' }, 'processor')).toThrow(
      /processor's invoice number and date — or tick "Invoice not received yet"/
    );
  });

  it('refuses a number without its date, and a date that is not a date', () => {
    expect(reasonOf(() => resolveReceiptInvoice({ invoiceNumber: 'INV-9' }, 'supplier'))).toBe(
      'GRN_INVOICE_DATE_REQUIRED'
    );
    expect(() => resolveReceiptInvoice({ invoiceNumber: 'INV-9' }, 'supplier')).toThrow(
      'Enter the date of invoice INV-9.'
    );
    expect(
      reasonOf(() => resolveReceiptInvoice({ invoiceNumber: 'INV-9', invoiceDate: '31/31/2026' }, 'supplier'))
    ).toBe('GRN_INVOICE_DATE_INVALID');
  });

  it('files "to follow" as nulls when ticked — and keeps a number typed anyway', () => {
    expect(resolveReceiptInvoice({ invoiceToFollow: true }, 'supplier')).toEqual({
      invoiceNumber: null,
      invoiceDate: null,
    });
    expect(
      resolveReceiptInvoice({ invoiceToFollow: true, invoiceDate: '2026-09-28' }, 'supplier').invoiceDate
    ).toBeNull();
    const typed = resolveReceiptInvoice(
      { invoiceToFollow: true, invoiceNumber: 'B-7', invoiceDate: new Date('2026-09-28') },
      'processor'
    );
    expect(typed.invoiceNumber).toBe('B-7');
  });
});

describe('greigeLotInvoice — a lot reads its invoice through its receipt', () => {
  const receipt = (over: Partial<{ invoiceNumber: string | null; status: string }> = {}) => ({
    id: 'grn-1',
    grnNumber: 'GRN2608-0004',
    status: 'ACCEPTED',
    invoiceNumber: '1051',
    invoiceDate: new Date('2026-08-20'),
    ...over,
  });

  it("reads the lot's own receipt (GRG-0039 on GRN2608-0004 → 1051)", () => {
    expect(greigeLotInvoice({ grnItem: { goods_receiving_notes: receipt() } })).toMatchObject({
      invoiceNumber: '1051',
      invoiceGrnId: 'grn-1',
      invoiceGrnNumber: 'GRN2608-0004',
      invoiceToFollow: false,
    });
  });

  it('reads the origin lot’s receipt for a lot split off another (same procurement)', () => {
    const split = greigeLotInvoice({
      grnItem: null,
      procurement: {
        invoiceNumber: null,
        invoiceDate: null,
        greigeStock: [{ grnItem: { goods_receiving_notes: receipt() } }],
      },
    });
    expect(split.invoiceNumber).toBe('1051');
    expect(split.invoiceGrnId).toBe('grn-1');
  });

  it('says "to follow" only for a live receipt without its bill', () => {
    expect(
      greigeLotInvoice({ grnItem: { goods_receiving_notes: receipt({ invoiceNumber: null }) } }).invoiceToFollow
    ).toBe(true);
    expect(
      greigeLotInvoice({ grnItem: { goods_receiving_notes: receipt({ invoiceNumber: null, status: 'REVERSED' }) } })
        .invoiceToFollow
    ).toBe(false);
    expect(isInvoiceOpenStatus('PENDING_QC')).toBe(true);
    expect(isInvoiceOpenStatus('REJECTED')).toBe(false);
  });

  it('falls back to what a hand-entered lot typed, then to its procurement', () => {
    expect(
      greigeLotInvoice({
        invoiceNumber: 'M-12',
        invoiceDate: new Date('2026-07-29'),
        procurement: { invoiceNumber: 'P-1', invoiceDate: null, greigeStock: [] },
      })
    ).toMatchObject({ invoiceNumber: 'M-12', invoiceGrnId: null, invoiceToFollow: false });
    expect(
      greigeLotInvoice({ procurement: { invoiceNumber: 'P-1', invoiceDate: null, greigeStock: [] } }).invoiceNumber
    ).toBe('P-1');
    expect(greigeLotInvoice({}).invoiceNumber).toBeNull();
  });
});
