/**
 * Processing Module Validation Schemas
 *
 * Zod schemas for processing stages, movements, and deliveries.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const ProcessingStageStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REWORK', 'CANCELLED']);

export const MovementStatusEnum = z.enum(['IN_TRANSIT', 'DELIVERED', 'CANCELLED']);

export const DeliveryStatusEnum = z.enum(['PENDING_QC', 'QC_PASSED', 'QC_FAILED', 'ACCEPTED', 'REJECTED']);

export const QCResultEnum = z.enum(['PASS', 'FAIL', 'CONDITIONAL']);

// Mirrors Prisma `enum QualityStatus { PASS FAIL CONDITIONAL_PASS }`
export const QualityStatusEnum = z.enum(['PASS', 'FAIL', 'CONDITIONAL_PASS']);

// ============================================================================
// PROCESSING STAGE SCHEMAS
// ============================================================================

/**
 * Create Processing Stage
 * POST /api/processing-stages
 */
export const createProcessingStageSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  processorId: z.string().uuid('Invalid processor ID'),
  processType: z.string().max(50),
  sequenceNumber: z.number().int().positive().optional(),
  expectedQuantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('PIECE'),
  expectedStartDate: z.string().datetime().optional(),
  expectedEndDate: z.string().datetime().optional(),
  rate: z.number().nonnegative().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Processing Stage
 * PUT /api/processing-stages/:id
 */
export const updateProcessingStageSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID').optional(),
  processType: z.string().max(50).optional(),
  sequenceNumber: z.number().int().positive().optional(),
  expectedQuantity: z.number().positive().optional(),
  actualQuantity: z.number().nonnegative().optional(),
  unit: z.string().max(20).optional(),
  expectedStartDate: z.string().datetime().optional().nullable(),
  expectedEndDate: z.string().datetime().optional().nullable(),
  actualStartDate: z.string().datetime().optional().nullable(),
  actualEndDate: z.string().datetime().optional().nullable(),
  rate: z.number().nonnegative().optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Update Stage Status
 * PATCH /api/processing-stages/:id/status
 */
export const updateStageStatusSchema = z.object({
  status: ProcessingStageStatusEnum,
  remarks: z.string().max(500).optional(),
});

/**
 * Complete Stage
 * POST /api/processing-stages/:id/complete
 */
export const completeStageSchema = z.object({
  // completeStage(id) takes no quantity today, so requiring it rejected the natural empty-body call.
  // NOTE: if completion should record an actual quantity, that needs a column + service change.
  actualQuantity: z.coerce.number().nonnegative('Quantity cannot be negative').optional(),
  completedDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Mark for Rework
 * POST /api/processing-stages/:id/rework
 */
// Both fields are now genuinely recorded (owner decision 2026-07-29: the rework quantity must be
// captured, not just the reason) — processing_stage gained a reworkQuantity column and the
// controller/service persist both. `remarks` was removed: processing_stage has no column for it, so
// accepting it only promised storage that never happened.
export const markForReworkSchema = z.object({
  reworkQuantity: z.coerce.number().positive('Rework quantity must be positive'),
  reworkReason: z.string().min(1, 'Rework reason is required').max(500),
});

/**
 * Processing Stage Query Params
 * GET /api/processing-stages
 */
export const processingStageQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  batchId: z.string().uuid().optional(),
  processorId: z.string().uuid().optional(),
  processType: z.string().max(50).optional(),
  status: ProcessingStageStatusEnum.optional(),
});

// ============================================================================
// PROCESSING MOVEMENT SCHEMAS
// ============================================================================

/**
 * Create Processing Movement
 * POST /api/processing-movements
 */
