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
  getSuppliersByMaterialType,
  getSupplierCategoriesForMaterial,
  getProcessorSuppliers,
  suggestProcessorsForProcessingRequirements,
  bulkAssignProcessorsToProcessingRequirements,
  autoAssignProcessorsToProcessingRequirements,
} from '../services/vendor-suggestion.service';
import { ValidationError } from '../errors';

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
// HELPER: Parse Zod schema with ValidationError
// ============================================

function parseWithValidation<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new ValidationError(`Validation failed: ${details}`);
  }
  return result.data;
}

// ============================================
// CONTROLLER METHODS
// ============================================

/**
 * Get vendor suggestion for a single material
 * POST /api/vendor-suggestions/material
 */
export const suggestForMaterial = async (req: Request, res: Response) => {
  const validatedData = parseWithValidation(SuggestForMaterialSchema, req.body);

  const suggestion = await suggestVendorForMaterial(validatedData.materialId);

  res.json({
    success: true,
    data: suggestion,
  });
};

/**
 * Get vendor suggestions for multiple requirements
 * POST /api/vendor-suggestions/requirements
 */
export const suggestForRequirements = async (req: Request, res: Response) => {
  const validatedData = parseWithValidation(SuggestForRequirementsSchema, req.body);

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
};

/**
 * Bulk assign vendors to requirements
 * POST /api/vendor-suggestions/bulk-assign
 */
export const bulkAssign = async (req: Request, res: Response) => {
  const validatedData = parseWithValidation(BulkAssignVendorsSchema, req.body);

  const updatedCount = await bulkAssignVendors(validatedData.assignments);

  res.json({
    success: true,
    data: {
      updatedCount,
      requested: validatedData.assignments.length,
    },
    message: `${updatedCount} requirement(s) assigned to vendors`,
  });
};

/**
 * Auto-assign vendors based on suggestions
 * POST /api/vendor-suggestions/auto-assign
 */
export const autoAssign = async (req: Request, res: Response) => {
  const validatedData = parseWithValidation(AutoAssignVendorsSchema, req.body);

  const result = await autoAssignVendors(validatedData.requirementIds, validatedData.minConfidence);

  res.json({
    success: true,
    data: result,
    message: `${result.assigned} requirement(s) auto-assigned (${result.skipped} skipped due to low confidence)`,
  });
};

/**
 * Get suppliers filtered by material type
 * GET /api/vendor-suggestions/suppliers-by-type?materialType=GREIGE
 */
export const getSuppliersByType = async (req: Request, res: Response) => {
  const materialType = req.query.materialType as string | undefined;

  const suppliers = await getSuppliersByMaterialType(materialType || null);
  const categories = getSupplierCategoriesForMaterial(materialType || null);

  res.json({
    success: true,
    data: {
      filteredSuppliers: suppliers, // Use 'filteredSuppliers' to avoid serializer transforming 'suppliers' → 'supplier'
      materialType: materialType || null,
      supplierCategories: categories,
      count: suppliers.length,
    },
  });
};

// ============================================
// PROCESSING REQUIREMENT PROCESSOR ASSIGNMENT
// ============================================

const BulkAssignProcessorsSchema = z.object({
  assignments: z
    .array(
      z.object({
        requirementId: z.string().uuid('Invalid requirement ID'),
        processorId: z.string().uuid('Invalid processor ID'),
      })
    )
    .min(1, 'At least one assignment is required'),
});

const AutoAssignProcessorsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
  minConfidence: z.enum(['high', 'medium']).optional().default('medium'),
});

/**
 * Get processor suggestions for PROCESSING material requirements
 * POST /api/mrp/processing-assignment/suggest
 */
export const suggestProcessorsForProcessing = async (req: Request, res: Response) => {
  const validatedData = parseWithValidation(SuggestForRequirementsSchema, req.body);

  const suggestions = await suggestProcessorsForProcessingRequirements(validatedData.requirementIds);

  const stats = {
    total: suggestions.length,
    highConfidence: suggestions.filter((s) => s.confidence === 'high').length,
    mediumConfidence: suggestions.filter((s) => s.confidence === 'medium').length,
    lowConfidence: suggestions.filter((s) => s.confidence === 'low').length,
    withSuggestion: suggestions.filter((s) => s.suggestedProcessorId !== null).length,
    needsManual: suggestions.filter((s) => s.suggestedProcessorId === null).length,
  };

  res.json({
    success: true,
    data: { suggestions, stats },
  });
};

/**
 * Bulk assign processors to PROCESSING material requirements
 * POST /api/mrp/processing-assignment/bulk-assign
 */
export const bulkAssignProcessorsForProcessing = async (req: Request, res: Response) => {
  const validatedData = parseWithValidation(BulkAssignProcessorsSchema, req.body);

  const updatedCount = await bulkAssignProcessorsToProcessingRequirements(validatedData.assignments);

  res.json({
    success: true,
    data: { updatedCount, requested: validatedData.assignments.length },
    message: `${updatedCount} processing requirement(s) assigned to processors`,
  });
};

/**
 * Auto-assign processors to PROCESSING requirements
 * POST /api/mrp/processing-assignment/auto-assign
 */
export const autoAssignProcessorsForProcessing = async (req: Request, res: Response) => {
  const validatedData = parseWithValidation(AutoAssignProcessorsSchema, req.body);

  const result = await autoAssignProcessorsToProcessingRequirements(
    validatedData.requirementIds,
    validatedData.minConfidence
  );

  res.json({
    success: true,
    data: result,
    message: `${result.assigned} requirement(s) auto-assigned (${result.skipped} skipped)`,
  });
};

/**
 * Get list of processor suppliers
 * GET /api/mrp/processing-assignment/processors
 */
export const getProcessorList = async (_req: Request, res: Response) => {
  const processors = await getProcessorSuppliers();

  res.json({
    success: true,
    data: { processorList: processors, count: processors.length },
  });
};
