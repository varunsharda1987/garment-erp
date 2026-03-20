import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';

// Helper to transform relations for response
const transformLabDip = (item: any) => ({
  ...item,
  style: item.style,
  fabric: item.fabric,
  targetColor: item.targetColor,
  mill: item.mill,
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
  mill: item.mill,
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
    },
  },
  targetColor: {
    select: {
      id: true,
      colorName: true,
      colorCode: true,
    },
  },
  mill: {
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
  mill: {
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

// Generate lab dip number
const generateLabDipNumber = async (styleCode: string): Promise<string> => {
  const prefix = 'LDD'; // Lab Dip Dyeing

  const count = await prisma.lab_dips.count({
    where: {
      processType: PROCESS_TYPE,
      labDipNumber: {
        startsWith: `${prefix}-${styleCode}-`,
      },
    },
  });

  return `${prefix}-${styleCode}-${(count + 1).toString().padStart(3, '0')}`;
};

// Get all lab dips
export const getAllLabDips = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '10',
      search,
      status,
      styleId,
      millId,
      fromDate,
      toDate,
    } = req.query;

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

    if (millId) {
      where.millId = millId as string;
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
  } catch (error) {
    next(error);
  }
};

// Get lab dip by ID
export const getLabDipById = async (req: Request, res: Response, next: NextFunction) => {
  try {
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
      return res.status(404).json({ error: 'Lab dip not found' });
    }

    const transformed = transformLabDip(labDip as any);
    transformed.jobWorkOrders = (labDip as any).jobWorkOrders?.map(transformJobWorkOrder) || [];

    res.json({ data: transformed });
  } catch (error) {
    next(error);
  }
};

// Create lab dip
export const createLabDip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const {
      styleId,
      fabricId,
      targetColorId,
      colorReference,
      millId,
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
      return res.status(404).json({ error: 'Style not found' });
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
        millId,
        submissionDate: new Date(submissionDate),
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        remarks,
        status: 'PENDING',
        createdById: userId,
      },
      include: labDipInclude,
    });

    res.status(201).json({ data: transformLabDip(labDip as any) });
  } catch (error) {
    next(error);
  }
};

// Update lab dip
export const updateLabDip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      targetColorId,
      colorReference,
      millId,
      submissionDate,
      expectedDate,
      receivedDate,
      remarks,
    } = req.body;

    const existing = await prisma.lab_dips.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lab dip not found' });
    }

    if (existing.status === 'APPROVED') {
      return res.status(400).json({ error: 'Cannot update an approved lab dip' });
    }

    const updateData: any = {};

    if (targetColorId !== undefined) updateData.targetColorId = targetColorId;
    if (colorReference !== undefined) updateData.colorReference = colorReference;
    if (millId !== undefined) updateData.millId = millId;
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
  } catch (error) {
    next(error);
  }
};

// Delete lab dip
export const deleteLabDip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.lab_dips.findUnique({
      where: { id },
      include: { jobWorkOrders: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lab dip not found' });
    }

    if ((existing as any).jobWorkOrders?.length > 0) {
      return res.status(400).json({ error: 'Cannot delete lab dip with existing dye jobs' });
    }

    await prisma.lab_dips.delete({ where: { id } });

    res.json({ message: 'Lab dip deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Approve lab dip
export const approveLabDip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const { approvedSampleNo, colorMatchRating, remarks } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const existing = await prisma.lab_dips.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lab dip not found' });
    }

    if (existing.status === 'APPROVED') {
      return res.status(400).json({ error: 'Lab dip is already approved' });
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
  } catch (error) {
    next(error);
  }
};

// Reject lab dip
export const rejectLabDip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const { rejectionReason, remarks } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const existing = await prisma.lab_dips.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lab dip not found' });
    }

    if (existing.status === 'APPROVED') {
      return res.status(400).json({ error: 'Cannot reject an approved lab dip' });
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
  } catch (error) {
    next(error);
  }
};

