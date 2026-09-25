/**
 * CAD Embroidery & Production Controller
 * Handles embroidery CAD, total fabric CAD, and production variance endpoints.
 * Extracted from cad-planning.controller.ts
 */

import { Request, Response } from 'express';
import { fabric_width_cad } from '@prisma/client';
import prisma from '../config/database';
import { logInfo } from '../utils/logger';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import { systemSettingsService } from '../services/system-settings.service';
import { ALL_PARTS_CODE, getDefaultLayerMargin } from './cad-planning.utils';
import { resolveProductionLot } from '../services/helpers/production-cad-lot.helper';
import { cadMarkerFields, copyCadChildren } from '../services/helpers/cad-copy.helper';
import { recomputeStyleCadStatus } from '../services/helpers/cad-status.helper';

// ============================================================================
// EMBROIDERY CAD API ENDPOINTS
// ============================================================================

/**
 * Get embroidery CAD for a style fabric
 * GET /api/styles/:styleId/fabrics/:fabricId/embroidery-cad
 */
export async function getEmbroideryCad(req: Request, res: Response) {
  const { styleId, fabricId } = req.params;

  // Verify style fabric exists
  const styleFabric = await prisma.style_fabrics.findFirst({
    where: {
      id: fabricId,
      style_components: {
        styleId: styleId,
      },
    },
    include: {
      stylePatternParts: {
        where: { goesToEmbroidery: true },
        include: { patternPart: true },
      },
    },
  });

  if (!styleFabric) {
    throw new NotFoundError('Style fabric', fabricId);
  }

  // Check if there are any embroidery parts
  if (styleFabric.stylePatternParts.length === 0) {
    return res.json({
      success: true,
      data: {
        styleFabricId: fabricId,
        hasEmbroideryParts: false,
        embroideryParts: [],
        embroideryCad: null,
      },
    });
  }

  // Get embroidery CAD if exists
  const embroideryCad = await prisma.embroidery_part_cad.findUnique({
    where: { styleFabricId: fabricId },
    include: {
      sizeBreakdowns: {
        orderBy: { sizeName: 'asc' },
      },
      fabricWidthCad: true,
      embroidery: true,
    },
  });

  return res.json({
    success: true,
    data: {
      styleFabricId: fabricId,
      hasEmbroideryParts: true,
      embroideryParts: styleFabric.stylePatternParts.map((spp) => ({
        id: spp.id,
        patternPartId: spp.patternPartId,
        partName: spp.patternPart.name,
        partCode: spp.patternPart.code,
        quantity: spp.quantity,
      })),
      embroideryCad: embroideryCad
        ? {
            id: embroideryCad.id,
            fabricWidthCadId: embroideryCad.fabricWidthCadId,
            embroideryId: embroideryCad.embroideryId,
            cadMeters: embroideryCad.cadMeters ? Number(embroideryCad.cadMeters) : null,
            cadYards: embroideryCad.cadYards ? Number(embroideryCad.cadYards) : null,
            cadWastagePercent: Number(embroideryCad.cadWastagePercent),
            layerMarginMeters: embroideryCad.layerMarginMeters ? Number(embroideryCad.layerMarginMeters) : null,
            piecesPerMarker: embroideryCad.piecesPerMarker,
            markerEfficiency: embroideryCad.markerEfficiency ? Number(embroideryCad.markerEfficiency) : null,
            printDirection: embroideryCad.printDirection,
            isApproved: embroideryCad.isApproved,
            notes: embroideryCad.notes,
            sizeBreakdowns: embroideryCad.sizeBreakdowns.map((sb) => ({
              id: sb.id,
              sizeName: sb.sizeName,
              sizeId: sb.sizeId,
              quantity: sb.quantity,
            })),
            selectedWidth: embroideryCad.fabricWidthCad
              ? {
                  id: embroideryCad.fabricWidthCad.id,
                  cutableWidth: Number(embroideryCad.fabricWidthCad.cutableWidth),
                }
              : null,
            embroideryDesign: embroideryCad.embroidery
              ? {
                  id: embroideryCad.embroidery.id,
                  designName: embroideryCad.embroidery.designName,
                  costPerMeter: embroideryCad.embroidery.costPerMeter
                    ? Number(embroideryCad.embroidery.costPerMeter)
                    : null,
                }
              : null,
          }
        : null,
    },
  });
}

