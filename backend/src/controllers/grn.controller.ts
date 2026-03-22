/**
 * GRN (Goods Receiving Notes) Controller
 * RESTful API endpoints for goods receiving management
 */

import { Request, Response } from 'express';
import { grnService } from '../services/grn.service';
import { GRNStatus } from '@prisma/client';
import { logInfo, logError } from '../utils/logger';
import { CreateGRNDTO, GRNFilters, ProcessingQCData } from '../types/grn.types';
import { NotFoundError, ValidationError } from '../errors';
import { updateCostSheetActuals } from '../services/costSheet.service';
import prisma from '../config/database';  // Use singleton to avoid connection pool leak

/**
 * @route GET /api/grn
 * @desc Get all GRNs with filters and pagination
 * @access Private
 */
export const getAllGRNs = async (req: Request, res: Response) => {
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
};

/**
 * @route GET /api/grn/:id
 * @desc Get GRN by ID
 * @access Private
 */
export const getGRNById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const grn = await grnService.getGRNById(id);

  res.json({
    success: true,
    data: grn,
  });
};

/**
 * @route GET /api/grn/po/:poId
 * @desc Get all GRNs for a specific PO
 * @access Private
 */
export const getGRNsByPO = async (req: Request, res: Response) => {
  const { poId } = req.params;

  const grns = await grnService.getGRNsByPO(poId);

  res.json({
    success: true,
    data: grns,
    count: grns.length,
  });
};

/**
 * @route GET /api/grn/po/:poId/pending
 * @desc Get pending items for a PO (for GRN creation)
 * @access Private
 */
export const getPendingItemsForPO = async (req: Request, res: Response) => {
  const { poId } = req.params;

  const pendingItems = await grnService.getPendingItemsForPO(poId);

  res.json({
    success: true,
    data: pendingItems,
  });
};

/**
 * @route GET /api/grn/po/:poId/summary
 * @desc Get receiving summary by warehouse for a PO
 * @access Private
 */
export const getReceivingSummaryByPO = async (req: Request, res: Response) => {
  const { poId } = req.params;

  const summary = await grnService.getReceivingSummaryByPO(poId);

  res.json({
    success: true,
    data: summary,
  });
};

/**
 * @route POST /api/grn
 * @desc Create a new GRN
 * @access Private (WAREHOUSE, PURCHASE, ADMIN)
 */
export const createGRN = async (req: Request, res: Response) => {
  const data: CreateGRNDTO = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  if (!data.poId) {
    throw new ValidationError('Purchase Order ID is required');
  }

  if (!data.items || data.items.length === 0) {
    throw new ValidationError('At least one item is required');
  }

  // Validate items have required fields
  for (const item of data.items) {
    if (!item.poItemId) {
      throw new ValidationError('PO Item ID is required for all items');
    }
    if (!item.materialId) {
      throw new ValidationError('Material ID is required for all items');
    }
    if (item.receivedQuantity === undefined || item.receivedQuantity < 0) {
      throw new ValidationError('Received quantity must be 0 or greater');
    }
  }

  const grn = await grnService.createGRN(data, userId);

  logInfo(`GRN created: ${grn.grnNumber}`);

  res.status(201).json({
    success: true,
    data: grn,
    message: 'GRN created successfully',
  });
};

/**
 * @route PATCH /api/grn/:id/approve
 * @desc Approve a GRN (PENDING_QC -> ACCEPTED) and create stock movements
 * @access Private (QC, ADMIN)
 */