// Request resubmission
export const requestResubmit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const existing = await prisma.lab_dips.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lab dip not found' });
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
  } catch (error) {
    next(error);
  }
};

// Get approved lab dips
export const getApprovedLabDips = async (req: Request, res: Response, next: NextFunction) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

// Search lab dips
export const searchLabDips = async (req: Request, res: Response, next: NextFunction) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

// ============================================
// DYE JOB ENDPOINTS
// ============================================

// Generate job work number
const generateJobWorkNumber = async (styleCode: string): Promise<string> => {
  const prefix = 'DJ'; // Dye Job

  const count = await prisma.job_work_orders.count({
    where: {
      processType: PROCESS_TYPE,
      jobWorkNumber: {
        startsWith: `${prefix}-${styleCode}-`,
      },
    },
  });

  return `${prefix}-${styleCode}-${(count + 1).toString().padStart(3, '0')}`;
};

// Get all dye jobs
export const getAllDyeJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '10',
      search,
      status,
      labDipId,
      styleId,
      millId,
      fromDate,
      toDate,
    } = req.query;

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

    if (millId) {
      where.millId = millId as string;
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
  } catch (error) {
    next(error);
  }
};

// Get dye job by ID
export const getDyeJobById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const job = await prisma.job_work_orders.findUnique({
      where: { id },
      include: jobWorkOrderInclude,
    });

    if (!job) {
      return res.status(404).json({ error: 'Dye job not found' });
    }

    res.json({ data: transformJobWorkOrder(job as any) });
  } catch (error) {
    next(error);
  }
};

// Create dye job
export const createDyeJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
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
      return res.status(404).json({ error: 'Lab dip not found' });
    }

    if (labDip.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Lab dip must be approved before creating a dye job' });
    }

    // Get fabric stock to validate
    const fabricStock = await prisma.fabric_stock.findUnique({
      where: { id: fabricStockLotId },
    });

    if (!fabricStock) {
      return res.status(404).json({ error: 'Fabric stock lot not found' });
    }

    if (Number(fabricStock.quantityAvailable) < qtySentMeters) {
      return res.status(400).json({ error: 'Insufficient fabric stock' });
    }

    const jobWorkNumber = await generateJobWorkNumber((labDip as any).style.styleCode);

    const job = await prisma.job_work_orders.create({
      data: {
        jobWorkNumber,
        processType: PROCESS_TYPE,
        labDipId,
        styleId: labDip.styleId,
        fabricId: labDip.fabricId,
        millId: labDip.millId,
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

    res.status(201).json({ data: transformJobWorkOrder(job as any) });
  } catch (error) {
    next(error);
  }
};

// Update dye job
export const updateDyeJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
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
      return res.status(404).json({ error: 'Dye job not found' });
    }

    if (existing.sentDate) {
      return res.status(400).json({ error: 'Cannot update a job that has already been sent to mill' });
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
  } catch (error) {
    next(error);
  }
};

// Delete dye job
export const deleteDyeJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.job_work_orders.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Dye job not found' });
    }

    if (existing.sentDate) {
      return res.status(400).json({ error: 'Cannot delete a job that has already been sent to mill' });
    }

    await prisma.job_work_orders.delete({ where: { id } });

    res.json({ message: 'Dye job deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Send fabric to mill
export const sendToMill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { sentDate, challanNumber, vehicleNumber } = req.body;

    const existing = await prisma.job_work_orders.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Dye job not found' });
    }

    if (existing.sentDate) {
      return res.status(400).json({ error: 'Fabric has already been sent to mill' });
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

    const job = await prisma.job_work_orders.update({
      where: { id },
      data: {
        sentDate: new Date(sentDate),
        challanNumber,
        vehicleNumber,
        status: 'AT_MILL',
      },
      include: jobWorkOrderInclude,
    });

    res.json({ data: transformJobWorkOrder(job as any) });
  } catch (error) {
    next(error);
  }
};

