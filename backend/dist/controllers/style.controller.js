"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveCADPlan = exports.updateCADGrouping = exports.getStyleCADPlanning = exports.publishDraft = exports.deleteDraft = exports.getDraftById = exports.getAllDrafts = exports.createStyleVariants = exports.uploadStyleImage = exports.deleteStyle = exports.updateStyle = exports.getStyleById = exports.getAllStyles = exports.createStyle = void 0;
const database_1 = __importDefault(require("../config/database"));
const crypto_1 = require("crypto");
const logger_1 = require("../utils/logger");
const sku_generator_1 = require("../utils/sku-generator");
/**
 * Create new style with components and processes
 * POST /api/styles
 * Updated to include UUIDs for all child records
 */
const createStyle = async (req, res) => {
    (0, logger_1.logDebug)('🔥🔥🔥 CREATE STYLE ENDPOINT HIT 🔥🔥🔥');
    (0, logger_1.logDebug)('Request method:', req.method);
    (0, logger_1.logDebug)('Request URL:', req.url);
    (0, logger_1.logDebug)('Request headers:', req.headers);
    try {
        (0, logger_1.logDebug)('=== CREATE STYLE REQUEST ===');
        (0, logger_1.logDebug)('Request body:', JSON.stringify(req.body, null, 2));
        const { styleCode, styleName, customerName, brandName, brandCategoryId, category, description, season, gender, components, processes, garmentTrims, // DEPRECATED: Legacy field, use materialBOM instead
        valueAdditions, // DEPRECATED: Legacy field, use processes instead
        packagingTrims, // DEPRECATED: Legacy field, use materialBOM instead
        materialBOM, // NEW: Unified material BOM for all materials (trims, accessories, packaging)
        customerAccessoriesPresetId, // NEW: Apply customer's default accessories
         } = req.body;
        (0, logger_1.logDebug)('Components received:', components?.length || 0);
        (0, logger_1.logDebug)('Material BOM received:', materialBOM?.length || 0);
        (0, logger_1.logDebug)('Customer accessories preset ID:', customerAccessoriesPresetId);
        // Legacy fields for backward compatibility
        (0, logger_1.logDebug)('Garment trims received (legacy):', garmentTrims?.length || 0);
        (0, logger_1.logDebug)('Value additions received (legacy):', valueAdditions?.length || 0);
        (0, logger_1.logDebug)('Packaging trims received (legacy):', packagingTrims?.length || 0);
        // Validation
        if (!styleCode || !styleName || !customerName || !brandName) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'styleCode, styleName, customerName, and brandName are required',
            });
            return;
        }
        // Check for duplicate style code
        const existingStyle = await database_1.default.styles.findUnique({
            where: { styleCode },
        });
        if (existingStyle) {
            res.status(409).json({
                error: 'Conflict',
                message: 'Style code already exists',
            });
            return;
        }
        // Load customer accessories preset if provided
        let presetAccessories = [];
        if (customerAccessoriesPresetId) {
            try {
                const preset = await database_1.default.customer_accessories_presets.findUnique({
                    where: { id: customerAccessoriesPresetId },
                });
                if (preset && preset.accessoryItems) {
                    presetAccessories = Array.isArray(preset.accessoryItems)
                        ? preset.accessoryItems
                        : [];
                    (0, logger_1.logDebug)('Loaded preset accessories:', presetAccessories.length);
                }
            }
            catch (error) {
                (0, logger_1.logWarn)('Failed to load customer accessories preset:', error);
            }
        }
        // Combine material BOM with preset accessories
        const combinedMaterialBOM = [
            ...(materialBOM || []),
            ...presetAccessories,
        ];
        // Auto-add Thread if not already present
        const hasThread = combinedMaterialBOM.some((item) => item.materialType === 'THREAD');
        if (!hasThread) {
            combinedMaterialBOM.push({
                materialType: 'THREAD',
                usageCategory: 'GARMENT_TRIM',
                componentName: 'Default Thread',
                quantityPerGarment: 0, // Quantity will be calculated later
                unit: 'cone',
            });
        }
        (0, logger_1.logDebug)('Combined material BOM (including preset + thread):', combinedMaterialBOM.length);
        // Create style with nested components, fabrics, and processes
        const style = await database_1.default.styles.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                styleCode,
                styleName,
                customerName,
                brandName,
                brandCategoryId: brandCategoryId || null,
                description,
                season,
                gender: gender || null, // NEW: Gender field
                createdById: req.user?.userId || 'system',
                specifications: category || null, // Store category in specifications field for now
                cadStatus: 'PENDING', // NEW: Initial CAD status
                style_components: {
                    create: components?.map((comp, index) => ({
                        id: (0, crypto_1.randomUUID)(),
                        componentName: comp.componentName,
                        componentType: comp.componentType,
                        sortOrder: index,
                        style_fabrics: {
                            create: comp.fabrics?.map((fabric) => ({
                                id: (0, crypto_1.randomUUID)(),
                                fabricId: fabric.fabricId || null, // Reference to fabric_master
                                fabricCADId: fabric.fabricCADId || null, // Reference to fabric_width_cad
                                fabricFinishType: fabric.fabricFinishType || null, // NEW: DYED, PRINTED, YARN_DYED, RAW
                                cadGroupKey: fabric.cadGroupKey || null, // NEW: For CAD grouping
                                // DEPRECATED fields - keep for backward compatibility during migration
                                fabricName: fabric.fabricName,
                                fabricType: fabric.fabricType,
                                greigeName: fabric.greigeName || null,
                                quantityNeeded: fabric.quantityNeeded ? parseFloat(fabric.quantityNeeded) : null,
                                unitPrice: fabric.unitPrice ? parseFloat(fabric.unitPrice) : null,
                                notes: fabric.notes || null,
                            })) || [],
                        },
                    })) || [],
                },
                style_processes: {
                    create: processes?.map((proc, index) => ({
                        id: (0, crypto_1.randomUUID)(),
                        processName: proc.processName,
                        processType: proc.processType || proc.processName,
                        isRequired: proc.isRequired !== false,
                        sortOrder: index,
                        vendorName: proc.vendorName || null,
                        estimatedCost: proc.estimatedCost || null,
                        estimatedDays: proc.estimatedDays || null,
                        notes: proc.notes || null,
                    })) || [],
                },
                // NEW: Unified Material BOM (replaces garmentTrims, valueAdditions, packagingTrims)
                style_material_bom: {
                    create: combinedMaterialBOM?.map((bom, index) => ({
                        id: (0, crypto_1.randomUUID)(),
                        materialType: bom.materialType,
                        materialId: bom.materialId || (0, crypto_1.randomUUID)(), // Temporary fallback
                        usageCategory: bom.usageCategory || 'GARMENT_TRIM',
                        componentName: bom.componentName || null,
                        quantityPerGarment: bom.quantityPerGarment ? parseFloat(bom.quantityPerGarment) : 0,
                        unit: bom.unit || 'pcs',
                        unitPrice: bom.unitPrice ? parseFloat(bom.unitPrice) : null,
                        totalCost: bom.totalCost ? parseFloat(bom.totalCost) : null,
                        notes: bom.notes || null,
                        sortOrder: index,
                        // Material-specific IDs
                        laceId: bom.materialType === 'LACE' ? bom.materialId : null,
                        buttonId: bom.materialType === 'BUTTON' ? bom.materialId : null,
                        threadId: bom.materialType === 'THREAD' ? bom.materialId : null,
                        zipperId: bom.materialType === 'ZIPPER' ? bom.materialId : null,
                        elasticId: bom.materialType === 'ELASTIC' ? bom.materialId : null,
                        labelId: bom.materialType === 'LABEL' ? bom.materialId : null,
                        packagingId: bom.materialType === 'PACKAGING' ? bom.materialId : null,
                    })) || [],
                },
                // DEPRECATED: Keep for backward compatibility during migration
                style_garment_trims: {
                    create: garmentTrims?.map((trim) => ({
                        id: (0, crypto_1.randomUUID)(),
                        trimName: trim.trimName,
                        trimType: trim.trimType || '',
                        quantityPerPiece: parseFloat(trim.quantityPerPiece) || 0,
                        unit: trim.unit || 'pcs',
                        supplier: trim.supplier || null,
                    })) || [],
                },
                style_value_additions: {
                    create: valueAdditions
                        ?.filter((va) => va.additionType)
                        .map((va) => ({
                        id: (0, crypto_1.randomUUID)(),
                        additionType: va.additionType,
                        description: va.description || null,
                        type: va.type || null,
                        numberOfItems: va.numberOfItems || null,
                    })) || [],
                },
                style_packaging: {
                    create: packagingTrims?.map((pkg) => ({
                        id: (0, crypto_1.randomUUID)(),
                        itemName: pkg.itemName,
                        itemType: pkg.itemType || 'polybag',
                        specification: pkg.specification || null,
                        quantityPerPack: parseInt(pkg.quantityPerPack) || 1,
                    })) || [],
                },
            },
            include: {
                style_components: {
                    include: {
                        style_fabrics: {
                            include: {
                                fabric: true, // Include fabric_master details
                                fabricCAD: true, // Include fabric_width_cad details (replaces cad_averages)
                            },
                        },
                        style_accessories: true,
                    },
                },
                style_processes: true,
                style_costing: true,
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
                // DEPRECATED: Legacy relations, kept for backward compatibility
                style_garment_trims: true,
                style_value_additions: true,
                style_packaging: true,
            },
        });
        (0, logger_1.logDebug)('Style created successfully with ID:', style.id);
        res.status(201).json({
            data: style,
            message: 'Style created successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create style error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create style',
        });
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
        const skip = (page - 1) * limit;
        const search = req.query.search;
        const stage = req.query.stage;
        const whereClause = { isActive: true };
        // Search filter
        if (search) {
            whereClause.OR = [
                { styleCode: { contains: search, mode: 'insensitive' } },
                { styleName: { contains: search, mode: 'insensitive' } },
                { customerName: { contains: search, mode: 'insensitive' } },
                { brandName: { contains: search, mode: 'insensitive' } },
            ];
        }
        // Stage filter
        if (stage) {
            whereClause.productionTracking = {
                some: {
                    currentStage: stage,
                    piecesInStage: { gt: 0 },
                },
            };
        }
        const totalStyles = await database_1.default.styles.count({ where: whereClause });
        const styles = await database_1.default.styles.findMany({
            where: whereClause,
            skip,
            take: limit,
            include: {
                style_components: {
                    include: {
                        style_fabrics: true,
                        style_accessories: true,
                    },
                },
                style_processes: true,
                style_costing: true,
                style_production_tracking: true,
                style_garment_trims: true,
                style_value_additions: true,
                style_packaging: true,
                _count: {
                    select: {
                        style_components: true,
                        style_processes: true,
                        style_garment_trims: true,
                        style_value_additions: true,
                        style_packaging: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        // Transform Decimal fields in garment trims to numbers
        const transformedStyles = styles.map(style => ({
            ...style,
            style_garment_trims: style.style_garment_trims?.map(trim => ({
                ...trim,
                quantityPerPiece: trim.quantityPerPiece ? Number(trim.quantityPerPiece) : 0,
            })) || [],
        }));
        // The global transformation middleware will handle snake_case to camelCase conversion
        // and apply RELATION_MAPPINGS automatically
        res.status(200).json({
            data: transformedStyles,
            pagination: {
                page,
                limit,
                total: totalStyles,
                totalPages: Math.ceil(totalStyles / limit),
            },
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get all styles error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch styles',
        });
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
        const style = await database_1.default.styles.findUnique({
            where: { id },
            include: {
                color_options: {
                    orderBy: {
                        sortOrder: 'asc',
                    },
                },
                size_options: {
                    orderBy: {
                        sortOrder: 'asc',
                    },
                },
                style_components: {
                    include: {
                        style_fabrics: true,
                        style_accessories: true,
                    },
                    orderBy: {
                        sortOrder: 'asc',
                    },
                },
                style_processes: {
                    orderBy: {
                        sortOrder: 'asc',
                    },
                },
                style_costing: true,
                style_production_tracking: true,
                style_garment_trims: true,
                style_value_additions: true,
                style_packaging: true,
                users: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });
        if (!style) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Style not found',
            });
            return;
        }
        // Transform Decimal fields in garment trims to numbers
        const transformedStyle = {
            ...style,
            style_garment_trims: style.style_garment_trims?.map(trim => ({
                ...trim,
                quantityPerPiece: trim.quantityPerPiece ? Number(trim.quantityPerPiece) : 0,
            })) || [],
        };
        // The global transformation middleware will handle snake_case to camelCase conversion
        // and apply RELATION_MAPPINGS automatically
        res.status(200).json({ data: transformedStyle });
    }
    catch (error) {
        (0, logger_1.logError)('Get style by ID error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch style',
        });
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
        const { styleName, customerName, brandName, brandCategoryId, description, season, } = req.body;
        const style = await database_1.default.styles.update({
            where: { id },
            data: {
                styleName,
                customerName,
                brandName,
                brandCategoryId: brandCategoryId || null,
                description,
                season,
            },
            include: {
                style_components: {
                    include: {
                        style_fabrics: {
                            include: {
                                fabric: true, // Include fabric_master details
                                fabricCAD: true, // Include fabric_width_cad details (replaces cad_averages)
                            },
                        },
                        style_accessories: true,
                    },
                },
                style_processes: true,
                style_costing: true,
                style_garment_trims: true,
                style_value_additions: true,
                style_packaging: true,
            },
        });
        res.status(200).json({
            data: style,
            message: 'Style updated successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Update style error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update style',
        });
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
        await database_1.default.styles.update({
            where: { id },
            data: { isActive: false },
        });
        res.status(200).json({
            message: 'Style deleted successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Delete style error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete style',
        });
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
        const style = await database_1.default.styles.update({
            where: { id },
            data: { imageUrl },
            select: {
                id: true,
                styleCode: true,
                imageUrl: true,
            },
        });
        res.status(200).json({
            data: style,
            message: 'Image uploaded successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Upload style image error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to upload image',
        });
    }
};
exports.uploadStyleImage = uploadStyleImage;
/**
 * Create or update style variants
 * POST /api/styles/:id/variants
 *
 * Request body:
 * {
 *   variants: [
 *     { size: "M", sku: "ABC123M", barcode?: "", isActive: true },
 *     { size: "L", sku: "ABC123L", barcode?: "", isActive: true }
 *   ]
 * }
 */
