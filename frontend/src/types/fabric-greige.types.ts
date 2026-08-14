// Fabric & Greige Management Types

export interface GreigeMaster {
  id: string;
  greigeCode: string;
  greigeName: string;
  genericGreigeName?: string; // Stored separately: "Cambric", "Cotton Poplin", etc.
  yarnCount?: string;
  construction?: string;
  composition: string;
  weaveType?: string;
  greigeQuality?: 'PRINTING' | 'DYEING' | 'SUPER_DYEING';
  weaver?: string;
  greigeWidth: number;
  defaultCutableWidth?: number; // Default finished/cutable width for CAD planning
  expectedFinishedWidthMin?: number;
  expectedFinishedWidthMax?: number;
  /** MRP-48: fallback only — the processor rate card is the source of truth for shrinkage. */
  averageShrinkagePercent?: number;
  supplierId?: string;
  gsmRange?: string;
  costPerMeter?: number;
  moq?: number;
  leadTimeDays?: number;
  description?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  // Note: Prisma relation `suppliers` is renamed to `supplier` by the serializer (RELATION_MAPPINGS singular rename)
  supplier?: Array<{
    supplier: {
      id: string;
      code: string;
      name: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      isActive: boolean;
    };
    isPreferred: boolean;
    isActive: boolean;
    notes?: string;
  }>;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  finishedFabrics?: FabricMaster[];
  _count?: {
    finishedFabrics: number;
  };
}

export interface FabricMaster {
  id: string;
  fabricCode: string;
  fabricName: string;
  greigeId?: string; // Optional for stock/generic fabrics
  greigeName?: string; // Direct griege name text field
  genericGreigeName?: string; // Simplified fabric type: "Cambric", "Poplin", etc.
  yarnCount?: string; // e.g., "40x40"
  composition?: string; // e.g., "98% Polyester 2% Elastane"
  colorName?: string;
  colorCode?: string;
  finishType?: string;
  printDesign?: string;
  actualWidth: number;
  cutableWidth?: number; // Usable width (default: actualWidth - 2")
  finishedConstruction?: string; // Post-processing construction
  actualGSM?: number;
  valueAddition?: string; // e.g., "Embroidery", "Special Wash"
  valueAdditionCost?: number;
  styleReference?: string; // Links to specific style if style-specific
  source?: string; // STYLE_LINKED or STOCK
  supplierId?: string;
  costPerMeter: number;
  moq?: number;
  leadTimeDays?: number;
  description?: string;
  notes?: string;
  imageUrl?: string;
  isGeneric: boolean; // Can be used across styles
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  greige?: GreigeMaster;
  // The serializer maps the `suppliers` junction ARRAY -> `supplier` (serializer.ts:256), so at
  // runtime this is the array of supplier links, NOT a single supplier. It was typed as a single
  // object, so the edit form read `fabric.suppliers` (undefined) and silently wiped links on save
  // (bug-hunt BH-0207).
  supplier?: Array<{
    supplier: {
      id: string;
      code: string;
      name: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      isActive: boolean;
    };
    isPreferred: boolean;
    isActive: boolean;
    notes?: string;
  }>;
  suppliers?: Array<{
    supplier: {
      id: string;
      code: string;
      name: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      isActive: boolean;
    };
    isPreferred: boolean;
    isActive: boolean;
    notes?: string;
  }>;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  widthCADs?: FabricWidthCAD[];
  // Style fabric allocations (for fabric list view)
  // Note: Serializer renames: styleFabrics -> fabrics, style_components -> components
  fabrics?: Array<{
    id: string;
    genericGreigeName?: string;
    // Note: style_components -> styleComponents -> components (via RELATION_MAPPINGS)
    components: {
      id: string;
      componentName: string;
      componentType: string;
      // Note: styles -> style (via RELATION_MAPPINGS singular rename)
      style: {
        id: string;
        styleCode: string;
        buyerStyleRef?: string | null;
        styleName: string;
      };
    };
    // Note: stylePatternParts stays as-is (no mapping defined)
    stylePatternParts: Array<{
      id: string;
      quantity: number;
      goesToEmbroidery?: boolean;
      patternPart: {
        id: string;
        code: string;
        name: string;
      };
    }>;
  }>;
  // Note: the serializer now preserves Prisma's `_count` key verbatim and does NOT
  // remap its inner relation keys, so read `_count.styleFabrics` (not `count.fabrics`).
  _count?: {
    widthCADs: number;
    styleFabrics?: number; // preserved as-is inside _count (no styleFabrics->fabrics remap)
  };
}

