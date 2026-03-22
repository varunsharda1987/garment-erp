/**
 * Lace Defect Service
 *
 * Business logic for tracking lace defects and managing claims:
 * - Log defects discovered during production
 * - Submit claims to suppliers
 * - Track claim status and resolution
 * - Record replacement materials
 */

import prisma from '../config/database';
import { logInfo, logError, logDebug } from '../utils/logger';

// ============================================
// Types
// ============================================

export type DefectType = 'WEAVE_DEFECT' | 'COLOR_VARIATION' | 'WIDTH_VARIATION' | 'DAMAGE';
export type DiscoveredAt = 'RECEIVING' | 'CUTTING' | 'STITCHING' | 'QC';
export type ClaimStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RESOLVED';

export interface LogDefectInput {
  stockId: string;
  laceId: string;
  orderId?: string;
  styleId?: string;
  defectType: DefectType;
  defectQuantity: number;
  defectDescription?: string;
  discoveredAt: DiscoveredAt;
  photos?: string[];
  discoveredById: string;
}

export interface SubmitClaimInput {
  defectId: string;
  claimReference: string;
  claimAmount: number;
  notes?: string;
}

export interface UpdateClaimStatusInput {
  defectId: string;
  status: ClaimStatus;
  resolution?: string;
}

export interface RecordReplacementInput {
  defectId: string;
  replacementStockId: string;
  replacementQuantity: number;
}

