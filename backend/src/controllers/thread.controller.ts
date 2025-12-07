import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

/**
 * Create a single thread item
 * Auto-generates threadCode and creates corresponding material entry
 * Optionally associates with styles via styleCodes array
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
      description,
      styleCodes = [] // Array of style codes to associate
    } = req.body;

    // Auto-generate thread code
    const threadCode = await generateCode('THR', 'thread_master', 'threadCode');

    // Auto-generate threadName if not provided
    let finalThreadName = threadName;
    if (!finalThreadName || finalThreadName.trim() === '') {
      const parts = [];
      if (buyerCode) parts.push(`[${buyerCode}]`);
      if (color) parts.push(color);
      if (threadType) parts.push(threadType);
      parts.push('Thread');
      if (threadCount) parts.push(threadCount);
      if (composition) parts.push(composition);
      finalThreadName = parts.join(' ').trim() || `Thread ${threadCode}`;
    }

    // Get Threads category ID
    const threadCategory = await prisma.material_categories.findFirst({
      where: { name: 'Threads' }
    });

    if (!threadCategory) {
      return res.status(500).json({ error: 'Threads category not found. Please run Phase 1 migration.' });
    }

    // Validate styleCodes if provided
    let validStyles: { id: string; styleCode: string }[] = [];
    if (styleCodes.length > 0) {
      validStyles = await prisma.styles.findMany({
        where: { styleCode: { in: styleCodes } },
        select: { id: true, styleCode: true }
      });

      const foundCodes = validStyles.map(s => s.styleCode);
      const invalidCodes = styleCodes.filter((code: string) => !foundCodes.includes(code));
      if (invalidCodes.length > 0) {
        return res.status(400).json({
          error: 'Invalid style codes',
          invalidCodes
        });
      }
    }

    // Create thread_master entry using Prisma
    const threadRecord = await prisma.thread_master.create({
      data: {
        threadCode,
        threadName: finalThreadName,
        threadCount: threadCount || null,
        color: color || null,
        colorCode: colorCode || null,
        composition: composition || null,
        threadType: threadType || null,
        coneSize: coneSize || null,
        pricePerCone: pricePerCone ? parseFloat(pricePerCone) : null,
        supplierCode: supplierCode || null,
        buyerCode: buyerCode || null,
        supplierId: supplierId || null,
        description: description || null,
        isActive: true,
      }
    });

    // Create style associations if provided
    if (validStyles.length > 0) {
      await prisma.thread_style_associations.createMany({
        data: validStyles.map((style, index) => ({
          threadId: threadRecord.id,
          styleId: style.id,
          isPrimary: index === 0
        }))
      });
    }

    // Create corresponding material entry
    const materialEntry = await prisma.materials.create({
      data: {
        id: `mat-${threadCode.toLowerCase()}`,
        code: threadCode,
        name: finalThreadName,
        materialType: 'THREAD',
        threadId: threadRecord.id,
        categoryId: threadCategory.id,
        unit: 'CONE',
        isActive: true,
      }
    });

    res.status(201).json({
      thread: { ...threadRecord, styleCodes: validStyles.map(s => s.styleCode) },
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
 * Includes associated style codes
 */
