/**
 * Cost Sheet Service
 *
 * Handles variance calculation for procurement cost sheets
 * Auto-calculates budget vs actual variances
 * Determines variance approval status based on buffer thresholds
 */

import { PrismaClient, CostSheetVarianceStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface VarianceCalculationResult {
  fabricVariance: number | null;
  fabricVariancePercent: number | null;
  trimsVariance: number | null;
  trimsVariancePercent: number | null;
  cmtVariance: number | null;
  cmtVariancePercent: number | null;
  embroideryVariance: number | null;
  embroideryVariancePercent: number | null;
  accessoriesVariance: number | null;
  accessoriesVariancePercent: number | null;
  totalVariance: number | null;
  totalVariancePercent: number | null;
  varianceStatus: CostSheetVarianceStatus;
}

/**
 * Calculate variance for a cost sheet
 *
 * Compares actual costs vs budget for each category
 * Checks if variance exceeds buffer thresholds
 * Auto-determines variance approval status
 *
 * @param costSheetId - ID of the cost sheet to calculate variance for
 * @returns Updated cost sheet with calculated variance fields
 */
export async function calculateVariance(costSheetId: string) {
  // Fetch cost sheet with all budget and actual values
  const costSheet = await prisma.style_costing.findUnique({
    where: { id: costSheetId },
  });

  if (!costSheet) {
    throw new Error(`Cost sheet ${costSheetId} not found`);
  }

  // Only calculate variance for PROCUREMENT_PRODUCTION mode
  if (costSheet.purpose !== 'PROCUREMENT_PRODUCTION') {
    throw new Error('Variance calculation only applies to PROCUREMENT_PRODUCTION cost sheets');
  }

  const result: VarianceCalculationResult = {
    fabricVariance: null,
    fabricVariancePercent: null,
    trimsVariance: null,
    trimsVariancePercent: null,
    cmtVariance: null,
    cmtVariancePercent: null,
    embroideryVariance: null,
    embroideryVariancePercent: null,
    accessoriesVariance: null,
    accessoriesVariancePercent: null,
    totalVariance: null,
    totalVariancePercent: null,
    varianceStatus: 'PENDING',
  };

  let hasAnyActuals = false;
  let exceedsBuffer = false;

  // ==========================================
  // Calculate Fabric Variance
  // ==========================================
  if (costSheet.fabricActual !== null && costSheet.fabricBudget !== null) {
    hasAnyActuals = true;
    result.fabricVariance = parseFloat((Number(costSheet.fabricActual) - Number(costSheet.fabricBudget)).toFixed(2));

    if (Number(costSheet.fabricBudget) !== 0) {
      result.fabricVariancePercent = parseFloat(
        ((result.fabricVariance / Number(costSheet.fabricBudget)) * 100).toFixed(2)
      );

      // Check if exceeds buffer
      if (Math.abs(result.fabricVariancePercent) > Number(costSheet.fabricBufferPercent || 5)) {
        exceedsBuffer = true;
      }
    }
  }

  // ==========================================
  // Calculate Trims Variance
  // ==========================================
  if (costSheet.trimsActual !== null && costSheet.trimsBudget !== null) {
    hasAnyActuals = true;
    result.trimsVariance = parseFloat((Number(costSheet.trimsActual) - Number(costSheet.trimsBudget)).toFixed(2));

    if (Number(costSheet.trimsBudget) !== 0) {
      result.trimsVariancePercent = parseFloat(
        ((result.trimsVariance / Number(costSheet.trimsBudget)) * 100).toFixed(2)
      );

      if (Math.abs(result.trimsVariancePercent) > Number(costSheet.trimsBufferPercent || 10)) {
        exceedsBuffer = true;
      }
    }
  }

  // ==========================================
  // Calculate CMT Variance
  // ==========================================
  if (costSheet.cmtActual !== null && costSheet.cmtBudget !== null) {
    hasAnyActuals = true;
    result.cmtVariance = parseFloat((Number(costSheet.cmtActual) - Number(costSheet.cmtBudget)).toFixed(2));

    if (Number(costSheet.cmtBudget) !== 0) {
      result.cmtVariancePercent = parseFloat(
        ((result.cmtVariance / Number(costSheet.cmtBudget)) * 100).toFixed(2)
      );

      if (Math.abs(result.cmtVariancePercent) > Number(costSheet.cmtBufferPercent || 5)) {
        exceedsBuffer = true;
      }
    }
  }

  // ==========================================
  // Calculate Embroidery Variance
  // ==========================================
  if (costSheet.embroideryActual !== null && costSheet.embroideryBudget !== null) {
    hasAnyActuals = true;
    result.embroideryVariance = parseFloat((Number(costSheet.embroideryActual) - Number(costSheet.embroideryBudget)).toFixed(2));

    if (Number(costSheet.embroideryBudget) !== 0) {
      result.embroideryVariancePercent = parseFloat(
        ((result.embroideryVariance / Number(costSheet.embroideryBudget)) * 100).toFixed(2)
      );

      if (Math.abs(result.embroideryVariancePercent) > Number(costSheet.embroideryBufferPercent || 8)) {
        exceedsBuffer = true;
      }
    }
  }

  // ==========================================
  // Calculate Accessories Variance
  // ==========================================
  if (costSheet.accessoriesActual !== null && costSheet.accessoriesBudget !== null) {
    hasAnyActuals = true;
    result.accessoriesVariance = parseFloat((Number(costSheet.accessoriesActual) - Number(costSheet.accessoriesBudget)).toFixed(2));

    if (Number(costSheet.accessoriesBudget) !== 0) {
      result.accessoriesVariancePercent = parseFloat(
        ((result.accessoriesVariance / Number(costSheet.accessoriesBudget)) * 100).toFixed(2)
      );

      if (Math.abs(result.accessoriesVariancePercent) > Number(costSheet.accessoriesBufferPercent || 10)) {
        exceedsBuffer = true;
      }
    }
  }

  // ==========================================
  // Calculate Total Variance
  // ==========================================
  if (costSheet.totalActual !== null && costSheet.totalBudget !== null) {
    result.totalVariance = parseFloat((Number(costSheet.totalActual) - Number(costSheet.totalBudget)).toFixed(2));

    if (Number(costSheet.totalBudget) !== 0) {
      result.totalVariancePercent = parseFloat(
        ((result.totalVariance / Number(costSheet.totalBudget)) * 100).toFixed(2)
      );
    }
  }

  // ==========================================
  // Determine Variance Status
  // ==========================================
  if (!hasAnyActuals) {
    result.varianceStatus = 'PENDING';
  } else if (exceedsBuffer) {
    result.varianceStatus = 'REQUIRES_APPROVAL';
  } else {
    result.varianceStatus = 'WITHIN_BUDGET';
  }

  // ==========================================
  // Update Cost Sheet with Calculated Values
  // ==========================================
  const updatedCostSheet = await prisma.style_costing.update({
    where: { id: costSheetId },
    data: {
      fabricVariance: result.fabricVariance,
      fabricVariancePercent: result.fabricVariancePercent,
      trimsVariance: result.trimsVariance,
      trimsVariancePercent: result.trimsVariancePercent,
      cmtVariance: result.cmtVariance,
      cmtVariancePercent: result.cmtVariancePercent,
      embroideryVariance: result.embroideryVariance,
      embroideryVariancePercent: result.embroideryVariancePercent,
      accessoriesVariance: result.accessoriesVariance,
      accessoriesVariancePercent: result.accessoriesVariancePercent,
      totalVariance: result.totalVariance,
      totalVariancePercent: result.totalVariancePercent,
      varianceStatus: result.varianceStatus,
    },
  });

  return updatedCostSheet;
}

/**
 * Update cost sheet actuals from procurement/production events
 *
 * Called when:
 * - Purchase Order is created (fabricActual, trimsActual)
 * - GRN is created (refined actuals)
 * - Work Order is completed (cmtActual)
 *
 * Auto-triggers variance calculation after update
 *
 * @param params - Update parameters
 * @returns Updated cost sheet
 */
export async function updateCostSheetActuals(params: {
  styleId: string;
  category: 'FABRIC' | 'TRIMS' | 'CMT' | 'EMBROIDERY' | 'ACCESSORIES' | 'TOTAL';
  actualCost: number;
  source?: 'PO' | 'GRN' | 'WORK_ORDER' | 'MANUAL';
}) {
  const { styleId, category, actualCost, source = 'MANUAL' } = params;

  // Find PROCUREMENT_PRODUCTION cost sheet for this style
  const costSheet = await prisma.style_costing.findFirst({
    where: {
      styleId,
      purpose: 'PROCUREMENT_PRODUCTION',
      supersededById: null, // Only get current version
    },
  });

  if (!costSheet) {
    throw new Error(
      `No PROCUREMENT_PRODUCTION cost sheet found for style ${styleId}. ` +
      `Actual costs can only be updated for procurement cost sheets.`
    );
  }

  // Map category to actual field name
  const actualFieldMap: Record<typeof category, string> = {
    FABRIC: 'fabricActual',
    TRIMS: 'trimsActual',
    CMT: 'cmtActual',
    EMBROIDERY: 'embroideryActual',
    ACCESSORIES: 'accessoriesActual',
    TOTAL: 'totalActual',
  };

  const actualField = actualFieldMap[category];

  // Update actual field
  await prisma.style_costing.update({
    where: { id: costSheet.id },
    data: {
      [actualField]: actualCost,
    },
  });

  // Auto-calculate variance after updating actuals
  const updatedCostSheet = await calculateVariance(costSheet.id);

  return updatedCostSheet;
}
