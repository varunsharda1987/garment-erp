import { Request, Response, NextFunction } from 'express';
import { BusinessError, NotFoundError, ValidationError, UnauthorizedError } from '../errors';
import prisma from '../config/database';
import { Prisma, Unit } from '@prisma/client';
import { createChallan } from '../services/challan.service';
import greigeStockService from '../services/greige-stock.service';
import { generateUnifiedPONumber } from '../utils/po-number-generator';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../services/helpers/material-sync.helper';
import { systemSettingsService } from '../services/system-settings.service';

// ============================================
// Atomic scoped numbering helpers
// ============================================

/** Highest numeric suffix among codes shaped `${prefix}-<digits>` (the dash keeps the scope exact). */
const maxNumericSuffix = (codes: Array<string | null>, prefix: string): number => {
  let max = 0;
  for (const code of codes) {
    if (!code || !code.startsWith(`${prefix}-`)) continue;
    const suffix = code.slice(prefix.length + 1);
    if (/^\d+$/.test(suffix)) max = Math.max(max, parseInt(suffix, 10));
  }
  return max;
};

/**
 * Lazily seed the atomic sequence for a per-scope compound prefix (e.g. `LDD-{styleCode}`).
 * Static seeding (scripts/seed-code-sequences.ts) is impossible for prefixes that embed a style
 * scope, so before first use in a scope: if code_sequences has no row for the prefix but rows
 * already exist in the target table, initialize the sequence with their max numeric suffix
 * (idempotent GREATEST upsert, mirroring the seed script).
 */
