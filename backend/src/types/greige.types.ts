/**
 * Greige Types
 * Type definitions for greige-related operations
 */

import { GreigeQuality } from '@prisma/client';

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
  genericGreigeName?: string | null;
  yarnCount?: string | null;
  construction?: string | null;
  composition: string;
  weaveType?: string | null;
  greigeWidth: number | null;
  defaultCutableWidth: number | null;
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
  genericGreigeName?: string | null;
  yarnCount?: string | null;
  construction?: string | null;
  composition: string;
  weaveType?: string | null;
  greigeWidth: { toNumber: () => number } | number | null;
  defaultCutableWidth?: { toNumber: () => number } | number | null;
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
 * Prisma where clause for greige queries.
 *
 * Deliberately has NO `AND` member: applySearch() writes where.AND through its own cast
 * (search-filter.ts) so this hand-rolled interface stays assignable to Prisma's
 * greige_masterWhereInput. Adding `AND?: unknown[]` here BREAKS that assignability and the
 * count()/findMany() calls stop type-checking.
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
  // Multi-select facets resolve to `{ in: [...] }`; the scalar forms are kept so any existing
  // single-value caller still type-checks.
  weaveType?: string | { in: string[] };
  genericGreigeName?: string | { in: string[] };
  greigeQuality?: GreigeQuality | { in: GreigeQuality[] };
  // Decimal(10,2) / Decimal(5,2) columns. Prisma's DecimalFilter accepts a plain JS number for
  // gte/lte, so no Prisma.Decimal wrapping is required.
  greigeWidth?: { gte?: number; lte?: number };
  averageShrinkagePercent?: { gte?: number; lte?: number };
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
  genericGreigeName?: string | null;
  yarnCount?: string | null;
  construction?: string | null;
  composition?: string;
  weaveType?: string | null;
  greigeQuality?: GreigeQuality | null;
  weaver?: string | null;
  greigeWidth?: number;
  defaultCutableWidth?: number | null;
  expectedFinishedWidthMin?: number | null;
  expectedFinishedWidthMax?: number | null;
  averageShrinkagePercent?: number | null;
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
