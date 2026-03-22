// Processing Delivery Controller
import { Request, Response } from 'express';
import processingDeliveryService from '../services/processingDelivery.service';
import { ValidationError } from '../errors';

/**
 * Create a new processing delivery
 */
export async function createDelivery(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  const delivery = await processingDeliveryService.createDelivery({
    ...req.body,
    receivedById: userId,
  });

  res.status(201).json({
    success: true,
    message: 'Processing delivery created successfully',
    data: delivery,
  });
}

/**
 * Get delivery by ID
 */
export async function getDeliveryById(req: Request, res: Response) {
  const { id } = req.params;
  const delivery = await processingDeliveryService.getDeliveryById(id);
  res.status(200).json({
    success: true,
    data: delivery,
  });
}

/**
 * Get all deliveries with filters
 */
export async function getAllDeliveries(req: Request, res: Response) {
  const filters = {
    batchId: req.query.batchId as string | undefined,
    stageId: req.query.stageId as string | undefined,
    qualityStatus: req.query.qualityStatus as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };

  const deliveries = await processingDeliveryService.getAllDeliveries(filters);
  res.status(200).json({
    success: true,
    data: deliveries,
    count: deliveries.length,
  });
}

/**
 * Get deliveries by batch
 */
export async function getDeliveriesByBatch(req: Request, res: Response) {
  const { batchId } = req.params;
  const deliveries = await processingDeliveryService.getDeliveriesByBatch(
    batchId
  );
  res.status(200).json({
    success: true,
    data: deliveries,
    count: deliveries.length,
  });
}

/**
 * Get deliveries by stage
 */
export async function getDeliveriesByStage(req: Request, res: Response) {
  const { stageId } = req.params;
  const deliveries = await processingDeliveryService.getDeliveriesByStage(
    stageId
  );
  res.status(200).json({
    success: true,
    data: deliveries,
    count: deliveries.length,
  });
}

/**
 * Get pending QC deliveries
 */
export async function getPendingQCDeliveries(req: Request, res: Response) {
  const deliveries = await processingDeliveryService.getPendingQCDeliveries();
  res.status(200).json({
    success: true,
    data: deliveries,
    count: deliveries.length,
  });
}

/**
 * Update delivery
 */
export async function updateDelivery(req: Request, res: Response) {
  const { id } = req.params;
  const delivery = await processingDeliveryService.updateDelivery(
    id,
    req.body
  );
  res.status(200).json({
    success: true,
    message: 'Processing delivery updated successfully',
    data: delivery,
  });
}

/**
 * Perform quality check
 */
export async function performQC(req: Request, res: Response) {
  const { id } = req.params;
  const {
    quantityAccepted,
    quantityRejected,
    qualityStatus,
    qualityNotes,
    rejectionReason,
  } = req.body;

  if (
    quantityAccepted === undefined ||
    quantityRejected === undefined ||
    !qualityStatus
  ) {
    throw new ValidationError(
      'quantityAccepted, quantityRejected, and qualityStatus are required'
    );
  }

  const delivery = await processingDeliveryService.performQC(id, {
    quantityAccepted,
    quantityRejected,
    qualityStatus,
    qualityNotes,
    rejectionReason,
  });

  res.status(200).json({
    success: true,
    message: 'Quality check performed successfully',
    data: delivery,
  });
}

/**
 * Accept delivery
 */
export async function acceptDelivery(req: Request, res: Response) {
  const { id } = req.params;
  const delivery = await processingDeliveryService.acceptDelivery(id);
  res.status(200).json({
    success: true,
    message: 'Delivery accepted successfully',
    data: delivery,
  });
}

/**
 * Reject delivery
 */
export async function rejectDelivery(req: Request, res: Response) {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new ValidationError('Rejection reason is required');
  }

  const delivery = await processingDeliveryService.rejectDelivery(id, reason);
  res.status(200).json({
    success: true,
    message: 'Delivery rejected',
    data: delivery,
  });
}

/**
 * Get delivery summary
 */
export async function getDeliverySummary(req: Request, res: Response) {
  const filters = {
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };

  const summary = await processingDeliveryService.getDeliverySummary(filters);
  res.status(200).json({
    success: true,
    data: summary,
  });
}

/**
 * Delete delivery
 */
export async function deleteDelivery(req: Request, res: Response) {
  const { id } = req.params;
  const result = await processingDeliveryService.deleteDelivery(id);
  res.status(200).json(result);
}
