// Style CAD Planning Types
// For CAD approval workflow and fabric width selection

export enum CADStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
}

export enum ProductionMethod {
  DYED_ONLY = 'DYED_ONLY',
  PRINTED_ONLY = 'PRINTED_ONLY',
  MIXED = 'MIXED',
  // Component-level options
  DYED = 'DYED',
  PRINTED = 'PRINTED',
}

export interface CADOption {
  cadId: string;
  fabricId: string;
  fabricName: string;
  greigeId: string;
  greigeName: string;
  availableWidth: number; // inches
  widthUnit: string;
  cadMeters: number;
  cadYards?: number;
  cadWastagePercent: number;
  markerEfficiency?: number;
  isPreferred: boolean;
  supplierAvailability?: string;
  priceDifferential?: number;
  // Cost calculation fields
  fabricRate?: number; // Rate per meter/yard
  totalFabricCost?: number; // Calculated: (CAD × (1 + wastage%)) × Rate
  notes?: string;
}

export interface GenerateCADOptionsDTO {
  styleId: string;
  genericFabricName: string;
  greigeId: string;
  widths?: number[]; // Optional: specific widths to generate, defaults to common widths
}

export interface CADCostCalculationDTO {
  cadId: string;
  fabricRate: number; // Rate per unit (meter or yard)
  unit?: 'meters' | 'yards'; // Defaults to meters
}

export interface CADCostResult {
  cadId: string;
  availableWidth: number;
  cadConsumption: number;
  wastagePercent: number;
  effectiveConsumption: number;  // cadConsumption × (1 + wastage%)
  fabricRate: number;
  totalCost: number;
  costPerMeter?: number;
  unit: string;
}

export interface ApproveCADDTO {
  styleId: string;
  cadId: string;
  fabricId: string;
  approvalNotes?: string;
}

export interface StyleCADSummary {
  styleId: string;
  styleCode: string;
  styleName: string;
  customerName: string;
  brandName: string;
  imageUrl?: string;
  cadStatus: CADStatus;
  components: ComponentCADSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface ComponentCADSummary {
  componentId: string;
  componentName: string;
  productionMethod?: ProductionMethod;
  fabrics: FabricCADSummary[];
}

export interface FabricCADSummary {
  fabricId: string;
  genericFabricName: string;
  productionMethod?: ProductionMethod;
  cadStatus: 'PENDING' | 'OPTIONS_GENERATED' | 'APPROVED';
  approvedCADId?: string;
  approvedWidth?: number;
  approvedCost?: number;
  availableOptions: number; // Count of CAD options generated
}

export interface PendingCADStylesResponse {
  data: StyleCADSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CADOptionsResponse {
  styleId: string;
  genericFabricName: string;
  greigeName: string;
  options: CADOption[];
  recommendedOption?: string; // CAD ID of lowest cost option
}

export interface CADApprovalResponse {
  success: boolean;
  message: string;
  style: {
    styleId: string;
    cadStatus: CADStatus;
    approvedCadId: string;
  };
}
