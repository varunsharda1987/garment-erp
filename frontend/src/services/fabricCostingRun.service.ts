/**
 * Fabric Costing Run Service
 * API service for managing costing runs
 */

import api from '../lib/api';
import type { PrintingType } from '../types/generated/prisma-enums';

/**
 * One fabric of a run, FROZEN when the run was saved (fabric_costing_run_items). A run keeps these
 * figures even after its fabrics are re-costed or saved into a later run; `change` and `now` say
 * how today's costing of that fabric differs.
 */
export interface CostingRunFabric {
  id: string;
  cadId: string | null;
  /** Recorded after the fact: the run was saved before runs kept their own record */
  backfilled: boolean;
  recordedAt: string;
  componentName: string | null;
  greige: { greigeCode: string | null; greigeName: string | null } | null;
  cutableWidth: number | null;
  cadAverage: number | null;
  orderQuantityPcs: number | null;
  costedAtQuantityMeters: number | null;
  costedRateIsBatch: boolean;
  batchColorName: string | null;
  costInputMode: string | null;
  greigeCostPerMeter: number | null;
  greigeRateSource: 'PURCHASE_ORDER' | 'PROCUREMENT' | 'STOCK_VALUATION' | 'GREIGE_MASTER' | 'MANUAL_OVERRIDE' | null;
  greigeRateSourceRef: string | null;
  greigeRateSourceDate: string | null;
  greigeRateOverrideReason: string | null;
  transportCostPerMeter: number | null;
  processor: { id: string; name: string | null } | null;
  processingType: string | null;
  printingType: PrintingType | null;
  numberOfColors: number | null;
  processingPricePerMeter: number | null;
  shrinkagePercent: number | null;
  shrinkageCostPerMeter: number | null;
  screenType: string | null;
  screenCostPerMeter: number | null;
  totalCostPerMeter: number | null;
  costPerGarment: number | null;
  /** The price approval this fabric had when the run was saved */
  costingApprovalStatus: string | null;
  /** null = today's costing still says the same; CHANGED = re-costed since; REMOVED = costing removed */
  change: 'CHANGED' | 'REMOVED' | null;
  now: { totalCostPerMeter: number | null; cadAverage: number | null; costPerGarment: number | null } | null;
  /** The fabric was saved again into this later run */
  laterRunName: string | null;
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
  /** Fabrics re-costed (or whose costing was removed) since the run was saved */
  changedCount: number;
  /** The run was saved before runs kept their own record; its figures were recorded later */
  backfilled: boolean;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  style?: {
    id: string;
    styleCode: string;
    buyerStyleRef?: string | null;
    styleName: string;
    customerName: string;
  };
}

/**
 * Get all costing runs for a style
 */
export async function getRunsByStyle(styleId: string, purpose?: string): Promise<CostingRun[]> {
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
export async function createRun(styleId: string, purpose: string, fabricCadIds: string[]): Promise<CostingRun> {
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