/**
 * Create or update embroidery CAD for a style fabric
 * POST /api/styles/:styleId/fabrics/:fabricId/embroidery-cad
 * Body: { fabricWidthCadId?, embroideryId?, cadMeters?, cadYards?, cadWastagePercent?,
 *         layerMarginMeters?, piecesPerMarker?, markerEfficiency?, printDirection?, notes?,
 *         sizeBreakdowns?: [{ sizeName, sizeId?, quantity }] }
 */
export async function createOrUpdateEmbroideryCad(req: Request, res: Response) {
  const { styleId, fabricId } = req.params;
  const {
    fabricWidthCadId,
    embroideryId,
    cadMeters,
    cadYards,
    cadWastagePercent,
    layerMarginMeters,
    piecesPerMarker,
    markerEfficiency,
    printDirection,
    notes,
    sizeBreakdowns,
  } = req.body;

  // Verify style fabric exists and has embroidery parts
  const styleFabric = await prisma.style_fabrics.findFirst({
    where: {
      id: fabricId,
      style_components: {
        styleId: styleId,
      },
    },
    include: {
      stylePatternParts: {
        where: { goesToEmbroidery: true },
      },
    },
  });

  if (!styleFabric) {
    throw new NotFoundError('Style fabric', fabricId);
  }

  if (styleFabric.stylePatternParts.length === 0) {
    throw new BusinessError(
      'No embroidery parts marked for this fabric. Mark pattern parts as "goes to embroidery" first.'
    );
  }

  // Check if embroidery CAD exists
  const existing = await prisma.embroidery_part_cad.findUnique({
    where: { styleFabricId: fabricId },
  });

  // Calculate piecesPerMarker from size breakdowns if provided
  let calculatedPiecesPerMarker = piecesPerMarker;
  if (sizeBreakdowns && Array.isArray(sizeBreakdowns)) {
    calculatedPiecesPerMarker = sizeBreakdowns.reduce(
      (sum: number, sb: { quantity: number }) => sum + (sb.quantity || 0),
      0
    );
  }

  // Build data for create/update
  const cadData = {
    fabricWidthCadId: fabricWidthCadId || null,
    embroideryId: embroideryId || null,
    cadMeters: cadMeters !== undefined ? cadMeters : null,
    cadYards: cadYards !== undefined ? cadYards : null,
    cadWastagePercent:
      cadWastagePercent !== undefined
        ? cadWastagePercent
        : await systemSettingsService.getNumberDefault('FABRIC_DEFAULT_WASTAGE_PERCENT'),
    layerMarginMeters:
      layerMarginMeters !== undefined ? layerMarginMeters : cadMeters ? getDefaultLayerMargin(cadMeters) : null,
    piecesPerMarker: calculatedPiecesPerMarker || null,
    markerEfficiency: markerEfficiency !== undefined ? markerEfficiency : null,
    printDirection: printDirection || 'TWO_WAY',
    notes: notes || null,
  };

  let embroideryCad: { id: string };

  if (existing) {
    // Update existing
    embroideryCad = await prisma.embroidery_part_cad.update({
      where: { id: existing.id },
      data: cadData,
    });

    // Update size breakdowns if provided
    if (sizeBreakdowns && Array.isArray(sizeBreakdowns)) {
      await prisma.embroidery_cad_size_breakdown.deleteMany({
        where: { embroideryCadId: existing.id },
      });

      if (sizeBreakdowns.length > 0) {
        await prisma.embroidery_cad_size_breakdown.createMany({
          data: sizeBreakdowns.map((sb: { sizeName: string; sizeId?: string; quantity: number }) => ({
            embroideryCadId: existing.id,
            sizeName: sb.sizeName,
            sizeId: sb.sizeId || null,
            quantity: sb.quantity,
          })),
        });
      }
    }
  } else {
    // Create new
    embroideryCad = await prisma.embroidery_part_cad.create({
      data: {
        styleFabricId: fabricId,
        ...cadData,
      },
    });

    // Create size breakdowns if provided
    if (sizeBreakdowns && Array.isArray(sizeBreakdowns) && sizeBreakdowns.length > 0) {
      await prisma.embroidery_cad_size_breakdown.createMany({
        data: sizeBreakdowns.map((sb: { sizeName: string; sizeId?: string; quantity: number }) => ({
          embroideryCadId: embroideryCad.id,
          sizeName: sb.sizeName,
          sizeId: sb.sizeId || null,
          quantity: sb.quantity,
        })),
      });
    }
  }

  // Fetch final CAD with relations
  const finalCad = await prisma.embroidery_part_cad.findUnique({
    where: { id: embroideryCad.id },
    include: {
      sizeBreakdowns: {
        orderBy: { sizeName: 'asc' },
      },
      fabricWidthCad: true,
      embroidery: true,
    },
  });

  return res.json({
    success: true,
    message: existing ? 'Embroidery CAD updated successfully' : 'Embroidery CAD created successfully',
    data: {
      id: finalCad!.id,
      styleFabricId: finalCad!.styleFabricId,
      fabricWidthCadId: finalCad!.fabricWidthCadId,
      embroideryId: finalCad!.embroideryId,
      cadMeters: finalCad!.cadMeters ? Number(finalCad!.cadMeters) : null,
      cadYards: finalCad!.cadYards ? Number(finalCad!.cadYards) : null,
      cadWastagePercent: Number(finalCad!.cadWastagePercent),
      layerMarginMeters: finalCad!.layerMarginMeters ? Number(finalCad!.layerMarginMeters) : null,
      piecesPerMarker: finalCad!.piecesPerMarker,
      markerEfficiency: finalCad!.markerEfficiency ? Number(finalCad!.markerEfficiency) : null,
      printDirection: finalCad!.printDirection,
      isApproved: finalCad!.isApproved,
      notes: finalCad!.notes,
      sizeBreakdowns: finalCad!.sizeBreakdowns.map((sb) => ({
        id: sb.id,
        sizeName: sb.sizeName,
        sizeId: sb.sizeId,
        quantity: sb.quantity,
      })),
    },
  });
}

