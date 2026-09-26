import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { logError, logInfo } from '../utils/logger';
import { calculateVariance } from '../services/costSheet.service';
import { UnauthorizedError, NotFoundError, ValidationError, BusinessError, ConflictError } from '../errors';
import { getCostSheetOrderDependents, consumerOrderNumbers } from '../services/helpers/cad-costing-provenance.helper';
import { copyCostSheetItemTables, createCostSheetVersionTx } from '../services/helpers/cost-sheet-version.helper';
import { onCostSheetApproved, onCostSheetRejected } from '../services/cad-correction.service';
import type { Prisma } from '@prisma/client';

// ============================================================================
// APPROVAL & VERSIONING OPERATIONS
// ============================================================================

// copyCostSheetItemTables + createCostSheetVersionTx live in services/helpers/cost-sheet-version.helper.ts

/**
 * Approve or reject cost sheet
 * PATCH /api/style-costing/:id/approve
 *
 * Uses new approval workflow with CostSheetApprovalStatus enum:
 * - PENDING: Initial state
 * - APPROVED: Admin approved - locked for editing
 * - REJECTED: Admin rejected with notes - can be revised and resubmitted
 *
 * Note: Only ADMIN can approve/reject (enforced in route middleware)
 */
export const approveCostSheet = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  // costing-22: rejectionReason accepted as legacy alias so a rejection reason is never silently dropped
  const { action } = req.body;
  const rejectionNotes = req.body.rejectionNotes ?? req.body.rejectionReason;
  // Also support legacy 'approved' boolean for backward compatibility
  const legacyApproved = req.body.approved;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  // Support both new 'action' and legacy 'approved' boolean
  let approvalStatus: 'APPROVED' | 'REJECTED' | 'PENDING';

  if (action !== undefined) {
    // New API: action = 'approve' | 'reject' | 'revoke'
    if (action === 'approve') {
      approvalStatus = 'APPROVED';
    } else if (action === 'reject') {
      approvalStatus = 'REJECTED';
      if (!rejectionNotes || rejectionNotes.trim().length === 0) {
        throw new ValidationError('Rejection notes are required when rejecting a cost sheet');
      }
    } else if (action === 'revoke') {
      approvalStatus = 'PENDING';
    } else {
      throw new ValidationError('Invalid action. Must be approve, reject, or revoke');
    }
  } else if (typeof legacyApproved === 'boolean') {
    // Legacy API: approved = true/false
    approvalStatus = legacyApproved ? 'APPROVED' : 'PENDING';
  } else {
    throw new ValidationError('Either action or approved field is required');
  }

  const costSheet = await prisma.style_costing.findUnique({
    where: { id },
  });

  if (!costSheet) {
    throw new NotFoundError('Cost sheet', id);
  }

  // Order-consumption freeze (2026-08-25): once a live order consumed this sheet
  // (an active order BOM was generated from it, or an order-item costing is based
  // on it), its approval must not be pulled out from under those frozen numbers —
  // that de-anchors the BOM/MRP prices from any visible source (the ESSKY082/083/
  // 089LS drift class). `lockedForOrders` was write-only dead code; this live
  // check is the real lock. Sanctioned path: create a new cost-sheet version
  // (the consumed version stays APPROVED as the order's source of record), or
  // delete the order/BOM first.
  const currentlyApproved = costSheet.approvalStatus === 'APPROVED' || costSheet.isApproved;
  if (currentlyApproved && approvalStatus !== 'APPROVED') {
    const consumers = await getCostSheetOrderDependents(id);
    if (consumers.hasLiveConsumers) {
      const orderList = consumerOrderNumbers(consumers).join(', ');
      const verb = approvalStatus === 'REJECTED' ? 'reject' : 'unapprove';
      throw new ConflictError(
        `Cannot ${verb}: order(s) ${orderList} were created from this cost sheet. ` +
          `Delete the order's BOM (or the order) first, or create a new cost sheet version instead.`,
        { code: 'COST_SHEET_IN_USE', dependents: consumers }
      );
    }
  }

  // Build update data
  const updateData: any = {
    approvalStatus,
    isApproved: approvalStatus === 'APPROVED', // Keep legacy field in sync
    approvedById: approvalStatus === 'APPROVED' ? userId : null,
    approvedAt: approvalStatus === 'APPROVED' ? new Date() : null,
  };

  // Add rejection notes if rejecting
  if (approvalStatus === 'REJECTED' && rejectionNotes) {
    updateData.rejectionNotes = rejectionNotes.trim();
  } else if (approvalStatus === 'APPROVED') {
    updateData.rejectionNotes = null; // Clear rejection notes on approval
  }

  const updatedCostSheet = await prisma.style_costing.update({
    where: { id },
    data: updateData,
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          categoryId: true,
        },
      },
      users_style_costing_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users_style_costing_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // A CAD correction's cost-sheet version: approving it carries the correction to the CAD row, its fabric
  // price approval and the live orders built on the superseded version; rejecting it drops the correction
  // and restores that version (cad-correction.service). The sheet decision above stands either way.
  let correctionWarning: string | undefined;
  if (approvalStatus === 'APPROVED' || approvalStatus === 'REJECTED') {
    try {
      if (approvalStatus === 'APPROVED') await onCostSheetApproved(id, userId);
      else await onCostSheetRejected(id, userId, rejectionNotes?.trim() ?? null);
    } catch (error) {
      // allow-swallow — the sheet decision is saved; the correction stays open and can be retried
      logError('[CadCorrection] applying the cost-sheet decision failed', error);
      correctionWarning =
        'The cost sheet was saved, but carrying its CAD correction through failed: ' +
        (error instanceof Error ? error.message : String(error)) +
        '. An admin can press Retry in the CAD correction box on this cost sheet.';
    }
  }

  // Different messages based on action
  let message: string;
  if (approvalStatus === 'APPROVED') {
    message = 'Cost sheet approved successfully';
  } else if (approvalStatus === 'REJECTED') {
    message = 'Cost sheet rejected';
  } else {
    message = 'Cost sheet approval status reset to pending';
  }

  res.json({
    success: true,
    data: updatedCostSheet,
    message,
    ...(correctionWarning ? { warning: correctionWarning } : {}),
  });
};

