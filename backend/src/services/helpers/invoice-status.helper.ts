/**
 * Invoice status helper — the single authority for invoices.status
 * (data-ownership landmine №5, fixed 2026-08-24).
 *
 * Amount-owed was tracked two ways: `balanceAmount` (a running balance that payments AND
 * approved credit notes decrement) and a status recomputed from payments alone
 * (totalAmount − paidAmount). An invoice settled by part credit note + part payment got
 * stuck at PARTIALLY_PAID/OVERDUE forever — no further payment could arrive to fix it,
 * because the balance guard rejects overpaying — so accounts kept dunning a customer who
 * owed nothing. The status now derives from the BALANCE (which knows about credits), and
 * a settlement that used credit gets its own label (owner decision 2026-08-24):
 *
 *   PAID                — balance cleared entirely by payments
 *   SETTLED_WITH_CREDIT — balance cleared, but partly/wholly by an approved credit note
 *   PARTIALLY_PAID      — some settlement (payment or credit), balance still open
 *   OVERDUE             — balance still open past the due date
 *   PENDING             — untouched, not yet due
 *
 * EVERY status write goes through deriveInvoiceStatus: recordPayment, credit-note
 * approval, and invoice money/due-date edits. updateInvoice must also recompute the
 * balance as total − paid − approvedCredits (it used to erase the credit decrement).
 */

import { InvoiceStatus, Prisma } from '@prisma/client';
import { toCurrency } from '../../utils/currency';

/** Residual-imprecision tolerance, mirrors the recordPayment balance guard. */
const TOLERANCE = 0.005;

type Money = Prisma.Decimal | number | string;

export function deriveInvoiceStatus(
  totalAmount: Money,
  paidAmount: Money,
  balanceAmount: Money,
  dueDate: Date | string
): InvoiceStatus {
  const total = toCurrency(totalAmount.toString());
  const paid = toCurrency(paidAmount.toString());
  const balance = toCurrency(balanceAmount.toString());
  const overdue = new Date() > new Date(dueDate);

  if (balance.lessThanOrEqualTo(TOLERANCE)) {
    // Settled. If payments alone cover the total it is plain PAID; anything short means a
    // credit note closed the gap (a negative balance = credit exceeded the open amount).
    return paid.plus(TOLERANCE).greaterThanOrEqualTo(total) ? 'PAID' : 'SETTLED_WITH_CREDIT';
  }

  const partiallySettled = paid.greaterThan(0) || balance.lessThan(total);
  if (overdue) return 'OVERDUE';
  return partiallySettled ? 'PARTIALLY_PAID' : 'PENDING';
}
