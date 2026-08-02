import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, allocateBatchCodes } from '../utils/code-generator';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import { createLaceStock } from '../services/laceStock.service';
import { syncMasterToMaterials } from '../services/helpers/material-sync.helper';

// Type for supplier input
interface LaceSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerMeter?: number | string;
}

/**
 * Generates lace name following the consistent naming convention:
 * - GREIGE:    {laceCode} | {laceType} | {composition} | {width}" | GREIGE
 * - READY:     {laceCode} | {laceType} | {composition} | {width}" | {color}
 * - PROCESSED: {laceCode} | {laceType} | {composition} | {width}" | {color} | {sourceGreigeCode} → {styleCode}
 */
function generateLaceName(lace: {
  laceCode: string;
  laceType?: string | null;
  composition?: string | null;
  width?: number | null;
  color?: string | null;
  isGreige: boolean;
  sourceGreigeLaceCode?: string | null;
  processedForStyleCode?: string | null;
}): string {
  const parts: string[] = [lace.laceCode];

  // Add laceType (use 'Lace' as fallback)
  parts.push(lace.laceType || 'Lace');

  // Add composition if present
  if (lace.composition) {
    parts.push(lace.composition);
  }

  // Add width if present
  if (lace.width) {
    parts.push(`${lace.width}"`);
  }

  // Type-specific suffix
  if (lace.isGreige) {
    parts.push('GREIGE');
  } else if (lace.sourceGreigeLaceCode) {
    // Processed lace
    parts.push(lace.color || 'Unspecified');
    parts.push(`${lace.sourceGreigeLaceCode} → ${lace.processedForStyleCode || '?'}`);
  } else {
    // Ready lace
    parts.push(lace.color || 'Unspecified');
  }

  return parts.join(' | ');
}

/**
 * Create a single lace item
 * Auto-generates laceCode and creates corresponding material entry
 * Optionally associates with styles via styleCodes array
 * Supports multiple suppliers via suppliers array
 * Supports greige lace with isGreige flag and related fields
 */
export const createLace = async (req: Request, res: Response) => {
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
    suppliers = [], // Array of supplier relationships
    // Greige lace support
    isGreige = false, // True = raw lace needing dyeing
    expectedShrinkagePercent, // Shrinkage during dyeing (for greige)
    costPerMeterGreige, // Greige cost (if isGreige=true)
    sourceGreigeLaceId, // For finished lace: links to source greige
    pricePerMeter, // Price per meter for ready lace
  } = req.body;

  // Auto-generate lace code
  const laceCode = await generateCode('LACE', 'lace_master', 'laceCode');

  // For processed lace, get source greige lace code for naming
  let sourceGreigeLaceCode: string | null = null;
  if (sourceGreigeLaceId) {
    const sourceGreige = await prisma.lace_master.findUnique({
      where: { id: sourceGreigeLaceId },
      select: { laceCode: true },
    });
    sourceGreigeLaceCode = sourceGreige?.laceCode || null;
  }

  // Auto-generate laceName using consistent naming convention
  let finalLaceName = laceName;
  if (!finalLaceName || finalLaceName.trim() === '') {
    finalLaceName = generateLaceName({
      laceCode,
      laceType: laceType || null,
      composition: composition || null,
      width: width ? parseFloat(width) : null,
      color: isGreige ? null : color || null,
      isGreige: Boolean(isGreige),
      sourceGreigeLaceCode,
      processedForStyleCode: null, // Not set at creation time
    });
  }

  // Get Lace category ID
  const laceCategory = await prisma.material_categories.findFirst({
    where: { name: 'Lace' },
  });

  if (!laceCategory) {
    throw new ValidationError('Lace category not found. Please run Phase 1 migration.');
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

  // For greige lace, color is not applicable (color applied during dyeing)
  const finalColor = isGreige ? null : color || null;

  // Validate sourceGreigeLaceId if provided (for finished lace)
  if (sourceGreigeLaceId) {
    const sourceGreige = await prisma.lace_master.findUnique({
      where: { id: sourceGreigeLaceId },
      select: { id: true, isGreige: true },
    });
    if (!sourceGreige || !sourceGreige.isGreige) {
      throw new ValidationError('Invalid sourceGreigeLaceId: Source lace must be a greige lace (isGreige=true)');
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
      color: finalColor,
      composition: composition || null,
      laceType: laceType || null,
      description: description || null,
      isActive: true,
      // Greige lace fields
      isGreige: Boolean(isGreige),
      expectedShrinkagePercent: expectedShrinkagePercent ? parseFloat(expectedShrinkagePercent) : null,
      costPerMeterGreige: costPerMeterGreige ? parseFloat(costPerMeterGreige) : null,
      sourceGreigeLaceId: sourceGreigeLaceId || null,
      pricePerMeter: pricePerMeter ? parseFloat(pricePerMeter) : null,
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
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
      sourceGreigeLace: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          expectedShrinkagePercent: true,
          costPerMeterGreige: true,
        },
      },
    },
  });

  // Create style associations if provided
  if (validStyles.length > 0) {
    await prisma.lace_style_associations.createMany({
      data: validStyles.map((style, index) => ({
        laceId: laceRecord.id,
        styleId: style.id,
        isPrimary: index === 0, // First style is primary
      })),
    });
  }

  // Create corresponding material entry with SAME ID as lace_master
  const material = await prisma.materials.create({
    data: {
      id: laceRecord.id, // Use same ID as lace_master for consistency
      code: laceCode,
      name: finalLaceName,
      materialType: 'LACE',
      laceId: laceRecord.id,
      categoryId: laceCategory.id,
      unit: 'METER',
      isActive: true,
    },
  });

  res.status(201).json({
    lace: {
      ...laceRecord,
      styleCodes: validStyles.map((s) => s.styleCode),
    },
    material,
    message: 'Lace created successfully',
  });
};

