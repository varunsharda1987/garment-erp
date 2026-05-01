/**
 * Lace Lab Dip Routes
 *
 * API routes for managing lace lab dip approval workflow.
 * Lab dip is required when using GREIGE_PROCESSED sourcing strategy.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateParams } from '../middleware/validation.middleware';
import { idParamSchema, greigeLaceIdParamSchema } from '../schemas/common.schema';
import {
  createLabDip,
  getLabDips,
  getLabDipById,
  updateLabDip,
  updateStatus,
  getApprovedForLace,
  deleteLabDip,
} from '../controllers/laceLabDip.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/lace-lab-dips
 * @desc    Create a new lace lab dip request
 * @access  Private
 * @body    greigeLaceId, targetColor, processorId, sampleQuantity
 */
router.post('/', asyncHandler(createLabDip));

/**
 * @route   GET /api/lace-lab-dips
 * @desc    Get all lace lab dips with filters
 * @access  Private
 * @query   status, greigeLaceId, processorId, styleId, costSheetId, page, limit
 */
router.get('/', asyncHandler(getLabDips));

/**
 * @route   GET /api/lace-lab-dips/approved/:greigeLaceId
 * @desc    Get approved lab dips for a greige lace (for processor selection)
 * @access  Private
 */
router.get('/approved/:greigeLaceId', validateParams(greigeLaceIdParamSchema), asyncHandler(getApprovedForLace));

/**
 * @route   GET /api/lace-lab-dips/:id
 * @desc    Get single lace lab dip by ID
 * @access  Private
 */
router.get('/:id', validateParams(idParamSchema), asyncHandler(getLabDipById));

/**
 * @route   PUT /api/lace-lab-dips/:id
 * @desc    Update lace lab dip details
 * @access  Private
 */
router.put('/:id', validateParams(idParamSchema), asyncHandler(updateLabDip));

/**
 * @route   POST /api/lace-lab-dips/:id/status
 * @desc    Update lab dip status (workflow transitions)
 * @access  Private
 * @body    status, buyerRemarks?, rejectionReason?, approvalReference?
 *
 * Valid status transitions:
 * - PENDING -> SENT_TO_PROCESSOR
 * - SENT_TO_PROCESSOR -> SAMPLE_RECEIVED
 * - SAMPLE_RECEIVED -> AWAITING_BUYER_APPROVAL
 * - AWAITING_BUYER_APPROVAL -> APPROVED | REJECTED
 * - REJECTED -> PENDING (restart process)
 */
router.post('/:id/status', validateParams(idParamSchema), asyncHandler(updateStatus));

/**
 * @route   DELETE /api/lace-lab-dips/:id
 * @desc    Delete lab dip (only if PENDING status)
 * @access  Private
 */
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteLabDip));

export default router;
