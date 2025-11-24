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
 * Calculate material requirements for a production order
 * @param styleId - Style ID
 * @param orderQuantity - Number of pieces to produce
 */
export async function calculateMaterialRequirement(
  styleId: string,
  orderQuantity: number
): Promise<MaterialRequirement[]> {
  // Get style with garment trims
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    include: {
      style_garment_trims: true,
    },
  });

  if (!style) {
    throw new Error('Style not found');
  }

  const requirements: MaterialRequirement[] = [];

  // Calculate requirements from garment trims
  for (const trim of style.style_garment_trims) {
    const quantityPerPiece = Number(trim.quantityPerPiece);
    const totalRequired = quantityPerPiece * orderQuantity;

    // TODO: Query actual stock from inventory_stock or stock_levels table
    // For now, we'll return 0 as available stock
    const availableStock = 0;
    const shortfall = totalRequired - availableStock;

    requirements.push({
      materialId: '', // TODO: Get from materials table
      materialCode: trim.trimName, // Using trim name as code for now
      materialName: trim.trimName,
      materialType: trim.trimType,
      requiredQuantity: totalRequired,
      unit: trim.unit,
      availableStock,
      shortfall,
      usedInStyles: [style.styleCode],
    });
  }

  return requirements;
}

/**
 * Get all styles that use a specific material
 * Useful for answering: "Which styles use LACE-0001?"
 */
export async function getStylesUsingMaterial(
  materialCode: string
): Promise<StyleRequirement[]> {
  // Search in style_garment_trims by trimName
  // TODO: This should be improved once we link to materials table properly
  const stylesWithTrims = await prisma.styles.findMany({
    where: {
      style_garment_trims: {
        some: {
          trimName: {
            contains: materialCode,
            mode: 'insensitive',
          },
        },
      },
      isActive: true,
    },
    include: {
      style_garment_trims: {
        where: {
          trimName: {
            contains: materialCode,
            mode: 'insensitive',
          },
        },
      },
    },
  });

  return stylesWithTrims.map((style) => ({
    styleId: style.id,
    styleCode: style.styleCode,
    styleName: style.styleName,
    orderQuantity: 0, // Default, will be filled when actual order is created
    materials: style.style_garment_trims.map((trim) => ({
      materialCode: trim.trimName,
      materialName: trim.trimName,
      quantityPerPiece: Number(trim.quantityPerPiece),
      totalRequired: 0,
      unit: trim.unit,
    })),
  }));
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
