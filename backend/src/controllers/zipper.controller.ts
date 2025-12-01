import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';
import { logError } from '../utils/logger';
import {
  ZipperMasterRecord,
  CountResult,
  BulkImportResult,
  BulkImportSummary,
  WarehouseRecord,
} from '../types/material-master.types';

const prisma = new PrismaClient();

/**
 * Create a single zipper item
 * Auto-generates zipperCode and creates corresponding material entry
 */
export const createZipper = async (req: Request, res: Response) => {
  try {
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
      description
    } = req.body;

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
      where: { name: 'Zipper' }
    });

    if (!zipperCategory) {
      return res.status(500).json({ error: 'Zipper category not found. Please run Phase 1 migration.' });
    }

    // Create zipper_master entry
    await prisma.$executeRaw`
      INSERT INTO "zipper_master" (
        "id", "zipperCode", "zipperName", "supplierCode", "buyerCode",
        "length", "teethType", "color", "brand", "sliderType", "tapeWidth", "pricePerPiece",
        "supplierId", "description", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${zipperCode},
        ${finalZipperName},
        ${supplierCode || null},
        ${buyerCode || null},
        ${length || null},
        ${teethType || null},
        ${color || null},
        ${brand || null},
        ${sliderType || null},
        ${tapeWidth || null},
        ${pricePerPiece || null},
        ${supplierId || null},
        ${description || null},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    // Get the created zipper
    const createdZipper = await prisma.$queryRaw<ZipperMasterRecord[]>`
      SELECT * FROM "zipper_master" WHERE "zipperCode" = ${zipperCode} LIMIT 1
    `;

    const zipperRecord = createdZipper[0];

    // Create corresponding material entry
    const materialCode = zipperCode; // Use same code
    const material = await prisma.materials.create({
      data: {
        id: `mat-${zipperCode.toLowerCase()}`,
        code: materialCode,
        name: zipperName,
        materialType: 'ZIPPER',
        zipperId: zipperRecord.id,
        categoryId: zipperCategory.id,
        unit: 'PIECE',
        isActive: true,
      } as Prisma.materialsUncheckedCreateInput
    });

    res.status(201).json({
      zipper: zipperRecord,
      material,
      message: 'Zipper created successfully'
    });

  } catch (error: unknown) {
    logError('Error creating zipper:', error);
    res.status(500).json({ error: 'Failed to create zipper', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Get all zipper items with pagination and search
 */
export const getAllZipper = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      supplierId = ''
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const searchStr = String(search);
    const supplierIdStr = String(supplierId);

    let countResult: CountResult[];
    let zipperItems: ZipperMasterRecord[];

    // Handle different filter combinations
    if (searchStr && supplierIdStr) {
      // Both search and supplierId
      const searchPattern = `%${searchStr}%`;

      countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "zipper_master" zm
        WHERE zm."isActive" = true
        AND (zm."zipperName" ILIKE ${searchPattern} OR zm."zipperCode" ILIKE ${searchPattern} OR zm."color" ILIKE ${searchPattern})
        AND zm."supplierId" = ${supplierIdStr}
      `;

      zipperItems = await prisma.$queryRaw<ZipperMasterRecord[]>`
        SELECT
          zm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "zipper_master" zm
        LEFT JOIN "materials" m ON m."zipperId" = zm."id"
        LEFT JOIN "suppliers" s ON s."id" = zm."supplierId"
        WHERE zm."isActive" = true
        AND (zm."zipperName" ILIKE ${searchPattern} OR zm."zipperCode" ILIKE ${searchPattern} OR zm."color" ILIKE ${searchPattern})
        AND zm."supplierId" = ${supplierIdStr}
        ORDER BY zm."createdAt" DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
    } else if (searchStr) {
      // Only search
      const searchPattern = `%${searchStr}%`;

      countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "zipper_master" zm
        WHERE zm."isActive" = true
        AND (zm."zipperName" ILIKE ${searchPattern} OR zm."zipperCode" ILIKE ${searchPattern} OR zm."color" ILIKE ${searchPattern})
      `;

      zipperItems = await prisma.$queryRaw<ZipperMasterRecord[]>`
        SELECT
          zm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "zipper_master" zm
        LEFT JOIN "materials" m ON m."zipperId" = zm."id"
        LEFT JOIN "suppliers" s ON s."id" = zm."supplierId"
        WHERE zm."isActive" = true
        AND (zm."zipperName" ILIKE ${searchPattern} OR zm."zipperCode" ILIKE ${searchPattern} OR zm."color" ILIKE ${searchPattern})
        ORDER BY zm."createdAt" DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
    } else if (supplierIdStr) {
      // Only supplierId
      countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "zipper_master" zm
        WHERE zm."isActive" = true
        AND zm."supplierId" = ${supplierIdStr}
      `;

      zipperItems = await prisma.$queryRaw<ZipperMasterRecord[]>`
        SELECT
          zm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "zipper_master" zm
        LEFT JOIN "materials" m ON m."zipperId" = zm."id"
        LEFT JOIN "suppliers" s ON s."id" = zm."supplierId"
        WHERE zm."isActive" = true
        AND zm."supplierId" = ${supplierIdStr}
        ORDER BY zm."createdAt" DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
    } else {
      // No filters
      countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "zipper_master" zm
        WHERE zm."isActive" = true
      `;

      zipperItems = await prisma.$queryRaw<ZipperMasterRecord[]>`
        SELECT
          zm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "zipper_master" zm
        LEFT JOIN "materials" m ON m."zipperId" = zm."id"
        LEFT JOIN "suppliers" s ON s."id" = zm."supplierId"
        WHERE zm."isActive" = true
        ORDER BY zm."createdAt" DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
    }

    const total = countResult[0]?.count || 0;

    res.json({
      data: zipperItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: unknown) {
    logError('Error fetching zipper items:', error);
    res.status(500).json({ error: 'Failed to fetch zipper items', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Get single zipper item by ID
 */
export const getZipperById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const zipperItems = await prisma.$queryRaw<ZipperMasterRecord[]>`
      SELECT
        zm.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName",
        s."code" as "supplierCodeRef"
      FROM "zipper_master" zm
      LEFT JOIN "materials" m ON m."zipperId" = zm."id"
      LEFT JOIN "suppliers" s ON s."id" = zm."supplierId"
      WHERE zm."id" = ${id}
      LIMIT 1
    `;

    if (zipperItems.length === 0) {
      return res.status(404).json({ error: 'Zipper not found' });
    }

    res.json(zipperItems[0]);

  } catch (error: unknown) {
    logError('Error fetching zipper:', error);
    res.status(500).json({ error: 'Failed to fetch zipper', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Update zipper item
 * Note: zipperCode cannot be changed
 */
export const updateZipper = async (req: Request, res: Response) => {
  try {
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
      isActive
    } = req.body;

    // Check if zipper exists
    const existing = await prisma.$queryRaw<ZipperMasterRecord[]>`
      SELECT * FROM "zipper_master" WHERE "id" = ${id} LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Zipper not found' });
    }

    // Build UPDATE query dynamically using Prisma.sql
    const updates: Prisma.Sql[] = [];

    if (zipperName !== undefined) {
      updates.push(Prisma.sql`"zipperName" = ${zipperName}`);
    }
    if (supplierCode !== undefined) {
      updates.push(Prisma.sql`"supplierCode" = ${supplierCode || null}`);
    }
    if (buyerCode !== undefined) {
      updates.push(Prisma.sql`"buyerCode" = ${buyerCode || null}`);
    }
    if (length !== undefined) {
      updates.push(Prisma.sql`"length" = ${length || null}`);
    }
    if (teethType !== undefined) {
      updates.push(Prisma.sql`"teethType" = ${teethType || null}`);
    }
    if (color !== undefined) {
      updates.push(Prisma.sql`"color" = ${color || null}`);
    }
    if (brand !== undefined) {
      updates.push(Prisma.sql`"brand" = ${brand || null}`);
    }
    if (sliderType !== undefined) {
      updates.push(Prisma.sql`"sliderType" = ${sliderType || null}`);
    }
    if (tapeWidth !== undefined) {
      updates.push(Prisma.sql`"tapeWidth" = ${tapeWidth || null}`);
    }
    if (pricePerPiece !== undefined) {
      updates.push(Prisma.sql`"pricePerPiece" = ${pricePerPiece || null}`);
    }
    if (supplierId !== undefined) {
      updates.push(Prisma.sql`"supplierId" = ${supplierId || null}`);
    }
    if (description !== undefined) {
      updates.push(Prisma.sql`"description" = ${description || null}`);
    }
    if (isActive !== undefined) {
      updates.push(Prisma.sql`"isActive" = ${isActive}`);
    }

    updates.push(Prisma.sql`"updatedAt" = CURRENT_TIMESTAMP`);

    // Join all updates with commas
    const updateClause = Prisma.join(updates, ', ');

    await prisma.$executeRaw`
      UPDATE "zipper_master"
      SET ${updateClause}
      WHERE "id" = ${id}
    `;

    // Also update material name if zipperName changed
    if (zipperName) {
      await prisma.$executeRaw`
        UPDATE "materials"
        SET "name" = ${zipperName}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "zipperId" = ${id}
      `;
    }

    // Fetch updated record
    const updated = await prisma.$queryRaw<ZipperMasterRecord[]>`
      SELECT
        zm.*,
        m."code" as "materialCode",
        m."id" as "materialId"
      FROM "zipper_master" zm
      LEFT JOIN "materials" m ON m."zipperId" = zm."id"
      WHERE zm."id" = ${id}
      LIMIT 1
    `;

    res.json({
      zipper: updated[0],
      message: 'Zipper updated successfully'
    });

  } catch (error: unknown) {
    logError('Error updating zipper:', error);
    res.status(500).json({ error: 'Failed to update zipper', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Delete zipper item
 * Checks if zipper is used in any BOM first
 */
export const deleteZipper = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if zipper exists
    const existing = await prisma.$queryRaw<ZipperMasterRecord[]>`
      SELECT * FROM "zipper_master" WHERE "id" = ${id} LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Zipper not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.$queryRaw<CountResult[]>`
      SELECT COUNT(*)::integer as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."zipperId" = ${id}
    `;

    if (bomUsage[0]?.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete zipper',
        message: `This zipper is used in ${bomUsage[0].count} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRaw`
      DELETE FROM "materials" WHERE "zipperId" = ${id}
    `;

    // Delete zipper
    await prisma.$executeRaw`
      DELETE FROM "zipper_master" WHERE "id" = ${id}
    `;

    res.json({ message: 'Zipper deleted successfully' });

  } catch (error: unknown) {
    logError('Error deleting zipper:', error);
    res.status(500).json({ error: 'Failed to delete zipper', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Bulk import zipper items from Excel
 * Auto-generates codes and creates material entries
 */
export const bulkImportZipper = async (req: Request, res: Response) => {
  try {
    const { data, createStock = false } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Data array is required' });
    }

    // Get Zipper category
    const zipperCategory = await prisma.material_categories.findFirst({
      where: { name: 'Zipper' }
    });

    if (!zipperCategory) {
      return res.status(500).json({ error: 'Zipper category not found' });
    }

    // Pre-generate all codes
    const codes = await generateBatchCodes('ZIP', 'zipper_master', 'zipperCode', data.length);

    const results: BulkImportResult[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const zipperCode = codes[i];

      try {
        // Validate required field
        if (!row.zipperName || row.zipperName.trim() === '') {
          results.push({
            success: false,
            row: i + 1,
            error: 'Zipper name is required'
          });
          continue;
        }

        // Create zipper
        await prisma.$executeRaw`
          INSERT INTO "zipper_master" (
            "id", "zipperCode", "zipperName", "supplierCode", "buyerCode",
            "length", "teethType", "color", "brand", "sliderType", "tapeWidth", "pricePerPiece",
            "description", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            ${zipperCode},
            ${row.zipperName},
            ${row.supplierCode || null},
            ${row.buyerCode || null},
            ${row.length || null},
            ${row.teethType || null},
            ${row.color || null},
            ${row.brand || null},
            ${row.sliderType || null},
            ${row.tapeWidth || null},
            ${row.pricePerPiece || null},
            ${row.description || null},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;

        // Get created zipper ID
        const created = await prisma.$queryRaw<ZipperMasterRecord[]>`
          SELECT "id" FROM "zipper_master" WHERE "zipperCode" = ${zipperCode} LIMIT 1
        `;

        const zipperId = created[0].id;

        // Create material
        await prisma.materials.create({
          data: {
            id: `mat-${zipperCode.toLowerCase()}`,
            code: zipperCode,
            name: row.zipperName,
            materialType: 'ZIPPER',
            zipperId,
            categoryId: zipperCategory.id,
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
                materialId: `mat-${zipperCode.toLowerCase()}`,
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
          zipperCode,
          materialCode: zipperCode,
          zipperName: row.zipperName,
          stockCreated
        });

      } catch (error: unknown) {
        results.push({
          success: false,
          row: i + 1,
          zipperCode,
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
        { name: 'zipperName', required: true, description: 'Name of the zipper (Required)' },
        { name: 'supplierCode', required: false, description: "Supplier's reference code (Optional)" },
        { name: 'buyerCode', required: false, description: "Buyer's reference code (Optional)" },
        { name: 'length', required: false, description: 'Length in inches (Optional)' },
        { name: 'type', required: false, description: 'Zipper type (e.g., Metal, Plastic, Invisible) (Optional)' },
        { name: 'color', required: false, description: 'Color name (Optional)' },
        { name: 'teeth', required: false, description: 'Teeth type/material (Optional)' },
        { name: 'pricePerPiece', required: false, description: 'Price per piece (Optional)' },
        { name: 'stockQuantity', required: false, description: 'Initial stock quantity (Optional)' },
        { name: 'locationCode', required: false, description: 'Warehouse location code (Optional)' }
      ],
      exampleData: [
        {
          zipperName: 'Metal Zipper 12inch Black',
          supplierCode: 'ZIP-001',
          buyerCode: '',
          length: 12.0,
          type: 'Metal',
          color: 'Black',
          teeth: 'Brass',
          pricePerPiece: 5.50,
          stockQuantity: 500,
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
