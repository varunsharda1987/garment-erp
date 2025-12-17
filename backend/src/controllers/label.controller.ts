import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

// Type for supplier input
interface LabelSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerPiece?: number | string;
  pricePerHundred?: number | string;
}

/**
 * Create a single label item
 * Auto-generates labelCode and creates corresponding material entry
 * Supports multiple suppliers via suppliers array
 */
export const createLabel = async (req: Request, res: Response) => {
  try {
    const {
      labelName,
      supplierCode,
      buyerCode,
      customerId,  // Link to customer - makes label customer-specific
      brandCategoryId, // Link to specific brand within customer
      labelCategory = 'SEWN_IN', // Default to sewn-in labels
      labelType,
      size,
      content,
      fabricContent,        // Fabric composition (e.g., "100% Cotton")
      washcareInstructions, // Care instructions (e.g., "Machine wash cold")
      printMethod,
      material,
      color,
      pricePerPiece,
      pricePerHundred,
      supplierId,
      description,
      suppliers = [] // Array of supplier relationships
    } = req.body;

    // Validate brand belongs to customer if both provided
    if (brandCategoryId && customerId) {
      const brand = await prisma.brand_categories.findUnique({
        where: { id: brandCategoryId },
        select: { customerId: true }
      });

      if (!brand) {
        return res.status(400).json({ error: 'Invalid brand category' });
      }

      if (brand.customerId !== customerId) {
        return res.status(400).json({ error: 'Brand does not belong to the specified customer' });
      }
    }

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

    // Get Label material category ID
    const labelMaterialCategory = await prisma.material_categories.findFirst({
      where: { name: 'Label' }
    });

    if (!labelMaterialCategory) {
      return res.status(500).json({ error: 'Label material category not found. Please run Phase 1 migration.' });
    }

    // Create label_master entry with suppliers using Prisma
    const labelRecord = await prisma.label_master.create({
      data: {
        labelCode,
        labelName: finalLabelName,
        supplierCode: supplierCode || null,
        buyerCode: buyerCode || null,
        customerId: customerId || null,  // Link to customer
        brandCategoryId: brandCategoryId || null, // Link to brand
        labelCategory: labelCategory as any,
        labelType: labelType || null,
        size: size || null,
        content: content || null,
        fabricContent: fabricContent || null,
        washcareInstructions: washcareInstructions || null,
        printMethod: printMethod || null,
        material: material || null,
        color: color || null,
        pricePerPiece: pricePerPiece ? parseFloat(pricePerPiece) : null,
        pricePerHundred: pricePerHundred ? parseFloat(pricePerHundred) : null,
        supplierId: supplierId || null,
        description: description || null,
        isActive: true,
        // Create supplier relationships
        labelSuppliers: {
          create: suppliers.map((s: LabelSupplierInput) => ({
            supplierId: s.supplierId,
            isPreferred: s.isPreferred || false,
            isActive: s.isActive !== undefined ? s.isActive : true,
            notes: s.notes || null,
            pricePerPiece: s.pricePerPiece ? parseFloat(String(s.pricePerPiece)) : null,
            pricePerHundred: s.pricePerHundred ? parseFloat(String(s.pricePerHundred)) : null,
          })),
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
          }
        },
        labelSuppliers: {
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

    // Create corresponding material entry
    const materialEntry = await prisma.materials.create({
      data: {
        id: `mat-${labelCode.toLowerCase()}`,
        code: labelCode,
        name: finalLabelName,
        materialType: 'LABEL',
        labelId: labelRecord.id,
        categoryId: labelMaterialCategory.id,
        unit: 'PIECE',
        isActive: true,
      }
    });

    res.status(201).json({
      label: labelRecord,
      material: materialEntry,
      message: 'Label created successfully'
    });

  } catch (error: unknown) {
    console.error('Error creating label:', error);
    res.status(500).json({
      error: 'Failed to create label',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get all label items with pagination and search
 * Includes suppliers
 */
export const getAllLabel = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      supplierId = '',
      customerId = '',  // Filter by customer
      brandCategoryId = '', // Filter by brand
      labelCategory = '' // Filter by SEWN_IN, HANGTAG, or PRICE_TAG
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause with AND conditions
    const whereConditions: any[] = [{ isActive: true }];

    // Filter by customer - show customer-specific labels OR generic (no customer)
    if (customerId) {
      whereConditions.push({
        OR: [
          { customerId: String(customerId) },
          { customerId: null }
        ]
      });
    }

    // Filter by brand
    if (brandCategoryId) {
      whereConditions.push({ brandCategoryId: String(brandCategoryId) });
    }

    // Filter by label category (SEWN_IN, HANGTAG, PRICE_TAG)
    if (labelCategory) {
      whereConditions.push({ labelCategory: String(labelCategory) as any });
    }

    // Search filter
    if (search) {
      whereConditions.push({
        OR: [
          { labelName: { contains: String(search), mode: 'insensitive' } },
          { labelCode: { contains: String(search), mode: 'insensitive' } },
          { color: { contains: String(search), mode: 'insensitive' } }
        ]
      });
    }

    // Filter by supplier via junction table
    if (supplierId) {
      whereConditions.push({
        labelSuppliers: {
          some: {
            supplierId: String(supplierId),
            isActive: true
          }
        }
      });
    }

    // Build final where clause
    const where = { AND: whereConditions };

    // Get total count
    const total = await prisma.label_master.count({ where });

    // Get labels with relations including suppliers, customer, and brand
    const labelItems = await prisma.label_master.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
          }
        },
        brandCategory: {
          select: {
            id: true,
            brandName: true,
            category: true,
            subCategory: true,
          }
        },
        materials: {
          select: { id: true, code: true }
        },
        labelSuppliers: {
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
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limitNum
    });

    // Transform to match expected format
    const transformedItems = labelItems.map((item: any) => ({
      ...item,
      materialId: item.materials[0]?.id || null,
      materialCode: item.materials[0]?.code || null,
      materials: undefined,
      // Keep labelSuppliers - serializer will rename to 'suppliers'
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
    console.error('Error fetching label items:', error);
    res.status(500).json({
      error: 'Failed to fetch label items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get single label item by ID
 * Includes suppliers
 */
export const getLabelById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const label = await prisma.label_master.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
          }
        },
        brandCategory: {
          select: {
            id: true,
            brandName: true,
            category: true,
            subCategory: true,
          }
        },
        materials: {
          select: { id: true, code: true }
        },
        labelSuppliers: {
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

    if (!label) {
      return res.status(404).json({ error: 'Label not found' });
    }

    // Transform to match expected format
    const transformed = {
      ...label,
      materialId: label.materials[0]?.id || null,
      materialCode: label.materials[0]?.code || null,
      materials: undefined,
      // Keep labelSuppliers - serializer will rename to 'suppliers'
    };

    res.json(transformed);

  } catch (error: unknown) {
    console.error('Error fetching label:', error);
    res.status(500).json({
      error: 'Failed to fetch label',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update label item
 * Note: labelCode cannot be changed
 * Supports updating suppliers via suppliers array (delete-and-recreate pattern)
 */
export const updateLabel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      labelName,
      supplierCode,
      buyerCode,
      customerId,  // Link to customer
      brandCategoryId, // Link to specific brand within customer
      labelCategory, // SEWN_IN, HANGTAG, or PRICE_TAG
      labelType,
      size,
      content,
      fabricContent,        // Fabric composition (e.g., "100% Cotton")
      washcareInstructions, // Care instructions (e.g., "Machine wash cold")
      printMethod,
      material,
      color,
      pricePerPiece,
      pricePerHundred,
      supplierId,
      description,
      isActive,
      suppliers // Array of supplier relationships (replaces existing)
    } = req.body;

    // Check if label exists
    const existing = await prisma.label_master.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Label not found' });
    }

    // Validate brand belongs to customer if both provided
    if (brandCategoryId && customerId) {
      const brand = await prisma.brand_categories.findUnique({
        where: { id: brandCategoryId },
        select: { customerId: true }
      });

      if (!brand) {
        return res.status(400).json({ error: 'Invalid brand category' });
      }

      if (brand.customerId !== customerId) {
        return res.status(400).json({ error: 'Brand does not belong to the specified customer' });
      }
    }

    // Update suppliers if provided (delete-and-recreate pattern)
    if (suppliers !== undefined && Array.isArray(suppliers)) {
      // Delete existing supplier relationships
      await prisma.label_suppliers.deleteMany({
        where: { labelId: id }
      });

      // Create new supplier relationships
      if (suppliers.length > 0) {
        await prisma.label_suppliers.createMany({
          data: suppliers.map((s: LabelSupplierInput) => ({
            labelId: id,
            supplierId: s.supplierId,
            isPreferred: s.isPreferred || false,
            isActive: s.isActive !== undefined ? s.isActive : true,
            notes: s.notes || null,
            pricePerPiece: s.pricePerPiece ? parseFloat(String(s.pricePerPiece)) : null,
            pricePerHundred: s.pricePerHundred ? parseFloat(String(s.pricePerHundred)) : null,
          }))
        });
      }
    }

    // Update label
    const updated = await prisma.label_master.update({
      where: { id },
      data: {
        ...(labelName !== undefined && { labelName }),
        ...(supplierCode !== undefined && { supplierCode: supplierCode || null }),
        ...(buyerCode !== undefined && { buyerCode: buyerCode || null }),
        ...(customerId !== undefined && { customerId: customerId || null }),
        ...(brandCategoryId !== undefined && { brandCategoryId: brandCategoryId || null }),
        ...(labelCategory !== undefined && { labelCategory: labelCategory as any }),
        ...(labelType !== undefined && { labelType: labelType || null }),
        ...(size !== undefined && { size: size || null }),
        ...(content !== undefined && { content: content || null }),
        ...(fabricContent !== undefined && { fabricContent: fabricContent || null }),
        ...(washcareInstructions !== undefined && { washcareInstructions: washcareInstructions || null }),
        ...(printMethod !== undefined && { printMethod: printMethod || null }),
        ...(material !== undefined && { material: material || null }),
        ...(color !== undefined && { color: color || null }),
        ...(pricePerPiece !== undefined && { pricePerPiece: pricePerPiece ? parseFloat(pricePerPiece) : null }),
        ...(pricePerHundred !== undefined && { pricePerHundred: pricePerHundred ? parseFloat(pricePerHundred) : null }),
        ...(supplierId !== undefined && { supplierId: supplierId || null }),
        ...(description !== undefined && { description: description || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
          }
        },
        brandCategory: {
          select: {
            id: true,
            brandName: true,
            category: true,
            subCategory: true,
          }
        },
        materials: {
          select: { id: true, code: true }
        },
        labelSuppliers: {
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

    // Also update material name if labelName changed
    if (labelName) {
      await prisma.materials.updateMany({
        where: { labelId: id },
        data: { name: labelName }
      });
    }

    // Transform response
    const transformed = {
      ...updated,
      materialId: updated.materials[0]?.id || null,
      materialCode: updated.materials[0]?.code || null,
      materials: undefined,
      // Keep labelSuppliers - serializer will rename to 'suppliers'
    };

    res.json({
      label: transformed,
      message: 'Label updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating label:', error);
    res.status(500).json({
      error: 'Failed to update label',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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
    const existing = await prisma.label_master.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Label not found' });
    }

    // Check if used in BOM
    const bomUsage = await prisma.bom_items.count({
      where: {
        materials: {
          labelId: id
        }
      }
    });

    if (bomUsage > 0) {
      return res.status(400).json({
        error: 'Cannot delete label',
        message: `This label is used in ${bomUsage} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.materials.deleteMany({
      where: { labelId: id }
    });

    // Delete label (cascade will delete label_suppliers)
    await prisma.label_master.delete({
      where: { id }
    });

    res.json({ message: 'Label deleted successfully' });

  } catch (error: unknown) {
    console.error('Error deleting label:', error);
    res.status(500).json({
      error: 'Failed to delete label',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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

        // Create label using Prisma
        const labelRecord = await prisma.label_master.create({
          data: {
            labelCode,
            labelName: row.labelName,
            supplierCode: row.supplierCode || null,
            buyerCode: row.buyerCode || null,
            labelType: row.labelType || null,
            size: row.size || null,
            content: row.content || null,
            printMethod: row.printMethod || null,
            material: row.material || null,
            color: row.color || null,
            pricePerPiece: row.pricePerPiece ? parseFloat(row.pricePerPiece) : null,
            pricePerHundred: row.pricePerHundred ? parseFloat(row.pricePerHundred) : null,
            description: row.description || null,
            isActive: true,
          }
        });

        // Create material
        const materialId = `mat-${labelCode.toLowerCase()}`;
        await prisma.materials.create({
          data: {
            id: materialId,
            code: labelCode,
            name: row.labelName,
            materialType: 'LABEL',
            labelId: labelRecord.id,
            categoryId: labelCategory.id,
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
    const template = {
      columns: [
        { name: 'labelName', required: true, description: 'Name of the label (Required)' },
        { name: 'supplierCode', required: false, description: "Supplier's reference code (Optional)" },
        { name: 'buyerCode', required: false, description: "Buyer's reference code (Optional)" },
        { name: 'labelType', required: false, description: 'Label type (Woven, Printed, Heat Transfer) (Optional)' },
        { name: 'size', required: false, description: 'Size/dimensions (Optional)' },
        { name: 'content', required: false, description: 'Label content text (Optional)' },
        { name: 'printMethod', required: false, description: 'Print method (Optional)' },
        { name: 'material', required: false, description: 'Material (Polyester, Satin, Cotton) (Optional)' },
        { name: 'color', required: false, description: 'Color name (Optional)' },
        { name: 'pricePerPiece', required: false, description: 'Price per piece (Optional)' },
        { name: 'pricePerHundred', required: false, description: 'Price per hundred (Optional)' },
        { name: 'stockQuantity', required: false, description: 'Initial stock quantity (Optional)' },
        { name: 'locationCode', required: false, description: 'Warehouse location code (Optional)' }
      ],
      exampleData: [
        {
          labelName: 'Brand Logo Woven Label',
          supplierCode: 'LBL-001',
          buyerCode: '',
          labelType: 'Woven',
          size: '2x1 inch',
          content: 'Brand Name',
          printMethod: 'Woven',
          material: 'Polyester',
          color: 'White',
          pricePerPiece: 0.50,
          pricePerHundred: 45.00,
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
