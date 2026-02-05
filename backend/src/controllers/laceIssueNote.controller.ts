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

/**
 * POST /api/lace-issue-notes
 * Create a new lace issue note (issue to production)
 */
export async function createIssueNote(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      orderId,
      styleId,
      cuttingBatchId,
      stockId,
      laceId,
      issuedQuantity,
      notes,
    } = req.body;

    if (!orderId || !styleId || !stockId || !laceId || issuedQuantity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, styleId, stockId, laceId, issuedQuantity',
      });
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

    res.status(201).json(serialize({
      success: true,
      data: issueNote,
      message: 'Lace issued to production successfully',
    }));
  } catch (error: any) {
    console.error('Error creating lace issue note:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create issue note',
    });
  }
}

/**
 * POST /api/lace-issue-notes/:id/consume
 * Record lace consumption during production
 */
export async function recordConsumptionController(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { consumedQuantity, notes } = req.body;

    if (consumedQuantity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: consumedQuantity',
      });
    }

    const issueNote = await recordConsumption({
      issueNoteId: id,
      consumedQuantity: parseFloat(consumedQuantity),
      notes,
      performedById: userId,
    });

    res.json(serialize({
      success: true,
      data: issueNote,
      message: 'Consumption recorded successfully',
    }));
  } catch (error: any) {
    console.error('Error recording consumption:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to record consumption',
    });
  }
}

/**
 * POST /api/lace-issue-notes/:id/return
 * Return unused lace to stock
 */
export async function returnToStockController(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { returnQuantity, notes } = req.body;

    if (returnQuantity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: returnQuantity',
      });
    }

    const issueNote = await returnToStock({
      issueNoteId: id,
      returnQuantity: parseFloat(returnQuantity),
      notes,
      performedById: userId,
    });

    res.json(serialize({
      success: true,
      data: issueNote,
      message: 'Material returned to stock successfully',
    }));
  } catch (error: any) {
    console.error('Error returning to stock:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to return to stock',
    });
  }
}

/**
 * POST /api/lace-issue-notes/:id/close
 * Close an issue note (finalize)
 */
export async function closeIssueNoteController(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;

    const issueNote = await closeIssueNote(id, userId);

    res.json(serialize({
      success: true,
      data: issueNote,
      message: 'Issue note closed successfully',
    }));
  } catch (error: any) {
    console.error('Error closing issue note:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to close issue note',
    });
  }
}

/**
 * GET /api/lace-issue-notes/:id
 * Get issue note by ID
 */
export async function getIssueNoteByIdController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const issueNote = await getIssueNoteById(id);

    if (!issueNote) {
      return res.status(404).json({
        success: false,
        error: 'Issue note not found',
      });
    }

    res.json(serialize({
      success: true,
      data: issueNote,
    }));
  } catch (error: any) {
    console.error('Error fetching issue note:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch issue note',
    });
  }
}

/**
 * GET /api/lace-issue-notes
 * Get issue notes with filters and pagination
 */
export async function getIssueNotesController(req: Request, res: Response) {
  try {
    const {
      orderId,
      styleId,
      stockId,
      laceId,
      status,
      search,
      page,
      limit,
    } = req.query;

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

    res.json(serialize({
      success: true,
      ...result,
    }));
  } catch (error: any) {
    console.error('Error fetching issue notes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch issue notes',
    });
  }
}

/**
 * GET /api/lace-issue-notes/order/:orderId
 * Get issue notes for an order
 */
export async function getIssueNotesByOrderController(req: Request, res: Response) {
  try {
    const { orderId } = req.params;

    const issueNotes = await getIssueNotesByOrder(orderId);

    res.json(serialize({
      success: true,
      data: issueNotes,
    }));
  } catch (error: any) {
    console.error('Error fetching issue notes for order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch issue notes for order',
    });
  }
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
