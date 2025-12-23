// Style Label Configuration Controller
// Manages label assignments to styles with size-specific data (barcodes, MRP)

import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logInfo, logError } from '../utils/logger';

// ============================================
// Types for Style Label Controller
// ============================================

interface SizeConfigInput {
  size: string;
  barcodeValue?: string | null;
  mrp?: number | null;
}

interface CreateStyleLabelInput {
  styleId: string;
  labelId: string;
  componentName?: string | null;
  extraPercentage?: number;
  notes?: string | null;
  sizeConfigs?: SizeConfigInput[];
}

interface UpdateStyleLabelInput {
  componentName?: string | null;
  extraPercentage?: number;
  notes?: string | null;
  sizeConfigs?: SizeConfigInput[];
  isActive?: boolean;
}

// ============================================
// Controller Functions
// ============================================

/**
 * Add a label to a style
 * POST /api/styles/:styleId/labels
 */
export const addLabelToStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const {
      labelId,
      componentName,
      extraPercentage = 5,
      notes,
      sizeConfigs = [],
    }: CreateStyleLabelInput = req.body;

    // Verify style exists
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      select: { id: true, isActive: true },
    });

    if (!style || !style.isActive) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Style not found',
      });
      return;
    }

    // Verify label exists
    const label = await prisma.label_master.findUnique({
      where: { id: labelId },
      select: { id: true, isActive: true, labelCategory: true },
    });

    if (!label || !label.isActive) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Label not found',
      });
      return;
    }

    // Check if this label is already assigned to this style with the same component
    const existingConfig = await prisma.style_label_config.findFirst({
      where: {
        styleId,
        labelId,
        componentName: componentName || null,
        isActive: true,
      },
    });

    if (existingConfig) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'This label is already assigned to this style for the specified component',
      });
      return;
    }

    // Create the style label config with size configs
    const styleLabelConfig = await prisma.style_label_config.create({
      data: {
        styleId,
        labelId,
        componentName: componentName || null,
        extraPercentage: new Prisma.Decimal(extraPercentage),
        notes: notes || null,
        sizeConfigs: {
          create: sizeConfigs.map((sc) => ({
            size: sc.size,
            barcodeValue: sc.barcodeValue || null,
            mrp: sc.mrp ? new Prisma.Decimal(sc.mrp) : null,
          })),
        },
      },
      include: {
        label: {
          select: {
            id: true,
            labelCode: true,
            labelName: true,
            labelCategory: true,
            labelType: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sizeConfigs: true,
      },
    });

    logInfo(`Label ${labelId} added to style ${styleId}`);

    res.status(201).json({
      data: styleLabelConfig,
      message: 'Label added to style successfully',
    });
  } catch (error) {
    logError('Add label to style error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add label to style',
    });
  }
};

/**
 * Get all labels assigned to a style
 * GET /api/styles/:styleId/labels
 */
export const getStyleLabels = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const { includeInactive } = req.query;

    // Verify style exists
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      select: { id: true },
    });

    if (!style) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Style not found',
      });
      return;
    }

    const whereClause: Prisma.style_label_configWhereInput = { styleId };
    if (includeInactive !== 'true') {
      whereClause.isActive = true;
    }

    const labelConfigs = await prisma.style_label_config.findMany({
      where: whereClause,
      include: {
        label: {
          select: {
            id: true,
            labelCode: true,
            labelName: true,
            labelCategory: true,
            labelType: true,
            fabricContent: true,
            washcareInstructions: true,
            material: true,
            color: true,
            pricePerPiece: true,
            pricePerHundred: true,
            image: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sizeConfigs: {
          orderBy: { size: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ data: labelConfigs });
  } catch (error) {
    logError('Get style labels error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch style labels',
    });
  }
};

/**
 * Get a specific style label config by ID
 * GET /api/style-labels/:id
 */
export const getStyleLabelById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const styleLabelConfig = await prisma.style_label_config.findUnique({
      where: { id },
      include: {
        style: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
          },
        },
        label: {
          select: {
            id: true,
            labelCode: true,
            labelName: true,
            labelCategory: true,
            labelType: true,
            fabricContent: true,
            washcareInstructions: true,
            material: true,
            color: true,
            pricePerPiece: true,
            pricePerHundred: true,
            image: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sizeConfigs: {
          orderBy: { size: 'asc' },
        },
      },
    });

    if (!styleLabelConfig) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Style label configuration not found',
      });
      return;
    }

    res.json({ data: styleLabelConfig });
  } catch (error) {
    logError('Get style label by ID error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch style label configuration',
    });
  }
};

