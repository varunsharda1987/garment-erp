import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

// Type for supplier input
interface LaceSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerMeter?: number | string;
}

/**
 * Create a single lace item
 * Auto-generates laceCode and creates corresponding material entry
 * Optionally associates with styles via styleCodes array
 * Supports multiple suppliers via suppliers array
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
      laceType,
      description,
      styleCodes = [], // Array of style codes to associate
      suppliers = [] // Array of supplier relationships
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

    // Create lace_master entry with suppliers using Prisma
    const laceRecord = await prisma.lace_master.create({
      data: {
        laceCode,
        laceName: finalLaceName,
        supplierCode: supplierCode || null,
        buyerCode: buyerCode || null,
        width: width ? parseFloat(width) : null,
        design: design || null,
        color: color || null,
        composition: composition || null,
        laceType: laceType || null,
        description: description || null,
        isActive: true,
        // Create supplier relationships
        lace_suppliers: {
          create: suppliers.map((s: LaceSupplierInput) => ({
            supplierId: s.supplierId,
            isPreferred: s.isPreferred || false,
            isActive: s.isActive !== undefined ? s.isActive : true,
            notes: s.notes || null,
            pricePerMeter: s.pricePerMeter ? parseFloat(String(s.pricePerMeter)) : null,
          })),
        },
      },
      include: {
        lace_suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                contactPerson: true,
                email: true,
                phone: true,
                isActive: true,
              }
            }
          },
          orderBy: { isPreferred: 'desc' }
        }
      }
    });

    // Create style associations if provided
    if (validStyles.length > 0) {
      await prisma.lace_style_associations.createMany({
        data: validStyles.map((style, index) => ({
          laceId: laceRecord.id,
          styleId: style.id,
          isPrimary: index === 0 // First style is primary
        }))
      });
    }

    // Create corresponding material entry
    const material = await prisma.materials.create({
      data: {
        id: `mat-${laceCode.toLowerCase()}`,
        code: laceCode,
        name: finalLaceName,
        materialType: 'LACE',
        laceId: laceRecord.id,
        categoryId: laceCategory.id,
        unit: 'METER',
        isActive: true,
      }
    });

    res.status(201).json({
      lace: {
        ...laceRecord,
        styleCodes: validStyles.map(s => s.styleCode),
      },
      material,
      message: 'Lace created successfully'
    });

  } catch (error: unknown) {
    console.error('Error creating lace:', error);
    res.status(500).json({
      error: 'Failed to create lace',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get all lace items with pagination and search
 * Includes associated style codes and suppliers
 */
