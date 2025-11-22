// Style Master controller - Force recompile
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ProductionStage } from '@prisma/client';
import { randomUUID } from 'crypto';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * Create new style with components and processes
 * POST /api/styles
 * Updated to include UUIDs for all child records
 */
export const createStyle = async (req: Request, res: Response): Promise<void> => {
  logDebug('🔥🔥🔥 CREATE STYLE ENDPOINT HIT 🔥🔥🔥');
  logDebug('Request method:', req.method);
  logDebug('Request URL:', req.url);
  logDebug('Request headers:', req.headers);

  try {
    logDebug('=== CREATE STYLE REQUEST ===');
    logDebug('Request body:', JSON.stringify(req.body, null, 2));

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

    logDebug('Components received:', components?.length || 0);
    logDebug('Garment trims received:', garmentTrims?.length || 0);
    logDebug('Value additions received:', valueAdditions?.length || 0);
    logDebug('Packaging trims received:', packagingTrims?.length || 0);

    // Validation
    if (!styleCode || !styleName || !buyerName || !brandName) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'styleCode, styleName, buyerName, and brandName are required',
      });
      return;
    }

    // Check for duplicate style code
    const existingStyle = await prisma.styles.findUnique({
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
    const style = await prisma.styles.create({
      data: {
        id: randomUUID(),
        styleCode,
        styleName,
        buyerName,
        brandName,
        description,
        season,
        createdById: req.user?.userId || 'system',
        specifications: category || null, // Store category in specifications field for now
        updatedAt: new Date(),
        style_components: {
          create: components?.map((comp: any, index: number) => ({
            id: randomUUID(),
            componentName: comp.componentName,
            componentType: comp.componentType,
            sortOrder: index,
            style_fabrics: {
              create: comp.fabrics?.map((fabric: any) => ({
                id: randomUUID(),
                fabricName: fabric.fabricName,
                fabricType: fabric.fabricType,
                greigeName: fabric.greigeName || null,
                cad_averages: {
                  create: fabric.cadAverages?.map((cad: any) => ({
                    id: randomUUID(),
                    fabric_width: parseFloat(cad.fabricWidth),
                    cad_average_meters: cad.cadAverageMeters ? parseFloat(cad.cadAverageMeters) : null,
                    cad_average_yards: cad.cadAverageYards ? parseFloat(cad.cadAverageYards) : null,
                    cad_wastage_percent: cad.cadWastagePercent ? parseFloat(cad.cadWastagePercent) : 2,
                    marker_efficiency: cad.markerEfficiency ? parseFloat(cad.markerEfficiency) : null,
                    marker_plan_file: cad.markerPlanFile || null,
                    is_preferred: cad.isPreferred || false,
                    notes: cad.notes || null,
                    updated_at: new Date(),
                  })) || [],
                },
              })) || [],
            },
          })) || [],
        },
        style_processes: {
          create: processes?.map((proc: any, index: number) => ({
            id: randomUUID(),
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
        style_garment_trims: {
          create: garmentTrims?.map((trim: any) => ({
            id: randomUUID(),
            trimName: trim.trimName,
            trimType: trim.trimType || '',
            quantityPerPiece: parseFloat(trim.quantityPerPiece) || 0,
            unit: trim.unit || 'pcs',
            supplier: trim.supplier || null,
            updatedAt: new Date(),
          })) || [],
        },
        style_value_additions: {
          create: valueAdditions
            ?.filter((va: any) => va.additionType)
            .map((va: any) => ({
              id: randomUUID(),
              additionType: va.additionType,
              description: va.description || null,
              type: va.type || null,
              numberOfItems: va.numberOfItems || null,
              updatedAt: new Date(),
            })) || [],
        },
        style_packaging: {
          create: packagingTrims?.map((pkg: any) => ({
            id: randomUUID(),
            itemName: pkg.itemName,
            itemType: pkg.itemType || 'polybag',
            specification: pkg.specification || null,
            quantityPerPack: parseInt(pkg.quantityPerPack) || 1,
            updatedAt: new Date(),
          })) || [],
        },
      },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                cad_averages: true,
              },
            },
            style_accessories: true,
          },
        },
        style_processes: true,
        style_costing: true,
        style_garment_trims: true,
        style_value_additions: true,
        style_packaging: true,
      },
    });


    res.status(201).json({
      data: style,
      message: 'Style created successfully',
    });
  } catch (error) {
    logError('Create style error:', error);
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

    const totalStyles = await prisma.styles.count({ where: whereClause });

    const styles = await prisma.styles.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        style_components: {
          include: {
            style_fabrics: true,
            style_accessories: true,
          },
        },
        style_processes: true,
        style_costing: true,
        style_production_tracking: true,
        style_garment_trims: true,
        style_value_additions: true,
        style_packaging: true,
        _count: {
          select: {
            style_components: true,
            style_processes: true,
            style_garment_trims: true,
            style_value_additions: true,
            style_packaging: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform Decimal fields in garment trims to numbers
    const transformedStyles = styles.map(style => ({
      ...style,
      style_garment_trims: style.style_garment_trims?.map(trim => ({
        ...trim,
        quantityPerPiece: trim.quantityPerPiece ? Number(trim.quantityPerPiece) : 0,
      })) || [],
    }));

    // The global transformation middleware will handle snake_case to camelCase conversion
    // and apply RELATION_MAPPINGS automatically
    res.status(200).json({
      data: transformedStyles,
      pagination: {
        page,
        limit,
        total: totalStyles,
        totalPages: Math.ceil(totalStyles / limit),
      },
    });
  } catch (error) {
    logError('Get all styles error:', error);
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

    const style = await prisma.styles.findUnique({
      where: { id },
      include: {
        color_options: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        size_options: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        style_components: {
          include: {
            style_fabrics: true,
            style_accessories: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
        style_processes: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        style_costing: true,
        style_production_tracking: true,
        style_garment_trims: true,
        style_value_additions: true,
        style_packaging: true,
        users: {
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

    // Transform Decimal fields in garment trims to numbers
    const transformedStyle = {
      ...style,
      style_garment_trims: style.style_garment_trims?.map(trim => ({
        ...trim,
        quantityPerPiece: trim.quantityPerPiece ? Number(trim.quantityPerPiece) : 0,
      })) || [],
    };

    // The global transformation middleware will handle snake_case to camelCase conversion
    // and apply RELATION_MAPPINGS automatically
    res.status(200).json({ data: transformedStyle });
  } catch (error) {
    logError('Get style by ID error:', error);
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

    const style = await prisma.styles.update({
      where: { id },
      data: {
        styleName,
        buyerName,
        brandName,
        description,
        season,

      },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                cad_averages: true,
              },
            },
            style_accessories: true,
          },
        },
        style_processes: true,
        style_costing: true,
        style_garment_trims: true,
        style_value_additions: true,
        style_packaging: true,
      },
    });

    res.status(200).json({
      data: style,
      message: 'Style updated successfully',
    });
  } catch (error) {
    logError('Update style error:', error);
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

    await prisma.styles.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(200).json({
      message: 'Style deleted successfully',
    });
  } catch (error) {
    logError('Delete style error:', error);
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

    const style = await prisma.styles.update({
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
    logError('Upload style image error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to upload image',
    });
  }
};

