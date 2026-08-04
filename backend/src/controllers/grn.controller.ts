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
import { systemSettingsService } from '../services/system-settings.service';
import prisma from '../config/database'; // Use singleton to avoid connection pool leak

/**
 * @route GET /api/grn
 * @desc Get all GRNs with filters and pagination
 * @access Private
 */
export const getAllGRNs = async (req: Request, res: Response) => {
  const { poId, supplierId, status, search, startDate, endDate, page, limit, sortBy, sortOrder } = req.query;

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

  const [pendingItems, tolerancePercent] = await Promise.all([
    grnService.getPendingItemsForPO(poId),
    systemSettingsService.getNumber('GRN_OVER_RECEIPT_TOLERANCE_PERCENT', 10),
  ]);

  res.json({
    success: true,
    data: pendingItems,
    tolerancePercent,
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
  // BUG-PROC4 fix: Enhanced post-commit error handling with structured context
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
            if (materialType === 'GREIGE' || materialType === 'FABRIC') {
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
        // BUG-PROC4 fix: Wrap each style update in its own try-catch to prevent one failure
        // from blocking others, and log structured data for potential retry
        try {
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
        } catch (styleError) {
          // BUG-PROC4 fix: Log structured error with full context for debugging/retry
          logError('Failed to update cost sheet actuals for style (post-commit)', styleError, {
            postCommitOperation: 'costSheetActuals',
            grnId: id,
            grnNumber: grn.grnNumber,
            styleId,
            pendingActuals: actuals,
            canRetry: true,
          });
        }
      }
    }
  } catch (error) {
    // BUG-PROC4 fix: Enhanced error logging with structured context
    logError('Failed to auto-update cost sheet actuals from GRN (post-commit)', error, {
      postCommitOperation: 'costSheetActuals',
      grnId: id,
      grnNumber: grn.grnNumber,
      phase: 'fetch',
      canRetry: true,
    });
  }
  // ==========================================

  // ==========================================
  // Check for pending cutting work orders that use the received fabrics
  // BUG-PROC4 fix: Enhanced post-commit error handling with structured context
  // ==========================================
  let pendingCuttingInfo: Array<{ workOrderNumber: string; workOrderId: string; pendingQty: number }> = [];
  try {
    // Get fabricIds from this GRN's items (via material → fabricId)
    const grnItems = await prisma.grn_items.findMany({
      where: { grnId: id },
      select: { materialId: true },
    });
    const materialIds = grnItems.map((gi) => gi.materialId).filter(Boolean) as string[];

    if (materialIds.length > 0) {
      const materials = await prisma.materials.findMany({
        where: { id: { in: materialIds }, fabricId: { not: null } },
        select: { fabricId: true },
      });
      const fabricIds = materials.map((m) => m.fabricId).filter(Boolean) as string[];

      if (fabricIds.length > 0) {
        // Find work orders that use these fabrics (via BOM items)
        const workOrders = await prisma.work_orders.findMany({
          where: {
            status: { in: ['PENDING', 'IN_PRODUCTION'] },
            orders: {
              orderBoms: {
                some: {
                  status: { in: ['APPROVED', 'LOCKED'] },
                  items: { some: { fabricId: { in: fabricIds } } },
                },
              },
            },
          },
          select: {
            id: true,
            workOrderNumber: true,
            totalQuantity: true,
            cutting_batches: {
              select: {
                skuOutputs: { select: { cutQty: true } },
              },
            },
          },
          take: 5, // Limit to avoid heavy queries
        });

        pendingCuttingInfo = workOrders
          .map((wo) => {
            const alreadyCut = wo.cutting_batches.reduce(
              (sum, b) => sum + b.skuOutputs.reduce((s, sku) => s + sku.cutQty, 0),
              0
            );
            const pendingQty = wo.totalQuantity - alreadyCut;
            return { workOrderNumber: wo.workOrderNumber, workOrderId: wo.id, pendingQty };
          })
          .filter((wo) => wo.pendingQty > 0);
      }
    }
  } catch (error) {
    // BUG-PROC4 fix: Enhanced error logging with structured context for debugging
    // This is informational (pendingCutting data enriches the response but is not critical)
    logError('Failed to check pending cutting work orders after GRN (post-commit)', error, {
      postCommitOperation: 'pendingCuttingCheck',
      grnId: id,
      grnNumber: grn.grnNumber,
      // Non-critical: failure just means the response won't include cutting suggestions
      severity: 'warning',
      canRetry: false,
    });
  }
  // ==========================================

  // BUG-PROC4 fix: Include warnings from post-commit operations in response
  const warnings = (grn as any)._warnings as string[] | undefined;

  res.json({
    success: true,
    data: grn,
    message: 'GRN approved successfully. Stock levels updated.',
    // BUG-PROC4 fix: Surface warnings so frontend can notify user of non-critical failures
    warnings: warnings?.length ? warnings : undefined,
    pendingCutting: pendingCuttingInfo.length > 0 ? pendingCuttingInfo : undefined,
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

// BUG-GRN6 fix: Comprehensive GRN reversal endpoint
/**
 * @route PATCH /api/grn/:id/reverse
 * @desc Reverse an accepted GRN (ACCEPTED -> REVERSED) - fully reverses all stock and transactions
 * @access Private (ADMIN)
 */
export const reverseGRN = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  if (!reason) {
    throw new ValidationError('Reversal reason is required');
  }

  const grn = await grnService.reverseGRN(id, userId, reason);

  logInfo(`GRN reversed: ${grn.grnNumber}`, {
    grnId: id,
    userId,
    reason,
  });

  res.json({
    success: true,
    data: grn,
    message: 'GRN reversed successfully. All stock movements and entries have been reversed.',
  });
};
