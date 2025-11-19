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

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/processing/mill-performance - Mill performance analytics
// Must come BEFORE /:id route to avoid conflict
router.get('/mill-performance', getMillPerformance);

// GET /api/processing - List all processing batches with filters
router.get('/', listProcessingBatches);

// GET /api/processing/:id - Get processing batch details
router.get('/:id', getProcessingDetails);

// POST /api/processing - Send greige for processing
router.post('/', sendForProcessing);

// PUT /api/processing/:id/receive - Receive finished fabric
router.put('/:id/receive', receiveFinishedFabric);

export default router;
