/**
 * Fabric Stock Service
 * Frontend service for fabric stock operations
 */

import api from '@/lib/api';

// Type definitions for stock operations
export interface UpdateStockData {
  purchaseCost?: number;
  weightedAvgCost?: number;
  qualityGrade?: 'A' | 'B' | 'DEFECT';
  warehouseLocation?: string;
  rackNumber?: string;
  rollNumbers?: string;
}

export type { UpdateStockData as UpdateStockDataType };

export interface StockData {
  id: string;
  fabricId: string;
  fabric: {
    fabricCode: string;
    fabricName: string;
    colorName?: string;
  };
  quantityAvailable: number;
  purchaseCost: number;
  weightedAvgCost: number;
  qualityGrade: 'A' | 'B' | 'DEFECT';
  warehouseLocation?: string;
  rackNumber?: string;
  rollNumbers?: string;
  status: string;
}

export interface FabricStockForCAD {
  id: string;
  fabricId: string;
  fabricName: string;
  fabricCode: string;
  colorName?: string;
  greigeId: string;
  greigeName: string;
  finishedWidth: number;
  cutableWidth: number;
  quantityAvailable: number;
  qualityGrade: 'A' | 'B' | 'DEFECT';
  rollNumbers?: string;
  receivedDate: string;
  procurementId?: string;
  originStyleId?: string;
  originOrderId?: string;
  status: string;
  embroideryId?: string | null;
  embroideryCode?: string | null;
  embroideryName?: string | null;
}

/**
 * Fabric stock service
 */
export const fabricStockService = {
  /**
   * Update fabric stock record
   */
  updateStock: async (id: string, data: UpdateStockData) => {
    const response = await api.patch(`/stock/${id}`, data);
    return response.data;
  },

  /**
   * Get fabric stock for a specific style (for CAD planning)
   * Returns stock entries that are available for the style
   *
   * @param styleId - The style ID to get stock for
   * @param params.fabricId - Filter by specific fabric
   * @param params.status - Filter by stock status
   * @param params.qualityGrade - Filter by quality grade
   * @param params.embroideryId - Filter by embroidery status:
   *   - undefined: Return all stock (no embroidery filter)
   *   - null or '': Return only plain (non-embroidered) stock
   *   - '<uuid>': Return only stock with specific embroidery design
   */
  getStockForStyle: async (
    styleId: string,
    params?: {
      fabricId?: string;
      status?: string;
      qualityGrade?: string;
      embroideryId?: string | null;
    }
  ): Promise<FabricStockForCAD[]> => {
    const queryParams = new URLSearchParams();
    if (params?.fabricId) queryParams.append('fabricId', params.fabricId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.qualityGrade) queryParams.append('qualityGrade', params.qualityGrade);
    if (params?.embroideryId !== undefined) {
      queryParams.append('embroideryId', params.embroideryId ?? 'null');
    }

    const url = `/styles/${styleId}/fabric-stock${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await api.get<{ data: FabricStockForCAD[] }>(url);
    return response.data.data || [];
  },

  /**
   * Adjust fabric stock quantity (increase/decrease with reason)
   * Backend: POST /api/stock/adjust
   */
  adjustStock: async (
    stockId: string,
    data: { adjustmentType: 'INCREASE' | 'DECREASE'; quantity: number; reason: string; notes?: string }
  ) => {
    const response = await api.post('/stock/adjust', { stockId, ...data });
    return response.data;
  },

  /**
   * Delete fabric stock record
   * Will block if dependencies exist
   */
  deleteStock: async (id: string) => {
    const response = await api.delete(`/stock/${id}`);
    return response.data;
  },
};
