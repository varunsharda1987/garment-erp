import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

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
    const lace = await prisma.$executeRawUnsafe(`
      INSERT INTO "lace_master" (
        "id", "laceCode", "laceName", "supplierCode", "buyerCode",
        "width", "design", "color", "composition", "pricePerMeter",
        "supplierId", "description", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        '${laceCode}',
        '${finalLaceName.replace(/'/g, "''")}',
        ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'},
        ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'},
        ${width || 'NULL'},
        ${design ? `'${design.replace(/'/g, "''")}'` : 'NULL'},
        ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'},
        ${composition ? `'${composition.replace(/'/g, "''")}'` : 'NULL'},
        ${pricePerMeter || 'NULL'},
        ${supplierId ? `'${supplierId}'` : 'NULL'},
        ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `);

    // Get the created lace
    const createdLace = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "lace_master" WHERE "laceCode" = '${laceCode}' LIMIT 1
    `);

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
      } as any
    });

    res.status(201).json({
      lace: laceRecord,
      material,
      message: 'Lace created successfully'
    });

  } catch (error: any) {
    console.error('Error creating lace:', error);
    res.status(500).json({ error: 'Failed to create lace', details: error.message });
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

    // Build WHERE clause
    let whereClause = `WHERE lm."isActive" = true`;

    if (search) {
      whereClause += ` AND (lm."laceName" ILIKE '%${search}%' OR lm."laceCode" ILIKE '%${search}%' OR lm."color" ILIKE '%${search}%')`;
    }

    if (supplierId) {
      whereClause += ` AND lm."supplierId" = '${supplierId}'`;
    }

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::integer as count FROM "lace_master" lm ${whereClause}
    `);
    const total = countResult[0]?.count || 0;

    // Get lace items
    const laceItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        lm.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName"
      FROM "lace_master" lm
      LEFT JOIN "materials" m ON m."laceId" = lm."id"
      LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
      ${whereClause}
      ORDER BY lm."createdAt" DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `);

    res.json({
      data: laceItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Error fetching lace items:', error);
    res.status(500).json({ error: 'Failed to fetch lace items', details: error.message });
  }
};

/**
 * Get single lace item by ID
 */
export const getLaceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const laceItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        lm.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName",
        s."code" as "supplierCodeRef"
      FROM "lace_master" lm
      LEFT JOIN "materials" m ON m."laceId" = lm."id"
      LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
      WHERE lm."id" = '${id}'
      LIMIT 1
    `);

    if (laceItems.length === 0) {
      return res.status(404).json({ error: 'Lace not found' });
    }

    res.json(laceItems[0]);

  } catch (error: any) {
    console.error('Error fetching lace:', error);
    res.status(500).json({ error: 'Failed to fetch lace', details: error.message });
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
      pricePerMeter,
      supplierId,
      description,
      isActive
    } = req.body;

    // Check if lace exists
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "lace_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Lace not found' });
    }

    // Build UPDATE query
    const updates: string[] = [];
    if (laceName !== undefined) updates.push(`"laceName" = '${laceName.replace(/'/g, "''")}'`);
    if (supplierCode !== undefined) updates.push(`"supplierCode" = ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'}`);
    if (buyerCode !== undefined) updates.push(`"buyerCode" = ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'}`);
    if (width !== undefined) updates.push(`"width" = ${width || 'NULL'}`);
    if (design !== undefined) updates.push(`"design" = ${design ? `'${design.replace(/'/g, "''")}'` : 'NULL'}`);
    if (color !== undefined) updates.push(`"color" = ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'}`);
    if (composition !== undefined) updates.push(`"composition" = ${composition ? `'${composition.replace(/'/g, "''")}'` : 'NULL'}`);
    if (pricePerMeter !== undefined) updates.push(`"pricePerMeter" = ${pricePerMeter || 'NULL'}`);
    if (supplierId !== undefined) updates.push(`"supplierId" = ${supplierId ? `'${supplierId}'` : 'NULL'}`);
    if (description !== undefined) updates.push(`"description" = ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'}`);
    if (isActive !== undefined) updates.push(`"isActive" = ${isActive}`);

    updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);

    await prisma.$executeRawUnsafe(`
      UPDATE "lace_master"
      SET ${updates.join(', ')}
      WHERE "id" = '${id}'
    `);

    // Also update material name if laceName changed
    if (laceName) {
      await prisma.$executeRawUnsafe(`
        UPDATE "materials"
        SET "name" = '${laceName.replace(/'/g, "''")}', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "laceId" = '${id}'
      `);
    }

    // Fetch updated record
    const updated = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        lm.*,
        m."code" as "materialCode",
        m."id" as "materialId"
      FROM "lace_master" lm
      LEFT JOIN "materials" m ON m."laceId" = lm."id"
      WHERE lm."id" = '${id}'
      LIMIT 1
    `);

    res.json({
      lace: updated[0],
      message: 'Lace updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating lace:', error);
    res.status(500).json({ error: 'Failed to update lace', details: error.message });
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
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "lace_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Lace not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::integer as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."laceId" = '${id}'
    `);

    if (bomUsage[0]?.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete lace',
        message: `This lace is used in ${bomUsage[0].count} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRawUnsafe(`
      DELETE FROM "materials" WHERE "laceId" = '${id}'
    `);

    // Delete lace
    await prisma.$executeRawUnsafe(`
      DELETE FROM "lace_master" WHERE "id" = '${id}'
    `);

    res.json({ message: 'Lace deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting lace:', error);
    res.status(500).json({ error: 'Failed to delete lace', details: error.message });
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

    const results: any[] = [];

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
        await prisma.$executeRawUnsafe(`
          INSERT INTO "lace_master" (
            "id", "laceCode", "laceName", "supplierCode", "buyerCode",
            "width", "design", "color", "composition", "pricePerMeter",
            "description", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            '${laceCode}',
            '${row.laceName.replace(/'/g, "''")}',
            ${row.supplierCode ? `'${row.supplierCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.buyerCode ? `'${row.buyerCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.width || 'NULL'},
            ${row.design ? `'${row.design.replace(/'/g, "''")}'` : 'NULL'},
            ${row.color ? `'${row.color.replace(/'/g, "''")}'` : 'NULL'},
            ${row.composition ? `'${row.composition.replace(/'/g, "''")}'` : 'NULL'},
            ${row.pricePerMeter || 'NULL'},
            ${row.description ? `'${row.description.replace(/'/g, "''")}'` : 'NULL'},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `);

        // Get created lace ID
        const created = await prisma.$queryRawUnsafe<any[]>(`
          SELECT "id" FROM "lace_master" WHERE "laceCode" = '${laceCode}' LIMIT 1
        `);

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

      } catch (error: any) {
        results.push({
          success: false,
          row: i + 1,
          laceCode,
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
        { name: 'laceName', required: true, description: 'Name of the lace (Required)' },
        { name: 'supplierCode', required: false, description: "Supplier's reference code (Optional)" },
        { name: 'buyerCode', required: false, description: "Buyer's reference code (Optional)" },
        { name: 'width', required: false, description: 'Width in inches (Optional)' },
        { name: 'design', required: false, description: 'Design/pattern description (Optional)' },
        { name: 'color', required: false, description: 'Color name (Optional)' },
        { name: 'composition', required: false, description: 'Material composition (Optional)' },
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
          pricePerMeter: 15.50,
          stockQuantity: 100,
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
