import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../config/database';

// ============================================
// TYPES
// ============================================

export interface SplitInput {
  quantity: number;
  fabricLotInfo?: Record<string, any>;
  remarks?: string;
}

export interface SplitResult {
  parent: {
    id: string;
    workOrderNumber: string;
    status: string;
    totalQuantity: number;
  };
  children: {
    id: string;
    workOrderNumber: string;
    totalQuantity: number;
    fabricLotInfo?: any;
  }[];
}

// ============================================
// SPLIT LOGIC
// ============================================

/**
 * Allocate each breakup row across the splits so that (a) every row's allocations sum exactly to the
 * row's plannedQuantity (largest-remainder method) and (b) every child's column sums exactly to its
 * split quantity (single-unit rebalancing between children within rows). The old independent
 * Math.round per child created phantom/lost pieces in the size grids (bug-hunt production-24).
 *
 * Returns matrix[rowIndex][childIndex] = allocated quantity.
 */
function allocateBreakupAcrossSplits(rowQuantities: number[], splitQuantities: number[]): number[][] {
  const totalQty = splitQuantities.reduce((a, b) => a + b, 0);

  // 1. Largest-remainder allocation per breakup row (row sums are exact)
  const matrix = rowQuantities.map((rowQty) => {
    const exact = splitQuantities.map((q) => (rowQty * q) / totalQty);
    const base = exact.map((e) => Math.floor(e));
    let remainder = rowQty - base.reduce((a, x) => a + x, 0);
    const byFraction = exact.map((e, i) => ({ frac: e - Math.floor(e), i })).sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < byFraction.length && remainder > 0; k++, remainder--) {
      base[byFraction[k].i] += 1;
    }
    return base;
  });

  // 2. Rebalance columns: move single units between children inside a row (row sums stay exact)
  //    until each child's total equals its requested split quantity.
  const colSum = (c: number) => matrix.reduce((a, row) => a + row[c], 0);
  let guard = 0;
  while (guard++ < 100000) {
    const over = splitQuantities.findIndex((q, c) => colSum(c) > q);
    if (over === -1) break;
    const under = splitQuantities.findIndex((q, c) => colSum(c) < q);
    if (under === -1) break;
    const row = matrix.findIndex((r) => r[over] > 0);
    if (row === -1) break;
    matrix[row][over] -= 1;
    matrix[row][under] += 1;
  }

  return matrix;
}

/**
 * Split a production run (work_order) into multiple child runs.
 *
 * Rules:
 * - Parent must not be COMPLETED, CANCELLED, or already SPLIT
 * - Sum of split quantities must equal parent totalQuantity
 * - Each child gets a new workOrderNumber: parent + "-A", "-B", etc.
 * - Parent status becomes SPLIT
 * - work_order_breakup entries proportionally distributed to children
 */
export async function splitProductionRun(parentId: string, splits: SplitInput[], userId: string): Promise<SplitResult> {
  if (!splits || splits.length < 2) {
    throw new Error('At least 2 splits are required');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Fetch parent with breakup
    const parent = await tx.work_orders.findUnique({
      where: { id: parentId },
      include: {
        work_order_breakup: true,
      },
    });

    if (!parent) {
      throw new Error('Production run not found');
    }

    // 2. Validate parent status
    const invalidStatuses = ['COMPLETED', 'CANCELLED', 'SPLIT'];
    if (invalidStatuses.includes(parent.status)) {
      throw new Error(`Cannot split a production run with status: ${parent.status}`);
    }

    // 3. Validate quantities
    const totalSplitQty = splits.reduce((sum, s) => sum + s.quantity, 0);
    if (totalSplitQty !== parent.totalQuantity) {
      throw new Error(`Split quantities (${totalSplitQty}) must equal parent total (${parent.totalQuantity})`);
    }

    // 4. Generate child work order numbers
    const suffixes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (splits.length > 26) {
      throw new Error('Maximum 26 splits supported');
    }

    // Pre-compute the exact per-row/per-child allocation (bug-hunt production-24)
    const breakupAllocations = allocateBreakupAcrossSplits(
      parent.work_order_breakup.map((b) => b.plannedQuantity),
      splits.map((s) => s.quantity)
    );

    const children: SplitResult['children'] = [];

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const suffix = suffixes[i];
      const childNumber = `${parent.workOrderNumber}-${suffix}`;

      const childId = randomUUID();

      // Create child work order
      await tx.work_orders.create({
        data: {
          id: childId,
          workOrderNumber: childNumber,
          orderId: parent.orderId,
          orderItemId: parent.orderItemId,
          styleId: parent.styleId,
          warehouseId: parent.warehouseId,
          plannedStartDate: parent.plannedStartDate,
          plannedEndDate: parent.plannedEndDate,
          totalQuantity: split.quantity,
          status: 'PENDING',
          priority: parent.priority,
          remarks: split.remarks || `Split from ${parent.workOrderNumber}`,
          createdById: userId,
          parentRunId: parent.id,
          fabricLotInfo: split.fabricLotInfo ? (split.fabricLotInfo as any) : undefined,
          splitReason: split.remarks,
        },
      });

      // Create allocated breakup entries for child (exact — no independent rounding)
      let childBreakupSum = 0;
      for (let r = 0; r < parent.work_order_breakup.length; r++) {
        const breakup = parent.work_order_breakup[r];
        const childQty = breakupAllocations[r][i];
        childBreakupSum += childQty;
        if (childQty > 0) {
          await tx.work_order_breakup.create({
            data: {
              id: randomUUID(),
              workOrderId: childId,
              colorId: breakup.colorId,
              sizeId: breakup.sizeId,
              plannedQuantity: childQty,
            },
          });
        }
      }

      // Safety assertion (bug-hunt production-24): a mismatch means the parent's breakup rows do not
      // sum to its totalQuantity (header/breakup drift) — abort rather than persist a bad size grid.
      if (childBreakupSum !== split.quantity) {
        throw new Error(
          `Split allocation mismatch for ${childNumber}: breakup sums to ${childBreakupSum} but split quantity is ${split.quantity}. ` +
            `Parent breakup rows likely do not sum to its total quantity (${parent.totalQuantity}).`
        );
      }

      children.push({
        id: childId,
        workOrderNumber: childNumber,
        totalQuantity: split.quantity,
        fabricLotInfo: split.fabricLotInfo,
      });
    }

    // 5. Update parent status to SPLIT
    await tx.work_orders.update({
      where: { id: parentId },
      data: {
        status: 'SPLIT',
        splitReason: `Split into ${splits.length} runs`,
      },
    });

    return {
      parent: {
        id: parent.id,
        workOrderNumber: parent.workOrderNumber,
        status: 'SPLIT',
        totalQuantity: parent.totalQuantity,
      },
      children,
    };
  });
}

/**
 * Get all child runs for a parent production run
 */
export async function getChildRuns(parentId: string) {
  return prisma.work_orders.findMany({
    where: { parentRunId: parentId },
    include: {
      work_order_breakup: true,
    },
    orderBy: { workOrderNumber: 'asc' },
  });
}