/**
 * Get all lace items with pagination and search
 * Includes associated style codes and suppliers
 * Supports filtering by isGreige status
 */
export const getAllLace = async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    supplierId = '',
    styleCode = '', // Filter by specific style
    isGreige = '', // Filter by greige status: 'true', 'false', or empty for all
  } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;

  // Build where clause
  const where: {
    isActive: boolean;
    isGreige?: boolean;
    OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
    lace_suppliers?: { some: { supplierId: string; isActive: boolean } };
    lace_style_associations?: { some: { style: { styleCode: string } } };
  } = { isActive: true };

  // Filter by greige status if specified
  if (isGreige === 'true') {
    where.isGreige = true;
  } else if (isGreige === 'false') {
    where.isGreige = false;
  }

  if (search) {
    where.OR = [
      { laceName: { contains: String(search), mode: 'insensitive' } },
      { laceCode: { contains: String(search), mode: 'insensitive' } },
      { color: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  // Filter by supplier via junction table
  if (supplierId) {
    where.lace_suppliers = {
      some: {
        supplierId: String(supplierId),
        isActive: true,
      },
    };
  }

  // Filter by style code if provided
  if (styleCode) {
    where.lace_style_associations = {
      some: {
        style: { styleCode: String(styleCode) },
      },
    };
  }

  // Get total count
  const total = await prisma.lace_master.count({ where });

  // Get lace items with relations including suppliers, style associations, and greige source
  const laceItems = await prisma.lace_master.findMany({
    where,
    include: {
      materials: {
        select: { id: true, code: true },
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
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
      lace_style_associations: {
        include: {
          style: {
            select: { styleCode: true, styleName: true },
          },
        },
      },
      // Include source greige lace for finished lace items
      sourceGreigeLace: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          expectedShrinkagePercent: true,
          costPerMeterGreige: true,
        },
      },
      // Include finished laces that were made from this greige
      finishedLaces: {
        where: { isActive: true },
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          color: true,
          processedForStyleCode: true,
        },
      },
      // Include processedForStyle for processed laces
      processedForStyle: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
        },
      },
      // Cost sheet associations - for greige lace (styles planning to process it)
      greigeCostingItems: {
        where: { sourcingStrategy: 'GREIGE_PROCESSED' },
        select: {
          sourcingStrategy: true,
          costing: {
            select: {
              styles: {
                select: { styleCode: true, styleName: true },
              },
            },
          },
        },
      },
      // Cost sheet associations - for finished lace (styles using it)
      costingItems: {
        select: {
          sourcingStrategy: true,
          costing: {
            select: {
              styles: {
                select: { styleCode: true, styleName: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limitNum,
  });

  // Transform to match expected format
  // Note: lace_suppliers is kept and will be transformed to 'suppliers' by the serializer middleware
  const transformedItems = laceItems.map((item: any) => {
    // Extract cost sheet style associations
    // For greige lace: styles that plan to process it (via greigeCostingItems)
    // For finished lace: styles that use it (via costingItems)
    const costingStyleCodes = item.isGreige
      ? [...new Set(item.greigeCostingItems?.map((ci: any) => ci.costing?.styles?.styleCode).filter(Boolean) || [])]
      : [...new Set(item.costingItems?.map((ci: any) => ci.costing?.styles?.styleCode).filter(Boolean) || [])];

    const costingStyleNames = item.isGreige
      ? [...new Set(item.greigeCostingItems?.map((ci: any) => ci.costing?.styles?.styleName).filter(Boolean) || [])]
      : [...new Set(item.costingItems?.map((ci: any) => ci.costing?.styles?.styleName).filter(Boolean) || [])];

    return {
      ...item,
      materialId: item.materials[0]?.id || null,
      materialCode: item.materials[0]?.code || null,
      styleCodes: item.lace_style_associations.map((sa: any) => sa.style.styleCode),
      styleNames: item.lace_style_associations.map((sa: any) => sa.style.styleName),
      // Cost sheet style associations (more authoritative)
      costingStyleCodes,
      costingStyleNames,
      // Clean up internal relations
      materials: undefined,
      lace_style_associations: undefined,
      greigeCostingItems: undefined,
      costingItems: undefined,
      // Keep lace_suppliers - serializer will rename to 'suppliers'
    };
  });

  res.json({
    data: transformedItems,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get single lace item by ID
 * Includes associated style codes and suppliers
 */
export const getLaceById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const lace = await prisma.lace_master.findUnique({
    where: { id },
    include: {
      materials: {
        select: { id: true, code: true },
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
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
      lace_style_associations: {
        include: {
          style: {
            select: { styleCode: true, styleName: true },
          },
        },
        orderBy: { isPrimary: 'desc' },
      },
      // Include source greige lace for finished lace items
      sourceGreigeLace: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          width: true,
          composition: true,
          expectedShrinkagePercent: true,
          costPerMeterGreige: true,
        },
      },
      // Include finished laces that were made from this greige
      finishedLaces: {
        where: { isActive: true },
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          color: true,
          pricePerMeter: true,
        },
      },
    },
  });

  if (!lace) {
    throw new NotFoundError('Lace', id);
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
    // Keep lace_suppliers, sourceGreigeLace, finishedLaces - serializer will transform keys
  };

  res.json(transformed);
};

/**
 * Update lace item
 * Note: laceCode cannot be changed
 * Supports updating style associations via styleCodes array
 * Supports updating suppliers via suppliers array (delete-and-recreate pattern)
 */
export const updateLace = async (req: Request, res: Response) => {
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
    suppliers, // Array of supplier relationships (replaces existing)
    // Greige lace fields
    isGreige,
    expectedShrinkagePercent,
    costPerMeterGreige,
    sourceGreigeLaceId,
    pricePerMeter,
  } = req.body;

  // Check if lace exists
  const existing = await prisma.lace_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lace', id);
  }

  // Cannot change isGreige once created (requires new lace entry)
  if (isGreige !== undefined && isGreige !== existing.isGreige) {
    throw new ValidationError('isGreige cannot be changed after creation. Create a new lace entry instead.');
  }

  // Validate sourceGreigeLaceId if provided
  if (sourceGreigeLaceId !== undefined && sourceGreigeLaceId !== null) {
    const sourceGreige = await prisma.lace_master.findUnique({
      where: { id: sourceGreigeLaceId },
      select: { id: true, isGreige: true },
    });
    if (!sourceGreige || !sourceGreige.isGreige) {
      throw new ValidationError('Invalid sourceGreigeLaceId: Source lace must be a greige lace (isGreige=true)');
    }
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
    await prisma.lace_style_associations.deleteMany({
      where: { laceId: id },
    });

    if (validStyles.length > 0) {
      await prisma.lace_style_associations.createMany({
        data: validStyles.map((style, index) => ({
          laceId: id,
          styleId: style.id,
          isPrimary: index === 0,
        })),
      });
    }
  }

  // Update suppliers if provided (delete-and-recreate pattern)
  if (suppliers !== undefined && Array.isArray(suppliers)) {
    // Delete existing supplier relationships
    await prisma.lace_suppliers.deleteMany({
      where: { laceId: id },
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
        })),
      });
    }
  }

  // Determine final values for name generation (use new values if provided, otherwise use existing)
  const finalColor = color !== undefined ? color : existing.color;
  const finalComposition = composition !== undefined ? composition : existing.composition;
  const finalLaceType = laceType !== undefined ? laceType : existing.laceType;
  const finalWidth =
    width !== undefined
      ? width
        ? parseFloat(width)
        : null
      : existing.width
        ? parseFloat(String(existing.width))
        : null;

  // Get source greige lace code for naming (if this is a processed lace)
  let sourceGreigeLaceCode: string | null = null;
  const effectiveSourceGreigeLaceId =
    sourceGreigeLaceId !== undefined ? sourceGreigeLaceId : existing.sourceGreigeLaceId;
  if (effectiveSourceGreigeLaceId) {
    const sourceGreige = await prisma.lace_master.findUnique({
      where: { id: effectiveSourceGreigeLaceId },
      select: { laceCode: true },
    });
    sourceGreigeLaceCode = sourceGreige?.laceCode || null;
  }

  // Auto-regenerate laceName using consistent naming convention
  // If laceName is empty string or not provided, regenerate from attributes
  let finalLaceName = laceName;
  if (!laceName || laceName.trim() === '') {
    finalLaceName = generateLaceName({
      laceCode: existing.laceCode,
      laceType: finalLaceType || null,
      composition: finalComposition || null,
      width: finalWidth,
      color: existing.isGreige ? null : finalColor || null,
      isGreige: existing.isGreige,
      sourceGreigeLaceCode,
      processedForStyleCode: existing.processedForStyleCode,
    });
  }

  // For greige lace, color should not be updated
  const finalColorToUpdate = existing.isGreige ? undefined : color !== undefined ? color || null : undefined;

  // Update lace
  const updated = await prisma.lace_master.update({
    where: { id },
    data: {
      laceName: finalLaceName,
      ...(supplierCode !== undefined && { supplierCode: supplierCode || null }),
      ...(buyerCode !== undefined && { buyerCode: buyerCode || null }),
      ...(width !== undefined && { width: width ? parseFloat(width) : null }),
      ...(design !== undefined && { design: design || null }),
      ...(finalColorToUpdate !== undefined && { color: finalColorToUpdate }),
      ...(composition !== undefined && { composition: composition || null }),
      ...(laceType !== undefined && { laceType: laceType || null }),
      ...(description !== undefined && { description: description || null }),
      ...(isActive !== undefined && { isActive }),
      // Greige lace fields
      ...(expectedShrinkagePercent !== undefined && {
        expectedShrinkagePercent: expectedShrinkagePercent ? parseFloat(expectedShrinkagePercent) : null,
      }),
      ...(costPerMeterGreige !== undefined && {
        costPerMeterGreige: costPerMeterGreige ? parseFloat(costPerMeterGreige) : null,
      }),
      ...(sourceGreigeLaceId !== undefined && { sourceGreigeLaceId: sourceGreigeLaceId || null }),
      ...(pricePerMeter !== undefined && { pricePerMeter: pricePerMeter ? parseFloat(pricePerMeter) : null }),
    },
    include: {
      materials: {
        select: { id: true, code: true },
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
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
      lace_style_associations: {
        include: {
          style: {
            select: { styleCode: true, styleName: true },
          },
        },
      },
      sourceGreigeLace: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          expectedShrinkagePercent: true,
          costPerMeterGreige: true,
        },
      },
      finishedLaces: {
        where: { isActive: true },
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          color: true,
        },
      },
    },
  });

  // BUG-MM13 fix: sync code to materials
  // Note: laceCode is not updated (auto-generated), only sync name changes
  if (finalLaceName && finalLaceName !== existing.laceName) {
    await syncMasterToMaterials(id, 'LACE', { name: finalLaceName });
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
    message: 'Lace updated successfully',
  });
};

