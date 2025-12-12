"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCostSheetFromStyle = exports.deleteCostSheet = exports.approveCostSheet = exports.updateCostSheet = exports.getCostSheetByStyle = exports.getCostSheetById = exports.getAllCostSheets = exports.createCostSheet = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
const FabricDetailSchema = zod_1.z.object({
    fabricName: zod_1.z.string().min(1, 'Fabric name is required'),
    fabricWidth: zod_1.z.number().nonnegative('Fabric width must be non-negative'),
    fabricAverage: zod_1.z.number().nonnegative('Fabric average must be non-negative'),
    fabricRate: zod_1.z.number().nonnegative('Fabric rate must be non-negative'),
    fabricTotal: zod_1.z.number().nonnegative('Fabric total must be non-negative'),
});
const TrimDetailSchema = zod_1.z.object({
    trimName: zod_1.z.string().min(1, 'Trim name is required'),
    trimQuantity: zod_1.z.number().nonnegative('Trim quantity must be non-negative'),
    trimRate: zod_1.z.number().nonnegative('Trim rate must be non-negative'),
    trimTotal: zod_1.z.number().nonnegative('Trim total must be non-negative'),
});
const EmbroideryDetailSchema = zod_1.z.object({
    embroideryName: zod_1.z.string().min(1, 'Embroidery name is required'),
    embroideryAverage: zod_1.z.number().nonnegative('Embroidery average must be non-negative'),
    embroideryRate: zod_1.z.number().nonnegative('Embroidery rate must be non-negative'),
    embroideryTotal: zod_1.z.number().nonnegative('Embroidery total must be non-negative'),
});
const AccessoryDetailSchema = zod_1.z.object({
    accessoryName: zod_1.z.string().min(1, 'Accessory name is required'),
    accessoryQuantity: zod_1.z.number().nonnegative('Accessory quantity must be non-negative'),
    accessoryRate: zod_1.z.number().nonnegative('Accessory rate must be non-negative'),
    accessoryTotal: zod_1.z.number().nonnegative('Accessory total must be non-negative'),
});
const CMTCostsSchema = zod_1.z.object({
    cuttingCost: zod_1.z.number().nonnegative('Cutting cost must be non-negative').default(0),
    stitchingCost: zod_1.z.number().nonnegative('Stitching cost must be non-negative').default(0),
    finishingCost: zod_1.z.number().nonnegative('Finishing cost must be non-negative').default(0),
    buttonAttachmentCost: zod_1.z.number().nonnegative('Button attachment cost must be non-negative').default(0),
    handworkCost: zod_1.z.number().nonnegative('Handwork cost must be non-negative').default(0),
});
const CreateCostSheetSchema = zod_1.z.object({
    styleId: zod_1.z.string().uuid('Invalid style ID'),
    // Basic Information
    numberOfComponents: zod_1.z.number().int().positive().optional(),
    category: zod_1.z.string().optional(),
    subCategory: zod_1.z.string().optional(),
    // Dynamic arrays
    fabricDetails: zod_1.z.array(FabricDetailSchema).min(1, 'At least one fabric is required'),
    trimsDetails: zod_1.z.array(TrimDetailSchema).min(1, 'At least one trim is required'),
    cmtCosts: CMTCostsSchema,
    embroideryDetails: zod_1.z.array(EmbroideryDetailSchema).default([]),
    accessoriesDetails: zod_1.z.array(AccessoryDetailSchema).default([]),
    // Value Loss & Markup
    valueLossPercent: zod_1.z.number().min(0).max(100, 'Value loss must be between 0-100%').default(2),
    markupPercent: zod_1.z.number().min(0).max(100, 'Markup must be between 0-100%').default(15),
    // Additional fields
    notes: zod_1.z.string().optional(),
});
const UpdateCostSheetSchema = CreateCostSheetSchema.partial().omit({ styleId: true });
// ============================================================================
// CONTROLLER FUNCTIONS
// ============================================================================
/**
 * Create a new Cost Sheet for a style
 * POST /api/style-costing
 */
