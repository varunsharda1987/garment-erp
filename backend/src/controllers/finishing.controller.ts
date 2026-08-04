import { Request, Response } from 'express';
import logger from '../utils/logger';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';
import { dedupeSkuRows } from './cutting.utils';
import workOrderService from '../services/workOrder.service';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';

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
              buyerStyleRef: issue.workOrder.styles.buyerStyleRef ?? null,
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
 * Lazily seed the atomic sequence for a per-scope compound prefix (e.g. `FI-WO2607-0001`,
 * `TS-20260726`). Static seeding (scripts/seed-code-sequences.ts) is impossible for prefixes
 * that embed a work-order/date scope, so before first use in a scope: if code_sequences has no
 * row for the prefix but rows already exist in the target table, initialize the sequence with
 * their max numeric suffix (idempotent GREATEST upsert, mirroring the seed script).
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

/** True when err is a Prisma P2002 unique violation whose target involves the given column. */
const isUniqueViolationOn = (err: unknown, column: string): boolean => {
  const e = err as { code?: string; meta?: { target?: unknown } } | null;
  if (!e || e.code !== 'P2002') return false;
  const target = e.meta?.target;
  const text = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return text.includes(column);
};

// Atomic per-work-order sequence; visible format preserved: FI-{workOrderNumber}-NNN
const generateIssueNumber = async (workOrderNumber: string): Promise<string> => {
  const prefix = `FI-${workOrderNumber}`;
  await seedScopedSequenceIfMissing(prefix, async () => {
    const rows = await prisma.finishing_issues.findMany({
      where: { issueNumber: { startsWith: `${prefix}-` } },
      select: { issueNumber: true },
    });
    return maxNumericSuffix(
      rows.map((r) => r.issueNumber),
      prefix
    );
  });
  return generateAtomicMasterCode(prefix, 3);
};

/**
 * Next transfer-slip number from the atomic per-day sequence; visible format preserved:
 * TS-YYYYMMDD-NNNN. cutting-issue.controller.ts writes the same transfer_slips.slipNumber
 * series and MUST use this same `TS-<date>` sequence key so the series can't collide.
 */
