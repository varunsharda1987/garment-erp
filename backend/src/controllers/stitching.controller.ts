import { Request, Response } from 'express';
import logger from '../utils/logger';
import { NotFoundError, ValidationError, BusinessError, UnauthorizedError } from '../errors';
import prisma from '../config/database';
import { Prisma, StitchingIssueStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { dedupeSkuRows } from './cutting.utils';

// ============================================
// Helper Functions
// ============================================

const transformStitchingIssue = (issue: any) => ({
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
  const prefix = `SI-${workOrderNumber}`;

  // Max-based (not count-based) so a deleted issue never causes its number to be reused
  // (bug-hunt production-17)
  const existing = await prisma.stitching_issues.findMany({
    where: {
      issueNumber: {
        startsWith: prefix,
      },
    },
    select: { issueNumber: true },
  });
  const maxSeq = existing.reduce((max, i) => {
    const m = i.issueNumber.match(/-(\d+)$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);

  const seq = (maxSeq + 1).toString().padStart(3, '0');
  return `${prefix}-${seq}`;
};

// Include options for stitching issue queries
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
// List Stitching Issues
// ============================================

export const getAllStitchingIssues = async (req: Request, res: Response) => {
  const { page = 1, limit = 20, search, status, workOrderId, managerId, fromDate, toDate } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Prisma.stitching_issuesWhereInput = {};

  if (search) {
    where.OR = [
      { issueNumber: { contains: String(search), mode: 'insensitive' } },
      { workOrder: { workOrderNumber: { contains: String(search), mode: 'insensitive' } } },
      { workOrder: { styles: { styleCode: { contains: String(search), mode: 'insensitive' } } } },
      { workOrder: { styles: { styleName: { contains: String(search), mode: 'insensitive' } } } },
    ];
  }

  if (status) {
    where.status = status as StitchingIssueStatus;
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
    prisma.stitching_issues.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: issueIncludeOptions,
    }),
    prisma.stitching_issues.count({ where }),
  ]);

  res.json({
    data: issues.map(transformStitchingIssue),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
};

// ============================================
// Get Single Stitching Issue
// ============================================

export const getStitchingIssueById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const [issue, transferSlip] = await Promise.all([
    prisma.stitching_issues.findUnique({
      where: { id },
      include: issueIncludeOptions,
    }),
    prisma.transfer_slips.findFirst({
      where: { stitchingIssueId: id },
      select: { id: true, slipNumber: true, status: true },
    }),
  ]);

  if (!issue) {
    throw new NotFoundError('Stitching issue', id);
  }

  const transformed = transformStitchingIssue(issue);
  res.json({
    data: {
      ...transformed,
      transferSlip: transferSlip || null,
    },
  });
};

// ============================================
// Create Stitching Issue
// ============================================

export const createStitchingIssue = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }
  const {
    workOrderId,
    issueDate,
    managerId,
    contractorId,
    expectedCompletionDate,
    remarks,
    components,
    skuBreakdown,
    transferSlipIds,
  } = req.body;

  // Get work order to generate issue number
  const workOrder = await prisma.work_orders.findUnique({
    where: { id: workOrderId },
    select: { workOrderNumber: true },
  });

  if (!workOrder) {
    throw new ValidationError('Work order not found');
  }

  const issueNumber = await generateIssueNumber(workOrder.workOrderNumber);

  // Deduped by (colorId, sizeId) — NULL-color duplicates double-count totals (bug-hunt production-18)
  const skuRows = dedupeSkuRows(
    // as any[]: bare `any` receiver collapses the generic to its constraint (loses qty fields)
    ((skuBreakdown || []) as any[]).map((sku: any) => {
      const availableQty = sku.availableQty ?? sku.issuedQty;
      if (availableQty === undefined || availableQty === null) {
        throw new ValidationError(
          `Available quantity is required for SKU (color: ${sku.colorId}, size: ${sku.sizeId}). Must come from cutting output.`
        );
      }
      return {
        colorId: sku.colorId ?? null,
        sizeId: sku.sizeId,
        availableQty: Number(availableQty),
        issuedQty: Number(sku.issuedQty ?? availableQty),
      };
    }),
    ['availableQty', 'issuedQty']
  );

  if (skuRows.length === 0) {
    throw new ValidationError('At least one SKU breakdown entry is required');
  }

  // Validate issued quantities against the selected transfer slips — issuing more than cutting
  // supplied silently inflated stitching WIP (bug-hunt production-23).
  if (transferSlipIds?.length) {
    const slips = await prisma.transfer_slips.findMany({
      where: { id: { in: transferSlipIds }, isActive: true },
      include: { skuBreakdown: true },
    });

    if (slips.length !== transferSlipIds.length) {
      throw new ValidationError('One or more selected transfer slips were not found or are inactive');
    }
    const wrongWo = slips.find((s) => s.workOrderId !== workOrderId);
    if (wrongWo) {
      throw new ValidationError(`Transfer slip ${wrongWo.slipNumber} belongs to a different work order`);
    }
    const consumed = slips.find((s) => s.status === 'RECEIVED'); // RECEIVED = consumed (TransferSlipStatus has no CANCELLED)
    if (consumed) {
      throw new ValidationError(
        `Transfer slip ${consumed.slipNumber} has already been ${consumed.status.toLowerCase()}`
      );
    }

    // Per-SKU available = sum across the selected slips
    const slipQtyByKey = new Map<string, number>();
    for (const slip of slips) {
      for (const sku of slip.skuBreakdown) {
        const key = `${sku.colorId ?? ''}|${sku.sizeId}`;
        slipQtyByKey.set(key, (slipQtyByKey.get(key) || 0) + sku.quantity);
      }
    }
    for (const row of skuRows) {
      const key = `${row.colorId ?? ''}|${row.sizeId}`;
      const available = slipQtyByKey.get(key) || 0;
      if (row.issuedQty > available) {
        throw new ValidationError(
          `Issued quantity (${row.issuedQty}) exceeds the ${available} pieces available on the selected transfer slips for size ${row.sizeId}${row.colorId ? ` / color ${row.colorId}` : ''}`
        );
      }
    }
  }

  // Create the issue and consume the slips in ONE transaction with a guarded status flip —
  // previously the slips were bulk-marked RECEIVED outside any transaction (bug-hunt production-23).
  const issue = await prisma.$transaction(async (tx) => {
    const created = await tx.stitching_issues.create({
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
          create: skuRows,
        },
      },
      include: issueIncludeOptions,
    });

    // Mark consumed transfer slips as RECEIVED — guarded so a slip consumed concurrently
    // (already RECEIVED) aborts the whole issue instead of being double-consumed
    if (transferSlipIds?.length) {
      const flipped = await tx.transfer_slips.updateMany({
        where: {
          id: { in: transferSlipIds },
          isActive: true,
          status: { in: ['CREATED', 'PRINTED', 'CONFIRMED'] },
        },
        data: { status: 'RECEIVED', receivedDate: new Date() },
      });
      if (flipped.count !== transferSlipIds.length) {
        throw new ValidationError('One or more transfer slips were already consumed by another stitching issue');
      }
    }

    return created;
  });

  // Auto-create production_tracking: IN_STITCHING
  try {
    const totalIssuedQty = skuRows.reduce((sum: number, sku) => sum + (Number(sku.issuedQty) || 0), 0);
    await prisma.production_tracking.create({
      data: {
        id: randomUUID(),
        workOrderId,
        productionStage: 'IN_STITCHING',
        quantityCompleted: totalIssuedQty,
        updatedById: userId,
        updateDate: new Date(),
      },
    });
  } catch (err) {
    // allow-swallow — pure timeline production_tracking entry; must not fail the already-created stitching issue
    logger.error('Failed to create production_tracking for stitching:', err);
  }

  res.status(201).json({ data: transformStitchingIssue(issue), message: 'Stitching issue created successfully' });
};

