/**
 * Embroidery Stock Routes
 * API endpoints for embroidery send-out/receive workflow
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
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
} from '../controllers/embroidery-stock.controller';

const router = Router();

// Send-out/Receive Operations
router.post('/send-out', asyncHandler(sendOut));
router.post('/receive', asyncHandler(receive));

// Send-out Records
router.get('/send-outs', asyncHandler(getSendOuts));
router.get('/send-outs/:id', asyncHandler(getSendOutById));
router.post('/send-outs/:id/cancel', asyncHandler(cancelSendOut));

// Stock Queries
router.get('/by-style/:styleId', asyncHandler(getStockByStyle));
router.get('/by-embroidery/:embroideryId', asyncHandler(getStockByEmbroidery));
router.get('/pending', asyncHandler(getPendingSendOuts));
router.get('/summary', asyncHandler(getStockSummary));

export default router;
