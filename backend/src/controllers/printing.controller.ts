import { Request, Response, NextFunction } from 'express';
import { BusinessError, NotFoundError, ValidationError, UnauthorizedError } from '../errors';
import prisma from '../config/database';
import { Prisma, Unit } from '@prisma/client';
import { createChallan } from '../services/challan.service';
import { issueJobWorkOrder } from '../services/job-work-issuance.service';
import { generateUnifiedPONumber } from '../utils/po-number-generator';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';
import { formatStyleCodeWithRef } from '../utils/style-ref-format';
import {
  getOrCreateFinishedFabricV2,
  rebuildAutoFabricName,
  resolveFinishedFabricIdentity,
  resolveManualJobStyleFabricAnchor,
} from '../services/helpers/fabric-identity.helper';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';
// BUG-INV3 fix: Import material sync helpers for processor receipt stock_levels sync
import { ensureMaterialRecord, syncStockLevelQuantity } from '../services/helpers/material-sync.helper';
import greigeStockService from '../services/greige-stock.service';
import { isJwoDead, JWO_PRE_ISSUE_STATUSES, JWO_AT_PROCESSOR_STATUSES } from '../services/helpers/jwo-status.helper';
import { echoShadowPoStatus } from '../services/helpers/shadow-po.helper';
// BUG-PRT5 fix: Import decimal.js helpers for safe cost calculations
import {
  toCurrency,
  addCurrency,
  multiplyCurrency,
  divideCurrency,
  toNumber,
  applyShrinkageLoss,
  roundToCent,
} from '../utils/currency';
// BUG-DYE9 fix: Import system settings service for configurable cutable width deduction
import { systemSettingsService } from '../services/system-settings.service';
// Phase 6: Job work order service for loss split calculation
import { jobWorkOrderService, JobWorkOrderError, JWO_ERROR_CODES } from '../services/job-work-order.service';
// Atomic scoped numbering helpers now live in utils/jobWorkNumber.ts
// (shared with dyeing.controller.ts and the MRP → JWO bridge in mrp.service.ts)
import { maxNumericSuffix, seedScopedSequenceIfMissing, generateJobWorkNumber } from '../utils/jobWorkNumber';
import { findProcessingRequirementMatches, updateJwoReceivedQuantity } from '../services/mrp.service';
import { resolveJwoExpectedShrinkage } from '../services/helpers/shrinkage-resolver.helper';
import { jwoRateProvenance } from '../services/helpers/jwo-rate.helper';
import {
  processJwoInclude,
  toProcessPOEnvelope,
  resolveProcessJwo,
} from '../services/helpers/process-po-envelope.helper';

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
      buyerStyleRef: true,
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

// ============================================
// LAB DIP ENDPOINTS
// ============================================

