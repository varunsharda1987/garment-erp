/**
 * Wash-care codes per buyer per fabric — request validation.
 *
 * `washCareCode` is free text, not an enum: it is the BUYER's vocabulary (Easybuy use "RN-6"),
 * and a second buyer will number theirs differently.
 */

import { z } from 'zod';

export const setWashCareSchema = z.object({
  customerId: z.string().uuid('Select a customer'),
  greigeId: z.string().uuid('Select a fabric'),
  /** Reserved. Nothing sends a colour yet — see the note on the model. */
  colorId: z.string().optional().nullable(),
  washCareCode: z.string().trim().min(1, 'Enter the code').max(50),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const washCareQuerySchema = z.object({
  greigeId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

export type SetWashCareInput = z.infer<typeof setWashCareSchema>;
export type WashCareQueryInput = z.infer<typeof washCareQuerySchema>;
