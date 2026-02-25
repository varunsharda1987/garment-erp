/**
 * Fabric Costing Run Service
 * API service for managing costing runs
 */

import api from '../lib/api';

export interface CostingRunFabric {
  id: string;
  componentName: string | null;
  cutableWidth: number;
  orderQuantityPcs: number | null;
  cadAverage: number | null;
  totalCostPerMeter: number | null;
  costPerGarment: number | null;
  greigeId?: string;
  greige?: {
    greigeCode: string;
    greigeName: string;
  };
  processor?: {
    id: string;
    name: string;
  };
}

export interface CostingRun {
  id: string;
  styleId: string;
  purpose: 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION';
  runNumber: number;
  runName: string;
  totalFabricCost: number | null;
  fabricCount: number;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
  fabrics: CostingRunFabric[];
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
    customerName: string;
  };
}

/**
 * Get all costing runs for a style
 */
export async function getRunsByStyle(
  styleId: string,
  purpose?: string
): Promise<CostingRun[]> {
  const params = purpose ? `?purpose=${purpose}` : '';
  const response = await api.get(`/fabric-costing-runs/style/${styleId}${params}`);
  return response.data.data;
}

/**
 * Get a single costing run by ID
 */
export async function getRunById(runId: string): Promise<CostingRun> {
  const response = await api.get(`/fabric-costing-runs/${runId}`);
  return response.data.data;
}

/**
 * Create a new costing run
 */
export async function createRun(
  styleId: string,
  purpose: string,
  fabricCadIds: string[]
): Promise<CostingRun> {
  const response = await api.post(`/fabric-costing-runs/style/${styleId}`, {
    purpose,
    fabricCadIds,
  });
  return response.data.data;
}

/**
 * Delete a costing run
 */
export async function deleteRun(runId: string): Promise<void> {
  await api.delete(`/fabric-costing-runs/${runId}`);
}

/**
 * Recalculate totals for a costing run
 */
export async function recalculateRunTotals(runId: string): Promise<CostingRun> {
  const response = await api.patch(`/fabric-costing-runs/${runId}/recalculate`);
  return response.data.data;
}

export default {
  getRunsByStyle,
  getRunById,
  createRun,
  deleteRun,
  recalculateRunTotals,
};
