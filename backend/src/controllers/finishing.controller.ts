import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';

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
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      workOrderId,
      managerId,
      fromDate,
      toDate,
    } = req.query;

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
  } catch (error) {
    console.error('Error fetching finishing issues:', error);
    res.status(500).json({ error: 'Failed to fetch finishing issues' });
  }
};

// ============================================
// Get Single Finishing Issue
// ============================================

export const getFinishingIssueById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const issue = await prisma.finishing_issues.findUnique({
      where: { id },
      include: issueIncludeOptions,
    });

    if (!issue) {
      return res.status(404).json({ error: 'Finishing issue not found' });
    }

    res.json({ data: transformFinishingIssue(issue) });
  } catch (error) {
    console.error('Error fetching finishing issue:', error);
    res.status(500).json({ error: 'Failed to fetch finishing issue' });
  }
};

// ============================================
// Create Finishing Issue
// ============================================

export const createFinishingIssue = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const {
      workOrderId,
      issueDate,
      managerId,
      expectedCompletionDate,
      remarks,
      components,
      skuBreakdown,
    } = req.body;

    // Get work order to generate issue number
    const workOrder = await prisma.work_orders.findUnique({
      where: { id: workOrderId },
      select: { workOrderNumber: true },
    });

    if (!workOrder) {
      return res.status(400).json({ error: 'Work order not found' });
    }

    const issueNumber = await generateIssueNumber(workOrder.workOrderNumber);

    const issue = await prisma.finishing_issues.create({
      data: {
        issueNumber,
        workOrderId,
        issueDate: new Date(issueDate),
        managerId,
        expectedCompletionDate: expectedCompletionDate ? new Date(expectedCompletionDate) : null,
        status: 'PENDING_RECEIPT',
        remarks,
        createdById: userId,
        components: components?.length > 0
          ? {
              create: components.map((componentId: string) => ({
                componentId,
              })),
            }
          : undefined,
        skuBreakdown: {
          create: skuBreakdown.map((sku: any) => ({
            colorId: sku.colorId,
            sizeId: sku.sizeId,
            availableQty: sku.availableQty || sku.issuedQty || 0,
            issuedQty: sku.issuedQty || 0,
          })),
        },
      },
      include: issueIncludeOptions,
    });

    res.status(201).json({ data: transformFinishingIssue(issue) });
  } catch (error) {
    console.error('Error creating finishing issue:', error);
    res.status(500).json({ error: 'Failed to create finishing issue' });
  }
};

// ============================================
// Update Finishing Issue
// ============================================

export const updateFinishingIssue = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existing = await prisma.finishing_issues.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Finishing issue not found' });
    }

    if (existing.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot update completed issue' });
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
  } catch (error) {
    console.error('Error updating finishing issue:', error);
    res.status(500).json({ error: 'Failed to update finishing issue' });
  }
};

// ============================================
// Delete Finishing Issue
// ============================================

export const deleteFinishingIssue = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.finishing_issues.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Finishing issue not found' });
    }

    if (existing.status !== 'PENDING_RECEIPT') {
      return res.status(400).json({ error: 'Can only delete pending issues' });
    }

    await prisma.finishing_issues.delete({
      where: { id },
    });

    res.json({ message: 'Finishing issue deleted successfully' });
  } catch (error) {
    console.error('Error deleting finishing issue:', error);
    res.status(500).json({ error: 'Failed to delete finishing issue' });
  }
};

// ============================================
// Workflow Actions
// ============================================

// Receive from stitching
export const receiveFromStitching = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { transferSlipId } = req.body;

    const existing = await prisma.finishing_issues.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Finishing issue not found' });
    }

    if (existing.status !== 'PENDING_RECEIPT') {
      return res.status(400).json({ error: 'Can only receive for pending issues' });
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
  } catch (error) {
    console.error('Error receiving from stitching:', error);
    res.status(500).json({ error: 'Failed to receive from stitching' });
  }
};

// Start finishing
export const startFinishingIssue = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.finishing_issues.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Finishing issue not found' });
    }

    if (existing.status !== 'RECEIVED') {
      return res.status(400).json({ error: 'Can only start received issues' });
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
  } catch (error) {
    console.error('Error starting finishing:', error);
    res.status(500).json({ error: 'Failed to start finishing' });
  }
};

