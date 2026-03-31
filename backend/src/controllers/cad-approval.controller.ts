import { Request, Response } from 'express';
import prisma from '../config/database';
import { logInfo } from '../utils/logger';
import { calculateCadAverage } from './cad-planning.utils';

/**
 * Approve a specific CAD option for a style
 * POST /api/styles/cad-planning/approve
 * Body: { styleId, cadId, fabricId, approvalNotes? }
 */
export async function approveCAD(req: Request, res: Response) {
  const { styleId, cadId, fabricId, approvalNotes } = req.body;

  // Verify style exists
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    include: {
      style_components: {
        include: {
          style_fabrics: {
            where: {
              fabricId: fabricId,
            },
          },
        },
      },
    },
  });

  if (!style) {
    return res.status(404).json({
      success: false,
      message: 'Style not found',
    });
  }

  // Verify CAD exists and has required data
  const cad = await prisma.fabric_width_cad.findUnique({
    where: { id: cadId },
    select: {
      id: true,
      cadMeters: true,
      cadAverage: true,
      cutableWidth: true,
    },
  });

  if (!cad) {
    return res.status(404).json({
      success: false,
      message: 'CAD record not found',
    });
  }

  // Validate that CAD has essential data before approval
  if (!cad.cadMeters || Number(cad.cadMeters) <= 0) {
    return res.status(400).json({
      success: false,
      message:
        'Cannot approve CAD: Layer length (cadMeters) must be populated with a valid value. Please complete the CAD data before approval.',
    });
  }

  if (!cad.cutableWidth || Number(cad.cutableWidth) <= 0) {
    return res.status(400).json({
      success: false,
      message:
        'Cannot approve CAD: Cutable width must be populated with a valid value. Please complete the CAD data before approval.',
    });
  }

  // Update style_fabrics to reference this CAD
  const fabricsToUpdate = style.style_components.flatMap((comp) => comp.style_fabrics.map((fabric) => fabric.id));

  if (fabricsToUpdate.length > 0) {
    await prisma.style_fabrics.updateMany({
      where: {
        id: { in: fabricsToUpdate },
      },
      data: {
        fabricCADId: cadId,
        fabricId: fabricId,
      },
    });
  }

  // Update style status to APPROVED with approval date
  const updatedStyle = await prisma.styles.update({
    where: { id: styleId },
    data: {
      cadStatus: 'APPROVED',
      approvedCadDate: new Date(),
    },
  });

  // Optionally add approval notes to CAD record
  if (approvalNotes) {
    await prisma.fabric_width_cad.update({
      where: { id: cadId },
      data: {
        notes: approvalNotes,
      },
    });
  }

  return res.json({
    success: true,
    message: 'CAD approved successfully',
    style: {
      styleId: updatedStyle.id,
      cadStatus: updatedStyle.cadStatus,
      approvedCadDate: updatedStyle.approvedCadDate,
    },
  });
}

/**
 * Approve CAD Purpose (COSTING, RAW_MATERIAL_CALCULATION, or PRODUCTION)
 * POST /api/styles/:styleId/cad-table/row/:rowId/approve
 */
