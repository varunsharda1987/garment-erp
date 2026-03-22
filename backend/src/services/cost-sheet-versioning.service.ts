/**
 * Cost Sheet Versioning Service
 *
 * Handles automatic versioning of cost sheets when costs change significantly
 * Manages version history and locking for orders
 */

import prisma from '../config/database';
import { randomUUID } from 'crypto';

const AUTO_VERSION_THRESHOLD_PERCENT = 5; // 5% cost variance triggers new version

export interface CostSheetVersionData {
  styleId: string;
  totalProductCost: number;
  fabricTotal?: number;
  trimsTotal?: number;
  cmtTotal?: number;
  embroideryTotal?: number;
  accessoriesTotal?: number;
  versionReason?: string;
}

export interface VersionComparisonResult {
  version1: {
    id: string;
    version: number;
    totalProductCost: number;
    versionDate: Date;
  };
  version2: {
    id: string;
    version: number;
    totalProductCost: number;
    versionDate: Date;
  };
  costDifference: number;
  percentageChange: number;
  itemizedChanges: {
    fabricTotal: { v1: number; v2: number; diff: number; pct: number };
    trimsTotal: { v1: number; v2: number; diff: number; pct: number };
    cmtTotal: { v1: number; v2: number; diff: number; pct: number };
    embroideryTotal: { v1: number; v2: number; diff: number; pct: number };
    accessoriesTotal: { v1: number; v2: number; diff: number; pct: number };
  };
}

/**
 * Check if new version should be created based on cost variance
 */
export async function shouldCreateNewVersion(
  styleId: string,
  newCostData: CostSheetVersionData
): Promise<{ shouldCreate: boolean; reason: string; costVariancePercent: number | null }> {
  // Get latest version
  const latestVersion = await prisma.style_costing.findFirst({
    where: { styleId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      totalProductCost: true,
      isApproved: true,
    },
  });

  if (!latestVersion) {
    return {
      shouldCreate: true,
      reason: 'First version',
      costVariancePercent: null,
    };
  }

  const oldCost = Number(latestVersion.totalProductCost);
  const newCost = newCostData.totalProductCost;

  // Calculate variance percentage
  const costDifference = Math.abs(newCost - oldCost);
  const costVariancePercent = (costDifference / oldCost) * 100;

  // Auto-version if variance > threshold
  if (costVariancePercent >= AUTO_VERSION_THRESHOLD_PERCENT) {
    return {
      shouldCreate: true,
      reason: `Cost variance ${costVariancePercent.toFixed(2)}% exceeds threshold of ${AUTO_VERSION_THRESHOLD_PERCENT}%`,
      costVariancePercent,
    };
  }

  return {
    shouldCreate: false,
    reason: `Cost variance ${costVariancePercent.toFixed(2)}% is below threshold`,
    costVariancePercent,
  };
}

/**
 * Create new cost sheet version
 */
export async function createCostSheetVersion(
  costData: CostSheetVersionData,
  createdById: string,
  forceNew: boolean = false
): Promise<any> {
  const { styleId, versionReason } = costData;

  // Check if new version needed
  const versionCheck = await shouldCreateNewVersion(styleId, costData);

  if (!forceNew && !versionCheck.shouldCreate) {
    throw new Error(`New version not needed: ${versionCheck.reason}`);
  }

  // Get latest version number
  const latestVersion = await prisma.style_costing.findFirst({
    where: { styleId },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  });

  const newVersion = latestVersion ? latestVersion.version + 1 : 1;

  // Create new cost sheet version
  const newCostSheet = await prisma.style_costing.create({
    data: {
      id: randomUUID(),
      styleId,
      version: newVersion,
      versionDate: new Date(),
      versionReason: versionReason || versionCheck.reason,
      costVariancePercent: versionCheck.costVariancePercent,
      supersededById: latestVersion?.id || null,
      lockedForOrders: false,
      isApproved: false, // New versions require approval
      createdById,
      // Cost fields would be populated from costData
      totalProductCost: costData.totalProductCost,
      fabricTotal: costData.fabricTotal,
      trimsTotal: costData.trimsTotal,
      cmtTotal: costData.cmtTotal,
      embroideryTotal: costData.embroideryTotal,
      accessoriesTotal: costData.accessoriesTotal,
      // All other cost fields default to 0 as per schema
    },
    include: {
      styles: {
        select: {
          id: true,
          styleName: true,
          styleCode: true,
        },
      },
      supersededBy: {
        select: {
          id: true,
          version: true,
          totalProductCost: true,
        },
      },
    },
  });

  return newCostSheet;
}

