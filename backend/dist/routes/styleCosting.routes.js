"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const styleCosting_controller_1 = require("../controllers/styleCosting.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// ============================================================================
// COST SHEET ROUTES
// ============================================================================
/**
 * @route   POST /api/style-costing
 * @desc    Create a new cost sheet
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 */
router.post('/', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.PRODUCTION_MANAGER, client_1.UserRole.MERCHANDISER), styleCosting_controller_1.createCostSheet);
/**
 * @route   POST /api/style-costing/generate/:styleId
 * @desc    Auto-generate cost sheet from approved CAD data
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 */
router.post('/generate/:styleId', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.PRODUCTION_MANAGER, client_1.UserRole.MERCHANDISER), styleCosting_controller_1.generateCostSheetFromStyle);
/**
 * @route   GET /api/style-costing
 * @desc    Get all cost sheets with filtering and pagination
 * @access  Private
 */
router.get('/', auth_middleware_1.authenticateToken, styleCosting_controller_1.getAllCostSheets);
/**
 * @route   GET /api/style-costing/:id
 * @desc    Get cost sheet by ID
 * @access  Private
 */
router.get('/:id', auth_middleware_1.authenticateToken, styleCosting_controller_1.getCostSheetById);
/**
 * @route   GET /api/style-costing/style/:styleId
 * @desc    Get cost sheet by style ID
 * @access  Private
 */
router.get('/style/:styleId', auth_middleware_1.authenticateToken, styleCosting_controller_1.getCostSheetByStyle);
/**
 * @route   PUT /api/style-costing/:id
 * @desc    Update cost sheet (only if not approved)
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 */
router.put('/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.PRODUCTION_MANAGER, client_1.UserRole.MERCHANDISER), styleCosting_controller_1.updateCostSheet);
/**
 * @route   PATCH /api/style-costing/:id/approve
 * @desc    Approve or reject cost sheet
 * @access  Private (ADMIN, PRODUCTION_MANAGER)
 */
router.patch('/:id/approve', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.PRODUCTION_MANAGER), styleCosting_controller_1.approveCostSheet);
/**
 * @route   DELETE /api/style-costing/:id
 * @desc    Delete cost sheet (only if not approved)
 * @access  Private (ADMIN, PRODUCTION_MANAGER)
 */
router.delete('/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.PRODUCTION_MANAGER), styleCosting_controller_1.deleteCostSheet);
exports.default = router;
