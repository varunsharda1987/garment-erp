import { Request, Response } from 'express';
import { testTemplatesService } from '../services/testTemplates.service';
import { UnauthorizedError } from '../errors';

export const createTestTemplate = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const template = await testTemplatesService.createTemplate(req.body, userId);

  res.status(201).json({
    data: template,
    message: 'Test template created successfully',
  });
};

export const getAllTestTemplates = async (req: Request, res: Response): Promise<void> => {
  const result = await testTemplatesService.getAllTemplates(req.validatedQuery || req.query);

  res.json({
    data: result.data,
    pagination: result.pagination,
  });
};

export const getTestTemplateById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const template = await testTemplatesService.getTemplateById(id);

  res.json({
    data: template,
  });
};

export const updateTestTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const template = await testTemplatesService.updateTemplate(id, req.body);

  res.json({
    data: template,
    message: 'Test template updated successfully',
  });
};

export const deleteTestTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await testTemplatesService.deleteTemplate(id);

  res.json({
    message: 'Test template deleted successfully',
  });
};
