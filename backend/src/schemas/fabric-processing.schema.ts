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
  expectedShrinkagePercent: z.number().min(0).max(100),
  greigeCost: z.number().positive(),
  processingCost: z.number().positive(),
  sentDate: z.coerce.date(),
  expectedReturnDate: z.coerce.date().optional(),
  batchNumber: z.string().optional(),
  processSpecifications: z.string().optional(),
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
});

export type ReceiveFinishedFabricInput = z.infer<typeof receiveFinishedFabricSchema>;