/**
 * Delete lace item
 * Checks if lace is used in any BOM first
 */
export const deleteLace = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if lace exists
  const existing = await prisma.lace_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lace', id);
  }

  // Check if used in BOM
  const bomUsage = await prisma.order_bom_items.count({
    where: {
      laceId: id,
    },
  });

  if (bomUsage > 0) {
    throw new BusinessError(`This lace is used in ${bomUsage} BOM(s). Please remove from BOMs first.`);
  }

  // Delete material entry first (FK constraint)
  await prisma.materials.deleteMany({
    where: { laceId: id },
  });

  // Delete lace
  await prisma.lace_master.delete({
    where: { id },
  });

  res.json({ message: 'Lace deleted successfully' });
};

/**
 * Bulk import lace items from Excel
 * Auto-generates codes and creates material entries
 */
export const bulkImportLace = async (req: Request, res: Response) => {
  const { data, createStock = false } = req.body;
  const userId = (req as any).user?.userId || 'system';

  if (!Array.isArray(data) || data.length === 0) {
    throw new ValidationError('Data array is required');
  }

  // Get Lace category
  const laceCategory = await prisma.material_categories.findFirst({
    where: { name: 'Lace' },
  });

  if (!laceCategory) {
    throw new ValidationError('Lace category not found');
  }

  // Pre-generate all codes
  const codes = await allocateBatchCodes('LACE', 'lace_master', 'laceCode', data.length);

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
    const laceCode = codes[i];

    try {
      // Validate required field
      if (!row.laceName || row.laceName.trim() === '') {
        results.push({
          success: false,
          row: i + 1,
          error: 'Lace name is required',
        });
        continue;
      }

      // Create lace + material atomically so a failure cannot leave a master without its materials record
      const laceRecord = await prisma.$transaction(async (tx) => {
        const created = await tx.lace_master.create({
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
          },
        });

        // Create material
        await tx.materials.create({
          data: {
            id: `mat-${laceCode.toLowerCase()}`,
            code: laceCode,
            name: row.laceName,
            materialType: 'LACE',
            laceId: created.id,
            categoryId: laceCategory.id,
            unit: 'METER',
            isActive: true,
          },
        });

        return created;
      });

      // Create stock if requested - using specialized lace_stock table
      let stockCreated = false;
      if (createStock && row.stockQuantity && row.stockQuantity > 0 && defaultWarehouse) {
        await createLaceStock({
          laceId: laceRecord.id,
          quantityAvailable: parseFloat(row.stockQuantity),
          purchaseCost: row.purchaseCost ? parseFloat(row.purchaseCost) : 0,
          weightedAvgCost: row.purchaseCost ? parseFloat(row.purchaseCost) : 0,
          warehouseId: defaultWarehouse.id,
          stockType: 'GENERIC',
          createdById: userId,
        });
        stockCreated = true;
      }

      results.push({
        success: true,
        row: i + 1,
        laceCode,
        materialCode: laceCode,
        laceName: row.laceName,
        stockCreated,
      });
    } catch (error: any) {
      // allow-swallow — per-row bulk-import reporter: row writes are atomic ($transaction) and the failure is surfaced in results[]
      results.push({
        success: false,
        row: i + 1,
        laceCode,
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
 * Get greige lace items only (for dyeing/processing selection)
 * Convenience endpoint - filters isGreige=true
 */
export const getGreigeLace = async (req: Request, res: Response) => {
  const { page = 1, limit = 50, search = '' } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;

  const where: any = {
    isActive: true,
    isGreige: true,
  };

  if (search) {
    where.OR = [
      { laceName: { contains: String(search), mode: 'insensitive' } },
      { laceCode: { contains: String(search), mode: 'insensitive' } },
      { composition: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  const total = await prisma.lace_master.count({ where });

  const laceItems = await prisma.lace_master.findMany({
    where,
    select: {
      id: true,
      laceCode: true,
      laceName: true,
      width: true,
      composition: true,
      laceType: true,
      expectedShrinkagePercent: true,
      costPerMeterGreige: true,
      createdAt: true,
      // Count how many finished laces were made from this greige
      _count: {
        select: { finishedLaces: true },
      },
    },
    orderBy: { laceName: 'asc' },
    skip: offset,
    take: limitNum,
  });

  res.json({
    data: laceItems,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get finished (ready-to-use) lace items only
 * Convenience endpoint - filters isGreige=false
 */
export const getFinishedLace = async (req: Request, res: Response) => {
  const { page = 1, limit = 50, search = '', color = '' } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;

  const where: any = {
    isActive: true,
    isGreige: false,
  };

  if (search) {
    where.OR = [
      { laceName: { contains: String(search), mode: 'insensitive' } },
      { laceCode: { contains: String(search), mode: 'insensitive' } },
      { color: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  if (color) {
    where.color = { contains: String(color), mode: 'insensitive' };
  }

  const total = await prisma.lace_master.count({ where });

  const laceItems = await prisma.lace_master.findMany({
    where,
    select: {
      id: true,
      laceCode: true,
      laceName: true,
      width: true,
      color: true,
      composition: true,
      laceType: true,
      pricePerMeter: true,
      createdAt: true,
      // Include source greige if this lace was processed from greige
      sourceGreigeLace: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
        },
      },
    },
    orderBy: { laceName: 'asc' },
    skip: offset,
    take: limitNum,
  });

  res.json({
    data: laceItems,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get lace items available for costing
 * Returns both ready lace (isGreige=false) and greige lace with processor info
 */
export const getLaceForCosting = async (req: Request, res: Response) => {
  const { search = '' } = req.query;

  const where: any = { isActive: true };

  if (search) {
    where.OR = [
      { laceName: { contains: String(search), mode: 'insensitive' } },
      { laceCode: { contains: String(search), mode: 'insensitive' } },
      { color: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  // Get all active lace items with stock info
  const laceItems = await prisma.lace_master.findMany({
    where,
    include: {
      lace_suppliers: {
        where: { isActive: true },
        include: {
          supplier: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
      sourceGreigeLace: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          expectedShrinkagePercent: true,
          costPerMeterGreige: true,
        },
      },
      // Check available stock
      laceStock: {
        where: { status: 'AVAILABLE' },
        select: {
          id: true,
          quantityAvailable: true,
          weightedAvgCost: true,
          qualityGrade: true,
          dyeLotNumber: true,
        },
      },
    },
    orderBy: { laceName: 'asc' },
  });

  // Transform data for costing dropdown
  const costingOptions = laceItems.map((lace: any) => {
    const totalAvailableStock = lace.laceStock.reduce(
      (sum: number, stock: any) => sum + Number(stock.quantityAvailable),
      0
    );
    const avgStockCost =
      lace.laceStock.length > 0
        ? lace.laceStock.reduce((sum: number, stock: any) => sum + Number(stock.weightedAvgCost), 0) /
          lace.laceStock.length
        : null;

    return {
      id: lace.id,
      laceCode: lace.laceCode,
      laceName: lace.laceName,
      color: lace.color,
      width: lace.width,
      isGreige: lace.isGreige,
      // Cost options
      readyLaceCost: !lace.isGreige ? lace.pricePerMeter : null,
      greigeCost: lace.isGreige ? lace.costPerMeterGreige : (lace.sourceGreigeLace?.costPerMeterGreige ?? null),
      expectedShrinkagePercent: lace.isGreige
        ? lace.expectedShrinkagePercent
        : lace.sourceGreigeLace?.expectedShrinkagePercent || null,
      // Stock info
      stockAvailable: totalAvailableStock,
      stockCost: avgStockCost,
      stockLots: lace.laceStock,
      // Suppliers
      suppliers: lace.lace_suppliers,
      // Source greige (for finished lace from processed greige)
      sourceGreigeLace: lace.sourceGreigeLace,
    };
  });

  res.json({
    data: costingOptions,
    total: costingOptions.length,
  });
};

/**
 * Download Excel template for bulk import
 */
export const downloadTemplate = async (req: Request, res: Response) => {
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
      { name: 'locationCode', required: false, description: 'Warehouse location code (Optional)' },
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
        pricePerMeter: 15.5,
        stockQuantity: 100,
        locationCode: 'WH-01',
      },
    ],
  };

  res.json(template);
};
