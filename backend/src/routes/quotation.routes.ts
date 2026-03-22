/**
 * Quotation Routes
 * API endpoints for quotation management
 */

import { Router } from 'express';
import {
  createQuotation,
  getAllQuotations,
  getQuotationById,
  updateQuotation,
  updateQuotationStatus,
  deleteQuotation,
  getQuotationSummary,
  markExpiredQuotations,
} from '../controllers/quotation.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import {
  createQuotationSchema,
  updateQuotationSchema,
  updateQuotationStatusSchema,
  quotationQuerySchema,
  quotationIdParamSchema,
} from '../schemas/quotation.schema';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// Public Routes (All authenticated users)
// ============================================

/**
 * GET /api/quotations/summary
 * Get quotation summary statistics
 * Optional query: customerId
 */
router.get('/summary', asyncHandler(getQuotationSummary));

/**
 * GET /api/quotations
 * Get all quotations with pagination and filters
 * Query params: page, limit, search, status, customerId, fromDate, toDate, sortBy, sortOrder
 */
router.get('/', validateQuery(quotationQuerySchema), asyncHandler(getAllQuotations));

/**
 * GET /api/quotations/:id
 * Get quotation by ID
 */
router.get('/:id', validateParams(quotationIdParamSchema), asyncHandler(getQuotationById));

// ============================================
// Protected Routes (Admin, Sales roles)
// ============================================

/**
 * POST /api/quotations
 * Create a new quotation
 * Requires: ADMIN or SALES_MANAGER role
 */
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.SALES),
  validateBody(createQuotationSchema),
  asyncHandler(createQuotation)
);

/**
 * PUT /api/quotations/:id
 * Update quotation (only DRAFT quotations can be modified)
 * Requires: ADMIN or SALES_MANAGER role
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.SALES),
  validateParams(quotationIdParamSchema),
  validateBody(updateQuotationSchema),
  asyncHandler(updateQuotation)
);

/**
 * PUT /api/quotations/:id/status
 * Update quotation status (DRAFT → SENT → ACCEPTED/REJECTED)
 * Requires: ADMIN or SALES_MANAGER role
 */
router.put(
  '/:id/status',
  authorize(UserRole.ADMIN, UserRole.SALES),
  validateParams(quotationIdParamSchema),
  validateBody(updateQuotationStatusSchema),
  asyncHandler(updateQuotationStatus)
);

// ============================================
// Admin Only Routes
// ============================================

/**
 * DELETE /api/quotations/:id
 * Delete quotation (only DRAFT quotations can be deleted)
 * Requires: ADMIN role
 */
router.delete('/:id', authorize(UserRole.ADMIN), validateParams(quotationIdParamSchema), asyncHandler(deleteQuotation));

/**
 * POST /api/quotations/mark-expired
 * Mark expired quotations (cron job endpoint)
 * Requires: ADMIN role
 */
router.post('/mark-expired', authorize(UserRole.ADMIN), asyncHandler(markExpiredQuotations));

export default router;
