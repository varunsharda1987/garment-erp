import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

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
 * Split a production run (work_order) into multiple child runs.
 *
 * Rules:
 * - Parent must not be COMPLETED, CANCELLED, or already SPLIT
 * - Sum of split quantities must equal parent totalQuantity
 * - Each child gets a new workOrderNumber: parent + "-A", "-B", etc.
 * - Parent status becomes SPLIT
 * - work_order_breakup entries proportionally distributed to children
 */
export async function splitProductionRun(
  parentId: string,
  splits: SplitInput[],
  userId: string
): Promise<SplitResult> {
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
      throw new Error(
        `Split quantities (${totalSplitQty}) must equal parent total (${parent.totalQuantity})`
      );
    }

    // 4. Generate child work order numbers
    const suffixes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (splits.length > 26) {
      throw new Error('Maximum 26 splits supported');
    }

    const children: SplitResult['children'] = [];

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const suffix = suffixes[i];
      const childNumber = `${parent.workOrderNumber}-${suffix}`;

      // Calculate proportional breakup for this child
      const ratio = split.quantity / parent.totalQuantity;

      const childId = randomUUID();

      // Create child work order
      await tx.work_orders.create({
        data: {
          id: childId,
          workOrderNumber: childNumber,
          orderId: parent.orderId,
          orderItemId: parent.orderItemId,
          styleId: parent.styleId,
          locationId: parent.locationId,
          plannedStartDate: parent.plannedStartDate,
          plannedEndDate: parent.plannedEndDate,
          totalQuantity: split.quantity,
          status: 'PENDING',
          priority: parent.priority,
          remarks: split.remarks || `Split from ${parent.workOrderNumber}`,
          createdById: userId,
          parentRunId: parent.id,
          fabricLotInfo: split.fabricLotInfo ? split.fabricLotInfo as any : undefined,
          splitReason: split.remarks,
        },
      });

      // Create proportional breakup entries for child
      for (const breakup of parent.work_order_breakup) {
        const childQty = Math.round(breakup.plannedQuantity * ratio);
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
