/**
 * Material Requirement Planning (MRP) Service
 * Calculates material requirements for production orders
 * and checks against available inventory
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

export interface MaterialRequirement {
  materialId: string;
  materialCode: string;
  materialName: string;
  materialType: string;
  requiredQuantity: number;
  unit: string;
  availableStock: number;
  shortfall: number; // negative = surplus, positive = shortage
  usedInStyles: string[]; // List of style codes using this material
}

export interface StyleRequirement {
  styleId: string;
  styleCode: string;
  styleName: string;
  orderQuantity: number;
  materials: Array<{
    materialCode: string;
    materialName: string;
    quantityPerPiece: number;
    totalRequired: number;
    unit: string;
  }>;
}

/**
 * Get available stock for a material across all warehouses
 */
async function getAvailableStock(materialId: string): Promise<number> {
  if (!materialId) return 0;

  const stockLevels = await prisma.stock_levels.aggregate({
    where: { materialId },
    _sum: { quantity: true },
  });

  return Number(stockLevels._sum.quantity || 0);
}

/**
 * Calculate material requirements for a production order
 * Uses style_material_bom for proper material linking
 * @param styleId - Style ID
 * @param orderQuantity - Number of pieces to produce
 */
export async function calculateMaterialRequirement(
  styleId: string,
  orderQuantity: number
): Promise<MaterialRequirement[]> {
  // Get style with material BOM (proper material linking)
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    include: {
      style_material_bom: {
        where: { isActive: true },
        include: {
          materials: true,
          lace_master: true,
          button_master: true,
          thread_master: true,
          zipper_master: true,
          elastic_master: true,
          label_master: true,
          packaging_master: true,
        },
      },
      style_garment_trims: true, // Fallback for legacy data
    },
  });

  if (!style) {
    throw new Error('Style not found');
  }

  const requirements: MaterialRequirement[] = [];

  // First, process style_material_bom (preferred - has proper material links)
  for (const bom of style.style_material_bom) {
    const quantityPerPiece = Number(bom.quantityPerGarment);
    const totalRequired = quantityPerPiece * orderQuantity;

    // Get material info from the appropriate master table
    let materialId = bom.materialId || '';
    let materialCode = '';
    let materialName = '';

    // Check each material type for name/code (each master has its own naming convention)
    if (bom.materials) {
      materialId = bom.materials.id;
      materialCode = bom.materials.code;
      materialName = bom.materials.name;
    } else if (bom.lace_master) {
      materialId = bom.laceId || '';
      materialCode = bom.lace_master.laceCode;
      materialName = bom.lace_master.laceName;
    } else if (bom.button_master) {
      materialId = bom.buttonId || '';
      materialCode = bom.button_master.buttonCode;
      materialName = bom.button_master.buttonName;
    } else if (bom.thread_master) {
      materialId = bom.threadId || '';
      materialCode = bom.thread_master.threadCode;
      materialName = bom.thread_master.threadName;
    } else if (bom.zipper_master) {
      materialId = bom.zipperId || '';
      materialCode = bom.zipper_master.zipperCode;
      materialName = bom.zipper_master.zipperName;
    } else if (bom.elastic_master) {
      materialId = bom.elasticId || '';
      materialCode = bom.elastic_master.elasticCode;
      materialName = bom.elastic_master.elasticName;
    } else if (bom.label_master) {
      materialId = bom.labelId || '';
      materialCode = bom.label_master.labelCode;
      materialName = bom.label_master.labelName;
    } else if (bom.packaging_master) {
      materialId = bom.packagingId || '';
      materialCode = bom.packaging_master.packagingCode;
      materialName = bom.packaging_master.packagingName;
    }

    // Query actual stock from stock_levels table
    const availableStock = await getAvailableStock(materialId);
    const shortfall = totalRequired - availableStock;

    requirements.push({
      materialId,
      materialCode: materialCode || bom.componentName || 'UNKNOWN',
      materialName: materialName || bom.componentName || 'Unknown Material',
      materialType: bom.materialType,
      requiredQuantity: totalRequired,
      unit: bom.unit,
      availableStock,
      shortfall,
      usedInStyles: [style.styleCode],
    });
  }

  // Fallback: Also process style_garment_trims for legacy data (if no BOM entries)
  if (style.style_material_bom.length === 0) {
    for (const trim of style.style_garment_trims) {
      const quantityPerPiece = Number(trim.quantityPerPiece);
      const totalRequired = quantityPerPiece * orderQuantity;

      // Try to find matching material by name
      const material = await prisma.materials.findFirst({
        where: {
          OR: [
            { code: { contains: trim.trimName, mode: 'insensitive' } },
            { name: { contains: trim.trimName, mode: 'insensitive' } },
          ],
        },
      });

      const materialId = material?.id || '';
      const availableStock = await getAvailableStock(materialId);
      const shortfall = totalRequired - availableStock;

      requirements.push({
        materialId,
        materialCode: material?.code || trim.trimName,
        materialName: material?.name || trim.trimName,
        materialType: trim.trimType,
        requiredQuantity: totalRequired,
        unit: trim.unit,
        availableStock,
        shortfall,
        usedInStyles: [style.styleCode],
      });
    }
  }

  return requirements;
}