// Record daily output
export const recordDailyOutput = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { outputDate, componentId, skuOutputs, remarks } = req.body;

    const existing = await prisma.finishing_issues.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Finishing issue not found' });
    }

    if (existing.status !== 'IN_PROGRESS' && existing.status !== 'PACKING') {
      return res.status(400).json({ error: 'Can only record output for in-progress or packing issues' });
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
          create: skuOutputs.map((sku: any) => ({
            colorId: sku.colorId,
            sizeId: sku.sizeId,
            finishedQty: sku.finishedQty || 0,
            defectQty: sku.defectQty || 0,
          })),
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
  } catch (error) {
    console.error('Error recording daily output:', error);
    res.status(500).json({ error: 'Failed to record daily output' });
  }
};

// Move to packing
export const moveToPackingFinishingIssue = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.finishing_issues.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Finishing issue not found' });
    }

    if (existing.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Can only move to packing from in-progress' });
    }

    const issue = await prisma.finishing_issues.update({
      where: { id },
      data: { status: 'PACKING' },
      include: issueIncludeOptions,
    });

    res.json({ data: transformFinishingIssue(issue) });
  } catch (error) {
    console.error('Error moving to packing:', error);
    res.status(500).json({ error: 'Failed to move to packing' });
  }
};

// Complete finishing issue
export const completeFinishingIssue = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.finishing_issues.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Finishing issue not found' });
    }

    if (existing.status !== 'PACKING' && existing.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Can only complete packing or in-progress issues' });
    }

    const issue = await prisma.finishing_issues.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endDate: new Date(),
      },
      include: issueIncludeOptions,
    });

    res.json({ data: transformFinishingIssue(issue) });
  } catch (error) {
    console.error('Error completing finishing:', error);
    res.status(500).json({ error: 'Failed to complete finishing' });
  }
};

// Generate transfer slip to dispatch
export const generateTransferSlip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

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
      return res.status(404).json({ error: 'Finishing issue not found' });
    }

    if (issue.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Can only generate transfer slip for completed issues' });
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

    res.json({
      data: {
        transferSlipId: transferSlip.id,
        slipNumber: transferSlip.slipNumber,
      },
    });
  } catch (error) {
    console.error('Error generating transfer slip:', error);
    res.status(500).json({ error: 'Failed to generate transfer slip' });
  }
};

// ============================================
// Summary Endpoints
// ============================================

export const getSummary = async (req: Request, res: Response) => {
  try {
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
    const managerIds = byManager.map((m) => m.managerId);
    const managers = await prisma.users.findMany({
      where: { id: { in: managerIds } },
    });
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
          const manager = managerMap.get(m.managerId);
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
  } catch (error) {
    console.error('Error fetching finishing summary:', error);
    res.status(500).json({ error: 'Failed to fetch finishing summary' });
  }
};

export const getSummaryByWorkOrder = async (req: Request, res: Response) => {
  try {
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
        issue.dailyOutputs.reduce(
          (s, output) => s + output.skuOutputs.reduce((t, sku) => t + sku.finishedQty, 0),
          0
        ),
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
  } catch (error) {
    console.error('Error fetching finishing summary by work order:', error);
    res.status(500).json({ error: 'Failed to fetch finishing summary' });
  }
};

// Get available transfer slips from stitching (pending receipt)
export const getAvailableTransferSlips = async (req: Request, res: Response) => {
  try {
    const slips = await prisma.transfer_slips.findMany({
      where: {
        fromStage: 'STITCHING',
        toStage: 'FINISHING',
        status: { in: ['CREATED', 'PRINTED', 'CONFIRMED'] },
      },
      include: {
        workOrder: {
          include: {
            styles: true,
          },
        },
      },
    });

    res.json({
      data: slips.map((slip) => ({
        id: slip.id,
        slipNumber: slip.slipNumber,
        workOrderNumber: slip.workOrder?.workOrderNumber || '',
        styleName: slip.workOrder?.styles?.styleName || '',
        totalGoodPieces: slip.totalGoodPieces,
        transferDate: slip.transferDate,
      })),
    });
  } catch (error) {
    console.error('Error fetching available transfer slips:', error);
    res.status(500).json({ error: 'Failed to fetch available transfer slips' });
  }
};

// Get available managers (users who can manage finishing)
export const getAvailableManagers = async (req: Request, res: Response) => {
  try {
    // Get users who are active - in a real system you might filter by role
    const managers = await prisma.users.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    });

    res.json({
      data: managers.map((m) => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`,
        email: m.email,
        role: m.role,
      })),
    });
  } catch (error) {
    console.error('Error fetching available managers:', error);
    res.status(500).json({ error: 'Failed to fetch available managers' });
  }
};
