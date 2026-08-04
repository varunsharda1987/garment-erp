import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { customerService, AccessoryItem } from '../services/customer.service';
import { NotFoundError, ValidationError, ConflictError } from '../errors';

// DTO types for controller
interface CreatePresetDTO {
  presetName: string;
  description?: string;
  items: AccessoryItem[]; // Changed from accessoryItems to items
  isDefault?: boolean;
}

interface UpdatePresetDTO {
  presetName?: string;
  description?: string;
  items?: AccessoryItem[]; // Changed from accessoryItems to items
  isDefault?: boolean;
  isActive?: boolean;
}

/**
 * Get all accessory presets for a customer
 * GET /api/customers/:customerId/accessory-presets
 */
export async function getCustomerAccessoryPresets(req: Request, res: Response) {
  const { customerId } = req.params;

  const presets = await customerService.getAccessoryPresets(customerId);

  return res.json({
    success: true,
    data: presets,
    total: presets.length,
  });
}

/**
 * Get a specific accessory preset by ID
 * GET /api/customers/:customerId/accessory-presets/:presetId
 */
export async function getCustomerAccessoryPresetById(req: Request, res: Response) {
  const { customerId, presetId } = req.params;

  const preset = await customerService.getAccessoryPresetById(presetId, customerId);

  if (!preset) {
    throw new NotFoundError('Accessory preset', presetId);
  }

  return res.json({
    success: true,
    data: preset,
  });
}

/**
 * Get the default accessory preset for a customer
 * GET /api/customers/:customerId/accessory-presets/default
 */
export async function getDefaultAccessoryPreset(req: Request, res: Response) {
  const { customerId } = req.params;

  const preset = await customerService.getDefaultAccessoryPreset(customerId);

  if (!preset) {
    return res.json({
      success: true,
      data: null,
      message: 'No default preset found',
    });
  }

  return res.json({
    success: true,
    data: preset,
  });
}

/**
 * Create a new accessory preset for a customer
 * POST /api/customers/:customerId/accessory-presets
 */
export async function createAccessoryPreset(req: Request, res: Response) {
  const { customerId } = req.params;
  const data: CreatePresetDTO = req.body;

  // Validate required fields
  if (!data.presetName) {
    throw new ValidationError('Preset name is required');
  }

  try {
    const preset = await customerService.createAccessoryPreset(customerId, data);

    return res.status(201).json({
      success: true,
      message: 'Accessory preset created successfully',
      data: preset,
    });
  } catch (error: unknown) {
    // Check for unique constraint violation
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('A preset with this name already exists for this customer');
    }
    throw error;
  }
}

/**
 * Update an accessory preset
 * PUT /api/customers/:customerId/accessory-presets/:presetId
 */
export async function updateAccessoryPreset(req: Request, res: Response) {
  const { customerId, presetId } = req.params;
  const data: UpdatePresetDTO = req.body;

  try {
    const preset = await customerService.updateAccessoryPreset(customerId, presetId, data);

    return res.json({
      success: true,
      message: 'Accessory preset updated successfully',
      data: preset,
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('A preset with this name already exists for this customer');
    }
    throw error;
  }
}

/**
 * Delete an accessory preset (soft delete)
 * DELETE /api/customers/:customerId/accessory-presets/:presetId
 */
export async function deleteAccessoryPreset(req: Request, res: Response) {
  const { presetId } = req.params;

  await customerService.deleteAccessoryPreset(presetId);

  return res.json({
    success: true,
    message: 'Accessory preset deleted successfully',
  });
}

/**
 * Set a preset as the default for a customer
 * POST /api/customers/:customerId/accessory-presets/:presetId/set-default
 */
export async function setDefaultPreset(req: Request, res: Response) {
  const { customerId, presetId } = req.params;

  const preset = await customerService.updateAccessoryPreset(customerId, presetId, { isDefault: true });

  return res.json({
    success: true,
    message: 'Default preset updated successfully',
    data: preset,
  });
}

/**
 * Clone a preset (copy to create a new one)
 * POST /api/customers/:customerId/accessory-presets/:presetId/clone
 */
export async function cloneAccessoryPreset(req: Request, res: Response) {
  const { customerId, presetId } = req.params;
  const { newPresetName } = req.body;

  if (!newPresetName) {
    throw new ValidationError('New preset name is required');
  }

  try {
    const cloned = await customerService.cloneAccessoryPreset(customerId, presetId, newPresetName);

    return res.status(201).json({
      success: true,
      message: 'Preset cloned successfully',
      data: cloned,
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('A preset with this name already exists for this customer');
    }
    throw error;
  }
}
