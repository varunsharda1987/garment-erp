/**
 * Report Routes
 * API endpoints for report generation and download
 */

import { Router } from 'express';
import {
  generateReport,
  listReports,
  downloadReport,
  getReportTypes,
  cleanupReports,
} from '../controllers/report.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { generateReportSchema, cleanupReportsSchema } from '../schemas/report.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/reports/types
 * @desc    Get available report types and formats
 * @access  All authenticated users
 */
router.get('/types', asyncHandler(getReportTypes));

/**
 * @route   POST /api/reports/generate
 * @desc    Generate a report (async or sync based on Redis availability)
 * @body    { reportType, format?, dateFrom?, dateTo?, customerId?, supplierId?, styleId?, status? }
 * @access  Managers and above
 */
router.post(
  '/generate',
  authorize('ADMIN', 'PRODUCTION_MANAGER', 'INVENTORY', 'ACCOUNTS'),
  validateBody(generateReportSchema),
  asyncHandler(generateReport)
);

/**
 * @route   GET /api/reports
 * @desc    List available reports for download
 * @access  Managers and above
 */
router.get('/', authorize('ADMIN', 'PRODUCTION_MANAGER', 'INVENTORY', 'ACCOUNTS'), asyncHandler(listReports));

/**
 * @route   GET /api/reports/download/:fileName
 * @desc    Download a generated report file
 * @access  Managers and above
 */
router.get(
  '/download/:fileName',
  authorize('ADMIN', 'PRODUCTION_MANAGER', 'INVENTORY', 'ACCOUNTS'),
  asyncHandler(downloadReport)
);

/**
 * @route   POST /api/reports/cleanup
 * @desc    Clean up old report files
 * @body    { daysToKeep?: number }
 * @access  Admin only
 */
router.post('/cleanup', authorize('ADMIN'), validateBody(cleanupReportsSchema), asyncHandler(cleanupReports));

export default router;
