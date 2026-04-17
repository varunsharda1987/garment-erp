/**
 * Sample Validation Schemas
 *
 * Zod schemas for sample CRUD and workflow operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const SampleTypeEnum = z.enum(['DEVELOPMENT', 'FIT', 'PRE_PRODUCTION', 'PRODUCTION', 'PHOTO_SHOOT']);

export const SampleStatusEnum = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'SENT',
  'RECEIVED',
  'APPROVED',
  'REJECTED',
  'REVISION_REQUIRED',
]);

// ============================================================================
// SAMPLE SCHEMAS
// ============================================================================

/**
 * Create Sample
 * POST /api/samples
 */
export const createSampleSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  customerId: z.string().uuid('Invalid customer ID').optional(),
  sampleType: SampleTypeEnum,
  quantity: z.number().int().positive('Quantity must be positive').optional().default(1),
  requiredDate: z.string().datetime().optional(),
  colorId: z.string().uuid('Invalid color ID').optional(),
  sizeId: z.string().uuid('Invalid size ID').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  remarks: z.string().max(500).optional(),
  specifications: z.string().max(2000).optional(),
});

/**
 * Update Sample
 * PUT /api/samples/:id
 */
export const updateSampleSchema = z.object({
  styleId: z.string().uuid('Invalid style ID').optional(),
  customerId: z.string().uuid('Invalid customer ID').optional().nullable(),
  sampleType: SampleTypeEnum.optional(),
  quantity: z.number().int().positive().optional(),
  requiredDate: z.string().datetime().optional().nullable(),
  colorId: z.string().uuid('Invalid color ID').optional().nullable(),
  sizeId: z.string().uuid('Invalid size ID').optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  remarks: z.string().max(500).optional().nullable(),
  specifications: z.string().max(2000).optional().nullable(),
});

/**
 * Update Sample Status
 * PATCH /api/samples/:id/status
 */
export const updateSampleStatusSchema = z.object({
  status: SampleStatusEnum,
  feedback: z.string().max(1000).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Measurements
 * PUT /api/samples/:id/measurements
 */
export const updateMeasurementsSchema = z.object({
  measurements: z.array(
    z.object({
      measurementPointId: z.string().uuid('Invalid measurement point ID'),
      targetValue: z.number().positive().optional(),
      tolerance: z.number().nonnegative().optional(),
    })
  ),
});

/**
 * Record Actual Measurements
 * PATCH /api/samples/:id/measurements/actual
 */
export const recordActualMeasurementsSchema = z.object({
  measurements: z.array(
    z.object({
      measurementPointId: z.string().uuid('Invalid measurement point ID'),
      actualValue: z.number().positive(),
      remarks: z.string().max(500).optional(),
    })
  ),
  inspectedBy: z.string().uuid('Invalid user ID').optional(),
});

/**
 * Mark as Sent
 * POST /api/samples/:id/send
 */
export const markAsSentSchema = z.object({
  sentDate: z.string().datetime().optional(),
  trackingNumber: z.string().max(100).optional(),
  courier: z.string().max(100).optional(),
  sentTo: z.string().max(200).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Record Receipt
 * POST /api/samples/:id/receive
 */
export const recordReceiptSchema = z.object({
  receivedDate: z.string().datetime().optional(),
  receivedBy: z.string().max(200).optional(),
  condition: z.string().max(200).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Record Feedback
 * POST /api/samples/:id/feedback
 */
export const recordFeedbackSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'REVISION_REQUIRED']),
  feedback: z.string().max(1000),
  feedbackDate: z.string().datetime().optional(),
  feedbackBy: z.string().max(200).optional(),
  attachments: z.array(z.string().max(500)).optional(),
});

/**
 * Create Revision
 * POST /api/samples/:id/revision
 */
export const createRevisionSchema = z.object({
  remarks: z.string().max(500).optional(),
  changesToMake: z.string().max(2000).optional(),
});

/**
 * Sample Query Params
 * GET /api/samples
 */
export const sampleQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  styleId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  sampleType: SampleTypeEnum.optional(),
  status: SampleStatusEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  pendingApproval: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateSampleInput = z.infer<typeof createSampleSchema>;
export type UpdateSampleInput = z.infer<typeof updateSampleSchema>;
export type UpdateSampleStatusInput = z.infer<typeof updateSampleStatusSchema>;
export type UpdateMeasurementsInput = z.infer<typeof updateMeasurementsSchema>;
export type RecordActualMeasurementsInput = z.infer<typeof recordActualMeasurementsSchema>;
export type MarkAsSentInput = z.infer<typeof markAsSentSchema>;
export type RecordReceiptInput = z.infer<typeof recordReceiptSchema>;
export type RecordFeedbackInput = z.infer<typeof recordFeedbackSchema>;
export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;
export type SampleQueryInput = z.infer<typeof sampleQuerySchema>;
