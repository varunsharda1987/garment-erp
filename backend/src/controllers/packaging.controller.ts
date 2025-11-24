import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

const prisma = new PrismaClient();

/**
 * Create a single packaging item
 * Auto-generates packagingCode and creates corresponding material entry
 */
export const createPackaging = async (req: Request, res: Response) => {
  try {
    const {
      packagingName,
      supplierCode,
      buyerCode,
      packagingType,
      size,
      material,
      thickness,
      printDetails,
      pricePerPiece,
      pricePerHundred,
      supplierId,
      description
    } = req.body;

    // Validation
    if (!packagingName || packagingName.trim() === '') {
      return res.status(400).json({ error: 'Packaging name is required' });
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

    // Create packaging_master entry
    const packaging = await prisma.$executeRawUnsafe(`
      INSERT INTO "packaging_master" (
        "id", "packagingCode", "packagingName", "supplierCode", "buyerCode",
        "packagingType", "size", "material", "thickness", "printDetails", "pricePerPiece", "pricePerHundred",
        "supplierId", "description", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        '${packagingCode}',
        '${packagingName.replace(/'/g, "''")}',
        ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'},
        ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'},
        ${packagingType ? `'${packagingType.replace(/'/g, "''")}'` : 'NULL'},
        ${size ? `'${size.replace(/'/g, "''")}'` : 'NULL'},
        ${material ? `'${material.replace(/'/g, "''")}'` : 'NULL'},
        ${thickness ? `'${thickness.replace(/'/g, "''")}'` : 'NULL'},
        ${printDetails ? `'${printDetails.replace(/'/g, "''")}'` : 'NULL'},
        ${pricePerPiece || 'NULL'},
        ${pricePerHundred || 'NULL'},
        ${supplierId ? `'${supplierId}'` : 'NULL'},
        ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `);

    // Get the created packaging
    const createdPackaging = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "packaging_master" WHERE "packagingCode" = '${packagingCode}' LIMIT 1
    `);

    const packagingRecord = createdPackaging[0];

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
        updatedAt: new Date()
      } as any
    });

    res.status(201).json({
      packaging: packagingRecord,
      material: materialEntry,
      message: 'Packaging created successfully'
    });

  } catch (error: any) {
    console.error('Error creating packaging:', error);
    res.status(500).json({ error: 'Failed to create packaging', details: error.message });
  }
};

/**
 * Get all packaging items with pagination and search
 */
export const getAllPackaging = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      supplierId = ''
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    // Build WHERE clause
    let whereClause = `WHERE pm."isActive" = true`;

    if (search) {
      whereClause += ` AND (pm."packagingName" ILIKE '%${search}%' OR pm."packagingCode" ILIKE '%${search}%' OR pm."packagingType" ILIKE '%${search}%')`;
    }

    if (supplierId) {
      whereClause += ` AND pm."supplierId" = '${supplierId}'`;
    }

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::integer as count FROM "packaging_master" pm ${whereClause}
    `);
    const total = countResult[0]?.count || 0;

    // Get packaging items
    const packagingItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        pm.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName"
      FROM "packaging_master" pm
      LEFT JOIN "materials" m ON m."packagingId" = pm."id"
      LEFT JOIN "suppliers" s ON s."id" = pm."supplierId"
      ${whereClause}
      ORDER BY pm."createdAt" DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `);

    res.json({
      data: packagingItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Error fetching packaging items:', error);
    res.status(500).json({ error: 'Failed to fetch packaging items', details: error.message });
  }
};

/**
 * Get single packaging item by ID
 */