export const createProcessingMovementSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  fromStageId: z.string().uuid('Invalid from stage ID').optional(),
  toStageId: z.string().uuid('Invalid to stage ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('PIECE'),
  dispatchDate: z.string().datetime().optional(),
  vehicleNumber: z.string().max(50).optional(),
  driverName: z.string().max(100).optional(),
  driverContact: z.string().max(20).optional(),
  challanNumber: z.string().max(50).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Processing Movement
 * PUT /api/processing-movements/:id
 */
export const updateProcessingMovementSchema = z.object({
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  dispatchDate: z.string().datetime().optional().nullable(),
  vehicleNumber: z.string().max(50).optional().nullable(),
  driverName: z.string().max(100).optional().nullable(),
  driverContact: z.string().max(20).optional().nullable(),
  challanNumber: z.string().max(50).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Mark as Delivered
 * POST /api/processing-movements/:id/deliver
 */
export const markAsDeliveredSchema = z.object({
  // Not read by the deliver handler; required only forced callers to send a dead field.
  deliveredQuantity: z.coerce.number().nonnegative('Delivered quantity cannot be negative').optional(),
  deliveredDate: z.string().datetime().optional(),
  receivedBy: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Processing Movement Query Params
 * GET /api/processing-movements
 */
export const processingMovementQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  batchId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  status: MovementStatusEnum.optional(),
});

// ============================================================================
// PROCESSING DELIVERY SCHEMAS
// ============================================================================

/**
 * Create Processing Delivery
 * POST /api/processing-deliveries
 */
export const createProcessingDeliverySchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  stageId: z.string().uuid('Invalid stage ID'),
  movementId: z.string().uuid('Invalid movement ID').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('PIECE'),
  deliveryDate: z.string().datetime().optional(),
  challanNumber: z.string().max(50).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Processing Delivery
 * PUT /api/processing-deliveries/:id
 */
export const updateProcessingDeliverySchema = z.object({
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  deliveryDate: z.string().datetime().optional().nullable(),
  challanNumber: z.string().max(50).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Perform QC
 * POST /api/processing-deliveries/:id/qc
 */
export const performQCSchema = z.object({
  quantityAccepted: z.number().nonnegative(),
  quantityRejected: z.number().nonnegative(),
  qualityStatus: QualityStatusEnum,
  qualityNotes: z.string().max(500).optional(),
  rejectionReason: z.string().max(500).optional(),
});

/**
 * Accept Delivery
 * POST /api/processing-deliveries/:id/accept
 */
export const acceptDeliverySchema = z.object({
  // Controller reads nothing from the body — keep optional so an empty POST /accept passes.
  acceptedQuantity: z.number().nonnegative('Accepted quantity cannot be negative').optional(),
  acceptedDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Reject Delivery
 * POST /api/processing-deliveries/:id/reject
 */
export const rejectDeliverySchema = z.object({
  // Controller reads only { reason }.
  reason: z.string().min(1, 'Rejection reason is required').max(500),
  rejectedDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Processing Delivery Query Params
 * GET /api/processing-deliveries
 */
export const processingDeliveryQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  batchId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  status: DeliveryStatusEnum.optional(),
});

// ============================================================================
// PROCESSING BATCH SCHEMAS
// ============================================================================

// Material type a batch can be created for (matches CreateProcessingBatchDTO)
export const ProcessingMaterialTypeEnum = z.enum(['GREIGE', 'FABRIC', 'LACE']);

/**
 * Create Processing Batch
 * POST /api/processing-batches
 * `createdById` is injected by the controller from the authenticated user — NOT accepted from the body.
 */
export const createProcessingBatchSchema = z.object({
  materialType: ProcessingMaterialTypeEnum,
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  fabricId: z.string().uuid('Invalid fabric ID').optional(),
  laceId: z.string().uuid('Invalid lace ID').optional(),
  totalQuantitySent: z.number().positive('Total quantity sent must be positive'),
  quantityInProcess: z.number().nonnegative('Quantity in process cannot be negative'),
  // Lace-specific fields
  colorToApply: z.string().max(100).optional(),
  expectedShrinkagePercent: z.number().min(0).max(100).optional(),
});

/**
 * Update Processing Batch
 * PUT /api/processing-batches/:id
 * Only user-editable operational quantities + lace notes. Deliberately EXCLUDES
 * overallStatus, totalCostIncurred, batchNumber, createdById, and material FKs
 * (greigeId/fabricId/laceId/finishedLaceId) — those are managed by dedicated
 * flows (complete/cancel/receiveProcessedLace), not raw body mass-assignment.
 */
export const updateProcessingBatchSchema = z
  .object({
    totalQuantityReceived: z.number().nonnegative().optional(),
    quantityInProcess: z.number().nonnegative().optional(),
    quantityInTransit: z.number().nonnegative().optional(),
    quantityRejected: z.number().nonnegative().optional(),
    dyeLotNumber: z.string().max(50).optional(),
    shadeNote: z.string().max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

// ============================================================================
// Param Validation Schemas
// ============================================================================

export const processingMovementIdParamSchema = z.object({
  id: z.string().uuid('Invalid movement ID'),
});

export const processingStageIdParamSchema = z.object({
  id: z.string().uuid('Invalid stage ID'),
});

export const processingDeliveryIdParamSchema = z.object({
  id: z.string().uuid('Invalid delivery ID'),
});

export const batchIdParamSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
});

export const stageIdParamSchema = z.object({
  stageId: z.string().uuid('Invalid stage ID'),
});

export const processorIdParamSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
});

export const processingBatchIdParamSchema = z.object({
  id: z.string().uuid('Invalid batch ID'),
});

// ============================================================================
// Type Exports
// ============================================================================

// Stage types
export type CreateProcessingStageInput = z.infer<typeof createProcessingStageSchema>;
export type UpdateProcessingStageInput = z.infer<typeof updateProcessingStageSchema>;
export type UpdateStageStatusInput = z.infer<typeof updateStageStatusSchema>;
export type CompleteStageInput = z.infer<typeof completeStageSchema>;
export type MarkForReworkInput = z.infer<typeof markForReworkSchema>;
export type ProcessingStageQueryInput = z.infer<typeof processingStageQuerySchema>;

// Movement types
export type CreateProcessingMovementInput = z.infer<typeof createProcessingMovementSchema>;
export type UpdateProcessingMovementInput = z.infer<typeof updateProcessingMovementSchema>;
export type MarkAsDeliveredInput = z.infer<typeof markAsDeliveredSchema>;
export type ProcessingMovementQueryInput = z.infer<typeof processingMovementQuerySchema>;

// Delivery types
export type CreateProcessingDeliveryInput = z.infer<typeof createProcessingDeliverySchema>;
export type UpdateProcessingDeliveryInput = z.infer<typeof updateProcessingDeliverySchema>;
export type PerformQCInput = z.infer<typeof performQCSchema>;
export type AcceptDeliveryInput = z.infer<typeof acceptDeliverySchema>;
export type RejectDeliveryInput = z.infer<typeof rejectDeliverySchema>;
export type ProcessingDeliveryQueryInput = z.infer<typeof processingDeliveryQuerySchema>;

// Batch types
export type CreateProcessingBatchInput = z.infer<typeof createProcessingBatchSchema>;
export type UpdateProcessingBatchInput = z.infer<typeof updateProcessingBatchSchema>;
