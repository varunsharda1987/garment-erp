import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

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

    // Validation
    if (!zipperName || zipperName.trim() === '') {
      return res.status(400).json({ error: 'Zipper name is required' });
    }

    // Auto-generate zipper code
    const zipperCode = await generateCode('ZIP', 'zipper_master', 'zipperCode');

    // Get Zipper category ID
    const zipperCategory = await prisma.material_categories.findFirst({
      where: { name: 'Zipper' }
    });

    if (!zipperCategory) {
      return res.status(500).json({ error: 'Zipper category not found. Please run Phase 1 migration.' });
    }

    // Create zipper_master entry
    const zipper = await prisma.$executeRawUnsafe(`
      INSERT INTO "zipper_master" (
        "id", "zipperCode", "zipperName", "supplierCode", "buyerCode",
        "length", "teethType", "color", "brand", "sliderType", "tapeWidth", "pricePerPiece",
        "supplierId", "description", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        '${zipperCode}',
        '${zipperName.replace(/'/g, "''")}',
        ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'},
        ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'},
        ${length || 'NULL'},
        ${teethType ? `'${teethType.replace(/'/g, "''")}'` : 'NULL'},
        ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'},
        ${brand ? `'${brand.replace(/'/g, "''")}'` : 'NULL'},
        ${sliderType ? `'${sliderType.replace(/'/g, "''")}'` : 'NULL'},
        ${tapeWidth || 'NULL'},
        ${pricePerPiece || 'NULL'},
        ${supplierId ? `'${supplierId}'` : 'NULL'},
        ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `);

    // Get the created zipper
    const createdZipper = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "zipper_master" WHERE "zipperCode" = '${zipperCode}' LIMIT 1
    `);

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
        updatedAt: new Date()
      } as any
    });

    res.status(201).json({
      zipper: zipperRecord,
      material,
      message: 'Zipper created successfully'
    });

  } catch (error: any) {
    console.error('Error creating zipper:', error);
    res.status(500).json({ error: 'Failed to create zipper', details: error.message });
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

    // Build WHERE clause
    let whereClause = `WHERE zm."isActive" = true`;

    if (search) {
      whereClause += ` AND (zm."zipperName" ILIKE '%${search}%' OR zm."zipperCode" ILIKE '%${search}%' OR zm."color" ILIKE '%${search}%')`;
    }

    if (supplierId) {
      whereClause += ` AND zm."supplierId" = '${supplierId}'`;
    }

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::integer as count FROM "zipper_master" zm ${whereClause}
    `);
    const total = countResult[0]?.count || 0;

    // Get zipper items
    const zipperItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        zm.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName"
      FROM "zipper_master" zm
      LEFT JOIN "materials" m ON m."zipperId" = zm."id"
      LEFT JOIN "suppliers" s ON s."id" = zm."supplierId"
      ${whereClause}
      ORDER BY zm."createdAt" DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `);

    res.json({
      data: zipperItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Error fetching zipper items:', error);
    res.status(500).json({ error: 'Failed to fetch zipper items', details: error.message });
  }
};

/**
 * Get single zipper item by ID
 */