/**
 * Delete embroidery CAD for a style fabric
 * DELETE /api/styles/:styleId/fabrics/:fabricId/embroidery-cad
 */
export async function deleteEmbroideryCad(req: Request, res: Response) {
  const { styleId, fabricId } = req.params;

  // Verify style fabric exists
  const styleFabric = await prisma.style_fabrics.findFirst({
    where: {
      id: fabricId,
      style_components: {
        styleId: styleId,
      },
    },
  });

  if (!styleFabric) {
    throw new NotFoundError('Style fabric', fabricId);
  }

  // Check if embroidery CAD exists
  const embroideryCad = await prisma.embroidery_part_cad.findUnique({
    where: { styleFabricId: fabricId },
  });

  if (!embroideryCad) {
    throw new NotFoundError('Embroidery CAD', fabricId);
  }

  // Delete size breakdowns first (cascade)
  await prisma.embroidery_cad_size_breakdown.deleteMany({
    where: { embroideryCadId: embroideryCad.id },
  });

  // Delete embroidery CAD
  await prisma.embroidery_part_cad.delete({
    where: { id: embroideryCad.id },
  });

  return res.json({
    success: true,
    message: 'Embroidery CAD deleted successfully',
  });
}

/**
 * Get total CAD for a style fabric (Main CAD + Embroidery CAD)
 * GET /api/styles/:styleId/fabrics/:fabricId/total-cad
 */
export async function getTotalFabricCad(req: Request, res: Response) {
  const { styleId, fabricId } = req.params;

  // Get style fabric with its CAD
  const styleFabric = await prisma.style_fabrics.findFirst({
    where: {
      id: fabricId,
      style_components: {
        styleId: styleId,
      },
    },
    include: {
      fabricCAD: true,
      stylePatternParts: {
        where: { goesToEmbroidery: true },
      },
    },
  });

  if (!styleFabric) {
    throw new NotFoundError('Style fabric', fabricId);
  }

  // Get main CAD (selected fabric_width_cad)
  const mainCad = styleFabric.fabricCAD;

  // Get embroidery CAD if exists
  const embroideryCad =
    styleFabric.stylePatternParts.length > 0
      ? await prisma.embroidery_part_cad.findUnique({
          where: { styleFabricId: fabricId },
        })
      : null;

  // Calculate totals
  const mainCadMeters = mainCad?.cadMeters ? Number(mainCad.cadMeters) : 0;
  const defaultWastage = await systemSettingsService.getNumberDefault('FABRIC_DEFAULT_WASTAGE_PERCENT');
  const mainWastage = mainCad?.cadWastagePercent != null ? Number(mainCad.cadWastagePercent) : defaultWastage;
  const mainEffective = mainCadMeters * (1 + mainWastage / 100);

  const embroideryCadMeters = embroideryCad?.cadMeters ? Number(embroideryCad.cadMeters) : 0;
  const embroideryWastage =
    embroideryCad?.cadWastagePercent != null ? Number(embroideryCad.cadWastagePercent) : defaultWastage;
  const embroideryEffective = embroideryCadMeters * (1 + embroideryWastage / 100);

  const totalCadMeters = mainCadMeters + embroideryCadMeters;
  const totalEffectiveMeters = mainEffective + embroideryEffective;

  return res.json({
    success: true,
    data: {
      styleFabricId: fabricId,
      mainCad: mainCad
        ? {
            cadId: mainCad.id,
            cadMeters: mainCadMeters,
            wastagePercent: mainWastage,
            effectiveMeters: mainEffective,
            cutableWidth: Number(mainCad.cutableWidth),
            printDirection: mainCad.printDirection,
          }
        : null,
      embroideryCad: embroideryCad
        ? {
            cadId: embroideryCad.id,
            cadMeters: embroideryCadMeters,
            wastagePercent: embroideryWastage,
            effectiveMeters: embroideryEffective,
            printDirection: embroideryCad.printDirection,
          }
        : null,
      totals: {
        totalCadMeters,
        totalEffectiveMeters,
        hasEmbroideryCad: !!embroideryCad,
      },
    },
  });
}

