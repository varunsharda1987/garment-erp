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

export const CADStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  APPROVED: 'APPROVED',
} as const;

export type CADStatus = typeof CADStatus[keyof typeof CADStatus];

// Print Direction enum for CAD planning
export const PrintDirection = {
  ONE_WAY: 'ONE_WAY',
  TWO_WAY: 'TWO_WAY',
} as const;

export type PrintDirection = typeof PrintDirection[keyof typeof PrintDirection];

export const PRINT_DIRECTION_LABELS: Record<PrintDirection, string> = {
  [PrintDirection.ONE_WAY]: 'One-Way',
  [PrintDirection.TWO_WAY]: 'Two-Way',
};

export interface Style {
  id: string;
  internalCode?: string | null;  // Auto-generated internal reference (e.g., STY-202506-0001)
  styleCode: string;
  styleName: string;
  customerName: string;
  brandName: string;
  brandCategoryId?: string | null; // Reference to brand_categories table
  // Note: backend serializer converts snake_case to camelCase
  brandCategories?: {
    id: string;
    brandName: string;
    category: string;
    subCategory?: string | null;
    subSubCategory?: string | null;
  } | null; // Expanded brand_categories relation from backend (camelCase from serializer)
  imageUrl: string | null;
  description: string | null;
  season: string | null;
  seasonId?: string | null;
  seasonMaster?: {
    id: string;
    code: string;
    name: string;
    year: number;
    seasonType: string;
  } | null; // Season relation from backend (camelCase from serializer)
  specifications?: string | null; // Old category field (for backward compatibility)
  numberOfComponents?: number | null; // Number of garment components (e.g., top, bottom, etc.)
  productCategoryId?: string | null; // Reference to product_category_master table
  productCategory?: {
    id: string;
    name: string;
    code?: string | null;
  } | null; // Product category relation from backend (for list view)
  components: StyleComponent[];
  processes: StyleProcess[];
  costing: StyleCosting | null;
  styleCosting?: {
    totalCostPerPiece: number;
  } | null; // Costing summary for list view
  productionTracking: StyleProductionTracking[];
  styleMaterialBom?: StyleMaterialBom[];
  valueAdditions: StyleValueAddition[];
  packaging: StylePackaging[];
  isActive: boolean;
  cadStatus?: CADStatus;
  approvedCadDate?: string | null;
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
  componentMasterId?: string | null;
  sortOrder: number;
  componentMaster?: {
    id: string;
    name: string;
    componentGroupId?: string | null;
  } | null;
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
  availableWidth: number; // Width in inches (alias: cutableWidth)
  cutableWidth?: number; // Same as availableWidth - backend uses this name
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
  layerMarginMeters: number | null; // Layer margin for marker planning
  piecesPerMarker: number | null;
  printDirection: PrintDirection | null; // One-Way or Two-Way print direction
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
  genericFabricName?: string | null; // Generic fabric name from backend
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
    supplierCategories: string[];
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
  seasonId?: string | null;
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
export interface CADPlanningGreigeOption {
  id: string;
  greigeCode: string;
  greigeName: string;
  greigeWidth: number;
  defaultCutableWidth: number | null;
  expectedFinishedWidthMin: number | null;
  expectedFinishedWidthMax: number | null;
  greigePricePerMeter: number | null;
  composition?: string;
  weaveType?: string;
  cutableWidths?: number[];
}

export interface CADPlanningOption {
  id: string;
  cutableWidth: number;
  cadMeters: number | null;
  cadYards: number | null;
  layerMarginMeters: number | null;
  cadWastagePercent: number;
  processingPricePerMeter: number | null;
  markerEfficiency: number | null;
  piecesPerMarker: number | null;
  markerLengthMeters: number | null;
  isSelected: boolean;
  isPreferred?: boolean;
  printDirection?: PrintDirection | null;
  componentName?: string | null;
  notes?: string | null;
  sizeBreakdowns?: Array<{ sizeName: string; sizeId?: string | null; quantity: number }>;
}

export interface CADPlanningFabric {
  id: string;
  componentId: string;
  componentName: string;
  fabricName: string;
  genericFabricName: string;
  fabricFinishType: string;
  currentCADId: string | null;
  hasEmbroidery?: boolean;
  embroideryId?: string | null;
  cutableWidth?: number | null;
  allowCombinedCutting?: boolean;
}

export interface CADPlanningEmbroidery {
  id: string;
  embroideryCode: string;
  designName: string;
  costPerMeter: number | null;
}

export interface CADPlanningReadyPurchaseFabric {
  id: string;
  fabricCode: string;
  fabricName: string;
  actualWidth: number | null;
  cutableWidth: number | null;
  costPerMeter: number | null;
  composition?: string;
  yarnCount?: string;
}

export interface CADFabricGroup {
  groupKey: string;
  genericFabricName: string;
  fabricFinishType: string;
  cutableWidth?: number | null;
  hasEmbroidery?: boolean;
  embroidery?: CADPlanningEmbroidery | null;
  fabrics: CADPlanningFabric[];
  components: string[];
  isReadyPurchaseFabric?: boolean;
  readyPurchaseFabric?: CADPlanningReadyPurchaseFabric | null;
  availableGreiges?: CADPlanningGreigeOption[];
  selectedGreigeId?: string;
  selectedGreige?: CADPlanningGreigeOption;
  averagingMode?: 'COMBINED' | 'SEPARATE';
  cadOptions?: CADPlanningOption[];
  selectedCADId?: string;
  // Note: Backend returns 'sizeOptions' but serializer maps it to 'sizes'
  sizes?: Array<{ sizeId: string | null; sizeName: string; sortOrder: number }>;
}

export interface CADPlanningStyle {
  id: string;
  styleCode: string;
  styleName: string;
  cadStatus: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  approvedCadDate?: string;
}

export interface CADPlanningResponse {
  style: CADPlanningStyle;
  fabricGroups: CADFabricGroup[];
  missingGreigeNames?: string[];
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

// Material BOM entry - unified trim/accessory storage (replaces deprecated StyleGarmentTrim)
export interface StyleMaterialBom {
  id: string;
  styleId: string;
  materialId?: string | null;
  materialType: 'LACE' | 'BUTTON' | 'THREAD' | 'ZIPPER' | 'ELASTIC' | 'LABEL' | 'PACKAGING';
  usageCategory: 'GARMENT_TRIM' | 'VALUE_ADDITION' | 'PACKAGING';
  componentName?: string | null;
  quantityPerGarment: number;
  unit: string;
  unitPrice?: number | null;
  totalCost?: number | null;
  notes?: string | null;
  extraPercentage?: number | null;
  sortOrder: number;
  isActive: boolean;
  // Foreign keys to specific masters
  laceId?: string | null;
  buttonId?: string | null;
  threadId?: string | null;
  zipperId?: string | null;
  elasticId?: string | null;
  labelId?: string | null;
  packagingId?: string | null;
  // Included master relations (populated by backend)
  laceMaster?: {
    laceCode: string;
    laceName: string;
    color?: string | null;
    width?: number | null;
    composition?: string | null;
  } | null;
  buttonMaster?: {
    buttonCode: string;
    buttonName: string;
    color?: string | null;
    size?: string | null;
    material?: string | null;
  } | null;
  threadMaster?: {
    threadCode: string;
    threadName: string;
    color?: string | null;
    colorCode?: string | null;
  } | null;
  zipperMaster?: {
    zipperCode: string;
    zipperName: string;
    color?: string | null;
    length?: number | null;
  } | null;
  elasticMaster?: {
    elasticCode: string;
    elasticName: string;
    color?: string | null;
    width?: number | null;
  } | null;
  labelMaster?: {
    labelCode: string;
    labelName: string;
    labelType?: string | null;
  } | null;
  packagingMaster?: {
    packagingCode: string;
    packagingName: string;
    packagingType?: string | null;
  } | null;
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

// ============================================================================
// CAD Planning - Pattern Parts & Embroidery CAD Types
// ============================================================================

/**
 * Pattern part assigned to a style fabric
 * Links pattern parts to fabrics during CAD planning
 */
export interface StylePatternPart {
  id: string;
  styleFabricId: string;
  patternPartId: string;
  quantity: number;
  goesToEmbroidery: boolean; // If true, this part needs separate embroidery CAD
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Expanded pattern part details
  patternPart?: {
    id: string;
    name: string;
    code: string;
    description?: string | null;
  };
}

/**
 * Size breakdown for embroidery CAD
 */
export interface EmbroideryCadSizeBreakdown {
  id: string;
  embroideryCadId: string;
  sizeName: string;
  sizeId: string | null;
  quantity: number;
}

/**
 * Embroidery CAD - separate CAD for parts that go to embroidery
 */
export interface EmbroideryCad {
  id: string;
  styleFabricId: string;
  fabricWidthCadId: string | null; // Links to selected fabric_width_cad
  embroideryId: string | null; // Links to embroidery master

