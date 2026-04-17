/**
 * Dyeing Module Validation Schemas
 *
 * Zod schemas for lab-dips, dye-jobs, and process-pos endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const LabDipStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'REVISED']);

export const DyeJobStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

export const ProcessPoStatusEnum = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

// ============================================================================
// LAB DIP SCHEMAS
// ============================================================================

/**
 * Create Lab Dip
 * POST /api/dyeing/lab-dips
 */
export const createLabDipSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  fabricId: z.string().uuid('Invalid fabric ID').optional(),
  colorId: z.string().uuid('Invalid color ID').optional(),
  colorCode: z.string().max(50).optional(),
  colorName: z.string().max(100).optional(),
  targetShade: z.string().max(100).optional(),
  processorId: z.string().uuid('Invalid processor ID').optional(),
  requestedDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Lab Dip
 * PUT /api/dyeing/lab-dips/:id
 */
export const updateLabDipSchema = z.object({
  colorCode: z.string().max(50).optional().nullable(),
  colorName: z.string().max(100).optional().nullable(),
  targetShade: z.string().max(100).optional().nullable(),
  processorId: z.string().uuid('Invalid processor ID').optional().nullable(),
  requestedDate: z.string().datetime().optional().nullable(),
  status: LabDipStatusEnum.optional(),
  approvedShade: z.string().max(100).optional().nullable(),
  approvedDate: z.string().datetime().optional().nullable(),
  approvedBy: z.string().uuid().optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Lab Dip Query Params
 * GET /api/dyeing/lab-dips
 */
export const labDipQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  styleId: z.string().uuid().optional(),
  fabricId: z.string().uuid().optional(),
  processorId: z.string().uuid().optional(),
  status: LabDipStatusEnum.optional(),
});

// ============================================================================
// DYE JOB SCHEMAS
// ============================================================================

/**
 * Create Dye Job
 * POST /api/dyeing/dye-jobs
 */
export const createDyeJobSchema = z.object({
  labDipId: z.string().uuid('Invalid lab dip ID').optional(),
  styleId: z.string().uuid('Invalid style ID'),
  fabricId: z.string().uuid('Invalid fabric ID'),
  colorId: z.string().uuid('Invalid color ID').optional(),
  processorId: z.string().uuid('Invalid processor ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('KG'),
  targetDate: z.string().datetime().optional(),
  dyeRecipeId: z.string().uuid().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Dye Job
 * PUT /api/dyeing/dye-jobs/:id
 */
export const updateDyeJobSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID').optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  targetDate: z.string().datetime().optional().nullable(),
  status: DyeJobStatusEnum.optional(),
  actualQuantity: z.number().nonnegative().optional().nullable(),
  completedDate: z.string().datetime().optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Dye Job Query Params
 * GET /api/dyeing/dye-jobs
 */
export const dyeJobQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  styleId: z.string().uuid().optional(),
  fabricId: z.string().uuid().optional(),
  processorId: z.string().uuid().optional(),
  status: DyeJobStatusEnum.optional(),
});

// ============================================================================
// PROCESS PO SCHEMAS
// ============================================================================

/**
 * Process PO Item
 */
const processPoItemSchema = z.object({
  fabricId: z.string().uuid('Invalid fabric ID').optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  description: z.string().max(500).optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('METER'),
  rate: z.number().nonnegative('Rate cannot be negative'),
  processType: z.string().max(50).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Create Process PO
 * POST /api/dyeing/process-pos
 */
export const createProcessPoSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
  styleId: z.string().uuid('Invalid style ID').optional(),
  orderId: z.string().uuid('Invalid order ID').optional(),
  processType: z.string().max(50),
  expectedDeliveryDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
  items: z.array(processPoItemSchema).min(1, 'At least one item is required'),
});

/**
 * Update Process PO
 * PUT /api/dyeing/process-pos/:id
 */
export const updateProcessPoSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID').optional(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
  status: ProcessPoStatusEnum.optional(),
  remarks: z.string().max(500).optional().nullable(),
  items: z.array(processPoItemSchema).optional(),
});

/**
 * Process PO Query Params
 * GET /api/dyeing/process-pos
 */
export const processPoQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  processorId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  status: ProcessPoStatusEnum.optional(),
  processType: z.string().max(50).optional(),
});

/**
 * Process PO Action (Approve/Reject/Cancel)
 * POST /api/dyeing/process-pos/:id/approve, reject, cancel
 */
export const processPoActionSchema = z.object({
  remarks: z.string().max(500).optional(),
  rejectionReason: z.string().max(500).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateLabDipInput = z.infer<typeof createLabDipSchema>;
export type UpdateLabDipInput = z.infer<typeof updateLabDipSchema>;
export type LabDipQueryInput = z.infer<typeof labDipQuerySchema>;

export type CreateDyeJobInput = z.infer<typeof createDyeJobSchema>;
export type UpdateDyeJobInput = z.infer<typeof updateDyeJobSchema>;
export type DyeJobQueryInput = z.infer<typeof dyeJobQuerySchema>;

export type CreateProcessPoInput = z.infer<typeof createProcessPoSchema>;
export type UpdateProcessPoInput = z.infer<typeof updateProcessPoSchema>;
export type ProcessPoQueryInput = z.infer<typeof processPoQuerySchema>;
export type ProcessPoActionInput = z.infer<typeof processPoActionSchema>;

// Lab Dip and Dye Job Action Schemas
export const labDipActionSchema = z.object({
  remarks: z.string().max(500).optional(),
  approvedShade: z.string().max(100).optional(),
  rejectionReason: z.string().max(500).optional(),
});

export const dyeJobActionSchema = z.object({
  remarks: z.string().max(500).optional(),
  actualQuantity: z.number().nonnegative().optional(),
  qualityGrade: z.string().max(20).optional(),
  defects: z.string().max(500).optional(),
});

export type LabDipActionInput = z.infer<typeof labDipActionSchema>;
export type DyeJobActionInput = z.infer<typeof dyeJobActionSchema>;
