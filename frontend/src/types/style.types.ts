// Style Master TypeScript types

export const ProductionStage = {
  ORDER_RECEIVED: 'ORDER_RECEIVED',
  PENDING_COSTING: 'PENDING_COSTING',
  PENDING_GREIGE_ORDER: 'PENDING_GREIGE_ORDER',
  TRIMS_NOT_ORDERED: 'TRIMS_NOT_ORDERED',
  IN_PRINTING: 'IN_PRINTING',
  IN_DYING: 'IN_DYING',
  IN_EMBROIDERY: 'IN_EMBROIDERY',
  IN_HANDWORK: 'IN_HANDWORK',
  IN_CUTTING: 'IN_CUTTING',
  IN_STITCHING: 'IN_STITCHING',
  IN_FINISHING: 'IN_FINISHING',
  READY_TO_SHIP: 'READY_TO_SHIP',
  SHIPPED: 'SHIPPED',
  COMPLETED: 'COMPLETED',
} as const;

export type ProductionStage = typeof ProductionStage[keyof typeof ProductionStage];

export interface Style {
  id: string;
  internalCode?: string | null;  // Auto-generated internal reference (e.g., STY-202506-0001)
  styleCode: string;
  styleName: string;
  customerName: string;
  brandName: string;
  brandCategoryId?: string | null; // Reference to brand_categories table
  imageUrl: string | null;
  description: string | null;
  season: string | null;
  specifications?: string | null; // Old category field (for backward compatibility)
  components: StyleComponent[];
  processes: StyleProcess[];
  costing: StyleCosting | null;
  productionTracking: StyleProductionTracking[];
  garmentTrims: StyleGarmentTrim[];
  valueAdditions: StyleValueAddition[];
  packaging: StylePackaging[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count?: {
    components: number;
    processes: number;
  };
  orderQuantity?: number;
  costPerPiece?: number;
  orderValue?: number;
  orderDate?: string;
  deliveryDate?: string;
  variants?: StyleVariant[];
}

export interface StyleComponent {
  id: string;
  styleId: string;
  componentName: string;
  componentType: string;
  sortOrder: number;
  fabrics: StyleFabric[];
  accessories: StyleAccessory[];
  createdAt: string;
  updatedAt: string;
}

// DEPRECATED: Use FabricWidthCAD instead
// Keeping for backward compatibility during migration
export interface CadAverage {
  id: string;
  styleFabricId: string;
  fabricWidth: number;
  cadAverageMeters: number | null;
  cadAverageYards: number | null;
  cadWastagePercent: number | null;
  markerEfficiency: number | null;
  markerPlanFile: string | null;
  isPreferred: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// New fabric_width_cad interface
export interface FabricWidthCAD {
  id: string;
  fabricId: string;
  availableWidth: number; // Width in inches
  widthUnit: string; // "inches", "cm", etc.
  cadMeters: number | null;
  cadYards: number | null;
  cadWastagePercent: number;
  markerEfficiency: number | null;
  actualCad: number | null;
  cadVariancePercent: number | null;
  isPreferred: boolean;
  supplierAvailability: string | null;
  priceDifferential: number | null;
  markerPlanFile: string | null;
  markerLengthMeters: number | null;
  piecesPerMarker: number | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface StyleFabric {
  id: string;
  componentId: string;

  // NEW: References to fabric_master and fabric_width_cad
  fabricId: string | null;
  fabricCADId: string | null;
  fabric?: FabricMasterRef; // fabric_master details
  fabricCAD?: FabricWidthCAD; // fabric_width_cad details

  // DEPRECATED: Legacy fields (kept for backward compatibility)
  fabricName: string;
  fabricType: string;
  fabricColor: string | null;
  fabricGSM: string | null;
  fabricWidth: number | null;
  cadAverageMeters: number | null;
  cadAverageYards: number | null;
  supplierName: string | null;
  greigeName: string | null;
  cadAverages?: CadAverage[]; // DEPRECATED: Use fabricCAD instead

  // Component-specific fields
  quantityNeeded: number | null;
  unitPrice: number | null;
  notes: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface StyleAccessory {
  id: string;
  componentId: string;
  accessoryName: string;
  accessoryType: string;
  quantityPerPiece: number;
  unit: string;
  supplierName: string | null;
  unitPrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StyleProcess {
  id: string;
  styleId: string;
  processName: string;
  processType: string;
  isRequired: boolean;
  sortOrder: number;
  supplierId: string | null;
  supplier?: {
    id: string;
    code: string;
    name: string;
    supplierCategory: string;
  } | null;
  estimatedCost: number | null;
  estimatedDays: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StyleCosting {
  id: string;
  styleId: string;
  totalFabricCost: number;
  totalAccessoryCost: number;
  totalMaterialCost: number;
  printingCost: number;
  dyingCost: number;
  embroideryCost: number;
  handworkCost: number;
  totalProcessingCost: number;
  cuttingCost: number;
  stitchingCost: number;
  finishingCost: number;
  checkingCost: number;
  packingCost: number;
  totalProductionCost: number;
  overheadCost: number;
  profitMargin: number;
  totalCostPerPiece: number;
  sellingPricePerPiece: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface StyleProductionTracking {
  id: string;
  styleId: string;
  currentStage: ProductionStage;
  piecesInStage: number;
  sizeName: string | null;
  piecesOrderReceived: number;
  piecesPendingCosting: number;
  piecesPendingGreige: number;
  piecesTrimsNotOrdered: number;
  piecesInPrinting: number;
  piecesInDying: number;
  piecesInEmbroidery: number;
  piecesInHandwork: number;
  piecesInCutting: number;
  piecesInStitching: number;
  piecesInFinishing: number;
  piecesReadyToShip: number;
  piecesShipped: number;
  piecesCompleted: number;
  lastUpdatedStage: ProductionStage | null;
  lastUpdatedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  preProduction: {
    ordersReceived: { styles: number; pieces: number };
    pendingCosting: { styles: number; pieces: number };
    pendingGreige: { styles: number; pieces: number };
    trimsNotOrdered: { styles: number; pieces: number };
  };
  processing: {
    inPrinting: { styles: number; pieces: number };
    inDying: { styles: number; pieces: number };
    inEmbroidery: { styles: number; pieces: number };
    inHandwork: { styles: number; pieces: number };
  };
  production: {
    inCutting: { styles: number; pieces: number };
    inStitching: { styles: number; pieces: number };
    inFinishing: { styles: number; pieces: number };
    readyToShip: { styles: number; pieces: number };
  };
}

// Form types for creating/updating styles
export interface CreateStyleFormData {
  styleCode: string;
  styleName: string;
  customerName: string;
  brandName: string;
  description?: string;
  season?: string;
  components: ComponentFormData[];
  processes: ProcessFormData[];
}

// DEPRECATED: CAD Average form data (use FabricWidthCADFormData instead)
export interface CadAverageFormData {
  fabricWidth: number;
  cadAverageMeters?: number;
  cadAverageYards?: number;
  cadWastagePercent?: number;
  markerEfficiency?: number;
  markerPlanFile?: string;
  isPreferred?: boolean;
  notes?: string;
}

// New fabric_width_cad form data
export interface FabricWidthCADFormData {
  fabricId: string;
  availableWidth: number;
  widthUnit?: string;
  cadMeters?: number;
  cadYards?: number;
  cadWastagePercent?: number;
  markerEfficiency?: number;
  isPreferred?: boolean;
  markerPlanFile?: string;
  notes?: string;
}

export interface FabricFormData {
  // NEW: Use fabric_master and fabric_width_cad references
  fabricId?: string; // Reference to fabric_master
  fabricCADId?: string; // Reference to fabric_width_cad

  // DEPRECATED: Legacy fields (still used during migration)
  fabricName: string;
  fabricType: string;
  fabricColor?: string;
  fabricGSM?: string;
  fabricWidth?: number;
  cadAverageMeters?: number;
  cadAverageYards?: number;
  supplierName?: string;
  greigeName?: string;
  cadAverages?: CadAverageFormData[]; // DEPRECATED

  // Component-specific fields
  quantityNeeded?: number;
  unitPrice?: number;
  notes?: string;
}

export interface AccessoryFormData {
  accessoryName: string;
  accessoryType: string;
  quantityPerPiece: number;
  unit: string;
  supplierName?: string;
  unitPrice?: number;
}

export interface ComponentFormData {
  componentName: string;
  componentType: string;
  sortOrder?: number;
  fabrics?: FabricFormData[];
  accessories?: AccessoryFormData[];
}

export interface ProcessFormData {
  processName: string;
  processType?: string;
  isRequired?: boolean;
  sortOrder?: number;
  supplierId?: string | null;
  estimatedCost?: number;
  estimatedDays?: number;
  notes?: string;
}

export interface CostingFormData {
  totalFabricCost?: number;
  totalAccessoryCost?: number;
  totalMaterialCost?: number;
  printingCost?: number;
  dyingCost?: number;
  embroideryCost?: number;
  handworkCost?: number;
  totalProcessingCost?: number;
  cuttingCost?: number;
  stitchingCost?: number;
  finishingCost?: number;
  checkingCost?: number;
  packingCost?: number;
  totalProductionCost?: number;
  overheadCost?: number;
  profitMargin?: number;
  totalCostPerPiece?: number;
  sellingPricePerPiece?: number;
  notes?: string;
}

// API Response types
export interface StylesListResponse {
  data: Style[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StyleResponse {
  data: Style;
  message?: string;
}

export interface DashboardSummaryResponse {
  data: DashboardSummary;
}

// Draft-related response types
export interface DraftsListResponse {
  data: Style[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DraftResponse {
  data: Style;
  message?: string;
}

// Style Variant response types
export interface StyleVariantsResponse {
  data: StyleVariant[];
  message?: string;
}

// CAD Planning response types
export interface CADFabricGroup {
  cadGroupKey: string;
  fabrics: Array<{
    fabricId: string;
    fabricName: string;
    fabricType: string;
    componentName: string;
  }>;
}

export interface CADPlanningResponse {
  styleId: string;
  styleName: string;
  fabricGroups: CADFabricGroup[];
}

export interface CADGroupingResponse {
  message: string;
  updated: number;
}

export interface CADApprovalResponse {
  message: string;
  updated: number;
}

// Helper types for production stage display
export const PRODUCTION_STAGE_LABELS: Record<ProductionStage, string> = {
  [ProductionStage.ORDER_RECEIVED]: 'Orders Received',
  [ProductionStage.PENDING_COSTING]: 'Pending Costing',
  [ProductionStage.PENDING_GREIGE_ORDER]: 'Pending Greige Order',
  [ProductionStage.TRIMS_NOT_ORDERED]: 'Trims Not Ordered',
  [ProductionStage.IN_PRINTING]: 'In Printing',
  [ProductionStage.IN_DYING]: 'In Dying',
  [ProductionStage.IN_EMBROIDERY]: 'In Embroidery',
  [ProductionStage.IN_HANDWORK]: 'In Handwork',
  [ProductionStage.IN_CUTTING]: 'In Cutting',
  [ProductionStage.IN_STITCHING]: 'In Stitching',
  [ProductionStage.IN_FINISHING]: 'In Finishing',
  [ProductionStage.READY_TO_SHIP]: 'Ready to Ship',
  [ProductionStage.SHIPPED]: 'Shipped',
  [ProductionStage.COMPLETED]: 'Completed',
};

// Fabric types dropdown options
export const FABRIC_TYPES = [
  'Cotton',
  'Silk',
  'Polyester',
  'Georgette',
  'Chiffon',
  'Crepe',
  'Linen',
  'Rayon',
  'Velvet',
  'Satin',
  'Jersey',
  'Other',
];

// Accessory types dropdown options
export const ACCESSORY_TYPES = [
  'Button',
  'Zipper',
  'Thread',
  'Label',
  'Lace',
  'Elastic',
  'Hook & Eye',
  'Snap Button',
  'Sequin',
  'Bead',
  'Tassel',
  'Other',
];

// Process names
export const PROCESS_NAMES = [
  'Printing',
  'Dying',
  'Embroidery',
  'Handwork',
];

// Unit options for accessories
export const UNIT_OPTIONS = [
  'pcs',
  'meters',
  'yards',
  'dozen',
  'grams',
  'kg',
];

// Style Variant interface
export interface StyleVariant {
  id: string;
  styleId: string;
  size: string;
  sku: string;
  accountingSKU?: string | null;
  barcode?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Fabric Master reference (simplified for style context)
export interface FabricMasterRef {
  id: string;
  fabricCode: string;
  fabricName: string;
  fabricType?: string | null;
  composition?: string | null;
  gsm?: number | null;
  supplierName?: string | null;
}

// Common fabric widths (in inches)
export const COMMON_FABRIC_WIDTHS = [
  36,  // 36 inches
  44,  // 44 inches
  54,  // 54 inches
  58,  // 58 inches
  60,  // 60 inches
  72,  // 72 inches
  108, // 108 inches (extra wide)
];

// New interfaces for enhanced Style Master
export interface StyleGarmentTrim {
  id: string;
  styleId: string;
  trimName: string;
  trimType: string;
  quantityPerPiece: number;
  unit: string;
  supplier: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StyleValueAddition {
  id: string;
  styleId: string;
  additionType: string;
  description: string | null;
  estimatedCost: number | null;
  vendor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StylePackaging {
  id: string;
  styleId: string;
  itemName: string;
  itemType: string;
  specification: string | null;
  quantityPerPack: number;
  createdAt: string;
  updatedAt: string;
}
