/**
 * AI Admin Validation Schemas
 *
 * Zod schemas for AI admin operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// AI ADMIN SCHEMAS
// ============================================================================

/**
 * Search Documents
 * POST /api/ai-admin/search
 */
export const searchDocumentsSchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000),
  limit: z.number().int().min(1).max(50).optional().default(5),
  documentType: z.string().max(50).optional(),
});

/**
 * Update RAG Config
 * PUT /api/ai-admin/rag/config
 */
export const updateRagConfigSchema = z.object({
  maxDocuments: z.number().int().min(1).max(50).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
});

/**
 * Delete Documents by Type
 * DELETE /api/ai-admin/documents/:type
 * BUG-ADM4 fix: require explicit confirmation for dangerous delete operation
 */
export const deleteDocumentsSchema = z.object({
  confirmDelete: z.literal(true, { message: 'Must confirm delete by setting confirmDelete to true' }),
});

/**
 * Full Reindex
 * POST /api/ai-admin/index/all
 * BUG-ADM4 fix: require explicit confirmation for potentially disruptive reindex
 */
export const fullReindexSchema = z.object({
  confirmReindex: z.literal(true, { message: 'Must confirm full reindex by setting confirmReindex to true' }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SearchDocumentsInput = z.infer<typeof searchDocumentsSchema>;
export type UpdateRagConfigInput = z.infer<typeof updateRagConfigSchema>;
export type DeleteDocumentsInput = z.infer<typeof deleteDocumentsSchema>;
export type FullReindexInput = z.infer<typeof fullReindexSchema>;
