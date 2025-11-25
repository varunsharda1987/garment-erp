// Style Master controller - Force recompile
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ProductionStage } from '@prisma/client';
import { randomUUID } from 'crypto';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';
import {
  generateSKU,
  checkMultipleSKUsExist,
  validateSKUFormat,
  getSizeOrder
} from '../utils/sku-generator';

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
      customerName,
      brandName,
      brandCategoryId,
      category,
      description,
      season,
      gender,
      components,
      processes,
      garmentTrims,        // DEPRECATED: Legacy field, use materialBOM instead
      valueAdditions,      // DEPRECATED: Legacy field, use processes instead
      packagingTrims,      // DEPRECATED: Legacy field, use materialBOM instead
      materialBOM,         // NEW: Unified material BOM for all materials (trims, accessories, packaging)
      customerAccessoriesPresetId, // NEW: Apply customer's default accessories
    } = req.body;

    logDebug('Components received:', components?.length || 0);
    logDebug('Material BOM received:', materialBOM?.length || 0);
    logDebug('Customer accessories preset ID:', customerAccessoriesPresetId);
    // Legacy fields for backward compatibility
    logDebug('Garment trims received (legacy):', garmentTrims?.length || 0);
    logDebug('Value additions received (legacy):', valueAdditions?.length || 0);
    logDebug('Packaging trims received (legacy):', packagingTrims?.length || 0);

    // Validation
    if (!styleCode || !styleName || !customerName || !brandName) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'styleCode, styleName, customerName, and brandName are required',
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

    // Load customer accessories preset if provided
    let presetAccessories: any[] = [];
    if (customerAccessoriesPresetId) {
      try {
        const preset = await prisma.customer_accessories_presets.findUnique({
          where: { id: customerAccessoriesPresetId },
        });
        if (preset && preset.accessoryItems) {
          presetAccessories = Array.isArray(preset.accessoryItems)
            ? preset.accessoryItems
            : [];
          logDebug('Loaded preset accessories:', presetAccessories.length);
        }
      } catch (error) {
        logWarn('Failed to load customer accessories preset:', error);
      }
    }

    // Combine material BOM with preset accessories
    const combinedMaterialBOM = [
      ...(materialBOM || []),
      ...presetAccessories,
    ];

    // Auto-add Thread if not already present
    const hasThread = combinedMaterialBOM.some(
      (item: any) => item.materialType === 'THREAD'
    );
    if (!hasThread) {
      combinedMaterialBOM.push({
        materialType: 'THREAD',
        usageCategory: 'GARMENT_TRIM',
        componentName: 'Default Thread',
        quantityPerGarment: 0, // Quantity will be calculated later
        unit: 'cone',
      });
    }

    logDebug('Combined material BOM (including preset + thread):', combinedMaterialBOM.length);

    // Create style with nested components, fabrics, and processes
    const style = await prisma.styles.create({
      data: {
        id: randomUUID(),
        styleCode,
        styleName,
        customerName,
        brandName,
        brandCategoryId: brandCategoryId || null,
        description,
        season,
        gender: gender || null, // NEW: Gender field
        createdById: req.user?.userId || 'system',
        specifications: category || null, // Store category in specifications field for now
        cadStatus: 'PENDING', // NEW: Initial CAD status
        style_components: {
          create: components?.map((comp: any, index: number) => ({
            id: randomUUID(),
            componentName: comp.componentName,
            componentType: comp.componentType,
            sortOrder: index,
            style_fabrics: {
              create: comp.fabrics?.map((fabric: any) => ({
                id: randomUUID(),
                fabricId: fabric.fabricId || null, // Reference to fabric_master
                fabricCADId: fabric.fabricCADId || null, // Reference to fabric_width_cad
                fabricFinishType: fabric.fabricFinishType || null, // NEW: DYED, PRINTED, YARN_DYED, RAW
                cadGroupKey: fabric.cadGroupKey || null, // NEW: For CAD grouping
                // DEPRECATED fields - keep for backward compatibility during migration
                fabricName: fabric.fabricName,
                fabricType: fabric.fabricType,
                greigeName: fabric.greigeName || null,
                quantityNeeded: fabric.quantityNeeded ? parseFloat(fabric.quantityNeeded) : null,
                unitPrice: fabric.unitPrice ? parseFloat(fabric.unitPrice) : null,
                notes: fabric.notes || null,
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
        // NEW: Unified Material BOM (replaces garmentTrims, valueAdditions, packagingTrims)
        style_material_bom: {
          create: combinedMaterialBOM?.map((bom: any, index: number) => ({
            id: randomUUID(),
            materialType: bom.materialType,
            materialId: bom.materialId || randomUUID(), // Temporary fallback
            usageCategory: bom.usageCategory || 'GARMENT_TRIM',
            componentName: bom.componentName || null,
            quantityPerGarment: bom.quantityPerGarment ? parseFloat(bom.quantityPerGarment) : 0,
            unit: bom.unit || 'pcs',
            unitPrice: bom.unitPrice ? parseFloat(bom.unitPrice) : null,
            totalCost: bom.totalCost ? parseFloat(bom.totalCost) : null,
            notes: bom.notes || null,
            sortOrder: index,
            // Material-specific IDs
            laceId: bom.materialType === 'LACE' ? bom.materialId : null,
            buttonId: bom.materialType === 'BUTTON' ? bom.materialId : null,
            threadId: bom.materialType === 'THREAD' ? bom.materialId : null,
            zipperId: bom.materialType === 'ZIPPER' ? bom.materialId : null,
            elasticId: bom.materialType === 'ELASTIC' ? bom.materialId : null,
            labelId: bom.materialType === 'LABEL' ? bom.materialId : null,
            packagingId: bom.materialType === 'PACKAGING' ? bom.materialId : null,
          })) || [],
        },
        // DEPRECATED: Keep for backward compatibility during migration
        style_garment_trims: {
          create: garmentTrims?.map((trim: any) => ({
            id: randomUUID(),
            trimName: trim.trimName,
            trimType: trim.trimType || '',
            quantityPerPiece: parseFloat(trim.quantityPerPiece) || 0,
            unit: trim.unit || 'pcs',
            supplier: trim.supplier || null,
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
            })) || [],
        },
        style_packaging: {
          create: packagingTrims?.map((pkg: any) => ({
            id: randomUUID(),
            itemName: pkg.itemName,
            itemType: pkg.itemType || 'polybag',
            specification: pkg.specification || null,
            quantityPerPack: parseInt(pkg.quantityPerPack) || 1,
          })) || [],
        },
      },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: true, // Include fabric_master details
                fabricCAD: true, // Include fabric_width_cad details (replaces cad_averages)
              },
            },
            style_accessories: true,
          },
        },
        style_processes: true,
        style_costing: true,
        style_material_bom: { // NEW: Include material BOM with related masters
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
        // DEPRECATED: Legacy relations, kept for backward compatibility
        style_garment_trims: true,
        style_value_additions: true,
        style_packaging: true,
      },
    });

    logDebug('Style created successfully with ID:', style.id);

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
        { customerName: { contains: search, mode: 'insensitive' } },
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
      customerName,
      brandName,
      brandCategoryId,
      description,
      season,
    } = req.body;

    const style = await prisma.styles.update({
      where: { id },
      data: {
        styleName,
        customerName,
        brandName,
        brandCategoryId: brandCategoryId || null,
        description,
        season,

      },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: true, // Include fabric_master details
                fabricCAD: true, // Include fabric_width_cad details (replaces cad_averages)
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

/**
 * Create or update style variants
 * POST /api/styles/:id/variants
 *
 * Request body:
 * {
 *   variants: [
 *     { size: "M", sku: "ABC123M", barcode?: "", isActive: true },
 *     { size: "L", sku: "ABC123L", barcode?: "", isActive: true }
 *   ]
 * }
 */
export const createStyleVariants = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: styleId } = req.params;
    const { variants } = req.body;

    logDebug('=== CREATE STYLE VARIANTS ===');
    logDebug('Style ID:', styleId);
    logDebug('Variants:', JSON.stringify(variants, null, 2));

    // Validation
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Variants array is required and must not be empty',
      });
      return;
    }

    // Check if style exists
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      select: { id: true, styleCode: true },
    });

    if (!style) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Style not found',
      });
      return;
    }

    // Validate all SKU formats
    const invalidSKUs = variants.filter(v => !validateSKUFormat(v.sku));
    if (invalidSKUs.length > 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Invalid SKU format for: ${invalidSKUs.map(v => v.sku).join(', ')}`,
      });
      return;
    }

    // Check for duplicate SKUs within the request
    const skuCounts = new Map<string, number>();
    variants.forEach(v => {
      skuCounts.set(v.sku, (skuCounts.get(v.sku) || 0) + 1);
    });
    const duplicates = Array.from(skuCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([sku]) => sku);

    if (duplicates.length > 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Duplicate SKUs in request: ${duplicates.join(', ')}`,
      });
      return;
    }

    // Check if any SKUs already exist in database (for other styles)
    const allSKUs = variants.map(v => v.sku);
    const existingSKUs = await checkMultipleSKUsExist(allSKUs);

    // Filter out SKUs that belong to THIS style (we'll upsert those)
    const existingVariantsForStyle = await prisma.style_variants.findMany({
      where: {
        styleId,
        sku: { in: allSKUs }
      },
      select: { sku: true }
    });
    const existingSKUsForThisStyle = new Set(existingVariantsForStyle.map(v => v.sku));
    const conflictingSKUs = existingSKUs.filter(sku => !existingSKUsForThisStyle.has(sku));

    if (conflictingSKUs.length > 0) {
      res.status(409).json({
        error: 'Conflict',
        message: `SKUs already exist for other styles: ${conflictingSKUs.join(', ')}`,
      });
      return;
    }

    // Process variants in a transaction
    const createdVariants = await prisma.$transaction(async (tx) => {
      const results = [];

      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        const { size, sku, barcode, isActive } = variant;

        // Get or create size option
        let sizeOption = await tx.size_options.findFirst({
          where: {
            styleId,
            sizeName: size,
          },
        });

        if (!sizeOption) {
          sizeOption = await tx.size_options.create({
            data: {
              id: randomUUID(),
              styleId,
              sizeName: size,
              sizeCode: size, // Use size name as code
              sortOrder: getSizeOrder(size),
              isActive: true,
            },
          });
        }

        // Upsert style variant (create or update if exists)
        const styleVariant = await tx.style_variants.upsert({
          where: { sku },
          create: {
            id: randomUUID(),
            styleId,
            sku,
            sizeId: sizeOption.id,
            sizeName: size,
            colorId: null,
            colorName: null,
            barcode: barcode || null,
            isActive: isActive !== false,
            sortOrder: getSizeOrder(size),
          },
          update: {
            sizeId: sizeOption.id,
            sizeName: size,
            barcode: barcode || null,
            isActive: isActive !== false,
            sortOrder: getSizeOrder(size),
          },
        });

        results.push(styleVariant);
      }

      return results;
    });

    logInfo(`Created/updated ${createdVariants.length} variants for style ${style.styleCode}`);

    res.status(201).json({
      data: createdVariants,
      message: `Successfully created/updated ${createdVariants.length} variant(s)`,
    });
  } catch (error) {
    logError('Create style variants error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create variants',
    });
  }
};

