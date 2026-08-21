import { Request, Response } from 'express';
import { Prisma, FabricFinishType } from '@prisma/client';
import prisma from '../config/database';
import logger, { logInfo } from '../utils/logger';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import { systemSettingsService } from '../services/system-settings.service';
import { cachedQuery, cacheKeys, cacheTTL } from '../lib/cache';
import { toCurrency, multiplyCurrency, divideCurrency, toNumber } from '../utils/currency'; // BUG-CAD8 fix
import {
  ALL_PARTS_CODE,
  ALL_PARTS_LEGACY_MARKER,
  CUTABLE_WIDTH_OFFSETS,
  getDefaultLayerMargin,
  calculateCadAverage,
  validateCutableWidth,
  validateCADModification,
  StyleCADSummary,
  ComponentCADSummary,
  FabricCADSummary,
  CADOption,
  CADCostResult,
} from './cad-planning.utils';
import { syncBomFabricId } from '../services/order-bom.service';
import { ensureMaterialRecord } from '../services/helpers/material-sync.helper';

/**
 * Get all styles pending CAD approval
 * GET /api/styles/cad-planning/pending
 * Query params: page, limit
 */
export async function getPendingCADStyles(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [styles, total] = await Promise.all([
    prisma.styles.findMany({
      where: {
        cadStatus: { in: ['PENDING', 'IN_PROGRESS'] },
        isActive: true,
      },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabricCAD: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.styles.count({
      where: {
        cadStatus: { in: ['PENDING', 'IN_PROGRESS'] },
        isActive: true,
      },
    }),
  ]);

  // Transform to StyleCADSummary format
  const data: StyleCADSummary[] = styles.map((style) => {
    const components: ComponentCADSummary[] = style.style_components.map((comp) => {
      const fabrics: FabricCADSummary[] = comp.style_fabrics.map((fabric) => {
        const hasApprovedCAD = fabric.fabricCADId != null;
        const hasOptions = fabric.fabricCAD != null;

        return {
          fabricId: fabric.id,
          fabricName: fabric.fabricName || 'Unknown',
          componentType: comp.componentType,
          cadStatus: hasApprovedCAD ? 'APPROVED' : hasOptions ? 'OPTIONS_GENERATED' : 'PENDING',
          approvedCADId: fabric.fabricCADId || undefined,
          approvedWidth: fabric.fabricCAD?.cutableWidth ? Number(fabric.fabricCAD.cutableWidth) : undefined,
          availableOptions: hasOptions ? 1 : 0,
        };
      });

      return {
        componentId: comp.id,
        componentName: comp.componentName,
        componentType: comp.componentType,
        fabrics,
      };
    });

    return {
      styleId: style.id,
      styleCode: style.styleCode,
      styleName: style.styleName,
      customerName: style.customerName || '',
      brandName: style.brandName || '',
      imageUrl: style.imageUrl || undefined,
      cadStatus: style.cadStatus,
      components,
      createdAt: style.createdAt.toISOString(),
      updatedAt: style.updatedAt.toISOString(),
    };
  });

  return res.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * Generate CAD options for a style's fabric group after selecting greige
 * POST /api/styles/cad-planning/generate
 * Body: { styleId, genericGreigeName, greigeId, averagingMode?, componentNames? }
 *
 * NEW WORKFLOW:
 * 1. User selects greige from greige_master
 * 2. System generates cutable width options based on greige width (offset -2", -4", -6")
 * 3. For SEPARATE mode, generates one set of options per component
 */
export async function generateCADOptions(req: Request, res: Response) {
  const {
    styleId,
    genericGreigeName,
    greigeId,
    averagingMode = 'COMBINED',
    componentNames = [], // For SEPARATE mode: list of component names
  } = req.body;

  // Verify style exists
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  // Get greige to determine cutable widths
  let greige = null;
  let cutableWidths: number[] = [];

  if (greigeId) {
    greige = await prisma.greige_master.findUnique({
      where: { id: greigeId },
    });

    if (!greige) {
      throw new NotFoundError('Greige fabric', greigeId);
    }

    // Calculate cutable widths from greige width
    const greigeWidth = Number(greige.greigeWidth);
    cutableWidths = CUTABLE_WIDTH_OFFSETS.map((offset) => greigeWidth + offset);
  } else {
    // Default widths if no greige selected
    cutableWidths = [54, 56, 58];
  }

  // Find or create fabric_master for this greige/style
  // Tolerant read: rows may predate the styleCode standardization until the repair script runs
  let fabric = await prisma.fabric_master.findFirst({
    where: greigeId
      ? {
          greigeId,
          genericGreigeName,
        }
      : {
          genericGreigeName,
          styleReference: { in: [style.styleCode, styleId] },
          isGeneric: true,
        },
  });

  if (!fabric) {
    fabric = await prisma.fabric_master.create({
      data: {
        fabricCode: greigeId ? `${greige!.greigeCode}-${Date.now()}` : `CAD-${styleId.slice(0, 8)}-${Date.now()}`,
        fabricName: greigeId ? `${genericGreigeName} - ${greige!.greigeName}` : `${genericGreigeName} (CAD Planning)`,
        genericGreigeName,
        greigeId: greigeId || null,
        actualWidth: greige?.greigeWidth || null,
        isActive: true,
        isGeneric: true,
        styleReference: style.styleCode,
        createdById: req.user?.userId || 'system',
      },
    });
    // Material Identity: materials.id === fabric_master.id
    await ensureMaterialRecord(fabric.id, 'FABRIC');
  }

  // Generate CAD options
  const options: CADOption[] = [];

  // For SEPARATE mode, we generate options for each component
  // For COMBINED mode, we generate options without componentName
  const componentsToProcess = averagingMode === 'SEPARATE' && componentNames.length > 0 ? componentNames : [null]; // null means COMBINED

  for (const componentName of componentsToProcess) {
    for (const cutableWidth of cutableWidths) {
      // Check if CAD already exists for this width/component combination
      let cad = await prisma.fabric_width_cad.findFirst({
        where: {
          fabricId: fabric.id,
          cutableWidth: cutableWidth,
          componentName: componentName || null,
        },
      });

      if (!cad) {
        // Create CAD entry with default layer margin
        cad = await prisma.fabric_width_cad.create({
          data: {
            fabricId: fabric.id,
            costingStyleId: styleId, // Link to style for cost sheet discovery
            cutableWidth: cutableWidth,
            widthUnit: 'inches',
            cadWastagePercent: await systemSettingsService.getNumberDefault('FABRIC_DEFAULT_WASTAGE_PERCENT'),
            layerMarginMeters: 0.05, // Default 5cm layer margin
            greigeId: greigeId || null,
            componentName: componentName || null,
            isPreferred: cutableWidth === cutableWidths[0], // Prefer largest width
            createdById: req.user?.userId || 'system',
          },
        });
      } else if (greigeId && cad.greigeId !== greigeId) {
        // Update existing CAD entry's greigeId if user selected a different greige
        cad = await prisma.fabric_width_cad.update({
          where: { id: cad.id },
          data: {
            greigeId,
            costingStyleId: styleId, // Ensure costingStyleId is set on existing rows too
          },
        });
      }

      options.push({
        cadId: cad.id,
        fabricId: fabric.id,
        fabricName: fabric.fabricName,
        greigeId: greigeId || undefined,
        greigeName: greige?.greigeName || undefined,
        cutableWidth: Number(cad.cutableWidth),
        widthUnit: cad.widthUnit,
        cadMeters: cad.cadMeters ? Number(cad.cadMeters) : null,
        cadYards: cad.cadYards ? Number(cad.cadYards) : undefined,
        cadWastagePercent: Number(cad.cadWastagePercent),
        layerMarginMeters: cad.layerMarginMeters ? Number(cad.layerMarginMeters) : 0.05,
        markerEfficiency: cad.markerEfficiency ? Number(cad.markerEfficiency) : undefined,
        isPreferred: cad.isPreferred,
        supplierAvailability: cad.supplierAvailability || undefined,
        processingPricePerMeter: cad.processingPricePerMeter ? Number(cad.processingPricePerMeter) : undefined,
        componentName: cad.componentName || undefined,
        notes: cad.notes || undefined,
      });
    }
  }

  // Update style status to IN_PROGRESS
  await prisma.styles.update({
    where: { id: styleId },
    data: { cadStatus: 'IN_PROGRESS' },
  });

  return res.json({
    success: true,
    message: 'CAD options generated successfully',
    styleId,
    genericGreigeName,
    greigeId: greigeId || null,
    greigeName: greige?.greigeName || null,
    greigeWidth: greige ? Number(greige.greigeWidth) : null,
    greigePricePerMeter: greige?.costPerMeter ? Number(greige.costPerMeter) : null,
    averagingMode,
    options,
    recommendedOption: options.find((opt) => opt.isPreferred)?.cadId || options[0]?.cadId,
  });
}

/**
 * Calculate cost for a specific CAD option
 * POST /api/styles/cad-planning/calculate-cost
 * Body: { cadId, fabricRate, unit? }
 */
export async function calculateCADCost(req: Request, res: Response) {
  const { cadId, fabricRate, unit = 'meters' } = req.body;

  // Get CAD details
  const cad = await prisma.fabric_width_cad.findUnique({
    where: { id: cadId },
    include: {
      fabric: true,
    },
  });

  if (!cad) {
    throw new NotFoundError('CAD record', cadId);
  }

  // Calculate effective consumption
  const cadConsumption = unit === 'meters' ? Number(cad.cadMeters || 0) : Number(cad.cadYards || 0);

  if (cadConsumption === 0) {
    throw new BusinessError('CAD consumption value not available. Please input CAD value first.');
  }

  const wastagePercent = Number(cad.cadWastagePercent);
  // BUG-CAD8 fix: use decimal.js for safe arithmetic
  const wastageMultiplier = toCurrency(1).plus(toCurrency(wastagePercent).dividedBy(100));
  const effectiveConsumption = toNumber(toCurrency(cadConsumption).times(wastageMultiplier));
  const totalCost = toNumber(multiplyCurrency(effectiveConsumption, fabricRate));
  const costPerMeter = toNumber(unit === 'meters' ? toCurrency(fabricRate) : divideCurrency(fabricRate, 0.9144)); // yards to meters

  const result: CADCostResult = {
    cadId,
    cutableWidth: Number(cad.cutableWidth),
    cadConsumption,
    wastagePercent,
    effectiveConsumption,
    fabricRate,
    totalCost,
    costPerMeter,
    unit: unit === 'meters' ? 'meters' : 'yards',
  };

  return res.json({
    success: true,
    data: result,
  });
}

/**
 * Update CAD values for a specific width
 * PUT /api/styles/cad-planning/update-cad/:cadId
 * Body: { cutableWidth?, cadMeters?, cadYards?, cadWastagePercent?, layerMarginMeters?,
 *         piecesPerMarker?, markerLengthMeters?, markerEfficiency?, notes? }
 *
 * NEW: Auto-calculates layerMarginMeters based on cadMeters if not explicitly provided
 */
export async function updateCADValues(req: Request, res: Response) {
  const { cadId } = req.params;
  const parsedCadId = parseInt(cadId, 10);

  // Validate that approved CAD cannot be updated
  await validateCADModification(cadId, 'update');

  const {
    cutableWidth,
    cadMeters,
    cadYards,
    cadWastagePercent,
    layerMarginMeters,
    piecesPerMarker,
    markerLengthMeters,
    processingPricePerMeter,
    markerEfficiency,
    markerPlanFile,
    supplierAvailability,
    priceDifferential,
    notes,
  } = req.body;

  // Verify CAD exists
  const existing = await prisma.fabric_width_cad.findUnique({
    where: { id: cadId },
  });

  if (!existing) {
    throw new NotFoundError('CAD record', cadId);
  }

  // Build update data
  const updateData: Prisma.fabric_width_cadUpdateInput = {};
  if (cutableWidth !== undefined) updateData.cutableWidth = cutableWidth;
  if (cadMeters !== undefined) {
    updateData.cadMeters = cadMeters;
    // Auto-calculate layer margin if not explicitly provided
    if (layerMarginMeters === undefined) {
      updateData.layerMarginMeters = getDefaultLayerMargin(cadMeters);
    }
  }
  if (cadYards !== undefined) updateData.cadYards = cadYards;
  if (cadWastagePercent !== undefined) updateData.cadWastagePercent = cadWastagePercent;
  if (layerMarginMeters !== undefined) updateData.layerMarginMeters = layerMarginMeters;
  if (piecesPerMarker !== undefined) updateData.piecesPerMarker = piecesPerMarker;
  if (markerLengthMeters !== undefined) updateData.markerLengthMeters = markerLengthMeters;
  if (processingPricePerMeter !== undefined) updateData.processingPricePerMeter = processingPricePerMeter;
  if (markerEfficiency !== undefined) updateData.markerEfficiency = markerEfficiency;
  if (markerPlanFile !== undefined) updateData.markerPlanFile = markerPlanFile;
  if (supplierAvailability !== undefined) updateData.supplierAvailability = supplierAvailability;
  if (priceDifferential !== undefined) updateData.priceDifferential = priceDifferential;
  if (notes !== undefined) updateData.notes = notes;

  // Calculate cadAverage if any relevant fields are updated
  // Use provided values or fall back to existing record values
  const effectiveCadMeters =
    cadMeters !== undefined ? cadMeters : existing.cadMeters ? Number(existing.cadMeters) : null;
  const effectiveLayerMargin =
    layerMarginMeters !== undefined
      ? layerMarginMeters
      : updateData.layerMarginMeters !== undefined
        ? Number(updateData.layerMarginMeters)
        : existing.layerMarginMeters
          ? Number(existing.layerMarginMeters)
          : null;
  const effectivePiecesPerMarker = piecesPerMarker !== undefined ? piecesPerMarker : existing.piecesPerMarker;

  const calculatedCadAverage = calculateCadAverage(effectiveCadMeters, effectiveLayerMargin, effectivePiecesPerMarker);
  if (calculatedCadAverage !== null) {
    updateData.cadAverage = calculatedCadAverage;
  }

  const updated = await prisma.fabric_width_cad.update({
    where: { id: cadId },
    data: updateData,
  });

  return res.json({
    success: true,
    message: 'CAD values updated successfully',
    data: {
      ...updated,
      cutableWidth: Number(updated.cutableWidth),
      cadMeters: updated.cadMeters ? Number(updated.cadMeters) : null,
      cadYards: updated.cadYards ? Number(updated.cadYards) : null,
      cadWastagePercent: Number(updated.cadWastagePercent),
      layerMarginMeters: updated.layerMarginMeters ? Number(updated.layerMarginMeters) : null,
      piecesPerMarker: updated.piecesPerMarker,
      markerLengthMeters: updated.markerLengthMeters ? Number(updated.markerLengthMeters) : null,
      processingPricePerMeter: updated.processingPricePerMeter ? Number(updated.processingPricePerMeter) : null,
    },
  });
}

/**
 * Get available greige options for a generic fabric name
 * GET /api/styles/cad-planning/greige-options
 * Query params: genericGreigeName
 */
export async function getGreigeOptionsForGeneric(req: Request, res: Response) {
  const { genericGreigeName } = req.query;

  if (!genericGreigeName) {
    throw new ValidationError('genericGreigeName query parameter is required');
  }

  // Find all fabrics with this generic name
  const fabrics = await prisma.fabric_master.findMany({
    where: {
      genericGreigeName: genericGreigeName as string,
      isActive: true,
    },
    include: {
      greige: true,
    },
    distinct: ['greigeId'],
  });

  const greigeOptions = fabrics
    .filter((fabric) => fabric.greige) // Only include fabrics with greige
    .map((fabric) => ({
      greigeId: fabric.greigeId,
      greigeCode: fabric.greige!.greigeCode,
      greigeName: fabric.greige!.greigeName,
      yarnCount: fabric.greige!.yarnCount,
      construction: fabric.greige!.construction,
      composition: fabric.greige!.composition,
      weaveType: fabric.greige!.weaveType,
      greigeWidth: Number(fabric.greige!.greigeWidth),
    }));

  return res.json({
    success: true,
    genericGreigeName,
    options: greigeOptions,
    total: greigeOptions.length,
  });
}

/**
 * Get CAD planning summary for a style
 * GET /api/styles/:styleId/cad-summary
 */
export async function getStyleCADSummary(req: Request, res: Response) {
  const { styleId } = req.params;

  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    include: {
      style_components: {
        include: {
          style_fabrics: {
            include: {
              fabricCAD: true,
              fabric: {
                include: {
                  greige: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  // Build summary
  const components = style.style_components.map((comp) => ({
    componentId: comp.id,
    componentName: comp.componentName,
    componentType: comp.componentType,
    fabrics: comp.style_fabrics.map((fabric) => ({
      fabricId: fabric.id,
      fabricName: fabric.fabricName || fabric.fabric?.fabricName || 'Unknown',
      genericGreigeName: fabric.genericGreigeName,
      fabricMasterId: fabric.fabricId,
      hasCAD: fabric.fabricCADId !== null,
      cutableWidth: fabric.cutableWidth ? Number(fabric.cutableWidth) : null,
      averagingMode: fabric.averagingMode || 'COMBINED',
      selectedGreigeId: fabric.selectedGreigeId,
      cadDetails: fabric.fabricCAD
        ? {
            cadId: fabric.fabricCAD.id,
            cutableWidth: Number(fabric.fabricCAD.cutableWidth),
            cadMeters: fabric.fabricCAD.cadMeters ? Number(fabric.fabricCAD.cadMeters) : null,
            wastagePercent: Number(fabric.fabricCAD.cadWastagePercent),
            layerMarginMeters: fabric.fabricCAD.layerMarginMeters ? Number(fabric.fabricCAD.layerMarginMeters) : null,
            processingPricePerMeter: fabric.fabricCAD.processingPricePerMeter
              ? Number(fabric.fabricCAD.processingPricePerMeter)
              : null,
            markerEfficiency: fabric.fabricCAD.markerEfficiency ? Number(fabric.fabricCAD.markerEfficiency) : null,
            componentName: fabric.fabricCAD.componentName,
          }
        : null,
      greigeDetails: fabric.fabric?.greige
        ? {
            greigeId: fabric.fabric.greigeId,
            greigeName: fabric.fabric.greige.greigeName,
            greigeWidth: Number(fabric.fabric.greige.greigeWidth),
            greigePricePerMeter: fabric.fabric.greige.costPerMeter ? Number(fabric.fabric.greige.costPerMeter) : null,
          }
        : null,
    })),
  }));

  return res.json({
    success: true,
    data: {
      styleId: style.id,
      styleCode: style.styleCode,
      styleName: style.styleName,
      cadStatus: style.cadStatus,
      approvedCadDate: style.approvedCadDate,
      components,
    },
  });
}

/**
 * Get enhanced CAD planning data for a style
 * GET /api/styles/:styleId/cad-planning
 *
 * Returns:
 * - Style info
 * - Fabric groups (grouped by genericGreigeName + fabricFinishType)
 * - Available greige options for each group
 * - CAD options for each group (if greige selected)
 */
export async function getEnhancedCADPlanning(req: Request, res: Response) {
  const { styleId } = req.params;

  // Get style with all fabric data and variants for size options
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    include: {
      style_variants: true, // Include style variants for size options
      style_components: {
        include: {
          style_fabrics: {
            include: {
              fabricCAD: true,
              fabric: {
                include: {
                  greige: true,
                },
              },
              selectedGreige: true,
              embroidery: true,
            },
          },
        },
      },
    },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  // Extract size options from style variants
  type StyleVariant = (typeof style.style_variants)[0];
  type SizeOptionType = { sizeId: string | null; sizeName: string; sortOrder: number };
  const sizeOptions: SizeOptionType[] = style.style_variants
    .filter((v: StyleVariant) => v.sizeName)
    .map(
      (v: StyleVariant): SizeOptionType => ({
        sizeId: v.sizeId,
        sizeName: v.sizeName!,
        sortOrder: v.sortOrder,
      })
    )
    .filter(
      (size: SizeOptionType, index: number, self: SizeOptionType[]) =>
        index === self.findIndex((s: SizeOptionType) => s.sizeName === size.sizeName)
    )
    .sort((a: SizeOptionType, b: SizeOptionType) => a.sortOrder - b.sortOrder);

  // Group fabrics by genericGreigeName + fabricFinishType + embroidery state
  // Embroidery creates a "derivative fabric" that needs separate CAD planning
  const fabricGroupsMap = new Map<
    string,
    {
      groupKey: string;
      genericGreigeName: string;
      fabricFinishType: string | null;
      printDesign: string | null;
      colorName: string | null;
      hasEmbroidery: boolean;
      embroidery: {
        id: string;
        embroideryCode: string;
        designName: string;
        costPerMeter: number | null;
      } | null;
      components: string[];
      fabrics: any[];
      selectedGreigeId: string | null;
      averagingMode: string;
    }
  >();

  for (const comp of style.style_components) {
    for (const fabric of comp.style_fabrics) {
      // Include embroidery state in grouping key
      // hasEmbroidery alone determines if it's embroidered - embroideryId is optional
      const embroideryPart = fabric.hasEmbroidery
        ? fabric.embroideryId
          ? `EMB-${fabric.embroideryId.substring(0, 8)}`
          : 'EMB-PENDING'
        : 'NO_EMB';
      // Include design/color in group key for proper fabric distinction
      const designColorPart =
        fabric.printDesign || (fabric as any).colorMaster?.colorName || fabric.fabricColor || 'Default';
      const groupKey = `${fabric.genericGreigeName || 'Unknown'}-${fabric.fabricFinishType || 'PLAIN'}-${designColorPart}-${embroideryPart}`;

      if (!fabricGroupsMap.has(groupKey)) {
        fabricGroupsMap.set(groupKey, {
          groupKey,
          genericGreigeName: fabric.genericGreigeName || 'Unknown',
          fabricFinishType: fabric.fabricFinishType,
          printDesign: fabric.printDesign || null,
          colorName: (fabric as any).colorMaster?.colorName || fabric.fabricColor || null,
          hasEmbroidery: fabric.hasEmbroidery || false,
          embroidery: fabric.embroidery
            ? {
                id: fabric.embroidery.id,
                embroideryCode: fabric.embroidery.embroideryCode,
                designName: fabric.embroidery.designName,
                costPerMeter: fabric.embroidery.costPerMeter ? Number(fabric.embroidery.costPerMeter) : null,
              }
            : null,
          components: [],
          fabrics: [],
          selectedGreigeId: fabric.selectedGreigeId,
          averagingMode: fabric.averagingMode || 'COMBINED',
        });
      }

      const group = fabricGroupsMap.get(groupKey)!;
      if (!group.components.includes(comp.componentName)) {
        group.components.push(comp.componentName);
      }
      group.fabrics.push({
        id: fabric.id,
        componentId: comp.id,
        componentName: comp.componentName,
        genericGreigeName: fabric.genericGreigeName,
        fabricFinishType: fabric.fabricFinishType,
        cutableWidth: fabric.cutableWidth ? Number(fabric.cutableWidth) : null,
        hasEmbroidery: fabric.hasEmbroidery,
        embroideryId: fabric.embroideryId,
        embroideryName: fabric.embroidery?.designName,
        fabricCADId: fabric.fabricCADId,
        selectedGreigeId: fabric.selectedGreigeId,
        averagingMode: fabric.averagingMode,
      });
    }
  }

  // For each group, get available greiges and CAD options
  const fabricGroups = [];
  const missingGreigeNames: string[] = [];

  for (const [, group] of fabricGroupsMap) {
    // Get available greiges for this generic fabric name (case-insensitive match)
    const availableGreiges = await prisma.greige_master.findMany({
      where: {
        genericGreigeName: {
          equals: group.genericGreigeName,
          mode: 'insensitive',
        },
        isActive: true,
      },
      orderBy: { greigeName: 'asc' },
    });

    // Check if there are ready-purchase fabrics (fabric_master with no greige)
    // These are fabrics purchased directly without going through greige conversion
    // Look up fabric_master by genericGreigeName where greigeId is NULL
    let readyPurchaseFabrics: any[] = [];
    if (availableGreiges.length === 0 && group.genericGreigeName) {
      readyPurchaseFabrics = await prisma.fabric_master.findMany({
        where: {
          genericGreigeName: {
            equals: group.genericGreigeName,
            mode: 'insensitive',
          },
          greigeId: null, // Ready-purchase fabrics have no greige
          isActive: true,
        },
        include: {
          widthCADs: {
            orderBy: { cutableWidth: 'desc' },
            include: {
              sizeBreakdowns: {
                orderBy: { sizeName: 'asc' },
              },
            },
          },
        },
      });
    }

    const isReadyPurchaseFabric = readyPurchaseFabrics.length > 0;

    // Log if no greige found for this generic name (only if not a ready-purchase fabric)
    if (availableGreiges.length === 0 && group.genericGreigeName && !isReadyPurchaseFabric) {
      missingGreigeNames.push(group.genericGreigeName);
      logInfo(`No greige found for genericGreigeName: "${group.genericGreigeName}"`);
    }

    // Get CAD options if greige is selected OR if this is a ready-purchase fabric
    let cadOptions: any[] = [];

    if (group.selectedGreigeId) {
      // Greige-based fabric: Find fabric_master for this greige
      const fabricMaster = await prisma.fabric_master.findFirst({
        where: {
          greigeId: group.selectedGreigeId,
          genericGreigeName: group.genericGreigeName,
        },
        include: {
          greige: true,
          widthCADs: {
            orderBy: { cutableWidth: 'desc' },
            include: {
              sizeBreakdowns: {
                orderBy: { sizeName: 'asc' },
              },
            },
          },
        },
      });

      if (fabricMaster) {
        cadOptions = fabricMaster.widthCADs.map((cad) => ({
          id: cad.id,
          cutableWidth: Number(cad.cutableWidth),
          cadMeters: cad.cadMeters ? Number(cad.cadMeters) : null,
          cadYards: cad.cadYards ? Number(cad.cadYards) : null,
          cadWastagePercent: Number(cad.cadWastagePercent),
          layerMarginMeters: cad.layerMarginMeters ? Number(cad.layerMarginMeters) : null,
          piecesPerMarker: cad.piecesPerMarker,
          markerLengthMeters: cad.markerLengthMeters ? Number(cad.markerLengthMeters) : null,
          processingPricePerMeter: cad.processingPricePerMeter ? Number(cad.processingPricePerMeter) : null,
          markerEfficiency: cad.markerEfficiency ? Number(cad.markerEfficiency) : null,
          componentName: cad.componentName,
          isPreferred: cad.isPreferred,
          notes: cad.notes,
          printDirection: cad.printDirection,
          sizeBreakdowns:
            cad.sizeBreakdowns?.map(
              (sb: { id: string; sizeName: string; sizeId: string | null; quantity: number }) => ({
                id: sb.id,
                sizeName: sb.sizeName,
                sizeId: sb.sizeId,
                quantity: sb.quantity,
              })
            ) || [],
        }));
      }
    } else if (isReadyPurchaseFabric) {
      // Ready-purchase fabric: Get CAD options from fabric_master found by genericGreigeName lookup
      // Use the first matching ready-purchase fabric
      const fabricMaster = readyPurchaseFabrics[0];

      if (fabricMaster) {
        // If no CAD entries exist, create a default one based on fabric's cutableWidth
        if (fabricMaster.widthCADs.length === 0) {
          const defaultWidth = fabricMaster.cutableWidth
            ? Number(fabricMaster.cutableWidth)
            : fabricMaster.actualWidth
              ? Number(fabricMaster.actualWidth) - 2
              : 54; // Default fallback

          const newCad = await prisma.fabric_width_cad.create({
            data: {
              fabricId: fabricMaster.id,
              cutableWidth: defaultWidth,
              widthUnit: 'inches',
              cadWastagePercent: await systemSettingsService.getNumberDefault('FABRIC_DEFAULT_WASTAGE_PERCENT'),
              layerMarginMeters: 0.05,
              isPreferred: true,
              createdById: req.user?.userId || 'system',
            },
          });

          cadOptions.push({
            id: newCad.id,
            cutableWidth: Number(newCad.cutableWidth),
            cadMeters: null,
            cadYards: null,
            cadWastagePercent: Number(newCad.cadWastagePercent),
            layerMarginMeters: Number(newCad.layerMarginMeters),
            piecesPerMarker: null,
            markerLengthMeters: null,
            processingPricePerMeter: null,
            markerEfficiency: null,
            componentName: null,
            isPreferred: true,
            notes: null,
            printDirection: null,
            sizeBreakdowns: [],
          });
        } else {
          for (const cad of fabricMaster.widthCADs) {
            cadOptions.push({
              id: cad.id,
              cutableWidth: Number(cad.cutableWidth),
              cadMeters: cad.cadMeters ? Number(cad.cadMeters) : null,
              cadYards: cad.cadYards ? Number(cad.cadYards) : null,
              cadWastagePercent: Number(cad.cadWastagePercent),
              layerMarginMeters: cad.layerMarginMeters ? Number(cad.layerMarginMeters) : null,
              piecesPerMarker: cad.piecesPerMarker,
              markerLengthMeters: cad.markerLengthMeters ? Number(cad.markerLengthMeters) : null,
              processingPricePerMeter: cad.processingPricePerMeter ? Number(cad.processingPricePerMeter) : null,
              markerEfficiency: cad.markerEfficiency ? Number(cad.markerEfficiency) : null,
              componentName: cad.componentName,
              isPreferred: cad.isPreferred,
              notes: cad.notes,
              printDirection: cad.printDirection,
              sizeBreakdowns:
                cad.sizeBreakdowns?.map(
                  (sb: { id: string; sizeName: string; sizeId: string | null; quantity: number }) => ({
                    id: sb.id,
                    sizeName: sb.sizeName,
                    sizeId: sb.sizeId,
                    quantity: sb.quantity,
                  })
                ) || [],
            });
          }
        }
      }
    }

    // Get selected greige details
    const selectedGreige = group.selectedGreigeId
      ? availableGreiges.find((g) => g.id === group.selectedGreigeId)
      : null;

    // For ready-purchase fabrics, get fabric details to show instead of greige
    let readyPurchaseFabricInfo = null;
    if (isReadyPurchaseFabric && readyPurchaseFabrics.length > 0) {
      const fabricMaster = readyPurchaseFabrics[0];
      readyPurchaseFabricInfo = {
        id: fabricMaster.id,
        fabricCode: fabricMaster.fabricCode,
        fabricName: fabricMaster.fabricName,
        actualWidth: fabricMaster.actualWidth ? Number(fabricMaster.actualWidth) : null,
        cutableWidth: fabricMaster.cutableWidth ? Number(fabricMaster.cutableWidth) : null,
        costPerMeter: fabricMaster.costPerMeter ? Number(fabricMaster.costPerMeter) : null,
        composition: fabricMaster.composition,
        yarnCount: fabricMaster.yarnCount,
      };
    }

    fabricGroups.push({
      groupKey: group.groupKey,
      genericGreigeName: group.genericGreigeName,
      fabricFinishType: group.fabricFinishType,
      hasEmbroidery: group.hasEmbroidery,
      embroidery: group.embroidery,
      components: group.components,
      fabrics: group.fabrics,
      averagingMode: group.averagingMode,
      // Ready-purchase fabric flag and info
      isReadyPurchaseFabric,
      readyPurchaseFabric: readyPurchaseFabricInfo,
      // Greige options (empty for ready-purchase fabrics)
      availableGreiges: availableGreiges.map((g) => ({
        id: g.id,
        greigeCode: g.greigeCode,
        greigeName: g.greigeName,
        greigeWidth: Number(g.greigeWidth),
        defaultCutableWidth: g.defaultCutableWidth ? Number(g.defaultCutableWidth) : null,
        expectedFinishedWidthMin: g.expectedFinishedWidthMin ? Number(g.expectedFinishedWidthMin) : null,
        expectedFinishedWidthMax: g.expectedFinishedWidthMax ? Number(g.expectedFinishedWidthMax) : null,
        greigePricePerMeter: g.costPerMeter ? Number(g.costPerMeter) : null,
        composition: g.composition,
        weaveType: g.weaveType,
        // Calculate potential cutable widths
        cutableWidths: CUTABLE_WIDTH_OFFSETS.map((offset) => Number(g.greigeWidth) + offset),
      })),
      selectedGreigeId: group.selectedGreigeId,
      selectedGreige: selectedGreige
        ? {
            id: selectedGreige.id,
            greigeCode: selectedGreige.greigeCode,
            greigeName: selectedGreige.greigeName,
            greigeWidth: Number(selectedGreige.greigeWidth),
            defaultCutableWidth: selectedGreige.defaultCutableWidth ? Number(selectedGreige.defaultCutableWidth) : null,
            expectedFinishedWidthMin: selectedGreige.expectedFinishedWidthMin
              ? Number(selectedGreige.expectedFinishedWidthMin)
              : null,
            expectedFinishedWidthMax: selectedGreige.expectedFinishedWidthMax
              ? Number(selectedGreige.expectedFinishedWidthMax)
              : null,
            greigePricePerMeter: selectedGreige.costPerMeter ? Number(selectedGreige.costPerMeter) : null,
          }
        : null,
      cadOptions,
      // Size options for size breakdown editing
      sizeOptions,
    });
  }

  return res.json({
    success: true,
    data: {
      style: {
        id: style.id,
        styleCode: style.styleCode,
        styleName: style.styleName,
        cadStatus: style.cadStatus,
        approvedCadDate: style.approvedCadDate,
      },
      fabricGroups,
      // Include missing greige names so user can update Greige Master
      missingGreigeNames: missingGreigeNames.length > 0 ? missingGreigeNames : undefined,
    },
  });
}

/**
 * Select greige for a fabric group and update style_fabrics
 * POST /api/styles/:styleId/cad-planning/select-greige
 * Body: { groupKey, greigeId, averagingMode }
 */
export async function selectGreigeForGroup(req: Request, res: Response) {
  const { styleId } = req.params;
  const { groupKey, greigeId, averagingMode = 'COMBINED' } = req.body;

  // Parse groupKey which now includes embroidery state
  // Format: "Poplin-DYED-NO_EMB" or "Poplin-DYED-EMB-12345678"
  const parts = groupKey.split('-');
  const genericGreigeName = parts[0];
  const fabricFinishType = parts[1];
  const hasEmbroidery = parts.length > 2 && parts[2] === 'EMB';
  const embroideryIdPrefix = hasEmbroidery && parts.length > 3 ? parts[3] : null;

  // Build where clause for style_fabrics based on embroidery filter
  const fabricWhereClause: any = {
    genericGreigeName,
    fabricFinishType: fabricFinishType === 'PLAIN' ? null : fabricFinishType,
  };

  if (hasEmbroidery) {
    fabricWhereClause.hasEmbroidery = true;
    if (embroideryIdPrefix) {
      fabricWhereClause.embroideryId = { startsWith: embroideryIdPrefix };
    }
  } else {
    // Match fabrics without embroidery (hasEmbroidery = false or not set)
    fabricWhereClause.OR = [{ hasEmbroidery: false }, { hasEmbroidery: { equals: false } }];
  }

  // Get all style_fabrics matching this group (including embroidery filter)
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    include: {
      style_components: {
        include: {
          style_fabrics: {
            where: fabricWhereClause,
          },
        },
      },
    },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  // Verify greige exists
  const greige = await prisma.greige_master.findUnique({
    where: { id: greigeId },
  });

  if (!greige) {
    throw new NotFoundError('Greige', greigeId);
  }

  // Update all matching style_fabrics
  const fabricIds = style.style_components.flatMap((comp) => comp.style_fabrics.map((f) => f.id));

  await prisma.style_fabrics.updateMany({
    where: { id: { in: fabricIds } },
    data: {
      selectedGreigeId: greigeId,
      averagingMode,
    },
  });

  // Generate CAD options for this selection
  const componentNames = style.style_components
    .filter((comp) => comp.style_fabrics.length > 0)
    .map((comp) => comp.componentName);

  // Call generateCADOptions internally
  const req2 = {
    body: {
      styleId,
      genericGreigeName,
      greigeId,
      averagingMode,
      componentNames: averagingMode === 'SEPARATE' ? componentNames : [],
    },
    user: req.user,
  } as Request;

  // Find or create fabric_master
  let fabric = await prisma.fabric_master.findFirst({
    where: {
      greigeId,
      genericGreigeName,
    },
  });

  if (!fabric) {
    fabric = await prisma.fabric_master.create({
      data: {
        fabricCode: `${greige.greigeCode}-${Date.now()}`,
        fabricName: `${genericGreigeName} - ${greige.greigeName}`,
        genericGreigeName,
        greigeId,
        actualWidth: greige.greigeWidth,
        isActive: true,
        isGeneric: true,
        styleReference: style.styleCode,
        createdById: req.user?.userId || 'system',
      },
    });
    // Material Identity: materials.id === fabric_master.id
    await ensureMaterialRecord(fabric.id, 'FABRIC');
  }

  // Get greige width and suggest default cutable width
  // NOTE: Auto-width generation has been removed - users add widths manually on CAD Edit page
  const greigeWidth = Number(greige.greigeWidth);
  const suggestedCutableWidth = greige.defaultCutableWidth ? Number(greige.defaultCutableWidth) : greigeWidth - 4; // Default suggestion: 4 inches less than greige width

  return res.json({
    success: true,
    message: 'Greige selected successfully. Navigate to CAD Edit page to add width options.',
    data: {
      greigeId,
      greigeName: greige.greigeName,
      greigeWidth: greigeWidth,
      suggestedCutableWidth,
      averagingMode,
      fabricsUpdated: fabricIds.length,
      fabricId: fabric.id,
    },
  });
}

/**
 * Add a new CAD width entry for a fabric group
 * POST /api/styles/:styleId/cad-planning/add-width
 * Body: { groupKey, fabricId?, cutableWidth, greigeId?, componentName? }
 *
 * Allows users to add custom width CAD entries that may not be pre-defined
 */
export async function addCADWidth(req: Request, res: Response) {
  const { styleId } = req.params;
  const { groupKey, fabricId, cutableWidth, greigeId, componentName } = req.body;

  if (!cutableWidth) {
    throw new ValidationError('cutableWidth is required');
  }

  // Parse groupKey to get genericGreigeName
  const parts = groupKey.split('-');
  const genericGreigeName = parts[0];

  // If greigeId provided, validate cutableWidth against greige's finished width range
  if (greigeId) {
    const greige = await prisma.greige_master.findUnique({
      where: { id: greigeId },
      select: {
        greigeWidth: true,
        expectedFinishedWidthMin: true,
        expectedFinishedWidthMax: true,
      },
    });

    if (greige) {
      // Check if this fabric group has any embroidery parts
      // If so, allow wider range (up to greige width)
      const hasEmbroideryParts = await prisma.style_pattern_parts.findFirst({
        where: {
          styleFabric: {
            style_components: {
              styleId: styleId,
            },
            cadGroupKey: groupKey,
          },
          goesToEmbroidery: true,
        },
      });

      const validation = validateCutableWidth(Number(cutableWidth), greige, !!hasEmbroideryParts);

      if (!validation.valid) {
        throw new ValidationError(validation.message || 'Cutable width out of valid range');
      }
    }
  }

  let targetFabricId = fabricId;

  // If no fabricId provided, find or create fabric_master
  if (!targetFabricId) {
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      select: { styleCode: true },
    });

    if (!style) {
      throw new NotFoundError('Style', styleId);
    }

    // Tolerant read: rows may predate the styleCode standardization until the repair script runs
    let fabric = await prisma.fabric_master.findFirst({
      where: greigeId
        ? {
            greigeId,
            genericGreigeName,
          }
        : {
            genericGreigeName,
            styleReference: { in: [style.styleCode, styleId] },
          },
    });

    if (!fabric) {
      // Create fabric_master for this width
      const greige = greigeId
        ? await prisma.greige_master.findUnique({
            where: { id: greigeId },
          })
        : null;

      fabric = await prisma.fabric_master.create({
        data: {
          fabricCode:
            greigeId && greige ? `${greige.greigeCode}-CAD-${Date.now()}` : `CAD-${styleId.slice(0, 8)}-${Date.now()}`,
          fabricName:
            greigeId && greige ? `${genericGreigeName} - ${greige.greigeName}` : `${genericGreigeName} (CAD Planning)`,
          genericGreigeName,
          greigeId: greigeId || null,
          actualWidth: greige?.greigeWidth || cutableWidth + 4, // Estimate
          isActive: true,
          isGeneric: true,
          styleReference: style.styleCode,
          createdById: req.user?.userId || 'system',
        },
      });
      // Material Identity: materials.id === fabric_master.id
      await ensureMaterialRecord(fabric.id, 'FABRIC');
    }

    targetFabricId = fabric.id;
  }

  // Check if CAD already exists for this width/component
  const existing = await prisma.fabric_width_cad.findFirst({
    where: {
      fabricId: targetFabricId,
      cutableWidth: cutableWidth,
      componentName: componentName || null,
    },
  });

  if (existing) {
    throw new BusinessError(`CAD entry for width ${cutableWidth}" already exists`);
  }

  // Create new CAD entry with printDirection from request body or default
  const { printDirection } = req.body;
  const newCad = await prisma.fabric_width_cad.create({
    data: {
      fabricId: targetFabricId,
      costingStyleId: styleId, // Link to style for cost sheet discovery
      cutableWidth,
      widthUnit: 'inches',
      cadWastagePercent: await systemSettingsService.getNumberDefault('FABRIC_DEFAULT_WASTAGE_PERCENT'),
      layerMarginMeters: 0.05,
      greigeId: greigeId || null,
      componentName: componentName || null,
      printDirection: printDirection || 'TWO_WAY', // Default to TWO_WAY (more efficient)
      isPreferred: false, // New entries default to not preferred
      createdById: req.user?.userId || 'system',
    },
    include: {
      sizeBreakdowns: true,
    },
  });

  return res.json({
    success: true,
    message: 'CAD width added successfully',
    data: {
      id: newCad.id,
      fabricId: newCad.fabricId,
      cutableWidth: Number(newCad.cutableWidth),
      widthUnit: newCad.widthUnit,
      cadMeters: null,
      cadYards: null,
      cadWastagePercent: Number(newCad.cadWastagePercent),
      layerMarginMeters: Number(newCad.layerMarginMeters),
      piecesPerMarker: null,
      markerLengthMeters: null,
      markerEfficiency: null,
      printDirection: newCad.printDirection,
      componentName: newCad.componentName,
      isPreferred: newCad.isPreferred,
      sizeBreakdowns: [],
    },
  });
}

/**
 * Delete a CAD width entry
 * DELETE /api/styles/cad-planning/cad/:cadId
 */
export async function deleteCADWidth(req: Request, res: Response) {
  const { cadId } = req.params;
  const parsedCadId = parseInt(cadId, 10);

  // Validate that approved CAD cannot be deleted
  await validateCADModification(cadId, 'delete');

  // Check if CAD exists
  const cad = await prisma.fabric_width_cad.findUnique({
    where: { id: cadId },
    include: {
      styleFabrics: true,
    },
  });

  if (!cad) {
    throw new NotFoundError('CAD record', cadId);
  }

  // Don't delete if it's referenced by style_fabrics
  if (cad.styleFabrics.length > 0) {
    throw new BusinessError('Cannot delete CAD that is assigned to style fabrics. Remove the assignment first.');
  }

  // Delete the CAD (size breakdowns will cascade delete)
  await prisma.fabric_width_cad.delete({
    where: { id: cadId },
  });

  return res.json({
    success: true,
    message: 'CAD width deleted successfully',
  });
}

/**
 * Get CAD group details for the CAD Edit page
 * GET /api/styles/:styleId/cad-planning/:groupKey/details
 *
 * Returns:
 * - Group info (genericGreigeName, finishType, etc.)
 * - All CAD width options with size breakdowns
 * - Style variants (sizes) for pre-populating size breakdown
 * - Greige/fabric details
 */
export async function getCADGroupDetails(req: Request, res: Response) {
  const { styleId, groupKey } = req.params;

  // Parse groupKey
  const parts = groupKey.split('-');
  const genericGreigeName = parts[0];
  const fabricFinishType = parts[1] === 'PLAIN' ? null : (parts[1] as FabricFinishType);
  const hasEmbroidery = parts.length > 2 && parts[2] === 'EMB';

  // Get style with variants
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    include: {
      style_variants: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          size: true,
        },
      },
      style_components: {
        include: {
          style_fabrics: {
            where: {
              genericGreigeName,
              fabricFinishType: fabricFinishType || null,
              ...(hasEmbroidery
                ? { hasEmbroidery: true }
                : {
                    OR: [{ hasEmbroidery: false }, { hasEmbroidery: { equals: false } }],
                  }),
            },
            include: {
              selectedGreige: true,
              embroidery: true,
            },
          },
        },
      },
    },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  // Get selected greige ID from style_fabrics
  const firstFabric = style.style_components
    .flatMap((c: (typeof style.style_components)[0]) => c.style_fabrics)
    .find((f: (typeof style.style_components)[0]['style_fabrics'][0]) => f.selectedGreigeId);

  const selectedGreigeId = firstFabric?.selectedGreigeId;
  const averagingMode = firstFabric?.averagingMode || 'COMBINED';

  // Get fabric_master and CAD options
  let fabricMaster = null;
  let cadOptions: any[] = [];

  if (selectedGreigeId) {
    // Greige-based fabric
    fabricMaster = await prisma.fabric_master.findFirst({
      where: {
        greigeId: selectedGreigeId,
        genericGreigeName,
      },
      include: {
        greige: true,
        widthCADs: {
          orderBy: { cutableWidth: 'desc' },
          include: {
            sizeBreakdowns: {
              orderBy: { sizeName: 'asc' },
            },
          },
        },
      },
    });
  } else {
    // Ready-purchase fabric or no greige selected
    fabricMaster = await prisma.fabric_master.findFirst({
      where: {
        genericGreigeName: {
          equals: genericGreigeName,
          mode: 'insensitive',
        },
        greigeId: null,
        isActive: true,
      },
      include: {
        widthCADs: {
          orderBy: { cutableWidth: 'desc' },
          include: {
            sizeBreakdowns: {
              orderBy: { sizeName: 'asc' },
            },
          },
        },
      },
    });
  }

  if (fabricMaster) {
    cadOptions = fabricMaster.widthCADs.map((cad) => ({
      id: cad.id,
      fabricId: cad.fabricId,
      cutableWidth: Number(cad.cutableWidth),
      widthUnit: cad.widthUnit,
      cadMeters: cad.cadMeters ? Number(cad.cadMeters) : null,
      cadYards: cad.cadYards ? Number(cad.cadYards) : null,
      cadWastagePercent: Number(cad.cadWastagePercent),
      layerMarginMeters: cad.layerMarginMeters ? Number(cad.layerMarginMeters) : null,
      piecesPerMarker: cad.piecesPerMarker,
      markerLengthMeters: cad.markerLengthMeters ? Number(cad.markerLengthMeters) : null,
      markerEfficiency: cad.markerEfficiency ? Number(cad.markerEfficiency) : null,
      printDirection: cad.printDirection, // One-Way or Two-Way
      componentName: cad.componentName,
      isPreferred: cad.isPreferred,
      notes: cad.notes,
      sizeBreakdowns: cad.sizeBreakdowns.map((sb) => ({
        id: sb.id,
        sizeName: sb.sizeName,
        sizeId: sb.sizeId,
        quantity: sb.quantity,
      })),
    }));
  }

  // Get greige details if selected
  let greigeDetails = null;
  if (selectedGreigeId) {
    const greige = await prisma.greige_master.findUnique({
      where: { id: selectedGreigeId },
    });
    if (greige) {
      greigeDetails = {
        id: greige.id,
        greigeCode: greige.greigeCode,
        greigeName: greige.greigeName,
        greigeWidth: Number(greige.greigeWidth),
        defaultCutableWidth: greige.defaultCutableWidth ? Number(greige.defaultCutableWidth) : null,
        expectedFinishedWidthMin: greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : null,
        expectedFinishedWidthMax: greige.expectedFinishedWidthMax ? Number(greige.expectedFinishedWidthMax) : null,
        costPerMeter: greige.costPerMeter ? Number(greige.costPerMeter) : null,
        composition: greige.composition,
      };
    }
  }

  // Extract unique sizes from style variants
  type StyleVariant = (typeof style.style_variants)[0];
  type SizeOption = { sizeId: string | null; sizeName: string; sortOrder: number };
  const sizeOptions = style.style_variants
    .filter((v: StyleVariant) => v.sizeName)
    .map(
      (v: StyleVariant): SizeOption => ({
        sizeId: v.sizeId,
        sizeName: v.sizeName!,
        sortOrder: v.sortOrder,
      })
    )
    .filter(
      (size: SizeOption, index: number, self: SizeOption[]) =>
        index === self.findIndex((s: SizeOption) => s.sizeName === size.sizeName)
    )
    .sort((a: SizeOption, b: SizeOption) => a.sortOrder - b.sortOrder);

  // Get embroidery details if applicable
  const embroidery = firstFabric?.embroidery
    ? {
        id: firstFabric.embroidery.id,
        embroideryCode: firstFabric.embroidery.embroideryCode,
        designName: firstFabric.embroidery.designName,
      }
    : null;

  return res.json({
    success: true,
    data: {
      style: {
        id: style.id,
        styleCode: style.styleCode,
        styleName: style.styleName,
        cadStatus: style.cadStatus,
        imageUrl: style.imageUrl,
      },
      group: {
        groupKey,
        genericGreigeName,
        fabricFinishType: fabricFinishType || 'PLAIN',
        hasEmbroidery,
        embroidery,
        averagingMode,
      },
      greige: greigeDetails,
      fabric: fabricMaster
        ? {
            id: fabricMaster.id,
            fabricCode: fabricMaster.fabricCode,
            fabricName: fabricMaster.fabricName,
            actualWidth: fabricMaster.actualWidth ? Number(fabricMaster.actualWidth) : null,
          }
        : null,
      cadOptions,
      sizeOptions,
      // Suggest width based on greige or fabric
      suggestedWidth: greigeDetails
        ? greigeDetails.defaultCutableWidth || greigeDetails.greigeWidth - 4
        : fabricMaster?.actualWidth
          ? Number(fabricMaster.actualWidth) - 2
          : 54,
    },
  });
}

/**
 * Update CAD values with size breakdown
 * PUT /api/styles/cad-planning/update-cad/:cadId
 * Body: { cutableWidth?, cadMeters?, cadYards?, cadWastagePercent?, layerMarginMeters?,
 *         markerLengthMeters?, markerEfficiency?, notes?, isPreferred?,
 *         sizeBreakdowns?: { sizeName, sizeId?, quantity }[] }
 *
 * Auto-calculates piecesPerMarker from sum of sizeBreakdowns quantities
 */
export async function updateCADValuesWithBreakdown(req: Request, res: Response) {
  const { cadId } = req.params;
  const parsedCadId = parseInt(cadId, 10);

  // Validate that approved CAD cannot be updated
  await validateCADModification(cadId, 'update');

  const {
    cutableWidth,
    cadMeters,
    cadYards,
    cadWastagePercent,
    layerMarginMeters,
    markerLengthMeters,
    processingPricePerMeter,
    markerEfficiency,
    markerPlanFile,
    supplierAvailability,
    priceDifferential,
    notes,
    isPreferred,
    printDirection, // ONE_WAY or TWO_WAY
    sizeBreakdowns, // NEW: Array of { sizeName, sizeId?, quantity }
  } = req.body;

  // Verify CAD exists
  const existing = await prisma.fabric_width_cad.findUnique({
    where: { id: cadId },
  });

  if (!existing) {
    throw new NotFoundError('CAD record', cadId);
  }

  // Calculate piecesPerMarker from size breakdowns if provided
  let calculatedPiecesPerMarker: number | undefined;
  if (sizeBreakdowns && Array.isArray(sizeBreakdowns)) {
    calculatedPiecesPerMarker = sizeBreakdowns.reduce(
      (sum: number, sb: { quantity: number }) => sum + (sb.quantity || 0),
      0
    );
  }

  // Build update data
  const updateData: Prisma.fabric_width_cadUpdateInput = {};
  if (cutableWidth !== undefined) updateData.cutableWidth = cutableWidth;
  if (cadMeters !== undefined) {
    updateData.cadMeters = cadMeters;
    // Auto-calculate layer margin if not explicitly provided
    if (layerMarginMeters === undefined) {
      updateData.layerMarginMeters = getDefaultLayerMargin(cadMeters);
    }
  }
  if (cadYards !== undefined) updateData.cadYards = cadYards;
  if (cadWastagePercent !== undefined) updateData.cadWastagePercent = cadWastagePercent;
  if (layerMarginMeters !== undefined) updateData.layerMarginMeters = layerMarginMeters;
  if (calculatedPiecesPerMarker !== undefined) updateData.piecesPerMarker = calculatedPiecesPerMarker;
  if (markerLengthMeters !== undefined) updateData.markerLengthMeters = markerLengthMeters;
  if (processingPricePerMeter !== undefined) updateData.processingPricePerMeter = processingPricePerMeter;
  if (markerEfficiency !== undefined) updateData.markerEfficiency = markerEfficiency;
  if (markerPlanFile !== undefined) updateData.markerPlanFile = markerPlanFile;
  if (supplierAvailability !== undefined) updateData.supplierAvailability = supplierAvailability;
  if (priceDifferential !== undefined) updateData.priceDifferential = priceDifferential;
  if (notes !== undefined) updateData.notes = notes;
  if (isPreferred !== undefined) updateData.isPreferred = isPreferred;
  if (printDirection !== undefined) updateData.printDirection = printDirection;

  // Calculate cadAverage if any relevant fields are updated
  // Use provided values or fall back to existing record values
  const effectiveCadMeters =
    cadMeters !== undefined ? cadMeters : existing.cadMeters ? Number(existing.cadMeters) : null;
  const effectiveLayerMargin =
    layerMarginMeters !== undefined
      ? layerMarginMeters
      : updateData.layerMarginMeters !== undefined
        ? Number(updateData.layerMarginMeters)
        : existing.layerMarginMeters
          ? Number(existing.layerMarginMeters)
          : null;
  const effectivePiecesPerMarker =
    calculatedPiecesPerMarker !== undefined ? calculatedPiecesPerMarker : existing.piecesPerMarker;

  const calculatedCadAverageValue = calculateCadAverage(
    effectiveCadMeters,
    effectiveLayerMargin,
    effectivePiecesPerMarker
  );
  if (calculatedCadAverageValue !== null) {
    updateData.cadAverage = calculatedCadAverageValue;
  }

  // Update CAD record
  const updated = await prisma.fabric_width_cad.update({
    where: { id: cadId },
    data: updateData,
  });

  // Update size breakdowns if provided
  if (sizeBreakdowns && Array.isArray(sizeBreakdowns)) {
    // Delete existing breakdowns
    await prisma.cad_size_breakdown.deleteMany({
      where: { cadId },
    });

    // Create new breakdowns
    if (sizeBreakdowns.length > 0) {
      await prisma.cad_size_breakdown.createMany({
        data: sizeBreakdowns.map((sb: { sizeName: string; sizeId?: string; quantity: number }) => ({
          cadId,
          sizeName: sb.sizeName,
          sizeId: sb.sizeId || null,
          quantity: sb.quantity,
        })),
      });
    }
  }

  // Fetch updated CAD with breakdowns
  const finalCad = await prisma.fabric_width_cad.findUnique({
    where: { id: cadId },
    include: {
      sizeBreakdowns: {
        orderBy: { sizeName: 'asc' },
      },
    },
  });

  return res.json({
    success: true,
    message: 'CAD values updated successfully',
    data: {
      id: finalCad!.id,
      fabricId: finalCad!.fabricId,
      cutableWidth: Number(finalCad!.cutableWidth),
      cadMeters: finalCad!.cadMeters ? Number(finalCad!.cadMeters) : null,
      cadYards: finalCad!.cadYards ? Number(finalCad!.cadYards) : null,
      cadWastagePercent: Number(finalCad!.cadWastagePercent),
      layerMarginMeters: finalCad!.layerMarginMeters ? Number(finalCad!.layerMarginMeters) : null,
      piecesPerMarker: finalCad!.piecesPerMarker,
      markerLengthMeters: finalCad!.markerLengthMeters ? Number(finalCad!.markerLengthMeters) : null,
      processingPricePerMeter: finalCad!.processingPricePerMeter ? Number(finalCad!.processingPricePerMeter) : null,
      markerEfficiency: finalCad!.markerEfficiency ? Number(finalCad!.markerEfficiency) : null,
      isPreferred: finalCad!.isPreferred,
      printDirection: finalCad!.printDirection,
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
 * Set preferred CAD width for a fabric
 * PUT /api/styles/cad-planning/cad/:cadId/set-preferred
 */
export async function setPreferredCAD(req: Request, res: Response) {
  const { cadId } = req.params;

  // Get the CAD record
  const cad = await prisma.fabric_width_cad.findUnique({
    where: { id: cadId },
  });

  if (!cad) {
    throw new NotFoundError('CAD record', cadId);
  }

  // Unset all other preferred flags for this fabric
  await prisma.fabric_width_cad.updateMany({
    where: {
      fabricId: cad.fabricId,
      componentName: cad.componentName,
      isPreferred: true,
    },
    data: { isPreferred: false },
  });

  // Set this one as preferred
  await prisma.fabric_width_cad.update({
    where: { id: cadId },
    data: { isPreferred: true },
  });

  return res.json({
    success: true,
    message: 'Preferred CAD width updated',
  });
}

/**
 * Get all CAD history for a style
 * GET /api/styles/:styleId/cad-planning/history
 *
 * Returns all CAD entries across all fabric groups for a style, including:
 * - Currently selected/approved CADs
 * - Previously calculated CADs at different widths
 * - Size breakdown details
 * - Grouped by fabric/component for easy comparison
 */
export async function getStyleCADHistory(req: Request, res: Response) {
  const { styleId } = req.params;

  // Get style info
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    select: {
      id: true,
      styleCode: true,
      styleName: true,
      cadStatus: true,
      approvedCadDate: true,
      imageUrl: true,
    },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  // Get all style_fabrics with their CAD references
  const styleComponents = await prisma.style_components.findMany({
    where: { styleId },
    include: {
      style_fabrics: {
        include: {
          fabric: {
            include: {
              greige: true,
              widthCADs: {
                orderBy: [{ isPreferred: 'desc' }, { cutableWidth: 'desc' }],
                include: {
                  sizeBreakdowns: {
                    orderBy: { sizeName: 'asc' },
                  },
                  greige: true,
                },
              },
            },
          },
          selectedGreige: true,
          fabricCAD: {
            include: {
              sizeBreakdowns: true,
            },
          },
          embroidery: true,
          colorMaster: { select: { id: true, colorCode: true, colorName: true, hexCode: true } },
        },
      },
    },
  });

  // Group CADs by fabric group (genericGreigeName + finishType)
  const cadGroups: Record<
    string,
    {
      groupKey: string;
      genericGreigeName: string;
      fabricFinishType: string;
      printDesign: string | null;
      colorName: string | null;
      hasEmbroidery: boolean;
      embroidery: { id: string; embroideryCode: string; designName: string } | null;
      greige: { id: string; greigeCode: string; greigeName: string; greigeWidth: number } | null;
      components: string[];
      selectedCADId: string | null;
      cadOptions: Array<{
        id: string;
        fabricId: string | null;
        cutableWidth: number;
        cadMeters: number | null;
        cadYards: number | null;
        piecesPerMarker: number | null;
        markerLengthMeters: number | null;
        markerEfficiency: number | null;
        cadWastagePercent: number;
        layerMarginMeters: number | null;
        isPreferred: boolean;
        isSelected: boolean;
        componentName: string | null;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
        sizeBreakdowns: Array<{
          sizeName: string;
          quantity: number;
        }>;
      }>;
    }
  > = {};

  for (const component of styleComponents) {
    for (const sf of component.style_fabrics) {
      // Include design/color in group key for proper fabric distinction
      const designColorPart = sf.printDesign || (sf as any).colorMaster?.colorName || sf.fabricColor || 'Default';
      const groupKey = `${sf.genericGreigeName || 'Unknown'}-${sf.fabricFinishType || 'PLAIN'}-${designColorPart}${sf.hasEmbroidery ? '-EMB' : ''}`;

      if (!cadGroups[groupKey]) {
        cadGroups[groupKey] = {
          groupKey,
          genericGreigeName: sf.genericGreigeName || 'Unknown',
          fabricFinishType: sf.fabricFinishType || 'PLAIN',
          printDesign: sf.printDesign || null,
          colorName: (sf as any).colorMaster?.colorName || sf.fabricColor || null,
          hasEmbroidery: sf.hasEmbroidery || false,
          embroidery: sf.embroidery
            ? {
                id: sf.embroidery.id,
                embroideryCode: sf.embroidery.embroideryCode,
                designName: sf.embroidery.designName,
              }
            : null,
          greige: sf.selectedGreige
            ? {
                id: sf.selectedGreige.id,
                greigeCode: sf.selectedGreige.greigeCode,
                greigeName: sf.selectedGreige.greigeName,
                greigeWidth: Number(sf.selectedGreige.greigeWidth),
              }
            : null,
          components: [],
          selectedCADId: sf.fabricCADId,
          cadOptions: [],
        };
      }

      // Add component name if not already present
      const componentName = component.componentName || component.componentType;
      if (componentName && !cadGroups[groupKey].components.includes(componentName)) {
        cadGroups[groupKey].components.push(componentName);
      }

      // Add CAD options from the fabric
      if (sf.fabric?.widthCADs) {
        for (const cad of sf.fabric.widthCADs) {
          // Check if this CAD is already added
          const existingIndex = cadGroups[groupKey].cadOptions.findIndex((c) => c.id === cad.id);
          if (existingIndex === -1) {
            cadGroups[groupKey].cadOptions.push({
              id: cad.id,
              fabricId: cad.fabricId,
              cutableWidth: Number(cad.cutableWidth),
              cadMeters: cad.cadMeters ? Number(cad.cadMeters) : null,
              cadYards: cad.cadYards ? Number(cad.cadYards) : null,
              piecesPerMarker: cad.piecesPerMarker,
              markerLengthMeters: cad.markerLengthMeters ? Number(cad.markerLengthMeters) : null,
              markerEfficiency: cad.markerEfficiency ? Number(cad.markerEfficiency) : null,
              cadWastagePercent: Number(cad.cadWastagePercent),
              layerMarginMeters: cad.layerMarginMeters ? Number(cad.layerMarginMeters) : null,
              isPreferred: cad.isPreferred,
              isSelected: sf.fabricCADId === cad.id,
              componentName: cad.componentName,
              notes: cad.notes,
              createdAt: cad.createdAt,
              updatedAt: cad.updatedAt,
              sizeBreakdowns: cad.sizeBreakdowns.map((sb: { sizeName: string; quantity: number }) => ({
                sizeName: sb.sizeName,
                quantity: sb.quantity,
              })),
            });
          }
        }
      }
    }
  }

  // Sort CAD options within each group: selected first, then preferred, then by width descending
  for (const group of Object.values(cadGroups)) {
    group.cadOptions.sort((a, b) => {
      if (a.isSelected && !b.isSelected) return -1;
      if (!a.isSelected && b.isSelected) return 1;
      if (a.isPreferred && !b.isPreferred) return -1;
      if (!a.isPreferred && b.isPreferred) return 1;
      return b.cutableWidth - a.cutableWidth;
    });
  }

  // Calculate summary statistics
  const totalGroups = Object.keys(cadGroups).length;
  const groupsWithSelectedCAD = Object.values(cadGroups).filter((g) => g.selectedCADId).length;
  const totalCADOptions = Object.values(cadGroups).reduce((sum, g) => sum + g.cadOptions.length, 0);

  return res.json({
    success: true,
    data: {
      style: {
        id: style.id,
        styleCode: style.styleCode,
        styleName: style.styleName,
        cadStatus: style.cadStatus,
        approvedCadDate: style.approvedCadDate,
        imageUrl: style.imageUrl,
      },
      summary: {
        totalFabricGroups: totalGroups,
        groupsWithSelectedCAD,
        totalCADOptions,
        isFullyApproved: style.cadStatus === 'APPROVED',
      },
      cadGroups: Object.values(cadGroups),
    },
  });
}

// ============================================================================
// CAD SPREADSHEET TABLE ENDPOINTS
// ============================================================================

/**
 * Get CAD spreadsheet table data for a style
 * Returns flat table data with all rows for spreadsheet view
 * GET /api/styles/:styleId/cad-table
 */
export async function getCADTableData(req: Request, res: Response) {
  const { styleId } = req.params;

  // Performance optimization: Run style query and fabric stock query in parallel
  // Both only depend on styleId, so they can execute concurrently
  const [style, initialFabricStock] = await Promise.all([
    // Get style with all related data
    prisma.styles.findUnique({
      where: { id: styleId },
      include: {
        style_components: {
          include: {
            // BUG-PP10 fix: include componentMaster relation for ID-based lookup
            componentMaster: {
              include: {
                patternParts: {
                  include: {
                    patternPart: true,
                  },
                },
              },
            },
            style_fabrics: {
              include: {
                fabric: true,
                embroidery: true,
                colorMaster: { select: { id: true, colorCode: true, colorName: true, hexCode: true } },
                fabricCAD: {
                  include: {
                    sizeBreakdowns: true,
                    greige: true,
                    patternPart: true,
                    cadPatternParts: { include: { patternPart: true } }, // Multi-part selection
                    fabricStock: true,
                    stockAllocations: true, // For order count tracking
                  },
                },
                // Include CAD rows linked via styleFabricId
                cadRows: {
                  include: {
                    sizeBreakdowns: true,
                    greige: true,
                    patternPart: true,
                    cadPatternParts: { include: { patternPart: true } }, // Multi-part selection
                    fabricStock: true,
                    stockAllocations: true, // For order count tracking
                  },
                },
                stylePatternParts: {
                  include: {
                    patternPart: true,
                  },
                },
              },
            },
          },
        },
        style_variants: {
          include: {
            size: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    }),
    // Query fabric stock for this style (for stock width integration)
    prisma.fabric_stock.findMany({
      where: {
        OR: [{ originStyleId: styleId }, { procurement: { orderedForStyleId: styleId } }],
        status: 'AVAILABLE',
        quantityAvailable: { gt: 0 },
      },
      include: {
        fabricMaster: {
          include: { greige: true },
        },
        procurement: true,
        patternPart: { select: { name: true, code: true } },
      },
      orderBy: { receivedDate: 'asc' },
    }),
  ]);

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  // Also find stock by fabricId for fabrics used by this style
  // This catches stock where originStyleId/procurement aren't set (e.g., manual stock entry)
  const styleFabricIds = new Set<string>();
  style.style_components.forEach((comp: any) => {
    comp.style_fabrics?.forEach((sf: any) => {
      if (sf.fabricId) {
        styleFabricIds.add(sf.fabricId);
      }
    });
  });

  let fabricStock = [...initialFabricStock];
  if (styleFabricIds.size > 0) {
    const existingStockIds = new Set(initialFabricStock.map((s) => s.id));
    const fabricIdStock = await prisma.fabric_stock.findMany({
      where: {
        fabricId: { in: Array.from(styleFabricIds) },
        status: 'AVAILABLE',
        quantityAvailable: { gt: 0 },
        id: { notIn: Array.from(existingStockIds) },
      },
      include: {
        fabricMaster: {
          include: { greige: true },
        },
        procurement: true,
        patternPart: { select: { name: true, code: true } },
      },
      orderBy: { receivedDate: 'asc' },
    });
    fabricStock.push(...fabricIdStock);
  }

  // Get available greiges for the style's fabrics
  // For READY_FABRIC fabrics, style_fabrics.genericGreigeName is null;
  // fall back to fabric_master.genericGreigeName
  const genericGreigeNames = new Set<string>();
  style.style_components.forEach((comp: any) => {
    comp.style_fabrics.forEach((fabric: any) => {
      const name = fabric.genericGreigeName || fabric.fabric?.genericGreigeName;
      if (name) {
        genericGreigeNames.add(name);
      }
    });
  });

  const availableGreiges = await prisma.greige_master.findMany({
    where: {
      genericGreigeName: { in: Array.from(genericGreigeNames) },
      isActive: true,
    },
    include: {
      defaultSupplier: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ genericGreigeName: 'asc' }, { greigeName: 'asc' }],
  });

  // fabricStock already fetched in parallel query above

  // Build fabricId -> styleFabricId map for linking stock to style fabrics
  const fabricIdToStyleFabric = new Map<string, { styleFabricId: string; componentId: string }>();
  style.style_components.forEach((comp: any) => {
    comp.style_fabrics?.forEach((sf: any) => {
      if (sf.fabricId && !fabricIdToStyleFabric.has(sf.fabricId)) {
        fabricIdToStyleFabric.set(sf.fabricId, { styleFabricId: sf.id, componentId: comp.id });
      }
    });
  });

  // Build stock widths map by fabricId for CAD row matching
  const stockByFabricId = new Map<
    string,
    Array<{
      width: number;
      quantity: number;
      stockId: string;
      qualityGrade: string;
    }>
  >();

  fabricStock.forEach((stock) => {
    const fabricId = stock.fabricId;
    if (!stockByFabricId.has(fabricId)) {
      stockByFabricId.set(fabricId, []);
    }
    stockByFabricId.get(fabricId)!.push({
      width: Number(stock.cutableWidth),
      quantity: Number(stock.quantityAvailable),
      stockId: stock.id,
      qualityGrade: stock.qualityGrade || 'A',
    });
  });

  // Query PRODUCTION CAD entries for these stock lots
  const stockIds = fabricStock.map((s) => s.id);
  const productionCads = await prisma.fabric_width_cad.findMany({
    where: {
      OR: [{ styleFabric: { style_components: { styleId } } }, { styleFabricId: null }],
      purpose: 'PRODUCTION',
      fabricStockId: { in: stockIds },
    },
    select: {
      id: true,
      fabricStockId: true,
      approvalStatus: true,
    },
  });

  // Create map of stockId -> PRODUCTION CAD
  const productionCadByStock = new Map<string, { id: string; approvalStatus: string | null }>();
  productionCads.forEach((cad) => {
    if (cad.fabricStockId) {
      productionCadByStock.set(cad.fabricStockId, {
        id: cad.id,
        approvalStatus: cad.approvalStatus,
      });
    }
  });

  // Build stock summary for banner display with PRODUCTION CAD info
  const stockSummary = fabricStock.map((stock) => {
    const productionCad = productionCadByStock.get(stock.id);
    const styleFabricMatch = fabricIdToStyleFabric.get(stock.fabricId);
    return {
      id: stock.id,
      fabricId: stock.fabricId,
      fabricName: stock.fabricMaster?.fabricName || '',
      fabricCode: stock.fabricMaster?.fabricCode || '',
      greigeId: stock.fabricMaster?.greigeId || '',
      greigeName: stock.fabricMaster?.greige?.greigeName || '',
      cutableWidth: Number(stock.cutableWidth),
      finishedWidth: Number(stock.finishedWidth),
      quantityAvailable: Number(stock.quantityAvailable),
      qualityGrade: stock.qualityGrade || 'A',
      stockLotNumber: stock.id.substring(0, 8), // Use first 8 chars of ID as lot identifier
      styleFabricId: styleFabricMatch?.styleFabricId || null,
      componentId: styleFabricMatch?.componentId || null,
      hasProductionCad: !!productionCad,
      productionCadId: productionCad?.id || null,
      productionCadStatus: productionCad?.approvalStatus || null,
      patternPartName: (stock as any).patternPart?.name || null,
      fabricFinishType: stock.fabricFinishType || null,
    };
  });

  // BUG-PP10 fix: Get component pattern parts (prefer ID-based lookup via componentMasterId FK)
  // Components with componentMasterId already have pattern parts included via the relation.
  // Fall back to name-based lookup only for legacy data where componentMasterId is null.
  const componentsWithMaster = style.style_components.filter((c: any) => c.componentMaster);
  const componentsWithoutMaster = style.style_components.filter((c: any) => !c.componentMaster);

  // For components WITH componentMasterId, extract pattern parts directly from the relation
  const componentMasterIds: string[] = componentsWithMaster.map((c: any) => c.componentMasterId);
  const componentNameToIdMap = new Map<string, string>();
  componentsWithMaster.forEach((c: any) => {
    componentNameToIdMap.set(c.componentName.toLowerCase(), c.componentMasterId);
  });

  // Collect pattern parts from components that already have the relation loaded.
  // componentId must be present on every entry — the components[] builder below
  // filters on it (legacy prisma rows carry it natively).
  const componentPatternParts: Array<{
    componentId: string;
    patternPart: { id: string; code: string; name: string };
    component: { id: string; name: string };
  }> = [];

  componentsWithMaster.forEach((comp: any) => {
    if (comp.componentMaster?.patternParts) {
      comp.componentMaster.patternParts.forEach((pp: any) => {
        componentPatternParts.push({
          componentId: comp.componentMaster.id,
          patternPart: pp.patternPart,
          component: { id: comp.componentMaster.id, name: comp.componentMaster.name },
        });
      });
    }
  });

  // Legacy fallback: for components WITHOUT componentMasterId, do name-based lookup
  if (componentsWithoutMaster.length > 0) {
    const legacyComponentNames = componentsWithoutMaster.map((c: any) => c.componentName);
    const legacyComponentMasters = await prisma.component_masters.findMany({
      where: {
        OR: legacyComponentNames.map((n: string) => ({ name: { equals: n, mode: 'insensitive' as const } })),
        isActive: true,
      },
      select: { id: true, name: true },
    });

    // Add to maps
    legacyComponentMasters.forEach((cm) => {
      componentMasterIds.push(cm.id);
      componentNameToIdMap.set(cm.name.toLowerCase(), cm.id);
    });

    // Fetch pattern parts for legacy components
    if (legacyComponentMasters.length > 0) {
      const legacyPatternParts = await prisma.component_pattern_parts.findMany({
        where: {
          componentId: { in: legacyComponentMasters.map((cm) => cm.id) },
        },
        include: {
          patternPart: true,
          component: { select: { id: true, name: true } },
        },
      });
      componentPatternParts.push(...legacyPatternParts);
    }

    if (legacyComponentNames.length > 0) {
      console.warn(
        `[cad-planning] ${legacyComponentNames.length} components without componentMasterId: ${legacyComponentNames.join(', ')}. Consider setting componentMasterId on style_components.`
      );
    }
  }

  // Build CAD rows from existing data
  const cadRows: Array<{
    id: string;
    purpose: string | null;
    componentId: string;
    componentName: string;
    styleFabricId: string;
    // Legacy single-part fields (backwards compatibility)
    partId: string | null;
    partCode: string | null;
    partName: string | null;
    // Multi-part fields
    partIds: string[];
    parts: Array<{ id: string; code: string; name: string; goesToEmbroidery: boolean }>;
    fabricFinishType: string | null;
    designName: string | null;
    isEmbroidery: boolean;
    genericGreigeName: string | null;
    // Ready-fabric fields
    readyFabricId: string | null;
    readyFabricName: string | null;
    readyFabricCode: string | null;
    greigeId: string | null;
    greigeName: string | null;
    cutableWidth: number | null;
    availableWidths: number[];
    stockWidths: number[];
    hasStockMatch: boolean;
    printDirection: string;
    sizeBreakdowns: Array<{ sizeName: string; sizeId: string | null; quantity: number }>;
    piecesPerMarker: number | null;
    layerMarginMeters: number | null;
    layerLengthMeters: number | null;
    cadAverage: number | null;
    // Combined cutting fields
    isCombinedCutting: boolean;
    combinedFabricIds: string[] | null;
    combinedComponents: string | null;
    // Order usage tracking
    orderCount: number;
    stockLotNumber: string | null;
    // Approval status
    approvalStatus: string | null;
    isLocked: boolean;
    fabricStockId: string | null;
  }> = [];

  // Iterate through components and fabrics to build rows
  style.style_components.forEach((component: any) => {
    component.style_fabrics.forEach((styleFabric: any) => {
      // Get all CAD entries: combine cadRows (new) and fabricCAD (legacy)
      const allCads: any[] = [];
      const seenIds = new Set<string>();

      // Add CAD rows linked via styleFabricId (new relationship)
      if (styleFabric.cadRows && styleFabric.cadRows.length > 0) {
        styleFabric.cadRows.forEach((cad: any) => {
          if (!seenIds.has(cad.id)) {
            seenIds.add(cad.id);
            allCads.push(cad);
          }
        });
      }

      // Also include fabricCAD if present and not already included (legacy)
      if (styleFabric.fabricCAD && !seenIds.has(styleFabric.fabricCAD.id)) {
        seenIds.add(styleFabric.fabricCAD.id);
        allCads.push(styleFabric.fabricCAD);
      }

      // Process each CAD entry
      allCads.forEach((cad: any) => {
        // Calculate available widths from greige
        const greige = cad.greige;
        const availableWidths: number[] = [];
        if (greige) {
          const minWidth = greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : 36;
          const maxWidth = greige.expectedFinishedWidthMax
            ? Number(greige.expectedFinishedWidthMax)
            : Number(greige.greigeWidth) || 60;
          // Generate widths in 0.5-inch increments
          for (let w = minWidth; w <= maxWidth; w += 0.5) {
            availableWidths.push(w);
          }
        }

        const sizeBreakdowns = cad.sizeBreakdowns.map((sb: any) => ({
          sizeName: sb.sizeName,
          sizeId: sb.sizeId,
          quantity: sb.quantity,
        }));

        const totalPieces = sizeBreakdowns.reduce((sum: number, sb: any) => sum + sb.quantity, 0);
        // cadMeters in DB stores the layer length
        const layerLength = cad.cadMeters ? Number(cad.cadMeters) : null;
        const layerMargin = cad.layerMarginMeters
          ? Number(cad.layerMarginMeters)
          : layerLength
            ? getDefaultLayerMargin(layerLength)
            : 0;
        // CAD Average = (layerLength + layerMargin) / piecesPerMarker
        const cadAverage = layerLength && totalPieces > 0 ? (layerLength + layerMargin) / totalPieces : null;

        // Handle "All Parts" case - check pattern part code or legacy marker in componentName
        const isAllParts = cad.patternPart?.code === ALL_PARTS_CODE || cad.componentName === ALL_PARTS_LEGACY_MARKER;

        // Get stock widths for this fabric (if any stock exists)
        const fabricId = styleFabric.fabric?.id || styleFabric.fabricId;
        const stockEntries = fabricId ? stockByFabricId.get(fabricId) || [] : [];
        const stockWidths = [...new Set(stockEntries.map((s) => s.width))];

        // Parse combinedFabricIds if present (JSON array of styleFabricIds)
        let combinedFabricIds: string[] | null = null;
        if (cad.combinedFabricIds) {
          try {
            combinedFabricIds = JSON.parse(cad.combinedFabricIds);
          } catch {
            combinedFabricIds = null;
          }
        }

        // For ready-fabric style fabrics (fabricId set, no genericGreigeName)
        const readyFabricMasterId = styleFabric.fabricId || null;
        const styleFabricMasterName = styleFabric.fabric?.fabricName || null;
        const styleFabricCode = styleFabric.fabric?.fabricCode || null;

        // Build embroidery map from styleFabric.stylePatternParts (per-style configuration)
        const styleFabricEmbroideryMap = new Map(
          (styleFabric.stylePatternParts || []).map((spp: any) => [spp.patternPartId, spp.goesToEmbroidery])
        );

        // Build parts array from cadPatternParts (multi-part) or fall back to single patternPart
        const cadParts = cad.cadPatternParts?.length
          ? cad.cadPatternParts.map((cp: any) => ({
              id: cp.patternPart.id,
              code: cp.patternPart.code,
              name: cp.patternPart.name,
              goesToEmbroidery: styleFabricEmbroideryMap.get(cp.patternPart.id) || false,
            }))
          : cad.patternPart
            ? [
                {
                  id: cad.patternPart.id,
                  code: cad.patternPart.code,
                  name: cad.patternPart.name,
                  goesToEmbroidery: styleFabricEmbroideryMap.get(cad.patternPart.id) || false,
                },
              ]
            : [];
        const cadPartIds = cadParts.map((p: any) => p.id);

        cadRows.push({
          id: cad.id,
          purpose: cad.purpose,
          componentId: component.id,
          componentName:
            cad.isCombinedCutting && cad.combinedComponents
              ? cad.combinedComponents // Use combined components string
              : component.componentName,
          styleFabricId: styleFabric.id,
          // Legacy single-part fields (backwards compatibility)
          partId: cad.patternPartId,
          partCode: cad.patternPart?.code || (isAllParts ? ALL_PARTS_CODE : null),
          partName: cad.patternPart?.name || (isAllParts ? 'All Parts' : null),
          // Multi-part fields
          partIds: cadPartIds,
          parts: cadParts,
          fabricFinishType: styleFabric.fabricFinishType,
          designName: styleFabric.printDesign || styleFabric.colorMaster?.colorName || null,
          isEmbroidery: cad.isEmbroidery,
          genericGreigeName: styleFabric.genericGreigeName || styleFabric.fabric?.genericGreigeName || null,
          // Ready-fabric fields: set when style_fabrics.fabricId is populated
          readyFabricId: readyFabricMasterId,
          readyFabricName: styleFabricMasterName,
          readyFabricCode: styleFabricCode,
          greigeId: cad.greigeId,
          greigeName: greige?.greigeName || null,
          cutableWidth: cad.cutableWidth ? Number(cad.cutableWidth) : null,
          availableWidths,
          stockWidths,
          hasStockMatch: stockWidths.length > 0,
          printDirection: cad.printDirection,
          sizeBreakdowns,
          piecesPerMarker: cad.piecesPerMarker,
          layerMarginMeters: layerMargin,
          layerLengthMeters: layerLength,
          cadAverage,
          // Combined cutting fields
          isCombinedCutting: cad.isCombinedCutting || false,
          combinedFabricIds: combinedFabricIds,
          combinedComponents: cad.combinedComponents || null,
          // Order usage tracking
          orderCount: cad.stockAllocations?.length || 0,
          stockLotNumber: cad.fabricStock?.id ? cad.fabricStock.id.substring(0, 8) : null,
          // Approval status
          approvalStatus: cad.approvalStatus,
          isLocked: cad.isLocked || false,
          fabricStockId: cad.fabricStockId || null,
        });
      });
    });
  });

  // Include orphaned PRODUCTION CADs (styleFabricId = null) linked to this style's stock
  // These were created before the auto-resolve fix and need to be recovered
  if (stockIds.length > 0) {
    const existingCadIds = new Set(cadRows.map((r) => r.id));
    const orphanedProductionCads = await prisma.fabric_width_cad.findMany({
      where: {
        styleFabricId: null,
        purpose: 'PRODUCTION',
        fabricStockId: { in: stockIds },
      },
      include: {
        sizeBreakdowns: true,
        greige: true,
        patternPart: true,
        cadPatternParts: { include: { patternPart: true } }, // Multi-part selection
        fabricStock: { include: { fabricMaster: { include: { greige: true } } } },
      },
    });

    for (const cad of orphanedProductionCads) {
      if (existingCadIds.has(cad.id)) continue;

      const stockFabricId = cad.fabricStock?.fabricId || '';
      const match = fabricIdToStyleFabric.get(stockFabricId);

      // Auto-fix: permanently link orphaned CAD to the correct style fabric
      if (match) {
        await prisma.fabric_width_cad.update({
          where: { id: cad.id },
          data: { styleFabricId: match.styleFabricId },
        });
      }

      // Find the matching component and style fabric for display info
      let componentName = cad.componentName || 'Unknown';
      let componentId = match?.componentId || '';
      let fabricFinishType: string | null = null;
      let designName: string | null = null;
      let genericGreigeName: string | null = null;
      let readyFabricId: string | null = null;
      let readyFabricName: string | null = null;
      let readyFabricCode: string | null = null;
      const matchedStyleFabricId = match?.styleFabricId || cad.id; // fallback to cad.id for display

      if (match) {
        const comp = style.style_components.find((c: any) => c.id === match.componentId);
        if (comp) {
          componentName = cad.isCombinedCutting && cad.combinedComponents ? cad.combinedComponents : comp.componentName;
          const sf = comp.style_fabrics.find((sf: any) => sf.id === match.styleFabricId);
          if (sf) {
            fabricFinishType = sf.fabricFinishType;
            designName = sf.printDesign || sf.colorMaster?.colorName || null;
            genericGreigeName = sf.genericGreigeName || sf.fabric?.genericGreigeName || null;
            readyFabricId = sf.fabricId || null;
            readyFabricName = sf.fabric?.fabricName || null;
            readyFabricCode = sf.fabric?.fabricCode || null;
          }
        }
      }

      const greige = cad.greige;
      const availableWidths: number[] = [];
      if (greige) {
        const minWidth = greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : 36;
        const maxWidth = greige.expectedFinishedWidthMax
          ? Number(greige.expectedFinishedWidthMax)
          : Number(greige.greigeWidth) || 60;
        for (let w = minWidth; w <= maxWidth; w += 0.5) availableWidths.push(w);
      }

      const sizeBreakdowns = cad.sizeBreakdowns.map((sb: any) => ({
        sizeName: sb.sizeName,
        sizeId: sb.sizeId,
        quantity: sb.quantity,
      }));
      const totalPieces = sizeBreakdowns.reduce((sum: number, sb: any) => sum + sb.quantity, 0);
      const layerLength = cad.cadMeters ? Number(cad.cadMeters) : null;
      const layerMargin = cad.layerMarginMeters
        ? Number(cad.layerMarginMeters)
        : layerLength
          ? getDefaultLayerMargin(layerLength)
          : 0;
      const cadAverage = layerLength && totalPieces > 0 ? (layerLength + layerMargin) / totalPieces : null;
      const isAllParts = cad.patternPart?.code === ALL_PARTS_CODE || cad.componentName === ALL_PARTS_LEGACY_MARKER;
      const stockEntries = stockFabricId ? stockByFabricId.get(stockFabricId) || [] : [];
      const stockWidths = [...new Set(stockEntries.map((s) => s.width))];

      // Build embroidery map from style fabric's stylePatternParts if available
      let orphanEmbroideryMap = new Map<string, boolean>();
      if (match) {
        const comp = style.style_components.find((c: any) => c.id === match.componentId);
        const sf = comp?.style_fabrics?.find((sfi: any) => sfi.id === match.styleFabricId);
        if (sf?.stylePatternParts) {
          orphanEmbroideryMap = new Map(
            sf.stylePatternParts.map((spp: any) => [spp.patternPartId, spp.goesToEmbroidery])
          );
        }
      }

      // Build parts array from cadPatternParts (multi-part) or fall back to single patternPart
      const orphanParts = (cad as any).cadPatternParts?.length
        ? (cad as any).cadPatternParts.map((cp: any) => ({
            id: cp.patternPart.id,
            code: cp.patternPart.code,
            name: cp.patternPart.name,
            goesToEmbroidery: orphanEmbroideryMap.get(cp.patternPart.id) || false,
          }))
        : cad.patternPart
          ? [
              {
                id: cad.patternPart.id,
                code: cad.patternPart.code,
                name: cad.patternPart.name,
                goesToEmbroidery: orphanEmbroideryMap.get(cad.patternPart.id) || false,
              },
            ]
          : [];
      const orphanPartIds = orphanParts.map((p: any) => p.id);

      cadRows.push({
        id: cad.id,
        purpose: cad.purpose,
        componentId,
        componentName,
        styleFabricId: matchedStyleFabricId,
        // Legacy single-part fields (backwards compatibility)
        partId: cad.patternPartId,
        partCode: cad.patternPart?.code || (isAllParts ? ALL_PARTS_CODE : null),
        partName: cad.patternPart?.name || (isAllParts ? 'All Parts' : null),
        // Multi-part fields
        partIds: orphanPartIds,
        parts: orphanParts,
        fabricFinishType,
        designName,
        isEmbroidery: cad.isEmbroidery,
        genericGreigeName,
        readyFabricId,
        readyFabricName,
        readyFabricCode,
        greigeId: cad.greigeId,
        greigeName: greige?.greigeName || null,
        cutableWidth: cad.cutableWidth ? Number(cad.cutableWidth) : null,
        availableWidths,
        stockWidths,
        hasStockMatch: stockWidths.length > 0,
        printDirection: cad.printDirection,
        sizeBreakdowns,
        piecesPerMarker: cad.piecesPerMarker,
        layerMarginMeters: layerMargin,
        layerLengthMeters: layerLength,
        cadAverage,
        isCombinedCutting: cad.isCombinedCutting || false,
        combinedFabricIds: null,
        combinedComponents: cad.combinedComponents || null,
        orderCount: 0,
        stockLotNumber: cad.fabricStock?.id ? cad.fabricStock.id.substring(0, 8) : null,
        approvalStatus: cad.approvalStatus,
        isLocked: cad.isLocked || false,
        fabricStockId: cad.fabricStockId || null,
      });
    }
  }

  // Build components list for dropdown
  const components = style.style_components.map((comp: any) => {
    // Get the component master ID for this style component
    const componentMasterId = componentNameToIdMap.get(comp.componentName.toLowerCase());

    return {
      id: comp.id,
      name: comp.componentName,
      type: comp.componentType,
      // Renamed to 'masterPatternParts' to avoid RELATION_MAPPING collision:
      // serializer maps 'stylePatternParts' → 'patternParts', which would overwrite
      // this field if we kept it as 'patternParts'. Using 'masterPatternParts' avoids that.
      masterPatternParts: componentMasterId
        ? componentPatternParts
            .filter((cpp) => cpp.componentId === componentMasterId)
            .map((cpp) => ({
              id: cpp.patternPart.id,
              name: cpp.patternPart.name,
              code: cpp.patternPart.code,
              goesToEmbroidery: false, // component_pattern_parts doesn't have this field
            }))
        : [],
      // Also include style pattern parts that have been assigned
      // Serializer maps 'stylePatternParts' → 'patternParts' via RELATION_MAPPINGS
      stylePatternParts: comp.style_fabrics.flatMap((sf: any) =>
        sf.stylePatternParts.map((spp: any) => ({
          id: spp.patternPart.id,
          name: spp.patternPart.name,
          code: spp.patternPart.code,
          goesToEmbroidery: spp.goesToEmbroidery,
        }))
      ),
      // Include style fabrics for add row functionality
      // Serializer maps 'styleFabrics' → 'fabrics' via RELATION_MAPPINGS
      styleFabrics: comp.style_fabrics.map((sf: any) => ({
        id: sf.id,
        fabricFinishType: sf.fabricFinishType,
        // For READY_FABRIC fabrics, genericGreigeName is null on style_fabrics;
        // fall back to fabric_master.genericGreigeName
        genericGreigeName: sf.genericGreigeName || sf.fabric?.genericGreigeName || null,
        // Design/Color for fabric identification
        printDesign: sf.printDesign || sf.fabric?.printDesign || null,
        colorName: sf.colorMaster?.colorName || sf.fabricColor || null,
        hasEmbroidery: sf.hasEmbroidery || false,
        embroideryCode: sf.embroidery?.embroideryCode || null,
        fabricCode: sf.fabric?.fabricCode || null,
      })),
    };
  });

  // Size options from style variants
  const sizeOptions = style.style_variants.map((sv: any) => ({
    id: sv.sizeId || sv.id,
    name: sv.size?.name || sv.sizeName || 'Unknown',
    sortOrder: sv.sortOrder,
  }));

  return res.json({
    success: true,
    data: {
      style: {
        id: style.id,
        styleCode: style.styleCode,
        styleName: style.styleName,
        cadStatus: style.cadStatus,
      },
      components,
      availableGreiges: availableGreiges.map((g) => ({
        id: g.id,
        greigeName: g.greigeName,
        genericGreigeName: g.genericGreigeName,
        greigeWidth: g.greigeWidth ? Number(g.greigeWidth) : null,
        expectedFinishedWidthMin: g.expectedFinishedWidthMin ? Number(g.expectedFinishedWidthMin) : null,
        expectedFinishedWidthMax: g.expectedFinishedWidthMax ? Number(g.expectedFinishedWidthMax) : null,
        supplierName: g.defaultSupplier?.name,
      })),
      sizeOptions,
      cadRows,
      stockSummary,
    },
  });
}

/**
 * Add a new CAD row to the spreadsheet table
 * POST /api/styles/:styleId/cad-table/row
 */
export async function addCADTableRow(req: Request, res: Response) {
  const { styleId } = req.params;
  const {
    purpose = 'COSTING', // Default to COSTING mode (no stock required) - renamed from PLANNING
    componentId,
    styleFabricId,
    partId: requestPartId,
    partIds: requestPartIds, // NEW: Array of part IDs for multi-part selection
    fabricStockId, // Required for PRODUCTION purpose only
    // Note: isEmbroidery is intentionally NOT used from request body
    // We inherit embroidery status from the linked style_fabrics record
  } = req.body;
  let partId = requestPartId;
  const partIds: string[] = requestPartIds || [];

  // ===================================================================
  // PRODUCTION PURPOSE: Require fabric stock selection
  // Business Rule: Production CAD is possible only if we have fabric in
  // stock or fabric has been GRN'd. The width should be taken from stock.
  // ===================================================================
  let stockCutableWidth: number | null = null;
  let validatedStock: any = null;

  if (purpose === 'PRODUCTION') {
    if (!fabricStockId) {
      throw new BusinessError(
        'PRODUCTION CAD requires fabric stock. Please select available stock or use COSTING/RAW_MATERIAL_CALCULATION purpose.'
      );
    }

    // Validate stock exists and has available quantity
    validatedStock = await prisma.fabric_stock.findUnique({
      where: { id: fabricStockId },
      include: {
        fabricMaster: {
          include: { greige: true },
        },
        embroidery: true,
      },
    });

    if (!validatedStock) {
      throw new NotFoundError('Fabric stock', fabricStockId);
    }

    if (Number(validatedStock.quantityAvailable) <= 0) {
      throw new BusinessError(
        'Selected stock has no available quantity. Please select a different stock or wait for GRN.'
      );
    }

    if (validatedStock.status !== 'AVAILABLE') {
      throw new BusinessError(
        `Selected stock is not available (status: ${validatedStock.status}). Please select an AVAILABLE stock.`
      );
    }

    // Use width from stock - this is the key business rule
    stockCutableWidth = Number(validatedStock.cutableWidth);
    logInfo(`PRODUCTION CAD: Using width ${stockCutableWidth}" from stock ${fabricStockId}`);
  }

  // Validate style exists
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    include: {
      style_components: {
        include: {
          style_fabrics: {
            include: {
              fabric: true,
            },
          },
        },
      },
    },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  // Find the style fabric
  let styleFabric = null;
  for (const comp of style.style_components) {
    const found = comp.style_fabrics.find((sf) => sf.id === styleFabricId);
    if (found) {
      styleFabric = found;
      break;
    }
  }

  if (!styleFabric) {
    throw new NotFoundError('Style fabric', styleFabricId);
  }

  // Auto-populate pattern part from style_pattern_parts if not provided
  if (!partId) {
    const assignedParts = await prisma.style_pattern_parts.findMany({
      where: { styleFabricId },
      include: { patternPart: true },
    });

    if (assignedParts.length === 1) {
      // Single part assigned → auto-set it
      partId = assignedParts[0].patternPartId;
      logInfo(`Auto-populated pattern part ${assignedParts[0].patternPart.name} for style fabric ${styleFabricId}`);
    } else if (assignedParts.length === 0) {
      // No parts assigned → default to "All Parts"
      const allParts = await prisma.pattern_part_master.findFirst({
        where: { code: ALL_PARTS_CODE },
      });
      if (allParts) {
        partId = allParts.id;
        logInfo(`Auto-populated "All Parts" for style fabric ${styleFabricId} (no parts assigned)`);
      }
    }
    // Multiple parts → leave blank, user selects manually after row creation
  }

  // Check if this is an "All Parts" selection (either legacy marker or we need to check the actual pattern part)
  // Since "All Parts" is now a real pattern part in the database, we check if the partId refers to it
  let isAllParts = partId === ALL_PARTS_LEGACY_MARKER;
  let allPartsPatternPart = null;

  // If partId is provided and not the legacy marker, check if it's the "All Parts" pattern part
  if (partId && !isAllParts) {
    allPartsPatternPart = await prisma.pattern_part_master.findFirst({
      where: { id: partId, code: ALL_PARTS_CODE },
    });
    if (allPartsPatternPart) {
      isAllParts = true;
    }
  }

  // Validate pattern part if provided (skip for ALL_PARTS)
  let patternPart = null;
  if (partId && !isAllParts) {
    patternPart = await prisma.pattern_part_master.findUnique({
      where: { id: partId },
    });
    if (!patternPart) {
      throw new NotFoundError('Pattern part', partId);
    }
  }

  // Create new CAD entry linked to style fabric
  // fabricId is optional - will be set when greige is selected and fabric is determined
  // For "All Parts": if using the real pattern part, store the FK; if legacy marker, store in componentName
  // IMPORTANT: Inherit embroidery status from the linked style_fabrics record, not from request body
  //
  // PRODUCTION PURPOSE: Use width and greige from stock, link fabricStockId
  const newCad = (await prisma.fabric_width_cad.create({
    data: {
      styleFabricId: styleFabricId, // Link to style fabric directly
      costingStyleId: styleId, // ✅ FIX: Set explicitly to avoid NULL in unique constraint
      // For PRODUCTION: use fabric from stock; otherwise use style fabric's fabric if set
      fabricId:
        purpose === 'PRODUCTION' && validatedStock ? validatedStock.fabricId : styleFabric.fabricId || undefined,
      // For PRODUCTION: use width from stock; otherwise start at 0 (set when greige selected)
      cutableWidth: purpose === 'PRODUCTION' && stockCutableWidth !== null ? stockCutableWidth : 0,
      purpose,
      purposeEnum: purpose as any, // Sync enum field with string field for validation
      approvalStatus: 'PENDING', // ✅ FIX: Set explicit default instead of NULL
      // If "All Parts" pattern part exists, use its ID; otherwise fall back to legacy handling
      patternPartId: allPartsPatternPart ? allPartsPatternPart.id : isAllParts ? undefined : partId || undefined,
      isEmbroidery: styleFabric.hasEmbroidery || false, // Use from styleFabric, not request body
      // Only store legacy marker if using legacy flow (no real pattern part)
      componentName: isAllParts && !allPartsPatternPart ? ALL_PARTS_LEGACY_MARKER : patternPart?.name || undefined,
      printDirection: 'TWO_WAY',
      createdById: req.user?.userId || undefined,
      // PRODUCTION: Link to stock and use greige from fabric master
      fabricStockId: purpose === 'PRODUCTION' ? fabricStockId : undefined,
      greigeId:
        purpose === 'PRODUCTION' && validatedStock?.fabricMaster?.greigeId
          ? validatedStock.fabricMaster.greigeId
          : undefined,
    },
    include: {
      sizeBreakdowns: true,
      greige: true,
      patternPart: true,
      styleFabric: true,
      fabricStock: purpose === 'PRODUCTION' ? true : undefined,
    },
  })) as any;

  logInfo(`Created new CAD row ${newCad.id} for style ${styleId}${isAllParts ? ' (All Parts)' : ''}`);

  // Fetch style_pattern_parts to get goesToEmbroidery values (per-style configuration)
  const stylePatternParts = await prisma.style_pattern_parts.findMany({
    where: { styleFabricId },
    select: { patternPartId: true, goesToEmbroidery: true },
  });
  const embroideryMap = new Map(stylePatternParts.map((spp) => [spp.patternPartId, spp.goesToEmbroidery]));

  // Create cad_pattern_parts entries if partIds array is provided (multi-part selection)
  let createdParts: { id: string; code: string; name: string; goesToEmbroidery: boolean }[] = [];
  if (partIds.length > 0) {
    // Create bridge table entries for each selected part
    await prisma.cad_pattern_parts.createMany({
      data: partIds.map((pid: string) => ({
        cadId: newCad.id,
        patternPartId: pid,
      })),
      skipDuplicates: true,
    });

    // Fetch the created parts for response
    const cadPartsWithDetails = await prisma.cad_pattern_parts.findMany({
      where: { cadId: newCad.id },
      include: { patternPart: true },
    });
    createdParts = cadPartsWithDetails.map((cp) => ({
      id: cp.patternPart.id,
      code: cp.patternPart.code,
      name: cp.patternPart.name,
      goesToEmbroidery: embroideryMap.get(cp.patternPart.id) || false,
    }));
    logInfo(`Created ${createdParts.length} cad_pattern_parts entries for CAD ${newCad.id}`);
  } else if (newCad.patternPart) {
    // Fall back to single pattern part for backwards compatibility
    createdParts = [
      {
        id: newCad.patternPart.id,
        code: newCad.patternPart.code,
        name: newCad.patternPart.name,
        goesToEmbroidery: embroideryMap.get(newCad.patternPart.id) || false,
      },
    ];
  }

  // Sync BOM: replace generic planning fabricId with real stock fabricId
  if (
    purpose === 'PRODUCTION' &&
    validatedStock?.fabricId &&
    styleFabric.fabricId &&
    validatedStock.fabricId !== styleFabric.fabricId
  ) {
    await syncBomFabricId(styleId, styleFabric.fabricId, validatedStock.fabricId);
  }

  // Check if the linked pattern part is "All Parts"
  const responseIsAllParts =
    newCad.patternPart?.code === ALL_PARTS_CODE || newCad.componentName === ALL_PARTS_LEGACY_MARKER;

  return res.status(201).json({
    success: true,
    data: {
      id: newCad.id,
      purpose: newCad.purpose,
      // Legacy single-part fields (backwards compatibility)
      partId: newCad.patternPartId,
      partCode: newCad.patternPart?.code || (responseIsAllParts ? ALL_PARTS_CODE : null),
      partName: newCad.patternPart?.name || (responseIsAllParts ? 'All Parts' : newCad.componentName),
      // Multi-part fields
      partIds: createdParts.map((p) => p.id),
      parts: createdParts,
      isEmbroidery: newCad.isEmbroidery,
      greigeId: newCad.greigeId,
      greigeName: newCad.greige?.greigeName || null,
      cutableWidth: Number(newCad.cutableWidth),
      printDirection: newCad.printDirection,
      sizeBreakdowns: [],
      piecesPerMarker: newCad.piecesPerMarker,
      layerMarginMeters: newCad.layerMarginMeters ? Number(newCad.layerMarginMeters) : null,
      cadMeters: newCad.cadMeters ? Number(newCad.cadMeters) : null,
      // Stock info for PRODUCTION purpose
      fabricStockId: newCad.fabricStockId || null,
      stockInfo:
        purpose === 'PRODUCTION' && validatedStock
          ? {
              id: validatedStock.id,
              rollNumbers: validatedStock.rollNumbers,
              quantityAvailable: Number(validatedStock.quantityAvailable),
              qualityGrade: validatedStock.qualityGrade,
              cutableWidth: Number(validatedStock.cutableWidth),
            }
          : null,
    },
    message:
      purpose === 'PRODUCTION'
        ? `PRODUCTION CAD row created with stock (Width: ${stockCutableWidth}")`
        : 'CAD row created successfully',
  });
}

/**
 * Add a COMBINED CAD row from multiple style fabrics that share the same base fabric
 * POST /api/styles/:styleId/cad-table/combined-row
 * Body: { styleFabricIds: string[], purpose?: string }
 *
 * Validation rules for combining:
 * - All fabrics must have same genericGreigeName
 * - All fabrics must have same fabricFinishType
 * - All fabrics must have same embroidery status (all plain OR all same embroideryId)
 */
export async function addCombinedCADRow(req: Request, res: Response) {
  const { styleId } = req.params;
  const { styleFabricIds, purpose = 'COSTING', fabricStockId } = req.body; // Default to COSTING mode (no stock required) - renamed from PLANNING

  // ===================================================================
  // PRODUCTION PURPOSE: Require fabric stock selection for combined rows
  // Business Rule: Production CAD is possible only if we have fabric in
  // stock or fabric has been GRN'd. The width should be taken from stock.
  // ===================================================================
  let stockCutableWidth: number | null = null;
  let validatedStock: any = null;

  if (purpose === 'PRODUCTION') {
    if (!fabricStockId) {
      throw new BusinessError(
        'PRODUCTION combined CAD requires fabric stock. Please select available stock or use COSTING/RAW_MATERIAL_CALCULATION purpose.'
      );
    }

    // Validate stock exists and has available quantity
    validatedStock = await prisma.fabric_stock.findUnique({
      where: { id: fabricStockId },
      include: {
        fabricMaster: {
          include: { greige: true },
        },
        embroidery: true,
      },
    });

    if (!validatedStock) {
      throw new NotFoundError('Fabric stock', fabricStockId);
    }

    if (Number(validatedStock.quantityAvailable) <= 0) {
      throw new BusinessError(
        'Selected stock has no available quantity. Please select a different stock or wait for GRN.'
      );
    }

    if (validatedStock.status !== 'AVAILABLE') {
      throw new BusinessError(
        `Selected stock is not available (status: ${validatedStock.status}). Please select an AVAILABLE stock.`
      );
    }

    // Use width from stock
    stockCutableWidth = Number(validatedStock.cutableWidth);
    logInfo(`PRODUCTION Combined CAD: Using width ${stockCutableWidth}" from stock ${fabricStockId}`);
  }

  // Validate input
  if (!styleFabricIds || !Array.isArray(styleFabricIds) || styleFabricIds.length < 2) {
    throw new ValidationError('At least 2 style fabrics are required for combined cutting');
  }

  // Fetch all style fabrics with their component info
  const styleFabrics = await prisma.style_fabrics.findMany({
    where: {
      id: { in: styleFabricIds },
      style_components: {
        styleId,
      },
    },
    include: {
      style_components: {
        select: {
          id: true,
          componentName: true,
          styleId: true,
        },
      },
      fabric: {
        select: {
          id: true,
          fabricCode: true,
          fabricName: true,
          greigeId: true,
        },
      },
    },
  });

  // Check all fabrics were found
  if (styleFabrics.length !== styleFabricIds.length) {
    throw new NotFoundError('Style fabrics', 'one or more not found');
  }

  // Extract component names for display
  const componentNames = styleFabrics.map((sf) => sf.style_components?.componentName).filter(Boolean);

  // Validate all fabrics share same base criteria
  const firstFabric = styleFabrics[0];
  const genericGreigeName = firstFabric.genericGreigeName;
  const fabricFinishType = firstFabric.fabricFinishType;
  const hasEmbroidery = firstFabric.hasEmbroidery;
  const embroideryId = firstFabric.embroideryId;

  for (const sf of styleFabrics) {
    if (sf.genericGreigeName !== genericGreigeName) {
      throw new BusinessError(
        `Cannot combine fabrics with different generic names: "${genericGreigeName}" vs "${sf.genericGreigeName}"`
      );
    }
    if (sf.fabricFinishType !== fabricFinishType) {
      throw new BusinessError(
        `Cannot combine fabrics with different finish types: "${fabricFinishType}" vs "${sf.fabricFinishType}"`
      );
    }
    if (sf.hasEmbroidery !== hasEmbroidery) {
      throw new BusinessError('Cannot combine plain and embroidered fabrics');
    }
    if (hasEmbroidery && sf.embroideryId !== embroideryId) {
      throw new BusinessError('Cannot combine fabrics with different embroidery designs');
    }
  }

  // Look up "All Parts" pattern part
  const allPartsPatternPart = await prisma.pattern_part_master.findFirst({
    where: { code: ALL_PARTS_CODE },
  });

  // Create combined CAD row
  // Link to first style fabric for the FK (styleFabricId is singular)
  // Store all fabric IDs in combinedFabricIds JSON field
  const combinedComponents = componentNames.join(', ');
  const combinedFabricIdsJson = JSON.stringify(styleFabricIds);

  // PRODUCTION PURPOSE: Use width, fabric, and greige from stock
  const newCad = (await prisma.fabric_width_cad.create({
    data: {
      styleFabricId: firstFabric.id, // Link to first fabric for FK
      // For PRODUCTION: use fabric from stock; otherwise use style fabric's fabric
      fabricId:
        purpose === 'PRODUCTION' && validatedStock ? validatedStock.fabricId : firstFabric.fabric?.id || undefined,
      // For PRODUCTION: use width from stock; otherwise start at 0
      cutableWidth: purpose === 'PRODUCTION' && stockCutableWidth !== null ? stockCutableWidth : 0,
      purpose,
      purposeEnum: purpose as any, // Sync enum field with string field for validation
      approvalStatus: 'PENDING', // Explicit default to match regular CAD creation
      patternPartId: allPartsPatternPart?.id || undefined,
      isEmbroidery: hasEmbroidery,
      componentName: 'Combined: ' + combinedComponents,
      printDirection: 'TWO_WAY',
      createdById: req.user?.userId || undefined,
      // Combined cutting fields
      isCombinedCutting: true,
      combinedFabricIds: combinedFabricIdsJson,
      combinedComponents: combinedComponents,
      // PRODUCTION: Link to stock and use greige from fabric master
      fabricStockId: purpose === 'PRODUCTION' ? fabricStockId : undefined,
      greigeId:
        purpose === 'PRODUCTION' && validatedStock?.fabricMaster?.greigeId
          ? validatedStock.fabricMaster.greigeId
          : undefined,
    },
    include: {
      sizeBreakdowns: true,
      greige: true,
      patternPart: true,
      styleFabric: true,
      fabricStock: purpose === 'PRODUCTION' ? true : undefined,
    },
  })) as any;

  logInfo(
    `Created combined CAD row ${newCad.id} for style ${styleId} with ${styleFabrics.length} fabrics: ${combinedComponents}`
  );

  // Sync BOM: replace generic planning fabricId with real stock fabricId for all combined fabrics
  if (purpose === 'PRODUCTION' && validatedStock?.fabricId) {
    for (const sf of styleFabrics) {
      if (sf.fabricId && sf.fabricId !== validatedStock.fabricId) {
        await syncBomFabricId(styleId, sf.fabricId, validatedStock.fabricId);
      }
    }
  }

  return res.status(201).json({
    success: true,
    data: {
      id: newCad.id,
      purpose: newCad.purpose,
      partId: newCad.patternPartId,
      partCode: allPartsPatternPart?.code || ALL_PARTS_CODE,
      partName: allPartsPatternPart?.name || 'All Parts',
      isEmbroidery: newCad.isEmbroidery,
      greigeId: newCad.greigeId,
      greigeName: newCad.greige?.greigeName || null,
      cutableWidth: Number(newCad.cutableWidth),
      printDirection: newCad.printDirection,
      sizeBreakdowns: [],
      piecesPerMarker: newCad.piecesPerMarker,
      layerMarginMeters: newCad.layerMarginMeters ? Number(newCad.layerMarginMeters) : null,
      cadMeters: newCad.cadMeters ? Number(newCad.cadMeters) : null,
      // Combined cutting info
      isCombinedCutting: true,
      combinedFabricIds: styleFabricIds,
      combinedComponents: combinedComponents,
      // Stock info for PRODUCTION purpose
      fabricStockId: newCad.fabricStockId || null,
      stockInfo:
        purpose === 'PRODUCTION' && validatedStock
          ? {
              id: validatedStock.id,
              rollNumbers: validatedStock.rollNumbers,
              quantityAvailable: Number(validatedStock.quantityAvailable),
              qualityGrade: validatedStock.qualityGrade,
              cutableWidth: Number(validatedStock.cutableWidth),
            }
          : null,
    },
    message:
      purpose === 'PRODUCTION'
        ? `PRODUCTION combined CAD row created with stock (Width: ${stockCutableWidth}")`
        : `Combined CAD row created for ${styleFabrics.length} components: ${combinedComponents}`,
  });
}

/**
 * Update a CAD row in the spreadsheet table
 * PUT /api/styles/:styleId/cad-table/row/:rowId
 */
export async function updateCADTableRow(req: Request, res: Response) {
  const { styleId, rowId } = req.params;
  const parsedRowId = parseInt(rowId, 10);

  // Validate that approved CAD cannot be updated
  await validateCADModification(rowId, 'update');

  const {
    purpose,
    partId,
    partIds, // NEW: Array of part IDs for multi-part selection
    isEmbroidery,
    greigeId,
    fabricId: readyFabricId, // Direct fabric_master link (ready fabric mode)
    cutableWidth,
    printDirection,
    sizeBreakdowns,
    cadMeters,
    piecesPerMarker,
    layerLengthMeters,
    // Greige rate override fields
  } = req.body;

  // Find existing CAD
  const existingCad = await prisma.fabric_width_cad.findUnique({
    where: { id: rowId },
    include: {
      sizeBreakdowns: true,
      greige: true,
      styleFabric: true,
    },
  });

  if (!existingCad) {
    throw new NotFoundError('CAD row', rowId);
  }

  // Fetch style_pattern_parts to get goesToEmbroidery values (per-style configuration)
  const stylePatternPartsForUpdate = existingCad.styleFabricId
    ? await prisma.style_pattern_parts.findMany({
        where: { styleFabricId: existingCad.styleFabricId },
        select: { patternPartId: true, goesToEmbroidery: true },
      })
    : [];
  const embroideryMapForUpdate = new Map(
    stylePatternPartsForUpdate.map((spp) => [spp.patternPartId, spp.goesToEmbroidery])
  );

  // Validate and apply default width based on greige
  let validatedWidth = cutableWidth;
  const effectiveGreigeId = greigeId !== undefined ? greigeId : existingCad.greigeId;

  // Apply default width if:
  // 1. Greige is changing (new greige selected), OR
  // 2. Width is empty/0 and greige already exists (placeholder default should be applied)
  if (effectiveGreigeId && (!validatedWidth || validatedWidth === 0)) {
    const greige = await prisma.greige_master.findUnique({
      where: { id: effectiveGreigeId },
    });

    if (!greige) {
      throw new NotFoundError('Greige', effectiveGreigeId);
    }

    // Set default based on greige width
    // Business rules: 63" greige → 52", 48" greige → 40"
    const greigeWidth = greige.greigeWidth ? Number(greige.greigeWidth) : null;
    if (greigeWidth && greigeWidth >= 63) {
      validatedWidth = 52;
    } else if (greigeWidth && greigeWidth >= 48) {
      validatedWidth = 40;
    } else {
      // Fallback to min finished width
      validatedWidth = greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : 44;
    }

    // Validate width against greige range
    const validation = validateCutableWidth(validatedWidth, greige, isEmbroidery ?? existingCad.isEmbroidery);
    if (!validation.valid) {
      throw new ValidationError(validation.message || 'Cutable width validation failed');
    }
  } else if (greigeId && greigeId !== existingCad.greigeId && validatedWidth) {
    // Greige changed but width was provided - validate width against new greige
    const greige = await prisma.greige_master.findUnique({
      where: { id: greigeId },
    });

    if (greige) {
      const validation = validateCutableWidth(validatedWidth, greige, isEmbroidery ?? existingCad.isEmbroidery);
      if (!validation.valid) {
        throw new ValidationError(validation.message || 'Cutable width validation failed');
      }
    }
  }

  // Determine the effective layer length (layerLengthMeters maps to cadMeters in DB)
  const effectiveLayerLength = layerLengthMeters !== undefined ? layerLengthMeters : cadMeters;

  // Calculate layer margin based on layer length
  let layerMarginMetersValue = existingCad.layerMarginMeters;
  if (effectiveLayerLength !== undefined) {
    layerMarginMetersValue = new Prisma.Decimal(getDefaultLayerMargin(effectiveLayerLength));
  }

  // Update CAD entry
  const updateData: Prisma.fabric_width_cadUpdateInput = {};

  if (purpose !== undefined) {
    updateData.purpose = purpose;
    // BUG-FC7 fix: Sync purposeEnum when purpose is updated to prevent drift
    updateData.purposeEnum = purpose as any;
  }
  if (partId !== undefined) {
    // Check if this is an "All Parts" selection
    const isAllPartsLegacy = partId === ALL_PARTS_LEGACY_MARKER;
    let isAllPartsReal = false;

    if (partId && !isAllPartsLegacy) {
      // Check if the partId refers to the "All Parts" pattern part
      const allPartsPart = await prisma.pattern_part_master.findFirst({
        where: { id: partId, code: ALL_PARTS_CODE },
      });
      isAllPartsReal = !!allPartsPart;
    }

    if (isAllPartsLegacy) {
      // Legacy "All Parts" marker - clear pattern part FK, store marker in componentName
      updateData.patternPart = { disconnect: true };
      updateData.componentName = ALL_PARTS_LEGACY_MARKER;
    } else if (isAllPartsReal || partId) {
      // Real pattern part selected (including "All Parts" as a real record)
      updateData.patternPart = { connect: { id: partId } };
      // Clear the legacy marker if it was previously set
      updateData.componentName = null;
    } else {
      // Clear part selection
      updateData.patternPart = { disconnect: true };
      updateData.componentName = null;
    }
  }
  if (isEmbroidery !== undefined) updateData.isEmbroidery = isEmbroidery;
  if (greigeId !== undefined) {
    updateData.greige = greigeId ? { connect: { id: greigeId } } : { disconnect: true };
  }
  // Ready-fabric mode: store fabricId directly (no greige validation needed)
  if (readyFabricId !== undefined) {
    updateData.fabric = readyFabricId ? { connect: { id: readyFabricId } } : { disconnect: true };
  }
  if (validatedWidth !== undefined) updateData.cutableWidth = validatedWidth;
  if (printDirection !== undefined) updateData.printDirection = printDirection;
  // layerLengthMeters from frontend maps to cadMeters in DB
  if (effectiveLayerLength !== undefined) {
    updateData.cadMeters = effectiveLayerLength;
    updateData.layerMarginMeters = layerMarginMetersValue;
  }
  if (piecesPerMarker !== undefined) updateData.piecesPerMarker = piecesPerMarker;

  const updatedCad = (await prisma.fabric_width_cad.update({
    where: { id: rowId },
    data: updateData,
    include: {
      sizeBreakdowns: true,
      greige: true,
      patternPart: true,
      cadPatternParts: { include: { patternPart: true } }, // Multi-part selection
    },
  })) as any;

  // Update size breakdowns if provided
  if (sizeBreakdowns && Array.isArray(sizeBreakdowns)) {
    // Delete existing breakdowns
    await prisma.cad_size_breakdown.deleteMany({
      where: { cadId: rowId },
    });

    // Create new breakdowns
    if (sizeBreakdowns.length > 0) {
      await prisma.cad_size_breakdown.createMany({
        data: sizeBreakdowns.map((sb: { sizeName: string; sizeId?: string; quantity: number }) => ({
          cadId: rowId,
          sizeName: sb.sizeName,
          sizeId: sb.sizeId || null,
          quantity: sb.quantity,
        })),
      });
    }
  }

  // Get updated breakdowns
  const updatedBreakdowns = await prisma.cad_size_breakdown.findMany({
    where: { cadId: rowId },
  });

  // Update cad_pattern_parts if partIds array is provided (multi-part selection)
  let updatedParts: { id: string; code: string; name: string; goesToEmbroidery: boolean }[] = [];
  if (partIds !== undefined && Array.isArray(partIds)) {
    // Delete existing cad_pattern_parts entries
    await prisma.cad_pattern_parts.deleteMany({
      where: { cadId: rowId },
    });

    // Create new entries if partIds has items
    if (partIds.length > 0) {
      await prisma.cad_pattern_parts.createMany({
        data: partIds.map((pid: string) => ({
          cadId: rowId,
          patternPartId: pid,
        })),
        skipDuplicates: true,
      });
    }

    // Fetch the updated parts for response
    const cadPartsWithDetails = await prisma.cad_pattern_parts.findMany({
      where: { cadId: rowId },
      include: { patternPart: true },
    });
    updatedParts = cadPartsWithDetails.map((cp) => ({
      id: cp.patternPart.id,
      code: cp.patternPart.code,
      name: cp.patternPart.name,
      goesToEmbroidery: embroideryMapForUpdate.get(cp.patternPart.id) || false,
    }));
    logInfo(`Updated ${updatedParts.length} cad_pattern_parts entries for CAD ${rowId}`);
  } else {
    // Use existing cadPatternParts or fall back to single patternPart
    updatedParts = updatedCad.cadPatternParts?.length
      ? updatedCad.cadPatternParts.map((cp: any) => ({
          id: cp.patternPart.id,
          code: cp.patternPart.code,
          name: cp.patternPart.name,
          goesToEmbroidery: embroideryMapForUpdate.get(cp.patternPart.id) || false,
        }))
      : updatedCad.patternPart
        ? [
            {
              id: updatedCad.patternPart.id,
              code: updatedCad.patternPart.code,
              name: updatedCad.patternPart.name,
              goesToEmbroidery: embroideryMapForUpdate.get(updatedCad.patternPart.id) || false,
            },
          ]
        : [];
  }

  const totalPieces = updatedBreakdowns.reduce((sum, sb) => sum + sb.quantity, 0);
  const finalCadMeters = updatedCad.cadMeters ? Number(updatedCad.cadMeters) : null;
  const finalLayerMargin = updatedCad.layerMarginMeters
    ? Number(updatedCad.layerMarginMeters)
    : finalCadMeters
      ? getDefaultLayerMargin(finalCadMeters)
      : 0;
  // CAD Average = (layerLengthMeters + layerMargin) / piecesPerMarker
  const cadAverage = finalCadMeters && totalPieces > 0 ? (finalCadMeters + finalLayerMargin) / totalPieces : null;

  // IMPORTANT: Store cadAverage in the database
  if (cadAverage !== null) {
    await prisma.fabric_width_cad.update({
      where: { id: rowId },
      data: { cadAverage },
    });
  }

  // =====================================================
  // AUTO-TRIGGER FABRIC COSTING on CAD save
  // When CAD data is complete (cadAverage, greigeId, cutableWidth),
  // automatically calculate and save fabric costing
  // =====================================================
  // Never re-seed a row that Fabric Costing has already costed: overwriting its greige
  // rate with today's market rate silently changed saved costings.
  const shouldAutoTriggerCosting =
    cadAverage !== null &&
    updatedCad.greigeId !== null &&
    updatedCad.cutableWidth !== null &&
    updatedCad.totalCostPerMeter === null;

  let autoCalculatedCost: { totalCostPerMeter: number | null; costInputMode: string | null } | null = null;
  // Failures of the auto-costing / variance side-effects are surfaced as a response
  // warning instead of being silently swallowed (bug-hunt cleanup-74, T2)
  let costingWarning: string | undefined;
  let varianceWarning: string | undefined;

  if (shouldAutoTriggerCosting) {
    try {
      {
        // Get greige cost from procurement or greige master
        const greigeForCosting = await prisma.greige_master.findUnique({
          where: { id: updatedCad.greigeId! },
          include: {
            fabricProcurements: {
              where: {
                procurementType: 'GREIGE',
                status: { in: ['RECEIVED', 'PROCESSING', 'COMPLETED'] },
              },
              orderBy: { purchaseDate: 'desc' },
              take: 1,
              select: { ratePerUnit: true, purchaseDate: true },
            },
          },
        });

        if (greigeForCosting) {
          const latestProcurement = greigeForCosting.fabricProcurements?.[0];
          const latestProcurementRate = latestProcurement?.ratePerUnit;

          // Determine rate source and value
          let greigeCostPerMeter: number | null = null;
          let rateSource: 'PROCUREMENT' | 'GREIGE_MASTER' | null = null;
          let rateSourceDate: Date | null = null;

          if (latestProcurementRate) {
            greigeCostPerMeter = Number(latestProcurementRate);
            rateSource = 'PROCUREMENT';
            rateSourceDate = latestProcurement?.purchaseDate || new Date();
          } else if (greigeForCosting.costPerMeter) {
            greigeCostPerMeter = Number(greigeForCosting.costPerMeter);
            rateSource = 'GREIGE_MASTER';
            rateSourceDate = greigeForCosting.updatedAt;
          }

          // If we have greige cost, update the CAD record with costing data
          if (greigeCostPerMeter !== null && rateSource !== null) {
            await prisma.fabric_width_cad.update({
              where: { id: rowId },
              data: {
                greigeCostPerMeter,
                greigeRateSource: rateSource,
                greigeRateSourceDate: rateSourceDate,
                greigeRateManualOverride: null, // Clear any previous override
                greigeRateOverrideReason: null,
                // costInputMode intentionally not written here — see the manual-override
                // branch above; 'AUTO_CALCULATED' is not a legal CostInputMode.
              } as any,
            });
            autoCalculatedCost = {
              totalCostPerMeter: greigeCostPerMeter,
              costInputMode: 'AUTO_CALCULATED',
              rateSource,
              rateSourceDate,
            } as any;
            logInfo(
              `Auto-triggered fabric costing for CAD ${rowId}: greige cost = ${greigeCostPerMeter}/meter (source: ${rateSource})`
            );
          }
        }
      }
    } catch (costingError) {
      // allow-swallow — CAD save must not fail on the costing enrichment; failure is surfaced via the response warning field (T2)
      logger.error('Auto-trigger fabric costing failed (non-critical):', costingError);
      costingWarning =
        'CAD row saved, but auto fabric costing failed — greige cost was not updated. ' +
        (costingError instanceof Error ? costingError.message : '');
    }
  }

  // =====================================================
  // PRODUCTION VARIANCE CALCULATION
  // When updating PRODUCTION CAD, calculate variance against
  // the RAW_MATERIAL_CALCULATION source CAD and trigger approval if > 3%
  // =====================================================
  let varianceData: {
    cadVariance: number | null;
    variancePercent: number | null;
    varianceApprovalStatus: string;
    varianceRequiresApproval: boolean;
  } | null = null;

  const effectivePurpose = purpose ?? existingCad.purpose;
  if (effectivePurpose === 'PRODUCTION' && cadAverage !== null) {
    try {
      // Find the source RAW_MATERIAL_CALCULATION CAD
      // Either via clonedFromCadId or by matching fabric/greige/width
      let sourceCad: {
        id: string;
        cadAverage: number | null;
        cadMeters: number | null;
        cutableWidth: number | null;
      } | null = null;

      // First try to find via clonedFromCadId
      if ((existingCad as any).clonedFromCadId) {
        const clonedSource = await prisma.fabric_width_cad.findUnique({
          where: { id: (existingCad as any).clonedFromCadId },
          select: { id: true, cadAverage: true, cadMeters: true, cutableWidth: true },
        });
        if (clonedSource) {
          sourceCad = {
            id: clonedSource.id,
            cadAverage: clonedSource.cadAverage ? Number(clonedSource.cadAverage) : null,
            cadMeters: clonedSource.cadMeters ? Number(clonedSource.cadMeters) : null,
            cutableWidth: clonedSource.cutableWidth ? Number(clonedSource.cutableWidth) : null,
          };
        }
      }

      // If not found via clonedFromCadId, try to match by greige and width
      if (!sourceCad && existingCad.greigeId) {
        // Find the RAW_MATERIAL_CALCULATION CAD for the same greige and width
        const rawMatCad = await prisma.fabric_width_cad.findFirst({
          where: {
            purpose: 'RAW_MATERIAL_CALCULATION',
            approvedBy: { not: null },
            greigeId: existingCad.greigeId,
            cutableWidth: existingCad.cutableWidth,
          },
          select: { id: true, cadAverage: true, cadMeters: true, cutableWidth: true },
          orderBy: { approvedAt: 'desc' },
        });

        if (rawMatCad) {
          sourceCad = {
            id: rawMatCad.id,
            cadAverage: rawMatCad.cadAverage ? Number(rawMatCad.cadAverage) : null,
            cadMeters: rawMatCad.cadMeters ? Number(rawMatCad.cadMeters) : null,
            cutableWidth: rawMatCad.cutableWidth ? Number(rawMatCad.cutableWidth) : null,
          };
        }
      }

      // Calculate variance if we found a source CAD
      if (sourceCad && sourceCad.cadAverage !== null && sourceCad.cadAverage > 0) {
        const plannedCad = sourceCad.cadAverage;
        const actualCad = cadAverage;
        const cadVarianceValue = actualCad - plannedCad;
        const variancePercentValue = (cadVarianceValue / plannedCad) * 100;

        // Business Rule: Variance > 3% requires Admin approval
        const VARIANCE_THRESHOLD = 3;
        const absVariancePercent = Math.abs(variancePercentValue);
        const requiresApproval = absVariancePercent > VARIANCE_THRESHOLD;

        const approvalStatus = requiresApproval ? 'PENDING_APPROVAL' : 'NOT_REQUIRED';

        // Update the CAD record with variance data
        await prisma.fabric_width_cad.update({
          where: { id: rowId },
          data: {
            cadVariance: cadVarianceValue,
            variancePercent: variancePercentValue,
            varianceApprovalStatus: approvalStatus,
            // Clear any previous approval if variance changed
            ...(requiresApproval && {
              varianceApprovedById: null,
              varianceApprovedAt: null,
              varianceApprovalNotes: null,
            }),
          } as any,
        });

        varianceData = {
          cadVariance: cadVarianceValue,
          variancePercent: variancePercentValue,
          varianceApprovalStatus: approvalStatus,
          varianceRequiresApproval: requiresApproval,
        };

        if (requiresApproval) {
          logInfo(
            `PRODUCTION CAD ${rowId}: Variance ${variancePercentValue.toFixed(2)}% exceeds 3% threshold - requires Admin approval`
          );
        } else {
          logInfo(
            `PRODUCTION CAD ${rowId}: Variance ${variancePercentValue.toFixed(2)}% within threshold - auto-approved`
          );
        }
      }
    } catch (varianceError) {
      // allow-swallow — CAD save must not fail on the variance rollup; failure is surfaced via the response warning field (T2)
      logger.error('PRODUCTION variance calculation failed (non-critical):', varianceError);
      varianceWarning =
        'CAD row saved, but production variance calculation failed — variance approval status was not updated. ' +
        (varianceError instanceof Error ? varianceError.message : '');
    }
  }

  // Handle "All Parts" case in response (check both real pattern part and legacy marker)
  const responseIsAllParts =
    updatedCad.patternPart?.code === ALL_PARTS_CODE || updatedCad.componentName === ALL_PARTS_LEGACY_MARKER;

  logInfo(`Updated CAD row ${rowId} for style ${styleId}${responseIsAllParts ? ' (All Parts)' : ''}`);

  return res.json({
    success: true,
    data: {
      id: updatedCad.id,
      purpose: updatedCad.purpose,
      // Legacy single-part fields (backwards compatibility)
      partId: updatedCad.patternPartId,
      partCode: updatedCad.patternPart?.code || (responseIsAllParts ? ALL_PARTS_CODE : null),
      partName: updatedCad.patternPart?.name || (responseIsAllParts ? 'All Parts' : updatedCad.componentName),
      // Multi-part fields
      partIds: updatedParts.map((p) => p.id),
      parts: updatedParts,
      isEmbroidery: updatedCad.isEmbroidery,
      greigeId: updatedCad.greigeId,
      greigeName: updatedCad.greige?.greigeName || null,
      cutableWidth: Number(updatedCad.cutableWidth),
      printDirection: updatedCad.printDirection,
      sizeBreakdowns: updatedBreakdowns.map((sb) => ({
        sizeName: sb.sizeName,
        sizeId: sb.sizeId,
        quantity: sb.quantity,
      })),
      piecesPerMarker: updatedCad.piecesPerMarker,
      layerMarginMeters: updatedCad.layerMarginMeters ? Number(updatedCad.layerMarginMeters) : null,
      layerLengthMeters: finalCadMeters,
      cadAverage,
      // Auto-calculated costing (if triggered)
      autoCalculatedCost: autoCalculatedCost
        ? {
            greigeCostPerMeter: autoCalculatedCost.totalCostPerMeter,
            costInputMode: autoCalculatedCost.costInputMode,
            rateSource: (autoCalculatedCost as any).rateSource || null,
            rateSourceDate: (autoCalculatedCost as any).rateSourceDate || null,
          }
        : null,
      // PRODUCTION variance data (if calculated)
      variance: varianceData
        ? {
            cadVariance: varianceData.cadVariance,
            variancePercent: varianceData.variancePercent,
            varianceApprovalStatus: varianceData.varianceApprovalStatus,
            requiresApproval: varianceData.varianceRequiresApproval,
          }
        : null,
    },
    message: varianceData?.varianceRequiresApproval
      ? `CAD row updated - Variance ${varianceData.variancePercent?.toFixed(2)}% exceeds 3% threshold, requires Admin approval`
      : autoCalculatedCost
        ? 'CAD row updated and fabric costing auto-calculated'
        : 'CAD row updated successfully',
    // Optional (additive) warning when a non-blocking side-effect failed
    ...(costingWarning || varianceWarning
      ? { warning: [costingWarning, varianceWarning].filter(Boolean).join(' ') }
      : {}),
  });
}

/**
 * Delete a CAD row from the spreadsheet table
 * DELETE /api/styles/:styleId/cad-table/row/:rowId
 */
export async function deleteCADTableRow(req: Request, res: Response) {
  const { styleId, rowId } = req.params;
  const parsedRowId = parseInt(rowId, 10);

  // Validate that approved CAD cannot be deleted
  await validateCADModification(rowId, 'delete');

  // Find existing CAD
  const existingCad = await prisma.fabric_width_cad.findUnique({
    where: { id: rowId },
    include: {
      styleFabrics: true,
    },
  });

  if (!existingCad) {
    throw new NotFoundError('CAD row', rowId);
  }

  // Unlink from style fabrics first
  await prisma.style_fabrics.updateMany({
    where: { fabricCADId: rowId },
    data: { fabricCADId: null },
  });

  // Delete size breakdowns
  await prisma.cad_size_breakdown.deleteMany({
    where: { cadId: rowId },
  });

  // Delete the CAD entry
  await prisma.fabric_width_cad.delete({
    where: { id: rowId },
  });

  // Auto-reset style cadStatus to PENDING if no CAD rows remain
  // When the last row is deleted, the plan is no longer approved
  const remainingRows = await prisma.fabric_width_cad.count({
    where: {
      styleFabric: {
        style_components: { styleId },
      },
    },
  });

  if (remainingRows === 0) {
    await prisma.styles.update({
      where: { id: styleId },
      data: { cadStatus: 'PENDING', approvedCadDate: null },
    });
    logInfo(`Reset cadStatus to PENDING for style ${styleId} — no CAD rows remain`);
  }

  logInfo(`Deleted CAD row ${rowId} for style ${styleId}`);

  return res.json({
    success: true,
    message: 'CAD row deleted successfully',
  });
}

/**
 * Get available widths for a greige
 * GET /api/styles/cad-table/greige/:greigeId/widths
 */
export async function getGreigeWidths(req: Request, res: Response) {
  const { greigeId } = req.params;

  const greige = await prisma.greige_master.findUnique({
    where: { id: greigeId },
  });

  if (!greige) {
    throw new NotFoundError('Greige', greigeId);
  }

  const minWidth = greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : 36;
  const maxWidth = greige.expectedFinishedWidthMax
    ? Number(greige.expectedFinishedWidthMax)
    : greige.greigeWidth
      ? Number(greige.greigeWidth)
      : 60;

  // Generate widths in 0.5-inch increments
  const widths: number[] = [];
  for (let w = minWidth; w <= maxWidth; w += 0.5) {
    widths.push(w);
  }

  return res.json({
    success: true,
    data: {
      greigeId,
      greigeName: greige.greigeName,
      greigeWidth: greige.greigeWidth ? Number(greige.greigeWidth) : null,
      minFinishedWidth: minWidth,
      maxFinishedWidth: maxWidth,
      availableWidths: widths,
    },
  });
}

/**
 * Get CAD order usage history for a style
 * Shows which orders used which PRODUCTION CAD widths
 * GET /api/styles/:styleId/cad-planning/order-history
 */
export async function getCADOrderHistory(req: Request, res: Response) {
  const { styleId } = req.params;

  // Query order items that have selected CAD for this style
  const orderItems = await prisma.order_items.findMany({
    where: {
      styleId,
      selectedCadId: { not: null },
    },
    include: {
      orders: {
        include: {
          customers: {
            select: {
              name: true,
            },
          },
        },
      },
      selectedCad: {
        include: {
          fabricStock: {
            select: {
              rollNumbers: true,
              qualityGrade: true,
              cutableWidth: true,
            },
          },
        },
      },
    },
    orderBy: {
      orders: {
        orderDate: 'desc',
      },
    },
  });

  // Also get allocations with PRODUCTION CAD linked
  const allocations = await prisma.fabric_stock_allocation.findMany({
    where: {
      styleId,
      productionCadId: { not: null },
    },
    include: {
      order: {
        include: {
          customers: {
            select: {
              name: true,
            },
          },
        },
      },
      productionCad: {
        select: {
          id: true,
          cutableWidth: true,
          cadMeters: true,
          planningCadWidth: true,
          widthVariance: true,
          variancePercent: true,
          approvalStatus: true,
        },
      },
      fabricStock: {
        select: {
          rollNumbers: true,
          qualityGrade: true,
        },
      },
    },
    orderBy: {
      allocatedDate: 'desc',
    },
  });

  // Build history from order items
  const historyFromOrders = orderItems.map((item) => ({
    source: 'order_selection',
    orderId: item.orderId,
    orderNumber: item.orders.orderNumber,
    orderDate: item.orders.orderDate,
    customerName: item.orders.customers?.name || 'Unknown',
    cadId: item.selectedCadId,
    cutableWidth: item.selectedCad ? Number(item.selectedCad.cutableWidth) : null,
    cadMeters: item.selectedCad?.cadMeters ? Number(item.selectedCad.cadMeters) : null,
    stockLot: item.selectedCad?.fabricStock?.rollNumbers || null,
    qualityGrade: item.selectedCad?.fabricStock?.qualityGrade || null,
    planningCadWidth: item.selectedCad?.planningCadWidth ? Number(item.selectedCad.planningCadWidth) : null,
    widthVariance: item.selectedCad?.widthVariance ? Number(item.selectedCad.widthVariance) : null,
    variancePercent: item.selectedCad?.variancePercent ? Number(item.selectedCad.variancePercent) : null,
    quantityCut: item.totalQuantity,
  }));

  // Build history from allocations
  const historyFromAllocations = allocations.map((alloc) => ({
    source: 'allocation',
    orderId: alloc.orderId,
    orderNumber: alloc.order?.orderNumber || 'Unknown',
    orderDate: alloc.order?.orderDate || alloc.allocatedDate,
    customerName: alloc.order?.customers?.name || 'Unknown',
    cadId: alloc.productionCadId,
    cutableWidth: alloc.productionCad ? Number(alloc.productionCad.cutableWidth) : null,
    cadMeters: alloc.productionCad?.cadMeters ? Number(alloc.productionCad.cadMeters) : null,
    stockLot: alloc.fabricStock?.rollNumbers || null,
    qualityGrade: alloc.fabricStock?.qualityGrade || null,
    planningCadWidth: alloc.productionCad?.planningCadWidth ? Number(alloc.productionCad.planningCadWidth) : null,
    widthVariance: alloc.productionCad?.widthVariance ? Number(alloc.productionCad.widthVariance) : null,
    variancePercent: alloc.productionCad?.variancePercent ? Number(alloc.productionCad.variancePercent) : null,
    quantityAllocated: Number(alloc.quantityAllocated),
    quantityConsumed: Number(alloc.quantityConsumed),
    allocationStatus: alloc.allocationStatus,
  }));

  // Merge and dedupe by orderId + cadId
  const historyMap = new Map<string, any>();

  for (const item of historyFromOrders) {
    const key = `${item.orderId}-${item.cadId}`;
    historyMap.set(key, item);
  }

  for (const item of historyFromAllocations) {
    const key = `${item.orderId}-${item.cadId}`;
    if (!historyMap.has(key)) {
      historyMap.set(key, item);
    } else {
      // Merge allocation data into existing entry
      const existing = historyMap.get(key);
      historyMap.set(key, {
        ...existing,
        quantityAllocated: item.quantityAllocated,
        quantityConsumed: item.quantityConsumed,
        allocationStatus: item.allocationStatus,
      });
    }
  }

  const history = Array.from(historyMap.values()).sort((a, b) => {
    const dateA = new Date(a.orderDate).getTime();
    const dateB = new Date(b.orderDate).getTime();
    return dateB - dateA; // Newest first
  });

  // Also get summary of all PRODUCTION CAD rows for this style
  const productionCADs = await prisma.fabric_width_cad.findMany({
    where: {
      styleFabric: {
        style_components: {
          styleId,
        },
      },
      purpose: 'PRODUCTION',
    },
    include: {
      styleFabric: {
        include: {
          style_components: true,
          fabric: true,
        },
      },
      fabricStock: {
        select: {
          id: true,
          quantityAvailable: true,
        },
      },
      stockAllocations: {
        select: {
          orderId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const cadSummary = productionCADs.map((cad) => ({
    id: cad.id,
    cutableWidth: Number(cad.cutableWidth),
    cadMeters: cad.cadMeters ? Number(cad.cadMeters) : null,
    approvalStatus: cad.approvalStatus,
    isLocked: cad.isLocked,
    fabricName: cad.styleFabric?.fabric?.fabricName || 'Unknown',
    componentName: cad.styleFabric?.style_components?.componentName || cad.componentName,
    stockLot: cad.fabricStock?.id ? cad.fabricStock.id.substring(0, 8) : null,
    stockAvailable: cad.fabricStock?.quantityAvailable ? Number(cad.fabricStock.quantityAvailable) : null,
    orderCount: cad.stockAllocations?.length || 0,
    createdAt: cad.createdAt,
  }));

  return res.json({
    success: true,
    data: {
      styleId,
      history,
      cadSummary,
      totalOrders: new Set(history.map((h) => h.orderId)).size,
      totalCADs: cadSummary.length,
    },
  });
}

// ============================================
// CAD PLANNING LIST OPERATIONS
// ============================================

/**
 * Get CAD status counts for all styles
 * Used by CADPlanningList to show tab counts
 * Note: Shows all active styles regardless of DRAFT/ACTIVE status
 * since CAD planning happens during both phases
 */
export async function getCADStatusCounts(req: Request, res: Response) {
  // Cache CAD status counts for 2 minutes (frequently accessed, changes rarely)
  const result = await cachedQuery(
    cacheKeys.cad.statusCounts,
    async () => {
      const counts = await prisma.styles.groupBy({
        by: ['cadStatus'],
        where: {
          isActive: true,
          // Note: Removed status: 'ACTIVE' filter - CAD planning works with DRAFT styles too
        },
        _count: {
          id: true,
        },
      });

      const statusCounts = {
        PENDING: 0,
        IN_PROGRESS: 0,
        APPROVED: 0,
      };

      counts.forEach((count) => {
        if (count.cadStatus && count.cadStatus in statusCounts) {
          statusCounts[count.cadStatus as keyof typeof statusCounts] = count._count.id;
        }
      });

      return statusCounts;
    },
    cacheTTL.SHORT // 1 minute - short TTL since counts change with style updates
  );

  return res.json({
    success: true,
    data: result,
  });
}

/**
 * Get styles for CAD planning list with filters
 * Dedicated endpoint for the new CADPlanningList page
 *
 * Enhanced to include:
 * - CAD width details (greige, width, CAD avg, purpose)
 * - Unified search across all statuses (when searchAll=true)
 * - IN_PROGRESS merged into PENDING tab
 */
export async function getStylesForCADPlanning(req: Request, res: Response) {
  const {
    status = 'PENDING',
    page = '1',
    limit = '20',
    search = '',
    searchAll = 'false', // When true, search across all statuses
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit as string, 10) || 20);
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: any = {
    isActive: true,
  };

  // For APPROVED status, query styles directly with nested filter (top-down approach)
  // This is more reliable than querying fabric_width_cad and filtering upward
  let validApprovedStyleIds: string[] | undefined;

  if (status === 'APPROVED' && !(searchAll === 'true' && search)) {
    // Query styles directly and filter for those with valid CAD entries (cadMeters populated)
    const stylesWithValidCAD = await prisma.styles.findMany({
      where: {
        cadStatus: 'APPROVED',
        isActive: true,
        style_components: {
          some: {
            style_fabrics: {
              some: {
                cadRows: {
                  some: {
                    cadMeters: { not: null },
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true, styleCode: true, buyerStyleRef: true },
    });

    validApprovedStyleIds = stylesWithValidCAD.map((s) => s.id);

    // If no valid styles found, return empty result early
    if (validApprovedStyleIds.length === 0) {
      return res.json({
        success: true,
        data: {
          styles: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        },
      });
    }
  }

  // Handle status filter
  // - If searchAll is true and search is provided, don't filter by status
  // - If status is PENDING, include both PENDING and IN_PROGRESS (merged)
  // - If status is APPROVED, use pre-filtered style IDs from the two-step query above
  // - Otherwise use the exact status
  if (!(searchAll === 'true' && search)) {
    if (status === 'PENDING') {
      where.cadStatus = { in: ['PENDING', 'IN_PROGRESS'] };
    } else if (status === 'APPROVED') {
      // Use pre-filtered style IDs from the two-step query above
      where.cadStatus = 'APPROVED';
      if (validApprovedStyleIds) {
        where.id = { in: validApprovedStyleIds };
      }
    } else {
      where.cadStatus = status as string;
    }
  }

  // Add search filter
  if (search) {
    where.OR = [
      { styleCode: { contains: search as string, mode: 'insensitive' } },
      { buyerStyleRef: { contains: search as string, mode: 'insensitive' } },
      { styleName: { contains: search as string, mode: 'insensitive' } },
      { customerName: { contains: search as string, mode: 'insensitive' } },
      { brand_categories: { brandName: { contains: search as string, mode: 'insensitive' } } },
    ];
  }

  const [styles, total] = await Promise.all([
    prisma.styles.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        styleCode: true,
        buyerStyleRef: true,
        styleName: true,
        cadStatus: true,
        approvedCadDate: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        customerName: true,
        brand_categories: {
          select: {
            id: true,
            brandName: true,
            category: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        style_components: {
          select: {
            id: true,
            componentName: true,
            componentType: true,
            style_fabrics: {
              select: {
                id: true,
                fabric: {
                  select: {
                    id: true,
                    fabricName: true,
                    genericGreigeName: true,
                  },
                },
                // Include CAD width details via cadRows relation
                cadRows: {
                  select: {
                    id: true,
                    cutableWidth: true,
                    cadMeters: true,
                    cadAverage: true,
                    purpose: true,
                    greigeId: true,
                    greige: {
                      select: {
                        greigeName: true,
                        greigeCode: true,
                      },
                    },
                  },
                  orderBy: { cutableWidth: 'asc' },
                },
                // Legacy approved CAD (set via approveCAD endpoint)
                fabricCAD: {
                  select: {
                    id: true,
                    cutableWidth: true,
                    cadMeters: true,
                    cadAverage: true,
                    purpose: true,
                    greige: {
                      select: {
                        greigeName: true,
                        greigeCode: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.styles.count({ where }),
  ]);

  // Transform to include fabric summary and CAD details
  const transformedStyles = styles.map((style) => {
    const fabricNames = new Set<string>();
    const cadDetails: Array<{
      id: string;
      cutableWidth: number;
      layerLength: number; // Renamed from cadMeters for clarity
      cadAverage: number | null; // Per-piece consumption
      purpose: string | null;
      greigeName: string | null;
      greigeCode: string | null;
    }> = [];

    style.style_components?.forEach((comp) => {
      comp.style_fabrics?.forEach((sf) => {
        // Collect fabric names
        if (sf.fabric?.genericGreigeName) {
          fabricNames.add(sf.fabric.genericGreigeName);
        } else if (sf.fabric?.fabricName) {
          fabricNames.add(sf.fabric.fabricName);
        }

        // Collect CAD details from each style fabric (new cadRows relationship)
        sf.cadRows?.forEach((cad) => {
          cadDetails.push({
            id: cad.id,
            cutableWidth: cad.cutableWidth ? Number(cad.cutableWidth) : 0,
            layerLength: cad.cadMeters ? Number(cad.cadMeters) : 0, // Renamed from cadMeters
            cadAverage: cad.cadAverage ? Number(cad.cadAverage) : null, // Per-piece consumption
            purpose: cad.purpose || null,
            greigeName: cad.greige?.greigeName || sf.fabric?.genericGreigeName || sf.fabric?.fabricName || null,
            greigeCode: cad.greige?.greigeCode || null,
          });
        });

        // Also include legacy approved CAD (set via old approveCAD endpoint via fabricCADId)
        const legacyCad = (sf as any).fabricCAD;
        if (legacyCad && !cadDetails.some((c) => c.id === legacyCad.id)) {
          cadDetails.push({
            id: legacyCad.id,
            cutableWidth: legacyCad.cutableWidth ? Number(legacyCad.cutableWidth) : 0,
            layerLength: legacyCad.cadMeters ? Number(legacyCad.cadMeters) : 0,
            cadAverage: legacyCad.cadAverage ? Number(legacyCad.cadAverage) : null,
            purpose: legacyCad.purpose || null,
            greigeName: legacyCad.greige?.greigeName || null,
            greigeCode: legacyCad.greige?.greigeCode || null,
          });
        }
      });
    });

    // If status is APPROVED but no CAD entries found, reflect the inconsistency
    const effectiveCadStatus = style.cadStatus === 'APPROVED' && cadDetails.length === 0 ? 'PENDING' : style.cadStatus;

    return {
      id: style.id,
      styleCode: style.styleCode,
      buyerStyleRef: style.buyerStyleRef ?? null,
      styleName: style.styleName,
      cadStatus: style.cadStatus,
      effectiveCadStatus, // Reflects actual state (PENDING if APPROVED but no entries)
      approvedCadDate: style.approvedCadDate,
      imageUrl: style.imageUrl,
      createdAt: style.createdAt,
      updatedAt: style.updatedAt,
      buyerName: style.brand_categories?.customer?.name || style.customerName || null,
      brandName: style.brand_categories?.brandName || null,
      categoryName: style.brand_categories?.category || null,
      componentCount: style.style_components?.length || 0,
      fabricSummary: Array.from(fabricNames).join(', ') || 'No fabrics',
      cadDetails, // Array of CAD width details
    };
  });

  return res.json({
    success: true,
    data: {
      styles: transformedStyles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
}

/**
 * Sync BOM items' fabricId for a style based on existing PRODUCTION CAD rows.
 * Use this to fix existing data where PRODUCTION CAD was created before the sync logic.
 * POST /api/cad-planning/:styleId/sync-bom-fabric
 */
export async function syncBomFabricFromCAD(req: Request, res: Response) {
  const { styleId } = req.params;

  const productionCads = await prisma.fabric_width_cad.findMany({
    where: {
      purpose: 'PRODUCTION',
      OR: [{ costingStyleId: styleId }, { styleFabric: { style_components: { styleId } } }],
    },
    include: {
      styleFabric: { select: { fabricId: true } },
      fabricStock: { select: { fabricId: true } },
    },
  });

  let totalSynced = 0;
  for (const cad of productionCads) {
    const genericId = cad.styleFabric?.fabricId;
    const realId = cad.fabricId || cad.fabricStock?.fabricId;
    if (genericId && realId && genericId !== realId) {
      totalSynced += await syncBomFabricId(styleId, genericId, realId);
    }
  }

  return res.json({
    success: true,
    message: `Synced ${totalSynced} BOM item(s)`,
    syncedCount: totalSynced,
    productionCadsChecked: productionCads.length,
  });
}
