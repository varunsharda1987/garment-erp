import { Request, Response } from 'express';
import { testingLabsService } from '../services/testingLabs.service';
import { logError } from '../utils/logger';
import { AppError, UnauthorizedError } from '../errors';

/**
 * Create new testing lab
 */
export const createTestingLab = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const lab = await testingLabsService.createLab(req.body, userId);

    res.status(201).json({
      data: lab,
      message: 'Testing lab created successfully',
    });
  } catch (error) {
    logError('Create testing lab error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create testing lab',
      });
    }
  }
};

/**
 * Get all testing labs
 */
export const getAllTestingLabs = async (req: Request, res: Response): Promise<void> => {
  console.log('🔍 getAllTestingLabs controller called with query:', req.query);
  console.log('🔍 validatedQuery:', (req as any).validatedQuery);
  try {
    const result = await testingLabsService.getAllLabs((req as any).validatedQuery || req.query);

    res.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logError('Get testing labs error', error instanceof Error ? error : new Error(String(error)));

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch testing labs',
    });
  }
};

/**
 * Get testing lab by ID
 */
export const getTestingLabById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const lab = await testingLabsService.getLabById(id);

    res.json({
      data: lab,
    });
  } catch (error) {
    logError('Get testing lab error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch testing lab',
      });
    }
  }
};

/**
 * Update testing lab
 */
export const updateTestingLab = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const lab = await testingLabsService.updateLab(id, req.body);

    res.json({
      data: lab,
      message: 'Testing lab updated successfully',
    });
  } catch (error) {
    logError('Update testing lab error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update testing lab',
      });
    }
  }
};

/**
 * Delete testing lab
 */
export const deleteTestingLab = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await testingLabsService.deleteLab(id);

    res.json({
      message: 'Testing lab deleted successfully',
    });
  } catch (error) {
    logError('Delete testing lab error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete testing lab',
      });
    }
  }
};

/**
 * Get lab statistics
 */
export const getLabStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const stats = await testingLabsService.getLabStats(id);

    res.json({
      data: stats,
    });
  } catch (error) {
    logError('Get lab stats error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch lab statistics',
      });
    }
  }
};
