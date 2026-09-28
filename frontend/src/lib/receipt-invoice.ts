/**
 * The invoice goods came on — the screen half of backend/src/services/helpers/receipt-invoice.helper.ts
 * (2026-09-28). A receipt carries its supplier's / processor's invoice number and date, or was filed with
 * "Invoice not received yet": a LIVE receipt with no invoice is "To follow" until the bill is added.
 */

/** Receipts whose missing invoice is still expected — not a reversed or rejected one. Mirrors the server. */
export const INVOICE_OPEN_STATUSES = ['PENDING_QC', 'ACCEPTED', 'PARTIALLY_ACCEPTED'] as const;

/** A live receipt filed without its bill. */
export function isInvoiceToFollow(receipt: { invoiceNumber?: string | null; status?: string | null }): boolean {
  return (
    !receipt.invoiceNumber?.trim() && (INVOICE_OPEN_STATUSES as readonly string[]).includes(String(receipt.status))
  );
}