// ============================================================================
// COST SHEET VERSIONING
// ============================================================================

/**
 * Create a new version of an approved cost sheet
 * POST /api/style-costing/:id/create-version
 *
 * Creates a new version when cost updates are needed after approval.
 * The old version remains locked and linked for audit purposes.
 * Used when:
 * - Material costs change significantly
 * - CAD values are updated
 * - New pricing is needed for subsequent orders
 */
export const createCostSheetVersion = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { versionReason } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  if (!versionReason || versionReason.trim().length === 0) {
    throw new ValidationError('Version reason is required. Please provide a reason for creating a new version.');
  }

  // Clone + supersede in ONE transaction (cost-sheet-version.helper) — a failure between the two writes
  // must not leave two active sheets with supersededById null (bug-hunt costing-16)
  const {
    created: newCostSheet,
    source: sourceCostSheet,
    newVersionNumber,
  } = await prisma.$transaction((tx) => createCostSheetVersionTx(tx, id, { userId, reason: versionReason }));

  logInfo(`Created cost sheet version ${newVersionNumber} for style ${sourceCostSheet.styleId}`, {
    sourceVersion: sourceCostSheet.version,
    newVersion: newVersionNumber,
    sourceId: sourceCostSheet.id,
    newId: newCostSheet.id,
    reason: versionReason,
  });

  res.status(201).json({
    success: true,
    data: newCostSheet,
    message: `New cost sheet version ${newVersionNumber} created successfully`,
    versionInfo: {
      previousVersion: sourceCostSheet.version,
      previousVersionId: sourceCostSheet.id,
      newVersion: newVersionNumber,
      reason: versionReason.trim(),
    },
  });
};

