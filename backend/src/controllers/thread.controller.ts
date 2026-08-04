import { Request, Response } from 'express';
import prisma from '../config/database';
import { getDerivedStockDetailed } from '../services/helpers/derived-stock.helper';
import { generateCode, allocateBatchCodes } from '../utils/code-generator';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import { threadStockService } from '../services/thread-stock.service';
import { syncMasterToMaterials } from '../services/helpers/material-sync.helper';
import { materialService } from '../services/material.service';

// Type for supplier input
interface ThreadSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerCone?: number | string;
}

/**
 * Create a single thread item
 * Auto-generates threadCode and creates corresponding material entry
 * Optionally associates with styles via styleCodes array
 * Supports multiple suppliers via suppliers array
 */
export const createThread = async (req: Request, res: Response) => {
  const {
    threadName,
    brand,
    packagingType, // 'CONE' or 'TUBE'
    piecesPerBox,
    metersPerUnit,
    color,
    colorCode,
    colorId, // FK to color_master
    coneSize,
    ply, // 2-Ply | 3-Ply
    materialComposition, // Polyester | Cotton
    unitsPerBox, // Auto-set based on ply + packaging
    pricePerCone,
    supplierCode,
    buyerCode,
    supplierId,
    description,
    styleCodes = [], // Array of style codes to associate
    suppliers = [], // Array of supplier relationships
  } = req.body;

  // Auto-generate thread code
  const threadCode = await generateCode('THR', 'thread_master', 'threadCode');

  // Auto-set piecesPerBox based on packagingType if not provided
  let finalPiecesPerBox = piecesPerBox;
  if (!finalPiecesPerBox && packagingType) {
    finalPiecesPerBox = packagingType === 'CONE' ? 6 : packagingType === 'TUBE' ? 10 : null;
  }

  // Auto-generate threadName if not provided
  let finalThreadName = threadName;
  if (!finalThreadName || finalThreadName.trim() === '') {
    const parts = [];
    if (buyerCode) parts.push(`[${buyerCode}]`);
    if (brand) parts.push(brand);
    if (color) parts.push(color);
    if (packagingType) parts.push(packagingType);
    parts.push('Thread');
    if (metersPerUnit) parts.push(`${metersPerUnit}m`);
    finalThreadName = parts.join(' ').trim() || `Thread ${threadCode}`;
  }

  // Validate styleCodes if provided
  let validStyles: { id: string; styleCode: string }[] = [];
  if (styleCodes.length > 0) {
    validStyles = await prisma.styles.findMany({
      where: { styleCode: { in: styleCodes } },
      select: { id: true, styleCode: true },
    });

    const foundCodes = validStyles.map((s) => s.styleCode);
    const invalidCodes = styleCodes.filter((code: string) => !foundCodes.includes(code));
    if (invalidCodes.length > 0) {
      throw new ValidationError('Invalid style codes', { invalidCodes });
    }
  }

  // Create master + its materials record atomically (materials.id === master.id — material-identity invariant)
  const { threadRecord, materialEntry } = await prisma.$transaction(async (tx) => {
    const created = await tx.thread_master.create({
      data: {
        threadCode,
        threadName: finalThreadName,
        brand: brand || null,
        packagingType: packagingType || null,
        piecesPerBox: finalPiecesPerBox || null,
        metersPerUnit: metersPerUnit ? parseFloat(metersPerUnit) : null,
        color: color || null,
        colorCode: colorCode || null,
        colorId: colorId || null,
        coneSize: coneSize || null,
        ply: ply || null,
        materialComposition: materialComposition || null,
        unitsPerBox: unitsPerBox ? parseInt(unitsPerBox, 10) : null,
        pricePerCone: pricePerCone ? parseFloat(pricePerCone) : null,
        supplierCode: supplierCode || null,
        buyerCode: buyerCode || null,
        supplierId: supplierId || null,
        description: description || null,
        isActive: true,
        // Create supplier relationships
        threadSuppliers: {
          create: suppliers.map((s: ThreadSupplierInput) => ({
            supplierId: s.supplierId,
            isPreferred: s.isPreferred || false,
            isActive: s.isActive !== undefined ? s.isActive : true,
            notes: s.notes || null,
            pricePerCone: s.pricePerCone ? parseFloat(String(s.pricePerCone)) : null,
          })),
        },
      },
      include: {
        threadSuppliers: {
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

    // Create style associations if provided
    if (validStyles.length > 0) {
      await tx.thread_style_associations.createMany({
        data: validStyles.map((style, index) => ({
          threadId: created.id,
          styleId: style.id,
          isPrimary: index === 0,
        })),
      });
    }

    const material = await materialService.createFromMaster(
      { id: created.id, code: threadCode, name: finalThreadName },
      'THREAD',
      tx
    );

    return { threadRecord: created, materialEntry: material };
  });

  res.status(201).json({
    thread: {
      ...threadRecord,
      styleCodes: validStyles.map((s) => s.styleCode),
    },
    material: materialEntry,
    message: 'Thread created successfully',
  });
};

/**
 * Get all threads with pagination and search
 * Includes associated style codes and suppliers
 */
export const getAllThreads = async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    supplierId = '',
    styleCode = '', // Filter by specific style
  } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;

  // Build where clause
  const where: {
    isActive: boolean;
    OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
    threadSuppliers?: { some: { supplierId: string; isActive: boolean } };
    thread_style_associations?: { some: { style: { styleCode: string } } };
  } = { isActive: true };

  if (search) {
    where.OR = [
      { threadName: { contains: String(search), mode: 'insensitive' } },
      { threadCode: { contains: String(search), mode: 'insensitive' } },
      { color: { contains: String(search), mode: 'insensitive' } },
      { colorCode: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  // Filter by supplier via junction table
  if (supplierId) {
    where.threadSuppliers = {
      some: {
        supplierId: String(supplierId),
        isActive: true,
      },
    };
  }

  // Filter by style code if provided
  if (styleCode) {
    where.thread_style_associations = {
      some: {
        style: { styleCode: String(styleCode) },
      },
    };
  }

  // Get total count
  const total = await prisma.thread_master.count({ where });

  // Get threads with relations including suppliers and style associations
  const threads = await prisma.thread_master.findMany({
    where,
    include: {
      materials: {
        select: { id: true, code: true },
      },
      threadSuppliers: {
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
      thread_style_associations: {
        include: {
          style: {
            select: { styleCode: true, styleName: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limitNum,
  });

  // Transform to match expected format
  const transformedThreads = threads.map((item: any) => ({
    ...item,
    materialId: item.materials[0]?.id || null,
    materialCode: item.materials[0]?.code || null,
    styleCodes: item.thread_style_associations.map((sa: any) => sa.style.styleCode),
    styleNames: item.thread_style_associations.map((sa: any) => sa.style.styleName),
    materials: undefined,
    thread_style_associations: undefined,
    // Keep threadSuppliers - serializer will rename to 'suppliers'
  }));

  res.json({
    data: transformedThreads,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get thread by ID
 * Includes associated style codes and suppliers
 */
export const getThreadById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const thread = await prisma.thread_master.findUnique({
    where: { id },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      threadSuppliers: {
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
      thread_style_associations: {
        include: {
          style: {
            select: { styleCode: true, styleName: true },
          },
        },
        orderBy: { isPrimary: 'desc' },
      },
    },
  });

  if (!thread) {
    throw new NotFoundError('Thread', id);
  }

  // Transform to match expected format
  const transformed = {
    ...thread,
    materialId: thread.materials[0]?.id || null,
    materialCode: thread.materials[0]?.code || null,
    styleCodes: thread.thread_style_associations.map((sa: any) => sa.style.styleCode),
    styleNames: thread.thread_style_associations.map((sa: any) => sa.style.styleName),
    materials: undefined,
    thread_style_associations: undefined,
    // Keep threadSuppliers - serializer will rename to 'suppliers'
  };

  res.json(transformed);
};

/**
 * Update thread
 * Supports updating style associations via styleCodes array
 * Supports updating suppliers via suppliers array (delete-and-recreate pattern)
 */
export const updateThread = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    threadName,
    brand,
    packagingType, // 'CONE' or 'TUBE'
    piecesPerBox,
    metersPerUnit,
    color,
    colorCode,
    colorId, // FK to color_master
    coneSize,
    ply, // 2-Ply | 3-Ply
    materialComposition, // Polyester | Cotton
    unitsPerBox, // Auto-set based on ply + packaging
    pricePerCone,
    supplierCode,
    buyerCode,
    supplierId,
    description,
    isActive,
    styleCodes, // Array of style codes to associate (replaces existing)
    suppliers, // Array of supplier relationships (replaces existing)
  } = req.body;

  // Auto-set piecesPerBox based on packagingType if packagingType is provided but piecesPerBox isn't
  let finalPiecesPerBox = piecesPerBox;
  if (packagingType !== undefined && piecesPerBox === undefined) {
    finalPiecesPerBox = packagingType === 'CONE' ? 6 : packagingType === 'TUBE' ? 10 : null;
  }

  // Check if thread exists
  const existing = await prisma.thread_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Thread', id);
  }

  // Validate styleCodes if provided
  let validStyles: { id: string; styleCode: string }[] = [];
  if (styleCodes !== undefined && Array.isArray(styleCodes)) {
    if (styleCodes.length > 0) {
      validStyles = await prisma.styles.findMany({
        where: { styleCode: { in: styleCodes } },
        select: { id: true, styleCode: true },
      });

      const foundCodes = validStyles.map((s) => s.styleCode);
      const invalidCodes = styleCodes.filter((code: string) => !foundCodes.includes(code));
      if (invalidCodes.length > 0) {
        throw new ValidationError('Invalid style codes', { invalidCodes });
      }
    }

    // Delete existing associations and create new ones
    await prisma.thread_style_associations.deleteMany({
      where: { threadId: id },
    });

    if (validStyles.length > 0) {
      await prisma.thread_style_associations.createMany({
        data: validStyles.map((style, index) => ({
          threadId: id,
          styleId: style.id,
          isPrimary: index === 0,
        })),
      });
    }
  }

  // Update suppliers if provided (delete-and-recreate pattern)
  if (suppliers !== undefined && Array.isArray(suppliers)) {
    // Delete existing supplier relationships
    await prisma.thread_suppliers.deleteMany({
      where: { threadId: id },
    });

    // Create new supplier relationships
    if (suppliers.length > 0) {
      await prisma.thread_suppliers.createMany({
        data: suppliers.map((s: ThreadSupplierInput) => ({
          threadId: id,
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
          pricePerCone: s.pricePerCone ? parseFloat(String(s.pricePerCone)) : null,
        })),
      });
    }
  }

  // Determine final values for name generation (use new values if provided, otherwise use existing)
  const finalBuyerCode = buyerCode !== undefined ? buyerCode : existing.buyerCode;
  const finalBrand = brand !== undefined ? brand : existing.brand;
  const finalColor = color !== undefined ? color : existing.color;
  const finalPackagingType = packagingType !== undefined ? packagingType : existing.packagingType;
  const finalMetersPerUnit =
    metersPerUnit !== undefined ? (metersPerUnit ? parseFloat(metersPerUnit) : null) : existing.metersPerUnit;

  // Auto-regenerate threadName if it was originally auto-generated (empty input) or if name is not explicitly provided
  // If threadName is empty string or not provided, regenerate from attributes
  let finalThreadName = threadName;
  if (!threadName || threadName.trim() === '') {
    const parts = [];
    if (finalBuyerCode) parts.push(`[${finalBuyerCode}]`);
    if (finalBrand) parts.push(finalBrand);
    if (finalColor) parts.push(finalColor);
    if (finalPackagingType) parts.push(finalPackagingType);
    parts.push('Thread');
    if (finalMetersPerUnit) parts.push(`${finalMetersPerUnit}m`);
    finalThreadName = parts.join(' ').trim() || `Thread ${existing.threadCode}`;
  }

  // Update thread
  const updated = await prisma.thread_master.update({
    where: { id },
    data: {
      threadName: finalThreadName,
      ...(brand !== undefined && { brand: brand || null }),
      ...(packagingType !== undefined && { packagingType: packagingType || null }),
      ...(finalPiecesPerBox !== undefined && { piecesPerBox: finalPiecesPerBox || null }),
      ...(metersPerUnit !== undefined && { metersPerUnit: metersPerUnit ? parseFloat(metersPerUnit) : null }),
      ...(color !== undefined && { color: color || null }),
      ...(colorCode !== undefined && { colorCode: colorCode || null }),
      ...(colorId !== undefined && { colorId: colorId || null }),
      ...(coneSize !== undefined && { coneSize: coneSize || null }),
      ...(ply !== undefined && { ply: ply || null }),
      ...(materialComposition !== undefined && { materialComposition: materialComposition || null }),
      ...(unitsPerBox !== undefined && { unitsPerBox: unitsPerBox ? parseInt(unitsPerBox, 10) : null }),
      ...(pricePerCone !== undefined && { pricePerCone: pricePerCone ? parseFloat(pricePerCone) : null }),
      ...(supplierCode !== undefined && { supplierCode: supplierCode || null }),
      ...(buyerCode !== undefined && { buyerCode: buyerCode || null }),
      ...(supplierId !== undefined && { supplierId: supplierId || null }),
      ...(description !== undefined && { description: description || null }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      threadSuppliers: {
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
      thread_style_associations: {
        include: {
          style: {
            select: { styleCode: true, styleName: true },
          },
        },
      },
    },
  });

  // BUG-MM13 fix: sync code to materials
  // Note: threadCode is not updated (auto-generated), only sync name changes
  if (finalThreadName && finalThreadName !== existing.threadName) {
    await syncMasterToMaterials(id, 'THREAD', { name: finalThreadName });
  }

  // Transform response
  const transformed = {
    ...updated,
    materialId: updated.materials[0]?.id || null,
    materialCode: updated.materials[0]?.code || null,
    styleCodes: updated.thread_style_associations.map((sa: any) => sa.style.styleCode),
    styleNames: updated.thread_style_associations.map((sa: any) => sa.style.styleName),
    materials: undefined,
    thread_style_associations: undefined,
    // Keep threadSuppliers - serializer will rename to 'suppliers'
  };

  res.json({
    thread: transformed,
    message: 'Thread updated successfully',
  });
};

/**
 * Delete thread
 * Checks if thread is used in any BOM first
 */
export const deleteThread = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if thread exists
  const existing = await prisma.thread_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Thread', id);
  }

  // Check if used in any BOM
  // Also guard the STYLE BOM (style_material_bom) — it holds the live bill-of-materials and its
  // FKs are ON DELETE SET NULL, so deleting a thread still referenced there silently orphans those
  // BOM lines. Checking the order BOM alone is not enough (bug-hunt BH-0286).
  const [orderBomUsage, styleBomUsage] = await Promise.all([
    prisma.order_bom_items.count({ where: { threadId: id } }),
    prisma.style_material_bom.count({ where: { threadId: id } }),
  ]);
  const bomUsage = orderBomUsage + styleBomUsage;

  if (bomUsage > 0) {
    throw new BusinessError(
      `Cannot delete thread. This thread is used in ${bomUsage} BOM(s). Please remove from BOMs first.`
    );
  }

  // Delete material entry first (FK constraint)
  await prisma.materials.deleteMany({
    where: { threadId: id },
  });

  // Delete thread (cascade will delete thread_suppliers)
  await prisma.thread_master.delete({
    where: { id },
  });

  res.json({ message: 'Thread deleted successfully' });
};

/**
 * Bulk import threads from Excel
 * Auto-generates codes and creates material entries
 */
export const bulkImportThreads = async (req: Request, res: Response) => {
  const { data, createStock = false } = req.body;
  const userId = req.user?.userId || 'system';

  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new ValidationError('No data provided for import');
  }

  // Pre-generate all thread codes
  const codes = await allocateBatchCodes('THR', 'thread_master', 'threadCode', data.length);

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
    const threadCode = codes[i];

    try {
      // Validate required field
      if (!row.threadName || row.threadName.trim() === '') {
        results.push({
          success: false,
          row: i + 1,
          error: 'Thread name is required',
        });
        continue;
      }

      // Auto-set piecesPerBox based on packagingType
      let rowPiecesPerBox = row.piecesPerBox;
      if (!rowPiecesPerBox && row.packagingType) {
        rowPiecesPerBox = row.packagingType === 'CONE' ? 6 : row.packagingType === 'TUBE' ? 10 : null;
      }

      // Create thread + material atomically so a failure cannot leave a master without its materials record
      const threadRecord = await prisma.$transaction(async (tx) => {
        const created = await tx.thread_master.create({
          data: {
            threadCode,
            threadName: row.threadName,
            brand: row.brand || null,
            packagingType: row.packagingType || null,
            piecesPerBox: rowPiecesPerBox || null,
            metersPerUnit: row.metersPerUnit ? parseFloat(row.metersPerUnit) : null,
            color: row.color || null,
            colorCode: row.colorCode || null,
            coneSize: row.coneSize || null,
            pricePerCone: row.pricePerCone ? parseFloat(row.pricePerCone) : null,
            supplierCode: row.supplierCode || null,
            buyerCode: row.buyerCode || null,
            description: row.description || null,
            isActive: true,
          },
        });

        // Create material (same-id convention, category auto-resolved)
        await materialService.createFromMaster(
          { id: created.id, code: threadCode, name: row.threadName },
          'THREAD',
          tx
        );

        return created;
      });

      // Create stock if requested - using specialized thread_stock table
      let stockCreated = false;
      if (createStock && row.stockQuantity && row.stockQuantity > 0 && defaultWarehouse) {
        await threadStockService.createThreadStock(
          {
            threadId: threadRecord.id,
            quantity: parseFloat(row.stockQuantity),
            unit: 'CONE',
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
        threadCode,
        materialCode: threadCode,
        threadName: row.threadName,
        stockCreated,
      });
    } catch (error: any) {
      // allow-swallow — per-row bulk-import reporter: row writes are atomic ($transaction) and the failure is surfaced in results[]
      results.push({
        success: false,
        row: i + 1,
        threadCode,
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
      { field: 'threadName', header: 'Thread Name', required: true, description: 'Name of the thread (Required)' },
      { field: 'brand', header: 'Brand', required: false, description: 'Brand name (Optional)' },
      { field: 'packagingType', header: 'Packaging Type', required: false, description: 'CONE or TUBE (Optional)' },
      {
        field: 'metersPerUnit',
        header: 'Meters per Unit',
        required: false,
        description: 'Meters per cone/tube (Optional)',
      },
      { field: 'color', header: 'Color', required: false, description: 'Color name (Optional)' },
      {
        field: 'colorCode',
        header: 'Color Code (Pantone)',
        required: false,
        description: 'Pantone color code (Optional)',
      },
      { field: 'coneSize', header: 'Cone Size', required: false, description: 'Cone size (Optional)' },
      {
        field: 'pricePerCone',
        header: 'Price Per Cone/Tube',
        required: false,
        description: 'Price per cone/tube (Optional)',
      },
      {
        field: 'supplierCode',
        header: 'Supplier Code',
        required: false,
        description: "Supplier's reference code (Optional)",
      },
      { field: 'buyerCode', header: 'Buyer Code', required: false, description: "Buyer's reference code (Optional)" },
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
        threadName: 'Coats Epic Thread',
        brand: 'Coats',
        packagingType: 'CONE',
        metersPerUnit: 5000,
        color: 'Black',
        colorCode: 'PMS 200',
        coneSize: '5000m',
        pricePerCone: 15.5,
        supplierCode: 'SUP-001',
        buyerCode: 'BUY-001',
        description: 'Black polyester sewing thread cone',
        stockQuantity: 500,
        locationCode: 'WH-01-A',
      },
      {
        threadName: 'Aster Thread',
        brand: 'Aster',
        packagingType: 'TUBE',
        metersPerUnit: 1000,
        color: 'White',
        colorCode: 'PMS 100',
        coneSize: '1000m',
        pricePerCone: 8.5,
        supplierCode: 'SUP-002',
        buyerCode: 'BUY-002',
        description: 'White polyester sewing thread tube',
        stockQuantity: 300,
        locationCode: 'WH-01-B',
      },
    ],
  };

  res.json(template);
};

/**
 * Get thread stock information
 * Returns stock levels across all warehouses for a specific thread
 */
export const getThreadStock = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { requiredUnits, warehouseId } = req.query;

  // Get thread details
  // Note: thread_master has a one-to-many relation to materials (not a direct materialId)
  const thread = await prisma.thread_master.findUnique({
    where: { id },
    select: {
      id: true,
      threadCode: true,
      threadName: true,
      materials: {
        select: { id: true },
        take: 1,
      },
      ply: true,
      packagingType: true,
      unitsPerBox: true,
    },
  });

  if (!thread) {
    throw new NotFoundError('Thread', id);
  }
  const materialId = thread.materials?.[0]?.id;
  if (!materialId) {
    // BUG-MM9 FIX: Distinguish between thread not found and materials record missing
    throw new NotFoundError('Materials record for Thread', id);
  }

  // T2-1: derived per-warehouse on-hand (per-lot truth) instead of hand-maintained stock_levels.
  const stockLevels = await getDerivedStockDetailed({
    materialId,
    ...(warehouseId ? { warehouseId: warehouseId as string } : {}),
  });

  // Calculate total available units
  const totalUnits = stockLevels.reduce((sum, level) => sum + parseFloat(level.quantity.toString()), 0);

  // Calculate total boxes (using unitsPerBox if available)
  const unitsPerBox = thread.unitsPerBox ?? 10; // Default to 10 if not set
  const totalBoxes = unitsPerBox > 0 ? totalUnits / unitsPerBox : 0;

  // Calculate shortage if requiredUnits provided
  const required = requiredUnits ? parseFloat(requiredUnits as string) : 0;
  const shortage = required > totalUnits ? required - totalUnits : 0;
  const available = totalUnits >= required;

  // Check reorder level
  const reorderLevel = stockLevels[0]?.reorderLevel || 0;
  const reorderSuggested = totalUnits <= parseFloat(reorderLevel.toString());

  // Determine status
  let status: 'IN_STOCK' | 'LOW_STOCK' | 'SHORTAGE';
  if (shortage > 0) {
    status = 'SHORTAGE';
  } else if (reorderSuggested) {
    status = 'LOW_STOCK';
  } else {
    status = 'IN_STOCK';
  }

  res.json({
    success: true,
    data: {
      threadId: thread.id,
      threadCode: thread.threadCode,
      threadName: thread.threadName,
      totalUnits,
      totalBoxes: Math.round(totalBoxes * 100) / 100, // Round to 2 decimals
      available,
      shortage,
      reorderSuggested,
      status,
      stockByWarehouse: stockLevels.map((level) => ({
        warehouseId: level.warehouseId,
        warehouseName: level.warehouses?.warehouseName,
        warehouseCode: level.warehouses?.warehouseCode,
        quantity: parseFloat(level.quantity.toString()),
        reorderLevel: level.reorderLevel ? parseFloat(level.reorderLevel.toString()) : 0,
      })),
    },
  });
};
