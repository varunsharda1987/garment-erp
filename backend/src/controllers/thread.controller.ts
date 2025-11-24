import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

const prisma = new PrismaClient();

/**
 * Create a single thread item
 * Auto-generates threadCode and creates corresponding material entry
 */
export const createThread = async (req: Request, res: Response) => {
  try {
    const {
      threadName,
      threadCount,
      color,
      colorCode,
      composition,
      threadType,
      coneSize,
      pricePerCone,
      supplierCode,
      buyerCode,
      supplierId,
      description
    } = req.body;

    // Validation
    if (!threadName || threadName.trim() === '') {
      return res.status(400).json({ error: 'Thread name is required' });
    }

    // Auto-generate thread code
    const threadCode = await generateCode('THR', 'thread_master', 'threadCode');

    // Get Threads category ID
    const threadCategory = await prisma.material_categories.findFirst({
      where: { name: 'Threads' }
    });

    if (!threadCategory) {
      return res.status(500).json({ error: 'Threads category not found. Please run Phase 1 migration.' });
    }

    // Create thread_master entry
    await prisma.$executeRawUnsafe(`
      INSERT INTO "thread_master" (
        "id", "threadCode", "threadName", "threadCount", "color", "colorCode",
        "composition", "threadType", "coneSize", "pricePerCone",
        "supplierCode", "buyerCode", "supplierId", "description",
        "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        '${threadCode}',
        '${threadName.replace(/'/g, "''")}',
        ${threadCount ? `'${threadCount.replace(/'/g, "''")}'` : 'NULL'},
        ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'},
        ${colorCode ? `'${colorCode.replace(/'/g, "''")}'` : 'NULL'},
        ${composition ? `'${composition.replace(/'/g, "''")}'` : 'NULL'},
        ${threadType ? `'${threadType.replace(/'/g, "''")}'` : 'NULL'},
        ${coneSize ? `'${coneSize.replace(/'/g, "''")}'` : 'NULL'},
        ${pricePerCone || 'NULL'},
        ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'},
        ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'},
        ${supplierId ? `'${supplierId}'` : 'NULL'},
        ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);

    // Get the created thread
    const createdThread = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "thread_master" WHERE "threadCode" = '${threadCode}' LIMIT 1
    `);

    const threadRecord = createdThread[0];

    // Create corresponding material entry
    const materialCode = threadCode; // Use same code
    const materialEntry = await prisma.materials.create({
      data: {
        id: `mat-${threadCode.toLowerCase()}`,
        code: materialCode,
        name: threadName,
        materialType: 'THREAD',
        threadId: threadRecord.id,
        categoryId: threadCategory.id,
        unit: 'CONE',
        isActive: true,
        updatedAt: new Date()
      } as any
    });

    res.status(201).json({
      thread: threadRecord,
      material: materialEntry,
      message: 'Thread created successfully'
    });

  } catch (error: any) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: 'Failed to create thread', details: error.message });
  }
};

/**
 * Get all threads with pagination and search
 */
export const getAllThreads = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      supplierId
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = `WHERE t."isActive" = true`;

    if (search) {
      whereClause += ` AND (
        t."threadName" ILIKE '%${search}%' OR
        t."threadCode" ILIKE '%${search}%' OR
        t."color" ILIKE '%${search}%' OR
        t."colorCode" ILIKE '%${search}%'
      )`;
    }

    if (supplierId) {
      whereClause += ` AND t."supplierId" = '${supplierId}'`;
    }

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) as count
      FROM "thread_master" t
      ${whereClause}
    `);

    const total = parseInt(countResult[0].count);

    // Get threads
    const threads = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        t.*,
        m."id" as "materialId",
        m."code" as "materialCode",
        s."name" as "supplierName"
      FROM "thread_master" t
      LEFT JOIN "materials" m ON m."threadId" = t."id"
      LEFT JOIN "suppliers" s ON s."id" = t."supplierId"
      ${whereClause}
      ORDER BY t."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    res.json({
      data: threads,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Error fetching threads:', error);
    res.status(500).json({ error: 'Failed to fetch threads', details: error.message });
  }
};