/**
 * Get all cost sheet versions for a style
 * GET /api/style-costing/style/:styleId/versions
 *
 * Returns all versions in order (newest first), showing version history
 */
export const getCostSheetVersions = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;

  const costSheets = await prisma.style_costing.findMany({
    where: { styleId },
    orderBy: { version: 'desc' },
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
        },
      },
      users_style_costing_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users_style_costing_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      supersededBy: {
        select: {
          id: true,
          version: true,
        },
      },
    },
  });

  if (costSheets.length === 0) {
    throw new NotFoundError('Cost sheets for style', styleId);
  }

  // Get the current (latest) version
  const currentVersion = costSheets[0];

  res.json({
    success: true,
    data: {
      currentVersion,
      allVersions: costSheets,
      totalVersions: costSheets.length,
    },
    message: `Found ${costSheets.length} version(s) for this style`,
  });
};

/**
 * Compare two cost sheet versions
 * GET /api/style-costing/compare/:id1/:id2
 *
 * Returns side-by-side comparison of two cost sheet versions
 */
export const compareCostSheetVersions = async (req: Request, res: Response): Promise<void> => {
  const { id1, id2 } = req.params;

  const [costSheet1, costSheet2] = await Promise.all([
    prisma.style_costing.findUnique({
      where: { id: id1 },
      include: {
        styles: {
          select: { styleCode: true, styleName: true },
        },
      },
    }),
    prisma.style_costing.findUnique({
      where: { id: id2 },
      include: {
        styles: {
          select: { styleCode: true, styleName: true },
        },
      },
    }),
  ]);

  if (!costSheet1 || !costSheet2) {
    throw new NotFoundError('Cost sheet', !costSheet1 ? id1 : id2);
  }

  // Calculate differences
  const diff = {
    fabricTotal: {
      v1: Number(costSheet1.fabricTotal),
      v2: Number(costSheet2.fabricTotal),
      change: Number(costSheet2.fabricTotal) - Number(costSheet1.fabricTotal),
      changePercent:
        costSheet1.fabricTotal && Number(costSheet1.fabricTotal) !== 0
          ? ((Number(costSheet2.fabricTotal) - Number(costSheet1.fabricTotal)) / Number(costSheet1.fabricTotal)) * 100
          : 0,
    },
    trimsTotal: {
      v1: Number(costSheet1.trimsTotal),
      v2: Number(costSheet2.trimsTotal),
      change: Number(costSheet2.trimsTotal) - Number(costSheet1.trimsTotal),
      changePercent:
        costSheet1.trimsTotal && Number(costSheet1.trimsTotal) !== 0
          ? ((Number(costSheet2.trimsTotal) - Number(costSheet1.trimsTotal)) / Number(costSheet1.trimsTotal)) * 100
          : 0,
    },
    cmtTotal: {
      v1: Number(costSheet1.cmtTotal),
      v2: Number(costSheet2.cmtTotal),
      change: Number(costSheet2.cmtTotal) - Number(costSheet1.cmtTotal),
      changePercent:
        costSheet1.cmtTotal && Number(costSheet1.cmtTotal) !== 0
          ? ((Number(costSheet2.cmtTotal) - Number(costSheet1.cmtTotal)) / Number(costSheet1.cmtTotal)) * 100
          : 0,
    },
    totalProductCost: {
      v1: Number(costSheet1.totalProductCost),
      v2: Number(costSheet2.totalProductCost),
      change: Number(costSheet2.totalProductCost) - Number(costSheet1.totalProductCost),
      changePercent:
        costSheet1.totalProductCost && Number(costSheet1.totalProductCost) !== 0
          ? ((Number(costSheet2.totalProductCost) - Number(costSheet1.totalProductCost)) /
              Number(costSheet1.totalProductCost)) *
            100
          : 0,
    },
  };

  res.json({
    success: true,
    data: {
      costSheet1: {
        id: costSheet1.id,
        version: costSheet1.version,
        versionDate: costSheet1.versionDate,
        approvalStatus: (costSheet1 as any).approvalStatus,
        totalProductCost: costSheet1.totalProductCost,
      },
      costSheet2: {
        id: costSheet2.id,
        version: costSheet2.version,
        versionDate: costSheet2.versionDate,
        approvalStatus: (costSheet2 as any).approvalStatus,
        totalProductCost: costSheet2.totalProductCost,
      },
      differences: diff,
    },
    message: 'Cost sheet comparison generated',
  });
};