const seedScopedSequenceIfMissing = async (prefix: string, findMaxSuffix: () => Promise<number>): Promise<void> => {
  const existing = await prisma.$queryRaw<Array<{ found: number }>>(
    Prisma.sql`SELECT 1 AS found FROM code_sequences WHERE prefix = ${prefix} LIMIT 1`
  );
  if (existing.length > 0) return;
  const max = await findMaxSuffix();
  if (max <= 0) return;
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO code_sequences (id, prefix, "lastValue", "updatedAt")
      VALUES (gen_random_uuid(), ${prefix}, ${max}, NOW())
      ON CONFLICT (prefix) DO UPDATE SET
        "lastValue" = GREATEST(code_sequences."lastValue", ${max}),
        "updatedAt" = NOW()
    `
  );
};

// Helper to transform relations for response
const transformLabDip = (item: any) => ({
  ...item,
  style: item.style,
  fabric: item.fabric,
  targetColor: item.targetColor,
  processor: item.processor,
  approvedBy: item.approvedBy
    ? {
        id: item.approvedBy.id,
        name: `${item.approvedBy.firstName} ${item.approvedBy.lastName}`,
      }
    : null,
  createdBy: item.createdBy
    ? {
        id: item.createdBy.id,
        name: `${item.createdBy.firstName} ${item.createdBy.lastName}`,
      }
    : null,
});

const transformJobWorkOrder = (item: any) => ({
  ...item,
  labDip: item.labDip ? transformLabDip(item.labDip) : null,
  style: item.style,
  fabric: item.fabric,
  processor: item.processor,
  finishedFabric: item.finishedFabric || null,
  fabricStockLot: item.fabricStockLot
    ? {
        id: item.fabricStockLot.id,
        lotNumber: item.fabricStockLot.lotNumber || item.fabricStockLot.id.slice(-8),
        availableQty: Number(item.fabricStockLot.quantityAvailable),
        purchaseCost: item.fabricStockLot.purchaseCost ? Number(item.fabricStockLot.purchaseCost) : 0,
      }
    : null,
  createdBy: item.createdBy
    ? {
        id: item.createdBy.id,
        name: `${item.createdBy.firstName} ${item.createdBy.lastName}`,
      }
    : null,
});

// Lab Dip include configuration
const labDipInclude = {
  style: {
    select: {
      id: true,
      styleCode: true,
      styleName: true,
    },
  },
  fabric: {
    select: {
      id: true,
      fabricCode: true,
      fabricName: true,
      finishType: true,
      printDesign: true,
      colorName: true,
    },
  },
  targetColor: {
    select: {
      id: true,
      colorName: true,
      colorCode: true,
    },
  },
  processor: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  approvedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
};

// Job Work Order include configuration
const jobWorkOrderInclude = {
  labDip: {
    include: labDipInclude,
  },
  style: {
    select: {
      id: true,
      styleCode: true,
      styleName: true,
    },
  },
  fabric: {
    select: {
      id: true,
      fabricCode: true,
      fabricName: true,
    },
  },
  processor: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  fabricStockLot: {
    select: {
      id: true,
      quantityAvailable: true,
      purchaseCost: true,
    },
  },
  finishedFabric: {
    select: {
      id: true,
      fabricCode: true,
      fabricName: true,
      actualWidth: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
};

// Process type constant for dyeing
const PROCESS_TYPE = 'DYEING';

// ============================================
// LAB DIP ENDPOINTS
// ============================================

// Generate lab dip number — atomic per-style sequence; visible format preserved: LDD-{styleCode}-NNN.
// printing.controller.ts writes the same lab_dips.labDipNumber column and MUST use this identical
// `${processPrefix}-${styleCode}` key scheme (LDD for dyeing, LDP for printing) so series can't collide.
const generateLabDipNumber = async (styleCode: string): Promise<string> => {
  const prefix = `LDD-${styleCode}`; // Lab Dip Dyeing
  await seedScopedSequenceIfMissing(prefix, async () => {
    const rows = await prisma.lab_dips.findMany({
      where: { labDipNumber: { startsWith: `${prefix}-` } },
      select: { labDipNumber: true },
    });
    return maxNumericSuffix(
      rows.map((r) => r.labDipNumber),
      prefix
    );
  });
  return generateAtomicMasterCode(prefix, 3);
};

// Get all lab dips
export const getAllLabDips = async (req: Request, res: Response, _next: NextFunction) => {
  const { page = '1', limit = '10', search, status, styleId, processorId, fromDate, toDate } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.lab_dipsWhereInput = {
    processType: PROCESS_TYPE,
  };

  if (search) {
    where.OR = [
      { labDipNumber: { contains: search as string, mode: 'insensitive' } },
      { style: { styleCode: { contains: search as string, mode: 'insensitive' } } },
      { style: { styleName: { contains: search as string, mode: 'insensitive' } } },
      { colorReference: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (status) {
    where.status = status as any;
  }

  if (styleId) {
    where.styleId = styleId as string;
  }

  if (processorId) {
    where.processorId = processorId as string;
  }

  if (fromDate || toDate) {
    where.submissionDate = {};
    if (fromDate) {
      where.submissionDate.gte = new Date(fromDate as string);
    }
    if (toDate) {
      where.submissionDate.lte = new Date(toDate as string);
    }
  }

  const [items, total] = await Promise.all([
    prisma.lab_dips.findMany({
      where,
      include: labDipInclude,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lab_dips.count({ where }),
  ]);

  res.json({
    data: items.map(transformLabDip),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

// Get lab dip by ID
export const getLabDipById = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;

  const labDip = await prisma.lab_dips.findUnique({
    where: { id },
    include: {
      ...labDipInclude,
      jobWorkOrders: {
        include: jobWorkOrderInclude,
      },
    },
  });

  if (!labDip) {
    throw new NotFoundError('Lab dip', id);
  }

  const transformed = transformLabDip(labDip as any);
  transformed.jobWorkOrders = (labDip as any).jobWorkOrders?.map(transformJobWorkOrder) || [];

  res.json({ data: transformed });
};

// Create lab dip
export const createLabDip = async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { styleId, fabricId, targetColorId, colorReference, processorId, submissionDate, expectedDate, remarks } =
    req.body;

  // Get style for labDipNumber
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    select: { styleCode: true },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  const labDipNumber = await generateLabDipNumber(style.styleCode);

  const labDip = await prisma.lab_dips.create({
    data: {
      labDipNumber,
      processType: PROCESS_TYPE,
      styleId,
      fabricId,
      targetColorId,
      colorReference,
      processorId,
      submissionDate: new Date(submissionDate),
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      remarks,
      status: 'PENDING',
      createdById: userId,
    },
    include: labDipInclude,
  });

  res.status(201).json({ data: transformLabDip(labDip as any), message: 'Lab dip created successfully' });
};

// Generate lab dip number for a specific process type
const generateLabDipNumberForProcess = async (
  styleCode: string,
  processType: 'DYEING' | 'PRINTING'
): Promise<string> => {
  const processPrefix = processType === 'DYEING' ? 'LDD' : 'LDP';
  const prefix = `${processPrefix}-${styleCode}`;
  await seedScopedSequenceIfMissing(prefix, async () => {
    const rows = await prisma.lab_dips.findMany({
      where: { labDipNumber: { startsWith: `${prefix}-` } },
      select: { labDipNumber: true },
    });
    return maxNumericSuffix(
      rows.map((r) => r.labDipNumber),
      prefix
    );
  });
  return generateAtomicMasterCode(prefix, 3);
};

/**
 * Bulk Create Lab Dips (Unified for DYEING + PRINTING)
 * POST /api/lab-dips/bulk
 * Creates multiple lab dips at once for a single style.
 */
export const bulkCreateLabDips = async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { styleId, submissionDate, labDips } = req.body;

  // Get style for labDipNumber
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    select: { styleCode: true },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  if (!labDips || !Array.isArray(labDips) || labDips.length === 0) {
    throw new ValidationError('At least one lab dip is required');
  }

  // Create all lab dips in a transaction
  const createdLabDips = await prisma.$transaction(async (tx) => {
    const results: any[] = [];

    for (const item of labDips) {
      const {
        styleFabricId,
        processType,
        processorId,
        targetColorId,
        colorReference,
        designArtwork,
        printMethod,
        printChemistry,
        expectedDate,
        remarks,
      } = item;

      // Get the style_fabric to find fabricId
      const styleFabric = await tx.style_fabrics.findUnique({
        where: { id: styleFabricId },
        select: { fabricId: true },
      });

      if (!styleFabric?.fabricId) {
        throw new ValidationError(
          `Style fabric ${styleFabricId} does not have a linked fabric. Please define fabric in style first.`
        );
      }

      // Generate lab dip number based on process type
      const labDipNumber = await generateLabDipNumberForProcess(style.styleCode, processType);

      const labDip = await tx.lab_dips.create({
        data: {
          labDipNumber,
          processType,
          styleId,
          fabricId: styleFabric.fabricId,
          targetColorId: processType === 'DYEING' ? targetColorId : undefined,
          colorReference: processType === 'DYEING' ? colorReference : undefined,
          designArtwork: processType === 'PRINTING' ? designArtwork : undefined,
          printMethod: processType === 'PRINTING' ? printMethod : undefined,
          printChemistry: processType === 'PRINTING' ? printChemistry : undefined,
          processorId,
          submissionDate: submissionDate ? new Date(submissionDate) : new Date(),
          expectedDate: expectedDate ? new Date(expectedDate) : undefined,
          remarks,
          status: 'PENDING',
          createdById: userId,
        },
        include: labDipInclude,
      });

      results.push(transformLabDip(labDip as any));
    }

    return results;
  });

  res.status(201).json({
    data: createdLabDips,
    message: `${createdLabDips.length} lab dip(s) created successfully`,
    summary: {
      total: createdLabDips.length,
      dyeing: createdLabDips.filter((l) => l.processType === 'DYEING').length,
      printing: createdLabDips.filter((l) => l.processType === 'PRINTING').length,
    },
  });
};

// Update lab dip
export const updateLabDip = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { targetColorId, colorReference, processorId, submissionDate, expectedDate, receivedDate, remarks } = req.body;

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  if (existing.status === 'APPROVED') {
    throw new ValidationError('Cannot update an approved lab dip');
  }

  const updateData: any = {};

  if (targetColorId !== undefined) updateData.targetColorId = targetColorId;
  if (colorReference !== undefined) updateData.colorReference = colorReference;
  if (processorId !== undefined) updateData.processorId = processorId;
  if (submissionDate !== undefined) updateData.submissionDate = new Date(submissionDate);
  if (expectedDate !== undefined) updateData.expectedDate = new Date(expectedDate);
  if (receivedDate !== undefined) {
    updateData.receivedDate = new Date(receivedDate);
    updateData.status = 'SUBMITTED';
  }
  if (remarks !== undefined) updateData.remarks = remarks;

  const labDip = await prisma.lab_dips.update({
    where: { id },
    data: updateData,
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// Delete lab dip
export const deleteLabDip = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
    include: { jobWorkOrders: true },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  if ((existing as any).jobWorkOrders?.length > 0) {
    throw new ValidationError('Cannot delete lab dip with existing dye jobs');
  }

  await prisma.lab_dips.delete({ where: { id } });

  res.json({ message: 'Lab dip deleted successfully' });
};

// Approve lab dip
// BUG-DYE4 fix: colorMatchRating uses aligned 4-level scale: Excellent, Good, Acceptable, Poor
export const approveLabDip = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const { approvedSampleNo, colorMatchRating, remarks } = req.body;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  if (existing.status === 'APPROVED') {
    throw new ValidationError('Lab dip is already approved');
  }

  const labDip = await prisma.lab_dips.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approvedById: userId,
      approvalDate: new Date(),
      approvedSampleNo,
      colorMatchRating,
      remarks: remarks ? `${existing.remarks || ''}\n[Approval Note] ${remarks}` : existing.remarks,
    },
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// Reject lab dip
export const rejectLabDip = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const { rejectionReason, remarks } = req.body;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  if (!rejectionReason) {
    throw new ValidationError('Rejection reason is required');
  }

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  if (existing.status === 'APPROVED') {
    throw new ValidationError('Cannot reject an approved lab dip');
  }

  const labDip = await prisma.lab_dips.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectionReason,
      remarks: remarks ? `${existing.remarks || ''}\n[Rejection Note] ${remarks}` : existing.remarks,
    },
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// Request resubmission
export const requestResubmit = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { remarks } = req.body;

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  const labDip = await prisma.lab_dips.update({
    where: { id },
    data: {
      status: 'RESUBMIT',
      resubmissionCount: (existing.resubmissionCount || 0) + 1,
      remarks: remarks ? `${existing.remarks || ''}\n[Resubmit Request] ${remarks}` : existing.remarks,
    },
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// ============================================
// BUYER APPROVAL WORKFLOW
// ============================================

// Send lab dip to buyer for approval
export const sendToBuyer = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { sentToBuyerDate, remarks } = req.body;

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  if (existing.status !== 'APPROVED') {
    throw new ValidationError('Lab dip must be internally approved before sending to buyer');
  }

  const labDip = await prisma.lab_dips.update({
    where: { id },
    data: {
      sentToBuyerDate: sentToBuyerDate ? new Date(sentToBuyerDate) : new Date(),
      buyerApprovalStatus: 'PENDING',
      remarks: remarks ? `${existing.remarks || ''}\n[Sent to Buyer] ${remarks}` : existing.remarks,
    },
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// Buyer approves lab dip
export const buyerApprove = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { buyerRemarks } = req.body;

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  if (existing.buyerApprovalStatus !== 'PENDING') {
    throw new ValidationError('Lab dip must be pending buyer approval');
  }

  const labDip = await prisma.lab_dips.update({
    where: { id },
    data: {
      buyerApprovalStatus: 'APPROVED',
      buyerApprovalDate: new Date(),
      buyerRemarks,
      remarks: buyerRemarks ? `${existing.remarks || ''}\n[Buyer Approved] ${buyerRemarks}` : existing.remarks,
    },
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// Buyer rejects lab dip
export const buyerReject = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { buyerRemarks } = req.body;

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  if (existing.buyerApprovalStatus !== 'PENDING') {
    throw new ValidationError('Lab dip must be pending buyer approval');
  }

  const labDip = await prisma.lab_dips.update({
    where: { id },
    data: {
      buyerApprovalStatus: 'REJECTED',
      buyerApprovalDate: new Date(),
      buyerRemarks,
      remarks: buyerRemarks ? `${existing.remarks || ''}\n[Buyer Rejected] ${buyerRemarks}` : existing.remarks,
    },
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// Buyer requests resubmission
export const buyerRequestResubmit = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { buyerRemarks } = req.body;

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  if (existing.buyerApprovalStatus !== 'PENDING') {
    throw new ValidationError('Lab dip must be pending buyer approval');
  }

  const labDip = await prisma.lab_dips.update({
    where: { id },
    data: {
      buyerApprovalStatus: 'RESUBMIT_REQUIRED',
      buyerApprovalDate: new Date(),
      buyerRemarks,
      resubmissionCount: (existing.resubmissionCount || 0) + 1,
      remarks: buyerRemarks ? `${existing.remarks || ''}\n[Buyer Resubmit Required] ${buyerRemarks}` : existing.remarks,
    },
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// Get approved lab dips
export const getApprovedLabDips = async (req: Request, res: Response, _next: NextFunction) => {
  const { styleId } = req.query;

  const where: Prisma.lab_dipsWhereInput = {
    processType: PROCESS_TYPE,
    status: 'APPROVED',
  };

  if (styleId) {
    where.styleId = styleId as string;
  }

  const labDips = await prisma.lab_dips.findMany({
    where,
    include: labDipInclude,
    orderBy: { approvalDate: 'desc' },
  });

  res.json({ data: labDips.map(transformLabDip) });
};

// Search lab dips
export const searchLabDips = async (req: Request, res: Response, _next: NextFunction) => {
  const { q } = req.query;

  if (!q || (q as string).length < 2) {
    return res.json({ data: [] });
  }

  const labDips = await prisma.lab_dips.findMany({
    where: {
      processType: PROCESS_TYPE,
      OR: [
        { labDipNumber: { contains: q as string, mode: 'insensitive' } },
        { style: { styleCode: { contains: q as string, mode: 'insensitive' } } },
        { colorReference: { contains: q as string, mode: 'insensitive' } },
      ],
    },
    include: labDipInclude,
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  res.json({ data: labDips.map(transformLabDip) });
};

// ============================================
// DYE JOB ENDPOINTS
// ============================================

// Generate job work number — atomic per-style sequence; visible format preserved: DJ-{styleCode}-NNN.
// printing.controller.ts writes the same job_work_orders.jobWorkNumber column and MUST use this
// identical `${processPrefix}-${styleCode}` key scheme (DJ for dyeing, PJ for printing).
const generateJobWorkNumber = async (styleCode: string): Promise<string> => {
  const prefix = `DJ-${styleCode}`; // Dye Job
  await seedScopedSequenceIfMissing(prefix, async () => {
    const rows = await prisma.job_work_orders.findMany({
      where: { jobWorkNumber: { startsWith: `${prefix}-` } },
      select: { jobWorkNumber: true },
    });
    return maxNumericSuffix(
      rows.map((r) => r.jobWorkNumber),
      prefix
    );
  });
  return generateAtomicMasterCode(prefix, 3);
};

// Get all dye jobs
export const getAllDyeJobs = async (req: Request, res: Response, _next: NextFunction) => {
  const { page = '1', limit = '10', search, status, labDipId, styleId, processorId, fromDate, toDate } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.job_work_ordersWhereInput = {
    processType: PROCESS_TYPE,
  };

  if (search) {
    where.OR = [
      { jobWorkNumber: { contains: search as string, mode: 'insensitive' } },
      { style: { styleCode: { contains: search as string, mode: 'insensitive' } } },
      { challanNumber: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (status) {
    where.status = status as any;
  }

  if (labDipId) {
    where.labDipId = labDipId as string;
  }

  if (styleId) {
    where.styleId = styleId as string;
  }

  if (processorId) {
    where.processorId = processorId as string;
  }

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      where.createdAt.gte = new Date(fromDate as string);
    }
    if (toDate) {
      where.createdAt.lte = new Date(toDate as string);
    }
  }

  const [items, total] = await Promise.all([
    prisma.job_work_orders.findMany({
      where,
      include: jobWorkOrderInclude,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.job_work_orders.count({ where }),
  ]);

  res.json({
    data: items.map(transformJobWorkOrder),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

// Get dye job by ID
export const getDyeJobById = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;

  const job = await prisma.job_work_orders.findUnique({
    where: { id },
    include: jobWorkOrderInclude,
  });

  if (!job) {
    throw new NotFoundError('Dye job', id);
  }

  res.json({ data: transformJobWorkOrder(job as any) });
};

// Create dye job
export const createDyeJob = async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    labDipId,
    fabricStockLotId,
    fabricType,
    reprocessReason,
    qtySentMeters,
    sentWidthInches,
    expectedReturnDate,
    expectedShrinkage,
    agreedRatePerMeter,
    remarks,
  } = req.body;

  // Get lab dip details
  const labDip = await prisma.lab_dips.findUnique({
    where: { id: labDipId },
    include: {
      style: { select: { styleCode: true } },
    },
  });

  if (!labDip) {
    throw new NotFoundError('Lab dip', labDipId);
  }

  if (labDip.status !== 'APPROVED') {
    throw new ValidationError('Lab dip must be approved before creating a dye job');
  }

  // Get fabric stock to validate
  const fabricStock = await prisma.fabric_stock.findUnique({
    where: { id: fabricStockLotId },
  });

  if (!fabricStock) {
    throw new NotFoundError('Fabric stock lot', fabricStockLotId);
  }

  if (Number(fabricStock.quantityAvailable) < qtySentMeters) {
    throw new ValidationError('Insufficient fabric stock');
  }

  const jobWorkNumber = await generateJobWorkNumber((labDip as any).style?.styleCode || 'UNKNOWN');

  const job = await prisma.job_work_orders.create({
    data: {
      jobWorkNumber,
      processType: PROCESS_TYPE,
      labDipId,
      styleId: labDip.styleId,
      fabricId: labDip.fabricId,
      processorId: labDip.processorId,
      fabricStockLotId,
      fabricType,
      reprocessReason,
      qtySentMeters,
      sentWidthInches,
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      expectedShrinkage,
      agreedRatePerMeter,
      remarks,
      status: 'READY_TO_SEND',
      createdById: userId,
    },
    include: jobWorkOrderInclude,
  });

  res.status(201).json({ data: transformJobWorkOrder(job as any), message: 'Dye job created successfully' });
};

// Update dye job
export const updateDyeJob = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const {
    fabricStockLotId,
    fabricType,
    reprocessReason,
    qtySentMeters,
    sentWidthInches,
    expectedReturnDate,
    expectedShrinkage,
    agreedRatePerMeter,
    remarks,
  } = req.body;

  const existing = await prisma.job_work_orders.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Dye job', id);
  }

  if (existing.sentDate) {
    throw new ValidationError('Cannot update a job that has already been sent to mill');
  }

  const updateData: any = {};

  if (fabricStockLotId !== undefined) updateData.fabricStockLotId = fabricStockLotId;
  if (fabricType !== undefined) updateData.fabricType = fabricType;
  if (reprocessReason !== undefined) updateData.reprocessReason = reprocessReason;
  if (qtySentMeters !== undefined) updateData.qtySentMeters = qtySentMeters;
  if (sentWidthInches !== undefined) updateData.sentWidthInches = sentWidthInches;
  if (expectedReturnDate !== undefined) updateData.expectedReturnDate = new Date(expectedReturnDate);
  if (expectedShrinkage !== undefined) updateData.expectedShrinkage = expectedShrinkage;
  if (agreedRatePerMeter !== undefined) updateData.agreedRatePerMeter = agreedRatePerMeter;
  if (remarks !== undefined) updateData.remarks = remarks;

  const job = await prisma.job_work_orders.update({
    where: { id },
    data: updateData,
    include: jobWorkOrderInclude,
  });

  res.json({ data: transformJobWorkOrder(job as any) });
};

// Delete dye job
export const deleteDyeJob = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;

  const existing = await prisma.job_work_orders.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Dye job', id);
  }

  if (existing.sentDate) {
    throw new ValidationError('Cannot delete a job that has already been sent to mill');
  }

  await prisma.job_work_orders.delete({ where: { id } });

  res.json({ message: 'Dye job deleted successfully' });
};

// Send fabric to mill
export const sendToMill = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { sentDate, challanNumber, vehicleNumber } = req.body;
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  // BUG-DYE9 fix: Use configurable cutable width deduction from system settings
  const cutableWidthDeduction = await systemSettingsService.getNumber('GREIGE_CUTABLE_WIDTH_DEDUCTION_CM', 2);

  const existing = await prisma.job_work_orders.findUnique({
    where: { id },
    include: {
      labDip: {
        include: {
          targetColor: { select: { colorName: true, colorCode: true } },
          fabric: {
            select: {
              id: true,
              fabricName: true,
              greigeId: true,
              greige: {
                select: {
                  id: true,
                  greigeCode: true,
                  greigeName: true,
                  genericGreigeName: true,
                  composition: true,
                  yarnCount: true,
                },
              },
            },
          },
        },
      },
      style: { select: { id: true, styleCode: true, styleName: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError('Dye job', id);
  }

  if (existing.sentDate) {
    throw new ValidationError('Fabric has already been sent to mill');
  }

  // Update fabric stock - reduce available quantity
  await prisma.fabric_stock.update({
    where: { id: existing.fabricStockLotId },
    data: {
      quantityAvailable: {
        decrement: Number(existing.qtySentMeters),
      },
    },
  });

  // Auto-create fabric_master for the finished (dyed) fabric
  let finishedFabricId: string | null = null;
  const colorName = existing.labDip?.targetColor?.colorName || existing.labDip?.colorReference || 'Unknown';
  const colorCode = existing.labDip?.targetColor?.colorCode || null;
  const greigeId = existing.labDip?.fabric?.greigeId || null;
  const finishType = 'DYED';

  // Check if a matching fabric_master already exists for this greige+color+finishType
  if (greigeId) {
    const existingFabric = await prisma.fabric_master.findFirst({
      where: {
        greigeId,
        colorName,
        finishType,
        isActive: true,
      },
    });

    if (existingFabric) {
      finishedFabricId = existingFabric.id;
    }
  }

  // If no existing fabric found, also check without greigeId (source fabric + color)
  if (!finishedFabricId) {
    const existingBySource = await prisma.fabric_master.findFirst({
      where: {
        greigeId: greigeId || undefined,
        colorName,
        finishType,
        isActive: true,
        ...(greigeId ? {} : { id: existing.fabricId }), // Match source fabric if no greige
      },
    });
    if (existingBySource) {
      finishedFabricId = existingBySource.id;
    }
  }

  if (!finishedFabricId) {
    // Generate fabric code: FAB-{StyleCode}-{Seq}
    const styleCode = existing.style?.styleCode || 'STK';
    const prefix = `FAB-${styleCode}-`;
    const existingCodes = await prisma.fabric_master.findMany({
      where: { fabricCode: { startsWith: prefix } },
      select: { fabricCode: true },
      orderBy: { fabricCode: 'desc' },
      take: 1,
    });
    let nextSeq = 1;
    if (existingCodes.length > 0) {
      const seqMatch = existingCodes[0].fabricCode.match(/-(\d+)$/);
      if (seqMatch) nextSeq = parseInt(seqMatch[1]) + 1;
    }
    const fabricCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;

    // Build fabric name: "{StyleCode} - {GreigeType} - Dyed - {ColorName} - {Width}""
    const greige = existing.labDip?.fabric?.greige;
    const greigeGeneric = greige?.genericGreigeName || greige?.greigeName?.split('/')[0]?.trim() || 'Fabric';
    const widthStr = `${Number(existing.sentWidthInches)}"`;
    const fabricName = [styleCode, greigeGeneric, 'Dyed', colorName, widthStr].filter(Boolean).join(' - ');

    const newFabric = await prisma.fabric_master.create({
      data: {
        fabricCode,
        fabricName,
        greigeId,
        greigeName: greige?.greigeName || null,
        genericGreigeName: greige?.genericGreigeName || null,
        colorName,
        colorCode,
        finishType,
        actualWidth: existing.sentWidthInches, // Placeholder, updated on receive
        cutableWidth: new Prisma.Decimal(Math.max(Number(existing.sentWidthInches) - cutableWidthDeduction, 0)),
        composition: greige?.composition || null,
        yarnCount: greige?.yarnCount || null,
        styleReference: styleCode,
        source: 'AUTO_FROM_JOB_WORK',
        isGeneric: false,
        isActive: true,
        createdById: userId,
      },
    });
    finishedFabricId = newFabric.id;
  }

  const job = await prisma.job_work_orders.update({
    where: { id },
    data: {
      sentDate: new Date(sentDate),
      challanNumber,
      vehicleNumber,
      finishedFabricId,
      status: 'AT_MILL',
    },
    include: jobWorkOrderInclude,
  });

  res.json({ data: transformJobWorkOrder(job as any) });
};