const createCostSheet = async (req, res) => {
    try {
        const validatedData = CreateCostSheetSchema.parse(req.body);
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // Check if style exists
        const style = await prisma.styles.findUnique({
            where: { id: validatedData.styleId },
        });
        if (!style) {
            res.status(404).json({ error: 'Style not found' });
            return;
        }
        // Check if cost sheet already exists for this style
        const existingCostSheet = await prisma.style_costing.findUnique({
            where: { styleId: validatedData.styleId },
        });
        if (existingCostSheet) {
            res.status(400).json({
                error: 'Cost sheet already exists for this style',
                message: 'Use update endpoint to modify existing cost sheet'
            });
            return;
        }
        // Calculate totals from arrays
        const fabricTotal = validatedData.fabricDetails.reduce((sum, f) => sum + f.fabricTotal, 0);
        const trimsTotal = validatedData.trimsDetails.reduce((sum, t) => sum + t.trimTotal, 0);
        const cmtTotal = Object.values(validatedData.cmtCosts).reduce((sum, c) => sum + c, 0);
        const embroideryTotal = validatedData.embroideryDetails.reduce((sum, e) => sum + e.embroideryTotal, 0);
        const accessoriesTotal = validatedData.accessoriesDetails.reduce((sum, a) => sum + a.accessoryTotal, 0);
        // Calculate subtotal (before value loss and markup)
        const subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal + accessoriesTotal;
        // Calculate value loss
        const valueLossAmount = (subtotal * validatedData.valueLossPercent) / 100;
        const totalAfterValueLoss = subtotal + valueLossAmount;
        // Calculate markup
        const markupAmount = (totalAfterValueLoss * validatedData.markupPercent) / 100;
        const totalProductCost = totalAfterValueLoss + markupAmount;
        // Generate unique ID for cost sheet
        const costSheetId = `CS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        // Create cost sheet
        const costSheet = await prisma.style_costing.create({
            data: {
                id: costSheetId,
                styleId: validatedData.styleId,
                // Basic Information
                numberOfComponents: validatedData.numberOfComponents,
                category: validatedData.category,
                subCategory: validatedData.subCategory,
                // Fabric Details
                fabricDetails: JSON.parse(JSON.stringify(validatedData.fabricDetails)),
                fabricTotal,
                // Trims Details
                trimsDetails: JSON.parse(JSON.stringify(validatedData.trimsDetails)),
                trimsTotal,
                // CMT Costs
                cuttingCost: validatedData.cmtCosts.cuttingCost,
                stitchingCost: validatedData.cmtCosts.stitchingCost,
                finishingCost: validatedData.cmtCosts.finishingCost,
                buttonAttachmentCost: validatedData.cmtCosts.buttonAttachmentCost,
                handworkCmtCost: validatedData.cmtCosts.handworkCost,
                cmtTotal,
                // Embroidery Details
                embroideryDetails: JSON.parse(JSON.stringify(validatedData.embroideryDetails)),
                embroideryTotal,
                // Accessories Details
                accessoriesDetails: JSON.parse(JSON.stringify(validatedData.accessoriesDetails)),
                accessoriesTotal,
                // Value Loss
                valueLossPercent: validatedData.valueLossPercent,
                valueLossAmount,
                // Markup
                markupPercent: validatedData.markupPercent,
                markupAmount,
                // Calculated Totals
                subtotal,
                totalProductCost,
                // Additional
                notes: validatedData.notes,
                createdById: userId,
            },
            include: {
                styles: {
                    select: {
                        id: true,
                        styleCode: true,
                        styleName: true,
                        categoryId: true,
                    },
                },
                users_style_costing_createdByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });
        res.status(201).json({
            success: true,
            data: costSheet,
            message: 'Cost sheet created successfully',
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Validation failed',
                details: error.issues,
            });
            return;
        }
        (0, logger_1.logError)('Error creating cost sheet:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.createCostSheet = createCostSheet;
/**
 * Get all cost sheets with filtering and pagination
 * GET /api/style-costing
 */
const getAllCostSheets = async (req, res) => {
    try {
        const { page = '1', limit = '10', search = '', approved = 'all', } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        // Search by style code or style name
        if (search) {
            where.styles = {
                OR: [
                    { styleCode: { contains: search, mode: 'insensitive' } },
                    { styleName: { contains: search, mode: 'insensitive' } },
                ],
            };
        }
        // Filter by approval status
        if (approved !== 'all') {
            where.isApproved = approved === 'true';
        }
        // Get total count
        const total = await prisma.style_costing.count({ where });
        // Get cost sheets
        const costSheets = await prisma.style_costing.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { createdAt: 'desc' },
            include: {
                styles: {
                    select: {
                        id: true,
                        styleCode: true,
                        styleName: true,
                        categoryId: true,
                    },
                },
                users_style_costing_createdByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                users_style_costing_approvedByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
        res.json({
            success: true,
            data: costSheets,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        (0, logger_1.logError)('Error fetching cost sheets:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getAllCostSheets = getAllCostSheets;
/**
 * Get cost sheet by ID
 * GET /api/style-costing/:id
 */
const getCostSheetById = async (req, res) => {
    try {
        const { id } = req.params;
        const costSheet = await prisma.style_costing.findUnique({
            where: { id },
            include: {
                styles: {
                    select: {
                        id: true,
                        styleCode: true,
                        styleName: true,
                        categoryId: true,
                    },
                },
                users_style_costing_createdByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                users_style_costing_approvedByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });
        if (!costSheet) {
            res.status(404).json({ error: 'Cost sheet not found' });
            return;
        }
        res.json({
            success: true,
            data: costSheet,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Error fetching cost sheet:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getCostSheetById = getCostSheetById;
/**
 * Get cost sheet by style ID
 * GET /api/style-costing/style/:styleId
 */
const getCostSheetByStyle = async (req, res) => {
    try {
        const { styleId } = req.params;
        const costSheet = await prisma.style_costing.findUnique({
            where: { styleId },
            include: {
                styles: {
                    select: {
                        id: true,
                        styleCode: true,
                        styleName: true,
                        categoryId: true,
                    },
                },
                users_style_costing_createdByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                users_style_costing_approvedByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });
        if (!costSheet) {
            res.status(404).json({ error: 'Cost sheet not found for this style' });
            return;
        }
        res.json({
            success: true,
            data: costSheet,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Error fetching cost sheet by style:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getCostSheetByStyle = getCostSheetByStyle;
/**
 * Update cost sheet
 * PUT /api/style-costing/:id
 * Note: Cannot update approved cost sheets
 */
const updateCostSheet = async (req, res) => {
    try {
        const { id } = req.params;
        const validatedData = UpdateCostSheetSchema.parse(req.body);
        // Check if cost sheet exists
        const existingCostSheet = await prisma.style_costing.findUnique({
            where: { id },
        });
        if (!existingCostSheet) {
            res.status(404).json({ error: 'Cost sheet not found' });
            return;
        }
        // Cannot update approved cost sheets
        if (existingCostSheet.isApproved) {
            res.status(400).json({
                error: 'Cannot update approved cost sheet',
                message: 'Please create a new version if changes are needed'
            });
            return;
        }
        // Get current or updated values - use JSON parse/stringify for safe type conversion
        const fabricDetails = validatedData.fabricDetails || existingCostSheet.fabricDetails || [];
        const trimsDetails = validatedData.trimsDetails || existingCostSheet.trimsDetails || [];
        const cmtCosts = validatedData.cmtCosts || {
            cuttingCost: Number(existingCostSheet.cuttingCost),
            stitchingCost: Number(existingCostSheet.stitchingCost),
            finishingCost: Number(existingCostSheet.finishingCost),
            buttonAttachmentCost: Number(existingCostSheet.buttonAttachmentCost),
            handworkCost: Number(existingCostSheet.handworkCmtCost),
        };
        const embroideryDetails = validatedData.embroideryDetails || existingCostSheet.embroideryDetails || [];
        const accessoriesDetails = validatedData.accessoriesDetails || existingCostSheet.accessoriesDetails || [];
        const valueLossPercent = validatedData.valueLossPercent ?? Number(existingCostSheet.valueLossPercent);
        const markupPercent = validatedData.markupPercent ?? Number(existingCostSheet.markupPercent);
        // Recalculate totals
        const fabricTotal = fabricDetails.reduce((sum, f) => sum + (f.fabricTotal || 0), 0);
        const trimsTotal = trimsDetails.reduce((sum, t) => sum + (t.trimTotal || 0), 0);
        const cmtTotal = Object.values(cmtCosts).reduce((sum, c) => sum + (c || 0), 0);
        const embroideryTotal = embroideryDetails.reduce((sum, e) => sum + (e.embroideryTotal || 0), 0);
        const accessoriesTotal = accessoriesDetails.reduce((sum, a) => sum + (a.accessoryTotal || 0), 0);
        const subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal + accessoriesTotal;
        const valueLossAmount = (subtotal * valueLossPercent) / 100;
        const totalAfterValueLoss = subtotal + valueLossAmount;
        const markupAmount = (totalAfterValueLoss * markupPercent) / 100;
        const totalProductCost = totalAfterValueLoss + markupAmount;
        // Build update data
        const updateData = {
            ...(validatedData.numberOfComponents !== undefined && { numberOfComponents: validatedData.numberOfComponents }),
            ...(validatedData.category !== undefined && { category: validatedData.category }),
            ...(validatedData.subCategory !== undefined && { subCategory: validatedData.subCategory }),
            ...(validatedData.fabricDetails && { fabricDetails: JSON.parse(JSON.stringify(validatedData.fabricDetails)) }),
            fabricTotal,
            ...(validatedData.trimsDetails && { trimsDetails: JSON.parse(JSON.stringify(validatedData.trimsDetails)) }),
            trimsTotal,
            ...(validatedData.cmtCosts && {
                cuttingCost: cmtCosts.cuttingCost,
                stitchingCost: cmtCosts.stitchingCost,
                finishingCost: cmtCosts.finishingCost,
                buttonAttachmentCost: cmtCosts.buttonAttachmentCost,
                handworkCmtCost: cmtCosts.handworkCost,
            }),
            cmtTotal,
            ...(validatedData.embroideryDetails && { embroideryDetails: JSON.parse(JSON.stringify(validatedData.embroideryDetails)) }),
            embroideryTotal,
            ...(validatedData.accessoriesDetails && { accessoriesDetails: JSON.parse(JSON.stringify(validatedData.accessoriesDetails)) }),
            accessoriesTotal,
            ...(validatedData.valueLossPercent !== undefined && { valueLossPercent }),
            valueLossAmount,
            ...(validatedData.markupPercent !== undefined && { markupPercent }),
            markupAmount,
            subtotal,
            totalProductCost,
            ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
        };
        const updatedCostSheet = await prisma.style_costing.update({
            where: { id },
            data: updateData,
            include: {
                styles: {
                    select: {
                        id: true,
                        styleCode: true,
                        styleName: true,
                        categoryId: true,
                    },
                },
                users_style_costing_createdByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });
        res.json({
            success: true,
            data: updatedCostSheet,
            message: 'Cost sheet updated successfully',
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Validation failed',
                details: error.issues,
            });
            return;
        }
        (0, logger_1.logError)('Error updating cost sheet:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.updateCostSheet = updateCostSheet;
/**
 * Approve or reject cost sheet
 * PATCH /api/style-costing/:id/approve
 */
const approveCostSheet = async (req, res) => {
    try {
        const { id } = req.params;
        const { approved } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        if (typeof approved !== 'boolean') {
            res.status(400).json({ error: 'Approved field must be a boolean' });
            return;
        }
        const costSheet = await prisma.style_costing.findUnique({
            where: { id },
        });
        if (!costSheet) {
            res.status(404).json({ error: 'Cost sheet not found' });
            return;
        }
        const updatedCostSheet = await prisma.style_costing.update({
            where: { id },
            data: {
                isApproved: approved,
                approvedById: approved ? userId : null,
                approvedAt: approved ? new Date() : null,
            },
            include: {
                styles: {
                    select: {
                        id: true,
                        styleCode: true,
                        styleName: true,
                        categoryId: true,
                    },
                },
                users_style_costing_createdByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                users_style_costing_approvedByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });
        res.json({
            success: true,
            data: updatedCostSheet,
            message: approved ? 'Cost sheet approved successfully' : 'Cost sheet approval revoked',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Error approving cost sheet:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.approveCostSheet = approveCostSheet;
/**
 * Delete cost sheet (soft delete by setting as inactive)
 * DELETE /api/style-costing/:id
 * Note: Cannot delete approved cost sheets
 */
const deleteCostSheet = async (req, res) => {
    try {
        const { id } = req.params;
        const costSheet = await prisma.style_costing.findUnique({
            where: { id },
        });
        if (!costSheet) {
            res.status(404).json({ error: 'Cost sheet not found' });
            return;
        }
        // Cannot delete approved cost sheets
        if (costSheet.isApproved) {
            res.status(400).json({
                error: 'Cannot delete approved cost sheet',
                message: 'Approved cost sheets cannot be deleted for audit purposes'
            });
            return;
        }
        // Soft delete by removing the record (or you could add an isActive field)
        await prisma.style_costing.delete({
            where: { id },
        });
        res.json({
            success: true,
            message: 'Cost sheet deleted successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Error deleting cost sheet:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.deleteCostSheet = deleteCostSheet;
/**
 * Auto-generate cost sheet from approved CAD data
 * POST /api/style-costing/generate/:styleId
 */
const generateCostSheetFromStyle = async (req, res) => {
    try {
        const { styleId } = req.params;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // Get style with all related data
        const style = await prisma.styles.findUnique({
            where: { id: styleId },
            include: {
                style_components: {
                    include: {
                        style_fabrics: {
                            include: {
                                fabric: true,
                                fabricCAD: true, // Must have approved CAD
                            },
                        },
                    },
                },
                style_material_bom: {
                    include: {
                        lace_master: true,
                        button_master: true,
                        thread_master: true,
                        zipper_master: true,
                        elastic_master: true,
                        label_master: true,
                        packaging_master: true,
                    },
                },
                style_processes: true,
            },
        });
        if (!style) {
            res.status(404).json({ error: 'Style not found' });
            return;
        }
        // Validate CAD is approved
        if (style.cadStatus !== 'APPROVED') {
            res.status(400).json({
                error: 'CAD not approved',
                message: 'CAD planning must be approved before generating cost sheet',
                currentStatus: style.cadStatus,
            });
            return;
        }
        // Check if cost sheet already exists
        const existingCostSheet = await prisma.style_costing.findUnique({
            where: { styleId },
        });
        if (existingCostSheet) {
            res.status(409).json({
                error: 'Cost sheet already exists',
                message: 'A cost sheet already exists for this style. Use update endpoint to modify it.',
                costSheetId: existingCostSheet.id,
            });
            return;
        }
        // Calculate fabric costs from approved CAD
        let totalFabricCost = 0;
        const fabricDetails = [];
        for (const component of style.style_components) {
            for (const styleFabric of component.style_fabrics) {
                if (!styleFabric.fabricCADId) {
                    (0, logger_1.logWarn)(`Style fabric ${styleFabric.id} missing CAD assignment`);
                    continue;
                }
                const cad = styleFabric.fabricCAD;
                if (!cad)
                    continue;
                const fabricCost = parseFloat(cad.cadMeters?.toString() || '0') * parseFloat(styleFabric.unitPrice?.toString() || '0');
                fabricDetails.push({
                    fabricName: styleFabric.fabric?.fabricName || styleFabric.fabricName || 'Unknown',
                    fabricWidth: parseFloat(cad.cutableWidth.toString()),
                    fabricAverage: parseFloat(cad.cadMeters?.toString() || '0'),
                    fabricRate: parseFloat(styleFabric.unitPrice?.toString() || '0'),
                    fabricTotal: fabricCost,
                });
                totalFabricCost += fabricCost;
            }
        }
        // Calculate material costs from BOM
        let totalTrimsCost = 0;
        let totalAccessoriesCost = 0;
        const trimsDetails = [];
        const accessoriesDetails = [];
        for (const bom of style.style_material_bom) {
            const quantity = parseFloat(bom.quantityPerGarment.toString());
            const unitPrice = parseFloat(bom.unitPrice?.toString() || '0');
            const total = quantity * unitPrice;
            // Get material name from appropriate master table
            let materialName = 'Unknown';
            if (bom.lace_master)
                materialName = bom.lace_master.laceName;
            else if (bom.button_master)
                materialName = bom.button_master.buttonName;
            else if (bom.thread_master)
                materialName = bom.thread_master.threadName;
            else if (bom.zipper_master)
                materialName = bom.zipper_master.zipperName;
            else if (bom.elastic_master)
                materialName = bom.elastic_master.elasticName;
            else if (bom.label_master)
                materialName = bom.label_master.labelName;
            else if (bom.packaging_master)
                materialName = bom.packaging_master.packagingName;
            const detail = {
                name: materialName,
                quantity,
                rate: unitPrice,
                total,
            };
            if (bom.usageCategory === 'GARMENT_TRIM') {
                trimsDetails.push({
                    trimName: detail.name,
                    trimQuantity: detail.quantity,
                    trimRate: detail.rate,
                    trimTotal: detail.total,
                });
                totalTrimsCost += total;
            }
            else if (bom.usageCategory === 'PACKAGING') {
                accessoriesDetails.push({
                    accessoryName: detail.name,
                    accessoryQuantity: detail.quantity,
                    accessoryRate: detail.rate,
                    accessoryTotal: detail.total,
                });
                totalAccessoriesCost += total;
            }
            // VALUE_ADDITION materials go to embroidery or other categories
        }
        // Calculate process costs
        let totalProcessingCost = 0;
        for (const process of style.style_processes) {
            if (process.estimatedCost) {
                totalProcessingCost += parseFloat(process.estimatedCost.toString());
            }
        }
        // Create cost sheet with auto-calculated values
        const costSheet = await prisma.style_costing.create({
            data: {
                id: `CS-${style.styleCode}-${Date.now()}`,
                styleId,
                createdById: userId,
                // Material Costs
                fabricCost: totalFabricCost,
                trimsCost: totalTrimsCost,
                accessoriesCost: totalAccessoriesCost,
                totalMaterialCost: totalFabricCost + totalTrimsCost + totalAccessoriesCost,
                // Processing Costs (from style_processes)
                totalProcessingCost,
                // Production Costs (user fills these)
                cuttingCost: 0,
                stitchingCost: 0,
                finishingCost: 0,
                checkingCost: 0,
                buttonAttachmentCost: 0,
                handworkCmtCost: 0,
                cmtCost: 0,
                totalProductionCost: 0,
                // Overheads (user fills these)
                adminOverhead: 0,
                factoryOverhead: 0,
                transportCost: 0,
                otherOverheads: 0,
                // JSON details for compatibility
                fabricDetails: JSON.parse(JSON.stringify(fabricDetails)),
                trimsDetails: JSON.parse(JSON.stringify(trimsDetails)),
                accessoriesDetails: JSON.parse(JSON.stringify(accessoriesDetails)),
                // Totals
                fabricTotal: totalFabricCost,
                trimsTotal: totalTrimsCost,
                accessoriesTotal: totalAccessoriesCost,
                // Value Loss & Markup (defaults)
                valueLossPercent: 2,
                valueLossAmount: 0,
                markupPercent: 15,
                markupAmount: 0,
                // Final calculations (will be zero until user fills production costs)
                subtotal: totalFabricCost + totalTrimsCost + totalAccessoriesCost + totalProcessingCost,
                totalProductCost: 0,
                totalCostPerPiece: 0,
                sellingPricePerPiece: 0,
                profitMargin: 0,
                profitAmount: 0,
                isApproved: false,
            },
        });
        (0, logger_1.logInfo)(`Cost sheet auto-generated for style ${style.styleCode}`, {
            costSheetId: costSheet.id,
            fabricCost: totalFabricCost,
            trimsCost: totalTrimsCost,
            accessoriesCost: totalAccessoriesCost,
            processingCost: totalProcessingCost,
        });
        res.status(201).json({
            success: true,
            data: costSheet,
            message: 'Cost sheet generated successfully. Please review and fill in production costs.',
            summary: {
                autoCalculated: {
                    fabricCost: totalFabricCost,
                    trimsCost: totalTrimsCost,
                    accessoriesCost: totalAccessoriesCost,
                    processingCost: totalProcessingCost,
                    total: totalFabricCost + totalTrimsCost + totalAccessoriesCost + totalProcessingCost,
                },
                needsUserInput: [
                    'Cutting Cost',
                    'Stitching Cost',
                    'Finishing Cost',
                    'Transportation Cost',
                    'Washing Cost (if applicable)',
                    'Overheads',
                    'Markup %',
                ],
            },
        });
    }
    catch (error) {
        (0, logger_1.logError)('Error generating cost sheet:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.generateCostSheetFromStyle = generateCostSheetFromStyle;
