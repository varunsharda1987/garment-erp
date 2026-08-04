import { Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../errors';
import prisma from '../config/database';
import { Prisma, Unit } from '@prisma/client';
import { randomUUID } from 'crypto';
import { transformCuttingBatch, generateBatchNumber, batchIncludeOptions, dedupeSkuRows } from './cutting.utils';
import { syncBomFabricId } from '../services/order-bom.service';
import { calculateCadAverage } from './cad-planning.utils';
import { createChallan, issueChallan, createFabricReturnChallan } from '../services/challan.service';
import { logInfo } from '../utils/logger';
import { productionBlockingValidationService } from '../services/productionBlockingValidation.service';
// BUG-CUT5 fix: Import decimal.js utilities for precision calculations
import { toCurrency, subtractCurrency, divideCurrency, toNumber } from '../utils/currency';

// Re-export sub-controllers so existing imports from routes continue to work
export { addCuttingLay, getCuttingLays, deleteCuttingLay } from './cutting-lay.controller';
export { issueToStitching, getStitchingIssues } from './cutting-issue.controller';

// ============================================
// List Cutting Batches
// ============================================

export const getAllCuttingBatches = async (req: Request, res: Response) => {
  const { page = 1, limit = 20, search, status, workOrderId, componentId, fromDate, toDate } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Prisma.cutting_batchesWhereInput = {};

  if (search) {
    where.OR = [
      { batchNumber: { contains: String(search), mode: 'insensitive' } },
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

  if (componentId) {
    where.componentId = String(componentId);
  }

  if (fromDate || toDate) {
    where.cuttingDate = {};
    if (fromDate) {
      where.cuttingDate.gte = new Date(String(fromDate));
    }
    if (toDate) {
      where.cuttingDate.lte = new Date(String(toDate));
    }
  }

  const [batches, total] = await Promise.all([
    prisma.cutting_batches.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: batchIncludeOptions,
    }),
    prisma.cutting_batches.count({ where }),
  ]);

  res.json({
    data: batches.map(transformCuttingBatch),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
};

// ============================================
// Get Single Cutting Batch
// ============================================

export const getCuttingBatchById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const batch = await prisma.cutting_batches.findUnique({
    where: { id },
    include: {
      ...batchIncludeOptions,
      transferSlips: true,
    },
  });

  if (!batch) {
    throw new NotFoundError('CuttingBatch', id);
  }

  res.json({ data: transformCuttingBatch(batch) });
};

// ============================================
// Create Cutting Batch
// ============================================

export const createCuttingBatch = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }
  const {
    workOrderId,
    componentId,
    cuttingDate,
    fabricStockId,
    actualFabricWidth,
    cadAverageUsed,
    cadWidthUsed,
    layersPerLay,
    numberOfLays,
    cuttingTableId,
    cuttingOperatorId,
    remarks,
    skuOutputs,
    fabricStocks, // array of { fabricStockId, cadAvgUsed, cadWidthUsed, actualWidth }
  } = req.body;

  // Get work order to generate batch number and check status
  const workOrder = await prisma.work_orders.findUnique({
    where: { id: workOrderId },
    select: { id: true, workOrderNumber: true, status: true, orderId: true },
  });

  if (!workOrder) {
    throw new ValidationError('Work order not found');
  }

  // Validate stage transition blockers (material availability, sample approvals, FPT/GPT)
  const stageValidation = await productionBlockingValidationService.validateStageTransition(
    workOrderId,
    'IN_CUTTING',
    false // Not admin override
  );

  if (stageValidation.isBlocked) {
    const blockerMessages = stageValidation.blockers.map((b) => b.message).join('; ');
    throw new ValidationError(`Cannot create cutting batch: ${blockerMessages}`);
  }

  // Validate SKU outputs
  if (!skuOutputs || skuOutputs.length === 0) {
    throw new ValidationError('At least one SKU output is required');
  }
  for (const sku of skuOutputs) {
    if (!sku.sizeId) {
      throw new ValidationError('Each SKU output must have a valid sizeId');
    }
  }

  // Validate cadAverageUsed is present and > 0 (must come from PRODUCTION CAD planning)
  if (!cadAverageUsed || Number(cadAverageUsed) <= 0) {
    throw new ValidationError(
      'CAD average is required and must be greater than 0. Complete PRODUCTION CAD planning first.'
    );
  }

  // Get component name if provided
  let componentName: string | undefined;
  if (componentId) {
    const component = await prisma.style_components.findUnique({
      where: { id: componentId },
      select: { componentName: true },
    });
    componentName = component?.componentName;
  }

  const batchNumber = await generateBatchNumber(workOrder.workOrderNumber, componentName);

  const batch = await prisma.cutting_batches.create({
    data: {
      batchNumber,
      workOrderId,
      componentId,
      cuttingDate: new Date(cuttingDate),
      fabricStockId,
      actualFabricWidth,
      cadAverageUsed,
      cadWidthUsed: cadWidthUsed || actualFabricWidth,
      layersPerLay,
      numberOfLays,
      fabricConsumed: 0, // Will be updated when recording output
      cuttingTableId,
      cuttingOperatorId,
      status: 'PENDING',
      remarks,
      createdById: userId,
      skuOutputs: {
        // Deduped by (colorId, sizeId) — NULL-color duplicates double-count totals (bug-hunt production-18)
        create: dedupeSkuRows(
          // as any[]: req.body is untyped, and a bare `any` receiver makes the generic collapse to its
          // constraint, losing the quantity fields at the Prisma boundary
          ((skuOutputs || []) as any[]).map((sku: any) => ({
            colorId: sku.colorId || null,
            sizeId: sku.sizeId,
            orderQty: sku.orderQty || sku.plannedQty,
            extraAllowed: sku.extraAllowed || 0,
            maxCuttable: sku.maxCuttable || sku.orderQty || sku.plannedQty,
            toCut: sku.toCut || sku.plannedQty,
            cutQty: 0,
            rejectedQty: 0,
            goodPcs: 0,
          })),
          ['orderQty', 'extraAllowed', 'maxCuttable', 'toCut']
        ),
      },
    },
    include: batchIncludeOptions,
  });

  // Create junction records for additional fabrics
  if (fabricStocks && fabricStocks.length > 0) {
    await prisma.cutting_batch_fabrics.createMany({
      data: fabricStocks.map((fs: any) => ({
        batchId: batch.id,
        fabricStockId: fs.fabricStockId,
        cadAvgUsed: fs.cadAvgUsed ?? null,
        cadWidthUsed: fs.cadWidthUsed ?? null,
        actualWidth: fs.actualWidth ?? null,
      })),
      skipDuplicates: true,
    });
  }

  // Update work order status to IN_PRODUCTION if still PENDING
  if (workOrder.status === 'PENDING') {
    await prisma.work_orders.update({
      where: { id: workOrder.id },
      data: {
        status: 'IN_PRODUCTION',
        actualStartDate: new Date(),
      },
    });
  }

  // Auto-create production_tracking: IN_CUTTING
  try {
    const totalCutQty = (skuOutputs as Array<{ toCut?: number; plannedQty?: number }>).reduce(
      (sum, s) => sum + (Number(s.toCut) || Number(s.plannedQty) || 0),
      0
    );
    await prisma.production_tracking.create({
      data: {
        id: randomUUID(),
        workOrderId,
        productionStage: 'IN_CUTTING',
        quantityCompleted: totalCutQty,
        updatedById: userId,
        updateDate: new Date(),
      },
    });
  } catch (err) {
    // allow-swallow — pure timeline production_tracking entry; must not fail the already-created cutting batch
    logInfo(
      `Warning: Auto production_tracking failed for cutting batch ${batch.batchNumber}: ${(err as Error).message}`
    );
  }

  // Auto-issue fabric: create INTERNAL challan for fabric lots used in this batch
  try {
    const allStockIds: Array<{ stockId: string; cadAvg: number | null }> = [];
    if (fabricStockId) {
      allStockIds.push({ stockId: fabricStockId, cadAvg: cadAverageUsed ? Number(cadAverageUsed) : null });
    }
    if (fabricStocks?.length > 0) {
      for (const fs of fabricStocks as Array<{ fabricStockId: string; cadAvgUsed?: number }>) {
        if (fs.fabricStockId && fs.fabricStockId !== fabricStockId) {
          allStockIds.push({ stockId: fs.fabricStockId, cadAvg: fs.cadAvgUsed ? Number(fs.cadAvgUsed) : null });
        }
      }
    }

    const totalPieces = (skuOutputs as Array<{ cutQuantity?: number }>).reduce(
      (sum, s) => sum + (Number(s.cutQuantity) || 0),
      0
    );

    const challanItems = [];
    for (const { stockId, cadAvg } of allStockIds) {
      const stock = await prisma.fabric_stock.findUnique({
        where: { id: stockId },
        select: {
          id: true,
          fabricId: true,
          quantityAvailable: true,
          fabricMaster: { select: { fabricCode: true, fabricName: true } },
        },
      });
      if (stock && Number(stock.quantityAvailable) > 0) {
        // BUG-MFG2 fix: Never default to issuing entire stock. Skip if we can't calculate need.
        if (!cadAvg || totalPieces <= 0) {
          logInfo(
            `Skipping fabric ${stock.fabricMaster?.fabricCode}: no CAD average (${cadAvg}) or totalPieces (${totalPieces})`
          );
          continue;
        }
        const fabricNeeded = totalPieces * cadAvg;
        const issueQty = Math.min(fabricNeeded, Number(stock.quantityAvailable));
        const desc =
          `${stock.fabricMaster?.fabricCode || ''} ${stock.fabricMaster?.fabricName || ''} - Batch ${batch.batchNumber}`.trim();

        challanItems.push({
          itemType: 'FABRIC',
          fabricStockId: stock.id,
          fabricId: stock.fabricId,
          quantity: Math.round(issueQty * 100) / 100, // Round to 2 decimals
          unit: Unit.METER,
          description: desc,
        });
      }
    }

    if (challanItems.length > 0) {
      const challan = await createChallan({
        challanType: 'INTERNAL',
        challanDate: new Date(),
        orderId: workOrder.orderId || undefined,
        productionRunId: workOrderId,
        fromType: 'DEPARTMENT',
        fromName: 'Fabric Store',
        toType: 'DEPARTMENT',
        toName: 'Cutting',
        remarks: `Auto-issued for cutting batch ${batch.batchNumber}`,
        issuedById: userId,
        items: challanItems,
      });
      await issueChallan(challan.id, userId);
      logInfo(`Auto-issued fabric challan ${challan.challanNumber} for cutting batch ${batch.batchNumber}`);
    }
  } catch (challanError) {
    // Don't fail batch creation if challan fails — log and continue
    logInfo(`Warning: Auto-issue challan failed for batch ${batch.batchNumber}: ${(challanError as Error).message}`);
  }

  res.status(201).json({ data: transformCuttingBatch(batch), message: 'Cutting batch created successfully' });
};

