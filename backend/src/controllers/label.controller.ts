import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

const prisma = new PrismaClient();

/**
 * Create a single label item
 * Auto-generates labelCode and creates corresponding material entry
 */
export const createLabel = async (req: Request, res: Response) => {
  try {
    const {
      labelName,
      supplierCode,
      buyerCode,
      labelType,
      size,
      content,
      printMethod,
      material,
      color,
      pricePerPiece,
      pricePerHundred,
      supplierId,
      description
    } = req.body;

    // Auto-generate label code
    const labelCode = await generateCode('LBL', 'label_master', 'labelCode');

    // Auto-generate labelName if not provided
    let finalLabelName = labelName;
    if (!finalLabelName || finalLabelName.trim() === '') {
      const parts = [];
      if (buyerCode) parts.push(`[${buyerCode}]`);
      if (labelType) parts.push(labelType);
      if (color) parts.push(color);
      parts.push('Label');
      if (material) parts.push(material);
      if (size) parts.push(size);
      finalLabelName = parts.join(' ').trim() || `Label ${labelCode}`;
    }

    // Get Label category ID
    const labelCategory = await prisma.material_categories.findFirst({
      where: { name: 'Label' }
    });

    if (!labelCategory) {
      return res.status(500).json({ error: 'Label category not found. Please run Phase 1 migration.' });
    }

    // Create label_master entry
    const label = await prisma.$executeRawUnsafe(`
      INSERT INTO "label_master" (
        "id", "labelCode", "labelName", "supplierCode", "buyerCode",
        "labelType", "size", "content", "printMethod", "material", "color", "pricePerPiece", "pricePerHundred",
        "supplierId", "description", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        '${labelCode}',
        '${finalLabelName.replace(/'/g, "''")}',
        ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'},
        ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'},
        ${labelType ? `'${labelType.replace(/'/g, "''")}'` : 'NULL'},
        ${size ? `'${size.replace(/'/g, "''")}'` : 'NULL'},
        ${content ? `'${content.replace(/'/g, "''")}'` : 'NULL'},
        ${printMethod ? `'${printMethod.replace(/'/g, "''")}'` : 'NULL'},
        ${material ? `'${material.replace(/'/g, "''")}'` : 'NULL'},
        ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'},
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

    // Get the created label
    const createdLabel = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "label_master" WHERE "labelCode" = '${labelCode}' LIMIT 1
    `);

    const labelRecord = createdLabel[0];

    // Create corresponding material entry
    const materialCode = labelCode; // Use same code
    const materialEntry = await prisma.materials.create({
      data: {
        id: `mat-${labelCode.toLowerCase()}`,
        code: materialCode,
        name: labelName,
        materialType: 'LABEL',
        labelId: labelRecord.id,
        categoryId: labelCategory.id,
        unit: 'PIECE',
        isActive: true,
        updatedAt: new Date()
      } as any
    });

    res.status(201).json({
      label: labelRecord,
      material: materialEntry,
      message: 'Label created successfully'
    });

  } catch (error: any) {
    console.error('Error creating label:', error);
    res.status(500).json({ error: 'Failed to create label', details: error.message });
  }
};

/**
 * Get all label items with pagination and search
 */
export const getAllLabel = async (req: Request, res: Response) => {
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
      whereClause += ` AND (lm."labelName" ILIKE '%${search}%' OR lm."labelCode" ILIKE '%${search}%' OR lm."color" ILIKE '%${search}%')`;
    }

    if (supplierId) {
      whereClause += ` AND lm."supplierId" = '${supplierId}'`;
    }

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::integer as count FROM "label_master" lm ${whereClause}
    `);
    const total = countResult[0]?.count || 0;

    // Get label items
    const labelItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        lm.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName"
      FROM "label_master" lm
      LEFT JOIN "materials" m ON m."labelId" = lm."id"
      LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
      ${whereClause}
      ORDER BY lm."createdAt" DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `);

    res.json({
      data: labelItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Error fetching label items:', error);
    res.status(500).json({ error: 'Failed to fetch label items', details: error.message });
  }
};

/**
 * Get single label item by ID
 */
export const getLabelById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const labelItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        lm.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName",
        s."code" as "supplierCodeRef"
      FROM "label_master" lm
      LEFT JOIN "materials" m ON m."labelId" = lm."id"
      LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
      WHERE lm."id" = '${id}'
      LIMIT 1
    `);

    if (labelItems.length === 0) {
      return res.status(404).json({ error: 'Label not found' });
    }

    res.json(labelItems[0]);

  } catch (error: any) {
    console.error('Error fetching label:', error);
    res.status(500).json({ error: 'Failed to fetch label', details: error.message });
  }
};

