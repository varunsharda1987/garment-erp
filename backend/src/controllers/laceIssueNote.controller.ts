/**
 * Lace Issue Note Controller
 *
 * API endpoints for issuing lace to production floor:
 * - Create issue notes
 * - Record consumption
 * - Return unused materials
 */

import { Request, Response } from 'express';
import {
  createLaceIssueNote,
  recordConsumption,
  returnToStock,
  closeIssueNote,
  getIssueNoteById,
  getIssueNotes,
  getIssueNotesByOrder,
} from '../services/laceIssueNote.service';
import { serialize } from '../utils/serializer';
import { NotFoundError, ValidationError } from '../errors';

/**
 * POST /api/lace-issue-notes
 * Create a new lace issue note (issue to production)
 */
export async function createIssueNote(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { orderId, styleId, cuttingBatchId, stockId, laceId, issuedQuantity, notes } = req.body;

  if (!orderId || !styleId || !stockId || !laceId || issuedQuantity === undefined) {
    throw new ValidationError('Missing required fields: orderId, styleId, stockId, laceId, issuedQuantity');
  }

  const issueNote = await createLaceIssueNote({
    orderId,
    styleId,
    cuttingBatchId,
    stockId,
    laceId,
    issuedQuantity: parseFloat(issuedQuantity),
    notes,
    issuedById: userId,
  });

  res.status(201).json(
    serialize({
      success: true,
      data: issueNote,
      message: 'Lace issued to production successfully',
    })
  );
}

/**
 * POST /api/lace-issue-notes/:id/consume
 * Record lace consumption during production
 */
export async function recordConsumptionController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { id } = req.params;
  const { consumedQuantity, notes } = req.body;

  if (consumedQuantity === undefined) {
    throw new ValidationError('Missing required field: consumedQuantity');
  }

  const issueNote = await recordConsumption({
    issueNoteId: id,
    consumedQuantity: parseFloat(consumedQuantity),
    notes,
    performedById: userId,
  });

  res.json(
    serialize({
      success: true,
      data: issueNote,
      message: 'Consumption recorded successfully',
    })
  );
}

/**
 * POST /api/lace-issue-notes/:id/return
 * Return unused lace to stock
 */
export async function returnToStockController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { id } = req.params;
  const { returnQuantity, notes } = req.body;

  if (returnQuantity === undefined) {
    throw new ValidationError('Missing required field: returnQuantity');
  }

  const issueNote = await returnToStock({
    issueNoteId: id,
    returnQuantity: parseFloat(returnQuantity),
    notes,
    performedById: userId,
  });

  res.json(
    serialize({
      success: true,
      data: issueNote,
      message: 'Material returned to stock successfully',
    })
  );
}

/**
 * POST /api/lace-issue-notes/:id/close
 * Close an issue note (finalize)
 */
export async function closeIssueNoteController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { id } = req.params;

  const issueNote = await closeIssueNote(id, userId);

  res.json(
    serialize({
      success: true,
      data: issueNote,
      message: 'Issue note closed successfully',
    })
  );
}

/**
 * GET /api/lace-issue-notes/:id
 * Get issue note by ID
 */
export async function getIssueNoteByIdController(req: Request, res: Response) {
  const { id } = req.params;

  const issueNote = await getIssueNoteById(id);

  if (!issueNote) {
    throw new NotFoundError('Issue note', id);
  }

  res.json(
    serialize({
      success: true,
      data: issueNote,
    })
  );
}

/**
 * GET /api/lace-issue-notes
 * Get issue notes with filters and pagination
 */
export async function getIssueNotesController(req: Request, res: Response) {
  const { orderId, styleId, stockId, laceId, status, search, page, limit } = req.query;

  const result = await getIssueNotes({
    orderId: orderId as string,
    styleId: styleId as string,
    stockId: stockId as string,
    laceId: laceId as string,
    status: status as string,
    search: search as string,
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
  });

  res.json(
    serialize({
      success: true,
      ...result,
    })
  );
}

/**
 * GET /api/lace-issue-notes/order/:orderId
 * Get issue notes for an order
 */
export async function getIssueNotesByOrderController(req: Request, res: Response) {
  const { orderId } = req.params;

  const issueNotes = await getIssueNotesByOrder(orderId);

  res.json(
    serialize({
      success: true,
      data: issueNotes,
    })
  );
}

export default {
  createIssueNote,
  recordConsumptionController,
  returnToStockController,
  closeIssueNoteController,
  getIssueNoteByIdController,
  getIssueNotesController,
  getIssueNotesByOrderController,
};
