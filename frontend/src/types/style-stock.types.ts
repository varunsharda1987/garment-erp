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
  canMakeGarments: number;
}

export interface StyleStockAvailability {
  canMakeGarments: number;
  fabricStocks: StyleFabricStock[];
  bottleneckFabric?: StyleFabricStock;
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
    availableWidth: number;
    cadMeters?: number;
    actualCad?: number;
    cadVariancePercent?: number;
  }>;
  quantityNeeded: number;
  fabricFinishType?: 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW' | null;
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

export interface StyleStockCreateResponse {
  message: string;
  stockEntries: Array<{
    id: string;
    fabricId: string;
    quantity: number;
    createdAt: string;
  }>;
}

export interface FabricStyleUsage {
  styleId: string;
  styleCode: string;
  styleName: string;
  quantityPerGarment: number;
  componentName: string;
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
  totalStock: number;
  unit: string;
}