// ============================================
// Update Cutting Batch
// ============================================

export const updateCuttingBatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  // Check if batch exists and is not completed
  const existing = await prisma.cutting_batches.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('CuttingBatch', id);
  }

  if (existing.status === 'COMPLETED') {
    throw new ValidationError('Cannot update completed batch');
  }

  const batch = await prisma.cutting_batches.update({
    where: { id },
    data: {
      ...updateData,
      cuttingDate: updateData.cuttingDate ? new Date(updateData.cuttingDate) : undefined,
    },
    include: batchIncludeOptions,
  });

  res.json({ data: transformCuttingBatch(batch) });
};

// ============================================
// Delete Cutting Batch
// ============================================

export const deleteCuttingBatch = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Fetch batch with fabrics to restore stock
  const existing = await prisma.cutting_batches.findUnique({
    where: { id },
    include: {
      additionalFabrics: {
        select: {
          fabricStockId: true,
          fabricConsumed: true,
          fabricIssued: true,
        },
      },
      lays: {
        select: { id: true },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('CuttingBatch', id);
  }

  // Allow deletion for PENDING, ON_HOLD, or IN_PROGRESS batches
  // But only if no actual cutting has happened (no lays recorded)
  const allowedStatuses = ['PENDING', 'ON_HOLD', 'IN_PROGRESS'];
  if (!allowedStatuses.includes(existing.status)) {
    throw new ValidationError('Cannot delete completed batches');
  }

  // Check if any cutting lays have been recorded
  if (existing.lays && existing.lays.length > 0) {
    throw new ValidationError('Cannot delete batch with cutting lays. Remove all lays first or complete the batch.');
  }

  // Use transaction to ensure atomicity
  const fabricsRestored: Array<{ fabricStockId: string; quantityRestored: number }> = [];

  await prisma.$transaction(async (tx) => {
    // Restore primary fabric stock (from fabricStockId on batch)
    const primaryQuantity = Number(existing.fabricIssued || existing.fabricConsumed || 0);
    if (primaryQuantity > 0) {
      await tx.fabric_stock.update({
        where: { id: existing.fabricStockId },
        data: {
          quantityAvailable: { increment: primaryQuantity },
          quantityConsumed: { decrement: primaryQuantity },
          status: 'AVAILABLE',
        },
      });
      fabricsRestored.push({ fabricStockId: existing.fabricStockId, quantityRestored: primaryQuantity });
      logInfo(`Restored ${primaryQuantity}m to primary fabric stock ${existing.fabricStockId}`);
    }

    // Restore additional fabrics (from additionalFabrics relation)
    for (const fabric of existing.additionalFabrics) {
      const quantityToRestore = Number(fabric.fabricIssued || fabric.fabricConsumed || 0);

      if (quantityToRestore > 0) {
        await tx.fabric_stock.update({
          where: { id: fabric.fabricStockId },
          data: {
            quantityAvailable: { increment: quantityToRestore },
            quantityConsumed: { decrement: quantityToRestore },
            status: 'AVAILABLE',
          },
        });
        fabricsRestored.push({ fabricStockId: fabric.fabricStockId, quantityRestored: quantityToRestore });
        logInfo(`Restored ${quantityToRestore}m to additional fabric stock ${fabric.fabricStockId}`);
      }
    }

    // Delete the batch (cascade will delete cutting_batch_fabrics, lays, skus)
    await tx.cutting_batches.delete({
      where: { id },
    });
  });

  res.json({
    message: 'Cutting batch deleted successfully',
    fabricRestored: fabricsRestored.length > 0,
    fabricsRestored,
  });
};

// ============================================
// Workflow Actions
// ============================================

// Start cutting batch (PENDING -> IN_PROGRESS)
export const startCuttingBatch = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.cutting_batches.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('CuttingBatch', id);
  }

  if (existing.status !== 'PENDING') {
    throw new ValidationError('Can only start pending batches');
  }

  const batch = await prisma.cutting_batches.update({
    where: { id },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
    include: batchIncludeOptions,
  });

  res.json({ data: transformCuttingBatch(batch) });
};

// Record cutting output
export const recordCuttingOutput = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { skuOutputs, defects, fabricConsumed, remarks } = req.body;

  const existing = await prisma.cutting_batches.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('CuttingBatch', id);
  }

  if (existing.status !== 'IN_PROGRESS') {
    throw new ValidationError('Can only record output for in-progress batches');
  }

  // Update SKU outputs and add defects in transaction
  await prisma.$transaction(async (tx) => {
    // Update SKU outputs. When the row id isn't sent, resolve it by (batch, colorId, sizeId) — the old
    // `if (sku.id)` silently SKIPPED id-less rows, so output was recorded as saved but never written
    // (bug-hunt production-3). Unresolvable rows now throw (rolls back the tx) instead of vanishing.
    for (const sku of skuOutputs) {
      let rowId: string | undefined = sku.id;
      if (!rowId) {
        const row = await tx.cutting_batch_skus.findFirst({
          where: { cuttingBatchId: id, sizeId: sku.sizeId, colorId: sku.colorId ?? null },
          select: { id: true },
        });
        if (!row) {
          throw new ValidationError(
            `No SKU row on this batch for sizeId=${sku.sizeId}${sku.colorId ? `, colorId=${sku.colorId}` : ''} — output not recorded`
          );
        }
        rowId = row.id;
      }
      await tx.cutting_batch_skus.update({
        where: { id: rowId },
        data: {
          cutQty: sku.cutQty,
          rejectedQty: sku.rejectedQty || 0,
          goodPcs: sku.cutQty - (sku.rejectedQty || 0),
        },
      });
    }

    // Add defects if any
    if (defects && defects.length > 0) {
      await tx.cutting_batch_defects.createMany({
        data: defects.map((d: any) => ({
          cuttingBatchId: id,
          colorId: d.colorId,
          sizeId: d.sizeId,
          defectType: d.defectType,
          defectQty: d.defectQty,
          remarks: d.remarks,
        })),
      });
    }

    // Update batch fabric consumed
    await tx.cutting_batches.update({
      where: { id },
      data: {
        fabricConsumed,
        remarks: remarks || undefined,
      },
    });
  });

  const batch = await prisma.cutting_batches.findUnique({
    where: { id },
    include: batchIncludeOptions,
  });

  res.json({ data: transformCuttingBatch(batch) });
};

