import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { logError } from '../utils/logger';

const prisma = new PrismaClient();

// Types for accessory items stored in JSON
interface AccessoryItem {
  id: string;
  materialType: string; // LABEL, BUTTON, THREAD, etc.
  materialId?: string;
  itemName: string;
  quantity: number;
  unit?: string;
  usageCategory: 'GARMENT' | 'PACKAGING';
  specification?: string;
  sortOrder?: number;
}

interface CreatePresetDTO {
  presetName: string;
  description?: string;
  accessoryItems: AccessoryItem[];
  isDefault?: boolean;
}

interface UpdatePresetDTO {
  presetName?: string;
  description?: string;
  accessoryItems?: AccessoryItem[];
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
    const { isActive } = req.query;

    const where: Prisma.customer_accessories_presetsWhereInput = { customerId };
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const presets = await prisma.customer_accessories_presets.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { presetName: 'asc' },
      ],
    });

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

    const preset = await prisma.customer_accessories_presets.findFirst({
      where: {
        id: presetId,
        customerId,
      },
    });

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

    const preset = await prisma.customer_accessories_presets.findFirst({
      where: {
        customerId,
        isDefault: true,
        isActive: true,
      },
    });

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

    // Verify customer exists
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // If this is set as default, unset other defaults first
    if (data.isDefault) {
      await prisma.customer_accessories_presets.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Add IDs to accessory items if not present
    const accessoryItemsWithIds = (data.accessoryItems || []).map((item, index) => ({
      ...item,
      id: item.id || `item-${Date.now()}-${index}`,
      sortOrder: item.sortOrder ?? index,
    }));

    const preset = await prisma.customer_accessories_presets.create({
      data: {
        customerId,
        presetName: data.presetName,
        description: data.description,
        accessoryItems: accessoryItemsWithIds as unknown as Prisma.InputJsonValue,
        isDefault: data.isDefault ?? false,
      },
    });

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

    // Verify preset exists and belongs to customer
    const existing = await prisma.customer_accessories_presets.findFirst({
      where: {
        id: presetId,
        customerId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Accessory preset not found',
      });
    }

    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await prisma.customer_accessories_presets.updateMany({
        where: { customerId, isDefault: true, id: { not: presetId } },
        data: { isDefault: false },
      });
    }

    // Prepare update data
    const updateData: Prisma.customer_accessories_presetsUpdateInput = {};
    if (data.presetName !== undefined) updateData.presetName = data.presetName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.accessoryItems !== undefined) {
      // Add IDs to new items if not present
      const itemsWithIds = data.accessoryItems.map((item, index) => ({
        ...item,
        id: item.id || `item-${Date.now()}-${index}`,
        sortOrder: item.sortOrder ?? index,
      }));
      updateData.accessoryItems = itemsWithIds as unknown as Prisma.InputJsonValue;
    }

    const preset = await prisma.customer_accessories_presets.update({
      where: { id: presetId },
      data: updateData,
    });

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
 * Delete an accessory preset
 * DELETE /api/customers/:customerId/accessory-presets/:presetId
 */
export async function deleteAccessoryPreset(req: Request, res: Response) {
  try {
    const { customerId, presetId } = req.params;

    // Verify preset exists and belongs to customer
    const existing = await prisma.customer_accessories_presets.findFirst({
      where: {
        id: presetId,
        customerId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Accessory preset not found',
      });
    }

    await prisma.customer_accessories_presets.delete({
      where: { id: presetId },
    });

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

    // Verify preset exists and belongs to customer
    const existing = await prisma.customer_accessories_presets.findFirst({
      where: {
        id: presetId,
        customerId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Accessory preset not found',
      });
    }

    // Unset all defaults for this customer
    await prisma.customer_accessories_presets.updateMany({
      where: { customerId, isDefault: true },
      data: { isDefault: false },
    });

    // Set this preset as default
    const preset = await prisma.customer_accessories_presets.update({
      where: { id: presetId },
      data: { isDefault: true },
    });

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

    // Get the source preset
    const source = await prisma.customer_accessories_presets.findFirst({
      where: {
        id: presetId,
        customerId,
      },
    });

    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Source preset not found',
      });
    }

    // Create clone with new name
    const cloned = await prisma.customer_accessories_presets.create({
      data: {
        customerId,
        presetName: newPresetName,
        description: source.description ? `Copy of: ${source.description}` : `Copy of ${source.presetName}`,
        accessoryItems: source.accessoryItems as Prisma.InputJsonValue,
        isDefault: false, // Clones are never default
      },
    });

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
