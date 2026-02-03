// Processing Batch Controller - Job work batch management endpoints
import { Request, Response } from 'express';
import processingBatchService from '../services/processingBatch.service';

/**
 * Create a new processing batch
 * POST /api/processing-batches
 */
export const createBatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const batch = await processingBatchService.createBatch({
      ...req.body,
      createdById: userId,
    });

    res.status(201).json({
      success: true,
      message: 'Processing batch created successfully',
      data: batch,
    });
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create processing batch',
    });
  }
};

/**
 * Get all processing batches
 * GET /api/processing-batches
 */
export const getAllBatches = async (req: Request, res: Response) => {
  try {
    const { overallStatus, materialType, greigeId, fabricId, search } = req.query;

    const batches = await processingBatchService.getAllBatches({
      overallStatus: overallStatus as string | undefined,
      materialType: materialType as 'GREIGE' | 'FABRIC' | undefined,
      greigeId: greigeId as string | undefined,
      fabricId: fabricId as string | undefined,
      search: search as string | undefined,
    });

    res.json({
      success: true,
      data: batches,
      count: batches.length,
    });
  } catch (error) {
    console.error('Get all batches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch processing batches',
    });
  }
};

/**
 * Get batch by ID
 * GET /api/processing-batches/:id
 */
export const getBatchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const batch = await processingBatchService.getBatchById(id);

    res.json({
      success: true,
      data: batch,
    });
  } catch (error) {
    console.error('Get batch error:', error);
    res.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : 'Processing batch not found',
    });
  }
};

/**
 * Update batch
 * PUT /api/processing-batches/:id
 */
export const updateBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const batch = await processingBatchService.updateBatch(id, req.body);

    res.json({
      success: true,
      message: 'Processing batch updated successfully',
      data: batch,
    });
  } catch (error) {
    console.error('Update batch error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update processing batch',
    });
  }
};

/**
 * Get batches by processor
 * GET /api/processing-batches/processor/:processorId
 */
export const getBatchesByProcessor = async (req: Request, res: Response) => {
  try {
    const { processorId } = req.params;
    const batches = await processingBatchService.getBatchesByProcessor(processorId);

    res.json({
      success: true,
      data: batches,
      count: batches.length,
    });
  } catch (error) {
    console.error('Get batches by processor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch processor batches',
    });
  }
};

/**
 * Get job work summary
 * GET /api/processing-batches/summary/job-work
 */
export const getJobWorkSummary = async (req: Request, res: Response) => {
  try {
    const summary = await processingBatchService.getJobWorkSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Get job work summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job work summary',
    });
  }
};

/**
 * Cancel batch
 * POST /api/processing-batches/:id/cancel
 */
export const cancelBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const batch = await processingBatchService.cancelBatch(id);

    res.json({
      success: true,
      message: 'Processing batch cancelled successfully',
      data: batch,
    });
  } catch (error) {
    console.error('Cancel batch error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to cancel processing batch',
    });
  }
};

/**
 * Complete batch
 * POST /api/processing-batches/:id/complete
 */
export const completeBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const batch = await processingBatchService.completeBatch(id);

    res.json({
      success: true,
      message: 'Processing batch completed successfully',
      data: batch,
    });
  } catch (error) {
    console.error('Complete batch error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to complete processing batch',
    });
  }
};
