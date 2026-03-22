// Processing Stage Controller
import { Request, Response } from 'express';
import processingStageService from '../services/processingStage.service';
import { ValidationError } from '../errors';

/**
 * Create a new processing stage
 */
export async function createStage(req: Request, res: Response) {
  const stage = await processingStageService.createStage(req.body);
  res.status(201).json({
    success: true,
    message: 'Processing stage created successfully',
    data: stage,
  });
}

/**
 * Get stage by ID
 */
export async function getStageById(req: Request, res: Response) {
  const { id } = req.params;
  const stage = await processingStageService.getStageById(id);
  res.status(200).json({
    success: true,
    data: stage,
  });
}

/**
 * Get all stages with filters
 */
export async function getAllStages(req: Request, res: Response) {
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
}

/**
 * Get stages by batch ID
 */
export async function getStagesByBatch(req: Request, res: Response) {
  const { batchId } = req.params;
  const stages = await processingStageService.getStagesByBatch(batchId);
  res.status(200).json({
    success: true,
    data: stages,
    count: stages.length,
  });
}

/**
 * Get stages by processor
 */
export async function getStagesByProcessor(req: Request, res: Response) {
  const { processorId } = req.params;
  const stages = await processingStageService.getStagesByProcessor(processorId);
  res.status(200).json({
    success: true,
    data: stages,
    count: stages.length,
  });
}

/**
 * Update stage
 */
export async function updateStage(req: Request, res: Response) {
  const { id } = req.params;
  const stage = await processingStageService.updateStage(id, req.body);
  res.status(200).json({
    success: true,
    message: 'Processing stage updated successfully',
    data: stage,
  });
}

/**
 * Update stage status
 */
export async function updateStageStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    throw new ValidationError('Status is required');
  }

  const stage = await processingStageService.updateStageStatus(id, status);
  res.status(200).json({
    success: true,
    message: 'Stage status updated successfully',
    data: stage,
  });
}

/**
 * Complete stage
 */
export async function completeStage(req: Request, res: Response) {
  const { id } = req.params;
  const stage = await processingStageService.completeStage(id);
  res.status(200).json({
    success: true,
    message: 'Processing stage completed successfully',
    data: stage,
  });
}

/**
 * Mark stage for rework
 */
export async function markForRework(req: Request, res: Response) {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new ValidationError('Rework reason is required');
  }

  const stage = await processingStageService.markForRework(id, reason);
  res.status(200).json({
    success: true,
    message: 'Stage marked for rework',
    data: stage,
  });
}

/**
 * Get processor summary
 */
export async function getProcessorSummary(req: Request, res: Response) {
  const { processorId } = req.params;
  const summary = await processingStageService.getProcessorSummary(processorId);
  res.status(200).json({
    success: true,
    data: summary,
  });
}

/**
 * Delete stage
 */
export async function deleteStage(req: Request, res: Response) {
  const { id } = req.params;
  const result = await processingStageService.deleteStage(id);
  res.status(200).json(result);
}