// Generate lab dip number — atomic per-style sequence; visible format preserved:
// {LDP|LDD}-{styleCode}-NNN. dyeing.controller.ts writes the same lab_dips.labDipNumber column
// and uses this identical `${processPrefix}-${styleCode}` key scheme, so series can't collide.
const generateLabDipNumber = async (processType: string, styleCode: string): Promise<string> => {
  const prefix = `${processType === 'PRINTING' ? 'LDP' : 'LDD'}-${styleCode}`;
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
  const {
    page = '1',
    limit = '10',
    search,
    processType = 'PRINTING',
    status,
    styleId,
    processorId,
    fromDate,
    toDate,
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.lab_dipsWhereInput = {
    processType: processType as string,
  };

  if (search) {
    where.OR = [
      { labDipNumber: { contains: search as string, mode: 'insensitive' } },
      { style: { styleCode: { contains: search as string, mode: 'insensitive' } } },
      { style: { buyerStyleRef: { contains: search as string, mode: 'insensitive' } } },
      { style: { styleName: { contains: search as string, mode: 'insensitive' } } },
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

  const {
    processType = 'PRINTING',
    styleId,
    fabricId,
    designArtwork,
    printMethod,
    printChemistry,
    targetColorId,
    colorReference,
    processorId,
    submissionDate,
    expectedDate,
    remarks,
  } = req.body;

  // Get style for labDipNumber
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    select: { styleCode: true },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  const labDipNumber = await generateLabDipNumber(processType, style.styleCode);

  const labDip = await prisma.lab_dips.create({
    data: {
      labDipNumber,
      processType,
      styleId,
      fabricId,
      designArtwork,
      printMethod,
      printChemistry,
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

  res.status(201).json({ data: transformLabDip(labDip as any), message: 'Print lab dip created successfully' });
};

// Update lab dip
export const updateLabDip = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const {
    designArtwork,
    printMethod,
    printChemistry,
    targetColorId,
    colorReference,
    processorId,
    submissionDate,
    expectedDate,
    receivedDate,
    remarks,
  } = req.body;

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  // Don't allow update if already approved
  if (existing.status === 'APPROVED') {
    throw new ValidationError('Cannot update an approved lab dip');
  }

  const updateData: any = {};

  if (designArtwork !== undefined) updateData.designArtwork = designArtwork;
  if (printMethod !== undefined) updateData.printMethod = printMethod;
  if (printChemistry !== undefined) updateData.printChemistry = printChemistry;
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

  // Don't allow delete if job work orders exist
  if ((existing as any).jobWorkOrders?.length > 0) {
    throw new ValidationError('Cannot delete lab dip with existing job work orders');
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
      remarks: remarks ? `${existing.remarks || ''}\n[Resubmit Request] ${remarks}` : existing.remarks,
    },
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// Get approved lab dips
export const getApprovedLabDips = async (req: Request, res: Response, _next: NextFunction) => {
  const { processType = 'PRINTING', styleId } = req.query;

  const where: Prisma.lab_dipsWhereInput = {
    processType: processType as string,
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
  const { q, processType = 'PRINTING' } = req.query;

  if (!q || (q as string).length < 2) {
    return res.json({ data: [] });
  }

  const labDips = await prisma.lab_dips.findMany({
    where: {
      processType: processType as string,
      OR: [
        { labDipNumber: { contains: q as string, mode: 'insensitive' } },
        { style: { styleCode: { contains: q as string, mode: 'insensitive' } } },
        { style: { buyerStyleRef: { contains: q as string, mode: 'insensitive' } } },
      ],
    },
    include: labDipInclude,
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  res.json({ data: labDips.map(transformLabDip) });
};

// ============================================
// BUYER APPROVAL ENDPOINTS
// ============================================

// Send to buyer for approval
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
    throw new ValidationError('Can only send approved lab dips to buyer');
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

// Record buyer approval
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
    throw new ValidationError('Lab dip is not pending buyer approval');
  }

  const labDip = await prisma.lab_dips.update({
    where: { id },
    data: {
      buyerApprovalStatus: 'APPROVED',
      buyerApprovalDate: new Date(),
      buyerRemarks,
    },
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// Record buyer rejection
export const buyerReject = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { buyerRemarks } = req.body;

  if (!buyerRemarks) {
    throw new ValidationError('Buyer remarks are required');
  }

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  if (existing.buyerApprovalStatus !== 'PENDING') {
    throw new ValidationError('Lab dip is not pending buyer approval');
  }

  const labDip = await prisma.lab_dips.update({
    where: { id },
    data: {
      buyerApprovalStatus: 'REJECTED',
      buyerApprovalDate: new Date(),
      buyerRemarks,
    },
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// Request buyer resubmit
export const buyerRequestResubmit = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;

  const existing = await prisma.lab_dips.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Lab dip', id);
  }

  if (existing.buyerApprovalStatus !== 'REJECTED' && existing.buyerApprovalStatus !== 'RESUBMIT_REQUIRED') {
    throw new ValidationError('Can only request resubmit for rejected lab dips');
  }

  const labDip = await prisma.lab_dips.update({
    where: { id },
    data: {
      buyerApprovalStatus: 'NOT_SENT',
      buyerApprovalDate: null,
      buyerRemarks: null,
      sentToBuyerDate: null,
      resubmissionCount: (existing.resubmissionCount || 0) + 1,
    },
    include: labDipInclude,
  });

  res.json({ data: transformLabDip(labDip as any) });
};

// ============================================
// JOB WORK ORDER (PRINT JOB) ENDPOINTS
// ============================================

// Job work number generation moved to utils/jobWorkNumber.ts (shared DJ/PJ scheme)

// Get all print jobs
export const getAllPrintJobs = async (req: Request, res: Response, _next: NextFunction) => {
  const {
    page = '1',
    limit = '10',
    search,
    processType = 'PRINTING',
    status,
    labDipId,
    styleId,
    processorId,
    fromDate,
    toDate,
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.job_work_ordersWhereInput = {
    processType: processType as string,
  };

  if (search) {
    where.OR = [
      { jobWorkNumber: { contains: search as string, mode: 'insensitive' } },
      { style: { styleCode: { contains: search as string, mode: 'insensitive' } } },
      { style: { buyerStyleRef: { contains: search as string, mode: 'insensitive' } } },
      { challanNumber: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (status) {
    where.jwoStatus = status as any;
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

// Get print job by ID
export const getPrintJobById = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;

  const job = await prisma.job_work_orders.findUnique({
    where: { id },
    include: jobWorkOrderInclude,
  });

  if (!job) {
    throw new NotFoundError('Print job', id);
  }

  res.json({ data: transformJobWorkOrder(job as any) });
};

// Create print job
export const createPrintJob = async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    processType = 'PRINTING',
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
    throw new ValidationError('Lab dip must be approved before creating a job');
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

  const jobWorkNumber = await generateJobWorkNumber(processType, (labDip as any).style.styleCode);

  const job = await prisma.job_work_orders.create({
    data: {
      jobWorkNumber,
      processType,
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
      jwoStatus: 'DRAFT',
      createdById: userId,
    },
    include: jobWorkOrderInclude,
  });

  res.status(201).json({ data: transformJobWorkOrder(job as any), message: 'Print job created successfully' });
};

// Update print job
export const updatePrintJob = async (req: Request, res: Response, _next: NextFunction) => {
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
    throw new NotFoundError('Print job', id);
  }

  // Don't allow update if already sent
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

// Delete print job
export const deletePrintJob = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;

  const existing = await prisma.job_work_orders.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Print job', id);
  }

  // Don't allow delete if already sent
  if (existing.sentDate) {
    throw new ValidationError('Cannot delete a job that has already been sent to mill');
  }

  await prisma.job_work_orders.delete({ where: { id } });

  res.json({ message: 'Print job deleted successfully' });
};

// RETIRED (issuance consolidation 2026-08-19): this pre-challan-era send consumed no
// greige, made no movement document, and set no statutory date. Zero frontend callers.
// The route stays registered so any stale client gets a clear 410, not a 404.
export const sendToMill = async (_req: Request, res: Response, _next: NextFunction) => {
  res.status(410).json({
    success: false,
    code: 'ENDPOINT_RETIRED',
    message: 'Retired — use POST /api/printing/process-pos/:id/send (atomic issue with challan + stock).',
  });
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

  const existing = await prisma.job_work_orders.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Print job', id);
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
    if (!qtyReceivedMeters) {
      actualMeters = calculatedActualMeters;
    }
  }

  // BUG-PRT5 fix: Use decimal.js for shrinkage calculation
  const sentMeters = Number(existing.qtySentMeters);
  const actualShrinkage =
    sentMeters > 0
      ? toNumber(
          divideCurrency(multiplyCurrency(toCurrency(sentMeters).minus(toCurrency(actualMeters)), 100), sentMeters)
        )
      : 0;

  // Calculate width variance
  const widthVariance = receivedWidthInches - Number(existing.sentWidthInches);

  // Measured width lands: patch the master's width columns and, for AUTO-created
  // masters, swap the width token inside the name (synced to materials)
  if (existing.finishedFabricId && receivedWidthInches) {
    await rebuildAutoFabricName(existing.finishedFabricId, Number(receivedWidthInches));
  }

  // GUARDED receive (receivedDate still null): the check at the top races with the GRN receive path
  // (grn.service PROCESSING branch, which uses the same guard) — without it, a receive via GRN and one
  // via this module could both pass the check and the later write would silently overwrite the first.
  const guarded = await prisma.job_work_orders.updateMany({
    where: { id, receivedDate: null },
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
      jwoStatus: 'RECEIVED',
    },
  });
  if (guarded.count === 0) {
    throw new ValidationError('Fabric has already been received (possibly via the GRN module)');
  }
  const job = await prisma.job_work_orders.findUniqueOrThrow({
    where: { id },
    include: jobWorkOrderInclude,
  });

  // Phase 6: Apply tolerance/loss split (normal vs abnormal)
  try {
    await jobWorkOrderService.applyLossSplit(id, actualMeters);
  } catch (lossSplitError) {
    logger.warn('[receiveFromMill] Loss split calculation failed:', {
      jobId: id,
      error: lossSplitError instanceof Error ? lossSplitError.message : lossSplitError,
    });
  }

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
    throw new NotFoundError('Print job', id);
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
      jwoStatus: 'QUALITY_CHECKED',
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

  const existing = await prisma.job_work_orders.findUnique({
    where: { id },
    include: {
      fabricStockLot: true,
      style: { select: { id: true, styleCode: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError('Print job', id);
  }

  if (existing.jwoStatus !== 'QUALITY_CHECKED') {
    throw new ValidationError('Quality check must be completed first');
  }

  if (!existing.finishedFabricId) {
    throw new ValidationError('No finished fabric linked. Was sendToMill completed properly?');
  }

  const goodQty = Number(existing.qtyReceivedMeters) - Number(existing.defectMeters || 0);
  const receivedWidth = Number(existing.receivedWidthInches || existing.sentWidthInches);
  const cutableWidth = receivedWidth > 2 ? receivedWidth - 2 : receivedWidth;

  // BUG-PRT5 fix: Use decimal.js for cost calculations
  const processingRate = toCurrency(existing.actualRate || existing.agreedRatePerMeter);
  const sourceCost = toCurrency(existing.fabricStockLot?.purchaseCost);
  const totalCostPerMeter = toNumber(addCurrency(processingRate, sourceCost));

  const qualityGrade = existing.qualityGrade === 'Reject' ? 'B' : existing.qualityGrade || 'A';

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
      fabricFinishType: 'PRINTED',
      weightedAvgCost: new Prisma.Decimal(totalCostPerMeter),
      purchaseCost: new Prisma.Decimal(totalCostPerMeter),
      qualityGrade,
      defectMeters: existing.defectMeters,
      receivedDate: existing.receivedDate || new Date(),
      agingDays: 0,
      createdById: userId,
    },
  });

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
        fabricFinishType: 'PRINTED',
        // BUG-PRT5 fix: Use decimal.js for defect cost calculation
        weightedAvgCost: new Prisma.Decimal(toNumber(multiplyCurrency(totalCostPerMeter, 0.5))),
        purchaseCost: new Prisma.Decimal(toNumber(multiplyCurrency(totalCostPerMeter, 0.5))),
        qualityGrade: 'B',
        defectMeters: new Prisma.Decimal(defectMeters),
        receivedDate: existing.receivedDate || new Date(),
        agingDays: 0,
        createdById: userId,
      },
    });
    defectStockId = defectStock.id;
  }

  const job = await prisma.job_work_orders.update({
    where: { id },
    data: {
      jwoStatus: 'STOCK_UPDATED',
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
      fabricFinishType: 'PRINTED',
    },
  });
};

// ============================================
// PROCESS PO ENDPOINTS (Unified PO + Job Work Order)
// ============================================

// Include/status logic now lives in services/helpers/process-po-envelope.helper.ts (Phase 4c-final)

// 1. Get all Process orders for Printing (Phase 4c-final: sourced from job_work_orders —
// covers legacy PO-paired records AND new JWO-only ones; rendered via the envelope)
export const getProcessPOs = async (req: Request, res: Response, _next: NextFunction) => {
  const { page = '1', limit = '10', search, status } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.job_work_ordersWhereInput = {
    processType: 'PRINTING',
    isActive: true,
    // Preserve today's visibility rule for soft-deleted legacy POs
    NOT: { purchaseOrder: { isActive: false } },
  };

  if (search) {
    where.AND = [
      {
        OR: [
          { jobWorkNumber: { contains: search as string, mode: 'insensitive' } },
          { purchaseOrder: { poNumber: { contains: search as string, mode: 'insensitive' } } },
          { style: { styleCode: { contains: search as string, mode: 'insensitive' } } },
          { style: { buyerStyleRef: { contains: search as string, mode: 'insensitive' } } },
        ],
      },
    ];
  }

  if (status && status !== 'ALL') {
    // Status filtering is done post-query since it's computed
    // but we can pre-filter for CANCELLED (either surface)
    if (status === 'CANCELLED') {
      where.OR = [{ jwoStatus: 'CANCELLED' }, { purchaseOrder: { status: 'CANCELLED' } }];
    }
  }

  const [items, total] = await Promise.all([
    prisma.job_work_orders.findMany({
      where,
      include: processJwoInclude,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.job_work_orders.count({ where }),
  ]);

  let results = items.map((jwo) => toProcessPOEnvelope(jwo));

  // Post-filter by computed status if needed
  if (status && status !== 'ALL' && status !== 'CANCELLED') {
    const statusFilter = status as string;
    results = results.filter((row: any) => row.processPOStatus === statusFilter);
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

// 2. Get single Process order by ID (JWO id, or legacy PO id via dual-lookup)
export const getProcessPOById = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;

  const jwo = await resolveProcessJwo(id, 'PRINTING');
  if (!jwo) {
    throw new NotFoundError('Process PO', id);
  }

  res.json({ data: toProcessPOEnvelope(jwo) });
};

// 3. Create Process PO (PO + Job Work Order together)
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
    // JWC5: caller explicitly accepts creating a PO even though MRP already generated one
    acknowledgeDuplicate = false,
  } = req.body;

  // Same rate rule as dyeing.createProcessPO: a positive rate is required unless isRateTbd
  // marks the zero as intentional (qty-rate audit 2026-08-24 — previously a silent 0 passed).
  if (!qtySentMeters || !sentWidthInches) {
    throw new ValidationError('Missing required fields: qtySentMeters, sentWidthInches');
  }
  if (!isRateTbd && (agreedRatePerMeter == null || Number(agreedRatePerMeter) <= 0)) {
    throw new ValidationError('agreedRatePerMeter is required (or mark the rate as TBD)');
  }
  const effectiveAgreedRate = isRateTbd ? Number(agreedRatePerMeter ?? 0) || 0 : Number(agreedRatePerMeter);

  // Either labDipId OR (styleId + fabricId + processorId) must be provided
  if (!labDipId && (!directStyleId || !directFabricId || !directProcessorId)) {
    throw new ValidationError('Either labDipId OR (styleId, fabricId, and processorId) must be provided');
  }

  if (!greigeStockLotId && !fabricStockLotId) {
    throw new ValidationError('Either greigeStockLotId or fabricStockLotId is required');
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
        style: { select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true } },
        fabric: {
          select: {
            id: true,
            fabricCode: true,
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
        processor: { select: { id: true, name: true, code: true } },
        targetColor: { select: { colorName: true, colorCode: true } },
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
        select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true },
      }),
      prisma.fabric_master.findUnique({
        where: { id: directFabricId },
        select: {
          id: true,
          fabricCode: true,
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
  let sourceGreigeId: string | null = null;

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
    sourceGreigeId = greigeStock.greigeId;
  }

  // JWC5 (Consolidation Phase 2): check for MRP PROCESSING requirements covering the same
  // greige/fabric + processor. Open requirements get LINKED to this PO (below, in-tx);
  // a live MRP-generated PO for the same work blocks creation unless explicitly acknowledged.
  const mrpMatches = await findProcessingRequirementMatches({
    greigeId: sourceGreigeId,
    fabricId: resolvedFabricId ?? null,
    processorId: resolvedProcessorId,
  });
  if ((mrpMatches.activePOs.length > 0 || mrpMatches.activeJwos.length > 0) && !acknowledgeDuplicate) {
    const docList = [
      ...mrpMatches.activePOs.map((p) => `${p.poNumber}${p.jobWorkNumber ? ` (JWO ${p.jobWorkNumber})` : ''}`),
      ...mrpMatches.activeJwos.map((j) => `JWO ${j.jobWorkNumber}`),
    ].join(', ');
    throw new BusinessError(
      `MRP already generated processing work for this greige and processor: ${docList}. ` +
        `Use that document (Job Work Orders / Printing → Process POs), or resubmit with acknowledgeDuplicate to create anyway.`,
      { duplicateProcessing: true, existingPOs: mrpMatches.activePOs, existingJwos: mrpMatches.activeJwos }
    );
  }

  // Validate fabric stock lot if provided (required by schema)
  if (validatedFabricStockLotId) {
    const fabricStock = await prisma.fabric_stock.findUnique({
      where: { id: validatedFabricStockLotId },
    });

    if (!fabricStock) {
      throw new NotFoundError('Fabric stock lot', fabricStockLotId);
    }
  }
  // Phase 4c-final (D1): no placeholder fabric_stock — fabricStockLotId is nullable
  // in schema; the stale "required by schema" fallback created phantom RESERVED lots.

  // Phase 4c-final: JWO-only — no purchase order is created. The JWO IS the
  // commercial + operational document.
  // MRP-48i: fill expectedShrinkage from the processor's rate card when the caller did not
  // supply one. Left null, the challan prints an expected return of 100% of what was sent.
  const greigeForShrinkage = greigeStockLotId
    ? await prisma.greige_stock.findUnique({
        where: { id: greigeStockLotId },
        select: { greigeId: true, greigeWidth: true },
      })
    : null;
  const resolvedExpectedShrinkage = await resolveJwoExpectedShrinkage({
    supplied: expectedShrinkage,
    processorId: resolvedProcessorId,
    greigeId: greigeForShrinkage?.greigeId ?? null,
  });
  // Greige (loom) width of the issued lot — distinct from sentWidthInches, which holds
  // the ASKED FINISHED width the processor must deliver (industry model 2026-08-18).
  const greigeWidthInches = greigeForShrinkage?.greigeWidth != null ? Number(greigeForShrinkage.greigeWidth) : null;

  // Billing basis (+ BUG-PRT5 decimal.js): the processor bills for the finished fabric he
  // returns, not the greige issued — deduct the expected shrinkage loss from the billed qty.
  const qtyBillable = toNumber(roundToCent(applyShrinkageLoss(qtySentMeters, resolvedExpectedShrinkage ?? 0)));
  const totalAmount = toNumber(roundToCent(multiplyCurrency(qtyBillable, effectiveAgreedRate)));

  // Qty-rate audit 2026-08-24: printing rate cards are keyed on the print SUB-TYPE, which this
  // endpoint's body does not carry — the card lookup is unresolvable here, so provenance records
  // the rate as MANUAL (or TBD). The typed rate rules the document either way.
  const rateProvenance = jwoRateProvenance(null, effectiveAgreedRate, { isRateTbd });

  const result = await prisma.$transaction(async (tx) => {
    // Generate job work number
    const styleCode = (labDip as any).style?.styleCode || 'STK';
    const jobWorkNumber = await generateJobWorkNumber('PRINTING', styleCode);

    // Phase 4a (BUG-JWC6): processTypeId enables JWO commercial totals
    const processTypeMaster = await tx.process_type_master.findFirst({
      where: { code: 'PRINTING', isActive: true },
      select: { id: true },
    });

    // Create job work order (greige lot attached; no PO)
    const job = await tx.job_work_orders.create({
      data: {
        jobWorkNumber,
        processType: 'PRINTING',
        processTypeId: processTypeMaster?.id ?? null,
        labDipId: labDipId || null, // Now optional for style-based PO
        styleId: resolvedStyleId,
        fabricId: resolvedFabricId,
        processorId: resolvedProcessorId,
        fabricStockLotId: validatedFabricStockLotId || null,
        greigeStockLotId: greigeStockLotId || null,
        fabricType,
        qtySentMeters,
        qtyBillable, // billing basis = expected fabric out (sent × (1 − shrinkage))
        greigeWidthInches,
        sentWidthInches,
        expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
        expectedShrinkage: resolvedExpectedShrinkage,
        agreedRatePerMeter: effectiveAgreedRate,
        isRateTbd, // Explicit TBD marker when rate=0 is intentional
        // Rate provenance (qty-rate audit 2026-08-24)
        rateCardId: rateProvenance.rateCardId,
        slabId: rateProvenance.slabId,
        rateSource: rateProvenance.rateSource,
        rateBasisQuantity: qtyBillable,
        costedRatePerMeter: rateProvenance.costedRatePerMeter,
        rateVarianceReason: rateProvenance.rateVarianceReason,
        remarks,
        jwoStatus: 'DRAFT',
        createdById: userId,
      },
    });

    // Phase 4a (BUG-JWC6): JWO commercial parity — unresolved GST downgrades to
    // subtotal-only (creation never fails; totalAmount null = R1 docs-blocked marker)
    try {
      await jobWorkOrderService.computeCommercialTotals(job.id, tx);
    } catch (error) {
      if (error instanceof JobWorkOrderError && error.code === JWO_ERROR_CODES.GST_RATE_UNRESOLVED) {
        await tx.job_work_orders.update({
          where: { id: job.id },
          data: { subtotal: totalAmount },
        });
        logger.warn(`[ProcessPO] JWO ${jobWorkNumber} created without GST — PRINTING gstRate unresolved`);
      } else {
        throw error;
      }
    }

    // JWC5: link the open MRP PROCESSING requirements this manual order covers, so MRP
    // stops re-offering them (guarded per-id flip — a concurrent generation loses the
    // race cleanly and we simply skip that requirement). Phase 4c-final: JWO links only.
    const linkedRequirementNumbers: string[] = [];
    for (const openReq of mrpMatches.openRequirements) {
      const flip = await tx.material_requirements.updateMany({
        where: { id: openReq.id, status: { in: ['PO_REQUIRED', 'PARTIAL_STOCK'] } },
        data: { status: 'PO_GENERATED' },
      });
      if (flip.count === 1) {
        await tx.requirement_jwo_links.create({
          data: {
            requirementId: openReq.id,
            jobWorkOrderId: job.id,
            // Fabric-basis: receivedQuantity accumulates fabric meters, so the allocation
            // must be fabric too (requirement shortfall is greige-basis — deduct shrinkage).
            allocatedQuantity: Math.min(
              toNumber(roundToCent(applyShrinkageLoss(openReq.shortfall, resolvedExpectedShrinkage ?? 0))),
              qtyBillable
            ),
          },
        });
        linkedRequirementNumbers.push(openReq.requirementNumber);
      }
    }
    if (linkedRequirementNumbers.length > 0) {
      await tx.job_work_orders.update({
        where: { id: job.id },
        data: {
          remarks: `${remarks || ''}\n[Linked] Covers MRP requirement(s) ${linkedRequirementNumbers.join(', ')}`.trim(),
        },
      });
      logger.info(
        `[ProcessPO] Linked ${linkedRequirementNumbers.length} open MRP PROCESSING requirement(s) to ${jobWorkNumber}: ${linkedRequirementNumbers.join(', ')}`
      );
    }

    return { job, labDip };
  });

  // If autoSend is true, immediately execute the send logic
  // If autoSend is true, immediately execute the send logic via the consolidated
  // issuance service. Create and issue stay separate transactions BY DESIGN: creation
  // must survive a send failure (the order stays READY_TO_SEND with a clear warning,
  // instead of the old half-sent states).
  if (autoSend) {
    const job = result.job;

    // Finished fabric identity (pre-tx; harmless catalog row if the issue fails).
    // Fixes the old bug where the artwork name was written INTO colorName ('Printed'
    // placeholder when absent) — design now lands in printDesign, colour stays colour.
    let finishedFabricId: string | null = null;
    {
      const dip: any = result.labDip;
      const greigeId = dip?.fabric?.greigeId || null;
      const dipStyle = dip?.style
        ? {
            id: dip.styleId ?? dip.style.id ?? null,
            styleCode: dip.style.styleCode ?? null,
            buyerStyleRef: dip.style.buyerStyleRef ?? null,
          }
        : null;
      const anchor =
        dipStyle?.id && greigeId ? await resolveManualJobStyleFabricAnchor(dipStyle.id, greigeId, 'PRINTED') : null;
      const identity = await resolveFinishedFabricIdentity({
        jwo: { labDip: dip, sentWidthInches: job.sentWidthInches },
        style: dipStyle,
        knownStyleFabricId: anchor,
        finishType: 'PRINTED',
      });
      if (identity) {
        const minted = await getOrCreateFinishedFabricV2(identity, userId, 'AUTO_FROM_JOB_WORK');
        finishedFabricId = minted.fabricId;
      } else if (job.fabricId) {
        // No greige lineage — keep the source master (legacy parity)
        finishedFabricId = job.fabricId;
      }
    }

    try {
      await issueJobWorkOrder(job.id, {
        userId,
        sentDate: sentDate ? new Date(sentDate) : undefined,
        challanNumber,
        vehicleNumber,
        finishedFabricId,
      });
    } catch (sendError) {
      const reason = sendError instanceof Error ? sendError.message : 'unknown error';
      logger.error('Auto-send failed after printing JWO creation — order left READY_TO_SEND', {
        jobId: job.id,
        error: sendError,
      });
      const createdOnly = await resolveProcessJwo(job.id, 'PRINTING');
      return res.status(201).json({
        data: createdOnly ? toProcessPOEnvelope(createdOnly) : null,
        message: `Printing job work order ${job.jobWorkNumber} created`,
        warning: `Created but not sent: ${reason}`,
      });
    }

    // Re-fetch after send (envelope shape)
    const finalJwo = await resolveProcessJwo(job.id, 'PRINTING');

    return res.status(201).json({
      data: finalJwo ? toProcessPOEnvelope(finalJwo) : null,
      message: `Printing job work order ${job.jobWorkNumber} created and sent to mill successfully`,
    });
  }

  const createdJwo = await resolveProcessJwo(result.job.id, 'PRINTING');
  res.status(201).json({
    data: createdJwo ? toProcessPOEnvelope(createdJwo) : null,
    message: `Printing job work order ${result.job.jobWorkNumber} created successfully`,
  });
};

// 4. Delete Process order (only DRAFT/READY_TO_SEND) — Phase 4c-final: JWO-keyed
export const deleteProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;

  const jwo = await resolveProcessJwo(id, 'PRINTING');
  if (!jwo) {
    throw new NotFoundError('Process PO', id);
  }

  // Only allow delete if nothing has been sent yet
  if (!JWO_PRE_ISSUE_STATUSES.includes(jwo.jwoStatus!)) {
    throw new BusinessError(`Cannot delete. Order is ${jwo.jwoStatus}. Only pre-issue orders can be deleted.`);
  }
  if (jwo.purchaseOrder && jwo.purchaseOrder.status !== 'DRAFT') {
    throw new BusinessError(`Cannot delete. Linked PO is ${jwo.purchaseOrder.status}, expected DRAFT.`);
  }

  await prisma.$transaction(async (tx) => {
    // Revert MRP requirements this order covered back to open (mirror of PO cancel)
    const jwoLinks = await tx.requirement_jwo_links.findMany({
      where: { jobWorkOrderId: jwo.id },
      select: { requirementId: true },
    });
    const poLinks = jwo.purchaseOrderId
      ? await tx.requirement_po_links.findMany({
          where: { purchaseOrderId: jwo.purchaseOrderId },
          select: { requirementId: true },
        })
      : [];
    const requirementIds = [...new Set([...jwoLinks, ...poLinks].map((l) => l.requirementId))];
    if (requirementIds.length > 0) {
      await tx.material_requirements.updateMany({
        where: { id: { in: requirementIds }, status: 'PO_GENERATED' },
        data: { status: 'PO_REQUIRED' },
      });
    }

    // Delete JWO first (cascades requirement_jwo_links + components)
    await tx.job_work_orders.delete({ where: { id: jwo.id } });
    // Then the legacy shadow PO pair, when present
    if (jwo.purchaseOrderId) {
      await tx.purchase_order_items.deleteMany({ where: { poId: jwo.purchaseOrderId } });
      await tx.purchase_orders.delete({ where: { id: jwo.purchaseOrderId } });
    }
  });

  res.json({ message: 'Process order deleted successfully' });
};

// 5. Send Process PO to Mill (dispatch greige + auto OUTWARD challan)
export const sendProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { sentDate, challanNumber, vehicleNumber, greigeStockLotId } = req.body;
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  // Phase 4c-final: JWO-keyed (dual-lookup accepts legacy PO ids)
  const jwo = await resolveProcessJwo(id, 'PRINTING');
  if (!jwo) {
    throw new NotFoundError('Process PO', id);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = jwo as any;

  if (job.status !== 'READY_TO_SEND') {
    throw new BusinessError(`Cannot send. Job status is ${job.status}, expected READY_TO_SEND`);
  }

  // Finished fabric identity (pre-tx: a minted master with a failed issue is a harmless
  // catalog row — cancel's orphan cleanup handles it)
  let finishedFabricId: string | null = null;
  {
    const greigeId = job.labDip?.fabric?.greigeId || null;
    const anchor =
      job.style?.id && greigeId ? await resolveManualJobStyleFabricAnchor(job.style.id, greigeId, 'PRINTED') : null;
    const identity = await resolveFinishedFabricIdentity({
      jwo: job,
      style: job.style,
      knownStyleFabricId: anchor,
      finishType: 'PRINTED',
    });
    if (identity) {
      const minted = await getOrCreateFinishedFabricV2(identity, userId, 'AUTO_FROM_JOB_WORK');
      finishedFabricId = minted.fabricId;
    } else if (job.fabricId) {
      // No greige lineage — keep the source master (legacy parity)
      finishedFabricId = job.fabricId;
    }
  }

  // Consolidated issuance: ONE atomic tx (mutex, challan born ISSUED, guarded consume,
  // statutory date, stamp). A greige JWO without a lot gets a clear 422 instead of the
  // old silent zero-consumption despatch.
  try {
    await issueJobWorkOrder(job.id, {
      userId,
      sentDate: sentDate ? new Date(sentDate) : undefined,
      greigeStockLotId: greigeStockLotId ?? undefined,
      challanNumber,
      vehicleNumber,
      finishedFabricId,
    });
  } catch (e) {
    if (e instanceof JobWorkOrderError) {
      throw new BusinessError(e.message);
    }
    throw e;
  }

  // Legacy shadow PO → SENT (pre-4c pairs only). Guarded echo (landmine №7): a raw
  // update here could resurrect a CANCELLED PO.
  await echoShadowPoStatus(prisma, job.purchaseOrderId, 'SENT');

  // Re-fetch (envelope shape)
  const fullJwo = await resolveProcessJwo(job.id, 'PRINTING');

  res.json({
    data: fullJwo ? toProcessPOEnvelope(fullJwo) : null,
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

  // Phase 4c-final: JWO-keyed (dual-lookup accepts legacy PO ids)
  const jwo = await resolveProcessJwo(id, 'PRINTING');
  if (!jwo) {
    throw new NotFoundError('Process PO', id);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = jwo as any;

  // Conflict guard: already received via GRN — by JWO link OR legacy PO link
  const existingGRN = await prisma.goods_receiving_notes.findFirst({
    where: {
      status: { not: 'REJECTED' },
      OR: [{ jobWorkOrderId: job.id }, ...(job.purchaseOrderId ? [{ poId: job.purchaseOrderId }] : [])],
    },
  });
  if (existingGRN) {
    throw new BusinessError(
      `This processing order has already been received via GRN ${(existingGRN as any).grnNumber}`
    );
  }
  if (!job) {
    throw new ValidationError('No job work order linked to this PO');
  }

  // Landmine No.1 fix: a cancelled/closed job's material was already credited back —
  // receiving (or re-returning) against it would double-count stock
  if (isJwoDead(job.jwoStatus)) {
    throw new BusinessError(
      `${job.jobWorkNumber} is ${job.jwoStatus?.toLowerCase()} — its stock was already credited back. Contact the office to re-open the job if material physically arrived.`
    );
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

  // BUG-PRT5 fix: Use decimal.js for shrinkage calculation
  const sentMeters = Number(job.qtySentMeters);
  const actualShrinkage =
    sentMeters > 0
      ? toNumber(
          divideCurrency(multiplyCurrency(toCurrency(sentMeters).minus(toCurrency(actualMeters)), 100), sentMeters)
        )
      : 0;

  // Calculate width variance
  const widthVariance = receivedWidthInches - Number(job.sentWidthInches);

  // Measured width lands: patch the master's width columns and, for AUTO-created
  // masters, swap the width token inside the name (synced to materials)
  if (job.finishedFabricId && receivedWidthInches) {
    await rebuildAutoFabricName(job.finishedFabricId, Number(receivedWidthInches));
  }

  // Auto-create INWARD challan
  let inwardChallanId: string | null = null;
  try {
    const challan = await createChallan({
      challanType: 'INWARD',
      challanDate: receivedDate ? new Date(receivedDate) : new Date(),
      fromType: 'VENDOR',
      fromId: job.processorId,
      fromName: job.processor?.name || 'Mill',
      toType: 'WAREHOUSE',
      toName: 'Main Warehouse',
      purchaseOrderId: job.purchaseOrderId ?? undefined,
      jobWorkOrderId: job.id,
      issuedById: userId,
      unit: Unit.METER,
      remarks: receivedChallan ? `Vendor challan ref: ${receivedChallan}` : undefined,
      items: [
        {
          itemType: 'FABRIC',
          fabricId: job.finishedFabricId || job.fabricId,
          description: `Printed fabric received - ${formatStyleCodeWithRef(job.style?.styleCode || '', job.style?.buyerStyleRef)}`,
          quantity: actualMeters,
          unit: Unit.METER,
          jobWorkOrderId: job.id,
        },
      ],
    });
    inwardChallanId = challan.id;
  } catch (challanError) {
    logger.error('Failed to create inward challan for printed fabric receipt', {
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
      jwoStatus: 'RECEIVED',
    },
  });

  // Phase 6: Apply tolerance/loss split (normal vs abnormal)
  try {
    await jobWorkOrderService.applyLossSplit(job.id, actualMeters);
  } catch (lossSplitError) {
    logger.warn('[receiveProcessPO] Loss split calculation failed:', {
      jobId: job.id,
      error: lossSplitError instanceof Error ? lossSplitError.message : lossSplitError,
    });
  }

  // Re-fetch (envelope shape)
  const fullJwo = await resolveProcessJwo(job.id, 'PRINTING');

  res.json({
    data: fullJwo ? toProcessPOEnvelope(fullJwo) : null,
  });
};

// 7. Quality Check for Process order — Phase 4c-final: JWO-keyed
export const qualityCheckProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { qualityGrade, colorMatchStatus, defectMeters, defectType, actualRate, remarks } = req.body;

  const jwo = await resolveProcessJwo(id, 'PRINTING');
  if (!jwo) {
    throw new NotFoundError('Process PO', id);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = jwo as any;

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
      jwoStatus: 'QUALITY_CHECKED',
    },
  });

  // Re-fetch (envelope shape)
  const qcJwo = await resolveProcessJwo(job.id, 'PRINTING');

  res.json({
    data: qcJwo ? toProcessPOEnvelope(qcJwo) : null,
  });
};

// 8. Update Stock for Process order (create fabric_stock entries) — Phase 4c-final: JWO-keyed
export const updateStockProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  const jwo = await resolveProcessJwo(id, 'PRINTING');
  if (!jwo) {
    throw new NotFoundError('Process PO', id);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = jwo as any;

  if (job.status !== 'QUALITY_CHECKED') {
    throw new ValidationError('Quality check must be completed first');
  }

  if (!job.finishedFabricId) {
    throw new ValidationError('No finished fabric linked. Was sendProcessPO completed properly?');
  }

  const goodQty = Number(job.qtyReceivedMeters) - Number(job.defectMeters || 0);
  const receivedWidth = Number(job.receivedWidthInches || job.sentWidthInches);
  const cutableWidth = receivedWidth > 2 ? receivedWidth - 2 : receivedWidth;

  // BUG-PRT5 fix: Use decimal.js for cost calculations
  const processingRate = toCurrency(job.actualRate || job.agreedRatePerMeter);
  // Use greige stock cost if available, fall back to fabric stock cost
  const sourceCost = job.greigeStockLot?.purchaseCost
    ? toCurrency(job.greigeStockLot.purchaseCost)
    : toCurrency(job.fabricStockLot?.purchaseCost);
  const totalCostPerMeter = toNumber(addCurrency(processingRate, sourceCost));

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
      fabricFinishType: 'PRINTED',
      weightedAvgCost: new Prisma.Decimal(totalCostPerMeter),
      purchaseCost: new Prisma.Decimal(totalCostPerMeter),
      qualityGrade,
      defectMeters: job.defectMeters,
      receivedDate: job.receivedDate || new Date(),
      agingDays: 0,
      createdById: userId,
    },
  });

  // BUG-INV3 fix: Sync stock_levels when receiving processed fabric from mill
  try {
    const materialId = await ensureMaterialRecord(job.finishedFabricId, 'FABRIC');
    await syncStockLevelQuantity(materialId, goodQty, undefined, 'METER');
    logger.info(`[receiveProcessPO] Synced stock_levels for fabric ${job.finishedFabricId}, qty: ${goodQty}`);
  } catch (syncErr) {
    logger.error('[receiveProcessPO] Failed to sync stock_levels:', syncErr);
    // Don't throw - fabric_stock was created successfully, stock_levels sync is secondary
  }

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
        fabricFinishType: 'PRINTED',
        // BUG-PRT5 fix: Use decimal.js for defect cost calculation
        weightedAvgCost: new Prisma.Decimal(toNumber(multiplyCurrency(totalCostPerMeter, 0.5))),
        purchaseCost: new Prisma.Decimal(toNumber(multiplyCurrency(totalCostPerMeter, 0.5))),
        qualityGrade: 'B',
        defectMeters: new Prisma.Decimal(defectMetersNum),
        receivedDate: job.receivedDate || new Date(),
        agingDays: 0,
        createdById: userId,
      },
    });
    defectStockId = defectStock.id;

    // BUG-INV3 fix: Also sync stock_levels for defect stock
    try {
      const materialId = await ensureMaterialRecord(job.finishedFabricId, 'FABRIC');
      await syncStockLevelQuantity(materialId, defectMetersNum, undefined, 'METER');
      logger.info(`[receiveProcessPO] Synced stock_levels for defect fabric, qty: ${defectMetersNum}`);
    } catch (syncErr) {
      logger.error('[receiveProcessPO] Failed to sync defect stock_levels:', syncErr);
    }
  }

  // Update job status to STOCK_UPDATED
  await prisma.job_work_orders.update({
    where: { id: job.id },
    data: {
      jwoStatus: 'STOCK_UPDATED',
    },
  });

  if (job.purchaseOrderId) {
    // Legacy shadow PO: echo receipt onto the PO pair
    const poItems = job.purchaseOrder?.purchase_order_items;
    if (poItems && poItems.length > 0) {
      await prisma.purchase_order_items.update({
        where: { id: poItems[0].id },
        data: {
          receivedQuantity: new Prisma.Decimal(Number(job.qtyReceivedMeters)),
        },
      });
    }
    // Guarded echo (landmine №7): never flips a CANCELLED PO to RECEIVED
    await echoShadowPoStatus(prisma, job.purchaseOrderId, 'RECEIVED');
  } else {
    // JWO-only (D3): advance MRP requirements via the JWO receipt bridge
    try {
      await updateJwoReceivedQuantity(job.id, Number(job.qtyReceivedMeters));
    } catch (bridgeError) {
      logger.error('Failed to advance MRP requirements for JWO receipt', { error: bridgeError, jobId: job.id });
    }
  }

  // Re-fetch (envelope shape)
  const fullJwo = await resolveProcessJwo(job.id, 'PRINTING');

  res.json({
    data: fullJwo ? toProcessPOEnvelope(fullJwo) : null,
    stockCreated: {
      fabricStockId: fabricStock.id,
      defectStockId,
      goodQtyMeters: goodQty,
      defectMeters: defectMetersNum,
      totalCostPerMeter,
      fabricFinishType: 'PRINTED',
    },
  });
};

// 9. Return Unprocessed (greige returned without processing → credit back to greige_stock)
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

  // Phase 4c-final: JWO-keyed (dual-lookup accepts legacy PO ids)
  const jwo = await resolveProcessJwo(id, 'PRINTING');
  if (!jwo) {
    throw new NotFoundError('Process PO', id);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = jwo as any;

  // Landmine No.1 fix: a cancelled/closed job's material was already credited back —
  // receiving (or re-returning) against it would double-count stock
  if (isJwoDead(job.jwoStatus)) {
    throw new BusinessError(
      `${job.jobWorkNumber} is ${job.jwoStatus?.toLowerCase()} — its stock was already credited back. Contact the office to re-open the job if material physically arrived.`
    );
  }
  if (job.status !== 'AT_MILL' && job.status !== 'SENT_TO_MILL') {
    throw new BusinessError(`Cannot return unprocessed. Job status is ${job.status}, expected AT_MILL`);
  }

  // Credit back to greige_stock via the shared return path: guarded against over-crediting,
  // writes the greige_stock_transaction ledger row, and keeps central stock_levels in step
  // (the old bare update here silently drifted the Stock Levels page — landmine №4).
  if (job.greigeStockLotId) {
    await greigeStockService.returnGreigeStock(job.greigeStockLotId, returnedQtyMeters, userId, undefined, {
      referenceType: 'JOB_WORK_ORDER',
      referenceId: job.id,
      notes: `Unprocessed greige returned — ${job.jobWorkNumber}${remarks ? ` (${remarks})` : ''}`,
    });
  }

  // Auto-create INWARD challan for returned greige
  let inwardChallanId: string | null = null;
  try {
    const challan = await createChallan({
      challanType: 'INWARD',
      challanDate: returnDate ? new Date(returnDate) : new Date(),
      fromType: 'VENDOR',
      fromId: job.processorId,
      fromName: job.processor?.name || 'Mill',
      toType: 'WAREHOUSE',
      toName: 'Main Warehouse',
      purchaseOrderId: job.purchaseOrderId ?? undefined,
      jobWorkOrderId: job.id,
      issuedById: userId,
      unit: Unit.METER,
      remarks: `Unprocessed greige returned${remarks ? ': ' + remarks : ''}`,
      items: [
        {
          itemType: 'GREIGE',
          fabricId: job.fabricId,
          greigeStockId: job.greigeStockLotId || undefined,
          description: `Unprocessed greige fabric returned - ${formatStyleCodeWithRef(job.style?.styleCode || '', job.style?.buyerStyleRef)}`,
          quantity: returnedQtyMeters,
          unit: Unit.METER,
          jobWorkOrderId: job.id,
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

  // Update job status — use CANCELLED since RETURNED is not in enum
  await prisma.job_work_orders.update({
    where: { id: job.id },
    data: {
      inwardChallanId,
      jwoStatus: 'CANCELLED',
      remarks:
        `${job.remarks || ''}\n[RETURNED UNPROCESSED] ${returnedQtyMeters} meters returned on ${(returnDate ? new Date(returnDate) : new Date()).toISOString().split('T')[0]}. ${remarks || ''}`.trim(),
      qtyReceivedMeters: 0, // Nothing was processed
      receivedDate: returnDate ? new Date(returnDate) : new Date(),
    },
  });

  // Legacy shadow PO: cancel it too. Guarded echo (landmine №7): leaves a
  // partially-received PO alone.
  await echoShadowPoStatus(prisma, job.purchaseOrderId, 'CANCELLED', {
    appendRemarks: `[RETURNED UNPROCESSED] Greige returned without processing. ${remarks || ''}`.trim(),
    cancelledById: userId,
  });

  // Re-fetch (envelope shape)
  const fullJwo = await resolveProcessJwo(job.id, 'PRINTING');

  res.json({
    data: fullJwo ? { ...toProcessPOEnvelope(fullJwo), processPOStatus: 'RETURNED' } : null,
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

// Get printing summary
export const getSummary = async (req: Request, res: Response, _next: NextFunction) => {
  const processType = 'PRINTING';

  const [totalLabDips, labDipsPending, labDipsApproved, totalJobs, jobsByStatus] = await Promise.all([
    prisma.lab_dips.count({ where: { processType } }),
    prisma.lab_dips.count({ where: { processType, status: 'PENDING' } }),
    prisma.lab_dips.count({ where: { processType, status: 'APPROVED' } }),
    prisma.job_work_orders.count({ where: { processType } }),
    prisma.job_work_orders.groupBy({
      by: ['jwoStatus'],
      where: { processType },
      _count: true,
    }),
  ]);

  const atProcessor = jobsByStatus
    .filter((s) => JWO_AT_PROCESSOR_STATUSES.includes(s.jwoStatus!))
    .reduce((sum, s) => sum + s._count, 0);
  const received = jobsByStatus.find((s) => s.jwoStatus === 'RECEIVED')?._count || 0;
  const qualityChecked = jobsByStatus.find((s) => s.jwoStatus === 'QUALITY_CHECKED')?._count || 0;

  res.json({
    data: {
      total: totalJobs,
      labDipsPending,
      labDipsApproved,
      atMill: atProcessor,
      received,
      qualityChecked,
      byStatus: jobsByStatus.map((s) => ({
        status: s.jwoStatus,
        count: s._count,
      })),
    },
  });
};

// Get summary by style
export const getSummaryByStyle = async (req: Request, res: Response, _next: NextFunction) => {
  const { styleId } = req.params;
  const processType = 'PRINTING';

  const [totalLabDips, labDipsPending, labDipsApproved, totalJobs, jobsByStatus] = await Promise.all([
    prisma.lab_dips.count({ where: { processType, styleId } }),
    prisma.lab_dips.count({ where: { processType, styleId, status: 'PENDING' } }),
    prisma.lab_dips.count({ where: { processType, styleId, status: 'APPROVED' } }),
    prisma.job_work_orders.count({ where: { processType, styleId } }),
    prisma.job_work_orders.groupBy({
      by: ['jwoStatus'],
      where: { processType, styleId },
      _count: true,
    }),
  ]);

  const atProcessor = jobsByStatus
    .filter((s) => JWO_AT_PROCESSOR_STATUSES.includes(s.jwoStatus!))
    .reduce((sum, s) => sum + s._count, 0);
  const received = jobsByStatus.find((s) => s.jwoStatus === 'RECEIVED')?._count || 0;
  const qualityChecked = jobsByStatus.find((s) => s.jwoStatus === 'QUALITY_CHECKED')?._count || 0;

  res.json({
    data: {
      total: totalJobs,
      labDipsPending,
      labDipsApproved,
      atMill: atProcessor,
      received,
      qualityChecked,
      byStatus: jobsByStatus.map((s) => ({
        status: s.jwoStatus,
        count: s._count,
      })),
    },
  });
};

// Get summary by mill
export const getSummaryByMill = async (req: Request, res: Response, _next: NextFunction) => {
  const { processorId } = req.params;
  const processType = 'PRINTING';

  const [totalLabDips, labDipsPending, labDipsApproved, totalJobs, jobsByStatus] = await Promise.all([
    prisma.lab_dips.count({ where: { processType, processorId } }),
    prisma.lab_dips.count({ where: { processType, processorId, status: 'PENDING' } }),
    prisma.lab_dips.count({ where: { processType, processorId, status: 'APPROVED' } }),
    prisma.job_work_orders.count({ where: { processType, processorId } }),
    prisma.job_work_orders.groupBy({
      by: ['jwoStatus'],
      where: { processType, processorId },
      _count: true,
    }),
  ]);

  const atProcessor = jobsByStatus
    .filter((s) => JWO_AT_PROCESSOR_STATUSES.includes(s.jwoStatus!))
    .reduce((sum, s) => sum + s._count, 0);
  const received = jobsByStatus.find((s) => s.jwoStatus === 'RECEIVED')?._count || 0;
  const qualityChecked = jobsByStatus.find((s) => s.jwoStatus === 'QUALITY_CHECKED')?._count || 0;

  res.json({
    data: {
      total: totalJobs,
      labDipsPending,
      labDipsApproved,
      atMill: atProcessor,
      received,
      qualityChecked,
      byStatus: jobsByStatus.map((s) => ({
        status: s.jwoStatus,
        count: s._count,
      })),
    },
  });
};