/**
 * Update label item
 * Note: labelCode cannot be changed
 */
export const updateLabel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      labelName,
      supplierCode,
      buyerCode,
      labelType,
      size,
      content,
      printMethod,
      material,
      color,
      pricePerPiece,
      pricePerHundred,
      supplierId,
      description,
      isActive
    } = req.body;

    // Check if label exists
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "label_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Label not found' });
    }

    // Build UPDATE query
    const updates: string[] = [];
    if (labelName !== undefined) updates.push(`"labelName" = '${labelName.replace(/'/g, "''")}'`);
    if (supplierCode !== undefined) updates.push(`"supplierCode" = ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'}`);
    if (buyerCode !== undefined) updates.push(`"buyerCode" = ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'}`);
    if (labelType !== undefined) updates.push(`"labelType" = ${labelType ? `'${labelType.replace(/'/g, "''")}'` : 'NULL'}`);
    if (size !== undefined) updates.push(`"size" = ${size ? `'${size.replace(/'/g, "''")}'` : 'NULL'}`);
    if (content !== undefined) updates.push(`"content" = ${content ? `'${content.replace(/'/g, "''")}'` : 'NULL'}`);
    if (printMethod !== undefined) updates.push(`"printMethod" = ${printMethod ? `'${printMethod.replace(/'/g, "''")}'` : 'NULL'}`);
    if (material !== undefined) updates.push(`"material" = ${material ? `'${material.replace(/'/g, "''")}'` : 'NULL'}`);
    if (color !== undefined) updates.push(`"color" = ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'}`);
    if (pricePerPiece !== undefined) updates.push(`"pricePerPiece" = ${pricePerPiece || 'NULL'}`);
    if (pricePerHundred !== undefined) updates.push(`"pricePerHundred" = ${pricePerHundred || 'NULL'}`);
    if (supplierId !== undefined) updates.push(`"supplierId" = ${supplierId ? `'${supplierId}'` : 'NULL'}`);
    if (description !== undefined) updates.push(`"description" = ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'}`);
    if (isActive !== undefined) updates.push(`"isActive" = ${isActive}`);

    updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);

    await prisma.$executeRawUnsafe(`
      UPDATE "label_master"
      SET ${updates.join(', ')}
      WHERE "id" = '${id}'
    `);

    // Also update material name if labelName changed
    if (labelName) {
      await prisma.$executeRawUnsafe(`
        UPDATE "materials"
        SET "name" = '${labelName.replace(/'/g, "''")}', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "labelId" = '${id}'
      `);
    }

    // Fetch updated record
    const updated = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        lm.*,
        m."code" as "materialCode",
        m."id" as "materialId"
      FROM "label_master" lm
      LEFT JOIN "materials" m ON m."labelId" = lm."id"
      WHERE lm."id" = '${id}'
      LIMIT 1
    `);

    res.json({
      label: updated[0],
      message: 'Label updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating label:', error);
    res.status(500).json({ error: 'Failed to update label', details: error.message });
  }
};

/**
 * Delete label item
 * Checks if label is used in any BOM first
 */
export const deleteLabel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if label exists
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "label_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Label not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::integer as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."labelId" = '${id}'
    `);

    if (bomUsage[0]?.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete label',
        message: `This label is used in ${bomUsage[0].count} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRawUnsafe(`
      DELETE FROM "materials" WHERE "labelId" = '${id}'
    `);

    // Delete label
    await prisma.$executeRawUnsafe(`
      DELETE FROM "label_master" WHERE "id" = '${id}'
    `);

    res.json({ message: 'Label deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting label:', error);
    res.status(500).json({ error: 'Failed to delete label', details: error.message });
  }
};

/**
 * Bulk import label items from Excel
 * Auto-generates codes and creates material entries
 */
export const bulkImportLabel = async (req: Request, res: Response) => {
  try {
    const { data, createStock = false } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Data array is required' });
    }

    // Get Label category
    const labelCategory = await prisma.material_categories.findFirst({
      where: { name: 'Label' }
    });

    if (!labelCategory) {
      return res.status(500).json({ error: 'Label category not found' });
    }

    // Pre-generate all codes
    const codes = await generateBatchCodes('LBL', 'label_master', 'labelCode', data.length);

    const results: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const labelCode = codes[i];

      try {
        // Validate required field
        if (!row.labelName || row.labelName.trim() === '') {
          results.push({
            success: false,
            row: i + 1,
            error: 'Label name is required'
          });
          continue;
        }

        // Create label
        await prisma.$executeRawUnsafe(`
          INSERT INTO "label_master" (
            "id", "labelCode", "labelName", "supplierCode", "buyerCode",
            "labelType", "size", "content", "printMethod", "material", "color", "pricePerPiece", "pricePerHundred",
            "description", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            '${labelCode}',
            '${row.labelName.replace(/'/g, "''")}',
            ${row.supplierCode ? `'${row.supplierCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.buyerCode ? `'${row.buyerCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.labelType ? `'${row.labelType.replace(/'/g, "''")}'` : 'NULL'},
            ${row.size ? `'${row.size.replace(/'/g, "''")}'` : 'NULL'},
            ${row.content ? `'${row.content.replace(/'/g, "''")}'` : 'NULL'},
            ${row.printMethod ? `'${row.printMethod.replace(/'/g, "''")}'` : 'NULL'},
            ${row.material ? `'${row.material.replace(/'/g, "''")}'` : 'NULL'},
            ${row.color ? `'${row.color.replace(/'/g, "''")}'` : 'NULL'},
            ${row.pricePerPiece || 'NULL'},
            ${row.pricePerHundred || 'NULL'},
            ${row.description ? `'${row.description.replace(/'/g, "''")}'` : 'NULL'},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `);

        // Get created label ID
        const created = await prisma.$queryRawUnsafe<any[]>(`
          SELECT "id" FROM "label_master" WHERE "labelCode" = '${labelCode}' LIMIT 1
        `);

        const labelId = created[0].id;

        // Create material
        await prisma.materials.create({
          data: {
            id: `mat-${labelCode.toLowerCase()}`,
            code: labelCode,
            name: row.labelName,
            materialType: 'LABEL',
            labelId,
            categoryId: labelCategory.id,
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
                materialId: `mat-${labelCode.toLowerCase()}`,
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
          labelCode,
          materialCode: labelCode,
          labelName: row.labelName,
          stockCreated
        });

      } catch (error: any) {
        results.push({
          success: false,
          row: i + 1,
          labelCode,
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
        { name: 'labelName', required: true, description: 'Name of the label (Required)' },
        { name: 'supplierCode', required: false, description: "Supplier's reference code (Optional)" },
        { name: 'buyerCode', required: false, description: "Buyer's reference code (Optional)" },
        { name: 'type', required: false, description: 'Label type (e.g., Woven, Printed, Heat Transfer) (Optional)' },
        { name: 'size', required: false, description: 'Size/dimensions (Optional)' },
        { name: 'color', required: false, description: 'Color name (Optional)' },
        { name: 'material', required: false, description: 'Material composition (e.g., Polyester, Satin) (Optional)' },
        { name: 'pricePerPiece', required: false, description: 'Price per piece (Optional)' },
        { name: 'stockQuantity', required: false, description: 'Initial stock quantity (Optional)' },
        { name: 'locationCode', required: false, description: 'Warehouse location code (Optional)' }
      ],
      exampleData: [
        {
          labelName: 'Brand Logo Woven Label',
          supplierCode: 'LBL-001',
          buyerCode: '',
          type: 'Woven',
          size: '2x1 inch',
          color: 'White',
          material: 'Polyester',
          pricePerPiece: 0.50,
          stockQuantity: 1000,
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