// Complete cutting batch (IN_PROGRESS -> COMPLETED)
export const completeCuttingBatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { actualAverage, remarks, fabricReturns } = req.body;

  const existing = await prisma.cutting_batches.findUnique({
    where: { id },
    include: {
      skuOutputs: true,
      additionalFabrics: {
        include: {
          fabricStock: {
            include: { fabricMaster: { select: { id: true, fabricCode: true, fabricName: true } } },
          },
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('CuttingBatch', id);
  }

  if (existing.status !== 'IN_PROGRESS') {
    throw new ValidationError('Can only complete in-progress batches');
  }

  // Calculate total cut quantity
  const totalCut = existing.skuOutputs.reduce((sum: number, sku) => sum + sku.cutQty, 0);

  // Query per-fabric issued quantities from INTERNAL challans to Cutting
  const issuedItems = await prisma.challan_items.groupBy({
    by: ['fabricStockId'],
    _sum: { quantity: true },
    where: {
      challan: {
        productionRunId: existing.workOrderId,
        challanType: 'INTERNAL',
        toName: 'Cutting',
        status: { in: ['ISSUED', 'RECEIVED'] },
      },
      fabricStockId: { not: null },
    },
  });

  // Build a map of fabricStockId -> issued quantity
  const issuedMap = new Map<string, number>();
  for (const item of issuedItems) {
    if (item.fabricStockId) {
      issuedMap.set(item.fabricStockId, Number(item._sum.quantity || 0));
    }
  }

  // Build a map of fabricStockId -> returned quantity from request
  const returnMap = new Map<string, number>();
  if (fabricReturns && Array.isArray(fabricReturns)) {
    for (const ret of fabricReturns) {
      if (ret.fabricStockId && ret.returnedQuantity > 0) {
        returnMap.set(ret.fabricStockId, ret.returnedQuantity);
      }
    }
  }

  // Create return challan if any fabric is being returned
  let returnChallanId: string | null = null;
  if (returnMap.size > 0) {
    const returnItems = Array.from(returnMap.entries()).map(([fabricStockId, quantity]) => {
      const batchFabric = existing.additionalFabrics.find((f) => f.fabricStockId === fabricStockId);
      const fabricName = batchFabric?.fabricStock?.fabricMaster?.fabricName || 'Fabric';
      return {
        fabricStockId,
        quantity,
        description: `Return: ${fabricName} from batch ${existing.batchNumber}`,
      };
    });

    const returnChallan = await createFabricReturnChallan({
      workOrderId: existing.workOrderId,
      issuedById: req.user?.userId || existing.createdById,
      items: returnItems,
      remarks: `Fabric return from cutting batch ${existing.batchNumber} completion`,
    });
    returnChallanId = returnChallan.id;
  }

  // Calculate per-fabric actual consumption and update cutting_batch_fabrics
  let totalFabricIssued = 0;
  let totalFabricReturned = 0;

  for (const batchFabric of existing.additionalFabrics) {
    const issued = issuedMap.get(batchFabric.fabricStockId) || 0;
    const returned = returnMap.get(batchFabric.fabricStockId) || 0;
    const actualCons = Math.max(0, issued - returned);

    totalFabricIssued += issued;
    totalFabricReturned += returned;

    await prisma.cutting_batch_fabrics.update({
      where: { id: batchFabric.id },
      data: {
        fabricIssued: issued,
        fabricReturned: returned,
        actualConsumption: actualCons,
      },
    });
  }

  // BUG-CUT5 fix: Use decimal.js for precision in cutting calculations
  // Total actual consumption
  const totalActualConsumption = Math.max(0, toNumber(subtractCurrency(totalFabricIssued, totalFabricReturned)));

  // If no challans found (legacy), fall back to lay-based fabricConsumed
  const consumptionForAvg = totalFabricIssued > 0 ? totalActualConsumption : Number(existing.fabricConsumed);

  // BUG-CUT5 fix: Use decimal.js for precision in average, variance, and wastage calculations
  // Calculate actual average
  let calcActualAverage = actualAverage;
  if (!calcActualAverage && totalCut > 0 && consumptionForAvg > 0) {
    calcActualAverage = toNumber(divideCurrency(consumptionForAvg, totalCut));
  }

  // Calculate variance from CAD
  let varianceFromCad: number | null = null;
  let variancePercent: number | null = null;
  if (calcActualAverage && Number(existing.cadAverageUsed) > 0) {
    const cadAvgUsed = toCurrency(existing.cadAverageUsed);
    varianceFromCad = toNumber(subtractCurrency(calcActualAverage, cadAvgUsed));
    variancePercent = toNumber(divideCurrency(varianceFromCad, cadAvgUsed).times(100));
  }

  // Calculate wastage: issued - actual consumption
  let wastageMeters: number | null = null;
  let wastagePercent: number | null = null;
  if (totalFabricIssued > 0 && consumptionForAvg > 0) {
    const wastage = subtractCurrency(totalFabricIssued, consumptionForAvg);
    wastageMeters = Math.max(0, toNumber(wastage));
    wastagePercent = toNumber(divideCurrency(wastageMeters, totalFabricIssued).times(100));
  }

  const batch = await prisma.cutting_batches.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      fabricIssued: totalFabricIssued || null,
      fabricReturned: totalFabricReturned || null,
      actualConsumption: totalFabricIssued > 0 ? totalActualConsumption : null,
      returnChallanId,
      actualAverage: calcActualAverage,
      varianceFromCad,
      variancePercent,
      wastageMeters,
      wastagePercent,
      remarks: remarks || existing.remarks,
    },
    include: batchIncludeOptions,
  });

  res.json({ data: transformCuttingBatch(batch) });
};

// Get issued fabric for a cutting batch (for completion dialog)
export const getIssuedFabric = async (req: Request, res: Response) => {
  const { id } = req.params;

  const batch = await prisma.cutting_batches.findUnique({
    where: { id },
    include: {
      additionalFabrics: {
        include: {
          fabricStock: {
            include: { fabricMaster: { select: { id: true, fabricCode: true, fabricName: true } } },
          },
        },
      },
    },
  });

  if (!batch) {
    throw new NotFoundError('CuttingBatch', id);
  }

  // Query issued fabric from INTERNAL challans to Cutting for this work order
  const issuedItems = await prisma.challan_items.groupBy({
    by: ['fabricStockId'],
    _sum: { quantity: true },
    where: {
      challan: {
        productionRunId: batch.workOrderId,
        challanType: 'INTERNAL',
        toName: 'Cutting',
        status: { in: ['ISSUED', 'RECEIVED'] },
      },
      fabricStockId: { not: null },
    },
  });

  const issuedMap = new Map<string, number>();
  for (const item of issuedItems) {
    if (item.fabricStockId) {
      issuedMap.set(item.fabricStockId, Number(item._sum.quantity || 0));
    }
  }

  const result = batch.additionalFabrics.map((bf) => {
    const issuedQty = issuedMap.get(bf.fabricStockId) || 0;
    const consumedInLays = Number(bf.fabricConsumed) || 0;
    return {
      fabricStockId: bf.fabricStockId,
      cuttingBatchFabricId: bf.id,
      fabricName: bf.fabricStock?.fabricMaster?.fabricName || 'Unknown',
      fabricCode: bf.fabricStock?.fabricMaster?.fabricCode || '',
      rollNumbers: (bf.fabricStock as any)?.rollNumbers || '',
      issuedQty,
      consumedInLays,
      balance: Math.max(0, issuedQty - consumedInLays),
    };
  });

  res.json({ data: result });
};

// Put batch on hold
export const holdCuttingBatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const existing = await prisma.cutting_batches.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('CuttingBatch', id);
  }

  if (existing.status === 'COMPLETED') {
    throw new ValidationError('Cannot put completed batches on hold');
  }

  const batch = await prisma.cutting_batches.update({
    where: { id },
    data: {
      status: 'ON_HOLD',
      remarks: reason,
    },
    include: batchIncludeOptions,
  });

  res.json({ data: transformCuttingBatch(batch) });
};