// Receive fabric from mill
export const receiveFromMill = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const {
    qtyReceivedMeters,
    receivedWidthInches,
    receivedDate,
    receivedChallan,
    invoiceNumber,
    thanCount,
    foldLengthCm,
  } = req.body;

  // BUG-DYE9 fix: Use configurable cutable width deduction from system settings
  const cutableWidthDeduction = await systemSettingsService.getNumber('GREIGE_CUTABLE_WIDTH_DEDUCTION_CM', 2);

  const existing = await prisma.job_work_orders.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Dye job', id);
  }

  if (!existing.sentDate) {
    throw new ValidationError('Fabric has not been sent to mill yet');
  }

  if (existing.receivedDate) {
    throw new ValidationError('Fabric has already been received');
  }

  // Calculate actual meters from than measurement if provided
  let calculatedActualMeters: number | null = null;
  let actualMeters = qtyReceivedMeters;

  if (thanCount && foldLengthCm) {
    calculatedActualMeters = (thanCount * foldLengthCm) / 100;
    // Use calculated value if no manual qtyReceivedMeters provided
    if (!qtyReceivedMeters) {
      actualMeters = calculatedActualMeters;
    }
  }

  // Calculate shrinkage
  const sentMeters = Number(existing.qtySentMeters);
  const actualShrinkage = sentMeters > 0 ? ((sentMeters - actualMeters) / sentMeters) * 100 : 0;

  // Calculate width variance
  const widthVariance = receivedWidthInches - Number(existing.sentWidthInches);

  // Update fabric_master's actualWidth with received width
  if (existing.finishedFabricId && receivedWidthInches) {
    await prisma.fabric_master.update({
      where: { id: existing.finishedFabricId },
      data: {
        actualWidth: receivedWidthInches,
        cutableWidth: new Prisma.Decimal(Math.max(receivedWidthInches - cutableWidthDeduction, 0)),
      },
    });
  }

  const job = await prisma.job_work_orders.update({
    where: { id },
    data: {
      qtyReceivedMeters: actualMeters,
      receivedWidthInches,
      receivedDate: new Date(receivedDate),
      receivedChallan,
      invoiceNumber,
      actualShrinkage,
      widthVariance,
      thanCount: thanCount || null,
      foldLengthCm: foldLengthCm ? new Prisma.Decimal(foldLengthCm) : null,
      calculatedActualMeters: calculatedActualMeters ? new Prisma.Decimal(calculatedActualMeters) : null,
      status: 'RECEIVED',
    },
    include: jobWorkOrderInclude,
  });

  res.json({ data: transformJobWorkOrder(job as any) });
};

