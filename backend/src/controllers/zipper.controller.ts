import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, allocateBatchCodes } from '../utils/code-generator';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import { trimStockService } from '../services/trim-stock.service';
import { syncMasterToMaterials } from '../services/helpers/material-sync.helper';

// Type for supplier input
interface ZipperSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerPiece?: number | string;
}

/**
 * Create a single zipper item
 * Auto-generates zipperCode and creates corresponding material entry
 * Supports multiple suppliers via suppliers array
 */
export const createZipper = async (req: Request, res: Response) => {
  const {
    zipperName,
    supplierCode,
    buyerCode,
    length,
    teethType,
    color,
    brand,
    sliderType,
    tapeWidth,
    pricePerPiece,
    supplierId,
    description,
    suppliers = [], // Array of supplier relationships
  } = req.body;

  // BUG-ZP4: Check for duplicate supplierIds before proceeding
  if (suppliers && suppliers.length > 0) {
    const supplierIds = suppliers.map((s: ZipperSupplierInput) => s.supplierId);
    const uniqueSupplierIds = new Set(supplierIds);
    if (supplierIds.length !== uniqueSupplierIds.size) {
      throw new ValidationError('Duplicate suppliers are not allowed. Each supplier can only be linked once.');
    }
  }

  // Auto-generate zipper code
  const zipperCode = await generateCode('ZIP', 'zipper_master', 'zipperCode');

  // Auto-generate zipperName if not provided
  let finalZipperName = zipperName;
  if (!finalZipperName || finalZipperName.trim() === '') {
    const parts = [];
    if (buyerCode) parts.push(`[${buyerCode}]`);
    if (color) parts.push(color);
    if (teethType) parts.push(teethType);
    parts.push('Zipper');
    if (length) parts.push(`${length}"`);
    if (brand) parts.push(brand);
    finalZipperName = parts.join(' ').trim() || `Zipper ${zipperCode}`;
  }

  // Get Zipper category ID
  const zipperCategory = await prisma.material_categories.findFirst({
    where: { name: 'Zipper' },
  });

  if (!zipperCategory) {
    throw new BusinessError('Zipper category not found. Please run Phase 1 migration.');
  }

  // Create zipper_master entry with suppliers using Prisma
  const zipperRecord = await prisma.zipper_master.create({
    data: {
      zipperCode,
      zipperName: finalZipperName,
      supplierCode: supplierCode || null,
      buyerCode: buyerCode || null,
      // BUG-ZP3: Guard against NaN from parseFloat
      length: length && !isNaN(parseFloat(length)) ? parseFloat(length) : null,
      teethType: teethType || null,
      color: color || null,
      brand: brand || null,
      sliderType: sliderType || null,
      tapeWidth: tapeWidth && !isNaN(parseFloat(tapeWidth)) ? parseFloat(tapeWidth) : null,
      pricePerPiece: pricePerPiece && !isNaN(parseFloat(pricePerPiece)) ? parseFloat(pricePerPiece) : null,
      supplierId: supplierId || null,
      description: description || null,
      isActive: true,
      // Create supplier relationships
      zipperSuppliers: {
        create: suppliers.map((s: ZipperSupplierInput) => ({
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
          // BUG-ZP3: Guard against NaN from parseFloat
          pricePerPiece: s.pricePerPiece
            ? isNaN(parseFloat(String(s.pricePerPiece)))
              ? null
              : parseFloat(String(s.pricePerPiece))
            : null,
        })),
      },
    },
    include: {
      zipperSuppliers: {
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
      id: `mat-${zipperCode.toLowerCase()}`,
      code: zipperCode,
      name: finalZipperName,
      materialType: 'ZIPPER',
      zipperId: zipperRecord.id,
      categoryId: zipperCategory.id,
      unit: 'PIECE',
      isActive: true,
    },
  });

  res.status(201).json({
    zipper: zipperRecord,
    material,
    message: 'Zipper created successfully',
  });
};

/**
 * Get all zipper items with pagination and search
 * Includes suppliers
 */
export const getAllZipper = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search = '', supplierId = '', isActive } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;

  // Build where clause - default to active only, but allow showing inactive via query param
  const where: {
    isActive?: boolean;
    OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
    zipperSuppliers?: { some: { supplierId: string; isActive: boolean } };
  } = {};

  // Only filter by isActive if explicitly provided, otherwise default to true
  if (isActive === 'false') {
    where.isActive = false;
  } else if (isActive === 'all') {
    // Don't filter by isActive - show all
  } else {
    where.isActive = true;
  }

  if (search) {
    where.OR = [
      { zipperName: { contains: String(search), mode: 'insensitive' } },
      { zipperCode: { contains: String(search), mode: 'insensitive' } },
      { color: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  // Filter by supplier via junction table
  if (supplierId) {
    where.zipperSuppliers = {
      some: {
        supplierId: String(supplierId),
        isActive: true,
      },
    };
  }

  // Get total count
  const total = await prisma.zipper_master.count({ where });

  // Get zippers with relations including suppliers
  const zipperItems = await prisma.zipper_master.findMany({
    where,
    include: {
      materials: {
        select: { id: true, code: true },
      },
      zipperSuppliers: {
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
  const transformedItems = zipperItems.map((item: any) => ({
    ...item,
    materialId: item.materials[0]?.id || null,
    materialCode: item.materials[0]?.code || null,
    materials: undefined,
    // Keep zipperSuppliers - serializer will rename to 'suppliers'
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
 * Get single zipper item by ID
 * Includes suppliers
 */
export const getZipperById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const zipper = await prisma.zipper_master.findUnique({
    where: { id },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      zipperSuppliers: {
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

  if (!zipper) {
    throw new NotFoundError('Zipper', id);
  }

  // Transform to match expected format
  const transformed = {
    ...zipper,
    materialId: zipper.materials[0]?.id || null,
    materialCode: zipper.materials[0]?.code || null,
    materials: undefined,
    // Keep zipperSuppliers - serializer will rename to 'suppliers'
  };

  res.json(transformed);
};

/**
 * Update zipper item
 * Note: zipperCode cannot be changed
 * Supports updating suppliers via suppliers array (delete-and-recreate pattern)
 */
export const updateZipper = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    zipperName,
    supplierCode,
    buyerCode,
    length,
    teethType,
    color,
    brand,
    sliderType,
    tapeWidth,
    pricePerPiece,
    supplierId,
    description,
    isActive,
    suppliers, // Array of supplier relationships (replaces existing)
  } = req.body;

  // Check if zipper exists
  const existing = await prisma.zipper_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Zipper', id);
  }

  // Update suppliers if provided (delete-and-recreate pattern)
  if (suppliers !== undefined && Array.isArray(suppliers)) {
    // BUG-ZP4: Check for duplicate supplierIds before proceeding
    const supplierIds = suppliers.map((s: ZipperSupplierInput) => s.supplierId);
    const uniqueSupplierIds = new Set(supplierIds);
    if (supplierIds.length !== uniqueSupplierIds.size) {
      throw new ValidationError('Duplicate suppliers are not allowed. Each supplier can only be linked once.');
    }

    // Delete existing supplier relationships
    await prisma.zipper_suppliers.deleteMany({
      where: { zipperId: id },
    });

    // Create new supplier relationships
    if (suppliers.length > 0) {
      await prisma.zipper_suppliers.createMany({
        data: suppliers.map((s: ZipperSupplierInput) => ({
          zipperId: id,
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
          // BUG-ZP3: Guard against NaN from parseFloat
          pricePerPiece: s.pricePerPiece
            ? isNaN(parseFloat(String(s.pricePerPiece)))
              ? null
              : parseFloat(String(s.pricePerPiece))
            : null,
        })),
      });
    }
  }

  // Update zipper
  const updated = await prisma.zipper_master.update({
    where: { id },
    data: {
      ...(zipperName !== undefined && { zipperName }),
      ...(supplierCode !== undefined && { supplierCode: supplierCode || null }),
      ...(buyerCode !== undefined && { buyerCode: buyerCode || null }),
      // BUG-ZP3: Guard against NaN from parseFloat
      ...(length !== undefined && { length: length && !isNaN(parseFloat(length)) ? parseFloat(length) : null }),
      ...(teethType !== undefined && { teethType: teethType || null }),
      ...(color !== undefined && { color: color || null }),
      ...(brand !== undefined && { brand: brand || null }),
      ...(sliderType !== undefined && { sliderType: sliderType || null }),
      ...(tapeWidth !== undefined && {
        tapeWidth: tapeWidth && !isNaN(parseFloat(tapeWidth)) ? parseFloat(tapeWidth) : null,
      }),
      ...(pricePerPiece !== undefined && {
        pricePerPiece: pricePerPiece && !isNaN(parseFloat(pricePerPiece)) ? parseFloat(pricePerPiece) : null,
      }),
      ...(supplierId !== undefined && { supplierId: supplierId || null }),
      ...(description !== undefined && { description: description || null }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      zipperSuppliers: {
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
  // Note: zipperCode is not updated (auto-generated), only sync name changes
  if (zipperName && zipperName !== existing.zipperName) {
    await syncMasterToMaterials(id, 'ZIPPER', { name: zipperName });
  }

  // Transform response
  const transformed = {
    ...updated,
    materialId: updated.materials[0]?.id || null,
    materialCode: updated.materials[0]?.code || null,
    materials: undefined,
    // Keep zipperSuppliers - serializer will rename to 'suppliers'
  };

  res.json({
    zipper: transformed,
    message: 'Zipper updated successfully',
  });
};

/**
 * Delete zipper item
 * Checks if zipper is used in any BOM first
 */
export const deleteZipper = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if zipper exists
  const existing = await prisma.zipper_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Zipper', id);
  }

  // Check if used in BOM
  // Also guard the STYLE BOM (style_material_bom) — it holds the live bill-of-materials and its
  // FKs are ON DELETE SET NULL, so deleting a zipper still referenced there silently orphans those
  // BOM lines. Checking the order BOM alone is not enough (bug-hunt BH-0286).
  const [orderBomUsage, styleBomUsage] = await Promise.all([
    prisma.order_bom_items.count({ where: { zipperId: id } }),
    prisma.style_material_bom.count({ where: { zipperId: id } }),
  ]);
  const bomUsage = orderBomUsage + styleBomUsage;

  if (bomUsage > 0) {
    throw new BusinessError(
      `Cannot delete zipper. This zipper is used in ${bomUsage} BOM(s). Please remove from BOMs first.`
    );
  }

  // Delete material entry first (FK constraint)
  await prisma.materials.deleteMany({
    where: { zipperId: id },
  });

  // Delete zipper (cascade will delete zipper_suppliers)
  await prisma.zipper_master.delete({
    where: { id },
  });

  res.json({ message: 'Zipper deleted successfully' });
};

/**
 * Bulk import zipper items from Excel
 * Auto-generates codes and creates material entries
 */
export const bulkImportZipper = async (req: Request, res: Response) => {
  const { data, createStock = false } = req.body;
  const userId = req.user?.userId || 'system';

  if (!Array.isArray(data) || data.length === 0) {
    throw new ValidationError('Data array is required');
  }

  // Get Zipper category
  const zipperCategory = await prisma.material_categories.findFirst({
    where: { name: 'Zipper' },
  });

  if (!zipperCategory) {
    throw new BusinessError('Zipper category not found');
  }

  // Pre-generate all codes
  const codes = await allocateBatchCodes('ZIP', 'zipper_master', 'zipperCode', data.length);

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
    const zipperCode = codes[i];

    try {
      // Validate required field
      if (!row.zipperName || row.zipperName.trim() === '') {
        results.push({
          success: false,
          row: i + 1,
          error: 'Zipper name is required',
        });
        continue;
      }

      // Create zipper + material atomically so a failure cannot leave a master without its materials record
      const zipperRecord = await prisma.$transaction(async (tx) => {
        const created = await tx.zipper_master.create({
          data: {
            zipperCode,
            zipperName: row.zipperName,
            supplierCode: row.supplierCode || null,
            buyerCode: row.buyerCode || null,
            // BUG-ZP3: Guard against NaN from parseFloat
            length: row.length && !isNaN(parseFloat(row.length)) ? parseFloat(row.length) : null,
            teethType: row.teethType || null,
            color: row.color || null,
            brand: row.brand || null,
            sliderType: row.sliderType || null,
            tapeWidth: row.tapeWidth && !isNaN(parseFloat(row.tapeWidth)) ? parseFloat(row.tapeWidth) : null,
            pricePerPiece:
              row.pricePerPiece && !isNaN(parseFloat(row.pricePerPiece)) ? parseFloat(row.pricePerPiece) : null,
            description: row.description || null,
            isActive: true,
          },
        });

        // Create material
        await tx.materials.create({
          data: {
            id: `mat-${zipperCode.toLowerCase()}`,
            code: zipperCode,
            name: row.zipperName,
            materialType: 'ZIPPER',
            zipperId: created.id,
            categoryId: zipperCategory.id,
            unit: 'PIECE',
            isActive: true,
          },
        });

        return created;
      });

      // Create stock if requested - using specialized zipper_stock table
      let stockCreated = false;
      const stockQty = row.stockQuantity ? parseFloat(row.stockQuantity) : 0;
      if (createStock && !isNaN(stockQty) && stockQty > 0 && defaultWarehouse) {
        const purchaseCost = row.purchaseCost ? parseFloat(row.purchaseCost) : 0;
        await trimStockService.createTrimStock(
          {
            trimType: 'ZIPPER',
            masterId: zipperRecord.id,
            quantity: stockQty,
            unit: 'PIECE',
            // BUG-ZP3: Guard against NaN from parseFloat
            purchaseCost: isNaN(purchaseCost) ? 0 : purchaseCost,
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
        zipperCode,
        materialCode: zipperCode,
        zipperName: row.zipperName,
        stockCreated,
      });
    } catch (error: any) {
      // allow-swallow — per-row bulk-import reporter: row writes are atomic ($transaction) and the failure is surfaced in results[]
      results.push({
        success: false,
        row: i + 1,
        zipperCode,
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
 * // BUG-ZP6 fix: description field included in template (verified present)
 */
export const downloadTemplate = async (req: Request, res: Response) => {
  const template = {
    columns: [
      { name: 'zipperName', required: true, description: 'Name of the zipper (Required)' },
      { name: 'supplierCode', required: false, description: "Supplier's reference code (Optional)" },
      { name: 'buyerCode', required: false, description: "Buyer's reference code (Optional)" },
      { name: 'length', required: false, description: 'Length in inches (Optional)' },
      { name: 'teethType', required: false, description: 'Teeth type (Metal, Plastic, Nylon, Invisible) (Optional)' },
      { name: 'color', required: false, description: 'Color name (Optional)' },
      { name: 'brand', required: false, description: 'Brand name (Optional)' },
      { name: 'sliderType', required: false, description: 'Slider type (Auto-lock, Pin-lock) (Optional)' },
      { name: 'tapeWidth', required: false, description: 'Tape width in mm (Optional)' },
      { name: 'pricePerPiece', required: false, description: 'Price per piece (Optional)' },
      { name: 'description', required: false, description: 'Description/notes (Optional)' },
      { name: 'stockQuantity', required: false, description: 'Initial stock quantity (Optional)' },
      { name: 'locationCode', required: false, description: 'Warehouse location code (Optional)' },
    ],
    exampleData: [
      {
        zipperName: 'Metal Zipper 12inch Black',
        supplierCode: 'ZIP-001',
        buyerCode: '',
        length: 12.0,
        teethType: 'Metal',
        color: 'Black',
        brand: 'YKK',
        sliderType: 'Auto-lock',
        tapeWidth: 25.0,
        pricePerPiece: 5.5,
        description: 'Heavy duty metal zipper for jackets',
        stockQuantity: 500,
        locationCode: 'WH-01',
      },
    ],
  };

  res.json(template);
};
