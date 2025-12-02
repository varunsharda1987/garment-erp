import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';
import { logError } from '../utils/logger';
import {
  LaceMasterRecord,
  LaceUpdateData,
  CountResult,
  BulkImportResult,
  BulkImportSummary,
  WarehouseRecord,
} from '../types/material-master.types';

const prisma = new PrismaClient();

/**
 * Create a single lace item
 * Auto-generates laceCode and creates corresponding material entry
 */
export const createLace = async (req: Request, res: Response) => {
  try {
    const {
      laceName,
      supplierCode,
      buyerCode,
      width,
      design,
      color,
      composition,
      laceType,
      pricePerMeter,
      supplierId,
      description
    } = req.body;

    // Auto-generate lace code
    const laceCode = await generateCode('LACE', 'lace_master', 'laceCode');

    // Auto-generate laceName if not provided
    let finalLaceName = laceName;
    if (!finalLaceName || finalLaceName.trim() === '') {
      const parts = [];
      if (buyerCode) parts.push(`[${buyerCode}]`);
      if (color) parts.push(color);
      if (design) parts.push(design);
      if (laceType) parts.push(laceType);
      if (composition) parts.push(composition);
      parts.push('Lace');
      if (width) parts.push(`${width}"`);
      finalLaceName = parts.join(' ').trim() || `Lace ${laceCode}`;
    }

    // Get Lace category ID
    const laceCategory = await prisma.material_categories.findFirst({
      where: { name: 'Lace' }
    });

    if (!laceCategory) {
      return res.status(500).json({ error: 'Lace category not found. Please run Phase 1 migration.' });
    }

    // Create lace_master entry
    await prisma.$executeRaw`
      INSERT INTO "lace_master" (
        "id", "laceCode", "laceName", "supplierCode", "buyerCode",
        "width", "design", "color", "composition", "laceType", "pricePerMeter",
        "supplierId", "description", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${laceCode},
        ${finalLaceName},
        ${supplierCode || null},
        ${buyerCode || null},
        ${width || null},
        ${design || null},
        ${color || null},
        ${composition || null},
        ${laceType || null},
        ${pricePerMeter || null},
        ${supplierId || null},
        ${description || null},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    // Get the created lace
    const createdLace = await prisma.$queryRaw<LaceMasterRecord[]>`
      SELECT * FROM "lace_master" WHERE "laceCode" = ${laceCode} LIMIT 1
    `;

    const laceRecord = createdLace[0];

    // Create corresponding material entry
    const materialCode = laceCode; // Use same code
    const material = await prisma.materials.create({
      data: {
        id: `mat-${laceCode.toLowerCase()}`,
        code: materialCode,
        name: laceName,
        materialType: 'LACE',
        laceId: laceRecord.id,
        categoryId: laceCategory.id,
        unit: 'METER',
        isActive: true,
      } as Prisma.materialsUncheckedCreateInput
    });

    res.status(201).json({
      lace: laceRecord,
      material,
      message: 'Lace created successfully'
    });

  } catch (error: unknown) {
    logError('Error creating lace:', error);
    res.status(500).json({ error: 'Failed to create lace', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Get all lace items with pagination and search
 */
export const getAllLace = async (req: Request, res: Response) => {
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
    let laceItems: LaceMasterRecord[];

    // Handle different filter combinations with separate queries
    if (searchStr && supplierIdStr) {
      // Both search and supplierId
      const searchPattern = `%${searchStr}%`;

      countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "lace_master" lm
        WHERE lm."isActive" = true
          AND (lm."laceName" ILIKE ${searchPattern} OR lm."laceCode" ILIKE ${searchPattern} OR lm."color" ILIKE ${searchPattern})
          AND lm."supplierId" = ${supplierIdStr}
      `;

      laceItems = await prisma.$queryRaw<LaceMasterRecord[]>`
        SELECT
          lm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "lace_master" lm
        LEFT JOIN "materials" m ON m."laceId" = lm."id"
        LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
        WHERE lm."isActive" = true
          AND (lm."laceName" ILIKE ${searchPattern} OR lm."laceCode" ILIKE ${searchPattern} OR lm."color" ILIKE ${searchPattern})
          AND lm."supplierId" = ${supplierIdStr}
        ORDER BY lm."createdAt" DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
    } else if (searchStr) {
      // Only search
      const searchPattern = `%${searchStr}%`;

      countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "lace_master" lm
        WHERE lm."isActive" = true
          AND (lm."laceName" ILIKE ${searchPattern} OR lm."laceCode" ILIKE ${searchPattern} OR lm."color" ILIKE ${searchPattern})
      `;

      laceItems = await prisma.$queryRaw<LaceMasterRecord[]>`
        SELECT
          lm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "lace_master" lm
        LEFT JOIN "materials" m ON m."laceId" = lm."id"
        LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
        WHERE lm."isActive" = true
          AND (lm."laceName" ILIKE ${searchPattern} OR lm."laceCode" ILIKE ${searchPattern} OR lm."color" ILIKE ${searchPattern})
        ORDER BY lm."createdAt" DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
    } else if (supplierIdStr) {
      // Only supplierId
      countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "lace_master" lm
        WHERE lm."isActive" = true
          AND lm."supplierId" = ${supplierIdStr}
      `;

      laceItems = await prisma.$queryRaw<LaceMasterRecord[]>`
        SELECT
          lm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "lace_master" lm
        LEFT JOIN "materials" m ON m."laceId" = lm."id"
        LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
        WHERE lm."isActive" = true
          AND lm."supplierId" = ${supplierIdStr}
        ORDER BY lm."createdAt" DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
    } else {
      // No filters
      countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "lace_master" lm
        WHERE lm."isActive" = true
      `;

      laceItems = await prisma.$queryRaw<LaceMasterRecord[]>`
        SELECT
          lm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "lace_master" lm
        LEFT JOIN "materials" m ON m."laceId" = lm."id"
        LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
        WHERE lm."isActive" = true
        ORDER BY lm."createdAt" DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
    }

    const total = countResult[0]?.count || 0;

    res.json({
      data: laceItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: unknown) {
    logError('Error fetching lace items:', error);
    res.status(500).json({ error: 'Failed to fetch lace items', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Get single lace item by ID
 */
export const getLaceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const laceItems = await prisma.$queryRaw<LaceMasterRecord[]>`
      SELECT
        lm.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName",
        s."code" as "supplierCodeRef"
      FROM "lace_master" lm
      LEFT JOIN "materials" m ON m."laceId" = lm."id"
      LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
      WHERE lm."id" = ${id}
      LIMIT 1
    `;

    if (laceItems.length === 0) {
      return res.status(404).json({ error: 'Lace not found' });
    }

    res.json(laceItems[0]);

  } catch (error: unknown) {
    logError('Error fetching lace:', error);
    res.status(500).json({ error: 'Failed to fetch lace', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Update lace item
 * Note: laceCode cannot be changed
 */
export const updateLace = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      laceName,
      supplierCode,
      buyerCode,
      width,
      design,
      color,
      composition,
      laceType,
      pricePerMeter,
      supplierId,
      description,
      isActive
    } = req.body;

    // Check if lace exists
    const existing = await prisma.$queryRaw<LaceMasterRecord[]>`
      SELECT * FROM "lace_master" WHERE "id" = ${id} LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Lace not found' });
    }

    // Build update data object
    const updateData: LaceUpdateData = {
      updatedAt: new Date()
    };

    if (laceName !== undefined) updateData.laceName = laceName;
    if (supplierCode !== undefined) updateData.supplierCode = supplierCode || null;
    if (buyerCode !== undefined) updateData.buyerCode = buyerCode || null;
    if (width !== undefined) updateData.width = width || null;
    if (design !== undefined) updateData.design = design || null;
    if (color !== undefined) updateData.color = color || null;
    if (composition !== undefined) updateData.composition = composition || null;
    if (laceType !== undefined) updateData.laceType = laceType || null;
    if (pricePerMeter !== undefined) updateData.pricePerMeter = pricePerMeter || null;
    if (supplierId !== undefined) updateData.supplierId = supplierId || null;
    if (description !== undefined) updateData.description = description || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Perform update using Prisma ORM for safety
    await prisma.lace_master.update({
      where: { id },
      data: updateData
    });

    // Also update material name if laceName changed
    if (laceName) {
      await prisma.$executeRaw`
        UPDATE "materials"
        SET "name" = ${laceName}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "laceId" = ${id}
      `;
    }

    // Fetch updated record
    const updated = await prisma.$queryRaw<LaceMasterRecord[]>`
      SELECT
        lm.*,
        m."code" as "materialCode",
        m."id" as "materialId"
      FROM "lace_master" lm
      LEFT JOIN "materials" m ON m."laceId" = lm."id"
      WHERE lm."id" = ${id}
      LIMIT 1
    `;

    res.json({
      lace: updated[0],
      message: 'Lace updated successfully'
    });

  } catch (error: unknown) {
    logError('Error updating lace:', error);
    res.status(500).json({ error: 'Failed to update lace', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Delete lace item
 * Checks if lace is used in any BOM first
 */
export const deleteLace = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if lace exists
    const existing = await prisma.$queryRaw<LaceMasterRecord[]>`
      SELECT * FROM "lace_master" WHERE "id" = ${id} LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Lace not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.$queryRaw<CountResult[]>`
      SELECT COUNT(*)::integer as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."laceId" = ${id}
    `;

    if (bomUsage[0]?.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete lace',
        message: `This lace is used in ${bomUsage[0].count} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRaw`
      DELETE FROM "materials" WHERE "laceId" = ${id}
    `;

    // Delete lace
    await prisma.$executeRaw`
      DELETE FROM "lace_master" WHERE "id" = ${id}
    `;

    res.json({ message: 'Lace deleted successfully' });

  } catch (error: unknown) {
    logError('Error deleting lace:', error);
    res.status(500).json({ error: 'Failed to delete lace', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Bulk import lace items from Excel
 * Auto-generates codes and creates material entries
 */
export const bulkImportLace = async (req: Request, res: Response) => {
  try {
    const { data, createStock = false } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Data array is required' });
    }

    // Get Lace category
    const laceCategory = await prisma.material_categories.findFirst({
      where: { name: 'Lace' }
    });

    if (!laceCategory) {
      return res.status(500).json({ error: 'Lace category not found' });
    }

    // Pre-generate all codes
    const codes = await generateBatchCodes('LACE', 'lace_master', 'laceCode', data.length);

    const results: BulkImportResult[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const laceCode = codes[i];

      try {
        // Validate required field
        if (!row.laceName || row.laceName.trim() === '') {
          results.push({
            success: false,
            row: i + 1,
            error: 'Lace name is required'
          });
          continue;
        }

        // Create lace
        await prisma.$executeRaw`
          INSERT INTO "lace_master" (
            "id", "laceCode", "laceName", "supplierCode", "buyerCode",
            "width", "design", "color", "composition", "laceType", "pricePerMeter",
            "description", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            ${laceCode},
            ${row.laceName},
            ${row.supplierCode || null},
            ${row.buyerCode || null},
            ${row.width || null},
            ${row.design || null},
            ${row.color || null},
            ${row.composition || null},
            ${row.laceType || null},
            ${row.pricePerMeter || null},
            ${row.description || null},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;

        // Get created lace ID
        const created = await prisma.$queryRaw<LaceMasterRecord[]>`
          SELECT "id" FROM "lace_master" WHERE "laceCode" = ${laceCode} LIMIT 1
        `;

        const laceId = created[0].id;

        // Create material
        await prisma.materials.create({
          data: {
            id: `mat-${laceCode.toLowerCase()}`,
            code: laceCode,
            name: row.laceName,
            materialType: 'LACE',
            laceId,
            categoryId: laceCategory.id,
            unit: 'METER',
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
                materialId: `mat-${laceCode.toLowerCase()}`,
                warehouseId: warehouse[0].id,
                quantity: row.stockQuantity,
                unit: 'METER'
              }
            });
            stockCreated = true;
          }
        }

        results.push({
          success: true,
          row: i + 1,
          laceCode,
          materialCode: laceCode,
          laceName: row.laceName,
          stockCreated
        });

      } catch (error: unknown) {
        results.push({
          success: false,
          row: i + 1,
          laceCode,
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
        { name: 'laceName', required: true, description: 'Name of the lace (Required)' },
        { name: 'supplierCode', required: false, description: "Supplier's reference code (Optional)" },
        { name: 'buyerCode', required: false, description: "Buyer's reference code (Optional)" },
        { name: 'width', required: false, description: 'Width in inches (Optional)' },
        { name: 'design', required: false, description: 'Design/pattern description (Optional)' },
        { name: 'color', required: false, description: 'Color name (Optional)' },
        { name: 'composition', required: false, description: 'Material composition (Optional)' },
        { name: 'laceType', required: false, description: 'Type of lace (e.g., Cotton Lace, Crochet Lace, Embroidered Lace) (Optional)' },
        { name: 'pricePerMeter', required: false, description: 'Price per meter (Optional)' },
        { name: 'stockQuantity', required: false, description: 'Initial stock quantity (Optional)' },
        { name: 'locationCode', required: false, description: 'Warehouse location code (Optional)' }
      ],
      exampleData: [
        {
          laceName: 'White Floral Lace 2inch',
          supplierCode: 'LC-001',
          buyerCode: '',
          width: 2.0,
          design: 'Floral',
          color: 'White',
          composition: '100% Polyester',
          laceType: 'Cotton Lace',
          pricePerMeter: 15.50,
          stockQuantity: 100,
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
