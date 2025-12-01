/**
 * Fabric Types
 * Type definitions for fabric-related operations
 */

// ============================================
// Supplier Types for Fabric
// ============================================

/**
 * Supplier input for fabric creation/update
 */
export interface FabricSupplierInput {
  supplierId: string;
  unitPrice?: number | string | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  isPreferred?: boolean;
}

// ============================================
// Fabric Master Types
// ============================================

/**
 * Create fabric master request
 */
export interface CreateFabricMasterRequest {
  fabricCode: string;
  fabricName: string;
  greigeId?: string | null;
  genericFabricName?: string | null;
  colorName?: string | null;
  colorCode?: string | null;
  finishType?: string | null;
  printDesign?: string | null;
  actualWidth?: number | string | null;
  cutableWidth?: number | string | null;
  finishedConstruction?: string | null;
  actualGSM?: number | null;
  valueAddition?: string | null;
  valueAdditionCost?: number | string | null;
  costPerMeter?: number | string | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  supplierId?: string | null;
  description?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  styleReference?: string | null;
  isGeneric?: boolean;
  componentType?: string | null;
  suppliers?: FabricSupplierInput[];
}

/**
 * Update fabric master request
 */
export interface UpdateFabricMasterRequest extends Partial<CreateFabricMasterRequest> {}

// ============================================
// Query Types
// ============================================

/**
 * Fabric query filters
 */
export interface FabricQueryFilters {
  page?: string | number;
  limit?: string | number;
  search?: string;
  greigeId?: string;
  supplierId?: string;
  isActive?: string;
  colorName?: string;
  finishType?: string;
}

/**
 * Prisma where clause for fabric queries
 */
export interface FabricWhereClause {
  isActive?: boolean;
  OR?: Array<Record<string, { contains: string; mode: 'insensitive' }>>;
  greigeId?: string;
  suppliers?: {
    some: {
      supplierId: string;
      isActive: boolean;
    };
  };
  colorName?: { contains: string; mode: 'insensitive' };
  finishType?: string;
}

// ============================================
// Fabric Update Data
// ============================================

/**
 * Fabric update data structure for Prisma
 */
export interface FabricUpdateData {
  fabricCode?: string;
  fabricName?: string;
  greigeId?: string | null;
  genericFabricName?: string | null;
  colorName?: string | null;
  colorCode?: string | null;
  finishType?: string | null;
  printDesign?: string | null;
  actualWidth?: number | null;
  cutableWidth?: number | null;
  finishedConstruction?: string | null;
  actualGSM?: number | null;
  valueAddition?: string | null;
  valueAdditionCost?: number | null;
  costPerMeter?: number | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  supplierId?: string | null;
  description?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  styleReference?: string | null;
  isGeneric?: boolean;
  componentType?: string | null;
}

// ============================================
// Error Types
// ============================================

/**
 * Prisma error with code and meta
 */
export interface PrismaErrorWithMeta extends Error {
  code?: string;
  meta?: {
    target?: string[];
    [key: string]: unknown;
  };
}
