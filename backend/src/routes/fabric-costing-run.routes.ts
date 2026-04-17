/**
 * Fabric Costing Run Routes
 * Routes for managing costing runs (grouped CAD records)
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import {
  getRunsByStyle,
  getRunById,
  createRun,
  deleteRun,
  updateRunTotals,
} from '../controllers/fabric-costing-run.controller';
import { createCostingRunSchema, recalculateRunSchema } from '../schemas/fabricCostingRun.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/fabric-costing-runs/style/:styleId - Get all runs for a style
router.get('/style/:styleId', asyncHandler(getRunsByStyle));

// POST /api/fabric-costing-runs/style/:styleId - Create new run
router.post('/style/:styleId', validateBody(createCostingRunSchema), asyncHandler(createRun));

// GET /api/fabric-costing-runs/:runId - Get single run with details
router.get('/:runId', asyncHandler(getRunById));

// DELETE /api/fabric-costing-runs/:runId - Delete run
router.delete('/:runId', asyncHandler(deleteRun));

// PATCH /api/fabric-costing-runs/:runId/recalculate - Recalculate totals
router.patch('/:runId/recalculate', validateBody(recalculateRunSchema), asyncHandler(updateRunTotals));

export default router;
