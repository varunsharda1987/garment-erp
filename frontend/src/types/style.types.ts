// Style Master TypeScript types

export const ProductionStage = {
  ORDER_RECEIVED: 'ORDER_RECEIVED',
  PENDING_COSTING: 'PENDING_COSTING',
  PENDING_GREIGE_ORDER: 'PENDING_GREIGE_ORDER',
  TRIMS_NOT_ORDERED: 'TRIMS_NOT_ORDERED',
  IN_PRINTING: 'IN_PRINTING',
  IN_DYING: 'IN_DYING',
  IN_EMBROIDERY: 'IN_EMBROIDERY',
  IN_SMOCKING: 'IN_SMOCKING',
  IN_HANDWORK: 'IN_HANDWORK',
  IN_CUTTING: 'IN_CUTTING',
  IN_STITCHING: 'IN_STITCHING',
  IN_FINISHING: 'IN_FINISHING',
  READY_TO_SHIP: 'READY_TO_SHIP',
  SHIPPED: 'SHIPPED',
  COMPLETED: 'COMPLETED',
} as const;

export type ProductionStage = (typeof ProductionStage)[keyof typeof ProductionStage];

// Import CAD enums for local use in this file (re-exports below do not create local bindings)
import type { CADStatus, PrintDirection } from './cad-planning.types';

// Re-export CAD enums from dedicated CAD module (backward compatibility)
export { CADStatus, PrintDirection, PRINT_DIRECTION_LABELS } from './cad-planning.types';
export type { CADStatus as CADStatusType, PrintDirection as PrintDirectionType } from './cad-planning.types';

export interface Style {
  id: string;
  internalCode?: string | null; // Auto-generated internal reference (e.g., STY-202506-0001)
  styleCode: string;
  buyerStyleRef?: string | null; // Buyer's own reference number - always editable
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
    customerId?: string | null; // BUG-FC8 fix: Include customerId from brand_categories
  } | null; // Expanded brand_categories relation from backend (camelCase from serializer)
  image?: string | null;
  imageUrl: string | null;
  description: string | null;
  costPrice?: number | null; // Prisma Decimal, serialized to number
  sellingPrice?: number | null; // Prisma Decimal, serialized to number
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
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
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
  sizeOptions?: { sizeName: string }[]; // Lean size list included in list view (for catalogue size filter)
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
  genericGreigeName?: string | null; // Generic fabric name from backend
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

  // Additional optional fields
  hasEmbroidery?: boolean;
  cutableWidth?: number | null;

  // Design/Color identification
  fabricFinishType?: 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW' | null; // Matches Prisma FabricFinishType enum
  printDesign?: string | null; // For PRINTED/YARN_DYED fabrics
  colorMasterId?: string | null; // For SOLID/DYED fabrics
  colorMaster?: {
    id: string;
    colorCode: string;
    colorName: string;
    hexCode?: string | null;
  } | null;

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
  piecesInSmocking: number;
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
    ordersReceived: { styleCount: number; pieces: number };
    pendingCosting: { styleCount: number; pieces: number };
    pendingGreige: { styleCount: number; pieces: number };
    trimsNotOrdered: { styleCount: number; pieces: number };
  };
  processing: {
    inPrinting: { styleCount: number; pieces: number };
    inDying: { styleCount: number; pieces: number };
    inEmbroidery: { styleCount: number; pieces: number };
    inHandwork: { styleCount: number; pieces: number };
  };
  production: {
    inCutting: { styleCount: number; pieces: number };
    inStitching: { styleCount: number; pieces: number };
    inFinishing: { styleCount: number; pieces: number };
    readyToShip: { styleCount: number; pieces: number };
  };
}

// Form types for creating/updating styles
// ISSUE-S5 fix: Extended to include all fields accepted by backend createStyleSchema
export interface CreateStyleFormData {
  styleCode: string;
  styleName: string;
  customerName?: string;
  brandName?: string;
  brandCategoryId?: string | null;
  productCategoryId?: string | null;
  category?: string;
  description?: string | null;
  season?: string;
  seasonId?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'UNISEX' | null;
  ageGroup?: 'INFANT' | 'KIDS' | 'TEEN' | 'ADULT' | null;
  specifications?: string | null;
  imageUrl?: string | null;
  projectGroup?: string;
  // Status fields
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  cadStatus?: CADStatus;
  // Pricing fields
  costPrice?: number | null;
  sellingPrice?: number | null;
  // Additional fields
  expectedOrderQuantity?: number | null;
  numberOfComponents?: number | null;
  hsnCode?: string | null;
  productTaxRule?: string | null;
  accountingSKU?: string | null;
  accountingUnit?: string | null;
  bulletPoints?: string | null;
  // Nested arrays
  components?: ComponentFormData[];
  processes?: ProcessFormData[];
  materialBOM?: MaterialBOMFormData[];
  customerAccessoriesPresetId?: string | null;
  skuVariants?: SKUVariantFormData[];
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
  fabricId?: string | null; // Reference to fabric_master
  fabricCADId?: string; // Reference to fabric_width_cad

