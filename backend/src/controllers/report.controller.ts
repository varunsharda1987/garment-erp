/**
 * Report Controller
 * HTTP handlers for report generation and download endpoints
 */

import { Request, Response } from 'express';
import { reportGeneratorService, ReportType, ReportParams } from '../services/report-generator.service';
import { addJob, isQueueAvailable } from '../jobs';
import { UnauthorizedError, NotFoundError, ValidationError } from '../errors';
import { logInfo } from '../utils/logger';
import path from 'path';
import fs from 'fs';

// Valid report types
const VALID_REPORT_TYPES: ReportType[] = [
  'inventory-summary',
  'stock-levels',
  'order-summary',
  'production-status',
  'supplier-performance',
  'style-costing',
  'sales-report',
  'gst-summary',
];

/**
 * Generate a report (async via job queue or sync)
 * POST /api/reports/generate
 */
export async function generateReport(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { reportType, format = 'xlsx', ...params } = req.body;

  // Validate report type
  if (!reportType || !VALID_REPORT_TYPES.includes(reportType as ReportType)) {
    throw new ValidationError(`Invalid report type. Valid types: ${VALID_REPORT_TYPES.join(', ')}`);
  }

  // Validate format
  const validFormats = ['csv', 'xlsx', 'pdf'];
  if (!validFormats.includes(format)) {
    throw new ValidationError(`Invalid format. Valid formats: ${validFormats.join(', ')}`);
  }

  const reportParams: ReportParams = {
    format,
    ...params,
  };

  // If Redis queue is available, queue the job for async processing
  if (isQueueAvailable()) {
    const jobId = await addJob({
      type: 'report',
      reportType,
      params: reportParams,
      userId,
    });

    logInfo(`Report job queued: ${jobId}`, { reportType, userId });

    res.status(202).json({
      success: true,
      message: 'Report generation queued',
      jobId,
      reportType,
      format,
    });
    return;
  }

  // Sync fallback: generate immediately
  logInfo('Generating report synchronously (Redis not available)', { reportType, userId });

  const result = await reportGeneratorService.generateReport(reportType as ReportType, reportParams, userId);

  if (result.success) {
    res.status(200).json({
      success: true,
      message: 'Report generated',
      fileName: result.fileName,
      recordCount: result.recordCount,
      downloadUrl: `/api/reports/download/${result.fileName}`,
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error || 'Report generation failed',
    });
  }
}

/**
 * List available reports for download
 * GET /api/reports
 */
export async function listReports(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const reports = await reportGeneratorService.listReports(userId);

  res.status(200).json({
    success: true,
    reports,
    total: reports.length,
  });
}

/**
 * Download a report file
 * GET /api/reports/download/:fileName
 */
export async function downloadReport(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { fileName } = req.params;

  // Sanitize fileName to prevent path traversal
  const sanitizedFileName = path.basename(fileName);
  const filePath = reportGeneratorService.getReportPath(sanitizedFileName);

  if (!filePath || !fs.existsSync(filePath)) {
    throw new NotFoundError('Report', sanitizedFileName);
  }

  // Determine content type
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pdf': 'application/pdf',
  };

  const contentType = contentTypes[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFileName}"`);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
}

/**
 * Get available report types
 * GET /api/reports/types
 */
export async function getReportTypes(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    success: true,
    reportTypes: VALID_REPORT_TYPES.map((type) => ({
      type,
      displayName: type
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    })),
    formats: [
      { format: 'csv', displayName: 'CSV' },
      { format: 'xlsx', displayName: 'Excel' },
      { format: 'pdf', displayName: 'PDF' },
    ],
  });
}

/**
 * Cleanup old reports (admin only)
 * POST /api/reports/cleanup
 */
export async function cleanupReports(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const daysToKeep = parseInt(req.body.daysToKeep as string) || 7;
  const deletedCount = await reportGeneratorService.cleanupOldReports(daysToKeep);

  res.status(200).json({
    success: true,
    message: `Cleaned up ${deletedCount} old reports`,
    deletedCount,
    daysToKeep,
  });
}
