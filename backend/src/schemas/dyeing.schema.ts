/**
 * Dyeing Module Validation Schemas
 *
 * Zod schemas for lab-dips, dye-jobs, and process-pos endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 *
 * IMPORTANT: These schemas are used by BOTH dyeing.controller.ts AND printing.controller.ts
 * The controllers share similar patterns for lab dips and job work orders.
 */

import { z } from 'zod';

// Helper for validating IDs that can be UUID or CUID (color_master uses CUID)
const isValidIdFormat = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val);

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
 * POST /api/dyeing/lab-dips or /api/printing/lab-dips
 *
 * Controller destructures:
 * - dyeing: styleId, fabricId, targetColorId, colorReference, processorId, submissionDate, expectedDate, remarks
 * - printing: processType, styleId, fabricId, designArtwork, printMethod, printChemistry, targetColorId, colorReference, processorId, submissionDate, expectedDate, remarks
 */
export const createLabDipSchema = z
  .object({
    processType: z.enum(['DYEING', 'PRINTING']).optional().default('DYEING'),
    styleId: z.string().uuid('Invalid style ID'),
    fabricId: z.string().uuid('Invalid fabric ID').optional(),
    targetColorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID' }).optional(),
    colorReference: z.string().max(200).optional(),
    processorId: z.string().uuid('Invalid processor ID').optional(),
    submissionDate: z.string().optional(), // Date string, controller parses with new Date()
    expectedDate: z.string().optional().nullable(),
    remarks: z.string().max(500).optional(),
    // Printing-specific fields
    designArtwork: z.string().max(200).optional(),
    printMethod: z.string().max(100).optional(),
    printChemistry: z.string().max(100).optional(),
  })
  .passthrough();

/**
 * Update Lab Dip
 * PUT /api/dyeing/lab-dips/:id or /api/printing/lab-dips/:id
 *
 * Controller destructures:
 * - dyeing: targetColorId, colorReference, processorId, submissionDate, expectedDate, receivedDate, remarks
 * - printing: designArtwork, printMethod, printChemistry, targetColorId, colorReference, processorId, submissionDate, expectedDate, receivedDate, remarks
 */
export const updateLabDipSchema = z
  .object({
    targetColorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID' }).optional().nullable(),
    colorReference: z.string().max(200).optional().nullable(),
    processorId: z.string().uuid('Invalid processor ID').optional().nullable(),
    submissionDate: z.string().optional().nullable(),
    expectedDate: z.string().optional().nullable(),
    receivedDate: z.string().optional().nullable(),
    remarks: z.string().max(500).optional().nullable(),
    // Printing-specific fields
    designArtwork: z.string().max(200).optional().nullable(),
    printMethod: z.string().max(100).optional().nullable(),
    printChemistry: z.string().max(100).optional().nullable(),
  })
  .passthrough();

/**
 * Lab Dip Query Params
 * GET /api/dyeing/lab-dips or /api/printing/lab-dips
 */
export const labDipQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  processType: z.enum(['DYEING', 'PRINTING']).optional(),
  styleId: z.string().uuid().optional(),
  fabricId: z.string().uuid().optional(),
  processorId: z.string().uuid().optional(),
  status: LabDipStatusEnum.optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

// ============================================================================
// DYE JOB / PRINT JOB SCHEMAS
// ============================================================================

/**
 * Create Dye Job / Print Job
 * POST /api/dyeing/dye-jobs or /api/printing/print-jobs
 *
 * Controller destructures:
 * - dyeing: labDipId, fabricStockLotId, fabricType, reprocessReason, qtySentMeters, sentWidthInches, expectedReturnDate, expectedShrinkage, agreedRatePerMeter, remarks
 * - printing: processType, labDipId, fabricStockLotId, fabricType, reprocessReason, qtySentMeters, sentWidthInches, expectedReturnDate, expectedShrinkage, agreedRatePerMeter, remarks
 */
