import { z } from 'zod';

/**
 * Query for GET /api/materials/:id/ledger.
 *
 * Dates come from `<input type="date">` as 'YYYY-MM-DD'; a cleared input posts '', which must
 * become undefined rather than an Invalid Date. Same convention as `challan.schema.ts`.
 */
const ledgerDate = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.date().optional());

export const materialLedgerQuerySchema = z
  .object({
    from: ledgerDate,
    to: ledgerDate,
    warehouseId: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.string().min(1).optional()),
    format: z.enum(['json', 'pdf']).optional(),
  })
  .refine((q) => !q.from || !q.to || q.to >= q.from, {
    path: ['to'],
    message: 'The end date must be on or after the start date',
  });

export type MaterialLedgerQueryInput = z.infer<typeof materialLedgerQuerySchema>;
