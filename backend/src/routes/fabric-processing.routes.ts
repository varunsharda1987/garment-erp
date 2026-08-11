/**
 * Fabric Processing Routes
 *
 * Handles routing for fabric processing workflow endpoints
 */

import { Router, Request, Response } from 'express';
import {
  listProcessingBatches,
  getProcessingDetails,
  getMillPerformance,
} from '../controllers/fabric-processing.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateParams } from '../middleware/validation.middleware';
import { idParamSchema } from '../schemas/common.schema';

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

// Phase 5b: fabric_processing writers are RETIRED — greige processing runs on Job Work
// Orders end-to-end (dyeing/printing pages or /job-work-orders). Reads above stay.
const gone = (_req: Request, res: Response) =>
  res.status(410).json({
    success: false,
    message: 'Greige processing now runs on Job Work Orders — use the Dyeing/Printing pages or /job-work-orders',
  });
router.post('/', gone); // no-body — 410 tombstone, nothing read
router.put('/:id/receive', gone); // no-body — 410 tombstone, nothing read

export default router;