// ============================================================================
// PRODUCTION CAD FROM STOCK
// ============================================================================

/**
 * Create a PRODUCTION CAD from a received stock lot — the "Create CAD" button on CAD Planning's
 * Fabric Stock Available banner. One Production CAD per lot (owner decision 2026-09-23),
 * pre-filled from the style's approved planning marker so the team checks it and approves it.
 *
 * Until 2026-09-23 this made unusable rows whenever the style's fabric slot was not linked to the
 * received fabric (ESSKY085LS): no slot → a row with no styleFabricId and no costingStyleId,
 * invisible to the table's approve path and to cutting, which still marked the lot "with CAD". It
 * also copied the layer length but no sizes, pieces or average, let the planning row's fabric win
 * over the lot's, and skipped the style CAD-status recompute. Now the slot is resolved or the
 * request is refused with no row written.
 *
 * POST /api/cad-planning/:styleId/production-from-stock
 */
export async function createProductionCADFromStock(req: Request, res: Response) {
  const { styleId } = req.params;
  const { fabricStockId, styleFabricId, basedOnPlanningCadId, componentId, greigeId, patternPartId } = req.body;
  const userId = req.user?.userId;

  if (!fabricStockId) {
    throw new ValidationError('fabricStockId is required');
  }

  // 1–2. The style slot this lot belongs to (or refused) and one Production CAD per lot — the
  //      same rule Add Row, Add Combined Row and Link to Stock apply (production-cad-lot.helper)
  const {
    fabricStock,
    styleFabricId: resolvedStyleFabricId,
    lotLabel,
    lotGreigeId,
  } = await resolveProductionLot(styleId, fabricStockId, { styleFabricId, componentId });

  // 3. The marker to start from: the slot's approved planning row, RAW MAT first, same width first
  const stockWidth = Number(fabricStock.cutableWidth);
  let source: fabric_width_cad | null = null;
  if (basedOnPlanningCadId) {
    source = await prisma.fabric_width_cad.findUnique({ where: { id: basedOnPlanningCadId } });
  } else {
    const purposeRank: Record<string, number> = { RAW_MATERIAL_CALCULATION: 0, COSTING: 1, PRODUCTION: 2 };
    const candidates = await prisma.fabric_width_cad.findMany({
      where: {
        styleFabricId: resolvedStyleFabricId,
        approvalStatus: 'APPROVED', // allow-cad-approval — the GEOMETRY must be final to reuse it
        purpose: { in: ['RAW_MATERIAL_CALCULATION', 'COSTING', 'PRODUCTION'] },
      },
      orderBy: [{ version: 'desc' }, { approvedAt: 'desc' }],
    });
    const widthRank = (c: fabric_width_cad) => (Number(c.cutableWidth) === stockWidth ? 0 : 1);
    candidates.sort(
      (a, b) =>
        (purposeRank[a.purposeEnum ?? a.purpose ?? ''] ?? 9) - (purposeRank[b.purposeEnum ?? b.purpose ?? ''] ?? 9) ||
        widthRank(a) - widthRank(b)
    );
    source = candidates[0] ?? null;
  }

  // 4. Width variance. A marker planned at another width does not fit this lot: keep its sizes
  //    and part, drop its layer length and average so the row cannot be approved on them.
  const planningWidth = source ? Number(source.cutableWidth) : null;
  let widthVariance: number | null = null;
  let variancePercent: number | null = null;
  if (planningWidth && stockWidth) {
    widthVariance = stockWidth - planningWidth;
    variancePercent = (widthVariance / planningWidth) * 100;
  }
  const widthMatches = widthVariance === null || Math.abs(widthVariance) < 0.01;
  const warning =
    source && !widthMatches
      ? `This lot is ${stockWidth}" wide but the marker was planned at ${planningWidth}". ` +
        `The sizes were copied; enter the layer length for ${stockWidth}" before approving.`
      : !source
        ? 'No approved planning marker was found for this fabric — enter the layer length and sizes before approving.'
        : null;

  // 5. Pattern part: request → marker → lot → CAD Planning's auto rule
  let finalPatternPartId: string | null = patternPartId || source?.patternPartId || fabricStock.patternPartId || null;
  if (!finalPatternPartId) {
    const assignedParts = await prisma.style_pattern_parts.findMany({
      where: { styleFabricId: resolvedStyleFabricId },
      include: { patternPart: true },
    });
    if (assignedParts.length === 1) {
      finalPatternPartId = assignedParts[0].patternPartId;
      logInfo(`Auto-populated pattern part ${assignedParts[0].patternPart.name} for stock CAD`);
    } else if (assignedParts.length === 0) {
      const allParts = await prisma.pattern_part_master.findFirst({ where: { code: ALL_PARTS_CODE } });
      if (allParts) {
        finalPatternPartId = allParts.id;
        logInfo(`Auto-populated "All Parts" for stock CAD (no parts assigned)`);
      }
    }
  }

  const slot = await prisma.style_fabrics.findUnique({
    where: { id: resolvedStyleFabricId },
    select: { style_components: { select: { componentName: true } } },
  });
  const defaultWastage = await systemSettingsService.getNumberDefault('FABRIC_DEFAULT_WASTAGE_PERCENT');

  // 6. Create — no costingStyleId and no costs: a lot's Production CAD is a marker, not a costing
  const newCAD = await prisma.$transaction(async (tx) => {
    const created = await tx.fabric_width_cad.create({
      data: {
        ...(source ? cadMarkerFields(source) : {}),
        ...(source && !widthMatches
          ? { cadMeters: null, cadYards: null, cadAverage: null, markerLengthMeters: null, markerEfficiency: null }
          : {}),
        styleFabricId: resolvedStyleFabricId,
        fabricId: fabricStock.fabricId, // the lot's fabric, never the planning row's
        greigeId: greigeId || lotGreigeId || source?.greigeId || null,
        componentName: source?.componentName ?? slot?.style_components?.componentName ?? null,
        patternPartId: finalPatternPartId,
        cutableWidth: stockWidth,
        widthUnit: 'inches',
        cadWastagePercent: source?.cadWastagePercent ?? defaultWastage,
        printDirection: source?.printDirection ?? 'TWO_WAY',

        purpose: 'PRODUCTION',
        purposeEnum: 'PRODUCTION',
        approvalStatus: 'PENDING',

        fabricStockId,
        procurementId: fabricStock.procurementId,
        copiedFromId: source?.id ?? null,

        planningCadWidth: planningWidth,
        widthVariance,
        variancePercent,

        createdById: userId,
        notes:
          `Created from stock lot ${lotLabel || fabricStockId}. Stock width: ${stockWidth}".` +
          (source ? ` Marker from ${source.purposeEnum ?? source.purpose} at ${planningWidth}".` : ''),
      },
    });
    if (source) await copyCadChildren(tx, source.id, created.id);
    await recomputeStyleCadStatus(tx, styleId);
    return created;
  });

  logInfo(`Created PRODUCTION CAD ${newCAD.id} from stock ${fabricStockId} for style ${styleId}`);

  return res.status(201).json({
    success: true,
    message: 'PRODUCTION CAD created from stock',
    warning,
    data: {
      id: newCAD.id,
      cutableWidth: newCAD.cutableWidth,
      cadMeters: newCAD.cadMeters,
      cadAverage: newCAD.cadAverage,
      purpose: newCAD.purpose,
      approvalStatus: newCAD.approvalStatus,
      fabricStockId: newCAD.fabricStockId,
      styleFabricId: newCAD.styleFabricId,
      planningCadWidth: newCAD.planningCadWidth,
      widthVariance: newCAD.widthVariance,
      variancePercent: newCAD.variancePercent,
    },
  });
}