const createStyleVariants = async (req, res) => {
    try {
        const { id: styleId } = req.params;
        const { variants } = req.body;
        (0, logger_1.logDebug)('=== CREATE STYLE VARIANTS ===');
        (0, logger_1.logDebug)('Style ID:', styleId);
        (0, logger_1.logDebug)('Variants:', JSON.stringify(variants, null, 2));
        // Validation
        if (!variants || !Array.isArray(variants) || variants.length === 0) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Variants array is required and must not be empty',
            });
            return;
        }
        // Check if style exists
        const style = await database_1.default.styles.findUnique({
            where: { id: styleId },
            select: { id: true, styleCode: true },
        });
        if (!style) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Style not found',
            });
            return;
        }
        // Validate all SKU formats
        const invalidSKUs = variants.filter(v => !(0, sku_generator_1.validateSKUFormat)(v.sku));
        if (invalidSKUs.length > 0) {
            res.status(400).json({
                error: 'Validation Error',
                message: `Invalid SKU format for: ${invalidSKUs.map(v => v.sku).join(', ')}`,
            });
            return;
        }
        // Check for duplicate SKUs within the request
        const skuCounts = new Map();
        variants.forEach(v => {
            skuCounts.set(v.sku, (skuCounts.get(v.sku) || 0) + 1);
        });
        const duplicates = Array.from(skuCounts.entries())
            .filter(([_, count]) => count > 1)
            .map(([sku]) => sku);
        if (duplicates.length > 0) {
            res.status(400).json({
                error: 'Validation Error',
                message: `Duplicate SKUs in request: ${duplicates.join(', ')}`,
            });
            return;
        }
        // Check if any SKUs already exist in database (for other styles)
        const allSKUs = variants.map(v => v.sku);
        const existingSKUs = await (0, sku_generator_1.checkMultipleSKUsExist)(allSKUs);
        // Filter out SKUs that belong to THIS style (we'll upsert those)
        const existingVariantsForStyle = await database_1.default.style_variants.findMany({
            where: {
                styleId,
                sku: { in: allSKUs }
            },
            select: { sku: true }
        });
        const existingSKUsForThisStyle = new Set(existingVariantsForStyle.map(v => v.sku));
        const conflictingSKUs = existingSKUs.filter(sku => !existingSKUsForThisStyle.has(sku));
        if (conflictingSKUs.length > 0) {
            res.status(409).json({
                error: 'Conflict',
                message: `SKUs already exist for other styles: ${conflictingSKUs.join(', ')}`,
            });
            return;
        }
        // Process variants in a transaction
        const createdVariants = await database_1.default.$transaction(async (tx) => {
            const results = [];
            for (let i = 0; i < variants.length; i++) {
                const variant = variants[i];
                const { size, sku, barcode, isActive } = variant;
                // Get or create size option
                let sizeOption = await tx.size_options.findFirst({
                    where: {
                        styleId,
                        sizeName: size,
                    },
                });
                if (!sizeOption) {
                    sizeOption = await tx.size_options.create({
                        data: {
                            id: (0, crypto_1.randomUUID)(),
                            styleId,
                            sizeName: size,
                            sizeCode: size, // Use size name as code
                            sortOrder: (0, sku_generator_1.getSizeOrder)(size),
                            isActive: true,
                        },
                    });
                }
                // Upsert style variant (create or update if exists)
                const styleVariant = await tx.style_variants.upsert({
                    where: { sku },
                    create: {
                        id: (0, crypto_1.randomUUID)(),
                        styleId,
                        sku,
                        sizeId: sizeOption.id,
                        sizeName: size,
                        colorId: null,
                        colorName: null,
                        barcode: barcode || null,
                        isActive: isActive !== false,
                        sortOrder: (0, sku_generator_1.getSizeOrder)(size),
                    },
                    update: {
                        sizeId: sizeOption.id,
                        sizeName: size,
                        barcode: barcode || null,
                        isActive: isActive !== false,
                        sortOrder: (0, sku_generator_1.getSizeOrder)(size),
                    },
                });
                results.push(styleVariant);
            }
            return results;
        });
        (0, logger_1.logInfo)(`Created/updated ${createdVariants.length} variants for style ${style.styleCode}`);
        res.status(201).json({
            data: createdVariants,
            message: `Successfully created/updated ${createdVariants.length} variant(s)`,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create style variants error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create variants',
        });
    }
};
exports.createStyleVariants = createStyleVariants;
/**
 * Get all draft styles for the current user
 * GET /api/styles/drafts
 */