/**
 * Get thread by ID
 */
export const getThreadById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const thread = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        t.*,
        m."id" as "materialId",
        m."code" as "materialCode",
        s."name" as "supplierName"
      FROM "thread_master" t
      LEFT JOIN "materials" m ON m."threadId" = t."id"
      LEFT JOIN "suppliers" s ON s."id" = t."supplierId"
      WHERE t."id" = '${id}'
      LIMIT 1
    `);

    if (!thread || thread.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json({ thread: thread[0] });

  } catch (error: any) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ error: 'Failed to fetch thread', details: error.message });
  }
};

/**
 * Update thread
 */
export const updateThread = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      threadName,
      threadCount,
      color,
      colorCode,
      composition,
      threadType,
      coneSize,
      pricePerCone,
      supplierCode,
      buyerCode,
      supplierId,
      description
    } = req.body;

    // Check if thread exists
    const existing = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "thread_master" WHERE "id" = '${id}' LIMIT 1
    `);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Update thread (preserve threadCode)
    await prisma.$executeRawUnsafe(`
      UPDATE "thread_master"
      SET
        "threadName" = '${threadName.replace(/'/g, "''")}',
        "threadCount" = ${threadCount ? `'${threadCount.replace(/'/g, "''")}'` : 'NULL'},
        "color" = ${color ? `'${color.replace(/'/g, "''")}'` : 'NULL'},
        "colorCode" = ${colorCode ? `'${colorCode.replace(/'/g, "''")}'` : 'NULL'},
        "composition" = ${composition ? `'${composition.replace(/'/g, "''")}'` : 'NULL'},
        "threadType" = ${threadType ? `'${threadType.replace(/'/g, "''")}'` : 'NULL'},
        "coneSize" = ${coneSize ? `'${coneSize.replace(/'/g, "''")}'` : 'NULL'},
        "pricePerCone" = ${pricePerCone || 'NULL'},
        "supplierCode" = ${supplierCode ? `'${supplierCode.replace(/'/g, "''")}'` : 'NULL'},
        "buyerCode" = ${buyerCode ? `'${buyerCode.replace(/'/g, "''")}'` : 'NULL'},
        "supplierId" = ${supplierId ? `'${supplierId}'` : 'NULL'},
        "description" = ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = '${id}'
    `);

    // Update material name
    await prisma.$executeRawUnsafe(`
      UPDATE "materials"
      SET "name" = '${threadName.replace(/'/g, "''")}', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "threadId" = '${id}'
    `);

    // Get updated thread
    const updated = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "thread_master" WHERE "id" = '${id}' LIMIT 1
    `);

    res.json({
      thread: updated[0],
      message: 'Thread updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating thread:', error);
    res.status(500).json({ error: 'Failed to update thread', details: error.message });
  }
};

/**
 * Delete thread
 */
