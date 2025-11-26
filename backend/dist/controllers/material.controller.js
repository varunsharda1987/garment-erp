"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCategory = exports.getCategoryHierarchy = exports.getAllCategories = exports.deleteMaterial = exports.updateMaterial = exports.getMaterialById = exports.getAllMaterials = exports.createMaterial = void 0;
const crypto_1 = require("crypto");
const database_1 = __importDefault(require("../config/database"));
const logger_1 = require("../utils/logger");
/**
 * Create new material
 * POST /api/materials
 */
const createMaterial = async (req, res) => {
    try {
        const { code, name, categoryId, description, specifications, unit, reorderLevel, suppliers = [], // Array of {supplierId, isPreferred, isActive, notes}
        image, categoryData, } = req.body;
        // Check if material code already exists
        const existingMaterial = await database_1.default.materials.findUnique({
            where: { code },
        });
        if (existingMaterial) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Material code already exists',
            });
            return;
        }
        const material = await database_1.default.materials.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                code,
                name,
                categoryId,
                description,
                specifications,
                unit,
                reorderLevel: reorderLevel ? parseInt(reorderLevel) : null,
                image: image || null,
                categoryData: categoryData || null,
                suppliers: {
                    create: suppliers.map((s) => ({
                        supplierId: s.supplierId,
                        isPreferred: s.isPreferred || false,
                        isActive: s.isActive !== undefined ? s.isActive : true,
                        notes: s.notes || null,
                    })),
                },
            },
            include: {
                material_categories: true,
                suppliers: {
                    include: {
                        supplier: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                supplierCategory: true,
                            },
                        },
                    },
                },
            },
        });
        res.status(201).json({
            data: material,
            message: 'Material created successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create material error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create material',
        });
    }
};
exports.createMaterial = createMaterial;
/**
 * Get all materials with pagination, search, and filters
 * GET /api/materials
 */
const getAllMaterials = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search;
        const categoryId = req.query.categoryId;
        const supplierId = req.query.supplierId;
        const unit = req.query.unit;
        const whereClause = { isActive: true };
        // Search filter
        if (search) {
            whereClause.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        // Category filter
        if (categoryId) {
            whereClause.categoryId = categoryId;
        }
        // Supplier filter (via junction table)
        if (supplierId) {
            whereClause.suppliers = {
                some: {
                    supplierId: supplierId,
                    isActive: true,
                },
            };
        }
        // Unit filter
        if (unit) {
            whereClause.unit = unit;
        }
        const [materials, total] = await Promise.all([
            database_1.default.materials.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    material_categories: {
                        include: {
                            parent: true, // Include parent category
                        },
                    },
                    suppliers: {
                        include: {
                            supplier: {
                                select: {
                                    id: true,
                                    code: true,
                                    name: true,
                                    supplierCategory: true,
                                },
                            },
                        },
                        orderBy: {
                            isPreferred: 'desc',
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            database_1.default.materials.count({ where: whereClause }),
        ]);
        const totalPages = Math.ceil(total / limit);
        // Transform Decimal fields to numbers
        const transformedMaterials = materials.map(material => ({
            ...material,
            reorderLevel: material.reorderLevel ? Number(material.reorderLevel) : null,
        }));
        res.json({
            data: transformedMaterials,
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get materials error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch materials',
        });
    }
};
exports.getAllMaterials = getAllMaterials;
/**
 * Get material by ID
 * GET /api/materials/:id
 */
const getMaterialById = async (req, res) => {
    try {
        const { id } = req.params;
        const material = await database_1.default.materials.findUnique({
            where: { id },
            include: {
                material_categories: {
                    include: {
                        parent: true, // Include parent category
                    },
                },
                suppliers: {
                    include: {
                        supplier: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                supplierCategory: true,
                                contactPerson: true,
                                phone: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        isPreferred: 'desc',
                    },
                },
                inventory_stock: {
                    include: {
                        locations: true,
                    },
                },
            },
        });
        if (!material) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Material not found',
            });
            return;
        }
        // Transform Decimal fields to numbers
        const transformedMaterial = {
            ...material,
            reorderLevel: material.reorderLevel ? Number(material.reorderLevel) : null,
        };
        res.json({ data: transformedMaterial });
    }
    catch (error) {
        (0, logger_1.logError)('Get material error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch material',
        });
    }
};
exports.getMaterialById = getMaterialById;
/**
 * Update material
 * PUT /api/materials/:id
 */
const updateMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, categoryId, description, specifications, unit, reorderLevel, suppliers, // Array of {supplierId, isPreferred, isActive, notes}
        image, categoryData, } = req.body;
        // Check if material exists
        const existingMaterial = await database_1.default.materials.findUnique({
            where: { id },
        });
        if (!existingMaterial) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Material not found',
            });
            return;
        }
        // Check if code is being changed and if new code already exists
        if (code !== existingMaterial.code) {
            const codeExists = await database_1.default.materials.findUnique({
                where: { code },
            });
            if (codeExists) {
                res.status(400).json({
                    error: 'Validation Error',
                    message: 'Material code already exists',
                });
                return;
            }
        }
        // Build update data
        const updateData = {
            code,
            name,
            categoryId,
            description,
            specifications,
            unit,
            reorderLevel: reorderLevel ? parseInt(reorderLevel) : null,
            image: image || null,
            categoryData: categoryData || null,
        };
        // Update suppliers if provided
        if (suppliers !== undefined) {
            // Delete existing supplier relationships
            await database_1.default.material_suppliers.deleteMany({
                where: { materialId: id },
            });
            // Create new supplier relationships
            updateData.suppliers = {
                create: suppliers.map((s) => ({
                    supplierId: s.supplierId,
                    isPreferred: s.isPreferred || false,
                    isActive: s.isActive !== undefined ? s.isActive : true,
                    notes: s.notes || null,
                })),
            };
        }
        const material = await database_1.default.materials.update({
            where: { id },
            data: updateData,
            include: {
                material_categories: true,
                suppliers: {
                    include: {
                        supplier: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                supplierCategory: true,
                            },
                        },
                    },
                },
            },
        });
        res.json({
            data: material,
            message: 'Material updated successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Update material error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update material',
        });
    }
};
exports.updateMaterial = updateMaterial;
/**
 * Delete material (soft delete)
 * DELETE /api/materials/:id
 */
const deleteMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const material = await database_1.default.materials.findUnique({
            where: { id },
        });
        if (!material) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Material not found',
            });
            return;
        }
        await database_1.default.materials.update({
            where: { id },
            data: { isActive: false },
        });
        res.json({
            message: 'Material deleted successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Delete material error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete material',
        });
    }
};
exports.deleteMaterial = deleteMaterial;
/**
 * Get all material categories
 * GET /api/materials/categories
 */
const getAllCategories = async (req, res) => {
    try {
        const { parentId } = req.query;
        const where = { isActive: true };
        // Filter by parent if specified
        if (parentId) {
            where.parentCategoryId = parentId;
        }
        const categories = await database_1.default.material_categories.findMany({
            where,
            orderBy: [
                { level: 'asc' },
                { sortOrder: 'asc' },
                { name: 'asc' },
            ],
            include: {
                _count: {
                    select: { materials: true },
                },
                parent: true,
                children: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });
        res.json({ data: categories });
    }
    catch (error) {
        (0, logger_1.logError)('Get categories error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch categories',
        });
    }
};
exports.getAllCategories = getAllCategories;
/**
 * Get category hierarchy (parents with children nested)
 * GET /api/materials/categories/hierarchy
 */
const getCategoryHierarchy = async (req, res) => {
    try {
        // Get parent categories with their children
        const parentCategories = await database_1.default.material_categories.findMany({
            where: {
                level: 1,
                isActive: true,
            },
            orderBy: { sortOrder: 'asc' },
            include: {
                children: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        _count: {
                            select: { materials: true },
                        },
                    },
                },
                _count: {
                    select: { materials: true },
                },
            },
        });
        res.json({ data: parentCategories });
    }
    catch (error) {
        (0, logger_1.logError)('Get category hierarchy error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch category hierarchy',
        });
    }
};
exports.getCategoryHierarchy = getCategoryHierarchy;
/**
 * Create material category
 * POST /api/materials/categories
 */
const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        // Check if category already exists
        const existingCategory = await database_1.default.material_categories.findUnique({
            where: { name },
        });
        if (existingCategory) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Category name already exists',
            });
            return;
        }
        const category = await database_1.default.material_categories.create({
            data: {
                name,
                description: description || null,
            },
        });
        res.status(201).json({
            data: category,
            message: 'Category created successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create category error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create category',
        });
    }
};
exports.createCategory = createCategory;
