import { Router } from 'express';
import {
  createSample,
  getAllSamples,
  getSampleById,
  updateSample,
  updateSampleStatus,
  deleteSample,
  updateMeasurements,
  recordActualMeasurements,
  markAsSent,
  recordReceipt,
  recordFeedback,
  createRevision,
  getSummary,
  checkApprovalGate,
  searchSamples,
} from '../controllers/sample.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createSampleSchema,
  updateSampleSchema,
  updateSampleStatusSchema,
  updateMeasurementsSchema,
  recordActualMeasurementsSchema,
  markAsSentSchema,
  recordReceiptSchema,
  recordFeedbackSchema,
  createRevisionSchema,
  sampleQuerySchema,
} from '../schemas/sample.schema';
import { idParamSchema, styleIdParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/samples/summary
 * @desc    Get samples summary/stats
 * @access  Private
 * @query   styleId (optional)
 */
router.get('/summary', asyncHandler(getSummary));

/**
 * @route   GET /api/samples/search
 * @desc    Search samples for picker/dropdown
 * @access  Private
 * @query   search, sampleType, limit
 */
router.get('/search', asyncHandler(searchSamples));

/**
 * @route   GET /api/samples/approval-gate/:styleId
 * @desc    Check sample approval gate for work order creation
 * @access  Private
 */
router.get('/approval-gate/:styleId', validateParams(styleIdParamSchema), asyncHandler(checkApprovalGate));

/**
 * @route   POST /api/samples
 * @desc    Create a new sample
 * @access  Private
 */
router.post('/', validateBody(createSampleSchema), asyncHandler(createSample));

/**
 * @route   GET /api/samples
 * @desc    Get all samples with pagination and filtering
 * @access  Private
 * @query   page, limit, search, sampleType, status, customerId, styleId, fromDate, toDate, pendingApproval
 */
router.get('/', validateQuery(sampleQuerySchema), asyncHandler(getAllSamples));

/**
 * @route   GET /api/samples/:id
 * @desc    Get single sample by ID with all related data
 * @access  Private
 */
router.get('/:id', validateParams(idParamSchema), asyncHandler(getSampleById));

/**
 * @route   PUT /api/samples/:id
 * @desc    Update sample
 * @access  Private
 */
router.put('/:id', validateParams(idParamSchema), validateBody(updateSampleSchema), asyncHandler(updateSample));

/**
 * @route   PATCH /api/samples/:id/status
 * @desc    Update sample status (with feedback)
 * @access  Private
 */
router.patch(
  '/:id/status',
  validateParams(idParamSchema),
  validateBody(updateSampleStatusSchema),
  asyncHandler(updateSampleStatus)
);

/**
 * @route   DELETE /api/samples/:id
 * @desc    Delete sample
 * @access  Private
 */
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteSample));

/**
 * @route   PUT /api/samples/:id/measurements
 * @desc    Add or update measurements for a sample
 * @access  Private
 */
router.put(
  '/:id/measurements',
  validateParams(idParamSchema),
  validateBody(updateMeasurementsSchema),
  asyncHandler(updateMeasurements)
);

/**
 * @route   PATCH /api/samples/:id/measurements/actual
 * @desc    Record actual measurements (for QC)
 * @access  Private
 */
router.patch(
  '/:id/measurements/actual',
  validateParams(idParamSchema),
  validateBody(recordActualMeasurementsSchema),
  asyncHandler(recordActualMeasurements)
);

/**
 * @route   POST /api/samples/:id/send
 * @desc    Mark sample as sent
 * @access  Private
 */
router.post('/:id/send', validateParams(idParamSchema), validateBody(markAsSentSchema), asyncHandler(markAsSent));

/**
 * @route   POST /api/samples/:id/receive
 * @desc    Record buyer receipt
 * @access  Private
 */
router.post(
  '/:id/receive',
  validateParams(idParamSchema),
  validateBody(recordReceiptSchema),
  asyncHandler(recordReceipt)
);

/**
 * @route   POST /api/samples/:id/feedback
 * @desc    Record buyer feedback
 * @access  Private
 */
router.post(
  '/:id/feedback',
  validateParams(idParamSchema),
  validateBody(recordFeedbackSchema),
  asyncHandler(recordFeedback)
);

/**
 * @route   POST /api/samples/:id/revision
 * @desc    Create a revision of rejected FIT sample
 * @access  Private
 */
router.post(
  '/:id/revision',
  validateParams(idParamSchema),
  validateBody(createRevisionSchema),
  asyncHandler(createRevision)
);

export default router;