  // DEPRECATED: Legacy fields (still used during migration)
  fabricName?: string;
  fabricCode?: string;
  fabricType?: string;
  fabricColor?: string;
  fabricGSM?: string;
  fabricWidth?: number;
  fabricRate?: number;
  fabricAverage?: number;
  cadAverageMeters?: number;
  cadAverageYards?: number;
  supplierName?: string;
  greigeName?: string;
  genericGreigeName?: string | null;
  fabricFinishType?: 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW' | null;
  cadAverages?: CadAverageFormData[]; // DEPRECATED

  // Component-specific fields
  quantityNeeded?: number;
  unit?: string;
  unitPrice?: number;
  notes?: string | null;

  // Design/Color identification
  printDesign?: string | null;
  colorMasterId?: string | null;

  // Embroidery support
  hasEmbroidery?: boolean;
  embroideryId?: string | null;

  // Pattern parts
  patternPartIds?: string[];
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

// ISSUE-S5 fix: Add MaterialBOMFormData to support proper typing
export interface MaterialBOMFormData {
  materialType: string;
  materialId?: string | null;
  materialCode?: string | null;
  materialName?: string | null;
  usageCategory?: string;
  componentName?: string | null;
  quantityPerGarment?: number;
  unit?: string;
  unitPrice?: number | null;
  totalCost?: number | null;
  notes?: string | null;
}

// ISSUE-S5 fix: Add SKUVariantFormData to support proper typing
export interface SKUVariantFormData {
  size?: string;
  sku?: string;
  barcode?: string | null;
  accountingSKU?: string | null;
  isActive?: boolean;
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

// Re-export CAD Planning response types from dedicated CAD module (backward compatibility)
export type {
  CADPlanningGreigeOption,
  CADPlanningOption,
  CADPlanningFabric,
  CADPlanningEmbroidery,
  CADPlanningReadyPurchaseFabric,
  CADFabricGroup,
  CADPlanningStyle,
  CADPlanningResponse,
  CADGroupingResponse,
  CADApprovalResponse,
} from './cad-planning.types';

// Helper types for production stage display
export const PRODUCTION_STAGE_LABELS: Record<ProductionStage, string> = {
  [ProductionStage.ORDER_RECEIVED]: 'Orders Received',
  [ProductionStage.PENDING_COSTING]: 'Pending Costing',
  [ProductionStage.PENDING_GREIGE_ORDER]: 'Pending Greige Order',
  [ProductionStage.TRIMS_NOT_ORDERED]: 'Trims Not Ordered',
  [ProductionStage.IN_PRINTING]: 'In Printing',
  [ProductionStage.IN_DYING]: 'In Dying',
  [ProductionStage.IN_EMBROIDERY]: 'In Embroidery',
  [ProductionStage.IN_SMOCKING]: 'In Smocking',
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
export const PROCESS_NAMES = ['Printing', 'Dying', 'Embroidery', 'Handwork'];

// Unit options for accessories
export const UNIT_OPTIONS = ['pcs', 'meters', 'yards', 'dozen', 'grams', 'kg'];

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
  genericGreigeName?: string | null;
  composition?: string | null;
  gsm?: number | null;
  supplierName?: string | null;
}

// Common fabric widths (in inches)
export const COMMON_FABRIC_WIDTHS = [
  36, // 36 inches
  44, // 44 inches
  54, // 54 inches
  58, // 58 inches
  60, // 60 inches
  72, // 72 inches
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

// Re-export all CAD spreadsheet & workflow types from dedicated CAD module (backward compatibility)
export {
  CADPurpose,
  CAD_PURPOSE_LABELS,
  CAD_PURPOSE_SHORT_LABELS,
  ALL_PARTS_CODE,
  ALL_PARTS_LABEL,
  ALL_PARTS_ID,
  CADApprovalStatus,
  CAD_APPROVAL_STATUS_LABELS,
} from './cad-planning.types';

export type {
  CADSizeBreakdown,
  CADSpreadsheetRow,
  CADPatternPartOption,
  CADStyleFabricOption,
  CADComponentOption,
  CADGreigeOption,
  CADSizeOption,
  CADStyleSummary,
  FabricStockSummaryItem,
  CADTableData,
  CADTableDataResponse,
  AddCADRowRequest,
  UpdateCADRowRequest,
  GreigeWidthsResponse,
  CopyCADResponse,
  CADCopyLineageItem,
  CADCopyLineage,
  GetCADLineageResponse,
  CADSpreadsheetRowExtended,
  ApproveCADRequest,
  RejectCADRequest,
  CreateCostingVersionRequest,
  CreatePlanningVersionRequest,
  CopyCADPurposeRequest,
  LinkCADToStockRequest,
  FabricStockOption,
  CreateProductionCADFromStockRequest,
  CADOrderHistoryItem,
  CADSummaryItem,
  CADOrderHistoryResponse,
} from './cad-planning.types';
