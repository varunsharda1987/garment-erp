"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Style Master routes
const express_1 = require("express");
const style_controller_1 = require("../controllers/style.controller");
const styleComponent_controller_1 = require("../controllers/styleComponent.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const style_schema_1 = require("../schemas/style.schema");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
// ============================================
// STYLE ROUTES
// ============================================
/**
 * @route   POST /api/styles
 * @desc    Create new style
 * @access  Protected - Admin, Merchandiser
 */
router.post('/', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), (0, validation_middleware_1.validateBody)(style_schema_1.createStyleSchema), style_controller_1.createStyle);
/**
 * @route   GET /api/styles/drafts
 * @desc    Get all draft styles
 * @access  Protected - All authenticated users
 */
router.get('/drafts', style_controller_1.getAllDrafts);
/**
 * @route   GET /api/styles/drafts/:id
 * @desc    Get specific draft by ID
 * @access  Protected - All authenticated users
 */
router.get('/drafts/:id', style_controller_1.getDraftById);
/**
 * @route   DELETE /api/styles/drafts/:id
 * @desc    Delete a draft
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/drafts/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), style_controller_1.deleteDraft);
/**
 * @route   GET /api/styles
 * @desc    Get all styles (paginated, searchable, filterable by stage)
 * @access  Protected - All authenticated users
 */
router.get('/', (0, validation_middleware_1.validateQuery)(style_schema_1.styleQuerySchema), style_controller_1.getAllStyles);
/**
 * @route   GET /api/styles/:id
 * @desc    Get style by ID with all related data
 * @access  Protected - All authenticated users
 */
router.get('/:id', (0, validation_middleware_1.validateParams)(style_schema_1.styleIdParamSchema), style_controller_1.getStyleById);
/**
 * @route   PUT /api/styles/:id
 * @desc    Update style
 * @access  Protected - Admin, Merchandiser
 */
router.put('/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), (0, validation_middleware_1.validateParams)(style_schema_1.styleIdParamSchema), (0, validation_middleware_1.validateBody)(style_schema_1.updateStyleSchema), style_controller_1.updateStyle);
/**
 * @route   DELETE /api/styles/:id
 * @desc    Delete (deactivate) style
 * @access  Protected - Admin only
 */
router.delete('/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN), (0, validation_middleware_1.validateParams)(style_schema_1.styleIdParamSchema), style_controller_1.deleteStyle);
/**
 * @route   POST /api/styles/:id/image
 * @desc    Upload style image
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:id/image', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), upload_middleware_1.uploadStyleImage, style_controller_1.uploadStyleImage);
/**
 * @route   POST /api/styles/:id/variants
 * @desc    Create or update style variants with SKUs
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:id/variants', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), style_controller_1.createStyleVariants);
/**
 * @route   POST /api/styles/:id/publish
 * @desc    Publish a draft style (convert to ACTIVE status)
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:id/publish', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), style_controller_1.publishDraft);
// ============================================
// CAD PLANNING ROUTES
// ============================================
/**
 * @route   GET /api/styles/:id/cad-planning
 * @desc    Get CAD planning data for a style (grouped fabrics)
 * @access  Protected - All authenticated users
 */
router.get('/:id/cad-planning', style_controller_1.getStyleCADPlanning);
/**
 * @route   POST /api/styles/:id/cad-groups
 * @desc    Update CAD grouping for style fabrics
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:id/cad-groups', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), style_controller_1.updateCADGrouping);
/**
 * @route   PUT /api/styles/:id/approve-cad
 * @desc    Approve CAD plan and link fabrics to selected CAD entries
 * @access  Protected - Admin, Merchandiser
 */
router.put('/:id/approve-cad', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), style_controller_1.approveCADPlan);
/**
 * @route   PUT /api/styles/:id/production-stage
 * @desc    Update production stage for a style
 * @access  Protected - Admin, Production Manager, Merchandiser
 */
router.put('/:id/production-stage', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.PRODUCTION_MANAGER, client_1.UserRole.MERCHANDISER));
// ============================================
// COMPONENT ROUTES
// ============================================
/**
 * @route   POST /api/styles/:styleId/components
 * @desc    Add component to style
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:styleId/components', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.createComponent);
/**
 * @route   PUT /api/components/:id
 * @desc    Update component
 * @access  Protected - Admin, Merchandiser
 */
router.put('/components/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.updateComponent);
/**
 * @route   DELETE /api/components/:id
 * @desc    Delete component
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/components/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.deleteComponent);
// ============================================
// FABRIC ROUTES
// ============================================
/**
 * @route   POST /api/components/:componentId/fabrics
 * @desc    Add fabric to component
 * @access  Protected - Admin, Merchandiser
 */
router.post('/components/:componentId/fabrics', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.createFabric);
/**
 * @route   PUT /api/fabrics/:id
 * @desc    Update fabric (including CAD averages)
 * @access  Protected - Admin, Merchandiser
 */
router.put('/fabrics/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.updateFabric);
/**
 * @route   DELETE /api/fabrics/:id
 * @desc    Delete fabric
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/fabrics/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.deleteFabric);
// ============================================
// ACCESSORY ROUTES
// ============================================
/**
 * @route   POST /api/components/:componentId/accessories
 * @desc    Add accessory to component
 * @access  Protected - Admin, Merchandiser
 */
router.post('/components/:componentId/accessories', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.createAccessory);
/**
 * @route   PUT /api/accessories/:id
 * @desc    Update accessory
 * @access  Protected - Admin, Merchandiser
 */
router.put('/accessories/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.updateAccessory);
/**
 * @route   DELETE /api/accessories/:id
 * @desc    Delete accessory
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/accessories/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.deleteAccessory);
// ============================================
// PROCESS ROUTES
// ============================================
/**
 * @route   POST /api/styles/:styleId/processes
 * @desc    Add process to style
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:styleId/processes', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.createProcess);
/**
 * @route   PUT /api/processes/:id
 * @desc    Update process
 * @access  Protected - Admin, Merchandiser
 */
router.put('/processes/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.updateProcess);
/**
 * @route   DELETE /api/processes/:id
 * @desc    Delete process
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/processes/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.MERCHANDISER), styleComponent_controller_1.deleteProcess);
// ============================================
// COSTING ROUTES
// ============================================
// Note: Costing routes have been moved to /api/style-costing
// See styleCosting.routes.ts for cost sheet management
exports.default = router;
