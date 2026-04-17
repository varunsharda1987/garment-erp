import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NotFoundError, ValidationError } from '../errors';

// ============================================
// Helper Functions
// ============================================

const transformFinishingIssue = (issue: any) => ({
  ...issue,
  workOrder: issue.workOrder
    ? {
        id: issue.workOrder.id,
        workOrderNumber: issue.workOrder.workOrderNumber,
        styleId: issue.workOrder.styleId,
        style: issue.workOrder.styles
          ? {
              id: issue.workOrder.styles.id,
              styleCode: issue.workOrder.styles.styleCode,
              styleName: issue.workOrder.styles.styleName,
            }
          : null,
        order: issue.workOrder.orders
          ? {
              id: issue.workOrder.orders.id,
              orderNumber: issue.workOrder.orders.orderNumber,
              customer: issue.workOrder.orders.customers
                ? {
                    id: issue.workOrder.orders.customers.id,
                    name: issue.workOrder.orders.customers.name,
                  }
                : null,
            }
          : null,
      }
    : null,
  manager: issue.manager
    ? {
        id: issue.manager.id,
        name: `${issue.manager.firstName} ${issue.manager.lastName}`,
      }
    : null,
  createdBy: issue.createdBy
    ? {
        id: issue.createdBy.id,
        name: `${issue.createdBy.firstName} ${issue.createdBy.lastName}`,
      }
    : null,
  skuBreakdown: issue.skuBreakdown?.map((sku: any) => ({
    ...sku,
    color: sku.color
      ? {
          id: sku.color.id,
          colorName: sku.color.colorName,
          colorCode: sku.color.colorCode,
        }
      : null,
    size: sku.size
      ? {
          id: sku.size.id,
          sizeName: sku.size.sizeName,
          sortOrder: sku.size.sortOrder,
        }
      : null,
  })),
  components: issue.components?.map((comp: any) => ({
    ...comp,
    component: comp.component
      ? {
          id: comp.component.id,
          componentName: comp.component.componentName,
          componentType: comp.component.componentType,
        }
      : null,
  })),
  dailyOutputs: issue.dailyOutputs || [],
});

const generateIssueNumber = async (workOrderNumber: string): Promise<string> => {
  const prefix = `FI-${workOrderNumber}`;

  const existingCount = await prisma.finishing_issues.count({
    where: {
      issueNumber: {
        startsWith: prefix,
      },
    },
  });

  const seq = (existingCount + 1).toString().padStart(3, '0');
  return `${prefix}-${seq}`;
};

// Include options for finishing issue queries
const issueIncludeOptions = {
  workOrder: {
    include: {
      styles: true,
      orders: {
        include: {
          customers: true,
        },
      },
    },
  },
  manager: true,
  contractor: {
    select: { id: true, code: true, name: true, contactPerson: true, phone: true },
  },
  createdBy: true,
  skuBreakdown: {
    include: {
      color: true,
      size: true,
    },
  },
  components: {
    include: {
      component: true,
    },
  },
  dailyOutputs: {
    include: {
      createdBy: true,
      skuOutputs: {
        include: {
          color: true,
          size: true,
        },
      },
    },
  },
};

// ============================================
// List Finishing Issues
// ============================================

export const getAllFinishingIssues = async (req: Request, res: Response) => {
  const { page = 1, limit = 20, search, status, workOrderId, managerId, fromDate, toDate } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Prisma.finishing_issuesWhereInput = {};

  if (search) {
    where.OR = [
      { issueNumber: { contains: String(search), mode: 'insensitive' } },
      { workOrder: { workOrderNumber: { contains: String(search), mode: 'insensitive' } } },
      { workOrder: { styles: { styleCode: { contains: String(search), mode: 'insensitive' } } } },
      { workOrder: { styles: { styleName: { contains: String(search), mode: 'insensitive' } } } },
    ];
  }

  if (status) {
    where.status = status as any;
  }

  if (workOrderId) {
    where.workOrderId = String(workOrderId);
  }

  if (managerId) {
    where.managerId = String(managerId);
  }

  if (fromDate || toDate) {
    where.issueDate = {};
    if (fromDate) {
      where.issueDate.gte = new Date(String(fromDate));
    }
    if (toDate) {
      where.issueDate.lte = new Date(String(toDate));
    }
  }

  const [issues, total] = await Promise.all([
    prisma.finishing_issues.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: issueIncludeOptions,
    }),
    prisma.finishing_issues.count({ where }),
  ]);

  res.json({
    data: issues.map(transformFinishingIssue),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
  // end getAllFinishingIssues
};

// ============================================
// Get Single Finishing Issue
// ============================================

export const getFinishingIssueById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const issue = await prisma.finishing_issues.findUnique({
    where: { id },
    include: issueIncludeOptions,
  });

  if (!issue) {
    throw new NotFoundError('Finishing issue', id);
  }

  res.json({ data: transformFinishingIssue(issue) });
  // end getFinishingIssueById
};