// Resume cutting batch (ON_HOLD -> IN_PROGRESS)
export const resumeCuttingBatch = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.cutting_batches.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('CuttingBatch', id);
  }

  if (existing.status !== 'ON_HOLD') {
    throw new ValidationError('Can only resume batches that are on hold');
  }

  const batch = await prisma.cutting_batches.update({
    where: { id },
    data: { status: 'IN_PROGRESS' },
    include: batchIncludeOptions,
  });

  res.json({ data: transformCuttingBatch(batch) });
};

// Cancel cutting batch (BUG-MFG3 fix: restore fabric when cancelling)
export const cancelCuttingBatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const existing = await prisma.cutting_batches.findUnique({
    where: { id },
    include: {
      additionalFabrics: true,
    },
  });

  if (!existing) {
    throw new NotFoundError('CuttingBatch', id);
  }

  if (existing.status === 'COMPLETED') {
    throw new ValidationError('Cannot cancel completed batches');
  }

  // BUG-MFG3 fix: Restore fabric stock when cancelling (same logic as delete)
  const fabricsRestored: Array<{ fabricStockId: string; quantityRestored: number }> = [];

  const batch = await prisma.$transaction(async (tx) => {
    // Restore primary fabric stock (from fabricStockId on batch)
    const primaryQuantity = Number(existing.fabricIssued || existing.fabricConsumed || 0);
    if (primaryQuantity > 0 && existing.fabricStockId) {
      await tx.fabric_stock.update({
        where: { id: existing.fabricStockId },
        data: {
          quantityAvailable: { increment: primaryQuantity },
          quantityConsumed: { decrement: primaryQuantity },
          status: 'AVAILABLE',
        },
      });
      fabricsRestored.push({ fabricStockId: existing.fabricStockId, quantityRestored: primaryQuantity });
      logInfo(`Restored ${primaryQuantity}m to primary fabric stock ${existing.fabricStockId} (cancelled)`);
    }

    // Restore additional fabrics
    for (const fabric of existing.additionalFabrics) {
      const quantityToRestore = Number(fabric.fabricIssued || fabric.fabricConsumed || 0);
      if (quantityToRestore > 0) {
        await tx.fabric_stock.update({
          where: { id: fabric.fabricStockId },
          data: {
            quantityAvailable: { increment: quantityToRestore },
            quantityConsumed: { decrement: quantityToRestore },
            status: 'AVAILABLE',
          },
        });
        fabricsRestored.push({ fabricStockId: fabric.fabricStockId, quantityRestored: quantityToRestore });
        logInfo(`Restored ${quantityToRestore}m to additional fabric stock ${fabric.fabricStockId} (cancelled)`);
      }
    }

    // Zero out consumed quantities on the batch itself
    return tx.cutting_batches.update({
      where: { id },
      data: {
        status: 'ON_HOLD',
        remarks: reason ? `CANCELLED: ${reason}` : 'CANCELLED',
        fabricConsumed: 0,
        fabricIssued: 0,
      },
      include: batchIncludeOptions,
    });
  });

  res.json({ data: transformCuttingBatch(batch), fabricsRestored });
};

