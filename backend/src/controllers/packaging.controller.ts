import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';
import { logError } from '../utils/logger';
import {
  PackagingMasterRecord,
  CountResult,
  BulkImportResult,
  BulkImportSummary,
  WarehouseRecord,
} from '../types/material-master.types';

const prisma = new PrismaClient();

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
  try {
    const {
      packagingName,
      supplierCode,
      buyerCode,
      customerId,  // Link to customer - makes packaging customer-specific
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
      suppliers = [] // Array of supplier relationships
    } = req.body;

    // Validation
    if (!packagingName || packagingName.trim() === '') {
      return res.status(400).json({ error: 'Packaging name is required' });
    }

    // Validate brand belongs to customer if both provided
    if (brandCategoryId && customerId) {
      const brand = await prisma.brand_categories.findUnique({
        where: { id: brandCategoryId },
        select: { customerId: true }
      });

      if (!brand) {
        return res.status(400).json({ error: 'Invalid brand category' });
      }

      if (brand.customerId !== customerId) {
        return res.status(400).json({ error: 'Brand does not belong to the specified customer' });
      }
    }

    // Auto-generate packaging code
    const packagingCode = await generateCode('PKG', 'packaging_master', 'packagingCode');

    // Get Packaging category ID
    const packagingCategory = await prisma.material_categories.findFirst({
      where: { name: 'Packaging' }
    });

    if (!packagingCategory) {
      return res.status(500).json({ error: 'Packaging category not found. Please run Phase 1 migration.' });
    }

    // Create packaging_master entry using Prisma with suppliers
    const packagingRecord = await prisma.packaging_master.create({
      data: {
        packagingCode,
        packagingName,
        supplierCode: supplierCode || null,
        buyerCode: buyerCode || null,
        customerId: customerId || null,  // Link to customer
        brandCategoryId: brandCategoryId || null, // Link to brand
        packagingType: packagingType || null,
        size: size || null,
        material: material || null,
        thickness: thickness || null,
        printDetails: printDetails || null,
        pricePerPiece: pricePerPiece ? parseFloat(String(pricePerPiece)) : null,
        pricePerHundred: pricePerHundred ? parseFloat(String(pricePerHundred)) : null,
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
            pricePerPiece: s.pricePerPiece ? parseFloat(String(s.pricePerPiece)) : null,
          })),
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
          }
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
              }
            }
          },
          orderBy: { isPreferred: 'desc' }
        }
      }
    });

    // Create corresponding material entry
    const materialCode = packagingCode; // Use same code
    const materialEntry = await prisma.materials.create({
      data: {
        id: `mat-${packagingCode.toLowerCase()}`,
        code: materialCode,
        name: packagingName,
        materialType: 'PACKAGING',
        packagingId: packagingRecord.id,
        categoryId: packagingCategory.id,
        unit: 'PIECE',
        isActive: true,
      } as Prisma.materialsUncheckedCreateInput
    });

    res.status(201).json({
      packaging: packagingRecord,
      material: materialEntry,
      message: 'Packaging created successfully'
    });

  } catch (error: unknown) {
    logError('Error creating packaging:', error);
    res.status(500).json({ error: 'Failed to create packaging', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Get all packaging items with pagination and search
 * Supports filtering by customerId
 */
export const getAllPackaging = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      supplierId = '',
      customerId = '',  // Filter by customer
      brandCategoryId = '' // Filter by brand
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);

    // Build where clause with AND conditions
    const whereConditions: any[] = [{ isActive: true }];

    // Filter by customer - show customer-specific packaging OR generic (no customer)
    if (customerId) {
      whereConditions.push({
        OR: [
          { customerId: String(customerId) },
          { customerId: null }
        ]
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
          { packagingType: { contains: String(search), mode: 'insensitive' } }
        ]
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
          }
        },
        brandCategory: {
          select: {
            id: true,
            brandName: true,
            category: true,
            subCategory: true,
          }
        },
        materials: {
          select: { id: true, code: true }
        },
        suppliers: {
          select: { id: true, code: true, name: true }
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
              }
            }
          },
          orderBy: { isPreferred: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limitNum
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
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: unknown) {
    logError('Error fetching packaging items:', error);
    res.status(500).json({ error: 'Failed to fetch packaging items', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Get single packaging item by ID
 */
export const getPackagingById = async (req: Request, res: Response) => {
  try {
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
          }
        },
        brandCategory: {
          select: {
            id: true,
            brandName: true,
            category: true,
            subCategory: true,
          }
        },
        materials: {
          select: { id: true, code: true }
        },
        suppliers: {
          select: { id: true, code: true, name: true }
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
              }
            }
          },
          orderBy: { isPreferred: 'desc' }
        }
      }
    });

    if (!packaging) {
      return res.status(404).json({ error: 'Packaging not found' });
    }

    // Format response to include both legacy single supplier and new multi-supplier
    const response = {
      ...packaging,
      materialCode: packaging.materials?.[0]?.code,
      materialId: packaging.materials?.[0]?.id,
      supplierName: packaging.suppliers?.name,
      supplierCodeRef: packaging.suppliers?.code,
      // Map packaging_suppliers to frontend format
      packagingSuppliers: packaging.packaging_suppliers.map(ps => ({
        id: ps.id,
        supplierId: ps.supplierId,
        supplierCode: ps.supplier.code,
        supplierName: ps.supplier.name,
        isPreferred: ps.isPreferred,
        isActive: ps.isActive,
        notes: ps.notes,
        pricePerPiece: ps.pricePerPiece,
      }))
    };

    res.json(response);

  } catch (error: unknown) {
    logError('Error fetching packaging:', error);
    res.status(500).json({ error: 'Failed to fetch packaging', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Update packaging item
 * Note: packagingCode cannot be changed
 * Supports multiple suppliers via suppliers array
 */
export const updatePackaging = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      packagingName,
      supplierCode,
      buyerCode,
      customerId,  // Link to customer
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
      suppliers // Array of supplier relationships (replaces existing)
    } = req.body;

    // Check if packaging exists
    const existing = await prisma.packaging_master.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Packaging not found' });
    }

    // Validate brand belongs to customer if both provided
    if (brandCategoryId && customerId) {
      const brand = await prisma.brand_categories.findUnique({
        where: { id: brandCategoryId },
        select: { customerId: true }
      });

      if (!brand) {
        return res.status(400).json({ error: 'Invalid brand category' });
      }

      if (brand.customerId !== customerId) {
        return res.status(400).json({ error: 'Brand does not belong to the specified customer' });
      }
    }

    // Update suppliers if provided (delete-and-recreate pattern)
    if (suppliers !== undefined && Array.isArray(suppliers)) {
      // Delete existing supplier relationships
      await prisma.packaging_suppliers.deleteMany({
        where: { packagingId: id }
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
            pricePerPiece: s.pricePerPiece ? parseFloat(String(s.pricePerPiece)) : null,
          }))
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
        ...(thickness !== undefined && { thickness: thickness || null }),
        ...(printDetails !== undefined && { printDetails: printDetails || null }),
        ...(pricePerPiece !== undefined && { pricePerPiece: pricePerPiece ? parseFloat(String(pricePerPiece)) : null }),
        ...(pricePerHundred !== undefined && { pricePerHundred: pricePerHundred ? parseFloat(String(pricePerHundred)) : null }),
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
          }
        },
        brandCategory: {
          select: {
            id: true,
            brandName: true,
            category: true,
            subCategory: true,
          }
        },
        materials: {
          select: { id: true, code: true }
        },
        packaging_suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
              }
            }
          },
          orderBy: { isPreferred: 'desc' }
        }
      }
    });

    // Also update material name if packagingName changed
    if (packagingName) {
      await prisma.materials.updateMany({
        where: { packagingId: id },
        data: { name: packagingName }
      });
    }

    // Format response
    const response = {
      ...updated,
      materialCode: updated.materials?.[0]?.code,
      materialId: updated.materials?.[0]?.id,
      packagingSuppliers: updated.packaging_suppliers.map(ps => ({
        id: ps.id,
        supplierId: ps.supplierId,
        supplierCode: ps.supplier.code,
        supplierName: ps.supplier.name,
        isPreferred: ps.isPreferred,
        isActive: ps.isActive,
        notes: ps.notes,
        pricePerPiece: ps.pricePerPiece,
      }))
    };

    res.json({
      packaging: response,
      message: 'Packaging updated successfully'
    });

  } catch (error: unknown) {
    logError('Error updating packaging:', error);
    res.status(500).json({ error: 'Failed to update packaging', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Delete packaging item
 * Checks if packaging is used in any BOM first
 */
export const deletePackaging = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if packaging exists
    const existing = await prisma.$queryRaw<PackagingMasterRecord[]>`
      SELECT * FROM "packaging_master" WHERE "id" = ${id} LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Packaging not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.$queryRaw<CountResult[]>`
      SELECT COUNT(*)::integer as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."packagingId" = ${id}
    `;

    if (bomUsage[0]?.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete packaging',
        message: `This packaging is used in ${bomUsage[0].count} BOM(s). Please remove from BOMs first.`
      });
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

  } catch (error: unknown) {
    logError('Error deleting packaging:', error);
    res.status(500).json({ error: 'Failed to delete packaging', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Bulk import packaging items from Excel
 * Auto-generates codes and creates material entries
 */
export const bulkImportPackaging = async (req: Request, res: Response) => {
  try {
    const { data, createStock = false } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Data array is required' });
    }

    // Get Packaging category
    const packagingCategory = await prisma.material_categories.findFirst({
      where: { name: 'Packaging' }
    });

    if (!packagingCategory) {
      return res.status(500).json({ error: 'Packaging category not found' });
    }

    // Pre-generate all codes
    const codes = await generateBatchCodes('PKG', 'packaging_master', 'packagingCode', data.length);

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
            error: 'Packaging name is required'
          });
          continue;
        }

        // Create packaging
        await prisma.$executeRaw`
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
            ${row.pricePerPiece || null},
            ${row.pricePerHundred || null},
            ${row.description || null},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;

        // Get created packaging ID
        const created = await prisma.$queryRaw<PackagingMasterRecord[]>`
          SELECT "id" FROM "packaging_master" WHERE "packagingCode" = ${packagingCode} LIMIT 1
        `;

        const packagingId = created[0].id;

        // Create material
        await prisma.materials.create({
          data: {
            id: `mat-${packagingCode.toLowerCase()}`,
            code: packagingCode,
            name: row.packagingName,
            materialType: 'PACKAGING',
            packagingId,
            categoryId: packagingCategory.id,
            unit: 'PIECE',
            isActive: true,
          } as Prisma.materialsUncheckedCreateInput
        });

        // Create stock if requested
        let stockCreated = false;
        if (createStock && row.stockQuantity && row.stockQuantity > 0) {
          // Get default warehouse
          const locationCode = row.locationCode || 'DEFAULT';
          const warehouse = await prisma.$queryRaw<WarehouseRecord[]>`
            SELECT "id" FROM "warehouses"
            WHERE "code" = ${locationCode} OR "name" = 'Default Warehouse'
            LIMIT 1
          `;

          if (warehouse.length > 0) {
            await prisma.stock_levels.create({
              data: {
                materialId: `mat-${packagingCode.toLowerCase()}`,
                warehouseId: warehouse[0].id,
                quantity: row.stockQuantity,
                unit: 'PIECE'
              }
            });
            stockCreated = true;
          }
        }

        results.push({
          success: true,
          row: i + 1,
          packagingCode,
          materialCode: packagingCode,
          packagingName: row.packagingName,
          stockCreated
        });

      } catch (error: unknown) {
        results.push({
          success: false,
          row: i + 1,
          packagingCode,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const summary: BulkImportSummary = {
      total: data.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

    res.json({
      results,
      summary,
      message: `Bulk import completed: ${summary.success} succeeded, ${summary.failed} failed`
    });

  } catch (error: unknown) {
    logError('Error in bulk import:', error);
    res.status(500).json({ error: 'Bulk import failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Download Excel template for bulk import
 */
export const downloadTemplate = async (req: Request, res: Response) => {
  try {
    // Return template structure as JSON
    // Frontend will convert to Excel
    const template = {
      columns: [
        { name: 'packagingName', required: true, description: 'Name of the packaging (Required)' },
        { name: 'supplierCode', required: false, description: "Supplier's reference code (Optional)" },
        { name: 'buyerCode', required: false, description: "Buyer's reference code (Optional)" },
        { name: 'type', required: false, description: 'Packaging type (e.g., Box, Bag, Polybag, Carton) (Optional)' },
        { name: 'size', required: false, description: 'Size/dimensions (Optional)' },
        { name: 'material', required: false, description: 'Material composition (e.g., Cardboard, Plastic) (Optional)' },
        { name: 'weight', required: false, description: 'Weight in grams (Optional)' },
        { name: 'pricePerPiece', required: false, description: 'Price per piece (Optional)' },
        { name: 'stockQuantity', required: false, description: 'Initial stock quantity (Optional)' },
        { name: 'locationCode', required: false, description: 'Warehouse location code (Optional)' }
      ],
      exampleData: [
        {
          packagingName: 'Clear Polybag 12x18 inch',
          supplierCode: 'PKG-001',
          buyerCode: '',
          type: 'Polybag',
          size: '12x18 inch',
          material: 'LDPE Plastic',
          weight: 25,
          pricePerPiece: 0.15,
          stockQuantity: 5000,
          locationCode: 'WH-01'
        }
      ]
    };

    res.json(template);

  } catch (error: unknown) {
    logError('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};
