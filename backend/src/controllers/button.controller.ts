import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';
import { logError } from '../utils/logger';
import {
  ButtonMasterRecord,
  CountResult,
  BulkImportResult,
  BulkImportSummary,
  WarehouseRecord,
} from '../types/material-master.types';

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

    // Auto-generate button code
    const buttonCode = await generateCode('BTN', 'button_master', 'buttonCode');

    // Auto-generate buttonName if not provided
    let finalButtonName = buttonName;
    if (!finalButtonName || finalButtonName.trim() === '') {
      const parts = [];
      if (buyerCode) parts.push(`[${buyerCode}]`);
      if (color) parts.push(color);
      if (material) parts.push(material);
      if (holes) parts.push(`${holes}-Hole`);
      parts.push('Button');
      if (size) parts.push(size);
      finalButtonName = parts.join(' ').trim() || `Button ${buttonCode}`;
    }

    // Get Buttons category ID
    const buttonCategory = await prisma.material_categories.findFirst({
      where: { name: 'Buttons' }
    });

    if (!buttonCategory) {
      return res.status(500).json({ error: 'Buttons category not found. Please run Phase 1 migration.' });
    }

    // Create button_master entry using parameterized query
    await prisma.$executeRaw`
      INSERT INTO "button_master" (
        "id", "buttonCode", "buttonName", "supplierCode", "buyerCode",
        "size", "holes", "color", "material", "shape",
        "pricePerPiece", "pricePerGross", "supplierId", "description",
        "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${buttonCode},
        ${finalButtonName},
        ${supplierCode || null},
        ${buyerCode || null},
        ${size || null},
        ${holes ? Number(holes) : null},
        ${color || null},
        ${material || null},
        ${shape || null},
        ${pricePerPiece ? Number(pricePerPiece) : null},
        ${pricePerGross ? Number(pricePerGross) : null},
        ${supplierId || null},
        ${description || null},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    // Get the created button using parameterized query
    const createdButton = await prisma.$queryRaw<ButtonMasterRecord[]>`
      SELECT * FROM "button_master" WHERE "buttonCode" = ${buttonCode} LIMIT 1
    `;

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
      } as Prisma.materialsUncheckedCreateInput
    });

    res.status(201).json({
      button: buttonRecord,
      material: materialEntry,
      message: 'Button created successfully'
    });

  } catch (error: unknown) {
    logError('Error creating button:', error);
    res.status(500).json({ error: 'Failed to create button', details: error instanceof Error ? error.message : 'Unknown error' });
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

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;
    const searchTerm = `%${String(search)}%`;

    let total: number;
    let buttons: ButtonMasterRecord[];

    if (search && supplierId) {
      // Both search and supplierId filters
      const countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "button_master" b
        WHERE b."isActive" = true
          AND (
            b."buttonName" ILIKE ${searchTerm} OR
            b."buttonCode" ILIKE ${searchTerm} OR
            b."color" ILIKE ${searchTerm}
          )
          AND b."supplierId" = ${String(supplierId)}
      `;
      total = Number(countResult[0].count);

      buttons = await prisma.$queryRaw<ButtonMasterRecord[]>`
        SELECT
          b.*,
          m."id" as "materialId",
          m."code" as "materialCode",
          s."name" as "supplierName"
        FROM "button_master" b
        LEFT JOIN "materials" m ON m."buttonId" = b."id"
        LEFT JOIN "suppliers" s ON s."id" = b."supplierId"
        WHERE b."isActive" = true
          AND (
            b."buttonName" ILIKE ${searchTerm} OR
            b."buttonCode" ILIKE ${searchTerm} OR
            b."color" ILIKE ${searchTerm}
          )
          AND b."supplierId" = ${String(supplierId)}
        ORDER BY b."createdAt" DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    } else if (search) {
      // Only search filter
      const countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "button_master" b
        WHERE b."isActive" = true
          AND (
            b."buttonName" ILIKE ${searchTerm} OR
            b."buttonCode" ILIKE ${searchTerm} OR
            b."color" ILIKE ${searchTerm}
          )
      `;
      total = Number(countResult[0].count);

      buttons = await prisma.$queryRaw<ButtonMasterRecord[]>`
        SELECT
          b.*,
          m."id" as "materialId",
          m."code" as "materialCode",
          s."name" as "supplierName"
        FROM "button_master" b
        LEFT JOIN "materials" m ON m."buttonId" = b."id"
        LEFT JOIN "suppliers" s ON s."id" = b."supplierId"
        WHERE b."isActive" = true
          AND (
            b."buttonName" ILIKE ${searchTerm} OR
            b."buttonCode" ILIKE ${searchTerm} OR
            b."color" ILIKE ${searchTerm}
          )
        ORDER BY b."createdAt" DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    } else if (supplierId) {
      // Only supplierId filter
      const countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "button_master" b
        WHERE b."isActive" = true
          AND b."supplierId" = ${String(supplierId)}
      `;
      total = Number(countResult[0].count);

      buttons = await prisma.$queryRaw<ButtonMasterRecord[]>`
        SELECT
          b.*,
          m."id" as "materialId",
          m."code" as "materialCode",
          s."name" as "supplierName"
        FROM "button_master" b
        LEFT JOIN "materials" m ON m."buttonId" = b."id"
        LEFT JOIN "suppliers" s ON s."id" = b."supplierId"
        WHERE b."isActive" = true
          AND b."supplierId" = ${String(supplierId)}
        ORDER BY b."createdAt" DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    } else {
      // No filters
      const countResult = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*)::integer as count
        FROM "button_master" b
        WHERE b."isActive" = true
      `;
      total = Number(countResult[0].count);

      buttons = await prisma.$queryRaw<ButtonMasterRecord[]>`
        SELECT
          b.*,
          m."id" as "materialId",
          m."code" as "materialCode",
          s."name" as "supplierName"
        FROM "button_master" b
        LEFT JOIN "materials" m ON m."buttonId" = b."id"
        LEFT JOIN "suppliers" s ON s."id" = b."supplierId"
        WHERE b."isActive" = true
        ORDER BY b."createdAt" DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    }

    res.json({
      data: buttons,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error: unknown) {
    logError('Error fetching buttons:', error);
    res.status(500).json({ error: 'Failed to fetch buttons', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Get button by ID
 */
export const getButtonById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const button = await prisma.$queryRaw<ButtonMasterRecord[]>`
      SELECT
        b.*,
        m."id" as "materialId",
        m."code" as "materialCode",
        s."name" as "supplierName"
      FROM "button_master" b
      LEFT JOIN "materials" m ON m."buttonId" = b."id"
      LEFT JOIN "suppliers" s ON s."id" = b."supplierId"
      WHERE b."id" = ${id}
      LIMIT 1
    `;

    if (!button || button.length === 0) {
      return res.status(404).json({ error: 'Button not found' });
    }

    res.json({ button: button[0] });

  } catch (error: unknown) {
    logError('Error fetching button:', error);
    res.status(500).json({ error: 'Failed to fetch button', details: error instanceof Error ? error.message : 'Unknown error' });
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
    const existing = await prisma.$queryRaw<ButtonMasterRecord[]>`
      SELECT * FROM "button_master" WHERE "id" = ${id} LIMIT 1
    `;

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Button not found' });
    }

    // Update button (preserve buttonCode)
    await prisma.$executeRaw`
      UPDATE "button_master"
      SET
        "buttonName" = ${buttonName},
        "supplierCode" = ${supplierCode || null},
        "buyerCode" = ${buyerCode || null},
        "size" = ${size || null},
        "holes" = ${holes ? Number(holes) : null},
        "color" = ${color || null},
        "material" = ${material || null},
        "shape" = ${shape || null},
        "pricePerPiece" = ${pricePerPiece ? Number(pricePerPiece) : null},
        "pricePerGross" = ${pricePerGross ? Number(pricePerGross) : null},
        "supplierId" = ${supplierId || null},
        "description" = ${description || null},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `;

    // Update material name
    await prisma.$executeRaw`
      UPDATE "materials"
      SET "name" = ${buttonName}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "buttonId" = ${id}
    `;

    // Get updated button
    const updated = await prisma.$queryRaw<ButtonMasterRecord[]>`
      SELECT * FROM "button_master" WHERE "id" = ${id} LIMIT 1
    `;

    res.json({
      button: updated[0],
      message: 'Button updated successfully'
    });

  } catch (error: unknown) {
    logError('Error updating button:', error);
    res.status(500).json({ error: 'Failed to update button', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Delete button
 */
export const deleteButton = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if used in any BOM
    const bomUsage = await prisma.$queryRaw<CountResult[]>`
      SELECT COUNT(*)::integer as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."buttonId" = ${id}
    `;

    if (bomUsage[0]?.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete button',
        message: 'This button is used in one or more BOMs'
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRaw`
      DELETE FROM "materials" WHERE "buttonId" = ${id}
    `;

    // Delete button
    await prisma.$executeRaw`
      DELETE FROM "button_master" WHERE "id" = ${id}
    `;

    res.json({ message: 'Button deleted successfully' });

  } catch (error: unknown) {
    logError('Error deleting button:', error);
    res.status(500).json({ error: 'Failed to delete button', details: error instanceof Error ? error.message : 'Unknown error' });
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

    const results: BulkImportResult[] = [];

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

        // Insert button using parameterized query
        await prisma.$executeRaw`
          INSERT INTO "button_master" (
            "id", "buttonCode", "buttonName", "supplierCode", "buyerCode",
            "size", "holes", "color", "material", "shape",
            "pricePerPiece", "pricePerGross", "supplierId", "description",
            "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            ${buttonCode},
            ${row.buttonName},
            ${row.supplierCode || null},
            ${row.buyerCode || null},
            ${row.size || null},
            ${row.holes ? Number(row.holes) : null},
            ${row.color || null},
            ${row.material || null},
            ${row.shape || null},
            ${row.pricePerPiece ? Number(row.pricePerPiece) : null},
            ${row.pricePerGross ? Number(row.pricePerGross) : null},
            ${row.supplierId || null},
            ${row.description || null},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;

        // Get button ID
        const created = await prisma.$queryRaw<ButtonMasterRecord[]>`
          SELECT "id" FROM "button_master" WHERE "buttonCode" = ${buttonCode} LIMIT 1
        `;

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
          } as Prisma.materialsUncheckedCreateInput
        });

        // Create stock if requested
        let stockCreated = false;
        if (createStock && row.stockQuantity && row.stockQuantity > 0) {
          // Get default warehouse
          const warehouse = await prisma.$queryRaw<WarehouseRecord[]>`
            SELECT "id" FROM "warehouses"
            WHERE "isActive" = true
            ORDER BY "createdAt" ASC
            LIMIT 1
          `;

          if (warehouse && warehouse.length > 0) {
            const materialId = `mat-${buttonCode.toLowerCase()}`;

            await prisma.$executeRaw`
              INSERT INTO "stock_levels" (
                "id", "warehouseId", "materialId", "currentQuantity",
                "reorderLevel", "maxLevel", "locationCode",
                "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid()::text,
                ${warehouse[0].id},
                ${materialId},
                ${Number(row.stockQuantity)},
                ${row.reorderLevel ? Number(row.reorderLevel) : 0},
                ${row.maxLevel ? Number(row.maxLevel) : 0},
                ${row.locationCode || null},
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )
            `;

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

      } catch (error: unknown) {
        results.push({
          success: false,
          buttonCode,
          error: error instanceof Error ? error.message : 'Unknown error',
          row: i + 1
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

  } catch (error: unknown) {
    logError('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};
