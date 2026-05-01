/**
 * Embroidery Stock Routes
 * API endpoints for embroidery send-out/receive workflow
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  sendOutSchema,
  receiveSchema,
  cancelSendOutSchema,
  embroideryStockQuerySchema,
} from '../schemas/embroideryStock.schema';
import { idParamSchema, styleIdParamSchema, embroideryIdParamSchema } from '../schemas/common.schema';
import {
  sendOut,
  receive,
  getSendOuts,
  getSendOutById,
  cancelSendOut,
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

// Send-out/Receive Operations
router.post('/send-out', validateBody(sendOutSchema), asyncHandler(sendOut));
router.post('/receive', validateBody(receiveSchema), asyncHandler(receive));

// Send-out Records
router.get('/send-outs', validateQuery(embroideryStockQuerySchema), asyncHandler(getSendOuts));
router.get('/send-outs/:id', validateParams(idParamSchema), asyncHandler(getSendOutById));
router.post(
  '/send-outs/:id/cancel',
  validateParams(idParamSchema),
  validateBody(cancelSendOutSchema),
  asyncHandler(cancelSendOut)
);

// Stock Queries
router.get('/pending-embroidery', asyncHandler(getPendingEmbroideryStock));
router.get('/by-style/:styleId', validateParams(styleIdParamSchema), asyncHandler(getStockByStyle));
router.get('/by-embroidery/:embroideryId', validateParams(embroideryIdParamSchema), asyncHandler(getStockByEmbroidery));
router.get('/pending', asyncHandler(getPendingSendOuts));
router.get('/summary', asyncHandler(getStockSummary));

export default router;
