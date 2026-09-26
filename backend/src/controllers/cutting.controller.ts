import { Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../errors';
import prisma from '../config/database';
import { Prisma, Unit } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  transformCuttingBatch,
  generateBatchNumber,
  generateTransferSlipNumber,
  batchIncludeOptions,
  dedupeSkuRows,
  buildBatchFabricRows,
  dedupeChartEntries,
  splitFabricReservation,
} from './cutting.utils';
import { countsForPurposeAverage } from '../services/helpers/cad-status.helper';
import { syncBomFabricId } from '../services/order-bom.service';
import { calculateCadAverage } from './cad-planning.utils';
import { createChallan, issueChallan, createFabricReturnChallan } from '../services/challan.service';
import { maxCutForSize, maxCutBySize, fabricCutBySize, MAX_EXTRA_CUT_PERCENT } from '../utils/cut-allowance';
import { logInfo, logError, logWarn } from '../utils/logger';
import { productionBlockingValidationService } from '../services/productionBlockingValidation.service';
// BUG-CUT5 fix: Import decimal.js utilities for precision calculations
import { toCurrency, subtractCurrency, divideCurrency, toNumber } from '../utils/currency';
import { batchFabricAtCutting, batchIssuedFabric, getRunFabricPosition } from '../services/helpers/run-fabric.helper';
import { applySearch } from '../utils/search-filter';
import { toDateInputValue } from '../utils/date';
import { notInProcessorUnitWhere } from '../services/helpers/lot-location.helper';

// Re-export sub-controllers so existing imports from routes continue to work
export { addCuttingLay, getCuttingLays, deleteCuttingLay } from './cutting-lay.controller';
export { issueToStitching, getStitchingIssues } from './cutting-issue.controller';

/**
 * Send back to the store whatever went out FOR this batch and has not come back (owner rule
 * 2026-09-24: fabric is issued for a cutting batch; deleting the batch returns it). Written as a
 * proper return challan from Cutting, so the lot, stock_levels and the run's fabric position
 * (run-fabric.helper.ts) all agree. Fabric issued to the run before issues carried a batch stays
 * with the run for its next batch.
 */
async function returnBatchFabricToStore(
  batch: { id: string; batchNumber: string; workOrderId: string },
  userId: string | null,
  why: string
): Promise<Array<{ fabricStockId: string; quantityRestored: number }>> {
  const outstanding = await batchFabricAtCutting(batch.id, batch.workOrderId);
  const items = [...outstanding]
    .filter(([, qty]) => qty > 0)
    .map(([fabricStockId, quantity]) => ({
      fabricStockId,
      quantity,
      description: `Returned — batch ${batch.batchNumber} ${why}`,
    }));
  if (items.length === 0) return [];
  if (!userId) throw new ValidationError('A signed-in user is needed to return fabric to the store.');
  const challan = await createFabricReturnChallan({
    workOrderId: batch.workOrderId,
    cuttingBatchId: batch.id,
    issuedById: userId,
    items,
    remarks: `Fabric returned to store — cutting batch ${batch.batchNumber} ${why}`,
  });
  logInfo(`[Cutting] ${batch.batchNumber} ${why}: fabric returned on ${challan.challanNumber}`);
  return items.map((i) => ({ fabricStockId: i.fabricStockId, quantityRestored: i.quantity }));
}

// ============================================
// List Cutting Batches
// ============================================