export const deleteThread = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if used in any BOM
    const bomUsage = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) as count
      FROM "bom_items" bi
      JOIN "materials" m ON m."id" = bi."materialId"
      WHERE m."threadId" = '${id}'
    `);

    if (parseInt(bomUsage[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete thread',
        message: 'This thread is used in one or more BOMs'
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.$executeRawUnsafe(`
      DELETE FROM "materials" WHERE "threadId" = '${id}'
    `);

    // Delete thread
    await prisma.$executeRawUnsafe(`
      DELETE FROM "thread_master" WHERE "id" = '${id}'
    `);

    res.json({ message: 'Thread deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting thread:', error);
    res.status(500).json({ error: 'Failed to delete thread', details: error.message });
  }
};

/**
 * Bulk import threads from Excel
 */
export const bulkImportThreads = async (req: Request, res: Response) => {
  try {
    const { data, createStock = false } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided for import' });
    }

    // Get Threads category
    const threadCategory = await prisma.material_categories.findFirst({
      where: { name: 'Threads' }
    });

    if (!threadCategory) {
      return res.status(500).json({ error: 'Threads category not found' });
    }

    // Pre-generate all thread codes
    const codes = await generateBatchCodes('THR', 'thread_master', 'threadCode', data.length);

    const results = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const threadCode = codes[i];

      try {
        // Validate required field
        if (!row.threadName || row.threadName.trim() === '') {
          results.push({
            success: false,
            threadCode,
            error: 'Thread name is required',
            row: i + 1
          });
          continue;
        }

        // Insert thread
        await prisma.$executeRawUnsafe(`
          INSERT INTO "thread_master" (
            "id", "threadCode", "threadName", "threadCount", "color", "colorCode",
            "composition", "threadType", "coneSize", "pricePerCone",
            "supplierCode", "buyerCode", "supplierId", "description",
            "isActive", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            '${threadCode}',
            '${row.threadName.replace(/'/g, "''")}',
            ${row.threadCount ? `'${row.threadCount.replace(/'/g, "''")}'` : 'NULL'},
            ${row.color ? `'${row.color.replace(/'/g, "''")}'` : 'NULL'},
            ${row.colorCode ? `'${row.colorCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.composition ? `'${row.composition.replace(/'/g, "''")}'` : 'NULL'},
            ${row.threadType ? `'${row.threadType.replace(/'/g, "''")}'` : 'NULL'},
            ${row.coneSize ? `'${row.coneSize.replace(/'/g, "''")}'` : 'NULL'},
            ${row.pricePerCone || 'NULL'},
            ${row.supplierCode ? `'${row.supplierCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.buyerCode ? `'${row.buyerCode.replace(/'/g, "''")}'` : 'NULL'},
            ${row.supplierId ? `'${row.supplierId}'` : 'NULL'},
            ${row.description ? `'${row.description.replace(/'/g, "''")}'` : 'NULL'},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `);

        // Get thread ID
        const created = await prisma.$queryRawUnsafe<any[]>(`
          SELECT "id" FROM "thread_master" WHERE "threadCode" = '${threadCode}' LIMIT 1
        `);

        const threadId = created[0].id;

        // Create material
        await prisma.materials.create({
          data: {
            id: `mat-${threadCode.toLowerCase()}`,
            code: threadCode,
            name: row.threadName,
            materialType: 'THREAD',
            threadId,
            categoryId: threadCategory.id,
            unit: 'CONE',
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
            const materialId = `mat-${threadCode.toLowerCase()}`;

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
          threadCode,
          materialCode: threadCode,
          stockCreated,
          row: i + 1
        });

      } catch (error: any) {
        results.push({
          success: false,
          threadCode,
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
        { field: 'threadName', header: 'Thread Name', required: true },
        { field: 'threadCount', header: 'Thread Count', required: false },
        { field: 'color', header: 'Color', required: false },
        { field: 'colorCode', header: 'Color Code (Pantone)', required: false },
        { field: 'composition', header: 'Composition', required: false },
        { field: 'threadType', header: 'Thread Type', required: false },
        { field: 'coneSize', header: 'Cone Size', required: false },
        { field: 'pricePerCone', header: 'Price Per Cone', required: false },
        { field: 'supplierCode', header: 'Supplier Code', required: false },
        { field: 'buyerCode', header: 'Buyer Code', required: false },
        { field: 'description', header: 'Description', required: false },
        { field: 'stockQuantity', header: 'Stock Quantity', required: false },
        { field: 'locationCode', header: 'Location Code', required: false }
      ],
      example: {
        threadName: 'Polyester Thread 40s',
        threadCount: '40s',
        color: 'Black',
        colorCode: 'PMS 200',
        composition: 'Polyester',
        threadType: 'Sewing',
        coneSize: '5000m',
        pricePerCone: 15.50,
        supplierCode: 'SUP-001',
        buyerCode: 'BUY-001',
        description: 'Black polyester sewing thread 40s count',
        stockQuantity: 500,
        locationCode: 'WH-01-A'
      }
    };

    res.json(template);

  } catch (error: any) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template', details: error.message });
  }
};
