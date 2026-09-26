import { Request, Response } from 'express';
import prisma from '../config/database';
import { logInfo, logWarn } from '../utils/logger';
import { calculateCadAverage } from './cad-planning.utils';
import { NotFoundError, ValidationError, BusinessError, UnauthorizedError } from '../errors';
import { Decimal } from '@prisma/client/runtime/library';
import { multiplyCurrency, toNumber } from '../utils/currency'; // BUG-FAB12 fix
import { recomputeStyleCadStatus } from '../services/helpers/cad-status.helper';
import { cadMarkerFields, copyCadChildren } from '../services/helpers/cad-copy.helper';
import { resolveProductionLot, CREATE_CAD_HINT } from '../services/helpers/production-cad-lot.helper';
import {
  EMPTY_CAD_SNAPSHOT,
  cadSnapshot,
  recordCadEdit,
  recordCadEvent,
  refuseRejectWhenInUse,
} from '../services/helpers/cad-history.helper';

/**
 * Reserve fabric stock for a PRODUCTION CAD
 *
 * @param fabricStockId - The fabric stock record to reserve from
 * @param cadAverage - Meters per piece
 * @param orderQuantityPcs - Number of pieces to produce
 * @param cadId - CAD record ID for reference
 * @returns The reserved quantity in meters, or null if reservation failed
 */
async function reserveFabricStock(
  fabricStockId: string,
  cadAverage: number,
  orderQuantityPcs: number,
  cadId: string
): Promise<{ reservedQuantity: number; success: boolean; message: string }> {
  // Calculate quantity needed (meters)
  // BUG-FAB12 fix: use decimal.js for precision
  const quantityNeeded = toNumber(multiplyCurrency(cadAverage, orderQuantityPcs));

  // Get current stock
  const stock = await prisma.fabric_stock.findUnique({
    where: { id: fabricStockId },
    select: {
      id: true,
      quantityAvailable: true,
      quantityReserved: true,
      fabricId: true,
    },
  });

  if (!stock) {
    return { reservedQuantity: 0, success: false, message: 'Fabric stock not found' };
  }

  const available = Number(stock.quantityAvailable);
  const currentReserved = Number(stock.quantityReserved);
  const unreserved = available - currentReserved;

  // Check if enough stock is available
  if (unreserved < quantityNeeded) {
    logWarn(`Insufficient stock for CAD ${cadId}:`, {
      needed: quantityNeeded,
      unreserved,
      available,
      currentReserved,
    });
    return {
      reservedQuantity: 0,
      success: false,
      message: `Insufficient stock: need ${quantityNeeded.toFixed(2)}m, only ${unreserved.toFixed(2)}m unreserved`,
    };
  }

  // Reserve the stock
  const newReserved = currentReserved + quantityNeeded;

  await prisma.fabric_stock.update({
    where: { id: fabricStockId },
    data: {
      quantityReserved: new Decimal(newReserved),
    },
  });

  logInfo(`Fabric stock reserved for CAD ${cadId}:`, {
    fabricStockId,
    quantityReserved: quantityNeeded,
    totalReserved: newReserved,
    remaining: available - newReserved,
  });

  return {
    reservedQuantity: quantityNeeded,
    success: true,
    message: `Reserved ${quantityNeeded.toFixed(2)} meters`,
  };
}

/*
 * RETIRED 2026-08-24 (landmine No.3): the legacy style-level approveCAD endpoint
 * stamped styles.cadStatus='APPROVED' without ever touching fabric_width_cad.approvalStatus
 * — the purest producer of the style-vs-row approval drift. No frontend caller existed.
 * Style status is now DERIVED from rows via services/helpers/cad-status.helper.ts.
 */

/**
 * Approve CAD Purpose (COSTING, RAW_MATERIAL_CALCULATION, or PRODUCTION)
 * POST /api/styles/:styleId/cad-table/row/:rowId/approve
 */