/**
 * Get all draft styles for the current user
 * GET /api/styles/drafts
 */
export const getAllDrafts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      status: 'DRAFT',
      isActive: true
    };

    // Optionally filter by current user
    // if (req.user?.userId) {
    //   whereClause.createdById = req.user.userId;
    // }

    const totalDrafts = await prisma.styles.count({ where: whereClause });

    const drafts = await prisma.styles.findMany({
      where: whereClause,
      skip,
      take: limit,
      select: {
        id: true,
        styleCode: true,
        styleName: true,
        customerName: true,
        brandName: true,
        categoryId: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.status(200).json({
      data: drafts,
      pagination: {
        page,
        limit,
        total: totalDrafts,
        totalPages: Math.ceil(totalDrafts / limit)
      }
    });
  } catch (error) {
    logError('Get drafts error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch drafts'
    });
  }
};

/**
 * Get a single draft by ID
 * GET /api/styles/drafts/:id
 */
export const getDraftById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const draft = await prisma.styles.findFirst({
      where: {
        id,
        status: 'DRAFT'
      },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: true, // Include fabric_master details
                fabricCAD: true // Include fabric_width_cad details (replaces cad_averages)
              }
            }
          }
        },
        style_processes: true,
        style_garment_trims: true,
        style_value_additions: true,
        style_packaging: true,
        style_variants: {
          include: {
            size: true
          }
        }
      }
    });

    if (!draft) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Draft not found'
      });
      return;
    }

    res.status(200).json({ data: draft });
  } catch (error) {
    logError('Get draft by ID error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch draft'
    });
  }
};

