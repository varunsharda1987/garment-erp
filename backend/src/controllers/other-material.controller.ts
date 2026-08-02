import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, allocateBatchCodes } from '../utils/code-generator';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import { trimStockService } from '../services/trim-stock.service';
import { syncMasterToMaterials } from '../services/helpers/material-sync.helper';

// Type for supplier input
interface OtherMaterialSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerUnit?: number | string;
}

/**
 * Create a single other material item
 * Auto-generates materialCode and creates corresponding material entry
 * Supports multiple suppliers via suppliers array
 */
export const createOtherMaterial = async (req: Request, res: Response) => {
  const {
    materialName,
    category,
    unit,
    specifications,
    pricePerUnit,
    supplierId,
    description,
    suppliers = [],
  } = req.body;

  // Auto-generate material code
  const materialCode = await generateCode('OTH', 'other_material_master', 'materialCode');

  // Validate required fields
  if (!materialName || materialName.trim() === '') {
    throw new ValidationError('Material name is required');
  }

  // Get Other Materials category ID
  const otherMaterialCategory = await prisma.material_categories.findFirst({
    where: { name: 'Other' },
  });

  if (!otherMaterialCategory) {
    throw new BusinessError('Other Materials category not found. Please create it first.');
  }

  // Create other_material_master entry with suppliers using Prisma
  const materialRecord = await prisma.other_material_master.create({
    data: {
      materialCode,
      materialName,
      category: category || null,
      unit: unit || 'PIECE',
      specifications: specifications || null,
      pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : null,
      supplierId: supplierId || null,
      description: description || null,
      isActive: true,
      // Create supplier relationships
      otherMaterialSuppliers: {
        create: suppliers.map((s: OtherMaterialSupplierInput) => ({
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
          pricePerUnit: s.pricePerUnit ? parseFloat(String(s.pricePerUnit)) : null,
        })),
      },
    },
    include: {
      otherMaterialSuppliers: {
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
              contactPerson: true,
              email: true,
              phone: true,
              isActive: true,
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
    },
  });

  // Create corresponding material entry
  const materialEntry = await prisma.materials.create({
    data: {
      id: `mat-${materialCode.toLowerCase()}`,
      code: materialCode,
      name: materialName,
      materialType: 'OTHER',
      otherMaterialId: materialRecord.id,
      categoryId: otherMaterialCategory.id,
      unit: unit || 'PIECE',
      isActive: true,
    },
  });

  res.status(201).json({
    otherMaterial: materialRecord,
    material: materialEntry,
    message: 'Other material created successfully',
  });
};

/**
 * Get all other materials with pagination and search
 */
export const getAllOtherMaterials = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search = '', supplierId = '', category = '' } = req.query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 10);
  const offset = (pageNum - 1) * limitNum;

  // Build where clause
  const where: {
    isActive: boolean;
    OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
    otherMaterialSuppliers?: { some: { supplierId: string; isActive: boolean } };
    category?: { contains: string; mode: 'insensitive' };
  } = { isActive: true };

  if (search) {
    where.OR = [
      { materialName: { contains: String(search), mode: 'insensitive' } },
      { materialCode: { contains: String(search), mode: 'insensitive' } },
      { category: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  // Filter by supplier via junction table
  if (supplierId) {
    where.otherMaterialSuppliers = {
      some: {
        supplierId: String(supplierId),
        isActive: true,
      },
    };
  }

  // Filter by category
  if (category) {
    where.category = { contains: String(category), mode: 'insensitive' };
  }

  // Get total count
  const total = await prisma.other_material_master.count({ where });

  // Get other materials with relations
  const otherMaterials = await prisma.other_material_master.findMany({
    where,
    include: {
      materials: {
        select: { id: true, code: true },
      },
      otherMaterialSuppliers: {
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
              contactPerson: true,
              email: true,
              phone: true,
              isActive: true,
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limitNum,
  });

  // Transform to match expected format
  const transformedMaterials = otherMaterials.map((item: any) => ({
    ...item,
    materialId: item.materials[0]?.id || null,
    materialCodeRef: item.materials[0]?.code || null,
    materials: undefined,
    // Keep otherMaterialSuppliers - serializer will rename
  }));

  res.json({
    data: transformedMaterials,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get other material by ID
 */
export const getOtherMaterialById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const otherMaterial = await prisma.other_material_master.findUnique({
    where: { id },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      otherMaterialSuppliers: {
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
              contactPerson: true,
              email: true,
              phone: true,
              isActive: true,
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
    },
  });

  if (!otherMaterial) {
    throw new NotFoundError('Other material', id);
  }

  // Transform to match expected format
  const transformed = {
    ...otherMaterial,
    materialId: otherMaterial.materials[0]?.id || null,
    materialCodeRef: otherMaterial.materials[0]?.code || null,
    materials: undefined,
  };

  res.json(transformed);
};

/**
 * Update other material
 */
export const updateOtherMaterial = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { materialName, category, unit, specifications, pricePerUnit, supplierId, description, isActive, suppliers } =
    req.body;

  // Check if other material exists
  const existing = await prisma.other_material_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Other material', id);
  }

  // Update suppliers if provided (delete-and-recreate pattern)
  if (suppliers !== undefined && Array.isArray(suppliers)) {
    await prisma.other_material_suppliers.deleteMany({
      where: { otherMaterialId: id },
    });

    if (suppliers.length > 0) {
      await prisma.other_material_suppliers.createMany({
        data: suppliers.map((s: OtherMaterialSupplierInput) => ({
          otherMaterialId: id,
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
          pricePerUnit: s.pricePerUnit ? parseFloat(String(s.pricePerUnit)) : null,
        })),
      });
    }
  }

  // Update other material
  const updated = await prisma.other_material_master.update({
    where: { id },
    data: {
      ...(materialName !== undefined && { materialName }),
      ...(category !== undefined && { category: category || null }),
      ...(unit !== undefined && { unit: unit || 'PIECE' }),
      ...(specifications !== undefined && { specifications: specifications || null }),
      ...(pricePerUnit !== undefined && { pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : null }),
      ...(supplierId !== undefined && { supplierId: supplierId || null }),
      ...(description !== undefined && { description: description || null }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      otherMaterialSuppliers: {
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
              contactPerson: true,
              email: true,
              phone: true,
              isActive: true,
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
    },
  });

  // BUG-MM13 fix: sync code to materials
  // Note: materialCode is not updated (auto-generated), only sync name changes
  if (materialName && materialName !== existing.materialName) {
    await syncMasterToMaterials(id, 'OTHER_MATERIAL', { name: materialName });
  }

  // Transform response
  const transformed = {
    ...updated,
    materialId: updated.materials[0]?.id || null,
    materialCodeRef: updated.materials[0]?.code || null,
    materials: undefined,
  };

  res.json({
    otherMaterial: transformed,
    message: 'Other material updated successfully',
  });
};

/**
 * Delete other material
 */
export const deleteOtherMaterial = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if other material exists
  const existing = await prisma.other_material_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Other material', id);
  }

  // BUG-OM1 fix: Check BOTH BOM tables for usage
  // 1. style_material_bom has direct FK (otherMaterialId -> other_material_master.id)
  // 2. order_bom_items uses indirect path (materialId -> materials.id -> materials.otherMaterialId)

  // Check style_material_bom (direct FK)
  const styleBomUsage = await prisma.style_material_bom.count({
    where: { otherMaterialId: id },
  });

  if (styleBomUsage > 0) {
    throw new ValidationError(
      `Cannot delete other material. This material is used in ${styleBomUsage} style BOM(s). Please remove from style BOMs first.`
    );
  }

  // Find the corresponding materials record to check order BOM usage
  const materialRecord = await prisma.materials.findFirst({
    where: { otherMaterialId: id },
  });

  // Check order_bom_items (indirect path via materials table)
  if (materialRecord) {
    const orderBomUsage = await prisma.order_bom_items.count({
      where: {
        materialId: materialRecord.id,
      },
    });

    if (orderBomUsage > 0) {
      throw new ValidationError(
        `Cannot delete other material. This material is used in ${orderBomUsage} order BOM(s). Please remove from order BOMs first.`
      );
    }
  }

  // Delete material entry first (FK constraint)
  await prisma.materials.deleteMany({
    where: { otherMaterialId: id },
  });

  // Delete other material (cascade will delete other_material_suppliers)
  await prisma.other_material_master.delete({
    where: { id },
  });

  res.json({ message: 'Other material deleted successfully' });
};

/**
 * Bulk import other materials from Excel
 */
export const bulkImportOtherMaterials = async (req: Request, res: Response) => {
  const { data, createStock = false } = req.body;
  const userId = (req as any).user?.userId || 'system';

  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new ValidationError('No data provided for import');
  }

  // Get Other Materials category
  const otherMaterialCategory = await prisma.material_categories.findFirst({
    where: { name: 'Other' },
  });

  if (!otherMaterialCategory) {
    throw new BusinessError('Other Materials category not found');
  }

  // Pre-generate all material codes
  const codes = await allocateBatchCodes('OTH', 'other_material_master', 'materialCode', data.length);

  // Get default warehouse if creating stock
  let defaultWarehouse: any = null;
  if (createStock) {
    defaultWarehouse = await prisma.warehouses.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  const results: any[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const materialCode = codes[i];

    try {
      // Validate required field
      if (!row.materialName || row.materialName.trim() === '') {
        results.push({
          success: false,
          row: i + 1,
          error: 'Material name is required',
        });
        continue;
      }

      // Create other material + material atomically so a failure cannot leave a master without its materials record
      const materialRecord = await prisma.$transaction(async (tx) => {
        const created = await tx.other_material_master.create({
          data: {
            materialCode,
            materialName: row.materialName,
            category: row.category || null,
            unit: row.unit || 'PIECE',
            specifications: row.specifications || null,
            pricePerUnit: row.pricePerUnit ? parseFloat(row.pricePerUnit) : null,
            description: row.description || null,
            isActive: true,
          },
        });

        // Create material
        await tx.materials.create({
          data: {
            id: `mat-${materialCode.toLowerCase()}`,
            code: materialCode,
            name: row.materialName,
            materialType: 'OTHER',
            otherMaterialId: created.id,
            categoryId: otherMaterialCategory.id,
            unit: row.unit || 'PIECE',
            isActive: true,
          },
        });

        return created;
      });

      // Create stock if requested - using specialized other_material_stock table
      let stockCreated = false;
      if (createStock && row.stockQuantity && row.stockQuantity > 0 && defaultWarehouse) {
        await trimStockService.createTrimStock(
          {
            trimType: 'OTHER_MATERIAL',
            masterId: materialRecord.id,
            quantity: parseFloat(row.stockQuantity),
            unit: row.unit || 'PIECE',
            purchaseCost: row.purchaseCost ? parseFloat(row.purchaseCost) : 0,
            warehouseId: defaultWarehouse.id,
            sourceType: 'IMPORT',
          },
          userId
        );
        stockCreated = true;
      }

      results.push({
        success: true,
        row: i + 1,
        materialCode,
        materialName: row.materialName,
        stockCreated,
      });
    } catch (error: any) {
      // allow-swallow — per-row bulk-import reporter: row writes are atomic ($transaction) and the failure is surfaced in results[]
      results.push({
        success: false,
        row: i + 1,
        materialCode,
        error: error.message,
      });
    }
  }

  const summary = {
    total: data.length,
    success: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };

  res.json({
    results,
    summary,
    message: `Bulk import completed: ${summary.success} succeeded, ${summary.failed} failed`,
  });
};

/**
 * Download Excel template for bulk import
 */
export const downloadTemplate = async (req: Request, res: Response) => {
  const template = {
    columns: [
      {
        field: 'materialName',
        header: 'Material Name',
        required: true,
        description: 'Name of the material (Required)',
      },
      { field: 'category', header: 'Category', required: false, description: 'Material category (Optional)' },
      {
        field: 'unit',
        header: 'Unit',
        required: false,
        description: 'Unit of measurement (PIECE, METER, KG, etc.) (Optional)',
      },
      {
        field: 'specifications',
        header: 'Specifications',
        required: false,
        description: 'Technical specifications (Optional)',
      },
      { field: 'pricePerUnit', header: 'Price Per Unit', required: false, description: 'Price per unit (Optional)' },
      { field: 'description', header: 'Description', required: false, description: 'Description (Optional)' },
      {
        field: 'stockQuantity',
        header: 'Stock Quantity',
        required: false,
        description: 'Initial stock quantity (Optional)',
      },
      {
        field: 'locationCode',
        header: 'Location Code',
        required: false,
        description: 'Warehouse location code (Optional)',
      },
    ],
    exampleData: [
      {
        materialName: 'Safety Pin Pack',
        category: 'Miscellaneous',
        unit: 'PACK',
        specifications: 'Pack of 100 pins',
        pricePerUnit: 25.0,
        description: 'Safety pins for tagging and sampling',
        stockQuantity: 50,
        locationCode: 'WH-01-C',
      },
    ],
  };

  res.json(template);
};
