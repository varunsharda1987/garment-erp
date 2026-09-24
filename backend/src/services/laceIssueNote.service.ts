/**
 * Lace Issue Note Service
 *
 * Business logic for issuing lace materials to production floor:
 * - Create issue notes (allocate from stock)
 * - Record consumption during production
 * - Return unused materials to stock
 */

import prisma from '../config/database';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';
import { logInfo, logError, logDebug } from '../utils/logger';
import { syncStockLevelQuantity } from './helpers/material-sync.helper';
import { applySearch } from '../utils/search-filter';
import { qtyExceeds, qtyRemaining, isQtyZero, snapToLimit } from '../utils/quantity';

// ============================================
// Types
// ============================================

export interface CreateLaceIssueNoteInput {
  orderId: string;
  styleId: string;
  cuttingBatchId?: string;
  stockId: string;
  laceId: string;
  issuedQuantity: number;
  notes?: string;
  issuedById: string;
}

export interface RecordConsumptionInput {
  issueNoteId: string;
  consumedQuantity: number;
  notes?: string;
  performedById: string;
}

export interface ReturnToStockInput {
  issueNoteId: string;
  returnQuantity: number;
  notes?: string;
  performedById: string;
}

export interface LaceIssueNoteFilters {
  orderId?: string;
  styleId?: string;
  stockId?: string;
  laceId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================
// Service Functions
// ============================================

/**
 * Generate unique issue note number (LIS2607-0001) — atomic monthly series.
 */
async function generateIssueNumber(): Promise<string> {
  return generateAtomicDocNumber('LIS');
}

/**
 * Create a lace issue note (issue lace to production floor)
 */
export async function createLaceIssueNote(input: CreateLaceIssueNoteInput) {
  logDebug('Creating lace issue note', { orderId: input.orderId, stockId: input.stockId });

  const issueNumber = await generateIssueNumber();

  // Create issue note and update stock in transaction (atomic check-and-update)
  const result = await prisma.$transaction(async (tx) => {
    // Validate stock exists and has sufficient quantity - INSIDE transaction to prevent race condition
    const stock = await tx.lace_stock.findUnique({
      where: { id: input.stockId },
      include: { laceMaster: true },
    });

    if (!stock) {
      throw new Error('Lace stock not found');
    }

    if (stock.status !== 'AVAILABLE') {
      throw new Error(`Stock is not available (status: ${stock.status})`);
    }

    const available = Number(stock.quantityAvailable) - Number(stock.quantityReserved);
    // Quantity rule (utils/quantity): issuing the whole lot typed at 2 decimals is issuing the lot.
    if (qtyExceeds(input.issuedQuantity, available)) {
      throw new Error(`Insufficient stock available. Required: ${input.issuedQuantity}, Available: ${available}`);
    }
    const issuedQty = snapToLimit(input.issuedQuantity, available);

    // Create issue note
    const issueNote = await tx.lace_issue_note.create({
      data: {
        issueNumber,
        orderId: input.orderId,
        styleId: input.styleId,
        cuttingBatchId: input.cuttingBatchId,
        stockId: input.stockId,
        laceId: input.laceId,
        issuedQuantity: issuedQty,
        consumedQuantity: 0,
        returnedQuantity: 0,
        status: 'ISSUED',
        notes: input.notes,
        issuedById: input.issuedById,
      },
      include: {
        stock: {
          include: { laceMaster: true },
        },
        order: { select: { id: true, orderNumber: true } },
        style: { select: { id: true, styleCode: true, styleName: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Update stock - move from available to reserved/consumed
    await tx.lace_stock.update({
      where: { id: input.stockId },
      data: {
        quantityAvailable: { decrement: issuedQty },
        quantityReserved: { increment: issuedQty },
      },
    });

    // Create stock transaction
    const newBalance = Number(stock.quantityAvailable) - issuedQty;
    await tx.lace_stock_transaction.create({
      data: {
        stockId: input.stockId,
        transactionType: 'ISSUE',
        quantity: -issuedQty,
        balanceAfter: newBalance,
        referenceType: 'ISSUE_NOTE',
        referenceId: issueNote.id,
        notes: `Issued to Order: ${input.orderId}, Style: ${input.styleId}`,
        transactionDate: new Date(),
        performedById: input.issuedById,
      },
    });

    return issueNote;
  });

  logInfo('Lace issue note created', {
    issueNumber,
    stockId: input.stockId,
    issuedQuantity: input.issuedQuantity,
  });

  return result;
}

/**
 * Record lace consumption during production
 */
export async function recordConsumption(input: RecordConsumptionInput) {
  logDebug('Recording lace consumption', {
    issueNoteId: input.issueNoteId,
    consumedQuantity: input.consumedQuantity,
  });

  const issueNote = await prisma.lace_issue_note.findUnique({
    where: { id: input.issueNoteId },
  });

  if (!issueNote) {
    throw new Error('Issue note not found');
  }

  if (issueNote.status === 'CLOSED') {
    throw new Error('Issue note is already closed');
  }

  const currentConsumed = Number(issueNote.consumedQuantity);
  const currentReturned = Number(issueNote.returnedQuantity);
  const issued = Number(issueNote.issuedQuantity);
  // Quantity rule (utils/quantity): consuming everything left, typed at 2 decimals, is consuming
  // everything left — snap it so no dust stays on the note.
  const unaccounted = qtyRemaining(issued, currentConsumed + currentReturned);
  if (qtyExceeds(input.consumedQuantity, unaccounted)) {
    throw new Error(
      `Cannot consume more than issued. Issued: ${issued}, Already consumed: ${currentConsumed}, Already returned: ${currentReturned}`
    );
  }
  const consumedQty = snapToLimit(input.consumedQuantity, unaccounted);
  const newConsumed = currentConsumed + consumedQty;

  // Update issue note and stock
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.lace_issue_note.update({
      where: { id: input.issueNoteId },
      data: {
        consumedQuantity: newConsumed,
        notes: input.notes ? `${issueNote.notes || ''}\n[Consumption] ${input.notes}` : issueNote.notes,
      },
      include: {
        stock: { include: { laceMaster: true } },
        order: { select: { id: true, orderNumber: true } },
        style: { select: { id: true, styleCode: true, styleName: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Update stock - move from reserved to consumed
    await tx.lace_stock.update({
      where: { id: issueNote.stockId },
      data: {
        quantityReserved: { decrement: consumedQty },
        quantityConsumed: { increment: consumedQty },
      },
    });

    // BUG-INV3 fix: find materials.id instead of using laceId directly
    if (updated.stock.laceId) {
      const material = await tx.materials.findFirst({
        where: { laceId: updated.stock.laceId },
        select: { id: true },
      });
      if (material) {
        await syncStockLevelQuantity(material.id, -consumedQty, updated.stock.warehouseId ?? undefined, 'METER', tx);
      }
    }

    // Create transaction record
    await tx.lace_stock_transaction.create({
      data: {
        stockId: issueNote.stockId,
        transactionType: 'CONSUMPTION',
        quantity: -consumedQty,
        balanceAfter: 0, // Will be calculated
        referenceType: 'ISSUE_NOTE',
        referenceId: issueNote.id,
        notes: `Consumed in production. Issue: ${issueNote.issueNumber}`,
        transactionDate: new Date(),
        performedById: input.performedById,
      },
    });

    return updated;
  });

  logInfo('Lace consumption recorded', {
    issueNumber: result.issueNumber,
    consumedQuantity: input.consumedQuantity,
    totalConsumed: newConsumed,
  });

  return result;
}

/**
 * Return unused lace to stock
 */
export async function returnToStock(input: ReturnToStockInput) {
  logDebug('Returning lace to stock', {
    issueNoteId: input.issueNoteId,
    returnQuantity: input.returnQuantity,
  });

  const issueNote = await prisma.lace_issue_note.findUnique({
    where: { id: input.issueNoteId },
  });

  if (!issueNote) {
    throw new Error('Issue note not found');
  }

  if (issueNote.status === 'CLOSED') {
    throw new Error('Issue note is already closed');
  }

  const currentConsumed = Number(issueNote.consumedQuantity);
  const currentReturned = Number(issueNote.returnedQuantity);
  const issued = Number(issueNote.issuedQuantity);
  // Quantity rule (utils/quantity): returning everything left, typed at 2 decimals, returns everything
  // left and closes the note — float sums must not leave it PARTIALLY_RETURNED for 2 mm.
  const unaccounted = qtyRemaining(issued, currentConsumed + currentReturned);
  if (qtyExceeds(input.returnQuantity, unaccounted)) {
    throw new Error(
      `Cannot return more than remaining. Issued: ${issued}, Consumed: ${currentConsumed}, Already returned: ${currentReturned}`
    );
  }
  const returnQty = snapToLimit(input.returnQuantity, unaccounted);
  const newReturned = currentReturned + returnQty;

  // Determine new status
  const remaining = qtyRemaining(unaccounted, returnQty);
  const newStatus = isQtyZero(remaining) ? 'CLOSED' : 'PARTIALLY_RETURNED';

  // Update issue note and stock
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.lace_issue_note.update({
      where: { id: input.issueNoteId },
      data: {
        returnedQuantity: newReturned,
        status: newStatus,
        returnedAt: new Date(),
        notes: input.notes ? `${issueNote.notes || ''}\n[Return] ${input.notes}` : issueNote.notes,
      },
      include: {
        stock: { include: { laceMaster: true } },
        order: { select: { id: true, orderNumber: true } },
        style: { select: { id: true, styleCode: true, styleName: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Update stock - return from reserved to available
    await tx.lace_stock.update({
      where: { id: issueNote.stockId },
      data: {
        quantityReserved: { decrement: returnQty },
        quantityAvailable: { increment: returnQty },
      },
    });

    // Create transaction record
    await tx.lace_stock_transaction.create({
      data: {
        stockId: issueNote.stockId,
        transactionType: 'RETURN',
        quantity: returnQty,
        balanceAfter: 0, // Will be calculated
        referenceType: 'ISSUE_NOTE',
        referenceId: issueNote.id,
        notes: `Returned from production. Issue: ${issueNote.issueNumber}`,
        transactionDate: new Date(),
        performedById: input.performedById,
      },
    });

    return updated;
  });

  logInfo('Lace returned to stock', {
    issueNumber: result.issueNumber,
    returnedQuantity: input.returnQuantity,
    totalReturned: newReturned,
    newStatus,
  });

  return result;
}

/**
 * Close an issue note (finalize - all material accounted for)
 */
export async function closeIssueNote(issueNoteId: string, userId: string) {
  const issueNote = await prisma.lace_issue_note.findUnique({
    where: { id: issueNoteId },
  });

  if (!issueNote) {
    throw new Error('Issue note not found');
  }

  if (issueNote.status === 'CLOSED') {
    throw new Error('Issue note is already closed');
  }

  const consumed = Number(issueNote.consumedQuantity);
  const returned = Number(issueNote.returnedQuantity);
  const issued = Number(issueNote.issuedQuantity);
  // Snapped to 0 within rounding dust (utils/quantity).
  const remaining = qtyRemaining(issued, consumed + returned);

  if (remaining > 0) {
    throw new Error(
      `Cannot close: ${remaining} units still unaccounted for. Please record consumption or return first.`
    );
  }

  const updated = await prisma.lace_issue_note.update({
    where: { id: issueNoteId },
    data: {
      status: 'CLOSED',
    },
    include: {
      stock: { include: { laceMaster: true } },
      order: { select: { id: true, orderNumber: true } },
      style: { select: { id: true, styleCode: true, styleName: true } },
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  logInfo('Lace issue note closed', { issueNumber: updated.issueNumber });

  return updated;
}

/**
 * Get issue note by ID
 */
export async function getIssueNoteById(id: string) {
  const issueNote = await prisma.lace_issue_note.findUnique({
    where: { id },
    include: {
      stock: { include: { laceMaster: true } },
      order: { select: { id: true, orderNumber: true } },
      style: { select: { id: true, styleCode: true, styleName: true } },
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return issueNote;
}

/**
 * Get issue notes with filters and pagination
 */
export async function getIssueNotes(filters: LaceIssueNoteFilters) {
  const { orderId, styleId, stockId, laceId, status, search, page = 1, limit = 20 } = filters;

  const where: any = {};

  if (orderId) where.orderId = orderId;
  if (styleId) where.styleId = styleId;
  if (stockId) where.stockId = stockId;
  if (laceId) where.laceId = laceId;
  if (status) where.status = status;

  if (search) {
    applySearch(where, search, ['issueNumber', 'order.orderNumber', 'style.styleCode', 'style.buyerStyleRef']);
  }

  const [issueNotes, total] = await Promise.all([
    prisma.lace_issue_note.findMany({
      where,
      include: {
        stock: { include: { laceMaster: true } },
        order: { select: { id: true, orderNumber: true } },
        style: { select: { id: true, styleCode: true, styleName: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { issuedAt: 'desc' },
    }),
    prisma.lace_issue_note.count({ where }),
  ]);

  return {
    data: issueNotes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get issue notes for an order
 */
export async function getIssueNotesByOrder(orderId: string) {
  const issueNotes = await prisma.lace_issue_note.findMany({
    where: { orderId },
    include: {
      stock: { include: { laceMaster: true } },
      style: { select: { id: true, styleCode: true, styleName: true } },
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { issuedAt: 'desc' },
  });

  return issueNotes;
}

export default {
  createLaceIssueNote,
  recordConsumption,
  returnToStock,
  closeIssueNote,
  getIssueNoteById,
  getIssueNotes,
  getIssueNotesByOrder,
};