/**
 * Delete a draft
 * DELETE /api/styles/drafts/:id
 */
export const deleteDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify it's a draft before deleting
    const draft = await prisma.styles.findFirst({
      where: { id, status: 'DRAFT' }
    });

    if (!draft) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Draft not found'
      });
      return;
    }

    await prisma.styles.update({
      where: { id },
      data: { isActive: false }
    });

    res.status(200).json({
      message: 'Draft deleted successfully'
    });
  } catch (error) {
    logError('Delete draft error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete draft'
    });
  }
};

/**
 * Publish a draft (convert to ACTIVE status)
 * POST /api/styles/:id/publish
 */
export const publishDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify it's a draft
    const draft = await prisma.styles.findFirst({
      where: { id, status: 'DRAFT' }
    });

    if (!draft) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Draft not found'
      });
      return;
    }

    // Update status to ACTIVE
    const publishedStyle = await prisma.styles.update({
      where: { id },
      data: {
        status: 'ACTIVE',
      },
      include: {
        style_components: {
          include: {
            style_fabrics: true
          }
        },
        style_processes: true
      }
    });

    logInfo(`Draft ${draft.styleCode} published to ACTIVE status`);

    res.status(200).json({
      data: publishedStyle,
      message: 'Style published successfully'
    });
  } catch (error) {
    logError('Publish draft error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to publish draft'
    });
  }
};

