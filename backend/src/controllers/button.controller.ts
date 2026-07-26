import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, allocateBatchCodes } from '../utils/code-generator';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import { trimStockService } from '../services/trim-stock.service';

// Type for supplier input
interface ButtonSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerPiece?: number | string;
  pricePerGross?: number | string;
}

/**
 * Create a single button item
 * Auto-generates buttonCode and creates corresponding material entry
 * Optionally associates with styles via styleCodes array
 * Supports multiple suppliers via suppliers array
 */
export const createButton = async (req: Request, res: Response) => {
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
    styleCodes = [], // Array of style codes to associate
    suppliers = [], // Array of supplier relationships
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
    where: { name: 'Buttons' },
  });

  if (!buttonCategory) {
    throw new BusinessError('Buttons category not found. Please run Phase 1 migration.');
  }

  // Validate styleCodes if provided
  let validStyles: { id: string; styleCode: string }[] = [];
  if (styleCodes.length > 0) {
    validStyles = await prisma.styles.findMany({
      where: { styleCode: { in: styleCodes } },
      select: { id: true, styleCode: true },
    });

    const foundCodes = validStyles.map((s) => s.styleCode);
    const invalidCodes = styleCodes.filter((code: string) => !foundCodes.includes(code));
    if (invalidCodes.length > 0) {
      throw new ValidationError('Invalid style codes', { invalidCodes });
    }
  }

  // Create button_master entry with suppliers using Prisma
  const buttonRecord = await prisma.button_master.create({
    data: {
      buttonCode,
      buttonName: finalButtonName,
      supplierCode: supplierCode ?? null,
      buyerCode: buyerCode ?? null,
      size: size ?? null,
      holes: holes != null ? parseInt(holes) : null,
      color: color ?? null,
      material: material ?? null,
      shape: shape ?? null,
      pricePerPiece: pricePerPiece != null ? parseFloat(pricePerPiece) : null,
      pricePerGross: pricePerGross != null ? parseFloat(pricePerGross) : null,
      supplierId: supplierId ?? null,
      description: description ?? null,
      isActive: true,
      // Create supplier relationships
      buttonSuppliers: {
        create: suppliers.map((s: ButtonSupplierInput) => ({
          supplierId: s.supplierId,
          isPreferred: s.isPreferred ?? false,
          isActive: s.isActive ?? true,
          notes: s.notes ?? null,
          pricePerPiece: s.pricePerPiece != null ? parseFloat(String(s.pricePerPiece)) : null,
          pricePerGross: s.pricePerGross != null ? parseFloat(String(s.pricePerGross)) : null,
        })),
      },
    },
    include: {
      buttonSuppliers: {
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
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
    },
  });

  // Create style associations if provided
  if (validStyles.length > 0) {
    await prisma.button_style_associations.createMany({
      data: validStyles.map((style, index) => ({
        buttonId: buttonRecord.id,
        styleId: style.id,
        isPrimary: index === 0,
      })),
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
    },
  });

  res.status(201).json({
    button: {
      ...buttonRecord,
      styleCodes: validStyles.map((s) => s.styleCode),
    },
    material: materialEntry,
    message: 'Button created successfully',
  });
};

/**
 * Get all buttons with pagination and search
 * Includes associated style codes and suppliers
 */
