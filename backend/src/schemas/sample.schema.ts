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
 *
 * Controller destructures:
 * - customerId, styleId, sampleType, requestDate, requiredDate, remarks
 * - sampleSizeId, fitSampleReference, ppSampleReference, linkedDispatchId, productionLot, sentTo, purpose
 * - measurements, colorways, sizeSets
 * - adminOverride, overrideReason
 */
export const createSampleSchema = z
  .object({
    customerId: z.string().uuid('Invalid customer ID'),
    styleId: z.string().uuid('Invalid style ID').optional(),
    sampleType: SampleTypeEnum,
    requestDate: z.string().datetime().optional(),
    requiredDate: z.string().datetime(),
    remarks: z.string().max(500).optional(),
    // Type-specific fields
    sampleSizeId: z.string().uuid('Invalid sample size ID').optional(),
    fitSampleReference: z.string().max(200).optional(),
    ppSampleReference: z.string().max(200).optional(),
    linkedDispatchId: z.string().uuid('Invalid dispatch ID').optional(),
    productionLot: z.string().max(100).optional(),
    sentTo: z.string().max(200).optional(),
    purpose: z.string().max(500).optional(),
    // Nested data
    measurements: z
      .array(
        z.object({
          sizeId: z.string().uuid().optional(),
          measurementPoint: z.string(),
          specValue: z.number(),
          actualValue: z.number().optional(),
          tolerance: z.number().optional(),
        })
      )
      .optional(),
    colorways: z
      .array(
        z.object({
          colorId: z.string(),
          sizeId: z.string().uuid().optional(),
          fabricLot: z.string().optional(),
          qtySent: z.number().int().positive().optional(),
        })
      )
      .optional(),
    sizeSets: z
      .array(
        z.object({
          sizeId: z.string().uuid(),
          colorId: z.string(),
          qty: z.number().int().positive().optional(),
        })
      )
      .optional(),
    // Admin override
    adminOverride: z.boolean().optional(),
    overrideReason: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Update Sample
 * PUT /api/samples/:id
 *
 * Controller destructures:
 * - requiredDate, completionDate, status, customerFeedback, remarks
 * - sentDate, courierMode, trackingNumber, receivedDate, feedbackDate
 * - measurementComments, revisionRequired, nextAction
 */
export const updateSampleSchema = z
  .object({
    requiredDate: z.string().datetime().optional(),
    completionDate: z.string().datetime().optional().nullable(),
    status: SampleStatusEnum.optional(),
    customerFeedback: z.string().max(2000).optional().nullable(),
    remarks: z.string().max(500).optional().nullable(),
    sentDate: z.string().datetime().optional().nullable(),
    courierMode: z.string().max(100).optional().nullable(),
    trackingNumber: z.string().max(100).optional().nullable(),
    receivedDate: z.string().datetime().optional().nullable(),
    feedbackDate: z.string().datetime().optional().nullable(),
    measurementComments: z.string().max(1000).optional().nullable(),
    revisionRequired: z.boolean().optional(),
    nextAction: z.string().max(500).optional().nullable(),
  })
  .passthrough();

/**
 * Update Sample Status
 * PATCH /api/samples/:id/status
 */
export const updateSampleStatusSchema = z
  .object({
    status: SampleStatusEnum,
    feedback: z.string().max(1000).optional(),
    comments: z.string().max(500).optional(), // Controller uses 'comments' not 'remarks'
  })
  .passthrough();

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
 *
 * Controller destructures: sentDate, courierMode, trackingNumber
 */
export const markAsSentSchema = z
  .object({
    sentDate: z.string().datetime().optional(),
    courierMode: z.string().max(100).optional(),
    trackingNumber: z.string().max(100).optional(),
  })
  .passthrough();

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
 *
 * Controller destructures: status, feedback, feedbackDate, measurementComments
 */
export const recordFeedbackSchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'REVISION_NEEDED']),
    feedback: z.string().max(1000).optional(),
    feedbackDate: z.string().datetime().optional(),
    measurementComments: z.string().max(1000).optional(),
  })
  .passthrough();

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