// Receive fabric from mill
export const receiveFromMill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      qtyReceivedMeters,
      receivedWidthInches,
      receivedDate,
      receivedChallan,
      invoiceNumber,
    } = req.body;

    const existing = await prisma.job_work_orders.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Dye job not found' });
    }

    if (!existing.sentDate) {
      return res.status(400).json({ error: 'Fabric has not been sent to mill yet' });
    }

    if (existing.receivedDate) {
      return res.status(400).json({ error: 'Fabric has already been received' });
    }

    // Calculate shrinkage
    const sentMeters = Number(existing.qtySentMeters);
    const actualShrinkage = sentMeters > 0
      ? ((sentMeters - qtyReceivedMeters) / sentMeters) * 100
      : 0;

    // Calculate width variance
    const widthVariance = receivedWidthInches - Number(existing.sentWidthInches);

    const job = await prisma.job_work_orders.update({
      where: { id },
      data: {
        qtyReceivedMeters,
        receivedWidthInches,
        receivedDate: new Date(receivedDate),
        receivedChallan,
        invoiceNumber,
        actualShrinkage,
        widthVariance,
        status: 'RECEIVED',
      },
      include: jobWorkOrderInclude,
    });

    res.json({ data: transformJobWorkOrder(job as any) });
  } catch (error) {
    next(error);
  }
};

// Quality check
export const qualityCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      qualityGrade,
      colorMatchStatus,
      defectMeters,
      defectType,
      actualRate,
      remarks,
    } = req.body;

    const existing = await prisma.job_work_orders.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Dye job not found' });
    }

    if (!existing.receivedDate) {
      return res.status(400).json({ error: 'Fabric has not been received yet' });
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
  } catch (error) {
    next(error);
  }
};

// Update stock after quality check
export const updateStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.job_work_orders.findUnique({
      where: { id },
      include: {
        fabricStockLot: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Dye job not found' });
    }

    if (existing.status !== 'QUALITY_CHECKED') {
      return res.status(400).json({ error: 'Quality check must be completed first' });
    }

    // Calculate good qty
    const goodQty = Number(existing.qtyReceivedMeters) - Number(existing.defectMeters || 0);

    // Here you would typically create a new fabric_stock entry for the dyed fabric
    // For now, we just update the status

    const job = await prisma.job_work_orders.update({
      where: { id },
      data: {
        status: 'STOCK_UPDATED',
      },
      include: jobWorkOrderInclude,
    });

    res.json({ data: transformJobWorkOrder(job as any) });
  } catch (error) {
    next(error);
  }
};

// ============================================
// SUMMARY ENDPOINTS
// ============================================

// Get dyeing summary
export const getSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalLabDips,
      labDipsPending,
      labDipsApproved,
      totalJobs,
      jobsByStatus,
    ] = await Promise.all([
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
  } catch (error) {
    next(error);
  }
};

// Get summary by style
export const getSummaryByStyle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { styleId } = req.params;

    const [
      totalLabDips,
      labDipsPending,
      labDipsApproved,
      totalJobs,
      jobsByStatus,
    ] = await Promise.all([
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
  } catch (error) {
    next(error);
  }
};

// Get summary by mill
export const getSummaryByMill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { millId } = req.params;

    const [
      totalLabDips,
      labDipsPending,
      labDipsApproved,
      totalJobs,
      jobsByStatus,
    ] = await Promise.all([
      prisma.lab_dips.count({ where: { processType: PROCESS_TYPE, millId } }),
      prisma.lab_dips.count({ where: { processType: PROCESS_TYPE, millId, status: 'PENDING' } }),
      prisma.lab_dips.count({ where: { processType: PROCESS_TYPE, millId, status: 'APPROVED' } }),
      prisma.job_work_orders.count({ where: { processType: PROCESS_TYPE, millId } }),
      prisma.job_work_orders.groupBy({
        by: ['status'],
        where: { processType: PROCESS_TYPE, millId },
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
  } catch (error) {
    next(error);
  }
};
