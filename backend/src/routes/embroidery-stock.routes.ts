/**
 * Embroidery Stock Routes
 * API endpoints for embroidery send-out/receive workflow
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  sendOutSchema,
  receiveSchema,
  cancelSendOutSchema,
  embroideryStockQuerySchema,
} from '../schemas/embroideryStock.schema';
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

const router = Router();

// Send-out/Receive Operations
router.post('/send-out', validateBody(sendOutSchema), asyncHandler(sendOut));
router.post('/receive', validateBody(receiveSchema), asyncHandler(receive));

// Send-out Records
router.get('/send-outs', validateQuery(embroideryStockQuerySchema), asyncHandler(getSendOuts));
router.get('/send-outs/:id', asyncHandler(getSendOutById));
router.post('/send-outs/:id/cancel', validateBody(cancelSendOutSchema), asyncHandler(cancelSendOut));

// Stock Queries
router.get('/pending-embroidery', asyncHandler(getPendingEmbroideryStock));
router.get('/by-style/:styleId', asyncHandler(getStockByStyle));
router.get('/by-embroidery/:embroideryId', asyncHandler(getStockByEmbroidery));
router.get('/pending', asyncHandler(getPendingSendOuts));
router.get('/summary', asyncHandler(getStockSummary));

export default router;
