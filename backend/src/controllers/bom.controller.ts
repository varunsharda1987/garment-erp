import { Request, Response } from 'express';
import { PrismaClient, Unit } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const BOMItemSchema = z.object({
  materialId: z.string().uuid('Invalid material ID'),
  quantityPerUnit: z.number().positive('Quantity must be positive'),
  unit: z.nativeEnum(Unit),
  wastagePercent: z.number().min(0).max(100).default(0),
  costPerUnit: z.number().nonnegative('Cost must be non-negative'),
  notes: z.string().optional(),
});

const CreateBOMSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  bomItems: z.array(BOMItemSchema).min(1, 'At least one BOM item is required'),
});

const UpdateBOMSchema = z.object({
  bomItems: z.array(BOMItemSchema).min(1, 'At least one BOM item is required'),
  isActive: z.boolean().optional(),
});

const ApproveBOMSchema = z.object({
  approved: z.boolean(),
});

// ============================================
// CONTROLLER METHODS
// ============================================

/**
 * Create a new Bill of Materials for a style
 * POST /api/bom
 */
export const createBOM = async (req: Request, res: Response) => {
  try {
    const validatedData = CreateBOMSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Check if style exists
    const style = await prisma.styles.findUnique({
      where: { id: validatedData.styleId },
    });

    if (!style) {
      return res.status(404).json({
        success: false,
        error: 'Style not found',
      });
    }

    // Get the next version number for this style
    const latestBOM = await prisma.bill_of_materials.findFirst({
      where: { styleId: validatedData.styleId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latestBOM ? latestBOM.version + 1 : 1;

    // Validate all materials exist
    const materialIds = validatedData.bomItems.map((item: { materialId: string }) => item.materialId);
    const materials = await prisma.materials.findMany({
      where: { id: { in: materialIds } },
    });

    if (materials.length !== materialIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more materials not found',
      });
    }

    // Calculate total cost
    const totalCost = validatedData.bomItems.reduce((sum: number, item: { quantityPerUnit: number; wastagePercent: number; costPerUnit: number }) => {
      const effectiveQuantity = item.quantityPerUnit * (1 + item.wastagePercent / 100);
      return sum + (effectiveQuantity * item.costPerUnit);
    }, 0);

    // Create BOM with items in a transaction
    const bom = await prisma.$transaction(async (tx) => {
      // Deactivate previous BOMs for this style
      await tx.bill_of_materials.updateMany({
        where: {
          styleId: validatedData.styleId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Create new BOM
      const newBOM = await tx.bill_of_materials.create({
        data: {
          id: uuidv4(),
          styleId: validatedData.styleId,
          version: nextVersion,
          totalCost: totalCost,
          createdById: userId,
          isActive: true,
          bom_items: {
            create: validatedData.bomItems.map((item: any) => ({
              id: uuidv4(),
              materialId: item.materialId,
              quantityPerUnit: item.quantityPerUnit,
              unit: item.unit,
              wastagePercent: item.wastagePercent,
              costPerUnit: item.costPerUnit,
              notes: item.notes,
            })),
          },
        } as any,
        include: {
          bom_items: {
            include: {
              materials: true,
            },
          },
          users_bill_of_materials_createdByIdTousers: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          users_bill_of_materials_approvedByIdTousers: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          styles: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
            },
          },
        },
      });

      return newBOM;
    });

    res.status(201).json({
      success: true,
      data: bom,
      message: `BOM version ${nextVersion} created successfully`,
    });
  } catch (error: any) {
    console.error('Error creating BOM:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create BOM',
      message: error.message,
    });
  }
};

/**
 * Get all BOMs with optional filtering
 * GET /api/bom
 */
export const getAllBOMs = async (req: Request, res: Response) => {
  try {
    const {
      styleId,
      isActive,
      approved,
      page = '1',
      limit = '20',
      search
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (styleId) {
      where.styleId = styleId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (approved === 'true') {
      where.approvedById = { not: null };
    } else if (approved === 'false') {
      where.approvedById = null;
    }

    if (search) {
      where.OR = [
        {
          styles: {
            styleCode: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
        },
        {
          styles: {
            styleName: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const [boms, total] = await Promise.all([
      prisma.bill_of_materials.findMany({
        where,
        include: {
          bom_items: {
            include: {
              materials: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: true,
                },
              },
            },
          },
          users_bill_of_materials_createdByIdTousers: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          users_bill_of_materials_approvedByIdTousers: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          styles: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
              image: true,
              imageUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.bill_of_materials.count({ where }),
    ]);

    // Transform Decimal fields to numbers for frontend
    const transformedBOMs = boms.map(bom => ({
      ...bom,
      totalCost: bom.totalCost ? Number(bom.totalCost) : null,
      bom_items: bom.bom_items.map(item => ({
        ...item,
        quantityPerUnit: Number(item.quantityPerUnit),
        wastagePercent: Number(item.wastagePercent),
        costPerUnit: Number(item.costPerUnit),
        materials: item.materials || null,
      })),
    }));

    res.json({
      success: true,
      data: transformedBOMs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching BOMs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch BOMs',
      message: error.message,
    });
  }
};

/**
 * Get a single BOM by ID
 * GET /api/bom/:id
 */
export const getBOMById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bom = await prisma.bill_of_materials.findUnique({
      where: { id },
      include: {
        bom_items: {
          include: {
            materials: true,
          },
        },
        users_bill_of_materials_createdByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        users_bill_of_materials_approvedByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        styles: true,
      },
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        error: 'BOM not found',
      });
    }

    // Transform Decimal fields to numbers for frontend
    const transformedBOM = {
      ...bom,
      totalCost: bom.totalCost ? Number(bom.totalCost) : null,
      bom_items: bom.bom_items.map(item => ({
        ...item,
        quantityPerUnit: Number(item.quantityPerUnit),
        wastagePercent: Number(item.wastagePercent),
        costPerUnit: Number(item.costPerUnit),
        materials: {
          ...item.materials,
          reorderLevel: item.materials.reorderLevel ? Number(item.materials.reorderLevel) : null,
        },
      })),
    };

    res.json({
      success: true,
      data: transformedBOM,
    });
  } catch (error: any) {
    console.error('Error fetching BOM:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch BOM',
      message: error.message,
    });
  }
};

/**
 * Get active BOM for a style
 * GET /api/bom/style/:styleId/active
 */
export const getActiveBOMByStyle = async (req: Request, res: Response) => {
  try {
    const { styleId } = req.params;

    const bom = await prisma.bill_of_materials.findFirst({
      where: {
        styleId,
        isActive: true,
      },
      include: {
        bom_items: {
          include: {
            materials: true,
          },
        },
        users_bill_of_materials_createdByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        users_bill_of_materials_approvedByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
            image: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        error: 'No active BOM found for this style',
      });
    }

    // Transform Decimal fields to numbers for frontend
    const transformedBOM = {
      ...bom,
      totalCost: bom.totalCost ? Number(bom.totalCost) : null,
      bom_items: bom.bom_items.map(item => ({
        ...item,
        quantityPerUnit: Number(item.quantityPerUnit),
        wastagePercent: Number(item.wastagePercent),
        costPerUnit: Number(item.costPerUnit),
        materials: {
          ...item.materials,
          reorderLevel: item.materials.reorderLevel ? Number(item.materials.reorderLevel) : null,
        },
      })),
    };

    res.json({
      success: true,
      data: transformedBOM,
    });
  } catch (error: any) {
    console.error('Error fetching active BOM:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active BOM',
      message: error.message,
    });
  }
};

/**
 * Get all BOM versions for a style
 * GET /api/bom/style/:styleId/versions
 */
export const getBOMVersionsByStyle = async (req: Request, res: Response) => {
  try {
    const { styleId } = req.params;

    const boms = await prisma.bill_of_materials.findMany({
      where: { styleId },
      include: {
        bom_items: {
          include: {
            materials: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
        users_bill_of_materials_createdByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        users_bill_of_materials_approvedByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        version: 'desc',
      },
    });

    // Transform Decimal fields to numbers for frontend
    const transformedBOMs = boms.map(bom => ({
      ...bom,
      totalCost: bom.totalCost ? Number(bom.totalCost) : null,
      bom_items: bom.bom_items.map(item => ({
        ...item,
        quantityPerUnit: Number(item.quantityPerUnit),
        wastagePercent: Number(item.wastagePercent),
        costPerUnit: Number(item.costPerUnit),
      })),
    }));

    res.json({
      success: true,
      data: transformedBOMs,
    });
  } catch (error: any) {
    console.error('Error fetching BOM versions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch BOM versions',
      message: error.message,
    });
  }
};

/**
 * Update a BOM (creates a new version)
 * PUT /api/bom/:id
 */
export const updateBOM = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = UpdateBOMSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Get the current BOM
    const currentBOM = await prisma.bill_of_materials.findUnique({
      where: { id },
      include: { styles: true },
    });

    if (!currentBOM) {
      return res.status(404).json({
        success: false,
        error: 'BOM not found',
      });
    }

    // If BOM is already approved, create a new version instead
    if (currentBOM.approvedById) {
      return res.status(400).json({
        success: false,
        error: 'Cannot update approved BOM. Create a new version instead.',
      });
    }

    // Validate all materials exist
    const materialIds = validatedData.bomItems.map((item: { materialId: string }) => item.materialId);
    const materials = await prisma.materials.findMany({
      where: { id: { in: materialIds } },
    });

    if (materials.length !== materialIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more materials not found',
      });
    }

    // Calculate total cost
    const totalCost = validatedData.bomItems.reduce((sum: number, item: { quantityPerUnit: number; wastagePercent: number; costPerUnit: number }) => {
      const effectiveQuantity = item.quantityPerUnit * (1 + item.wastagePercent / 100);
      return sum + (effectiveQuantity * item.costPerUnit);
    }, 0);

    // Update BOM in a transaction
    const updatedBOM = await prisma.$transaction(async (tx) => {
      // Delete existing BOM items
      await tx.bom_items.deleteMany({
        where: { bomId: id },
      });

      // Update BOM
      const bom = await tx.bill_of_materials.update({
        where: { id },
        data: {
          totalCost: totalCost,
          isActive: validatedData.isActive ?? currentBOM.isActive,
          bom_items: {
            create: validatedData.bomItems.map((item: any) => ({
              materialId: item.materialId,
              quantityPerUnit: item.quantityPerUnit,
              unit: item.unit,
              wastagePercent: item.wastagePercent,
              costPerUnit: item.costPerUnit,
              notes: item.notes,
            })) as any,
          },
        },
        include: {
          bom_items: {
            include: {
              materials: true,
            },
          },
          users_bill_of_materials_createdByIdTousers: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          users_bill_of_materials_approvedByIdTousers: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          styles: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
            },
          },
        },
      });

      return bom;
    });

    res.json({
      success: true,
      data: updatedBOM,
      message: 'BOM updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating BOM:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update BOM',
      message: error.message,
    });
  }
};

