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
  getCostingOptions,
  approveCostingOption,
  unapproveCostingOption,
  deleteCostingOption,
  getStyleCostingOptions,
  promoteCostingOption,
  getStylesCostingStatus,
  checkCADCostingStatus,
  pushFromCAD,
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

// === COSTING OPTIONS ENDPOINTS ===

// GET /api/fabric-costing/options - Get all costing options with filtering (paginated by style)
router.get('/options', getCostingOptions);

// GET /api/fabric-costing/style/:styleId/options - Get all costing options for a specific style
router.get('/style/:styleId/options', getStyleCostingOptions);

// POST /api/fabric-costing/option/:optionId/approve - Approve a costing option
router.post('/option/:optionId/approve', approveCostingOption);

// PATCH /api/fabric-costing/option/:optionId/unapprove - Unapprove a costing option
router.patch('/option/:optionId/unapprove', unapproveCostingOption);

// POST /api/fabric-costing/option/:optionId/promote - Promote to next workflow stage
router.post('/option/:optionId/promote', promoteCostingOption);

// DELETE /api/fabric-costing/option/:optionId - Delete a costing option
router.delete('/option/:optionId', deleteCostingOption);

// POST /api/fabric-costing/styles/costing-status - Get costing status for multiple styles
router.post('/styles/costing-status', getStylesCostingStatus);

// === CAD TO COSTING PUSH ENDPOINTS ===

// POST /api/fabric-costing/check-cad-status - Check which CAD rows already have costing
router.post('/check-cad-status', checkCADCostingStatus);

// POST /api/fabric-costing/push-from-cad - Create costing records from CAD rows
router.post('/push-from-cad', pushFromCAD);

// === EXISTING ENDPOINTS (kept for backward compatibility) ===

// POST /api/fabric-costing/calculate - Calculate single fabric cost
router.post('/calculate', calculateSingleFabricCost);

// POST /api/fabric-costing/batch-calculate - Calculate multiple fabrics
router.post('/batch-calculate', calculateBatchFabricCost);

export default router;
