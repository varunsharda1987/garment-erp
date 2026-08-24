/**
 * Landmine №5 — an invoice settled by part credit note + part payment must not stay
 * "overdue" forever.
 *
 * Status used to be recomputed from payments alone (total − paid) while approved credit
 * notes only decremented balanceAmount — so a part-credit part-payment invoice stuck at
 * PARTIALLY_PAID/OVERDUE with dunning running, and a later money edit re-added the
 * credited amount to the receivable. Now every writer derives from the BALANCE via
 * helpers/invoice-status.helper.ts, and a credit-assisted settlement gets its own
 * SETTLED_WITH_CREDIT status (owner decision 2026-08-24).
 */

import { deriveInvoiceStatus } from '../helpers/invoice-status.helper';
import { invoiceService } from '../invoice.service';
import { creditNoteService } from '../creditNote.service';
import prisma from '../../config/database';
import { randomUUID } from 'crypto';

describe('invoice + credit-note settlement (landmine №5)', () => {
  const RUN = `TICS${Date.now().toString(36).toUpperCase()}`;
  let testUserId: string;
  let customerId: string;
  let n = 0;

  const FUTURE = new Date(Date.now() + 30 * 86400_000);
  const PAST = new Date(Date.now() - 30 * 86400_000);

  beforeAll(async () => {
    const user = await prisma.users.create({
      data: {
        email: `${RUN.toLowerCase()}@test.com`,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
      },
    });
    testUserId = user.id;

    const customer = await prisma.customers.create({
      data: {
        code: `${RUN}-CUST`,
        name: `${RUN} Customer`,
        type: 'BUYER',
        category: 'DOMESTIC',
        createdById: testUserId,
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    try {
      await prisma.payments.deleteMany({ where: { invoices: { invoiceNumber: { startsWith: RUN } } } });
      await prisma.credit_notes.deleteMany({ where: { creditNoteNumber: { startsWith: RUN } } });
      await prisma.invoices.deleteMany({ where: { invoiceNumber: { startsWith: RUN } } });
      await prisma.customers.deleteMany({ where: { id: customerId } });
      await prisma.users.deleteMany({ where: { id: testUserId } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  function createInvoice(total: number, dueDate: Date = FUTURE) {
    n += 1;
    return prisma.invoices.create({
      data: {
        id: randomUUID(),
        invoiceNumber: `${RUN}-${n}`,
        customerId,
        dueDate,
        subtotal: total,
        taxAmount: 0,
        totalAmount: total,
        balanceAmount: total,
        createdById: testUserId,
      },
    });
  }

  function createDraftCreditNote(invoiceId: string, amount: number) {
    n += 1;
    return prisma.credit_notes.create({
      data: {
        creditNoteNumber: `${RUN}-CN-${n}`,
        invoiceId,
        customerId,
        reason: 'RATE_DIFFERENCE',
        subtotal: amount,
        totalAmount: amount,
        status: 'DRAFT',
        createdById: testUserId,
      },
    });
  }

  function pay(invoiceId: string, amount: number) {
    return invoiceService.recordPayment({
      invoiceId,
      amount,
      paymentMethod: 'BANK_TRANSFER',
      receivedById: testUserId,
    });
  }

  async function status(invoiceId: string) {
    const inv = await prisma.invoices.findUnique({ where: { id: invoiceId } });
    return { status: inv!.status, balance: Number(inv!.balanceAmount) };
  }

  it('pure derivation: balance decides, credit-assisted settlement gets its own label', () => {
    // Fully paid by payments
    expect(deriveInvoiceStatus(1000, 1000, 0, FUTURE)).toBe('PAID');
    // Settled, but payments fall short of total → a credit closed the gap
    expect(deriveInvoiceStatus(1000, 600, 0, FUTURE)).toBe('SETTLED_WITH_CREDIT');
    // Credit exceeding the open balance (refund due) is still settled
    expect(deriveInvoiceStatus(1000, 0, -50, FUTURE)).toBe('SETTLED_WITH_CREDIT');
    // Partial credit with no payment = partially settled
    expect(deriveInvoiceStatus(1000, 0, 600, FUTURE)).toBe('PARTIALLY_PAID');
    expect(deriveInvoiceStatus(1000, 400, 600, FUTURE)).toBe('PARTIALLY_PAID');
    expect(deriveInvoiceStatus(1000, 400, 600, PAST)).toBe('OVERDUE');
    expect(deriveInvoiceStatus(1000, 0, 1000, FUTURE)).toBe('PENDING');
    expect(deriveInvoiceStatus(1000, 0, 1000, PAST)).toBe('OVERDUE');
  });

  it('payment then credit note: lands on SETTLED_WITH_CREDIT, not stuck PARTIALLY_PAID', async () => {
    const inv = await createInvoice(1000);
    await pay(inv.id, 600);
    expect((await status(inv.id)).status).toBe('PARTIALLY_PAID');

    const cn = await createDraftCreditNote(inv.id, 400);
    await creditNoteService.approve(cn.id);

    const after = await status(inv.id);
    expect(after.balance).toBe(0);
    expect(after.status).toBe('SETTLED_WITH_CREDIT');
  });

  it('credit note then final payment: the previously-stuck order of events (the incident pin)', async () => {
    const inv = await createInvoice(1000);
    const cn = await createDraftCreditNote(inv.id, 400);
    await creditNoteService.approve(cn.id);
    expect((await status(inv.id)).status).toBe('PARTIALLY_PAID');

    // The balance guard allows exactly the remaining 600 — and the status must settle,
    // not stick at PARTIALLY_PAID (the old payments-only math saw 600 < 1000 forever)
    await pay(inv.id, 600);

    const after = await status(inv.id);
    expect(after.balance).toBe(0);
    expect(after.status).toBe('SETTLED_WITH_CREDIT');
  });

  it('an overdue invoice settled by credit stops being OVERDUE (dunning stops)', async () => {
    const inv = await createInvoice(1000, PAST);
    await pay(inv.id, 600);
    expect((await status(inv.id)).status).toBe('OVERDUE');

    const cn = await createDraftCreditNote(inv.id, 400);
    await creditNoteService.approve(cn.id);
    expect((await status(inv.id)).status).toBe('SETTLED_WITH_CREDIT');
  });

  it('a money edit preserves the credit decrement instead of re-adding it to the receivable', async () => {
    const inv = await createInvoice(1000);
    const cn = await createDraftCreditNote(inv.id, 400);
    await creditNoteService.approve(cn.id);
    expect((await status(inv.id)).balance).toBe(600);

    // Raise the invoice to 1200 — the balance must become 1200 − 0 paid − 400 credit = 800
    // (the old recompute produced 1200: the credit silently vanished from the books)
    await invoiceService.updateInvoice(inv.id, { subtotal: 1200 } as any);

    const after = await status(inv.id);
    expect(after.balance).toBe(800);
    expect(after.status).toBe('PARTIALLY_PAID');
  });

  it('payments-only invoices behave exactly as before (regression)', async () => {
    const inv = await createInvoice(1000);
    await pay(inv.id, 400);
    expect((await status(inv.id)).status).toBe('PARTIALLY_PAID');
    await pay(inv.id, 600);
    const after = await status(inv.id);
    expect(after.status).toBe('PAID');
    expect(after.balance).toBe(0);
  });
});
