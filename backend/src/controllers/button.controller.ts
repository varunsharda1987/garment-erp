import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

const prisma = new PrismaClient();

/**
 * Create a single button item
 * Auto-generates buttonCode and creates corresponding material entry
 */
export const createButton = async (req: Request, res: Response) => {
  try {
    const {
      buttonName,
      supplierCode,
      buyerCode,
      size,
      holes,
      color,
      material,
      shape,
      pricePerPiece,
      pricePerGross,
      supplierId,
      description
    } = req.body;

    // Validation
    if (!buttonName || buttonName.trim() === '') {
      return res.status(400).json({ error: 'Button name is required' });
    }

    // Auto-generate button code
    const buttonCode = await generateCode('BTN', 'button_master', 'buttonCode');

    // Get Buttons category ID
    const buttonCategory = await prisma.material_categories.findFirst({
      where: { name: 'Buttons' }
    });

    if (!buttonCategory) {
      return res.status(500).json({ error: 'Buttons category not found. Please run Phase 1 migration.' });
    }

    // Create button_master entry
    await prisma.$executeRawUnsafe(`
      INSERT INTO "button_master" (
        "id", "buttonCode", "buttonName", "supplierCode", "buyerCode",
        "size", "holes", "color", "material", "shape",
        "pricePerPiece", "pricePerGross", "supplierId", "description",
        "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        '${buttonCode}',
        '${buttonName.replace(/'/g, "''")}',
        ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'},
        ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'},
        ${size ? `'${size.replace(/'/g, "''")}'` : 'NULL'},
        ${holes || 'NULL'},
        ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'},
        ${material ? `'${material.replace(/'/g, "''")}'` : 'NULL'},
        ${shape ? `'${shape.replace(/'/g, "''")}'` : 'NULL'},
        ${pricePerPiece || 'NULL'},
        ${pricePerGross || 'NULL'},
        ${supplierId ? `'${supplierId}'` : 'NULL'},
        ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);

    // Get the created button
    const createdButton = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "button_master" WHERE "buttonCode" = '${buttonCode}' LIMIT 1
    `);

    const buttonRecord = createdButton[0];

    // Create corresponding material entry
    const materialCode = buttonCode; // Use same code
    const materialEntry = await prisma.materials.create({
      data: {
        id: `mat-${buttonCode.toLowerCase()}`,
        code: materialCode,
        name: buttonName,
        materialType: 'BUTTON',
        buttonId: buttonRecord.id,
        categoryId: buttonCategory.id,
        unit: 'PIECE',
        isActive: true,
        updatedAt: new Date()
      } as any
    });

    res.status(201).json({
      button: buttonRecord,
      material: materialEntry,
      message: 'Button created successfully'
    });

  } catch (error: any) {
    console.error('Error creating button:', error);
    res.status(500).json({ error: 'Failed to create button', details: error.message });
  }
};

/**
 * Get all buttons with pagination and search
 */
export const getAllButtons = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      supplierId
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = `WHERE b."isActive" = true`;

    if (search) {
      whereClause += ` AND (
        b."buttonName" ILIKE '%${search}%' OR
        b."buttonCode" ILIKE '%${search}%' OR
        b."color" ILIKE '%${search}%'
      )`;
    }

    if (supplierId) {
      whereClause += ` AND b."supplierId" = '${supplierId}'`;
    }

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) as count
      FROM "button_master" b
      ${whereClause}
    `);

    const total = parseInt(countResult[0].count);

    // Get buttons
    const buttons = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        b.*,
        m."id" as "materialId",
        m."code" as "materialCode",
        s."name" as "supplierName"
      FROM "button_master" b
      LEFT JOIN "materials" m ON m."buttonId" = b."id"
      LEFT JOIN "suppliers" s ON s."id" = b."supplierId"
      ${whereClause}
      ORDER BY b."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    res.json({
      data: buttons,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Error fetching buttons:', error);
    res.status(500).json({ error: 'Failed to fetch buttons', details: error.message });
  }
};

/**
 * Get button by ID
 */
