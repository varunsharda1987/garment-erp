import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { logInfo, logError, logWarn } from '../utils/logger';

const prisma = new PrismaClient();

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
}

interface TrimDetail {
  trimName: string;
  trimQuantity: number;
  trimRate: number;
  trimTotal: number;
}

interface EmbroideryDetail {
  embroideryName: string;
  embroideryAverage: number;
  embroideryRate: number;
  embroideryTotal: number;
}

interface AccessoryDetail {
  accessoryName: string;
  accessoryQuantity: number;
  accessoryRate: number;
  accessoryTotal: number;
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
});

const TrimDetailSchema = z.object({
  trimName: z.string().min(1, 'Trim name is required'),
  trimQuantity: z.number().nonnegative('Trim quantity must be non-negative'),
  trimRate: z.number().nonnegative('Trim rate must be non-negative'),
  trimTotal: z.number().nonnegative('Trim total must be non-negative'),
});

const EmbroideryDetailSchema = z.object({
  embroideryName: z.string().min(1, 'Embroidery name is required'),
  embroideryAverage: z.number().nonnegative('Embroidery average must be non-negative'),
  embroideryRate: z.number().nonnegative('Embroidery rate must be non-negative'),
  embroideryTotal: z.number().nonnegative('Embroidery total must be non-negative'),
});

const AccessoryDetailSchema = z.object({
  accessoryName: z.string().min(1, 'Accessory name is required'),
  accessoryQuantity: z.number().nonnegative('Accessory quantity must be non-negative'),
  accessoryRate: z.number().nonnegative('Accessory rate must be non-negative'),
  accessoryTotal: z.number().nonnegative('Accessory total must be non-negative'),
});

const CMTCostsSchema = z.object({
  cuttingCost: z.number().nonnegative('Cutting cost must be non-negative').default(0),
  stitchingCost: z.number().nonnegative('Stitching cost must be non-negative').default(0),
  finishingCost: z.number().nonnegative('Finishing cost must be non-negative').default(0),
  buttonAttachmentCost: z.number().nonnegative('Button attachment cost must be non-negative').default(0),
  handworkCost: z.number().nonnegative('Handwork cost must be non-negative').default(0),
});

const CreateCostSheetSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),

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

    // Check if cost sheet already exists for this style
    const existingCostSheet = await prisma.style_costing.findUnique({
      where: { styleId: validatedData.styleId },
    });

    if (existingCostSheet) {
      res.status(400).json({
        error: 'Cost sheet already exists for this style',
        message: 'Use update endpoint to modify existing cost sheet'
      });
      return;
    }

    // Calculate totals from arrays
    const fabricTotal = validatedData.fabricDetails.reduce((sum, f) => sum + f.fabricTotal, 0);
    const trimsTotal = validatedData.trimsDetails.reduce((sum, t) => sum + t.trimTotal, 0);
    const cmtTotal = Object.values(validatedData.cmtCosts).reduce((sum, c) => sum + c, 0);
    const embroideryTotal = validatedData.embroideryDetails.reduce((sum, e) => sum + e.embroideryTotal, 0);
    const accessoriesTotal = validatedData.accessoriesDetails.reduce((sum, a) => sum + a.accessoryTotal, 0);

    // Calculate subtotal (before value loss and markup)
    const subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal + accessoriesTotal;

    // Calculate value loss
    const valueLossAmount = (subtotal * validatedData.valueLossPercent) / 100;
    const totalAfterValueLoss = subtotal + valueLossAmount;

    // Calculate markup
    const markupAmount = (totalAfterValueLoss * validatedData.markupPercent) / 100;
    const totalProductCost = totalAfterValueLoss + markupAmount;

    // Generate unique ID for cost sheet
    const costSheetId = `CS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create cost sheet
    const costSheet = await prisma.style_costing.create({
      data: {
        id: costSheetId,
        styleId: validatedData.styleId,

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

        // Additional
        notes: validatedData.notes,
        createdById: userId,
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
      where.isApproved = approved === 'true';
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

    const costSheet = await prisma.style_costing.findUnique({
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
    if (existingCostSheet.isApproved) {
      res.status(400).json({
        error: 'Cannot update approved cost sheet',
        message: 'Please create a new version if changes are needed'
      });
      return;
    }

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

    // Recalculate totals
    const fabricTotal = fabricDetails.reduce((sum: number, f: FabricDetail) => sum + (f.fabricTotal || 0), 0);
    const trimsTotal = trimsDetails.reduce((sum: number, t: TrimDetail) => sum + (t.trimTotal || 0), 0);
    const cmtTotal = Object.values(cmtCosts).reduce((sum: number, c) => sum + (c as number || 0), 0);
    const embroideryTotal = embroideryDetails.reduce((sum: number, e: EmbroideryDetail) => sum + (e.embroideryTotal || 0), 0);
    const accessoriesTotal = accessoriesDetails.reduce((sum: number, a: AccessoryDetail) => sum + (a.accessoryTotal || 0), 0);

    const subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal + accessoriesTotal;
    const valueLossAmount = (subtotal * valueLossPercent) / 100;
    const totalAfterValueLoss = subtotal + valueLossAmount;
    const markupAmount = (totalAfterValueLoss * markupPercent) / 100;
    const totalProductCost = totalAfterValueLoss + markupAmount;

    // Build update data
    const updateData: Prisma.style_costingUpdateInput = {
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

      ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
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
 */
export const approveCostSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (typeof approved !== 'boolean') {
      res.status(400).json({ error: 'Approved field must be a boolean' });
      return;
    }

    const costSheet = await prisma.style_costing.findUnique({
      where: { id },
    });

    if (!costSheet) {
      res.status(404).json({ error: 'Cost sheet not found' });
      return;
    }

    const updatedCostSheet = await prisma.style_costing.update({
      where: { id },
      data: {
        isApproved: approved,
        approvedById: approved ? userId : null,
        approvedAt: approved ? new Date() : null,
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

    res.json({
      success: true,
      data: updatedCostSheet,
      message: approved ? 'Cost sheet approved successfully' : 'Cost sheet approval revoked',
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
                fabricCAD: true, // Must have approved CAD
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
          },
        },
        style_processes: true,
      },
    });

    if (!style) {
      res.status(404).json({ error: 'Style not found' });
      return;
    }

    // Validate CAD is approved
    if (style.cadStatus !== 'APPROVED') {
      res.status(400).json({
        error: 'CAD not approved',
        message: 'CAD planning must be approved before generating cost sheet',
        currentStatus: style.cadStatus,
      });
      return;
    }

    // Check if cost sheet already exists - warn but still return preview data
    const existingCostSheet = await prisma.style_costing.findUnique({
      where: { styleId },
    });

    if (existingCostSheet) {
      logWarn(`Cost sheet already exists for style ${styleId}, returning preview only`);
    }

    // Calculate fabric costs from approved CAD or style_fabrics data
    let totalFabricCost = 0;
    const fabricDetails: FabricDetail[] = [];

    for (const component of style.style_components) {
      for (const styleFabric of component.style_fabrics) {
        // Get CAD data from fabricCAD relation OR fallback to style_fabrics fields
        const cad = styleFabric.fabricCAD;

        // Get fabric average - prefer fabricCAD, fallback to cadAverageMeters on style_fabrics
        let fabricAverage = 0;
        let fabricWidth = 0;

        if (cad) {
          fabricAverage = parseFloat(cad.cadMeters?.toString() || '0');
          fabricWidth = parseFloat(cad.cutableWidth?.toString() || '0');
        } else if (styleFabric.cadAverageMeters) {
          // Fallback to deprecated fields on style_fabrics
          fabricAverage = parseFloat(styleFabric.cadAverageMeters.toString());
          fabricWidth = parseFloat(styleFabric.cutableWidth?.toString() || '0');
        }

        // Skip if no CAD data available at all
        if (fabricAverage === 0) {
          logWarn(`Style fabric ${styleFabric.id} has no CAD data - skipping`);
          continue;
        }

        // Get fabric rate - from unitPrice or fabricCostPerMeter
        const fabricRate = parseFloat(
          styleFabric.unitPrice?.toString() ||
          styleFabric.fabricCostPerMeter?.toString() ||
          '0'
        );

        const fabricCost = fabricAverage * fabricRate;

        fabricDetails.push({
          fabricName: styleFabric.fabric?.fabricName || styleFabric.fabricName || 'Unknown',
          fabricWidth: fabricWidth,
          fabricAverage: fabricAverage,
          fabricRate: fabricRate,
          fabricTotal: fabricCost,
        });

        totalFabricCost += fabricCost;
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
