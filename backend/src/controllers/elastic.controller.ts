import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

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

    // Validation
    if (!elasticName || elasticName.trim() === '') {
      return res.status(400).json({ error: 'Elastic name is required' });
    }

    // Auto-generate elastic code
    const elasticCode = await generateCode('ELA', 'elastic_master', 'elasticCode');

    // Get Elastic category ID
    const elasticCategory = await prisma.material_categories.findFirst({
      where: { name: 'Elastic' }
    });

    if (!elasticCategory) {
      return res.status(500).json({ error: 'Elastic category not found. Please run Phase 1 migration.' });
    }

    // Create elastic_master entry
    const elastic = await prisma.$executeRawUnsafe(`
      INSERT INTO "elastic_master" (
        "id", "elasticCode", "elasticName", "supplierCode", "buyerCode",
        "width", "stretchPercent", "color", "composition", "elasticType", "pricePerMeter",
        "supplierId", "description", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        '${elasticCode}',
        '${elasticName.replace(/'/g, "''")}',
        ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'},
        ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'},
        ${width || 'NULL'},
        ${stretchPercent || 'NULL'},
        ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'},
        ${composition ? `'${composition.replace(/'/g, "''")}'` : 'NULL'},
        ${elasticType ? `'${elasticType.replace(/'/g, "''")}'` : 'NULL'},
        ${pricePerMeter || 'NULL'},
        ${supplierId ? `'${supplierId}'` : 'NULL'},
        ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `);

    // Get the created elastic
    const createdElastic = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "elastic_master" WHERE "elasticCode" = '${elasticCode}' LIMIT 1
    `);

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
        updatedAt: new Date()
      } as any
    });

    res.status(201).json({
      elastic: elasticRecord,
      material,
      message: 'Elastic created successfully'
    });

  } catch (error: any) {
    console.error('Error creating elastic:', error);
    res.status(500).json({ error: 'Failed to create elastic', details: error.message });
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

    const offset = (Number(page) - 1) * Number(limit);

    // Build WHERE clause
    let whereClause = `WHERE em."isActive" = true`;

    if (search) {
      whereClause += ` AND (em."elasticName" ILIKE '%${search}%' OR em."elasticCode" ILIKE '%${search}%' OR em."color" ILIKE '%${search}%')`;
    }

    if (supplierId) {
      whereClause += ` AND em."supplierId" = '${supplierId}'`;
    }

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::integer as count FROM "elastic_master" em ${whereClause}
    `);
    const total = countResult[0]?.count || 0;

    // Get elastic items
    const elasticItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        em.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName"
      FROM "elastic_master" em
      LEFT JOIN "materials" m ON m."elasticId" = em."id"
      LEFT JOIN "suppliers" s ON s."id" = em."supplierId"
      ${whereClause}
      ORDER BY em."createdAt" DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `);

    res.json({
      data: elasticItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Error fetching elastic items:', error);
    res.status(500).json({ error: 'Failed to fetch elastic items', details: error.message });
  }
};

/**
 * Get single elastic item by ID
 */
