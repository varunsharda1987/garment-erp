// Dashboard Types
import type { FabricStockSummary } from './fabricStock.types';
import type { GreigeStockSummary } from './greigeStock.types';

export interface MaterialTypeSummary {
  materialType: string;
  count: number;
  value: number;
}

export interface TrimStockSummary {
  totalValue: number;
  totalMaterials: number;
  lowStockCount: number;
  byMaterialType: MaterialTypeSummary[];
}

export interface CombinedMetrics {
  totalValue: number;
  lowStockCount: number;
  totalMaterials: number;
}

export interface InventoryDashboardSummary {
  fabric: FabricStockSummary;
  greige: GreigeStockSummary;
  trims: TrimStockSummary;
  combined: CombinedMetrics;
}
