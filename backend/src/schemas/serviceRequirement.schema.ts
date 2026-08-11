/**
 * Service Requirement Validation Schemas
 *
 * Zod schemas for work order service requirement management.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

// Aligned with Prisma enum ServiceType (schema.prisma) — do NOT add values Prisma lacks
export const ServiceTypeEnum = z.enum([
  'EMBROIDERY',
  'PRINTING',
  'DYEING',
  'WASHING',
  'FINISHING',
  'CUTTING',
  'STITCHING',
  'HANDWORK',
  'SMOCKING',
  'TRANSPORTATION',
  'OTHER',
]);

// Aligned with Prisma enum ServiceRequirementStatus (schema.prisma) — do NOT add values Prisma lacks
export const ServiceRequirementStatusEnum = z.enum([
  'PENDING',
  'PO_GENERATED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

// ============================================================================
// SERVICE REQUIREMENT SCHEMAS
// ============================================================================

/**
 * Calculate Services
 * POST /api/work-orders/:workOrderId/calculate-services
 * The acting user is taken from the auth token (req.user.userId), not the body (bug B06-05).
 */
export const calculateServicesSchema = z.object({});

/**
 * Query Service Requirements for Work Order
 * GET /api/work-orders/:workOrderId/service-requirements
 */
export const serviceRequirementQuerySchema = z.object({
  status: ServiceRequirementStatusEnum.optional(),
  serviceType: ServiceTypeEnum.optional(),
});

/**
 * List All Service Requirements
 * GET /api/service-requirements/list
 */
export const listServiceRequirementsSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  workOrderId: z.string().uuid().optional(),
  status: ServiceRequirementStatusEnum.optional(),
  serviceType: ServiceTypeEnum.optional(),
  processorId: z.string().uuid().optional(),
  source: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Suggest Processor
 * POST /api/service-requirements/suggest-processor
 */
export const suggestProcessorSchema = z.object({
  serviceType: ServiceTypeEnum,
  styleId: z.string().uuid('Invalid style ID').optional(),
});

/**
 * Suggest Processors Bulk
 * POST /api/service-requirements/suggest-processors-bulk
 */
export const suggestProcessorsBulkSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
});

/**
 * Bulk Assign Processors
 * POST /api/service-requirements/bulk-assign-processors
 */
export const bulkAssignProcessorsSchema = z.object({
  assignments: z
    .array(
      z.object({
        requirementId: z.string().uuid('Invalid requirement ID'),
        processorId: z.string().uuid('Invalid processor ID'),
      })
    )
    .min(1, 'At least one assignment is required'),
});

/**
 * Auto Assign Processors
 * POST /api/service-requirements/auto-assign-processors
 */
export const autoAssignProcessorsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
  minConfidence: z.enum(['high', 'medium']).optional(),
});

/**
 * Group by Processor
 * POST /api/service-requirements/group-by-processor
 */
export const groupByProcessorSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
});

/**
 * Generate Job Work Order(s) — Phase 5a (replaces generate-po)
 * POST /api/service-requirements/generate-jwo
 */
export const generateJwoSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
  // Accepts 'YYYY-MM-DD' from <input type="date"> as well as full ISO strings
  expectedDeliveryDate: z.coerce.date(),
  remarks: z.string().max(1000).optional(),
});

/**
 * Bulk Generate Job Work Orders — Phase 5a (replaces generate-pos-bulk)
 * POST /api/service-requirements/generate-jwos-bulk
 */
export const bulkGenerateJwosSchema = z.object({
  groups: z
    .array(
      z.object({
        processorId: z.string().uuid('Invalid processor ID'),
        requirementIds: z.array(z.string().uuid()).min(1),
        // Kept as a string (service converts internally via new Date());
        // .refine accepts 'YYYY-MM-DD' from <input type="date"> unlike .datetime()
        expectedDeliveryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: 'Invalid date format',
        }),
        remarks: z.string().max(1000).optional(),
      })
    )
    .min(1, 'At least one group is required'),
});

/**
 * Update Execution
 * PATCH /api/service-requirements/:id/execution
 * Phase 5a (D8): job_work_orders is the ONLY execution target.
 */
export const updateExecutionSchema = z.object({
  jobWorkOrderId: z.string().uuid('Invalid job work order ID').optional(),
  actualQuantity: z.number().positive().optional(),
  actualCost: z.number().positive().optional(),
  status: ServiceRequirementStatusEnum,
});

// ============================================================================
// Type Exports
// ============================================================================

export type CalculateServicesInput = z.infer<typeof calculateServicesSchema>;
export type ServiceRequirementQueryInput = z.infer<typeof serviceRequirementQuerySchema>;
export type ListServiceRequirementsInput = z.infer<typeof listServiceRequirementsSchema>;
export type SuggestProcessorInput = z.infer<typeof suggestProcessorSchema>;
export type SuggestProcessorsBulkInput = z.infer<typeof suggestProcessorsBulkSchema>;
export type BulkAssignProcessorsInput = z.infer<typeof bulkAssignProcessorsSchema>;
export type AutoAssignProcessorsInput = z.infer<typeof autoAssignProcessorsSchema>;
export type GroupByProcessorInput = z.infer<typeof groupByProcessorSchema>;
export type GenerateJwoInput = z.infer<typeof generateJwoSchema>;
export type BulkGenerateJwosInput = z.infer<typeof bulkGenerateJwosSchema>;
export type UpdateExecutionInput = z.infer<typeof updateExecutionSchema>;