// ============================================
// Update Stitching Issue
// ============================================

export const updateStitchingIssue = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const existing = await prisma.stitching_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Stitching issue', id);
  }

  if (existing.status === 'COMPLETED') {
    throw new ValidationError('Cannot update completed issue');
  }

  const issue = await prisma.stitching_issues.update({
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

  res.json({ data: transformStitchingIssue(issue) });
};

// ============================================
// Delete Stitching Issue
// ============================================

export const deleteStitchingIssue = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.stitching_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Stitching issue', id);
  }

  if (existing.status !== 'PENDING_RECEIPT') {
    throw new ValidationError('Can only delete pending issues');
  }

  await prisma.stitching_issues.delete({
    where: { id },
  });

  res.json({ message: 'Stitching issue deleted successfully' });
};

// ============================================
// Workflow Actions
// ============================================

// Receive from cutting
export const receiveFromCutting = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { transferSlipId, skuReceived, remarks } = req.body;
  const userId = req.user?.userId;

  const existing = await prisma.stitching_issues.findUnique({
    where: { id },
    select: { status: true, workOrderId: true },
  });

  if (!existing) {
    throw new NotFoundError('Stitching issue', id);
  }

  if (existing.status !== 'PENDING_RECEIPT') {
    throw new ValidationError('Can only receive for pending issues');
  }

  const issue = await prisma.stitching_issues.update({
    where: { id },
    data: { status: 'RECEIVED' },
    include: issueIncludeOptions,
  });

  // Update transfer slip status and persist the received quantities as a stage receipt — the
  // schema-required skuReceived array used to be silently discarded, so short receipts were
  // never recorded anywhere (bug-hunt production-14).
  if (transferSlipId) {
    const slip = await prisma.transfer_slips.update({
      where: { id: transferSlipId },
      data: { status: 'RECEIVED', receivedDate: new Date(), receivedById: userId ?? undefined },
      include: { skuBreakdown: true },
    });

    if (skuReceived?.length && userId) {
      const expectedByKey = new Map(slip.skuBreakdown.map((s) => [`${s.colorId ?? ''}|${s.sizeId}`, s.quantity]));
      const totalReceived = skuReceived.reduce((sum: number, r: any) => sum + Number(r.receivedQty || 0), 0);
      const hasDeviation = totalReceived !== slip.totalGoodPieces;
      await prisma.stage_receipts.create({
        data: {
          workOrderId: existing.workOrderId,
          stage: 'STITCHING',
          transferSlipId,
          receivedDate: new Date(),
          receivedById: userId,
          hasDeviation,
          deviationReason: hasDeviation
            ? `Received ${totalReceived} of ${slip.totalGoodPieces} pieces on slip ${slip.slipNumber}`
            : null,
          remarks,
          skuReceipts: {
            // stage_receipt_skus.colorId is non-nullable — size-only (null-color) rows are captured
            // by the header totals/deviation above
            create: skuReceived
              .filter((r: any) => r.colorId)
              .map((r: any) => {
                const expectedQty = expectedByKey.get(`${r.colorId}|${r.sizeId}`) ?? 0;
                return {
                  colorId: r.colorId,
                  sizeId: r.sizeId,
                  expectedQty,
                  receivedQty: Number(r.receivedQty || 0),
                  deviation: Number(r.receivedQty || 0) - expectedQty,
                };
              }),
          },
        },
      });
    }
  }

  res.json({ data: transformStitchingIssue(issue) });
};

