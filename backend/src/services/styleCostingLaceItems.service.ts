/**
 * Style Costing Lace Items Service
 *
 * Manages lace items within a style cost sheet.
 * Handles CRUD operations and integration with the cost calculation service.
 */

import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { calculateLaceCost, LaceCostCalculationResult } from './laceCostingCalculation.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateLaceItemInput {
  costingId: string;
  laceId: string;
  laceName: string;
  colorName?: string;
  width?: number;
  quantityPerGarment: number;
  wastagePercent?: number;
  sourcingStrategy: 'STOCK_REUSE' | 'READY_LACE' | 'GREIGE_PROCESSED';
  // Cost fields - populated based on sourcing strategy
  greigeCost?: number;
  processingCost?: number;
  readyLaceCost?: number;
  stockCost?: number;
  costPerMeter: number;
  // Source references
  greigeLaceId?: string;
  processorId?: string;
  rateCardId?: string;
  stockLotId?: string;
  procurementId?: string;
  labDipId?: string;
  labDipStatus?: string;
  // Override
  isManualOverride?: boolean;
  overrideReason?: string;
  notes?: string;
}

export interface UpdateLaceItemInput extends Partial<Omit<CreateLaceItemInput, 'costingId'>> {}

/**
 * Add a lace item to a cost sheet
 */
