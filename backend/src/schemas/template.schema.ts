/**
 * Template Validation Schemas
 *
 * Zod schemas for export template management.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Column Config Schema
// ============================================================================

// BUG-ET2/ET3 fix: schema used field/header but frontend uses fieldName/displayName
const ColumnConfigItemSchema = z.object({
  fieldName: z.string().min(1).max(100),
  displayName: z.string().max(100).optional(),
  width: z.number().positive().optional(),
  format: z.string().max(50).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  visible: z.boolean().optional().default(true),
});

// ============================================================================
// TEMPLATE SCHEMAS
// ============================================================================

/**
 * Create Template
 * POST /api/templates
 */
export const createTemplateSchema = z.object({
  moduleName: z.string().min(1, 'Module name is required').max(100),
  templateName: z.string().min(1, 'Template name is required').max(100),
  description: z.string().max(500).optional(),
  columnConfig: z.array(ColumnConfigItemSchema).min(1, 'At least one column is required'),
  isDefault: z.boolean().optional().default(false),
});

/**
 * Update Template
 * PUT /api/templates/:id
 */
export const updateTemplateSchema = z.object({
  templateName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  columnConfig: z.array(ColumnConfigItemSchema).optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Query Templates
 * GET /api/templates
 * BUG-ET10 fix: module is REQUIRED in schema (not just controller) for consistent validation
 */
export const templateQuerySchema = z.object({
  module: z.string().min(1, 'Module name is required').max(100),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type TemplateQueryInput = z.infer<typeof templateQuerySchema>;
