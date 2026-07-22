/**
 * Fabric Processing Routes
 *
 * Handles routing for fabric processing workflow endpoints
 */

import { Router } from 'express';
import {
  listProcessingBatches,
  getProcessingDetails,
  sendForProcessing,
  receiveFinishedFabric,
  getMillPerformance,
} from '../controllers/fabric-processing.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { idParamSchema } from '../schemas/common.schema';
import { sendForProcessingSchema, receiveFinishedFabricSchema } from '../schemas/fabric-processing.schema';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/processing/mill-performance - Mill performance analytics
// Must come BEFORE /:id route to avoid conflict
router.get('/mill-performance', asyncHandler(getMillPerformance));

// GET /api/processing - List all processing batches with filters
router.get('/', asyncHandler(listProcessingBatches));

// GET /api/processing/:id - Get processing batch details
router.get('/:id', validateParams(idParamSchema), asyncHandler(getProcessingDetails));

// POST /api/processing - Send greige for processing
router.post('/', validateBody(sendForProcessingSchema), asyncHandler(sendForProcessing));

// PUT /api/processing/:id/receive - Receive finished fabric
router.put(
  '/:id/receive',
  validateParams(idParamSchema),
  validateBody(receiveFinishedFabricSchema),
  asyncHandler(receiveFinishedFabric)
);

export default router;
