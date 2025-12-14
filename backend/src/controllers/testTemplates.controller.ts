import { Request, Response } from 'express';
import { testTemplatesService } from '../services/testTemplates.service';
import { logError } from '../utils/logger';
import { AppError, UnauthorizedError } from '../errors';

export const createTestTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const template = await testTemplatesService.createTemplate(req.body, userId);

    res.status(201).json({
      data: template,
      message: 'Test template created successfully',
    });
  } catch (error) {
    logError('Create test template error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create test template',
      });
    }
  }
};

export const getAllTestTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await testTemplatesService.getAllTemplates((req as any).validatedQuery || req.query);

    res.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logError('Get test templates error', error instanceof Error ? error : new Error(String(error)));

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch test templates',
    });
  }
};

export const getTestTemplateById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const template = await testTemplatesService.getTemplateById(id);

    res.json({
      data: template,
    });
  } catch (error) {
    logError('Get test template error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch test template',
      });
    }
  }
};

export const updateTestTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const template = await testTemplatesService.updateTemplate(id, req.body);

    res.json({
      data: template,
      message: 'Test template updated successfully',
    });
  } catch (error) {
    logError('Update test template error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update test template',
      });
    }
  }
};

export const deleteTestTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await testTemplatesService.deleteTemplate(id);

    res.json({
      message: 'Test template deleted successfully',
    });
  } catch (error) {
    logError('Delete test template error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete test template',
      });
    }
  }
};