// Generate transfer slip
export const generateTransferSlip = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const batch = await prisma.cutting_batches.findUnique({
    where: { id },
    include: {
      workOrder: true,
      skuOutputs: true,
    },
  });

  if (!batch) {
    throw new NotFoundError('CuttingBatch', id);
  }

  if (batch.status !== 'COMPLETED') {
    throw new ValidationError('Can only generate transfer slip for completed batches');
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

  // Calculate total quantity
  const totalGoodPieces = batch.skuOutputs.reduce((sum: number, sku) => sum + sku.goodPcs, 0);

  // ONE slip per cutting batch (bug-hunt production-8): duplicates double-counted the same pieces
  // downstream. The partial unique index on cuttingBatchId is the DB backstop.
  const existingSlipForBatch = await prisma.transfer_slips.findFirst({
    where: { cuttingBatchId: id },
    select: { slipNumber: true },
  });
  if (existingSlipForBatch) {
    throw new ValidationError(
      `A transfer slip (${existingSlipForBatch.slipNumber}) already exists for this cutting batch`
    );
  }

  // Create transfer slip
  const transferSlip = await prisma.transfer_slips.create({
    data: {
      slipNumber,
      transferDate: today,
      workOrderId: batch.workOrderId,
      componentId: batch.componentId,
      fromStage: 'CUTTING',
      toStage: 'STITCHING',
      fromDepartment: 'Cutting',
      toDepartment: 'Stitching',
      totalGoodPieces,
      status: 'CREATED',
      cuttingBatchId: id,
      preparedById: userId,
      skuBreakdown: {
        // Deduped: legacy duplicate NULL-color batch SKUs would otherwise violate/duplicate
        // transfer_slip_skus rows (bug-hunt production-18)
        create: dedupeSkuRows(
          batch.skuOutputs
            .filter((sku) => sku.goodPcs > 0)
            .map((sku) => ({
              colorId: sku.colorId,
              sizeId: sku.sizeId,
              quantity: sku.goodPcs,
            })),
          ['quantity']
        ),
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
  const [statusCounts, totals, byWorkOrder] = await Promise.all([
    // Status counts
    prisma.cutting_batches.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    // Total fabric consumed
    prisma.cutting_batches.aggregate({
      _sum: {
        fabricConsumed: true,
        layersPerLay: true,
        numberOfLays: true,
      },
    }),
    // By work order
    prisma.cutting_batches.groupBy({
      by: ['workOrderId'],
      _count: { id: true },
    }),
  ]);

  // Get work order details
  const workOrderIds = byWorkOrder.map((wo) => wo.workOrderId);
  const workOrders = await prisma.work_orders.findMany({
    where: { id: { in: workOrderIds } },
    include: { styles: true },
  });

  const workOrderMap = new Map(workOrders.map((wo) => [wo.id, wo]));

  // Calculate total cut pieces
  const skuTotals = await prisma.cutting_batch_skus.aggregate({
    _sum: {
      cutQty: true,
      toCut: true,
    },
  });

  res.json({
    data: {
      total: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
      pending: statusCounts.find((s) => s.status === 'PENDING')?._count.id || 0,
      inProgress: statusCounts.find((s) => s.status === 'IN_PROGRESS')?._count.id || 0,
      completed: statusCounts.find((s) => s.status === 'COMPLETED')?._count.id || 0,
      onHold: statusCounts.find((s) => s.status === 'ON_HOLD')?._count.id || 0,
      totalPcsPlanned: Number(skuTotals._sum?.toCut || 0),
      totalPcsCut: Number(skuTotals._sum?.cutQty || 0),
      totalFabricConsumed: Number(totals._sum?.fabricConsumed || 0),
      byWorkOrder: byWorkOrder.map((wo) => {
        const workOrder = workOrderMap.get(wo.workOrderId);
        return {
          workOrderId: wo.workOrderId,
          workOrderNumber: workOrder?.workOrderNumber || 'Unknown',
          styleName: workOrder?.styles?.styleName || 'Unknown',
          batchCount: wo._count.id,
        };
      }),
    },
  });
};

export const getSummaryByWorkOrder = async (req: Request, res: Response) => {
  const { workOrderId } = req.params;

  const [statusCounts, totals, batches] = await Promise.all([
    prisma.cutting_batches.groupBy({
      by: ['status'],
      where: { workOrderId },
      _count: { id: true },
    }),
    prisma.cutting_batches.aggregate({
      where: { workOrderId },
      _sum: {
        fabricConsumed: true,
      },
    }),
    prisma.cutting_batches.findMany({
      where: { workOrderId },
      include: {
        skuOutputs: true,
      },
    }),
  ]);

  const totalCut = batches.reduce((sum, batch) => sum + batch.skuOutputs.reduce((s, sku) => s + sku.cutQty, 0), 0);

  const totalPlanned = batches.reduce((sum, batch) => sum + batch.skuOutputs.reduce((s, sku) => s + sku.toCut, 0), 0);

  res.json({
    data: {
      total: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
      pending: statusCounts.find((s) => s.status === 'PENDING')?._count.id || 0,
      inProgress: statusCounts.find((s) => s.status === 'IN_PROGRESS')?._count.id || 0,
      completed: statusCounts.find((s) => s.status === 'COMPLETED')?._count.id || 0,
      onHold: statusCounts.find((s) => s.status === 'ON_HOLD')?._count.id || 0,
      totalPcsPlanned: totalPlanned,
      totalPcsCut: totalCut,
      totalFabricConsumed: Number(totals._sum?.fabricConsumed || 0),
      byWorkOrder: [],
    },
  });
};

// Get available work orders for cutting
export const getAvailableWorkOrders = async (req: Request, res: Response) => {
  const workOrders = await prisma.work_orders.findMany({
    where: {
      status: {
        in: ['IN_PRODUCTION', 'PENDING'],
      },
    },
    include: {
      styles: {
        include: {
          style_components: {
            include: {
              style_fabrics: {
                select: {
                  id: true,
                  fabricId: true,
                  fabricName: true,
                  componentId: true,
                  fabricFinishType: true,
                  printDesign: true,
                  colorMaster: { select: { id: true, colorName: true } },
                },
              },
            },
          },
        },
      },
      work_order_breakup: {
        include: {
          color_options: { select: { id: true, colorName: true } },
        },
      },
      cutting_batches: {
        include: {
          skuOutputs: true,
        },
      },
    },
  });

  const result = workOrders
    .map((wo) => {
      const cutQty = wo.cutting_batches.reduce(
        (sum, batch) => sum + batch.skuOutputs.reduce((s, sku) => s + sku.goodPcs, 0),
        0
      );

      // Collect unique fabricIds from style_components -> style_fabrics
      const fabricIds = [
        ...new Set(
          wo.styles?.style_components?.flatMap(
            (c: any) => c.style_fabrics?.map((sf: any) => sf.fabricId).filter(Boolean) || []
          ) || []
        ),
      ];

      // Collect unique colors from work_order_breakup
      const colors = [
        ...new Map(
          wo.work_order_breakup
            ?.filter((b: any) => b.color_options)
            .map((b: any) => [b.color_options.id, { id: b.color_options.id, colorName: b.color_options.colorName }])
        ).values(),
      ];

      // Collect components
      const components =
        wo.styles?.style_components?.map((c: any) => ({
          id: c.id,
          componentName: c.componentName,
          componentType: c.componentType,
        })) || [];

      return {
        id: wo.id,
        workOrderNumber: wo.workOrderNumber,
        styleId: wo.styleId,
        styleCode: wo.styles?.styleCode || '',
        buyerStyleRef: wo.styles?.buyerStyleRef ?? null,
        styleName: wo.styles?.styleName || '',
        orderQty: wo.totalQuantity,
        cutQty,
        pendingQty: wo.totalQuantity - cutQty,
        fabricIds,
        colors,
        components,
      };
    })
    .filter((wo) => wo.pendingQty > 0);

  res.json({ data: result });
};

// Get available fabric stock for cutting
export const getAvailableFabricStock = async (req: Request, res: Response) => {
  const { fabricId } = req.params;

  const stock = await prisma.fabric_stock.findMany({
    where: {
      fabricId,
      quantityAvailable: { gt: 0 },
    },
    select: {
      id: true,
      rollNumbers: true,
      quantityAvailable: true,
      finishedWidth: true,
      cutableWidth: true,
      qualityGrade: true,
      weightedAvgCost: true,
      fabricMaster: {
        select: {
          id: true,
          fabricCode: true,
          fabricName: true,
          finishType: true,
          printDesign: true,
          colorName: true,
        },
      },
    },
  });

  res.json({
    data: stock.map((s) => ({
      id: s.id,
      rollNumbers: s.rollNumbers || '',
      quantityAvailable: Number(s.quantityAvailable),
      finishedWidth: Number(s.finishedWidth),
      cutableWidth: Number(s.cutableWidth),
      qualityGrade: s.qualityGrade,
      weightedAvgCost: Number(s.weightedAvgCost),
      fabricName: s.fabricMaster?.fabricName || '',
      finishType: s.fabricMaster?.finishType || null,
      printDesign: s.fabricMaster?.printDesign || null,
      colorName: s.fabricMaster?.colorName || null,
    })),
  });
};

// ============================================
// Cutting Chart Data — Shared aggregation
// ============================================

export async function buildCuttingChartData(workOrderId: string, colorId?: string) {
  // 1. Fetch work order with all related data
  const workOrder = await prisma.work_orders.findUnique({
    where: { id: workOrderId },
    include: {
      orders: {
        include: {
          customers: { select: { id: true, name: true, brandNames: true } },
        },
      },
      styles: {
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
          styleName: true,
          imageUrl: true,
          brandName: true,
        },
      },
      work_order_breakup: {
        include: {
          color_options: { select: { id: true, colorName: true, colorCode: true } },
          size_options: { select: { id: true, sizeName: true, sortOrder: true } },
        },
      },
      cutting_batches: {
        select: {
          id: true,
          batchNumber: true,
          status: true,
          skuOutputs: {
            select: { cutQty: true, goodPcs: true, colorId: true },
          },
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  // 2. Resolve breakup data — use work_order_breakup, or backfill from order_item_breakup
  let breakupData = workOrder.work_order_breakup as Array<{
    id: string;
    colorId: string | null;
    sizeId: string;
    plannedQuantity: number;
    completedQuantity: number;
    color_options: { id: string; colorName: string; colorCode: string | null } | null;
    size_options: { id: string; sizeName: string; sortOrder: number };
  }>;

  // Backfill: if work_order_breakup is empty, try order_item_breakup
  if (breakupData.length === 0 && workOrder.orderItemId) {
    const orderItem = await prisma.order_items.findUnique({
      where: { id: workOrder.orderItemId },
      include: {
        order_item_breakup: {
          include: {
            color_options: { select: { id: true, colorName: true, colorCode: true } },
            size_options: { select: { id: true, sizeName: true, sortOrder: true } },
          },
        },
      },
    });
    if (orderItem?.order_item_breakup?.length) {
      breakupData = orderItem.order_item_breakup.map((b) => ({
        id: b.id,
        colorId: b.colorId,
        sizeId: b.sizeId,
        plannedQuantity: b.quantity,
        completedQuantity: 0,
        color_options: b.color_options,
        size_options: b.size_options,
      }));
    }
  }

  // Filter breakup by colorId if provided
  let breakup = breakupData;
  if (colorId) {
    breakup = breakup.filter((b) => b.colorId === colorId);
  }

  // Get unique colors from breakup
  const uniqueColors = [
    ...new Map(breakupData.filter((b) => b.color_options).map((b) => [b.color_options!.id, b.color_options!])).values(),
  ];

  // Build size breakdown for the selected color
  const sizes = breakup
    .filter((b) => b.size_options)
    .map((b) => ({
      sizeId: b.sizeId,
      sizeName: b.size_options.sizeName,
      sortOrder: b.size_options.sortOrder,
      orderQty: b.plannedQuantity,
      completedQty: b.completedQuantity,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Use workOrder.totalQuantity as the authoritative order qty
  const totalOrderQty = workOrder.totalQuantity;

  // Calculate ratios
  const sizesWithRatio = sizes.map((s) => ({
    ...s,
    ratio: totalOrderQty > 0 ? Math.round((s.orderQty / totalOrderQty) * 100) : 0,
  }));

  // 3. Fetch CAD rows for the style — search all 3 linking paths
  const cadRows = await prisma.fabric_width_cad.findMany({
    where: {
      OR: [
        { costingStyleId: workOrder.styleId },
        { styleFabric: { style_components: { styleId: workOrder.styleId } } },
        { styleCosting: { styleId: workOrder.styleId } },
      ],
    },
    select: {
      id: true,
      componentName: true,
      purpose: true,
      purposeEnum: true,
      cutableWidth: true,
      cadMeters: true,
      cadAverage: true,
      piecesPerMarker: true,
      layerMarginMeters: true,
      fabricId: true,
      fabric: {
        select: { id: true, fabricCode: true, fabricName: true },
      },
      batchGroupColor: {
        select: { id: true, colorName: true },
      },
      styleFabric: {
        select: {
          fabricId: true,
          fabricName: true,
          fabricColor: true,
          cutableWidth: true,
          style_components: { select: { componentName: true } },
        },
      },
      costingFabricItems: {
        select: {
          id: true,
          width: true,
          cadMeters: true,
          costPerMeter: true,
          colorName: true,
        },
      },
    },
  });

  // 3-fix. Auto-heal existing data BEFORE grouping:
  // Backfill styleFabricId on PRODUCTION CADs missing it (match by greigeId),
  // backfill cadAverage if null but computable, sync BOM fabricId
  for (const cad of cadRows) {
    const cadPurpose = cad.purposeEnum || cad.purpose;

    // Backfill styleFabricId if missing
    if (cadPurpose === 'PRODUCTION' && !cad.styleFabric && cad.fabricId) {
      const fabric = await prisma.fabric_master.findUnique({
        where: { id: cad.fabricId },
        select: { greigeId: true },
      });
      if (fabric?.greigeId) {
        const matchingSf = await prisma.style_fabrics.findFirst({
          where: {
            style_components: { styleId: workOrder.styleId },
            fabric: { greigeId: fabric.greigeId },
          },
          select: {
            id: true,
            fabricId: true,
            fabricName: true,
            fabricColor: true,
            cutableWidth: true,
            style_components: { select: { componentName: true } },
          },
        });
        if (matchingSf) {
          await prisma.fabric_width_cad.update({
            where: { id: cad.id },
            data: { styleFabricId: matchingSf.id },
          });
          (cad as any).styleFabric = matchingSf;
        }
      }
    }

    // Sync BOM fabricId
    if (
      cadPurpose === 'PRODUCTION' &&
      cad.fabricId &&
      (cad as any).styleFabric?.fabricId &&
      cad.fabricId !== (cad as any).styleFabric.fabricId
    ) {
      await syncBomFabricId(workOrder.styleId, (cad as any).styleFabric.fabricId, cad.fabricId);
    }

    // Backfill cadAverage if missing but computable
    if (!cad.cadAverage && cad.cadMeters && cad.piecesPerMarker) {
      const computed = calculateCadAverage(
        Number(cad.cadMeters),
        cad.layerMarginMeters ? Number(cad.layerMarginMeters) : null,
        Number(cad.piecesPerMarker)
      );
      if (computed !== null) {
        await prisma.fabric_width_cad.update({
          where: { id: cad.id },
          data: { cadAverage: computed },
        });
        (cad as any).cadAverage = computed;
      }
    }
  }

  // Group CAD rows by componentName (= "Part")
  const partMap = new Map<
    string,
    {
      part: string;
      fabricId: string | null;
      fabricName: string;
      fabricCode: string;
      costingWidth: number | null;
      costingAverage: number | null;
      rawMatCalcWidth: number | null;
      rawMatCalcAverage: number | null;
      productionWidth: number | null;
      productionAverage: number | null;
      fabricColor: string | null;
    }
  >();

  for (const cad of cadRows) {
    // Resolve fabricId: direct -> styleFabric fallback
    const resolvedFabricId = cad.fabricId || cad.styleFabric?.fabricId || null;
    // Display name: component name for the UI "Part" column
    const displayName = cad.styleFabric?.style_components?.componentName || cad.componentName;
    if (!displayName) continue; // Skip orphan CAD rows with no component linkage
    // Key by fabricId to prevent collision when two fabrics share the same componentName
    const partKey = resolvedFabricId || displayName;
    const resolvedFabricName = cad.fabric?.fabricName || cad.styleFabric?.fabricName || '';
    const resolvedFabricCode = cad.fabric?.fabricCode || '';
    // Color priority: batch group color -> costing item color -> style fabric color
    const resolvedColor =
      cad.batchGroupColor?.colorName || cad.costingFabricItems?.[0]?.colorName || cad.styleFabric?.fabricColor || null;

    if (!partMap.has(partKey)) {
      partMap.set(partKey, {
        part: displayName, // display name for UI, not the fabricId key
        fabricId: resolvedFabricId,
        fabricName: resolvedFabricName,
        fabricCode: resolvedFabricCode,
        costingWidth: null,
        costingAverage: null,
        rawMatCalcWidth: null,
        rawMatCalcAverage: null,
        productionWidth: null,
        productionAverage: null,
        fabricColor: resolvedColor,
      });
    }

    const entry = partMap.get(partKey)!;
    const width = cad.cutableWidth ? Number(cad.cutableWidth) : null;
    const avg = cad.cadAverage ? Number(cad.cadAverage) : null;

    const cadPurpose = cad.purposeEnum || cad.purpose;
    switch (cadPurpose) {
      case 'COSTING':
        entry.costingWidth = width;
        entry.costingAverage = avg;
        break;
      case 'RAW_MATERIAL_CALCULATION':
        entry.rawMatCalcWidth = width;
        entry.rawMatCalcAverage = avg;
        break;
      case 'PRODUCTION':
        entry.productionWidth = width;
        entry.productionAverage = avg;
        break;
    }

    // Update fabricId if not set
    if (!entry.fabricId && resolvedFabricId) {
      entry.fabricId = resolvedFabricId;
      entry.fabricName = resolvedFabricName;
      entry.fabricCode = resolvedFabricCode;
    }
    // Update color if not set
    if (!entry.fabricColor && resolvedColor) {
      entry.fabricColor = resolvedColor;
    }
  }

  // 3b. Enrich from order_bom_items (fabric requirements for this order)
  if (workOrder.orderId) {
    const orderBom = await prisma.order_bom.findFirst({
      where: { orderId: workOrder.orderId, styleId: workOrder.styleId, isActive: true },
      include: {
        items: {
          where: { materialType: { in: ['GREIGE', 'FABRIC'] } },
          select: {
            fabricId: true,
            componentName: true,
            totalWithWastage: true,
            sourcingStrategy: true,
            fabric_master: { select: { id: true, fabricCode: true, fabricName: true } },
          },
        },
      },
    });

    if (orderBom?.items) {
      for (const bomItem of orderBom.items) {
        if (!bomItem.fabricId) continue;

        // Match by fabricId first to avoid duplicates from mismatched componentName keys
        let matched = false;
        for (const [, entry] of partMap.entries()) {
          if (entry.fabricId && entry.fabricId === bomItem.fabricId) {
            // Same fabric already exists — enrich if missing data
            if (!entry.fabricName && bomItem.fabric_master?.fabricName) {
              entry.fabricName = bomItem.fabric_master.fabricName;
            }
            if (!entry.fabricCode && bomItem.fabric_master?.fabricCode) {
              entry.fabricCode = bomItem.fabric_master.fabricCode;
            }
            matched = true;
            break;
          }
        }

        if (!matched) {
          // Only add new entry if this fabricId doesn't exist anywhere in partMap
          const fabricIdExists = Array.from(partMap.values()).some((e) => e.fabricId === bomItem.fabricId);
          if (!fabricIdExists) {
            const baseKey = bomItem.componentName;
            if (!baseKey) continue; // Skip BOM items with no component name
            // Avoid overwriting an existing entry — use fabricCode or incremented key if needed
            const partKey = partMap.has(baseKey)
              ? bomItem.fabric_master?.fabricCode || `${baseKey}-${partMap.size + 1}`
              : baseKey;
            partMap.set(partKey, {
              part: partKey,
              fabricId: bomItem.fabricId,
              fabricName: bomItem.fabric_master?.fabricName || '',
              fabricCode: bomItem.fabric_master?.fabricCode || '',
              costingWidth: null,
              costingAverage: null,
              rawMatCalcWidth: null,
              rawMatCalcAverage: null,
              productionWidth: null,
              productionAverage: null,
              fabricColor: null,
            });
          }
        }
      }
    }
  }

  // 3c. Fallback to style_fabrics if partMap still has no fabricId entries
  const hasFabricIds = Array.from(partMap.values()).some((f) => f.fabricId);
  if (!hasFabricIds) {
    const styleFabrics = await prisma.style_fabrics.findMany({
      where: { style_components: { styleId: workOrder.styleId } },
      select: {
        fabricId: true,
        fabricName: true,
        fabricColor: true,
        style_components: { select: { componentName: true } },
      },
    });
    for (const sf of styleFabrics) {
      if (!sf.fabricId) continue;

      // Match by fabricId first to avoid duplicates
      let matched = false;
      for (const [, entry] of partMap.entries()) {
        if (entry.fabricId && entry.fabricId === sf.fabricId) {
          // Same fabric — enrich color if missing
          if (!entry.fabricColor && sf.fabricColor) entry.fabricColor = sf.fabricColor;
          if (!entry.fabricName && sf.fabricName) entry.fabricName = sf.fabricName;
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Only add if this fabricId doesn't exist anywhere in partMap
        const fabricIdExists = Array.from(partMap.values()).some((e) => e.fabricId === sf.fabricId);
        if (!fabricIdExists) {
          const displayName = sf.style_components?.componentName;
          if (!displayName) continue; // Skip style fabrics with no component linkage
          const partKey = sf.fabricId || displayName; // key by fabricId for uniqueness
          partMap.set(partKey, {
            part: displayName,
            fabricId: sf.fabricId,
            fabricName: sf.fabricName || '',
            fabricCode: '',
            costingWidth: null,
            costingAverage: null,
            rawMatCalcWidth: null,
            rawMatCalcAverage: null,
            productionWidth: null,
            productionAverage: null,
            fabricColor: sf.fabricColor || null,
          });
        }
      }
    }
  }

  // --- Deduplicate entries that share the same fabric (by fabricId OR fabricName) ---
  const allEntries = Array.from(partMap.values());
  const seenFabricIds = new Map<string, (typeof allEntries)[0]>();
  const seenFabricNames = new Map<string, (typeof allEntries)[0]>();
  const fabrics: typeof allEntries = [];

  const mergeCadFields = (target: (typeof allEntries)[0], source: (typeof allEntries)[0]) => {
    if (!target.fabricName && source.fabricName) target.fabricName = source.fabricName;
    if (!target.fabricCode && source.fabricCode) target.fabricCode = source.fabricCode;
    if (!target.fabricColor && source.fabricColor) target.fabricColor = source.fabricColor;
    if (source.costingWidth !== null && target.costingWidth === null) {
      target.costingWidth = source.costingWidth;
      target.costingAverage = source.costingAverage;
    }
    if (source.rawMatCalcWidth !== null && target.rawMatCalcWidth === null) {
      target.rawMatCalcWidth = source.rawMatCalcWidth;
      target.rawMatCalcAverage = source.rawMatCalcAverage;
    }
    if (source.productionWidth !== null && target.productionWidth === null) {
      target.productionWidth = source.productionWidth;
      target.productionAverage = source.productionAverage;
    }
  };

  for (const f of allEntries) {
    if (f.fabricId) {
      // Dedup by fabricId
      const existing = seenFabricIds.get(f.fabricId);
      if (existing) {
        mergeCadFields(existing, f);
        continue;
      }
      // Check if a null-fabricId entry with same fabricName already exists — merge into it
      if (f.fabricName) {
        const byName = seenFabricNames.get(f.fabricName);
        if (byName && !byName.fabricId) {
          byName.fabricId = f.fabricId;
          mergeCadFields(byName, f);
          seenFabricIds.set(f.fabricId, byName);
          continue;
        }
      }
      seenFabricIds.set(f.fabricId, f);
    } else if (f.fabricName) {
      // No fabricId — dedup by fabricName
      const byName = seenFabricNames.get(f.fabricName);
      if (byName) {
        mergeCadFields(byName, f);
        continue;
      }
      // Check if any fabricId entry already has this name
      const byId = Array.from(seenFabricIds.values()).find((e) => e.fabricName === f.fabricName);
      if (byId) {
        mergeCadFields(byId, f);
        continue;
      }
    }

    if (f.fabricName) seenFabricNames.set(f.fabricName, f);
    fabrics.push(f);
  }

  // 4. For each unique fabricId, get PO ordered qty, GRN received qty, and fabric stock lots
  const uniqueFabricIds = [...new Set(fabrics.map((f) => f.fabricId).filter(Boolean))] as string[];

  // Get materials that link to these fabrics (materials.fabricId -> purchase_order_items)
  const materialsWithFabric = await prisma.materials.findMany({
    where: { fabricId: { in: uniqueFabricIds } },
    select: {
      id: true,
      fabricId: true,
      purchase_order_items: {
        select: {
          id: true,
          orderedQuantity: true,
          receivedQuantity: true,
          grn_items: {
            select: {
              acceptedQuantity: true,
            },
          },
        },
      },
    },
  });

  // Build fabric ordered/received maps
  const fabricOrderedMap = new Map<string, number>();
  const fabricReceivedMap = new Map<string, number>();
  for (const mat of materialsWithFabric) {
    if (!mat.fabricId) continue;
    const ordered = mat.purchase_order_items.reduce((sum, poi) => sum + Number(poi.orderedQuantity), 0);
    const received = mat.purchase_order_items.reduce(
      (sum, poi) => sum + poi.grn_items.reduce((gSum, gi) => gSum + Number(gi.acceptedQuantity), 0),
      0
    );
    fabricOrderedMap.set(mat.fabricId, (fabricOrderedMap.get(mat.fabricId) || 0) + ordered);
    fabricReceivedMap.set(mat.fabricId, (fabricReceivedMap.get(mat.fabricId) || 0) + received);
  }

  // Check for issued INTERNAL challans (fabric issuance from store to cutting)
  const issuedChallanItems = await prisma.challan_items.findMany({
    where: {
      challan: {
        productionRunId: workOrderId,
        challanType: 'INTERNAL',
        status: { in: ['ISSUED', 'IN_TRANSIT', 'RECEIVED', 'PARTIALLY_RECEIVED'] },
      },
      fabricStockId: { not: null },
    },
    select: { fabricStockId: true, fabricId: true, quantity: true },
  });

  // Build issued qty map: fabricStockId → issued meters
  const issuedQtyMap = new Map<string, number>();
  for (const ci of issuedChallanItems) {
    if (ci.fabricStockId) {
      issuedQtyMap.set(ci.fabricStockId, (issuedQtyMap.get(ci.fabricStockId) || 0) + Number(ci.quantity));
    }
  }
  const issuedStockIds = [...issuedQtyMap.keys()];
  const hasIssuedFabric = issuedStockIds.length > 0;

  // If fabric has been issued via challan → only show issued lots
  // Otherwise fallback to all available stock (backward compat for existing work orders)
  const stockSelect = {
    id: true,
    fabricId: true,
    rollNumbers: true,
    cutableWidth: true,
    quantityAvailable: true,
    qualityGrade: true,
    plannedCad: true,
    actualCad: true,
  } as const;

  const fabricStockRecords = hasIssuedFabric
    ? await prisma.fabric_stock.findMany({
        where: { id: { in: issuedStockIds } },
        select: stockSelect,
        orderBy: { receivedDate: 'desc' },
      })
    : await prisma.fabric_stock.findMany({
        where: { fabricId: { in: uniqueFabricIds }, quantityAvailable: { gt: 0 } },
        select: stockSelect,
        orderBy: { receivedDate: 'desc' },
      });

  const fabricStockMap = new Map<string, typeof fabricStockRecords>();
  for (const fs of fabricStockRecords) {
    if (!fabricStockMap.has(fs.fabricId)) {
      fabricStockMap.set(fs.fabricId, []);
    }
    fabricStockMap.get(fs.fabricId)!.push(fs);
  }

  // 5. Build fabric details array (per part)
  const fabricDetails = fabrics.map((f) => {
    const ordered = f.fabricId ? fabricOrderedMap.get(f.fabricId) || 0 : 0;
    const received = f.fabricId ? fabricReceivedMap.get(f.fabricId) || 0 : 0;
    const stocks = f.fabricId ? fabricStockMap.get(f.fabricId) || [] : [];
    const cutableQty = stocks.reduce((sum, s) => sum + Number(s.quantityAvailable), 0);

    return {
      part: f.part,
      fabric: f.fabricName,
      fabricId: f.fabricId,
      fabricOrdered: ordered,
      fabricReceived: received,
      cutableQty,
      extraShortage: received - ordered,
    };
  });

  // 6. Build fabrics with lot details
  // For issued lots, show the issued quantity (not current quantityAvailable which may be 0 after deduction)
  const fabricsWithLots = fabrics.map((f) => {
    const stocks = f.fabricId ? fabricStockMap.get(f.fabricId) || [] : [];
    return {
      ...f,
      lots: stocks.map((s, idx) => ({
        lotId: s.id,
        lotNumber: idx + 1,
        rollNumbers: s.rollNumbers || '',
        actualWidth: Number(s.cutableWidth),
        quantityAvailable: hasIssuedFabric
          ? issuedQtyMap.get(s.id) || Number(s.quantityAvailable)
          : Number(s.quantityAvailable),
        qualityGrade: s.qualityGrade,
      })),
    };
  });

  // 6b. Per-fabric stock analysis — calculate max cuttable pcs (Production CAD only)
  const fabricAnalysis = fabrics.map((f) => {
    const stocks = f.fabricId ? fabricStockMap.get(f.fabricId) || [] : [];
    const availableStock = hasIssuedFabric
      ? stocks.reduce((sum, s) => sum + (issuedQtyMap.get(s.id) || Number(s.quantityAvailable)), 0)
      : stocks.reduce((sum, s) => sum + Number(s.quantityAvailable), 0);
    const cadAvg = f.productionAverage ? Number(f.productionAverage) : 0; // Production CAD only
    const cadSet = cadAvg > 0;
    const maxPcs = cadSet ? Math.floor(availableStock / cadAvg) : null;
    const requiredMeters = totalOrderQty * cadAvg;
    const shortfallMeters = cadSet ? Math.max(0, requiredMeters - availableStock) : 0;
    return {
      part: f.part,
      fabricId: f.fabricId,
      fabricName: f.fabricName,
      cadAverage: cadAvg,
      cadSet,
      availableStock,
      maxPcsFromStock: maxPcs,
      requiredForOrder: requiredMeters,
      shortfallMeters,
    };
  });

  // Max cuttable = min across all fabrics with Production CAD set
  const fabricsWithCad = fabricAnalysis.filter((fa) => fa.cadSet && fa.maxPcsFromStock !== null);
  const maxCuttablePcs =
    fabricsWithCad.length > 0 ? Math.min(...fabricsWithCad.map((fa) => fa.maxPcsFromStock!)) : totalOrderQty;

  // Identify the bottleneck fabric (lowest max pcs)
  const bottleneckFabric =
    fabricsWithCad.length > 0
      ? fabricsWithCad.reduce((min, fa) => (fa.maxPcsFromStock! < min.maxPcsFromStock! ? fa : min)).part
      : null;

  // 7. Existing batches for this WO (optionally filter by color)
  let existingBatches = workOrder.cutting_batches.map((b) => {
    const totalCut = b.skuOutputs.reduce((sum, s) => sum + s.cutQty, 0);
    return {
      id: b.id,
      batchNumber: b.batchNumber,
      status: b.status,
      totalCut,
    };
  });

  // Calculate already-cut and pending quantities (exclude ON_HOLD as they may resume)
  const alreadyCutQty = existingBatches.reduce((sum, b) => sum + b.totalCut, 0);
  const pendingCutQty = Math.max(0, totalOrderQty - alreadyCutQty);

  // Get selected color name
  const selectedColor = colorId ? uniqueColors.find((c) => c.id === colorId) : null;

  // 8. Build response
  const chartData = {
    // Header Info
    buyer: workOrder.orders?.customers?.name || '',
    brand: workOrder.styles?.brandName || workOrder.orders?.customers?.brandNames || '',
    style: workOrder.styles?.styleCode || '',
    buyerStyleRef: workOrder.styles?.buyerStyleRef ?? null,
    styleName: workOrder.styles?.styleName || '',
    styleImage: workOrder.styles?.imageUrl || '',
    workOrderNumber: workOrder.workOrderNumber,
    workOrderId: workOrder.id,
    orderQty: workOrder.totalQuantity,
    color: selectedColor?.colorName || 'All Colors',
    colorId: colorId || null,
    cuttingDate: new Date().toISOString().split('T')[0],

    // Available colors for this work order
    availableColors: uniqueColors.map((c) => ({
      id: c.id,
      colorName: c.colorName,
      colorCode: c.colorCode,
    })),

    // Size Breakdown
    sizes: sizesWithRatio,
    totalOrderQty,

    // Fabric Details (per part)
    fabricDetails,

    // Fabrics & CAD (per part with lot details)
    fabrics: fabricsWithLots,

    // Fabric Stock Analysis (per part — max cuttable pcs)
    fabricAnalysis,
    maxCuttablePcs,
    bottleneckFabric,
    pendingCutQty,

    // Existing batches
    existingBatches,
  };

  return chartData;
}

// ============================================
// Cutting Chart Data Endpoint
// ============================================

export const getCuttingChartData = async (req: Request, res: Response) => {
  const { workOrderId } = req.params;
  const { colorId } = req.query;
  const chartData = await buildCuttingChartData(workOrderId, colorId as string | undefined);
  res.json({ data: chartData });
};

// ============================================
// Style/Size Cutting Summary
// ============================================

// Get style/size-wise cutting summary with days tracking
export const getStyleSizeSummary = async (req: Request, res: Response) => {
  const batches = await prisma.cutting_batches.findMany({
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
      skuOutputs: {
        include: {
          color: { select: { id: true, colorName: true } },
          size: { select: { id: true, sizeName: true, sortOrder: true } },
        },
      },
    },
  });

  // Group by workOrder -> size
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
      cuttingDates: Date[];
      updatedAts: Date[];
      statuses: string[];
      sizeMap: Map<
        string,
        { sizeId: string; sizeName: string; sortOrder: number; planned: number; cut: number; goodPcs: number }
      >;
    }
  >();

  for (const batch of batches) {
    const woId = batch.workOrderId;
    if (!woMap.has(woId)) {
      woMap.set(woId, {
        workOrderId: woId,
        workOrderNumber: batch.workOrder?.workOrderNumber || '',
        styleCode: (batch.workOrder as any)?.styles?.styleCode || '',
        buyerStyleRef: (batch.workOrder as any)?.styles?.buyerStyleRef ?? null,
        styleName: (batch.workOrder as any)?.styles?.styleName || '',
        customerName: (batch.workOrder as any)?.orders?.customers?.name || '',
        orderNumber: (batch.workOrder as any)?.orders?.orderNumber || '',
        cuttingDates: [],
        updatedAts: [],
        statuses: [],
        sizeMap: new Map(),
      });
    }
    const wo = woMap.get(woId)!;
    wo.cuttingDates.push(new Date(batch.cuttingDate));
    wo.updatedAts.push(new Date(batch.updatedAt));
    wo.statuses.push(batch.status);

    for (const sku of batch.skuOutputs) {
      const sizeId = sku.sizeId;
      if (!wo.sizeMap.has(sizeId)) {
        wo.sizeMap.set(sizeId, {
          sizeId,
          sizeName: sku.size?.sizeName || '',
          sortOrder: sku.size?.sortOrder || 0,
          planned: 0,
          cut: 0,
          goodPcs: 0,
        });
      }
      const sizeEntry = wo.sizeMap.get(sizeId)!;
      sizeEntry.planned += sku.toCut;
      sizeEntry.cut += sku.cutQty;
      sizeEntry.goodPcs += sku.goodPcs;
    }
  }

  // Fetch transfer slips for pending push calculation
  const workOrderIds = Array.from(woMap.keys());
  const transferSlips = await prisma.transfer_slips.findMany({
    where: {
      workOrderId: { in: workOrderIds },
      isActive: true,
      fromStage: 'CUTTING',
      toStage: 'STITCHING',
    },
    select: { workOrderId: true, status: true },
  });

  const DAY_MS = 86400000;
  const now = Date.now();

  const data = Array.from(woMap.values()).map((wo) => {
    const sizes = Array.from(wo.sizeMap.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        ...s,
        pending: Math.max(0, s.planned - s.cut),
      }));

    // Days in cutting
    const cuttingStart = Math.min(...wo.cuttingDates.map((d) => d.getTime()));
    const allCompleted = wo.statuses.every((s) => s === 'COMPLETED');
    const cuttingEnd = allCompleted ? Math.max(...wo.updatedAts.map((d) => d.getTime())) : now;
    const daysInCutting = Math.max(1, Math.ceil((cuttingEnd - cuttingStart) / DAY_MS));

    // Days pending push (completed but not transferred to stitching)
    let daysPendingPush: number | null = null;
    if (allCompleted) {
      const hasStitchingSlip = transferSlips.some((s) => s.workOrderId === wo.workOrderId);
      if (!hasStitchingSlip) {
        const lastEnd = Math.max(...wo.updatedAts.map((d) => d.getTime()));
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
      daysPendingPush,
      sizes,
      totalPlanned: sizes.reduce((sum, s) => sum + s.planned, 0),
      totalCut: sizes.reduce((sum, s) => sum + s.cut, 0),
      totalGoodPcs: sizes.reduce((sum, s) => sum + s.goodPcs, 0),
    };
  });

  res.json({ data });
};