export const getAllLace = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      supplierId = '',
      styleCode = '' // Filter by specific style
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const where: {
      isActive: boolean;
      OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
      lace_suppliers?: { some: { supplierId: string; isActive: boolean } };
      lace_style_associations?: { some: { style: { styleCode: string } } };
    } = { isActive: true };

    if (search) {
      where.OR = [
        { laceName: { contains: String(search), mode: 'insensitive' } },
        { laceCode: { contains: String(search), mode: 'insensitive' } },
        { color: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    // Filter by supplier via junction table
    if (supplierId) {
      where.lace_suppliers = {
        some: {
          supplierId: String(supplierId),
          isActive: true
        }
      };
    }

    // Filter by style code if provided
    if (styleCode) {
      where.lace_style_associations = {
        some: {
          style: { styleCode: String(styleCode) }
        }
      };
    }

    // Get total count
    const total = await prisma.lace_master.count({ where });

    // Get lace items with relations including suppliers and style associations
    const laceItems = await prisma.lace_master.findMany({
      where,
      include: {
        materials: {
          select: { id: true, code: true }
        },
        lace_suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                contactPerson: true,
                email: true,
                phone: true,
                isActive: true,
              }
            }
          },
          orderBy: { isPreferred: 'desc' }
        },
        lace_style_associations: {
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
    // Note: lace_suppliers is kept and will be transformed to 'suppliers' by the serializer middleware
    const transformedItems = laceItems.map((item: any) => ({
      ...item,
      materialId: item.materials[0]?.id || null,
      materialCode: item.materials[0]?.code || null,
      styleCodes: item.lace_style_associations.map((sa: any) => sa.style.styleCode),
      styleNames: item.lace_style_associations.map((sa: any) => sa.style.styleName),
      materials: undefined,
      lace_style_associations: undefined,
      // Keep lace_suppliers - serializer will rename to 'suppliers'
    }));

    res.json({
      data: transformedItems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching lace items:', error);
    res.status(500).json({
      error: 'Failed to fetch lace items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get single lace item by ID
 * Includes associated style codes and suppliers
 */
export const getLaceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const lace = await prisma.lace_master.findUnique({
      where: { id },
      include: {
        materials: {
          select: { id: true, code: true }
        },
        lace_suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                contactPerson: true,
                email: true,
                phone: true,
                isActive: true,
              }
            }
          },
          orderBy: { isPreferred: 'desc' }
        },
        lace_style_associations: {
          include: {
            style: {
              select: { styleCode: true, styleName: true }
            }
          },
          orderBy: { isPrimary: 'desc' }
        }
      }
    });

    if (!lace) {
      return res.status(404).json({ error: 'Lace not found' });
    }

    // Transform to match expected format
    // Note: lace_suppliers is kept and will be transformed to 'suppliers' by the serializer middleware
    const transformed = {
      ...lace,
      materialId: lace.materials[0]?.id || null,
      materialCode: lace.materials[0]?.code || null,
      styleCodes: lace.lace_style_associations.map((sa: any) => sa.style.styleCode),
      styleNames: lace.lace_style_associations.map((sa: any) => sa.style.styleName),
      materials: undefined,
      lace_style_associations: undefined,
      // Keep lace_suppliers - serializer will rename to 'suppliers'
    };

    res.json(transformed);

  } catch (error: unknown) {
    console.error('Error fetching lace:', error);
    res.status(500).json({
      error: 'Failed to fetch lace',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update lace item
 * Note: laceCode cannot be changed
 * Supports updating style associations via styleCodes array
 * Supports updating suppliers via suppliers array (delete-and-recreate pattern)
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
      laceType,
      description,
      isActive,
      styleCodes, // Array of style codes to associate (replaces existing)
      suppliers // Array of supplier relationships (replaces existing)
    } = req.body;

    // Check if lace exists
    const existing = await prisma.lace_master.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lace not found' });
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
      await prisma.lace_style_associations.deleteMany({
        where: { laceId: id }
      });

      if (validStyles.length > 0) {
        await prisma.lace_style_associations.createMany({
          data: validStyles.map((style, index) => ({
            laceId: id,
            styleId: style.id,
            isPrimary: index === 0
          }))
        });
      }
    }

    // Update suppliers if provided (delete-and-recreate pattern)
    if (suppliers !== undefined && Array.isArray(suppliers)) {
      // Delete existing supplier relationships
      await prisma.lace_suppliers.deleteMany({
        where: { laceId: id }
      });

      // Create new supplier relationships
      if (suppliers.length > 0) {
        await prisma.lace_suppliers.createMany({
          data: suppliers.map((s: LaceSupplierInput) => ({
            laceId: id,
            supplierId: s.supplierId,
            isPreferred: s.isPreferred || false,
            isActive: s.isActive !== undefined ? s.isActive : true,
            notes: s.notes || null,
            pricePerMeter: s.pricePerMeter ? parseFloat(String(s.pricePerMeter)) : null,
          }))
        });
      }
    }

    // Determine final values for name generation (use new values if provided, otherwise use existing)
    const finalBuyerCode = buyerCode !== undefined ? buyerCode : existing.buyerCode;
    const finalColor = color !== undefined ? color : existing.color;
    const finalDesign = design !== undefined ? design : existing.design;
    const finalComposition = composition !== undefined ? composition : existing.composition;
    const finalWidth = width !== undefined ? (width ? parseFloat(width) : null) : existing.width;

    // Auto-regenerate laceName if it was originally auto-generated (empty input) or if name is not explicitly provided
    // If laceName is empty string or not provided, regenerate from attributes
    let finalLaceName = laceName;
    if (!laceName || laceName.trim() === '') {
      const parts = [];
      if (finalBuyerCode) parts.push(`[${finalBuyerCode}]`);
      if (finalColor) parts.push(finalColor);
      if (finalDesign) parts.push(finalDesign);
      if (finalComposition) parts.push(finalComposition);
      parts.push('Lace');
      if (finalWidth) parts.push(`${finalWidth}"`);
      finalLaceName = parts.join(' ').trim() || `Lace ${existing.laceCode}`;
    }

    // Update lace
    const updated = await prisma.lace_master.update({
      where: { id },
      data: {
        laceName: finalLaceName,
        ...(supplierCode !== undefined && { supplierCode: supplierCode || null }),
        ...(buyerCode !== undefined && { buyerCode: buyerCode || null }),
        ...(width !== undefined && { width: width ? parseFloat(width) : null }),
        ...(design !== undefined && { design: design || null }),
        ...(color !== undefined && { color: color || null }),
        ...(composition !== undefined && { composition: composition || null }),
        ...(laceType !== undefined && { laceType: laceType || null }),
        ...(description !== undefined && { description: description || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        materials: {
          select: { id: true, code: true }
        },
        lace_suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                contactPerson: true,
                email: true,
                phone: true,
                isActive: true,
              }
            }
          },
          orderBy: { isPreferred: 'desc' }
        },
        lace_style_associations: {
          include: {
            style: {
              select: { styleCode: true, styleName: true }
            }
          }
        }
      }
    });

    // Also update material name if laceName changed
    if (finalLaceName) {
      await prisma.materials.updateMany({
        where: { laceId: id },
        data: { name: finalLaceName }
      });
    }

    // Transform response
    // Note: lace_suppliers is kept and will be transformed to 'suppliers' by the serializer middleware
    const transformed = {
      ...updated,
      materialId: updated.materials[0]?.id || null,
      materialCode: updated.materials[0]?.code || null,
      styleCodes: updated.lace_style_associations.map((sa: any) => sa.style.styleCode),
      styleNames: updated.lace_style_associations.map((sa: any) => sa.style.styleName),
      materials: undefined,
      lace_style_associations: undefined,
      // Keep lace_suppliers - serializer will rename to 'suppliers'
    };

    res.json({
      lace: transformed,
      message: 'Lace updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating lace:', error);
    res.status(500).json({
      error: 'Failed to update lace',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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
    const existing = await prisma.lace_master.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lace not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.order_bom_items.count({
      where: {
        laceId: id
      }
    });

    if (bomUsage > 0) {
      return res.status(400).json({
        error: 'Cannot delete lace',
        message: `This lace is used in ${bomUsage} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.materials.deleteMany({
      where: { laceId: id }
    });

    // Delete lace
    await prisma.lace_master.delete({
      where: { id }
    });

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

    // Get default warehouse if creating stock
    let defaultWarehouse: any = null;
    if (createStock) {
      defaultWarehouse = await prisma.warehouses.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      });
    }

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

        // Create lace using Prisma
        const laceRecord = await prisma.lace_master.create({
          data: {
            laceCode,
            laceName: row.laceName,
            supplierCode: row.supplierCode || null,
            buyerCode: row.buyerCode || null,
            width: row.width ? parseFloat(row.width) : null,
            design: row.design || null,
            color: row.color || null,
            composition: row.composition || null,
            laceType: row.laceType || null,
            pricePerMeter: row.pricePerMeter ? parseFloat(row.pricePerMeter) : null,
            description: row.description || null,
            isActive: true,
          }
        });

        // Create material
        const materialId = `mat-${laceCode.toLowerCase()}`;
        await prisma.materials.create({
          data: {
            id: materialId,
            code: laceCode,
            name: row.laceName,
            materialType: 'LACE',
            laceId: laceRecord.id,
            categoryId: laceCategory.id,
            unit: 'METER',
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
              unit: 'METER',
              reorderLevel: row.reorderLevel ? parseFloat(row.reorderLevel) : 0,
              maxLevel: row.maxLevel ? parseFloat(row.maxLevel) : 0,
            }
          });
          stockCreated = true;
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
    const template = {
      columns: [
        { name: 'laceName', required: true, description: 'Name of the lace (Required)' },
        { name: 'supplierCode', required: false, description: "Supplier's reference code (Optional)" },
        { name: 'buyerCode', required: false, description: "Buyer's reference code (Optional)" },
        { name: 'width', required: false, description: 'Width in inches (Optional)' },
        { name: 'design', required: false, description: 'Design/pattern description (Optional)' },
        { name: 'color', required: false, description: 'Color name (Optional)' },
        { name: 'composition', required: false, description: 'Material composition (Optional)' },
        { name: 'laceType', required: false, description: 'Type of lace (Optional)' },
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
          laceType: 'Cotton',
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
