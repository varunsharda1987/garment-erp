/**
 * Editing an invoice must save the line items it lets you edit (silent-data-loss finding #8).
 *
 * InvoiceDetail offers "Edit" on any PENDING, non-IRN invoice. The form loads invoice_items into an
 * editable table — description, qty, unit price, HSN, Add Item, delete — and derives `subtotal` from
 * it. But the edit request sent only `{invoiceDate, dueDate, subtotal, remarks}`. `items` was not in
 * updateInvoiceSchema either, so Zod stripped it, and updateInvoice never touched invoice_items.
 *
 * Because `subtotal` WAS present, the header rescaled: taxAmount, totalAmount, cgst/sgst/igst,
 * balanceAmount and the derived status all moved to a figure no line item supported. Change 100 pcs
 * to 90 and the row still says 100 @ 450 while the header says 40,500 + rescaled GST.
 *
 * That is a GST document that fails its own arithmetic — and it feeds the tax-invoice PDF, the IRN
 * registration and the Tally push. It was silent because the only field reflecting the edit was the
 * derived total, and it saved successfully.
 *
 * Now `items` round-trips, and when it is present the SERVER prices the lines and derives every
 * money column from them.
 *
 * SHARED-DB SAFETY: invoice numbers here are RUN-prefixed AND every created id is tracked, so
 * cleanup never depends on a prefix guess. (invoice.service.ts mints real INV{YYMM}-{seq} numbers;
 * a sibling suite cleans up with `startsWith: 'INV-'`, which matches none of them — that suite has
 * been leaking rows into this database since 2026-08-31.)
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { invoiceService } from '../../services/invoice.service';

const RUN = `IIER${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let customerId: string;
let n = 0;

const invoiceIds: string[] = [];

async function makeInvoice(
  lines: Array<{ description: string; quantity: number; unitPrice: number; hsnCode?: string }>
) {
  n += 1;
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const inv = await prisma.invoices.create({
    data: {
      id: randomUUID(),
      invoiceNumber: `${RUN}-${n}`,
      customerId,
      dueDate: new Date(Date.now() + 30 * 86400000),
      subtotal,
      taxAmount: 0,
      totalAmount: subtotal,
      balanceAmount: subtotal,
      isInterstate: false,
      createdById: userId,
    },
  });
  invoiceIds.push(inv.id);
  await prisma.invoice_items.createMany({
    data: lines.map((l) => ({
      id: randomUUID(),
      invoiceId: inv.id,
      description: l.description,
      hsnCode: l.hsnCode ?? null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      totalPrice: l.quantity * l.unitPrice,
      gstRate: 0,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      taxAmount: 0,
    })),
  });
  return inv.id;
}

const itemsOf = (invoiceId: string) =>
  prisma.invoice_items.findMany({ where: { invoiceId }, orderBy: { description: 'asc' } });

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const customer = await prisma.customers.create({
    data: {
      code: `${RUN}-CUST`,
      name: `${RUN} Customer`,
      type: 'BUYER',
      category: 'DOMESTIC',
      createdById: userId,
    },
  });
  customerId = customer.id;
});

afterAll(async () => {
  // Delete by tracked ids, never by a number prefix — and do NOT swallow failures, or a leak
  // becomes invisible exactly the way the sibling suite's has.
  if (invoiceIds.length > 0) {
    await prisma.payments.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.credit_notes.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoice_items.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoices.deleteMany({ where: { id: { in: invoiceIds } } });
  }
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('Editing an invoice saves its line items', () => {
  it('persists a quantity change and re-derives the header from the lines', async () => {
    // The reported bug: 100 @ 450 corrected to 90. Today the row stays at 100 while the header
    // moves to 40,500.
    const id = await makeInvoice([{ description: 'Shirt', quantity: 100, unitPrice: 450 }]);

    // Through HTTP on purpose: the bug had TWO halves — Zod stripped `items` because the update
    // schema never declared it, AND the service ignored them. A service-level call would exercise
    // only the second half and would pass again the moment the schema regressed.
    const res = await request(app)
      .put(`/api/invoices/${id}`)
      .set(authHeader)
      .send({ items: [{ description: 'Shirt', quantity: 90, unitPrice: 450 }] });
    expect(res.status).toBe(200);

    const items = await itemsOf(id);
    expect(items).toHaveLength(1);
    expect(Number(items[0].quantity)).toBeCloseTo(90, 2);

    const inv = await prisma.invoices.findUniqueOrThrow({ where: { id } });
    expect(Number(inv.subtotal)).toBeCloseTo(40500, 2);
  });

  it('leaves the header reconcilable against its own lines', async () => {
    const id = await makeInvoice([{ description: 'Trouser', quantity: 10, unitPrice: 999.99 }]);
    await invoiceService.updateInvoice(id, {
      items: [
        { description: 'Trouser', quantity: 7, unitPrice: 999.99 },
        { description: 'Belt', quantity: 3, unitPrice: 249.5 },
      ],
    } as never);

    const items = await itemsOf(id);
    const inv = await prisma.invoices.findUniqueOrThrow({ where: { id } });

    const lineSum = items.reduce((s, i) => s + Number(i.totalPrice), 0);
    const lineTax = items.reduce((s, i) => s + Number(i.cgstAmount) + Number(i.sgstAmount) + Number(i.igstAmount), 0);
    const headerTax = Number(inv.cgstAmount) + Number(inv.sgstAmount) + Number(inv.igstAmount);

    // This is the invariant the tax-invoice PDF and the IRN preflight both rely on.
    expect(Math.abs(lineSum - Number(inv.subtotal))).toBeLessThanOrEqual(1);
    expect(Math.abs(lineTax - headerTax)).toBeLessThanOrEqual(1);
    expect(Math.abs(Number(inv.totalAmount) - (Number(inv.subtotal) + Number(inv.taxAmount)))).toBeLessThanOrEqual(1);
  });

  it('derives the money from the lines and ignores a subtotal the client sends alongside', async () => {
    const id = await makeInvoice([{ description: 'Cap', quantity: 2, unitPrice: 100 }]);
    await invoiceService.updateInvoice(id, {
      items: [{ description: 'Cap', quantity: 2, unitPrice: 100 }],
      subtotal: 999999,
    } as never);

    const inv = await prisma.invoices.findUniqueOrThrow({ where: { id } });
    expect(Number(inv.subtotal)).toBeCloseTo(200, 2);
  });

  it('round-trips an HSN change — the edit that drives the GST rate and was 100% silent', async () => {
    const id = await makeInvoice([{ description: 'Scarf', quantity: 5, unitPrice: 200, hsnCode: '6117' }]);
    await invoiceService.updateInvoice(id, {
      items: [{ description: 'Scarf', quantity: 5, unitPrice: 200, hsnCode: '6214' }],
    } as never);

    const items = await itemsOf(id);
    expect(items[0].hsnCode).toBe('6214');
  });

  it('adds and removes lines', async () => {
    const id = await makeInvoice([{ description: 'Aaa', quantity: 1, unitPrice: 10 }]);
    await invoiceService.updateInvoice(id, {
      items: [
        { description: 'Aaa', quantity: 1, unitPrice: 10 },
        { description: 'Bbb', quantity: 2, unitPrice: 20 },
      ],
    } as never);
    expect(await itemsOf(id)).toHaveLength(2);

    await invoiceService.updateInvoice(id, { items: [{ description: 'Bbb', quantity: 2, unitPrice: 20 }] } as never);
    const left = await itemsOf(id);
    expect(left).toHaveLength(1);
    expect(left[0].description).toBe('Bbb');
  });
});

describe('Guards on the item-rebuild path', () => {
  it('rejects an empty items array instead of wiping the invoice', async () => {
    const id = await makeInvoice([{ description: 'Keep me', quantity: 1, unitPrice: 100 }]);
    const res = await request(app).put(`/api/invoices/${id}`).set(authHeader).send({ items: [] });
    expect(res.status).toBe(400);
    // The lines must still be there — an empty array is a client error, not "delete everything".
    expect(await itemsOf(id)).toHaveLength(1);
  });

  it('refuses to rewrite lines under an active credit note', async () => {
    const id = await makeInvoice([{ description: 'Credited', quantity: 4, unitPrice: 250 }]);
    await prisma.credit_notes.create({
      data: {
        creditNoteNumber: `${RUN}-CN`,
        invoiceId: id,
        customerId,
        reason: 'RATE_DIFFERENCE',
        subtotal: 100,
        totalAmount: 100,
        status: 'DRAFT',
        createdById: userId,
      },
    });

    await expect(
      invoiceService.updateInvoice(id, { items: [{ description: 'Credited', quantity: 1, unitPrice: 250 }] } as never)
    ).rejects.toThrow(/credit note/i);

    // The guard must fire BEFORE the deleteMany.
    const items = await itemsOf(id);
    expect(items).toHaveLength(1);
    expect(Number(items[0].quantity)).toBeCloseTo(4, 2);
  });

  it('refuses to rewrite lines once money has been received', async () => {
    const id = await makeInvoice([{ description: 'Paid', quantity: 4, unitPrice: 250 }]);
    await prisma.invoices.update({ where: { id }, data: { paidAmount: 500, balanceAmount: 500 } });

    await expect(
      invoiceService.updateInvoice(id, { items: [{ description: 'Paid', quantity: 1, unitPrice: 250 }] } as never)
    ).rejects.toThrow(/payment/i);

    expect(Number((await itemsOf(id))[0].quantity)).toBeCloseTo(4, 2);
  });

  it('keeps the e-Invoice freeze — an IRN-registered document is immutable', async () => {
    const id = await makeInvoice([{ description: 'Frozen', quantity: 3, unitPrice: 300 }]);
    await prisma.invoices.update({ where: { id }, data: { eInvoiceIrn: `${RUN}-IRN` } });

    await expect(
      invoiceService.updateInvoice(id, { items: [{ description: 'Frozen', quantity: 1, unitPrice: 300 }] } as never)
    ).rejects.toThrow(/IRN/i);

    expect(Number((await itemsOf(id))[0].quantity)).toBeCloseTo(3, 2);
  });
});

describe('The paths this change must not disturb', () => {
  it('still scales the header from a subtotal-only edit', async () => {
    const id = await makeInvoice([{ description: 'Legacy', quantity: 10, unitPrice: 100 }]);
    await invoiceService.updateInvoice(id, { subtotal: 1200 } as never);

    const inv = await prisma.invoices.findUniqueOrThrow({ where: { id } });
    expect(Number(inv.subtotal)).toBeCloseTo(1200, 2);
    // ...and it must NOT have touched the lines.
    expect(Number((await itemsOf(id))[0].quantity)).toBeCloseTo(10, 2);
  });

  it('still accepts a plain scalar edit — the Prisma-shape tripwire', async () => {
    // `items` and `taxRate` are on the DTO but are NOT columns on `invoices`. If either ever leaks
    // back into the update data spread, this 200 becomes a 500.
    const id = await makeInvoice([{ description: 'Scalar', quantity: 1, unitPrice: 50 }]);
    const res = await request(app).put(`/api/invoices/${id}`).set(authHeader).send({ remarks: 'just a note' });
    expect(res.status).toBe(200);
    expect((await prisma.invoices.findUniqueOrThrow({ where: { id } })).remarks).toBe('just a note');
  });
});