// ============================================================================
// PROCUREMENT & VARIANCE TRACKING ENDPOINTS (Phase 2B)
// ============================================================================

/**
 * Copy COSTING cost sheet to PROCUREMENT_PRODUCTION mode
 * POST /api/style-costing/copy
 *
 * Creates a new cost sheet with purpose=PROCUREMENT_PRODUCTION
 * Budget fields are populated from source COSTING totals
 * Used to transition from quotation to procurement phase
 */
export const copyCostSheetForProcurement = async (req: Request, res: Response): Promise<void> => {
  const { sourceCostSheetId } = req.body;

  if (!sourceCostSheetId) {
    throw new ValidationError('Source cost sheet ID is required');
  }

  logInfo(`[copyCostSheetForProcurement] Copying cost sheet ${sourceCostSheetId} for procurement`);

  // Fetch source cost sheet
  const sourceCostSheet = await prisma.style_costing.findUnique({
    where: { id: sourceCostSheetId },
  });

  if (!sourceCostSheet) {
    throw new NotFoundError('Source cost sheet', sourceCostSheetId);
  }

  // Validate source is COSTING mode
  if (sourceCostSheet.purpose !== 'COSTING') {
    throw new BusinessError('Only COSTING mode cost sheets can be copied for procurement');
  }

  // Validate source is approved
  if (!sourceCostSheet.isApproved) {
    throw new BusinessError('Source cost sheet must be approved before copying for procurement');
  }

  // Check if PROCUREMENT_PRODUCTION already exists for this style
  const existingProcurementCostSheet = await prisma.style_costing.findFirst({
    where: {
      styleId: sourceCostSheet.styleId,
      purpose: 'PROCUREMENT_PRODUCTION',
      supersededById: null, // Only check active versions
    },
  });

  if (existingProcurementCostSheet) {
    throw new ConflictError(
      `A PROCUREMENT_PRODUCTION cost sheet already exists for this style (ID: ${existingProcurementCostSheet.id})`
    );
  }

  logInfo(`[copyCostSheetForProcurement] Creating PROCUREMENT_PRODUCTION cost sheet from COSTING ${sourceCostSheetId}`);

  // Create new PROCUREMENT_PRODUCTION cost sheet (+ its relational item rows, atomically)
  const newCostSheet = await prisma.$transaction(async (tx) => {
    const created = await tx.style_costing.create({
      data: {
        id: randomUUID(),
        styleId: sourceCostSheet.styleId,
        purpose: 'PROCUREMENT_PRODUCTION',
        copiedFromCostingId: sourceCostSheetId,

        // Copy basic information
        numberOfComponents: sourceCostSheet.numberOfComponents,
        category: sourceCostSheet.category,
        subCategory: sourceCostSheet.subCategory,

        // Copy detail arrays
        fabricDetails: sourceCostSheet.fabricDetails as any,
        trimsDetails: sourceCostSheet.trimsDetails as any,
        cmtCost: sourceCostSheet.cmtCost,
        embroideryDetails: sourceCostSheet.embroideryDetails as any,
        accessoriesDetails: sourceCostSheet.accessoriesDetails as any,

        // Copy totals to budget fields
        fabricBudget: sourceCostSheet.fabricTotal,
        trimsBudget: sourceCostSheet.trimsTotal,
        cmtBudget: sourceCostSheet.cmtTotal,
        embroideryBudget: sourceCostSheet.embroideryTotal,
        accessoriesBudget: sourceCostSheet.accessoriesTotal,
        totalBudget: sourceCostSheet.totalProductCost,

        // Buffer percentages (use defaults from schema)
        fabricBufferPercent: 5.0,
        trimsBufferPercent: 10.0,
        cmtBufferPercent: 5.0,
        embroideryBufferPercent: 8.0,
        accessoriesBufferPercent: 10.0,

        // Copy existing totals (as starting point)
        fabricTotal: sourceCostSheet.fabricTotal,
        trimsTotal: sourceCostSheet.trimsTotal,
        cmtTotal: sourceCostSheet.cmtTotal,
        embroideryTotal: sourceCostSheet.embroideryTotal,
        accessoriesTotal: sourceCostSheet.accessoriesTotal,
        // Lace rows are cloned relationally below; keep the column in step
        laceTotal: sourceCostSheet.laceTotal,
        totalProductCost: sourceCostSheet.totalProductCost,

        // Copy value loss and markup
        valueLossPercent: sourceCostSheet.valueLossPercent,
        valueLossAmount: sourceCostSheet.valueLossAmount,
        markupPercent: sourceCostSheet.markupPercent,
        markupAmount: sourceCostSheet.markupAmount,

        // Actuals initially null (to be filled during procurement)
        fabricActual: null,
        trimsActual: null,
        cmtActual: null,
        embroideryActual: null,
        accessoriesActual: null,
        totalActual: null,

        // Variance fields initially null (auto-calculated later)
        fabricVariance: null,
        fabricVariancePercent: null,
        trimsVariance: null,
        trimsVariancePercent: null,
        cmtVariance: null,
        cmtVariancePercent: null,
        embroideryVariance: null,
        embroideryVariancePercent: null,
        accessoriesVariance: null,
        accessoriesVariancePercent: null,
        totalVariance: null,
        totalVariancePercent: null,
        varianceStatus: 'PENDING',

        // Start with version 1 (new version sequence for procurement)
        version: 1,
        versionDate: new Date(),
        versionReason: `Copied from COSTING cost sheet (ID: ${sourceCostSheetId}) for procurement`,

        // Not approved initially (requires review and approval)
        isApproved: false,
        approvedById: null,
        approvedAt: null,

        // Track creation
        createdById: req.user?.userId || sourceCostSheet.createdById,
      },
      include: {
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
          },
        },
      },
    });

    // Copy the relational item tables — Order-BOM generation reads these, not the JSON snapshot
    await copyCostSheetItemTables(tx, sourceCostSheetId, created.id);

    return created;
  });

  logInfo(`[copyCostSheetForProcurement] Successfully created PROCUREMENT_PRODUCTION cost sheet ${newCostSheet.id}`, {
    sourceCostSheetId,
    newCostSheetId: newCostSheet.id,
    styleId: newCostSheet.styleId,
  });

  res.status(201).json({
    success: true,
    data: newCostSheet,
    message:
      'Procurement cost sheet created successfully. Please review budget values, adjust buffer percentages if needed, and approve when ready.',
    copyInfo: {
      sourceCostSheetId,
      sourceMode: 'COSTING',
      targetMode: 'PROCUREMENT_PRODUCTION',
      budgetFieldsPopulated: true,
    },
  });
};

