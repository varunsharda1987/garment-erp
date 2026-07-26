import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, allocateBatchCodes } from '../utils/code-generator';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import { trimStockService } from '../services/trim-stock.service';

// Type for supplier input
interface ElasticSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerMeter?: number | string;
}

/**
 * Create a single elastic item
 * Auto-generates elasticCode and creates corresponding material entry
 * Supports multiple suppliers via suppliers array
 */
export const createElastic = async (req: Request, res: Response) => {
  const {
    elasticName,
    supplierCode,
    buyerCode,
    width,
    stretchPercent,
    color,
    composition,
    elasticType,
    pricePerMeter,
    supplierId,
    description,
    suppliers = [], // Array of supplier relationships
  } = req.body;

  // Auto-generate elastic code
  const elasticCode = await generateCode('ELA', 'elastic_master', 'elasticCode');

  // Auto-generate elasticName if not provided
  let finalElasticName = elasticName;
  if (!finalElasticName || finalElasticName.trim() === '') {
    const parts = [];
    if (buyerCode) parts.push(`[${buyerCode}]`);
    if (color) parts.push(color);
    if (elasticType) parts.push(elasticType);
    parts.push('Elastic');
    if (width) parts.push(`${width}mm`);
    if (composition) parts.push(composition);
    finalElasticName = parts.join(' ').trim() || `Elastic ${elasticCode}`;
  }

  // Get Elastic category ID
  const elasticCategory = await prisma.material_categories.findFirst({
    where: { name: 'Elastic' },
  });

  if (!elasticCategory) {
    throw new BusinessError('Elastic category not found. Please run Phase 1 migration.');
  }

  // Create elastic_master entry with suppliers using Prisma
  const elasticRecord = await prisma.elastic_master.create({
    data: {
      elasticCode,
      elasticName: finalElasticName,
      supplierCode: supplierCode || null,
      buyerCode: buyerCode || null,
      width: width ? parseFloat(width) : null,
      stretchPercent: stretchPercent ? parseFloat(stretchPercent) : null,
      color: color || null,
      composition: composition || null,
      elasticType: elasticType || null,
      pricePerMeter: pricePerMeter ? parseFloat(pricePerMeter) : null,
      supplierId: supplierId || null,
      description: description || null,
      isActive: true,
      // Create supplier relationships
      elasticSuppliers: {
        create: suppliers.map((s: ElasticSupplierInput) => ({
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
          pricePerMeter: s.pricePerMeter ? parseFloat(String(s.pricePerMeter)) : null,
        })),
      },
    },
    include: {
      elasticSuppliers: {
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
  const material = await prisma.materials.create({
    data: {
      id: `mat-${elasticCode.toLowerCase()}`,
      code: elasticCode,
      name: finalElasticName,
      materialType: 'ELASTIC',
      elasticId: elasticRecord.id,
      categoryId: elasticCategory.id,
      unit: 'METER',
      isActive: true,
    },
  });

  res.status(201).json({
    elastic: elasticRecord,
    material,
    message: 'Elastic created successfully',
  });
};

/**
 * Get all elastic items with pagination and search
 * Includes suppliers
 */
export const getAllElastic = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search = '', supplierId = '' } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;

  // Build where clause
  const where: {
    isActive: boolean;
    OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
    elasticSuppliers?: { some: { supplierId: string; isActive: boolean } };
  } = { isActive: true };

  if (search) {
    where.OR = [
      { elasticName: { contains: String(search), mode: 'insensitive' } },
      { elasticCode: { contains: String(search), mode: 'insensitive' } },
      { color: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  // Filter by supplier via junction table
  if (supplierId) {
    where.elasticSuppliers = {
      some: {
        supplierId: String(supplierId),
        isActive: true,
      },
    };
  }

  // Get total count
  const total = await prisma.elastic_master.count({ where });

  // Get elastics with relations including suppliers
  const elasticItems = await prisma.elastic_master.findMany({
    where,
    include: {
      materials: {
        select: { id: true, code: true },
      },
      elasticSuppliers: {
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
  const transformedItems = elasticItems.map((item: any) => ({
    ...item,
    materialId: item.materials[0]?.id || null,
    materialCode: item.materials[0]?.code || null,
    materials: undefined,
    // Keep elasticSuppliers - serializer will rename to 'suppliers'
  }));

  res.json({
    data: transformedItems,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get single elastic item by ID
 * Includes suppliers
 */
export const getElasticById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const elastic = await prisma.elastic_master.findUnique({
    where: { id },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      elasticSuppliers: {
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

  if (!elastic) {
    throw new NotFoundError('Elastic', id);
  }

  // Transform to match expected format
  const transformed = {
    ...elastic,
    materialId: elastic.materials[0]?.id || null,
    materialCode: elastic.materials[0]?.code || null,
    materials: undefined,
    // Keep elasticSuppliers - serializer will rename to 'suppliers'
  };

  res.json(transformed);
};

/**
 * Update elastic item
 * Note: elasticCode cannot be changed
 * Supports updating suppliers via suppliers array (delete-and-recreate pattern)
 */
export const updateElastic = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    elasticName,
    supplierCode,
    buyerCode,
    width,
    stretchPercent,
    color,
    composition,
    elasticType,
    pricePerMeter,
    supplierId,
    description,
    isActive,
    suppliers, // Array of supplier relationships (replaces existing)
  } = req.body;

  // Check if elastic exists
  const existing = await prisma.elastic_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Elastic', id);
  }

  // Update suppliers if provided (delete-and-recreate pattern)
  if (suppliers !== undefined && Array.isArray(suppliers)) {
    // Delete existing supplier relationships
    await prisma.elastic_suppliers.deleteMany({
      where: { elasticId: id },
    });

    // Create new supplier relationships
    if (suppliers.length > 0) {
      await prisma.elastic_suppliers.createMany({
        data: suppliers.map((s: ElasticSupplierInput) => ({
          elasticId: id,
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
          pricePerMeter: s.pricePerMeter ? parseFloat(String(s.pricePerMeter)) : null,
        })),
      });
    }
  }

  // Update elastic
  const updated = await prisma.elastic_master.update({
    where: { id },
    data: {
      ...(elasticName !== undefined && { elasticName }),
      ...(supplierCode !== undefined && { supplierCode: supplierCode || null }),
      ...(buyerCode !== undefined && { buyerCode: buyerCode || null }),
      ...(width !== undefined && { width: width ? parseFloat(width) : null }),
      ...(stretchPercent !== undefined && { stretchPercent: stretchPercent ? parseFloat(stretchPercent) : null }),
      ...(color !== undefined && { color: color || null }),
      ...(composition !== undefined && { composition: composition || null }),
      ...(elasticType !== undefined && { elasticType: elasticType || null }),
      ...(pricePerMeter !== undefined && { pricePerMeter: pricePerMeter ? parseFloat(pricePerMeter) : null }),
      ...(supplierId !== undefined && { supplierId: supplierId || null }),
      ...(description !== undefined && { description: description || null }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      elasticSuppliers: {
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

  // Also update material name if elasticName changed
  if (elasticName) {
    await prisma.materials.updateMany({
      where: { elasticId: id },
      data: { name: elasticName },
    });
  }

  // Transform response
  const transformed = {
    ...updated,
    materialId: updated.materials[0]?.id || null,
    materialCode: updated.materials[0]?.code || null,
    materials: undefined,
    // Keep elasticSuppliers - serializer will rename to 'suppliers'
  };

  res.json({
    elastic: transformed,
    message: 'Elastic updated successfully',
  });
};

/**
 * Delete elastic item
 * Checks if elastic is used in any BOM first
 */
export const deleteElastic = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if elastic exists
  const existing = await prisma.elastic_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Elastic', id);
  }

  // Check if used in BOM
  // Also guard the STYLE BOM (style_material_bom) — it holds the live bill-of-materials and its
  // FKs are ON DELETE SET NULL, so deleting an elastic still referenced there silently orphans
  // those BOM lines. Checking the order BOM alone is not enough (bug-hunt BH-0286).
  const [orderBomUsage, styleBomUsage] = await Promise.all([
    prisma.order_bom_items.count({ where: { elasticId: id } }),
    prisma.style_material_bom.count({ where: { elasticId: id } }),
  ]);
  const bomUsage = orderBomUsage + styleBomUsage;

  if (bomUsage > 0) {
    throw new BusinessError(
      `Cannot delete elastic. This elastic is used in ${bomUsage} BOM(s). Please remove from BOMs first.`
    );
  }

  // Delete material entry first (FK constraint)
  await prisma.materials.deleteMany({
    where: { elasticId: id },
  });

  // Delete elastic (cascade will delete elastic_suppliers)
  await prisma.elastic_master.delete({
    where: { id },
  });

  res.json({ message: 'Elastic deleted successfully' });
};

/**
 * Bulk import elastic items from Excel
 * Auto-generates codes and creates material entries
 */
export const bulkImportElastic = async (req: Request, res: Response) => {
  const { data, createStock = false } = req.body;
  const userId = (req as any).user?.id || 'system';

  if (!Array.isArray(data) || data.length === 0) {
    throw new ValidationError('Data array is required');
  }

  // Get Elastic category
  const elasticCategory = await prisma.material_categories.findFirst({
    where: { name: 'Elastic' },
  });

  if (!elasticCategory) {
    throw new BusinessError('Elastic category not found');
  }

  // Pre-generate all codes
  const codes = await allocateBatchCodes('ELA', 'elastic_master', 'elasticCode', data.length);

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
    const elasticCode = codes[i];

    try {
      // Validate required field
      if (!row.elasticName || row.elasticName.trim() === '') {
        results.push({
          success: false,
          row: i + 1,
          error: 'Elastic name is required',
        });
        continue;
      }

      // Create elastic using Prisma
      const elasticRecord = await prisma.elastic_master.create({
        data: {
          elasticCode,
          elasticName: row.elasticName,
          supplierCode: row.supplierCode || null,
          buyerCode: row.buyerCode || null,
          width: row.width ? parseFloat(row.width) : null,
          stretchPercent: row.stretchPercent ? parseFloat(row.stretchPercent) : null,
          color: row.color || null,
          composition: row.composition || null,
          elasticType: row.elasticType || null,
          pricePerMeter: row.pricePerMeter ? parseFloat(row.pricePerMeter) : null,
          description: row.description || null,
          isActive: true,
        },
      });

      // Create material
      const materialId = `mat-${elasticCode.toLowerCase()}`;
      await prisma.materials.create({
        data: {
          id: materialId,
          code: elasticCode,
          name: row.elasticName,
          materialType: 'ELASTIC',
          elasticId: elasticRecord.id,
          categoryId: elasticCategory.id,
          unit: 'METER',
          isActive: true,
        },
      });

      // Create stock if requested - using specialized elastic_stock table
      let stockCreated = false;
      if (createStock && row.stockQuantity && row.stockQuantity > 0 && defaultWarehouse) {
        await trimStockService.createTrimStock(
          {
            trimType: 'ELASTIC',
            masterId: elasticRecord.id,
            quantity: parseFloat(row.stockQuantity),
            unit: 'METER',
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
        elasticCode,
        materialCode: elasticCode,
        elasticName: row.elasticName,
        stockCreated,
      });
    } catch (error: any) {
      results.push({
        success: false,
        row: i + 1,
        elasticCode,
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
      { name: 'elasticName', required: true, description: 'Name of the elastic (Required)' },
      { name: 'supplierCode', required: false, description: "Supplier's reference code (Optional)" },
      { name: 'buyerCode', required: false, description: "Buyer's reference code (Optional)" },
      { name: 'width', required: false, description: 'Width in mm (Optional)' },
      { name: 'stretchPercent', required: false, description: 'Stretch percentage (Optional)' },
      { name: 'elasticType', required: false, description: 'Elastic type (Woven, Knitted, Braided) (Optional)' },
      { name: 'color', required: false, description: 'Color name (Optional)' },
      { name: 'composition', required: false, description: 'Material composition (Optional)' },
      { name: 'pricePerMeter', required: false, description: 'Price per meter (Optional)' },
      { name: 'stockQuantity', required: false, description: 'Initial stock quantity (Optional)' },
      { name: 'locationCode', required: false, description: 'Warehouse location code (Optional)' },
    ],
    exampleData: [
      {
        elasticName: 'White Knitted Elastic 25mm',
        supplierCode: 'ELA-001',
        buyerCode: '',
        width: 25.0,
        stretchPercent: 150,
        elasticType: 'Knitted',
        color: 'White',
        composition: '80% Polyester 20% Rubber',
        pricePerMeter: 8.5,
        stockQuantity: 200,
        locationCode: 'WH-01',
      },
    ],
  };

  res.json(template);
};
