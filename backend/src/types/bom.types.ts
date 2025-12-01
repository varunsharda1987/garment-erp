/**
 * BOM (Bill of Materials) Types
 * Type definitions for BOM-related operations
 */

import { Unit } from '@prisma/client';

// ============================================
// BOM Item Types
// ============================================

/**
 * BOM item input from request
 */
export interface BOMItemInput {
  materialId: string;
  quantityPerUnit: number;
  unit: Unit;
  wastagePercent: number;
  costPerUnit: number;
  notes?: string;
}

/**
 * BOM item for creation
 */
export interface BOMItemCreate {
  id?: string;
  materialId: string;
  quantityPerUnit: number;
  unit: Unit;
  wastagePercent: number;
  costPerUnit: number;
  notes?: string;
}

// ============================================
// Query Types
// ============================================

/**
 * BOM query where clause
 */
export interface BOMWhereClause {
  styleId?: string;
  isActive?: boolean;
  approvedById?: { not: null } | null;
  OR?: Array<{
    styles?: {
      styleCode?: { contains: string; mode: 'insensitive' };
      styleName?: { contains: string; mode: 'insensitive' };
    };
  }>;
}

// ============================================
// BOM Item with Relations
// ============================================

/**
 * BOM item from database with material relation
 */
export interface BOMItemWithMaterial {
  id: string;
  bomId: string;
  materialId: string;
  quantityPerUnit: { toNumber?: () => number } | number;
  unit: Unit;
  wastagePercent: { toNumber?: () => number } | number;
  costPerUnit: { toNumber?: () => number } | number;
  notes?: string | null;
  materials: {
    id: string;
    code: string;
    name: string;
    unit: Unit;
    reorderLevel?: { toNumber?: () => number } | number | null;
    [key: string]: unknown;
  };
}

// ============================================
// Calculation Types
// ============================================

/**
 * Material requirement calculation result
 */
export interface MaterialRequirement {
  material: unknown;
  quantityPerUnit: number;
  unit: Unit;
  wastagePercent: number;
  costPerUnit: number;
  baseQuantity: number;
  wastageQuantity: number;
  totalQuantity: number;
  totalCost: number;
}
