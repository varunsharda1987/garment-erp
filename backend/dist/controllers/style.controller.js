"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveCADPlan = exports.updateCADGrouping = exports.getStyleCADPlanning = exports.publishDraft = exports.deleteDraft = exports.getDraftById = exports.getAllDrafts = exports.createStyleVariants = exports.uploadStyleImage = exports.deleteStyle = exports.updateStyle = exports.getStyleById = exports.getAllStyles = exports.createStyle = void 0;
const style_service_1 = require("../services/style.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../errors");
/**
 * Create new style with components and processes
 * POST /api/styles
 */
const createStyle = async (req, res) => {
    try {
        const userId = req.user?.userId || 'system';
        const style = await style_service_1.styleService.createWithRelations(req.body, userId);
        res.status(201).json({
            data: style,
            message: 'Style created successfully',
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to create style');
    }
};
exports.createStyle = createStyle;
/**
 * Get all styles with pagination and search
 * GET /api/styles
 */
const getAllStyles = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search;
        const stage = req.query.stage;
        const customerName = req.query.customerName;
        const brandName = req.query.brandName;
        const season = req.query.season;
        const status = req.query.status;
        const cadStatus = req.query.cadStatus;
        const result = await style_service_1.styleService.findAllWithFilters({
            page,
            limit,
            search,
            stage,
            customerName,
            brandName,
            season,
            status,
            cadStatus,
        });
        res.status(200).json({
            data: result.data,
            pagination: result.pagination,
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to fetch styles');
    }
};
exports.getAllStyles = getAllStyles;
/**
 * Get style by ID with all related data
 * GET /api/styles/:id
 */
const getStyleById = async (req, res) => {
    try {
        const { id } = req.params;
        const style = await style_service_1.styleService.getFullDetails(id);
        const styleWithComponents = style;
        const styleFabricsFlat = styleWithComponents.style_components?.flatMap((comp) => comp.style_fabrics.map((fab) => ({
            id: fab.id,
            componentId: fab.componentId,
            componentName: comp.componentName,
            genericFabricName: fab.genericFabricName || fab.fabricName,
            fabricFinishType: fab.fabricFinishType,
            estimatedConsumption: fab.quantityNeeded,
            unit: 'METER', // Default unit
            notes: fab.notes,
            hasEmbroidery: fab.hasEmbroidery || false,
            embroideryId: fab.embroideryId,
            embroidery: fab.embroidery,
            usableWidth: fab.usableWidth,
            allowCombinedCutting: fab.allowCombinedCutting !== false,
        }))) || [];
        // Also flatten components for frontend compatibility
        const components = styleWithComponents.style_components?.map((comp) => ({
            id: comp.id,
            componentName: comp.componentName,
            componentType: comp.componentType,
            sortOrder: comp.sortOrder,
        })) || [];
        res.status(200).json({
            data: {
                ...style,
                styleFabricsFlat,
                components,
            },
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to fetch style');
    }
};
exports.getStyleById = getStyleById;
/**
 * Update style
 * PUT /api/styles/:id
 */
const updateStyle = async (req, res) => {
    try {
        const { id } = req.params;
        (0, logger_1.logInfo)('Updating style', { id, bodyKeys: Object.keys(req.body) });
        const style = await style_service_1.styleService.updateWithRelations(id, req.body);
        res.status(200).json({
            data: style,
            message: 'Style updated successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Style update failed', { id: req.params.id, error: error.message, stack: error.stack });
        handleError(res, error, 'Failed to update style');
    }
};
exports.updateStyle = updateStyle;
/**
 * Delete style (soft delete)
 * DELETE /api/styles/:id
 */
const deleteStyle = async (req, res) => {
    try {
        const { id } = req.params;
        await style_service_1.styleService.softDelete(id);
        res.status(200).json({
            message: 'Style deleted successfully',
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to delete style');
    }
};
exports.deleteStyle = deleteStyle;
/**
 * Upload style image
 * POST /api/styles/:id/image
 */
const uploadStyleImage = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'No image file provided',
            });
            return;
        }
        const imageUrl = `/uploads/styles/${req.file.filename}`;
        const style = await style_service_1.styleService.updateImage(id, imageUrl);
        res.status(200).json({
            data: style,
            message: 'Image uploaded successfully',
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to upload image');
    }
};
exports.uploadStyleImage = uploadStyleImage;
/**
 * Create or update style variants
 * POST /api/styles/:id/variants
 */
const createStyleVariants = async (req, res) => {
    try {
        const { id: styleId } = req.params;
        const { variants } = req.body;
        const createdVariants = await style_service_1.styleService.upsertVariants(styleId, variants);
        res.status(201).json({
            data: createdVariants,
            message: `Successfully created/updated ${createdVariants.length} variant(s)`,
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to create variants');
    }
};
exports.createStyleVariants = createStyleVariants;
/**
 * Get all draft styles
 * GET /api/styles/drafts
 */
const getAllDrafts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const result = await style_service_1.styleService.findAllDrafts({ page, limit });
        res.status(200).json({
            data: result.data,
            pagination: result.pagination,
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to fetch drafts');
    }
};
exports.getAllDrafts = getAllDrafts;
/**
 * Get a single draft by ID
 * GET /api/styles/drafts/:id
 */
const getDraftById = async (req, res) => {
    try {
        const { id } = req.params;
        const draft = await style_service_1.styleService.findDraftById(id);
        res.status(200).json({ data: draft });
    }
    catch (error) {
        handleError(res, error, 'Failed to fetch draft');
    }
};
exports.getDraftById = getDraftById;
/**
 * Delete a draft
 * DELETE /api/styles/drafts/:id
 */
const deleteDraft = async (req, res) => {
    try {
        const { id } = req.params;
        // Verify it's a draft before deleting
        await style_service_1.styleService.findDraftById(id);
        await style_service_1.styleService.softDelete(id);
        res.status(200).json({
            message: 'Draft deleted successfully',
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to delete draft');
    }
};
exports.deleteDraft = deleteDraft;
/**
 * Publish a draft (convert to ACTIVE status)
 * POST /api/styles/:id/publish
 */
const publishDraft = async (req, res) => {
    try {
        const { id } = req.params;
        const publishedStyle = await style_service_1.styleService.publishDraft(id);
        res.status(200).json({
            data: publishedStyle,
            message: 'Style published successfully',
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to publish draft');
    }
};
exports.publishDraft = publishDraft;
/**
 * Get CAD planning data for a style
 * GET /api/styles/:id/cad-planning
 */
const getStyleCADPlanning = async (req, res) => {
    try {
        const { id: styleId } = req.params;
        const cadPlanningData = await style_service_1.styleService.getCADPlanning(styleId);
        res.status(200).json({
            data: cadPlanningData,
            message: 'CAD planning data retrieved successfully',
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to retrieve CAD planning data');
    }
};
exports.getStyleCADPlanning = getStyleCADPlanning;
/**
 * Update CAD grouping for style fabrics
 * POST /api/styles/:id/cad-groups
 */
const updateCADGrouping = async (req, res) => {
    try {
        const { id: styleId } = req.params;
        const { fabricGroups } = req.body;
        await style_service_1.styleService.updateCADGrouping(styleId, fabricGroups);
        res.status(200).json({ message: 'CAD grouping updated successfully' });
    }
    catch (error) {
        handleError(res, error, 'Failed to update CAD grouping');
    }
};
exports.updateCADGrouping = updateCADGrouping;
/**
 * Approve CAD plan and link fabrics to selected CAD entries
 * PUT /api/styles/:id/approve-cad
 */
const approveCADPlan = async (req, res) => {
    try {
        const { id: styleId } = req.params;
        const { fabricCADMappings } = req.body;
        const updatedStyle = await style_service_1.styleService.approveCADPlan(styleId, fabricCADMappings);
        res.status(200).json({
            data: updatedStyle,
            message: 'CAD plan approved successfully',
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to approve CAD plan');
    }
};
exports.approveCADPlan = approveCADPlan;
/**
 * Centralized error handler for controller
 */
function handleError(res, error, defaultMessage) {
    if (error instanceof errors_1.ValidationError) {
        res.status(400).json({
            error: 'Validation Error',
            message: error.message,
        });
        return;
    }
    if (error instanceof errors_1.ConflictError) {
        res.status(409).json({
            error: 'Conflict',
            message: error.message,
        });
        return;
    }
    if (error instanceof errors_1.NotFoundError) {
        res.status(404).json({
            error: 'Not Found',
            message: error.message,
        });
        return;
    }
    (0, logger_1.logError)(defaultMessage, error);
    res.status(500).json({
        error: 'Internal Server Error',
        message: defaultMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
}
