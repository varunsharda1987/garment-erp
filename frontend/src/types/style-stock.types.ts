// Style Stock Types

export interface StyleStockEntry {
  fabricId: string;
  quantity: number;
  width: number;
  rollNumbers?: string;
  warehouseLocation?: string;
  qualityGrade?: 'A' | 'B' | 'DEFECT';
  purchaseCost?: number;
  receivedDate?: Date;
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
}

export interface ComponentWithFabrics {
  componentName: string;
  componentType: string;
  fabrics: FabricWithCAD[];
}