export const createDyeJobSchema = z
  .object({
    processType: z.enum(['DYEING', 'PRINTING']).optional().default('DYEING'),
    labDipId: z.string().uuid('Invalid lab dip ID'),
    fabricStockLotId: z.string().uuid('Invalid fabric stock lot ID'),
    fabricType: z.string().max(50).optional(),
    reprocessReason: z.string().max(500).optional(),
    qtySentMeters: z.number().positive('Quantity must be positive'),
    sentWidthInches: z.number().positive('Width must be positive'),
    expectedReturnDate: z.string().optional().nullable(),
    expectedShrinkage: z.number().min(0).max(100).optional(),
    agreedRatePerMeter: z.number().nonnegative('Rate cannot be negative'),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Update Dye Job / Print Job
 * PUT /api/dyeing/dye-jobs/:id or /api/printing/print-jobs/:id
 *
 * Controller destructures:
 * fabricStockLotId, fabricType, reprocessReason, qtySentMeters, sentWidthInches, expectedReturnDate, expectedShrinkage, agreedRatePerMeter, remarks
 */
export const updateDyeJobSchema = z
  .object({
    fabricStockLotId: z.string().uuid('Invalid fabric stock lot ID').optional(),
    fabricType: z.string().max(50).optional().nullable(),
    reprocessReason: z.string().max(500).optional().nullable(),
    qtySentMeters: z.number().positive().optional(),
    sentWidthInches: z.number().positive().optional(),
    expectedReturnDate: z.string().optional().nullable(),
    expectedShrinkage: z.number().min(0).max(100).optional().nullable(),
    agreedRatePerMeter: z.number().nonnegative().optional(),
    remarks: z.string().max(500).optional().nullable(),
  })
  .passthrough();

/**
 * Dye Job / Print Job Query Params
 * GET /api/dyeing/dye-jobs or /api/printing/print-jobs
 */
export const dyeJobQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  processType: z.enum(['DYEING', 'PRINTING']).optional(),
  labDipId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  fabricId: z.string().uuid().optional(),
  processorId: z.string().uuid().optional(),
  status: DyeJobStatusEnum.optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

// ============================================================================
// PROCESS PO SCHEMAS
// ============================================================================

/**
 * Create Process PO
 * POST /api/dyeing/process-pos or /api/printing/process-pos
 *
 * Controller destructures:
 * labDipId, greigeStockLotId, fabricStockLotId, qtySentMeters, sentWidthInches, agreedRatePerMeter,
 * expectedReturnDate, expectedShrinkage, fabricType, remarks
 */
export const createProcessPoSchema = z
  .object({
    labDipId: z.string().uuid('Invalid lab dip ID'),
    greigeStockLotId: z.string().uuid('Invalid greige stock lot ID').optional(),
    fabricStockLotId: z.string().uuid('Invalid fabric stock lot ID').optional(),
    qtySentMeters: z.number().positive('Quantity must be positive'),
    sentWidthInches: z.number().positive('Width must be positive'),
    agreedRatePerMeter: z.number().nonnegative('Rate cannot be negative'),
    expectedReturnDate: z.string().optional().nullable(),
    expectedShrinkage: z.number().min(0).max(100).optional(),
    fabricType: z.string().max(50).optional().default('GREIGE'),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Process PO Query Params
 * GET /api/dyeing/process-pos or /api/printing/process-pos
 */
export const processPoQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
});

/**
 * Send Process PO to Mill
 * POST /api/dyeing/process-pos/:id/send or /api/printing/process-pos/:id/send
 *
 * Controller destructures: sentDate, challanNumber, vehicleNumber
 */
export const sendProcessPoSchema = z
  .object({
    sentDate: z.string().optional(), // Date string, controller parses with new Date()
    challanNumber: z.string().max(100).optional(),
    vehicleNumber: z.string().max(50).optional(),
  })
  .passthrough();

/**
 * Receive Process PO from Mill
 * POST /api/dyeing/process-pos/:id/receive or /api/printing/process-pos/:id/receive
 *
 * Controller destructures: qtyReceivedMeters, receivedWidthInches, receivedDate, receivedChallan, invoiceNumber, thanCount, foldLengthCm
 */
export const receiveProcessPoSchema = z
  .object({
    qtyReceivedMeters: z.number().nonnegative().optional(),
    receivedWidthInches: z.number().positive().optional(),
    receivedDate: z.string().optional(),
    receivedChallan: z.string().max(100).optional(),
    invoiceNumber: z.string().max(100).optional(),
    thanCount: z.number().int().nonnegative().optional(),
    foldLengthCm: z.number().positive().optional(),
  })
  .passthrough();

/**
 * Quality Check for Process PO
 * POST /api/dyeing/process-pos/:id/quality-check or /api/printing/process-pos/:id/quality-check
 *
 * Controller destructures: qualityGrade, colorMatchStatus, defectMeters, defectType, actualRate, remarks
 */
export const qualityCheckProcessPoSchema = z
  .object({
    qualityGrade: z.string().max(20).optional(),
    colorMatchStatus: z.string().max(50).optional(),
    defectMeters: z.number().nonnegative().optional(),
    defectType: z.string().max(100).optional(),
    actualRate: z.number().nonnegative().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Return Unprocessed for Process PO
 * POST /api/dyeing/process-pos/:id/return-unprocessed or /api/printing/process-pos/:id/return-unprocessed
 *
 * Controller destructures: returnedQtyMeters, returnDate, remarks
 */
export const returnUnprocessedProcessPoSchema = z
  .object({
    returnedQtyMeters: z.number().positive('Returned quantity must be positive'),
    returnDate: z.string().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Generic Process PO Action (legacy compatibility)
 * Kept for backwards compatibility but specific action schemas above are preferred
 */
export const processPoActionSchema = z
  .object({
    remarks: z.string().max(500).optional(),
    // Send action fields
    sentDate: z.string().optional(),
    challanNumber: z.string().max(100).optional(),
    vehicleNumber: z.string().max(50).optional(),
    // Receive action fields
    qtyReceivedMeters: z.number().nonnegative().optional(),
    receivedWidthInches: z.number().positive().optional(),
    receivedDate: z.string().optional(),
    receivedChallan: z.string().max(100).optional(),
    invoiceNumber: z.string().max(100).optional(),
    thanCount: z.number().int().nonnegative().optional(),
    foldLengthCm: z.number().positive().optional(),
    // Quality check fields
    qualityGrade: z.string().max(20).optional(),
    colorMatchStatus: z.string().max(50).optional(),
    defectMeters: z.number().nonnegative().optional(),
    defectType: z.string().max(100).optional(),
    actualRate: z.number().nonnegative().optional(),
    // Return unprocessed fields
    returnedQtyMeters: z.number().positive().optional(),
    returnDate: z.string().optional(),
  })
  .passthrough();

// ============================================================================
// LAB DIP AND DYE JOB ACTION SCHEMAS
// ============================================================================

/**
 * Approve Lab Dip
 * POST /api/dyeing/lab-dips/:id/approve or /api/printing/lab-dips/:id/approve
 *
 * Controller destructures: approvedSampleNo, colorMatchRating, remarks
 */
export const labDipActionSchema = z
  .object({
    approvedSampleNo: z.string().max(50).optional(),
    colorMatchRating: z.number().min(1).max(5).optional(),
    remarks: z.string().max(500).optional(),
    // For reject action
    rejectionReason: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Send to Mill / Receive from Mill / Quality Check
 * POST /api/dyeing/dye-jobs/:id/send-to-mill, /receive-from-mill, /quality-check
 * POST /api/printing/print-jobs/:id/send-to-mill, /receive-from-mill, /quality-check
 *
 * Different actions use different fields:
 * - sendToMill: sentDate, challanNumber, vehicleNumber
 * - receiveFromMill: qtyReceivedMeters, receivedWidthInches, receivedDate, receivedChallan, invoiceNumber, thanCount, foldLengthCm
 * - qualityCheck: qualityGrade, colorMatchStatus, defectMeters, defectType, actualRate, remarks
 */
export const dyeJobActionSchema = z
  .object({
    // Send to mill fields
    sentDate: z.string().optional(),
    challanNumber: z.string().max(100).optional(),
    vehicleNumber: z.string().max(50).optional(),
    // Receive from mill fields
    qtyReceivedMeters: z.number().nonnegative().optional(),
    receivedWidthInches: z.number().positive().optional(),
    receivedDate: z.string().optional(),
    receivedChallan: z.string().max(100).optional(),
    invoiceNumber: z.string().max(100).optional(),
    thanCount: z.number().int().nonnegative().optional(),
    foldLengthCm: z.number().positive().optional(),
    // Quality check fields
    qualityGrade: z.string().max(20).optional(),
    colorMatchStatus: z.string().max(50).optional(),
    defectMeters: z.number().nonnegative().optional(),
    defectType: z.string().max(100).optional(),
    actualRate: z.number().nonnegative().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

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
export type ProcessPoQueryInput = z.infer<typeof processPoQuerySchema>;
export type ProcessPoActionInput = z.infer<typeof processPoActionSchema>;
export type SendProcessPoInput = z.infer<typeof sendProcessPoSchema>;
export type ReceiveProcessPoInput = z.infer<typeof receiveProcessPoSchema>;
export type QualityCheckProcessPoInput = z.infer<typeof qualityCheckProcessPoSchema>;
export type ReturnUnprocessedProcessPoInput = z.infer<typeof returnUnprocessedProcessPoSchema>;

export type LabDipActionInput = z.infer<typeof labDipActionSchema>;
export type DyeJobActionInput = z.infer<typeof dyeJobActionSchema>;
