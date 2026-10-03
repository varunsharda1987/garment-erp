// Greige Stock Service - API calls for greige stock
import api from '@/lib/api';
import type { GreigeStockSummary } from '../types/greigeStock.types';
import type { GreigeStockDetail, UpdateGreigeStockData } from '../types/style-stock.types';

const BASE_URL = '/greige';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface GreigeStockEntry {
  id: string;
  greigeId: string;
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  greigeWidth: number;
  cutableWidth?: number;
  purchaseCost?: number;
  weightedAvgCost?: number;
  warehouseLocation?: string;
  rollNumbers?: string;
  qualityGrade: string;
  status: string;
  greige: {
    id: string;
    greigeCode: string;
    greigeName: string;
    composition: string;
    yarnCount?: string;
    construction?: string;
    weaveType?: string;
  };
  /** The processor holding the lot (delivered straight there, or parked by a Stock-Out), if any */
  processorId?: string | null;
  processor?: { id: string; name: string } | null;
  /** A processor's unit reads warehouseType JOB_WORK with supplierId = that processor */
  warehouse?: { id: string; warehouseName: string; warehouseType?: string; supplierId?: string | null } | null;
  receivedDate?: string;
  weaver?: { id: string; name: string } | null;
}

/** POST /greige/stock/:stockId/pieces — "Record bales & thans" on a lot that has no list */
export interface RecordLotPiecesPayload {
  entryMode: 'THAN_WISE' | 'BALE_WISE' | 'ROLL_WISE';
  pieces: Array<{
    /** Bale-wise: the dialog's bale 1, 2, 3… */
    baleNumber?: number | null;
    /** Printed bale number */
    baleNo?: string | null;
    /** Than tag, or the roll number */
    thanNo?: string | null;
    /** COUNTED metres (the tag figure at the lot's fold length) */
    meters: number;
  }>;
  remarks?: string;
}

export interface RecordLotPiecesResult {
  stockId: string;
  greigeCode: string | null;
  recorded: number;
  bales: number;
  detailType: 'THAN' | 'ROLL';
  countedTotal: number;
  actualTotal: number;
  onHand: number;
  foldLengthCm: number | null;
}

// BUG-GR11 fix: added return type
export interface GreigeStockAdjustmentResult {
  stockId: string;
  adjustmentType: 'INCREASE' | 'DECREASE';
  quantity: number;
  reason: string;
  remarks?: string;
  previousQuantity: number;
  newQuantity: number;
}

export const greigeStockService = {
  /**
   * Get greige stock summary for unified dashboard
   */
  async getSummary(): Promise<GreigeStockSummary> {
    const response = await api.get<ApiResponse<GreigeStockSummary>>(`${BASE_URL}/summary`);
    return response.data.data;
  },

  /**
   * Get individual greige stock entries (available, with IDs for challan issuance)
   * @param filters.warehouseLocation - Filter by warehouse location
   * @param filters.excludeTransferred - Our stores only: leave out every lot a processor holds
   */
  async listAvailableStock(filters?: {
    warehouseLocation?: string;
    excludeTransferred?: boolean;
  }): Promise<GreigeStockEntry[]> {
    const params = new URLSearchParams();
    if (filters?.warehouseLocation) {
      params.append('warehouseLocation', filters.warehouseLocation);
    }
    if (filters?.excludeTransferred) {
      params.append('excludeTransferred', 'true');
    }
    const queryString = params.toString();
    const url = queryString ? `${BASE_URL}/stock?${queryString}` : `${BASE_URL}/stock`;

    const response = await api.get<ApiResponse<GreigeStockEntry[]>>(url);
    return response.data.data;
  },

  /**
   * Get individual stock entries for a specific greige type (expandable rows)
   */
  async getStockEntriesByGreige(greigeId: string): Promise<GreigeStockDetail[]> {
    const response = await api.get<ApiResponse<GreigeStockDetail[]>>(`${BASE_URL}/stock-entries/${greigeId}`);
    return response.data.data;
  },

  /**
   * Update a greige stock entry
   */
  async updateStock(stockId: string, data: UpdateGreigeStockData): Promise<GreigeStockDetail> {
    const response = await api.patch<ApiResponse<GreigeStockDetail>>(`${BASE_URL}/stock/${stockId}`, data);
    return response.data.data;
  },

  /**
   * Adjust greige stock (increase/decrease with reason)
   */
  // BUG-GR11 fix: added return type
  async adjustStock(
    stockId: string,
    data: {
      adjustmentType: 'INCREASE' | 'DECREASE';
      quantity: number;
      reason: string;
      remarks?: string;
      /** The user confirmed taking metres held for other orders (STOCK_HELD_FOR_ORDER) */
      takeHeld?: boolean;
    }
  ): Promise<GreigeStockAdjustmentResult> {
    const response = await api.post<ApiResponse<GreigeStockAdjustmentResult>>(
      `${BASE_URL}/stock/${stockId}/adjust`,
      data
    );
    return response.data.data;
  },

  /**
   * "Record bales & thans": list the pieces on hand of a lot that has no list. No stock moves.
   */
  async recordPieces(stockId: string, data: RecordLotPiecesPayload): Promise<RecordLotPiecesResult> {
    const response = await api.post<ApiResponse<RecordLotPiecesResult>>(`${BASE_URL}/stock/${stockId}/pieces`, data);
    return response.data.data;
  },
};

export default greigeStockService;