// ============================================================================
// PRODUCTION VARIANCE APPROVAL
// ============================================================================

/**
 * Approve or reject PRODUCTION CAD variance
 * POST /api/cad-planning/:styleId/row/:rowId/approve-variance
 * Admin only - for variance > 3%
 */
export async function approveProductionVariance(req: Request, res: Response) {
  const { rowId } = req.params;
  const { action, notes } = req.body; // action: 'APPROVE' | 'REJECT'
  const userId = req.user?.userId;

  if (!['APPROVE', 'REJECT'].includes(action)) {
    throw new ValidationError('Invalid action. Must be APPROVE or REJECT');
  }

  // Find the CAD row
  const cadRow = await prisma.fabric_width_cad.findUnique({
    where: { id: rowId },
    include: {
      styleFabric: {
        include: {
          style_components: {
            include: {
              styles: { select: { id: true, styleCode: true } },
            },
          },
        },
      },
    },
  });

  if (!cadRow) {
    throw new NotFoundError('CAD row', rowId);
  }

  // Verify this is a PRODUCTION CAD with pending variance approval
  if (cadRow.purpose !== 'PRODUCTION') {
    throw new BusinessError('Variance approval only applies to PRODUCTION CAD rows');
  }

  const varianceStatus = (cadRow as any).varianceApprovalStatus;
  if (varianceStatus !== 'PENDING_APPROVAL') {
    throw new BusinessError(`CAD row does not have pending variance approval. Current status: ${varianceStatus}`);
  }

  // Update variance approval status
  const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  await prisma.fabric_width_cad.update({
    where: { id: rowId },
    data: {
      varianceApprovalStatus: newStatus,
      varianceApprovedById: userId,
      varianceApprovedAt: new Date(),
      varianceApprovalNotes: notes || null,
    } as any,
  });

  const styleCode = cadRow.styleFabric?.style_components?.styles?.styleCode || 'Unknown';
  const variancePercent = (cadRow as any).variancePercent ? Number((cadRow as any).variancePercent).toFixed(2) : 'N/A';

  logInfo(
    `PRODUCTION variance ${action}ED for CAD ${rowId} (Style: ${styleCode}, Variance: ${variancePercent}%) by user ${userId}`
  );

  return res.json({
    success: true,
    data: {
      cadId: rowId,
      varianceApprovalStatus: newStatus,
      variancePercent: (cadRow as any).variancePercent ? Number((cadRow as any).variancePercent) : null,
      approvedById: userId,
      approvedAt: new Date(),
      notes,
    },
    message: `Variance ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`,
  });
}