/**
 * Lock cost sheet version for an order (prevents editing)
 */
export async function lockCostSheetForOrder(costSheetId: string, orderId: string): Promise<void> {
  await prisma.style_costing.update({
    where: { id: costSheetId },
    data: { lockedForOrders: true },
  });

  console.log(`Cost sheet ${costSheetId} locked for order ${orderId}`);
}

/**
 * Check if cost sheet can be edited
 */
export async function canEditCostSheet(costSheetId: string): Promise<{
  canEdit: boolean;
  reason: string;
}> {
  const costSheet = await prisma.style_costing.findUnique({
    where: { id: costSheetId },
    select: {
      id: true,
      version: true,
      lockedForOrders: true,
      isApproved: true,
    },
  });

  if (!costSheet) {
    return { canEdit: false, reason: 'Cost sheet not found' };
  }

  if (costSheet.lockedForOrders) {
    return {
      canEdit: false,
      reason: 'Cost sheet is locked (used in orders). Create new version instead.',
    };
  }

  return { canEdit: true, reason: 'Can edit' };
}

/**
 * Get cost sheet version history
 */
export async function getCostSheetVersions(styleId: string): Promise<any[]> {
  const versions = await prisma.style_costing.findMany({
    where: { styleId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      versionDate: true,
      versionReason: true,
      costVariancePercent: true,
      totalProductCost: true,
      fabricTotal: true,
      trimsTotal: true,
      cmtTotal: true,
      embroideryTotal: true,
      accessoriesTotal: true,
      lockedForOrders: true,
      isApproved: true,
      approvedAt: true,
      createdAt: true,
      supersededById: true,
    },
  });

  return versions;
}

/**
 * Compare two cost sheet versions
 */
export async function compareCostSheetVersions(
  version1Id: string,
  version2Id: string
): Promise<VersionComparisonResult> {
  const [v1, v2] = await Promise.all([
    prisma.style_costing.findUnique({
      where: { id: version1Id },
      select: {
        id: true,
        version: true,
        totalProductCost: true,
        fabricTotal: true,
        trimsTotal: true,
        cmtTotal: true,
        embroideryTotal: true,
        accessoriesTotal: true,
        versionDate: true,
      },
    }),
    prisma.style_costing.findUnique({
      where: { id: version2Id },
      select: {
        id: true,
        version: true,
        totalProductCost: true,
        fabricTotal: true,
        trimsTotal: true,
        cmtTotal: true,
        embroideryTotal: true,
        accessoriesTotal: true,
        versionDate: true,
      },
    }),
  ]);

  if (!v1 || !v2) {
    throw new Error('One or both cost sheet versions not found');
  }

  const totalCost1 = Number(v1.totalProductCost);
  const totalCost2 = Number(v2.totalProductCost);
  const costDifference = totalCost2 - totalCost1;
  const percentageChange = (costDifference / totalCost1) * 100;

  const calculateChange = (val1: any, val2: any) => {
    const num1 = val1 ? Number(val1) : 0;
    const num2 = val2 ? Number(val2) : 0;
    const diff = num2 - num1;
    const pct = num1 !== 0 ? (diff / num1) * 100 : 0;
    return { v1: num1, v2: num2, diff, pct };
  };

  return {
    version1: {
      id: v1.id,
      version: v1.version,
      totalProductCost: totalCost1,
      versionDate: v1.versionDate,
    },
    version2: {
      id: v2.id,
      version: v2.version,
      totalProductCost: totalCost2,
      versionDate: v2.versionDate,
    },
    costDifference,
    percentageChange,
    itemizedChanges: {
      fabricTotal: calculateChange(v1.fabricTotal, v2.fabricTotal),
      trimsTotal: calculateChange(v1.trimsTotal, v2.trimsTotal),
      cmtTotal: calculateChange(v1.cmtTotal, v2.cmtTotal),
      embroideryTotal: calculateChange(v1.embroideryTotal, v2.embroideryTotal),
      accessoriesTotal: calculateChange(v1.accessoriesTotal, v2.accessoriesTotal),
    },
  };
}

/**
 * Get latest approved cost sheet for a style
 */
export async function getLatestApprovedCostSheet(styleId: string): Promise<any | null> {
  return await prisma.style_costing.findFirst({
    where: {
      styleId,
      isApproved: true,
    },
    orderBy: { version: 'desc' },
    include: {
      fabricItems: true,
    },
  });
}

export default {
  shouldCreateNewVersion,
  createCostSheetVersion,
  lockCostSheetForOrder,
  canEditCostSheet,
  getCostSheetVersions,
  compareCostSheetVersions,
  getLatestApprovedCostSheet,
};
