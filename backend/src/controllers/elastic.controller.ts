import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';
import { logError } from '../utils/logger';
import {
  ElasticMasterRecord,
  CountResult,
  BulkImportResult,
  BulkImportSummary,
  WarehouseRecord,
} from '../types/material-master.types';

const prisma = new PrismaClient();

/**
 * Create a single elastic item
 * Auto-generates elasticCode and creates corresponding material entry
 */
export const createElastic = async (req: Request, res: Response) => {
  try {
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
      description
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
      where: { name: 'Elastic' }
    });

    if (!elasticCategory) {
      return res.status(500).json({ error: 'Elastic category not found. Please run Phase 1 migration.' });
    }

    // Create elastic_master entry using parameterized query
    await prisma.$executeRaw`
      INSERT INTO "elastic_master" (
        "id", "elasticCode", "elasticName", "supplierCode", "buyerCode",
        "width", "stretchPercent", "color", "composition", "elasticType", "pricePerMeter",
        "supplierId", "description", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${elasticCode},
        ${finalElasticName},
        ${supplierCode || null},
        ${buyerCode || null},
        ${width ? Number(width) : null},
        ${stretchPercent ? Number(stretchPercent) : null},
        ${color || null},
        ${composition || null},
        ${elasticType || null},
        ${pricePerMeter ? Number(pricePerMeter) : null},
        ${supplierId || null},
        ${description || null},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    // Get the created elastic
    const createdElastic = await prisma.$queryRaw<ElasticMasterRecord[]>`
      SELECT * FROM "elastic_master" WHERE "elasticCode" = ${elasticCode} LIMIT 1
    `;

    const elasticRecord = createdElastic[0];

    // Create corresponding material entry
    const materialCode = elasticCode; // Use same code
    const material = await prisma.materials.create({
      data: {
        id: `mat-${elasticCode.toLowerCase()}`,
        code: materialCode,
        name: elasticName,
        materialType: 'ELASTIC',
        elasticId: elasticRecord.id,
        categoryId: elasticCategory.id,
        unit: 'METER',
        isActive: true,
      } as Prisma.materialsUncheckedCreateInput
    });

    res.status(201).json({
      elastic: elasticRecord,
      material,
      message: 'Elastic created successfully'
    });

  } catch (error: unknown) {
    logError('Error creating elastic:', error);
    res.status(500).json({ error: 'Failed to create elastic', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Get all elastic items with pagination and search
 */
export const getAllElastic = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      supplierId = ''
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;
    const searchTerm = `%${String(search)}%`;

    let total: number;
    let elasticItems: ElasticMasterRecord[];

    if (search && supplierId) {
      // Both search and supplierId filters
      const countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count FROM "elastic_master" em
        WHERE em."isActive" = true
          AND (em."elasticName" ILIKE ${searchTerm} OR em."elasticCode" ILIKE ${searchTerm} OR em."color" ILIKE ${searchTerm})
          AND em."supplierId" = ${String(supplierId)}
      `;
      total = countResult[0]?.count || 0;

      elasticItems = await prisma.$queryRaw<ElasticMasterRecord[]>`
        SELECT
          em.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "elastic_master" em
        LEFT JOIN "materials" m ON m."elasticId" = em."id"
        LEFT JOIN "suppliers" s ON s."id" = em."supplierId"
        WHERE em."isActive" = true
          AND (em."elasticName" ILIKE ${searchTerm} OR em."elasticCode" ILIKE ${searchTerm} OR em."color" ILIKE ${searchTerm})
          AND em."supplierId" = ${String(supplierId)}
        ORDER BY em."createdAt" DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    } else if (search) {
      // Only search filter
      const countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count FROM "elastic_master" em
        WHERE em."isActive" = true
          AND (em."elasticName" ILIKE ${searchTerm} OR em."elasticCode" ILIKE ${searchTerm} OR em."color" ILIKE ${searchTerm})
      `;
      total = countResult[0]?.count || 0;

      elasticItems = await prisma.$queryRaw<ElasticMasterRecord[]>`
        SELECT
          em.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "elastic_master" em
        LEFT JOIN "materials" m ON m."elasticId" = em."id"
        LEFT JOIN "suppliers" s ON s."id" = em."supplierId"
        WHERE em."isActive" = true
          AND (em."elasticName" ILIKE ${searchTerm} OR em."elasticCode" ILIKE ${searchTerm} OR em."color" ILIKE ${searchTerm})
        ORDER BY em."createdAt" DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    } else if (supplierId) {
      // Only supplierId filter
      const countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count FROM "elastic_master" em
        WHERE em."isActive" = true
          AND em."supplierId" = ${String(supplierId)}
      `;
      total = countResult[0]?.count || 0;

      elasticItems = await prisma.$queryRaw<ElasticMasterRecord[]>`
        SELECT
          em.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "elastic_master" em
        LEFT JOIN "materials" m ON m."elasticId" = em."id"
        LEFT JOIN "suppliers" s ON s."id" = em."supplierId"
        WHERE em."isActive" = true
          AND em."supplierId" = ${String(supplierId)}
        ORDER BY em."createdAt" DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    } else {
      // No filters
      const countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count FROM "elastic_master" em
        WHERE em."isActive" = true
      `;
      total = countResult[0]?.count || 0;

      elasticItems = await prisma.$queryRaw<ElasticMasterRecord[]>`
        SELECT
          em.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "elastic_master" em
        LEFT JOIN "materials" m ON m."elasticId" = em."id"
        LEFT JOIN "suppliers" s ON s."id" = em."supplierId"
        WHERE em."isActive" = true
        ORDER BY em."createdAt" DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    }

    res.json({
      data: elasticItems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error: unknown) {
    logError('Error fetching elastic items:', error);
    res.status(500).json({ error: 'Failed to fetch elastic items', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Get single elastic item by ID
 */
export const getElasticById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const elasticItems = await prisma.$queryRaw<ElasticMasterRecord[]>`
      SELECT
        em.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName",
        s."code" as "supplierCodeRef"
      FROM "elastic_master" em
      LEFT JOIN "materials" m ON m."elasticId" = em."id"
      LEFT JOIN "suppliers" s ON s."id" = em."supplierId"
      WHERE em."id" = ${id}
      LIMIT 1
    `;

    if (elasticItems.length === 0) {
      return res.status(404).json({ error: 'Elastic not found' });
    }

    res.json(elasticItems[0]);

  } catch (error: unknown) {
    logError('Error fetching elastic:', error);
    res.status(500).json({ error: 'Failed to fetch elastic', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Update elastic item
 * Note: elasticCode cannot be changed
 */
export const updateElastic = async (req: Request, res: Response) => {
  try {
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
      isActive
    } = req.body;

    // Check if elastic exists
    const existing = await prisma.$queryRaw<ElasticMasterRecord[]>`
      SELECT * FROM "elastic_master" WHERE "id" = ${id} LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Elastic not found' });
    }

    // Update elastic using parameterized query
    await prisma.$executeRaw`
      UPDATE "elastic_master"
      SET
        "elasticName" = COALESCE(${elasticName}, "elasticName"),
        "supplierCode" = ${supplierCode !== undefined ? (supplierCode || null) : existing[0].supplierCode},
        "buyerCode" = ${buyerCode !== undefined ? (buyerCode || null) : existing[0].buyerCode},
        "width" = ${width !== undefined ? (width ? Number(width) : null) : existing[0].width},
        "stretchPercent" = ${stretchPercent !== undefined ? (stretchPercent ? Number(stretchPercent) : null) : existing[0].stretchPercent},
        "color" = ${color !== undefined ? (color || null) : existing[0].color},
        "composition" = ${composition !== undefined ? (composition || null) : existing[0].composition},
        "elasticType" = ${elasticType !== undefined ? (elasticType || null) : existing[0].elasticType},
        "pricePerMeter" = ${pricePerMeter !== undefined ? (pricePerMeter ? Number(pricePerMeter) : null) : existing[0].pricePerMeter},
        "supplierId" = ${supplierId !== undefined ? (supplierId || null) : existing[0].supplierId},
        "description" = ${description !== undefined ? (description || null) : existing[0].description},
        "isActive" = ${isActive !== undefined ? isActive : existing[0].isActive},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `;

    // Also update material name if elasticName changed
    if (elasticName) {
      await prisma.$executeRaw`
        UPDATE "materials"
        SET "name" = ${elasticName}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "elasticId" = ${id}
      `;
    }

    // Fetch updated record
    const updated = await prisma.$queryRaw<ElasticMasterRecord[]>`
      SELECT
        em.*,
        m."code" as "materialCode",
        m."id" as "materialId"
      FROM "elastic_master" em
      LEFT JOIN "materials" m ON m."elasticId" = em."id"
      WHERE em."id" = ${id}
      LIMIT 1
    `;

    res.json({
      elastic: updated[0],
      message: 'Elastic updated successfully'
    });

  } catch (error: unknown) {
    logError('Error updating elastic:', error);
    res.status(500).json({ error: 'Failed to update elastic', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Delete elastic item
 * Checks if elastic is used in any BOM first
 */
export const deleteElastic = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if elastic exists
    const existing = await prisma.$queryRaw<ElasticMasterRecord[]>`
      SELECT * FROM "elastic_master" WHERE "id" = ${id} LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Elastic not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.$queryRaw<CountResult[]>`
      SELECT COUNT(*)::integer as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."elasticId" = ${id}
    `;

    if (bomUsage[0]?.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete elastic',
        message: `This elastic is used in ${bomUsage[0].count} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRaw`
      DELETE FROM "materials" WHERE "elasticId" = ${id}
    `;

    // Delete elastic
    await prisma.$executeRaw`
      DELETE FROM "elastic_master" WHERE "id" = ${id}
    `;

    res.json({ message: 'Elastic deleted successfully' });

  } catch (error: unknown) {
    logError('Error deleting elastic:', error);
    res.status(500).json({ error: 'Failed to delete elastic', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Bulk import elastic items from Excel
 * Auto-generates codes and creates material entries
 */
export const bulkImportElastic = async (req: Request, res: Response) => {
  try {
    const { data, createStock = false } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Data array is required' });
    }

    // Get Elastic category
    const elasticCategory = await prisma.material_categories.findFirst({
      where: { name: 'Elastic' }
    });

    if (!elasticCategory) {
      return res.status(500).json({ error: 'Elastic category not found' });
    }

    // Pre-generate all codes
    const codes = await generateBatchCodes('ELA', 'elastic_master', 'elasticCode', data.length);

    const results: BulkImportResult[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const elasticCode = codes[i];

      try {
        // Validate required field
        if (!row.elasticName || row.elasticName.trim() === '') {
          results.push({
            success: false,
            row: i + 1,
            error: 'Elastic name is required'
          });
          continue;
        }

        // Create elastic using parameterized query
        await prisma.$executeRaw`
          INSERT INTO "elastic_master" (
            "id", "elasticCode", "elasticName", "supplierCode", "buyerCode",
            "width", "stretchPercent", "color", "composition", "elasticType", "pricePerMeter",
            "description", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            ${elasticCode},
            ${row.elasticName},
            ${row.supplierCode || null},
            ${row.buyerCode || null},
            ${row.width ? Number(row.width) : null},
            ${row.stretchPercent ? Number(row.stretchPercent) : null},
            ${row.color || null},
            ${row.composition || null},
            ${row.elasticType || null},
            ${row.pricePerMeter ? Number(row.pricePerMeter) : null},
            ${row.description || null},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;

        // Get created elastic ID
        const created = await prisma.$queryRaw<ElasticMasterRecord[]>`
          SELECT "id" FROM "elastic_master" WHERE "elasticCode" = ${elasticCode} LIMIT 1
        `;

        const elasticId = created[0].id;

        // Create material
        await prisma.materials.create({
          data: {
            id: `mat-${elasticCode.toLowerCase()}`,
            code: elasticCode,
            name: row.elasticName,
            materialType: 'ELASTIC',
            elasticId,
            categoryId: elasticCategory.id,
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
                materialId: `mat-${elasticCode.toLowerCase()}`,
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
          elasticCode,
          materialCode: elasticCode,
          elasticName: row.elasticName,
          stockCreated
        });

      } catch (error: unknown) {
        results.push({
          success: false,
          row: i + 1,
          elasticCode,
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
        { name: 'elasticName', required: true, description: 'Name of the elastic (Required)' },
        { name: 'supplierCode', required: false, description: "Supplier's reference code (Optional)" },
        { name: 'buyerCode', required: false, description: "Buyer's reference code (Optional)" },
        { name: 'width', required: false, description: 'Width in inches (Optional)' },
        { name: 'type', required: false, description: 'Elastic type (e.g., Woven, Knitted, Braided) (Optional)' },
        { name: 'color', required: false, description: 'Color name (Optional)' },
        { name: 'composition', required: false, description: 'Material composition (Optional)' },
        { name: 'pricePerMeter', required: false, description: 'Price per meter (Optional)' },
        { name: 'stockQuantity', required: false, description: 'Initial stock quantity (Optional)' },
        { name: 'locationCode', required: false, description: 'Warehouse location code (Optional)' }
      ],
      exampleData: [
        {
          elasticName: 'White Knitted Elastic 1inch',
          supplierCode: 'ELA-001',
          buyerCode: '',
          width: 1.0,
          type: 'Knitted',
          color: 'White',
          composition: '80% Polyester 20% Rubber',
          pricePerMeter: 8.50,
          stockQuantity: 200,
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