export const getZipperById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const zipperItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        zm.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName",
        s."code" as "supplierCodeRef"
      FROM "zipper_master" zm
      LEFT JOIN "materials" m ON m."zipperId" = zm."id"
      LEFT JOIN "suppliers" s ON s."id" = zm."supplierId"
      WHERE zm."id" = '${id}'
      LIMIT 1
    `);

    if (zipperItems.length === 0) {
      return res.status(404).json({ error: 'Zipper not found' });
    }

    res.json(zipperItems[0]);

  } catch (error: any) {
    console.error('Error fetching zipper:', error);
    res.status(500).json({ error: 'Failed to fetch zipper', details: error.message });
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
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "zipper_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Zipper not found' });
    }

    // Build UPDATE query
    const updates: string[] = [];
    if (zipperName !== undefined) updates.push(`"zipperName" = '${zipperName.replace(/'/g, "''")}'`);
    if (supplierCode !== undefined) updates.push(`"supplierCode" = ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'}`);
    if (buyerCode !== undefined) updates.push(`"buyerCode" = ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'}`);
    if (length !== undefined) updates.push(`"length" = ${length || 'NULL'}`);
    if (teethType !== undefined) updates.push(`"teethType" = ${teethType ? `'${teethType.replace(/'/g, "''")}'` : 'NULL'}`);
    if (color !== undefined) updates.push(`"color" = ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'}`);
    if (brand !== undefined) updates.push(`"brand" = ${brand ? `'${brand.replace(/'/g, "''")}'` : 'NULL'}`);
    if (sliderType !== undefined) updates.push(`"sliderType" = ${sliderType ? `'${sliderType.replace(/'/g, "''")}'` : 'NULL'}`);
    if (tapeWidth !== undefined) updates.push(`"tapeWidth" = ${tapeWidth || 'NULL'}`);
    if (pricePerPiece !== undefined) updates.push(`"pricePerPiece" = ${pricePerPiece || 'NULL'}`);
    if (supplierId !== undefined) updates.push(`"supplierId" = ${supplierId ? `'${supplierId}'` : 'NULL'}`);
    if (description !== undefined) updates.push(`"description" = ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'}`);
    if (isActive !== undefined) updates.push(`"isActive" = ${isActive}`);

    updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);

    await prisma.$executeRawUnsafe(`
      UPDATE "zipper_master"
      SET ${updates.join(', ')}
      WHERE "id" = '${id}'
    `);

    // Also update material name if zipperName changed
    if (zipperName) {
      await prisma.$executeRawUnsafe(`
        UPDATE "materials"
        SET "name" = '${zipperName.replace(/'/g, "''")}', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "zipperId" = '${id}'
      `);
    }

    // Fetch updated record
    const updated = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        zm.*,
        m."code" as "materialCode",
        m."id" as "materialId"
      FROM "zipper_master" zm
      LEFT JOIN "materials" m ON m."zipperId" = zm."id"
      WHERE zm."id" = '${id}'
      LIMIT 1
    `);

    res.json({
      zipper: updated[0],
      message: 'Zipper updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating zipper:', error);
    res.status(500).json({ error: 'Failed to update zipper', details: error.message });
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
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "zipper_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Zipper not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::integer as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."zipperId" = '${id}'
    `);

    if (bomUsage[0]?.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete zipper',
        message: `This zipper is used in ${bomUsage[0].count} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRawUnsafe(`
      DELETE FROM "materials" WHERE "zipperId" = '${id}'
    `);

    // Delete zipper
    await prisma.$executeRawUnsafe(`
      DELETE FROM "zipper_master" WHERE "id" = '${id}'
    `);

    res.json({ message: 'Zipper deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting zipper:', error);
    res.status(500).json({ error: 'Failed to delete zipper', details: error.message });
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
            error: 'Zipper name is required'
          });
          continue;
        }

        // Create zipper
        await prisma.$executeRawUnsafe(`
          INSERT INTO "zipper_master" (
            "id", "zipperCode", "zipperName", "supplierCode", "buyerCode",
            "length", "teethType", "color", "brand", "sliderType", "tapeWidth", "pricePerPiece",
            "description", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            '${zipperCode}',
            '${row.zipperName.replace(/'/g, "''")}',
            ${row.supplierCode ? `'${row.supplierCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.buyerCode ? `'${row.buyerCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.length || 'NULL'},
            ${row.teethType ? `'${row.teethType.replace(/'/g, "''")}'` : 'NULL'},
            ${row.color ? `'${row.color.replace(/'/g, "''")}'` : 'NULL'},
            ${row.brand ? `'${row.brand.replace(/'/g, "''")}'` : 'NULL'},
            ${row.sliderType ? `'${row.sliderType.replace(/'/g, "''")}'` : 'NULL'},
            ${row.tapeWidth || 'NULL'},
            ${row.pricePerPiece || 'NULL'},
            ${row.description ? `'${row.description.replace(/'/g, "''")}'` : 'NULL'},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `);

        // Get created zipper ID
        const created = await prisma.$queryRawUnsafe<any[]>(`
          SELECT "id" FROM "zipper_master" WHERE "zipperCode" = '${zipperCode}' LIMIT 1
        `);

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

      } catch (error: any) {
        results.push({
          success: false,
          row: i + 1,
          zipperCode,
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

  } catch (error: any) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template', details: error.message });
  }
};