// Quality check
export const qualityCheck = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { qualityGrade, colorMatchStatus, defectMeters, defectType, actualRate, remarks } = req.body;

  const existing = await prisma.job_work_orders.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Dye job', id);
  }

  if (!existing.receivedDate) {
    throw new ValidationError('Fabric has not been received yet');
  }

  const job = await prisma.job_work_orders.update({
    where: { id },
    data: {
      qualityGrade,
      colorMatchStatus,
      defectMeters,
      defectType,
      actualRate,
      remarks: remarks ? `${existing.remarks || ''}\n[QC Note] ${remarks}` : existing.remarks,
      status: 'QUALITY_CHECKED',
    },
    include: jobWorkOrderInclude,
  });

  res.json({ data: transformJobWorkOrder(job as any) });
};

// Update stock after quality check — creates fabric_stock entry for finished fabric
export const updateStock = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  // BUG-DYE9 fix: Use configurable cutable width deduction from system settings
  const cutableWidthDeduction = await systemSettingsService.getNumber('GREIGE_CUTABLE_WIDTH_DEDUCTION_CM', 2);

  const existing = await prisma.job_work_orders.findUnique({
    where: { id },
    include: {
      fabricStockLot: true,
      style: { select: { id: true, styleCode: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError('Dye job', id);
  }

  if (existing.status !== 'QUALITY_CHECKED') {
    throw new ValidationError('Quality check must be completed first');
  }

  if (!existing.finishedFabricId) {
    throw new ValidationError('No finished fabric linked. Was sendToMill completed properly?');
  }

  // Calculate good qty (total received minus defects)
  const goodQty = Number(existing.qtyReceivedMeters) - Number(existing.defectMeters || 0);
  const receivedWidth = Number(existing.receivedWidthInches || existing.sentWidthInches);
  // BUG-DYE9 fix: Use configurable cutable width deduction
  const cutableWidth = Math.max(receivedWidth - cutableWidthDeduction, 0);

  // Calculate cost: processing rate + source greige/fabric cost
  const processingRate = Number(existing.actualRate || existing.agreedRatePerMeter);
  const sourceCost = existing.fabricStockLot?.purchaseCost ? Number(existing.fabricStockLot.purchaseCost) : 0;
  const totalCostPerMeter = processingRate + sourceCost;

  const qualityGrade = existing.qualityGrade === 'Reject' ? 'B' : existing.qualityGrade || 'A';

  // Create fabric_stock entry for good quantity
  const fabricStock = await prisma.fabric_stock.create({
    data: {
      fabricId: existing.finishedFabricId,
      finishedWidth: new Prisma.Decimal(receivedWidth),
      cutableWidth: new Prisma.Decimal(cutableWidth),
      quantityAvailable: new Prisma.Decimal(goodQty),
      quantityReserved: new Prisma.Decimal(0),
      quantityConsumed: new Prisma.Decimal(0),
      unit: 'meters',
      originStyleId: existing.styleId,
      status: 'AVAILABLE',
      stockType: 'PLANNED_STOCK',
      fabricFinishType: 'DYED',
      weightedAvgCost: new Prisma.Decimal(totalCostPerMeter),
      purchaseCost: new Prisma.Decimal(totalCostPerMeter),
      qualityGrade,
      defectMeters: existing.defectMeters,
      receivedDate: existing.receivedDate || new Date(),
      agingDays: 0,
      createdById: userId,
    },
  });

  // BUG-INV3 fix: Sync stock_levels when receiving processed fabric from mill
  try {
    const materialId = await ensureMaterialRecord(existing.finishedFabricId, 'FABRIC');
    await syncStockLevelQuantity(materialId, goodQty, undefined, 'METER');
    logger.info(`[receiveAtMill] Synced stock_levels for fabric ${existing.finishedFabricId}, qty: ${goodQty}`);
  } catch (syncErr) {
    logger.error('[receiveAtMill] Failed to sync stock_levels:', syncErr);
  }

  // If there are defect meters, create a separate B-grade stock entry
  const defectMeters = Number(existing.defectMeters || 0);
  let defectStockId: string | null = null;
  if (defectMeters > 0 && qualityGrade !== 'B') {
    const defectStock = await prisma.fabric_stock.create({
      data: {
        fabricId: existing.finishedFabricId,
        finishedWidth: new Prisma.Decimal(receivedWidth),
        cutableWidth: new Prisma.Decimal(cutableWidth),
        quantityAvailable: new Prisma.Decimal(defectMeters),
        quantityReserved: new Prisma.Decimal(0),
        quantityConsumed: new Prisma.Decimal(0),
        unit: 'meters',
        originStyleId: existing.styleId,
        status: 'AVAILABLE',
        stockType: 'PLANNED_STOCK',
        fabricFinishType: 'DYED',
        weightedAvgCost: new Prisma.Decimal(totalCostPerMeter * 0.5),
        purchaseCost: new Prisma.Decimal(totalCostPerMeter * 0.5),
        qualityGrade: 'B',
        defectMeters: new Prisma.Decimal(defectMeters),
        receivedDate: existing.receivedDate || new Date(),
        agingDays: 0,
        createdById: userId,
      },
    });
    defectStockId = defectStock.id;
  }

  // Update job status
  const job = await prisma.job_work_orders.update({
    where: { id },
    data: {
      status: 'STOCK_UPDATED',
    },
    include: jobWorkOrderInclude,
  });

  res.json({
    data: transformJobWorkOrder(job as any),
    stockCreated: {
      fabricStockId: fabricStock.id,
      defectStockId,
      goodQtyMeters: goodQty,
      defectMeters,
      totalCostPerMeter,
      fabricFinishType: 'DYED',
    },
  });
};

// ============================================
// PROCESS PO ENDPOINTS (Unified PO + Job Work Order)
// ============================================

// Include configuration for process PO queries
const processPOInclude = {
  suppliers: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  purchase_order_items: true,
  jobWorkOrder: {
    include: {
      labDip: {
        include: labDipInclude,
      },
      style: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
        },
      },
      fabric: {
        select: {
          id: true,
          fabricCode: true,
          fabricName: true,
        },
      },
      processor: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      greigeStockLot: {
        select: {
          id: true,
          quantityAvailable: true,
          quantityConsumed: true,
          purchaseCost: true,
          greigeWidth: true,
          greige: {
            select: {
              id: true,
              greigeCode: true,
              greigeName: true,
              genericGreigeName: true,
              composition: true,
              yarnCount: true,
            },
          },
        },
      },
      finishedFabric: {
        select: {
          id: true,
          fabricCode: true,
          fabricName: true,
          actualWidth: true,
        },
      },
      fabricStockLot: {
        select: {
          id: true,
          quantityAvailable: true,
          purchaseCost: true,
        },
      },
      outwardChallan: {
        select: {
          id: true,
          challanNumber: true,
          challanDate: true,
        },
      },
      inwardChallan: {
        select: {
          id: true,
          challanNumber: true,
          challanDate: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
};

// Compute unified process PO status from PO + Job Work Order
const computeProcessPOStatus = (po: any): string => {
  if (po.status === 'CANCELLED') return 'CANCELLED';

  const job = po.jobWorkOrder;
  if (!job) return 'DRAFT';

  const jobStatus = job.status as string;

  if (jobStatus === 'STOCK_UPDATED') return 'STOCK_UPDATED';
  if (jobStatus === 'QUALITY_CHECKED') return 'QUALITY_CHECKED';
  if (jobStatus === 'RECEIVED') return 'RECEIVED';
  if (jobStatus === 'AT_MILL' || jobStatus === 'SENT_TO_MILL') return 'AT_MILL';
  if (jobStatus === 'READY_TO_SEND') return 'DRAFT';
  if (jobStatus.includes('RETURNED')) return 'RETURNED';

  return 'DRAFT';
};

// 1. Get all Process POs for Dyeing
export const getProcessPOs = async (req: Request, res: Response, _next: NextFunction) => {
  const { page = '1', limit = '10', search, status } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.purchase_ordersWhereInput = {
    poCategory: 'PROCESSING',
    isActive: true,
    OR: [
      { jobWorkOrder: { processType: 'DYEING' } },
      {
        purchase_order_items: {
          some: {
            serviceType: 'DYEING',
          },
        },
      },
    ],
  };

  if (search) {
    where.AND = [
      {
        OR: [
          { poNumber: { contains: search as string, mode: 'insensitive' } },
          { jobWorkOrder: { style: { styleCode: { contains: search as string, mode: 'insensitive' } } } },
        ],
      },
    ];
  }

  if (status && status !== 'ALL') {
    // Status filtering is done post-query since it's computed
    // but we can pre-filter on PO status for CANCELLED
    if (status === 'CANCELLED') {
      where.status = 'CANCELLED';
    }
  }

  const [items, total] = await Promise.all([
    prisma.purchase_orders.findMany({
      where,
      include: processPOInclude,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.purchase_orders.count({ where }),
  ]);

  let results = items.map((po: any) => ({
    ...po,
    processPOStatus: computeProcessPOStatus(po),
  }));

  // Post-filter by computed status if needed
  if (status && status !== 'ALL' && status !== 'CANCELLED') {
    const statusFilter = status as string;
    results = results.filter((po: any) => po.processPOStatus === statusFilter);
  }

  res.json({
    data: results,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

// 2. Get single Process PO by ID
export const getProcessPOById = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;

  const po = await prisma.purchase_orders.findUnique({
    where: { id },
    include: processPOInclude,
  });

  if (!po) {
    throw new NotFoundError('Process PO', id);
  }

  const result = {
    ...po,
    processPOStatus: computeProcessPOStatus(po),
  };

  res.json({ data: result });
};

// 3. Create Process PO (PO + Job Work Order together)
// Supports both lab-dip-based (traditional) and style-based (direct) creation
export const createProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    labDipId,
    styleId: directStyleId,
    fabricId: directFabricId,
    processorId: directProcessorId,
    greigeStockLotId,
    fabricStockLotId,
    qtySentMeters,
    sentWidthInches,
    agreedRatePerMeter,
    isRateTbd = false,
    expectedReturnDate,
    expectedShrinkage,
    fabricType = 'GREIGE',
    remarks,
    // Auto-send fields (Create & Send one-click)
    autoSend = false,
    sentDate,
    challanNumber,
    vehicleNumber,
  } = req.body;

  // BUG-DYE9 fix: Use configurable cutable width deduction from system settings
  const cutableWidthDeduction = await systemSettingsService.getNumber('GREIGE_CUTABLE_WIDTH_DEDUCTION_CM', 2);

  // Validate required fields
  if (!qtySentMeters || !sentWidthInches || !agreedRatePerMeter) {
    throw new ValidationError('Missing required fields: qtySentMeters, sentWidthInches, agreedRatePerMeter');
  }

  if (!greigeStockLotId && !fabricStockLotId) {
    throw new ValidationError('Either greigeStockLotId or fabricStockLotId is required');
  }

  // Either labDipId OR (styleId + fabricId + processorId) must be provided
  if (!labDipId && (!directStyleId || !directFabricId || !directProcessorId)) {
    throw new ValidationError('Either labDipId OR (styleId, fabricId, and processorId) must be provided');
  }

  // Resolve style, fabric, processor - either from lab dip or direct input
  let resolvedStyleId: string;
  let resolvedFabricId: string;
  let resolvedProcessorId: string;
  let labDip: any = null;

  if (labDipId) {
    // Lab-dip-based creation - validate lab dip exists and is APPROVED
    labDip = await prisma.lab_dips.findUnique({
      where: { id: labDipId },
      include: {
        style: { select: { id: true, styleCode: true, styleName: true } },
        fabric: { select: { id: true, fabricCode: true, fabricName: true } },
        processor: { select: { id: true, name: true, code: true } },
      },
    });

    if (!labDip) {
      throw new NotFoundError('Lab dip', labDipId);
    }

    if (labDip.status !== 'APPROVED') {
      throw new ValidationError('Lab dip must be approved before creating a Process PO');
    }

    resolvedStyleId = labDip.styleId;
    resolvedFabricId = labDip.fabricId;
    resolvedProcessorId = labDip.processorId;
  } else {
    // Style-based creation - validate style, fabric, processor exist
    const [style, fabric, processor] = await Promise.all([
      prisma.styles.findUnique({
        where: { id: directStyleId },
        select: { id: true, styleCode: true, styleName: true },
      }),
      prisma.fabric_master.findUnique({
        where: { id: directFabricId },
        select: { id: true, fabricCode: true, fabricName: true },
      }),
      prisma.suppliers.findUnique({ where: { id: directProcessorId }, select: { id: true, name: true, code: true } }),
    ]);

    if (!style) throw new NotFoundError('Style', directStyleId);
    if (!fabric) throw new NotFoundError('Fabric', directFabricId);
    if (!processor) throw new NotFoundError('Processor', directProcessorId);

    resolvedStyleId = directStyleId;
    resolvedFabricId = directFabricId;
    resolvedProcessorId = directProcessorId;

    // Create a mock labDip object for compatibility with downstream code
    labDip = {
      styleId: directStyleId,
      fabricId: directFabricId,
      processorId: directProcessorId,
      style,
      fabric,
      processor,
    };
  }

  // Validate stock source (greige_stock preferred, fabric_stock as fallback)
  let validatedFabricStockLotId = fabricStockLotId;

  if (greigeStockLotId) {
    const greigeStock = await prisma.greige_stock.findUnique({
      where: { id: greigeStockLotId },
    });

    if (!greigeStock) {
      throw new NotFoundError('Greige stock lot', greigeStockLotId);
    }

    if (Number(greigeStock.quantityAvailable) < qtySentMeters) {
      throw new ValidationError(
        `Insufficient greige stock. Available: ${Number(greigeStock.quantityAvailable)} meters, Requested: ${qtySentMeters} meters`
      );
    }
  }

  // Validate fabric stock lot if provided (required by schema)
  if (validatedFabricStockLotId) {
    const fabricStock = await prisma.fabric_stock.findUnique({
      where: { id: validatedFabricStockLotId },
    });

    if (!fabricStock) {
      throw new NotFoundError('Fabric stock lot', fabricStockLotId);
    }
  } else {
    // If no fabricStockLotId provided, find or use the first available fabric stock
    // as a placeholder (fabricStockLotId is required by schema)
    const fallbackStock = await prisma.fabric_stock.findFirst({
      where: { fabricId: resolvedFabricId },
      select: { id: true },
    });
    if (!fallbackStock) {
      // Create a minimal placeholder stock entry for schema compatibility
      // Using RESERVED status to indicate this is not yet available for use
      const placeholderStock = await prisma.fabric_stock.create({
        data: {
          fabricId: resolvedFabricId,
          finishedWidth: new Prisma.Decimal(sentWidthInches),
          cutableWidth: new Prisma.Decimal(Math.max(sentWidthInches - cutableWidthDeduction, 0)),
          quantityAvailable: new Prisma.Decimal(0),
          quantityReserved: new Prisma.Decimal(0),
          quantityConsumed: new Prisma.Decimal(0),
          unit: 'meters',
          status: 'RESERVED',
          stockType: 'GENERIC',
          weightedAvgCost: new Prisma.Decimal(0),
          purchaseCost: new Prisma.Decimal(0),
          receivedDate: new Date(),
          agingDays: 0,
          createdById: userId,
        },
      });
      validatedFabricStockLotId = placeholderStock.id;
    } else {
      validatedFabricStockLotId = fallbackStock.id;
    }
  }

  // Create PO + Job in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Generate PO number
    const poNumber = await generateUnifiedPONumber();

    // Calculate totals
    const totalAmount = qtySentMeters * agreedRatePerMeter;

    // Create purchase order
    const poId = randomUUID();
    const po = await tx.purchase_orders.create({
      data: {
        id: poId,
        poNumber,
        supplierId: resolvedProcessorId,
        poDate: new Date(),
        expectedDeliveryDate: expectedReturnDate
          ? new Date(expectedReturnDate)
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // default 14 days
        status: 'DRAFT',
        poCategory: 'PROCESSING',
        poSource: 'MANUAL',
        totalAmount: new Prisma.Decimal(totalAmount),
        subtotal: new Prisma.Decimal(totalAmount),
        remarks,
        createdById: userId,
      },
    });

    // Create purchase order item
    const poItemId = randomUUID();
    await tx.purchase_order_items.create({
      data: {
        id: poItemId,
        poId: po.id,
        serviceType: 'DYEING',
        serviceDescription: `Dyeing processing - ${(labDip as any).style?.styleCode || ''}`,
        orderedQuantity: new Prisma.Decimal(qtySentMeters),
        receivedQuantity: new Prisma.Decimal(0),
        unit: 'METER',
        unitPrice: new Prisma.Decimal(agreedRatePerMeter),
        totalPrice: new Prisma.Decimal(totalAmount),
      },
    });

    // Generate job work number
    const styleCode = (labDip as any).style?.styleCode || 'STK';
    const jobWorkNumber = await generateJobWorkNumber(styleCode);

    // Create job work order linked to PO and greige stock
    const job = await tx.job_work_orders.create({
      data: {
        jobWorkNumber,
        processType: 'DYEING',
        labDipId: labDipId || null, // Now optional for style-based PO
        styleId: resolvedStyleId,
        fabricId: resolvedFabricId,
        processorId: resolvedProcessorId,
        fabricStockLotId: validatedFabricStockLotId,
        greigeStockLotId: greigeStockLotId || null,
        purchaseOrderId: po.id,
        fabricType,
        qtySentMeters,
        sentWidthInches,
        expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
        expectedShrinkage,
        agreedRatePerMeter,
        isRateTbd, // Explicit TBD marker when rate=0 is intentional
        remarks,
        status: 'READY_TO_SEND',
        createdById: userId,
      },
    });

    // Re-fetch the PO with full includes
    const fullPO = await tx.purchase_orders.findUnique({
      where: { id: po.id },
      include: processPOInclude,
    });

    return { fullPO, job, labDip };
  });

  // If autoSend is true, immediately execute the send logic
  if (autoSend && result.fullPO) {
    const poId = result.fullPO.id;
    const job = result.job;

    // 1. Consume greige stock
    if (job.greigeStockLotId) {
      await greigeStockService.consumeGreigeStock(job.greigeStockLotId, Number(job.qtySentMeters), userId);
    }

    // 2. Auto-create finished fabric_master (reuse exact sendToMill pattern)
    let finishedFabricId: string | null = null;
    const colorName = result.labDip?.targetColor?.colorName || result.labDip?.colorReference || 'Unknown';
    const colorCode = result.labDip?.targetColor?.colorCode || null;
    const greigeId = result.labDip?.fabric?.greigeId || null;
    const finishType = 'DYED';

    // Check if a matching fabric_master already exists
    if (greigeId) {
      const existingFabric = await prisma.fabric_master.findFirst({
        where: { greigeId, colorName, finishType, isActive: true },
      });
      if (existingFabric) finishedFabricId = existingFabric.id;
    }

    if (!finishedFabricId) {
      // Generate fabric code
      const styleCode = result.labDip?.style?.styleCode || 'STK';
      const prefix = `FAB-${styleCode}-`;
      const existingCodes = await prisma.fabric_master.findMany({
        where: { fabricCode: { startsWith: prefix } },
        select: { fabricCode: true },
        orderBy: { fabricCode: 'desc' },
        take: 1,
      });
      let nextSeq = 1;
      if (existingCodes.length > 0) {
        const seqMatch = existingCodes[0].fabricCode.match(/-(\d+)$/);
        if (seqMatch) nextSeq = parseInt(seqMatch[1]) + 1;
      }
      const fabricCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;

      // Build fabric name
      const greige = result.labDip?.fabric?.greige;
      const greigeGeneric = greige?.genericGreigeName || greige?.greigeName?.split('/')[0]?.trim() || 'Fabric';
      const widthStr = `${Number(job.sentWidthInches)}"`;
      const fabricName = [styleCode, greigeGeneric, 'Dyed', colorName, widthStr].filter(Boolean).join(' - ');

      const newFabric = await prisma.fabric_master.create({
        data: {
          fabricCode,
          fabricName,
          greigeId,
          greigeName: greige?.greigeName || null,
          genericGreigeName: greige?.genericGreigeName || null,
          colorName,
          colorCode,
          finishType,
          actualWidth: job.sentWidthInches,
          cutableWidth: new Prisma.Decimal(Math.max(Number(job.sentWidthInches) - cutableWidthDeduction, 0)), // BUG-DYE9 fix
          composition: greige?.composition || null,
          yarnCount: greige?.yarnCount || null,
          styleReference: styleCode,
          source: 'AUTO_FROM_JOB_WORK',
          isGeneric: false,
          isActive: true,
          createdById: userId,
        },
      });
      finishedFabricId = newFabric.id;
    }

    // 3. Auto-create OUTWARD challan
    let outwardChallanId: string | null = null;
    try {
      const challan = await createChallan({
        challanType: 'OUTWARD',
        challanDate: sentDate ? new Date(sentDate) : new Date(),
        fromType: 'WAREHOUSE',
        fromName: 'Main Warehouse',
        toType: 'VENDOR',
        toId: result.fullPO.supplierId,
        toName: result.fullPO.suppliers?.name || 'Mill',
        purchaseOrderId: poId,
        vehicleNumber,
        issuedById: userId,
        unit: Unit.METER,
        remarks: challanNumber ? `Manual challan ref: ${challanNumber}` : undefined,
        items: [
          {
            itemType: 'GREIGE',
            fabricId: job.fabricId,
            greigeStockId: job.greigeStockLotId || undefined,
            description: `Greige fabric for Dyeing - ${result.labDip?.style?.styleCode || ''}`,
            quantity: Number(job.qtySentMeters),
            unit: Unit.METER,
            rate: Number(job.agreedRatePerMeter),
          },
        ],
      });
      outwardChallanId = challan.id;
    } catch (challanError) {
      logger.error('Failed to create outward challan for dyeing auto-send', {
        error: challanError,
        jobId: job.id,
        greigeStockLotId: job.greigeStockLotId,
      });
    }

    // 4. Update job work order to AT_MILL
    await prisma.job_work_orders.update({
      where: { id: job.id },
      data: {
        sentDate: sentDate ? new Date(sentDate) : new Date(),
        challanNumber,
        vehicleNumber,
        finishedFabricId,
        outwardChallanId,
        status: 'AT_MILL',
      },
    });

    // 5. Update PO status to SENT
    await prisma.purchase_orders.update({
      where: { id: poId },
      data: { status: 'SENT' },
    });

    // Re-fetch full PO after send
    const finalPO = await prisma.purchase_orders.findUnique({
      where: { id: poId },
      include: processPOInclude,
    });

    return res.status(201).json({
      data: {
        ...finalPO,
        processPOStatus: computeProcessPOStatus(finalPO),
      },
      message: 'Dyeing process PO created and sent to mill successfully',
    });
  }

  res.status(201).json({
    data: {
      ...result.fullPO,
      processPOStatus: computeProcessPOStatus(result.fullPO),
    },
    message: 'Dyeing process PO created successfully',
  });
};

// 4. Delete Process PO (only DRAFT/READY_TO_SEND)
export const deleteProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;

  const po = await prisma.purchase_orders.findUnique({
    where: { id },
    include: {
      jobWorkOrder: true,
    },
  });

  if (!po) {
    throw new NotFoundError('Process PO', id);
  }

  const job = (po as any).jobWorkOrder;
  const jobStatus = job?.status as string;

  // Only allow delete if nothing has been sent yet
  if (job && jobStatus !== 'READY_TO_SEND') {
    throw new BusinessError(
      `Cannot delete Process PO. Job status is ${jobStatus}. Only DRAFT/READY_TO_SEND POs can be deleted.`
    );
  }

  if (po.status !== 'DRAFT') {
    throw new BusinessError(`Cannot delete Process PO with status ${po.status}. Only DRAFT POs can be deleted.`);
  }

  await prisma.$transaction(async (tx) => {
    // Delete job work order first (FK constraint)
    if (job) {
      await tx.job_work_orders.delete({ where: { id: job.id } });
    }
    // Delete PO items
    await tx.purchase_order_items.deleteMany({ where: { poId: id } });
    // Delete PO
    await tx.purchase_orders.delete({ where: { id } });
  });

  res.json({ message: 'Process PO deleted successfully' });
};

// 5. Send Process PO to Mill (dispatch greige + auto OUTWARD challan)
export const sendProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { sentDate, challanNumber, vehicleNumber } = req.body;
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  // BUG-DYE9 fix: Use configurable cutable width deduction from system settings
  const cutableWidthDeduction = await systemSettingsService.getNumber('GREIGE_CUTABLE_WIDTH_DEDUCTION_CM', 2);

  const po = await prisma.purchase_orders.findUnique({
    where: { id },
    include: {
      suppliers: { select: { id: true, name: true, code: true } },
      jobWorkOrder: {
        include: {
          labDip: {
            include: {
              targetColor: { select: { colorName: true, colorCode: true } },
              fabric: {
                select: {
                  id: true,
                  fabricName: true,
                  greigeId: true,
                  greige: {
                    select: {
                      id: true,
                      greigeCode: true,
                      greigeName: true,
                      genericGreigeName: true,
                      composition: true,
                      yarnCount: true,
                    },
                  },
                },
              },
            },
          },
          style: { select: { id: true, styleCode: true, styleName: true } },
          greigeStockLot: true,
        },
      },
    },
  });

  if (!po) {
    throw new NotFoundError('Process PO', id);
  }

  const job = (po as any).jobWorkOrder;
  if (!job) {
    throw new ValidationError('No job work order linked to this PO');
  }

  if (job.status !== 'READY_TO_SEND') {
    throw new BusinessError(`Cannot send. Job status is ${job.status}, expected READY_TO_SEND`);
  }

  // Consume greige stock
  if (job.greigeStockLotId) {
    await greigeStockService.consumeGreigeStock(job.greigeStockLotId, Number(job.qtySentMeters), userId);
  }

  // Auto-create finished fabric_master (reuse exact sendToMill pattern)
  let finishedFabricId: string | null = null;
  const colorName = job.labDip?.targetColor?.colorName || job.labDip?.colorReference || 'Unknown';
  const colorCode = job.labDip?.targetColor?.colorCode || null;
  const greigeId = job.labDip?.fabric?.greigeId || null;
  const finishType = 'DYED';

  // Check if a matching fabric_master already exists
  if (greigeId) {
    const existingFabric = await prisma.fabric_master.findFirst({
      where: {
        greigeId,
        colorName,
        finishType,
        isActive: true,
      },
    });
    if (existingFabric) {
      finishedFabricId = existingFabric.id;
    }
  }

  if (!finishedFabricId) {
    const existingBySource = await prisma.fabric_master.findFirst({
      where: {
        greigeId: greigeId || undefined,
        colorName,
        finishType,
        isActive: true,
      },
    });
    if (existingBySource) {
      finishedFabricId = existingBySource.id;
    }
  }

  if (!finishedFabricId) {
    // Generate fabric code
    const styleCode = job.style?.styleCode || 'STK';
    const prefix = `FAB-${styleCode}-`;
    const existingCodes = await prisma.fabric_master.findMany({
      where: { fabricCode: { startsWith: prefix } },
      select: { fabricCode: true },
      orderBy: { fabricCode: 'desc' },
      take: 1,
    });
    let nextSeq = 1;
    if (existingCodes.length > 0) {
      const seqMatch = existingCodes[0].fabricCode.match(/-(\d+)$/);
      if (seqMatch) nextSeq = parseInt(seqMatch[1]) + 1;
    }
    const fabricCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;

    // Build fabric name
    const greige = job.labDip?.fabric?.greige;
    const greigeGeneric = greige?.genericGreigeName || greige?.greigeName?.split('/')[0]?.trim() || 'Fabric';
    const widthStr = `${Number(job.sentWidthInches)}"`;
    const fabricName = [styleCode, greigeGeneric, 'Dyed', colorName, widthStr].filter(Boolean).join(' - ');

    const newFabric = await prisma.fabric_master.create({
      data: {
        fabricCode,
        fabricName,
        greigeId,
        greigeName: greige?.greigeName || null,
        genericGreigeName: greige?.genericGreigeName || null,
        colorName,
        colorCode,
        finishType,
        actualWidth: job.sentWidthInches,
        cutableWidth: new Prisma.Decimal(Math.max(Number(job.sentWidthInches) - cutableWidthDeduction, 0)), // BUG-DYE9 fix
        composition: greige?.composition || null,
        yarnCount: greige?.yarnCount || null,
        styleReference: styleCode,
        source: 'AUTO_FROM_JOB_WORK',
        isGeneric: false,
        isActive: true,
        createdById: userId,
      },
    });
    finishedFabricId = newFabric.id;
  }

  // Auto-create OUTWARD challan
  let outwardChallanId: string | null = null;
  try {
    const challan = await createChallan({
      challanType: 'OUTWARD',
      challanDate: sentDate ? new Date(sentDate) : new Date(),
      fromType: 'WAREHOUSE',
      fromName: 'Main Warehouse',
      toType: 'VENDOR',
      toId: po.supplierId,
      toName: (po as any).suppliers?.name || 'Mill',
      purchaseOrderId: po.id,
      vehicleNumber,
      issuedById: userId,
      unit: Unit.METER,
      remarks: challanNumber ? `Manual challan ref: ${challanNumber}` : undefined,
      items: [
        {
          itemType: 'GREIGE',
          fabricId: job.fabricId,
          greigeStockId: job.greigeStockLotId || undefined,
          description: `Greige fabric for Dyeing - ${job.style?.styleCode || ''}`,
          quantity: Number(job.qtySentMeters),
          unit: Unit.METER,
          rate: Number(job.agreedRatePerMeter),
        },
      ],
    });
    outwardChallanId = challan.id;
  } catch (challanError) {
    logger.error('Failed to create outward challan for dyeing send-out', {
      error: challanError,
      jobId: job.id,
      greigeStockLotId: job.greigeStockLotId,
    });
  }

  // Update job work order
  const updatedJob = await prisma.job_work_orders.update({
    where: { id: job.id },
    data: {
      sentDate: sentDate ? new Date(sentDate) : new Date(),
      challanNumber,
      vehicleNumber,
      finishedFabricId,
      outwardChallanId,
      status: 'AT_MILL',
    },
  });

  // Update PO status to SENT
  await prisma.purchase_orders.update({
    where: { id },
    data: { status: 'SENT' },
  });

  // Re-fetch full PO
  const fullPO = await prisma.purchase_orders.findUnique({
    where: { id },
    include: processPOInclude,
  });

  res.json({
    data: {
      ...fullPO,
      processPOStatus: computeProcessPOStatus(fullPO),
    },
  });
};

// 6. Receive Process PO from Mill (receive fabric + auto INWARD challan)
export const receiveProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const {
    qtyReceivedMeters,
    receivedWidthInches,
    receivedDate,
    receivedChallan,
    invoiceNumber,
    thanCount,
    foldLengthCm,
  } = req.body;
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  // BUG-DYE9 fix: Use configurable cutable width deduction from system settings
  const cutableWidthDeduction = await systemSettingsService.getNumber('GREIGE_CUTABLE_WIDTH_DEDUCTION_CM', 2);

  const po = await prisma.purchase_orders.findUnique({
    where: { id },
    include: {
      suppliers: { select: { id: true, name: true, code: true } },
      jobWorkOrder: {
        include: {
          style: { select: { id: true, styleCode: true } },
        },
      },
    },
  });

  if (!po) {
    throw new NotFoundError('Process PO', id);
  }

  // Conflict guard: check if already received via GRN
  const existingGRN = await prisma.goods_receiving_notes.findFirst({
    where: { poId: id, status: { not: 'REJECTED' } },
  });
  if (existingGRN) {
    throw new BusinessError(`This processing PO has already been received via GRN ${(existingGRN as any).grnNumber}`);
  }

  const job = (po as any).jobWorkOrder;
  if (!job) {
    throw new ValidationError('No job work order linked to this PO');
  }

  if (job.status !== 'AT_MILL' && job.status !== 'SENT_TO_MILL') {
    throw new BusinessError(`Cannot receive. Job status is ${job.status}, expected AT_MILL`);
  }

  if (job.receivedDate) {
    throw new ValidationError('Fabric has already been received');
  }

  // Calculate actual meters from than measurement if provided
  let calculatedActualMeters: number | null = null;
  let actualMeters = qtyReceivedMeters;

  if (thanCount && foldLengthCm) {
    calculatedActualMeters = (thanCount * foldLengthCm) / 100;
    if (!qtyReceivedMeters) {
      actualMeters = calculatedActualMeters;
    }
  }

  // Calculate shrinkage
  const sentMeters = Number(job.qtySentMeters);
  const actualShrinkage = sentMeters > 0 ? ((sentMeters - actualMeters) / sentMeters) * 100 : 0;

  // Calculate width variance
  const widthVariance = receivedWidthInches - Number(job.sentWidthInches);

  // Update fabric_master's actualWidth with received width
  if (job.finishedFabricId && receivedWidthInches) {
    await prisma.fabric_master.update({
      where: { id: job.finishedFabricId },
      data: {
        actualWidth: receivedWidthInches,
        cutableWidth: new Prisma.Decimal(Math.max(receivedWidthInches - cutableWidthDeduction, 0)), // BUG-DYE9 fix
      },
    });
  }

  // Auto-create INWARD challan
  let inwardChallanId: string | null = null;
  try {
    const challan = await createChallan({
      challanType: 'INWARD',
      challanDate: receivedDate ? new Date(receivedDate) : new Date(),
      fromType: 'VENDOR',
      fromId: po.supplierId,
      fromName: (po as any).suppliers?.name || 'Mill',
      toType: 'WAREHOUSE',
      toName: 'Main Warehouse',
      purchaseOrderId: po.id,
      issuedById: userId,
      unit: Unit.METER,
      remarks: receivedChallan ? `Vendor challan ref: ${receivedChallan}` : undefined,
      items: [
        {
          itemType: 'FABRIC',
          fabricId: job.finishedFabricId || job.fabricId,
          description: `Dyed fabric received - ${job.style?.styleCode || ''}`,
          quantity: actualMeters,
          unit: Unit.METER,
        },
      ],
    });
    inwardChallanId = challan.id;
  } catch (challanError) {
    logger.error('Failed to create inward challan for dyed fabric receipt', {
      error: challanError,
      jobId: job.id,
      finishedFabricId: job.finishedFabricId,
    });
  }

  // Update job work order
  await prisma.job_work_orders.update({
    where: { id: job.id },
    data: {
      qtyReceivedMeters: actualMeters,
      receivedWidthInches,
      receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
      receivedChallan,
      invoiceNumber,
      actualShrinkage,
      widthVariance,
      thanCount: thanCount || null,
      foldLengthCm: foldLengthCm ? new Prisma.Decimal(foldLengthCm) : null,
      calculatedActualMeters: calculatedActualMeters ? new Prisma.Decimal(calculatedActualMeters) : null,
      inwardChallanId,
      status: 'RECEIVED',
    },
  });

  // Re-fetch full PO
  const fullPO = await prisma.purchase_orders.findUnique({
    where: { id },
    include: processPOInclude,
  });

  res.json({
    data: {
      ...fullPO,
      processPOStatus: computeProcessPOStatus(fullPO),
    },
  });
};

// 7. Quality Check for Process PO
export const qualityCheckProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { qualityGrade, colorMatchStatus, defectMeters, defectType, actualRate, remarks } = req.body;

  const po = await prisma.purchase_orders.findUnique({
    where: { id },
    include: {
      jobWorkOrder: true,
    },
  });

  if (!po) {
    throw new NotFoundError('Process PO', id);
  }

  const job = (po as any).jobWorkOrder;
  if (!job) {
    throw new ValidationError('No job work order linked to this PO');
  }

  if (!job.receivedDate) {
    throw new ValidationError('Fabric has not been received yet');
  }

  if (job.status !== 'RECEIVED') {
    throw new BusinessError(`Cannot quality check. Job status is ${job.status}, expected RECEIVED`);
  }

  await prisma.job_work_orders.update({
    where: { id: job.id },
    data: {
      qualityGrade,
      colorMatchStatus,
      defectMeters,
      defectType,
      actualRate,
      remarks: remarks ? `${job.remarks || ''}\n[QC Note] ${remarks}` : job.remarks,
      status: 'QUALITY_CHECKED',
    },
  });

  // Re-fetch full PO
  const fullPO = await prisma.purchase_orders.findUnique({
    where: { id },
    include: processPOInclude,
  });

  res.json({
    data: {
      ...fullPO,
      processPOStatus: computeProcessPOStatus(fullPO),
    },
  });
};

// 8. Update Stock for Process PO (create fabric_stock entries)
export const updateStockProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  // BUG-DYE9 fix: Use configurable cutable width deduction from system settings
  const cutableWidthDeduction = await systemSettingsService.getNumber('GREIGE_CUTABLE_WIDTH_DEDUCTION_CM', 2);

  const po = await prisma.purchase_orders.findUnique({
    where: { id },
    include: {
      purchase_order_items: true,
      jobWorkOrder: {
        include: {
          fabricStockLot: true,
          greigeStockLot: true,
          style: { select: { id: true, styleCode: true } },
        },
      },
    },
  });

  if (!po) {
    throw new NotFoundError('Process PO', id);
  }

  const job = (po as any).jobWorkOrder;
  if (!job) {
    throw new ValidationError('No job work order linked to this PO');
  }

  if (job.status !== 'QUALITY_CHECKED') {
    throw new ValidationError('Quality check must be completed first');
  }

  if (!job.finishedFabricId) {
    throw new ValidationError('No finished fabric linked. Was sendProcessPO completed properly?');
  }

  const goodQty = Number(job.qtyReceivedMeters) - Number(job.defectMeters || 0);
  const receivedWidth = Number(job.receivedWidthInches || job.sentWidthInches);
  const cutableWidth = Math.max(receivedWidth - cutableWidthDeduction, 0); // BUG-DYE9 fix

  const processingRate = Number(job.actualRate || job.agreedRatePerMeter);
  // Use greige stock cost if available, fall back to fabric stock cost
  const sourceCost = job.greigeStockLot?.purchaseCost
    ? Number(job.greigeStockLot.purchaseCost)
    : job.fabricStockLot?.purchaseCost
      ? Number(job.fabricStockLot.purchaseCost)
      : 0;
  const totalCostPerMeter = processingRate + sourceCost;

  const qualityGrade = job.qualityGrade === 'Reject' ? 'B' : job.qualityGrade || 'A';

  const fabricStock = await prisma.fabric_stock.create({
    data: {
      fabricId: job.finishedFabricId,
      finishedWidth: new Prisma.Decimal(receivedWidth),
      cutableWidth: new Prisma.Decimal(cutableWidth),
      quantityAvailable: new Prisma.Decimal(goodQty),
      quantityReserved: new Prisma.Decimal(0),
      quantityConsumed: new Prisma.Decimal(0),
      unit: 'meters',
      originStyleId: job.styleId,
      status: 'AVAILABLE',
      stockType: 'PLANNED_STOCK',
      fabricFinishType: 'DYED',
      weightedAvgCost: new Prisma.Decimal(totalCostPerMeter),
      purchaseCost: new Prisma.Decimal(totalCostPerMeter),
      qualityGrade,
      defectMeters: job.defectMeters,
      receivedDate: job.receivedDate || new Date(),
      agingDays: 0,
      createdById: userId,
    },
  });

  const defectMetersNum = Number(job.defectMeters || 0);
  let defectStockId: string | null = null;
  if (defectMetersNum > 0 && qualityGrade !== 'B') {
    const defectStock = await prisma.fabric_stock.create({
      data: {
        fabricId: job.finishedFabricId,
        finishedWidth: new Prisma.Decimal(receivedWidth),
        cutableWidth: new Prisma.Decimal(cutableWidth),
        quantityAvailable: new Prisma.Decimal(defectMetersNum),
        quantityReserved: new Prisma.Decimal(0),
        quantityConsumed: new Prisma.Decimal(0),
        unit: 'meters',
        originStyleId: job.styleId,
        status: 'AVAILABLE',
        stockType: 'PLANNED_STOCK',
        fabricFinishType: 'DYED',
        weightedAvgCost: new Prisma.Decimal(totalCostPerMeter * 0.5),
        purchaseCost: new Prisma.Decimal(totalCostPerMeter * 0.5),
        qualityGrade: 'B',
        defectMeters: new Prisma.Decimal(defectMetersNum),
        receivedDate: job.receivedDate || new Date(),
        agingDays: 0,
        createdById: userId,
      },
    });
    defectStockId = defectStock.id;
  }

  // Update job status to STOCK_UPDATED
  await prisma.job_work_orders.update({
    where: { id: job.id },
    data: {
      status: 'STOCK_UPDATED',
    },
  });

  // Update PO item receivedQuantity
  const poItems = (po as any).purchase_order_items;
  if (poItems && poItems.length > 0) {
    await prisma.purchase_order_items.update({
      where: { id: poItems[0].id },
      data: {
        receivedQuantity: new Prisma.Decimal(Number(job.qtyReceivedMeters)),
      },
    });
  }

  // Update PO status to RECEIVED
  await prisma.purchase_orders.update({
    where: { id },
    data: { status: 'RECEIVED' },
  });

  // Re-fetch full PO
  const fullPO = await prisma.purchase_orders.findUnique({
    where: { id },
    include: processPOInclude,
  });

  res.json({
    data: {
      ...fullPO,
      processPOStatus: computeProcessPOStatus(fullPO),
    },
    stockCreated: {
      fabricStockId: fabricStock.id,
      defectStockId,
      goodQtyMeters: goodQty,
      defectMeters: defectMetersNum,
      totalCostPerMeter,
      fabricFinishType: 'DYED',
    },
  });
};

