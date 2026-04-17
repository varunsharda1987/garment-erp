import prisma from '../config/database';
import { Prisma, DebitNoteReason, DocumentStatus } from '@prisma/client';
import { gstService } from './gst.service';
import { NotFoundError, ValidationError, BusinessError } from '../errors';

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
   * Generate next debit note number (DN-001, DN-002, etc.)
   */
  private async generateDebitNoteNumber(): Promise<string> {
    const lastNote = await prisma.debit_notes.findFirst({
      where: {
        debitNoteNumber: {
          startsWith: 'DN-',
        },
      },
      orderBy: {
        debitNoteNumber: 'desc',
      },
      select: {
        debitNoteNumber: true,
      },
    });

    if (!lastNote) {
      return 'DN-001';
    }

    const lastNumber = parseInt(lastNote.debitNoteNumber.replace('DN-', ''), 10);
    const nextNumber = lastNumber + 1;
    return `DN-${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Create a new debit note with items and GST calculation
   */
  async create(data: DebitNoteCreateInput, userId: string) {
    if (!data.items || data.items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    // Determine interstate status
    let isInterstate = false;
    if (data.poId) {
      const result = await gstService.isInterstatePO(data.supplierId);
      isInterstate = result.isInterstate;
    }

    // Calculate GST for each item
    const itemsWithGST = await Promise.all(
      data.items.map(async (item) => {
        const lineTotal = item.quantity * item.unitPrice;
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

    // Calculate header totals
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalTax = 0;

    for (const item of itemsWithGST) {
      subtotal += item.lineTotal;
      totalCgst += item.gstResult.cgstAmount;
      totalSgst += item.gstResult.sgstAmount;
      totalIgst += item.gstResult.igstAmount;
      totalTax += item.gstResult.taxAmount;
    }

    const totalAmount = subtotal + totalTax;
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
          subtotal: parseFloat(subtotal.toFixed(2)),
          cgstAmount: parseFloat(totalCgst.toFixed(2)),
          sgstAmount: parseFloat(totalSgst.toFixed(2)),
          igstAmount: parseFloat(totalIgst.toFixed(2)),
          totalTax: parseFloat(totalTax.toFixed(2)),
          totalAmount: parseFloat(totalAmount.toFixed(2)),
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
              totalPrice: parseFloat(item.lineTotal.toFixed(2)),
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
