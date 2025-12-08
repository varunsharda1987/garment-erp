/**
 * Embroidery Stock Routes
 * API endpoints for embroidery send-out/receive workflow
 */

import { Router } from 'express';
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
router.post('/send-out', sendOut);
router.post('/receive', receive);

// Send-out Records
router.get('/send-outs', getSendOuts);
router.get('/send-outs/:id', getSendOutById);
router.post('/send-outs/:id/cancel', cancelSendOut);

// Stock Queries
router.get('/by-style/:styleId', getStockByStyle);
router.get('/by-embroidery/:embroideryId', getStockByEmbroidery);
router.get('/pending', getPendingSendOuts);
router.get('/summary', getStockSummary);

export default router;
