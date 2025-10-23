// Style Master controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ProductionStage } from '@prisma/client';

/**
 * Create new style with components and processes
 * POST /api/styles
 */
export const createStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      styleCode,
      styleName,
      buyerName,
      brandName,
      category,
      description,
      season,
      components,
      processes,
      garmentTrims,
      valueAdditions,
      packagingTrims,
    } = req.body;

    // Validation
    if (!styleCode || !styleName || !buyerName || !brandName) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'styleCode, styleName, buyerName, and brandName are required',
      });
      return;
    }

    // Check for duplicate style code
    const existingStyle = await prisma.style.findUnique({
      where: { styleCode },
    });

    if (existingStyle) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Style code already exists',
      });
      return;
    }

    // Create style with nested components, fabrics, and processes
    const style = await prisma.style.create({
      data: {
        styleCode,
        styleName,
        buyerName,
        brandName,
        description,
        season,
        createdById: req.user?.userId || 'system',
        specifications: category || null, // Store category in specifications field for now
        components: {
          create: components?.map((comp: any, index: number) => ({
            componentName: comp.componentName,
            componentType: comp.componentType,
            sortOrder: index,
            fabrics: {
              create: comp.fabrics?.map((fabric: any) => ({
                fabricName: fabric.fabricName,
                fabricType: fabric.fabricType,
                greigeName: fabric.greigeName || null,
              })) || [],
            },
          })) || [],
        },
        processes: {
          create: processes?.map((proc: any, index: number) => ({
            processName: proc.processName,
            processType: proc.processType || proc.processName,
            isRequired: proc.isRequired !== false,
            sortOrder: index,
            vendorName: proc.vendorName || null,
            estimatedCost: proc.estimatedCost || null,
            estimatedDays: proc.estimatedDays || null,
            notes: proc.notes || null,
          })) || [],
        },
        garmentTrims: {
          create: garmentTrims?.map((trim: any) => ({
            trimName: trim.trimName,
            trimType: trim.trimType || '',
            quantityPerPiece: parseFloat(trim.quantityPerPiece) || 0,
            unit: trim.unit || 'pcs',
            supplier: trim.supplier || null,
          })) || [],
        },
        valueAdditions: {
          create: valueAdditions
            ?.filter((va: any) => va.additionType && va.description)
            .map((va: any) => ({
              additionType: va.additionType,
              description: va.description || null,
              estimatedCost: va.estimatedCost ? parseFloat(va.estimatedCost) : null,
              vendor: va.vendor || null,
            })) || [],
        },
        packaging: {
          create: packagingTrims?.map((pkg: any) => ({
            itemName: pkg.itemName,
            itemType: pkg.itemType || 'polybag',
            specification: pkg.specification || null,
            quantityPerPack: parseInt(pkg.quantityPerPack) || 1,
          })) || [],
        },
      },
      include: {
        components: {
          include: {
            fabrics: true,
            accessories: true,
          },
        },
        processes: true,
        costing: true,
        garmentTrims: true,
        valueAdditions: true,
        packaging: true,
      },
    });


    res.status(201).json({
      data: style,
      message: 'Style created successfully',
    });
  } catch (error) {
    console.error('Create style error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create style',
    });
  }
};

/**
 * Get all styles with pagination and search
 * GET /api/styles
 */
export const getAllStyles = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const stage = req.query.stage as string;

    const whereClause: any = { isActive: true };

    // Search filter
    if (search) {
      whereClause.OR = [
        { styleCode: { contains: search, mode: 'insensitive' } },
        { styleName: { contains: search, mode: 'insensitive' } },
        { buyerName: { contains: search, mode: 'insensitive' } },
        { brandName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Stage filter
    if (stage) {
      whereClause.productionTracking = {
        some: {
          currentStage: stage as ProductionStage,
          piecesInStage: { gt: 0 },
        },
      };
    }

    const totalStyles = await prisma.style.count({ where: whereClause });

    const styles = await prisma.style.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        components: {
          include: {
            fabrics: true,
            accessories: true,
          },
        },
        processes: true,
        costing: true,
        productionTracking: true,
        garmentTrims: true,
        valueAdditions: true,
        packaging: true,
        _count: {
          select: {
            components: true,
            processes: true,
            garmentTrims: true,
            valueAdditions: true,
            packaging: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      data: styles,
      pagination: {
        page,
        limit,
        total: totalStyles,
        totalPages: Math.ceil(totalStyles / limit),
      },
    });
  } catch (error) {
    console.error('Get all styles error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch styles',
    });
  }
};

/**
 * Get style by ID with all related data
 * GET /api/styles/:id
 */
export const getStyleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const style = await prisma.style.findUnique({
      where: { id },
      include: {
        components: {
          include: {
            fabrics: true,
            accessories: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
        processes: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        costing: true,
        productionTracking: true,
        garmentTrims: true,
        valueAdditions: true,
        packaging: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!style) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Style not found',
      });
      return;
    }

    res.status(200).json({ data: style });
  } catch (error) {
    console.error('Get style by ID error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch style',
    });
  }
};

/**
 * Update style
 * PUT /api/styles/:id
 */
export const updateStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      styleName,
      buyerName,
      brandName,
      description,
      season,
    } = req.body;

    const style = await prisma.style.update({
      where: { id },
      data: {
        styleName,
        buyerName,
        brandName,
        description,
        season,

      },
      include: {
        components: {
          include: {
            fabrics: true,
            accessories: true,
          },
        },
        processes: true,
        costing: true,
        garmentTrims: true,
        valueAdditions: true,
        packaging: true,
      },
    });

    res.status(200).json({
      data: style,
      message: 'Style updated successfully',
    });
  } catch (error) {
    console.error('Update style error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update style',
    });
  }
};

/**
 * Delete style (soft delete)
 * DELETE /api/styles/:id
 */
export const deleteStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.style.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(200).json({
      message: 'Style deleted successfully',
    });
  } catch (error) {
    console.error('Delete style error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete style',
    });
  }
};

/**
 * Upload style image
 * POST /api/styles/:id/image
 */
export const uploadStyleImage = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.file) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'No image file provided',
      });
      return;
    }

    const imageUrl = `/uploads/styles/${req.file.filename}`;

    const style = await prisma.style.update({
      where: { id },
      data: { imageUrl },
      select: {
        id: true,
        styleCode: true,
        imageUrl: true,
      },
    });

    res.status(200).json({
      data: style,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Upload style image error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to upload image',
    });
  }
};