export const getButtonById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const button = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        b.*,
        m."id" as "materialId",
        m."code" as "materialCode",
        s."name" as "supplierName"
      FROM "button_master" b
      LEFT JOIN "materials" m ON m."buttonId" = b."id"
      LEFT JOIN "suppliers" s ON s."id" = b."supplierId"
      WHERE b."id" = '${id}'
      LIMIT 1
    `);

    if (!button || button.length === 0) {
      return res.status(404).json({ error: 'Button not found' });
    }

    res.json({ button: button[0] });

  } catch (error: any) {
    console.error('Error fetching button:', error);
    res.status(500).json({ error: 'Failed to fetch button', details: error.message });
  }
};

/**
 * Update button
 */
export const updateButton = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      buttonName,
      supplierCode,
      buyerCode,
      size,
      holes,
      color,
      material,
      shape,
      pricePerPiece,
      pricePerGross,
      supplierId,
      description
    } = req.body;

    // Check if button exists
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "button_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Button not found' });
    }

    // Update button (preserve buttonCode)
    await prisma.$executeRawUnsafe(`
      UPDATE "button_master"
      SET
        "buttonName" = '${buttonName.replace(/'/g, "''")}',
        "supplierCode" = ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'},
        "buyerCode" = ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'},
        "size" = ${size ? `'${size.replace(/'/g, "''")}'` : 'NULL'},
        "holes" = ${holes || 'NULL'},
        "color" = ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'},
        "material" = ${material ? `'${material.replace(/'/g, "''")}'` : 'NULL'},
        "shape" = ${shape ? `'${shape.replace(/'/g, "''")}'` : 'NULL'},
        "pricePerPiece" = ${pricePerPiece || 'NULL'},
        "pricePerGross" = ${pricePerGross || 'NULL'},
        "supplierId" = ${supplierId ? `'${supplierId}'` : 'NULL'},
        "description" = ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = '${id}'
    `);

    // Update material name
    await prisma.$executeRawUnsafe(`
      UPDATE "materials"
      SET "name" = '${buttonName.replace(/'/g, "''")}', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "buttonId" = '${id}'
    `);

    // Get updated button
    const updated = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "button_master" WHERE "id" = '${id}' LIMIT 1
    `);

    res.json({
      button: updated[0],
      message: 'Button updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating button:', error);
    res.status(500).json({ error: 'Failed to update button', details: error.message });
  }
};

/**
 * Delete button
 */