// Start stitching
export const startStitchingIssue = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.stitching_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Stitching issue', id);
  }

  if (existing.status !== 'RECEIVED') {
    throw new ValidationError('Can only start received items');
  }

  const issue = await prisma.stitching_issues.update({
    where: { id },
    data: {
      status: 'IN_PROGRESS',
      startDate: new Date(),
    },
    include: issueIncludeOptions,
  });

  res.json({ data: transformStitchingIssue(issue) });
};

// Record daily output
export const recordDailyOutput = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }
  const { outputDate, componentId, skuOutputs, remarks } = req.body;

  const existing = await prisma.stitching_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Stitching issue', id);
  }

  if (existing.status !== 'IN_PROGRESS') {
    throw new ValidationError('Can only record output for in-progress issues');
  }

  // Cap cumulative output at the issued quantity — stitching 'produced' could silently exceed
  // what cutting supplied (bug-hunt production-23)
  const [issuedAgg, producedAgg] = await Promise.all([
    prisma.stitching_issue_skus.aggregate({
      where: { stitchingIssueId: id },
      _sum: { issuedQty: true },
    }),
    prisma.stitching_output_skus.aggregate({
      where: { dailyOutput: { stitchingIssueId: id } },
      _sum: { goodQty: true, defectQty: true },
    }),
  ]);
  const totalIssued = issuedAgg._sum.issuedQty ?? 0;
  const alreadyRecorded = (producedAgg._sum.goodQty ?? 0) + (producedAgg._sum.defectQty ?? 0);
  const newTotal = (skuOutputs || []).reduce(
    (sum: number, sku: any) =>
      sum + (Number(sku.goodQty ?? sku.passedQty) || 0) + (Number(sku.defectQty ?? sku.rejectedQty) || 0),
    0
  );
  if (totalIssued > 0 && alreadyRecorded + newTotal > totalIssued) {
    throw new ValidationError(
      `Cannot record ${newTotal} pieces: ${alreadyRecorded} of ${totalIssued} issued pieces already recorded (only ${totalIssued - alreadyRecorded} remain)`
    );
  }

  // Create daily output record - stitching_daily_outputs doesn't have aggregate fields
  // The totals are calculated from skuOutputs (stitching_output_skus)
  const dailyOutput = await prisma.stitching_daily_outputs.create({
    data: {
      stitchingIssueId: id,
      componentId,
      outputDate: new Date(outputDate),
      remarks,
      createdById: userId,
      skuOutputs: {
        create: skuOutputs.map((sku: any) => {
          const goodQty = sku.goodQty ?? sku.passedQty;
          const defectQty = sku.defectQty ?? sku.rejectedQty;
          if (goodQty === undefined || goodQty === null) {
            throw new Error(
              `Good/passed quantity is required for each SKU output (color: ${sku.colorId}, size: ${sku.sizeId})`
            );
          }
          if (defectQty === undefined || defectQty === null) {
            throw new Error(
              `Defect/rejected quantity is required for each SKU output (color: ${sku.colorId}, size: ${sku.sizeId}). Enter 0 if no defects.`
            );
          }
          return {
            colorId: sku.colorId,
            sizeId: sku.sizeId,
            goodQty: Number(goodQty) || 0,
            defectQty: Number(defectQty) || 0,
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
};

// Complete stitching issue
export const completeStitchingIssue = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.stitching_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Stitching issue', id);
  }

  if (existing.status !== 'IN_PROGRESS') {
    throw new ValidationError('Can only complete in-progress issues');
  }

  // Validate that at least some output has been recorded
  const outputTotals = await prisma.stitching_output_skus.aggregate({
    where: { dailyOutput: { stitchingIssueId: id } },
    _sum: { goodQty: true },
  });
  if (!outputTotals._sum.goodQty || outputTotals._sum.goodQty <= 0) {
    throw new ValidationError('Cannot complete: no output recorded. Record daily output first.');
  }

  const issue = await prisma.stitching_issues.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      endDate: new Date(),
    },
    include: issueIncludeOptions,
  });

  res.json({ data: transformStitchingIssue(issue) });
};

// Reopen a completed stitching issue (back to IN_PROGRESS)
export const reopenStitchingIssue = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.stitching_issues.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Stitching issue', id);
  }

  if (existing.status !== 'COMPLETED') {
    throw new ValidationError('Can only reopen completed issues');
  }

  // Check no transfer slip has been generated
  const transferSlip = await prisma.transfer_slips.findFirst({
    where: { stitchingIssueId: id },
  });
  if (transferSlip) {
    throw new BusinessError('Cannot reopen: a transfer slip has already been generated for this issue');
  }

  const issue = await prisma.stitching_issues.update({
    where: { id },
    data: {
      status: 'IN_PROGRESS',
      endDate: null,
    },
    include: issueIncludeOptions,
  });

  res.json({ data: transformStitchingIssue(issue) });
};