export interface DefectFilters {
  stockId?: string;
  laceId?: string;
  orderId?: string;
  styleId?: string;
  defectType?: DefectType;
  claimStatus?: ClaimStatus;
  discoveredAt?: DiscoveredAt;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================
// Service Functions
// ============================================

/**
 * Log a lace defect discovered during production
 */
export async function logLaceDefect(input: LogDefectInput) {
  logDebug('Logging lace defect', { stockId: input.stockId, defectType: input.defectType });

  // Validate stock exists
  const stock = await prisma.lace_stock.findUnique({
    where: { id: input.stockId },
    include: { laceMaster: true },
  });

  if (!stock) {
    throw new Error('Lace stock not found');
  }

  // Create defect log
  const defect = await prisma.lace_defect_log.create({
    data: {
      stockId: input.stockId,
      laceId: input.laceId,
      orderId: input.orderId,
      styleId: input.styleId,
      defectType: input.defectType,
      defectQuantity: input.defectQuantity,
      defectDescription: input.defectDescription,
      discoveredAt: input.discoveredAt,
      discoveredDate: new Date(),
      discoveredById: input.discoveredById,
      photos: input.photos ? JSON.stringify(input.photos) : null,
      claimStatus: 'PENDING',
      replacementRequired: false,
    },
    include: {
      discoveredBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  logInfo('Lace defect logged', {
    defectId: defect.id,
    stockId: input.stockId,
    defectType: input.defectType,
    defectQuantity: input.defectQuantity,
  });

  return defect;
}

/**
 * Submit a claim to supplier for defective lace
 */
export async function submitClaim(input: SubmitClaimInput) {
  logDebug('Submitting lace defect claim', { defectId: input.defectId });

  const defect = await prisma.lace_defect_log.findUnique({
    where: { id: input.defectId },
  });

  if (!defect) {
    throw new Error('Defect record not found');
  }

  if (defect.claimStatus !== 'PENDING') {
    throw new Error(`Cannot submit claim: current status is ${defect.claimStatus}`);
  }

  const updated = await prisma.lace_defect_log.update({
    where: { id: input.defectId },
    data: {
      claimStatus: 'SUBMITTED',
      claimReference: input.claimReference,
      claimAmount: input.claimAmount,
      claimSubmittedDate: new Date(),
    },
    include: {
      discoveredBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  logInfo('Lace defect claim submitted', {
    defectId: input.defectId,
    claimReference: input.claimReference,
    claimAmount: input.claimAmount,
  });

  return updated;
}

/**
 * Update claim status (approve, reject, resolve)
 */
export async function updateClaimStatus(input: UpdateClaimStatusInput) {
  logDebug('Updating claim status', { defectId: input.defectId, status: input.status });

  const defect = await prisma.lace_defect_log.findUnique({
    where: { id: input.defectId },
  });

  if (!defect) {
    throw new Error('Defect record not found');
  }

  // Validate status transition
  const validTransitions: Record<string, string[]> = {
    PENDING: ['SUBMITTED'],
    SUBMITTED: ['APPROVED', 'REJECTED'],
    APPROVED: ['RESOLVED'],
    REJECTED: ['RESOLVED'],
    RESOLVED: [],
  };

  if (!validTransitions[defect.claimStatus]?.includes(input.status)) {
    throw new Error(`Invalid status transition: ${defect.claimStatus} -> ${input.status}`);
  }

  const updateData: any = {
    claimStatus: input.status,
  };

  if (input.status === 'RESOLVED') {
    updateData.claimResolvedDate = new Date();
    updateData.claimResolution = input.resolution;
  }

  const updated = await prisma.lace_defect_log.update({
    where: { id: input.defectId },
    data: updateData,
    include: {
      discoveredBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  logInfo('Claim status updated', {
    defectId: input.defectId,
    newStatus: input.status,
  });

  return updated;
}

/**
 * Record replacement material for defect
 */
export async function recordReplacement(input: RecordReplacementInput) {
  logDebug('Recording replacement material', { defectId: input.defectId });

  const defect = await prisma.lace_defect_log.findUnique({
    where: { id: input.defectId },
  });

  if (!defect) {
    throw new Error('Defect record not found');
  }

  // Validate replacement stock exists
  const replacementStock = await prisma.lace_stock.findUnique({
    where: { id: input.replacementStockId },
  });

  if (!replacementStock) {
    throw new Error('Replacement stock not found');
  }

  const updated = await prisma.lace_defect_log.update({
    where: { id: input.defectId },
    data: {
      replacementRequired: true,
      replacementStockId: input.replacementStockId,
      replacementQuantity: input.replacementQuantity,
    },
    include: {
      discoveredBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  logInfo('Replacement recorded', {
    defectId: input.defectId,
    replacementStockId: input.replacementStockId,
    replacementQuantity: input.replacementQuantity,
  });

  return updated;
}

/**
 * Get defect by ID
 */
export async function getDefectById(id: string) {
  const defect = await prisma.lace_defect_log.findUnique({
    where: { id },
    include: {
      discoveredBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (defect && defect.photos) {
    try {
      (defect as any).photos = JSON.parse(defect.photos);
    } catch {
      // Leave as string if not valid JSON
    }
  }

  return defect;
}

/**
 * Get defects with filters and pagination
 */
export async function getDefects(filters: DefectFilters) {
  const {
    stockId,
    laceId,
    orderId,
    styleId,
    defectType,
    claimStatus,
    discoveredAt,
    search,
    page = 1,
    limit = 20,
  } = filters;

  const where: any = {};

  if (stockId) where.stockId = stockId;
  if (laceId) where.laceId = laceId;
  if (orderId) where.orderId = orderId;
  if (styleId) where.styleId = styleId;
  if (defectType) where.defectType = defectType;
  if (claimStatus) where.claimStatus = claimStatus;
  if (discoveredAt) where.discoveredAt = discoveredAt;

  if (search) {
    where.OR = [
      { defectDescription: { contains: search, mode: 'insensitive' } },
      { claimReference: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [defects, total] = await Promise.all([
    prisma.lace_defect_log.findMany({
      where,
      include: {
        discoveredBy: { select: { id: true, firstName: true, lastName: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { discoveredDate: 'desc' },
    }),
    prisma.lace_defect_log.count({ where }),
  ]);

  // Parse photos JSON for each defect
  const parsedDefects = defects.map((defect) => {
    if (defect.photos) {
      try {
        (defect as any).photos = JSON.parse(defect.photos);
      } catch {
        // Leave as string if not valid JSON
      }
    }
    return defect;
  });

  return {
    data: parsedDefects,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get pending claims dashboard
 */
export async function getPendingClaims() {
  const claims = await prisma.lace_defect_log.findMany({
    where: {
      claimStatus: { in: ['PENDING', 'SUBMITTED'] },
    },
    include: {
      discoveredBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { discoveredDate: 'desc' },
  });

  // Group by status
  const pending = claims.filter((c) => c.claimStatus === 'PENDING');
  const submitted = claims.filter((c) => c.claimStatus === 'SUBMITTED');

  const totalPendingAmount = pending.reduce((sum, c) => sum + Number(c.defectQuantity || 0), 0);
  const totalSubmittedAmount = submitted.reduce((sum, c) => sum + Number(c.claimAmount || 0), 0);

  return {
    pending: {
      count: pending.length,
      totalQuantity: totalPendingAmount,
      items: pending,
    },
    submitted: {
      count: submitted.length,
      totalClaimAmount: totalSubmittedAmount,
      items: submitted,
    },
  };
}

/**
 * Get defect statistics
 */
export async function getDefectStatistics() {
  const [byType, byDiscoveredAt, byStatus, totalDefects] = await Promise.all([
    prisma.lace_defect_log.groupBy({
      by: ['defectType'],
      _count: true,
      _sum: { defectQuantity: true },
    }),
    prisma.lace_defect_log.groupBy({
      by: ['discoveredAt'],
      _count: true,
    }),
    prisma.lace_defect_log.groupBy({
      by: ['claimStatus'],
      _count: true,
    }),
    prisma.lace_defect_log.count(),
  ]);

  return {
    totalDefects,
    byType: byType.map((t) => ({
      type: t.defectType,
      count: t._count,
      totalQuantity: Number(t._sum.defectQuantity || 0),
    })),
    byDiscoveredAt: byDiscoveredAt.map((d) => ({
      stage: d.discoveredAt,
      count: d._count,
    })),
    byStatus: byStatus.map((s) => ({
      status: s.claimStatus,
      count: s._count,
    })),
  };
}

export default {
  logLaceDefect,
  submitClaim,
  updateClaimStatus,
  recordReplacement,
  getDefectById,
  getDefects,
  getPendingClaims,
  getDefectStatistics,
};
