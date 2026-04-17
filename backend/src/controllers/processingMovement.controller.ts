// Processing Movement Controller
import { Request, Response } from 'express';
import processingMovementService from '../services/processingMovement.service';
import { UnauthorizedError } from '../errors';

/**
 * Create a new processing movement
 */
export async function createMovement(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('User not authenticated');

  const movement = await processingMovementService.createMovement({
    ...req.body,
    performedById: userId,
  });

  res.status(201).json({
    success: true,
    message: 'Processing movement created successfully',
    data: movement,
  });
}

/**
 * Get movement by ID
 */
export async function getMovementById(req: Request, res: Response) {
  const { id } = req.params;
  const movement = await processingMovementService.getMovementById(id);
  res.status(200).json({
    success: true,
    data: movement,
  });
}

/**
 * Get all movements with filters
 */
export async function getAllMovements(req: Request, res: Response) {
  const filters = {
    batchId: req.query.batchId as string | undefined,
    stageId: req.query.stageId as string | undefined,
    status: req.query.status as string | undefined,
    movementType: req.query.movementType as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };

  const movements = await processingMovementService.getAllMovements(filters);
  res.status(200).json({
    success: true,
    data: movements,
    count: movements.length,
  });
}

/**
 * Get movements by batch
 */
export async function getMovementsByBatch(req: Request, res: Response) {
  const { batchId } = req.params;
  const movements = await processingMovementService.getMovementsByBatch(batchId);
  res.status(200).json({
    success: true,
    data: movements,
    count: movements.length,
  });
}

/**
 * Get movements by stage
 */
export async function getMovementsByStage(req: Request, res: Response) {
  const { stageId } = req.params;
  const movements = await processingMovementService.getMovementsByStage(stageId);
  res.status(200).json({
    success: true,
    data: movements,
    count: movements.length,
  });
}

/**
 * Get in-transit movements
 */
export async function getInTransitMovements(req: Request, res: Response) {
  const movements = await processingMovementService.getInTransitMovements();
  res.status(200).json({
    success: true,
    data: movements,
    count: movements.length,
  });
}

/**
 * Update movement
 */
export async function updateMovement(req: Request, res: Response) {
  const { id } = req.params;
  const movement = await processingMovementService.updateMovement(id, req.body);
  res.status(200).json({
    success: true,
    message: 'Processing movement updated successfully',
    data: movement,
  });
}

/**
 * Mark movement as delivered
 */
export async function markAsDelivered(req: Request, res: Response) {
  const { id } = req.params;
  const movement = await processingMovementService.markAsDelivered(id);
  res.status(200).json({
    success: true,
    message: 'Movement marked as delivered',
    data: movement,
  });
}

/**
 * Get transit summary
 */
export async function getTransitSummary(req: Request, res: Response) {
  const summary = await processingMovementService.getTransitSummary();
  res.status(200).json({
    success: true,
    data: summary,
  });
}

/**
 * Delete movement
 */
export async function deleteMovement(req: Request, res: Response) {
  const { id } = req.params;
  const result = await processingMovementService.deleteMovement(id);
  res.status(200).json(result);
}
