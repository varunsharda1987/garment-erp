/**
 * BOM Controller - Thin HTTP layer
 * Delegates all business logic to bomService
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { Unit } from '@prisma/client';
import { bomService } from '../services/bom.service';
import { logError } from '../utils/logger';
import { ValidationError, ConflictError, NotFoundError, BusinessError } from '../errors';

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

    const bom = await bomService.createWithItems(validatedData, userId);

    res.status(201).json({
      success: true,
      data: bom,
      message: `BOM version ${bom.version} created successfully`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to create BOM');
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
      search,
    } = req.query;

    const result = await bomService.findAllWithFilters({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      search: search as string,
      styleId: styleId as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      approved: approved !== undefined ? approved === 'true' : undefined,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch BOMs');
  }
};

/**
 * Get a single BOM by ID
 * GET /api/bom/:id
 */
export const getBOMById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bom = await bomService.getFullDetails(id);

    res.json({
      success: true,
      data: bom,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch BOM');
  }
};

/**
 * Get active BOM for a style
 * GET /api/bom/style/:styleId/active
 */
export const getActiveBOMByStyle = async (req: Request, res: Response) => {
  try {
    const { styleId } = req.params;
    const bom = await bomService.getActiveByStyle(styleId);

    res.json({
      success: true,
      data: bom,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch active BOM');
  }
};

/**
 * Get all BOM versions for a style
 * GET /api/bom/style/:styleId/versions
 */
export const getBOMVersionsByStyle = async (req: Request, res: Response) => {
  try {
    const { styleId } = req.params;
    const boms = await bomService.getVersionsByStyle(styleId);

    res.json({
      success: true,
      data: boms,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch BOM versions');
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

    const updatedBOM = await bomService.updateItems(id, validatedData);

    res.json({
      success: true,
      data: updatedBOM,
      message: 'BOM updated successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to update BOM');
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

    const updatedBOM = await bomService.approve(id, userId, approved);

    res.json({
      success: true,
      data: updatedBOM,
      message: approved ? 'BOM approved successfully' : 'BOM approval revoked',
    });
  } catch (error) {
    handleError(res, error, 'Failed to approve BOM');
  }
};

/**
 * Delete a BOM (soft delete by deactivating)
 * DELETE /api/bom/:id
 */
export const deleteBOM = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await bomService.deactivate(id);

    res.json({
      success: true,
      message: 'BOM deactivated successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete BOM');
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

    const result = await bomService.calculateMaterialRequirements(id, orderQuantity);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(res, error, 'Failed to calculate material requirements');
  }
};

/**
 * Centralized error handler for controller
 */
function handleError(res: Response, error: unknown, defaultMessage: string): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.issues,
    });
    return;
  }

  if (error instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: error.message,
    });
    return;
  }

  if (error instanceof ConflictError) {
    res.status(409).json({
      success: false,
      error: 'Conflict',
      message: error.message,
    });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: error.message,
    });
    return;
  }

  if (error instanceof BusinessError) {
    res.status(400).json({
      success: false,
      error: 'Business Error',
      message: error.message,
    });
    return;
  }

  logError(defaultMessage, error);
  res.status(500).json({
    success: false,
    error: defaultMessage,
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}