  // CAD values for embroidery parts
  cadMeters: number | null;
  cadYards: number | null;
  cadWastagePercent: number;
  layerMarginMeters: number | null;
  piecesPerMarker: number | null;
  markerEfficiency: number | null;
  printDirection: PrintDirection;

  isApproved: boolean;
  notes: string | null;

  createdAt: string;
  updatedAt: string;

  // Expanded relations
  sizeBreakdowns?: EmbroideryCadSizeBreakdown[];
  fabricWidthCad?: FabricWidthCAD;
  embroidery?: {
    id: string;
    name: string;
    code?: string | null;
    costPerMeter?: number | null;
  };
  // Pattern parts that go to embroidery
  embroideryParts?: StylePatternPart[];
}

/**
 * Total fabric CAD combining main CAD + embroidery CAD
 */
export interface TotalFabricCad {
  styleFabricId: string;
  mainCad: {
    cadId: string | null;
    cadMeters: number | null;
    cadYards: number | null;
    cutableWidth: number | null;
    isPreferred: boolean;
    printDirection: PrintDirection | null;
  } | null;
  embroideryCad: {
    cadId: string | null;
    cadMeters: number | null;
    cadYards: number | null;
    isApproved: boolean;
    printDirection: PrintDirection | null;
  } | null;
  totalCadMeters: number | null;
  totalCadYards: number | null;
  hasEmbroideryParts: boolean;
}

// ============================================================================
// CAD Planning - API Request/Response Types
// ============================================================================

/**
 * Request body for assigning pattern parts to a style fabric
 */
export interface AssignPatternPartsRequest {
  patternParts: Array<{
    patternPartId: string;
    quantity?: number;
    goesToEmbroidery?: boolean;
    notes?: string;
  }>;
}

/**
 * Request body for updating a pattern part assignment
 */
export interface UpdatePatternPartRequest {
  quantity?: number;
  goesToEmbroidery?: boolean;
  notes?: string;
}

/**
 * Request body for creating/updating embroidery CAD
 */
export interface EmbroideryCadRequest {
  fabricWidthCadId?: string;
  embroideryId?: string;
  cadMeters?: number;
  cadYards?: number;
  cadWastagePercent?: number;
  layerMarginMeters?: number;
  piecesPerMarker?: number;
  markerEfficiency?: number;
  printDirection?: PrintDirection;
  notes?: string;
  sizeBreakdowns?: Array<{
    sizeName: string;
    sizeId?: string;
    quantity: number;
  }>;
}

/**
 * Response for pattern parts endpoints
 */
export interface PatternPartsResponse {
  data: StylePatternPart[];
  message?: string;
}

/**
 * Response for embroidery CAD endpoints
 */
export interface EmbroideryCadResponse {
  data: EmbroideryCad | null;
  message?: string;
}

/**
 * Response for total fabric CAD endpoint
 */
export interface TotalFabricCadResponse {
  data: TotalFabricCad;
  message?: string;
}

/**
 * Cutable width validation result
 */
export interface CutableWidthValidation {
  valid: boolean;
  message?: string;
  minWidth?: number;
  maxWidth?: number;
  greigeWidth?: number;
  hasEmbroidery?: boolean;
}

// ============================================================================
// CAD SPREADSHEET TABLE TYPES
// ============================================================================

/**
 * Purpose of CAD entry
 * COSTING = Style costing for quotations (formerly PLANNING)
 * RAW_MATERIAL_CALCULATION = MRP for confirmed orders (formerly COSTING)
 * PRODUCTION = Actual production fabric requirements
 */
export const CADPurpose = {
  PRODUCTION: 'PRODUCTION',
  RAW_MATERIAL_CALCULATION: 'RAW_MATERIAL_CALCULATION',
  COSTING: 'COSTING',
} as const;

export type CADPurpose = typeof CADPurpose[keyof typeof CADPurpose];

export const CAD_PURPOSE_LABELS: Record<CADPurpose, string> = {
  [CADPurpose.PRODUCTION]: 'Production',
  [CADPurpose.RAW_MATERIAL_CALCULATION]: 'Raw Material Calculation',
  [CADPurpose.COSTING]: 'Costing',
};

// Short labels for compact UI display (tabs, badges)
export const CAD_PURPOSE_SHORT_LABELS: Record<CADPurpose, string> = {
  [CADPurpose.PRODUCTION]: 'Production',
  [CADPurpose.RAW_MATERIAL_CALCULATION]: 'Raw Mat',
  [CADPurpose.COSTING]: 'Costing',
};

/**
 * Code for the "All Parts" pattern part in the database.
 * This is a real pattern_part_master record that represents all parts combined.
 */
export const ALL_PARTS_CODE = 'ALL_PARTS';

/**
 * Display label for "All Parts" option
 */
export const ALL_PARTS_LABEL = 'All Parts';

/**
 * @deprecated Use ALL_PARTS_CODE instead. Kept for backward compatibility.
 */
export const ALL_PARTS_ID = '__ALL_PARTS__';

/**
 * Size breakdown for CAD calculation
 */
export interface CADSizeBreakdown {
  sizeName: string;
  sizeId: string | null;
  quantity: number;
}

/**
 * CAD spreadsheet row - represents one CAD entry in the table
 */
export interface CADSpreadsheetRow {
  id: string;
  purpose: CADPurpose | null;
  componentId: string;
  componentName: string;
  styleFabricId: string;
  partId: string | null;
  partCode: string | null;
  partName: string | null;
  fabricFinishType: string | null;
  isEmbroidery: boolean;
  genericGreigeName: string | null;
  greigeId: string | null;
  greigeName: string | null;
  cutableWidth: number | null;
  availableWidths: number[];
  stockWidths?: number[];      // Available widths from stock
  hasStockMatch?: boolean;     // Does stock exist for this fabric?
  printDirection: PrintDirection;
  sizeBreakdowns: CADSizeBreakdown[];
  piecesPerMarker: number | null;
  layerMarginMeters: number | null;
  layerLengthMeters: number | null;
  cadAverage: number | null;
  // Combined cutting fields
  isCombinedCutting?: boolean;
  combinedFabricIds?: string[] | null;
  combinedComponents?: string | null;
  // Order usage tracking
  orderCount?: number;
  stockLotNumber?: string | null;
  // Approval status
  approvalStatus?: string | null;
  isLocked?: boolean;
  fabricStockId?: string | null;
  // Copy lineage tracking - NEW
  copiedFromId?: string | null;
  copiedFrom?: {
    id: string;
    purpose: CADPurpose;
    approvalStatus: string;
  } | null;
}

/**
 * Pattern part option for dropdown
 */
export interface CADPatternPartOption {
  id: string;
  name: string;
  code: string;
  goesToEmbroidery: boolean;
}

/**
 * Component option for the spreadsheet
 */
/**
 * Style fabric option for add row functionality
 */
export interface CADStyleFabricOption {
  id: string;
  fabricFinishType: string | null;
  genericFabricName: string | null;
  hasEmbroidery?: boolean;
  embroideryCode?: string | null;
  fabricCode?: string | null;
}

export interface CADComponentOption {
  id: string;
  name: string;
  type: string;
  patternParts: CADPatternPartOption[];
  stylePatternParts: CADPatternPartOption[];
  // Note: Backend serializer maps 'styleFabrics' to 'fabrics'
  fabrics: CADStyleFabricOption[];
}

/**
 * Greige option for dropdown
 */
export interface CADGreigeOption {
  id: string;
  greigeName: string;
  genericFabricName: string;
  greigeWidth: number | null;
  expectedFinishedWidthMin: number | null;
  expectedFinishedWidthMax: number | null;
  supplierName?: string;
}

/**
 * Size option for size breakdown popup
 */
export interface CADSizeOption {
  id: string;
  name: string;
  sortOrder: number;
}

/**
 * Style summary for CAD table header
 */
export interface CADStyleSummary {
  id: string;
  styleCode: string;
  styleName: string;
  cadStatus: CADStatus;
}

/**
 * Stock summary item for banner display in CAD Planning page
 */
export interface FabricStockSummaryItem {
  id: string;
  fabricId: string;
  fabricName: string;
  fabricCode: string;
  greigeId: string;
  greigeName: string;
  cutableWidth: number;
  finishedWidth: number;
  quantityAvailable: number;
  qualityGrade: string;
  // PRODUCTION CAD tracking
  hasProductionCad?: boolean;
  productionCadId?: string | null;
  productionCadStatus?: string | null; // 'PENDING' | 'APPROVED' | 'REJECTED'
  stockLotNumber?: string | null;
}

/**
 * Full CAD table data response
 * Note: Backend serializer transforms sizeOptions → sizes
 */
export interface CADTableData {
  style: CADStyleSummary;
  components: CADComponentOption[];
  availableGreiges: CADGreigeOption[];
  sizeOptions?: CADSizeOption[];  // Backend may send as 'sizes' due to serializer
  sizes?: CADSizeOption[];        // Serialized name from backend
  cadRows: CADSpreadsheetRow[];
  stockSummary?: FabricStockSummaryItem[];
}

/**
 * Response for CAD table data endpoint
 */
export interface CADTableDataResponse {
  success: boolean;
  data: CADTableData;
  message?: string;
}

/**
 * Request body for adding a new CAD row
 */
export interface AddCADRowRequest {
  purpose?: CADPurpose;
  componentId: string;
  styleFabricId: string;
  partId?: string;
  isEmbroidery?: boolean;
  /** Required for PRODUCTION purpose - links CAD row to actual stock */
  fabricStockId?: string;
}

/**
 * Request body for updating a CAD row
 */
export interface UpdateCADRowRequest {
  purpose?: CADPurpose;
  partId?: string;
  isEmbroidery?: boolean;
  greigeId?: string;
  cutableWidth?: number;
  printDirection?: PrintDirection;
  sizeBreakdowns?: CADSizeBreakdown[];
  cadMeters?: number;
  piecesPerMarker?: number;
  layerLengthMeters?: number;
}

/**
 * Response for greige widths endpoint
 */
export interface GreigeWidthsResponse {
  success: boolean;
  data: {
    greigeId: string;
    greigeName: string;
    greigeWidth: number | null;
    minFinishedWidth: number;
    maxFinishedWidth: number;
    availableWidths: number[];
  };
}

/**
 * Copy CAD Response - NEW for "Copy as Draft" workflow
 */
export interface CopyCADResponse {
  success: boolean;
  message: string;
  data: {
    newRecordId: string;
    copiedFromId: string;
    purpose: CADPurpose;
    approvalStatus: CADApprovalStatus;
  };
}

/**
 * CAD Copy Lineage Data - NEW for tracking copy history
 */
export interface CADCopyLineageItem {
  id: string;
  purpose: CADPurpose;
  approvalStatus: CADApprovalStatus;
  componentName?: string;
  cutableWidth: number;
}

export interface CADCopyLineage {
  source?: CADCopyLineageItem;
  current: CADCopyLineageItem;
  children: CADCopyLineageItem[];
}

/**
 * Get Lineage Response - NEW
 */
export interface GetCADLineageResponse {
  success: boolean;
  data: CADCopyLineage;
}

// ============================================
// CAD PURPOSES: COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION
// ============================================

/**
 * CAD Approval Status
 */
export enum CADApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * CAD Approval Status Labels
 */
export const CAD_APPROVAL_STATUS_LABELS: Record<CADApprovalStatus, string> = {
  [CADApprovalStatus.PENDING]: 'Pending',
  [CADApprovalStatus.APPROVED]: 'Approved',
  [CADApprovalStatus.REJECTED]: 'Rejected',
};

/**
 * Extended CAD spreadsheet row with approval and purpose fields
 */
export interface CADSpreadsheetRowExtended extends CADSpreadsheetRow {
  // Approval workflow
  approvalStatus?: CADApprovalStatus | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  approvalNotes?: string | null;

