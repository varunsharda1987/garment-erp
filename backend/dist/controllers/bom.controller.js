"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMaterialRequirements = exports.deleteBOM = exports.approveBOM = exports.updateBOM = exports.getBOMVersionsByStyle = exports.getActiveBOMByStyle = exports.getBOMById = exports.getAllBOMs = exports.createBOM = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const bom_service_1 = require("../services/bom.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../errors");
// ============================================
// VALIDATION SCHEMAS
// ============================================
const BOMItemSchema = zod_1.z.object({
    materialId: zod_1.z.string().uuid('Invalid material ID'),
    quantityPerUnit: zod_1.z.number().positive('Quantity must be positive'),
    unit: zod_1.z.nativeEnum(client_1.Unit),
    wastagePercent: zod_1.z.number().min(0).max(100).default(0),
    costPerUnit: zod_1.z.number().nonnegative('Cost must be non-negative'),
    notes: zod_1.z.string().optional(),
});
const CreateBOMSchema = zod_1.z.object({
    styleId: zod_1.z.string().uuid('Invalid style ID'),
    bomItems: zod_1.z.array(BOMItemSchema).min(1, 'At least one BOM item is required'),
});
const UpdateBOMSchema = zod_1.z.object({
    bomItems: zod_1.z.array(BOMItemSchema).min(1, 'At least one BOM item is required'),
    isActive: zod_1.z.boolean().optional(),
});
const ApproveBOMSchema = zod_1.z.object({
    approved: zod_1.z.boolean(),
});
// ============================================
// CONTROLLER METHODS
// ============================================
/**
 * Create a new Bill of Materials for a style
 * POST /api/bom
 */
const createBOM = async (req, res) => {
    try {
        const validatedData = CreateBOMSchema.parse(req.body);
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated',
            });
        }
        const bom = await bom_service_1.bomService.createWithItems(validatedData, userId);
        res.status(201).json({
            success: true,
            data: bom,
            message: `BOM version ${bom.version} created successfully`,
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to create BOM');
    }
};
exports.createBOM = createBOM;
/**
 * Get all BOMs with optional filtering
 * GET /api/bom
 */
const getAllBOMs = async (req, res) => {
    try {
        const { styleId, isActive, approved, page = '1', limit = '20', search, } = req.query;
        const result = await bom_service_1.bomService.findAllWithFilters({
            page: parseInt(page),
            limit: parseInt(limit),
            search: search,
            styleId: styleId,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
            approved: approved !== undefined ? approved === 'true' : undefined,
        });
        res.json({
            success: true,
            data: result.data,
            pagination: result.pagination,
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to fetch BOMs');
    }
};
exports.getAllBOMs = getAllBOMs;
/**
 * Get a single BOM by ID
 * GET /api/bom/:id
 */
const getBOMById = async (req, res) => {
    try {
        const { id } = req.params;
        const bom = await bom_service_1.bomService.getFullDetails(id);
        res.json({
            success: true,
            data: bom,
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to fetch BOM');
    }
};
exports.getBOMById = getBOMById;
/**
 * Get active BOM for a style
 * GET /api/bom/style/:styleId/active
 */
const getActiveBOMByStyle = async (req, res) => {
    try {
        const { styleId } = req.params;
        const bom = await bom_service_1.bomService.getActiveByStyle(styleId);
        res.json({
            success: true,
            data: bom,
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to fetch active BOM');
    }
};
exports.getActiveBOMByStyle = getActiveBOMByStyle;
/**
 * Get all BOM versions for a style
 * GET /api/bom/style/:styleId/versions
 */
const getBOMVersionsByStyle = async (req, res) => {
    try {
        const { styleId } = req.params;
        const boms = await bom_service_1.bomService.getVersionsByStyle(styleId);
        res.json({
            success: true,
            data: boms,
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to fetch BOM versions');
    }
};
exports.getBOMVersionsByStyle = getBOMVersionsByStyle;
/**
 * Update a BOM (creates a new version)
 * PUT /api/bom/:id
 */
const updateBOM = async (req, res) => {
    try {
        const { id } = req.params;
        const validatedData = UpdateBOMSchema.parse(req.body);
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated',
            });
        }
        const updatedBOM = await bom_service_1.bomService.updateItems(id, validatedData);
        res.json({
            success: true,
            data: updatedBOM,
            message: 'BOM updated successfully',
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to update BOM');
    }
};
exports.updateBOM = updateBOM;
/**
 * Approve or reject a BOM
 * PATCH /api/bom/:id/approve
 */
const approveBOM = async (req, res) => {
    try {
        const { id } = req.params;
        const { approved } = ApproveBOMSchema.parse(req.body);
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated',
            });
        }
        const updatedBOM = await bom_service_1.bomService.approve(id, userId, approved);
        res.json({
            success: true,
            data: updatedBOM,
            message: approved ? 'BOM approved successfully' : 'BOM approval revoked',
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to approve BOM');
    }
};
exports.approveBOM = approveBOM;
/**
 * Delete a BOM (soft delete by deactivating)
 * DELETE /api/bom/:id
 */
const deleteBOM = async (req, res) => {
    try {
        const { id } = req.params;
        await bom_service_1.bomService.deactivate(id);
        res.json({
            success: true,
            message: 'BOM deactivated successfully',
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to delete BOM');
    }
};
exports.deleteBOM = deleteBOM;
/**
 * Calculate material requirements for an order quantity
 * POST /api/bom/:id/calculate
 */
const calculateMaterialRequirements = async (req, res) => {
    try {
        const { id } = req.params;
        const { orderQuantity } = req.body;
        const result = await bom_service_1.bomService.calculateMaterialRequirements(id, orderQuantity);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to calculate material requirements');
    }
};
exports.calculateMaterialRequirements = calculateMaterialRequirements;
/**
 * Centralized error handler for controller
 */
function handleError(res, error, defaultMessage) {
    if (error instanceof zod_1.z.ZodError) {
        res.status(400).json({
            success: false,
            error: 'Validation error',
            details: error.issues,
        });
        return;
    }
    if (error instanceof errors_1.ValidationError) {
        res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: error.message,
        });
        return;
    }
    if (error instanceof errors_1.ConflictError) {
        res.status(409).json({
            success: false,
            error: 'Conflict',
            message: error.message,
        });
        return;
    }
    if (error instanceof errors_1.NotFoundError) {
        res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
        });
        return;
    }
    if (error instanceof errors_1.BusinessError) {
        res.status(400).json({
            success: false,
            error: 'Business Error',
            message: error.message,
        });
        return;
    }
    (0, logger_1.logError)(defaultMessage, error);
    res.status(500).json({
        success: false,
        error: defaultMessage,
        message: error instanceof Error ? error.message : 'Unknown error',
    });
}
