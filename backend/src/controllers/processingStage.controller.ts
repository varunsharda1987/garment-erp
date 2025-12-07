// Processing Stage Controller
import { Request, Response } from 'express';
import processingStageService from '../services/processingStage.service';

/**
 * Create a new processing stage
 */
export async function createStage(req: Request, res: Response) {
  try {
    const stage = await processingStageService.createStage(req.body);
    res.status(201).json({
      success: true,
      message: 'Processing stage created successfully',
      data: stage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create processing stage';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Get stage by ID
 */
export async function getStageById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const stage = await processingStageService.getStageById(id);
    res.status(200).json({
      success: true,
      data: stage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch processing stage';
    res.status(404).json({
      success: false,
      message,
    });
  }
}

/**
 * Get all stages with filters
 */
export async function getAllStages(req: Request, res: Response) {
  try {
    const filters = {
      batchId: req.query.batchId as string | undefined,
      processorId: req.query.processorId as string | undefined,
      status: req.query.status as string | undefined,
      processingType: req.query.processingType as string | undefined,
    };

    const stages = await processingStageService.getAllStages(filters);
    res.status(200).json({
      success: true,
      data: stages,
      count: stages.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch processing stages';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Get stages by batch ID
 */
export async function getStagesByBatch(req: Request, res: Response) {
  try {
    const { batchId } = req.params;
    const stages = await processingStageService.getStagesByBatch(batchId);
    res.status(200).json({
      success: true,
      data: stages,
      count: stages.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch batch stages';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Get stages by processor
 */
export async function getStagesByProcessor(req: Request, res: Response) {
  try {
    const { processorId } = req.params;
    const stages = await processingStageService.getStagesByProcessor(processorId);
    res.status(200).json({
      success: true,
      data: stages,
      count: stages.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch processor stages';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Update stage
 */
export async function updateStage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const stage = await processingStageService.updateStage(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Processing stage updated successfully',
      data: stage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update processing stage';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Update stage status
 */
export async function updateStageStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const stage = await processingStageService.updateStageStatus(id, status);
    res.status(200).json({
      success: true,
      message: 'Stage status updated successfully',
      data: stage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update stage status';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Complete stage
 */
export async function completeStage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const stage = await processingStageService.completeStage(id);
    res.status(200).json({
      success: true,
      message: 'Processing stage completed successfully',
      data: stage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to complete processing stage';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Mark stage for rework
 */
export async function markForRework(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rework reason is required',
      });
    }

    const stage = await processingStageService.markForRework(id, reason);
    res.status(200).json({
      success: true,
      message: 'Stage marked for rework',
      data: stage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to mark stage for rework';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Get processor summary
 */
export async function getProcessorSummary(req: Request, res: Response) {
  try {
    const { processorId } = req.params;
    const summary = await processingStageService.getProcessorSummary(processorId);
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch processor summary';
    res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * Delete stage
 */
export async function deleteStage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await processingStageService.deleteStage(id);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete processing stage';
    res.status(400).json({
      success: false,
      message,
    });
  }
}