/**
 * Update a style label config
 * PUT /api/style-labels/:id
 */
export const updateStyleLabelConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      componentName,
      extraPercentage,
      notes,
      sizeConfigs,
      isActive,
    }: UpdateStyleLabelInput = req.body;

    // Verify config exists
    const existingConfig = await prisma.style_label_config.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingConfig) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Style label configuration not found',
      });
      return;
    }

    // Build update data
    const updateData: Prisma.style_label_configUpdateInput = {};

    if (componentName !== undefined) {
      updateData.componentName = componentName;
    }
    if (extraPercentage !== undefined) {
      updateData.extraPercentage = new Prisma.Decimal(extraPercentage);
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Update size configs if provided
    if (sizeConfigs !== undefined) {
      // Delete existing size configs and create new ones
      await prisma.style_label_size_config.deleteMany({
        where: { styleLabelConfigId: id },
      });

      updateData.sizeConfigs = {
        create: sizeConfigs.map((sc) => ({
          size: sc.size,
          barcodeValue: sc.barcodeValue || null,
          mrp: sc.mrp ? new Prisma.Decimal(sc.mrp) : null,
        })),
      };
    }

    const updatedConfig = await prisma.style_label_config.update({
      where: { id },
      data: updateData,
      include: {
        label: {
          select: {
            id: true,
            labelCode: true,
            labelName: true,
            labelCategory: true,
            labelType: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sizeConfigs: {
          orderBy: { size: 'asc' },
        },
      },
    });

    logInfo(`Style label config ${id} updated`);

    res.json({
      data: updatedConfig,
      message: 'Style label configuration updated successfully',
    });
  } catch (error) {
    logError('Update style label config error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update style label configuration',
    });
  }
};

/**
 * Remove a label from a style (soft delete)
 * DELETE /api/style-labels/:id
 */
export const removeStyleLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const config = await prisma.style_label_config.findUnique({
      where: { id },
      select: { id: true, styleId: true, labelId: true },
    });

    if (!config) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Style label configuration not found',
      });
      return;
    }

    // Soft delete
    await prisma.style_label_config.update({
      where: { id },
      data: { isActive: false },
    });

    logInfo(`Style label config ${id} removed (soft delete)`);

    res.json({
      message: 'Label removed from style successfully',
    });
  } catch (error) {
    logError('Remove style label error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to remove label from style',
    });
  }
};

/**
 * Hard delete a style label config
 * DELETE /api/style-labels/:id/permanent
 */
export const deleteStyleLabelPermanent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const config = await prisma.style_label_config.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!config) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Style label configuration not found',
      });
      return;
    }

    // Hard delete (cascade will delete size configs)
    await prisma.style_label_config.delete({
      where: { id },
    });

    logInfo(`Style label config ${id} permanently deleted`);

    res.json({
      message: 'Style label configuration permanently deleted',
    });
  } catch (error) {
    logError('Delete style label permanent error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete style label configuration',
    });
  }
};

/**
 * Bulk add labels to a style
 * POST /api/styles/:styleId/labels/bulk
 */
export const bulkAddLabelsToStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const { labels }: { labels: CreateStyleLabelInput[] } = req.body;

    // Verify style exists
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      select: { id: true, isActive: true },
    });

    if (!style || !style.isActive) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Style not found',
      });
      return;
    }

    // Create all configs in a transaction
    const results = await prisma.$transaction(
      labels.map((label) =>
        prisma.style_label_config.create({
          data: {
            styleId,
            labelId: label.labelId,
            componentName: label.componentName || null,
            extraPercentage: new Prisma.Decimal(label.extraPercentage || 5),
            notes: label.notes || null,
            sizeConfigs: {
              create: (label.sizeConfigs || []).map((sc) => ({
                size: sc.size,
                barcodeValue: sc.barcodeValue || null,
                mrp: sc.mrp ? new Prisma.Decimal(sc.mrp) : null,
              })),
            },
          },
          include: {
            label: {
              select: {
                id: true,
                labelCode: true,
                labelName: true,
                labelCategory: true,
              },
            },
            sizeConfigs: true,
          },
        })
      )
    );

    logInfo(`${labels.length} labels added to style ${styleId}`);

    res.status(201).json({
      data: results,
      message: `${labels.length} labels added to style successfully`,
    });
  } catch (error) {
    logError('Bulk add labels to style error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add labels to style',
    });
  }
};