// 9. Return Unprocessed (greige returned without processing -> credit back to greige_stock)
export const returnUnprocessedProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { returnedQtyMeters, returnDate, remarks } = req.body;
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  if (!returnedQtyMeters || returnedQtyMeters <= 0) {
    throw new ValidationError('returnedQtyMeters is required and must be > 0');
  }

  const po = await prisma.purchase_orders.findUnique({
    where: { id },
    include: {
      suppliers: { select: { id: true, name: true, code: true } },
      jobWorkOrder: {
        include: {
          style: { select: { id: true, styleCode: true } },
          greigeStockLot: true,
        },
      },
    },
  });

  if (!po) {
    throw new NotFoundError('Process PO', id);
  }

  const job = (po as any).jobWorkOrder;
  if (!job) {
    throw new ValidationError('No job work order linked to this PO');
  }

  if (job.status !== 'AT_MILL' && job.status !== 'SENT_TO_MILL') {
    throw new BusinessError(`Cannot return unprocessed. Job status is ${job.status}, expected AT_MILL`);
  }

  // Credit back to greige_stock
  if (job.greigeStockLotId) {
    await prisma.greige_stock.update({
      where: { id: job.greigeStockLotId },
      data: {
        quantityAvailable: { increment: returnedQtyMeters },
        quantityConsumed: { decrement: returnedQtyMeters },
        status: 'AVAILABLE', // Mark available again since stock was returned
      },
    });
  }

  // Auto-create INWARD challan for returned greige
  let inwardChallanId: string | null = null;
  try {
    const challan = await createChallan({
      challanType: 'INWARD',
      challanDate: returnDate ? new Date(returnDate) : new Date(),
      fromType: 'VENDOR',
      fromId: po.supplierId,
      fromName: (po as any).suppliers?.name || 'Mill',
      toType: 'WAREHOUSE',
      toName: 'Main Warehouse',
      purchaseOrderId: po.id,
      issuedById: userId,
      unit: Unit.METER,
      remarks: `Unprocessed greige returned${remarks ? ': ' + remarks : ''}`,
      items: [
        {
          itemType: 'GREIGE',
          fabricId: job.fabricId,
          greigeStockId: job.greigeStockLotId || undefined,
          description: `Unprocessed greige fabric returned - ${job.style?.styleCode || ''}`,
          quantity: returnedQtyMeters,
          unit: Unit.METER,
        },
      ],
    });
    inwardChallanId = challan.id;
  } catch (challanError) {
    logger.error('Failed to create inward challan for returned unprocessed greige', {
      error: challanError,
      jobId: job.id,
      returnedQtyMeters,
    });
  }

  // Update job status -- use RECEIVED since RETURNED is not in enum
  await prisma.job_work_orders.update({
    where: { id: job.id },
    data: {
      inwardChallanId,
      status: 'RECEIVED', // closest valid enum; mark via remarks
      remarks:
        `${job.remarks || ''}\n[RETURNED UNPROCESSED] ${returnedQtyMeters} meters returned on ${(returnDate ? new Date(returnDate) : new Date()).toISOString().split('T')[0]}. ${remarks || ''}`.trim(),
      qtyReceivedMeters: 0, // Nothing was processed
      receivedDate: returnDate ? new Date(returnDate) : new Date(),
    },
  });

  // Update PO status to CANCELLED
  await prisma.purchase_orders.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      remarks:
        `${po.remarks || ''}\n[RETURNED UNPROCESSED] Greige returned without processing. ${remarks || ''}`.trim(),
    },
  });

  // Re-fetch full PO
  const fullPO = await prisma.purchase_orders.findUnique({
    where: { id },
    include: processPOInclude,
  });

  res.json({
    data: {
      ...fullPO,
      processPOStatus: 'RETURNED',
    },
    returnDetails: {
      returnedQtyMeters,
      greigeStockCredited: !!job.greigeStockLotId,
      inwardChallanId,
    },
  });
};

