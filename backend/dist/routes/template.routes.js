"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Template Routes - Export template management
const express_1 = require("express");
const templateController = __importStar(require("../controllers/template.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
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
exports.default = router;
