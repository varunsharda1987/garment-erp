import prisma from '../config/database';
import { Prisma, CreditNoteReason, DocumentStatus } from '@prisma/client';
import { gstService } from './gst.service';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import { generateAtomicCreditNoteNumber } from '../utils/atomicCodeGenerator';
import { roundToCent, multiplyCurrency, addCurrency, subtractCurrency, toCurrency } from '../utils/currency';
import { deriveInvoiceStatus } from './helpers/invoice-status.helper';

interface CreditNoteCreateInput {
  invoiceId: string;
  customerId: string;
  creditNoteDate?: string;
  reason: CreditNoteReason;
  remarks?: string;
  items: Array<{
    invoiceItemId?: string;
    description: string;
    hsnCode?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

interface CreditNoteQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: DocumentStatus;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class CreditNoteService {
  /**
   * Generate next credit note number (CN2607-0001, ...).
   * bug-hunt financial-gst-11: the old lexicographic findFirst('desc') + padStart(3) generator
   * permanently wedged after CN-999 ('CN-999' > 'CN-1000' as strings → eternal P2002) and raced
   * under concurrency. The atomic sequence UPSERT cannot collide.
   */
  private async generateCreditNoteNumber(): Promise<string> {
    return generateAtomicCreditNoteNumber();
  }

  /**
   * Create a new credit note with items and GST calculation
   */
  async create(data: CreditNoteCreateInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      // Fetch the linked invoice to determine isInterstate
      const invoice = await tx.invoices.findUnique({
        where: { id: data.invoiceId },
        select: { isInterstate: true },
      });

      if (!invoice) {
        throw new NotFoundError('Invoice');
      }

      const isInterstate = invoice.isInterstate;

      // Generate credit note number
      const creditNoteNumber = await this.generateCreditNoteNumber();

      // bug-hunt financial-gst-15: a credit note reverses the tax the invoice actually charged.
      // For items linked to an invoice line, copy the STORED gstRate/hsnCode from invoice_items
      // instead of re-resolving from current rate tables (which fall back to 5% when hsnCode is
      // omitted, or may have changed since the invoice was issued).
      const linkedItemIds = data.items.map((item) => item.invoiceItemId).filter((id): id is string => Boolean(id));
      const linkedInvoiceItems = linkedItemIds.length
        ? await tx.invoice_items.findMany({
            where: { id: { in: linkedItemIds }, invoiceId: data.invoiceId },
            select: { id: true, gstRate: true, hsnCode: true },
          })
        : [];
      const linkedItemById = new Map(linkedInvoiceItems.map((li) => [li.id, li]));

      // Calculate GST for each item
      const itemsWithGST = await Promise.all(
        data.items.map(async (item) => {
          const lineTotal = roundToCent(multiplyCurrency(item.quantity, item.unitPrice)).toNumber();

          const linked = item.invoiceItemId ? linkedItemById.get(item.invoiceItemId) : undefined;
          if (item.invoiceItemId && !linked) {
            throw new ValidationError(
              `Invoice item ${item.invoiceItemId} does not belong to invoice ${data.invoiceId}`
            );
          }

          const gstResult = await gstService.calculateLineItemGST({
            lineTotal,
            hsnSacCode: item.hsnCode || linked?.hsnCode,
            // Reverse at the invoiced rate for linked lines; fresh lookup only for unlinked lines
            gstRateOverride: linked ? Number(linked.gstRate) : undefined,
            isInterstate,
            unitPrice: item.unitPrice,
          });

          return {
            invoiceItemId: item.invoiceItemId || null,
            description: item.description,
            hsnCode: item.hsnCode || linked?.hsnCode || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: lineTotal,
            gstRate: gstResult.gstRate,
            cgstAmount: gstResult.cgstAmount,
            sgstAmount: gstResult.sgstAmount,
            igstAmount: gstResult.igstAmount,
            taxAmount: gstResult.taxAmount,
          };
        })
      );

      // Header totals via the shared decimal.js aggregation (bug-hunt financial-gst-13:
      // was a raw float += loop that drifted paise vs the stored per-line amounts)
      const totals = gstService.calculateTotals(
        itemsWithGST.map((item) => ({
          lineTotal: item.totalPrice,
          hsnCode: item.hsnCode,
          gstRate: item.gstRate,
          cgstRate: 0,
          cgstAmount: item.cgstAmount,
          sgstRate: 0,
          sgstAmount: item.sgstAmount,
          igstRate: 0,
          igstAmount: item.igstAmount,
          taxAmount: item.taxAmount,
        }))
      );
      const subtotal = totals.subtotal;
      const totalCgst = totals.totalCgst;
      const totalSgst = totals.totalSgst;
      const totalIgst = totals.totalIgst;
      const totalTax = totals.totalTax;
      const totalAmount = roundToCent(addCurrency(subtotal, totalTax)).toNumber();

      // BUG-CN5 fix: Validate cumulative credit notes must not exceed invoice total
      // Use decimal.js to avoid floating point precision errors in comparisons
      const existingCreditNotes = await tx.credit_notes.aggregate({
        where: {
          invoiceId: data.invoiceId,
          status: { not: 'CANCELLED' },
        },
        _sum: { totalAmount: true },
      });
      // BUG-CN5 fix: convert Prisma Decimals to string for decimal.js
      const existingTotalStr = existingCreditNotes._sum.totalAmount?.toString() || '0';
      const existingTotalDec = toCurrency(existingTotalStr);

      const invoiceFull = await tx.invoices.findUnique({
        where: { id: data.invoiceId },
        select: { totalAmount: true },
      });
      const invoiceTotalStr = invoiceFull?.totalAmount?.toString() || '0';
      const invoiceTotalDec = toCurrency(invoiceTotalStr);

      // BUG-CN5 fix: use decimal.js for precise comparison (avoids 0.1 + 0.2 != 0.3 issues)
      const cumulativeTotal = addCurrency(existingTotalStr, totalAmount);
      if (cumulativeTotal.greaterThan(invoiceTotalDec)) {
        const remainingAllowance = roundToCent(subtractCurrency(invoiceTotalStr, existingTotalStr));
        throw new Error(
          `Credit note total (₹${totalAmount}) would exceed invoice amount. ` +
            `Invoice total: ₹${invoiceTotalDec.toFixed(2)}, existing credit notes: ₹${existingTotalDec.toFixed(2)}, ` +
            `remaining allowance: ₹${remainingAllowance.toFixed(2)}`
        );
      }

      // Create credit note with items
      const creditNote = await tx.credit_notes.create({
        data: {
          creditNoteNumber,
          invoiceId: data.invoiceId,
          customerId: data.customerId,
          creditNoteDate: data.creditNoteDate ? new Date(data.creditNoteDate) : new Date(),
          reason: data.reason,
          remarks: data.remarks || null,
          isInterstate,
          subtotal,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          totalTax,
          totalAmount,
          status: 'DRAFT',
          createdById: userId,
          items: {
            create: itemsWithGST.map((item) => ({
              invoiceItemId: item.invoiceItemId,
              description: item.description,
              hsnCode: item.hsnCode,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              gstRate: item.gstRate,
              cgstAmount: item.cgstAmount,
              sgstAmount: item.sgstAmount,
              igstAmount: item.igstAmount,
              taxAmount: item.taxAmount,
            })),
          },
        },
        include: {
          invoice: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          items: true,
        },
      });

      return creditNote;
    });
  }