const generateTransferSlipNumber = async (date: Date): Promise<string> => {
  const prefix = `TS-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  await seedScopedSequenceIfMissing(prefix, async () => {
    const rows = await prisma.transfer_slips.findMany({
      where: { slipNumber: { startsWith: `${prefix}-` } },
      select: { slipNumber: true },
    });
    return maxNumericSuffix(
      rows.map((r) => r.slipNumber),
      prefix
    );
  });
  return generateAtomicMasterCode(prefix, 4);
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
      { workOrder: { styles: { buyerStyleRef: { contains: String(search), mode: 'insensitive' } } } },
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
    throw new UnauthorizedError('User not authenticated');
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
        // Deduped by (colorId, sizeId) — NULL-color duplicates double-count totals (bug-hunt production-18)
        create: dedupeSkuRows(
          // as any[]: bare `any` receiver collapses the generic to its constraint (loses qty fields)
          ((skuBreakdown || []) as any[]).map((sku: any) => {
            const availableQty = sku.availableQty ?? sku.issuedQty;
            if (availableQty === undefined || availableQty === null) {
              throw new ValidationError(
                `Available quantity is required for SKU (color: ${sku.colorId}, size: ${sku.sizeId}). Must come from stitching output.`
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
        ),
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
    // allow-swallow — pure timeline production_tracking entry; must not fail the already-created finishing issue
    logger.error('Failed to create production_tracking for finishing:', err);
  }

  res.status(201).json({ data: transformFinishingIssue(issue), message: 'Finishing issue created successfully' });
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
  const { transferSlipId, receivedQty, remarks } = req.body;
  const userId = req.user?.userId;

  const existing = await prisma.finishing_issues.findUnique({
    where: { id },
    select: { status: true, workOrderId: true },
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

  // Update transfer slip status and persist the received quantity as a stage receipt — the
  // schema-required receivedQty used to be silently discarded, making short receipts
  // indistinguishable from full ones (bug-hunt production-14).
  if (transferSlipId) {
    const slip = await prisma.transfer_slips.update({
      where: { id: transferSlipId },
      data: { status: 'RECEIVED', receivedDate: new Date(), receivedById: userId ?? undefined },
    });

    if (receivedQty != null && userId) {
      const hasDeviation = receivedQty !== slip.totalGoodPieces;
      await prisma.stage_receipts.create({
        data: {
          workOrderId: existing.workOrderId,
          stage: 'FINISHING',
          transferSlipId,
          receivedDate: new Date(),
          receivedById: userId,
          hasDeviation,
          deviationReason: hasDeviation
            ? `Received ${receivedQty} of ${slip.totalGoodPieces} pieces on slip ${slip.slipNumber}`
            : null,
          remarks,
        },
      });
    }
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
    throw new UnauthorizedError('User not authenticated');
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

  // Auto-create production_tracking: READY_TO_SHIP, and roll the WO's completedQuantity/status up
  // in the same transaction — this path previously inserted the tracking row without the rollup,
  // so finishing-driven completion never flipped the WO to COMPLETED (review nit, item F).
  // A rollup failure is surfaced as a response warning (pattern: cmtUpdateWarning in
  // workOrder.controller.ts) instead of being silently swallowed.
  let completionWarning: string | undefined;
  try {
    const userId = req.user?.userId;
    if (issue.workOrderId && userId) {
      const workOrderId = issue.workOrderId;
      const flippedToCompleted = await prisma.$transaction(async (tx) => {
        await tx.production_tracking.create({
          data: {
            id: randomUUID(),
            workOrderId,
            productionStage: 'READY_TO_SHIP',
            quantityCompleted:
              issue.skuBreakdown?.reduce((sum: number, sku: any) => sum + (Number(sku.issuedQty) || 0), 0) || 0,
            updatedById: userId,
            updateDate: new Date(),
          },
        });
        return workOrderService.recomputeWorkOrderCompletion(tx, workOrderId);
      });
      if (flippedToCompleted) {
        try {
          await workOrderService.updateActualCMTCosts(workOrderId);
        } catch (err) {
          logger.warn(`CMT actuals auto-update failed after finishing-driven completion of WO ${workOrderId}:`, err);
          completionWarning =
            'Finishing issue completed, but updating actual CMT costs failed — order item costing still reflects estimates. ' +
            (err instanceof Error ? err.message : '');
        }
      }
    }
  } catch (err) {
    logger.error('Failed to create production_tracking for finishing completion:', err);
    completionWarning =
      'Finishing issue completed, but the production-tracking entry / work-order completion rollup failed — the work order may not reflect this completion. ' +
      (err instanceof Error ? err.message : '');
  }

  res.json({
    data: transformFinishingIssue(issue),
    ...(completionWarning ? { warning: completionWarning } : {}),
  });
  // end completeFinishingIssue
};

// Generate transfer slip to dispatch
export const generateTransferSlip = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
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

  // Slip number comes from the atomic per-day TS sequence (generated per attempt, below)
  const today = new Date();

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

  // Get or create a default FG location (independent of the slip tx)
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

  // Slip creation + FG stock credit in ONE transaction with an existing-slip guard (bug-hunt
  // production-8/-9): the old code created the slip then did non-atomic read-modify-write FG updates
  // on the global client with NO duplicate check — a double-click created a second slip and counted
  // the same good pieces into finished-goods stock twice. The partial unique index on
  // finishingIssueId (migration 20260722150000) is the hard DB backstop.
  const attemptCreateSlip = (slipNumber: string) =>
    prisma.$transaction(async (tx) => {
      const existingSlip = await tx.transfer_slips.findFirst({
        where: { finishingIssueId: id },
        select: { id: true, slipNumber: true },
      });
      if (existingSlip) {
        throw new ValidationError(
          `A transfer slip (${existingSlip.slipNumber}) already exists for this finishing issue`
        );
      }

      const slip = await tx.transfer_slips.create({
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

      // Atomic upsert-with-increment per SKU (the FG unique on style+color+size+location makes this exact)
      for (const sku of skuBreakdownForSlip) {
        await tx.finished_goods_stock.upsert({
          where: {
            styleId_colorId_sizeId_locationId: {
              styleId: issue.workOrder.styleId,
              colorId: sku.colorId,
              sizeId: sku.sizeId,
              locationId: fgLocation.id,
            },
          },
          update: { quantity: { increment: sku.finishedQty }, lastUpdated: new Date() },
          create: {
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

      return slip;
    });

  let transferSlip;
  try {
    transferSlip = await (async () => {
      for (let attempt = 1; ; attempt++) {
        const slipNumber = await generateTransferSlipNumber(today);
        try {
          return await attemptCreateSlip(slipNumber);
        } catch (err) {
          // Only a slipNumber collision (pre-atomic row in today's scope) is retried with a fresh
          // number — the partial unique on finishingIssueId means a genuine duplicate slip and
          // falls through to the outer P2002 handling.
          if (isUniqueViolationOn(err, 'slipNumber') && attempt < 3) continue;
          throw err;
        }
      }
    })();
  } catch (err: any) {
    // P2002 = the partial unique index caught a concurrent duplicate (or a slip-number collision)
    if (err?.code === 'P2002') {
      throw new ValidationError(
        'A transfer slip already exists for this finishing issue (or slip number collided — retry)'
      );
    }
    throw err;
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
          styles: { select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true } },
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
      buyerStyleRef: (slip.workOrder as any)?.styles?.buyerStyleRef ?? null,
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
          styles: { select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true } },
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
      buyerStyleRef: string | null;
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
        buyerStyleRef: (issue.workOrder as any)?.styles?.buyerStyleRef ?? null,
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
      buyerStyleRef: wo.buyerStyleRef,
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
  if (!userId) throw new UnauthorizedError('User not authenticated');

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

  res.status(201).json({ data: entry, message: 'Polybag entry created successfully' });
};

/**
 * @route POST /api/finishing/issues/:id/carton-packing
 * @desc Record carton packing for a finishing issue
 */
export const createCartonPacking = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('User not authenticated');

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

  res.status(201).json({ data: carton, message: 'Carton packing created successfully' });
};