export const getAllThreads = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      supplierId,
      styleCode = '' // Filter by specific style
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { threadName: { contains: String(search), mode: 'insensitive' } },
        { threadCode: { contains: String(search), mode: 'insensitive' } },
        { color: { contains: String(search), mode: 'insensitive' } },
        { colorCode: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    if (supplierId) {
      where.supplierId = String(supplierId);
    }

    // Filter by style code if provided
    if (styleCode) {
      where.thread_style_associations = {
        some: {
          style: { styleCode: String(styleCode) }
        }
      };
    }

    // Get total count
    const total = await prisma.thread_master.count({ where });

    // Get threads with relations including style associations
    const threads = await prisma.thread_master.findMany({
      where,
      include: {
        materials: {
          select: { id: true, code: true }
        },
        suppliers: {
          select: { name: true }
        },
        thread_style_associations: {
          include: {
            style: {
              select: { styleCode: true, styleName: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limitNum
    });

    // Transform to match expected format
    const transformedThreads = threads.map(t => ({
      ...t,
      materialId: t.materials[0]?.id || null,
      materialCode: t.materials[0]?.code || null,
      supplierName: t.suppliers?.name || null,
      styleCodes: t.thread_style_associations.map(sa => sa.style.styleCode),
      styleNames: t.thread_style_associations.map(sa => sa.style.styleName),
      materials: undefined,
      suppliers: undefined,
      thread_style_associations: undefined
    }));

    res.json({
      data: transformedThreads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error: any) {
    console.error('Error fetching threads:', error);
    res.status(500).json({ error: 'Failed to fetch threads', details: error.message });
  }
};

/**
 * Get thread by ID
 * Includes associated style codes
 */
export const getThreadById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const thread = await prisma.thread_master.findUnique({
      where: { id },
      include: {
        materials: {
          select: { id: true, code: true }
        },
        suppliers: {
          select: { name: true }
        },
        thread_style_associations: {
          include: {
            style: {
              select: { styleCode: true, styleName: true }
            }
          },
          orderBy: { isPrimary: 'desc' }
        }
      }
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Transform to match expected format
    const transformed = {
      ...thread,
      materialId: thread.materials[0]?.id || null,
      materialCode: thread.materials[0]?.code || null,
      supplierName: thread.suppliers?.name || null,
      styleCodes: thread.thread_style_associations.map(sa => sa.style.styleCode),
      styleNames: thread.thread_style_associations.map(sa => sa.style.styleName),
      materials: undefined,
      suppliers: undefined,
      thread_style_associations: undefined
    };

    res.json({ thread: transformed });

  } catch (error: any) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ error: 'Failed to fetch thread', details: error.message });
  }
};

/**
 * Update thread
 * Supports updating style associations via styleCodes array
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
      description,
      styleCodes // Array of style codes to associate (replaces existing)
    } = req.body;

    // Check if thread exists
    const existing = await prisma.thread_master.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Validate styleCodes if provided
    let validStyles: { id: string; styleCode: string }[] = [];
    if (styleCodes !== undefined && Array.isArray(styleCodes)) {
      if (styleCodes.length > 0) {
        validStyles = await prisma.styles.findMany({
          where: { styleCode: { in: styleCodes } },
          select: { id: true, styleCode: true }
        });

        const foundCodes = validStyles.map(s => s.styleCode);
        const invalidCodes = styleCodes.filter((code: string) => !foundCodes.includes(code));
        if (invalidCodes.length > 0) {
          return res.status(400).json({
            error: 'Invalid style codes',
            invalidCodes
          });
        }
      }

      // Delete existing associations and create new ones
      await prisma.thread_style_associations.deleteMany({
        where: { threadId: id }
      });

      if (validStyles.length > 0) {
        await prisma.thread_style_associations.createMany({
          data: validStyles.map((style, index) => ({
            threadId: id,
            styleId: style.id,
            isPrimary: index === 0
          }))
        });
      }
    }

    // Update thread
    const updated = await prisma.thread_master.update({
      where: { id },
      data: {
        ...(threadName !== undefined && { threadName }),
        ...(threadCount !== undefined && { threadCount: threadCount || null }),
        ...(color !== undefined && { color: color || null }),
        ...(colorCode !== undefined && { colorCode: colorCode || null }),
        ...(composition !== undefined && { composition: composition || null }),
        ...(threadType !== undefined && { threadType: threadType || null }),
        ...(coneSize !== undefined && { coneSize: coneSize || null }),
        ...(pricePerCone !== undefined && { pricePerCone: pricePerCone ? parseFloat(pricePerCone) : null }),
        ...(supplierCode !== undefined && { supplierCode: supplierCode || null }),
        ...(buyerCode !== undefined && { buyerCode: buyerCode || null }),
        ...(supplierId !== undefined && { supplierId: supplierId || null }),
        ...(description !== undefined && { description: description || null }),
      },
      include: {
        thread_style_associations: {
          include: {
            style: {
              select: { styleCode: true, styleName: true }
            }
          }
        }
      }
    });

    // Update material name if threadName changed
    if (threadName) {
      await prisma.materials.updateMany({
        where: { threadId: id },
        data: { name: threadName }
      });
    }

    // Transform response
    const transformed = {
      ...updated,
      styleCodes: updated.thread_style_associations.map(sa => sa.style.styleCode),
      styleNames: updated.thread_style_associations.map(sa => sa.style.styleName),
      thread_style_associations: undefined
    };

    res.json({
      thread: transformed,
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
    const bomUsage = await prisma.bom_items.count({
      where: {
        materials: {
          threadId: id
        }
      }
    });

    if (bomUsage > 0) {
      return res.status(400).json({
        error: 'Cannot delete thread',
        message: 'This thread is used in one or more BOMs'
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.materials.deleteMany({
      where: { threadId: id }
    });

    // Delete thread
    await prisma.thread_master.delete({
      where: { id }
    });

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

    // Get default warehouse if creating stock
    let defaultWarehouse: any = null;
    if (createStock) {
      defaultWarehouse = await prisma.warehouses.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      });
    }

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

        // Create thread using Prisma
        const threadRecord = await prisma.thread_master.create({
          data: {
            threadCode,
            threadName: row.threadName,
            threadCount: row.threadCount || null,
            color: row.color || null,
            colorCode: row.colorCode || null,
            composition: row.composition || null,
            threadType: row.threadType || null,
            coneSize: row.coneSize || null,
            pricePerCone: row.pricePerCone ? parseFloat(row.pricePerCone) : null,
            supplierCode: row.supplierCode || null,
            buyerCode: row.buyerCode || null,
            supplierId: row.supplierId || null,
            description: row.description || null,
            isActive: true,
          }
        });

        // Create material
        const materialId = `mat-${threadCode.toLowerCase()}`;
        await prisma.materials.create({
          data: {
            id: materialId,
            code: threadCode,
            name: row.threadName,
            materialType: 'THREAD',
            threadId: threadRecord.id,
            categoryId: threadCategory.id,
            unit: 'CONE',
            isActive: true,
          }
        });

        // Create stock if requested
        let stockCreated = false;
        if (createStock && row.stockQuantity && row.stockQuantity > 0 && defaultWarehouse) {
          await prisma.stock_levels.create({
            data: {
              warehouseId: defaultWarehouse.id,
              materialId,
              quantity: parseFloat(row.stockQuantity),
              unit: 'CONE',
              reorderLevel: row.reorderLevel ? parseFloat(row.reorderLevel) : 0,
              maxLevel: row.maxLevel ? parseFloat(row.maxLevel) : 0,
            }
          });
          stockCreated = true;
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
