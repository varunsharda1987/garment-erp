// Style Stock Types

export interface StyleStockEntry {
  fabricId: string;
  quantity: number;
  finishedWidth: number;
  cutableWidth: number;
  rollNumbers?: string;
  warehouseLocation?: string;
  qualityGrade?: 'A' | 'B' | 'DEFECT';
  purchaseCost?: number;
  receivedDate?: Date;
  patternPartId?: string;
  fabricFinishType?: 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW';
}

export interface StyleFabricStock {
  fabricId: string;
  fabricCode: string;
  fabricName: string;
  componentName: string;
  requiredPerGarment: number;
  availableStock: number;
  reservedStock: number;
  consumedStock: number;
  canMakeGarments: number;
}

// Stock status filter type (maps to Prisma StockStatus enum)
export type StockStatusFilter = 'AVAILABLE' | 'RESERVED' | 'EXHAUSTED' | 'ALL';

export interface StyleStockAvailability {
  canMakeGarments: number;
  fabricStocks: StyleFabricStock[];
  bottleneckFabric?: StyleFabricStock;
  statusFilter?: StockStatusFilter;
}

export interface FabricWithCAD {
  fabricId: string;
  fabricCode: string;
  fabricName: string;
  description?: string;
  greige?: {
    greigeCode: string;
    greigeName: string;
    composition: string;
  };
  widthCADs?: Array<{
    id: string;
    cutableWidth: number;
    cadMeters?: number;
    actualCad?: number;
    cadVariancePercent?: number;
  }>;
  quantityNeeded: number;
  fabricFinishType?: 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW' | null;
  actualWidth?: number | null;
  cutableWidth?: number | null;
  allocatedPatternParts?: Array<{ id: string; code: string; name: string }>;
}

export interface PatternPartOption {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

export interface ComponentWithFabrics {
  componentName: string;
  componentType: string;
  componentId: string;
  patternParts: PatternPartOption[];
  fabrics: FabricWithCAD[];
}

export interface UnlinkedFabric {
  fabricName: string;
  componentName: string;
  componentId?: string;
  finishType?: string;
}

export interface StyleFabricsResponse {
  components: ComponentWithFabrics[];
  unlinkedFabrics: UnlinkedFabric[];
}

/**
 * Response of POST /api/styles/:styleId/stock-entry
 * (StyleStockController.createStyleStock → FabricStockService.bulkCreateStyleStock)
 */
export interface StyleStockCreateResponse {
  success: boolean;
  message: string;
  data: {
    /** Number of entries created successfully */
    success: number;
    /** Number of entries that failed */
    failed: number;
    errors: Array<{ fabricId: string; error: string }>;
  };
}

export interface FabricStyleUsage {
  styleId: string;
  styleCode: string;
  styleName: string;
  buyerStyleRef?: string | null;
  quantityPerGarment: number;
  componentName: string;
  stockAllocated?: number;
  stockConsumed?: number;
}

export interface FabricStockHistoryEntry {
  id: string;
  quantity: number;
  width: number;
  rollNumbers?: string;
  warehouseLocation?: string;
  purchaseCost?: number;
  receivedDate: string;
  createdAt: string;
}

export interface GreigeStockCreateResponse {
  message: string;
  stockEntry: {
    id: string;
    greigeId: string;
    quantity: number;
    createdAt: string;
  };
}

export interface GenericGreigeStock {
  greigeId: string;
  greigeCode: string;
  greigeName: string;
  composition: string;
  greigeQuality: string | null;
  weaver: string | null;
  totalStock: number;
  unit: string;
  totalValue: number;
  maxAgingDays: number;
  greigeWidth: number | null;
  cutableWidth: number | null;
  qualityGrades: string[];
  warehouses: string[];
  suppliers: Array<{ id: string; name: string; code: string }>;
  processors: Array<{ id: string; name: string; code: string }>;
  statuses: string[];
  entryCount: number;
  totalBales: number;
  totalThans: number;
}

export interface GreigeStockDetail {
  id: string;
  greigeId: string;
  greige: {
    id: string;
    greigeCode: string;
    greigeName: string;
    composition: string;
  };
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  greigeWidth: number;
  cutableWidth: number | null;
  purchaseCost: number | null;
  weightedAvgCost: number | null;
  warehouseLocation: string | null;
  rollNumbers: string | null;
  qualityGrade: string;
  receivedDate: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  agingDays: number;
  status: string;
  stockType: string;
  sourceType: string | null;
  supplierId: string | null;
  supplier: { id: string; name: string; code: string } | null;
  processorId: string | null;
  processor: { id: string; name: string; code: string } | null;
  sourceChallanId: string | null;
  sourceChallan: { id: string; challanNumber: string; challanDate: string } | null;
}

export interface UpdateGreigeStockData {
  purchaseCost?: number;
  weightedAvgCost?: number;
  qualityGrade?: string;
  warehouseLocation?: string;
  rollNumbers?: string;
}
