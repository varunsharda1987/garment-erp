import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, generateBatchCodes } from '../utils/code-generator';

// Type for supplier input
interface OtherMaterialSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerUnit?: number | string;
}

/**
 * Create a single other material item
 * Auto-generates materialCode and creates corresponding material entry
 * Supports multiple suppliers via suppliers array
 */
export const createOtherMaterial = async (req: Request, res: Response) => {
  try {
    const {
      materialName,
      category,
      unit,
      specifications,
      pricePerUnit,
      supplierId,
      description,
      suppliers = []
    } = req.body;

    // Auto-generate material code
    const materialCode = await generateCode('OTH', 'other_material_master', 'materialCode');

    // Validate required fields
    if (!materialName || materialName.trim() === '') {
      return res.status(400).json({ error: 'Material name is required' });
    }

    // Get Other Materials category ID
    const otherMaterialCategory = await prisma.material_categories.findFirst({
      where: { name: 'Other' }
    });

    if (!otherMaterialCategory) {
      return res.status(500).json({ error: 'Other Materials category not found. Please create it first.' });
    }

    // Create other_material_master entry with suppliers using Prisma
    const materialRecord = await prisma.other_material_master.create({
      data: {
        materialCode,
        materialName,
        category: category || null,
        unit: unit || 'PIECE',
        specifications: specifications || null,
        pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : null,
        supplierId: supplierId || null,
        description: description || null,
        isActive: true,
        // Create supplier relationships
        otherMaterialSuppliers: {
          create: suppliers.map((s: OtherMaterialSupplierInput) => ({
            supplierId: s.supplierId,
            isPreferred: s.isPreferred || false,
            isActive: s.isActive !== undefined ? s.isActive : true,
            notes: s.notes || null,
            pricePerUnit: s.pricePerUnit ? parseFloat(String(s.pricePerUnit)) : null,
          })),
        },
      },
      include: {
        otherMaterialSuppliers: {
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
        id: `mat-${materialCode.toLowerCase()}`,
        code: materialCode,
        name: materialName,
        materialType: 'OTHER',
        otherMaterialId: materialRecord.id,
        categoryId: otherMaterialCategory.id,
        unit: unit || 'PIECE',
        isActive: true,
      }
    });

    res.status(201).json({
      otherMaterial: materialRecord,
      material: materialEntry,
      message: 'Other material created successfully'
    });

  } catch (error: unknown) {
    console.error('Error creating other material:', error);
    res.status(500).json({
      error: 'Failed to create other material',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get all other materials with pagination and search
 */
export const getAllOtherMaterials = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      supplierId = '',
      category = ''
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const where: {
      isActive: boolean;
      OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
      otherMaterialSuppliers?: { some: { supplierId: string; isActive: boolean } };
      category?: { contains: string; mode: 'insensitive' };
    } = { isActive: true };

    if (search) {
      where.OR = [
        { materialName: { contains: String(search), mode: 'insensitive' } },
        { materialCode: { contains: String(search), mode: 'insensitive' } },
        { category: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    // Filter by supplier via junction table
    if (supplierId) {
      where.otherMaterialSuppliers = {
        some: {
          supplierId: String(supplierId),
          isActive: true
        }
      };
    }

    // Filter by category
    if (category) {
      where.category = { contains: String(category), mode: 'insensitive' };
    }

    // Get total count
    const total = await prisma.other_material_master.count({ where });

    // Get other materials with relations
    const otherMaterials = await prisma.other_material_master.findMany({
      where,
      include: {
        materials: {
          select: { id: true, code: true }
        },
        otherMaterialSuppliers: {
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
    const transformedMaterials = otherMaterials.map((item: any) => ({
      ...item,
      materialId: item.materials[0]?.id || null,
      materialCodeRef: item.materials[0]?.code || null,
      materials: undefined,
      // Keep otherMaterialSuppliers - serializer will rename
    }));

    res.json({
      data: transformedMaterials,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching other materials:', error);
    res.status(500).json({
      error: 'Failed to fetch other materials',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get other material by ID
 */
export const getOtherMaterialById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const otherMaterial = await prisma.other_material_master.findUnique({
      where: { id },
      include: {
        materials: {
          select: { id: true, code: true }
        },
        otherMaterialSuppliers: {
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

    if (!otherMaterial) {
      return res.status(404).json({ error: 'Other material not found' });
    }

    // Transform to match expected format
    const transformed = {
      ...otherMaterial,
      materialId: otherMaterial.materials[0]?.id || null,
      materialCodeRef: otherMaterial.materials[0]?.code || null,
      materials: undefined,
    };

    res.json(transformed);

  } catch (error: unknown) {
    console.error('Error fetching other material:', error);
    res.status(500).json({
      error: 'Failed to fetch other material',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update other material
 */
export const updateOtherMaterial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      materialName,
      category,
      unit,
      specifications,
      pricePerUnit,
      supplierId,
      description,
      isActive,
      suppliers
    } = req.body;

    // Check if other material exists
    const existing = await prisma.other_material_master.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Other material not found' });
    }

    // Update suppliers if provided (delete-and-recreate pattern)
    if (suppliers !== undefined && Array.isArray(suppliers)) {
      await prisma.other_material_suppliers.deleteMany({
        where: { otherMaterialId: id }
      });

      if (suppliers.length > 0) {
        await prisma.other_material_suppliers.createMany({
          data: suppliers.map((s: OtherMaterialSupplierInput) => ({
            otherMaterialId: id,
            supplierId: s.supplierId,
            isPreferred: s.isPreferred || false,
            isActive: s.isActive !== undefined ? s.isActive : true,
            notes: s.notes || null,
            pricePerUnit: s.pricePerUnit ? parseFloat(String(s.pricePerUnit)) : null,
          }))
        });
      }
    }

    // Update other material
    const updated = await prisma.other_material_master.update({
      where: { id },
      data: {
        ...(materialName !== undefined && { materialName }),
        ...(category !== undefined && { category: category || null }),
        ...(unit !== undefined && { unit: unit || 'PIECE' }),
        ...(specifications !== undefined && { specifications: specifications || null }),
        ...(pricePerUnit !== undefined && { pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : null }),
        ...(supplierId !== undefined && { supplierId: supplierId || null }),
        ...(description !== undefined && { description: description || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        materials: {
          select: { id: true, code: true }
        },
        otherMaterialSuppliers: {
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

    // Update material name if materialName changed
    if (materialName) {
      await prisma.materials.updateMany({
        where: { otherMaterialId: id },
        data: { name: materialName }
      });
    }

    // Transform response
    const transformed = {
      ...updated,
      materialId: updated.materials[0]?.id || null,
      materialCodeRef: updated.materials[0]?.code || null,
      materials: undefined,
    };

    res.json({
      otherMaterial: transformed,
      message: 'Other material updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating other material:', error);
    res.status(500).json({
      error: 'Failed to update other material',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Delete other material
 */
export const deleteOtherMaterial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if other material exists
    const existing = await prisma.other_material_master.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Other material not found' });
    }

    // Check if used in any BOM
    const bomUsage = await prisma.order_bom_items.count({
      where: {
        materialId: id
      }
    });

    if (bomUsage > 0) {
      return res.status(400).json({
        error: 'Cannot delete other material',
        message: `This material is used in ${bomUsage} BOM(s). Please remove from BOMs first.`
      });
    }

    // Delete material entry first (FK constraint)
    await prisma.materials.deleteMany({
      where: { otherMaterialId: id }
    });

    // Delete other material (cascade will delete other_material_suppliers)
    await prisma.other_material_master.delete({
      where: { id }
    });

    res.json({ message: 'Other material deleted successfully' });

  } catch (error: unknown) {
    console.error('Error deleting other material:', error);
    res.status(500).json({
      error: 'Failed to delete other material',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Bulk import other materials from Excel
 */
export const bulkImportOtherMaterials = async (req: Request, res: Response) => {
  try {
    const { data, createStock = false } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided for import' });
    }

    // Get Other Materials category
    const otherMaterialCategory = await prisma.material_categories.findFirst({
      where: { name: 'Other' }
    });

    if (!otherMaterialCategory) {
      return res.status(500).json({ error: 'Other Materials category not found' });
    }

    // Pre-generate all material codes
    const codes = await generateBatchCodes('OTH', 'other_material_master', 'materialCode', data.length);

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
      const materialCode = codes[i];

      try {
        // Validate required field
        if (!row.materialName || row.materialName.trim() === '') {
          results.push({
            success: false,
            row: i + 1,
            error: 'Material name is required'
          });
          continue;
        }

        // Create other material using Prisma
        const materialRecord = await prisma.other_material_master.create({
          data: {
            materialCode,
            materialName: row.materialName,
            category: row.category || null,
            unit: row.unit || 'PIECE',
            specifications: row.specifications || null,
            pricePerUnit: row.pricePerUnit ? parseFloat(row.pricePerUnit) : null,
            description: row.description || null,
            isActive: true,
          }
        });

        // Create material
        const materialId = `mat-${materialCode.toLowerCase()}`;
        await prisma.materials.create({
          data: {
            id: materialId,
            code: materialCode,
            name: row.materialName,
            materialType: 'OTHER',
            otherMaterialId: materialRecord.id,
            categoryId: otherMaterialCategory.id,
            unit: row.unit || 'PIECE',
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
              unit: row.unit || 'PIECE',
              reorderLevel: row.reorderLevel ? parseFloat(row.reorderLevel) : 0,
              maxLevel: row.maxLevel ? parseFloat(row.maxLevel) : 0,
            }
          });
          stockCreated = true;
        }

        results.push({
          success: true,
          row: i + 1,
          materialCode,
          materialName: row.materialName,
          stockCreated
        });

      } catch (error: any) {
        results.push({
          success: false,
          row: i + 1,
          materialCode,
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
        { field: 'materialName', header: 'Material Name', required: true, description: 'Name of the material (Required)' },
        { field: 'category', header: 'Category', required: false, description: 'Material category (Optional)' },
        { field: 'unit', header: 'Unit', required: false, description: 'Unit of measurement (PIECE, METER, KG, etc.) (Optional)' },
        { field: 'specifications', header: 'Specifications', required: false, description: 'Technical specifications (Optional)' },
        { field: 'pricePerUnit', header: 'Price Per Unit', required: false, description: 'Price per unit (Optional)' },
        { field: 'description', header: 'Description', required: false, description: 'Description (Optional)' },
        { field: 'stockQuantity', header: 'Stock Quantity', required: false, description: 'Initial stock quantity (Optional)' },
        { field: 'locationCode', header: 'Location Code', required: false, description: 'Warehouse location code (Optional)' }
      ],
      exampleData: [
        {
          materialName: 'Safety Pin Pack',
          category: 'Miscellaneous',
          unit: 'PACK',
          specifications: 'Pack of 100 pins',
          pricePerUnit: 25.00,
          description: 'Safety pins for tagging and sampling',
          stockQuantity: 50,
          locationCode: 'WH-01-C'
        }
      ]
    };

    res.json(template);

  } catch (error: any) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template', details: error.message });
  }
};
