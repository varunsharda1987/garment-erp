/**
 * Fabric Costing Routes
 * Routes for fabric cost calculation with sourcing strategies
 */

import { Router } from 'express';
import {
  calculateSingleFabricCost,
  calculateBatchFabricCost,
} from '../controllers/fabric-costing.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/fabric-costing/calculate - Calculate single fabric cost
router.post('/calculate', calculateSingleFabricCost);

// POST /api/fabric-costing/batch-calculate - Calculate multiple fabrics
router.post('/batch-calculate', calculateBatchFabricCost);

export default router;
