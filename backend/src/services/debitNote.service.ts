import prisma from '../config/database';
import { Prisma, DebitNoteReason, DocumentStatus } from '@prisma/client';
import { gstService } from './gst.service';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import { generateAtomicDebitNoteNumber } from '../utils/atomicCodeGenerator';
import { roundToCent, multiplyCurrency, addCurrency } from '../utils/currency';

// ============================================
// Types
// ============================================

interface DebitNoteCreateInput {
  poId?: string;
  supplierId: string;
  debitNoteDate?: string;
  reason: DebitNoteReason;
  remarks?: string;
  items: Array<{
    poItemId?: string;
    description: string;
    hsnCode?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

interface DebitNoteQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: DocumentStatus;
  supplierId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Service
// ============================================

export class DebitNoteService {
  /**
   * Generate next debit note number (DN2607-0001, ...).
   * bug-hunt financial-gst-11: the old lexicographic findFirst('desc') + padStart(3) generator
   * permanently wedged after DN-999 ('DN-999' > 'DN-1000' as strings → eternal P2002) and raced
   * under concurrency. The atomic sequence UPSERT cannot collide.
   */
  private async generateDebitNoteNumber(): Promise<string> {
    return generateAtomicDebitNoteNumber();
  }

  /**
   * Create a new debit note with items and GST calculation
   */
  async create(data: DebitNoteCreateInput, userId: string) {
    if (!data.items || data.items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    // Determine interstate status from the supplier alone — the lookup needs only supplierId,
    // so it must NOT be gated on the optional poId (bug-hunt financial-gst-7: standalone debit
    // notes for out-of-state suppliers were always taxed CGST/SGST instead of IGST).
    const { isInterstate } = await gstService.isInterstatePO(data.supplierId);

    // Calculate GST for each item
    const itemsWithGST = await Promise.all(
      data.items.map(async (item) => {
        const lineTotal = roundToCent(multiplyCurrency(item.quantity, item.unitPrice)).toNumber();
        const gstResult = await gstService.calculateLineItemGST({
          lineTotal,
          hsnSacCode: item.hsnCode,
          isInterstate,
          unitPrice: item.unitPrice,
        });

        return {
          ...item,
          lineTotal,
          gstResult,
        };
      })
    );

    // Header totals via the shared decimal.js aggregation (bug-hunt financial-gst-13:
    // was a raw float += loop that drifted paise vs the stored per-line amounts)
    const totals = gstService.calculateTotals(
      itemsWithGST.map((item) => ({ lineTotal: item.lineTotal, ...item.gstResult }))
    );
    const subtotal = totals.subtotal;
    const totalCgst = totals.totalCgst;
    const totalSgst = totals.totalSgst;
    const totalIgst = totals.totalIgst;
    const totalTax = totals.totalTax;

    const totalAmount = roundToCent(addCurrency(subtotal, totalTax)).toNumber();
    const debitNoteNumber = await this.generateDebitNoteNumber();

    // Validate: cumulative debit notes must not exceed PO total (if linked to PO)
    if (data.poId) {
      const existingDebitNotes = await prisma.debit_notes.aggregate({
        where: {
          poId: data.poId,
          status: { not: 'CANCELLED' },
        },
        _sum: { totalAmount: true },
      });
      const existingTotal = Number(existingDebitNotes._sum.totalAmount || 0);

      const po = await prisma.purchase_orders.findUnique({
        where: { id: data.poId },
        select: { totalAmount: true },
      });
      const poTotal = Number(po?.totalAmount || 0);

      if (poTotal > 0 && existingTotal + totalAmount > poTotal) {
        throw new Error(
          `Debit note total (₹${totalAmount.toFixed(2)}) would exceed PO amount. ` +
            `PO total: ₹${poTotal}, existing debit notes: ₹${existingTotal.toFixed(2)}, ` +
            `remaining allowance: ₹${(poTotal - existingTotal).toFixed(2)}`
        );
      }
    }

    // Create inside a transaction
    return prisma.$transaction(async (tx) => {
      const debitNote = await tx.debit_notes.create({
        data: {
          debitNoteNumber,
          poId: data.poId || null,
          supplierId: data.supplierId,
          debitNoteDate: data.debitNoteDate ? new Date(data.debitNoteDate) : new Date(),
          reason: data.reason,
          subtotal,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          totalTax,
          totalAmount,
          isInterstate,
          status: 'DRAFT',
          remarks: data.remarks || null,
          createdById: userId,
          items: {
            create: itemsWithGST.map((item) => ({
              poItemId: item.poItemId || null,
              description: item.description,
              hsnCode: item.hsnCode || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.lineTotal,
              gstRate: item.gstResult.gstRate,
              cgstAmount: item.gstResult.cgstAmount,
              sgstAmount: item.gstResult.sgstAmount,
              igstAmount: item.gstResult.igstAmount,
              taxAmount: item.gstResult.taxAmount,
            })),
          },
        },
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
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
      });

      return debitNote;
    });
  }

  /**
   * Get all debit notes with pagination and filtering
   */
  async getAll(params: DebitNoteQueryParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      supplierId,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.debit_notesWhereInput = {};

    if (search) {
      where.OR = [
        { debitNoteNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (fromDate || toDate) {
      where.debitNoteDate = {};
      if (fromDate) {
        where.debitNoteDate.gte = new Date(fromDate);
      }
      if (toDate) {
        where.debitNoteDate.lte = new Date(toDate);
      }
    }

    const [data, total] = await Promise.all([
      prisma.debit_notes.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
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
      prisma.debit_notes.count({ where }),
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
   * Get debit note by ID with all relations
   */
  async getById(id: string) {
    return prisma.debit_notes.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            poDate: true,
            status: true,
          },
        },
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
   * Approve a debit note (only if DRAFT)
   */
  async approve(id: string) {
    const debitNote = await prisma.debit_notes.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!debitNote) {
      throw new NotFoundError('Debit note');
    }

    if (debitNote.status !== 'DRAFT') {
      throw new BusinessError('Only DRAFT debit notes can be approved');
    }

    return prisma.debit_notes.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
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
    });
  }

  /**
   * Cancel a debit note (only if DRAFT)
   */
  async cancel(id: string) {
    const debitNote = await prisma.debit_notes.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!debitNote) {
      throw new NotFoundError('Debit note');
    }

    if (debitNote.status !== 'DRAFT') {
      throw new BusinessError('Only DRAFT debit notes can be cancelled');
    }

    return prisma.debit_notes.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
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
    });
  }

  /**
   * Delete a debit note (only if DRAFT)
   */
  async delete(id: string) {
    const debitNote = await prisma.debit_notes.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!debitNote) {
      throw new NotFoundError('Debit note');
    }

    if (debitNote.status !== 'DRAFT') {
      throw new BusinessError('Only DRAFT debit notes can be deleted');
    }

    // Items are cascade-deleted via the relation
    return prisma.debit_notes.delete({
      where: { id },
    });
  }
}

export const debitNoteService = new DebitNoteService();
