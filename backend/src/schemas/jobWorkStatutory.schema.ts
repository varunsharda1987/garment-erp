import { z } from 'zod';

/**
 * Query schemas for the job-work statutory + reconciliation reports.
 *
 * Dates arrive from `<input type="date">` as 'YYYY-MM-DD'. `z.string().datetime()` rejects that
 * shape outright, and a bare string reaching Prisma's DateTime columns 500s — so every date here
 * is coerced, and an empty string (a cleared date input) is mapped to undefined rather than
 * becoming an Invalid Date. Same convention as `challan.schema.ts`.
 */
const reportDate = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.date());

export const processorStatementQuerySchema = z
  .object({
    processorId: z.string().trim().min(1, 'Pick a processor'),
    periodStart: reportDate,
    periodEnd: reportDate,
    format: z.enum(['json', 'pdf']).optional(),
  })
  .refine((q) => q.periodEnd >= q.periodStart, {
    path: ['periodEnd'],
    message: 'The end date must be on or after the start date',
  });

export type ProcessorStatementQueryInput = z.infer<typeof processorStatementQuerySchema>;