export interface FabricWidthCAD {
  id: string;
  fabricId: string;
  cutableWidth: number; // backend column name (fabric_width_cad.cutableWidth); was mis-aliased as availableWidth
  widthUnit: string;
  cadMeters?: number;
  cadYards?: number;
  cadWastagePercent: number;
  markerEfficiency?: number;
  isPreferred: boolean;
  supplierAvailability?: 'always' | 'limited' | 'rare';
  priceDifferential?: number;
  markerPlanFile?: string;
  markerLengthMeters?: number;
  piecesPerMarker?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  fabric?: FabricMaster;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface CostComparisonOption {
  width: number;
  isPreferred: boolean;
  cadMeters: number;
  cadYards: number;
  wastagePercent: number;
  markerEfficiency: number;
  costPerMeter: number;
  priceDifferential: number;
  costPerGarment: number;
  totalFabricRequired: number;
  totalCost: number;
  supplierAvailability?: string;
  notes?: string;
}

export interface CostComparison {
  fabric: {
    id: string;
    fabricCode: string;
    fabricName: string;
    baseCostPerMeter: number;
  };
  orderQuantity: number;
  options: CostComparisonOption[];
  bestOption: {
    width: number;
    savings: number;
  };
}

export interface GreigeStatistics {
  totalGreige: number;
  activeGreige: number;
  inactiveGreige: number;
  byComposition: Array<{ composition: string; count: number }>;
  byWeaveType: Array<{ weaveType: string; count: number }>;
}

export interface FabricStatistics {
  totalFabrics: number;
  activeFabrics: number;
  inactiveFabrics: number;
  averageShrinkagePercent?: number;
  byFinishType: Array<{ finishType: string; count: number }>;
  byColor: Array<{ colorName: string; count: number }>;
}

export interface CADStatistics {
  totalCADEntries: number;
  averageMarkerEfficiency?: number;
  commonWidths: Array<{ width: number; count: number }>;
}

// Supplier relationship types
export interface SupplierRelationship {
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string;
}

// Form types for creating/updating
export interface GreigeMasterFormData {
  greigeCode: string;
  greigeName: string;
  genericGreigeName?: string;
  yarnCount?: string;
  construction?: string;
  composition: string;
  weaveType?: string;
  greigeQuality?: 'PRINTING' | 'DYEING' | 'SUPER_DYEING';
  weaver?: string;
  greigeWidth: number;
  defaultCutableWidth?: number; // Default finished/cutable width for CAD planning
  expectedFinishedWidthMin?: number;
  expectedFinishedWidthMax?: number;
  /** MRP-48: fallback only — the processor rate card is the source of truth for shrinkage. */
  averageShrinkagePercent?: number;
  gsmRange?: string;
  description?: string;
  notes?: string;
  isActive: boolean;
  suppliers: SupplierRelationship[];
}

// API payload for fabric create/update. The form sanitizes optional text fields
// from '' to null before sending (backend Zod accepts null/undefined, not '').
// FabricMasterFormData is assignable to this type.
export type FabricMasterSavePayload = {
  [K in keyof FabricMasterFormData]: FabricMasterFormData[K] | null;
};

export interface FabricMasterFormData {
  fabricCode: string;
  fabricName: string;
  greigeId?: string; // Optional for stock/generic fabrics
  greigeName?: string; // Direct griege name text field
  genericGreigeName?: string;
  yarnCount?: string;
  composition?: string;
  colorName?: string;
  colorCode?: string;
  finishType?: string;
  printDesign?: string;
  actualWidth: number;
  cutableWidth?: number;
  finishedConstruction?: string;
  actualGSM?: number;
  valueAddition?: string;
  valueAdditionCost?: number;
  styleReference?: string;
  source?: string;
  description?: string;
  notes?: string;
  imageUrl?: string;
  isGeneric: boolean;
  isActive: boolean;
  suppliers: SupplierRelationship[];
}

export interface FabricWidthCADFormData {
  fabricId: string;
  cutableWidth: number;
  widthUnit: string;
  cadMeters?: number;
  cadYards?: number;
  cadWastagePercent: number;
  markerEfficiency?: number;
  isPreferred: boolean;
  supplierAvailability?: 'always' | 'limited' | 'rare';
  priceDifferential?: number;
  markerPlanFile?: string;
  markerLengthMeters?: number;
  piecesPerMarker?: number;
  notes?: string;
}

// Fabric Stock types
export interface FabricStock {
  id: string;
  fabricId: string;
  width: number;
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  unit: string;
  procurementId?: string;
  originStyleId?: string;
  originOrderId?: string;
  status: 'AVAILABLE' | 'RESERVED' | 'DEPLETED' | 'QUARANTINED';
  stockType: 'EXCESS' | 'PLANNED_STOCK' | 'GENERIC' | 'RETURNED' | 'VARIANCE_UNUSED';
  weightedAvgCost?: number;
  purchaseCost?: number;
  qualityGrade: 'A' | 'B' | 'DEFECT';
  defectValue?: number;
  rollNumbers?: string;
  warehouseLocation?: string;
  rackNumber?: string;
  receivedDate: string;
  agingDays?: number;
  agingAlertSent: boolean;
  needsEmbroidery?: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  fabric?: FabricMaster;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface FabricStockEntry {
  fabricId: string;
  quantity: number;
  width: number;
  purchaseCost?: number;
  receivedDate: string;
  warehouseLocation?: string;
  rackNumber?: string;
  rollNumbers?: string;
  qualityGrade: 'A' | 'B' | 'DEFECT';
  stockType?: 'EXCESS' | 'PLANNED_STOCK' | 'GENERIC' | 'RETURNED' | 'VARIANCE_UNUSED';
  notes?: string;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// FABRIC STYLE ALLOCATION TYPES
// ============================================

export interface FabricStyleAllocation {
  id: string;
  fabricId: string;
  componentId: string;
  notes?: string;
  createdAt: string;
  component: {
    id: string;
    componentName: string;
    componentCode: string;
    style: {
      id: string;
      styleCode: string;
      buyerStyleRef?: string | null;
      styleName: string;
      isActive?: boolean;
    } | null;
  };
  patternParts: Array<{
    id: string;
    patternPartId: string;
    quantity: number;
    goesToEmbroidery?: boolean;
    patternPart: {
      id: string;
      code: string;
      name: string;
    };
  }>;
}

export interface FabricStyleAllocationsResponse {
  fabricId: string;
  fabricCode: string;
  fabricName: string;
  allocations: FabricStyleAllocation[];
  totalAllocations: number;
}

export interface AllocateToStyleRequest {
  componentId?: string; // Single component (legacy)
  componentIds?: string[]; // Multiple components (new)
  patternPartIds?: string[];
  hasEmbroidery?: boolean;
  embroideryId?: string;
  notes?: string;
}

export interface AllocateToStyleResponse {
  message: string;
  allocation?: FabricStyleAllocation; // Single allocation (legacy)
  allocations?: FabricStyleAllocation[]; // Multiple allocations (new)
}

export interface RemoveAllocationResponse {
  message: string;
  removedAllocation: {
    id: string;
    styleCode?: string;
    styleName?: string;
    componentName?: string;
  };
}

// For the allocation modal - styles with their components
export interface StyleForAllocation {
  id: string;
  styleCode: string;
  styleName: string;
  isActive: boolean;
  components: Array<{
    id: string;
    componentName: string;
    componentCode: string;
    componentMaster?: {
      id: string;
      code: string;
      name: string;
    };
  }>;
}

// Pattern part for selection
export interface PatternPartForAllocation {
  id: string;
  code: string;
  name: string;
  goesToEmbroidery?: boolean;
}
