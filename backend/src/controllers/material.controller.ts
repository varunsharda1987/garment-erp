// Material Management Controller
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

// ============================================
// Types for Material Controller
// ============================================

interface SupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
}

/**
 * Create new material
 * POST /api/materials
 */
export const createMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code,
      name,
      categoryId,
      description,
      specifications,
      unit,
      reorderLevel,
      suppliers = [], // Array of {supplierId, isPreferred, isActive, notes}
      image,
      categoryData,
    } = req.body;

    // Check if material code already exists
    const existingMaterial = await prisma.materials.findUnique({
      where: { code },
    });

    if (existingMaterial) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Material code already exists',
      });
      return;
    }

    const material = await prisma.materials.create({
      data: {
        id: randomUUID(),
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
          create: (suppliers as SupplierInput[]).map((s) => ({
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
                supplierCategories: true,
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
  } catch (error) {
    logError('Create material error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create material',
    });
  }
};

/**
 * Get all materials with pagination, search, and filters
 * GET /api/materials
 */
export const getAllMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const categoryId = req.query.categoryId as string;
    const supplierId = req.query.supplierId as string;
    const unit = req.query.unit as string;

    const whereClause: Prisma.materialsWhereInput = { isActive: true };

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

    // Unit filter - cast to Unit enum type
    if (unit) {
      whereClause.unit = unit as 'METER' | 'PIECE' | 'KILOGRAM' | 'SET' | 'YARD' | 'DOZEN' | 'GROSS' | 'TUBE' | 'CONE';
    }

    const [materials, total] = await Promise.all([
      prisma.materials.findMany({
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
                  supplierCategories: true,
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
      prisma.materials.count({ where: whereClause }),
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
  } catch (error) {
    logError('Get materials error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch materials',
    });
  }
};

/**
 * Get material by ID
 * GET /api/materials/:id
 */
export const getMaterialById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const material = await prisma.materials.findUnique({
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
                supplierCategories: true,
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
  } catch (error) {
    logError('Get material error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch material',
    });
  }
};

/**
 * Update material
 * PUT /api/materials/:id
 */
export const updateMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      categoryId,
      description,
      specifications,
      unit,
      reorderLevel,
      suppliers, // Array of {supplierId, isPreferred, isActive, notes}
      image,
      categoryData,
    } = req.body;

    // Check if material exists
    const existingMaterial = await prisma.materials.findUnique({
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
      const codeExists = await prisma.materials.findUnique({
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

    // Build update data - use material_categories relation for categoryId
    const updateData: Prisma.materialsUpdateInput = {
      code,
      name,
      material_categories: categoryId ? { connect: { id: categoryId } } : undefined,
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
      await prisma.material_suppliers.deleteMany({
        where: { materialId: id },
      });

      // Create new supplier relationships
      updateData.suppliers = {
        create: (suppliers as SupplierInput[]).map((s) => ({
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
        })),
      };
    }

    const material = await prisma.materials.update({
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
                supplierCategories: true,
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
  } catch (error) {
    logError('Update material error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update material',
    });
  }
};

/**
 * Delete material (soft delete)
 * DELETE /api/materials/:id
 */
export const deleteMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const material = await prisma.materials.findUnique({
      where: { id },
    });

    if (!material) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Material not found',
      });
      return;
    }

    await prisma.materials.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      message: 'Material deleted successfully',
    });
  } catch (error) {
    logError('Delete material error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete material',
    });
  }
};

/**
 * Get all material categories
 * GET /api/materials/categories
 */
export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { parentId } = req.query;

    const where: Prisma.material_categoriesWhereInput = { isActive: true };

    // Filter by parent if specified
    if (parentId) {
      where.parentCategoryId = parentId as string;
    }

    const categories = await prisma.material_categories.findMany({
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
  } catch (error) {
    logError('Get categories error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch categories',
    });
  }
};

/**
 * Get category hierarchy (parents with children nested)
 * GET /api/materials/categories/hierarchy
 */
export const getCategoryHierarchy = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get parent categories with their children
    const parentCategories = await prisma.material_categories.findMany({
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
  } catch (error) {
    logError('Get category hierarchy error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch category hierarchy',
    });
  }
};

/**
 * Create material category
 * POST /api/materials/categories
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    // Check if category already exists
    const existingCategory = await prisma.material_categories.findUnique({
      where: { name },
    });

    if (existingCategory) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Category name already exists',
      });
      return;
    }

    const category = await prisma.material_categories.create({
      data: {
        name,
        description: description || null,
      } as any,
    });

    res.status(201).json({
      data: category,
      message: 'Category created successfully',
    });
  } catch (error) {
    logError('Create category error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create category',
    });
  }
};