/**
 * Approve or reject a BOM
 * PATCH /api/bom/:id/approve
 */
export const approveBOM = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved } = ApproveBOMSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const bom = await prisma.bill_of_materials.findUnique({
      where: { id },
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        error: 'BOM not found',
      });
    }

    if (bom.approvedById) {
      return res.status(400).json({
        success: false,
        error: 'BOM is already approved',
      });
    }

    const updatedBOM = await prisma.bill_of_materials.update({
      where: { id },
      data: {
        approvedById: approved ? userId : null,
        approvedAt: approved ? new Date() : null,
      },
      include: {
        bom_items: {
          include: {
            materials: true,
          },
        },
        users_bill_of_materials_createdByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        users_bill_of_materials_approvedByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: updatedBOM,
      message: approved ? 'BOM approved successfully' : 'BOM approval revoked',
    });
  } catch (error: any) {
    console.error('Error approving BOM:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to approve BOM',
      message: error.message,
    });
  }
};

/**
 * Delete a BOM (soft delete by deactivating)
 * DELETE /api/bom/:id
 */
export const deleteBOM = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bom = await prisma.bill_of_materials.findUnique({
      where: { id },
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        error: 'BOM not found',
      });
    }

    // If BOM is approved, don't allow deletion
    if (bom.approvedById) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete approved BOM. Deactivate it instead.',
      });
    }

    // Soft delete by deactivating
    await prisma.bill_of_materials.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'BOM deactivated successfully',
    });
  } catch (error: any) {
    console.error('Error deleting BOM:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete BOM',
      message: error.message,
    });
  }
};

