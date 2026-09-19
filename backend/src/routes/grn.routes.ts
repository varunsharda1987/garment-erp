/**
 * GRN (Goods Receiving Notes) Routes
 * RESTful API routes for goods receiving management
 */

import { Router, type Request, type Response } from 'express';
import {
  getAllGRNs,
  getGRNById,
  getGRNsByPO,
  getPendingItemsForPO,
  getReceivingSummaryByPO,
  getProcessingContext,
  createGRN,
  receiveJwoToStock,
  approveGRN,
  rejectGRN,
  reverseGRN, // BUG-GRN6 fix
} from '../controllers/grn.controller';
import { authenticateToken, requirePermissionForWrites, requireAdmin } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import {
  createGRNSchema,
  receiveJwoToStockSchema,
  approveGRNSchema,
  rejectGRNSchema,
  reverseGRNSchema,
  grnQuerySchema,
} from '../schemas/grn.schema';
import { idParamSchema, poIdParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);
router.use(requirePermissionForWrites('grn'));

// ============================================
// List & Query Routes
// ============================================

/**
 * @route   GET /api/grn
 * @desc    Get all GRNs with filters and pagination
 * @access  Private
 */
router.get('/', validateQuery(grnQuerySchema), asyncHandler(getAllGRNs));

/**
 * @route   GET /api/grn/po/:poId
 * @desc    Get all GRNs for a specific PO
 * @access  Private
 */
router.get('/po/:poId', validateParams(poIdParamSchema), asyncHandler(getGRNsByPO));

/**
 * @route   GET /api/grn/po/:poId/processing-context
 * @desc    Get processing context for a PROCESSING PO (for GRN form)
 * @access  Private
 */
router.get('/po/:poId/processing-context', validateParams(poIdParamSchema), asyncHandler(getProcessingContext));

/**
 * @route   GET /api/grn/po/:poId/pending
 * @desc    Get pending items for a PO (for GRN creation)
 * @access  Private
 */
router.get('/po/:poId/pending', validateParams(poIdParamSchema), asyncHandler(getPendingItemsForPO));

/**
 * @route   GET /api/grn/po/:poId/summary
 * @desc    Get receiving summary by warehouse for a PO
 * @access  Private
 */
router.get('/po/:poId/summary', validateParams(poIdParamSchema), asyncHandler(getReceivingSummaryByPO));

/**
 * @route   GET /api/grn/:id
 * @desc    Get GRN by ID with all relations
 * @access  Private
 */
router.get('/:id', validateParams(idParamSchema), asyncHandler(getGRNById));

// ============================================
// CRUD Routes
// ============================================

/**
 * @route   POST /api/grn
 * @desc    Create a new GRN
 * @access  Private (INVENTORY, PURCHASE, ADMIN)
 */
router.post('/', validateBody(createGRNSchema), asyncHandler(createGRN));

/**
 * @route   POST /api/grn/jwo
 * @desc    RETIRED 2026-09-19. This created a receipt with no stock behind it (PENDING_QC) and
 *          relied on a second screen to approve it — the "saved but not in stock" trap. Job-work
 *          returns are one action on the job now (POST /api/grn/jwo/receive).
 */
// no-body — 410 tombstone, nothing read
router.post('/jwo', (_req: Request, res: Response) =>
  res.status(410).json({
    success: false,
    message: 'Job-work returns are recorded on the job work order — open the job and click Receive from processor.',
  })
);

/**
 * @route   POST /api/grn/jwo/receive
 * @desc    One action: file the job-work receipt (accepted) and book stock, inward challan, loss
 *          split and MRP in a single transaction. Lives on this router so INVENTORY can run it.
 * @access  Private (INVENTORY, PURCHASE, ADMIN)
 */
router.post('/jwo/receive', validateBody(receiveJwoToStockSchema), asyncHandler(receiveJwoToStock));

// ============================================
// Status Transition Routes
// ============================================

/**
 * @route   PATCH /api/grn/:id/approve
 * @desc    Approve a GRN (PENDING_QC -> ACCEPTED)
 * @access  Private (QUALITY, INVENTORY, ADMIN)
 */
router.patch('/:id/approve', validateParams(idParamSchema), validateBody(approveGRNSchema), asyncHandler(approveGRN));

/**
 * @route   PATCH /api/grn/:id/reject
 * @desc    Reject a GRN (PENDING_QC -> REJECTED)
 * @access  Private (QUALITY, INVENTORY, ADMIN)
 */
router.patch('/:id/reject', validateParams(idParamSchema), validateBody(rejectGRNSchema), asyncHandler(rejectGRN));

// BUG-GRN6 fix: Comprehensive GRN reversal endpoint
/**
 * @route   PATCH /api/grn/:id/reverse
 * @desc    Reverse an accepted GRN (ACCEPTED -> REVERSED) - fully reverses all stock and transactions
 * @access  Private (ADMIN only)
 */
router.patch(
  '/:id/reverse',
  requireAdmin(),
  validateParams(idParamSchema),
  validateBody(reverseGRNSchema),
  asyncHandler(reverseGRN)
);

export default router;
