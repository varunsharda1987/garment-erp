/**
 * AI Insights Schemas
 *
 * Query parameters for the ADMIN-only AI Insights endpoints (what the assistant could not
 * answer, weak matches, negative feedback, guide usage).
 */

import { z } from 'zod';

export const aiInsightsQuerySchema = z.object({
  /** YYYY-MM-DD (defaults to 30 days ago) */
  from: z.string().max(30).optional(),
  /** YYYY-MM-DD (defaults to today) */
  to: z.string().max(30).optional(),
  /** Include questions that pulled live ERP data (lookups, not how-tos) */
  includeData: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type AiInsightsQueryInput = z.infer<typeof aiInsightsQuerySchema>;