const getAllDrafts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const whereClause = {
            status: 'DRAFT',
            isActive: true
        };
        // Optionally filter by current user
        // if (req.user?.userId) {
        //   whereClause.createdById = req.user.userId;
        // }
        const totalDrafts = await database_1.default.styles.count({ where: whereClause });
        const drafts = await database_1.default.styles.findMany({
            where: whereClause,
            skip,
            take: limit,
            select: {
                id: true,
                styleCode: true,
                styleName: true,
                customerName: true,
                brandName: true,
                categoryId: true,
                status: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });
        res.status(200).json({
            data: drafts,
            pagination: {
                page,
                limit,
                total: totalDrafts,
                totalPages: Math.ceil(totalDrafts / limit)
            }
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get drafts error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch drafts'
        });
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
        const draft = await database_1.default.styles.findFirst({
            where: {
                id,
                status: 'DRAFT'
            },
            include: {
                style_components: {
                    include: {
                        style_fabrics: {
                            include: {
                                fabric: true, // Include fabric_master details
                                fabricCAD: true // Include fabric_width_cad details (replaces cad_averages)
                            }
                        }
                    }
                },
                style_processes: true,
                style_garment_trims: true,
                style_value_additions: true,
                style_packaging: true,
                style_variants: {
                    include: {
                        size: true
                    }
                }
            }
        });
        if (!draft) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Draft not found'
            });
            return;
        }
        res.status(200).json({ data: draft });
    }
    catch (error) {
        (0, logger_1.logError)('Get draft by ID error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch draft'
        });
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
        const draft = await database_1.default.styles.findFirst({
            where: { id, status: 'DRAFT' }
        });
        if (!draft) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Draft not found'
            });
            return;
        }
        await database_1.default.styles.update({
            where: { id },
            data: { isActive: false }
        });
        res.status(200).json({
            message: 'Draft deleted successfully'
        });
    }
    catch (error) {
        (0, logger_1.logError)('Delete draft error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete draft'
        });
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
        // Verify it's a draft
        const draft = await database_1.default.styles.findFirst({
            where: { id, status: 'DRAFT' }
        });
        if (!draft) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Draft not found'
            });
            return;
        }
        // Update status to ACTIVE
        const publishedStyle = await database_1.default.styles.update({
            where: { id },
            data: {
                status: 'ACTIVE',
            },
            include: {
                style_components: {
                    include: {
                        style_fabrics: true
                    }
                },
                style_processes: true
            }
        });
        (0, logger_1.logInfo)(`Draft ${draft.styleCode} published to ACTIVE status`);
        res.status(200).json({
            data: publishedStyle,
            message: 'Style published successfully'
        });
    }
    catch (error) {
        (0, logger_1.logError)('Publish draft error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to publish draft'
        });
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
        const style = await database_1.default.styles.findUnique({
            where: { id: styleId },
            include: {
                style_components: {
                    include: {
                        style_fabrics: {
                            include: {
                                fabric: {
                                    include: {
                                        greige: true,
                                        widthCADs: { where: { isActive: true }, orderBy: { availableWidth: 'asc' } },
                                    },
                                },
                                fabricCAD: true,
                            },
                        },
                    },
                },
            },
        });
        if (!style) {
            res.status(404).json({ error: 'Not Found', message: 'Style not found' });
            return;
        }
        // Group fabrics by cadGroupKey
        const fabricGroups = {};
        for (const component of style.style_components) {
            for (const fabric of component.style_fabrics) {
                const groupKey = fabric.cadGroupKey || `${fabric.fabric?.genericFabricName || 'Unknown'}-${fabric.fabricFinishType || 'Unknown'}`;
                if (!fabricGroups[groupKey]) {
                    fabricGroups[groupKey] = {
                        groupKey,
                        genericFabricName: fabric.fabric?.genericFabricName,
                        fabricFinishType: fabric.fabricFinishType,
                        fabrics: [],
                        components: [],
                        availableWidthOptions: fabric.fabric?.widthCADs || [],
                    };
                }
                fabricGroups[groupKey].fabrics.push({
                    id: fabric.id,
                    componentName: component.componentName,
                    fabricName: fabric.fabric?.fabricName || fabric.fabricName,
                    currentCADId: fabric.fabricCADId,
                });
                if (!fabricGroups[groupKey].components.includes(component.componentName)) {
                    fabricGroups[groupKey].components.push(component.componentName);
                }
            }
        }
        res.status(200).json({
            data: {
                style: { id: style.id, styleCode: style.styleCode, styleName: style.styleName, cadStatus: style.cadStatus },
                fabricGroups: Object.values(fabricGroups),
            },
            message: 'CAD planning data retrieved successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get CAD planning error', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve CAD planning data' });
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
        if (!fabricGroups || !Array.isArray(fabricGroups)) {
            res.status(400).json({ error: 'Validation Error', message: 'fabricGroups array is required' });
            return;
        }
        await Promise.all(fabricGroups.map((group) => database_1.default.style_fabrics.update({
            where: { id: group.fabricId },
            data: { cadGroupKey: group.cadGroupKey },
        })));
        await database_1.default.styles.update({
            where: { id: styleId },
            data: { cadStatus: 'IN_PROGRESS' },
        });
        res.status(200).json({ message: 'CAD grouping updated successfully' });
    }
    catch (error) {
        (0, logger_1.logError)('Update CAD grouping error', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update CAD grouping' });
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
        if (!fabricCADMappings || !Array.isArray(fabricCADMappings)) {
            res.status(400).json({ error: 'Validation Error', message: 'fabricCADMappings array is required' });
            return;
        }
        await Promise.all(fabricCADMappings.map((mapping) => database_1.default.style_fabrics.update({
            where: { id: mapping.fabricId },
            data: { fabricCADId: mapping.fabricCADId },
        })));
        const updatedStyle = await database_1.default.styles.update({
            where: { id: styleId },
            data: { cadStatus: 'APPROVED', approvedCadDate: new Date() },
        });
        res.status(200).json({ data: updatedStyle, message: 'CAD plan approved successfully' });
    }
    catch (error) {
        (0, logger_1.logError)('Approve CAD plan error', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to approve CAD plan' });
    }
};
exports.approveCADPlan = approveCADPlan;
