/**
 * Vendor Suggestion Controller
 * HTTP endpoints for intelligent supplier recommendations
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import {
  suggestVendorForMaterial,
  suggestVendorsForRequirements,
  bulkAssignVendors,
  autoAssignVendors,
} from '../services/vendor-suggestion.service';
import { logError } from '../utils/logger';
import { ValidationError, NotFoundError, BusinessError } from '../errors';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const SuggestForMaterialSchema = z.object({
  materialId: z.string().uuid('Invalid material ID'),
});

const SuggestForRequirementsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
});

const BulkAssignVendorsSchema = z.object({
  assignments: z
    .array(
      z.object({
        requirementId: z.string().uuid('Invalid requirement ID'),
        supplierId: z.string().uuid('Invalid supplier ID'),
      })
    )
    .min(1, 'At least one assignment is required'),
});

const AutoAssignVendorsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
  minConfidence: z.enum(['high', 'medium']).optional().default('medium'),
});

// ============================================
// CONTROLLER METHODS
// ============================================

/**
 * Get vendor suggestion for a single material
 * POST /api/vendor-suggestions/material
 */
export const suggestForMaterial = async (req: Request, res: Response) => {
  try {
    const validatedData = SuggestForMaterialSchema.parse(req.body);

    const suggestion = await suggestVendorForMaterial(validatedData.materialId);

    res.json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    handleError(res, error, 'Failed to suggest vendor for material');
  }
};

/**
 * Get vendor suggestions for multiple requirements
 * POST /api/vendor-suggestions/requirements
 */
export const suggestForRequirements = async (req: Request, res: Response) => {
  try {
    const validatedData = SuggestForRequirementsSchema.parse(req.body);

    const suggestions = await suggestVendorsForRequirements(validatedData.requirementIds);

    // Summary statistics
    const stats = {
      total: suggestions.length,
      highConfidence: suggestions.filter((s) => s.confidence === 'high').length,
      mediumConfidence: suggestions.filter((s) => s.confidence === 'medium').length,
      lowConfidence: suggestions.filter((s) => s.confidence === 'low').length,
      withSuggestion: suggestions.filter((s) => s.suggestedSupplierId !== null).length,
      needsManual: suggestions.filter((s) => s.suggestedSupplierId === null).length,
    };

    res.json({
      success: true,
      data: {
        suggestions,
        stats,
      },
    });
  } catch (error) {
    handleError(res, error, 'Failed to suggest vendors for requirements');
  }
};

/**
 * Bulk assign vendors to requirements
 * POST /api/vendor-suggestions/bulk-assign
 */
export const bulkAssign = async (req: Request, res: Response) => {
  try {
    const validatedData = BulkAssignVendorsSchema.parse(req.body);

    const updatedCount = await bulkAssignVendors(validatedData.assignments);

    res.json({
      success: true,
      data: {
        updatedCount,
        requested: validatedData.assignments.length,
      },
      message: `${updatedCount} requirement(s) assigned to vendors`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to bulk assign vendors');
  }
};

/**
 * Auto-assign vendors based on suggestions
 * POST /api/vendor-suggestions/auto-assign
 */
export const autoAssign = async (req: Request, res: Response) => {
  try {
    const validatedData = AutoAssignVendorsSchema.parse(req.body);

    const result = await autoAssignVendors(
      validatedData.requirementIds,
      validatedData.minConfidence
    );

    res.json({
      success: true,
      data: result,
      message: `${result.assigned} requirement(s) auto-assigned (${result.skipped} skipped due to low confidence)`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to auto-assign vendors');
  }
};

// ============================================
// ERROR HANDLER
// ============================================

function handleError(res: Response, error: unknown, defaultMessage: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.issues.map((e: z.ZodIssue) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  if (error instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      error: error.message,
    });
  }

  if (error instanceof BusinessError) {
    return res.status(422).json({
      success: false,
      error: error.message,
    });
  }

  logError(`${defaultMessage}:`, error);
  return res.status(500).json({
    success: false,
    error: defaultMessage,
  });
}
