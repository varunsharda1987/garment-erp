/**
 * Job Work Order Schemas
 * Validation for the unified JWO API surface (Consolidation Phase 3).
 */
import { z } from 'zod';
import { ProcessTypeEnum } from './generated/prisma-enums';

/**
 * POST /api/job-work-orders — create a DRAFT job work order.
 *
 * Quantity is in the process type's unit of measure (MTR for fabric processes,
 * PCS for garment processes, TRIP for transportation — defaulted from
 * process_type_master when uom is omitted).
 *
 * KAAJ_BUTTON is piece-based with two tracked operations: quantity = garment pieces,
 * buttonholeCount/buttonCount drive the commercial total
 * (buttonholeCount × buttonholeRatePerUnit + buttonCount × buttonRatePerUnit);
 * rates default from system settings KAAJ_BUTTONHOLE_RATE_PER_UNIT / KAAJ_BUTTON_RATE_PER_UNIT.
 */
export const createJobWorkOrderSchema = z
  .object({
    processType: ProcessTypeEnum,
    processorId: z.string().uuid('Invalid processor ID'),
    styleId: z.string().uuid('Invalid style ID').optional().nullable(),
    fabricId: z.string().uuid('Invalid fabric ID').optional().nullable(),
    quantity: z.number().positive('Quantity must be positive'),
    uom: z.enum(['MTR', 'PCS', 'KG', 'TRIP']).optional(),
    agreedRate: z.number().nonnegative('Rate cannot be negative').optional().default(0),
    isRateTbd: z.boolean().optional().default(false),
    expectedReturnDate: z.coerce.date().optional().nullable(),
    remarks: z.string().max(500).optional(),
    // Phase 5b: fabric-roll processes (EMBROIDERY) issue FROM a fabric_stock lot and
    // may carry the embroidery design (embroidery_master uses cuid ids — no uuid constraint)
    fabricStockLotId: z.string().min(1).optional().nullable(),
    embroideryId: z.string().min(1).optional().nullable(),
    // KAAJ_BUTTON-specific
    buttonholeCount: z.number().int().nonnegative().optional(),
    buttonCount: z.number().int().nonnegative().optional(),
    buttonholeRatePerUnit: z.number().nonnegative().optional(),
    buttonRatePerUnit: z.number().nonnegative().optional(),
  })
  .refine(
    (data) => data.processType !== 'KAAJ_BUTTON' || (data.buttonholeCount ?? 0) > 0 || (data.buttonCount ?? 0) > 0,
    { message: 'KAAJ_BUTTON requires buttonholeCount or buttonCount greater than 0' }
  )
  .refine((data) => data.processType === 'KAAJ_BUTTON' || data.agreedRate > 0 || data.isRateTbd, {
    message: 'agreedRate must be greater than 0 (or set isRateTbd for an intentional TBD rate)',
  })
  .refine((data) => !data.embroideryId || data.processType === 'EMBROIDERY', {
    message: 'embroideryId is only valid for EMBROIDERY job work orders',
  });

export type CreateJobWorkOrderInput = z.infer<typeof createJobWorkOrderSchema>;

/**
 * POST /api/job-work-orders/:id/components — add issued-material line (pre-issue only).
 * R6 (no purchased goods from the same processor) is enforced in the controller
 * against the stock lot's original supplier.
 */
export const addJwoComponentSchema = z
  .object({
    materialType: z.enum(['GREIGE', 'FABRIC', 'LACE', 'THREAD', 'TRIM']),
    greigeId: z.string().uuid().optional().nullable(),
    fabricId: z.string().uuid().optional().nullable(),
    laceId: z.string().uuid().optional().nullable(),
    greigeStockId: z.string().optional().nullable(),
    fabricStockId: z.string().optional().nullable(),
    laceStockId: z.string().optional().nullable(),
    qtySent: z.number().positive('qtySent must be positive'),
    unit: z.string().max(10).optional().default('MTR'),
    rate: z.number().nonnegative().optional(),
    isChargeable: z.boolean().optional().default(true),
    isReturnable: z.boolean().optional().default(true),
    componentName: z.string().max(100).optional(),
    colorName: z.string().max(100).optional(),
    description: z.string().max(300).optional(),
  })
  .refine((d) => d.greigeId || d.fabricId || d.laceId || d.componentName || d.description, {
    message: 'Component needs a material reference (greigeId/fabricId/laceId) or at least a componentName/description',
  });

export type AddJwoComponentInput = z.infer<typeof addJwoComponentSchema>;

/**
 * POST /api/job-work-orders/:id/close — RECEIVED → CLOSED.
 * Requires an invoice reference (here or already on the order).
 */
export const closeJwoSchema = z.object({
  invoiceNumber: z.string().min(1).max(100).optional(),
  remarks: z.string().max(500).optional(),
});

export type CloseJwoInput = z.infer<typeof closeJwoSchema>;

/**
 * POST /api/job-work-orders/:id/issue — Phase 4c operational issue.
 * greigeStockLotId consumes that lot; challanNumber is the manual/vendor challan ref.
 */
export const issueJwoSchema = z.object({
  sentDate: z.coerce.date().optional(),
  greigeStockLotId: z.string().optional().nullable(),
  // Multi-lot issue (consolidated issuance service): quantities must total qtySentMeters.
  // Single-lot callers may keep sending greigeStockLotId instead.
  lots: z.array(z.object({ greigeStockLotId: z.string(), qty: z.number().positive() })).optional(),
  // Phase 5b: fabric-roll issue source (EMBROIDERY) — consumes a fabric_stock lot instead of greige
  fabricStockLotId: z.string().optional().nullable(),
  challanNumber: z.string().max(100).trim().optional(),
  vehicleNumber: z.string().max(50).trim().optional(),
  // Width guard override: issue although the lot's greige width differs beyond tolerance
  acknowledgeWidthMismatch: z.boolean().optional(),
});

/**
 * POST /api/job-work-orders/:id/cancel — pre-receive cancellation.
 * Reverses the issue (credits the source lot back, restores needsEmbroidery) and
 * sets jwoStatus CANCELLED (exits dedup guards).
 */
export const cancelJwoSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CancelJwoInput = z.infer<typeof cancelJwoSchema>;

export type IssueJwoInput = z.infer<typeof issueJwoSchema>;

/**
 * POST /api/job-work-orders/:id/receive — record received qty; loss split is computed server-side.
 */
export const receiveJwoSchema = z.object({
  qtyReceived: z.number().positive('qtyReceived must be a positive number'),
  receivedDate: z.coerce.date().optional(),
});

export type ReceiveJwoInput = z.infer<typeof receiveJwoSchema>;
