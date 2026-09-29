/**
 * Fabric Stock Routes
 *
 * All routes are protected with authentication middleware
 */

import { Router } from 'express';
import {
  createFabricStock,
  listStock,
  getStockById,
  getStockDashboard,
  getFabricStockSummary,
  getAgingStock,
  getStockValuation,
  transferStock,
  adjustStock,
  updateStock,
  deleteStock,
  getStockPieces,
  recordStockPieces,
  correctLotWidth,
} from '../controllers/fabric-stock.controller';
import { authenticateToken, requirePermissionForWrites } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createFabricStockSchema,
  updateFabricStockSchema,
  transferFabricStockSchema,
  adjustFabricStockSchema,
  fabricStockQuerySchema,
  fabricStockIdParamSchema,
  recordFabricPiecesSchema,
  correctLotWidthSchema,
} from '../schemas/fabricStock.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);
router.use(requirePermissionForWrites('greigeFabricStock'));

// Stock creation
router.post('/', validateBody(createFabricStockSchema), asyncHandler(createFabricStock));

// Stock listing and details
router.get('/', validateQuery(fabricStockQuerySchema), asyncHandler(listStock));
router.get('/dashboard', asyncHandler(getStockDashboard));
router.get('/summary', asyncHandler(getFabricStockSummary));
router.get('/aging', asyncHandler(getAgingStock));
router.get('/valuation', asyncHandler(getStockValuation));
// A lot's rolls & thans (fabric-lot-pieces.service) — read, and Record / Check what is on the rack
router.get('/:id/pieces', validateParams(fabricStockIdParamSchema), asyncHandler(getStockPieces));
router.post(
  '/:id/pieces',
  validateParams(fabricStockIdParamSchema),
  validateBody(recordFabricPiecesSchema),
  asyncHandler(recordStockPieces)
);
// Correct a lot's measured / cutable width after inward (lot-width.helper) — refused once it has gone to cutting
router.post(
  '/:id/correct-width',
  validateParams(fabricStockIdParamSchema),
  validateBody(correctLotWidthSchema),
  asyncHandler(correctLotWidth)
);
router.get('/:id', validateParams(fabricStockIdParamSchema), asyncHandler(getStockById));

// Stock operations
router.post('/transfer', validateBody(transferFabricStockSchema), asyncHandler(transferStock));
router.post('/adjust', validateBody(adjustFabricStockSchema), asyncHandler(adjustStock));

// Stock update
router.patch(
  '/:id',
  validateParams(fabricStockIdParamSchema),
  validateBody(updateFabricStockSchema),
  asyncHandler(updateStock)
);

// Stock deletion
router.delete('/:id', validateParams(fabricStockIdParamSchema), asyncHandler(deleteStock));

export default router;
