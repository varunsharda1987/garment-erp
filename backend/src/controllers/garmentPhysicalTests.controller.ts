import { Request, Response } from 'express';
import { garmentPhysicalTestsService } from '../services/garmentPhysicalTests.service';
import { logError } from '../utils/logger';
import { AppError, UnauthorizedError } from '../errors';

export const createGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const test = await garmentPhysicalTestsService.createTest(req.body, userId);

    res.status(201).json({
      data: test,
      message: 'Garment physical test created successfully',
    });
  } catch (error) {
    logError('Create GPT error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create garment physical test',
      });
    }
  }
};

export const getAllGarmentPhysicalTests = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await garmentPhysicalTestsService.getAllTests((req as any).validatedQuery || req.query);

    res.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logError('Get GPTs error', error instanceof Error ? error : new Error(String(error)));

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch garment physical tests',
    });
  }
};

export const getGarmentPhysicalTestById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const test = await garmentPhysicalTestsService.getTestById(id);

    res.json({
      data: test,
    });
  } catch (error) {
    logError('Get GPT error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch garment physical test',
      });
    }
  }
};

export const updateGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const test = await garmentPhysicalTestsService.updateTest(id, req.body);

    res.json({
      data: test,
      message: 'Garment physical test updated successfully',
    });
  } catch (error) {
    logError('Update GPT error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update garment physical test',
      });
    }
  }
};

export const createRetestGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const retest = await garmentPhysicalTestsService.createRetest(req.body, userId);

    res.status(201).json({
      data: retest,
      message: 'Garment physical test retest created successfully',
    });
  } catch (error) {
    logError('Create GPT retest error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create retest',
      });
    }
  }
};

export const approveGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const { id } = req.params;
    const test = await garmentPhysicalTestsService.approveTest(id, req.body, userId);

    res.json({
      data: test,
      message: 'Garment physical test approved successfully',
    });
  } catch (error) {
    logError('Approve GPT error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to approve garment physical test',
      });
    }
  }
};

export const buyerApproveGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const { id } = req.params;
    const test = await garmentPhysicalTestsService.buyerApproveTest(id, req.body, userId);

    res.json({
      data: test,
      message: 'Garment physical test buyer approved successfully',
    });
  } catch (error) {
    logError('Buyer approve GPT error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to buyer approve garment physical test',
      });
    }
  }
};

export const deleteGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await garmentPhysicalTestsService.deleteTest(id);

    res.json({
      message: 'Garment physical test deleted successfully',
    });
  } catch (error) {
    logError('Delete GPT error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete garment physical test',
      });
    }
  }
};
