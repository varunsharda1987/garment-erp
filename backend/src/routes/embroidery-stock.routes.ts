/**
 * Embroidery Stock Routes
 * API endpoints for embroidery send-out/receive workflow
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { validateQuery, validateParams } from '../middleware/validation.middleware';
import { embroideryStockQuerySchema } from '../schemas/embroideryStock.schema';
import { idParamSchema, styleIdParamSchema, embroideryIdParamSchema } from '../schemas/common.schema';
import {
  getSendOuts,
  getSendOutById,
  getStockByStyle,
  getStockByEmbroidery,
  getPendingSendOuts,
  getStockSummary,
  getPendingEmbroideryStock,
} from '../controllers/embroidery-stock.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all embroidery stock routes
router.use(authenticateToken);

// Phase 5b: the embroidery send-out flow is RETIRED — fabric-roll embroidery runs as an
// EMBROIDERY Job Work Order (create with a fabric lot + design, issue, receive via GRN).
// Reads below are kept (CuttingForm and stock views depend on them).
const gone = (_req: Request, res: Response) =>
  res.status(410).json({
    success: false,
    message: 'Embroidery send-outs now run as Job Work Orders — use /job-work-orders (process type EMBROIDERY)',
  });
// no-body — 410 tombstone, nothing read from the request
router.post('/send-out', gone);
// no-body — 410 tombstone, nothing read from the request
router.post('/receive', gone);
// no-body — 410 tombstone, nothing read from the request
router.post('/send-outs/:id/cancel', gone);

// Send-out Records (legacy reads — 0 rows live, kept for history views)
router.get('/send-outs', validateQuery(embroideryStockQuerySchema), asyncHandler(getSendOuts));
router.get('/send-outs/:id', validateParams(idParamSchema), asyncHandler(getSendOutById));

// Stock Queries
router.get('/pending-embroidery', asyncHandler(getPendingEmbroideryStock));
router.get('/by-style/:styleId', validateParams(styleIdParamSchema), asyncHandler(getStockByStyle));
router.get('/by-embroidery/:embroideryId', validateParams(embroideryIdParamSchema), asyncHandler(getStockByEmbroidery));
router.get('/pending', asyncHandler(getPendingSendOuts));
router.get('/summary', asyncHandler(getStockSummary));

export default router;
