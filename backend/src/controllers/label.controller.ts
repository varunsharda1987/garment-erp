import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';
import { logError } from '../utils/logger';
import {
  LabelMasterRecord,
  CountResult,
  BulkImportResult,
  BulkImportSummary,
  WarehouseRecord,
} from '../types/material-master.types';

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
    await prisma.$executeRaw`
      INSERT INTO "label_master" (
        "id", "labelCode", "labelName", "supplierCode", "buyerCode",
        "labelType", "size", "content", "printMethod", "material", "color", "pricePerPiece", "pricePerHundred",
        "supplierId", "description", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${labelCode},
        ${finalLabelName},
        ${supplierCode || null},
        ${buyerCode || null},
        ${labelType || null},
        ${size || null},
        ${content || null},
        ${printMethod || null},
        ${material || null},
        ${color || null},
        ${pricePerPiece || null},
        ${pricePerHundred || null},
        ${supplierId || null},
        ${description || null},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    // Get the created label
    const createdLabel = await prisma.$queryRaw<LabelMasterRecord[]>`
      SELECT * FROM "label_master" WHERE "labelCode" = ${labelCode} LIMIT 1
    `;

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
      } as Prisma.materialsUncheckedCreateInput
    });

    res.status(201).json({
      label: labelRecord,
      material: materialEntry,
      message: 'Label created successfully'
    });

  } catch (error: unknown) {
    logError('Error creating label:', error);
    res.status(500).json({ error: 'Failed to create label', details: error instanceof Error ? error.message : 'Unknown error' });
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
    const searchTerm = search as string;
    const supplierIdStr = supplierId as string;

    let countResult: CountResult[];
    let labelItems: LabelMasterRecord[];

    // Use separate query branches for different filter combinations
    if (searchTerm && supplierIdStr) {
      // Both search and supplierId filters
      const searchPattern = `%${searchTerm}%`;

      countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "label_master" lm
        WHERE lm."isActive" = true
          AND (lm."labelName" ILIKE ${searchPattern} OR lm."labelCode" ILIKE ${searchPattern} OR lm."color" ILIKE ${searchPattern})
          AND lm."supplierId" = ${supplierIdStr}
      `;

      labelItems = await prisma.$queryRaw<LabelMasterRecord[]>`
        SELECT
          lm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "label_master" lm
        LEFT JOIN "materials" m ON m."labelId" = lm."id"
        LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
        WHERE lm."isActive" = true
          AND (lm."labelName" ILIKE ${searchPattern} OR lm."labelCode" ILIKE ${searchPattern} OR lm."color" ILIKE ${searchPattern})
          AND lm."supplierId" = ${supplierIdStr}
        ORDER BY lm."createdAt" DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
    } else if (searchTerm) {
      // Only search filter
      const searchPattern = `%${searchTerm}%`;

      countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "label_master" lm
        WHERE lm."isActive" = true
          AND (lm."labelName" ILIKE ${searchPattern} OR lm."labelCode" ILIKE ${searchPattern} OR lm."color" ILIKE ${searchPattern})
      `;

      labelItems = await prisma.$queryRaw<LabelMasterRecord[]>`
        SELECT
          lm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "label_master" lm
        LEFT JOIN "materials" m ON m."labelId" = lm."id"
        LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
        WHERE lm."isActive" = true
          AND (lm."labelName" ILIKE ${searchPattern} OR lm."labelCode" ILIKE ${searchPattern} OR lm."color" ILIKE ${searchPattern})
        ORDER BY lm."createdAt" DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
    } else if (supplierIdStr) {
      // Only supplierId filter
      countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "label_master" lm
        WHERE lm."isActive" = true
          AND lm."supplierId" = ${supplierIdStr}
      `;

      labelItems = await prisma.$queryRaw<LabelMasterRecord[]>`
        SELECT
          lm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "label_master" lm
        LEFT JOIN "materials" m ON m."labelId" = lm."id"
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
        FROM "label_master" lm
        WHERE lm."isActive" = true
      `;

      labelItems = await prisma.$queryRaw<LabelMasterRecord[]>`
        SELECT
          lm.*,
          m."code" as "materialCode",
          m."id" as "materialId",
          s."name" as "supplierName"
        FROM "label_master" lm
        LEFT JOIN "materials" m ON m."labelId" = lm."id"
        LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
        WHERE lm."isActive" = true
        ORDER BY lm."createdAt" DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
    }

    const total = countResult[0]?.count || 0;

    res.json({
      data: labelItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: unknown) {
    logError('Error fetching label items:', error);
    res.status(500).json({ error: 'Failed to fetch label items', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Get single label item by ID
 */
export const getLabelById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const labelItems = await prisma.$queryRaw<LabelMasterRecord[]>`
      SELECT
        lm.*,
        m."code" as "materialCode",
        m."id" as "materialId",
        s."name" as "supplierName",
        s."code" as "supplierCodeRef"
      FROM "label_master" lm
      LEFT JOIN "materials" m ON m."labelId" = lm."id"
      LEFT JOIN "suppliers" s ON s."id" = lm."supplierId"
      WHERE lm."id" = ${id}
      LIMIT 1
    `;

    if (labelItems.length === 0) {
      return res.status(404).json({ error: 'Label not found' });
    }

    res.json(labelItems[0]);

  } catch (error: unknown) {
    logError('Error fetching label:', error);
    res.status(500).json({ error: 'Failed to fetch label', details: error instanceof Error ? error.message : 'Unknown error' });
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
    const existing = await prisma.$queryRaw<LabelMasterRecord[]>`
      SELECT * FROM "label_master" WHERE "id" = ${id} LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Label not found' });
    }

    // Build UPDATE query using Prisma.sql
    const updateFields: Prisma.Sql[] = [];

    if (labelName !== undefined) {
      updateFields.push(Prisma.sql`"labelName" = ${labelName}`);
    }
    if (supplierCode !== undefined) {
      updateFields.push(Prisma.sql`"supplierCode" = ${supplierCode || null}`);
    }
    if (buyerCode !== undefined) {
      updateFields.push(Prisma.sql`"buyerCode" = ${buyerCode || null}`);
    }
    if (labelType !== undefined) {
      updateFields.push(Prisma.sql`"labelType" = ${labelType || null}`);
    }
    if (size !== undefined) {
      updateFields.push(Prisma.sql`"size" = ${size || null}`);
    }
    if (content !== undefined) {
      updateFields.push(Prisma.sql`"content" = ${content || null}`);
    }
    if (printMethod !== undefined) {
      updateFields.push(Prisma.sql`"printMethod" = ${printMethod || null}`);
    }
    if (material !== undefined) {
      updateFields.push(Prisma.sql`"material" = ${material || null}`);
    }
    if (color !== undefined) {
      updateFields.push(Prisma.sql`"color" = ${color || null}`);
    }
    if (pricePerPiece !== undefined) {
      updateFields.push(Prisma.sql`"pricePerPiece" = ${pricePerPiece || null}`);
    }
    if (pricePerHundred !== undefined) {
      updateFields.push(Prisma.sql`"pricePerHundred" = ${pricePerHundred || null}`);
    }
    if (supplierId !== undefined) {
      updateFields.push(Prisma.sql`"supplierId" = ${supplierId || null}`);
    }
    if (description !== undefined) {
      updateFields.push(Prisma.sql`"description" = ${description || null}`);
    }
    if (isActive !== undefined) {
      updateFields.push(Prisma.sql`"isActive" = ${isActive}`);
    }

    updateFields.push(Prisma.sql`"updatedAt" = CURRENT_TIMESTAMP`);

    // Join all update fields with commas
    const updateQuery = Prisma.sql`
      UPDATE "label_master"
      SET ${Prisma.join(updateFields, ', ')}
      WHERE "id" = ${id}
    `;

    await prisma.$executeRaw(updateQuery);

    // Also update material name if labelName changed
    if (labelName) {
      await prisma.$executeRaw`
        UPDATE "materials"
        SET "name" = ${labelName}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "labelId" = ${id}
      `;
    }

    // Fetch updated record
    const updated = await prisma.$queryRaw<LabelMasterRecord[]>`
      SELECT
        lm.*,
        m."code" as "materialCode",
        m."id" as "materialId"
      FROM "label_master" lm
      LEFT JOIN "materials" m ON m."labelId" = lm."id"
      WHERE lm."id" = ${id}
      LIMIT 1
    `;

    res.json({
      label: updated[0],
      message: 'Label updated successfully'
    });

  } catch (error: unknown) {
    logError('Error updating label:', error);
    res.status(500).json({ error: 'Failed to update label', details: error instanceof Error ? error.message : 'Unknown error' });
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
    const existing = await prisma.$queryRaw<LabelMasterRecord[]>`
      SELECT * FROM "label_master" WHERE "id" = ${id} LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Label not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.$queryRaw<CountResult[]>`
      SELECT COUNT(*)::integer as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."labelId" = ${id}
    `;

    if (bomUsage[0]?.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete label',
        message: `This label is used in ${bomUsage[0].count} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRaw`
      DELETE FROM "materials" WHERE "labelId" = ${id}
    `;

    // Delete label
    await prisma.$executeRaw`
      DELETE FROM "label_master" WHERE "id" = ${id}
    `;

    res.json({ message: 'Label deleted successfully' });

  } catch (error: unknown) {
    logError('Error deleting label:', error);
    res.status(500).json({ error: 'Failed to delete label', details: error instanceof Error ? error.message : 'Unknown error' });
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

    const results: BulkImportResult[] = [];

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
        await prisma.$executeRaw`
          INSERT INTO "label_master" (
            "id", "labelCode", "labelName", "supplierCode", "buyerCode",
            "labelType", "size", "content", "printMethod", "material", "color", "pricePerPiece", "pricePerHundred",
            "description", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            ${labelCode},
            ${row.labelName},
            ${row.supplierCode || null},
            ${row.buyerCode || null},
            ${row.labelType || null},
            ${row.size || null},
            ${row.content || null},
            ${row.printMethod || null},
            ${row.material || null},
            ${row.color || null},
            ${row.pricePerPiece || null},
            ${row.pricePerHundred || null},
            ${row.description || null},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;

        // Get created label ID
        const created = await prisma.$queryRaw<LabelMasterRecord[]>`
          SELECT "id" FROM "label_master" WHERE "labelCode" = ${labelCode} LIMIT 1
        `;

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
          } as Prisma.materialsUncheckedCreateInput
        });

        // Create stock if requested
        let stockCreated = false;
        if (createStock && row.stockQuantity && row.stockQuantity > 0) {
          // Get default warehouse
          const warehouseCode = row.locationCode || 'DEFAULT';
          const warehouse = await prisma.$queryRaw<WarehouseRecord[]>`
            SELECT "id" FROM "warehouses"
            WHERE "code" = ${warehouseCode} OR "name" = 'Default Warehouse'
            LIMIT 1
          `;

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

      } catch (error: unknown) {
        results.push({
          success: false,
          row: i + 1,
          labelCode,
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

  } catch (error: unknown) {
    logError('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};
