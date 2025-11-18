// Template Routes - Export template management
import { Router } from 'express';
import * as templateController from '../controllers/template.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/templates
 * @desc    Create a new export template
 * @access  Private (Admin)
 * @body    { moduleName, templateName, description?, columnConfig, isDefault? }
 */
router.post('/', templateController.createTemplate);

/**
 * @route   GET /api/templates?module=customers
 * @desc    Get all templates for a module (via query param)
 * @access  Private
 */
router.get('/', templateController.getTemplates);

/**
 * @route   GET /api/templates/modules
 * @desc    Get list of available modules
 * @access  Private
 */
router.get('/modules', templateController.getAvailableModules);

/**
 * @route   GET /api/templates/columns/:moduleName
 * @desc    Get available columns for a module
 * @access  Private
 */
router.get('/columns/:moduleName', templateController.getAvailableColumns);

/**
 * @route   GET /api/templates/module/:moduleName
 * @desc    Get all templates for a specific module (via path param)
 * @access  Private
 */
router.get('/module/:moduleName', templateController.getModuleTemplates);

/**
 * @route   GET /api/templates/:id
 * @desc    Get a single template by ID
 * @access  Private
 */
router.get('/:id', templateController.getTemplateById);

/**
 * @route   PUT /api/templates/:id
 * @desc    Update a template
 * @access  Private (Admin)
 * @body    { templateName?, description?, columnConfig?, isDefault? }
 */
router.put('/:id', templateController.updateTemplate);

/**
 * @route   DELETE /api/templates/:id
 * @desc    Delete a template (soft delete)
 * @access  Private (Admin)
 */
router.delete('/:id', templateController.deleteTemplate);

export default router;
