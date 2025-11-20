// Fabric & Greige Management Types

export interface GreigeMaster {
  id: string;
  greigeCode: string;
  greigeName: string;
  yarnCount?: string;
  construction?: string;
  composition: string;
  weaveType?: string;
  greigeWidth: number;
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
  supplier?: {
    id: string;
    code: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    isActive: boolean;
  };
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
  greigeId: string;
  colorName?: string;
  colorCode?: string;
  finishType?: string;
  finishProcess?: string;
  printDesign?: string;
  actualWidth: number;
  actualGSM?: number;
  actualShrinkage?: number;
  supplierId?: string;
  costPerMeter: number;
  moq?: number;
  leadTimeDays?: number;
  description?: string;
  notes?: string;
  imageUrl?: string;
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
  yarnCount?: string;
  construction?: string;
  composition: string;
  weaveType?: string;
  greigeWidth: number;
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
  greigeId: string;
  colorName?: string;
  colorCode?: string;
  finishType?: string;
  finishProcess?: string;
  printDesign?: string;
  actualWidth: number;
  actualGSM?: number;
  actualShrinkage?: number;
  description?: string;
  notes?: string;
  imageUrl?: string;
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
