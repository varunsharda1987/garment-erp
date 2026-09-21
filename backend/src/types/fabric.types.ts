/**
 * Fabric Types
 * Type definitions for fabric-related operations
 */
import { FabricFinishType } from '@prisma/client';

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
  greigeName?: string | null;
  genericGreigeName?: string | null;
  colorName?: string | null;
  colorCode?: string | null;
  finishType?: FabricFinishType | null;
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
  suppliers?: FabricSupplierInput[];
}

/**
 * Update fabric master request
 */
export interface UpdateFabricMasterRequest extends Partial<CreateFabricMasterRequest> {}

// ============================================
// Query Types
// ============================================

// FabricQueryFilters deleted: it had zero importers, and z.infer<typeof fabricQuerySchema>
// (FabricQueryInput) is now the single source of truth for this endpoint's params.

/**
 * Prisma where clause for fabric queries.
 * No `AND` member on purpose — see the note on GreigeWhereClause (greige.types.ts).
 */
export interface FabricWhereClause {
  isActive?: boolean;
  isGeneric?: boolean;
  OR?: Array<Record<string, { contains: string; mode: 'insensitive' }>>;
  greigeId?: string;
  suppliers?: {
    some: {
      supplierId: string;
      isActive: boolean;
    };
  };
  // colorName moved from a single `contains` to an exact multi-select `in` — the values now come
  // from /fabric/filter-options. Substring colour search is still served by `search`.
  colorName?: { contains: string; mode: 'insensitive' } | { in: string[] };
  finishType?: FabricFinishType | { in: FabricFinishType[] };
  genericGreigeName?: string | { in: string[] };
  source?: string | { in: string[] };
  actualGSM?: { gte?: number; lte?: number }; // Int column
  actualWidth?: { gte?: number; lte?: number }; // Decimal(10,2)
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
  greigeName?: string | null;
  genericGreigeName?: string | null;
  colorName?: string | null;
  colorCode?: string | null;
  finishType?: FabricFinishType | null;
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
}

// ============================================
// Fabric Stock Types
// ============================================

/**
 * Fabric stock data for CAD planning
 * Used when selecting stock to link to CAD rows
 */
export interface FabricStockForCAD {
  id: string;
  fabricId: string;
  fabricName: string;
  fabricCode: string;
  colorName?: string;
  greigeId: string;
  greigeName: string;
  finishedWidth: number;
  cutableWidth: number;
  quantityAvailable: number;
  qualityGrade: 'A' | 'B' | 'DEFECT';
  rollNumbers?: string;
  receivedDate: string;
  procurementId?: string;
  originStyleId?: string;
  originOrderId?: string;
  status: string;
  // Embroidery fields for filtering and display
  embroideryId?: string | null;
  embroideryCode?: string | null;
  embroideryName?: string | null;
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
