import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all size category presets for a customer
 * GET /customers/:customerId/size-category-presets
 */
export const getAllPresetsForCustomer = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const presets = await prisma.customer_size_category_presets.findMany({
      where: {
        customerId,
        isActive: true,
      },
      include: {
        sizeCategory: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { presetName: 'asc' },
      ],
    });

    res.status(200).json({
      success: true,
      data: presets,
      total: presets.length,
    });
  } catch (error) {
    console.error('Error fetching customer size presets:', error);
    res.status(500).json({ error: 'Failed to fetch size category presets' });
  }
};

/**
 * Get default size category preset for a customer
 * GET /customers/:customerId/size-category-presets/default
 */
export const getDefaultPreset = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const preset = await prisma.customer_size_category_presets.findFirst({
      where: {
        customerId,
        isDefault: true,
        isActive: true,
      },
      include: {
        sizeCategory: true,
      },
    });

    if (!preset) {
      return res.status(404).json({ error: 'No default size category preset found for this customer' });
    }

    res.status(200).json({
      success: true,
      data: preset,
    });
  } catch (error) {
    console.error('Error fetching default preset:', error);
    res.status(500).json({ error: 'Failed to fetch default size category preset' });
  }
};

/**
 * Get a specific size category preset by ID
 * GET /customers/:customerId/size-category-presets/:presetId
 */
export const getPresetById = async (req: Request, res: Response) => {
  try {
    const { customerId, presetId } = req.params;

    const preset = await prisma.customer_size_category_presets.findFirst({
      where: {
        id: presetId,
        customerId,
      },
      include: {
        sizeCategory: true,
      },
    });

    if (!preset) {
      return res.status(404).json({ error: 'Size category preset not found' });
    }

    res.status(200).json({
      success: true,
      data: preset,
    });
  } catch (error) {
    console.error('Error fetching preset:', error);
    res.status(500).json({ error: 'Failed to fetch size category preset' });
  }
};

/**
 * Create a new size category preset
 * POST /customers/:customerId/size-category-presets
 */
