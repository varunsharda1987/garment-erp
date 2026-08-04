import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, allocateBatchCodes } from '../utils/code-generator';
import { logDebug } from '../utils/logger';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import { trimStockService } from '../services/trim-stock.service';
import { syncMasterToMaterials } from '../services/helpers/material-sync.helper';
import { materialService } from '../services/material.service';
import {
  PackagingMasterRecord,
  CountResult,
  BulkImportResult,
  BulkImportSummary,
  WarehouseRecord,
} from '../types/material-master.types';

// Type for supplier input
interface PackagingSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerPiece?: number | string;
}

/**
 * Create a single packaging item
 * Auto-generates packagingCode and creates corresponding material entry
 * Supports multiple suppliers via suppliers array
 */
export const createPackaging = async (req: Request, res: Response) => {
  // Log incoming request body for debugging
  logDebug('createPackaging request body:', req.body);

  const {
    packagingName,
    supplierCode,
    buyerCode,
    customerId, // Link to customer - makes packaging customer-specific
    brandCategoryId, // Link to specific brand within customer
    packagingType,
    size,
    material,
    thickness,
    printDetails,
    pricePerPiece,
    pricePerHundred,
    supplierId,
    description,
    suppliers = [], // Array of supplier relationships
  } = req.body;

  // Validation
  if (!packagingName || packagingName.trim() === '') {
    throw new ValidationError('Packaging name is required');
  }

  // Validate brand belongs to customer if both provided
  if (brandCategoryId && customerId) {
    const brand = await prisma.brand_categories.findUnique({
      where: { id: brandCategoryId },
      select: { customerId: true },
    });

    if (!brand) {
      throw new ValidationError('Invalid brand category');
    }

    if (brand.customerId !== customerId) {
      throw new ValidationError('Brand does not belong to the specified customer');
    }
  }

  // Auto-generate packaging code
  const packagingCode = await generateCode('PKG', 'packaging_master', 'packagingCode');

  // Ensure thickness is a string if provided
  const thicknessValue = thickness !== undefined && thickness !== '' && thickness !== null ? String(thickness) : null;

  // Create master + its materials record atomically (materials.id === master.id — material-identity invariant)
  const { packagingRecord, materialEntry } = await prisma.$transaction(async (tx) => {
    const created = await tx.packaging_master.create({
      data: {
        packagingCode,
        packagingName,
        supplierCode: supplierCode || null,
        buyerCode: buyerCode || null,
        customerId: customerId || null, // Link to customer
        brandCategoryId: brandCategoryId || null, // Link to brand
        packagingType: packagingType || null,
        size: size || null,
        material: material || null,
        thickness: thicknessValue,
        printDetails: printDetails || null,
        pricePerPiece: pricePerPiece != null ? parseFloat(String(pricePerPiece)) : null,
        pricePerHundred: pricePerHundred != null ? parseFloat(String(pricePerHundred)) : null,
        supplierId: supplierId || null,
        description: description || null,
        isActive: true,
        // Create supplier relationships
        packaging_suppliers: {
          create: suppliers.map((s: PackagingSupplierInput) => ({
            supplierId: s.supplierId,
            isPreferred: s.isPreferred || false,
            isActive: s.isActive !== undefined ? s.isActive : true,
            notes: s.notes || null,
            pricePerPiece: s.pricePerPiece != null ? parseFloat(String(s.pricePerPiece)) : null,
          })),
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        packaging_suppliers: {
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

    // Create material (same-id convention, category auto-resolved)
    const materialRow = await materialService.createFromMaster(
      { id: created.id, code: packagingCode, name: packagingName },
      'PACKAGING',
      tx
    );

    return { packagingRecord: created, materialEntry: materialRow };
  });

  res.status(201).json({
    packaging: packagingRecord,
    material: materialEntry,
    message: 'Packaging created successfully',
  });
};

/**
 * Get all packaging items with pagination and search
 * Supports filtering by customerId
 */
export const getAllPackaging = async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    supplierId = '',
    customerId = '', // Filter by customer
    brandCategoryId = '', // Filter by brand
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  // Build where clause with AND conditions
  const whereConditions: any[] = [{ isActive: true }];

  // Filter by customer - show customer-specific packaging OR generic (no customer)
  if (customerId) {
    whereConditions.push({
      OR: [{ customerId: String(customerId) }, { customerId: null }],
    });
  }

  // Filter by brand
  if (brandCategoryId) {
    whereConditions.push({ brandCategoryId: String(brandCategoryId) });
  }

  // Search filter
  if (search) {
    whereConditions.push({
      OR: [
        { packagingName: { contains: String(search), mode: 'insensitive' } },
        { packagingCode: { contains: String(search), mode: 'insensitive' } },
        { packagingType: { contains: String(search), mode: 'insensitive' } },
      ],
    });
  }

  // Filter by supplier
  if (supplierId) {
    whereConditions.push({ supplierId: String(supplierId) });
  }

  // Build final where clause
  const where = { AND: whereConditions };

  // Get total count
  const total = await prisma.packaging_master.count({ where });

  // Get packaging items with relations including brand
  const packagingItems = await prisma.packaging_master.findMany({
    where,
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      brandCategory: {
        select: {
          id: true,
          brandName: true,
          category: true,
          subCategory: true,
        },
      },
      materials: {
        select: { id: true, code: true },
      },
      suppliers: {
        select: { id: true, code: true, name: true },
      },
      packaging_suppliers: {
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
  const transformedItems = packagingItems.map((item: any) => ({
    ...item,
    materialId: item.materials[0]?.id || null,
    materialCode: item.materials[0]?.code || null,
    supplierName: item.suppliers?.name || null,
    materials: undefined,
  }));

  res.json({
    data: transformedItems,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
};

/**
 * Get single packaging item by ID
 */
export const getPackagingById = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Use Prisma to get packaging with suppliers, customer, and brand
  const packaging = await prisma.packaging_master.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      brandCategory: {
        select: {
          id: true,
          brandName: true,
          category: true,
          subCategory: true,
        },
      },
      materials: {
        select: { id: true, code: true },
      },
      suppliers: {
        select: { id: true, code: true, name: true },
      },
      packaging_suppliers: {
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

  if (!packaging) {
    throw new NotFoundError('Packaging', id);
  }

  // Format response to include both legacy single supplier and new multi-supplier
  const response = {
    ...packaging,
    materialCode: packaging.materials?.[0]?.code,
    materialId: packaging.materials?.[0]?.id,
    supplierName: packaging.suppliers?.name,
    supplierCodeRef: packaging.suppliers?.code,
    // Map packaging_suppliers to frontend format
    packagingSuppliers: packaging.packaging_suppliers.map((ps) => ({
      id: ps.id,
      supplierId: ps.supplierId,
      supplierCode: ps.supplier.code,
      supplierName: ps.supplier.name,
      isPreferred: ps.isPreferred,
      isActive: ps.isActive,
      notes: ps.notes,
      pricePerPiece: ps.pricePerPiece,
    })),
  };

  res.json(response);
};

/**
 * Update packaging item
 * Note: packagingCode cannot be changed
 * Supports multiple suppliers via suppliers array
 */
export const updatePackaging = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    packagingName,
    supplierCode,
    buyerCode,
    customerId, // Link to customer
    brandCategoryId, // Link to specific brand within customer
    packagingType,
    size,
    material,
    thickness,
    printDetails,
    pricePerPiece,
    pricePerHundred,
    supplierId,
    description,
    isActive,
    suppliers, // Array of supplier relationships (replaces existing)
  } = req.body;

  // Check if packaging exists
  const existing = await prisma.packaging_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Packaging', id);
  }

  // Validate brand belongs to customer if both provided
  if (brandCategoryId && customerId) {
    const brand = await prisma.brand_categories.findUnique({
      where: { id: brandCategoryId },
      select: { customerId: true },
    });

    if (!brand) {
      throw new ValidationError('Invalid brand category');
    }

    if (brand.customerId !== customerId) {
      throw new ValidationError('Brand does not belong to the specified customer');
    }
  }

  // Update suppliers if provided (delete-and-recreate pattern)
  if (suppliers !== undefined && Array.isArray(suppliers)) {
    // Delete existing supplier relationships
    await prisma.packaging_suppliers.deleteMany({
      where: { packagingId: id },
    });

    // Create new supplier relationships
    if (suppliers.length > 0) {
      await prisma.packaging_suppliers.createMany({
        data: suppliers.map((s: PackagingSupplierInput) => ({
          packagingId: id,
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
          pricePerPiece: s.pricePerPiece != null ? parseFloat(String(s.pricePerPiece)) : null,
        })),
      });
    }
  }

  // Update packaging using Prisma
  const updated = await prisma.packaging_master.update({
    where: { id },
    data: {
      ...(packagingName !== undefined && { packagingName }),
      ...(supplierCode !== undefined && { supplierCode: supplierCode || null }),
      ...(buyerCode !== undefined && { buyerCode: buyerCode || null }),
      ...(customerId !== undefined && { customerId: customerId || null }),
      ...(brandCategoryId !== undefined && { brandCategoryId: brandCategoryId || null }),
      ...(packagingType !== undefined && { packagingType: packagingType || null }),
      ...(size !== undefined && { size: size || null }),
      ...(material !== undefined && { material: material || null }),
      ...(thickness !== undefined && { thickness: thickness !== null && thickness !== '' ? String(thickness) : null }),
      ...(printDetails !== undefined && { printDetails: printDetails || null }),
      ...(pricePerPiece !== undefined && {
        pricePerPiece: pricePerPiece != null ? parseFloat(String(pricePerPiece)) : null,
      }),
      ...(pricePerHundred !== undefined && {
        pricePerHundred: pricePerHundred != null ? parseFloat(String(pricePerHundred)) : null,
      }),
      ...(supplierId !== undefined && { supplierId: supplierId || null }),
      ...(description !== undefined && { description: description || null }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      brandCategory: {
        select: {
          id: true,
          brandName: true,
          category: true,
          subCategory: true,
        },
      },
      materials: {
        select: { id: true, code: true },
      },
      packaging_suppliers: {
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
    },
  });

  // BUG-MM13 fix: sync code to materials
  // Note: packagingCode is not updated (auto-generated), only sync name changes
  if (packagingName && packagingName !== existing.packagingName) {
    await syncMasterToMaterials(id, 'PACKAGING', { name: packagingName });
  }

  // Format response
  const response = {
    ...updated,
    materialCode: updated.materials?.[0]?.code,
    materialId: updated.materials?.[0]?.id,
    packagingSuppliers: updated.packaging_suppliers.map((ps) => ({
      id: ps.id,
      supplierId: ps.supplierId,
      supplierCode: ps.supplier.code,
      supplierName: ps.supplier.name,
      isPreferred: ps.isPreferred,
      isActive: ps.isActive,
      notes: ps.notes,
      pricePerPiece: ps.pricePerPiece,
    })),
  };

  res.json({
    packaging: response,
    message: 'Packaging updated successfully',
  });
};

/**
 * Delete packaging item
 * Checks if packaging is used in any BOM first
 */
export const deletePackaging = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if packaging exists
  const existing = await prisma.$queryRaw<PackagingMasterRecord[]>`
    SELECT * FROM "packaging_master" WHERE "id" = ${id} LIMIT 1
  `;

  if (existing.length === 0) {
    throw new NotFoundError('Packaging', id);
  }

  // Check if used in a BOM. Guard BOTH the order BOM and the STYLE BOM (style_material_bom):
  // the style BOM holds the live bill-of-materials and its FKs are ON DELETE SET NULL, so an
  // unchecked delete silently orphans style BOM lines (bug-hunt BH-0286).
  const bomUsage = await prisma.$queryRaw<CountResult[]>`
    SELECT (
      (SELECT COUNT(*) FROM "order_bom_items" WHERE "packagingId" = ${id})
      + (SELECT COUNT(*) FROM "style_material_bom" WHERE "packagingId" = ${id})
    )::integer as count
  `;

  if (bomUsage[0]?.count > 0) {
    throw new BusinessError(
      `Cannot delete packaging. This packaging is used in ${bomUsage[0].count} BOM(s). Please remove from BOMs first.`
    );
  }

  // Delete material entry first (FK constraint)
  await prisma.$executeRaw`
    DELETE FROM "materials" WHERE "packagingId" = ${id}
  `;

  // Delete packaging
  await prisma.$executeRaw`
    DELETE FROM "packaging_master" WHERE "id" = ${id}
  `;

  res.json({ message: 'Packaging deleted successfully' });
};

/**
 * Bulk import packaging items from Excel
 * Auto-generates codes and creates material entries
 */
export const bulkImportPackaging = async (req: Request, res: Response) => {
  const { data, createStock = false } = req.body;
  const userId = (req as any).user?.userId || 'system';

  if (!Array.isArray(data) || data.length === 0) {
    throw new ValidationError('Data array is required');
  }

  // Pre-generate all codes
  const codes = await allocateBatchCodes('PKG', 'packaging_master', 'packagingCode', data.length);

  const results: BulkImportResult[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const packagingCode = codes[i];

    try {
      // Validate required field
      if (!row.packagingName || row.packagingName.trim() === '') {
        results.push({
          success: false,
          row: i + 1,
          error: 'Packaging name is required',
        });
        continue;
      }

      // Create packaging + material atomically so a failure cannot leave a master without its materials record
      const packagingId = await prisma.$transaction(async (tx) => {
        // Create packaging
        await tx.$executeRaw`
          INSERT INTO "packaging_master" (
            "id", "packagingCode", "packagingName", "supplierCode", "buyerCode",
            "packagingType", "size", "material", "thickness", "printDetails", "pricePerPiece", "pricePerHundred",
            "description", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            ${packagingCode},
            ${row.packagingName},
            ${row.supplierCode || null},
            ${row.buyerCode || null},
            ${row.packagingType || null},
            ${row.size || null},
            ${row.material || null},
            ${row.thickness || null},
            ${row.printDetails || null},
            ${row.pricePerPiece ?? null},
            ${row.pricePerHundred ?? null},
            ${row.description || null},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;

        // Get created packaging ID
        const created = await tx.$queryRaw<PackagingMasterRecord[]>`
          SELECT "id" FROM "packaging_master" WHERE "packagingCode" = ${packagingCode} LIMIT 1
        `;

        // Create material (same-id convention, category auto-resolved)
        await materialService.createFromMaster(
          { id: created[0].id, code: packagingCode, name: row.packagingName },
          'PACKAGING',
          tx
        );

        return created[0].id;
      });

      // Create stock if requested - using specialized packaging_stock table
      let stockCreated = false;
      if (createStock && row.stockQuantity && row.stockQuantity > 0) {
        // Get default warehouse
        const locationCode = row.locationCode || 'DEFAULT';
        const warehouse = await prisma.$queryRaw<WarehouseRecord[]>`
          SELECT "id" FROM "warehouses"
          WHERE "warehouseCode" = ${locationCode} OR "warehouseName" = 'Default Warehouse'
          LIMIT 1
        `;

        if (warehouse.length > 0) {
          await trimStockService.createTrimStock(
            {
              trimType: 'PACKAGING',
              masterId: packagingId,
              quantity: parseFloat(row.stockQuantity),
              unit: 'PIECE',
              purchaseCost: row.purchaseCost ? parseFloat(row.purchaseCost) : 0,
              warehouseId: warehouse[0].id,
              sourceType: 'IMPORT',
            },
            userId
          );
          stockCreated = true;
        }
      }

      results.push({
        success: true,
        row: i + 1,
        packagingCode,
        materialCode: packagingCode,
        packagingName: row.packagingName,
        stockCreated,
      });
    } catch (error: unknown) {
      // allow-swallow — per-row bulk-import reporter: row writes are atomic ($transaction) and the failure is surfaced in results[]
      results.push({
        success: false,
        row: i + 1,
        packagingCode,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const summary: BulkImportSummary = {
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
  // Return template structure as JSON
  // Frontend will convert to Excel
  // BUG-PK2 FIX: Template column names must match bulkImportPackaging field names
  // - 'type' -> 'packagingType' (line 625 uses row.packagingType)
  // - 'weight' -> 'thickness' (line 628 uses row.thickness)
  const template = {
    columns: [
      { name: 'packagingName', required: true, description: 'Name of the packaging (Required)' },
      { name: 'supplierCode', required: false, description: "Supplier's reference code (Optional)" },
      { name: 'buyerCode', required: false, description: "Buyer's reference code (Optional)" },
      {
        name: 'packagingType',
        required: false,
        description: 'Packaging type (e.g., Box, Bag, Polybag, Carton) (Optional)',
      },
      { name: 'size', required: false, description: 'Size/dimensions (Optional)' },
      { name: 'material', required: false, description: 'Material composition (e.g., Cardboard, Plastic) (Optional)' },
      { name: 'thickness', required: false, description: 'Thickness/weight (e.g., 40 microns, 3 ply) (Optional)' },
      { name: 'pricePerPiece', required: false, description: 'Price per piece (Optional)' },
      { name: 'stockQuantity', required: false, description: 'Initial stock quantity (Optional)' },
      { name: 'locationCode', required: false, description: 'Warehouse location code (Optional)' },
    ],
    exampleData: [
      {
        packagingName: 'Clear Polybag 12x18 inch',
        supplierCode: 'PKG-001',
        buyerCode: '',
        packagingType: 'Polybag',
        size: '12x18 inch',
        material: 'LDPE Plastic',
        thickness: '40 microns',
        pricePerPiece: 0.15,
        stockQuantity: 5000,
        locationCode: 'WH-01',
      },
    ],
  };

  res.json(template);
};
