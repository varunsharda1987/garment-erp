import { Request, Response } from 'express';
import prisma from '../config/database';
import { NotFoundError, ValidationError, ConflictError } from '../errors';

/**
 * Get all size category presets for a customer
 * GET /customers/:customerId/size-category-presets
 */
export const getAllPresetsForCustomer = async (req: Request, res: Response) => {
  const { customerId } = req.params;

  const presets = await prisma.customer_size_category_presets.findMany({
    where: {
      customerId,
      isActive: true,
    },
    include: {
      sizeCategory: true,
    },
    orderBy: [{ isDefault: 'desc' }, { presetName: 'asc' }],
  });

  res.status(200).json({
    success: true,
    data: presets,
    total: presets.length,
  });
};

/**
 * Get default size category preset for a customer
 * GET /customers/:customerId/size-category-presets/default
 */
export const getDefaultPreset = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Default size category preset');
  }

  res.status(200).json({
    success: true,
    data: preset,
  });
};

/**
 * Get a specific size category preset by ID
 * GET /customers/:customerId/size-category-presets/:presetId
 */
export const getPresetById = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Size category preset', presetId);
  }

  res.status(200).json({
    success: true,
    data: preset,
  });
};

/**
 * Create a new size category preset
 * POST /customers/:customerId/size-category-presets
 */
export const createPreset = async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const { presetName, description, sizeCategoryId, isDefault } = req.body;

  // Validate required fields
  if (!presetName || !sizeCategoryId) {
    throw new ValidationError('Preset name and size category ID are required');
  }

  // Verify size category exists
  const sizeCategory = await prisma.size_categories.findUnique({
    where: { id: sizeCategoryId },
  });

  if (!sizeCategory) {
    throw new NotFoundError('Size category', sizeCategoryId);
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
    throw new ConflictError(`A size category preset named "${presetName}" already exists for this customer`);
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
};

/**
 * Update a size category preset
 * PUT /customers/:customerId/size-category-presets/:presetId
 */
export const updatePreset = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Size category preset', presetId);
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
      throw new ConflictError(`A size category preset named "${presetName}" already exists for this customer`);
    }
  }

  // If changing size category, verify it exists
  if (sizeCategoryId && sizeCategoryId !== existingPreset.sizeCategoryId) {
    const sizeCategory = await prisma.size_categories.findUnique({
      where: { id: sizeCategoryId },
    });

    if (!sizeCategory) {
      throw new NotFoundError('Size category', sizeCategoryId);
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
};

/**
 * Delete a size category preset
 * DELETE /customers/:customerId/size-category-presets/:presetId
 */
export const deletePreset = async (req: Request, res: Response) => {
  const { customerId, presetId } = req.params;

  // Verify preset exists and belongs to customer
  const preset = await prisma.customer_size_category_presets.findFirst({
    where: {
      id: presetId,
      customerId,
    },
  });

  if (!preset) {
    throw new NotFoundError('Size category preset', presetId);
  }

  await prisma.customer_size_category_presets.delete({
    where: { id: presetId },
  });

  res.status(200).json({ message: 'Size category preset deleted successfully' });
};

/**
 * Set a preset as default (unset all others)
 * POST /customers/:customerId/size-category-presets/:presetId/set-default
 */
export const setAsDefault = async (req: Request, res: Response) => {
  const { customerId, presetId } = req.params;

  // Verify preset exists and belongs to customer
  const preset = await prisma.customer_size_category_presets.findFirst({
    where: {
      id: presetId,
      customerId,
    },
  });

  if (!preset) {
    throw new NotFoundError('Size category preset', presetId);
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
};

/**
 * Clone a size category preset
 * POST /customers/:customerId/size-category-presets/:presetId/clone
 */
export const clonePreset = async (req: Request, res: Response) => {
  const { customerId, presetId } = req.params;
  const { presetName } = req.body;

  if (!presetName) {
    throw new ValidationError('New preset name is required');
  }

  // Verify source preset exists and belongs to customer
  const sourcePreset = await prisma.customer_size_category_presets.findFirst({
    where: {
      id: presetId,
      customerId,
    },
  });

  if (!sourcePreset) {
    throw new NotFoundError('Source size category preset', presetId);
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
    throw new ConflictError(`A size category preset named "${presetName}" already exists for this customer`);
  }

  // Clone the preset
  const newPreset = await prisma.customer_size_category_presets.create({
    data: {
      customerId,
      presetName,
      description: sourcePreset.description ? `${sourcePreset.description} (Copy)` : 'Cloned preset',
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
};
