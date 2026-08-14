/**
 * Order BOM (Bill of Materials) Types
 * Frontend type definitions for Order-level BOM operations
 *
 * Order BOM is created after Cost Sheet approval and contains
 * order-specific quantities and prices for MRP & Production.
 */

// ============================================
// Order BOM Status
// ============================================

export type OrderBOMStatus = 'DRAFT' | 'APPROVED' | 'LOCKED';

// ============================================
// Order BOM Item Types
// ============================================

export type OrderBOMItemMaterialType =
  | 'BUTTON'
  | 'THREAD'
  | 'ZIPPER'
  | 'LACE'
  | 'ELASTIC'
  | 'LABEL'
  | 'PACKAGING'
  | 'FABRIC'
  | 'GREIGE'
  | 'GENERIC';

export type OrderBOMItemUsageCategory = 'GARMENT_TRIM' | 'PACKAGING' | 'VALUE_ADDITION' | 'FABRIC';

export interface OrderBOMItem {
  /**
   * MRP-31: display-only. The greige this line will actually consume — the finished CAD
   * consumption divided by the processor's shrinkage. Not persisted; computed on read by the
   * same resolver MRP plans with.
   */
  greigeRequired?: number | null;
  shrinkagePercentUsed?: number | null;
  shrinkageSource?: 'RATE_CARD' | 'RATE_CARD_RESOLVED' | 'GREIGE_MASTER_FALLBACK' | 'NONE' | null;
  id: string;
  orderBomId: string;
  materialType: OrderBOMItemMaterialType;
  materialId?: string | null;
  buttonId?: string | null;
  threadId?: string | null;
  zipperId?: string | null;
  laceId?: string | null;
  elasticId?: string | null;
  labelId?: string | null;
  packagingId?: string | null;
  // Generic trim FK fields
  hookEyeId?: string | null;
  snapButtonId?: string | null;
  buckleId?: string | null;
  beltId?: string | null;
  velcroId?: string | null;
  drawstringId?: string | null;
  ribbonId?: string | null;
  sequinId?: string | null;
  beadId?: string | null;
  motifId?: string | null;
  interliningId?: string | null;
  paddingId?: string | null;
  otherFastenerId?: string | null;
  otherTapeId?: string | null;
  otherDecorativeId?: string | null;
  otherFunctionalId?: string | null;
  fabricId?: string | null;
  selectedCadId?: string | null;
  fabricWidthInches?: number | null;
  cadAverageSnapshot?: number | null;
  quantityPerGarment: number;
  orderQuantity: number;
  totalQuantity: number;
  wastagePercent?: number | null;
  totalWithWastage?: number | null;
  unit: string;
  unitPrice: number;
  totalCost: number;
  componentName?: string | null;
  usageCategory?: OrderBOMItemUsageCategory | null;
  notes?: string | null;
  sortOrder: number;
  sourcingStrategy?: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED' | null;
  greigeId?: string | null;
  processorId?: string | null;
  greigeCost?: number | null;
  processingCost?: number | null;
  rateCardId?: string | null;
  colorName?: string | null;
  // Material relations (populated from includes)
  material?: { id: string; code: string; name: string } | null;
  buttonMaster?: { id: string; buttonCode: string; buttonName: string } | null;
  threadMaster?: { id: string; threadCode: string; threadName: string } | null;
  zipperMaster?: { id: string; zipperCode: string; zipperName: string } | null;
  laceMaster?: { id: string; laceCode: string; laceName: string } | null;
  elasticMaster?: { id: string; elasticCode: string; elasticName: string } | null;
  labelMaster?: { id: string; labelCode: string; labelName: string } | null;
  packagingMaster?: { id: string; packagingCode: string; packagingName: string } | null;
  // Generic trim masters (all follow { id, <type>Code, <type>Name })
  hookEyeMaster?: { id: string; hookEyeCode: string; hookEyeName: string } | null;
  snapButtonMaster?: { id: string; snapButtonCode: string; snapButtonName: string } | null;
  buckleMaster?: { id: string; buckleCode: string; buckleName: string } | null;
  beltMaster?: { id: string; beltCode: string; beltName: string } | null;
  velcroMaster?: { id: string; velcroCode: string; velcroName: string } | null;
  drawstringMaster?: { id: string; drawstringCode: string; drawstringName: string } | null;
  ribbonMaster?: { id: string; ribbonCode: string; ribbonName: string } | null;
  sequinMaster?: { id: string; sequinCode: string; sequinName: string } | null;
  beadMaster?: { id: string; beadCode: string; beadName: string } | null;
  motifMaster?: { id: string; motifCode: string; motifName: string } | null;
  interliningMaster?: { id: string; interliningCode: string; interliningName: string } | null;
  paddingMaster?: { id: string; paddingCode: string; paddingName: string } | null;
  otherFastenerMaster?: { id: string; otherFastenerCode: string; otherFastenerName: string } | null;
  otherTapeMaster?: { id: string; otherTapeCode: string; otherTapeName: string } | null;
  otherDecorativeMaster?: { id: string; otherDecorativeCode: string; otherDecorativeName: string } | null;
  otherFunctionalMaster?: { id: string; otherFunctionalCode: string; otherFunctionalName: string } | null;
  fabricMaster?: {
    id: string;
    fabricCode: string;
    fabricName: string;
    greige?: { id: string; greigeCode: string; greigeName: string } | null;
  } | null;
  greige?: { id: string; greigeCode: string; greigeName: string } | null;
}

