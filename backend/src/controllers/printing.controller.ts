import { Request, Response, NextFunction } from 'express';
import { BusinessError, NotFoundError, ValidationError, UnauthorizedError } from '../errors';
import prisma from '../config/database';
import { Prisma, Unit } from '@prisma/client';
import { createChallan } from '../services/challan.service';
import greigeStockService from '../services/greige-stock.service';
import { generateUnifiedPONumber } from '../utils/po-number-generator';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';

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

// ============================================
// LAB DIP ENDPOINTS
// ============================================

// Generate lab dip number
const generateLabDipNumber = async (processType: string, styleCode: string): Promise<string> => {
  const prefix = processType === 'PRINTING' ? 'LDP' : 'LDD';

  // Count existing lab dips for this style
  const count = await prisma.lab_dips.count({
    where: {
      processType,
      labDipNumber: {
        startsWith: `${prefix}-${styleCode}-`,
      },
    },
  });

  return `${prefix}-${styleCode}-${(count + 1).toString().padStart(3, '0')}`;
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
      ],
    },
    include: labDipInclude,
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  res.json({ data: labDips.map(transformLabDip) });
};

// ============================================
// JOB WORK ORDER (PRINT JOB) ENDPOINTS
// ============================================

// Generate job work number
const generateJobWorkNumber = async (processType: string, styleCode: string): Promise<string> => {
  const prefix = processType === 'PRINTING' ? 'PJ' : 'DJ';

  // Count existing job work orders for this style
  const count = await prisma.job_work_orders.count({
    where: {
      processType,
      jobWorkNumber: {
        startsWith: `${prefix}-${styleCode}-`,
      },
    },
  });

  return `${prefix}-${styleCode}-${(count + 1).toString().padStart(3, '0')}`;
};

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
      status: 'READY_TO_SEND',
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

