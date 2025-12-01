// Template Controller - Manage export templates
import { Request, Response } from 'express';
import templateService from '../services/template.service';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * Create a new export template
 * POST /api/templates
 */
export const createTemplate = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { moduleName, templateName, description, columnConfig, isDefault } = req.body;

    if (!moduleName || !templateName || !columnConfig) {
      return res.status(400).json({
        error: 'Missing required fields: moduleName, templateName, columnConfig'
      });
    }

    const template = await templateService.createTemplate({
      moduleName,
      templateName,
      description,
      columnConfig,
      isDefault,
      createdById: userId
    });

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      template
    });

  } catch (error: unknown) {
    logError('Create template error:', error);
    res.status(500).json({
      error: 'Failed to create template',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get all templates (optionally filter by module)
 * GET /api/templates?module=customers
 */
export const getTemplates = async (req: Request, res: Response) => {
  try {
    const { module } = req.query;

    if (module) {
      const templates = await templateService.getTemplatesByModule(module as string);
      return res.json({
        success: true,
        templates
      });
    }

    // If no module specified, return error (too broad)
    res.status(400).json({
      error: 'Please specify a module name using ?module=customers'
    });

  } catch (error: unknown) {
    logError('Get templates error:', error);
    res.status(500).json({
      error: 'Failed to retrieve templates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get templates for a specific module
 * GET /api/templates/module/:moduleName
 */
export const getModuleTemplates = async (req: Request, res: Response) => {
  try {
    const { moduleName } = req.params;

    const templates = await templateService.getTemplatesByModule(moduleName);

    res.json({
      success: true,
      module: moduleName,
      templates
    });

  } catch (error: unknown) {
    logError('Get module templates error:', error);
    res.status(500).json({
      error: 'Failed to retrieve templates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get a single template by ID
 * GET /api/templates/:id
 */
export const getTemplateById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const template = await templateService.getTemplateById(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      template
    });

  } catch (error: unknown) {
    logError('Get template error:', error);
    res.status(500).json({
      error: 'Failed to retrieve template',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update a template
 * PUT /api/templates/:id
 */
export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { templateName, description, columnConfig, isDefault } = req.body;

    const template = await templateService.updateTemplate(id, {
      templateName,
      description,
      columnConfig,
      isDefault
    });

    res.json({
      success: true,
      message: 'Template updated successfully',
      template
    });

  } catch (error: unknown) {
    logError('Update template error:', error);
    res.status(500).json({
      error: 'Failed to update template',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Delete a template (soft delete)
 * DELETE /api/templates/:id
 */
export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await templateService.deleteTemplate(id);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error: unknown) {
    logError('Delete template error:', error);
    res.status(500).json({
      error: 'Failed to delete template',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get available modules for templates
 * GET /api/templates/modules
 */
export const getAvailableModules = async (req: Request, res: Response) => {
  try {
    const modules = templateService.getAvailableModules();

    res.json({
      success: true,
      modules
    });

  } catch (error: unknown) {
    logError('Get modules error:', error);
    res.status(500).json({
      error: 'Failed to retrieve modules',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get available columns for a module
 * GET /api/templates/columns/:moduleName
 */
export const getAvailableColumns = async (req: Request, res: Response) => {
  try {
    const { moduleName } = req.params;

    const columns = templateService.getAvailableColumns(moduleName);

    if (!columns || columns.length === 0) {
      return res.status(404).json({
        error: `No column definitions found for module: ${moduleName}`
      });
    }

    res.json({
      success: true,
      module: moduleName,
      columns
    });

  } catch (error: unknown) {
    logError('Get columns error:', error);
    res.status(500).json({
      error: 'Failed to retrieve columns',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
