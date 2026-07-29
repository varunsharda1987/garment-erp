/**
 * Export Validation Schema
 *
 * Constrains the POST /api/export/:module request body so a raw, arbitrary
 * `filters` object can no longer be spread straight into a Prisma `where`
 * clause. Without this, any authenticated user could send:
 *   - `filters: { isActive: false }`  -> export soft-deleted rows
 *   - `filters: { customer: { orders: { some: {...} } } }` -> nested relation
 *     operator objects that force heavy joins (DoS)
 *
 * Defense in depth:
 *   1. This schema forces `filters` to be a flat map of SCALAR values only
 *      (string | number | boolean). Nested objects/arrays (i.e. Prisma
 *      operator objects) are rejected, and an explicit `isActive` override
 *      is rejected.
 *   2. The controller additionally applies a per-module allowlist of scalar
 *      filter fields (see EXPORT_FILTER_ALLOWLIST in export.controller.ts) so
 *      only known columns ever reach the query.
 */

import { z } from 'zod';

// Scalar-only filter value. Rejects objects/arrays (Prisma operator payloads).
const scalarFilterValue = z.union([z.string(), z.number(), z.boolean()]);

export const exportBodySchema = z.object({
  format: z.enum(['csv', 'excel', 'xlsx', 'pdf']).default('csv'),
  templateId: z.string().uuid('Invalid template ID').optional(),
  filters: z
    .record(z.string(), scalarFilterValue)
    .refine((f) => !Object.prototype.hasOwnProperty.call(f, 'isActive'), {
      message: 'isActive cannot be overridden in export filters',
    })
    .optional()
    .default({}),
});

export type ExportBodyInput = z.infer<typeof exportBodySchema>;