// Send fabric to mill
export const sendToMill = async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { sentDate, challanNumber, vehicleNumber } = req.body;
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

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
    throw new NotFoundError('Print job', id);
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

  // Auto-create fabric_master for the finished (printed) fabric
  let finishedFabricId: string | null = null;
  const colorName = existing.labDip?.targetColor?.colorName || existing.labDip?.colorReference || 'Unknown';
  const colorCode = existing.labDip?.targetColor?.colorCode || null;
  const greigeId = existing.labDip?.fabric?.greigeId || null;
  const finishType = 'PRINTED';

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

    // Build fabric name
    const greige = existing.labDip?.fabric?.greige;
    const greigeGeneric = greige?.genericGreigeName || greige?.greigeName?.split('/')[0]?.trim() || 'Fabric';
    const designLabel = existing.labDip?.designArtwork ? ` ${existing.labDip.designArtwork}` : '';
    const widthStr = `${Number(existing.sentWidthInches)}"`;
    const fabricName = [styleCode, greigeGeneric, 'Printed', `${colorName}${designLabel}`, widthStr]
      .filter(Boolean)
      .join(' - ');

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
        printDesign: existing.labDip?.designArtwork || null,
        actualWidth: existing.sentWidthInches,
        cutableWidth: new Prisma.Decimal(Number(existing.sentWidthInches) - 2),
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
        cutableWidth: new Prisma.Decimal(receivedWidthInches - 2),
      },
    });
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
      status: 'RECEIVED',
    },
  });
  if (guarded.count === 0) {
    throw new ValidationError('Fabric has already been received (possibly via the GRN module)');
  }
  const job = await prisma.job_work_orders.findUniqueOrThrow({
    where: { id },
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

  if (existing.status !== 'QUALITY_CHECKED') {
    throw new ValidationError('Quality check must be completed first');
  }

  if (!existing.finishedFabricId) {
    throw new ValidationError('No finished fabric linked. Was sendToMill completed properly?');
  }

  const goodQty = Number(existing.qtyReceivedMeters) - Number(existing.defectMeters || 0);
  const receivedWidth = Number(existing.receivedWidthInches || existing.sentWidthInches);
  const cutableWidth = receivedWidth > 2 ? receivedWidth - 2 : receivedWidth;

  const processingRate = Number(existing.actualRate || existing.agreedRatePerMeter);
  const sourceCost = existing.fabricStockLot?.purchaseCost ? Number(existing.fabricStockLot.purchaseCost) : 0;
  const totalCostPerMeter = processingRate + sourceCost;

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
      fabricFinishType: 'PRINTED',
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

// 1. Get all Process POs for Printing
export const getProcessPOs = async (req: Request, res: Response, _next: NextFunction) => {
  const { page = '1', limit = '10', search, status } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.purchase_ordersWhereInput = {
    poCategory: 'PROCESSING',
    isActive: true,
    OR: [
      { jobWorkOrder: { processType: 'PRINTING' } },
      {
        purchase_order_items: {
          some: {
            OR: [{ serviceType: 'PRINTING' }, { printingType: { not: null } }],
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
export const createProcessPO = async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    labDipId,
    greigeStockLotId,
    fabricStockLotId,
    qtySentMeters,
    sentWidthInches,
    agreedRatePerMeter,
    expectedReturnDate,
    expectedShrinkage,
    fabricType = 'GREIGE',
    remarks,
  } = req.body;

  if (!labDipId || !qtySentMeters || !sentWidthInches || !agreedRatePerMeter) {
    throw new ValidationError('Missing required fields: labDipId, qtySentMeters, sentWidthInches, agreedRatePerMeter');
  }

  if (!greigeStockLotId && !fabricStockLotId) {
    throw new ValidationError('Either greigeStockLotId or fabricStockLotId is required');
  }

  // Validate lab dip exists and is APPROVED
  const labDip = await prisma.lab_dips.findUnique({
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
      where: { fabricId: labDip.fabricId },
      select: { id: true },
    });
    if (!fallbackStock) {
      // Create a minimal placeholder stock entry for schema compatibility
      // Using RESERVED status to indicate this is not yet available for use
      const placeholderStock = await prisma.fabric_stock.create({
        data: {
          fabricId: labDip.fabricId,
          finishedWidth: new Prisma.Decimal(sentWidthInches),
          cutableWidth: new Prisma.Decimal(Math.max(sentWidthInches - 2, 0)),
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
        supplierId: labDip.processorId,
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
        serviceType: 'PRINTING',
        serviceDescription: `Printing processing - ${(labDip as any).style?.styleCode || ''}`,
        orderedQuantity: new Prisma.Decimal(qtySentMeters),
        receivedQuantity: new Prisma.Decimal(0),
        unit: 'METER',
        unitPrice: new Prisma.Decimal(agreedRatePerMeter),
        totalPrice: new Prisma.Decimal(totalAmount),
      },
    });

    // Generate job work number
    const styleCode = (labDip as any).style?.styleCode || 'STK';
    const jobWorkNumber = await generateJobWorkNumber('PRINTING', styleCode);

    // Create job work order linked to PO and greige stock
    const job = await tx.job_work_orders.create({
      data: {
        jobWorkNumber,
        processType: 'PRINTING',
        labDipId,
        styleId: labDip.styleId,
        fabricId: labDip.fabricId,
        processorId: labDip.processorId,
        fabricStockLotId: validatedFabricStockLotId,
        greigeStockLotId: greigeStockLotId || null,
        purchaseOrderId: po.id,
        fabricType,
        qtySentMeters,
        sentWidthInches,
        expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
        expectedShrinkage,
        agreedRatePerMeter,
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

    return fullPO;
  });

  res.status(201).json({
    data: {
      ...result,
      processPOStatus: computeProcessPOStatus(result),
    },
    message: 'Printing process PO created successfully',
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
  const finishType = 'PRINTED';

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
    const designLabel = job.labDip?.designArtwork ? ` ${job.labDip.designArtwork}` : '';
    const widthStr = `${Number(job.sentWidthInches)}"`;
    const fabricName = [styleCode, greigeGeneric, 'Printed', `${colorName}${designLabel}`, widthStr]
      .filter(Boolean)
      .join(' - ');

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
        printDesign: job.labDip?.designArtwork || null,
        actualWidth: job.sentWidthInches,
        cutableWidth: new Prisma.Decimal(Number(job.sentWidthInches) - 2),
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
          description: `Greige fabric for Printing - ${job.style?.styleCode || ''}`,
          quantity: Number(job.qtySentMeters),
          unit: Unit.METER,
          rate: Number(job.agreedRatePerMeter),
        },
      ],
    });
    outwardChallanId = challan.id;
  } catch (challanError) {
    logger.error('Failed to create outward challan for printing send-out', {
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
        cutableWidth: new Prisma.Decimal(receivedWidthInches - 2),
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
          description: `Printed fabric received - ${job.style?.styleCode || ''}`,
          quantity: actualMeters,
          unit: Unit.METER,
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
  const cutableWidth = receivedWidth > 2 ? receivedWidth - 2 : receivedWidth;

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

  // Update job status — use CANCELLED since RETURNED is not in enum
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

// Get printing summary
export const getSummary = async (req: Request, res: Response, _next: NextFunction) => {
  const processType = 'PRINTING';

  const [totalLabDips, labDipsPending, labDipsApproved, totalJobs, jobsByStatus] = await Promise.all([
    prisma.lab_dips.count({ where: { processType } }),
    prisma.lab_dips.count({ where: { processType, status: 'PENDING' } }),
    prisma.lab_dips.count({ where: { processType, status: 'APPROVED' } }),
    prisma.job_work_orders.count({ where: { processType } }),
    prisma.job_work_orders.groupBy({
      by: ['status'],
      where: { processType },
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
  const processType = 'PRINTING';

  const [totalLabDips, labDipsPending, labDipsApproved, totalJobs, jobsByStatus] = await Promise.all([
    prisma.lab_dips.count({ where: { processType, styleId } }),
    prisma.lab_dips.count({ where: { processType, styleId, status: 'PENDING' } }),
    prisma.lab_dips.count({ where: { processType, styleId, status: 'APPROVED' } }),
    prisma.job_work_orders.count({ where: { processType, styleId } }),
    prisma.job_work_orders.groupBy({
      by: ['status'],
      where: { processType, styleId },
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
  const processType = 'PRINTING';

  const [totalLabDips, labDipsPending, labDipsApproved, totalJobs, jobsByStatus] = await Promise.all([
    prisma.lab_dips.count({ where: { processType, processorId } }),
    prisma.lab_dips.count({ where: { processType, processorId, status: 'PENDING' } }),
    prisma.lab_dips.count({ where: { processType, processorId, status: 'APPROVED' } }),
    prisma.job_work_orders.count({ where: { processType, processorId } }),
    prisma.job_work_orders.groupBy({
      by: ['status'],
      where: { processType, processorId },
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
