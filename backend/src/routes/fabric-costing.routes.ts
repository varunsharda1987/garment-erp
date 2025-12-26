/**
 * Fabric Costing Routes
 * Routes for fabric cost calculation with sourcing strategies
 */

import { Router } from 'express';
import {
  calculateSingleFabricCost,
  calculateBatchFabricCost,
  getProcessors,
  getStyleFabrics,
  lookupProcessorRate,
  saveFabricCosting,
} from '../controllers/fabric-costing.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// === NEW ENDPOINTS FOR REDESIGNED FABRIC COSTING PAGE ===

// GET /api/fabric-costing/processors - Get all DYEING_PRINTING processors
router.get('/processors', getProcessors);

// GET /api/fabric-costing/style/:styleId - Get fabrics from a style with greige data
router.get('/style/:styleId', getStyleFabrics);

// POST /api/fabric-costing/lookup-rate - Lookup processor rate for greige+quantity
router.post('/lookup-rate', lookupProcessorRate);

// POST /api/fabric-costing/save - Save fabric costing data for a style
router.post('/save', saveFabricCosting);

// === EXISTING ENDPOINTS (kept for backward compatibility) ===

// POST /api/fabric-costing/calculate - Calculate single fabric cost
router.post('/calculate', calculateSingleFabricCost);

// POST /api/fabric-costing/batch-calculate - Calculate multiple fabrics
router.post('/batch-calculate', calculateBatchFabricCost);

export default router;
