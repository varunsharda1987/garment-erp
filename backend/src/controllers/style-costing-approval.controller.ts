import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';
import { calculateVariance } from '../services/costSheet.service';

// ============================================================================
// APPROVAL & VERSIONING OPERATIONS
// ============================================================================

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
  try {
    const { id } = req.params;
    const { action, rejectionNotes } = req.body;
    // Also support legacy 'approved' boolean for backward compatibility
    const legacyApproved = req.body.approved;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
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
          res.status(400).json({ error: 'Rejection notes are required when rejecting a cost sheet' });
          return;
        }
      } else if (action === 'revoke') {
        approvalStatus = 'PENDING';
      } else {
        res.status(400).json({ error: 'Invalid action. Must be approve, reject, or revoke' });
        return;
      }
    } else if (typeof legacyApproved === 'boolean') {
      // Legacy API: approved = true/false
      approvalStatus = legacyApproved ? 'APPROVED' : 'PENDING';
    } else {
      res.status(400).json({ error: 'Either action or approved field is required' });
      return;
    }

    const costSheet = await prisma.style_costing.findUnique({
      where: { id },
    });

    if (!costSheet) {
      res.status(404).json({ error: 'Cost sheet not found' });
      return;
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
    });
  } catch (error) {
    logError('Error approving cost sheet:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
  try {
    const { id } = req.params;
    const { versionReason } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!versionReason || versionReason.trim().length === 0) {
      res.status(400).json({
        error: 'Version reason is required',
        message: 'Please provide a reason for creating a new version (e.g., "Updated fabric costs", "New CAD values")',
      });
      return;
    }

    // Get the source cost sheet
    const sourceCostSheet = await prisma.style_costing.findUnique({
      where: { id },
      include: {
        styles: {
          select: {
            id: true,
            styleCode: true,
          },
        },
      },
    });

    if (!sourceCostSheet) {
      res.status(404).json({ error: 'Cost sheet not found' });
      return;
    }

    // Only approved cost sheets can be versioned
    const isApproved = (sourceCostSheet as any).approvalStatus === 'APPROVED' || sourceCostSheet.isApproved;
    if (!isApproved) {
      res.status(400).json({
        error: 'Cannot version unapproved cost sheet',
        message:
          'Only approved cost sheets can be versioned. Please approve the current version first or update it directly.',
      });
      return;
    }

    // Generate new version ID
    const newVersionId = `CS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newVersionNumber = sourceCostSheet.version + 1;

    // Create new version by cloning the approved cost sheet
    const newCostSheet = await prisma.style_costing.create({
      data: {
        id: newVersionId,
        styleId: sourceCostSheet.styleId,

        // Versioning fields
        version: newVersionNumber,
        versionDate: new Date(),
        versionReason: versionReason.trim(),
        costVariancePercent: 0, // Will be calculated when values are changed

        // Copy all cost data from source
        numberOfComponents: sourceCostSheet.numberOfComponents,
        category: sourceCostSheet.category,
        subCategory: sourceCostSheet.subCategory,
        fabricDetails: sourceCostSheet.fabricDetails || undefined,
        fabricTotal: sourceCostSheet.fabricTotal,
        trimsDetails: sourceCostSheet.trimsDetails || undefined,
        trimsTotal: sourceCostSheet.trimsTotal,
        cuttingCost: sourceCostSheet.cuttingCost,
        stitchingCost: sourceCostSheet.stitchingCost,
        finishingCost: sourceCostSheet.finishingCost,
        buttonAttachmentCost: sourceCostSheet.buttonAttachmentCost,
        handworkCmtCost: sourceCostSheet.handworkCmtCost,
        cmtTotal: sourceCostSheet.cmtTotal,
        embroideryDetails: sourceCostSheet.embroideryDetails || undefined,
        embroideryTotal: sourceCostSheet.embroideryTotal,
        accessoriesDetails: sourceCostSheet.accessoriesDetails || undefined,
        accessoriesTotal: sourceCostSheet.accessoriesTotal,
        valueLossPercent: sourceCostSheet.valueLossPercent,
        valueLossAmount: sourceCostSheet.valueLossAmount,
        markupPercent: sourceCostSheet.markupPercent,
        markupAmount: sourceCostSheet.markupAmount,
        subtotal: sourceCostSheet.subtotal,
        totalProductCost: sourceCostSheet.totalProductCost,

        // Additional fields
        totalMaterialCost: sourceCostSheet.totalMaterialCost,
        printingCost: sourceCostSheet.printingCost,
        totalProcessingCost: sourceCostSheet.totalProcessingCost,
        checkingCost: sourceCostSheet.checkingCost,
        totalProductionCost: sourceCostSheet.totalProductionCost,
        profitMargin: sourceCostSheet.profitMargin,
        totalCostPerPiece: sourceCostSheet.totalCostPerPiece,
        sellingPricePerPiece: sourceCostSheet.sellingPricePerPiece,
        cmtCost: sourceCostSheet.cmtCost,
        fabricCost: sourceCostSheet.fabricCost,
        trimsCost: sourceCostSheet.trimsCost,
        embroideryWork: sourceCostSheet.embroideryWork,
        handWork: sourceCostSheet.handWork,
        dyeingCost: sourceCostSheet.dyeingCost,
        washingCost: sourceCostSheet.washingCost,
        otherProcessingCost: sourceCostSheet.otherProcessingCost,
        packagingCost: sourceCostSheet.packagingCost,
        accessoriesCost: sourceCostSheet.accessoriesCost,
        otherMaterialCost: sourceCostSheet.otherMaterialCost,
        factoryOverhead: sourceCostSheet.factoryOverhead,
        adminOverhead: sourceCostSheet.adminOverhead,
        transportCost: sourceCostSheet.transportCost,
        otherOverheads: sourceCostSheet.otherOverheads,
        profitAmount: sourceCostSheet.profitAmount,
        cadFabricConsumption: sourceCostSheet.cadFabricConsumption,
        cadUnit: sourceCostSheet.cadUnit,
        cadWastagePercent: sourceCostSheet.cadWastagePercent,
        // Note: widthCombinationHash and widthCombinationDescription are copied if they exist
        // These fields use @map in Prisma schema, so we access them conditionally
        ...((sourceCostSheet as any).widthCombinationHash && {
          widthCombinationHash: (sourceCostSheet as any).widthCombinationHash,
        }),
        ...((sourceCostSheet as any).widthCombinationDescription && {
          widthCombinationDescription: (sourceCostSheet as any).widthCombinationDescription,
        }),
        notes: `Versioned from v${sourceCostSheet.version}. Reason: ${versionReason.trim()}`,

        // New version starts as PENDING
        approvalStatus: 'PENDING',
        isApproved: false,
        createdById: userId,
      },
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
      },
    });

    // Link the old version to this new version (supersededBy relation)
    await prisma.style_costing.update({
      where: { id: sourceCostSheet.id },
      data: {
        supersededById: newCostSheet.id,
        lockedForOrders: true, // Lock the old version
      },
    });

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
  } catch (error) {
    logError('Error creating cost sheet version:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get all cost sheet versions for a style
 * GET /api/style-costing/style/:styleId/versions
 *
 * Returns all versions in order (newest first), showing version history
 */
export const getCostSheetVersions = async (req: Request, res: Response): Promise<void> => {
  try {
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
      res.status(404).json({ error: 'No cost sheets found for this style' });
      return;
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
  } catch (error) {
    logError('Error fetching cost sheet versions:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Compare two cost sheet versions
 * GET /api/style-costing/compare/:id1/:id2
 *
 * Returns side-by-side comparison of two cost sheet versions
 */
export const compareCostSheetVersions = async (req: Request, res: Response): Promise<void> => {
  try {
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
      res.status(404).json({
        error: 'One or both cost sheets not found',
        found: {
          costSheet1: !!costSheet1,
          costSheet2: !!costSheet2,
        },
      });
      return;
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
  } catch (error) {
    logError('Error comparing cost sheets:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
  try {
    const { sourceCostSheetId } = req.body;

    if (!sourceCostSheetId) {
      res.status(400).json({
        error: 'Source cost sheet ID is required',
        message: 'Please provide sourceCostSheetId in request body',
      });
      return;
    }

    logInfo(`[copyCostSheetForProcurement] Copying cost sheet ${sourceCostSheetId} for procurement`);

    // Fetch source cost sheet
    const sourceCostSheet = await prisma.style_costing.findUnique({
      where: { id: sourceCostSheetId },
    });

    if (!sourceCostSheet) {
      res.status(404).json({
        error: 'Source cost sheet not found',
        message: `No cost sheet found with ID ${sourceCostSheetId}`,
      });
      return;
    }

    // Validate source is COSTING mode
    if (sourceCostSheet.purpose !== 'COSTING') {
      res.status(400).json({
        error: 'Invalid source cost sheet',
        message: 'Only COSTING mode cost sheets can be copied for procurement',
        code: 'INVALID_SOURCE_PURPOSE',
      });
      return;
    }

    // Validate source is approved
    if (!sourceCostSheet.isApproved) {
      res.status(400).json({
        error: 'Source cost sheet not approved',
        message: 'Source cost sheet must be approved before copying for procurement',
        code: 'SOURCE_NOT_APPROVED',
      });
      return;
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
      res.status(409).json({
        error: 'Procurement cost sheet already exists',
        message: `A PROCUREMENT_PRODUCTION cost sheet already exists for this style (ID: ${existingProcurementCostSheet.id})`,
        code: 'PROCUREMENT_ALREADY_EXISTS',
        existingCostSheetId: existingProcurementCostSheet.id,
      });
      return;
    }

    logInfo(
      `[copyCostSheetForProcurement] Creating PROCUREMENT_PRODUCTION cost sheet from COSTING ${sourceCostSheetId}`
    );

    // Create new PROCUREMENT_PRODUCTION cost sheet
    const newCostSheet = await prisma.style_costing.create({
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
  } catch (error) {
    logError('[copyCostSheetForProcurement] Error copying cost sheet:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Update actual costs for a PROCUREMENT_PRODUCTION cost sheet
 * PATCH /api/style-costing/:id/actuals
 *
 * Updates actual cost fields and auto-triggers variance calculation
 * Used during procurement to track actual costs vs budget
 */
export const updateActuals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fabricActual, trimsActual, cmtActual, embroideryActual, accessoriesActual, totalActual } = req.body;

    logInfo(`[updateActuals] Updating actuals for cost sheet ${id}`);

    // Fetch cost sheet
    const costSheet = await prisma.style_costing.findUnique({
      where: { id },
    });

    if (!costSheet) {
      res.status(404).json({
        error: 'Cost sheet not found',
        message: `No cost sheet found with ID ${id}`,
      });
      return;
    }

    // Validate it's PROCUREMENT_PRODUCTION mode
    if (costSheet.purpose !== 'PROCUREMENT_PRODUCTION') {
      res.status(400).json({
        error: 'Invalid cost sheet purpose',
        message: 'Actual costs can only be updated for PROCUREMENT_PRODUCTION cost sheets',
        code: 'INVALID_PURPOSE',
      });
      return;
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
  } catch (error) {
    logError('[updateActuals] Error updating actuals:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Approve or reject cost variance
 * POST /api/style-costing/variance/:id/approve
 *
 * Admin-only endpoint to approve/reject variances that exceed buffer limits
 * Required before order creation when variance status is REQUIRES_APPROVAL
 */
export const approveVariance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'APPROVE' | 'REJECT'

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      res.status(400).json({
        error: 'Invalid action',
        message: 'Action must be either APPROVE or REJECT',
      });
      return;
    }

    logInfo(`[approveVariance] ${action} variance for cost sheet ${id}`);

    // Fetch cost sheet
    const costSheet = await prisma.style_costing.findUnique({
      where: { id },
    });

    if (!costSheet) {
      res.status(404).json({
        error: 'Cost sheet not found',
        message: `No cost sheet found with ID ${id}`,
      });
      return;
    }

    // Validate it has REQUIRES_APPROVAL status
    if (costSheet.varianceStatus !== 'REQUIRES_APPROVAL') {
      res.status(400).json({
        error: 'Invalid variance status',
        message: `This cost sheet has variance status ${costSheet.varianceStatus}. Only REQUIRES_APPROVAL variances can be approved/rejected.`,
        code: 'INVALID_VARIANCE_STATUS',
        currentStatus: costSheet.varianceStatus,
      });
      return;
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
  } catch (error) {
    logError('[approveVariance] Error approving variance:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