export const approveGRN = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { warehouseId, processingQC } = req.body; // Optional - can be provided if not set on GRN
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const grn = await grnService.approveGRN(id, userId, warehouseId, processingQC as ProcessingQCData | undefined);

  logInfo(`GRN approved: ${grn.grnNumber} - Stock movements created`);

  // ==========================================
  // PHASE 2C: Auto-update cost sheet actuals from GRN
  // ==========================================
  try {
    // Fetch GRN with items and trace back to styleId
    const grnWithItems = await prisma.goods_receiving_notes.findUnique({
      where: { id },
      include: {
        grn_items: {
          include: {
            purchase_order_items: {
              include: {
                requirement_po_links: {
                  include: {
                    material_requirements: {
                      include: {
                        order_items: {
                          select: {
                            styleId: true,
                          },
                        },
                        materials: {
                          select: {
                            materialType: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (grnWithItems) {
      // Group items by styleId and calculate actual costs
      const styleActuals: Record<string, { fabric: number; trims: number; lace: number }> = {};

      for (const grnItem of grnWithItems.grn_items) {
        // unitPrice is on purchase_order_items, not grn_items
        const unitPrice = Number(grnItem.purchase_order_items?.unitPrice || 0);
        const receivedQty = Number(grnItem.receivedQuantity);
        const actualCost = unitPrice * receivedQty;

        // Trace back to styleId through requirement_po_links
        for (const link of grnItem.purchase_order_items?.requirement_po_links || []) {
          const requirement = link.material_requirements;
          const styleId = requirement.order_items?.styleId;
          const materialType = requirement.materials.materialType;

          if (styleId) {
            if (!styleActuals[styleId]) {
              styleActuals[styleId] = { fabric: 0, trims: 0, lace: 0 };
            }

            // Categorize as FABRIC, LACE, or TRIMS based on material type
            if (materialType === 'GREIGE' || materialType === 'FINISHED_FABRIC') {
              styleActuals[styleId].fabric += actualCost;
            } else if (materialType === 'LACE') {
              styleActuals[styleId].lace += actualCost;
            } else {
              styleActuals[styleId].trims += actualCost;
            }
          }
        }
      }

      // Update cost sheet actuals for each style
      for (const [styleId, actuals] of Object.entries(styleActuals)) {
        if (actuals.fabric > 0) {
          await updateCostSheetActuals({
            styleId,
            category: 'FABRIC',
            actualCost: actuals.fabric,
            source: 'GRN',
          });
          logInfo(`Updated fabric actual for style ${styleId}: ${actuals.fabric}`, {
            source: 'GRN',
            grnNumber: grn.grnNumber,
          });
        }

        if (actuals.trims > 0) {
          await updateCostSheetActuals({
            styleId,
            category: 'TRIMS',
            actualCost: actuals.trims,
            source: 'GRN',
          });
          logInfo(`Updated trims actual for style ${styleId}: ${actuals.trims}`, {
            source: 'GRN',
            grnNumber: grn.grnNumber,
          });
        }

        if (actuals.lace > 0) {
          await updateCostSheetActuals({
            styleId,
            category: 'LACE',
            actualCost: actuals.lace,
            source: 'GRN',
          });
          logInfo(`Updated lace actual for style ${styleId}: ${actuals.lace}`, {
            source: 'GRN',
            grnNumber: grn.grnNumber,
          });
        }
      }
    }
  } catch (error) {
    // Log error but don't fail the GRN approval
    logError('Failed to auto-update cost sheet actuals from GRN', error);
  }
  // ==========================================

  res.json({
    success: true,
    data: grn,
    message: 'GRN approved successfully. Stock levels updated.',
  });
};

/**
 * @route GET /api/grn/po/:poId/processing-context
 * @desc Get processing context for a PROCESSING PO (for GRN form)
 * @access Private
 */
export const getProcessingContext = async (req: Request, res: Response) => {
  const { poId } = req.params;
  const context = await grnService.getProcessingContext(poId);
  res.json({ success: true, data: context });
};

/**
 * @route PATCH /api/grn/:id/reject
 * @desc Reject a GRN (PENDING_QC -> REJECTED)
 * @access Private (QC, ADMIN)
 */
export const rejectGRN = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  if (!reason) {
    throw new ValidationError('Rejection reason is required');
  }

  const grn = await grnService.rejectGRN(id, userId, reason);

  logInfo(`GRN rejected: ${grn.grnNumber}`);

  res.json({
    success: true,
    data: grn,
    message: 'GRN rejected successfully',
  });
};
