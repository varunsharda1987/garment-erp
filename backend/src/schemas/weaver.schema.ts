/**
 * Weavers — the mill that wove a greige or fabric we bought (Phase 1b, 2026-09-25).
 * Picked, or added on the spot, from the PO line and the GRN line; there is no master screen.
 */
import { z } from 'zod';

export const weaverQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/** POST /api/weavers — returns the existing weaver when the name already exists (any case/spacing). */
export const createWeaverSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Weaver name must be at least 2 characters')
    .max(100, 'Weaver name must not exceed 100 characters'),
  city: z.string().trim().max(100).optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier').optional().nullable(),
});

export type WeaverQuery = z.infer<typeof weaverQuerySchema>;
export type CreateWeaverInput = z.infer<typeof createWeaverSchema>;
