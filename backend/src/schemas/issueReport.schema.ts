/**
 * Issue Report Schemas
 *
 * Zod validation for the team issue-reporting feature.
 * Note: status is a plain String in Prisma (issue_reports.status) — values listed here
 * are the single source of truth for the workflow.
 */

import { z } from 'zod';

export const ISSUE_STATUSES = ['OPEN', 'IN_PROGRESS', 'FIXED', 'CLOSED'] as const;

export const createIssueReportSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(5000).optional(),
  pageUrl: z.string().max(500).optional(),
});

export const updateIssueReportSchema = z.object({
  status: z.enum(ISSUE_STATUSES).optional(),
  adminNotes: z.string().max(5000).optional(),
});

export const issueReportQuerySchema = z.object({
  status: z.enum(ISSUE_STATUSES).optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
});

export type CreateIssueReportInput = z.infer<typeof createIssueReportSchema>;
export type UpdateIssueReportInput = z.infer<typeof updateIssueReportSchema>;
export type IssueReportQueryInput = z.infer<typeof issueReportQuerySchema>;
