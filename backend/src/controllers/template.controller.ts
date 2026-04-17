// Template Controller - Manage export templates
import { Request, Response } from 'express';
import templateService from '../services/template.service';
import { NotFoundError, UnauthorizedError, ValidationError } from '../errors';

/**
 * Create a new export template
 * POST /api/templates
 */
export const createTemplate = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { moduleName, templateName, description, columnConfig, isDefault } = req.body;

  if (!moduleName || !templateName || !columnConfig) {
    throw new ValidationError('Missing required fields: moduleName, templateName, columnConfig');
  }

  const template = await templateService.createTemplate({
    moduleName,
    templateName,
    description,
    columnConfig,
    isDefault,
    createdById: userId,
  });

  res.status(201).json({
    success: true,
    message: 'Template created successfully',
    template,
  });
};

/**
 * Get all templates (optionally filter by module)
 * GET /api/templates?module=customers
 */
export const getTemplates = async (req: Request, res: Response) => {
  const { module } = req.query;

  if (!module) {
    throw new ValidationError('Please specify a module name using ?module=customers');
  }

  const templates = await templateService.getTemplatesByModule(module as string);
  res.json({
    success: true,
    templates,
  });
};

/**
 * Get templates for a specific module
 * GET /api/templates/module/:moduleName
 */
export const getModuleTemplates = async (req: Request, res: Response) => {
  const { moduleName } = req.params;

  const templates = await templateService.getTemplatesByModule(moduleName);

  res.json({
    success: true,
    module: moduleName,
    templates,
  });
};

/**
 * Get a single template by ID
 * GET /api/templates/:id
 */
export const getTemplateById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const template = await templateService.getTemplateById(id);

  if (!template) {
    throw new NotFoundError('Template', id);
  }

  res.json({
    success: true,
    template,
  });
};

/**
 * Update a template
 * PUT /api/templates/:id
 */
export const updateTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { templateName, description, columnConfig, isDefault } = req.body;

  const template = await templateService.updateTemplate(id, {
    templateName,
    description,
    columnConfig,
    isDefault,
  });

  res.json({
    success: true,
    message: 'Template updated successfully',
    template,
  });
};

/**
 * Delete a template (soft delete)
 * DELETE /api/templates/:id
 */
export const deleteTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;

  await templateService.deleteTemplate(id);

  res.json({
    success: true,
    message: 'Template deleted successfully',
  });
};

/**
 * Get available modules for templates
 * GET /api/templates/modules
 */
export const getAvailableModules = async (req: Request, res: Response) => {
  const modules = templateService.getAvailableModules();

  res.json({
    success: true,
    modules,
  });
};

/**
 * Get available columns for a module
 * GET /api/templates/columns/:moduleName
 */
export const getAvailableColumns = async (req: Request, res: Response) => {
  const { moduleName } = req.params;

  const columns = templateService.getAvailableColumns(moduleName);

  if (!columns || columns.length === 0) {
    throw new NotFoundError('Column definitions for module', moduleName);
  }

  res.json({
    success: true,
    module: moduleName,
    columns,
  });
};
