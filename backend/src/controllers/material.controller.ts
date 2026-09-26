/**
 * Material Management Controller
 *
 * BUG-MM11 DOCUMENTATION: Understanding the Dual Material Systems
 * ================================================================
 * This codebase has TWO related but distinct material tracking systems:
 *
 * 1. `materials` table (this controller) - Routes: /api/materials
 *    - Primary inventory tracking table with string UUID IDs
 *    - Has FK links to master tables (greigeId, fabricId, zipperId, etc.)
 *    - Used by: Stock Levels, GRN, Purchase Orders, MRP
 *    - Supports generic material suppliers via material_suppliers junction
 *
 * 2. `material_master` table (material-master.controller.ts) - Routes: /api/material-master
 *    - Legacy/alternate material catalog with integer auto-increment IDs
 *    - Simpler structure, no FK links to specialized masters
 *    - Used by: Some legacy imports and quick-add flows
 *
 * For NEW development, prefer the `materials` table (this controller) as it integrates
 * with the full master-table hierarchy (greige_master, fabric_master, etc.).
 * The `material_master` table exists for backward compatibility.
 */
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../errors';
import { normalizeId, isUUID } from '../utils/id-helper';
import { applySearch } from '../utils/search-filter';
import type { Unit } from '../schemas/generated/prisma-enums';
import { materialUsage } from '../services/helpers/material-unit.helper';
import { purchaseUnitFor } from '../services/helpers/purchase-unit.helper';
import { unitLabel } from '../utils/units';

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

  // BUG-MM12 FIX: Validate categoryId exists before creating material
  if (categoryId) {
    const category = await prisma.material_categories.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new ValidationError(`Category with ID ${categoryId} does not exist`);
    }
  }

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
          isPreferred: s.isPreferred ?? false,
          isActive: s.isActive ?? true,
          notes: s.notes ?? null,
          supplierPrice: s.supplierPrice ?? null,
          leadTimeDays: s.leadTimeDays ?? null,
          moq: s.moq ?? null,
          moqUnit: s.moqUnit ?? null,
          isPrimary: s.isPrimary ?? false,
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
  // req.query is RAW STRINGS under Express 5 (validateQuery only fills req.validatedQuery), so
  // coerce here — `take: "25"` is a Prisma error, which is what every explicit ?limit= produced.
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const skip = (page - 1) * limit;
  const search = req.query.search as string;
  const categoryId = req.query.categoryId as string;
  const supplierId = req.query.supplierId as string;
  const materialTypesParam = req.query.materialTypes as string;
  const materialTypes = materialTypesParam ? materialTypesParam.split(',').filter(Boolean) : [];
  const unit = req.query.unit as string;
  // Whitelisted (also in materialQuerySchema — validateQuery does not replace req.query): pickers
  // ask for code/asc so the alphabetically FIRST page comes back, the list page keeps newest-first.
  const SORTABLE = ['code', 'name', 'createdAt'] as const;
  const requestedSort = req.query.sortBy as string | undefined;
  const sortBy = (SORTABLE as readonly string[]).includes(requestedSort ?? '') ? requestedSort! : 'createdAt';
  const sortOrder: 'asc' | 'desc' =
    req.query.sortOrder === 'asc'
      ? 'asc'
      : req.query.sortOrder === 'desc'
        ? 'desc'
        : sortBy === 'createdAt'
          ? 'desc'
          : 'asc';

  const whereClause: Prisma.materialsWhereInput = { isActive: true };

  // Search filter - includes customer name search via linked master tables
  if (search) {
    applySearch(whereClause, search, [
      'code',
      'name',
      'description',
      'hsnCode',
      // The picker's placeholder says "code, name, category" — so category must actually match
      'material_categories.name',
      'label_master.customer.name',
      'packaging_master.customer.name',
    ]);
  }

  // Category filter
  if (categoryId) {
    whereClause.categoryId = categoryId;
  }

  // Supplier + materialType filter with OR logic
  // When both are present: show materials linked to this supplier OR matching these material types.
  // The search lives under AND (applySearch), so this OR can never collide with it — the earlier
  // hand-off between the two is gone.
  //
  // "Linked to this supplier" reads the label's and packaging's OWN supplier tables — the ones their
  // master pages write — as well as material_suppliers. material_suppliers is a copy nothing keeps up
  // for these two (a March sync linked one arbitrary size row per label), so a sized label offered
  // only its XS row on the PO form (2026-09-26). The label_master path matches the base row AND every
  // size row, since each carries labelId. Neither type is in the PO form's TRIMS type list.
  const supplierLinked: Prisma.materialsWhereInput[] = [
    { suppliers: { some: { supplierId, isActive: true } } },
    { label_master: { labelSuppliers: { some: { supplierId, isActive: true } } } },
    { packaging_master: { packaging_suppliers: { some: { supplierId, isActive: true } } } },
  ];
  if (supplierId && materialTypes.length > 0) {
    whereClause.OR = [...supplierLinked, { materialType: { in: materialTypes as any[] } }];
  } else if (supplierId) {
    whereClause.OR = supplierLinked;
  } else if (materialTypes.length > 0) {
    whereClause.materialType = { in: materialTypes as any[] };
  }

  // Unit filter — the query schema already validated it against the generated UnitEnum
  if (unit) {
    whereClause.unit = unit as Unit;
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
        // A label's size row names its size — the PO form groups a sized label into one size grid
        label_size_variant: { select: { size: true } },
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
            pricePerGross: true,
          },
        },
        snap_button_master: {
          select: {
            pricePerPiece: true,
            pricePerGross: true,
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
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.materials.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Transform materials - extract customer and costPerUnit from linked master tables
  const transformedMaterials = materials.map((material) => {
    // Get customer from whichever master table has data (only label and packaging have customer)
    const customer = material.label_master?.customer || material.packaging_master?.customer || null;

    // Compute costPerUnit from whichever master table has price data
    const costPerUnit = material.fabric_master?.costPerMeter
      ? Number(material.fabric_master.costPerMeter)
      : material.greige_master?.costPerMeter
        ? Number(material.greige_master.costPerMeter)
        : material.lace_master?.pricePerMeter
          ? Number(material.lace_master.pricePerMeter)
          : material.button_master?.pricePerPiece
            ? Number(material.button_master.pricePerPiece)
            : material.thread_master?.pricePerCone
              ? Number(material.thread_master.pricePerCone)
              : material.zipper_master?.pricePerPiece
                ? Number(material.zipper_master.pricePerPiece)
                : material.elastic_master?.pricePerMeter
                  ? Number(material.elastic_master.pricePerMeter)
                  : material.label_master?.pricePerPiece
                    ? Number(material.label_master.pricePerPiece)
                    : material.packaging_master?.pricePerPiece
                      ? Number(material.packaging_master.pricePerPiece)
                      : null;

    // Bought in another unit than it is counted in (buttons / snap buttons by the gross): what a PO line is in,
    // and its rate — the master's price per gross, else its price per piece × 144
    const purchase = purchaseUnitFor(material.materialType);
    const trimMaster = material.button_master ?? material.snap_button_master ?? null;
    const perPiece =
      trimMaster?.pricePerPiece != null ? Number(trimMaster.pricePerPiece) : costPerUnit != null ? costPerUnit : null;
    const purchaseUnitPrice = purchase
      ? trimMaster?.pricePerGross != null
        ? Number(trimMaster.pricePerGross)
        : perPiece != null
          ? Math.round(perPiece * purchase.stockUnitsPerUnit * 100) / 100
          : null
      : null;

    return {
      ...material,
      reorderLevel: material.reorderLevel ? Number(material.reorderLevel) : null,
      costPerUnit, // Add costPerUnit to the response
      purchaseUnit: purchase?.unit ?? null,
      stockUnitsPerPurchaseUnit: purchase?.stockUnitsPerUnit ?? null,
      purchaseUnitPrice,
      customer, // Add customer to the response
      // Clean up - remove master table objects from response
      label_master: undefined,
      packaging_master: undefined,
      fabric_master: undefined,
      greige_master: undefined,
      lace_master: undefined,
      button_master: undefined,
      snap_button_master: undefined,
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
    // Where it is used — the edit form locks the unit when this is not empty
    unitInUse: await materialUsage(material.id),
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

  // The unit is what every quantity already on this material's lines and stock means. Once any exist,
  // changing it would silently relabel them (2,300 PIECE of a metre fusing was exactly that, 2026-09-26).
  // An unused material can still be corrected.
  if (unit !== undefined && unit !== existingMaterial.unit) {
    const usage = await materialUsage(id);
    if (usage.length > 0) {
      throw new ConflictError(
        `${existingMaterial.name} is counted in ${unitLabel(existingMaterial.unit)} and is already used on ` +
          `${usage.join(', ')} — its unit cannot change. If it is bought or used in another unit, create a separate item.`
      );
    }
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

  // BUG-MM12 FIX: Validate categoryId exists before updating material
  if (categoryId) {
    const category = await prisma.material_categories.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new ValidationError(`Category with ID ${categoryId} does not exist`);
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
    hsnCode: hsnCode !== undefined ? hsnCode || null : undefined,
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
        isPreferred: s.isPreferred ?? false,
        isActive: s.isActive ?? true,
        notes: s.notes ?? null,
        supplierPrice: s.supplierPrice ?? null,
        leadTimeDays: s.leadTimeDays ?? null,
        moq: s.moq ?? null,
        moqUnit: s.moqUnit ?? null,
        isPrimary: s.isPrimary ?? false,
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
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
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
