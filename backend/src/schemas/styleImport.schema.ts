/**
 * Style Import Validation Schemas
 *
 * Zod schemas for style import and stock operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// STYLE IMPORT SCHEMAS
// ============================================================================

/**
 * A boolean that survives multipart/form-data, where EVERY field arrives as a string.
 * Accepts real booleans (JSON callers) and the strings 'true'/'1'/'false'/'0'/''.
 * NOTE: plain `z.coerce.boolean()` is wrong here — Boolean('false') === true.
 */
const multipartBoolean = z.preprocess((v) => {
  if (typeof v === 'string') {
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0' || v === '') return false;
  }
  return v;
}, z.boolean().optional());

/**
 * Import Styles — MULTIPART (multipart/form-data)
 * POST /api/styles/import
 *
 * ⚠ This body is parsed by multer (`upload.single('file')` in style-import.routes.ts), so
 * validateBody MUST be mounted AFTER it. The CSV/XLSX FILE lives on `req.file` and is never part of
 * req.body — this schema only covers the two option flags the controller destructures.
 *
 * Both are optional; the frontend appends each key only when the user ticks it (and always as the
 * string 'true'). The whole body is normalised from undefined/null to {} so a file-only import,
 * with no option fields at all, cannot 400.
 */
export const importStylesSchema = z.preprocess(
  (body) => (body === undefined || body === null ? {} : body),
  z.object({
    overwriteExisting: multipartBoolean,
    skipDuplicates: multipartBoolean,
  })
);

/**
 * Retry Import
 * POST /api/styles/import/:batchId/retry
 */
export const retryImportSchema = z.object({
  rowIds: z.array(z.string()).optional(),
});

// ============================================================================
// STYLE STOCK SCHEMAS
// ============================================================================

/**
 * Single Style Stock Entry
 */
export const styleStockEntrySchema = z.object({
  fabricId: z.string().uuid('Invalid fabric ID'),
  quantity: z.number().positive('Quantity must be positive'),
  finishedWidth: z.number().nonnegative().optional(),
  cutableWidth: z.number().nonnegative().optional(),
  rollNumbers: z.string().max(500).optional(),
  warehouseLocation: z.string().max(100).optional(),
  qualityGrade: z.enum(['A', 'B', 'DEFECT']).optional(),
  purchaseCost: z.number().nonnegative().optional(),
  receivedDate: z.coerce.date().optional(),
  patternPartId: z.string().uuid().optional(),
  fabricFinishType: z.enum(['DYED', 'PRINTED', 'YARN_DYED', 'RAW']).optional(),
  unit: z.string().max(20).optional().default('METER'),
  lotNumber: z.string().max(50).optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  grnId: z.string().uuid('Invalid GRN ID').optional(),
  unitPrice: z.number().nonnegative().optional(),
  location: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Create Style Stock (Bulk)
 * POST /api/styles/:styleId/stock-entry
 */
export const createStyleStockSchema = z.object({
  entries: z.array(styleStockEntrySchema).min(1, 'At least one entry is required'),
});

/**
 * Bulk Stock Query
 * POST /api/styles/bulk-stock
 */
export const bulkStockQuerySchema = z.object({
  styleIds: z.array(z.string().uuid()).min(1, 'At least one style ID is required'),
});

/**
 * Create Greige Stock
 * POST /api/styles/greige/stock-entry
 */
export const createGreigeStockSchema = z.object({
  greigeId: z.string().uuid('Invalid greige ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('METER'),
  lotNumber: z.string().max(50).optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  grnId: z.string().uuid('Invalid GRN ID').optional(),
  unitPrice: z.number().nonnegative().optional(),
  location: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ImportStylesInput = z.infer<typeof importStylesSchema>;
export type RetryImportInput = z.infer<typeof retryImportSchema>;
export type StyleStockEntryInput = z.infer<typeof styleStockEntrySchema>;
export type CreateStyleStockInput = z.infer<typeof createStyleStockSchema>;
export type BulkStockQueryInput = z.infer<typeof bulkStockQuerySchema>;
export type CreateGreigeStockInput = z.infer<typeof createGreigeStockSchema>;