/**
 * Calculate material requirements for an order quantity
 * POST /api/bom/:id/calculate
 */
export const calculateMaterialRequirements = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { orderQuantity } = req.body;

    if (!orderQuantity || orderQuantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid order quantity is required',
      });
    }

    const bom = await prisma.bill_of_materials.findUnique({
      where: { id },
      include: {
        bom_items: {
          include: {
            materials: true,
          },
        },
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
          },
        },
      },
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        error: 'BOM not found',
      });
    }

    // Calculate requirements for each material
    const requirements = bom.bom_items.map((item: any) => {
      const baseQuantity = Number(item.quantityPerUnit) * orderQuantity;
      const wastageQuantity = baseQuantity * (Number(item.wastagePercent) / 100);
      const totalQuantity = baseQuantity + wastageQuantity;
      const totalCost = totalQuantity * Number(item.costPerUnit);

      return {
        material: item.materials,
        quantityPerUnit: Number(item.quantityPerUnit),
        unit: item.unit,
        wastagePercent: Number(item.wastagePercent),
        costPerUnit: Number(item.costPerUnit),
        baseQuantity,
        wastageQuantity,
        totalQuantity,
        totalCost,
      };
    });

    const totalMaterialCost = requirements.reduce((sum: number, req: any) => sum + req.totalCost, 0);

    res.json({
      success: true,
      data: {
        bom: {
          id: bom.id,
          version: bom.version,
          style: bom.styles,
        },
        orderQuantity,
        requirements,
        totalMaterialCost,
        costPerPiece: totalMaterialCost / orderQuantity,
      },
    });
  } catch (error: any) {
    console.error('Error calculating material requirements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate material requirements',
      message: error.message,
    });
  }
};
