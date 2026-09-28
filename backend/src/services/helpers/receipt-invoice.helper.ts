/**
 * The invoice goods came on — ONE rule for every inward that has a supplier's or processor's bill
 * (owner, 2026-09-28: "make sure that we are recording invoice number also while inwarding goods").
 *
 * A purchase GRN (incl. goods delivered straight to a processor) and a job-work return ("Receive from
 * processor") carry the invoice number AND date — unless the receiver ticks "Invoice not received yet"
 * (the goods came on a delivery challan; the bill follows). Missing data never blocks receiving; it is
 * said out loud. No column stores the tick: a LIVE receipt with no invoice is "To follow", and the bill
 * is added later on the receipt (PATCH /api/grn/:id/invoice).
 *
 * Lots never copy the invoice (a copy would go stale when the bill is added later): a greige lot reads it
 * through its receipt — see greigeLotInvoice. The whole job's bill is job_work_orders.invoiceNumber
 * (confirmed at Close); each return receipt's invoice is the bill for THAT delivery.
 *
 * Pure — no database access.
 */
import type { Prisma } from '@prisma/client';
import { BusinessError } from '../../errors';

/** The switch (mirrors GRN_WEAVER_REQUIRED): off = the invoice is optional again, nothing else changes. */
export const GRN_INVOICE_REQUIRED = true;

/** A receipt whose missing invoice is still expected ("To follow") — not a reversed or rejected one. */
export const INVOICE_OPEN_STATUSES = ['PENDING_QC', 'ACCEPTED', 'PARTIALLY_ACCEPTED'] as const;

export function isInvoiceOpenStatus(status: string | null | undefined): boolean {
  return (INVOICE_OPEN_STATUSES as readonly string[]).includes(String(status));
}

export interface ReceiptInvoiceInput {
  invoiceNumber?: string | null;
  invoiceDate?: string | Date | null;
  /** "Invoice not received yet" — the goods came without a bill */
  invoiceToFollow?: boolean | null;
}

/**
 * The invoice a receipt is filed with: trimmed number + a real date, or nulls when the bill is to follow.
 * Refuses (422) a receipt with neither an invoice nor the tick, a number without its date, and a date that
 * is not a date.
 */
export function resolveReceiptInvoice(
  input: ReceiptInvoiceInput,
  party: 'supplier' | 'processor'
): { invoiceNumber: string | null; invoiceDate: Date | null } {
  const invoiceNumber = input.invoiceNumber?.trim() || null;
  const rawDate = input.invoiceDate;
  let invoiceDate: Date | null = null;
  if (rawDate !== null && rawDate !== undefined && rawDate !== '') {
    invoiceDate = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (Number.isNaN(invoiceDate.getTime())) {
      throw new BusinessError(`"${String(rawDate)}" is not a date — enter the invoice date again.`, {
        reason: 'GRN_INVOICE_DATE_INVALID',
      });
    }
  }

  if (invoiceNumber) {
    if (!invoiceDate) {
      throw new BusinessError(`Enter the date of invoice ${invoiceNumber}.`, { reason: 'GRN_INVOICE_DATE_REQUIRED' });
    }
    return { invoiceNumber, invoiceDate };
  }
  if (GRN_INVOICE_REQUIRED && input.invoiceToFollow !== true) {
    throw new BusinessError(
      `Enter the ${party}'s invoice number and date — or tick "Invoice not received yet" if the goods came ` +
        `without a bill. (No such box on your screen? Reload the page.)`,
      { reason: 'GRN_INVOICE_REQUIRED' }
    );
  }
  // To follow: a date with no number means nothing on its own
  return { invoiceNumber: null, invoiceDate: null };
}

// ---------------------------------------------------------------------------------------------
// A greige lot's invoice — read through its receipt, never copied
// ---------------------------------------------------------------------------------------------

const RECEIPT_INVOICE_SELECT = {
  id: true,
  grnNumber: true,
  status: true,
  invoiceNumber: true,
  invoiceDate: true,
} satisfies Prisma.goods_receiving_notesSelect;

/**
 * What a greige lot read needs for its invoice: its own receipt, and — for a lot split off another (Stock-Out,
 * Bring to store, Move) which keeps only the procurement — the origin lot's receipt through that procurement.
 */
export const GREIGE_LOT_INVOICE_INCLUDE = {
  grnItem: { select: { goods_receiving_notes: { select: RECEIPT_INVOICE_SELECT } } },
  procurement: {
    select: {
      invoiceNumber: true,
      invoiceDate: true,
      greigeStock: {
        where: { grnItemId: { not: null } },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { grnItem: { select: { goods_receiving_notes: { select: RECEIPT_INVOICE_SELECT } } } },
      },
    },
  },
} satisfies Prisma.greige_stockInclude;

type ReceiptInvoice = {
  id: string;
  grnNumber: string;
  status: string;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
} | null;

export interface GreigeLotInvoiceSource {
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  grnItem?: { goods_receiving_notes: ReceiptInvoice } | null;
  procurement?: {
    invoiceNumber: string | null;
    invoiceDate: Date | null;
    greigeStock: Array<{ grnItem: { goods_receiving_notes: ReceiptInvoice } | null }>;
  } | null;
}

export interface GreigeLotInvoice {
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  /** The receipt the invoice belongs to — the screen links "To follow" to it */
  invoiceGrnId: string | null;
  invoiceGrnNumber: string | null;
  /** The lot came on a live receipt whose bill has not been recorded yet */
  invoiceToFollow: boolean;
}

/**
 * The invoice a greige lot came on. Order: its own receipt → the origin lot's receipt (same procurement,
 * for a lot split off another) → the invoice typed when the lot was entered by hand → its procurement's.
 */
export function greigeLotInvoice(lot: GreigeLotInvoiceSource): GreigeLotInvoice {
  const receipt =
    lot.grnItem?.goods_receiving_notes ?? lot.procurement?.greigeStock?.[0]?.grnItem?.goods_receiving_notes ?? null;
  if (receipt) {
    return {
      invoiceNumber: receipt.invoiceNumber,
      invoiceDate: receipt.invoiceDate,
      invoiceGrnId: receipt.id,
      invoiceGrnNumber: receipt.grnNumber,
      invoiceToFollow: !receipt.invoiceNumber && isInvoiceOpenStatus(receipt.status),
    };
  }
  const typed = lot.invoiceNumber?.trim() ? lot : null;
  return {
    invoiceNumber: typed?.invoiceNumber ?? lot.procurement?.invoiceNumber ?? null,
    invoiceDate: typed ? (typed.invoiceDate ?? null) : (lot.procurement?.invoiceDate ?? null),
    invoiceGrnId: null,
    invoiceGrnNumber: null,
    invoiceToFollow: false,
  };
}
