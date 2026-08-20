/**
 * Issue Report Controller
 */

import { Request, Response } from 'express';
import { issueReportService } from '../services/issue-report.service';
import { logError, logInfo } from '../utils/logger';
import type {
  CreateIssueReportInput,
  UpdateIssueReportInput,
  IssueReportQueryInput,
} from '../schemas/issueReport.schema';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export class IssueReportController {
  async create(req: MulterRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { title, description, pageUrl } = req.body as CreateIssueReportInput;

      let screenshotUrl: string | undefined;
      if (req.file) {
        screenshotUrl = `/uploads/issue-screenshots/${req.file.filename}`;
      }

      const report = await issueReportService.create({ userId, title, description, pageUrl, screenshotUrl });

      logInfo(`[IssueReport] User ${userId} reported: "${title}" (page: ${pageUrl || 'n/a'})`);
      res.status(201).json({ data: report });
    } catch (error) {
      logError('[IssueReportController] create error:', error);
      res.status(500).json({ error: 'Failed to submit issue report' });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const { status, page, limit } = req.query as unknown as IssueReportQueryInput;
      const result = await issueReportService.getAll({ status, page, limit });
      res.json(result);
    } catch (error) {
      logError('[IssueReportController] getAll error:', error);
      res.status(500).json({ error: 'Failed to fetch issue reports' });
    }
  }

  async getMyReports(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const reports = await issueReportService.getMyReports(userId);
      res.json({ data: reports });
    } catch (error) {
      logError('[IssueReportController] getMyReports error:', error);
      res.status(500).json({ error: 'Failed to fetch your reports' });
    }
  }

  async getOpenCount(req: Request, res: Response) {
    try {
      const count = await issueReportService.getOpenCount();
      res.json({ count });
    } catch (error) {
      logError('[IssueReportController] getOpenCount error:', error);
      res.status(500).json({ error: 'Failed to fetch open count' });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const report = await issueReportService.getById(req.params.id);
      if (!report) {
        return res.status(404).json({ error: 'Issue report not found' });
      }
      res.json({ data: report });
    } catch (error) {
      logError('[IssueReportController] getById error:', error);
      res.status(500).json({ error: 'Failed to fetch issue report' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { status, adminNotes } = req.body as UpdateIssueReportInput;
      const report = await issueReportService.update(req.params.id, { status, adminNotes });
      res.json({ data: report });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        return res.status(404).json({ error: 'Issue report not found' });
      }
      logError('[IssueReportController] update error:', error);
      res.status(500).json({ error: 'Failed to update issue report' });
    }
  }
}

export const issueReportController = new IssueReportController();
