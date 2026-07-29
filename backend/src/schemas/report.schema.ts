/**
 * Report Validation Schemas
 *
 * Zod schemas for report generation / maintenance endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 *
 * Field names + values are derived from what report.controller.ts reads off
 * req.body and from `ReportType` / `ReportParams` in
 * backend/src/services/report-generator.service.ts — do not add fields the
 * controller/service never read.
 */

import { z } from 'zod';

/**
 * A date filter the report service later hands to `new Date(...)`.
 *
 * Deliberately kept as a STRING (not z.coerce.date()): `ReportParams` declares
 * dateFrom/dateTo as `string`, and the value is JSON-serialised across the
 * report job queue. We only assert the string is actually parseable, so garbage
 * gets a clean 400 instead of an `Invalid Date` reaching Prisma.
 */
const reportDateString = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date');

/**
 * Generate Report
 * POST /api/reports/generate
 *
 * `reportType` values mirror VALID_REPORT_TYPES in report.controller.ts.
 */
export const generateReportSchema = z.object({
  reportType: z.enum([
    'inventory-summary',
    'stock-levels',
    'order-summary',
    'production-status',
    'supplier-performance',
    'style-costing',
    'sales-report',
    'gst-summary',
  ]),
  format: z.enum(['csv', 'xlsx', 'pdf']).optional().default('xlsx'),
  // Optional report filters (ReportParams) — all optional, the service applies
  // only the ones present.
  dateFrom: reportDateString.optional(),
  dateTo: reportDateString.optional(),
  customerId: z.string().trim().min(1).optional(),
  supplierId: z.string().trim().min(1).optional(),
  styleId: z.string().trim().min(1).optional(),
  // Free-form: the same key is applied to different models (orders /
  // production) with different status enums, so it is NOT constrained here.
  status: z.string().trim().min(1).optional(),
});

/**
 * Cleanup Reports
 * POST /api/reports/cleanup
 *
 * The whole body is optional — the handler falls back to 7 days when
 * `daysToKeep` is absent, so an empty/omitted body must still be accepted.
 */
export const cleanupReportsSchema = z
  .object({
    daysToKeep: z.coerce.number().int().min(1).max(3650).optional(),
  })
  .default({});

// ============================================================================
// Type Exports
// ============================================================================

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
export type CleanupReportsInput = z.infer<typeof cleanupReportsSchema>;