export const getElasticById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const elasticItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        em.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName",
        s."code" as "supplierCodeRef"
      FROM "elastic_master" em
      LEFT JOIN "materials" m ON m."elasticId" = em."id"
      LEFT JOIN "suppliers" s ON s."id" = em."supplierId"
      WHERE em."id" = '${id}'
      LIMIT 1
    `);

    if (elasticItems.length === 0) {
      return res.status(404).json({ error: 'Elastic not found' });
    }

    res.json(elasticItems[0]);

  } catch (error: any) {
    console.error('Error fetching elastic:', error);
    res.status(500).json({ error: 'Failed to fetch elastic', details: error.message });
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
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "elastic_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Elastic not found' });
    }

    // Build UPDATE query
    const updates: string[] = [];
    if (elasticName !== undefined) updates.push(`"elasticName" = '${elasticName.replace(/'/g, "''")}'`);
    if (supplierCode !== undefined) updates.push(`"supplierCode" = ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'}`);
    if (buyerCode !== undefined) updates.push(`"buyerCode" = ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'}`);
    if (width !== undefined) updates.push(`"width" = ${width || 'NULL'}`);
    if (stretchPercent !== undefined) updates.push(`"stretchPercent" = ${stretchPercent || 'NULL'}`);
    if (color !== undefined) updates.push(`"color" = ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'}`);
    if (composition !== undefined) updates.push(`"composition" = ${composition ? `'${composition.replace(/'/g, "''")}'` : 'NULL'}`);
    if (elasticType !== undefined) updates.push(`"elasticType" = ${elasticType ? `'${elasticType.replace(/'/g, "''")}'` : 'NULL'}`);
    if (pricePerMeter !== undefined) updates.push(`"pricePerMeter" = ${pricePerMeter || 'NULL'}`);
    if (supplierId !== undefined) updates.push(`"supplierId" = ${supplierId ? `'${supplierId}'` : 'NULL'}`);
    if (description !== undefined) updates.push(`"description" = ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'}`);
    if (isActive !== undefined) updates.push(`"isActive" = ${isActive}`);

    updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);

    await prisma.$executeRawUnsafe(`
      UPDATE "elastic_master"
      SET ${updates.join(', ')}
      WHERE "id" = '${id}'
    `);

    // Also update material name if elasticName changed
    if (elasticName) {
      await prisma.$executeRawUnsafe(`
        UPDATE "materials"
        SET "name" = '${elasticName.replace(/'/g, "''")}', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "elasticId" = '${id}'
      `);
    }

    // Fetch updated record
    const updated = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        em.*,
        m."code" as "materialCode",
        m."id" as "materialId"
      FROM "elastic_master" em
      LEFT JOIN "materials" m ON m."elasticId" = em."id"
      WHERE em."id" = '${id}'
      LIMIT 1
    `);

    res.json({
      elastic: updated[0],
      message: 'Elastic updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating elastic:', error);
    res.status(500).json({ error: 'Failed to update elastic', details: error.message });
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
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "elastic_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Elastic not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::integer as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."elasticId" = '${id}'
    `);

    if (bomUsage[0]?.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete elastic',
        message: `This elastic is used in ${bomUsage[0].count} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRawUnsafe(`
      DELETE FROM "materials" WHERE "elasticId" = '${id}'
    `);

    // Delete elastic
    await prisma.$executeRawUnsafe(`
      DELETE FROM "elastic_master" WHERE "id" = '${id}'
    `);

    res.json({ message: 'Elastic deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting elastic:', error);
    res.status(500).json({ error: 'Failed to delete elastic', details: error.message });
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
            error: 'Elastic name is required'
          });
          continue;
        }

        // Create elastic
        await prisma.$executeRawUnsafe(`
          INSERT INTO "elastic_master" (
            "id", "elasticCode", "elasticName", "supplierCode", "buyerCode",
            "width", "stretchPercent", "color", "composition", "elasticType", "pricePerMeter",
            "description", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            '${elasticCode}',
            '${row.elasticName.replace(/'/g, "''")}',
            ${row.supplierCode ? `'${row.supplierCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.buyerCode ? `'${row.buyerCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.width || 'NULL'},
            ${row.stretchPercent || 'NULL'},
            ${row.color ? `'${row.color.replace(/'/g, "''")}'` : 'NULL'},
            ${row.composition ? `'${row.composition.replace(/'/g, "''")}'` : 'NULL'},
            ${row.elasticType ? `'${row.elasticType.replace(/'/g, "''")}'` : 'NULL'},
            ${row.pricePerMeter || 'NULL'},
            ${row.description ? `'${row.description.replace(/'/g, "''")}'` : 'NULL'},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `);

        // Get created elastic ID
        const created = await prisma.$queryRawUnsafe<any[]>(`
          SELECT "id" FROM "elastic_master" WHERE "elasticCode" = '${elasticCode}' LIMIT 1
        `);

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
            updatedAt: new Date()
          } as any
        });

        // Create stock if requested
        let stockCreated = false;
        if (createStock && row.stockQuantity && row.stockQuantity > 0) {
          // Get default warehouse
          const warehouse = await prisma.$queryRawUnsafe<any[]>(`
            SELECT "id" FROM "warehouses"
            WHERE "code" = '${row.locationCode || 'DEFAULT'}' OR "name" = 'Default Warehouse'
            LIMIT 1
          `);

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

      } catch (error: any) {
        results.push({
          success: false,
          row: i + 1,
          elasticCode,
          error: error.message
        });
      }
    }

    const summary = {
      total: data.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

    res.json({
      results,
      summary,
      message: `Bulk import completed: ${summary.success} succeeded, ${summary.failed} failed`
    });

  } catch (error: any) {
    console.error('Error in bulk import:', error);
    res.status(500).json({ error: 'Bulk import failed', details: error.message });
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

  } catch (error: any) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template', details: error.message });
  }
};
