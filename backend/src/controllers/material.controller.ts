// Material Management Controller
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../errors';
import { normalizeId, isUUID } from '../utils/id-helper';

// ============================================
// Types for Material Controller
// ============================================

interface SupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  supplierPrice?: number | null;
  leadTimeDays?: number | null;
  moq?: number | null;
  moqUnit?: string | null;
  isPrimary?: boolean;
}

/**
 * Create new material
 * POST /api/materials
 */
export const createMaterial = async (req: Request, res: Response): Promise<void> => {
  const {
    code,
    name,
    categoryId,
    description,
    specifications,
    unit,
    reorderLevel,
    hsnCode,
    gstRate,
    suppliers = [], // Array of {supplierId, isPreferred, isActive, notes}
    image,
    categoryData,
  } = req.body;

  // Check if material code already exists
  const existingMaterial = await prisma.materials.findFirst({
    where: { code, isActive: true },
  });

  if (existingMaterial) {
    throw new ConflictError('Material code already exists');
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
      hsnCode: hsnCode || null,
      gstRate: gstRate ? parseFloat(gstRate) : null,
      image: image || null,
      categoryData: categoryData || null,
      suppliers: {
        create: (suppliers as SupplierInput[]).map((s) => ({
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
          supplierPrice: s.supplierPrice ?? null,
          leadTimeDays: s.leadTimeDays ?? null,
          moq: s.moq ?? null,
          moqUnit: s.moqUnit || null,
          isPrimary: s.isPrimary || false,
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
};

/**
 * Get all materials with pagination, search, and filters
 * GET /api/materials
 */
export const getAllMaterials = async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  const search = req.query.search as string;
  const categoryId = req.query.categoryId as string;
  const supplierId = req.query.supplierId as string;
  const materialTypesParam = req.query.materialTypes as string;
  const materialTypes = materialTypesParam ? materialTypesParam.split(',').filter(Boolean) : [];
  const unit = req.query.unit as string;

  const whereClause: Prisma.materialsWhereInput = { isActive: true };

  // Search filter - includes customer name search via linked master tables
  if (search) {
    whereClause.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      // Search by customer name via label_master
      {
        label_master: {
          customer: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      },
      // Search by customer name via packaging_master
      {
        packaging_master: {
          customer: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      },
    ];
  }

  // Category filter
  if (categoryId) {
    whereClause.categoryId = categoryId;
  }

  // Supplier + materialType filter with OR logic
  // When both are present: show materials linked to this supplier OR matching these material types
  if (supplierId && materialTypes.length > 0) {
    const supplierOrTypeConditions: Prisma.materialsWhereInput[] = [
      { suppliers: { some: { supplierId, isActive: true } } },
      { materialType: { in: materialTypes as any[] } },
    ];
    if (whereClause.OR) {
      // Search OR already exists — combine with AND
      whereClause.AND = [
        { OR: whereClause.OR },
        { OR: supplierOrTypeConditions },
      ];
      delete whereClause.OR;
    } else {
      whereClause.OR = supplierOrTypeConditions;
    }
  } else if (supplierId) {
    whereClause.suppliers = {
      some: {
        supplierId: supplierId,
        isActive: true,
      },
    };
  } else if (materialTypes.length > 0) {
    whereClause.materialType = { in: materialTypes as any[] };
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
        // Include master tables with customer info and price fields
        label_master: {
          select: {
            customerId: true,
            pricePerPiece: true,
            customer: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        packaging_master: {
          select: {
            customerId: true,
            pricePerPiece: true,
            customer: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        // Include other master tables for price info
        fabric_master: {
          select: {
            costPerMeter: true,
          },
        },
        greige_master: {
          select: {
            costPerMeter: true,
          },
        },
        lace_master: {
          select: {
            pricePerMeter: true,
          },
        },
        button_master: {
          select: {
            pricePerPiece: true,
          },
        },
        thread_master: {
          select: {
            pricePerCone: true,
          },
        },
        zipper_master: {
          select: {
            pricePerPiece: true,
          },
        },
        elastic_master: {
          select: {
            pricePerMeter: true,
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

  // Transform materials - extract customer and costPerUnit from linked master tables
  const transformedMaterials = materials.map(material => {
    // Get customer from whichever master table has data (only label and packaging have customer)
    const customer =
      material.label_master?.customer ||
      material.packaging_master?.customer ||
      null;

    // Compute costPerUnit from whichever master table has price data
    const costPerUnit =
      material.fabric_master?.costPerMeter ? Number(material.fabric_master.costPerMeter) :
      material.greige_master?.costPerMeter ? Number(material.greige_master.costPerMeter) :
      material.lace_master?.pricePerMeter ? Number(material.lace_master.pricePerMeter) :
      material.button_master?.pricePerPiece ? Number(material.button_master.pricePerPiece) :
      material.thread_master?.pricePerCone ? Number(material.thread_master.pricePerCone) :
      material.zipper_master?.pricePerPiece ? Number(material.zipper_master.pricePerPiece) :
      material.elastic_master?.pricePerMeter ? Number(material.elastic_master.pricePerMeter) :
      material.label_master?.pricePerPiece ? Number(material.label_master.pricePerPiece) :
      material.packaging_master?.pricePerPiece ? Number(material.packaging_master.pricePerPiece) :
      null;

    return {
      ...material,
      reorderLevel: material.reorderLevel ? Number(material.reorderLevel) : null,
      costPerUnit, // Add costPerUnit to the response
      customer, // Add customer to the response
      // Clean up - remove master table objects from response
      label_master: undefined,
      packaging_master: undefined,
      fabric_master: undefined,
      greige_master: undefined,
      lace_master: undefined,
      button_master: undefined,
      thread_master: undefined,
      zipper_master: undefined,
      elastic_master: undefined,
    };
  });

  res.json({
    data: transformedMaterials,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
};

/**
 * Get material by ID
 * GET /api/materials/:id
 */
export const getMaterialById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // First try exact match, then try case-insensitive match for non-UUID IDs
  let material = await prisma.materials.findUnique({
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

  // If not found and ID looks like a custom format (not UUID), try lowercase
  if (!material && !isUUID(id)) {
    material = await prisma.materials.findUnique({
      where: { id: normalizeId(id) },
      include: {
        material_categories: {
          include: {
            parent: true,
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
  }

  if (!material) {
    throw new NotFoundError('Material', id);
  }

  // Transform Decimal fields to numbers
  const transformedMaterial = {
    ...material,
    reorderLevel: material.reorderLevel ? Number(material.reorderLevel) : null,
  };

  res.json({ data: transformedMaterial });
};

/**
 * Update material
 * PUT /api/materials/:id
 */
export const updateMaterial = async (req: Request, res: Response): Promise<void> => {
  let { id } = req.params;
  const {
    code,
    name,
    categoryId,
    description,
    specifications,
    unit,
    reorderLevel,
    hsnCode,
    gstRate,
    suppliers, // Array of {supplierId, isPreferred, isActive, notes}
    image,
    categoryData,
  } = req.body;

  // Check if material exists (try lowercase for non-UUID IDs)
  let existingMaterial = await prisma.materials.findUnique({
    where: { id },
  });

  // If not found and ID looks like a custom format (not UUID), try lowercase
  if (!existingMaterial && !isUUID(id)) {
    id = normalizeId(id);
    existingMaterial = await prisma.materials.findUnique({
      where: { id },
    });
  }

  if (!existingMaterial) {
    throw new NotFoundError('Material', id);
  }

  // Check if code is being changed and if new code already exists
  if (code !== existingMaterial.code) {
    const codeExists = await prisma.materials.findFirst({
      where: { code, isActive: true },
    });

    if (codeExists) {
      throw new ConflictError('Material code already exists');
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
    hsnCode: hsnCode !== undefined ? (hsnCode || null) : undefined,
    gstRate: gstRate !== undefined ? (gstRate ? parseFloat(gstRate) : null) : undefined,
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
        supplierPrice: s.supplierPrice ?? null,
        leadTimeDays: s.leadTimeDays ?? null,
        moq: s.moq ?? null,
        moqUnit: s.moqUnit || null,
        isPrimary: s.isPrimary || false,
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
};

/**
 * Delete material (soft delete)
 * DELETE /api/materials/:id
 */
export const deleteMaterial = async (req: Request, res: Response): Promise<void> => {
  let { id } = req.params;

  let material = await prisma.materials.findUnique({
    where: { id },
  });

  // If not found and ID looks like a custom format (not UUID), try lowercase
  if (!material && !isUUID(id)) {
    id = normalizeId(id);
    material = await prisma.materials.findUnique({
      where: { id },
    });
  }

  if (!material) {
    throw new NotFoundError('Material', id);
  }

  await prisma.materials.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({
    message: 'Material deleted successfully',
  });
};

/**
 * Get all material categories
 * GET /api/materials/categories
 */
export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * Get category hierarchy (parents with children nested)
 * GET /api/materials/categories/hierarchy
 */
export const getCategoryHierarchy = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * Create material category
 * POST /api/materials/categories
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  const { name, description } = req.body;

  // Check if category already exists
  const existingCategory = await prisma.material_categories.findFirst({
    where: { name, isActive: true },
  });

  if (existingCategory) {
    throw new ConflictError('Category name already exists');
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
};