  /**
   * Get all credit notes with pagination and filtering
   */
  async getAll(params: CreditNoteQueryParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      customerId,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.credit_notesWhereInput = {};

    if (search) {
      where.OR = [
        { creditNoteNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (fromDate || toDate) {
      where.creditNoteDate = {};
      if (fromDate) {
        where.creditNoteDate.gte = new Date(fromDate);
      }
      if (toDate) {
        where.creditNoteDate.lte = new Date(toDate);
      }
    }

    const [data, total] = await Promise.all([
      prisma.credit_notes.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
              billingName: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          items: true,
        },
      }),
      prisma.credit_notes.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get credit note by ID with all relations
   */
  async getById(id: string) {
    return prisma.credit_notes.findUnique({
      where: { id },
      include: {
        invoice: true,
        customer: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: true,
      },
    });
  }

  /**
   * Approve a credit note (only if DRAFT)
   */
  async approve(id: string) {
    const creditNote = await prisma.credit_notes.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!creditNote) {
      throw new NotFoundError('Credit note');
    }

    if (creditNote.status !== 'DRAFT') {
      throw new BusinessError('Only DRAFT credit notes can be approved');
    }

    // Approval + receivable effect are ONE transaction (bug-hunt financial-gst-6: approved credit notes
    // never touched invoices.balanceAmount, so receivables stayed overstated and recordPayment's balance
    // guard allowed collecting the full amount on top of the credit).
    // NOTE: cancel/delete only apply to DRAFT notes, so approval is one-way — if a reversal path for
    // APPROVED notes is ever added, it MUST re-increment the invoice balance the same way.
    return prisma.$transaction(async (tx) => {
      // Guarded flip (DRAFT only) inside the tx — a concurrent double-approve gets count 0 and cannot
      // decrement the balance twice.
      const flipped = await tx.credit_notes.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'APPROVED' },
      });
      if (flipped.count === 0) {
        throw new BusinessError('Only DRAFT credit notes can be approved');
      }

      const note = await tx.credit_notes.findUnique({
        where: { id },
        select: { invoiceId: true, totalAmount: true },
      });

      // Atomic decrement. A negative balance is allowed (credit exceeding the open
      // balance = refund due).
      const inv = await tx.invoices.update({
        where: { id: note!.invoiceId },
        data: { balanceAmount: { decrement: note!.totalAmount } },
      });
      // Landmine №5: one shared derivation for every status writer. A credit that fully
      // settles the invoice lands on SETTLED_WITH_CREDIT (owner decision 2026-08-24) —
      // and a partial credit correctly steps PENDING → PARTIALLY_PAID.
      const newStatus = deriveInvoiceStatus(inv.totalAmount, inv.paidAmount, inv.balanceAmount, inv.dueDate);
      if (inv.status !== newStatus) {
        await tx.invoices.update({ where: { id: inv.id }, data: { status: newStatus } });
      }

      // Fetched AFTER the invoice update so the included invoice reflects the new balance.
      return tx.credit_notes.findUnique({
        where: { id },
        include: {
          invoice: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          items: true,
        },
      });
    });
  }

  /**
   * Cancel a credit note (only if DRAFT)
   */
  async cancel(id: string) {
    const creditNote = await prisma.credit_notes.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!creditNote) {
      throw new NotFoundError('Credit note');
    }

    if (creditNote.status !== 'DRAFT') {
      throw new BusinessError('Only DRAFT credit notes can be cancelled');
    }

    return prisma.credit_notes.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        invoice: true,
        customer: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: true,
      },
    });
  }

  /**
   * Delete a credit note (only if DRAFT)
   */
  async delete(id: string) {
    const creditNote = await prisma.credit_notes.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!creditNote) {
      throw new NotFoundError('Credit note');
    }

    if (creditNote.status !== 'DRAFT') {
      throw new BusinessError('Only DRAFT credit notes can be deleted');
    }

    return prisma.credit_notes.delete({
      where: { id },
    });
  }
}

export const creditNoteService = new CreditNoteService();
