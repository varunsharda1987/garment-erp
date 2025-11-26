"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableColumns = exports.getAvailableModules = exports.deleteTemplate = exports.updateTemplate = exports.getTemplateById = exports.getModuleTemplates = exports.getTemplates = exports.createTemplate = void 0;
const template_service_1 = __importDefault(require("../services/template.service"));
const logger_1 = require("../utils/logger");
/**
 * Create a new export template
 * POST /api/templates
 */
const createTemplate = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { moduleName, templateName, description, columnConfig, isDefault } = req.body;
        if (!moduleName || !templateName || !columnConfig) {
            return res.status(400).json({
                error: 'Missing required fields: moduleName, templateName, columnConfig'
            });
        }
        const template = await template_service_1.default.createTemplate({
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
    }
    catch (error) {
        (0, logger_1.logError)('Create template error:', error);
        res.status(500).json({
            error: 'Failed to create template',
            message: error.message
        });
    }
};
exports.createTemplate = createTemplate;
/**
 * Get all templates (optionally filter by module)
 * GET /api/templates?module=customers
 */
const getTemplates = async (req, res) => {
    try {
        const { module } = req.query;
        if (module) {
            const templates = await template_service_1.default.getTemplatesByModule(module);
            return res.json({
                success: true,
                templates
            });
        }
        // If no module specified, return error (too broad)
        res.status(400).json({
            error: 'Please specify a module name using ?module=customers'
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get templates error:', error);
        res.status(500).json({
            error: 'Failed to retrieve templates',
            message: error.message
        });
    }
};
exports.getTemplates = getTemplates;
/**
 * Get templates for a specific module
 * GET /api/templates/module/:moduleName
 */
const getModuleTemplates = async (req, res) => {
    try {
        const { moduleName } = req.params;
        const templates = await template_service_1.default.getTemplatesByModule(moduleName);
        res.json({
            success: true,
            module: moduleName,
            templates
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get module templates error:', error);
        res.status(500).json({
            error: 'Failed to retrieve templates',
            message: error.message
        });
    }
};
exports.getModuleTemplates = getModuleTemplates;
/**
 * Get a single template by ID
 * GET /api/templates/:id
 */
const getTemplateById = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await template_service_1.default.getTemplateById(id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.json({
            success: true,
            template
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get template error:', error);
        res.status(500).json({
            error: 'Failed to retrieve template',
            message: error.message
        });
    }
};
exports.getTemplateById = getTemplateById;
/**
 * Update a template
 * PUT /api/templates/:id
 */
const updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { templateName, description, columnConfig, isDefault } = req.body;
        const template = await template_service_1.default.updateTemplate(id, {
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
    }
    catch (error) {
        (0, logger_1.logError)('Update template error:', error);
        res.status(500).json({
            error: 'Failed to update template',
            message: error.message
        });
    }
};
exports.updateTemplate = updateTemplate;
/**
 * Delete a template (soft delete)
 * DELETE /api/templates/:id
 */
const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        await template_service_1.default.deleteTemplate(id);
        res.json({
            success: true,
            message: 'Template deleted successfully'
        });
    }
    catch (error) {
        (0, logger_1.logError)('Delete template error:', error);
        res.status(500).json({
            error: 'Failed to delete template',
            message: error.message
        });
    }
};
exports.deleteTemplate = deleteTemplate;
/**
 * Get available modules for templates
 * GET /api/templates/modules
 */
const getAvailableModules = async (req, res) => {
    try {
        const modules = template_service_1.default.getAvailableModules();
        res.json({
            success: true,
            modules
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get modules error:', error);
        res.status(500).json({
            error: 'Failed to retrieve modules',
            message: error.message
        });
    }
};
exports.getAvailableModules = getAvailableModules;
/**
 * Get available columns for a module
 * GET /api/templates/columns/:moduleName
 */
const getAvailableColumns = async (req, res) => {
    try {
        const { moduleName } = req.params;
        const columns = template_service_1.default.getAvailableColumns(moduleName);
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
    }
    catch (error) {
        (0, logger_1.logError)('Get columns error:', error);
        res.status(500).json({
            error: 'Failed to retrieve columns',
            message: error.message
        });
    }
};
exports.getAvailableColumns = getAvailableColumns;
