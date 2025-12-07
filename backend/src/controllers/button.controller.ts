import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

/**
 * Create a single button item
 * Auto-generates buttonCode and creates corresponding material entry
 * Optionally associates with styles via styleCodes array
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
      description,
      styleCodes = [] // Array of style codes to associate
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

    // Create button_master entry using Prisma
    const buttonRecord = await prisma.button_master.create({
      data: {
        buttonCode,
        buttonName: finalButtonName,
        supplierCode: supplierCode || null,
        buyerCode: buyerCode || null,
        size: size || null,
        holes: holes ? parseInt(holes) : null,
        color: color || null,
        material: material || null,
        shape: shape || null,
        pricePerPiece: pricePerPiece ? parseFloat(pricePerPiece) : null,
        pricePerGross: pricePerGross ? parseFloat(pricePerGross) : null,
        supplierId: supplierId || null,
        description: description || null,
        isActive: true,
      }
    });

    // Create style associations if provided
    if (validStyles.length > 0) {
      await prisma.button_style_associations.createMany({
        data: validStyles.map((style, index) => ({
          buttonId: buttonRecord.id,
          styleId: style.id,
          isPrimary: index === 0
        }))
      });
    }

    // Create corresponding material entry
    const materialEntry = await prisma.materials.create({
      data: {
        id: `mat-${buttonCode.toLowerCase()}`,
        code: buttonCode,
        name: finalButtonName,
        materialType: 'BUTTON',
        buttonId: buttonRecord.id,
        categoryId: buttonCategory.id,
        unit: 'PIECE',
        isActive: true,
      }
    });

    res.status(201).json({
      button: { ...buttonRecord, styleCodes: validStyles.map(s => s.styleCode) },
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
 * Includes associated style codes
 */
