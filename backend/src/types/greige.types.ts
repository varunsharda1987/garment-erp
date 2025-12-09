/**
 * Greige Types
 * Type definitions for greige-related operations
 */

// ============================================
// Greige Master Types
// ============================================

/**
 * Greige master data with Decimal fields converted to numbers
 */
export interface SerializedGreige {
  id: string;
  greigeCode: string;
  greigeName: string;
  genericFabricName?: string | null;
  yarnCount?: string | null;
  construction?: string | null;
  composition: string;
  weaveType?: string | null;
  greigeWidth: number | null;
  expectedFinishedWidthMin: number | null;
  expectedFinishedWidthMax: number | null;
  averageShrinkagePercent: number | null;
  gsmRange?: string | null;
  costPerMeter?: number | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  supplierId?: string | null;
  description?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

/**
 * Raw greige data from Prisma with Decimal types
 */
export interface RawGreigeData {
  id: string;
  greigeCode: string;
  greigeName: string;
  genericFabricName?: string | null;
  yarnCount?: string | null;
  construction?: string | null;
  composition: string;
  weaveType?: string | null;
  greigeWidth: { toNumber: () => number } | number | null;
  expectedFinishedWidthMin: { toNumber: () => number } | number | null;
  expectedFinishedWidthMax: { toNumber: () => number } | number | null;
  averageShrinkagePercent: { toNumber: () => number } | number | null;
  gsmRange?: string | null;
  costPerMeter?: { toNumber: () => number } | number | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  supplierId?: string | null;
  description?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

// ============================================
// Supplier Types for Greige
// ============================================

/**
 * Supplier input for greige creation/update
 */
export interface GreigeSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string | null;
}

// ============================================
// Query Types
// ============================================

/**
 * Prisma where clause for greige queries
 */
export interface GreigeWhereClause {
  isActive?: boolean;
  OR?: Array<Record<string, { contains: string; mode: 'insensitive' }>>;
  suppliers?: {
    some: {
      supplierId: string;
      isActive: boolean;
    };
  };
  composition?: { contains: string; mode: 'insensitive' };
  weaveType?: string;
}

// ============================================
// Update Data Types
// ============================================

/**
 * Greige update data structure for Prisma
 */
export interface GreigeUpdateData {
  greigeCode?: string;
  greigeName?: string;
  genericFabricName?: string | null;
  yarnCount?: string | null;
  construction?: string | null;
  composition?: string;
  weaveType?: string | null;
  greigeWidth?: number;
  expectedFinishedWidthMin?: number | null;
  expectedFinishedWidthMax?: number | null;
  averageShrinkagePercent?: number;
  gsmRange?: string | null;
  costPerMeter?: number | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  supplierId?: string | null;
  description?: string | null;
  notes?: string | null;
  isActive?: boolean;
  suppliers?: {
    create: Array<{
      supplierId: string;
      isPreferred: boolean;
      isActive: boolean;
      notes: string | null;
    }>;
  };
}