// ============================================
// Create Finishing Issue
// ============================================

export const createFinishingIssue = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  const { workOrderId, issueDate, managerId, contractorId, expectedCompletionDate, remarks, components, skuBreakdown } =
    req.body;

  // Get work order to generate issue number
  const workOrder = await prisma.work_orders.findUnique({
    where: { id: workOrderId },
    select: { workOrderNumber: true },
  });

  if (!workOrder) {
    throw new NotFoundError('Work order', workOrderId);
  }

  const issueNumber = await generateIssueNumber(workOrder.workOrderNumber);

  const issue = await prisma.finishing_issues.create({
    data: {
      issueNumber,
      workOrderId,
      issueDate: new Date(issueDate),
      managerId: managerId || null,
      contractorId: contractorId || null,
      expectedCompletionDate: expectedCompletionDate ? new Date(expectedCompletionDate) : null,
      status: 'PENDING_RECEIPT',
      remarks,
      createdById: userId,
      components:
        components?.length > 0
          ? {
              create: components.map((componentId: string) => ({
                componentId,
              })),
            }
          : undefined,
      skuBreakdown: {
        create: skuBreakdown.map((sku: any) => {
          const availableQty = sku.availableQty ?? sku.issuedQty;
          if (availableQty === undefined || availableQty === null) {
            throw new Error(
              `Available quantity is required for SKU (color: ${sku.colorId}, size: ${sku.sizeId}). Must come from stitching output.`
            );
          }
          return {
            colorId: sku.colorId,
            sizeId: sku.sizeId,
            availableQty: Number(availableQty),
            issuedQty: Number(sku.issuedQty ?? availableQty),
          };
        }),
      },
    },
    include: issueIncludeOptions,
  });

  // Auto-create production_tracking: IN_FINISHING
  try {
    const totalIssuedQty = skuBreakdown.reduce(
      (sum: number, sku: any) => sum + (Number(sku.issuedQty) || Number(sku.availableQty) || 0),
      0
    );
    await prisma.production_tracking.create({
      data: {
        id: randomUUID(),
        workOrderId,
        productionStage: 'IN_FINISHING',
        quantityCompleted: totalIssuedQty,
        updatedById: userId,
        updateDate: new Date(),
      },
    });
  } catch (err) {
    logger.error('Failed to create production_tracking for finishing:', err);
  }

  res.status(201).json({ data: transformFinishingIssue(issue) });
  // end createFinishingIssue
};

// ============================================
// Update Finishing Issue
// ============================================

export const updateFinishingIssue = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const existing = await prisma.finishing_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Finishing issue', id);
  }

  if (existing.status === 'COMPLETED') {
    throw new ValidationError('Cannot update completed issue');
  }

  const issue = await prisma.finishing_issues.update({
    where: { id },
    data: {
      ...updateData,
      issueDate: updateData.issueDate ? new Date(updateData.issueDate) : undefined,
      expectedCompletionDate: updateData.expectedCompletionDate
        ? new Date(updateData.expectedCompletionDate)
        : undefined,
    },
    include: issueIncludeOptions,
  });

  res.json({ data: transformFinishingIssue(issue) });
  // end updateFinishingIssue
};

// ============================================
// Delete Finishing Issue
// ============================================

export const deleteFinishingIssue = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.finishing_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Finishing issue', id);
  }

  if (existing.status !== 'PENDING_RECEIPT') {
    throw new ValidationError('Can only delete pending issues');
  }

  await prisma.finishing_issues.delete({
    where: { id },
  });

  res.json({ message: 'Finishing issue deleted successfully' });
  // end deleteFinishingIssue
};