export interface OrderBOMItemInput {
  // BUG-ORD12 fix: include IDs in update
  id?: string;
  materialType: OrderBOMItemMaterialType;
  materialId?: string;
  buttonId?: string;
  threadId?: string;
  zipperId?: string;
  laceId?: string;
  elasticId?: string;
  labelId?: string;
  packagingId?: string;
  fabricId?: string;
  quantityPerGarment: number;
  orderQuantity: number;
  wastagePercent?: number;
  unit: string;
  unitPrice: number;
  componentName?: string;
  usageCategory?: OrderBOMItemUsageCategory;
  notes?: string;
  sortOrder?: number;
}

// ============================================
// Order BOM Types
// ============================================

export interface OrderBOM {
  id: string;
  orderId: string;
  orderItemId?: string | null;
  styleId: string;
  version: number;
  isActive: boolean;
  status: OrderBOMStatus;
  totalMaterialCost?: number | null;
  sourceCostSheetId?: string | null;
  copiedFromOrderId?: string | null;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  order?: {
    id: string;
    orderNumber: string;
    [key: string]: unknown;
  };
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
    buyerStyleRef?: string | null;
    [key: string]: unknown;
  };
  items?: OrderBOMItem[];
  // Prisma _count aggregation — preserved verbatim by the serializer (leading
  // underscore kept). List endpoint returns _count.items for the Items column.
  _count?: {
    items: number;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

// ============================================
// Request Types
// ============================================

export interface CreateOrderBOMFromCostSheetRequest {
  styleId: string;
  costSheetId: string;
  orderItemId?: string;
}

export interface CopyOrderBOMRequest {
  styleId: string;
  orderItemId?: string;
  adjustQuantity?: number;
}

export interface UpdateOrderBOMRequest {
  items: OrderBOMItemInput[];
}

export interface ChangeWidthRequest {
  fabricItemChanges: Array<{
    bomItemId: string;
    newCadId: string;
  }>;
}

export interface FabricCadOption {
  id: string;
  fabricId?: string;
  cutableWidth: number;
  cadAverage?: number;
  totalCostPerMeter?: number;
  cadMeters?: number;
  cadWastagePercent?: number;
  markerEfficiency?: number;
}

// ============================================
// Query Types
// ============================================

export interface OrderBOMFilters {
  orderId?: string;
  styleId?: string;
  status?: OrderBOMStatus;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// ============================================
// Response Types
// ============================================

export interface OrderBOMResponse {
  success: boolean;
  data: OrderBOM;
  message?: string;
}

export interface OrderBOMListResponse {
  success: boolean;
  data: OrderBOM[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Material Requirement Types
// ============================================

export interface OrderBOMMaterialRequirement {
  materialType: string;
  materialName: string;
  materialCode: string;
  quantityPerGarment: number;
  orderQuantity: number;
  baseQuantity: number;
  wastagePercent: number;
  wastageQuantity: number;
  totalQuantity: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
}

export interface OrderBOMRequirementsSummary {
  totalItems: number;
  totalMaterialCost: number;
  requirements: OrderBOMMaterialRequirement[];
  byCategory: {
    [category: string]: {
      itemCount: number;
      totalCost: number;
    };
  };
}

export interface OrderBOMRequirementsResponse {
  success: boolean;
  data: OrderBOMRequirementsSummary;
}