/**
 * Update actual costs for a PROCUREMENT_PRODUCTION cost sheet
 * PATCH /api/style-costing/:id/actuals
 *
 * Updates actual cost fields and auto-triggers variance calculation
 * Used during procurement to track actual costs vs budget
 */
export const updateActuals = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { fabricActual, trimsActual, cmtActual, embroideryActual, accessoriesActual, totalActual } = req.body;

  logInfo(`[updateActuals] Updating actuals for cost sheet ${id}`);

  // Fetch cost sheet
  const costSheet = await prisma.style_costing.findUnique({
    where: { id },
  });

  if (!costSheet) {
    throw new NotFoundError('Cost sheet', id);
  }

  // Validate it's PROCUREMENT_PRODUCTION mode
  if (costSheet.purpose !== 'PROCUREMENT_PRODUCTION') {
    throw new BusinessError('Actual costs can only be updated for PROCUREMENT_PRODUCTION cost sheets');
  }

  // Update actual fields
  const updatedCostSheet = await prisma.style_costing.update({
    where: { id },
    data: {
      fabricActual: fabricActual !== undefined ? fabricActual : costSheet.fabricActual,
      trimsActual: trimsActual !== undefined ? trimsActual : costSheet.trimsActual,
      cmtActual: cmtActual !== undefined ? cmtActual : costSheet.cmtActual,
      embroideryActual: embroideryActual !== undefined ? embroideryActual : costSheet.embroideryActual,
      accessoriesActual: accessoriesActual !== undefined ? accessoriesActual : costSheet.accessoriesActual,
      totalActual: totalActual !== undefined ? totalActual : costSheet.totalActual,
    },
  });

  logInfo(`[updateActuals] Actuals updated. Triggering variance calculation...`);

  // Auto-calculate variance
  const costSheetWithVariance = await calculateVariance(id);

  logInfo(`[updateActuals] Variance calculated. Status: ${costSheetWithVariance.varianceStatus}`);

  res.json({
    success: true,
    data: costSheetWithVariance,
    message: `Actuals updated and variance calculated. Status: ${costSheetWithVariance.varianceStatus}`,
    varianceInfo: {
      status: costSheetWithVariance.varianceStatus,
      requiresApproval: costSheetWithVariance.varianceStatus === 'REQUIRES_APPROVAL',
      withinBudget: costSheetWithVariance.varianceStatus === 'WITHIN_BUDGET',
    },
  });
};