/**
 * Get CAD planning data for a style
 * GET /api/styles/:id/cad-planning
 */
export const getStyleCADPlanning = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: styleId } = req.params;

    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: {
                  include: {
                    greige: true,
                    widthCADs: { orderBy: { availableWidth: 'asc' } },
                  },
                },
                fabricCAD: true,
              },
            },
          },
        },
      },
    });

    if (!style) {
      res.status(404).json({ error: 'Not Found', message: 'Style not found' });
      return;
    }

    // Group fabrics by cadGroupKey
    const fabricGroups: Record<string, any> = {};
    for (const component of style.style_components) {
      for (const fabric of component.style_fabrics) {
        const groupKey = fabric.cadGroupKey || `${fabric.fabric?.genericFabricName || 'Unknown'}-${fabric.fabricFinishType || 'Unknown'}`;
        if (!fabricGroups[groupKey]) {
          fabricGroups[groupKey] = {
            groupKey,
            genericFabricName: fabric.fabric?.genericFabricName,
            fabricFinishType: fabric.fabricFinishType,
            fabrics: [],
            components: [],
            availableWidthOptions: fabric.fabric?.widthCADs || [],
          };
        }
        fabricGroups[groupKey].fabrics.push({
          id: fabric.id,
          componentName: component.componentName,
          fabricName: fabric.fabric?.fabricName || fabric.fabricName,
          currentCADId: fabric.fabricCADId,
        });
        if (!fabricGroups[groupKey].components.includes(component.componentName)) {
          fabricGroups[groupKey].components.push(component.componentName);
        }
      }
    }

    res.status(200).json({
      data: {
        style: { id: style.id, styleCode: style.styleCode, styleName: style.styleName, cadStatus: style.cadStatus },
        fabricGroups: Object.values(fabricGroups),
      },
      message: 'CAD planning data retrieved successfully',
    });
  } catch (error) {
    logError('Get CAD planning error', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve CAD planning data' });
  }
};

/**
 * Update CAD grouping for style fabrics
 * POST /api/styles/:id/cad-groups
 */
export const updateCADGrouping = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: styleId } = req.params;
    const { fabricGroups } = req.body;

    if (!fabricGroups || !Array.isArray(fabricGroups)) {
      res.status(400).json({ error: 'Validation Error', message: 'fabricGroups array is required' });
      return;
    }

    await Promise.all(fabricGroups.map((group: any) =>
      prisma.style_fabrics.update({
        where: { id: group.fabricId },
        data: { cadGroupKey: group.cadGroupKey },
      })
    ));

    await prisma.styles.update({
      where: { id: styleId },
      data: { cadStatus: 'IN_PROGRESS' },
    });

    res.status(200).json({ message: 'CAD grouping updated successfully' });
  } catch (error) {
    logError('Update CAD grouping error', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update CAD grouping' });
  }
};

/**
 * Approve CAD plan and link fabrics to selected CAD entries
 * PUT /api/styles/:id/approve-cad
 */
export const approveCADPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: styleId } = req.params;
    const { fabricCADMappings } = req.body;

    if (!fabricCADMappings || !Array.isArray(fabricCADMappings)) {
      res.status(400).json({ error: 'Validation Error', message: 'fabricCADMappings array is required' });
      return;
    }

    await Promise.all(fabricCADMappings.map((mapping: any) =>
      prisma.style_fabrics.update({
        where: { id: mapping.fabricId },
        data: { fabricCADId: mapping.fabricCADId },
      })
    ));

    const updatedStyle = await prisma.styles.update({
      where: { id: styleId },
      data: { cadStatus: 'APPROVED', approvedCadDate: new Date() },
    });

    res.status(200).json({ data: updatedStyle, message: 'CAD plan approved successfully' });
  } catch (error) {
    logError('Approve CAD plan error', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to approve CAD plan' });
  }
};

