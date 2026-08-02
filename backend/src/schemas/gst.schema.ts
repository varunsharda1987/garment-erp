/**
 * GST Validation Schemas
 *
 * Zod schemas for GST validation and tax calculation.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// GST SCHEMAS
// ============================================================================

/**
 * Validate GST Number
 * POST /api/gst/validate
 */
export const validateGSTSchema = z.object({
  gstNumber: z.string().length(15, 'GST number must be exactly 15 characters'),
  stateCode: z.string().length(2, 'State code must be exactly 2 digits'),
});

/**
 * Calculate GST
 * POST /api/gst/calculate
 */
export const calculateGSTSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  taxRate: z.number().min(0).max(100, 'Tax rate must be between 0 and 100'),
  supplierStateId: z.string().uuid('Invalid supplier state ID'),
  customerStateId: z.string().uuid('Invalid customer state ID'),
});

/**
 * Get Default Rate
 * POST /api/gst/default-rate
 */
export const getDefaultRateSchema = z.object({
  hsnCode: z.string().max(20).optional(),
  // BUG-FIN4: Add unitPrice for price-based apparel GST slab (5% ≤₹2,500 / 18% >₹2,500)
  unitPrice: z.number().positive().optional(),
});

/**
 * Calculate Bulk GST
 * POST /api/gst/calculate-bulk
 */
export const calculateBulkGSTSchema = z.object({
  items: z
    .array(
      z.object({
        amount: z.number().positive('Amount must be positive'),
        taxRate: z.number().min(0).max(100).optional(),
      })
    )
    .min(1, 'Items array is required and must not be empty'),
  supplierStateId: z.string().uuid('Invalid supplier state ID'),
  customerStateId: z.string().uuid('Invalid customer state ID'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ValidateGSTInput = z.infer<typeof validateGSTSchema>;
export type CalculateGSTInput = z.infer<typeof calculateGSTSchema>;
export type GetDefaultRateInput = z.infer<typeof getDefaultRateSchema>;
export type CalculateBulkGSTInput = z.infer<typeof calculateBulkGSTSchema>;
