/**
 * Issue Report Types
 * Matches backend issueReport.schema.ts + issue_reports Prisma model (camelCase via serializer)
 */

import type { SessionTrail } from '@/lib/session-trail';

export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'CLOSED';

export interface IssueReport {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  screenshotUrl: string | null;
  pageUrl: string | null;
  status: IssueStatus;
  adminNotes: string | null;
  /** Recent API errors + pages visited before reporting (absent on older reports) */
  contextJson?: SessionTrail | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

export interface UpdateIssueReportRequest {
  status?: IssueStatus;
  adminNotes?: string;
}

export interface IssueReportQueryParams {
  status?: IssueStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedIssueReports {
  data: IssueReport[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
