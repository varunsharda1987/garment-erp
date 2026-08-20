/**
 * Issue Report Service
 * Frontend API wrappers for the team issue-reporting feature.
 */

import api from '@/lib/api';
import type {
  IssueReport,
  UpdateIssueReportRequest,
  IssueReportQueryParams,
  PaginatedIssueReports,
} from '@/types/issueReport.types';

/**
 * Submit a new issue report. Screenshot is optional.
 * Pass FormData with no manual Content-Type — the api client leaves it unset so the
 * browser adds the multipart boundary.
 */
export async function createIssueReport(input: {
  title: string;
  description?: string;
  pageUrl?: string;
  screenshot?: File | null;
}): Promise<IssueReport> {
  const formData = new FormData();
  formData.append('title', input.title);
  if (input.description) formData.append('description', input.description);
  if (input.pageUrl) formData.append('pageUrl', input.pageUrl);
  if (input.screenshot) formData.append('screenshot', input.screenshot);

  const response = await api.post<{ data: IssueReport }>('/issue-reports', formData);
  return response.data.data;
}

/** Current user's own reports */
export async function getMyIssueReports(): Promise<IssueReport[]> {
  const response = await api.get<{ data: IssueReport[] }>('/issue-reports/my');
  return response.data.data;
}

/** Admin: all reports with optional status filter */
export async function getAllIssueReports(params: IssueReportQueryParams = {}): Promise<PaginatedIssueReports> {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));
  const response = await api.get<PaginatedIssueReports>(`/issue-reports?${query.toString()}`);
  return response.data;
}

/** Admin: update status / notes */
export async function updateIssueReport(id: string, data: UpdateIssueReportRequest): Promise<IssueReport> {
  const response = await api.patch<{ data: IssueReport }>(`/issue-reports/${id}`, data);
  return response.data.data;
}

/** Admin: count of OPEN reports (badge) */
export async function getOpenIssueCount(): Promise<number> {
  const response = await api.get<{ count: number }>('/issue-reports/open-count');
  return response.data.count;
}
