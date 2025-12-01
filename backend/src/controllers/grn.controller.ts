/**
 * GRN (Goods Receiving Notes) Controller
 * RESTful API endpoints for goods receiving management
 */

import { Request, Response } from 'express';
import { grnService } from '../services/grn.service';
import { GRNStatus } from '@prisma/client';
import { logInfo, logError } from '../utils/logger';
import { CreateGRNDTO, GRNFilters } from '../types/grn.types';

/**
 * @route GET /api/grn
 * @desc Get all GRNs with filters and pagination
 * @access Private
 */
export const getAllGRNs = async (req: Request, res: Response) => {
  try {
    const {
      poId,
      supplierId,
      status,
      search,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const filters: GRNFilters = {
      poId: poId as string | undefined,
      supplierId: supplierId as string | undefined,
      status: status as GRNStatus | undefined,
      search: search as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    };

    const result = await grnService.getAllGRNs(filters);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    logError('Get all GRNs error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch GRNs',
    });
  }
};

/**
 * @route GET /api/grn/:id
 * @desc Get GRN by ID
 * @access Private
 */
export const getGRNById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const grn = await grnService.getGRNById(id);

    res.json({
      success: true,
      data: grn,
    });
  } catch (error: unknown) {
    logError('Get GRN by ID error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch GRN';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route GET /api/grn/po/:poId
 * @desc Get all GRNs for a specific PO
 * @access Private
 */
export const getGRNsByPO = async (req: Request, res: Response) => {
  try {
    const { poId } = req.params;

    const grns = await grnService.getGRNsByPO(poId);

    res.json({
      success: true,
      data: grns,
      count: grns.length,
    });
  } catch (error: unknown) {
    logError('Get GRNs by PO error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch GRNs',
    });
  }
};

/**
 * @route GET /api/grn/po/:poId/pending
 * @desc Get pending items for a PO (for GRN creation)
 * @access Private
 */
export const getPendingItemsForPO = async (req: Request, res: Response) => {
  try {
    const { poId } = req.params;

    const pendingItems = await grnService.getPendingItemsForPO(poId);

    res.json({
      success: true,
      data: pendingItems,
    });
  } catch (error: unknown) {
    logError('Get pending items for PO error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pending items';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route GET /api/grn/po/:poId/summary
 * @desc Get receiving summary by warehouse for a PO
 * @access Private
 */
export const getReceivingSummaryByPO = async (req: Request, res: Response) => {
  try {
    const { poId } = req.params;

    const summary = await grnService.getReceivingSummaryByPO(poId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    logError('Get receiving summary error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch receiving summary',
    });
  }
};

/**
 * @route POST /api/grn
 * @desc Create a new GRN
 * @access Private (WAREHOUSE, PURCHASE, ADMIN)
 */
export const createGRN = async (req: Request, res: Response) => {
  try {
    const data: CreateGRNDTO = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!data.poId) {
      return res.status(400).json({
        success: false,
        message: 'Purchase Order ID is required',
      });
    }

    if (!data.items || data.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required',
      });
    }

    // Validate items have required fields
    for (const item of data.items) {
      if (!item.poItemId) {
        return res.status(400).json({
          success: false,
          message: 'PO Item ID is required for all items',
        });
      }
      if (!item.materialId) {
        return res.status(400).json({
          success: false,
          message: 'Material ID is required for all items',
        });
      }
      if (item.receivedQuantity === undefined || item.receivedQuantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Received quantity must be 0 or greater',
        });
      }
    }

    const grn = await grnService.createGRN(data, userId);

    logInfo(`GRN created: ${grn.grnNumber}`);

    res.status(201).json({
      success: true,
      data: grn,
      message: 'GRN created successfully',
    });
  } catch (error: unknown) {
    logError('Create GRN error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create GRN';
    const statusCode = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot receive') || errorMessage.includes('must equal')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route PATCH /api/grn/:id/approve
 * @desc Approve a GRN (PENDING_QC -> ACCEPTED)
 * @access Private (QC, ADMIN)
 */
export const approveGRN = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const grn = await grnService.approveGRN(id, userId);

    logInfo(`GRN approved: ${grn.grnNumber}`);

    res.json({
      success: true,
      data: grn,
      message: 'GRN approved successfully',
    });
  } catch (error: unknown) {
    logError('Approve GRN error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to approve GRN';
    const statusCode = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot approve')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route PATCH /api/grn/:id/reject
 * @desc Reject a GRN (PENDING_QC -> REJECTED)
 * @access Private (QC, ADMIN)
 */
export const rejectGRN = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const grn = await grnService.rejectGRN(id, userId, reason);

    logInfo(`GRN rejected: ${grn.grnNumber}`);

    res.json({
      success: true,
      data: grn,
      message: 'GRN rejected successfully',
    });
  } catch (error: unknown) {
    logError('Reject GRN error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reject GRN';
    const statusCode = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot reject')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};
