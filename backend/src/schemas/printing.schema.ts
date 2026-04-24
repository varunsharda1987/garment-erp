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
 *
 * Controller destructures: processType, styleId, fabricId, designArtwork, printMethod,
 * printChemistry, targetColorId, colorReference, processorId, submissionDate, expectedDate, remarks
 */
export const createPrintLabDipSchema = z
  .object({
    processType: z.string().max(50).optional().default('PRINTING'),
    styleId: z.string().uuid('Invalid style ID'),
    fabricId: z.string().uuid('Invalid fabric ID').optional(),
    designArtwork: z.string().max(200).optional(),
    printMethod: z.string().max(100).optional(),
    printChemistry: z.string().max(100).optional(),
    targetColorId: z.string().uuid('Invalid target color ID').optional(),
    colorReference: z.string().max(100).optional(),
    processorId: z.string().uuid('Invalid processor ID').optional(),
    submissionDate: z.string().datetime(),
    expectedDate: z.string().datetime().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Update Print Lab Dip
 * PUT /api/printing/lab-dips/:id
 *
 * Controller destructures: designArtwork, printMethod, printChemistry, targetColorId,
 * colorReference, processorId, submissionDate, expectedDate, receivedDate, remarks
 */
export const updatePrintLabDipSchema = z
  .object({
    designArtwork: z.string().max(200).optional().nullable(),
    printMethod: z.string().max(100).optional().nullable(),
    printChemistry: z.string().max(100).optional().nullable(),
    targetColorId: z.string().uuid('Invalid target color ID').optional().nullable(),
    colorReference: z.string().max(100).optional().nullable(),
    processorId: z.string().uuid('Invalid processor ID').optional().nullable(),
    submissionDate: z.string().datetime().optional().nullable(),
    expectedDate: z.string().datetime().optional().nullable(),
    receivedDate: z.string().datetime().optional().nullable(),
    remarks: z.string().max(500).optional().nullable(),
  })
  .passthrough();

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
 *
 * approve: approvedSampleNo, colorMatchRating, remarks
 * reject: rejectionReason, remarks
 * resubmit: remarks
 */
export const printLabDipActionSchema = z
  .object({
    approvedSampleNo: z.string().max(50).optional(),
    colorMatchRating: z.number().min(0).max(10).optional(),
    rejectionReason: z.string().max(500).optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

// ============================================================================
// PRINT JOB SCHEMAS
// ============================================================================

/**
 * Create Print Job
 * POST /api/printing/jobs
 *
 * Controller destructures: processType, labDipId, fabricStockLotId, fabricType,
 * reprocessReason, qtySentMeters, sentWidthInches, expectedReturnDate, expectedShrinkage,
 * agreedRatePerMeter, remarks
 */
export const createPrintJobSchema = z
  .object({
    processType: z.string().max(50).optional().default('PRINTING'),
    labDipId: z.string().uuid('Invalid lab dip ID'),
    fabricStockLotId: z.string().uuid('Invalid fabric stock lot ID'),
    fabricType: z.string().max(50).optional(),
    reprocessReason: z.string().max(500).optional(),
    qtySentMeters: z.number().positive('Quantity must be positive'),
    sentWidthInches: z.number().positive('Width must be positive'),
    expectedReturnDate: z.string().datetime().optional(),
    expectedShrinkage: z.number().min(0).max(100).optional(),
    agreedRatePerMeter: z.number().nonnegative('Rate cannot be negative'),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Update Print Job
 * PUT /api/printing/jobs/:id
 *
 * Controller destructures: fabricStockLotId, fabricType, reprocessReason, qtySentMeters,
 * sentWidthInches, expectedReturnDate, expectedShrinkage, agreedRatePerMeter, remarks
 */
export const updatePrintJobSchema = z
  .object({
    fabricStockLotId: z.string().uuid('Invalid fabric stock lot ID').optional(),
    fabricType: z.string().max(50).optional(),
    reprocessReason: z.string().max(500).optional(),
    qtySentMeters: z.number().positive().optional(),
    sentWidthInches: z.number().positive().optional(),
    expectedReturnDate: z.string().datetime().optional().nullable(),
    expectedShrinkage: z.number().min(0).max(100).optional().nullable(),
    agreedRatePerMeter: z.number().nonnegative().optional().nullable(),
    remarks: z.string().max(500).optional().nullable(),
  })
  .passthrough();

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
 *
 * sendToMill: sentDate, challanNumber, vehicleNumber
 * receiveFromMill: qtyReceivedMeters, receivedWidthInches, receivedDate, receivedChallan, invoiceNumber, thanCount, foldLengthCm
 * qualityCheck: qualityGrade, colorMatchStatus, defectMeters, defectType, actualRate, remarks
 */
export const printJobActionSchema = z
  .object({
    // sendToMill fields
    sentDate: z.string().datetime().optional(),
    challanNumber: z.string().max(100).optional(),
    vehicleNumber: z.string().max(50).optional(),
    // receiveFromMill fields
    qtyReceivedMeters: z.number().nonnegative().optional(),
    receivedWidthInches: z.number().positive().optional(),
    receivedDate: z.string().datetime().optional(),
    receivedChallan: z.string().max(100).optional(),
    invoiceNumber: z.string().max(100).optional(),
    thanCount: z.number().int().nonnegative().optional(),
    foldLengthCm: z.number().positive().optional(),
    // qualityCheck fields
    qualityGrade: z.string().max(20).optional(),
    colorMatchStatus: z.string().max(50).optional(),
    defectMeters: z.number().nonnegative().optional(),
    defectType: z.string().max(200).optional(),
    actualRate: z.number().nonnegative().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

// ============================================================================
// PRINT PROCESS PO SCHEMAS
// ============================================================================

/**
 * Create Print Process PO
 * POST /api/printing/process-pos
 *
 * Controller destructures: labDipId, greigeStockLotId, fabricStockLotId, qtySentMeters,
 * sentWidthInches, agreedRatePerMeter, expectedReturnDate, expectedShrinkage, fabricType, remarks
 */
export const createPrintProcessPoSchema = z
  .object({
    labDipId: z.string().uuid('Invalid lab dip ID'),
    greigeStockLotId: z.string().uuid('Invalid greige stock lot ID').optional(),
    fabricStockLotId: z.string().uuid('Invalid fabric stock lot ID').optional(),
    qtySentMeters: z.number().positive('Quantity must be positive'),
    sentWidthInches: z.number().positive('Width must be positive'),
    agreedRatePerMeter: z.number().nonnegative('Rate cannot be negative'),
    expectedReturnDate: z.string().datetime().optional(),
    expectedShrinkage: z.number().min(0).max(100).optional(),
    fabricType: z.string().max(50).optional().default('GREIGE'),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

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
 *
 * sendProcessPO: sentDate, challanNumber, vehicleNumber
 * receiveProcessPO: qtyReceivedMeters, receivedWidthInches, receivedDate, receivedChallan, invoiceNumber, thanCount, foldLengthCm
 * qualityCheckProcessPO: qualityGrade, colorMatchStatus, defectMeters, defectType, actualRate, remarks
 * returnUnprocessedProcessPO: returnedQtyMeters, returnDate, remarks
 */
export const printProcessPoActionSchema = z
  .object({
    // sendProcessPO fields
    sentDate: z.string().datetime().optional(),
    challanNumber: z.string().max(100).optional(),
    vehicleNumber: z.string().max(50).optional(),
    // receiveProcessPO fields
    qtyReceivedMeters: z.number().nonnegative().optional(),
    receivedWidthInches: z.number().positive().optional(),
    receivedDate: z.string().datetime().optional(),
    receivedChallan: z.string().max(100).optional(),
    invoiceNumber: z.string().max(100).optional(),
    thanCount: z.number().int().nonnegative().optional(),
    foldLengthCm: z.number().positive().optional(),
    // qualityCheckProcessPO fields
    qualityGrade: z.string().max(20).optional(),
    colorMatchStatus: z.string().max(50).optional(),
    defectMeters: z.number().nonnegative().optional(),
    defectType: z.string().max(200).optional(),
    actualRate: z.number().nonnegative().optional(),
    // returnUnprocessedProcessPO fields
    returnedQtyMeters: z.number().positive().optional(),
    returnDate: z.string().datetime().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

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
