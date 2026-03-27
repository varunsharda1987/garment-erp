/**
 * Fabric Stock Service
 * Frontend service for fabric stock operations
 */

import { API_URL } from '../config/api.config';

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
  // Embroidery fields for CAD planning stock filtering
  embroideryId?: string | null;
  embroideryCode?: string | null;
  embroideryName?: string | null;
}

/**
 * Get authentication token from localStorage
 */
function getAuthToken(): string {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) {
    throw new Error('Not authenticated. Please log in again.');
  }

  try {
    const parsed = JSON.parse(authStorage);
    const token = parsed.state?.token;
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }
    return token;
  } catch {
    throw new Error('Failed to parse authentication data. Please log in again.');
  }
}

/**
 * Fabric stock service
 */
export const fabricStockService = {
  /**
   * Update fabric stock record
   */
  updateStock: async (id: string, data: UpdateStockData) => {
    const token = getAuthToken();

    const response = await fetch(`${API_URL}/stock/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to update stock');
    }

    return response.json();
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
    const token = getAuthToken();

    const queryParams = new URLSearchParams();
    if (params?.fabricId) queryParams.append('fabricId', params.fabricId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.qualityGrade) queryParams.append('qualityGrade', params.qualityGrade);
    // Handle embroideryId filter for CAD planning
    // - null or '' means filter for plain (non-embroidered) stock
    // - specific ID means filter for that embroidery design
    if (params?.embroideryId !== undefined) {
      queryParams.append('embroideryId', params.embroideryId ?? 'null');
    }

    const url = `${API_URL}/styles/${styleId}/fabric-stock${queryParams.toString() ? `?${queryParams}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to fetch fabric stock');
    }

    const result = await response.json();
    return result.data || [];
  },

  /**
   * Delete fabric stock record
   * Will block if dependencies exist
   */
  deleteStock: async (id: string) => {
    const token = getAuthToken();

    const response = await fetch(`${API_URL}/stock/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();

      // Enhanced error formatting for dependency errors
      if (error.dependencies && Array.isArray(error.dependencies)) {
        const formattedDeps = error.dependencies.map((dep: string) => `• ${dep}`).join('\n');
        const fullMessage = `${error.error}\n\n${error.details}\n\n${formattedDeps}`;

        if (error.suggestions && Array.isArray(error.suggestions)) {
          const formattedSuggestions = error.suggestions.map((s: string) => `• ${s}`).join('\n');
          throw new Error(`${fullMessage}\n\nSuggestions:\n${formattedSuggestions}`);
        }

        throw new Error(fullMessage);
      }

      throw new Error(error.error || error.message || 'Failed to delete stock');
    }

    return response.json();
  },
};
