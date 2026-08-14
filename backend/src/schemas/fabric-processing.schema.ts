/**
 * Fabric Processing Schemas
 *
 * Single source of truth for the fabric processing workflow endpoints
 * (POST /api/processing, PUT /api/processing/:id/receive).
 * Applied at the route layer via validateBody(); the controller consumes
 * the typed req.body and must NOT re-parse.
 */

import { z } from 'zod';

// Schema for sending greige for processing
export const sendForProcessingSchema = z.object({
  procurementId: z.string().uuid(),
  greigeId: z.string().uuid(),
  processorId: z.string().uuid(),
  processingType: z.enum(['DYEING', 'PRINTING', 'CALENDERING', 'SANFORIZING', 'MERCERIZING']),
  greigeQuantitySent: z.number().positive(),
  greigeWidth: z.number().positive(),
  expectedFinishedWidthMin: z.number().positive(),
  expectedFinishedWidthMax: z.number().positive(),
  expectedShrinkagePercent: z.number().min(0).lt(100), // MRP-48h: lt(100) not max(100) — this feeds `1 - x/100` as a divisor; 100 is a divide-by-zero
  greigeCost: z.number().positive(),
  processingCost: z.number().positive(),
  sentDate: z.coerce.date(),
  expectedReturnDate: z.coerce.date().optional(),
  batchNumber: z.string().optional(),
  processSpecifications: z.string().optional(),
  // BUG-DASH11: Optional greige stock ID to debit when sending for processing
  greigeStockId: z.string().uuid().optional(),
});

export type SendForProcessingInput = z.infer<typeof sendForProcessingSchema>;

// Schema for receiving finished fabric
export const receiveFinishedFabricSchema = z.object({
  actualFinishedWidth: z.number().positive(),
  actualQuantityReceived: z.number().positive(),
  actualShrinkagePercent: z.number().min(0).max(100),
  processingLossMeters: z.number().min(0),
  finishedFabricId: z.string().uuid(),
  actualReturnDate: z.coerce.date(),
  qualityNotes: z.string().optional(),
  // BUG-DASH11: Optional warehouse ID for crediting fabric stock
  warehouseId: z.string().uuid().optional(),
});

export type ReceiveFinishedFabricInput = z.infer<typeof receiveFinishedFabricSchema>;