export async function addLaceItemToCostSheet(input: CreateLaceItemInput): Promise<any> {
  // Verify cost sheet exists
  const costSheet = await prisma.style_costing.findUnique({
    where: { id: input.costingId },
  });

  if (!costSheet) {
    throw new Error(`Cost sheet not found: ${input.costingId}`);
  }

  // Calculate effective quantity with wastage - wastagePercent is required, no default
  if (input.wastagePercent === undefined || input.wastagePercent === null) {
    throw new Error('wastagePercent is required - no hardcoded defaults allowed');
  }
  const wastagePercent = input.wastagePercent;
  const effectiveQuantity = input.quantityPerGarment * (1 + wastagePercent / 100);
  const totalCost = effectiveQuantity * input.costPerMeter;

  // Create lace item and recompute the cost sheet lace total in the SAME transaction —
  // a failure between the two must not leave totals disagreeing with line items (bug-hunt costing-20)
  const laceItem = await prisma.$transaction(async (tx) => {
    const created = await tx.style_costing_lace_items.create({
      data: {
        costingId: input.costingId,
        laceId: input.laceId,
        laceName: input.laceName,
        colorName: input.colorName || null,
        width: input.width ? new Decimal(input.width) : null,
        quantityPerGarment: new Decimal(input.quantityPerGarment),
        wastagePercent: new Decimal(wastagePercent),
        effectiveQuantity: new Decimal(effectiveQuantity),
        sourcingStrategy: input.sourcingStrategy,
        greigeCost: input.greigeCost ? new Decimal(input.greigeCost) : null,
        processingCost: input.processingCost ? new Decimal(input.processingCost) : null,
        readyLaceCost: input.readyLaceCost ? new Decimal(input.readyLaceCost) : null,
        stockCost: input.stockCost ? new Decimal(input.stockCost) : null,
        costPerMeter: new Decimal(input.costPerMeter),
        totalCost: new Decimal(totalCost),
        greigeLaceId: input.greigeLaceId || null,
        processorId: input.processorId || null,
        rateCardId: input.rateCardId || null,
        stockLotId: input.stockLotId || null,
        procurementId: input.procurementId || null,
        labDipId: input.labDipId || null,
        labDipStatus:
          input.labDipStatus || (input.sourcingStrategy === 'GREIGE_PROCESSED' ? 'PENDING' : 'NOT_REQUIRED'),
        isManualOverride: input.isManualOverride || false,
        overrideReason: input.overrideReason || null,
        notes: input.notes || null,
      },
      include: {
        lace: {
          select: {
            id: true,
            laceName: true,
            laceCode: true,
            color: true,
            width: true,
          },
        },
        greigeLace: {
          select: {
            id: true,
            laceName: true,
            laceCode: true,
          },
        },
        processor: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Update cost sheet lace total
    await updateCostSheetLaceTotal(input.costingId, tx);

    return created;
  });

  return laceItem;
}

/**
 * Update a lace item in a cost sheet
 */
export async function updateLaceItem(itemId: string, input: UpdateLaceItemInput): Promise<any> {
  // Get existing item
  const existing = await prisma.style_costing_lace_items.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      costingId: true,
      quantityPerGarment: true,
      wastagePercent: true,
      costPerMeter: true,
    },
  });

  if (!existing) {
    throw new Error(`Lace item not found: ${itemId}`);
  }

  // Calculate new values
  const quantityPerGarment =
    input.quantityPerGarment !== undefined ? input.quantityPerGarment : Number(existing.quantityPerGarment);
  const wastagePercent = input.wastagePercent !== undefined ? input.wastagePercent : Number(existing.wastagePercent);
  const costPerMeter = input.costPerMeter !== undefined ? input.costPerMeter : Number(existing.costPerMeter);

  const effectiveQuantity = quantityPerGarment * (1 + wastagePercent / 100);
  const totalCost = effectiveQuantity * costPerMeter;

  // Build update data
  const updateData: any = {};

  if (input.laceId !== undefined) updateData.laceId = input.laceId;
  if (input.laceName !== undefined) updateData.laceName = input.laceName;
  if (input.colorName !== undefined) updateData.colorName = input.colorName;
  if (input.width !== undefined) updateData.width = new Decimal(input.width);
  if (input.quantityPerGarment !== undefined) updateData.quantityPerGarment = new Decimal(input.quantityPerGarment);
  if (input.wastagePercent !== undefined) updateData.wastagePercent = new Decimal(input.wastagePercent);
  if (input.sourcingStrategy !== undefined) updateData.sourcingStrategy = input.sourcingStrategy;
  if (input.greigeCost !== undefined) updateData.greigeCost = input.greigeCost ? new Decimal(input.greigeCost) : null;
  if (input.processingCost !== undefined)
    updateData.processingCost = input.processingCost ? new Decimal(input.processingCost) : null;
  if (input.readyLaceCost !== undefined)
    updateData.readyLaceCost = input.readyLaceCost ? new Decimal(input.readyLaceCost) : null;
  if (input.stockCost !== undefined) updateData.stockCost = input.stockCost ? new Decimal(input.stockCost) : null;
  if (input.costPerMeter !== undefined) updateData.costPerMeter = new Decimal(input.costPerMeter);
  if (input.greigeLaceId !== undefined) updateData.greigeLaceId = input.greigeLaceId || null;
  if (input.processorId !== undefined) updateData.processorId = input.processorId || null;
  if (input.rateCardId !== undefined) updateData.rateCardId = input.rateCardId || null;
  if (input.stockLotId !== undefined) updateData.stockLotId = input.stockLotId || null;
  if (input.procurementId !== undefined) updateData.procurementId = input.procurementId || null;
  if (input.labDipId !== undefined) updateData.labDipId = input.labDipId || null;
  if (input.labDipStatus !== undefined) updateData.labDipStatus = input.labDipStatus;
  if (input.isManualOverride !== undefined) updateData.isManualOverride = input.isManualOverride;
  if (input.overrideReason !== undefined) updateData.overrideReason = input.overrideReason;
  if (input.notes !== undefined) updateData.notes = input.notes;

  // Always update calculated fields
  updateData.effectiveQuantity = new Decimal(effectiveQuantity);
  updateData.totalCost = new Decimal(totalCost);

  // Update item and recompute the cost sheet lace total in the SAME transaction (bug-hunt costing-20)
  const laceItem = await prisma.$transaction(async (tx) => {
    const updated = await tx.style_costing_lace_items.update({
      where: { id: itemId },
      data: updateData,
      include: {
        lace: {
          select: {
            id: true,
            laceName: true,
            laceCode: true,
            color: true,
            width: true,
          },
        },
        greigeLace: {
          select: {
            id: true,
            laceName: true,
            laceCode: true,
          },
        },
        processor: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Update cost sheet lace total
    await updateCostSheetLaceTotal(existing.costingId, tx);

    return updated;
  });

  return laceItem;
}

/**
 * Remove a lace item from a cost sheet
 */
export async function removeLaceItem(itemId: string): Promise<void> {
  // Get item to find costingId
  const item = await prisma.style_costing_lace_items.findUnique({
    where: { id: itemId },
    select: { costingId: true },
  });

  if (!item) {
    throw new Error(`Lace item not found: ${itemId}`);
  }

  // Delete item and recompute the cost sheet lace total in the SAME transaction (bug-hunt costing-20)
  await prisma.$transaction(async (tx) => {
    await tx.style_costing_lace_items.delete({
      where: { id: itemId },
    });

    // Update cost sheet lace total
    await updateCostSheetLaceTotal(item.costingId, tx);
  });
}

/**
 * Get all lace items for a cost sheet
 */
export async function getLaceItemsForCostSheet(costingId: string): Promise<any[]> {
  const items = await prisma.style_costing_lace_items.findMany({
    where: { costingId },
    include: {
      lace: {
        select: {
          id: true,
          laceName: true,
          laceCode: true,
          color: true,
          width: true,
          laceType: true,
        },
      },
      greigeLace: {
        select: {
          id: true,
          laceName: true,
          laceCode: true,
          expectedShrinkagePercent: true,
          costPerMeterGreige: true,
        },
      },
      processor: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      labDip: {
        select: {
          id: true,
          labDipNumber: true,
          status: true,
          targetColor: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return items;
}

/**
 * Get a single lace item by ID
 */
export async function getLaceItemById(itemId: string): Promise<any> {
  const item = await prisma.style_costing_lace_items.findUnique({
    where: { id: itemId },
    include: {
      lace: {
        select: {
          id: true,
          laceName: true,
          laceCode: true,
          color: true,
          width: true,
          laceType: true,
          pricePerMeter: true,
        },
      },
      greigeLace: {
        select: {
          id: true,
          laceName: true,
          laceCode: true,
          expectedShrinkagePercent: true,
          costPerMeterGreige: true,
        },
      },
      processor: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      rateCard: {
        select: {
          id: true,
          ratePerMeter: true,
        },
      },
      stockLot: {
        select: {
          id: true,
          quantityAvailable: true,
          weightedAvgCost: true,
          dyeLotNumber: true,
        },
      },
      labDip: {
        select: {
          id: true,
          labDipNumber: true,
          status: true,
          targetColor: true,
          buyerDecisionDate: true,
        },
      },
    },
  });

  return item;
}

/**
 * Calculate and fetch cost options for a lace item
 */
export async function calculateLaceItemCostOptions(
  laceId: string,
  quantityPerGarment: number,
  orderQuantity: number,
  wastagePercent: number, // Required - no hardcoded defaults
  styleId?: string,
  costSheetId?: string
): Promise<LaceCostCalculationResult> {
  return calculateLaceCost({
    laceId,
    quantityPerGarment,
    orderQuantity,
    wastagePercent,
    styleId,
    costSheetId,
  });
}

/**
 * Update the lace total on a cost sheet
 * Accepts an optional transaction client so item writes and the total recompute stay atomic.
 */
async function updateCostSheetLaceTotal(
  costingId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  // Calculate total from all lace items (N/A rows are persisted but excluded from totals)
  const result = await tx.style_costing_lace_items.aggregate({
    where: { costingId, isNotApplicable: false },
    _sum: { totalCost: true },
  });

  const laceTotal = result._sum.totalCost || new Decimal(0);

  // Get current cost sheet to recalculate totals
  const costSheet = await tx.style_costing.findUnique({
    where: { id: costingId },
    select: {
      fabricTotal: true,
      trimsTotal: true,
      cmtTotal: true,
      embroideryTotal: true,
      accessoriesTotal: true,
      valueLossPercent: true,
      markupPercent: true,
    },
  });

  if (!costSheet) {
    return;
  }

  // Recalculate subtotal and product cost including lace
  const fabricTotal = Number(costSheet.fabricTotal || 0);
  const trimsTotal = Number(costSheet.trimsTotal || 0);
  const cmtTotal = Number(costSheet.cmtTotal || 0);
  const embroideryTotal = Number(costSheet.embroideryTotal || 0);
  const accessoriesTotal = Number(costSheet.accessoriesTotal || 0);
  const laceTotalNum = Number(laceTotal);
  const valueLossPercent = Number(costSheet.valueLossPercent || 2);
  const markupPercent = Number(costSheet.markupPercent || 15);

  const subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal + accessoriesTotal + laceTotalNum;
  const valueLossAmount = (subtotal * valueLossPercent) / 100;
  const totalAfterValueLoss = subtotal + valueLossAmount;
  const markupAmount = (totalAfterValueLoss * markupPercent) / 100;
  const totalProductCost = totalAfterValueLoss + markupAmount;

  // Update cost sheet
  await tx.style_costing.update({
    where: { id: costingId },
    data: {
      laceTotal: new Decimal(laceTotalNum),
      subtotal: new Decimal(subtotal),
      valueLossAmount: new Decimal(valueLossAmount),
      markupAmount: new Decimal(markupAmount),
      totalProductCost: new Decimal(totalProductCost),
      totalMaterialCost: new Decimal(fabricTotal + trimsTotal + accessoriesTotal + laceTotalNum),
      totalCostPerPiece: new Decimal(totalProductCost),
      sellingPricePerPiece: new Decimal(totalProductCost),
    },
  });
}

/**
 * Bulk add lace items to a cost sheet
 */
export async function bulkAddLaceItems(
  costingId: string,
  items: Omit<CreateLaceItemInput, 'costingId'>[]
): Promise<any[]> {
  const createdItems: any[] = [];

  for (const item of items) {
    const created = await addLaceItemToCostSheet({
      ...item,
      costingId,
    });
    createdItems.push(created);
  }

  return createdItems;
}

/**
 * Copy lace items from one cost sheet to another
 */
export async function copyLaceItems(sourceCostingId: string, targetCostingId: string): Promise<any[]> {
  // Get source items
  const sourceItems = await prisma.style_costing_lace_items.findMany({
    where: { costingId: sourceCostingId },
  });

  if (sourceItems.length === 0) {
    return [];
  }

  // Create items in target cost sheet and recompute its lace total in the SAME transaction (bug-hunt costing-20)
  const createdItems = await prisma.$transaction(async (tx) => {
    const items: any[] = [];

    for (const item of sourceItems) {
      const created = await tx.style_costing_lace_items.create({
        data: {
          costingId: targetCostingId,
          laceId: item.laceId,
          laceName: item.laceName,
          colorName: item.colorName,
          width: item.width,
          quantityPerGarment: item.quantityPerGarment,
          wastagePercent: item.wastagePercent,
          effectiveQuantity: item.effectiveQuantity,
          sourcingStrategy: item.sourcingStrategy,
          greigeCost: item.greigeCost,
          processingCost: item.processingCost,
          readyLaceCost: item.readyLaceCost,
          stockCost: item.stockCost,
          costPerMeter: item.costPerMeter,
          totalCost: item.totalCost,
          greigeLaceId: item.greigeLaceId,
          processorId: item.processorId,
          // Note: Don't copy rateCardId, stockLotId, procurementId - these are order-specific
          labDipId: item.labDipId,
          labDipStatus: item.labDipStatus,
          isManualOverride: item.isManualOverride,
          overrideReason: item.overrideReason,
          notes: item.notes,
        },
      });
      items.push(created);
    }

    // Update target cost sheet totals
    await updateCostSheetLaceTotal(targetCostingId, tx);

    return items;
  });

  return createdItems;
}

export default {
  addLaceItemToCostSheet,
  updateLaceItem,
  removeLaceItem,
  getLaceItemsForCostSheet,
  getLaceItemById,
  calculateLaceItemCostOptions,
  bulkAddLaceItems,
  copyLaceItems,
};
