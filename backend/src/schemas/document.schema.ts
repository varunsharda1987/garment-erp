/**
 * Document Module Validation Schemas
 *
 * Zod schemas for document generation endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// CATALOGUE SCHEMAS
// ============================================================================

/**
 * Generate Catalogue PDF
 * POST /api/documents/catalogue/generate
 * POST /api/documents/catalogue/store
 */
export const generateCatalogueSchema = z.object({
  styleIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.number().int().positive()).optional(),
  brandCategoryIds: z.array(z.number().int().positive()).optional(),
  priceRange: z
    .object({
      min: z.number().nonnegative().optional(),
      max: z.number().positive().optional(),
    })
    .optional(),
  priceDisplay: z.enum(['b2b', 'b2r', 'both', 'none']),
  showFabricDetails: z.boolean().optional().default(false),
  showSizeRange: z.boolean().optional().default(true),
  includeIndex: z.boolean().optional().default(false),
  columnsPerPage: z.number().int().min(1).max(4).optional().default(2),
  catalogueName: z.string().max(200).optional(),
});

// ============================================================================
// LINE SHEET SCHEMAS
// ============================================================================

/**
 * Generate Line Sheet PDF/Excel
 * POST /api/documents/line-sheet/pdf
 * POST /api/documents/line-sheet/excel
 */
export const generateLineSheetSchema = z.object({
  styleIds: z.array(z.string().uuid()).min(1, 'At least one style is required'),
  showWholesalePrice: z.boolean().optional().default(true),
  showRetailPrice: z.boolean().optional().default(false),
  buyerCompany: z.string().max(200).optional(),
  buyerContact: z.string().max(100).optional(),
  buyerEmail: z.string().email().optional(),
  title: z.string().max(200).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type GenerateCatalogueInput = z.infer<typeof generateCatalogueSchema>;
export type GenerateLineSheetInput = z.infer<typeof generateLineSheetSchema>;
