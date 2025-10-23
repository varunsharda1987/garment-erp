// Material Management Controller
import { Request, Response } from 'express';
import prisma from '../config/database';

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
      costPrice,
      reorderLevel,
      supplierId,
      image,
      categoryData,
    } = req.body;

    // Check if material code already exists
    const existingMaterial = await prisma.material.findUnique({
      where: { code },
    });

    if (existingMaterial) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Material code already exists',
      });
      return;
    }

    const material = await prisma.material.create({
      data: {
        code,
        name,
        categoryId,
        description,
        specifications,
        unit,
        costPrice: costPrice ? parseFloat(costPrice) : 0,
        reorderLevel: reorderLevel ? parseInt(reorderLevel) : null,
        supplierId: supplierId || null,
        image: image || null,
        categoryData: categoryData || null,
      },
      include: {
        category: true,
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
            supplierCategory: true,
          },
        },
      },
    });

    res.status(201).json({
      data: material,
      message: 'Material created successfully',
    });
  } catch (error) {
    console.error('Create material error:', error);
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

    const whereClause: any = { isActive: true };

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

    // Supplier filter
    if (supplierId) {
      whereClause.supplierId = supplierId;
    }

    // Unit filter
    if (unit) {
      whereClause.unit = unit;
    }

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          category: true,
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
          createdAt: 'desc',
        },
      }),
      prisma.material.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: materials,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Get materials error:', error);
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

    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        category: true,
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
        inventoryStock: {
          include: {
            location: true,
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

    res.json({ data: material });
  } catch (error) {
    console.error('Get material error:', error);
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
      costPrice,
      reorderLevel,
      supplierId,
      image,
      categoryData,
    } = req.body;

    // Check if material exists
    const existingMaterial = await prisma.material.findUnique({
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
      const codeExists = await prisma.material.findUnique({
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

    const material = await prisma.material.update({
      where: { id },
      data: {
        code,
        name,
        categoryId,
        description,
        specifications,
        unit,
        costPrice: costPrice ? parseFloat(costPrice) : 0,
        reorderLevel: reorderLevel ? parseInt(reorderLevel) : null,
        supplierId: supplierId || null,
        image: image || null,
        categoryData: categoryData || null,
      },
      include: {
        category: true,
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
            supplierCategory: true,
          },
        },
      },
    });

    res.json({
      data: material,
      message: 'Material updated successfully',
    });
  } catch (error) {
    console.error('Update material error:', error);
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

    const material = await prisma.material.findUnique({
      where: { id },
    });

    if (!material) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Material not found',
      });
      return;
    }

    await prisma.material.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      message: 'Material deleted successfully',
    });
  } catch (error) {
    console.error('Delete material error:', error);
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
    const categories = await prisma.materialCategory.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: { materials: true },
        },
      },
    });

    res.json({ data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch categories',
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
    const existingCategory = await prisma.materialCategory.findUnique({
      where: { name },
    });

    if (existingCategory) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Category name already exists',
      });
      return;
    }

    const category = await prisma.materialCategory.create({
      data: {
        name,
        description: description || null,
      },
    });

    res.status(201).json({
      data: category,
      message: 'Category created successfully',
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create category',
    });
  }
};
