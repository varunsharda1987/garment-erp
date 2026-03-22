/**
 * Embroidery Stock Controller
 * API endpoints for embroidery send-out/receive workflow
 */

import { Request, Response } from 'express';
import { embroideryStockService } from '../services/embroidery-stock.service';
import { logInfo } from '../utils/logger';
import { NotFoundError, ValidationError } from '../errors';

/**
 * Send fabric out for embroidery
 * POST /api/embroidery-stock/send-out
 */
export const sendOut = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    sourceFabricStockId,
    embroideryId,
    supplierId,
    quantitySent,
    sentWidth,
    sendDate,
    expectedReturnDate,
    agreedRate,
    forStyleId,
    forOrderId,
    remarks,
  } = req.body;

  // Validation
  if (!sourceFabricStockId || !embroideryId || !supplierId || !quantitySent || !sentWidth || !sendDate || !agreedRate) {
    throw new ValidationError('sourceFabricStockId, embroideryId, supplierId, quantitySent, sentWidth, sendDate, and agreedRate are required');
  }

  const sendOutRecord = await embroideryStockService.sendOut({
    sourceFabricStockId,
    embroideryId,
    supplierId,
    quantitySent: parseFloat(quantitySent),
    sentWidth: parseFloat(sentWidth),
    sendDate: new Date(sendDate),
    expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : undefined,
    agreedRate: parseFloat(agreedRate),
    forStyleId,
    forOrderId,
    remarks,
    createdById: userId,
  });

  logInfo('Embroidery send-out created', { sendOutId: sendOutRecord.id });

  res.status(201).json({
    message: 'Fabric sent for embroidery successfully',
    data: sendOutRecord,
  });
};

/**
 * Receive embroidered fabric back
 * POST /api/embroidery-stock/receive
 */
export const receive = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    sendOutId,
    quantityReceived,
    quantityDamaged,
    receivedWidth,
    actualReturnDate,
    actualCost,
    invoiceNumber,
    invoiceDate,
    qualityGrade,
    warehouseLocation,
    remarks,
  } = req.body;

  // Validation
  if (!sendOutId || !quantityReceived || !receivedWidth || !actualReturnDate) {
    throw new ValidationError('sendOutId, quantityReceived, receivedWidth, and actualReturnDate are required');
  }

  const receiveRecord = await embroideryStockService.receive({
    sendOutId,
    quantityReceived: parseFloat(quantityReceived),
    quantityDamaged: quantityDamaged ? parseFloat(quantityDamaged) : undefined,
    receivedWidth: parseFloat(receivedWidth),
    actualReturnDate: new Date(actualReturnDate),
    actualCost: actualCost ? parseFloat(actualCost) : undefined,
    invoiceNumber,
    invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
    qualityGrade,
    warehouseLocation,
    remarks,
    createdById: userId,
  });

  logInfo('Embroidered fabric received', { sendOutId: receiveRecord.id });

  res.status(200).json({
    message: 'Embroidered fabric received successfully',
    data: receiveRecord,
  });
};

/**
 * Get all send-out records
 * GET /api/embroidery-stock/send-outs
 */
export const getSendOuts = async (req: Request, res: Response): Promise<void> => {
  const { status, embroideryId, supplierId, forStyleId, forOrderId, fromDate, toDate } = req.query;

  const sendOuts = await embroideryStockService.getSendOuts({
    status: status as string,
    embroideryId: embroideryId as string,
    supplierId: supplierId as string,
    forStyleId: forStyleId as string,
    forOrderId: forOrderId as string,
    fromDate: fromDate ? new Date(fromDate as string) : undefined,
    toDate: toDate ? new Date(toDate as string) : undefined,
  });

  res.json({
    data: sendOuts,
    count: sendOuts.length,
  });
};

/**
 * Get single send-out record
 * GET /api/embroidery-stock/send-outs/:id
 */
export const getSendOutById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const sendOut = await embroideryStockService.getSendOutById(id);

  if (!sendOut) {
    throw new NotFoundError('Send-out record', id);
  }

  res.json({ data: sendOut });
};

/**
 * Cancel a send-out
 * POST /api/embroidery-stock/send-outs/:id/cancel
 */
export const cancelSendOut = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new ValidationError('Cancellation reason is required');
  }

  const cancelled = await embroideryStockService.cancelSendOut(id, reason, userId);

  res.json({
    message: 'Send-out cancelled successfully',
    data: cancelled,
  });
};

/**
 * Get embroidered stock for a style
 * GET /api/embroidery-stock/by-style/:styleId
 */
export const getStockByStyle = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;

  const stock = await embroideryStockService.getEmbroideredStockForStyle(styleId);

  res.json({
    data: stock,
    count: stock.length,
  });
};

/**
 * Get stock by embroidery design
 * GET /api/embroidery-stock/by-embroidery/:embroideryId
 */
export const getStockByEmbroidery = async (req: Request, res: Response): Promise<void> => {
  const { embroideryId } = req.params;

  const stock = await embroideryStockService.getStockByEmbroidery(embroideryId);

  res.json({
    data: stock,
    count: stock.length,
  });
};

/**
 * Get pending (overdue) send-outs
 * GET /api/embroidery-stock/pending
 */
export const getPendingSendOuts = async (_req: Request, res: Response): Promise<void> => {
  const pending = await embroideryStockService.getPendingSendOuts();

  res.json({
    data: pending,
    count: pending.length,
  });
};

/**
 * Get embroidery stock summary
 * GET /api/embroidery-stock/summary
 */
export const getStockSummary = async (_req: Request, res: Response): Promise<void> => {
  const summary = await embroideryStockService.getStockSummary();

  res.json({ data: summary });
};
