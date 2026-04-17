/**
 * Printing Module Validation Schemas
 *
 * Zod schemas for print lab-dips, print-jobs, and process-pos endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const PrintLabDipStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'REVISED']);

export const PrintJobStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

export const PrintProcessPoStatusEnum = z.enum([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

// ============================================================================
// PRINT LAB DIP SCHEMAS
// ============================================================================

/**
 * Create Print Lab Dip
 * POST /api/printing/lab-dips
 */
export const createPrintLabDipSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  fabricId: z.string().uuid('Invalid fabric ID').optional(),
  printDesignId: z.string().uuid('Invalid print design ID').optional(),
  printType: z.string().max(50).optional(),
  colorway: z.string().max(100).optional(),
  processorId: z.string().uuid('Invalid processor ID').optional(),
  requestedDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Print Lab Dip
 * PUT /api/printing/lab-dips/:id
 */
export const updatePrintLabDipSchema = z.object({
  printType: z.string().max(50).optional().nullable(),
  colorway: z.string().max(100).optional().nullable(),
  processorId: z.string().uuid('Invalid processor ID').optional().nullable(),
  requestedDate: z.string().datetime().optional().nullable(),
  status: PrintLabDipStatusEnum.optional(),
  approvedDate: z.string().datetime().optional().nullable(),
  approvedBy: z.string().uuid().optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Print Lab Dip Query Params
 * GET /api/printing/lab-dips
 */
export const printLabDipQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  styleId: z.string().uuid().optional(),
  fabricId: z.string().uuid().optional(),
  processorId: z.string().uuid().optional(),
  status: PrintLabDipStatusEnum.optional(),
});

/**
 * Print Lab Dip Action (Approve/Reject/Resubmit)
 * POST /api/printing/lab-dips/:id/approve, reject, resubmit
 */
export const printLabDipActionSchema = z.object({
  remarks: z.string().max(500).optional(),
  rejectionReason: z.string().max(500).optional(),
});

// ============================================================================
// PRINT JOB SCHEMAS
// ============================================================================

/**
 * Create Print Job
 * POST /api/printing/jobs
 */
export const createPrintJobSchema = z.object({
  labDipId: z.string().uuid('Invalid lab dip ID').optional(),
  styleId: z.string().uuid('Invalid style ID'),
  fabricId: z.string().uuid('Invalid fabric ID'),
  processorId: z.string().uuid('Invalid processor ID'),
  printDesignId: z.string().uuid('Invalid print design ID').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('METER'),
  targetDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Print Job
 * PUT /api/printing/jobs/:id
 */
export const updatePrintJobSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID').optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  targetDate: z.string().datetime().optional().nullable(),
  status: PrintJobStatusEnum.optional(),
  actualQuantity: z.number().nonnegative().optional().nullable(),
  completedDate: z.string().datetime().optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Print Job Query Params
 * GET /api/printing/jobs
 */
export const printJobQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  styleId: z.string().uuid().optional(),
  fabricId: z.string().uuid().optional(),
  processorId: z.string().uuid().optional(),
  status: PrintJobStatusEnum.optional(),
});

/**
 * Print Job Action (Send/Receive/QC/Update Stock)
 * POST /api/printing/jobs/:id/send, receive, quality-check, update-stock
 */
export const printJobActionSchema = z.object({
  remarks: z.string().max(500).optional(),
  actualQuantity: z.number().nonnegative().optional(),
  qualityGrade: z.string().max(20).optional(),
  defects: z.string().max(500).optional(),
});

// ============================================================================
// PRINT PROCESS PO SCHEMAS
// ============================================================================

/**
 * Print Process PO Item
 */
const printProcessPoItemSchema = z.object({
  fabricId: z.string().uuid('Invalid fabric ID').optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  description: z.string().max(500).optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('METER'),
  rate: z.number().nonnegative('Rate cannot be negative'),
  printType: z.string().max(50).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Create Print Process PO
 * POST /api/printing/process-pos
 */
export const createPrintProcessPoSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
  styleId: z.string().uuid('Invalid style ID').optional(),
  orderId: z.string().uuid('Invalid order ID').optional(),
  processType: z.string().max(50),
  expectedDeliveryDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
  items: z.array(printProcessPoItemSchema).min(1, 'At least one item is required'),
});

/**
 * Print Process PO Query Params
 * GET /api/printing/process-pos
 */
export const printProcessPoQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  processorId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  status: PrintProcessPoStatusEnum.optional(),
});

/**
 * Print Process PO Action (Send/Receive/QC/Update Stock/Return)
 * POST /api/printing/process-pos/:id/send, receive, quality-check, update-stock, return-unprocessed
 */
export const printProcessPoActionSchema = z.object({
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreatePrintLabDipInput = z.infer<typeof createPrintLabDipSchema>;
export type UpdatePrintLabDipInput = z.infer<typeof updatePrintLabDipSchema>;
export type PrintLabDipQueryInput = z.infer<typeof printLabDipQuerySchema>;
export type PrintLabDipActionInput = z.infer<typeof printLabDipActionSchema>;

export type CreatePrintJobInput = z.infer<typeof createPrintJobSchema>;
export type UpdatePrintJobInput = z.infer<typeof updatePrintJobSchema>;
export type PrintJobQueryInput = z.infer<typeof printJobQuerySchema>;
export type PrintJobActionInput = z.infer<typeof printJobActionSchema>;

export type CreatePrintProcessPoInput = z.infer<typeof createPrintProcessPoSchema>;
export type PrintProcessPoQueryInput = z.infer<typeof printProcessPoQuerySchema>;
export type PrintProcessPoActionInput = z.infer<typeof printProcessPoActionSchema>;