// ============================================
// Workflow Actions
// ============================================

// Receive from stitching
export const receiveFromStitching = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { transferSlipId } = req.body;

  const existing = await prisma.finishing_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Finishing issue', id);
  }

  if (existing.status !== 'PENDING_RECEIPT') {
    throw new ValidationError('Can only receive for pending issues');
  }

  const issue = await prisma.finishing_issues.update({
    where: { id },
    data: { status: 'RECEIVED' },
    include: issueIncludeOptions,
  });

  // Update transfer slip status
  if (transferSlipId) {
    await prisma.transfer_slips.update({
      where: { id: transferSlipId },
      data: { status: 'RECEIVED', receivedDate: new Date() },
    });
  }

  res.json({ data: transformFinishingIssue(issue) });
  // end receiveFromStitching
};

// Start finishing
export const startFinishingIssue = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.finishing_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Finishing issue', id);
  }

  if (existing.status !== 'RECEIVED') {
    throw new ValidationError('Can only start received issues');
  }

  const issue = await prisma.finishing_issues.update({
    where: { id },
    data: {
      status: 'IN_PROGRESS',
      startDate: new Date(),
    },
    include: issueIncludeOptions,
  });

  res.json({ data: transformFinishingIssue(issue) });
  // end startFinishingIssue
};

// Record daily output
export const recordDailyOutput = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  const { outputDate, componentId, skuOutputs, remarks } = req.body;

  const existing = await prisma.finishing_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Finishing issue', id);
  }

  if (existing.status !== 'IN_PROGRESS' && existing.status !== 'PACKING') {
    throw new ValidationError('Can only record output for in-progress or packing issues');
  }

  // Create daily output record
  const dailyOutput = await prisma.finishing_daily_outputs.create({
    data: {
      finishingIssueId: id,
      componentId,
      outputDate: new Date(outputDate),
      remarks,
      createdById: userId,
      skuOutputs: {
        create: skuOutputs.map((sku: any) => {
          if (sku.finishedQty === undefined || sku.finishedQty === null) {
            throw new Error(
              `Finished quantity is required for each SKU output (color: ${sku.colorId}, size: ${sku.sizeId})`
            );
          }
          if (sku.defectQty === undefined || sku.defectQty === null) {
            throw new Error(
              `Defect quantity is required for each SKU output (color: ${sku.colorId}, size: ${sku.sizeId}). Enter 0 if no defects.`
            );
          }
          return {
            colorId: sku.colorId,
            sizeId: sku.sizeId,
            finishedQty: Number(sku.finishedQty),
            defectQty: Number(sku.defectQty),
          };
        }),
      },
    },
    include: {
      createdBy: true,
      skuOutputs: {
        include: {
          color: true,
          size: true,
        },
      },
    },
  });

  res.json({ data: dailyOutput });
  // end recordDailyOutput
};

// Move to packing
export const moveToPackingFinishingIssue = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.finishing_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Finishing issue', id);
  }

  if (existing.status !== 'IN_PROGRESS') {
    throw new ValidationError('Can only move to packing from in-progress');
  }

  const issue = await prisma.finishing_issues.update({
    where: { id },
    data: { status: 'PACKING' },
    include: issueIncludeOptions,
  });

  res.json({ data: transformFinishingIssue(issue) });
  // end moveToPackingFinishingIssue
};

// Complete finishing issue
export const completeFinishingIssue = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.finishing_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Finishing issue', id);
  }

  if (existing.status !== 'PACKING' && existing.status !== 'IN_PROGRESS') {
    throw new ValidationError('Can only complete packing or in-progress issues');
  }

  const issue = await prisma.finishing_issues.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      endDate: new Date(),
    },
    include: issueIncludeOptions,
  });

  // Auto-create production_tracking: READY_TO_SHIP
  try {
    const userId = req.user?.userId;
    if (issue.workOrderId && userId) {
      await prisma.production_tracking.create({
        data: {
          id: randomUUID(),
          workOrderId: issue.workOrderId,
          productionStage: 'READY_TO_SHIP',
          quantityCompleted:
            issue.skuBreakdown?.reduce((sum: number, sku: any) => sum + (Number(sku.issuedQty) || 0), 0) || 0,
          updatedById: userId,
          updateDate: new Date(),
        },
      });
    }
  } catch (err) {
    logger.error('Failed to create production_tracking for finishing completion:', err);
  }

  res.json({ data: transformFinishingIssue(issue) });
  // end completeFinishingIssue
};

