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

  // BUG-EMB15 fix: Zod schema (sendOutSchema) already coerces dates via z.coerce.date()
  // and numbers via z.coerce.number(), so values from req.body are already the correct types.
  // Removed redundant new Date() and parseFloat() calls for consistency.
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

  // Validation - Zod schema marks these required, but keep manual check for non-validated paths
  if (!sourceFabricStockId || !embroideryId || !supplierId || !quantitySent || !sentWidth || !sendDate || !agreedRate) {
    throw new ValidationError(
      'sourceFabricStockId, embroideryId, supplierId, quantitySent, sentWidth, sendDate, and agreedRate are required'
    );
  }

  const sendOutRecord = await embroideryStockService.sendOut({
    sourceFabricStockId,
    embroideryId,
    supplierId,
    quantitySent, // BUG-EMB15 fix: already number from z.coerce.number()
    sentWidth, // BUG-EMB15 fix: already number from z.coerce.number()
    sendDate, // BUG-EMB15 fix: already Date from z.coerce.date()
    expectedReturnDate, // BUG-EMB15 fix: already Date or undefined from z.coerce.date().optional()
    agreedRate, // BUG-EMB15 fix: already number from z.coerce.number()
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

  // BUG-EMB15 fix: Zod schema (receiveSchema) already coerces dates via z.coerce.date()
  // and numbers via z.coerce.number(), so values from req.body are already the correct types.
  // Removed redundant new Date() and parseFloat() calls for consistency.
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

  // Validation - Zod schema marks these required, but keep manual check for non-validated paths
  if (!sendOutId || !quantityReceived || !receivedWidth || !actualReturnDate) {
    throw new ValidationError('sendOutId, quantityReceived, receivedWidth, and actualReturnDate are required');
  }

  const receiveRecord = await embroideryStockService.receive({
    sendOutId,
    quantityReceived, // BUG-EMB15 fix: already number from z.coerce.number()
    quantityDamaged, // BUG-EMB15 fix: already number or undefined from z.coerce.number().optional()
    receivedWidth, // BUG-EMB15 fix: already number from z.coerce.number()
    actualReturnDate, // BUG-EMB15 fix: already Date from z.coerce.date()
    actualCost, // BUG-EMB15 fix: already number or undefined from z.coerce.number().optional()
    invoiceNumber,
    invoiceDate, // BUG-EMB15 fix: already Date or undefined from z.coerce.date().optional()
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
  // BUG-EMB15 fix: Use req.validatedQuery for coerced values from Zod schema (embroideryStockQuerySchema).
  // validateQuery middleware stores the transformed values there (dates already Date objects).
  // Fall back to req.query for backwards compatibility if validation middleware was bypassed.
  const validated = (req as any).validatedQuery ?? req.query;
  const { status, embroideryId, supplierId, forStyleId, forOrderId, fromDate, toDate } = validated;

  const sendOuts = await embroideryStockService.getSendOuts({
    status: status as string,
    embroideryId: embroideryId as string,
    supplierId: supplierId as string,
    forStyleId: forStyleId as string,
    forOrderId: forOrderId as string,
    fromDate, // BUG-EMB15 fix: already Date or undefined from z.coerce.date().optional()
    toDate, // BUG-EMB15 fix: already Date or undefined from z.coerce.date().optional()
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

/**
 * Get fabric stock pending embroidery
 * GET /api/embroidery-stock/pending-embroidery
 */
export const getPendingEmbroideryStock = async (req: Request, res: Response): Promise<void> => {
  const { styleId, page, limit } = req.query;

  const result = await embroideryStockService.getStockPendingEmbroidery({
    styleId: styleId as string | undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json(result);
};
