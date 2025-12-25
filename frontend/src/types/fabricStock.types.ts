// Fabric Stock Summary Types

export interface WarehouseStock {
  warehouseName: string;
  meters: number;
  value?: number;
}

export interface QualityGradeBreakdown {
  A: number;
  B: number;
  DEFECT: number;
}

export interface FabricStockSummary {
  totalMeters: number;
  totalValue: number;
  agingStockCount: number;
  totalItems: number;
  byQualityGrade: QualityGradeBreakdown;
  byWarehouse: WarehouseStock[];
}