export async function approveCADPurpose(req: Request, res: Response) {
  const { styleId, rowId } = req.params;
  const { approvalNotes } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  // Fetch CAD record
  const cadRecord = await prisma.fabric_width_cad.findUnique({
    where: { id: rowId },
    include: {
      styleFabric: {
        include: {
          style_components: true,
        },
      },
      sizeBreakdowns: { select: { quantity: true } },
    },
  });

  if (!cadRecord) {
    throw new NotFoundError('CAD record', rowId);
  }

  // Verify style ID matches (styleId is on style_components, not style_fabrics)
  if (cadRecord.styleFabric?.style_components?.styleId !== styleId) {
    throw new BusinessError('CAD record does not belong to this style');
  }

  // Check if already approved
  if (cadRecord.approvalStatus === 'APPROVED') {
    throw new BusinessError('CAD record is already approved');
  }

  // An approved Production CAD is what unlocks cutting (2026-09-23), so it must be the marker of a
  // received lot — rows made with no lot (Copy / Promote / a purpose edit, before 2026-09-25) never
  // qualify — and it must carry an average: the stored one, or one computable from its layer length
  // and size breakdown (then stored).
  let productionAverageToStore: number | null = null;
  if ((cadRecord.purposeEnum ?? cadRecord.purpose) === 'PRODUCTION') {
    if (!cadRecord.fabricStockId) {
      throw new BusinessError(
        'This Production CAD is not on a received fabric lot, so it cannot be approved. Link it to the lot ' +
          '(row menu → Link to Stock), or delete it and use Create CAD on the lot in the stock banner.'
      );
    }
    const pieces = cadRecord.piecesPerMarker ?? cadRecord.sizeBreakdowns.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const average =
      cadRecord.cadAverage !== null
        ? Number(cadRecord.cadAverage)
        : cadRecord.cadMeters
          ? calculateCadAverage(
              Number(cadRecord.cadMeters),
              cadRecord.layerMarginMeters ? Number(cadRecord.layerMarginMeters) : null,
              pieces
            )
          : null;
    if (!average || average <= 0) {
      throw new BusinessError(
        'This Production CAD has no average yet. Enter the Layer Length and the Size Breakdown on the row, ' +
          'save, then Approve.'
      );
    }
    if (cadRecord.cadAverage === null) productionAverageToStore = average;
  }

  // Update approval status
  const updated = await prisma.fabric_width_cad.update({
    where: { id: rowId },
    data: {
      approvalStatus: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
      approvalNotes: approvalNotes || null,
      ...(productionAverageToStore !== null ? { cadAverage: productionAverageToStore } : {}),
    },
    include: {
      approver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Ensure cadAverage is persisted — it may be null if only computed on-the-fly by getCADTableData
  if (updated.cadAverage === null && updated.cadMeters && updated.piecesPerMarker) {
    const cadAvg = calculateCadAverage(
      Number(updated.cadMeters),
      updated.layerMarginMeters ? Number(updated.layerMarginMeters) : null,
      Number(updated.piecesPerMarker)
    );
    if (cadAvg !== null) {
      await prisma.fabric_width_cad.update({
        where: { id: rowId },
        data: { cadAverage: cadAvg },
      });
      logInfo(`Backfilled cadAverage=${cadAvg.toFixed(4)} for CAD row ${rowId} during approval`);
    }
  }

  // If PRODUCTION CAD, reserve stock
  if (updated.purpose === 'PRODUCTION' && updated.fabricStockId) {
    const cadAvg = updated.cadAverage ? Number(updated.cadAverage) : null;
    const orderQty = updated.orderQuantityPcs;

    if (cadAvg && cadAvg > 0 && orderQty && orderQty > 0) {
      const reservationResult = await reserveFabricStock(updated.fabricStockId, cadAvg, orderQty, updated.id);

      if (!reservationResult.success) {
        // Log warning but don't fail approval - stock reservation is informational
        logWarn(`Stock reservation warning for CAD ${updated.id}: ${reservationResult.message}`);
      }
    } else {
      logInfo(`Skipping stock reservation for CAD ${updated.id}: missing cadAverage or orderQuantityPcs`);
    }
  }

  // Landmine №3: style-level cadStatus is derived from the rows — never drifts again
  await recomputeStyleCadStatus(prisma, styleId);

  await recordCadEvent({
    cadId: rowId,
    userId,
    action: 'APPROVE',
    newValues: approvalNotes ? { approvalNotes } : null,
  });

  return res.json({
    success: true,
    message: `${updated.purpose} CAD approved successfully`,
    data: {
      cadId: updated.id,
      purpose: updated.purpose,
      approvalStatus: updated.approvalStatus,
      approvedBy: updated.approver ? `${updated.approver.firstName} ${updated.approver.lastName}` : null,
      approvedAt: updated.approvedAt,
    },
  });
}

/**
 * Reject CAD Purpose
 * POST /api/styles/:styleId/cad-table/row/:rowId/reject
 */
export async function rejectCADPurpose(req: Request, res: Response) {
  const { styleId, rowId } = req.params;
  const { rejectionNotes } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  if (!rejectionNotes) {
    throw new ValidationError('Rejection notes are required');
  }

  // Fetch CAD record
  const cadRecord = await prisma.fabric_width_cad.findUnique({
    where: { id: rowId },
    include: {
      styleFabric: {
        include: {
          style_components: true,
        },
      },
    },
  });

  if (!cadRecord) {
    throw new NotFoundError('CAD record', rowId);
  }

  // Verify style ID matches (styleId is on style_components, not style_fabrics)
  if (cadRecord.styleFabric?.style_components?.styleId !== styleId) {
    throw new BusinessError('CAD record does not belong to this style');
  }

  // Approved cost sheets / order BOMs built on this row would keep their old figures after a reject
  // (ESSKY082LS, 26-Sep-2026) — once anything is built on it, the change goes through Correct instead.
  await refuseRejectWhenInUse([rowId]);

  // Update approval status. Policy (two-owner split, user decision 2026-08-22): rejecting
  // the CAD geometry also un-approves the row's PRICE — a price computed on rejected
  // geometry must be re-reviewed after rework. Cost numbers are kept.
  const updated = await prisma.fabric_width_cad.update({
    where: { id: rowId },
    data: {
      approvalStatus: 'REJECTED',
      // Landmine №6 fix: a rejection must stamp the REJECTED audit fields and clear the
      // approver ones — the old code wrote the rejector's name into approvedBy/approvedAt,
      // and the production variance baseline (approvedBy-not-null proxy) then compared
      // markers against rejected geometry.
      rejectedBy: userId,
      rejectedAt: new Date(),
      approvedBy: null,
      approvedAt: null,
      approvalNotes: rejectionNotes,
      costingApprovalStatus: null,
      costingApprovedBy: null,
      costingApprovedAt: null,
      isPreferred: false,
    },
    include: {
      rejector: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Landmine №3: style-level cadStatus is derived from the rows
  await recomputeStyleCadStatus(prisma, styleId);

  await recordCadEvent({
    cadId: rowId,
    userId,
    action: 'REJECT',
    reason: rejectionNotes,
  });

  return res.json({
    success: true,
    message: `${updated.purpose} CAD rejected`,
    data: {
      cadId: updated.id,
      purpose: updated.purpose,
      approvalStatus: updated.approvalStatus,
      rejectedBy: updated.rejector ? `${updated.rejector.firstName} ${updated.rejector.lastName}` : null,
      rejectionNotes: updated.approvalNotes,
    },
  });
}

/**
 * Create New Version of COSTING CAD (renamed from PLANNING)
 * POST /api/styles/:styleId/cad-table/planning/:rowId/create-version
 */
export async function createPlanningVersion(req: Request, res: Response) {
  const { styleId, rowId } = req.params;
  const { versionReason } = req.body;
  const userId = req.user?.userId;

  // Fetch base CAD record
  const baseCad = await prisma.fabric_width_cad.findUnique({
    where: { id: rowId },
    include: {
      styleFabric: true,
      sizeBreakdowns: true,
    },
  });

  if (!baseCad) {
    throw new NotFoundError('Base CAD record', rowId);
  }

  // Verify it's approved
  if (baseCad.approvalStatus !== 'APPROVED') {
    throw new BusinessError('Can only create new version from APPROVED CAD');
  }

  // A Production CAD is one lot's marker, one per lot. A version of it would be a second live row that
  // (copying only the planning fields below) had lost the lot. It is changed in place instead.
  if ((baseCad.purposeEnum ?? baseCad.purpose) === 'PRODUCTION') {
    throw new BusinessError(
      'A Production CAD has no versions — it is the marker of one fabric lot. To change it, Reject it, edit the ' +
        'row and Approve it again (or delete it and use Create CAD on the lot in the stock banner).'
    );
  }

  // Create new version
  const newVersion = await prisma.fabric_width_cad.create({
    data: {
      // Copy all fields from base
      fabricId: baseCad.fabricId,
      styleFabricId: baseCad.styleFabricId,
      cutableWidth: baseCad.cutableWidth,
      widthUnit: baseCad.widthUnit,
      cadWastagePercent: baseCad.cadWastagePercent,
      printDirection: baseCad.printDirection,
      layerMarginMeters: baseCad.layerMarginMeters,
      greigeId: baseCad.greigeId,
      componentName: baseCad.componentName,
      purpose: baseCad.purpose, // Keep same purpose as base
      // Landmine №8: purpose is stored twice (legacy string + typed enum) — every write
      // must set BOTH. This copy previously carried only the string, creating rows the
      // enum-only cutting gate could not see.
      purposeEnum: (baseCad.purposeEnum ?? baseCad.purpose) as any,
      patternPartId: baseCad.patternPartId,
      isEmbroidery: baseCad.isEmbroidery,
      piecesPerMarker: baseCad.piecesPerMarker,
      notes: versionReason || 'New version created',
      createdById: userId,

      // Version control
      version: baseCad.version + 1,
      supersededById: baseCad.id, // Link to previous version

      // Reset approval
      approvalStatus: 'PENDING',
      approvedBy: null,
      approvedAt: null,
      approvalNotes: null,
    },
  });

  // Copy size breakdowns
  if (baseCad.sizeBreakdowns && baseCad.sizeBreakdowns.length > 0) {
    await prisma.cad_size_breakdown.createMany({
      data: baseCad.sizeBreakdowns.map((sb) => ({
        cadId: newVersion.id,
        sizeName: sb.sizeName,
        sizeId: sb.sizeId,
        quantity: sb.quantity,
      })),
    });
  }

  await recomputeStyleCadStatus(prisma, styleId);

  await recordCadEdit({
    cadId: newVersion.id,
    userId,
    action: 'CREATE',
    before: EMPTY_CAD_SNAPSHOT,
    after: cadSnapshot({ ...newVersion, sizeBreakdowns: baseCad.sizeBreakdowns }),
    reason: `Version ${newVersion.version} of CAD ${baseCad.id}${versionReason ? ` — ${versionReason}` : ''}`,
  });

  return res.json({
    success: true,
    message: `${baseCad.purpose} CAD v${newVersion.version} created successfully`,
    data: {
      newCadId: newVersion.id,
      version: newVersion.version,
      baseCadId: baseCad.id,
      baseVersion: baseCad.version,
    },
  });
}

/**
 * Copy CAD Between Purposes (COSTING -> RAW_MATERIAL_CALCULATION)
 *
 * No copy to PRODUCTION (2026-09-25): a Production CAD is the marker of one received lot and is made
 * by Create CAD on that lot (production-from-stock), which pre-fills the approved planning marker.
 * Copy made one with no lot at all.
 * POST /api/styles/:styleId/cad-table/copy
 */
export async function copyCADPurpose(req: Request, res: Response) {
  const { styleId } = req.params;
  const { sourceCadId, targetPurpose, styleFabricId, componentId, patternPartId } = req.body;
  const userId = req.user?.userId;

  // Fetch source CAD
  const sourceCad = await prisma.fabric_width_cad.findUnique({
    where: { id: sourceCadId },
  });

  if (!sourceCad) {
    throw new NotFoundError('Source CAD', sourceCadId);
  }

  // Allow copying from any approval status, but log warning if not APPROVED
  // The copied record will be created with PENDING status regardless
  if (sourceCad.approvalStatus !== 'APPROVED') {
    logInfo(
      `Copying non-APPROVED CAD (status: ${sourceCad.approvalStatus}, id: ${sourceCadId}) - copied record will be PENDING`
    );
  }

  if (targetPurpose === 'PRODUCTION') {
    throw new BusinessError(
      `A Production CAD is made for a received fabric lot, not copied from a planning row. ${CREATE_CAD_HINT} ` +
        'It starts from the approved planning marker.'
    );
  }

  // Validate copy direction
  const validCopyPaths = [{ from: 'COSTING', to: 'RAW_MATERIAL_CALCULATION' }];

  const isValidPath = validCopyPaths.some((path) => path.from === sourceCad.purpose && path.to === targetPurpose);

  if (!isValidPath) {
    throw new BusinessError(
      `Invalid copy path: ${sourceCad.purpose} → ${targetPurpose}. Allowed: COSTING→RAW_MATERIAL_CALCULATION`
    );
  }

  // The price travels between the planning purposes (a Production row is never costed)
  const costing = {
    greigeCostPerMeter: sourceCad.greigeCostPerMeter,
    transportCostPerMeter: sourceCad.transportCostPerMeter,
    shrinkagePercent: sourceCad.shrinkagePercent,
    shrinkageCostPerMeter: sourceCad.shrinkageCostPerMeter,
    screenCostPerMeter: sourceCad.screenCostPerMeter,
    screenType: sourceCad.screenType,
    totalCostPerMeter: sourceCad.totalCostPerMeter,
    processorId: sourceCad.processorId,
    processingPricePerMeter: sourceCad.processingPricePerMeter,
    numberOfColors: sourceCad.numberOfColors,
    costInputMode: sourceCad.costInputMode,
    costingStyleId: sourceCad.costingStyleId,
    orderQuantityPcs: sourceCad.orderQuantityPcs,
    processingBatchGroupColorId: sourceCad.processingBatchGroupColorId,
  };

  // Create new CAD with target purpose (Copy as Draft workflow)
  const newCad = await prisma.$transaction(async (tx) => {
    const created = await tx.fabric_width_cad.create({
      data: {
        ...cadMarkerFields(sourceCad),
        styleFabricId: styleFabricId || sourceCad.styleFabricId,
        patternPartId: patternPartId || sourceCad.patternPartId,
        ...costing,

        // Copy tracking - NEW FIELD
        copiedFromId: sourceCad.id,

        notes: sourceCad.notes
          ? `${sourceCad.notes}\n\nCopied from ${sourceCad.purpose} CAD`
          : `Copied from ${sourceCad.purpose} CAD`,
        createdById: userId,

        // Set target purpose
        purpose: targetPurpose,
        purposeEnum: targetPurpose as any, // Set enum field if exists

        // Reset approval for new purpose - User must review and approve manually
        approvalStatus: 'PENDING',
        approvedBy: null,
        approvedAt: null,
        approvalNotes: null,
        isPreferred: false, // Reset preferred flag
      },
    });
    await copyCadChildren(tx, sourceCad.id, created.id);
    await recomputeStyleCadStatus(tx, styleId);
    return created;
  });

  const copiedSizes = await prisma.cad_size_breakdown.findMany({
    where: { cadId: newCad.id },
    select: { sizeName: true, quantity: true },
  });
  await recordCadEdit({
    cadId: newCad.id,
    userId,
    action: 'CREATE',
    before: EMPTY_CAD_SNAPSHOT,
    after: cadSnapshot({ ...newCad, sizeBreakdowns: copiedSizes }),
    reason: `Copied from ${sourceCad.purpose} CAD ${sourceCad.id}`,
  });

  return res.json({
    success: true,
    message: `Draft CAD created from ${sourceCad.purpose}. Please review and approve.`,
    data: {
      newRecordId: newCad.id, // Changed from newCadId for consistency with plan
      copiedFromId: sourceCad.id,
      purpose: targetPurpose,
      approvalStatus: 'PENDING',
    },
  });
}

/**
 * Get CAD Copy Lineage
 * GET /api/cad-planning/:styleId/row/:rowId/lineage
 *
 * Returns the copy history for a CAD record:
 * - source: The original record this was copied from (if any)
 * - current: The current record
 * - children: All records copied from the current record
 */
export async function getCADLineage(req: Request, res: Response) {
  const { rowId } = req.params;

  // Fetch current CAD with source and children
  const currentCad = await prisma.fabric_width_cad.findUnique({
    where: { id: rowId },
    include: {
      copiedFrom: {
        select: {
          id: true,
          purpose: true,
          approvalStatus: true,
          componentName: true,
          cutableWidth: true,
        },
      },
      copiedTo: {
        select: {
          id: true,
          purpose: true,
          approvalStatus: true,
          componentName: true,
          cutableWidth: true,
        },
      },
    },
  });

  if (!currentCad) {
    throw new NotFoundError('CAD record', rowId);
  }

  const lineage = {
    source: currentCad.copiedFrom || undefined,
    current: {
      id: currentCad.id,
      purpose: currentCad.purpose,
      approvalStatus: currentCad.approvalStatus,
      componentName: currentCad.componentName,
      cutableWidth: Number(currentCad.cutableWidth),
    },
    children: currentCad.copiedTo || [],
  };

  return res.json({
    success: true,
    data: lineage,
  });
}

/**
 * Link PRODUCTION CAD to Fabric Stock
 * POST /api/styles/:styleId/cad-table/link-stock
 */
export async function linkCADToStock(req: Request, res: Response) {
  const { styleId } = req.params;
  const { cadId, fabricStockId, procurementId, planningCadWidth } = req.body;

  // Fetch CAD record
  const cadRecord = await prisma.fabric_width_cad.findUnique({
    where: { id: cadId },
  });

  if (!cadRecord) {
    throw new NotFoundError('CAD record', cadId);
  }

  // Verify it's PRODUCTION purpose
  if (cadRecord.purpose !== 'PRODUCTION') {
    throw new BusinessError('Only PRODUCTION CAD can be linked to stock');
  }

  // Fetch fabric stock
  const fabricStock = await prisma.fabric_stock.findUnique({
    where: { id: fabricStockId },
  });

  if (!fabricStock) {
    throw new NotFoundError('Fabric stock', fabricStockId);
  }

  // Verify stock is available
  if (fabricStock.status !== 'AVAILABLE') {
    throw new BusinessError(`Stock is not available (current status: ${fabricStock.status})`);
  }

  // The lot must be this style's, on this row's fabric, with no other Production CAD — Create CAD's rule
  await resolveProductionLot(
    styleId,
    fabricStockId,
    { styleFabricId: cadRecord.styleFabricId },
    { excludeCadId: cadId }
  );

  // Calculate variance if planning width provided
  let widthVariance = null;
  let variancePercent = null;

  if (planningCadWidth && planningCadWidth > 0) {
    widthVariance = Number(fabricStock.cutableWidth) - planningCadWidth;
    variancePercent = (widthVariance / planningCadWidth) * 100;
  }

  // Update CAD with stock linkage
  const updated = await prisma.fabric_width_cad.update({
    where: { id: cadId },
    data: {
      fabricStockId,
      procurementId: procurementId || null,
      cutableWidth: fabricStock.cutableWidth, // Use actual stock width
      planningCadWidth: planningCadWidth || null,
      widthVariance,
      variancePercent,
    },
    include: {
      fabricStock: {
        select: {
          finishedWidth: true,
          cutableWidth: true,
          rollNumbers: true,
          qualityGrade: true,
        },
      },
    },
  });

  return res.json({
    success: true,
    message: 'PRODUCTION CAD linked to fabric stock',
    data: {
      cadId: updated.id,
      fabricStockId: updated.fabricStockId,
      stockDetails: updated.fabricStock,
      cutableWidth: updated.cutableWidth,
      planningCadWidth: updated.planningCadWidth,
      widthVariance: updated.widthVariance,
      variancePercent: updated.variancePercent,
    },
  });
}
