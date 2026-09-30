import { Request, Response } from 'express';
import logger from '../utils/logger';
import { NotFoundError, ValidationError, BusinessError, UnauthorizedError } from '../errors';
import prisma from '../config/database';
import { Prisma, StitchingIssueStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { dedupeSkuRows, generateTransferSlipNumber } from './cutting.utils';
import { nextSeededSequence } from '../utils/seeded-sequence';
import { applySearch } from '../utils/search-filter';
import { toDateInputValue } from '../utils/date';
import { skuKey } from '../services/helpers/sku-colour.helper';
import { USER_NAME_SELECT, userName } from '../types/prisma.types';
import {
  CUTTING_TO_STITCHING,
  OPEN_CUTTING_SLIP_STATUSES,
  SLIP_TAKINGS_INCLUDE,
  issueSlipTakings,
  returnToSlips,
  slipSkuBalances,
  takeFromSlips,
  waitingBySize,
} from '../services/helpers/stitching-slip-balance.helper';

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
  dailyOutputs: (issue.dailyOutputs || []).map((output: any) => ({ ...output, createdBy: userName(output.createdBy) })),
});

const generateIssueNumber = async (workOrderNumber: string): Promise<string> => {
  const prefix = `SI-${workOrderNumber}`;

  // Race-safe sequence, seeded from the historical max so a deleted issue never
  // causes its number to be reused (bug-hunt production-17)
  const seq = await nextSeededSequence(prefix, async () => {
    const rows = await prisma.$queryRaw<Array<{ max: number | null }>>(
      Prisma.sql`
        SELECT MAX((regexp_match("issueNumber", '-([0-9]+)$'))[1]::int) AS max
        FROM stitching_issues
        WHERE "issueNumber" LIKE ${prefix} || '-%'
      `
    );
    return Number(rows[0]?.max ?? 0);
  });

  return `${prefix}-${seq.toString().padStart(3, '0')}`;
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
  manager: USER_NAME_SELECT,
  contractor: {
    select: { id: true, code: true, name: true, contactPerson: true, phone: true },
  },
  createdBy: USER_NAME_SELECT,
  skuBreakdown: {
    include: {
      color: true,
      size: true,
    },
    orderBy: { size: { sortOrder: 'asc' as const } },
  },
  components: {
    include: {
      component: true,
    },
  },
  dailyOutputs: {
    include: {
      createdBy: USER_NAME_SELECT,
      skuOutputs: {
        include: {
          color: true,
          size: true,
        },
        orderBy: { size: { sortOrder: 'asc' as const } },
      },
    },
    orderBy: [{ outputDate: 'asc' as const }, { createdAt: 'asc' as const }],
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
    applySearch(where, String(search), [
      'issueNumber',
      'workOrder.workOrderNumber',
      'workOrder.styles.styleCode',
      'workOrder.styles.buyerStyleRef',
      'workOrder.styles.styleName',
      // The Contractor column shows the contractor, else the manager
      'contractor.name',
      'contractor.code',
      'manager.firstName',
      'manager.lastName',
    ]);
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

  // Each row's slip to finishing, so the list offers "Issue to Finishing" only while there is none
  // (it offered it on every Completed row and the click then failed "already exists")
  const slips = issues.length
    ? await prisma.transfer_slips.findMany({
        where: { stitchingIssueId: { in: issues.map((i) => i.id) } },
        select: { id: true, slipNumber: true, status: true, stitchingIssueId: true },
      })
    : [];
  const slipByIssue = new Map(slips.map(({ stitchingIssueId, ...slip }) => [stitchingIssueId, slip]));

  res.json({
    data: issues.map((issue) => ({
      ...transformStitchingIssue(issue),
      transferSlip: slipByIssue.get(issue.id) ?? null,
    })),
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

  // Create the issue and take its pieces from the selected slips in ONE transaction. A slip keeps
  // what the issue did not take (stitching-slip-balance.helper): until 2026-09-30 every selected slip
  // was marked RECEIVED however few pieces were issued, and the rest were lost. The helper also
  // refuses a slip of another run and more than a slip has left (bug-hunt production-23).
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

    if (transferSlipIds?.length) {
      await takeFromSlips(tx, {
        stitchingIssueId: created.id,
        workOrderId,
        slipIds: transferSlipIds,
        skuRows,
      });
    }

    return created;
  });

  // P6.2.2: Auto-create production_tracking: IN_STITCHING with 0 (stage started, not yet produced)
  // Actual output is tracked when recordDailyOutput is called
  try {
    await prisma.production_tracking.create({
      data: {
        id: randomUUID(),
        workOrderId,
        productionStage: 'IN_STITCHING',
        quantityCompleted: 0,
        updatedById: userId,
        updateDate: new Date(),
        remarks: `Stitching issue ${issue.issueNumber} started`,
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

  // Its pieces go back to the cutting slips they came from — deleting used to leave those slips
  // RECEIVED, so the pieces could never be issued again
  await prisma.$transaction(async (tx) => {
    await returnToSlips(tx, id);
    const removed = await tx.stitching_issues.deleteMany({ where: { id, status: 'PENDING_RECEIPT' } });
    if (removed.count !== 1) throw new ValidationError('Can only delete pending issues');
  });

  res.json({ message: 'Stitching issue deleted successfully' });
};

// ============================================
// Workflow Actions
// ============================================

// Receive from cutting
export const receiveFromCutting = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { transferSlipId, skuReceived, remarks } = req.body as {
    transferSlipId?: string;
    skuReceived?: Array<{ colorId?: string | null; sizeId: string; receivedQty: number }>;
    remarks?: string;
  };
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

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

  // The receipt is recorded against the slips this issue actually drew from, expecting what it took
  // from each (stitching-slip-balance.helper). It never touches a slip's status: that says whether
  // the slip still has pieces to issue. It used to re-mark the named slip RECEIVED and compare the
  // count with the WHOLE slip — wrong the moment a slip is shared between issues.
  await prisma.$transaction(async (tx) => {
    const flipped = await tx.stitching_issues.updateMany({
      where: { id, status: 'PENDING_RECEIPT' },
      data: { status: 'RECEIVED' },
    });
    if (flipped.count !== 1) throw new ValidationError('Can only receive for pending issues');

    const takings = await issueSlipTakings(tx, id);
    if (transferSlipId && !takings.some((t) => t.transferSlipId === transferSlipId)) {
      throw new ValidationError('That transfer slip is not one this stitching issue was made from');
    }
    if (takings.length === 0) return;

    // What the page counted, per colour + size; omitted = received exactly what was issued (the
    // list's quick Receive). Spread over the issue's slips oldest first; any excess lands on the last.
    const counted = new Map<string, number>();
    for (const r of skuReceived ?? []) {
      const key = skuKey(r.colorId ?? null, r.sizeId);
      counted.set(key, (counted.get(key) || 0) + Number(r.receivedQty || 0));
    }
    const rowsBySlip = takings.map((t) =>
      t.skus.map((sku) => {
        const key = skuKey(sku.colorId, sku.sizeId);
        let receivedQty = sku.quantity;
        if (skuReceived?.length) {
          const left = counted.get(key) || 0;
          receivedQty = Math.min(left, sku.quantity);
          counted.set(key, left - receivedQty);
        }
        return { colorId: sku.colorId, sizeId: sku.sizeId, expectedQty: sku.quantity, receivedQty };
      })
    );
    for (const [key, extra] of counted) {
      if (extra <= 0) continue; // allow-exact-qty: whole pieces
      const [colourPart, sizeId] = key.split('|');
      const colorId = colourPart || null;
      let target: { receivedQty: number } | undefined;
      for (const rows of rowsBySlip) {
        target = rows.find((r) => skuKey(r.colorId, r.sizeId) === key) ?? target;
      }
      if (target) target.receivedQty += extra;
      else rowsBySlip[rowsBySlip.length - 1].push({ colorId, sizeId, expectedQty: 0, receivedQty: extra });
    }

    for (let i = 0; i < takings.length; i++) {
      const rows = rowsBySlip[i];
      const expected = rows.reduce((sum, r) => sum + r.expectedQty, 0);
      const received = rows.reduce((sum, r) => sum + r.receivedQty, 0);
      const hasDeviation = rows.some((r) => r.receivedQty !== r.expectedQty);
      await tx.stage_receipts.create({
        data: {
          workOrderId: existing.workOrderId,
          stage: 'STITCHING',
          transferSlipId: takings[i].transferSlipId,
          receivedDate: new Date(),
          receivedById: userId,
          hasDeviation,
          deviationReason: hasDeviation
            ? `Received ${received} of the ${expected} pieces this issue took from slip ${takings[i].slipNumber}`
            : null,
          remarks,
          skuReceipts: {
            // Blank-colour (size-only) rows are recorded too — colour is optional (sku-colour.helper)
            create: rows.map((r) => ({ ...r, deviation: r.receivedQty - r.expectedQty })),
          },
        },
      });
    }
  });

  const issue = await prisma.stitching_issues.findUniqueOrThrow({ where: { id }, include: issueIncludeOptions });
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
  const { outputDate, componentId, skuOutputs, remarks } = req.body as {
    outputDate: Date;
    componentId?: string;
    skuOutputs: Array<{
      colorId?: string | null;
      sizeId: string;
      goodQty: number;
      defectQty?: number;
      rejectedQty?: number;
    }>;
    remarks?: string;
  };

  // One row per colour + size (two rows for one size would collide on the output unique index)
  const rows = dedupeSkuRows(
    skuOutputs.map((sku) => {
      const defectQty = sku.defectQty ?? sku.rejectedQty;
      if (defectQty === undefined || defectQty === null) {
        throw new ValidationError(
          `Defect quantity is required for each size (color: ${sku.colorId ?? '—'}, size: ${sku.sizeId}). Enter 0 if no defects.`
        );
      }
      return { colorId: sku.colorId ?? null, sizeId: sku.sizeId, goodQty: Number(sku.goodQty) || 0, defectQty };
    }),
    ['goodQty', 'defectQty']
  );
  const newTotal = rows.reduce((sum, r) => sum + r.goodQty + r.defectQty, 0);

  // Each size is capped at what was issued for it, less what is already recorded (good + defect).
  // The cap used to be the issue total only, so one size could be over-recorded while another was
  // under; the check and the insert share a transaction with the issue row locked.
  const { dailyOutput, workOrderId, goodPieces } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM stitching_issues WHERE id = ${id} FOR UPDATE`;
    const issue = await tx.stitching_issues.findUnique({
      where: { id },
      select: {
        status: true,
        workOrderId: true,
        skuBreakdown: {
          select: {
            colorId: true,
            sizeId: true,
            issuedQty: true,
            size: { select: { sizeName: true } },
            color: { select: { colorName: true } },
          },
        },
      },
    });
    if (!issue) throw new NotFoundError('Stitching issue', id);
    if (issue.status !== 'IN_PROGRESS') {
      throw new ValidationError('Can only record output for in-progress issues');
    }

    const recorded = await tx.stitching_output_skus.groupBy({
      by: ['colorId', 'sizeId'],
      where: { dailyOutput: { stitchingIssueId: id } },
      _sum: { goodQty: true, defectQty: true },
    });
    const recordedByKey = new Map(
      recorded.map((r) => [skuKey(r.colorId, r.sizeId), (r._sum.goodQty ?? 0) + (r._sum.defectQty ?? 0)])
    );
    const issuedByKey = new Map(issue.skuBreakdown.map((sku) => [skuKey(sku.colorId, sku.sizeId), sku]));

    const problems: string[] = [];
    for (const row of rows) {
      const sku = issuedByKey.get(skuKey(row.colorId, row.sizeId));
      if (!sku) {
        problems.push(`size ${row.sizeId} is not on this issue`);
        continue;
      }
      const label = [sku.color?.colorName, sku.size.sizeName].filter(Boolean).join(' / ');
      const already = recordedByKey.get(skuKey(row.colorId, row.sizeId)) || 0;
      const left = Math.max(0, sku.issuedQty - already);
      if (row.goodQty + row.defectQty > left) {
        problems.push(`${label}: ${row.goodQty + row.defectQty} entered, only ${left} of ${sku.issuedQty} left`);
      }
    }
    if (problems.length) {
      throw new ValidationError(`Cannot record this output — ${problems.join('; ')}`);
    }

    const created = await tx.stitching_daily_outputs.create({
      data: {
        stitchingIssueId: id,
        componentId,
        outputDate: new Date(outputDate),
        remarks,
        createdById: userId,
        skuOutputs: { create: rows },
      },
      include: {
        createdBy: USER_NAME_SELECT,
        skuOutputs: {
          include: {
            color: true,
            size: true,
          },
        },
      },
    });
    const goodBefore = recorded.reduce((sum, r) => sum + (r._sum.goodQty ?? 0), 0);
    return {
      dailyOutput: created,
      workOrderId: issue.workOrderId,
      goodPieces: goodBefore + rows.reduce((sum, r) => sum + r.goodQty, 0),
    };
  });

  // P6.2.2: production_tracking gets the issue's cumulative GOOD pieces (defects excluded)
  try {
    await prisma.production_tracking.create({
      data: {
        id: randomUUID(),
        workOrderId,
        productionStage: 'IN_STITCHING',
        quantityCompleted: goodPieces,
        updatedById: userId,
        updateDate: new Date(),
        remarks: `Daily output recorded: ${newTotal} pieces`,
      },
    });
  } catch (trackingError) {
    // allow-swallow — tracking update is advisory; daily output must succeed
    logger.error('Failed to update production_tracking for stitching output:', trackingError);
  }

  res.json({ data: { ...dailyOutput, createdBy: userName(dailyOutput.createdBy) } });
};

// Complete stitching issue
export const completeStitchingIssue = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { shortReason } = (req.body ?? {}) as { shortReason?: string };

  const existing = await prisma.stitching_issues.findUnique({
    where: { id },
    select: { status: true, remarks: true, skuBreakdown: { select: { issuedQty: true } } },
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
    _sum: { goodQty: true, defectQty: true },
  });
  const good = outputTotals._sum.goodQty ?? 0;
  const defect = outputTotals._sum.defectQty ?? 0;
  if (good <= 0) {
    throw new ValidationError('Cannot complete: no output recorded. Record daily output first.');
  }

  // Completing short used to drop the unrecorded pieces without a trace: the slip to finishing
  // carries only recorded good pieces. Now it needs a reason, kept on the issue's remarks.
  const issued = existing.skuBreakdown.reduce((sum, sku) => sum + sku.issuedQty, 0);
  const unrecorded = Math.max(0, issued - good - defect);
  const reason = shortReason?.trim();
  if (unrecorded > 0 && !reason) {
    throw new ValidationError(
      `Only ${good + defect} of ${issued} pieces are recorded (${good} good, ${defect} defect) — ${unrecorded} not recorded. Give a reason to complete short.`,
      { code: 'STITCHING_SHORT', issued, good, defect, unrecorded }
    );
  }
  const shortNote =
    unrecorded > 0
      ? `[${toDateInputValue(new Date())}] Completed short: ${unrecorded} of ${issued} pcs not recorded — ${reason}`
      : null;

  const flipped = await prisma.stitching_issues.updateMany({
    where: { id, status: 'IN_PROGRESS' },
    data: {
      status: 'COMPLETED',
      endDate: new Date(),
      ...(shortNote ? { remarks: existing.remarks ? `${existing.remarks}\n${shortNote}` : shortNote } : {}),
    },
  });
  if (flipped.count !== 1) {
    throw new ValidationError('Can only complete in-progress issues');
  }

  const issue = await prisma.stitching_issues.findUniqueOrThrow({ where: { id }, include: issueIncludeOptions });
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

  // Calculate good pieces per SKU from daily outputs
  const skuGoodQtyMap = new Map<string, { colorId: string | null; sizeId: string; goodQty: number }>();
  for (const output of issue.dailyOutputs) {
    for (const skuOutput of output.skuOutputs) {
      const key = skuKey(skuOutput.colorId, skuOutput.sizeId);
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

  // Generate slip number — race-safe seeded sequence (bug-hunt production-17). Taken only once the
  // issue is known to have no slip, so a refused click no longer burns a number.
  const today = new Date();
  const slipNumber = await generateTransferSlipNumber();

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

// Size-wise status of every run in stitching: what waits on cutting slips, what is with a contractor,
// what is stitched. Built from the records (slip takings, issued quantities, recorded output) — it
// used to be built from issue status, so "Completed" was the issued count of completed issues, "In
// Progress" the full issued count whatever was recorded, and pieces cut but not yet issued never
// showed (WO2609-0088 read "Pending 0" with 1,680 pcs waiting).
export const getStyleSizeSummary = async (req: Request, res: Response) => {
  const [issues, waiting] = await Promise.all([
    prisma.stitching_issues.findMany({
      where: { isActive: true },
      include: {
        skuBreakdown: { select: { sizeId: true, issuedQty: true } },
        dailyOutputs: { select: { skuOutputs: { select: { sizeId: true, goodQty: true, defectQty: true } } } },
      },
    }),
    waitingBySize(prisma),
  ]);

  const workOrderIds = [...new Set([...issues.map((i) => i.workOrderId), ...waiting.keys()])];
  const [workOrders, finishingSlips, cuttingBatches] = await Promise.all([
    prisma.work_orders.findMany({
      where: { id: { in: workOrderIds } },
      select: {
        id: true,
        workOrderNumber: true,
        styles: { select: { styleCode: true, buyerStyleRef: true, styleName: true } },
        orders: { select: { orderNumber: true, customers: { select: { name: true } } } },
      },
    }),
    prisma.transfer_slips.findMany({
      where: { stitchingIssueId: { in: issues.map((i) => i.id) }, isActive: true },
      select: { stitchingIssueId: true },
    }),
    prisma.cutting_batches.findMany({
      where: { workOrderId: { in: workOrderIds }, isActive: true },
      select: { workOrderId: true, cuttingDate: true, status: true, updatedAt: true },
    }),
  ]);
  const pushed = new Set(finishingSlips.map((s) => s.stitchingIssueId));

  type SizeRow = {
    sizeId: string;
    waiting: number;
    issued: number;
    withContractor: number;
    stitched: number;
    defects: number;
  };
  const bySize = new Map<string, Map<string, SizeRow>>();
  const sizeRow = (workOrderId: string, sizeId: string): SizeRow => {
    if (!bySize.has(workOrderId)) bySize.set(workOrderId, new Map());
    const sizes = bySize.get(workOrderId)!;
    if (!sizes.has(sizeId)) {
      sizes.set(sizeId, { sizeId, waiting: 0, issued: 0, withContractor: 0, stitched: 0, defects: 0 });
    }
    return sizes.get(sizeId)!;
  };

  for (const [workOrderId, sizes] of waiting) {
    for (const w of sizes.values()) sizeRow(workOrderId, w.sizeId).waiting += w.waiting;
  }
  for (const issue of issues) {
    const recordedBySize = new Map<string, number>();
    for (const output of issue.dailyOutputs) {
      for (const sku of output.skuOutputs) {
        const row = sizeRow(issue.workOrderId, sku.sizeId);
        row.stitched += sku.goodQty;
        row.defects += sku.defectQty;
        recordedBySize.set(sku.sizeId, (recordedBySize.get(sku.sizeId) || 0) + sku.goodQty + sku.defectQty);
      }
    }
    for (const sku of issue.skuBreakdown) {
      const row = sizeRow(issue.workOrderId, sku.sizeId);
      row.issued += sku.issuedQty;
      // A completed issue has nothing left with its contractor (a short completion carries a reason)
      if (issue.status !== 'COMPLETED') {
        const recorded = recordedBySize.get(sku.sizeId) || 0;
        row.withContractor += Math.max(0, sku.issuedQty - recorded);
        recordedBySize.set(sku.sizeId, Math.max(0, recorded - sku.issuedQty));
      }
    }
  }

  const allSizeIds = [...new Set([...bySize.values()].flatMap((m) => [...m.keys()]))];
  const sizeInfo = new Map(
    (
      await prisma.size_options.findMany({
        where: { id: { in: allSizeIds } },
        select: { id: true, sizeName: true, sortOrder: true },
      })
    ).map((s) => [s.id, s])
  );

  const DAY_MS = 86400000;
  const now = Date.now();
  const data = workOrders
    .map((wo) => {
      const woIssues = issues.filter((i) => i.workOrderId === wo.id);
      const sizes = [...(bySize.get(wo.id)?.values() ?? [])]
        .map((s) => ({
          ...s,
          sizeName: sizeInfo.get(s.sizeId)?.sizeName || '',
          sortOrder: sizeInfo.get(s.sizeId)?.sortOrder || 0,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const sum = (field: keyof SizeRow) => sizes.reduce((total, s) => total + (s[field] as number), 0);

      // Days in stitching: from the first issue, to the last completion once all are completed
      let daysInStitching = 0;
      if (woIssues.length > 0) {
        const start = Math.min(...woIssues.map((i) => new Date(i.issueDate).getTime()));
        const allCompleted = woIssues.every((i) => i.status === 'COMPLETED');
        const ends = woIssues.filter((i) => i.endDate).map((i) => new Date(i.endDate!).getTime());
        const end = allCompleted && ends.length ? Math.max(...ends) : now;
        daysInStitching = Math.max(1, Math.ceil((end - start) / DAY_MS));
      }

      // Days in cutting
      const woBatches = cuttingBatches.filter((b) => b.workOrderId === wo.id);
      let daysInCutting = 0;
      if (woBatches.length > 0) {
        const start = Math.min(...woBatches.map((b) => new Date(b.cuttingDate).getTime()));
        const allCut = woBatches.every((b) => b.status === 'COMPLETED');
        const end = allCut ? Math.max(...woBatches.map((b) => new Date(b.updatedAt).getTime())) : now;
        daysInCutting = Math.max(1, Math.ceil((end - start) / DAY_MS));
      }

      // Idle: completed issues not yet sent to finishing, counted from the oldest such completion
      const idleEnds = woIssues
        .filter((i) => i.status === 'COMPLETED' && i.endDate && !pushed.has(i.id))
        .map((i) => new Date(i.endDate!).getTime());
      const daysPendingPush = idleEnds.length ? Math.max(0, Math.ceil((now - Math.min(...idleEnds)) / DAY_MS)) : null;

      return {
        workOrderId: wo.id,
        workOrderNumber: wo.workOrderNumber,
        styleCode: wo.styles?.styleCode || '',
        buyerStyleRef: wo.styles?.buyerStyleRef ?? null,
        styleName: wo.styles?.styleName || '',
        customerName: wo.orders?.customers?.name || '',
        orderNumber: wo.orders?.orderNumber || '',
        daysInCutting,
        daysInStitching,
        daysPendingPush,
        sizes,
        totalWaiting: sum('waiting'),
        totalIssued: sum('issued'),
        totalWithContractor: sum('withContractor'),
        totalStitched: sum('stitched'),
        totalDefects: sum('defects'),
        // Done with stitching: nothing waiting, every issue completed and sent on to finishing
        done:
          sum('waiting') === 0 && // allow-exact-qty: whole pieces
          woIssues.length > 0 &&
          woIssues.every((i) => i.status === 'COMPLETED' && pushed.has(i.id)),
      };
    })
    .filter((wo) => !wo.done)
    .map(({ done: _done, ...wo }) => wo)
    .sort((a, b) => a.workOrderNumber.localeCompare(b.workOrderNumber));

  res.json({ data });
};

// Cutting slips with pieces still to issue to stitching — each showing what is LEFT on it
// (`quantity`, `totalGoodPieces`) next to what cutting sent (`sentQty`, `sentPieces`)
export const getAvailableTransferSlips = async (req: Request, res: Response) => {
  const slips = await prisma.transfer_slips.findMany({
    where: { ...CUTTING_TO_STITCHING, status: { in: OPEN_CUTTING_SLIP_STATUSES } },
    include: {
      workOrder: {
        include: {
          styles: { select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true } },
        },
      },
      skuBreakdown: {
        include: {
          color: { select: { id: true, colorName: true, colorCode: true } },
          size: { select: { id: true, sizeName: true, sortOrder: true } },
        },
      },
      issuedTo: { select: { id: true, name: true } },
      ...SLIP_TAKINGS_INCLUDE,
    },
    orderBy: { transferDate: 'desc' },
  });

  const data = slips
    .map((slip) => {
      const balances = new Map(slipSkuBalances(slip).map((b) => [skuKey(b.colorId, b.sizeId), b]));
      const skuBreakdown = slip.skuBreakdown
        .map((sku) => {
          const balance = balances.get(skuKey(sku.colorId, sku.sizeId));
          return {
            colorId: sku.colorId,
            colorName: sku.color?.colorName || '—',
            sizeId: sku.sizeId,
            sizeName: sku.size?.sizeName || '',
            sortOrder: sku.size?.sortOrder || 0,
            quantity: balance?.remaining ?? sku.quantity,
            sentQty: sku.quantity,
          };
        })
        .filter((sku) => sku.quantity > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return {
        id: slip.id,
        slipNumber: slip.slipNumber,
        workOrderId: slip.workOrderId,
        workOrderNumber: slip.workOrder?.workOrderNumber || '',
        styleCode: slip.workOrder?.styles?.styleCode || '',
        buyerStyleRef: slip.workOrder?.styles?.buyerStyleRef ?? null,
        styleName: slip.workOrder?.styles?.styleName || '',
        totalGoodPieces: skuBreakdown.reduce((sum, sku) => sum + sku.quantity, 0),
        sentPieces: slip.skuBreakdown.reduce((sum, sku) => sum + sku.quantity, 0),
        transferDate: slip.transferDate,
        issuedTo: slip.issuedTo?.name || null,
        skuBreakdown,
      };
    })
    .filter((slip) => slip.totalGoodPieces > 0);

  res.json({ data });
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
  const dispositionNote = `[${toDateInputValue(new Date())}] ${totalDefects} defective pcs marked as ${disposition}. ${remarks || ''}`;
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