export const getPackagingById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const packagingItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        pm.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName",
        s."code" as "supplierCodeRef"
      FROM "packaging_master" pm
      LEFT JOIN "materials" m ON m."packagingId" = pm."id"
      LEFT JOIN "suppliers" s ON s."id" = pm."supplierId"
      WHERE pm."id" = '${id}'
      LIMIT 1
    `);

    if (packagingItems.length === 0) {
      return res.status(404).json({ error: 'Packaging not found' });
    }

    res.json(packagingItems[0]);

  } catch (error: any) {
    console.error('Error fetching packaging:', error);
    res.status(500).json({ error: 'Failed to fetch packaging', details: error.message });
  }
};

/**
 * Update packaging item
 * Note: packagingCode cannot be changed
 */
export const updatePackaging = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      packagingName,
      supplierCode,
      buyerCode,
      packagingType,
      size,
      material,
      thickness,
      printDetails,
      pricePerPiece,
      pricePerHundred,
      supplierId,
      description,
      isActive
    } = req.body;

    // Check if packaging exists
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "packaging_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Packaging not found' });
    }

    // Build UPDATE query
    const updates: string[] = [];
    if (packagingName !== undefined) updates.push(`"packagingName" = '${packagingName.replace(/'/g, "''")}'`);
    if (supplierCode !== undefined) updates.push(`"supplierCode" = ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'}`);
    if (buyerCode !== undefined) updates.push(`"buyerCode" = ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'}`);
    if (packagingType !== undefined) updates.push(`"packagingType" = ${packagingType ? `'${packagingType.replace(/'/g, "''")}'` : 'NULL'}`);
    if (size !== undefined) updates.push(`"size" = ${size ? `'${size.replace(/'/g, "''")}'` : 'NULL'}`);
    if (material !== undefined) updates.push(`"material" = ${material ? `'${material.replace(/'/g, "''")}'` : 'NULL'}`);
    if (thickness !== undefined) updates.push(`"thickness" = ${thickness ? `'${thickness.replace(/'/g, "''")}'` : 'NULL'}`);
    if (printDetails !== undefined) updates.push(`"printDetails" = ${printDetails ? `'${printDetails.replace(/'/g, "''")}'` : 'NULL'}`);
    if (pricePerPiece !== undefined) updates.push(`"pricePerPiece" = ${pricePerPiece || 'NULL'}`);
    if (pricePerHundred !== undefined) updates.push(`"pricePerHundred" = ${pricePerHundred || 'NULL'}`);
    if (supplierId !== undefined) updates.push(`"supplierId" = ${supplierId ? `'${supplierId}'` : 'NULL'}`);
    if (description !== undefined) updates.push(`"description" = ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'}`);
    if (isActive !== undefined) updates.push(`"isActive" = ${isActive}`);

    updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);

    await prisma.$executeRawUnsafe(`
      UPDATE "packaging_master"
      SET ${updates.join(', ')}
      WHERE "id" = '${id}'
    `);

    // Also update material name if packagingName changed
    if (packagingName) {
      await prisma.$executeRawUnsafe(`
        UPDATE "materials"
        SET "name" = '${packagingName.replace(/'/g, "''")}', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "packagingId" = '${id}'
      `);
    }

    // Fetch updated record
    const updated = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        pm.*,
        m."code" as "materialCode",
        m."id" as "materialId"
      FROM "packaging_master" pm
      LEFT JOIN "materials" m ON m."packagingId" = pm."id"
      WHERE pm."id" = '${id}'
      LIMIT 1
    `);

    res.json({
      packaging: updated[0],
      message: 'Packaging updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating packaging:', error);
    res.status(500).json({ error: 'Failed to update packaging', details: error.message });
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
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "packaging_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Packaging not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::integer as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."packagingId" = '${id}'
    `);

    if (bomUsage[0]?.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete packaging',
        message: `This packaging is used in ${bomUsage[0].count} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRawUnsafe(`
      DELETE FROM "materials" WHERE "packagingId" = '${id}'
    `);

    // Delete packaging
    await prisma.$executeRawUnsafe(`
      DELETE FROM "packaging_master" WHERE "id" = '${id}'
    `);

    res.json({ message: 'Packaging deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting packaging:', error);
    res.status(500).json({ error: 'Failed to delete packaging', details: error.message });
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

    const results: any[] = [];

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
        await prisma.$executeRawUnsafe(`
          INSERT INTO "packaging_master" (
            "id", "packagingCode", "packagingName", "supplierCode", "buyerCode",
            "packagingType", "size", "material", "thickness", "printDetails", "pricePerPiece", "pricePerHundred",
            "description", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            '${packagingCode}',
            '${row.packagingName.replace(/'/g, "''")}',
            ${row.supplierCode ? `'${row.supplierCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.buyerCode ? `'${row.buyerCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.packagingType ? `'${row.packagingType.replace(/'/g, "''")}'` : 'NULL'},
            ${row.size ? `'${row.size.replace(/'/g, "''")}'` : 'NULL'},
            ${row.material ? `'${row.material.replace(/'/g, "''")}'` : 'NULL'},
            ${row.thickness ? `'${row.thickness.replace(/'/g, "''")}'` : 'NULL'},
            ${row.printDetails ? `'${row.printDetails.replace(/'/g, "''")}'` : 'NULL'},
            ${row.pricePerPiece || 'NULL'},
            ${row.pricePerHundred || 'NULL'},
            ${row.description ? `'${row.description.replace(/'/g, "''")}'` : 'NULL'},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `);

        // Get created packaging ID
        const created = await prisma.$queryRawUnsafe<any[]>(`
          SELECT "id" FROM "packaging_master" WHERE "packagingCode" = '${packagingCode}' LIMIT 1
        `);

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

      } catch (error: any) {
        results.push({
          success: false,
          row: i + 1,
          packagingCode,
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

  } catch (error: any) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template', details: error.message });
  }
};
