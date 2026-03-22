import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { gstService } from './gst.service';
import { NotFoundError, ValidationError, BusinessError } from '../errors';

interface CreditNoteCreateInput {
  invoiceId: string;
  customerId: string;
  creditNoteDate?: string;
  reason: string; // CreditNoteReason enum
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
  status?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class CreditNoteService {

  /**
   * Generate next credit note number (CN-001, CN-002, etc.)
   */
  private async generateCreditNoteNumber(): Promise<string> {
    const lastCreditNote = await prisma.credit_notes.findFirst({
      where: {
        creditNoteNumber: {
          startsWith: 'CN-',
        },
      },
      orderBy: {
        creditNoteNumber: 'desc',
      },
      select: {
        creditNoteNumber: true,
      },
    });

    if (!lastCreditNote) {
      return 'CN-001';
    }

    const lastNumber = parseInt(lastCreditNote.creditNoteNumber.replace('CN-', ''), 10);
    const nextNumber = lastNumber + 1;
    return `CN-${nextNumber.toString().padStart(3, '0')}`;
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

      // Calculate GST for each item
      const itemsWithGST = await Promise.all(
        data.items.map(async (item) => {
          const lineTotal = item.quantity * item.unitPrice;

          const gstResult = await gstService.calculateLineItemGST({
            lineTotal,
            hsnSacCode: item.hsnCode,
            isInterstate,
          });

          return {
            invoiceItemId: item.invoiceItemId || null,
            description: item.description,
            hsnCode: item.hsnCode || null,
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

      // Sum up header totals
      let subtotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      for (const item of itemsWithGST) {
        subtotal += item.totalPrice;
        totalCgst += item.cgstAmount;
        totalSgst += item.sgstAmount;
        totalIgst += item.igstAmount;
      }

      const totalTax = parseFloat((totalCgst + totalSgst + totalIgst).toFixed(2));
      const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

      // Create credit note with items
      const creditNote = await tx.credit_notes.create({
        data: {
          creditNoteNumber,
          invoiceId: data.invoiceId,
          customerId: data.customerId,
          creditNoteDate: data.creditNoteDate ? new Date(data.creditNoteDate) : new Date(),
          reason: data.reason as any,
          remarks: data.remarks || null,
          isInterstate,
          subtotal: parseFloat(subtotal.toFixed(2)),
          cgstAmount: parseFloat(totalCgst.toFixed(2)),
          sgstAmount: parseFloat(totalSgst.toFixed(2)),
          igstAmount: parseFloat(totalIgst.toFixed(2)),
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
      where.status = status as any;
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
              name: true,
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

    return prisma.credit_notes.update({
      where: { id },
      data: { status: 'APPROVED' },
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
