import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { logInfo, logError, logWarn } from '../utils/logger';
import { calculateVariance, updateCostSheetActuals } from '../services/costSheet.service';

// ============================================
// Types for Style Costing Controller
// ============================================

type StyleCostingWhereInput = Prisma.style_costingWhereInput;

// Type definitions for JSON detail arrays
interface FabricDetail {
  fabricName: string;
  fabricWidth: number;
  fabricAverage: number;
  fabricRate: number;
  fabricTotal: number;
  isNotApplicable?: boolean;
}

interface TrimDetail {
  trimName: string;
  trimQuantity: number;
  trimRate: number;
  trimTotal: number;
  isNotApplicable?: boolean;
}

interface EmbroideryDetail {
  embroideryName: string;
  embroideryAverage: number;
  embroideryRate: number;
  embroideryTotal: number;
  isNotApplicable?: boolean;
}

interface AccessoryDetail {
  accessoryName: string;
  accessoryQuantity: number;
  accessoryRate: number;
  accessoryTotal: number;
  isNotApplicable?: boolean;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const FabricDetailSchema = z.object({
  fabricName: z.string().min(1, 'Fabric name is required'),
  fabricWidth: z.number().nonnegative('Fabric width must be non-negative'),
  fabricAverage: z.number().nonnegative('Fabric average must be non-negative'),
  fabricRate: z.number().nonnegative('Fabric rate must be non-negative'),
  fabricTotal: z.number().nonnegative('Fabric total must be non-negative'),
  isNotApplicable: z.boolean().optional().default(false),
  // Sourcing strategy fields (optional)
  fabricId: z.string().optional(),
  sourcingStrategy: z.enum(['STOCK_REUSE', 'READY_FABRIC', 'GREIGE_PROCESSED']).optional(),
  stockLotId: z.string().optional(),
  processorId: z.string().optional(),
  rateCardId: z.string().optional(),
  procurementId: z.string().optional(),
  greigeCost: z.number().optional(),
  processingCost: z.number().optional(),
  isManualOverride: z.boolean().optional(),
  overrideReason: z.string().optional(),
}).refine(
  (data) => data.isNotApplicable || (data.fabricRate > 0 && data.fabricAverage > 0),
  {
    message: 'Fabric rate and average must be > 0 unless marked as Not Applicable (N/A)',
    path: ['fabricRate'],
  }
);

const TrimDetailSchema = z.object({
  trimName: z.string().min(1, 'Trim name is required'),
  trimQuantity: z.number().nonnegative('Trim quantity must be non-negative'),
  trimRate: z.number().nonnegative('Trim rate must be non-negative'),
  trimTotal: z.number().nonnegative('Trim total must be non-negative'),
  isNotApplicable: z.boolean().optional().default(false),
  // BOM reference fields (optional)
  unit: z.string().optional(),
  bomId: z.string().optional(),
  materialType: z.string().optional(),
}).refine(
  (data) => data.isNotApplicable || (data.trimRate > 0 && data.trimQuantity > 0),
  {
    message: 'Trim rate and quantity must be > 0 unless marked as Not Applicable (N/A)',
    path: ['trimRate'],
  }
);

const EmbroideryDetailSchema = z.object({
  embroideryName: z.string().min(1, 'Embroidery name is required'),
  embroideryAverage: z.number().nonnegative('Embroidery average must be non-negative'),
  embroideryRate: z.number().nonnegative('Embroidery rate must be non-negative'),
  embroideryTotal: z.number().nonnegative('Embroidery total must be non-negative'),
  isNotApplicable: z.boolean().optional().default(false),
}).refine(
  (data) => data.isNotApplicable || (data.embroideryRate > 0 && data.embroideryAverage > 0),
  {
    message: 'Embroidery rate and average must be > 0 unless marked as Not Applicable (N/A)',
    path: ['embroideryRate'],
  }
);

const AccessoryDetailSchema = z.object({
  accessoryName: z.string().min(1, 'Accessory name is required'),
  accessoryQuantity: z.number().nonnegative('Accessory quantity must be non-negative'),
  accessoryRate: z.number().nonnegative('Accessory rate must be non-negative'),
  accessoryTotal: z.number().nonnegative('Accessory total must be non-negative'),
  isNotApplicable: z.boolean().optional().default(false),
}).refine(
  (data) => data.isNotApplicable || (data.accessoryRate > 0 && data.accessoryQuantity > 0),
  {
    message: 'Accessory rate and quantity must be > 0 unless marked as Not Applicable (N/A)',
    path: ['accessoryRate'],
  }
);

const CMTCostsSchema = z.object({
  cuttingCost: z.number().nonnegative('Cutting cost must be non-negative').default(0),
  stitchingCost: z.number().nonnegative('Stitching cost must be non-negative').default(0),
  finishingCost: z.number().nonnegative('Finishing cost must be non-negative').default(0),
  buttonAttachmentCost: z.number().nonnegative('Button attachment cost must be non-negative').default(0),
  handworkCost: z.number().nonnegative('Handwork cost must be non-negative').default(0),
});

const CreateCostSheetSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),

  // Cost Sheet Purpose/Mode
  purpose: z.enum(['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION']).default('COSTING'),

  // Basic Information
  numberOfComponents: z.number().int().positive().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),

  // Dynamic arrays
  fabricDetails: z.array(FabricDetailSchema).min(1, 'At least one fabric is required'),
  trimsDetails: z.array(TrimDetailSchema).min(1, 'At least one trim is required'),
  cmtCosts: CMTCostsSchema,
  embroideryDetails: z.array(EmbroideryDetailSchema).default([]),
  accessoriesDetails: z.array(AccessoryDetailSchema).default([]),

  // Value Loss & Markup
  valueLossPercent: z.number().min(0).max(100, 'Value loss must be between 0-100%').default(2),
  markupPercent: z.number().min(0).max(100, 'Markup must be between 0-100%').default(15),

  // Additional fields
  notes: z.string().optional(),

  // Closed Cost - Final agreed price with customer (exclusive of tax)
  closedCost: z.number().positive('Closed cost must be positive').optional().nullable(),
  closedCostNotes: z.string().optional().nullable(),
});