export const getAllButtons = async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    supplierId = '',
    styleCode = '', // Filter by specific style
  } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;

  // Build where clause
  const where: {
    isActive: boolean;
    OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
    buttonSuppliers?: { some: { supplierId: string; isActive: boolean } };
    button_style_associations?: { some: { style: { styleCode: string } } };
  } = { isActive: true };

  if (search) {
    where.OR = [
      { buttonName: { contains: String(search), mode: 'insensitive' } },
      { buttonCode: { contains: String(search), mode: 'insensitive' } },
      { color: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  // Filter by supplier via junction table
  if (supplierId) {
    where.buttonSuppliers = {
      some: {
        supplierId: String(supplierId),
        isActive: true,
      },
    };
  }

  // Filter by style code if provided
  if (styleCode) {
    where.button_style_associations = {
      some: {
        style: { styleCode: String(styleCode) },
      },
    };
  }

  // Get total count
  const total = await prisma.button_master.count({ where });

  // Get buttons with relations including suppliers and style associations
  const buttons = await prisma.button_master.findMany({
    where,
    include: {
      materials: {
        select: { id: true, code: true },
      },
      buttonSuppliers: {
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
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
      button_style_associations: {
        include: {
          style: {
            select: { styleCode: true, styleName: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limitNum,
  });

  // Transform to match expected format
  const transformedButtons = buttons.map((item: any) => ({
    ...item,
    materialId: item.materials[0]?.id || null,
    materialCode: item.materials[0]?.code || null,
    styleCodes: item.button_style_associations.map((sa: any) => sa.style.styleCode),
    styleNames: item.button_style_associations.map((sa: any) => sa.style.styleName),
    materials: undefined,
    button_style_associations: undefined,
    // Keep buttonSuppliers - serializer will rename to 'suppliers'
  }));

  res.json({
    data: transformedButtons,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get button by ID
 * Includes associated style codes and suppliers
 */
export const getButtonById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const button = await prisma.button_master.findUnique({
    where: { id },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      buttonSuppliers: {
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
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
      button_style_associations: {
        include: {
          style: {
            select: { styleCode: true, styleName: true },
          },
        },
        orderBy: { isPrimary: 'desc' },
      },
    },
  });

  if (!button) {
    throw new NotFoundError('Button', id);
  }

  // Transform to match expected format
  const transformed = {
    ...button,
    materialId: button.materials[0]?.id || null,
    materialCode: button.materials[0]?.code || null,
    styleCodes: button.button_style_associations.map((sa: any) => sa.style.styleCode),
    styleNames: button.button_style_associations.map((sa: any) => sa.style.styleName),
    materials: undefined,
    button_style_associations: undefined,
    // Keep buttonSuppliers - serializer will rename to 'suppliers'
  };

  res.json(transformed);
};

/**
 * Update button
 * Supports updating style associations via styleCodes array
 * Supports updating suppliers via suppliers array (delete-and-recreate pattern)
 */
export const updateButton = async (req: Request, res: Response) => {
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
    isActive,
    styleCodes, // Array of style codes to associate (replaces existing)
    suppliers, // Array of supplier relationships (replaces existing)
  } = req.body;

  // Check if button exists
  const existing = await prisma.button_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Button', id);
  }

  // Validate styleCodes if provided
  let validStyles: { id: string; styleCode: string }[] = [];
  if (styleCodes !== undefined && Array.isArray(styleCodes)) {
    if (styleCodes.length > 0) {
      validStyles = await prisma.styles.findMany({
        where: { styleCode: { in: styleCodes } },
        select: { id: true, styleCode: true },
      });

      const foundCodes = validStyles.map((s) => s.styleCode);
      const invalidCodes = styleCodes.filter((code: string) => !foundCodes.includes(code));
      if (invalidCodes.length > 0) {
        throw new ValidationError('Invalid style codes', { invalidCodes });
      }
    }

    // Delete existing associations and create new ones
    await prisma.button_style_associations.deleteMany({
      where: { buttonId: id },
    });

    if (validStyles.length > 0) {
      await prisma.button_style_associations.createMany({
        data: validStyles.map((style, index) => ({
          buttonId: id,
          styleId: style.id,
          isPrimary: index === 0,
        })),
      });
    }
  }

  // Update suppliers if provided (delete-and-recreate pattern)
  if (suppliers !== undefined && Array.isArray(suppliers)) {
    // Delete existing supplier relationships
    await prisma.button_suppliers.deleteMany({
      where: { buttonId: id },
    });

    // Create new supplier relationships
    if (suppliers.length > 0) {
      await prisma.button_suppliers.createMany({
        data: suppliers.map((s: ButtonSupplierInput) => ({
          buttonId: id,
          supplierId: s.supplierId,
          isPreferred: s.isPreferred ?? false,
          isActive: s.isActive ?? true,
          notes: s.notes ?? null,
          pricePerPiece: s.pricePerPiece != null ? parseFloat(String(s.pricePerPiece)) : null,
          pricePerGross: s.pricePerGross != null ? parseFloat(String(s.pricePerGross)) : null,
        })),
      });
    }
  }

  // Determine final values for name generation (use new values if provided, otherwise use existing)
  const finalBuyerCode = buyerCode !== undefined ? buyerCode : existing.buyerCode;
  const finalColor = color !== undefined ? color : existing.color;
  const finalMaterial = material !== undefined ? material : existing.material;
  const finalHoles = holes !== undefined ? (holes != null ? parseInt(holes) : null) : existing.holes;
  const finalSize = size !== undefined ? size : existing.size;

  // Auto-regenerate buttonName if it was originally auto-generated (empty input) or if name is not explicitly provided
  // If buttonName is empty string or not provided, regenerate from attributes
  let finalButtonName = buttonName;
  if (!buttonName || buttonName.trim() === '') {
    const parts = [];
    if (finalBuyerCode) parts.push(`[${finalBuyerCode}]`);
    if (finalColor) parts.push(finalColor);
    if (finalMaterial) parts.push(finalMaterial);
    if (finalHoles) parts.push(`${finalHoles}-Hole`);
    parts.push('Button');
    if (finalSize) parts.push(finalSize);
    finalButtonName = parts.join(' ').trim() || `Button ${existing.buttonCode}`;
  }

  // Update button
  const updated = await prisma.button_master.update({
    where: { id },
    data: {
      buttonName: finalButtonName,
      ...(supplierCode !== undefined && { supplierCode: supplierCode ?? null }),
      ...(buyerCode !== undefined && { buyerCode: buyerCode ?? null }),
      ...(size !== undefined && { size: size ?? null }),
      ...(holes !== undefined && { holes: holes != null ? parseInt(holes) : null }),
      ...(color !== undefined && { color: color ?? null }),
      ...(material !== undefined && { material: material ?? null }),
      ...(shape !== undefined && { shape: shape ?? null }),
      ...(pricePerPiece !== undefined && { pricePerPiece: pricePerPiece != null ? parseFloat(pricePerPiece) : null }),
      ...(pricePerGross !== undefined && { pricePerGross: pricePerGross != null ? parseFloat(pricePerGross) : null }),
      ...(supplierId !== undefined && { supplierId: supplierId || null }),
      ...(description !== undefined && { description: description || null }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      buttonSuppliers: {
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
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
      button_style_associations: {
        include: {
          style: {
            select: { styleCode: true, styleName: true },
          },
        },
      },
    },
  });

  // Update material name if buttonName changed
  if (finalButtonName) {
    await prisma.materials.updateMany({
      where: { buttonId: id },
      data: { name: finalButtonName },
    });
  }

  // Transform response
  const transformed = {
    ...updated,
    materialId: updated.materials[0]?.id || null,
    materialCode: updated.materials[0]?.code || null,
    styleCodes: updated.button_style_associations.map((sa: any) => sa.style.styleCode),
    styleNames: updated.button_style_associations.map((sa: any) => sa.style.styleName),
    materials: undefined,
    button_style_associations: undefined,
    // Keep buttonSuppliers - serializer will rename to 'suppliers'
  };

  res.json({
    button: transformed,
    message: 'Button updated successfully',
  });
};

/**
 * Delete button
 * Checks if button is used in any BOM first
 */
export const deleteButton = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if button exists
  const existing = await prisma.button_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Button', id);
  }

  // Check if used in any BOM
  // Also guard the STYLE BOM (style_material_bom) — it holds the live bill-of-materials and its
  // FKs are ON DELETE SET NULL, so deleting a button still referenced there silently orphans those
  // BOM lines. Checking the order BOM alone is not enough (bug-hunt BH-0286).
  const [orderBomUsage, styleBomUsage] = await Promise.all([
    prisma.order_bom_items.count({ where: { buttonId: id } }),
    prisma.style_material_bom.count({ where: { buttonId: id } }),
  ]);
  const bomUsage = orderBomUsage + styleBomUsage;

  if (bomUsage > 0) {
    throw new BusinessError(
      `Cannot delete button. This button is used in ${bomUsage} BOM(s). Please remove from BOMs first.`
    );
  }

  // Delete material entry first (FK constraint)
  await prisma.materials.deleteMany({
    where: { buttonId: id },
  });

  // Delete button (cascade will delete button_suppliers)
  await prisma.button_master.delete({
    where: { id },
  });

  res.json({ message: 'Button deleted successfully' });
};

/**
 * Bulk import buttons from Excel
 * Auto-generates codes and creates material entries
 */
export const bulkImportButtons = async (req: Request, res: Response) => {
  const { data, createStock = false } = req.body;
  const userId = (req as any).user?.id || 'system';

  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new ValidationError('No data provided for import');
  }

  // Get Buttons category
  const buttonCategory = await prisma.material_categories.findFirst({
    where: { name: 'Buttons' },
  });

  if (!buttonCategory) {
    throw new BusinessError('Buttons category not found');
  }

  // Pre-generate all button codes
  const codes = await allocateBatchCodes('BTN', 'button_master', 'buttonCode', data.length);

  // Get default warehouse if creating stock
  let defaultWarehouse: any = null;
  if (createStock) {
    defaultWarehouse = await prisma.warehouses.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  const results: any[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const buttonCode = codes[i];

    try {
      // Validate required field
      if (!row.buttonName || row.buttonName.trim() === '') {
        results.push({
          success: false,
          row: i + 1,
          error: 'Button name is required',
        });
        continue;
      }

      // Create button using Prisma
      const buttonRecord = await prisma.button_master.create({
        data: {
          buttonCode,
          buttonName: row.buttonName,
          supplierCode: row.supplierCode ?? null,
          buyerCode: row.buyerCode ?? null,
          size: row.size ?? null,
          holes: row.holes != null ? parseInt(row.holes) : null,
          color: row.color ?? null,
          material: row.material ?? null,
          shape: row.shape ?? null,
          pricePerPiece: row.pricePerPiece != null ? parseFloat(row.pricePerPiece) : null,
          pricePerGross: row.pricePerGross != null ? parseFloat(row.pricePerGross) : null,
          description: row.description || null,
          isActive: true,
        },
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
        },
      });

      // Create stock if requested - using specialized button_stock table
      let stockCreated = false;
      if (createStock && row.stockQuantity && row.stockQuantity > 0 && defaultWarehouse) {
        await trimStockService.createTrimStock(
          {
            trimType: 'BUTTON',
            masterId: buttonRecord.id,
            quantity: parseFloat(row.stockQuantity),
            unit: 'PIECE',
            purchaseCost: row.purchaseCost ? parseFloat(row.purchaseCost) : 0,
            warehouseId: defaultWarehouse.id,
            sourceType: 'IMPORT',
          },
          userId
        );
        stockCreated = true;
      }

      results.push({
        success: true,
        row: i + 1,
        buttonCode,
        materialCode: buttonCode,
        buttonName: row.buttonName,
        stockCreated,
      });
    } catch (error: any) {
      results.push({
        success: false,
        row: i + 1,
        buttonCode,
        error: error.message,
      });
    }
  }

  const summary = {
    total: data.length,
    success: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };

  res.json({
    results,
    summary,
    message: `Bulk import completed: ${summary.success} succeeded, ${summary.failed} failed`,
  });
};

/**
 * Download Excel template for bulk import
 */
export const downloadTemplate = async (req: Request, res: Response) => {
  const template = {
    columns: [
      { field: 'buttonName', header: 'Button Name', required: true, description: 'Name of the button (Required)' },
      {
        field: 'supplierCode',
        header: 'Supplier Code',
        required: false,
        description: "Supplier's reference code (Optional)",
      },
      { field: 'buyerCode', header: 'Buyer Code', required: false, description: "Buyer's reference code (Optional)" },
      { field: 'size', header: 'Size', required: false, description: 'Button size (Optional)' },
      { field: 'holes', header: 'Holes', required: false, description: 'Number of holes (Optional)' },
      { field: 'color', header: 'Color', required: false, description: 'Color name (Optional)' },
      { field: 'material', header: 'Material', required: false, description: 'Material type (Optional)' },
      { field: 'shape', header: 'Shape', required: false, description: 'Button shape (Optional)' },
      { field: 'pricePerPiece', header: 'Price Per Piece', required: false, description: 'Price per piece (Optional)' },
      {
        field: 'pricePerGross',
        header: 'Price Per Gross',
        required: false,
        description: 'Price per gross (144 pcs) (Optional)',
      },
      { field: 'description', header: 'Description', required: false, description: 'Description (Optional)' },
      {
        field: 'stockQuantity',
        header: 'Stock Quantity',
        required: false,
        description: 'Initial stock quantity (Optional)',
      },
      {
        field: 'locationCode',
        header: 'Location Code',
        required: false,
        description: 'Warehouse location code (Optional)',
      },
    ],
    exampleData: [
      {
        buttonName: 'Metal Button 15mm',
        supplierCode: 'SUP-001',
        buyerCode: '',
        size: '15mm',
        holes: 2,
        color: 'Silver',
        material: 'Metal',
        shape: 'Round',
        pricePerPiece: 0.25,
        pricePerGross: 30.0,
        description: 'Silver metal button 2-hole',
        stockQuantity: 1000,
        locationCode: 'WH-01-A',
      },
    ],
  };

  res.json(template);
};
