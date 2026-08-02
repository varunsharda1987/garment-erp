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

// Must match the Prisma LabDipStatus enum exactly (the UI dropdown already does).
// It previously invented IN_PROGRESS/REVISED (absent from the DB → 500 if ever written) and omitted
// SUBMITTED/RESUBMIT — the real states the controller sets — so filtering the Lab Dips list by
// "Submitted" or "Resubmit Needed" returned 400.
export const LabDipStatusEnum = z.enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RESUBMIT']);

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
 * Bulk Create Lab Dips (Unified for DYEING + PRINTING)
 * POST /api/lab-dips/bulk
 *
 * Creates multiple lab dips at once for a single style.
 * Handles both DYED and PRINTED fabrics in one request.
 */
export const bulkCreateLabDipSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  submissionDate: z.string().optional(),
  labDips: z
    .array(
      z.object({
        styleFabricId: z.string().uuid('Invalid style fabric ID'),
        processType: z.enum(['DYEING', 'PRINTING']),
        processorId: z.string().uuid('Invalid processor ID'),
        // For DYEING
        targetColorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID' }).optional(),
        colorReference: z.string().max(200).optional(),
        // For PRINTING
        designArtwork: z.string().max(200).optional(),
        printMethod: z.string().max(100).optional(),
        printChemistry: z.string().max(100).optional(),
        // Common
        expectedDate: z.string().optional().nullable(),
        remarks: z.string().max(500).optional(),
      })
    )
    .min(1, 'At least one lab dip is required'),
});

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
 * Style-based: Can create PO directly from style without lab dip approval.
 * If labDipId is not provided, styleId, fabricId, and processorId are required.
 *
 * Controller destructures:
 * labDipId, styleId, fabricId, processorId, greigeStockLotId, fabricStockLotId, qtySentMeters,
 * sentWidthInches, agreedRatePerMeter, isRateTbd, expectedReturnDate, expectedShrinkage, fabricType,
 * remarks, autoSend, sentDate, challanNumber, vehicleNumber
 */
export const createProcessPoSchema = z
  .object({
    labDipId: z.string().uuid('Invalid lab dip ID').optional(), // Now optional - style-based PO
    styleId: z.string().uuid('Invalid style ID').optional(), // Required if no labDipId
    fabricId: z.string().uuid('Invalid fabric ID').optional(), // Required if no labDipId
    processorId: z.string().uuid('Invalid processor ID').optional(), // Required if no labDipId
    greigeStockLotId: z.string().uuid('Invalid greige stock lot ID').optional(),
    fabricStockLotId: z.string().uuid('Invalid fabric stock lot ID').optional(),
    qtySentMeters: z.number().positive('Quantity must be positive'),
    sentWidthInches: z.number().positive('Width must be positive'),
    agreedRatePerMeter: z.number().nonnegative('Rate cannot be negative'),
    isRateTbd: z.boolean().optional().default(false), // Explicit TBD marker when rate=0 is intentional
    expectedReturnDate: z.string().optional().nullable(),
    expectedShrinkage: z.number().min(0).max(100).optional(),
    fabricType: z.string().max(50).optional().default('GREIGE'),
    remarks: z.string().max(500).optional(),
    // Auto-send fields (Create & Send one-click)
    autoSend: z.boolean().optional().default(false), // If true, immediately send to mill after creation
    sentDate: z.string().optional(), // Used when autoSend=true
    challanNumber: z.string().max(100).optional(), // Used when autoSend=true
    vehicleNumber: z.string().max(50).optional(), // Used when autoSend=true
  })
  .passthrough()
  .refine((data) => data.labDipId || (data.styleId && data.fabricId && data.processorId), {
    message: 'Either labDipId OR (styleId, fabricId, and processorId) must be provided',
  });

/**
 * Bulk Create Process POs (Unified for DYEING + PRINTING)
 * POST /api/process-pos/bulk
 *
 * Creates multiple process POs at once for a single style.
 */
export const bulkCreateProcessPoSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  processPOs: z
    .array(
      z.object({
        styleFabricId: z.string().uuid('Invalid style fabric ID'),
        processType: z.enum(['DYEING', 'PRINTING']),
        processorId: z.string().uuid('Invalid processor ID'),
        greigeStockLotId: z.string().uuid('Invalid greige stock lot ID').optional(),
        qtySentMeters: z.number().positive('Quantity must be positive'),
        sentWidthInches: z.number().positive('Width must be positive'),
        agreedRatePerMeter: z.number().nonnegative('Rate cannot be negative'),
        expectedReturnDate: z.string().optional().nullable(),
        expectedShrinkage: z.number().min(0).max(100).optional(),
        // For PRINTING
        printMethod: z.string().max(100).optional(),
        printChemistry: z.string().max(100).optional(),
        remarks: z.string().max(500).optional(),
      })
    )
    .min(1, 'At least one process PO is required'),
});

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
 * Lab Dip Actions (Approve/Reject/Resubmit/SendToBuyer/BuyerApprove/BuyerReject)
 * POST /api/dyeing/lab-dips/:id/approve, reject, resubmit, send-to-buyer, buyer-approve, buyer-reject
 *
 * approve: approvedSampleNo, colorMatchRating, remarks
 * reject: rejectionReason, remarks
 * resubmit: remarks
 * sendToBuyer: sentToBuyerDate, remarks
 * buyerApprove: buyerRemarks
 * buyerReject: buyerRemarks
 */
export const labDipActionSchema = z
  .object({
    approvedSampleNo: z.string().max(50).optional(),
    // BUG-DYE4 fix: colorMatchRating scale aligned with printing module
    // Both modules use the same 4-level scale: Excellent, Good, Acceptable, Poor
    colorMatchRating: z.enum(['Excellent', 'Good', 'Acceptable', 'Poor']).optional(),
    rejectionReason: z.string().max(500).optional(),
    sentToBuyerDate: z.coerce.date().optional(),
    buyerRemarks: z.string().max(500).optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

export const BuyerApprovalStatusEnum = z.enum(['NOT_SENT', 'PENDING', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUIRED']);

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
export type BulkCreateLabDipInput = z.infer<typeof bulkCreateLabDipSchema>;
export type UpdateLabDipInput = z.infer<typeof updateLabDipSchema>;
export type LabDipQueryInput = z.infer<typeof labDipQuerySchema>;

export type CreateDyeJobInput = z.infer<typeof createDyeJobSchema>;
export type UpdateDyeJobInput = z.infer<typeof updateDyeJobSchema>;
export type DyeJobQueryInput = z.infer<typeof dyeJobQuerySchema>;

export type CreateProcessPoInput = z.infer<typeof createProcessPoSchema>;
export type BulkCreateProcessPoInput = z.infer<typeof bulkCreateProcessPoSchema>;
export type ProcessPoQueryInput = z.infer<typeof processPoQuerySchema>;
export type ProcessPoActionInput = z.infer<typeof processPoActionSchema>;
export type SendProcessPoInput = z.infer<typeof sendProcessPoSchema>;
export type ReceiveProcessPoInput = z.infer<typeof receiveProcessPoSchema>;
export type QualityCheckProcessPoInput = z.infer<typeof qualityCheckProcessPoSchema>;
export type ReturnUnprocessedProcessPoInput = z.infer<typeof returnUnprocessedProcessPoSchema>;

export type LabDipActionInput = z.infer<typeof labDipActionSchema>;
export type DyeJobActionInput = z.infer<typeof dyeJobActionSchema>;
