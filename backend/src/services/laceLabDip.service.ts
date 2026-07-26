/**
 * Lace Lab Dip Service
 *
 * Lab dip approval workflow for greige lace dyeing.
 * Lab dip is required when sourcingStrategy = GREIGE_PROCESSED:
 * - Small sample of greige lace sent to processor
 * - Dyed in target color
 * - Buyer approves or rejects
 * - Only after approval, bulk processing PO is raised
 */

import prisma from '../config/database';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';
import { LaceLabDipStatus } from '@prisma/client';

export interface CreateLabDipInput {
  greigeLaceId: string;
  targetColor: string;
  processorId: string;
  sampleQuantity: number;
  colorRecipe?: string;
  costSheetId?: string;
  styleId?: string;
  labDipCost?: number;
}

export interface UpdateLabDipInput {
  targetColor?: string;
  colorRecipe?: string;
  sampleQuantity?: number;
  labDipCost?: number;
  buyerRemarks?: string;
  rejectionReason?: string;
  approvalReference?: string;
}

/**
 * Create a new lace lab dip request
 */
export async function createLaceLabDip(input: CreateLabDipInput, userId: string) {
  // Validate greige lace exists and is greige
  const greigeLace = await prisma.lace_master.findFirst({
    where: { id: input.greigeLaceId, isGreige: true, isActive: true },
    select: { id: true, laceName: true, laceCode: true },
  });

  if (!greigeLace) {
    throw new Error('Greige lace not found or is not a greige lace');
  }

  // Validate processor exists and is a dyeing processor
  const processor = await prisma.suppliers.findFirst({
    where: {
      id: input.processorId,
      isActive: true,
      supplierCategories: { has: 'DYEING_PRINTING' },
    },
    select: { id: true, name: true },
  });

  if (!processor) {
    throw new Error('Processor not found or is not a dyeing processor');
  }

  // Generate lab dip number (atomic sequence, format LD-LACE-0001)
  const labDipNumber = await generateAtomicMasterCode('LD-LACE', 4);

  const labDip = await prisma.lace_lab_dip.create({
    data: {
      labDipNumber,
      greigeLaceId: input.greigeLaceId,
      targetColor: input.targetColor,
      processorId: input.processorId,
      sampleQuantity: input.sampleQuantity,
      colorRecipe: input.colorRecipe || null,
      costSheetId: input.costSheetId || null,
      styleId: input.styleId || null,
      labDipCost: input.labDipCost || null,
      status: 'PENDING',
      createdById: userId,
    },
    include: {
      greigeLace: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          width: true,
          composition: true,
          expectedShrinkagePercent: true,
        },
      },
      processor: {
        select: { id: true, name: true, code: true },
      },
      style: {
        select: { id: true, styleCode: true, styleName: true },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return labDip;
}

/**
 * Get all lace lab dips with filters
 */
export async function getLaceLabDips(filters: {
  status?: LaceLabDipStatus;
  greigeLaceId?: string;
  processorId?: string;
  styleId?: string;
  costSheetId?: string;
  page?: number;
  limit?: number;
}) {
  const { page = 1, limit = 20, ...filterValues } = filters;
  const offset = (page - 1) * limit;

  const where: any = {};
  if (filterValues.status) where.status = filterValues.status;
  if (filterValues.greigeLaceId) where.greigeLaceId = filterValues.greigeLaceId;
  if (filterValues.processorId) where.processorId = filterValues.processorId;
  if (filterValues.styleId) where.styleId = filterValues.styleId;
  if (filterValues.costSheetId) where.costSheetId = filterValues.costSheetId;

  const [total, labDips] = await Promise.all([
    prisma.lace_lab_dip.count({ where }),
    prisma.lace_lab_dip.findMany({
      where,
      include: {
        greigeLace: {
          select: {
            id: true,
            laceCode: true,
            laceName: true,
            width: true,
            expectedShrinkagePercent: true,
          },
        },
        processor: {
          select: { id: true, name: true, code: true },
        },
        style: {
          select: { id: true, styleCode: true, styleName: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
  ]);

  return {
    data: labDips,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get single lace lab dip by ID
 */
export async function getLaceLabDipById(id: string) {
  const labDip = await prisma.lace_lab_dip.findUnique({
    where: { id },
    include: {
      greigeLace: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          width: true,
          composition: true,
          laceType: true,
          expectedShrinkagePercent: true,
          costPerMeterGreige: true,
        },
      },
      processor: {
        select: { id: true, name: true, code: true },
      },
      style: {
        select: { id: true, styleCode: true, styleName: true },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      costingItems: {
        select: { id: true, costingId: true },
      },
    },
  });

  return labDip;
}

/**
 * Update lace lab dip
 */
export async function updateLaceLabDip(id: string, input: UpdateLabDipInput) {
  const existing = await prisma.lace_lab_dip.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new Error('Lab dip not found');
  }

  // Cannot update if already approved or rejected
  if (existing.status === 'APPROVED') {
    throw new Error('Cannot update an approved lab dip');
  }

  const updated = await prisma.lace_lab_dip.update({
    where: { id },
    data: {
      ...(input.targetColor !== undefined && { targetColor: input.targetColor }),
      ...(input.colorRecipe !== undefined && { colorRecipe: input.colorRecipe }),
      ...(input.sampleQuantity !== undefined && { sampleQuantity: input.sampleQuantity }),
      ...(input.labDipCost !== undefined && { labDipCost: input.labDipCost }),
      ...(input.buyerRemarks !== undefined && { buyerRemarks: input.buyerRemarks }),
      ...(input.rejectionReason !== undefined && { rejectionReason: input.rejectionReason }),
      ...(input.approvalReference !== undefined && { approvalReference: input.approvalReference }),
    },
    include: {
      greigeLace: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
        },
      },
      processor: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  return updated;
}

/**
 * Update lab dip status (workflow transitions)
 */
export async function updateLabDipStatus(
  id: string,
  newStatus: LaceLabDipStatus,
  additionalData?: {
    buyerRemarks?: string;
    rejectionReason?: string;
    approvalReference?: string;
  }
) {
  const existing = await prisma.lace_lab_dip.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new Error('Lab dip not found');
  }

  // Validate status transitions
  const validTransitions: Record<LaceLabDipStatus, LaceLabDipStatus[]> = {
    PENDING: ['SENT_TO_PROCESSOR'],
    SENT_TO_PROCESSOR: ['SAMPLE_RECEIVED'],
    SAMPLE_RECEIVED: ['AWAITING_BUYER_APPROVAL'],
    AWAITING_BUYER_APPROVAL: ['APPROVED', 'REJECTED'],
    APPROVED: [], // Terminal state
    REJECTED: ['PENDING'], // Can restart the process
  };

  if (!validTransitions[existing.status].includes(newStatus)) {
    throw new Error(`Invalid status transition from ${existing.status} to ${newStatus}`);
  }

  // Set appropriate date based on status
  const dateUpdates: any = {};
  switch (newStatus) {
    case 'SENT_TO_PROCESSOR':
      dateUpdates.sentToProcessorDate = new Date();
      break;
    case 'SAMPLE_RECEIVED':
      dateUpdates.sampleReceivedDate = new Date();
      break;
    case 'AWAITING_BUYER_APPROVAL':
      dateUpdates.sentToBuyerDate = new Date();
      break;
    case 'APPROVED':
    case 'REJECTED':
      dateUpdates.buyerDecisionDate = new Date();
      break;
  }

  const updated = await prisma.lace_lab_dip.update({
    where: { id },
    data: {
      status: newStatus,
      ...dateUpdates,
      ...(additionalData?.buyerRemarks && { buyerRemarks: additionalData.buyerRemarks }),
      ...(additionalData?.rejectionReason && { rejectionReason: additionalData.rejectionReason }),
      ...(additionalData?.approvalReference && { approvalReference: additionalData.approvalReference }),
    },
    include: {
      greigeLace: {
        select: { id: true, laceCode: true, laceName: true },
      },
      processor: {
        select: { id: true, name: true },
      },
    },
  });

  return updated;
}

/**
 * Check if a lab dip is approved (for PO generation validation)
 */
export async function isLabDipApproved(labDipId: string): Promise<boolean> {
  const labDip = await prisma.lace_lab_dip.findUnique({
    where: { id: labDipId },
    select: { status: true },
  });

  return labDip?.status === 'APPROVED';
}

/**
 * Get approved lab dips for a greige lace (for processor selection in costing)
 */
export async function getApprovedLabDipsForLace(greigeLaceId: string) {
  const labDips = await prisma.lace_lab_dip.findMany({
    where: {
      greigeLaceId,
      status: 'APPROVED',
    },
    include: {
      processor: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: { buyerDecisionDate: 'desc' },
  });

  return labDips;
}

/**
 * Delete lab dip (only if PENDING)
 */
export async function deleteLaceLabDip(id: string) {
  const existing = await prisma.lace_lab_dip.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new Error('Lab dip not found');
  }

  if (existing.status !== 'PENDING') {
    throw new Error('Can only delete lab dips with PENDING status');
  }

  await prisma.lace_lab_dip.delete({ where: { id } });
}

export default {
  createLaceLabDip,
  getLaceLabDips,
  getLaceLabDipById,
  updateLaceLabDip,
  updateLabDipStatus,
  isLabDipApproved,
  getApprovedLabDipsForLace,
  deleteLaceLabDip,
};