/**
 * Approve or reject cost variance
 * POST /api/style-costing/variance/:id/approve
 *
 * Admin-only endpoint to approve/reject variances that exceed buffer limits
 * Required before order creation when variance status is REQUIRES_APPROVAL
 */
export const approveVariance = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { action, notes } = req.body; // action: 'APPROVE' | 'REJECT'

  if (!action || !['APPROVE', 'REJECT'].includes(action)) {
    throw new ValidationError('Action must be either APPROVE or REJECT');
  }

  logInfo(`[approveVariance] ${action} variance for cost sheet ${id}`);

  // Fetch cost sheet
  const costSheet = await prisma.style_costing.findUnique({
    where: { id },
  });

  if (!costSheet) {
    throw new NotFoundError('Cost sheet', id);
  }

  // Validate it has REQUIRES_APPROVAL status
  if (costSheet.varianceStatus !== 'REQUIRES_APPROVAL') {
    throw new BusinessError(
      `This cost sheet has variance status ${costSheet.varianceStatus}. Only REQUIRES_APPROVAL variances can be approved/rejected.`
    );
  }

  const newVarianceStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  // Update variance approval
  const updatedCostSheet = await prisma.style_costing.update({
    where: { id },
    data: {
      varianceStatus: newVarianceStatus,
      varianceApprovedBy: req.user?.userId,
      varianceApprovedAt: new Date(),
      varianceNotes: notes || null,
    },
    include: {
      varianceApprovedByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  logInfo(`[approveVariance] Variance ${action}ED for cost sheet ${id}`, {
    newStatus: newVarianceStatus,
    approvedBy: req.user?.userId,
    notes: notes || 'No notes provided',
  });

  res.json({
    success: true,
    data: updatedCostSheet,
    message: `Variance ${action.toLowerCase()}ed successfully`,
    approvalInfo: {
      action: action.toUpperCase(),
      status: newVarianceStatus,
      approvedBy: req.user?.userId,
      approvedAt: updatedCostSheet.varianceApprovedAt,
      notes: notes || null,
    },
  });
};