export async function approveCADPurpose(req: Request, res: Response) {
  const { styleId, rowId } = req.params;
  const { approvalNotes } = req.body;
  const userId = (req as any).user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
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
    return res.status(404).json({
      success: false,
      message: 'CAD record not found',
    });
  }

  // Verify style ID matches (styleId is on style_components, not style_fabrics)
  if (cadRecord.styleFabric?.style_components?.styleId !== styleId) {
    return res.status(400).json({
      success: false,
      message: 'CAD record does not belong to this style',
    });
  }

  // Check if already approved
  if (cadRecord.approvalStatus === 'APPROVED') {
    return res.status(400).json({
      success: false,
      message: 'CAD record is already approved',
    });
  }

  // Update approval status
  const updated = await prisma.fabric_width_cad.update({
    where: { id: rowId },
    data: {
      approvalStatus: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
      approvalNotes: approvalNotes || null,
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
    // TODO: Implement stock reservation logic
    // This would update fabric_stock.quantityReserved
  }

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
  const userId = (req as any).user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  if (!rejectionNotes) {
    return res.status(400).json({
      success: false,
      message: 'Rejection notes are required',
    });
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
    return res.status(404).json({
      success: false,
      message: 'CAD record not found',
    });
  }

  // Verify style ID matches (styleId is on style_components, not style_fabrics)
  if (cadRecord.styleFabric?.style_components?.styleId !== styleId) {
    return res.status(400).json({
      success: false,
      message: 'CAD record does not belong to this style',
    });
  }

  // Update approval status
  const updated = await prisma.fabric_width_cad.update({
    where: { id: rowId },
    data: {
      approvalStatus: 'REJECTED',
      approvedBy: userId,
      approvedAt: new Date(),
      approvalNotes: rejectionNotes,
    },
    include: {
      approver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return res.json({
    success: true,
    message: `${updated.purpose} CAD rejected`,
    data: {
      cadId: updated.id,
      purpose: updated.purpose,
      approvalStatus: updated.approvalStatus,
      rejectedBy: updated.approver ? `${updated.approver.firstName} ${updated.approver.lastName}` : null,
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
  const userId = (req as any).user?.userId;

  // Fetch base CAD record
  const baseCad = await prisma.fabric_width_cad.findUnique({
    where: { id: rowId },
    include: {
      styleFabric: true,
      sizeBreakdowns: true,
    },
  });

  if (!baseCad) {
    return res.status(404).json({
      success: false,
      message: 'Base CAD record not found',
    });
  }

  // Verify it's approved
  if (baseCad.approvalStatus !== 'APPROVED') {
    return res.status(400).json({
      success: false,
      message: 'Can only create new version from APPROVED CAD',
    });
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
 * Copy CAD Between Purposes (RAW_MATERIAL_CALCULATION->COSTING, COSTING->PRODUCTION)
 * POST /api/styles/:styleId/cad-table/copy
 */
export async function copyCADPurpose(req: Request, res: Response) {
  const { styleId } = req.params;
  const { sourceCadId, targetPurpose, styleFabricId, componentId, patternPartId } = req.body;
  const userId = (req as any).user?.userId;

  // Fetch source CAD
  const sourceCad = await prisma.fabric_width_cad.findUnique({
    where: { id: sourceCadId },
    include: {
      sizeBreakdowns: true,
    },
  });

  if (!sourceCad) {
    return res.status(404).json({
      success: false,
      message: 'Source CAD not found',
    });
  }

  // Allow copying from any approval status, but log warning if not APPROVED
  // The copied record will be created with PENDING status regardless
  if (sourceCad.approvalStatus !== 'APPROVED') {
    logInfo(
      `Copying non-APPROVED CAD (status: ${sourceCad.approvalStatus}, id: ${sourceCadId}) - copied record will be PENDING`
    );
  }

  // Validate copy direction
  // Valid paths: COSTING -> RAW_MATERIAL_CALCULATION -> PRODUCTION
  const validCopyPaths = [
    { from: 'COSTING', to: 'RAW_MATERIAL_CALCULATION' },
    { from: 'RAW_MATERIAL_CALCULATION', to: 'PRODUCTION' },
  ];

  const isValidPath = validCopyPaths.some((path) => path.from === sourceCad.purpose && path.to === targetPurpose);

  if (!isValidPath) {
    return res.status(400).json({
      success: false,
      message: `Invalid copy path: ${sourceCad.purpose} → ${targetPurpose}. Allowed: COSTING→RAW_MATERIAL_CALCULATION, RAW_MATERIAL_CALCULATION→PRODUCTION`,
    });
  }

  // Create new CAD with target purpose (Copy as Draft workflow)
  const newCad = await prisma.fabric_width_cad.create({
    data: {
      // Copy all CAD structure fields
      fabricId: sourceCad.fabricId,
      styleFabricId: styleFabricId || sourceCad.styleFabricId,
      cutableWidth: sourceCad.cutableWidth,
      widthUnit: sourceCad.widthUnit,
      cadMeters: sourceCad.cadMeters,
      cadYards: sourceCad.cadYards,
      cadAverage: sourceCad.cadAverage,
      cadWastagePercent: sourceCad.cadWastagePercent,
      markerEfficiency: sourceCad.markerEfficiency,
      printDirection: sourceCad.printDirection,
      layerMarginMeters: sourceCad.layerMarginMeters,
      greigeId: sourceCad.greigeId,
      componentName: sourceCad.componentName,
      patternPartId: patternPartId || sourceCad.patternPartId,
      isEmbroidery: sourceCad.isEmbroidery,
      piecesPerMarker: sourceCad.piecesPerMarker,
      markerLengthMeters: sourceCad.markerLengthMeters,
      markerPlanFile: sourceCad.markerPlanFile,

      // Copy all cost fields (Fabric Costing data)
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

      // For PRODUCTION, track planning width for variance
      planningCadWidth: targetPurpose === 'PRODUCTION' ? sourceCad.cutableWidth : null,
    },
  });

  // Copy size breakdowns
  if (sourceCad.sizeBreakdowns && sourceCad.sizeBreakdowns.length > 0) {
    await prisma.cad_size_breakdown.createMany({
      data: sourceCad.sizeBreakdowns.map((sb) => ({
        cadId: newCad.id,
        sizeName: sb.sizeName,
        sizeId: sb.sizeId,
        quantity: sb.quantity,
      })),
    });
  }

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
    return res.status(404).json({
      success: false,
      message: 'CAD record not found',
    });
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
    return res.status(404).json({
      success: false,
      message: 'CAD record not found',
    });
  }

  // Verify it's PRODUCTION purpose
  if (cadRecord.purpose !== 'PRODUCTION') {
    return res.status(400).json({
      success: false,
      message: 'Only PRODUCTION CAD can be linked to stock',
    });
  }

  // Fetch fabric stock
  const fabricStock = await prisma.fabric_stock.findUnique({
    where: { id: fabricStockId },
  });

  if (!fabricStock) {
    return res.status(404).json({
      success: false,
      message: 'Fabric stock not found',
    });
  }

  // Verify stock is available
  if (fabricStock.status !== 'AVAILABLE') {
    return res.status(400).json({
      success: false,
      message: `Stock is not available (current status: ${fabricStock.status})`,
    });
  }

  // Calculate variance if planning width provided
  let widthVariance = null;
  let variancePercent = null;

  if (planningCadWidth) {
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
