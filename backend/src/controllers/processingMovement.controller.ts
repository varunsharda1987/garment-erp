// Processing Movement Controller
import { Request, Response } from 'express';
import processingMovementService from '../services/processingMovement.service';

/**
 * Create a new processing movement
 */
export async function createMovement(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const movement = await processingMovementService.createMovement({
      ...req.body,
      performedById: userId,
    });

    res.status(201).json({
      success: true,
      message: 'Processing movement created successfully',
      data: movement,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to create processing movement';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Get movement by ID
 */
export async function getMovementById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const movement = await processingMovementService.getMovementById(id);
    res.status(200).json({
      success: true,
      data: movement,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to fetch processing movement';
    res.status(404).json({
      success: false,
      message,
    });
  }
}

/**
 * Get all movements with filters
 */
export async function getAllMovements(req: Request, res: Response) {
  try {
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
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to fetch processing movements';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Get movements by batch
 */
export async function getMovementsByBatch(req: Request, res: Response) {
  try {
    const { batchId } = req.params;
    const movements = await processingMovementService.getMovementsByBatch(
      batchId
    );
    res.status(200).json({
      success: true,
      data: movements,
      count: movements.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to fetch batch movements';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Get movements by stage
 */
export async function getMovementsByStage(req: Request, res: Response) {
  try {
    const { stageId } = req.params;
    const movements = await processingMovementService.getMovementsByStage(
      stageId
    );
    res.status(200).json({
      success: true,
      data: movements,
      count: movements.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to fetch stage movements';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Get in-transit movements
 */
export async function getInTransitMovements(req: Request, res: Response) {
  try {
    const movements = await processingMovementService.getInTransitMovements();
    res.status(200).json({
      success: true,
      data: movements,
      count: movements.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to fetch in-transit movements';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Update movement
 */
export async function updateMovement(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const movement = await processingMovementService.updateMovement(
      id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: 'Processing movement updated successfully',
      data: movement,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to update processing movement';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Mark movement as delivered
 */
export async function markAsDelivered(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const movement = await processingMovementService.markAsDelivered(id);
    res.status(200).json({
      success: true,
      message: 'Movement marked as delivered',
      data: movement,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to mark movement as delivered';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Get transit summary
 */
export async function getTransitSummary(req: Request, res: Response) {
  try {
    const summary = await processingMovementService.getTransitSummary();
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to fetch transit summary';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Delete movement
 */
export async function deleteMovement(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await processingMovementService.deleteMovement(id);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to delete processing movement';
    res.status(400).json({
      success: false,
      message,
    });
  }
}
