import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { logError } from '../utils/logger';
import { customerService, AccessoryItem } from '../services/customer.service';

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
  try {
    const { customerId } = req.params;

    const presets = await customerService.getAccessoryPresets(customerId);

    return res.json({
      success: true,
      data: presets,
      total: presets.length,
    });
  } catch (error: unknown) {
    logError('Error fetching customer accessory presets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customer accessory presets',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get a specific accessory preset by ID
 * GET /api/customers/:customerId/accessory-presets/:presetId
 */
export async function getCustomerAccessoryPresetById(req: Request, res: Response) {
  try {
    const { customerId, presetId } = req.params;

    const preset = await customerService.getAccessoryPresetById(presetId, customerId);

    if (!preset) {
      return res.status(404).json({
        success: false,
        message: 'Accessory preset not found',
      });
    }

    return res.json({
      success: true,
      data: preset,
    });
  } catch (error: unknown) {
    logError('Error fetching accessory preset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch accessory preset',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get the default accessory preset for a customer
 * GET /api/customers/:customerId/accessory-presets/default
 */
export async function getDefaultAccessoryPreset(req: Request, res: Response) {
  try {
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
  } catch (error: unknown) {
    logError('Error fetching default accessory preset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch default accessory preset',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create a new accessory preset for a customer
 * POST /api/customers/:customerId/accessory-presets
 */
export async function createAccessoryPreset(req: Request, res: Response) {
  try {
    const { customerId } = req.params;
    const data: CreatePresetDTO = req.body;

    // Validate required fields
    if (!data.presetName) {
      return res.status(400).json({
        success: false,
        message: 'Preset name is required',
      });
    }

    if (!data.items || !Array.isArray(data.items)) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required',
      });
    }

    const preset = await customerService.createAccessoryPreset(customerId, data);

    return res.status(201).json({
      success: true,
      message: 'Accessory preset created successfully',
      data: preset,
    });
  } catch (error: unknown) {
    // Check for unique constraint violation
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'A preset with this name already exists for this customer',
      });
    }
    logError('Error creating accessory preset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create accessory preset',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update an accessory preset
 * PUT /api/customers/:customerId/accessory-presets/:presetId
 */
export async function updateAccessoryPreset(req: Request, res: Response) {
  try {
    const { customerId, presetId } = req.params;
    const data: UpdatePresetDTO = req.body;

    const preset = await customerService.updateAccessoryPreset(customerId, presetId, data);

    return res.json({
      success: true,
      message: 'Accessory preset updated successfully',
      data: preset,
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'A preset with this name already exists for this customer',
      });
    }
    logError('Error updating accessory preset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update accessory preset',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete an accessory preset (soft delete)
 * DELETE /api/customers/:customerId/accessory-presets/:presetId
 */
export async function deleteAccessoryPreset(req: Request, res: Response) {
  try {
    const { presetId } = req.params;

    await customerService.deleteAccessoryPreset(presetId);

    return res.json({
      success: true,
      message: 'Accessory preset deleted successfully',
    });
  } catch (error: unknown) {
    logError('Error deleting accessory preset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete accessory preset',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Set a preset as the default for a customer
 * POST /api/customers/:customerId/accessory-presets/:presetId/set-default
 */
export async function setDefaultPreset(req: Request, res: Response) {
  try {
    const { customerId, presetId } = req.params;

    const preset = await customerService.updateAccessoryPreset(customerId, presetId, { isDefault: true });

    return res.json({
      success: true,
      message: 'Default preset updated successfully',
      data: preset,
    });
  } catch (error: unknown) {
    logError('Error setting default preset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to set default preset',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Clone a preset (copy to create a new one)
 * POST /api/customers/:customerId/accessory-presets/:presetId/clone
 */
export async function cloneAccessoryPreset(req: Request, res: Response) {
  try {
    const { customerId, presetId } = req.params;
    const { newPresetName } = req.body;

    if (!newPresetName) {
      return res.status(400).json({
        success: false,
        message: 'New preset name is required',
      });
    }

    const cloned = await customerService.cloneAccessoryPreset(customerId, presetId, newPresetName);

    return res.status(201).json({
      success: true,
      message: 'Preset cloned successfully',
      data: cloned,
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'A preset with this name already exists for this customer',
      });
    }
    logError('Error cloning accessory preset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clone accessory preset',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