// ============================================
// SUMMARY ENDPOINTS
// ============================================

// Get dyeing summary
export const getSummary = async (req: Request, res: Response, _next: NextFunction) => {
  const [totalLabDips, labDipsPending, labDipsApproved, totalJobs, jobsByStatus] = await Promise.all([
    prisma.lab_dips.count({ where: { processType: PROCESS_TYPE } }),
    prisma.lab_dips.count({ where: { processType: PROCESS_TYPE, status: 'PENDING' } }),
    prisma.lab_dips.count({ where: { processType: PROCESS_TYPE, status: 'APPROVED' } }),
    prisma.job_work_orders.count({ where: { processType: PROCESS_TYPE } }),
    prisma.job_work_orders.groupBy({
      by: ['status'],
      where: { processType: PROCESS_TYPE },
      _count: true,
    }),
  ]);

  const atMill = jobsByStatus.find((s) => s.status === 'AT_MILL')?._count || 0;
  const received = jobsByStatus.find((s) => s.status === 'RECEIVED')?._count || 0;
  const qualityChecked = jobsByStatus.find((s) => s.status === 'QUALITY_CHECKED')?._count || 0;

  res.json({
    data: {
      total: totalJobs,
      labDipsPending,
      labDipsApproved,
      atMill,
      received,
      qualityChecked,
      byStatus: jobsByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    },
  });
};