export const getAllButtons = async (req: Request, res: Response) => {
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
        { buttonName: { contains: String(search), mode: 'insensitive' } },
        { buttonCode: { contains: String(search), mode: 'insensitive' } },
        { color: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    if (supplierId) {
      where.supplierId = String(supplierId);
    }

    // Filter by style code if provided
    if (styleCode) {
      where.button_style_associations = {
        some: {
          style: { styleCode: String(styleCode) }
        }
      };
    }

    // Get total count
    const total = await prisma.button_master.count({ where });

    // Get buttons with relations including style associations
    const buttons = await prisma.button_master.findMany({
      where,
      include: {
        materials: {
          select: { id: true, code: true }
        },
        suppliers: {
          select: { name: true }
        },
        button_style_associations: {
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
    const transformedButtons = buttons.map(b => ({
      ...b,
      materialId: b.materials[0]?.id || null,
      materialCode: b.materials[0]?.code || null,
      supplierName: b.suppliers?.name || null,
      styleCodes: b.button_style_associations.map(sa => sa.style.styleCode),
      styleNames: b.button_style_associations.map(sa => sa.style.styleName),
      materials: undefined,
      suppliers: undefined,
      button_style_associations: undefined
    }));

    res.json({
      data: transformedButtons,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error: any) {
    console.error('Error fetching buttons:', error);
    res.status(500).json({ error: 'Failed to fetch buttons', details: error.message });
  }
};

/**
 * Get button by ID
 * Includes associated style codes
 */
export const getButtonById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const button = await prisma.button_master.findUnique({
      where: { id },
      include: {
        materials: {
          select: { id: true, code: true }
        },
        suppliers: {
          select: { name: true }
        },
        button_style_associations: {
          include: {
            style: {
              select: { styleCode: true, styleName: true }
            }
          },
          orderBy: { isPrimary: 'desc' }
        }
      }
    });

    if (!button) {
      return res.status(404).json({ error: 'Button not found' });
    }

    // Transform to match expected format
    const transformed = {
      ...button,
      materialId: button.materials[0]?.id || null,
      materialCode: button.materials[0]?.code || null,
      supplierName: button.suppliers?.name || null,
      styleCodes: button.button_style_associations.map(sa => sa.style.styleCode),
      styleNames: button.button_style_associations.map(sa => sa.style.styleName),
      materials: undefined,
      suppliers: undefined,
      button_style_associations: undefined
    };

    res.json({ button: transformed });

  } catch (error: any) {
    console.error('Error fetching button:', error);
    res.status(500).json({ error: 'Failed to fetch button', details: error.message });
  }
};

/**
 * Update button
 * Supports updating style associations via styleCodes array
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
      description,
      styleCodes // Array of style codes to associate (replaces existing)
    } = req.body;

    // Check if button exists
    const existing = await prisma.button_master.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Button not found' });
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
      await prisma.button_style_associations.deleteMany({
        where: { buttonId: id }
      });

      if (validStyles.length > 0) {
        await prisma.button_style_associations.createMany({
          data: validStyles.map((style, index) => ({
            buttonId: id,
            styleId: style.id,
            isPrimary: index === 0
          }))
        });
      }
    }

    // Update button
    const updated = await prisma.button_master.update({
      where: { id },
      data: {
        ...(buttonName !== undefined && { buttonName }),
        ...(supplierCode !== undefined && { supplierCode: supplierCode || null }),
        ...(buyerCode !== undefined && { buyerCode: buyerCode || null }),
        ...(size !== undefined && { size: size || null }),
        ...(holes !== undefined && { holes: holes ? parseInt(holes) : null }),
        ...(color !== undefined && { color: color || null }),
        ...(material !== undefined && { material: material || null }),
        ...(shape !== undefined && { shape: shape || null }),
        ...(pricePerPiece !== undefined && { pricePerPiece: pricePerPiece ? parseFloat(pricePerPiece) : null }),
        ...(pricePerGross !== undefined && { pricePerGross: pricePerGross ? parseFloat(pricePerGross) : null }),
        ...(supplierId !== undefined && { supplierId: supplierId || null }),
        ...(description !== undefined && { description: description || null }),
      },
      include: {
        button_style_associations: {
          include: {
            style: {
              select: { styleCode: true, styleName: true }
            }
          }
        }
      }
    });

    // Update material name if buttonName changed
    if (buttonName) {
      await prisma.materials.updateMany({
        where: { buttonId: id },
        data: { name: buttonName }
      });
    }

    // Transform response
    const transformed = {
      ...updated,
      styleCodes: updated.button_style_associations.map(sa => sa.style.styleCode),
      styleNames: updated.button_style_associations.map(sa => sa.style.styleName),
      button_style_associations: undefined
    };

    res.json({
      button: transformed,
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
    const bomUsage = await prisma.bom_items.count({
      where: {
        materials: {
          buttonId: id
        }
      }
    });

    if (bomUsage > 0) {
      return res.status(400).json({
        error: 'Cannot delete button',
        message: 'This button is used in one or more BOMs'
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.materials.deleteMany({
      where: { buttonId: id }
    });

    // Delete button
    await prisma.button_master.delete({
      where: { id }
    });

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

        // Create button using Prisma
        const buttonRecord = await prisma.button_master.create({
          data: {
            buttonCode,
            buttonName: row.buttonName,
            supplierCode: row.supplierCode || null,
            buyerCode: row.buyerCode || null,
            size: row.size || null,
            holes: row.holes ? parseInt(row.holes) : null,
            color: row.color || null,
            material: row.material || null,
            shape: row.shape || null,
            pricePerPiece: row.pricePerPiece ? parseFloat(row.pricePerPiece) : null,
            pricePerGross: row.pricePerGross ? parseFloat(row.pricePerGross) : null,
            supplierId: row.supplierId || null,
            description: row.description || null,
            isActive: true,
          }
        });

        // Create material
        const materialId = `mat-${buttonCode.toLowerCase()}`;
        await prisma.materials.create({
          data: {
            id: materialId,
            code: buttonCode,
            name: row.buttonName,
            materialType: 'BUTTON',
            buttonId: buttonRecord.id,
            categoryId: buttonCategory.id,
            unit: 'PIECE',
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
              unit: 'PIECE',
              reorderLevel: row.reorderLevel ? parseFloat(row.reorderLevel) : 0,
              maxLevel: row.maxLevel ? parseFloat(row.maxLevel) : 0,
            }
          });
          stockCreated = true;
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
