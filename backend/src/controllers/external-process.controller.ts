/**
 * External Process Controller
 * API endpoints for Smocking, Handwork, and Piece-Level Embroidery send-out/receive
 */

import { Request, Response } from 'express';
import { externalProcessService } from '../services/external-process.service';
import { ExternalProcessType, ExternalProcessStatus, Unit } from '@prisma/client';
import { UnauthorizedError, ValidationError, NotFoundError } from '../errors';

class ExternalProcessController {
  /**
   * POST /api/external-process/send-out
   */
  async sendOut(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const {
      processType,
      sourceType,
      workOrderId,
      orderId,
      styleId,
      cuttingBatchId,
      fabricStockId,
      stitchingIssueId,
      supplierId,
      quantitySent,
      unit,
      agreedRate,
      sendDate,
      expectedReturnDate,
      purchaseOrderId,
      serviceRequirementId,
      embroideryId,
      remarks,
      skus,
    } = req.body;

    if (
      !processType ||
      !sourceType ||
      !workOrderId ||
      !supplierId ||
      !quantitySent ||
      !sendDate ||
      !agreedRate ||
      !purchaseOrderId
    ) {
      throw new ValidationError(
        'processType, sourceType, workOrderId, supplierId, quantitySent, sendDate, agreedRate, and purchaseOrderId are required'
      );
    }

    const result = await externalProcessService.createSendOut({
      processType: processType as ExternalProcessType,
      sourceType,
      workOrderId,
      orderId,
      styleId,
      cuttingBatchId,
      fabricStockId,
      stitchingIssueId,
      supplierId,
      quantitySent: parseFloat(quantitySent),
      unit: unit || Unit.PIECE,
      agreedRate: parseFloat(agreedRate),
      sendDate: new Date(sendDate),
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : undefined,
      purchaseOrderId,
      serviceRequirementId,
      embroideryId,
      remarks,
      createdById: userId,
      skus,
    });

    res.status(201).json({ message: 'Send-out created successfully', data: result });
  }

  /**
   * POST /api/external-process/receive
   */
  async receive(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const {
      sendOutId,
      quantityReceived,
      quantityDamaged,
      actualReturnDate,
      actualCost,
      invoiceNumber,
      invoiceDate,
      remarks,
      skus,
    } = req.body;

    if (!sendOutId || quantityReceived === undefined || !actualReturnDate) {
      throw new ValidationError('sendOutId, quantityReceived, and actualReturnDate are required');
    }

    const result = await externalProcessService.receiveSendOut({
      sendOutId,
      quantityReceived: parseFloat(quantityReceived),
      quantityDamaged: quantityDamaged ? parseFloat(quantityDamaged) : undefined,
      actualReturnDate: new Date(actualReturnDate),
      actualCost: actualCost ? parseFloat(actualCost) : undefined,
      invoiceNumber,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
      remarks,
      createdById: userId,
      skus,
    });

    res.status(200).json({ message: 'Material received successfully', data: result });
  }

  /**
   * GET /api/external-process/send-outs
   */
  async getSendOuts(req: Request, res: Response) {
    const { processType, status, supplierId, workOrderId, orderId, styleId, fromDate, toDate, page, limit, search } =
      req.query;

    const result = await externalProcessService.getSendOuts({
      processType: processType as ExternalProcessType | undefined,
      status: status as ExternalProcessStatus | undefined,
      supplierId: supplierId as string | undefined,
      workOrderId: workOrderId as string | undefined,
      orderId: orderId as string | undefined,
      styleId: styleId as string | undefined,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      search: search as string | undefined,
    });

    res.json(result);
  }

  /**
   * GET /api/external-process/send-outs/:id
   */
  async getSendOutById(req: Request, res: Response) {
    const { id } = req.params;
    const result = await externalProcessService.getSendOutById(id);

    if (!result) {
      throw new NotFoundError('Send-out', id);
    }

    res.json(result);
  }

  /**
   * POST /api/external-process/send-outs/:id/cancel
   */
  async cancelSendOut(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new ValidationError('Cancellation reason is required');
    }

    const result = await externalProcessService.cancelSendOut(id, reason, userId);
    res.json({ message: 'Send-out cancelled successfully', data: result });
  }

  /**
   * GET /api/external-process/dashboard
   */
  async getDashboard(req: Request, res: Response) {
    const { processType } = req.query;

    if (!processType) {
      throw new ValidationError('processType query parameter is required');
    }

    const result = await externalProcessService.getDashboard(processType as ExternalProcessType);
    res.json(result);
  }

  /**
   * GET /api/external-process/wip/:workOrderId
   */
  async getWipByWorkOrder(req: Request, res: Response) {
    const { workOrderId } = req.params;
    const { processType } = req.query;

    const result = await externalProcessService.getWipByWorkOrder(
      workOrderId,
      processType as ExternalProcessType | undefined
    );

    res.json(result);
  }
}

export const externalProcessController = new ExternalProcessController();