// Get summary by style
export const getSummaryByStyle = async (req: Request, res: Response, _next: NextFunction) => {
  const { styleId } = req.params;

  const [totalLabDips, labDipsPending, labDipsApproved, totalJobs, jobsByStatus] = await Promise.all([
    prisma.lab_dips.count({ where: { processType: PROCESS_TYPE, styleId } }),
    prisma.lab_dips.count({ where: { processType: PROCESS_TYPE, styleId, status: 'PENDING' } }),
    prisma.lab_dips.count({ where: { processType: PROCESS_TYPE, styleId, status: 'APPROVED' } }),
    prisma.job_work_orders.count({ where: { processType: PROCESS_TYPE, styleId } }),
    prisma.job_work_orders.groupBy({
      by: ['status'],
      where: { processType: PROCESS_TYPE, styleId },
      _count: true,
    }),
  ]);

  const atMill = jobsByStatus.find((s) => s.status === 'AT_MILL')?._count || 0;
  const received = jobsByStatus.find((s) => s.status === 'RECEIVED')?._count || 0;
  const qualityChecked = jobsByStatus.find((s) => s.status === 'QUALITY_CHECKED')?._count || 0;

  res.json({
    data: {
      total: totalJobs,
      labDipsPending,
      labDipsApproved,
      atMill,
      received,
      qualityChecked,
      byStatus: jobsByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    },
  });
};

