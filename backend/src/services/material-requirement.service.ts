/**
 * Material Requirement Planning (MRP) Service
 * Calculates material requirements for production orders
 * and checks against available inventory
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import { logWarn } from '../utils/logger';

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
  if (!materialId) {
    logWarn(
      '[MRP] getAvailableStock called with empty materialId — BOM item has no linked material record. Stock will be reported as 0, but this indicates incomplete BOM data that should be fixed at the source.'
    );
    return 0;
  }

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

    if (!materialId) {
      logWarn(
        `[MRP] BOM item '${bom.componentName || bom.id}' for style '${style.styleCode}' has no linked material record. This item will have 0 available stock. Fix the BOM data to link a material master.`
      );
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

  return requirements;
}

/**
 * Get all styles that use a specific material
 * Searches style_material_bom for material references
 */
export async function getStylesUsingMaterial(materialCode: string): Promise<StyleRequirement[]> {
  // First, try to find the material by code
  const material = await prisma.materials.findFirst({
    where: { code: { equals: materialCode, mode: 'insensitive' } },
  });

  // Search in style_material_bom
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

  // Map results
  const results: StyleRequirement[] = stylesWithBom.map((style) => ({
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
  }));

  return results;
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
    const styleRequirements = await calculateMaterialRequirement(order.styleId, order.quantity);

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