  // Locking (PRODUCTION)
  isLocked: boolean;
  lockedReason?: string | null;
  lockedAt?: string | null;

  // Version Control (COSTING)
  version: number;
  supersededById?: string | null;
  supersededByVersion?: number | null;

  // Stock Integration (PRODUCTION)
  fabricStockId?: string | null;
  fabricStockDetails?: {
    finishedWidth: number;
    cutableWidth: number;
    rollNumbers?: string | null;
    qualityGrade: string;
  } | null;
  procurementId?: string | null;

  // Variance Tracking (PRODUCTION vs RAW_MATERIAL_CALCULATION)
  sourceCadWidth?: number | null; // Width from source RAW_MATERIAL_CALCULATION CAD
  planningCadWidth?: number | null; // @deprecated - use sourceCadWidth
  widthVariance?: number | null;
  variancePercent?: number | null;

  // Costing Integration (RAW_MATERIAL_CALCULATION)
  styleCostingId?: string | null;
  autoApprovedFrom?: string | null;

  // Order Usage Tracking (PRODUCTION)
  orderCount?: number;
  stockLotNumber?: string | null;
}

/**
 * Approve CAD Request
 */
export interface ApproveCADRequest {
  approvalNotes?: string;
}

/**
 * Reject CAD Request
 */
export interface RejectCADRequest {
  rejectionNotes: string;
}

/**
 * Create Costing Version Request (for COSTING CAD versioning)
 */
export interface CreateCostingVersionRequest {
  versionReason?: string;
}

/** @deprecated Use CreateCostingVersionRequest */
export type CreatePlanningVersionRequest = CreateCostingVersionRequest;

/**
 * Copy CAD Purpose Request
 */
export interface CopyCADPurposeRequest {
  sourceCadId: string;
  targetPurpose: CADPurpose;
  styleFabricId: string;
  componentId?: string;
  patternPartId?: string;
}

/**
 * Link CAD to Stock Request
 */
export interface LinkCADToStockRequest {
  cadId: string;
  fabricStockId: string;
  procurementId?: string;
  planningCadWidth?: number;
}

/**
 * Fabric Stock Option for PRODUCTION CAD selection
 */
export interface FabricStockOption {
  id: string;
  fabricId: string;
  fabricName: string;
  finishedWidth: number;
  cutableWidth: number;
  quantityAvailable: number;
  rollNumbers?: string | null;
  qualityGrade: string;
  receivedDate: string;
  procurementId?: string | null;
}

// ============================================
// MULTI-ORDER CAD WORKFLOW TYPES
// ============================================

/**
 * Create PRODUCTION CAD from stock request
 */
export interface CreateProductionCADFromStockRequest {
  fabricStockId: string;
  styleFabricId?: string;
  basedOnRawMatCadId?: string; // Source RAW_MATERIAL_CALCULATION CAD for variance tracking
  basedOnPlanningCadId?: string; // @deprecated - use basedOnRawMatCadId
  componentId?: string;
  greigeId?: string;
  patternPartId?: string;
}

/**
 * CAD Order History Item - tracks which order used which CAD
 */
export interface CADOrderHistoryItem {
  source: 'order_selection' | 'allocation';
  orderId: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  cadId: string | null;
  cutableWidth: number | null;
  cadMeters: number | null;
  stockLot: string | null;
  qualityGrade: string | null;
  planningCadWidth: number | null;
  widthVariance: number | null;
  variancePercent: number | null;
  quantityCut?: number;
  quantityAllocated?: number;
  quantityConsumed?: number;
  allocationStatus?: string;
}

/**
 * CAD Summary Item for Order History
 */
export interface CADSummaryItem {
  id: string;
  cutableWidth: number;
  cadMeters: number | null;
  approvalStatus: string | null;
  isLocked: boolean;
  fabricName: string;
  componentName: string | null;
  stockLot: string | null;
  stockAvailable: number | null;
  orderCount: number;
  createdAt: string;
}

/**
 * CAD Order History Response
 */
export interface CADOrderHistoryResponse {
  styleId: string;
  history: CADOrderHistoryItem[];
  cadSummary: CADSummaryItem[];
  totalOrders: number;
  totalCADs: number;
}
