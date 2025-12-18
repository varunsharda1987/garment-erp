// Fabric & Greige Management Types

export interface GreigeMaster {
  id: string;
  greigeCode: string;
  greigeName: string;
  genericFabricName?: string; // Stored separately: "Cambric", "Cotton Poplin", etc.
  yarnCount?: string;
  construction?: string;
  composition: string;
  weaveType?: string;
  greigeWidth: number;
  defaultCutableWidth?: number; // Default finished/cutable width for CAD planning
  expectedFinishedWidthMin?: number;
  expectedFinishedWidthMax?: number;
  averageShrinkagePercent: number;
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
  genericFabricName?: string; // Simplified fabric type: "Cambric", "Poplin", etc.
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
  componentType?: string; // BODY, SLEEVE, COLLAR, etc.
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
  supplier?: {
    id: string;
    code: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    isActive: boolean;
  };
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
  _count?: {
    widthCADs: number;
  };
}

export interface FabricWidthCAD {
  id: string;
  fabricId: string;
  availableWidth: number;
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
  genericFabricName?: string;
  yarnCount?: string;
  construction?: string;
  composition: string;
  weaveType?: string;
  greigeWidth: number;
  defaultCutableWidth?: number; // Default finished/cutable width for CAD planning
  expectedFinishedWidthMin?: number;
  expectedFinishedWidthMax?: number;
  averageShrinkagePercent: number;
  gsmRange?: string;
  description?: string;
  notes?: string;
  isActive: boolean;
  suppliers: SupplierRelationship[];
}

export interface FabricMasterFormData {
  fabricCode: string;
  fabricName: string;
  greigeId?: string; // Optional for stock/generic fabrics
  genericFabricName?: string;
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
  componentType?: string;
  description?: string;
  notes?: string;
  imageUrl?: string;
  isGeneric: boolean;
  isActive: boolean;
  suppliers: SupplierRelationship[];
}

export interface FabricWidthCADFormData {
  fabricId: string;
  availableWidth: number;
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