/**
 * Get all PRODUCTION CAD rows pending variance approval
 * GET /api/cad-planning/pending-variance
 * Admin dashboard endpoint
 */
export async function getPendingVarianceApprovals(req: Request, res: Response) {
  const { styleId, orderId } = req.query;

  const whereClause: any = {
    purpose: 'PRODUCTION',
    varianceApprovalStatus: 'PENDING_APPROVAL',
  };

  // Optional filters
  if (styleId) {
    whereClause.styleFabrics = {
      some: {
        style_components: {
          styleId: styleId as string,
        },
      },
    };
  }

  if (orderId) {
    whereClause.clonedFromOrderId = orderId as string;
  }

  const pendingApprovals = await prisma.fabric_width_cad.findMany({
    where: whereClause,
    include: {
      greige: {
        select: { id: true, greigeName: true, genericGreigeName: true },
      },
      styleFabric: {
        include: {
          style_components: {
            include: {
              styles: { select: { id: true, styleCode: true, styleName: true } },
            },
          },
        },
      },
      sizeBreakdowns: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const formattedApprovals = pendingApprovals.map((cad: any) => {
    const style = cad.styleFabric?.style_components?.styles;
    return {
      cadId: cad.id,
      styleId: style?.id || null,
      styleCode: style?.styleCode || 'Unknown',
      styleName: style?.styleName || '',
      greigeName: cad.greige?.greigeName || 'Unknown',
      genericGreigeName: cad.greige?.genericGreigeName || '',
      cutableWidth: cad.cutableWidth ? Number(cad.cutableWidth) : null,
      cadAverage: cad.cadAverage ? Number(cad.cadAverage) : null,
      cadVariance: cad.cadVariance ? Number(cad.cadVariance) : null,
      variancePercent: cad.variancePercent ? Number(cad.variancePercent) : null,
      clonedFromOrderId: cad.clonedFromOrderId,
      clonedFromCadId: cad.clonedFromCadId,
      updatedAt: cad.updatedAt,
    };
  });

  return res.json({
    success: true,
    data: formattedApprovals,
    count: formattedApprovals.length,
  });
}