/**
 * Get all styles that use a specific material
 * Searches both style_material_bom and style_garment_trims
 */
export async function getStylesUsingMaterial(
  materialCode: string
): Promise<StyleRequirement[]> {
  // First, try to find the material by code
  const material = await prisma.materials.findFirst({
    where: { code: { equals: materialCode, mode: 'insensitive' } },
  });

  // Search in style_material_bom (preferred - proper linking)
  const stylesWithBom = material
    ? await prisma.styles.findMany({
        where: {
          style_material_bom: {
            some: { materialId: material.id, isActive: true },
          },
          isActive: true,
        },
        include: {
          style_material_bom: {
            where: { materialId: material.id, isActive: true },
            include: { materials: true },
          },
        },
      })
    : [];

  // Also search in style_garment_trims by trimName (fallback for legacy)
  const stylesWithTrims = await prisma.styles.findMany({
    where: {
      style_garment_trims: {
        some: {
          trimName: { contains: materialCode, mode: 'insensitive' },
        },
      },
      isActive: true,
    },
    include: {
      style_garment_trims: {
        where: {
          trimName: { contains: materialCode, mode: 'insensitive' },
        },
      },
    },
  });

  // Combine results (deduplicate by styleId)
  const styleMap = new Map<string, StyleRequirement>();

  // Add BOM-based styles
  for (const style of stylesWithBom) {
    styleMap.set(style.id, {
      styleId: style.id,
      styleCode: style.styleCode,
      styleName: style.styleName,
      orderQuantity: 0,
      materials: style.style_material_bom.map((bom) => ({
        materialCode: bom.materials?.code || materialCode,
        materialName: bom.materials?.name || bom.componentName || 'Unknown',
        quantityPerPiece: Number(bom.quantityPerGarment),
        totalRequired: 0,
        unit: bom.unit,
      })),
    });
  }

  // Add trim-based styles (if not already present)
  for (const style of stylesWithTrims) {
    if (!styleMap.has(style.id)) {
      styleMap.set(style.id, {
        styleId: style.id,
        styleCode: style.styleCode,
        styleName: style.styleName,
        orderQuantity: 0,
        materials: style.style_garment_trims.map((trim) => ({
          materialCode: trim.trimName,
          materialName: trim.trimName,
          quantityPerPiece: Number(trim.quantityPerPiece),
          totalRequired: 0,
          unit: trim.unit,
        })),
      });
    }
  }

  return Array.from(styleMap.values());
}

/**
 * Calculate aggregate material requirements for multiple orders
 * Useful for bulk production planning
 */
export async function calculateBulkRequirements(
  orders: Array<{ styleId: string; quantity: number }>
): Promise<MaterialRequirement[]> {
  const allRequirements: Map<string, MaterialRequirement> = new Map();

  for (const order of orders) {
    const styleRequirements = await calculateMaterialRequirement(
      order.styleId,
      order.quantity
    );

    // Aggregate by material code
    for (const req of styleRequirements) {
      const existing = allRequirements.get(req.materialCode);
      if (existing) {
        existing.requiredQuantity += req.requiredQuantity;
        existing.shortfall += req.shortfall;
        if (!existing.usedInStyles.includes(req.usedInStyles[0])) {
          existing.usedInStyles.push(req.usedInStyles[0]);
        }
      } else {
        allRequirements.set(req.materialCode, { ...req });
      }
    }
  }

  return Array.from(allRequirements.values());
}

/**
 * Check if sufficient materials are available for an order
 * Returns materials that are in shortage
 */
export async function checkMaterialAvailability(
  styleId: string,
  orderQuantity: number
): Promise<{ canFulfill: boolean; shortages: MaterialRequirement[] }> {
  const requirements = await calculateMaterialRequirement(styleId, orderQuantity);
  const shortages = requirements.filter((req) => req.shortfall > 0);

  return {
    canFulfill: shortages.length === 0,
    shortages,
  };
}