// Get summary by mill
export const getSummaryByMill = async (req: Request, res: Response, _next: NextFunction) => {
  const { processorId } = req.params;

  const [totalLabDips, labDipsPending, labDipsApproved, totalJobs, jobsByStatus] = await Promise.all([
    prisma.lab_dips.count({ where: { processType: PROCESS_TYPE, processorId } }),
    prisma.lab_dips.count({ where: { processType: PROCESS_TYPE, processorId, status: 'PENDING' } }),
    prisma.lab_dips.count({ where: { processType: PROCESS_TYPE, processorId, status: 'APPROVED' } }),
    prisma.job_work_orders.count({ where: { processType: PROCESS_TYPE, processorId } }),
    prisma.job_work_orders.groupBy({
      by: ['status'],
      where: { processType: PROCESS_TYPE, processorId },
      _count: true,
    }),
  ]);

  const atMill = jobsByStatus.find((s) => s.status === 'AT_MILL')?._count || 0;
  const received = jobsByStatus.find((s) => s.status === 'RECEIVED')?._count || 0;
  const qualityChecked = jobsByStatus.find((s) => s.status === 'QUALITY_CHECKED')?._count || 0;

  res.json({
    data: {
      total: totalJobs,
      labDipsPending,
      labDipsApproved,
      atMill,
      received,
      qualityChecked,
      byStatus: jobsByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    },
  });
};
