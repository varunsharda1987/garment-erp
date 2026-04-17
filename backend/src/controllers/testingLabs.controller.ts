import { Request, Response } from 'express';
import { testingLabsService } from '../services/testingLabs.service';
import { UnauthorizedError } from '../errors';

/**
 * Create new testing lab
 */
export const createTestingLab = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const lab = await testingLabsService.createLab(req.body, userId);

  res.status(201).json({
    data: lab,
    message: 'Testing lab created successfully',
  });
};

/**
 * Get all testing labs
 */
export const getAllTestingLabs = async (req: Request, res: Response): Promise<void> => {
  const result = await testingLabsService.getAllLabs(req.validatedQuery || req.query);

  res.json({
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Get testing lab by ID
 */
export const getTestingLabById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const lab = await testingLabsService.getLabById(id);

  res.json({
    data: lab,
  });
};

/**
 * Update testing lab
 */
export const updateTestingLab = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const lab = await testingLabsService.updateLab(id, req.body);

  res.json({
    data: lab,
    message: 'Testing lab updated successfully',
  });
};

/**
 * Delete testing lab
 */
export const deleteTestingLab = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await testingLabsService.deleteLab(id);

  res.json({
    message: 'Testing lab deleted successfully',
  });
};

/**
 * Get lab statistics
 */
export const getLabStats = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const stats = await testingLabsService.getLabStats(id);

  res.json({
    data: stats,
  });
};