// Generate transfer slip to finishing
export const generateTransferSlip = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const issue = await prisma.stitching_issues.findUnique({
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
    throw new NotFoundError('Stitching issue', id);
  }

  if (issue.status !== 'COMPLETED') {
    throw new ValidationError('Can only generate transfer slip for completed issues');
  }

  // Generate slip number — max-based, not count-based: slipNumber is @unique, so a deleted slip
  // plus count+1 regenerated an existing number → P2002 (bug-hunt production-17)
  const today = new Date();
  const datePrefix = `TS-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
  const lastSlip = await prisma.transfer_slips.findFirst({
    where: {
      slipNumber: { startsWith: datePrefix },
    },
    orderBy: { slipNumber: 'desc' },
    select: { slipNumber: true },
  });
  const lastSeq = lastSlip ? parseInt(lastSlip.slipNumber.slice(-4), 10) || 0 : 0;
  const slipNumber = `${datePrefix}-${(lastSeq + 1).toString().padStart(4, '0')}`;

  // Calculate good pieces per SKU from daily outputs
  const skuGoodQtyMap = new Map<string, { colorId: string; sizeId: string; goodQty: number }>();
  for (const output of issue.dailyOutputs) {
    for (const skuOutput of output.skuOutputs) {
      const key = `${skuOutput.colorId}-${skuOutput.sizeId}`;
      const existing = skuGoodQtyMap.get(key);
      if (existing) {
        existing.goodQty += skuOutput.goodQty;
      } else {
        skuGoodQtyMap.set(key, {
          colorId: skuOutput.colorId,
          sizeId: skuOutput.sizeId,
          goodQty: skuOutput.goodQty,
        });
      }
    }
  }

  const skuBreakdownForSlip = Array.from(skuGoodQtyMap.values()).filter((sku) => sku.goodQty > 0);
  const totalGoodPieces = skuBreakdownForSlip.reduce((sum, sku) => sum + sku.goodQty, 0);

  // ONE slip per stitching issue (bug-hunt production-8): duplicates double-counted the same pieces
  // downstream. The partial unique index on stitchingIssueId is the DB backstop.
  const existingSlipForIssue = await prisma.transfer_slips.findFirst({
    where: { stitchingIssueId: id },
    select: { slipNumber: true },
  });
  if (existingSlipForIssue) {
    throw new ValidationError(
      `A transfer slip (${existingSlipForIssue.slipNumber}) already exists for this stitching issue`
    );
  }

  // Create transfer slip
  const transferSlip = await prisma.transfer_slips.create({
    data: {
      slipNumber,
      transferDate: today,
      workOrderId: issue.workOrderId,
      fromStage: 'STITCHING',
      toStage: 'FINISHING',
      fromDepartment: 'Stitching',
      toDepartment: 'Finishing',
      totalGoodPieces,
      status: 'CREATED',
      stitchingIssueId: id,
      preparedById: userId,
      skuBreakdown: {
        create: skuBreakdownForSlip.map((sku) => ({
          colorId: sku.colorId,
          sizeId: sku.sizeId,
          quantity: sku.goodQty,
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
};

// ============================================
// Summary Endpoints
// ============================================

export const getSummary = async (req: Request, res: Response) => {
  const [statusCounts, byManager, skuTotals, outputTotals] = await Promise.all([
    prisma.stitching_issues.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.stitching_issues.groupBy({
      by: ['managerId'],
      _count: { id: true },
    }),
    // Get total issued from stitching_issue_skus
    prisma.stitching_issue_skus.aggregate({
      _sum: {
        issuedQty: true,
      },
    }),
    // Get total completed from stitching_output_skus
    prisma.stitching_output_skus.aggregate({
      _sum: {
        goodQty: true,
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
      completed: statusCounts.find((s) => s.status === 'COMPLETED')?._count.id || 0,
      totalIssued: Number(skuTotals._sum?.issuedQty || 0),
      totalCompleted: Number(outputTotals._sum?.goodQty || 0),
      byManager: byManager.map((m) => {
        const manager = m.managerId ? managerMap.get(m.managerId) : null;
        return {
          managerId: m.managerId,
          managerName: manager ? `${manager.firstName} ${manager.lastName}` : 'Unknown',
          issueCount: m._count.id,
          totalPieces: 0,
          completedPieces: 0,
        };
      }),
    },
  });
};

export const getSummaryByWorkOrder = async (req: Request, res: Response) => {
  const { workOrderId } = req.params;

  const [statusCounts, issues] = await Promise.all([
    prisma.stitching_issues.groupBy({
      by: ['status'],
      where: { workOrderId },
      _count: { id: true },
    }),
    prisma.stitching_issues.findMany({
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

  // Calculate completed from daily outputs
  const totalCompleted = issues.reduce(
    (sum, issue) =>
      sum + issue.dailyOutputs.reduce((s, output) => s + output.skuOutputs.reduce((t, sku) => t + sku.goodQty, 0), 0),
    0
  );

  res.json({
    data: {
      total: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
      pendingReceipt: statusCounts.find((s) => s.status === 'PENDING_RECEIPT')?._count.id || 0,
      received: statusCounts.find((s) => s.status === 'RECEIVED')?._count.id || 0,
      inProgress: statusCounts.find((s) => s.status === 'IN_PROGRESS')?._count.id || 0,
      completed: statusCounts.find((s) => s.status === 'COMPLETED')?._count.id || 0,
      totalIssued,
      totalCompleted,
      byManager: [],
    },
  });
};

export const getSummaryByManager = async (req: Request, res: Response) => {
  const { managerId } = req.params;

  const [statusCounts, issues] = await Promise.all([
    prisma.stitching_issues.groupBy({
      by: ['status'],
      where: { managerId },
      _count: { id: true },
    }),
    prisma.stitching_issues.findMany({
      where: { managerId },
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

  const totalCompleted = issues.reduce(
    (sum, issue) =>
      sum + issue.dailyOutputs.reduce((s, output) => s + output.skuOutputs.reduce((t, sku) => t + sku.goodQty, 0), 0),
    0
  );

  res.json({
    data: {
      total: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
      pendingReceipt: statusCounts.find((s) => s.status === 'PENDING_RECEIPT')?._count.id || 0,
      received: statusCounts.find((s) => s.status === 'RECEIVED')?._count.id || 0,
      inProgress: statusCounts.find((s) => s.status === 'IN_PROGRESS')?._count.id || 0,
      completed: statusCounts.find((s) => s.status === 'COMPLETED')?._count.id || 0,
      totalIssued,
      totalCompleted,
      byManager: [],
    },
  });
};

// Style-size-wise summary across all active stitching issues
export const getStyleSizeSummary = async (req: Request, res: Response) => {
  const issues = await prisma.stitching_issues.findMany({
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
        styleCode: issue.workOrder?.styles?.styleCode || '',
        styleName: issue.workOrder?.styles?.styleName || '',
        customerName: issue.workOrder?.orders?.customers?.name || '',
        orderNumber: issue.workOrder?.orders?.orderNumber || '',
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
      } else if (issue.status === 'IN_PROGRESS') {
        sizeEntry.inProgress += qty;
      } else if (issue.status === 'COMPLETED') {
        sizeEntry.completed += qty;
      }
    }
  }

  // Fetch cutting batches and transfer slips for days calculations
  const workOrderIds = Array.from(woMap.keys());
  const [cuttingBatches, transferSlips] = await Promise.all([
    prisma.cutting_batches.findMany({
      where: { workOrderId: { in: workOrderIds }, isActive: true },
      select: { workOrderId: true, cuttingDate: true, status: true, updatedAt: true },
    }),
    prisma.transfer_slips.findMany({
      where: {
        workOrderId: { in: workOrderIds },
        isActive: true,
        fromStage: 'STITCHING',
        toStage: 'FINISHING',
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

    // Days in stitching
    const stitchingStart = Math.min(...wo.issueDates.map((d) => d.getTime()));
    const allStitchingCompleted = wo.statuses.every((s) => s === 'COMPLETED');
    const validEndDates = wo.endDates.filter((d): d is Date => d !== null);
    const stitchingEnd =
      allStitchingCompleted && validEndDates.length > 0 ? Math.max(...validEndDates.map((d) => d.getTime())) : now;
    const daysInStitching = Math.max(1, Math.ceil((stitchingEnd - stitchingStart) / DAY_MS));

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

    // Days pending push (completed stitching but not transferred to finishing)
    let daysPendingPush: number | null = null;
    if (allStitchingCompleted && validEndDates.length > 0) {
      const hasFinishingSlip = transferSlips.some((s) => s.workOrderId === wo.workOrderId);
      if (!hasFinishingSlip) {
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
      daysPendingPush,
      sizes,
      totalPending: sizes.reduce((sum, s) => sum + s.pending, 0),
      totalInProgress: sizes.reduce((sum, s) => sum + s.inProgress, 0),
      totalCompleted: sizes.reduce((sum, s) => sum + s.completed, 0),
    };
  });

  res.json({ data });
};

// Get available transfer slips from cutting (pending receipt)
export const getAvailableTransferSlips = async (req: Request, res: Response) => {
  const slips = await prisma.transfer_slips.findMany({
    where: {
      fromStage: 'CUTTING',
      toStage: 'STITCHING',
      status: { in: ['CREATED', 'PRINTED', 'CONFIRMED'] },
    },
    include: {
      workOrder: {
        include: {
          styles: { select: { id: true, styleCode: true, styleName: true } },
        },
      },
      skuBreakdown: {
        include: {
          color: { select: { id: true, colorName: true, colorCode: true } },
          size: { select: { id: true, sizeName: true, sortOrder: true } },
        },
      },
      issuedTo: { select: { id: true, name: true } },
    },
    orderBy: { transferDate: 'desc' },
  });

  res.json({
    data: slips.map((slip) => ({
      id: slip.id,
      slipNumber: slip.slipNumber,
      workOrderId: slip.workOrderId,
      workOrderNumber: slip.workOrder?.workOrderNumber || '',
      styleCode: slip.workOrder?.styles?.styleCode || '',
      styleName: slip.workOrder?.styles?.styleName || '',
      totalGoodPieces: slip.totalGoodPieces,
      transferDate: slip.transferDate,
      issuedTo: slip.issuedTo?.name || null,
      skuBreakdown: slip.skuBreakdown.map((sku: any) => ({
        colorId: sku.colorId,
        colorName: sku.color?.colorName || '—',
        sizeId: sku.sizeId,
        sizeName: sku.size?.sizeName || '',
        sortOrder: sku.size?.sortOrder || 0,
        quantity: sku.quantity,
      })),
    })),
  });
};

// Get available stitching contractors (suppliers with STITCHING_CONTRACTOR category)
export const getAvailableManagers = async (req: Request, res: Response) => {
  const contractors = await prisma.suppliers.findMany({
    where: {
      isActive: true,
      supplierCategories: { has: 'STITCHING_CONTRACTOR' },
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
};

/**
 * @route POST /api/stitching/issues/:id/dispose-defects
 * @desc Record defect disposition (REWORK or SCRAP) for defective pieces
 */
export const disposeDefects = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('User not authenticated');

  // Validated by disposeDefectsSchema at the route (bug-hunt production-13)
  const { disposition, remarks } = req.body as {
    disposition: 'REWORK' | 'SCRAP';
    remarks?: string;
  };

  const issue = await prisma.stitching_issues.findUnique({
    where: { id },
    include: {
      dailyOutputs: {
        include: { skuOutputs: true },
      },
    },
  });
  if (!issue) throw new NotFoundError('Stitching issue', id);

  // Calculate total defects
  let totalDefects = 0;
  for (const output of issue.dailyOutputs) {
    for (const sku of output.skuOutputs) {
      totalDefects += sku.defectQty;
    }
  }

  if (totalDefects === 0) {
    throw new ValidationError('No defects to dispose');
  }

  // Update issue remarks with disposition record
  const dispositionNote = `[${new Date().toISOString().split('T')[0]}] ${totalDefects} defective pcs marked as ${disposition}. ${remarks || ''}`;
  const existingRemarks = issue.remarks || '';

  await prisma.stitching_issues.update({
    where: { id },
    data: {
      remarks: existingRemarks ? `${existingRemarks}\n${dispositionNote}` : dispositionNote,
    },
  });

  res.json({
    data: {
      disposition,
      totalDefects,
      message: `${totalDefects} defective pieces marked as ${disposition}`,
    },
  });
};