const UpdateCostSheetSchema = CreateCostSheetSchema.partial().omit({ styleId: true });

// ============================================================================
// CONTROLLER FUNCTIONS
// ============================================================================

/**
 * Create a new Cost Sheet for a style
 * POST /api/style-costing
 */
export const createCostSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = CreateCostSheetSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if style exists
    const style = await prisma.styles.findUnique({
      where: { id: validatedData.styleId },
    });

    if (!style) {
      res.status(404).json({ error: 'Style not found' });
      return;
    }

    // Check if cost sheet already exists for this style IN THE SAME MODE
    // Different modes (COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION) can have their own cost sheets
    const existingCostSheet = await prisma.style_costing.findFirst({
      where: {
        styleId: validatedData.styleId,
        purpose: validatedData.purpose,  // Only check within same mode
      },
    });

    // Generate width combination hash and description from fabric widths
    const fabricWidths = validatedData.fabricDetails
      .map(f => f.fabricWidth)
      .filter(w => w > 0)
      .sort((a, b) => a - b);
    const widthCombinationHash = fabricWidths.length > 0
      ? fabricWidths.join('-')
      : 'default';
    const widthCombinationDescription = fabricWidths.length > 0
      ? fabricWidths.map(w => `${w}"`).join(' + ')
      : 'Default Width';

    // Check if a cost sheet with the same width combination already exists
    if (existingCostSheet) {
      const existingHash = (existingCostSheet as any).widthCombinationHash || 'default';
      if (existingHash === widthCombinationHash) {
        res.status(400).json({
          error: 'Cost sheet already exists for this width combination',
          message: `A cost sheet for width combination "${widthCombinationDescription}" already exists. Use update or create a new version.`,
          existingCostSheetId: existingCostSheet.id
        });
        return;
      }
      // Different width combination - allow creation
    }

    // Calculate the next version for this style+purpose combination
    // Each mode has its own independent version sequence
    const maxVersionRecord = await prisma.style_costing.findFirst({
      where: {
        styleId: validatedData.styleId,
        purpose: validatedData.purpose,
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (maxVersionRecord?.version || 0) + 1;

    // Calculate totals from arrays (excluding items marked as Not Applicable)
    const fabricTotal = validatedData.fabricDetails
      .filter(f => !f.isNotApplicable)
      .reduce((sum, f) => sum + f.fabricTotal, 0);
    const trimsTotal = validatedData.trimsDetails
      .filter(t => !t.isNotApplicable)
      .reduce((sum, t) => sum + t.trimTotal, 0);
    const cmtTotal = Object.values(validatedData.cmtCosts).reduce((sum, c) => sum + c, 0);
    const embroideryTotal = validatedData.embroideryDetails
      .filter(e => !e.isNotApplicable)
      .reduce((sum, e) => sum + e.embroideryTotal, 0);
    const accessoriesTotal = validatedData.accessoriesDetails
      .filter(a => !a.isNotApplicable)
      .reduce((sum, a) => sum + a.accessoryTotal, 0);

    // Calculate subtotal (before value loss and markup)
    const subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal + accessoriesTotal;

    // Calculate value loss
    const valueLossAmount = (subtotal * validatedData.valueLossPercent) / 100;
    const totalAfterValueLoss = subtotal + valueLossAmount;

    // Calculate markup
    const markupAmount = (totalAfterValueLoss * validatedData.markupPercent) / 100;
    const totalProductCost = totalAfterValueLoss + markupAmount;

    // Calculate derived cost fields for display
    const totalMaterialCost = fabricTotal + trimsTotal + accessoriesTotal;
    const totalProcessingCost = embroideryTotal + cmtTotal;
    const totalCostPerPiece = totalProductCost; // Same as totalProductCost (per piece cost)
    const sellingPricePerPiece = totalProductCost; // Base selling price equals total cost

    // Generate unique ID for cost sheet
    const costSheetId = `CS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create cost sheet
    const costSheet = await prisma.style_costing.create({
      data: {
        id: costSheetId,
        styleId: validatedData.styleId,
        purpose: validatedData.purpose,  // Cost sheet purpose/mode
        version: nextVersion,  // Version per (styleId, purpose) combination

        // Basic Information
        numberOfComponents: validatedData.numberOfComponents,
        category: validatedData.category,
        subCategory: validatedData.subCategory,

        // Fabric Details
        fabricDetails: JSON.parse(JSON.stringify(validatedData.fabricDetails)),
        fabricTotal,

        // Trims Details
        trimsDetails: JSON.parse(JSON.stringify(validatedData.trimsDetails)),
        trimsTotal,

        // CMT Costs
        cuttingCost: validatedData.cmtCosts.cuttingCost,
        stitchingCost: validatedData.cmtCosts.stitchingCost,
        finishingCost: validatedData.cmtCosts.finishingCost,
        buttonAttachmentCost: validatedData.cmtCosts.buttonAttachmentCost,
        handworkCmtCost: validatedData.cmtCosts.handworkCost,
        cmtTotal,

        // Embroidery Details
        embroideryDetails: JSON.parse(JSON.stringify(validatedData.embroideryDetails)),
        embroideryTotal,

        // Accessories Details
        accessoriesDetails: JSON.parse(JSON.stringify(validatedData.accessoriesDetails)),
        accessoriesTotal,

        // Value Loss
        valueLossPercent: validatedData.valueLossPercent,
        valueLossAmount,

        // Markup
        markupPercent: validatedData.markupPercent,
        markupAmount,

        // Calculated Totals
        subtotal,
        totalProductCost,
        totalMaterialCost,
        totalProcessingCost,
        totalCostPerPiece,
        sellingPricePerPiece,

        // Width Combination (for multi-width support)
        widthCombinationHash,
        widthCombinationDescription,

        // Additional
        notes: validatedData.notes,
        createdById: userId,

        // Closed Cost - Final agreed price with customer
        closedCost: validatedData.closedCost || null,
        closedCostNotes: validatedData.closedCostNotes || null,
      },
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
      },
    });

    res.status(201).json({
      success: true,
      data: costSheet,
      message: 'Cost sheet created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.issues,
      });
      return;
    }

    logError('Error creating cost sheet:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get all cost sheets with filtering and pagination
 * GET /api/style-costing
 */
export const getAllCostSheets = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      approved = 'all',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: StyleCostingWhereInput = {};

    // Search by style code or style name
    if (search) {
      where.styles = {
        OR: [
          { styleCode: { contains: search as string, mode: 'insensitive' } },
          { styleName: { contains: search as string, mode: 'insensitive' } },
        ],
      };
    }

    // Filter by approval status
    if (approved !== 'all') {
      if (approved === 'approved') {
        where.approvalStatus = 'APPROVED';
      } else if (approved === 'pending') {
        where.approvalStatus = 'PENDING';
      } else if (approved === 'rejected') {
        where.approvalStatus = 'REJECTED';
      } else if (approved === 'true') {
        // Legacy support for boolean filter
        where.isApproved = true;
      } else if (approved === 'false') {
        where.isApproved = false;
      }
    }

    // Get total count
    const total = await prisma.style_costing.count({ where });

    // Get cost sheets
    const costSheets = await prisma.style_costing.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
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
          },
        },
        users_style_costing_approvedByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        // Include linked orders for tracking
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            orderDate: true,
          },
        },
        orderItem: {
          select: {
            id: true,
            orderId: true,
            totalQuantity: true,
            orders: {
              select: {
                orderNumber: true,
                status: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: costSheets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logError('Error fetching cost sheets:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get cost sheet by ID
 * GET /api/style-costing/:id
 */
export const getCostSheetById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const costSheet = await prisma.style_costing.findUnique({
      where: { id },
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

    if (!costSheet) {
      res.status(404).json({ error: 'Cost sheet not found' });
      return;
    }

    res.json({
      success: true,
      data: costSheet,
    });
  } catch (error) {
    logError('Error fetching cost sheet:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get cost sheet by style ID
 * GET /api/style-costing/style/:styleId
 */
export const getCostSheetByStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;

    const costSheet = await prisma.style_costing.findFirst({
      where: { styleId },
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

    if (!costSheet) {
      res.status(404).json({ error: 'Cost sheet not found for this style' });
      return;
    }

    res.json({
      success: true,
      data: costSheet,
    });
  } catch (error) {
    logError('Error fetching cost sheet by style:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get all cost sheets for a style grouped by width combination
 * GET /api/style-costing/style/:styleId/grouped
 * Returns all cost sheets for a style, grouped by width combination hash
 */
export const getCostSheetsGroupedByWidth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;

    const costSheets = await prisma.style_costing.findMany({
      where: { styleId },
      orderBy: [
        { widthCombinationHash: 'asc' },
        { version: 'desc' },
      ],
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

    // Group by width combination
    const grouped: Record<string, {
      widthCombinationHash: string;
      widthCombinationDescription: string;
      costSheets: typeof costSheets;
    }> = {};

    for (const cs of costSheets) {
      const hash = (cs as any).widthCombinationHash || 'default';
      const desc = (cs as any).widthCombinationDescription || 'Default Width';

      if (!grouped[hash]) {
        grouped[hash] = {
          widthCombinationHash: hash,
          widthCombinationDescription: desc,
          costSheets: [],
        };
      }
      grouped[hash].costSheets.push(cs);
    }

    res.json({
      success: true,
      data: {
        styleId,
        widthCombinations: Object.values(grouped),
        totalCostSheets: costSheets.length,
        totalWidthCombinations: Object.keys(grouped).length,
      },
    });
  } catch (error) {
    logError('Error fetching cost sheets grouped by width:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Update cost sheet
 * PUT /api/style-costing/:id
 * Note: Cannot update approved cost sheets
 */
export const updateCostSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = UpdateCostSheetSchema.parse(req.body);

    // Check if cost sheet exists
    const existingCostSheet = await prisma.style_costing.findUnique({
      where: { id },
    });

    if (!existingCostSheet) {
      res.status(404).json({ error: 'Cost sheet not found' });
      return;
    }

    // Cannot update approved cost sheets
    // Use approvalStatus if available (new enum), fallback to legacy isApproved
    const isApprovedCostSheet = (existingCostSheet as any).approvalStatus === 'APPROVED' ||
                                 existingCostSheet.isApproved;

    if (isApprovedCostSheet) {
      res.status(400).json({
        error: 'Cannot update approved cost sheet',
        message: 'Please create a new version if changes are needed. Approved cost sheets are locked to maintain pricing integrity.'
      });
      return;
    }

    // If rejected, reset the status to pending on update (allows resubmission)
    const shouldResetToPending = (existingCostSheet as any).approvalStatus === 'REJECTED';

    // Get current or updated values - use JSON parse/stringify for safe type conversion
    const fabricDetails = validatedData.fabricDetails || (existingCostSheet.fabricDetails as unknown as FabricDetail[]) || [];
    const trimsDetails = validatedData.trimsDetails || (existingCostSheet.trimsDetails as unknown as TrimDetail[]) || [];
    const cmtCosts = validatedData.cmtCosts || {
      cuttingCost: Number(existingCostSheet.cuttingCost),
      stitchingCost: Number(existingCostSheet.stitchingCost),
      finishingCost: Number(existingCostSheet.finishingCost),
      buttonAttachmentCost: Number(existingCostSheet.buttonAttachmentCost),
      handworkCost: Number(existingCostSheet.handworkCmtCost),
    };
    const embroideryDetails = validatedData.embroideryDetails || (existingCostSheet.embroideryDetails as unknown as EmbroideryDetail[]) || [];
    const accessoriesDetails = validatedData.accessoriesDetails || (existingCostSheet.accessoriesDetails as unknown as AccessoryDetail[]) || [];
    const valueLossPercent = validatedData.valueLossPercent ?? Number(existingCostSheet.valueLossPercent);
    const markupPercent = validatedData.markupPercent ?? Number(existingCostSheet.markupPercent);

    // Recalculate totals (excluding items marked as Not Applicable)
    const fabricTotal = fabricDetails
      .filter((f: FabricDetail) => !f.isNotApplicable)
      .reduce((sum: number, f: FabricDetail) => sum + (f.fabricTotal || 0), 0);
    const trimsTotal = trimsDetails
      .filter((t: TrimDetail) => !t.isNotApplicable)
      .reduce((sum: number, t: TrimDetail) => sum + (t.trimTotal || 0), 0);
    const cmtTotal = Object.values(cmtCosts).reduce((sum: number, c) => sum + (c as number || 0), 0);
    const embroideryTotal = embroideryDetails
      .filter((e: EmbroideryDetail) => !e.isNotApplicable)
      .reduce((sum: number, e: EmbroideryDetail) => sum + (e.embroideryTotal || 0), 0);
    const accessoriesTotal = accessoriesDetails
      .filter((a: AccessoryDetail) => !a.isNotApplicable)
      .reduce((sum: number, a: AccessoryDetail) => sum + (a.accessoryTotal || 0), 0);

    const subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal + accessoriesTotal;
    const valueLossAmount = (subtotal * valueLossPercent) / 100;
    const totalAfterValueLoss = subtotal + valueLossAmount;
    const markupAmount = (totalAfterValueLoss * markupPercent) / 100;
    const totalProductCost = totalAfterValueLoss + markupAmount;

    // Calculate derived cost fields for display
    const totalMaterialCost = fabricTotal + trimsTotal + accessoriesTotal;
    const totalProcessingCost = embroideryTotal + cmtTotal;
    const totalCostPerPiece = totalProductCost;
    const sellingPricePerPiece = totalProductCost;

    // Build update data
    const updateData: Prisma.style_costingUpdateInput = {
      // If previously rejected, reset to pending so it can be resubmitted for approval
      ...(shouldResetToPending && {
        approvalStatus: 'PENDING',
        rejectionNotes: null,
      }),
      // Update purpose/mode if provided
      ...(validatedData.purpose !== undefined && { purpose: validatedData.purpose }),
      ...(validatedData.numberOfComponents !== undefined && { numberOfComponents: validatedData.numberOfComponents }),
      ...(validatedData.category !== undefined && { category: validatedData.category }),
      ...(validatedData.subCategory !== undefined && { subCategory: validatedData.subCategory }),

      ...(validatedData.fabricDetails && { fabricDetails: JSON.parse(JSON.stringify(validatedData.fabricDetails)) }),
      fabricTotal,

      ...(validatedData.trimsDetails && { trimsDetails: JSON.parse(JSON.stringify(validatedData.trimsDetails)) }),
      trimsTotal,

      ...(validatedData.cmtCosts && {
        cuttingCost: cmtCosts.cuttingCost,
        stitchingCost: cmtCosts.stitchingCost,
        finishingCost: cmtCosts.finishingCost,
        buttonAttachmentCost: cmtCosts.buttonAttachmentCost,
        handworkCmtCost: cmtCosts.handworkCost,
      }),
      cmtTotal,

      ...(validatedData.embroideryDetails && { embroideryDetails: JSON.parse(JSON.stringify(validatedData.embroideryDetails)) }),
      embroideryTotal,

      ...(validatedData.accessoriesDetails && { accessoriesDetails: JSON.parse(JSON.stringify(validatedData.accessoriesDetails)) }),
      accessoriesTotal,

      ...(validatedData.valueLossPercent !== undefined && { valueLossPercent }),
      valueLossAmount,

      ...(validatedData.markupPercent !== undefined && { markupPercent }),
      markupAmount,

      subtotal,
      totalProductCost,
      totalMaterialCost,
      totalProcessingCost,
      totalCostPerPiece,
      sellingPricePerPiece,

      ...(validatedData.notes !== undefined && { notes: validatedData.notes }),

      // Closed Cost - Final agreed price with customer
      ...(validatedData.closedCost !== undefined && { closedCost: validatedData.closedCost }),
      ...(validatedData.closedCostNotes !== undefined && { closedCostNotes: validatedData.closedCostNotes }),
    };

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
      },
    });

    res.json({
      success: true,
      data: updatedCostSheet,
      message: 'Cost sheet updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.issues,
      });
      return;
    }

    logError('Error updating cost sheet:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

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

/**
 * Delete cost sheet (soft delete by setting as inactive)
 * DELETE /api/style-costing/:id
 * Note: Cannot delete approved cost sheets
 */
export const deleteCostSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const costSheet = await prisma.style_costing.findUnique({
      where: { id },
    });

    if (!costSheet) {
      res.status(404).json({ error: 'Cost sheet not found' });
      return;
    }

    // Cannot delete approved cost sheets
    if (costSheet.isApproved) {
      res.status(400).json({
        error: 'Cannot delete approved cost sheet',
        message: 'Approved cost sheets cannot be deleted for audit purposes'
      });
      return;
    }

    // Soft delete by removing the record (or you could add an isActive field)
    await prisma.style_costing.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Cost sheet deleted successfully',
    });
  } catch (error) {
    logError('Error deleting cost sheet:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Auto-generate cost sheet from approved CAD data
 * POST /api/style-costing/generate/:styleId
 */
export const generateCostSheetFromStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get style with all related data
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: true,
                cadRows: {
                  where: {
                    purpose: 'COSTING',
                  },
                  orderBy: { updatedAt: 'desc' },
                  take: 1, // Get latest COSTING CAD
                },
              },
            },
          },
        },
        style_material_bom: {
          include: {
            lace_master: true,
            button_master: true,
            thread_master: true,
            zipper_master: true,
            elastic_master: true,
            label_master: true,
            packaging_master: true,
            machine_part_master: true,
            other_material_master: true,
          },
        },
        style_processes: true,
      },
    });

    if (!style) {
      res.status(404).json({ error: 'Style not found' });
      return;
    }

    // Validate CAD is approved - check for either COSTING or RAW_MATERIAL_CALCULATION approved CAD
    // This allows users to skip COSTING mode and go directly to RAW_MATERIAL_CALCULATION for confirmed orders
    const hasApprovedCad = await prisma.fabric_width_cad.findFirst({
      where: {
        costingStyleId: styleId,
        purpose: { in: ['COSTING', 'RAW_MATERIAL_CALCULATION'] },
        approvalStatus: 'APPROVED',
      },
    });

    if (!hasApprovedCad && style.cadStatus !== 'APPROVED') {
      res.status(400).json({
        error: 'CAD not approved',
        message: 'CAD planning (COSTING or RAW_MATERIAL_CALCULATION) must be approved before generating cost sheet',
        currentStatus: style.cadStatus,
      });
      return;
    }

    // Check if cost sheet already exists - warn but still return preview data
    const existingCostSheet = await prisma.style_costing.findFirst({
      where: { styleId },
    });

    if (existingCostSheet) {
      logWarn(`Cost sheet already exists for style ${styleId}, returning preview only`);
    }

    // Fetch COSTING CAD data directly from fabric_width_cad by costingStyleId
    // This is where Fabric Costing saves data (not through styleFabricId)
    const costingCadRows = await prisma.fabric_width_cad.findMany({
      where: {
        costingStyleId: styleId,
        purpose: 'COSTING',
      },
      include: {
        fabric: { select: { fabricName: true } },
        greige: { select: { greigeName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Calculate fabric costs from COSTING CAD rows
    let totalFabricCost = 0;
    const fabricDetails: FabricDetail[] = [];

    // Group by componentName to avoid duplicates (take latest per component)
    const processedComponents = new Set<string>();

    for (const cadRow of costingCadRows) {
      const componentKey = cadRow.componentName || 'default';

      // Skip if we already processed this component (we have latest first)
      if (processedComponents.has(componentKey)) {
        continue;
      }
      processedComponents.add(componentKey);

      const fabricWidth = parseFloat(cadRow.cutableWidth?.toString() || '0');
      // Calculate CAD average (per-piece consumption) - NO fallback to cadMeters (layer length is useless for costing)
      let fabricAverage = 0;
      if (cadRow.cadAverage) {
        // Use stored cadAverage (per-piece consumption)
        fabricAverage = parseFloat(cadRow.cadAverage.toString());
      } else if (cadRow.cadMeters && cadRow.piecesPerMarker && cadRow.piecesPerMarker > 0) {
        // Calculate on-the-fly: (layerLength + margin) / pieces
        const layerLength = parseFloat(cadRow.cadMeters.toString());
        const layerMargin = cadRow.layerMarginMeters ? parseFloat(cadRow.layerMarginMeters.toString()) : 0;
        fabricAverage = (layerLength + layerMargin) / cadRow.piecesPerMarker;
      }
      // If neither available, fabricAverage stays 0 (will be skipped by the check below)
      const fabricRate = parseFloat(cadRow.totalCostPerMeter?.toString() || '0');

      // Skip if no meaningful data
      if (fabricAverage === 0 && fabricRate === 0) {
        logWarn(`CAD row ${cadRow.id} has no consumption or cost data - skipping`);
        continue;
      }

      const fabricCost = fabricAverage * fabricRate;
      totalFabricCost += fabricCost;

      fabricDetails.push({
        fabricName: cadRow.fabric?.fabricName || cadRow.greige?.greigeName || cadRow.componentName || 'Unknown Fabric',
        fabricWidth: fabricWidth,
        fabricAverage: fabricAverage,
        fabricRate: fabricRate,
        fabricTotal: fabricCost,
      });
    }

    // Fallback 1: If no COSTING CAD rows found, try RAW_MATERIAL_CALCULATION mode
    // This allows users to skip COSTING mode and generate cost sheets from RAW_MATERIAL_CALCULATION data
    if (fabricDetails.length === 0) {
      logWarn(`No COSTING CAD data found for style ${styleId} - trying RAW_MATERIAL_CALCULATION`);

      const rmcCadRows = await prisma.fabric_width_cad.findMany({
        where: {
          costingStyleId: styleId,
          purpose: 'RAW_MATERIAL_CALCULATION',
        },
        include: {
          fabric: { select: { fabricName: true } },
          greige: { select: { greigeName: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      for (const cadRow of rmcCadRows) {
        const componentKey = cadRow.componentName || 'default';

        // Skip if we already processed this component (we have latest first)
        if (processedComponents.has(componentKey)) {
          continue;
        }
        processedComponents.add(componentKey);

        const fabricWidth = parseFloat(cadRow.cutableWidth?.toString() || '0');
        // Calculate CAD average (per-piece consumption) - NO fallback to cadMeters (layer length is useless for costing)
        let fabricAverage = 0;
        if (cadRow.cadAverage) {
          // Use stored cadAverage (per-piece consumption)
          fabricAverage = parseFloat(cadRow.cadAverage.toString());
        } else if (cadRow.cadMeters && cadRow.piecesPerMarker && cadRow.piecesPerMarker > 0) {
          // Calculate on-the-fly: (layerLength + margin) / pieces
          const layerLength = parseFloat(cadRow.cadMeters.toString());
          const layerMargin = cadRow.layerMarginMeters ? parseFloat(cadRow.layerMarginMeters.toString()) : 0;
          fabricAverage = (layerLength + layerMargin) / cadRow.piecesPerMarker;
        }
        // If neither available, fabricAverage stays 0 (will be skipped by the check below)
        const fabricRate = parseFloat(cadRow.totalCostPerMeter?.toString() || '0');

        // Skip if no meaningful data
        if (fabricAverage === 0 && fabricRate === 0) {
          logWarn(`RAW_MATERIAL_CALCULATION CAD row ${cadRow.id} has no consumption or cost data - skipping`);
          continue;
        }

        const fabricCost = fabricAverage * fabricRate;
        totalFabricCost += fabricCost;

        fabricDetails.push({
          fabricName: cadRow.fabric?.fabricName || cadRow.greige?.greigeName || cadRow.componentName || 'Unknown Fabric',
          fabricWidth: fabricWidth,
          fabricAverage: fabricAverage,
          fabricRate: fabricRate,
          fabricTotal: fabricCost,
        });
      }
    }

    // Fallback 2: If still no CAD data, try legacy style_fabrics data
    if (fabricDetails.length === 0) {
      logWarn(`No CAD data found for style ${styleId} - falling back to style_fabrics`);

      for (const component of style.style_components) {
        for (const styleFabric of component.style_fabrics) {
          // Use deprecated cadAverageMeters field
          const fabricAverage = parseFloat(styleFabric.cadAverageMeters?.toString() || '0');

          if (fabricAverage === 0) {
            continue;
          }

          const fabricWidth = parseFloat(styleFabric.cutableWidth?.toString() || '0');
          const fabricRate = parseFloat(
            styleFabric.unitPrice?.toString() ||
            styleFabric.fabricCostPerMeter?.toString() ||
            '0'
          );

          const fabricCost = fabricAverage * fabricRate;
          totalFabricCost += fabricCost;

          fabricDetails.push({
            fabricName: styleFabric.fabric?.fabricName || styleFabric.fabricName || 'Unknown',
            fabricWidth: fabricWidth,
            fabricAverage: fabricAverage,
            fabricRate: fabricRate,
            fabricTotal: fabricCost,
          });
        }
      }
    }

    // Calculate material costs from BOM
    let totalTrimsCost = 0;
    let totalAccessoriesCost = 0;
    let totalEmbroideryMaterialCost = 0;
    const trimsDetails: TrimDetail[] = [];
    const accessoriesDetails: AccessoryDetail[] = [];
    const embroideryDetails: EmbroideryDetail[] = [];

    for (const bom of style.style_material_bom) {
      const quantity = parseFloat(bom.quantityPerGarment.toString());

      // Get material name and price from appropriate master table
      let materialName = 'Unknown';
      let masterPrice = 0;

      if (bom.lace_master) {
        materialName = bom.lace_master.laceName;
        masterPrice = parseFloat(bom.lace_master.pricePerMeter?.toString() || '0');
      } else if (bom.button_master) {
        materialName = bom.button_master.buttonName;
        masterPrice = parseFloat(bom.button_master.pricePerPiece?.toString() || '0');
      } else if (bom.thread_master) {
        materialName = bom.thread_master.threadName;
        masterPrice = parseFloat(bom.thread_master.pricePerCone?.toString() || '0');
      } else if (bom.zipper_master) {
        materialName = bom.zipper_master.zipperName;
        masterPrice = parseFloat(bom.zipper_master.pricePerPiece?.toString() || '0');
      } else if (bom.elastic_master) {
        materialName = bom.elastic_master.elasticName;
        masterPrice = parseFloat(bom.elastic_master.pricePerMeter?.toString() || '0');
      } else if (bom.label_master) {
        materialName = bom.label_master.labelName;
        masterPrice = parseFloat(bom.label_master.pricePerPiece?.toString() || '0');
      } else if (bom.packaging_master) {
        materialName = bom.packaging_master.packagingName;
        masterPrice = parseFloat(bom.packaging_master.pricePerPiece?.toString() || '0');
      }

      // Use BOM unitPrice if set, otherwise fallback to master price
      const unitPrice = parseFloat(bom.unitPrice?.toString() || '0') || masterPrice;
      const total = quantity * unitPrice;

      logInfo(`Processing BOM item: ${materialName}`, {
        quantity,
        unitPrice,
        masterPrice,
        total,
        usageCategory: bom.usageCategory,
        materialType: bom.materialType,
      });

      // Route to appropriate category based on usageCategory
      if (bom.usageCategory === 'GARMENT_TRIM') {
        trimsDetails.push({
          trimName: materialName,
          trimQuantity: quantity,
          trimRate: unitPrice,
          trimTotal: total,
        });
        totalTrimsCost += total;
      } else if (bom.usageCategory === 'PACKAGING') {
        accessoriesDetails.push({
          accessoryName: materialName,
          accessoryQuantity: quantity,
          accessoryRate: unitPrice,
          accessoryTotal: total,
        });
        totalAccessoriesCost += total;
      } else if (bom.usageCategory === 'VALUE_ADDITION') {
        // VALUE_ADDITION materials (special lace, embroidery materials) go to embroidery
        embroideryDetails.push({
          embroideryName: materialName,
          embroideryAverage: quantity,
          embroideryRate: unitPrice,
          embroideryTotal: total,
        });
        totalEmbroideryMaterialCost += total;
      } else {
        // Bug fix: Uncategorized materials default to trims to ensure nothing is lost
        logWarn(`BOM item "${materialName}" has no usageCategory (${bom.usageCategory}), defaulting to trims`);
        trimsDetails.push({
          trimName: materialName,
          trimQuantity: quantity,
          trimRate: unitPrice,
          trimTotal: total,
        });
        totalTrimsCost += total;
      }
    }

    // Calculate process costs
    let totalProcessingCost = 0;
    for (const process of style.style_processes) {
      if (process.estimatedCost) {
        totalProcessingCost += parseFloat(process.estimatedCost.toString());
      }
    }

    // Get number of components
    const numberOfComponents = style.style_components.length;

    // Get category from style (if available)
    const category = style.categoryId || '';
    const subCategory = '';

    // Ensure we have at least default thread trim
    if (trimsDetails.length === 0) {
      trimsDetails.push({
        trimName: 'Thread',
        trimQuantity: 0,
        trimRate: 0,
        trimTotal: 0,
      });
    }

    logInfo(`Cost sheet preview generated for style ${style.styleCode}`, {
      fabricCount: fabricDetails.length,
      trimsCount: trimsDetails.length,
      embroideryCount: embroideryDetails.length,
      accessoriesCount: accessoriesDetails.length,
      existingCostSheet: existingCostSheet ? existingCostSheet.id : null,
    });

    // Calculate total from all sources
    const grandTotal = totalFabricCost + totalTrimsCost + totalEmbroideryMaterialCost + totalAccessoriesCost + totalProcessingCost;

    // Return preview data WITHOUT creating in database
    // The frontend will use this to pre-fill the form, then user submits to actually create
    res.status(200).json({
      success: true,
      data: {
        // Basic Information for pre-fill
        numberOfComponents,
        category,
        subCategory,

        // Fabric details for pre-fill
        fabricDetails,
        fabricTotal: totalFabricCost,

        // Trims details for pre-fill
        trimsDetails,
        trimsTotal: totalTrimsCost,

        // Embroidery/Value Addition details for pre-fill
        embroideryDetails,
        embroideryTotal: totalEmbroideryMaterialCost,

        // Accessories/Packaging details for pre-fill
        accessoriesDetails,
        accessoriesTotal: totalAccessoriesCost,

        // Processing costs (for info)
        totalProcessingCost,

        // Defaults
        valueLossPercent: 2,
        markupPercent: 15,

        // Warning if cost sheet already exists
        existingCostSheetId: existingCostSheet?.id || null,
      },
      message: existingCostSheet
        ? 'Preview generated. Note: A cost sheet already exists for this style.'
        : 'Preview generated. Review and fill in CMT costs, then save.',
      summary: {
        autoCalculated: {
          fabricCost: totalFabricCost,
          trimsCost: totalTrimsCost,
          embroideryCost: totalEmbroideryMaterialCost,
          accessoriesCost: totalAccessoriesCost,
          processingCost: totalProcessingCost,
          total: grandTotal,
        },
        needsUserInput: [
          'Cutting Cost',
          'Stitching Cost',
          'Finishing Cost',
          'Button Attachment Cost',
          'Handwork Cost',
        ],
      },
    });
  } catch (error) {
    logError('Error generating cost sheet:', error);
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
        message: 'Please provide a reason for creating a new version (e.g., "Updated fabric costs", "New CAD values")'
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
        message: 'Only approved cost sheets can be versioned. Please approve the current version first or update it directly.'
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
        ...((sourceCostSheet as any).widthCombinationHash && { widthCombinationHash: (sourceCostSheet as any).widthCombinationHash }),
        ...((sourceCostSheet as any).widthCombinationDescription && { widthCombinationDescription: (sourceCostSheet as any).widthCombinationDescription }),
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
        changePercent: costSheet1.fabricTotal && Number(costSheet1.fabricTotal) !== 0
          ? ((Number(costSheet2.fabricTotal) - Number(costSheet1.fabricTotal)) / Number(costSheet1.fabricTotal)) * 100
          : 0,
      },
      trimsTotal: {
        v1: Number(costSheet1.trimsTotal),
        v2: Number(costSheet2.trimsTotal),
        change: Number(costSheet2.trimsTotal) - Number(costSheet1.trimsTotal),
        changePercent: costSheet1.trimsTotal && Number(costSheet1.trimsTotal) !== 0
          ? ((Number(costSheet2.trimsTotal) - Number(costSheet1.trimsTotal)) / Number(costSheet1.trimsTotal)) * 100
          : 0,
      },
      cmtTotal: {
        v1: Number(costSheet1.cmtTotal),
        v2: Number(costSheet2.cmtTotal),
        change: Number(costSheet2.cmtTotal) - Number(costSheet1.cmtTotal),
        changePercent: costSheet1.cmtTotal && Number(costSheet1.cmtTotal) !== 0
          ? ((Number(costSheet2.cmtTotal) - Number(costSheet1.cmtTotal)) / Number(costSheet1.cmtTotal)) * 100
          : 0,
      },
      totalProductCost: {
        v1: Number(costSheet1.totalProductCost),
        v2: Number(costSheet2.totalProductCost),
        change: Number(costSheet2.totalProductCost) - Number(costSheet1.totalProductCost),
        changePercent: costSheet1.totalProductCost && Number(costSheet1.totalProductCost) !== 0
          ? ((Number(costSheet2.totalProductCost) - Number(costSheet1.totalProductCost)) / Number(costSheet1.totalProductCost)) * 100
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

    logInfo(`[copyCostSheetForProcurement] Creating PROCUREMENT_PRODUCTION cost sheet from COSTING ${sourceCostSheetId}`);

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
      message: 'Procurement cost sheet created successfully. Please review budget values, adjust buffer percentages if needed, and approve when ready.',
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
    const {
      fabricActual,
      trimsActual,
      cmtActual,
      embroideryActual,
      accessoriesActual,
      totalActual,
    } = req.body;

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