export const getAllCuttingBatches = async (req: Request, res: Response) => {
  const { page = 1, limit = 20, search, status, workOrderId, componentId, fromDate, toDate } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Prisma.cutting_batchesWhereInput = {};

  if (search) {
    applySearch(where, String(search), [
      'batchNumber',
      'workOrder.workOrderNumber',
      'workOrder.styles.styleCode',
      'workOrder.styles.buyerStyleRef',
      'workOrder.styles.styleName',
    ]);
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
    select: { id: true, workOrderNumber: true, status: true, orderId: true, styleId: true },
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

  // No size may be cut past its order + the buyer's allowance (5 %, rounded down), counting what
  // this run's other batches already plan for it (owner rule 2026-09-24)
  {
    const [breakupRows, otherBatchSkus] = await Promise.all([
      prisma.work_order_breakup.findMany({
        where: { workOrderId },
        select: { sizeId: true, plannedQuantity: true, size_options: { select: { sizeName: true } } },
      }),
      prisma.cutting_batch_skus.findMany({
        where: { cuttingBatch: { workOrderId, isActive: true } },
        select: { sizeId: true, toCut: true },
      }),
    ]);
    if (breakupRows.length > 0) {
      const orderedBySize = new Map<string, { qty: number; name: string }>();
      for (const r of breakupRows) {
        const e = orderedBySize.get(r.sizeId) ?? { qty: 0, name: r.size_options.sizeName };
        e.qty += r.plannedQuantity;
        orderedBySize.set(r.sizeId, e);
      }
      const plannedBySize = new Map<string, number>();
      for (const s of otherBatchSkus) plannedBySize.set(s.sizeId, (plannedBySize.get(s.sizeId) ?? 0) + s.toCut);
      for (const sku of skuOutputs as Array<{ sizeId: string; toCut?: number; plannedQty?: number }>) {
        plannedBySize.set(
          sku.sizeId,
          (plannedBySize.get(sku.sizeId) ?? 0) + (Number(sku.toCut) || Number(sku.plannedQty) || 0)
        );
      }
      const over = [...plannedBySize]
        .filter(([sizeId]) => orderedBySize.has(sizeId))
        .map(([sizeId, planned]) => ({ ...orderedBySize.get(sizeId)!, planned }))
        .filter((s) => s.planned > maxCutForSize(s.qty));
      if (over.length > 0) {
        throw new ValidationError(
          `More than the order + ${MAX_EXTRA_CUT_PERCENT}% allowance: ` +
            over
              .map((s) => `${s.name} ${s.planned} pcs (at most ${maxCutForSize(s.qty)} for ${s.qty} ordered)`)
              .join(', ') +
            '. Lower the Extra % or the quantities to cut.'
        );
      }
    }
  }

  // Validate cadAverageUsed is present and > 0 (must come from PRODUCTION CAD planning)
  if (!cadAverageUsed || Number(cadAverageUsed) <= 0) {
    throw new ValidationError(
      'CAD average is required and must be greater than 0. Complete PRODUCTION CAD planning first.'
    );
  }

  // The width is NOT NULL on the batch, but the Cutting Chart page only knows it when the lot
  // carries one (it sends 0 otherwise). Resolve it here — request, then the lot's finished width,
  // then the CAD cutable width — and refuse readably instead of letting Prisma answer "Invalid data
  // provided to database" (T4-B, 2026-09-17). Lays are recorded after the batch exists, so 0 is
  // the honest value for layersPerLay/numberOfLays at creation.
  const lot = await prisma.fabric_stock.findUnique({
    where: { id: fabricStockId },
    select: { id: true, finishedWidth: true },
  });
  if (!lot) {
    throw new ValidationError('Fabric lot not found');
  }
  const resolvedWidth =
    Number(actualFabricWidth) > 0
      ? Number(actualFabricWidth)
      : Number(lot.finishedWidth) > 0
        ? Number(lot.finishedWidth)
        : Number(cadWidthUsed) > 0
          ? Number(cadWidthUsed)
          : 0;
  if (resolvedWidth <= 0) {
    throw new ValidationError(
      'The fabric width is not known — record the finished width on the fabric lot (or the cutable width on the Production CAD) before cutting.'
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
      actualFabricWidth: resolvedWidth,
      cadAverageUsed,
      cadWidthUsed: cadWidthUsed || resolvedWidth,
      layersPerLay: layersPerLay ?? 0,
      numberOfLays: numberOfLays ?? 0,
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
          // The order and the extra on top of it are kept apart: a caller that sent only the total
          // (plannedQty) had its Extra % recorded as ORDER quantity with extra 0 (2026-09-24).
          ((skuOutputs || []) as any[]).map((sku: any) => {
            const toCut = sku.toCut || sku.plannedQty;
            const orderQty = sku.orderQty || toCut;
            return {
              colorId: sku.colorId || null,
              sizeId: sku.sizeId,
              orderQty,
              extraAllowed: sku.extraAllowed ?? Math.max(0, toCut - orderQty),
              // Never below what is planned — a max under the plan would read as over-cutting
              maxCuttable: Math.max(sku.maxCuttable || 0, toCut),
              toCut,
              cutQty: 0,
              rejectedQty: 0,
              goodPcs: 0,
            };
          }),
          ['orderQty', 'extraAllowed', 'maxCuttable', 'toCut']
        ),
      },
    },
    include: batchIncludeOptions,
  });

  // Record every fabric lot this batch will consume — the PRIMARY one included.
  //
  // Completion sums fabric issued by walking cutting_batch_fabrics and looking each lot up in the
  // challan-derived issuedMap. A lot that has no row here is invisible to that sum, so its issued
  // metres are never counted. CuttingForm sends no `fabricStocks`, so its batches had no rows at
  // all: even a correctly issued fabric challan left totalFabricIssued at 0 and the completion
  // guard blocked the batch for ever. Seeding the primary lot is what makes manual issuance work.
  const batchFabricRows = buildBatchFabricRows(
    batch.id,
    { fabricStockId, cadAvgUsed: cadAverageUsed, cadWidthUsed, actualWidth: resolvedWidth },
    fabricStocks
  );
  if (batchFabricRows.length > 0) {
    // @@unique([batchId, fabricStockId]) + skipDuplicates makes the primary/extra overlap harmless.
    await prisma.cutting_batch_fabrics.createMany({ data: batchFabricRows, skipDuplicates: true });
  }

  // P6.1.2: Reserve fabric stock for this cutting batch (prevents double-booking across WOs)
  try {
    const totalPiecesToCut = (skuOutputs as Array<{ toCut?: number; plannedQty?: number }>).reduce(
      (sum, s) => sum + (Number(s.toCut) || Number(s.plannedQty) || 0),
      0
    );

    // Keyed by stockId so one batch can never emit two reservation rows for the same roll — which
    // would now hit the (cuttingBatchId, stockId) unique key. First cadAvg wins.
    const stocksToReserve = new Map<string, number | null>();
    if (fabricStockId) {
      stocksToReserve.set(fabricStockId, cadAverageUsed ? Number(cadAverageUsed) : null);
    }
    for (const fs of (fabricStocks || []) as Array<{ fabricStockId: string; cadAvgUsed?: number }>) {
      if (fs.fabricStockId && !stocksToReserve.has(fs.fabricStockId)) {
        stocksToReserve.set(fs.fabricStockId, fs.cadAvgUsed ? Number(fs.cadAvgUsed) : null);
      }
    }

    // Split each fabric's need across its lots, never more than a lot holds (in store + at Cutting
    // for this run) — the whole need used to be written on EVERY lot (cutting.utils.ts)
    const lotRows = await prisma.fabric_stock.findMany({
      where: { id: { in: [...stocksToReserve.keys()] } },
      select: { id: true, fabricId: true, quantityAvailable: true, status: true },
    });
    const lotById = new Map(lotRows.map((l) => [l.id, l]));
    const position = await getRunFabricPosition([workOrder.id]);
    const shares = splitFabricReservation(
      totalPiecesToCut,
      [...stocksToReserve].map(([stockId, cadAvg]) => {
        const lot = lotById.get(stockId);
        const inStore = lot && lot.status === 'AVAILABLE' ? Number(lot.quantityAvailable) : 0;
        return {
          stockId,
          fabricId: lot?.fabricId ?? null,
          cadAvg,
          capacity: inStore + (position.lots.get(stockId)?.atCutting ?? 0),
        };
      })
    );

    for (const { stockId, quantity: quantityToAllocate, cadAvg } of shares) {
      if (workOrder.orderId) {
        try {
          await prisma.fabric_stock_allocation.create({
            data: {
              stockId,
              orderId: workOrder.orderId,
              styleId: workOrder.styleId,
              // The batch is the allocation's identity. Without it, completion matched on
              // (stock, order, style, RESERVED) — which is EVERY batch's reservation on that roll.
              cuttingBatchId: batch.id,
              quantityAllocated: quantityToAllocate,
              plannedCad: cadAvg,
              allocationStatus: 'RESERVED',
              allocationType: 'SAME_STYLE',
              createdById: userId,
            },
          });
          logInfo(
            `Reserved ${quantityToAllocate.toFixed(2)}m of fabric stock ${stockId} for batch ${batch.batchNumber}`
          );
        } catch (reserveError) {
          // allow-swallow — reservation is advisory, not blocking; batch creation must succeed.
          // Per-stock so one roll's failure cannot abandon the remaining reservations.
          logWarn(
            `Warning: Fabric reservation failed for batch ${batch.batchNumber}, stock ${stockId}: ${(reserveError as Error).message}`
          );
        }
      }
    }
  } catch (reserveError) {
    // allow-swallow — reservation is advisory, not blocking; batch creation must succeed
    logWarn(`Warning: Fabric reservation failed for batch ${batch.batchNumber}: ${(reserveError as Error).message}`);
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

  // P6.2.2: Auto-create production_tracking: IN_CUTTING with 0 (stage started, not yet produced)
  // Actual output is tracked when recordCuttingOutput is called
  try {
    await prisma.production_tracking.create({
      data: {
        id: randomUUID(),
        workOrderId,
        productionStage: 'IN_CUTTING',
        quantityCompleted: 0,
        updatedById: userId,
        updateDate: new Date(),
        remarks: `Cutting batch ${batch.batchNumber} started`,
      },
    });
  } catch (err) {
    // allow-swallow — pure timeline production_tracking entry; must not fail the already-created cutting batch
    logInfo(
      `Warning: Auto production_tracking failed for cutting batch ${batch.batchNumber}: ${(err as Error).message}`
    );
  }

  // Fabric is NOT auto-issued (owner decision, 2026-09-01). Stock moves only when a human issues a
  // challan.
  //
  // The auto-issue that used to sit here never actually ran: it sized the requirement from
  // `cutQuantity`, a field no screen has ever sent, so the piece count was always 0, every lot hit
  // the "cannot calculate need" skip, and the batch reported plain success. Fabric was cut while the
  // books still showed it in the store.
  //
  // Repairing only the count would have switched on a stock movement that has never executed in this
  // installation, and it carried two live hazards: the requirement was computed PER LOT with no
  // running remainder, so two rolls of one fabric would each be issued the full amount; and deleting
  // such a batch restores nothing, so the metres would simply vanish. Manual challan issuance is an
  // existing, audited path, and it is already what the completion guard tells the user to do.
  //
  // The batch records which fabric lots it expects (cutting_batch_fabrics above), so a manually
  // issued challan is matched and counted at completion.
  //
  // Point at the run's Fabric Issuance (2026-09-25): it issues FOR this batch (challans.cuttingBatchId),
  // so deleting the batch returns the fabric. A challan raised from Procurement → Challans carries no
  // batch — the old message sent the cutter there.
  res.status(201).json({
    data: transformCuttingBatch(batch),
    message: 'Cutting batch created successfully',
    warning:
      batchFabricRows.length > 0
        ? `Fabric is not issued yet. On production run ${workOrder.workOrderNumber}, open Fabric Issuance, tick the lots and click Issue to Cutting — it is issued for this batch. Completing the batch is blocked until then.`
        : undefined,
  });
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

  // Nothing has been laid (checked above), so everything issued for this batch is still whole:
  // it goes back to the store on a return challan before the batch disappears.
  const deleteUserId = req.user?.userId ?? null;
  const fabricsRestored = await returnBatchFabricToStore(existing, deleteUserId, 'deleted');

  await prisma.$transaction(async (tx) => {
    // Release this batch's fabric reservations before it disappears. The FK is ON DELETE SET NULL,
    // so without this the rows survive as RESERVED with no owner — and a later batch's completion
    // would sweep them up. `id` is a validated route param proven to exist by the findUnique above,
    // so this can never degenerate into an unfiltered match.
    await tx.fabric_stock_allocation.updateMany({
      where: { cuttingBatchId: id },
      data: { allocationStatus: 'RELEASED', consumptionDate: new Date() },
    });

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
  const userId = req.user?.userId;
  const { skuOutputs, defects, fabricConsumed, remarks } = req.body;

  const existing = await prisma.cutting_batches.findUnique({
    where: { id },
    select: { status: true, workOrderId: true },
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

  // P6.2.2: Update production_tracking with actual cut output
  try {
    if (existing.workOrderId && userId) {
      // Calculate total good pieces cut from the updated SKU outputs
      const totalGoodPieces = (skuOutputs || []).reduce(
        (sum: number, sku: any) => sum + ((Number(sku.cutQty) || 0) - (Number(sku.rejectedQty) || 0)),
        0
      );

      await prisma.production_tracking.create({
        data: {
          id: randomUUID(),
          workOrderId: existing.workOrderId,
          productionStage: 'IN_CUTTING',
          quantityCompleted: totalGoodPieces,
          updatedById: userId,
          updateDate: new Date(),
          remarks: `Cutting output recorded: ${totalGoodPieces} good pieces`,
        },
      });
    }
  } catch (trackingError) {
    // allow-swallow — tracking update is advisory; output record must succeed
    logInfo(`Warning: Failed to update production_tracking for cutting output: ${(trackingError as Error).message}`);
  }

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

  // The fabric THIS batch accounts for: issued for it less anything already returned
  // (run-fabric.helper.ts) — not the run's gross issue, which every batch on the run used to claim
  const issuedMap = await batchIssuedFabric(existing.id, existing.workOrderId);

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

  // P6.1.3: Block completion if no fabric was ever issued (prevents silent production without material tracking)
  const legacyFabricConsumed = Number(existing.fabricConsumed) || 0;
  if (totalFabricIssued === 0 && legacyFabricConsumed === 0) {
    throw new ValidationError(
      'Cannot complete batch: No fabric issue recorded. Issue the fabric for this batch from the production run — Fabric Issuance → Issue to Cutting — then complete it.'
    );
  }

  // If no challans found (legacy), fall back to lay-based fabricConsumed
  const consumptionForAvg = totalFabricIssued > 0 ? totalActualConsumption : legacyFabricConsumed;

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

  // Ledger discrepancies are reported with the response rather than only logged.
  const allocationWarnings: string[] = [];

  // P6.1.2: Update fabric allocations to consumed status with actual consumption
  try {
    const workOrder = await prisma.work_orders.findUnique({
      where: { id: existing.workOrderId },
      select: { orderId: true, styleId: true },
    });

    if (workOrder?.orderId) {
      // Get all fabric stock IDs for this batch
      // CuttingChart sends the primary lot inside `fabricStocks` as well, so without the Set the
      // primary was processed twice.
      const allStockIds = [
        ...new Set(
          [existing.fabricStockId, ...existing.additionalFabrics.map((f) => f.fabricStockId)].filter(
            Boolean
          ) as string[]
        ),
      ];

      for (const stockId of allStockIds) {
        // Find the allocation for this stock and order, update it to CONSUMED
        const consumed = issuedMap.get(stockId) || 0;
        const returned = returnMap.get(stockId) || 0;
        const actualConsumed = Math.max(0, consumed - returned);

        // Scoped to THIS batch. The old key was (stockId, orderId, styleId, RESERVED), which matched
        // every batch's reservation on that roll: batch 1's consumption was stamped onto batch 2's
        // untouched row, and when batch 2 completed it found nothing RESERVED and recorded nothing
        // at all — the ledger over-counted the first cut and lost every later one. The status filter
        // is gone too; the batch id IS the identity, and keeping it would silently skip a
        // re-completion.
        const result = await prisma.fabric_stock_allocation.updateMany({
          where: { cuttingBatchId: existing.id, stockId },
          data: {
            allocationStatus: 'CONSUMED',
            quantityConsumed: actualConsumed,
            quantityReturned: returned,
            actualCad: calcActualAverage || undefined,
            consumptionDate: new Date(),
          },
        });

        // count 0 is legitimate (a batch whose CAD average was 0 reserved nothing), so this must not
        // throw and block a real factory completion. But it must not be invisible either — an
        // unchecked updateMany count is exactly what let the fan-out run unnoticed.
        if (result.count !== 1) {
          logWarn(
            `[Cutting ${existing.batchNumber}] allocation update matched ${result.count} row(s) for stock ${stockId} (expected 1)`
          );
          allocationWarnings.push(
            `Fabric allocation for lot ${stockId} was not updated as expected (${result.count} matching rows). Check the fabric usage report.`
          );
        }
      }
    }
  } catch (allocError) {
    // allow-swallow — allocation consumption update is advisory; batch completion must succeed
    logWarn(
      `Warning: Fabric allocation update failed for batch ${batch.batchNumber}: ${(allocError as Error).message}`
    );
  }

  // P6.1.4: Trim backflush - auto-consume trims/threads based on BOM per-garment × good pieces
  try {
    const workOrder = await prisma.work_orders.findUnique({
      where: { id: existing.workOrderId },
      select: { orderId: true, styleId: true },
    });

    if (workOrder?.orderId && workOrder.styleId) {
      // Get the approved BOM for this order/style
      const orderBom = await prisma.order_bom.findFirst({
        where: {
          orderId: workOrder.orderId,
          styleId: workOrder.styleId,
          isActive: true,
          status: { in: ['APPROVED', 'LOCKED'] },
        },
        include: {
          items: {
            where: {
              materialType: { in: ['THREAD', 'BUTTON', 'ZIPPER', 'ELASTIC', 'SNAP_BUTTON', 'HOOK_EYE'] },
            },
          },
        },
      });

      if (orderBom?.items && orderBom.items.length > 0) {
        const trimChallanItems: Array<{
          itemType: string;
          description: string;
          quantity: number;
          unit: string;
          threadStockId?: string;
          materialId?: string;
        }> = [];

        for (const bomItem of orderBom.items) {
          const perGarment = Number(bomItem.quantityPerGarment) || 0;
          if (perGarment <= 0) continue;

          const consumption = totalCut * perGarment;
          if (consumption <= 0) continue;

          // For THREAD items, find an available thread_stock
          if (bomItem.materialType === 'THREAD' && bomItem.threadId) {
            const threadStock = await prisma.thread_stock.findFirst({
              where: { threadId: bomItem.threadId, quantityAvailable: { gt: 0 } },
              orderBy: { quantityAvailable: 'desc' },
              select: { id: true, threadId: true },
            });

            if (threadStock) {
              trimChallanItems.push({
                itemType: 'THREAD',
                description: `Thread consumption for batch ${batch.batchNumber}`,
                quantity: Math.round(consumption * 100) / 100,
                unit: bomItem.unit || 'METER',
                threadStockId: threadStock.id,
              });
            }
          }

          // Log other trim types for future implementation
          if (['BUTTON', 'ZIPPER', 'ELASTIC', 'SNAP_BUTTON', 'HOOK_EYE'].includes(bomItem.materialType)) {
            logInfo(
              `Trim backflush: ${bomItem.materialType} - ${consumption.toFixed(2)} ${bomItem.unit} needed for batch ${batch.batchNumber} (manual deduction required)`
            );
          }
        }

        // Create challan for thread consumption if any
        if (trimChallanItems.length > 0) {
          const trimChallan = await createChallan({
            challanType: 'INTERNAL',
            challanDate: new Date(),
            orderId: workOrder.orderId,
            productionRunId: existing.workOrderId,
            fromType: 'DEPARTMENT',
            fromName: 'Thread Store',
            toType: 'DEPARTMENT',
            toName: 'Cutting',
            remarks: `Auto-consumed trims for cutting batch ${batch.batchNumber} completion`,
            issuedById: req.user?.userId || existing.createdById,
            items: trimChallanItems,
          });
          await issueChallan(trimChallan.id, req.user?.userId || existing.createdById);
          logInfo(
            `Auto-issued trim challan ${trimChallan.challanNumber} for ${trimChallanItems.length} items at batch ${batch.batchNumber} completion`
          );
        }
      }
    }
  } catch (trimError) {
    // allow-swallow — trim backflush is advisory; batch completion must succeed
    logInfo(`Warning: Trim backflush failed for batch ${batch.batchNumber}: ${(trimError as Error).message}`);
  }

  res.json({
    data: transformCuttingBatch(batch),
    ...(allocationWarnings.length > 0 && { warnings: allocationWarnings }),
  });
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

  // Issued for this batch, less returns (run-fabric.helper.ts)
  const issuedMap = await batchIssuedFabric(batch.id, batch.workOrderId);

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
      lays: { select: { id: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError('CuttingBatch', id);
  }

  if (existing.status === 'COMPLETED') {
    throw new ValidationError('Cannot cancel completed batches');
  }

  // Nothing laid → everything issued for the batch is still whole and goes back to the store.
  // Once lays exist, fabric has been cut: it is NOT put back (the old restore credited cut metres
  // to the store, and the primary lot twice) — the leftover is returned at completion.
  const cancelUserId = req.user?.userId ?? null;
  const fabricsRestored =
    existing.lays.length === 0 ? await returnBatchFabricToStore(existing, cancelUserId, 'cancelled') : [];

  const batch = await prisma.$transaction(async (tx) => {
    // Release this batch's fabric reservations. Cancel sets ON_HOLD rather than CANCELLED, so
    // without this a "cancelled" batch keeps a RESERVED row that a later batch's completion would
    // sweep up — the easiest way to reproduce the fan-out.
    await tx.fabric_stock_allocation.updateMany({
      where: { cuttingBatchId: id },
      data: { allocationStatus: 'RELEASED', consumptionDate: new Date() },
    });

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

  // Generate slip number — race-safe seeded sequence (bug-hunt production-17)
  const today = new Date();
  const slipNumber = await generateTransferSlipNumber();

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
      // Not fabric lying at a processor's unit — it cannot be cut here (Phase 4a)
      ...notInProcessorUnitWhere(),
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
            select: { cutQty: true, goodPcs: true, colorId: true, sizeId: true, toCut: true },
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
    // The most this size may be cut against the order: order + the buyer's allowance, rounded down
    allowanceCutQty: maxCutForSize(s.orderQty),
    // Max Cuttable for this size — the lower of the fabric and the allowance; filled in below
    maxCutQty: maxCutForSize(s.orderQty),
    // What the fabric alone can make of this size (null = no fabric limit known); filled in below
    fabricCutQty: null as number | null,
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
    // Deterministic: without it the iteration order below is Postgres heap order, so WHICH CAD
    // average won a collision changed between identical requests.
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      styleFabricId: true,
      componentName: true,
      purpose: true,
      purposeEnum: true,
      // allow-cad-approval — cutting consumes CAD GEOMETRY, so this is the right approval to prefer.
      // Never filter on costingApprovalStatus here: that is the PRICE approval and it is NULL on
      // every PRODUCTION row, so filtering on it would empty the cutting chart.
      approvalStatus: true,
      isPreferred: true,
      updatedAt: true,
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
    // A rejected row is repaired into nothing: no slot link, no BOM fabric, no average
    if (cad.approvalStatus === 'REJECTED') continue; // allow-cad-approval

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

    // Sync BOM fabricId — only from a Production CAD someone approved
    if (
      cadPurpose === 'PRODUCTION' &&
      cad.approvalStatus === 'APPROVED' && // allow-cad-approval
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
      /** Which style_fabric this row came from — null for rows enriched from BOM/style data. */
      styleFabricId: string | null;
      /** Best rank seen so far per purpose, so a weaker CAD row can never displace a stronger one. */
      rank: Partial<Record<'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION', number>>;
    }
  >();

  // Collisions are reported, never resolved in silence.
  const warnings: string[] = [];

  for (const cad of cadRows) {
    // Resolve fabricId: direct -> styleFabric fallback
    const resolvedFabricId = cad.fabricId || cad.styleFabric?.fabricId || null;
    // Display name: component name for the UI "Part" column
    const displayName = cad.styleFabric?.style_components?.componentName || cad.componentName;
    if (!displayName) continue; // Skip orphan CAD rows with no component linkage
    // Key by fabricId to prevent collision when two fabrics share the same componentName
    // Identity, not name. `resolvedFabricId || displayName` degraded to the COMPONENT NAME for
    // every greige-sourced style (fabricId is NULL on the great majority of style_fabrics), so two
    // CAD rows belonging to two DIFFERENT style_fabrics on the same component shared one entry and
    // the second silently overwrote the first — the chart then planned one average where two
    // different fabrics were needed. One style_fabric is one distinct fabric usage, so key on it.
    const partKey = cad.styleFabricId ?? resolvedFabricId ?? `cad:${cad.id}`;
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
        styleFabricId: cad.styleFabricId ?? null,
        rank: {},
      });
    }

    const entry = partMap.get(partKey)!;
    const width = cad.cutableWidth ? Number(cad.cutableWidth) : null;
    const avg = cad.cadAverage ? Number(cad.cadAverage) : null;

    const cadPurpose = cad.purposeEnum || cad.purpose;
    // A pending or rejected Production CAD still puts its fabric on the chart (entry above) but
    // never supplies the Production average — cutting needs an approved one (2026-09-23)
    if (
      (cadPurpose === 'COSTING' || cadPurpose === 'RAW_MATERIAL_CALCULATION' || cadPurpose === 'PRODUCTION') &&
      countsForPurposeAverage(cadPurpose, cad.approvalStatus)
    ) {
      // Rank the candidate rather than letting the last one seen win. Higher is better:
      // a row that HAS an average always beats one that does not (a value-less row may never erase
      // a real one), then an approved row, then the preferred row. Ties fall to the deterministic
      // query order above.
      const candidateRank =
        (avg !== null ? 4 : 0) + (cad.approvalStatus === 'APPROVED' ? 2 : 0) + (cad.isPreferred ? 1 : 0);
      const currentRank = entry.rank[cadPurpose];
      const field = (
        {
          COSTING: ['costingWidth', 'costingAverage'],
          RAW_MATERIAL_CALCULATION: ['rawMatCalcWidth', 'rawMatCalcAverage'],
          PRODUCTION: ['productionWidth', 'productionAverage'],
        } as const
      )[cadPurpose];

      if (currentRank === undefined || candidateRank > currentRank) {
        const previous = entry[field[1]] as number | null;
        if (previous !== null && avg !== null && Math.abs(previous - avg) > 1e-4) {
          warnings.push(
            `${displayName}${resolvedFabricName ? ` (${resolvedFabricName})` : ''}: ${cadPurpose} has more than one CAD option ` +
              `(${previous} m and ${avg} m per piece). Using ${avg} m. Resolve it in CAD Planning.`
          );
        }
        (entry[field[0]] as number | null) = width;
        (entry[field[1]] as number | null) = avg;
        entry.rank[cadPurpose] = candidateRank;
      } else if (avg !== null && entry[field[1]] !== null && Math.abs((entry[field[1]] as number) - avg) > 1e-4) {
        warnings.push(
          `${displayName}${resolvedFabricName ? ` (${resolvedFabricName})` : ''}: ${cadPurpose} has more than one CAD option ` +
            `(${entry[field[1]]} m and ${avg} m per piece). Using ${entry[field[1]]} m. Resolve it in CAD Planning.`
        );
      }
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
              // Enrichment row, not CAD-derived: null provenance lets it still attach by name to a
              // real CAD entry, which is exactly what this branch exists to do.
              styleFabricId: null,
              rank: {},
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
            // Enrichment row, not CAD-derived — see the 3b note above.
            styleFabricId: null,
            rank: {},
          });
        }
      }
    }
  }

  // --- Deduplicate entries that share the same fabric ---
  // Extracted to cutting.utils so the rule can be tested without standing up a work order.
  const { fabrics, warnings: dedupeWarnings } = dedupeChartEntries(Array.from(partMap.values()));
  warnings.push(...dedupeWarnings);

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

  // The run's fabric position (run-fabric.helper.ts): lots issued to this run with what is still at
  // Cutting, plus the store lots of its fabrics. Before this, a full issue made the chart switch to
  // "issued lots only" — a part not yet issued dropped to 0 — and return challans added to "issued".
  const position = await getRunFabricPosition([workOrderId]);
  const runLots = [...position.lots.values()].filter((l) => l.issued - l.returned > 0.005);
  const stockSelect = {
    id: true,
    fabricId: true,
    rollNumbers: true,
    cutableWidth: true,
    quantityAvailable: true,
    qualityGrade: true,
    plannedCad: true,
    actualCad: true,
    status: true,
  } as const;

  const fabricStockRecords = await prisma.fabric_stock.findMany({
    where: {
      OR: [
        // Store lots — never fabric lying at a processor's unit (Phase 4a: only that processor's job draws it)
        {
          fabricId: { in: uniqueFabricIds },
          quantityAvailable: { gt: 0 },
          status: 'AVAILABLE',
          ...notInProcessorUnitWhere(),
        },
        ...(runLots.length > 0 ? [{ id: { in: runLots.map((l) => l.fabricStockId) } }] : []),
      ],
    },
    select: stockSelect,
    orderBy: { receivedDate: 'desc' },
  });
  /** In the store (free to issue) */
  const inStoreOf = (s: (typeof fabricStockRecords)[0]) => (s.status === 'AVAILABLE' ? Number(s.quantityAvailable) : 0);
  /** On the cutting floor for this run, not yet used */
  const atCuttingOf = (id: string) => position.lots.get(id)?.atCutting ?? 0;
  /** Everything this run holds or has used from the lot — the basis of the RUN's Max Cuttable */
  const runHeldOf = (id: string) => {
    const l = position.lots.get(id);
    return l ? Math.max(0, l.issued - l.returned) : 0;
  };

  const fabricStockMap = new Map<string, typeof fabricStockRecords>();
  for (const fs of fabricStockRecords) {
    if (!fabricStockMap.has(fs.fabricId)) {
      fabricStockMap.set(fs.fabricId, []);
    }
    fabricStockMap.get(fs.fabricId)!.push(fs);
  }

  // Two surviving rows can now legitimately share a component name (that is the whole point of the
  // provenance rule). Give each a distinct label, or FabricIssuanceSection's `new Set(part)` and the
  // bare-string bottleneckFabric quietly collapse them back into one.
  const nameCounts = new Map<string, number>();
  for (const f of fabrics) nameCounts.set(f.part, (nameCounts.get(f.part) ?? 0) + 1);
  const nameSeen = new Map<string, number>();
  for (const f of fabrics) {
    if ((nameCounts.get(f.part) ?? 0) < 2) continue;
    const n = (nameSeen.get(f.part) ?? 0) + 1;
    nameSeen.set(f.part, n);
    const width = f.productionWidth ?? f.rawMatCalcWidth ?? f.costingWidth;
    f.part = width ? `${f.part} (${width}")` : f.fabricName ? `${f.part} — ${f.fabricName}` : `${f.part} #${n}`;
  }

  // A stable per-row identity for the UI to key on. `fabricId || part` collided for exactly the
  // rows this fix separates.
  const partKeyOf = (f: (typeof fabrics)[0]) => f.styleFabricId ?? f.fabricId ?? f.part;

  // 5. Build fabric details array (per part)
  const fabricDetails = fabrics.map((f) => {
    const ordered = f.fabricId ? fabricOrderedMap.get(f.fabricId) || 0 : 0;
    const received = f.fabricId ? fabricReceivedMap.get(f.fabricId) || 0 : 0;
    const stocks = f.fabricId ? fabricStockMap.get(f.fabricId) || [] : [];
    const cutableQty = stocks.reduce((sum, s) => sum + inStoreOf(s) + atCuttingOf(s.id), 0);

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
  // Each lot shows what is physically there for this run: in the store + at Cutting
  const fabricsWithLots = fabrics.map((f) => {
    const stocks = f.fabricId ? fabricStockMap.get(f.fabricId) || [] : [];
    return {
      ...f,
      partKey: partKeyOf(f),
      lots: stocks.map((s, idx) => ({
        lotId: s.id,
        lotNumber: idx + 1,
        rollNumbers: s.rollNumbers || '',
        actualWidth: Number(s.cutableWidth),
        quantityAvailable: inStoreOf(s) + atCuttingOf(s.id),
        inStore: inStoreOf(s),
        atCutting: atCuttingOf(s.id),
        qualityGrade: s.qualityGrade,
      })),
    };
  });

  // 6b. Per-fabric stock analysis — calculate max cuttable pcs (Production CAD only)
  const fabricAnalysis = fabrics.map((f) => {
    const stocks = f.fabricId ? fabricStockMap.get(f.fabricId) || [] : [];
    // The run's fabric: in the store + everything issued to it and not returned (what its batches have
    // used included — their pieces are counted as already planned, per size, below)
    const availableStock = stocks.reduce((sum, s) => sum + inStoreOf(s) + runHeldOf(s.id), 0);
    const atCutting = stocks.reduce((sum, s) => sum + atCuttingOf(s.id), 0);
    const inStore = stocks.reduce((sum, s) => sum + inStoreOf(s), 0);
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
      atCutting,
      inStore,
      maxPcsFromStock: maxPcs,
      requiredForOrder: requiredMeters,
      shortfallMeters,
    };
  });

  // Max cuttable = min across all fabrics with Production CAD set
  const fabricsWithCad = fabricAnalysis.filter((fa) => fa.cadSet && fa.maxPcsFromStock !== null);
  const maxFromFabric = fabricsWithCad.length > 0 ? Math.min(...fabricsWithCad.map((fa) => fa.maxPcsFromStock!)) : null;
  // Owner rule (2026-09-24): Max Cuttable is the LOWER of what the fabric can make and the order +
  // the buyer's allowance (5 % per size, rounded down)
  const maxFromAllowance =
    sizesWithRatio.length > 0
      ? sizesWithRatio.reduce((sum, s) => sum + s.allowanceCutQty, 0)
      : maxCutForSize(totalOrderQty);
  const maxCutLimitedBy: 'FABRIC' | 'ALLOWANCE' =
    maxFromFabric !== null && maxFromFabric < maxFromAllowance ? 'FABRIC' : 'ALLOWANCE';
  const maxCuttablePcs = maxCutLimitedBy === 'FABRIC' ? maxFromFabric! : maxFromAllowance;
  // Per size: the fabric's pieces shared in the order ratio, none past its allowance
  const perSizeMax = maxCutBySize(
    sizesWithRatio.map((s) => s.orderQty),
    maxFromFabric
  );
  // Both limits are SHOWN side by side (owner, 2026-09-25): order + allowance, and what the fabric
  // alone can make (its pieces in the order ratio, not capped) — "to cut" stays within the lower
  const perSizeFabric = fabricCutBySize(
    sizesWithRatio.map((s) => s.orderQty),
    maxFromFabric
  );
  sizesWithRatio.forEach((s, i) => {
    s.maxCutQty = perSizeMax[i];
    s.fabricCutQty = perSizeFabric ? perSizeFabric[i] : null;
  });
  // What the run's batches already plan per size (completed: what was cut; open: what is to be cut),
  // so a NEW batch is offered only the rest — of the allowance and of Max Cuttable
  const plannedBySize = new Map<string, number>();
  for (const b of workOrder.cutting_batches) {
    for (const sku of b.skuOutputs) {
      const qty = b.status === 'COMPLETED' ? sku.cutQty : sku.toCut;
      plannedBySize.set(sku.sizeId, (plannedBySize.get(sku.sizeId) ?? 0) + (qty || 0));
    }
  }
  const sizesForNewBatch = sizesWithRatio.map((s) => {
    const alreadyPlanned = plannedBySize.get(s.sizeId) ?? 0;
    return {
      ...s,
      alreadyPlanned,
      allowanceRemaining: Math.max(0, s.allowanceCutQty - alreadyPlanned),
      maxCutRemaining: Math.max(0, s.maxCutQty - alreadyPlanned),
    };
  });
  const maxCuttableNewBatchPcs = sizesForNewBatch.reduce((sum, s) => sum + s.maxCutRemaining, 0);

  // Identify the bottleneck fabric (lowest max pcs) — only when the fabric, not the allowance, limits
  const bottleneckFabric =
    maxCutLimitedBy === 'FABRIC' && fabricsWithCad.length > 0
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
    styleId: workOrder.styleId,
    buyerStyleRef: workOrder.styles?.buyerStyleRef ?? null,
    styleName: workOrder.styles?.styleName || '',
    styleImage: workOrder.styles?.imageUrl || '',
    workOrderNumber: workOrder.workOrderNumber,
    workOrderId: workOrder.id,
    orderQty: workOrder.totalQuantity,
    color: selectedColor?.colorName || 'All Colors',
    colorId: colorId || null,
    cuttingDate: toDateInputValue(new Date()),

    // Available colors for this work order
    availableColors: uniqueColors.map((c) => ({
      id: c.id,
      colorName: c.colorName,
      colorCode: c.colorCode,
    })),

    // Size Breakdown
    sizes: sizesForNewBatch,
    totalOrderQty,

    // Fabric Details (per part)
    fabricDetails,

    // Fabrics & CAD (per part with lot details)
    fabrics: fabricsWithLots,

    // Fabric Stock Analysis (per part — max cuttable pcs)
    fabricAnalysis,
    maxCuttablePcs,
    maxCuttableNewBatchPcs,
    maxCutLimitedBy,
    maxExtraCutPercent: MAX_EXTRA_CUT_PERCENT,
    /** Order + allowance, whole run */
    maxAllowedPcs: maxFromAllowance,
    /** What the fabric alone can make, whole run (null = no fabric limit known) */
    maxFromFabricPcs: maxFromFabric,
    /** The part whose fabric limits it most — named even when the allowance is the lower limit */
    fabricBottleneck:
      fabricsWithCad.length > 0
        ? fabricsWithCad.reduce((min, fa) => (fa.maxPcsFromStock! < min.maxPcsFromStock! ? fa : min)).part
        : null,
    bottleneckFabric,
    pendingCutQty,

    // Collisions the builder had to resolve. ALWAYS an array; empty when the CAD data is clean.
    // Silently picking a winner is what let one fabric's average stand in for another's.
    warnings,

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