// Generate transfer slip to dispatch
export const generateTransferSlip = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const issue = await prisma.finishing_issues.findUnique({
    where: { id },
    include: {
      workOrder: true,
      skuBreakdown: true,
      dailyOutputs: {
        include: {
          skuOutputs: true,
        },
      },
    },
  });

  if (!issue) {
    throw new NotFoundError('Finishing issue', id);
  }

  if (issue.status !== 'COMPLETED') {
    throw new ValidationError('Can only generate transfer slip for completed issues');
  }

  // Generate slip number
  const today = new Date();
  const datePrefix = `TS-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
  const existingSlips = await prisma.transfer_slips.count({
    where: {
      slipNumber: { startsWith: datePrefix },
    },
  });
  const slipNumber = `${datePrefix}-${(existingSlips + 1).toString().padStart(4, '0')}`;

  // Calculate finished pieces per SKU from daily outputs
  const skuFinishedQtyMap = new Map<string, { colorId: string; sizeId: string; finishedQty: number }>();
  for (const output of issue.dailyOutputs) {
    for (const skuOutput of output.skuOutputs) {
      const key = `${skuOutput.colorId}-${skuOutput.sizeId}`;
      const existing = skuFinishedQtyMap.get(key);
      if (existing) {
        existing.finishedQty += skuOutput.finishedQty;
      } else {
        skuFinishedQtyMap.set(key, {
          colorId: skuOutput.colorId,
          sizeId: skuOutput.sizeId,
          finishedQty: skuOutput.finishedQty,
        });
      }
    }
  }

  const skuBreakdownForSlip = Array.from(skuFinishedQtyMap.values()).filter((sku) => sku.finishedQty > 0);
  const totalGoodPieces = skuBreakdownForSlip.reduce((sum, sku) => sum + sku.finishedQty, 0);

  // Create transfer slip
  const transferSlip = await prisma.transfer_slips.create({
    data: {
      slipNumber,
      transferDate: today,
      workOrderId: issue.workOrderId,
      fromStage: 'FINISHING',
      toStage: 'DISPATCH',
      fromDepartment: 'Finishing',
      toDepartment: 'Dispatch',
      totalGoodPieces,
      status: 'CREATED',
      finishingIssueId: id,
      preparedById: userId,
      skuBreakdown: {
        create: skuBreakdownForSlip.map((sku) => ({
          colorId: sku.colorId,
          sizeId: sku.sizeId,
          quantity: sku.finishedQty,
        })),
      },
    },
  });

  // Auto-populate finished_goods_stock from finished output
  // Get or create a default FG location
  let fgLocation = await prisma.locations.findFirst({
    where: { locationType: 'WAREHOUSE', isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!fgLocation) {
    fgLocation = await prisma.locations.create({
      data: {
        id: randomUUID(),
        locationCode: 'FG-WAREHOUSE',
        locationName: 'Finished Goods Warehouse',
        locationType: 'WAREHOUSE',
        isActive: true,
      },
    });
  }

  // Upsert finished_goods_stock per SKU
  for (const sku of skuBreakdownForSlip) {
    const existing = await prisma.finished_goods_stock.findUnique({
      where: {
        styleId_colorId_sizeId_locationId: {
          styleId: issue.workOrder.styleId,
          colorId: sku.colorId,
          sizeId: sku.sizeId,
          locationId: fgLocation.id,
        },
      },
    });

    if (existing) {
      await prisma.finished_goods_stock.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + sku.finishedQty,
          lastUpdated: new Date(),
        },
      });
    } else {
      await prisma.finished_goods_stock.create({
        data: {
          id: randomUUID(),
          styleId: issue.workOrder.styleId,
          colorId: sku.colorId,
          sizeId: sku.sizeId,
          quantity: sku.finishedQty,
          locationId: fgLocation.id,
          workOrderId: issue.workOrderId,
          receivedDate: new Date(),
        },
      });
    }
  }

  res.json({
    data: {
      transferSlipId: transferSlip.id,
      slipNumber: transferSlip.slipNumber,
    },
  });
  // end generateTransferSlip
};

// ============================================
// Summary Endpoints
// ============================================

export const getSummary = async (req: Request, res: Response) => {
  const [statusCounts, byManager, skuTotals, outputTotals] = await Promise.all([
    prisma.finishing_issues.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.finishing_issues.groupBy({
      by: ['managerId'],
      _count: { id: true },
    }),
    // Get total issued from finishing_issue_skus
    prisma.finishing_issue_skus.aggregate({
      _sum: {
        issuedQty: true,
      },
    }),
    // Get total finished from finishing_output_skus
    prisma.finishing_output_skus.aggregate({
      _sum: {
        finishedQty: true,
      },
    }),
  ]);

  // Get manager details
  const managerIds = byManager.map((m) => m.managerId).filter((id): id is string => id !== null);
  const managers =
    managerIds.length > 0
      ? await prisma.users.findMany({
          where: { id: { in: managerIds } },
        })
      : [];
  const managerMap = new Map(managers.map((m) => [m.id, m]));

  res.json({
    data: {
      total: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
      pendingReceipt: statusCounts.find((s) => s.status === 'PENDING_RECEIPT')?._count.id || 0,
      received: statusCounts.find((s) => s.status === 'RECEIVED')?._count.id || 0,
      inProgress: statusCounts.find((s) => s.status === 'IN_PROGRESS')?._count.id || 0,
      packing: statusCounts.find((s) => s.status === 'PACKING')?._count.id || 0,
      completed: statusCounts.find((s) => s.status === 'COMPLETED')?._count.id || 0,
      totalIssued: Number(skuTotals._sum?.issuedQty || 0),
      totalFinished: Number(outputTotals._sum?.finishedQty || 0),
      byManager: byManager.map((m) => {
        const manager = m.managerId ? managerMap.get(m.managerId) : null;
        return {
          managerId: m.managerId,
          managerName: manager ? `${manager.firstName} ${manager.lastName}` : 'Unknown',
          issueCount: m._count.id,
          totalPieces: 0,
          finishedPieces: 0,
        };
      }),
    },
  });
  // end getSummary/getSummaryByWorkOrder
};

export const getSummaryByWorkOrder = async (req: Request, res: Response) => {
  const { workOrderId } = req.params;

  const [statusCounts, issues] = await Promise.all([
    prisma.finishing_issues.groupBy({
      by: ['status'],
      where: { workOrderId },
      _count: { id: true },
    }),
    prisma.finishing_issues.findMany({
      where: { workOrderId },
      include: {
        skuBreakdown: true,
        dailyOutputs: {
          include: {
            skuOutputs: true,
          },
        },
      },
    }),
  ]);

  const totalIssued = issues.reduce(
    (sum, issue) => sum + issue.skuBreakdown.reduce((s, sku) => s + sku.issuedQty, 0),
    0
  );

  // Calculate finished from daily outputs
  const totalFinished = issues.reduce(
    (sum, issue) =>
      sum +
      issue.dailyOutputs.reduce((s, output) => s + output.skuOutputs.reduce((t, sku) => t + sku.finishedQty, 0), 0),
    0
  );

  res.json({
    data: {
      total: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
      pendingReceipt: statusCounts.find((s) => s.status === 'PENDING_RECEIPT')?._count.id || 0,
      received: statusCounts.find((s) => s.status === 'RECEIVED')?._count.id || 0,
      inProgress: statusCounts.find((s) => s.status === 'IN_PROGRESS')?._count.id || 0,
      packing: statusCounts.find((s) => s.status === 'PACKING')?._count.id || 0,
      completed: statusCounts.find((s) => s.status === 'COMPLETED')?._count.id || 0,
      totalIssued,
      totalFinished,
      byManager: [],
    },
  });
  // end getSummaryByWorkOrder
};

// Get available transfer slips from stitching (pending receipt)
export const getAvailableTransferSlips = async (req: Request, res: Response) => {
  const slips = await prisma.transfer_slips.findMany({
    where: {
      fromStage: 'STITCHING',
      toStage: 'FINISHING',
      status: { in: ['CREATED', 'PRINTED', 'CONFIRMED'] },
    },
    include: {
      workOrder: {
        include: {
          styles: { select: { id: true, styleCode: true, styleName: true } },
        },
      },
      issuedTo: { select: { id: true, name: true } },
      skuBreakdown: {
        include: {
          color: { select: { id: true, colorName: true } },
          size: { select: { id: true, sizeName: true, sortOrder: true } },
        },
      },
    },
    orderBy: { transferDate: 'desc' },
  });

  res.json({
    data: slips.map((slip) => ({
      id: slip.id,
      slipNumber: slip.slipNumber,
      workOrderId: slip.workOrderId,
      workOrderNumber: slip.workOrder?.workOrderNumber || '',
      styleCode: (slip.workOrder as any)?.styles?.styleCode || '',
      styleName: (slip.workOrder as any)?.styles?.styleName || '',
      totalGoodPieces: slip.totalGoodPieces,
      transferDate: slip.transferDate,
      issuedTo: slip.issuedTo?.name || null,
      skuBreakdown: slip.skuBreakdown
        .map((sku: any) => ({
          colorId: sku.colorId,
          colorName: sku.color?.colorName || 'N/A',
          sizeId: sku.sizeId,
          sizeName: sku.size?.sizeName || '',
          sortOrder: sku.size?.sortOrder || 0,
          quantity: sku.quantity,
        }))
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder),
    })),
  });
  // end getAvailableTransferSlips
};

// Get available finishing contractors (suppliers with FINISHING_CONTRACTOR category)
export const getAvailableManagers = async (req: Request, res: Response) => {
  const contractors = await prisma.suppliers.findMany({
    where: {
      isActive: true,
      supplierCategories: { has: 'FINISHING_CONTRACTOR' },
    },
    select: {
      id: true,
      code: true,
      name: true,
      contactPerson: true,
      phone: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  res.json({ data: contractors });
  // end getAvailableManagers
};

// Get style/size-wise finishing summary with days tracking
export const getStyleSizeSummary = async (req: Request, res: Response) => {
  const issues = await prisma.finishing_issues.findMany({
    where: { isActive: true },
    include: {
      workOrder: {
        include: {
          styles: { select: { id: true, styleCode: true, styleName: true } },
          orders: {
            include: {
              customers: { select: { id: true, name: true } },
            },
          },
        },
      },
      skuBreakdown: {
        include: {
          color: { select: { id: true, colorName: true } },
          size: { select: { id: true, sizeName: true, sortOrder: true } },
        },
      },
    },
  });

  // Group by workOrder → size
  const woMap = new Map<
    string,
    {
      workOrderId: string;
      workOrderNumber: string;
      styleCode: string;
      styleName: string;
      customerName: string;
      orderNumber: string;
      issueDates: Date[];
      endDates: (Date | null)[];
      statuses: string[];
      sizeMap: Map<
        string,
        { sizeId: string; sizeName: string; sortOrder: number; pending: number; inProgress: number; completed: number }
      >;
    }
  >();

  for (const issue of issues) {
    const woId = issue.workOrderId;
    if (!woMap.has(woId)) {
      woMap.set(woId, {
        workOrderId: woId,
        workOrderNumber: issue.workOrder?.workOrderNumber || '',
        styleCode: (issue.workOrder as any)?.styles?.styleCode || '',
        styleName: (issue.workOrder as any)?.styles?.styleName || '',
        customerName: (issue.workOrder as any)?.orders?.customers?.name || '',
        orderNumber: (issue.workOrder as any)?.orders?.orderNumber || '',
        issueDates: [],
        endDates: [],
        statuses: [],
        sizeMap: new Map(),
      });
    }
    const wo = woMap.get(woId)!;
    wo.issueDates.push(new Date(issue.issueDate));
    wo.endDates.push(issue.endDate ? new Date(issue.endDate) : null);
    wo.statuses.push(issue.status);

    for (const sku of issue.skuBreakdown) {
      const sizeId = sku.sizeId;
      if (!wo.sizeMap.has(sizeId)) {
        wo.sizeMap.set(sizeId, {
          sizeId,
          sizeName: sku.size?.sizeName || '',
          sortOrder: sku.size?.sortOrder || 0,
          pending: 0,
          inProgress: 0,
          completed: 0,
        });
      }
      const sizeEntry = wo.sizeMap.get(sizeId)!;
      const qty = sku.issuedQty;

      if (issue.status === 'PENDING_RECEIPT' || issue.status === 'RECEIVED') {
        sizeEntry.pending += qty;
      } else if (issue.status === 'IN_PROGRESS' || issue.status === 'PACKING') {
        sizeEntry.inProgress += qty;
      } else if (issue.status === 'COMPLETED') {
        sizeEntry.completed += qty;
      }
    }
  }

  // Fetch cutting batches, stitching issues, and transfer slips for days calculations
  const workOrderIds = Array.from(woMap.keys());
  const [cuttingBatches, stitchingIssues, transferSlips] = await Promise.all([
    prisma.cutting_batches.findMany({
      where: { workOrderId: { in: workOrderIds }, isActive: true },
      select: { workOrderId: true, cuttingDate: true, status: true, updatedAt: true },
    }),
    prisma.stitching_issues.findMany({
      where: { workOrderId: { in: workOrderIds }, isActive: true },
      select: { workOrderId: true, issueDate: true, endDate: true, status: true },
    }),
    prisma.transfer_slips.findMany({
      where: {
        workOrderId: { in: workOrderIds },
        isActive: true,
        fromStage: 'FINISHING',
        toStage: 'DISPATCH',
      },
      select: { workOrderId: true, status: true },
    }),
  ]);

  const DAY_MS = 86400000;
  const now = Date.now();

  const data = Array.from(woMap.values()).map((wo) => {
    const sizes = Array.from(wo.sizeMap.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        ...s,
        total: s.pending + s.inProgress + s.completed,
      }));

    // Days in finishing
    const finishingStart = Math.min(...wo.issueDates.map((d) => d.getTime()));
    const allFinishingCompleted = wo.statuses.every((s) => s === 'COMPLETED');
    const validEndDates = wo.endDates.filter((d): d is Date => d !== null);
    const finishingEnd =
      allFinishingCompleted && validEndDates.length > 0 ? Math.max(...validEndDates.map((d) => d.getTime())) : now;
    const daysInFinishing = Math.max(1, Math.ceil((finishingEnd - finishingStart) / DAY_MS));

    // Days in cutting
    const woCuttingBatches = cuttingBatches.filter((b) => b.workOrderId === wo.workOrderId);
    let daysInCutting = 0;
    if (woCuttingBatches.length > 0) {
      const cuttingStart = Math.min(...woCuttingBatches.map((b) => new Date(b.cuttingDate).getTime()));
      const allCuttingCompleted = woCuttingBatches.every((b) => b.status === 'COMPLETED');
      const cuttingEnd = allCuttingCompleted
        ? Math.max(...woCuttingBatches.map((b) => new Date(b.updatedAt).getTime()))
        : now;
      daysInCutting = Math.max(1, Math.ceil((cuttingEnd - cuttingStart) / DAY_MS));
    }

    // Days in stitching
    const woStitchingIssues = stitchingIssues.filter((i) => i.workOrderId === wo.workOrderId);
    let daysInStitching = 0;
    if (woStitchingIssues.length > 0) {
      const stitchingStart = Math.min(...woStitchingIssues.map((i) => new Date(i.issueDate).getTime()));
      const allStitchingCompleted = woStitchingIssues.every((i) => i.status === 'COMPLETED');
      const stitchingEndDates = woStitchingIssues.map((i) => i.endDate).filter((d): d is Date => d !== null);
      const stitchingEnd =
        allStitchingCompleted && stitchingEndDates.length > 0
          ? Math.max(...stitchingEndDates.map((d) => new Date(d).getTime()))
          : now;
      daysInStitching = Math.max(1, Math.ceil((stitchingEnd - stitchingStart) / DAY_MS));
    }

    // Days pending push (completed finishing but not transferred to dispatch)
    let daysPendingPush: number | null = null;
    if (allFinishingCompleted && validEndDates.length > 0) {
      const hasDispatchSlip = transferSlips.some((s) => s.workOrderId === wo.workOrderId);
      if (!hasDispatchSlip) {
        const lastEnd = Math.max(...validEndDates.map((d) => d.getTime()));
        daysPendingPush = Math.max(0, Math.ceil((now - lastEnd) / DAY_MS));
      }
    }

    return {
      workOrderId: wo.workOrderId,
      workOrderNumber: wo.workOrderNumber,
      styleCode: wo.styleCode,
      styleName: wo.styleName,
      customerName: wo.customerName,
      orderNumber: wo.orderNumber,
      daysInCutting,
      daysInStitching,
      daysInFinishing,
      daysPendingPush,
      sizes,
      totalPending: sizes.reduce((sum, s) => sum + s.pending, 0),
      totalInProgress: sizes.reduce((sum, s) => sum + s.inProgress, 0),
      totalCompleted: sizes.reduce((sum, s) => sum + s.completed, 0),
    };
  });

  res.json({ data });
  // end getStyleSizeSummary
};

// ============================================
// Packing Endpoints (Polybag + Carton)
// ============================================

/**
 * @route POST /api/finishing/issues/:id/polybag-entry
 * @desc Record polybag packing for a finishing issue
 */
export const createPolybagEntry = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'User not authenticated' });

  const { packingDate, skuBreakdown, remarks } = req.body as {
    packingDate?: string;
    skuBreakdown: Array<{ colorId: string; sizeId: string; packedQty: number }>;
    remarks?: string;
  };

  if (!skuBreakdown || skuBreakdown.length === 0) {
    throw new ValidationError('At least one SKU must be included');
  }

  const issue = await prisma.finishing_issues.findUnique({ where: { id } });
  if (!issue) throw new NotFoundError('Finishing issue', id);
  if (issue.status !== 'PACKING' && issue.status !== 'IN_PROGRESS') {
    throw new ValidationError('Can only add polybag entries for in-progress or packing issues');
  }

  const totalPolybags = skuBreakdown.reduce((sum, s) => sum + s.packedQty, 0);

  const entry = await prisma.polybag_entries.create({
    data: {
      finishingIssueId: id,
      packingDate: packingDate ? new Date(packingDate) : new Date(),
      totalPolybags,
      remarks,
      createdById: userId,
      skuBreakdown: {
        create: skuBreakdown.map((s) => ({
          colorId: s.colorId,
          sizeId: s.sizeId,
          packedQty: s.packedQty,
        })),
      },
    },
    include: { skuBreakdown: true },
  });

  res.status(201).json({ data: entry });
};

/**
 * @route POST /api/finishing/issues/:id/carton-packing
 * @desc Record carton packing for a finishing issue
 */
export const createCartonPacking = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'User not authenticated' });

  const { cartonNumber, cartonDate, packingType, cartonDimensions, grossWeight, netWeight, skuBreakdown, remarks } =
    req.body as {
      cartonNumber: string;
      cartonDate?: string;
      packingType?: string;
      cartonDimensions?: string;
      grossWeight?: number;
      netWeight?: number;
      skuBreakdown: Array<{ colorId: string; sizeId: string; quantity: number }>;
      remarks?: string;
    };

  if (!cartonNumber || !skuBreakdown || skuBreakdown.length === 0) {
    throw new ValidationError('Carton number and at least one SKU are required');
  }

  const issue = await prisma.finishing_issues.findUnique({
    where: { id },
    select: { id: true, workOrderId: true, status: true },
  });
  if (!issue) throw new NotFoundError('Finishing issue', id);

  const pcsPerCarton = skuBreakdown.reduce((sum, s) => sum + s.quantity, 0);

  const carton = await prisma.carton_packings.create({
    data: {
      cartonNumber,
      workOrderId: issue.workOrderId,
      finishingIssueId: id,
      cartonDate: cartonDate ? new Date(cartonDate) : new Date(),
      packingType: (packingType as any) || 'SOLID',
      pcsPerCarton,
      cartonDimensions,
      grossWeight,
      netWeight,
      createdById: userId,
      remarks,
      skuBreakdown: {
        create: skuBreakdown.map((s) => ({
          colorId: s.colorId,
          sizeId: s.sizeId,
          quantity: s.quantity,
        })),
      },
    },
    include: { skuBreakdown: true },
  });

  res.status(201).json({ data: carton });
};
