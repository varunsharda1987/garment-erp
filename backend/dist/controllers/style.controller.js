"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadStyleImage = exports.deleteStyle = exports.updateStyle = exports.getStyleById = exports.getAllStyles = exports.createStyle = void 0;
const database_1 = __importDefault(require("../config/database"));
const crypto_1 = require("crypto");
/**
 * Create new style with components and processes
 * POST /api/styles
 * Updated to include UUIDs for all child records
 */
const createStyle = async (req, res) => {
    console.log('🔥🔥🔥 CREATE STYLE ENDPOINT HIT 🔥🔥🔥');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request headers:', req.headers);
    try {
        console.log('=== CREATE STYLE REQUEST ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        const { styleCode, styleName, buyerName, brandName, category, description, season, components, processes, garmentTrims, valueAdditions, packagingTrims, } = req.body;
        console.log('Components received:', components?.length || 0);
        console.log('Garment trims received:', garmentTrims?.length || 0);
        console.log('Value additions received:', valueAdditions?.length || 0);
        console.log('Packaging trims received:', packagingTrims?.length || 0);
        // Validation
        if (!styleCode || !styleName || !buyerName || !brandName) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'styleCode, styleName, buyerName, and brandName are required',
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
        // Create style with nested components, fabrics, and processes
        const style = await database_1.default.styles.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                styleCode,
                styleName,
                buyerName,
                brandName,
                description,
                season,
                createdById: req.user?.userId || 'system',
                specifications: category || null, // Store category in specifications field for now
                updatedAt: new Date(),
                style_components: {
                    create: components?.map((comp, index) => ({
                        id: (0, crypto_1.randomUUID)(),
                        componentName: comp.componentName,
                        componentType: comp.componentType,
                        sortOrder: index,
                        style_fabrics: {
                            create: comp.fabrics?.map((fabric) => ({
                                id: (0, crypto_1.randomUUID)(),
                                fabricName: fabric.fabricName,
                                fabricType: fabric.fabricType,
                                greigeName: fabric.greigeName || null,
                                cad_averages: {
                                    create: fabric.cadAverages?.map((cad) => ({
                                        id: (0, crypto_1.randomUUID)(),
                                        fabric_width: parseFloat(cad.fabricWidth),
                                        cad_average_meters: cad.cadAverageMeters ? parseFloat(cad.cadAverageMeters) : null,
                                        cad_average_yards: cad.cadAverageYards ? parseFloat(cad.cadAverageYards) : null,
                                        cad_wastage_percent: cad.cadWastagePercent ? parseFloat(cad.cadWastagePercent) : 2,
                                        marker_efficiency: cad.markerEfficiency ? parseFloat(cad.markerEfficiency) : null,
                                        marker_plan_file: cad.markerPlanFile || null,
                                        is_preferred: cad.isPreferred || false,
                                        notes: cad.notes || null,
                                        updated_at: new Date(),
                                    })) || [],
                                },
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
                style_garment_trims: {
                    create: garmentTrims?.map((trim) => ({
                        id: (0, crypto_1.randomUUID)(),
                        trimName: trim.trimName,
                        trimType: trim.trimType || '',
                        quantityPerPiece: parseFloat(trim.quantityPerPiece) || 0,
                        unit: trim.unit || 'pcs',
                        supplier: trim.supplier || null,
                        updatedAt: new Date(),
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
                        updatedAt: new Date(),
                    })) || [],
                },
                style_packaging: {
                    create: packagingTrims?.map((pkg) => ({
                        id: (0, crypto_1.randomUUID)(),
                        itemName: pkg.itemName,
                        itemType: pkg.itemType || 'polybag',
                        specification: pkg.specification || null,
                        quantityPerPack: parseInt(pkg.quantityPerPack) || 1,
                        updatedAt: new Date(),
                    })) || [],
                },
            },
            include: {
                style_components: {
                    include: {
                        style_fabrics: {
                            include: {
                                cad_averages: true,
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
        res.status(201).json({
            data: style,
            message: 'Style created successfully',
        });
    }
    catch (error) {
        console.error('Create style error:', error);
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
                { buyerName: { contains: search, mode: 'insensitive' } },
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
        console.error('Get all styles error:', error);
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
        console.error('Get style by ID error:', error);
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
        const { styleName, buyerName, brandName, description, season, } = req.body;
        const style = await database_1.default.styles.update({
            where: { id },
            data: {
                styleName,
                buyerName,
                brandName,
                description,
                season,
            },
            include: {
                style_components: {
                    include: {
                        style_fabrics: {
                            include: {
                                cad_averages: true,
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
        console.error('Update style error:', error);
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
        console.error('Delete style error:', error);
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
        console.error('Upload style image error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to upload image',
        });
    }
};
exports.uploadStyleImage = uploadStyleImage;