export const deleteButton = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if used in any BOM
    const bomUsage = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."buttonId" = '${id}'
    `);

    if (parseInt(bomUsage[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete button',
        message: 'This button is used in one or more BOMs'
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRawUnsafe(`
      DELETE FROM "materials" WHERE "buttonId" = '${id}'
    `);

    // Delete button
    await prisma.$executeRawUnsafe(`
      DELETE FROM "button_master" WHERE "id" = '${id}'
    `);

    res.json({ message: 'Button deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting button:', error);
    res.status(500).json({ error: 'Failed to delete button', details: error.message });
  }
};

/**
 * Bulk import buttons from Excel
 */
export const bulkImportButtons = async (req: Request, res: Response) => {
  try {
    const { data, createStock = false } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided for import' });
    }

    // Get Buttons category
    const buttonCategory = await prisma.material_categories.findFirst({
      where: { name: 'Buttons' }
    });

    if (!buttonCategory) {
      return res.status(500).json({ error: 'Buttons category not found' });
    }

    // Pre-generate all button codes
    const codes = await generateBatchCodes('BTN', 'button_master', 'buttonCode', data.length);

    const results = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const buttonCode = codes[i];

      try {
        // Validate required field
        if (!row.buttonName || row.buttonName.trim() === '') {
          results.push({
            success: false,
            buttonCode,
            error: 'Button name is required',
            row: i + 1
          });
          continue;
        }

        // Insert button
        await prisma.$executeRawUnsafe(`
          INSERT INTO "button_master" (
            "id", "buttonCode", "buttonName", "supplierCode", "buyerCode",
            "size", "holes", "color", "material", "shape",
            "pricePerPiece", "pricePerGross", "supplierId", "description",
            "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            '${buttonCode}',
            '${row.buttonName.replace(/'/g, "''")}',
            ${row.supplierCode ? `'${row.supplierCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.buyerCode ? `'${row.buyerCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.size ? `'${row.size.replace(/'/g, "''")}'` : 'NULL'},
            ${row.holes || 'NULL'},
            ${row.color ? `'${row.color.replace(/'/g, "''")}'` : 'NULL'},
            ${row.material ? `'${row.material.replace(/'/g, "''")}'` : 'NULL'},
            ${row.shape ? `'${row.shape.replace(/'/g, "''")}'` : 'NULL'},
            ${row.pricePerPiece || 'NULL'},
            ${row.pricePerGross || 'NULL'},
            ${row.supplierId ? `'${row.supplierId}'` : 'NULL'},
            ${row.description ? `'${row.description.replace(/'/g, "''")}'` : 'NULL'},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `);

        // Get button ID
        const created = await prisma.$queryRawUnsafe<any[]>(`
          SELECT "id" FROM "button_master" WHERE "buttonCode" = '${buttonCode}' LIMIT 1
        `);

        const buttonId = created[0].id;

        // Create material
        await prisma.materials.create({
          data: {
            id: `mat-${buttonCode.toLowerCase()}`,
            code: buttonCode,
            name: row.buttonName,
            materialType: 'BUTTON',
            buttonId,
            categoryId: buttonCategory.id,
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
            WHERE "isActive" = true
            ORDER BY "createdAt" ASC
            LIMIT 1
          `);

          if (warehouse && warehouse.length > 0) {
            const materialId = `mat-${buttonCode.toLowerCase()}`;

            await prisma.$executeRawUnsafe(`
              INSERT INTO "stock_levels" (
                "id", "warehouseId", "materialId", "currentQuantity",
                "reorderLevel", "maxLevel", "locationCode",
                "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid()::text,
                '${warehouse[0].id}',
                '${materialId}',
                ${row.stockQuantity},
                ${row.reorderLevel || 0},
                ${row.maxLevel || 0},
                ${row.locationCode ? `'${row.locationCode.replace(/'/g, "''")}'` : 'NULL'},
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )
            `);

            stockCreated = true;
          }
        }

        results.push({
          success: true,
          buttonCode,
          materialCode: buttonCode,
          stockCreated,
          row: i + 1
        });

      } catch (error: any) {
        results.push({
          success: false,
          buttonCode,
          error: error.message,
          row: i + 1
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
    const template = {
      columns: [
        { field: 'buttonName', header: 'Button Name', required: true },
        { field: 'supplierCode', header: 'Supplier Code', required: false },
        { field: 'buyerCode', header: 'Buyer Code', required: false },
        { field: 'size', header: 'Size', required: false },
        { field: 'holes', header: 'Holes', required: false },
        { field: 'color', header: 'Color', required: false },
        { field: 'material', header: 'Material', required: false },
        { field: 'shape', header: 'Shape', required: false },
        { field: 'pricePerPiece', header: 'Price Per Piece', required: false },
        { field: 'pricePerGross', header: 'Price Per Gross', required: false },
        { field: 'description', header: 'Description', required: false },
        { field: 'stockQuantity', header: 'Stock Quantity', required: false },
        { field: 'locationCode', header: 'Location Code', required: false }
      ],
      example: {
        buttonName: 'Metal Button 15mm',
        supplierCode: 'SUP-001',
        size: '15mm',
        holes: 2,
        color: 'Silver',
        material: 'Metal',
        shape: 'Round',
        pricePerPiece: 0.25,
        pricePerGross: 30.00,
        description: 'Silver metal button 2-hole',
        stockQuantity: 1000,
        locationCode: 'WH-01-A'
      }
    };

    res.json(template);

  } catch (error: any) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template', details: error.message });
  }
};