export const createPreset = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { presetName, description, sizeCategoryId, isDefault } = req.body;

    // Validate required fields
    if (!presetName || !sizeCategoryId) {
      return res.status(400).json({
        error: 'Preset name and size category ID are required',
      });
    }

    // Verify size category exists
    const sizeCategory = await prisma.size_categories.findUnique({
      where: { id: sizeCategoryId },
    });

    if (!sizeCategory) {
      return res.status(404).json({ error: 'Size category not found' });
    }

    // Check for duplicate preset name
    const existingPreset = await prisma.customer_size_category_presets.findUnique({
      where: {
        customerId_presetName: {
          customerId,
          presetName,
        },
      },
    });

    if (existingPreset) {
      return res.status(409).json({
        error: `A size category preset named "${presetName}" already exists for this customer`,
      });
    }

    // If isDefault is true, unset all other defaults for this customer
    if (isDefault) {
      await prisma.customer_size_category_presets.updateMany({
        where: {
          customerId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Create the preset
    const preset = await prisma.customer_size_category_presets.create({
      data: {
        customerId,
        presetName,
        description,
        sizeCategoryId,
        isDefault: isDefault || false,
      },
      include: {
        sizeCategory: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Size category preset created successfully',
      data: preset,
    });
  } catch (error) {
    console.error('Error creating preset:', error);
    res.status(500).json({ error: 'Failed to create size category preset' });
  }
};

/**
 * Update a size category preset
 * PUT /customers/:customerId/size-category-presets/:presetId
 */
export const updatePreset = async (req: Request, res: Response) => {
  try {
    const { customerId, presetId } = req.params;
    const { presetName, description, sizeCategoryId, isActive } = req.body;

    // Verify preset exists and belongs to customer
    const existingPreset = await prisma.customer_size_category_presets.findFirst({
      where: {
        id: presetId,
        customerId,
      },
    });

    if (!existingPreset) {
      return res.status(404).json({ error: 'Size category preset not found' });
    }

    // If changing preset name, check for duplicates
    if (presetName && presetName !== existingPreset.presetName) {
      const duplicate = await prisma.customer_size_category_presets.findUnique({
        where: {
          customerId_presetName: {
            customerId,
            presetName,
          },
        },
      });

      if (duplicate) {
        return res.status(409).json({
          error: `A size category preset named "${presetName}" already exists for this customer`,
        });
      }
    }

    // If changing size category, verify it exists
    if (sizeCategoryId && sizeCategoryId !== existingPreset.sizeCategoryId) {
      const sizeCategory = await prisma.size_categories.findUnique({
        where: { id: sizeCategoryId },
      });

      if (!sizeCategory) {
        return res.status(404).json({ error: 'Size category not found' });
      }
    }

    // Update the preset
    const preset = await prisma.customer_size_category_presets.update({
      where: { id: presetId },
      data: {
        ...(presetName && { presetName }),
        ...(description !== undefined && { description }),
        ...(sizeCategoryId && { sizeCategoryId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        sizeCategory: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Size category preset updated successfully',
      data: preset,
    });
  } catch (error) {
    console.error('Error updating preset:', error);
    res.status(500).json({ error: 'Failed to update size category preset' });
  }
};

/**
 * Delete a size category preset
 * DELETE /customers/:customerId/size-category-presets/:presetId
 */
export const deletePreset = async (req: Request, res: Response) => {
  try {
    const { customerId, presetId } = req.params;

    // Verify preset exists and belongs to customer
    const preset = await prisma.customer_size_category_presets.findFirst({
      where: {
        id: presetId,
        customerId,
      },
    });

    if (!preset) {
      return res.status(404).json({ error: 'Size category preset not found' });
    }

    await prisma.customer_size_category_presets.delete({
      where: { id: presetId },
    });

    res.status(200).json({ message: 'Size category preset deleted successfully' });
  } catch (error) {
    console.error('Error deleting preset:', error);
    res.status(500).json({ error: 'Failed to delete size category preset' });
  }
};

/**
 * Set a preset as default (unset all others)
 * POST /customers/:customerId/size-category-presets/:presetId/set-default
 */
export const setAsDefault = async (req: Request, res: Response) => {
  try {
    const { customerId, presetId } = req.params;

    // Verify preset exists and belongs to customer
    const preset = await prisma.customer_size_category_presets.findFirst({
      where: {
        id: presetId,
        customerId,
      },
    });

    if (!preset) {
      return res.status(404).json({ error: 'Size category preset not found' });
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction([
      // Unset all defaults for this customer
      prisma.customer_size_category_presets.updateMany({
        where: {
          customerId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      }),
      // Set this preset as default
      prisma.customer_size_category_presets.update({
        where: { id: presetId },
        data: { isDefault: true },
      }),
    ]);

    // Fetch updated preset
    const updatedPreset = await prisma.customer_size_category_presets.findUnique({
      where: { id: presetId },
      include: {
        sizeCategory: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Default preset set successfully',
      data: updatedPreset,
    });
  } catch (error) {
    console.error('Error setting default preset:', error);
    res.status(500).json({ error: 'Failed to set default size category preset' });
  }
};

/**
 * Clone a size category preset
 * POST /customers/:customerId/size-category-presets/:presetId/clone
 */
export const clonePreset = async (req: Request, res: Response) => {
  try {
    const { customerId, presetId } = req.params;
    const { presetName } = req.body;

    if (!presetName) {
      return res.status(400).json({ error: 'New preset name is required' });
    }

    // Verify source preset exists and belongs to customer
    const sourcePreset = await prisma.customer_size_category_presets.findFirst({
      where: {
        id: presetId,
        customerId,
      },
    });

    if (!sourcePreset) {
      return res.status(404).json({ error: 'Source size category preset not found' });
    }

    // Check for duplicate preset name
    const existingPreset = await prisma.customer_size_category_presets.findUnique({
      where: {
        customerId_presetName: {
          customerId,
          presetName,
        },
      },
    });

    if (existingPreset) {
      return res.status(409).json({
        error: `A size category preset named "${presetName}" already exists for this customer`,
      });
    }

    // Clone the preset
    const newPreset = await prisma.customer_size_category_presets.create({
      data: {
        customerId,
        presetName,
        description: sourcePreset.description
          ? `${sourcePreset.description} (Copy)`
          : 'Cloned preset',
        sizeCategoryId: sourcePreset.sizeCategoryId,
        isDefault: false, // Cloned preset is never default
      },
      include: {
        sizeCategory: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Size category preset cloned successfully',
      data: newPreset,
    });
  } catch (error) {
    console.error('Error cloning preset:', error);
    res.status(500).json({ error: 'Failed to clone size category preset' });
  }
};
