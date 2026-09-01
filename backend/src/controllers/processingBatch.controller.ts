// Processing Batch Controller - Job work batch management endpoints
import { Request, Response } from 'express';
import processingBatchService from '../services/processingBatch.service';
import { UnauthorizedError } from '../errors';

/**
 * Create a new processing batch
 * POST /api/processing-batches
 */
export const createBatch = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('User not authenticated');

  const batch = await processingBatchService.createBatch({
    ...req.body,
    createdById: userId,
  });

  res.status(201).json({
    success: true,
    message: 'Processing batch created successfully',
    data: batch,
  });
};

/**
 * Get all processing batches
 * GET /api/processing-batches
 */
export const getAllBatches = async (req: Request, res: Response) => {
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
};

/**
 * Get batch by ID
 * GET /api/processing-batches/:id
 */
export const getBatchById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const batch = await processingBatchService.getBatchById(id);

  res.json({
    success: true,
    data: batch,
  });
};

/**
 * Update batch
 * PUT /api/processing-batches/:id
 */
export const updateBatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const batch = await processingBatchService.updateBatch(id, req.body);

  res.json({
    success: true,
    message: 'Processing batch updated successfully',
    data: batch,
  });
};

/**
 * Get batches by processor
 * GET /api/processing-batches/processor/:processorId
 */
export const getBatchesByProcessor = async (req: Request, res: Response) => {
  const { processorId } = req.params;
  const batches = await processingBatchService.getBatchesByProcessor(processorId);

  res.json({
    success: true,
    data: batches,
    count: batches.length,
  });
};

/**
 * Get job work summary
 * GET /api/processing-batches/summary/job-work
 */
export const getJobWorkSummary = async (req: Request, res: Response) => {
  const summary = await processingBatchService.getJobWorkSummary();

  res.json({
    success: true,
    data: summary,
  });
};

/**
 * Cancel batch
 * POST /api/processing-batches/:id/cancel
 */
export const cancelBatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const batch = await processingBatchService.cancelBatch(id);

  res.json({
    success: true,
    message: 'Processing batch cancelled successfully',
    data: batch,
  });
};

/**
 * Complete batch
 * POST /api/processing-batches/:id/complete
 */
export const completeBatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const batch = await processingBatchService.completeBatch(id);

  res.json({
    success: true,
    message: 'Processing batch completed successfully',
    data: batch,
  });
};

/**
 * Receive dyed lace back from the processor and book it into stock.
 * POST /api/processing-batches/:id/receive-lace
 *
 * This closes the greige→dyed loop: the greige was bought on a GREIGE_LACE PO, sent out on this
 * batch, and comes back as a DIFFERENT material (the dyed variant) which is what production
 * consumes. The service resolves/validates that dyed master so the lot cannot land under the
 * greige id, and syncs stock_levels so it shows on the Stock Levels page.
 */
export const receiveLace = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('User not authenticated');

  const result = await processingBatchService.receiveProcessedLace(id, {
    ...req.body,
    receivedById: userId,
  });

  res.status(201).json({
    success: true,
    message: 'Dyed lace received into stock',
    data: result,
  });
};
