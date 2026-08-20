/**
 * Issue Report Service
 *
 * Team members report app problems (optionally with a screenshot);
 * admins review, set status, and leave notes.
 */

import prisma from '../config/database';

interface IssueReportCreateInput {
  userId: string;
  title: string;
  description?: string;
  pageUrl?: string;
  screenshotUrl?: string;
}

interface IssueReportUpdateInput {
  status?: string;
  adminNotes?: string;
}

interface IssueReportQueryParams {
  status?: string;
  page?: number;
  limit?: number;
}

const USER_SELECT = { select: { id: true, firstName: true, lastName: true, email: true, role: true } };

export class IssueReportService {
  async create(data: IssueReportCreateInput) {
    return prisma.issue_reports.create({
      data: {
        userId: data.userId,
        title: data.title,
        description: data.description || null,
        pageUrl: data.pageUrl || null,
        screenshotUrl: data.screenshotUrl || null,
      },
      include: { user: USER_SELECT },
    });
  }

  async getAll(params: IssueReportQueryParams = {}) {
    const { status, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.issue_reports.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: USER_SELECT },
      }),
      prisma.issue_reports.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getMyReports(userId: string) {
    return prisma.issue_reports.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getById(id: string) {
    return prisma.issue_reports.findUnique({
      where: { id },
      include: { user: USER_SELECT },
    });
  }

  async update(id: string, data: IssueReportUpdateInput) {
    return prisma.issue_reports.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes }),
      },
      include: { user: USER_SELECT },
    });
  }

  async getOpenCount() {
    return prisma.issue_reports.count({ where: { status: 'OPEN' } });
  }
}

export const issueReportService = new IssueReportService();
