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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const bomController = __importStar(require("../controllers/bom.controller"));
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
/**
 * @route   POST /api/bom
 * @desc    Create a new Bill of Materials
 * @access  Admin, Production Manager, Merchandiser
 */
router.post('/', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.PRODUCTION_MANAGER, client_1.UserRole.MERCHANDISER), bomController.createBOM);
/**
 * @route   GET /api/bom
 * @desc    Get all BOMs with filtering and pagination
 * @access  All authenticated users
 * @query   styleId, isActive, approved, page, limit, search
 */
router.get('/', bomController.getAllBOMs);
/**
 * @route   GET /api/bom/:id
 * @desc    Get a single BOM by ID
 * @access  All authenticated users
 */
router.get('/:id', bomController.getBOMById);
/**
 * @route   GET /api/bom/style/:styleId/active
 * @desc    Get active BOM for a style
 * @access  All authenticated users
 */
router.get('/style/:styleId/active', bomController.getActiveBOMByStyle);
/**
 * @route   GET /api/bom/style/:styleId/versions
 * @desc    Get all BOM versions for a style
 * @access  All authenticated users
 */
router.get('/style/:styleId/versions', bomController.getBOMVersionsByStyle);
/**
 * @route   PUT /api/bom/:id
 * @desc    Update a BOM (only if not approved)
 * @access  Admin, Production Manager, Merchandiser
 */
router.put('/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.PRODUCTION_MANAGER, client_1.UserRole.MERCHANDISER), bomController.updateBOM);
/**
 * @route   PATCH /api/bom/:id/approve
 * @desc    Approve or reject a BOM
 * @access  Admin, Production Manager
 */
router.patch('/:id/approve', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.PRODUCTION_MANAGER), bomController.approveBOM);
/**
 * @route   DELETE /api/bom/:id
 * @desc    Delete (deactivate) a BOM
 * @access  Admin, Production Manager
 */
router.delete('/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.PRODUCTION_MANAGER), bomController.deleteBOM);
/**
 * @route   POST /api/bom/:id/calculate
 * @desc    Calculate material requirements for a given order quantity
 * @access  All authenticated users
 */
router.post('/:id/calculate', bomController.calculateMaterialRequirements);
exports.default = router;
