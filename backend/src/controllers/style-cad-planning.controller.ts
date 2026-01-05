import { Request, Response } from 'express';
import { PrismaClient, Prisma, CADStatus, FabricFinishType } from '@prisma/client';
import { logError, logInfo } from '../utils/logger';

const prisma = new PrismaClient();

// Code for the "All Parts" pattern part in the database
const ALL_PARTS_CODE = 'ALL_PARTS';

// Legacy marker for backwards compatibility (stored in componentName for old rows)
const ALL_PARTS_LEGACY_MARKER = '__ALL_PARTS__';

// Cutable width offsets from greige width (standard industry practice)
// NOTE: Auto-width generation has been disabled - users add widths manually on CAD Edit page
const CUTABLE_WIDTH_OFFSETS = [-2, -4, -6]; // inches reduction from greige width (kept for reference/calculation display)

// Layer margin defaults based on layer length (meters)
function getDefaultLayerMargin(layerLengthMeters: number): number {
  if (layerLengthMeters <= 0) return 0.02;
  if (layerLengthMeters <= 1) return 0.02; // 2 cm
  if (layerLengthMeters <= 5) return 0.05; // 5 cm
  if (layerLengthMeters <= 10) return 0.10; // 10 cm
  if (layerLengthMeters <= 20) return 0.20; // 20 cm
  return 0.30; // 30 cm
}

/**
 * Validate cutable width against greige's finished width range
 * @param cutableWidth - The width to validate
 * @param greige - The greige master record
 * @param hasEmbroideryParts - If true, allows any width up to greige width
 * @returns Validation result with message if invalid
 */
interface WidthValidationResult {
  valid: boolean;
  message?: string;
}

function validateCutableWidth(
  cutableWidth: number,
  greige: {
    greigeWidth: number | Prisma.Decimal | null;
    expectedFinishedWidthMin: number | Prisma.Decimal | null;
    expectedFinishedWidthMax: number | Prisma.Decimal | null;
  } | null,
  hasEmbroideryParts: boolean = false
): WidthValidationResult {
  if (!greige) {
    return { valid: true }; // No greige = no validation
  }

  const greigeWidth = greige.greigeWidth ? Number(greige.greigeWidth) : null;
  const minWidth = greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : null;
  const maxWidth = greige.expectedFinishedWidthMax ? Number(greige.expectedFinishedWidthMax) : null;

  // If embroidery parts, allow any width up to greige width
  if (hasEmbroideryParts) {
    if (greigeWidth && cutableWidth > greigeWidth) {
      return {
        valid: false,
        message: `Width cannot exceed greige width (${greigeWidth}")`
      };
    }
    return { valid: true };
  }

  // Non-embroidery: must be within finished width range
  if (minWidth !== null && cutableWidth < minWidth) {
    return {
      valid: false,
      message: `Width must be at least ${minWidth}" (min finished width from greige)`
    };
  }

  if (maxWidth !== null && cutableWidth > maxWidth) {
    return {
      valid: false,
      message: `Width cannot exceed ${maxWidth}" (max finished width from greige)`
    };
  }

  return { valid: true };
}

// Response types for CAD planning
interface FabricCADSummary {
  fabricId: string;
  fabricName: string;
  componentType: string;
  cadStatus: 'PENDING' | 'OPTIONS_GENERATED' | 'APPROVED';
  approvedCADId?: string;
  approvedWidth?: number;
  availableOptions: number;
}

interface ComponentCADSummary {
  componentId: string;
  componentName: string;
  componentType: string;
  fabrics: FabricCADSummary[];
}

interface StyleCADSummary {
  styleId: string;
  styleCode: string;
  styleName: string;
  customerName: string;
  brandName: string;
  imageUrl?: string;
  cadStatus: CADStatus;
  components: ComponentCADSummary[];
  createdAt: string;
  updatedAt: string;
}

interface CADOption {
  cadId: string;
  fabricId: string | null;
  fabricName: string;
  greigeId?: string;
  greigeName?: string;
  cutableWidth: number;
  widthUnit: string;
  cadMeters: number | null;
  cadYards?: number;
  cadWastagePercent: number;
  layerMarginMeters: number;
  markerEfficiency?: number;
  isPreferred: boolean;
  supplierAvailability?: string;
  processingPricePerMeter?: number;
  componentName?: string;
  notes?: string;
}

interface CADCostResult {
  cadId: string;
  cutableWidth: number;
  cadConsumption: number;
  wastagePercent: number;
  effectiveConsumption: number;
  fabricRate: number;
  totalCost: number;
  costPerMeter: number;
  unit: 'meters' | 'yards';
}

/**
 * Get all styles pending CAD approval
 * GET /api/styles/cad-planning/pending
 * Query params: page, limit
 */
export async function getPendingCADStyles(req: Request, res: Response) {
  try {
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
  } catch (error: unknown) {
    logError('Error fetching pending CAD styles:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending CAD styles',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Generate CAD options for a style's fabric group after selecting greige
 * POST /api/styles/cad-planning/generate
 * Body: { styleId, genericFabricName, greigeId, averagingMode?, componentNames? }
 *
 * NEW WORKFLOW:
 * 1. User selects greige from greige_master
 * 2. System generates cutable width options based on greige width (offset -2", -4", -6")
 * 3. For SEPARATE mode, generates one set of options per component
 */
export async function generateCADOptions(req: Request, res: Response) {
  try {
    const {
      styleId,
      genericFabricName,
      greigeId,
      averagingMode = 'COMBINED',
      componentNames = [] // For SEPARATE mode: list of component names
    } = req.body;

    // Verify style exists
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
    });

    if (!style) {
      return res.status(404).json({
        success: false,
        message: 'Style not found',
      });
    }

    // Get greige to determine cutable widths
    let greige = null;
    let cutableWidths: number[] = [];

    if (greigeId) {
      greige = await prisma.greige_master.findUnique({
        where: { id: greigeId },
      });

      if (!greige) {
        return res.status(404).json({
          success: false,
          message: 'Greige fabric not found',
        });
      }

      // Calculate cutable widths from greige width
      const greigeWidth = Number(greige.greigeWidth);
      cutableWidths = CUTABLE_WIDTH_OFFSETS.map(offset => greigeWidth + offset);
    } else {
      // Default widths if no greige selected
      cutableWidths = [54, 56, 58];
    }

    // Find or create fabric_master for this greige/style
    let fabric = await prisma.fabric_master.findFirst({
      where: greigeId ? {
        greigeId,
        genericFabricName,
      } : {
        genericFabricName,
        styleReference: styleId,
        isGeneric: true,
      },
    });

    if (!fabric) {
      fabric = await prisma.fabric_master.create({
        data: {
          fabricCode: greigeId
            ? `${greige!.greigeCode}-${Date.now()}`
            : `CAD-${styleId.slice(0, 8)}-${Date.now()}`,
          fabricName: greigeId
            ? `${genericFabricName} - ${greige!.greigeName}`
            : `${genericFabricName} (CAD Planning)`,
          genericFabricName,
          greigeId: greigeId || null,
          actualWidth: greige?.greigeWidth || null,
          isActive: true,
          isGeneric: true,
          styleReference: styleId,
          createdById: req.user?.userId || 'system',
        },
      });
    }

    // Generate CAD options
    const options: CADOption[] = [];

    // For SEPARATE mode, we generate options for each component
    // For COMBINED mode, we generate options without componentName
    const componentsToProcess = averagingMode === 'SEPARATE' && componentNames.length > 0
      ? componentNames
      : [null]; // null means COMBINED

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
              cutableWidth: cutableWidth,
              widthUnit: 'inches',
              cadWastagePercent: 5, // Default 5% wastage
              layerMarginMeters: 0.05, // Default 5cm layer margin
              greigeId: greigeId || null,
              componentName: componentName || null,
              isPreferred: cutableWidth === cutableWidths[0], // Prefer largest width
              createdById: req.user?.userId || 'system',
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
      genericFabricName,
      greigeId: greigeId || null,
      greigeName: greige?.greigeName || null,
      greigeWidth: greige ? Number(greige.greigeWidth) : null,
      greigePricePerMeter: greige?.costPerMeter ? Number(greige.costPerMeter) : null,
      averagingMode,
      options,
      recommendedOption: options.find((opt) => opt.isPreferred)?.cadId || options[0]?.cadId,
    });
  } catch (error: unknown) {
    logError('Error generating CAD options:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate CAD options',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Calculate cost for a specific CAD option
 * POST /api/styles/cad-planning/calculate-cost
 * Body: { cadId, fabricRate, unit? }
 */
export async function calculateCADCost(req: Request, res: Response) {
  try {
    const { cadId, fabricRate, unit = 'meters' } = req.body;

    // Get CAD details
    const cad = await prisma.fabric_width_cad.findUnique({
      where: { id: cadId },
      include: {
        fabric: true,
      },
    });

    if (!cad) {
      return res.status(404).json({
        success: false,
        message: 'CAD record not found',
      });
    }

    // Calculate effective consumption
    const cadConsumption = unit === 'meters'
      ? Number(cad.cadMeters || 0)
      : Number(cad.cadYards || 0);

    if (cadConsumption === 0) {
      return res.status(400).json({
        success: false,
        message: 'CAD consumption value not available. Please input CAD value first.',
      });
    }

    const wastagePercent = Number(cad.cadWastagePercent);
    const effectiveConsumption = cadConsumption * (1 + wastagePercent / 100);
    const totalCost = effectiveConsumption * fabricRate;
    const costPerMeter = unit === 'meters' ? fabricRate : fabricRate / 0.9144; // yards to meters

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
  } catch (error: unknown) {
    logError('Error calculating CAD cost:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate CAD cost',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Approve a specific CAD option for a style
 * POST /api/styles/cad-planning/approve
 * Body: { styleId, cadId, fabricId, approvalNotes? }
 */
export async function approveCAD(req: Request, res: Response) {
  try {
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

    // Verify CAD exists
    const cad = await prisma.fabric_width_cad.findUnique({
      where: { id: cadId },
    });

    if (!cad) {
      return res.status(404).json({
        success: false,
        message: 'CAD record not found',
      });
    }

    // Update style_fabrics to reference this CAD
    const fabricsToUpdate = style.style_components.flatMap((comp) =>
      comp.style_fabrics.map((fabric) => fabric.id)
    );

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
  } catch (error: unknown) {
    logError('Error approving CAD:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve CAD',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
  try {
    const { cadId } = req.params;
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
      return res.status(404).json({
        success: false,
        message: 'CAD record not found',
      });
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
  } catch (error: unknown) {
    logError('Error updating CAD values:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update CAD values',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get available greige options for a generic fabric name
 * GET /api/styles/cad-planning/greige-options
 * Query params: genericFabricName
 */
export async function getGreigeOptionsForGeneric(req: Request, res: Response) {
  try {
    const { genericFabricName } = req.query;

    if (!genericFabricName) {
      return res.status(400).json({
        success: false,
        message: 'genericFabricName query parameter is required',
      });
    }

    // Find all fabrics with this generic name
    const fabrics = await prisma.fabric_master.findMany({
      where: {
        genericFabricName: genericFabricName as string,
        isActive: true,
      },
      include: {
        greige: true,
      },
      distinct: ['greigeId'],
    });

    const greigeOptions = fabrics
      .filter(fabric => fabric.greige) // Only include fabrics with greige
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
      genericFabricName,
      options: greigeOptions,
      total: greigeOptions.length,
    });
  } catch (error: unknown) {
    logError('Error fetching greige options:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch greige options',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get CAD planning summary for a style
 * GET /api/styles/:styleId/cad-summary
 */
export async function getStyleCADSummary(req: Request, res: Response) {
  try {
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
      return res.status(404).json({
        success: false,
        message: 'Style not found',
      });
    }

    // Build summary
    const components = style.style_components.map((comp) => ({
      componentId: comp.id,
      componentName: comp.componentName,
      componentType: comp.componentType,
      fabrics: comp.style_fabrics.map((fabric) => ({
        fabricId: fabric.id,
        fabricName: fabric.fabricName || fabric.fabric?.fabricName || 'Unknown',
        genericFabricName: fabric.genericFabricName,
        fabricMasterId: fabric.fabricId,
        hasCAD: fabric.fabricCADId !== null,
        cutableWidth: fabric.cutableWidth ? Number(fabric.cutableWidth) : null,
        averagingMode: fabric.averagingMode || 'COMBINED',
        selectedGreigeId: fabric.selectedGreigeId,
        cadDetails: fabric.fabricCAD ? {
          cadId: fabric.fabricCAD.id,
          cutableWidth: Number(fabric.fabricCAD.cutableWidth),
          cadMeters: fabric.fabricCAD.cadMeters ? Number(fabric.fabricCAD.cadMeters) : null,
          wastagePercent: Number(fabric.fabricCAD.cadWastagePercent),
          layerMarginMeters: fabric.fabricCAD.layerMarginMeters ? Number(fabric.fabricCAD.layerMarginMeters) : null,
          processingPricePerMeter: fabric.fabricCAD.processingPricePerMeter ? Number(fabric.fabricCAD.processingPricePerMeter) : null,
          markerEfficiency: fabric.fabricCAD.markerEfficiency ? Number(fabric.fabricCAD.markerEfficiency) : null,
          componentName: fabric.fabricCAD.componentName,
        } : null,
        greigeDetails: fabric.fabric?.greige ? {
          greigeId: fabric.fabric.greigeId,
          greigeName: fabric.fabric.greige.greigeName,
          greigeWidth: Number(fabric.fabric.greige.greigeWidth),
          greigePricePerMeter: fabric.fabric.greige.costPerMeter ? Number(fabric.fabric.greige.costPerMeter) : null,
        } : null,
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
  } catch (error: unknown) {
    logError('Error fetching style CAD summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch style CAD summary',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get enhanced CAD planning data for a style
 * GET /api/styles/:styleId/cad-planning
 *
 * Returns:
 * - Style info
 * - Fabric groups (grouped by genericFabricName + fabricFinishType)
 * - Available greige options for each group
 * - CAD options for each group (if greige selected)
 */
export async function getEnhancedCADPlanning(req: Request, res: Response) {
  try {
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
      return res.status(404).json({
        success: false,
        message: 'Style not found',
      });
    }

    // Extract size options from style variants
    type StyleVariant = typeof style.style_variants[0];
    type SizeOptionType = { sizeId: string | null; sizeName: string; sortOrder: number };
    const sizeOptions: SizeOptionType[] = style.style_variants
      .filter((v: StyleVariant) => v.sizeName)
      .map((v: StyleVariant): SizeOptionType => ({
        sizeId: v.sizeId,
        sizeName: v.sizeName!,
        sortOrder: v.sortOrder,
      }))
      .filter((size: SizeOptionType, index: number, self: SizeOptionType[]) =>
        index === self.findIndex((s: SizeOptionType) => s.sizeName === size.sizeName)
      )
      .sort((a: SizeOptionType, b: SizeOptionType) => a.sortOrder - b.sortOrder);

    // Group fabrics by genericFabricName + fabricFinishType + embroidery state
    // Embroidery creates a "derivative fabric" that needs separate CAD planning
    const fabricGroupsMap = new Map<string, {
      groupKey: string;
      genericFabricName: string;
      fabricFinishType: string | null;
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
    }>();

    for (const comp of style.style_components) {
      for (const fabric of comp.style_fabrics) {
        // Include embroidery state in grouping key
        // hasEmbroidery alone determines if it's embroidered - embroideryId is optional
        const embroideryPart = fabric.hasEmbroidery
          ? (fabric.embroideryId ? `EMB-${fabric.embroideryId.substring(0, 8)}` : 'EMB-PENDING')
          : 'NO_EMB';
        const groupKey = `${fabric.genericFabricName || 'Unknown'}-${fabric.fabricFinishType || 'PLAIN'}-${embroideryPart}`;

        if (!fabricGroupsMap.has(groupKey)) {
          fabricGroupsMap.set(groupKey, {
            groupKey,
            genericFabricName: fabric.genericFabricName || 'Unknown',
            fabricFinishType: fabric.fabricFinishType,
            hasEmbroidery: fabric.hasEmbroidery || false,
            embroidery: fabric.embroidery ? {
              id: fabric.embroidery.id,
              embroideryCode: fabric.embroidery.embroideryCode,
              designName: fabric.embroidery.designName,
              costPerMeter: fabric.embroidery.costPerMeter ? Number(fabric.embroidery.costPerMeter) : null,
            } : null,
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
          genericFabricName: fabric.genericFabricName,
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
          genericFabricName: {
            equals: group.genericFabricName,
            mode: 'insensitive',
          },
          isActive: true,
        },
        orderBy: { greigeName: 'asc' },
      });

      // Check if there are ready-purchase fabrics (fabric_master with no greige)
      // These are fabrics purchased directly without going through greige conversion
      // Look up fabric_master by genericFabricName where greigeId is NULL
      let readyPurchaseFabrics: any[] = [];
      if (availableGreiges.length === 0 && group.genericFabricName) {
        readyPurchaseFabrics = await prisma.fabric_master.findMany({
          where: {
            genericFabricName: {
              equals: group.genericFabricName,
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
      if (availableGreiges.length === 0 && group.genericFabricName && !isReadyPurchaseFabric) {
        missingGreigeNames.push(group.genericFabricName);
        logInfo(`No greige found for genericFabricName: "${group.genericFabricName}"`);
      }

      // Get CAD options if greige is selected OR if this is a ready-purchase fabric
      let cadOptions: any[] = [];

      if (group.selectedGreigeId) {
        // Greige-based fabric: Find fabric_master for this greige
        const fabricMaster = await prisma.fabric_master.findFirst({
          where: {
            greigeId: group.selectedGreigeId,
            genericFabricName: group.genericFabricName,
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
          cadOptions = fabricMaster.widthCADs.map(cad => ({
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
            sizeBreakdowns: cad.sizeBreakdowns?.map((sb: { id: string; sizeName: string; sizeId: string | null; quantity: number }) => ({
              id: sb.id,
              sizeName: sb.sizeName,
              sizeId: sb.sizeId,
              quantity: sb.quantity,
            })) || [],
          }));
        }
      } else if (isReadyPurchaseFabric) {
        // Ready-purchase fabric: Get CAD options from fabric_master found by genericFabricName lookup
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
                cadWastagePercent: 5,
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
                sizeBreakdowns: cad.sizeBreakdowns?.map((sb: { id: string; sizeName: string; sizeId: string | null; quantity: number }) => ({
                  id: sb.id,
                  sizeName: sb.sizeName,
                  sizeId: sb.sizeId,
                  quantity: sb.quantity,
                })) || [],
              });
            }
          }
        }
      }

      // Get selected greige details
      const selectedGreige = group.selectedGreigeId
        ? availableGreiges.find(g => g.id === group.selectedGreigeId)
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
        genericFabricName: group.genericFabricName,
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
        availableGreiges: availableGreiges.map(g => ({
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
          cutableWidths: CUTABLE_WIDTH_OFFSETS.map(offset => Number(g.greigeWidth) + offset),
        })),
        selectedGreigeId: group.selectedGreigeId,
        selectedGreige: selectedGreige ? {
          id: selectedGreige.id,
          greigeCode: selectedGreige.greigeCode,
          greigeName: selectedGreige.greigeName,
          greigeWidth: Number(selectedGreige.greigeWidth),
          defaultCutableWidth: selectedGreige.defaultCutableWidth ? Number(selectedGreige.defaultCutableWidth) : null,
          expectedFinishedWidthMin: selectedGreige.expectedFinishedWidthMin ? Number(selectedGreige.expectedFinishedWidthMin) : null,
          expectedFinishedWidthMax: selectedGreige.expectedFinishedWidthMax ? Number(selectedGreige.expectedFinishedWidthMax) : null,
          greigePricePerMeter: selectedGreige.costPerMeter ? Number(selectedGreige.costPerMeter) : null,
        } : null,
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
  } catch (error: unknown) {
    logError('Error fetching enhanced CAD planning data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch CAD planning data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Select greige for a fabric group and update style_fabrics
 * POST /api/styles/:styleId/cad-planning/select-greige
 * Body: { groupKey, greigeId, averagingMode }
 */
export async function selectGreigeForGroup(req: Request, res: Response) {
  try {
    const { styleId } = req.params;
    const { groupKey, greigeId, averagingMode = 'COMBINED' } = req.body;

    // Parse groupKey which now includes embroidery state
    // Format: "Poplin-DYED-NO_EMB" or "Poplin-DYED-EMB-12345678"
    const parts = groupKey.split('-');
    const genericFabricName = parts[0];
    const fabricFinishType = parts[1];
    const hasEmbroidery = parts.length > 2 && parts[2] === 'EMB';
    const embroideryIdPrefix = hasEmbroidery && parts.length > 3 ? parts[3] : null;

    // Build where clause for style_fabrics based on embroidery filter
    const fabricWhereClause: any = {
      genericFabricName,
      fabricFinishType: fabricFinishType === 'PLAIN' ? null : fabricFinishType,
    };

    if (hasEmbroidery) {
      fabricWhereClause.hasEmbroidery = true;
      if (embroideryIdPrefix) {
        fabricWhereClause.embroideryId = { startsWith: embroideryIdPrefix };
      }
    } else {
      // Match fabrics without embroidery (hasEmbroidery = false or not set)
      fabricWhereClause.OR = [
        { hasEmbroidery: false },
        { hasEmbroidery: { equals: false } },
      ];
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
      return res.status(404).json({
        success: false,
        message: 'Style not found',
      });
    }

    // Verify greige exists
    const greige = await prisma.greige_master.findUnique({
      where: { id: greigeId },
    });

    if (!greige) {
      return res.status(404).json({
        success: false,
        message: 'Greige not found',
      });
    }

    // Update all matching style_fabrics
    const fabricIds = style.style_components.flatMap(comp =>
      comp.style_fabrics.map(f => f.id)
    );

    await prisma.style_fabrics.updateMany({
      where: { id: { in: fabricIds } },
      data: {
        selectedGreigeId: greigeId,
        averagingMode,
      },
    });

    // Generate CAD options for this selection
    const componentNames = style.style_components
      .filter(comp => comp.style_fabrics.length > 0)
      .map(comp => comp.componentName);

    // Call generateCADOptions internally
    const req2 = {
      body: {
        styleId,
        genericFabricName,
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
        genericFabricName,
      },
    });

    if (!fabric) {
      fabric = await prisma.fabric_master.create({
        data: {
          fabricCode: `${greige.greigeCode}-${Date.now()}`,
          fabricName: `${genericFabricName} - ${greige.greigeName}`,
          genericFabricName,
          greigeId,
          actualWidth: greige.greigeWidth,
          isActive: true,
          isGeneric: true,
          styleReference: styleId,
          createdById: req.user?.userId || 'system',
        },
      });
    }

    // Get greige width and suggest default cutable width
    // NOTE: Auto-width generation has been removed - users add widths manually on CAD Edit page
    const greigeWidth = Number(greige.greigeWidth);
    const suggestedCutableWidth = greige.defaultCutableWidth
      ? Number(greige.defaultCutableWidth)
      : greigeWidth - 4; // Default suggestion: 4 inches less than greige width

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
  } catch (error: unknown) {
    logError('Error selecting greige for group:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to select greige',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Add a new CAD width entry for a fabric group
 * POST /api/styles/:styleId/cad-planning/add-width
 * Body: { groupKey, fabricId?, cutableWidth, greigeId?, componentName? }
 *
 * Allows users to add custom width CAD entries that may not be pre-defined
 */
export async function addCADWidth(req: Request, res: Response) {
  try {
    const { styleId } = req.params;
    const { groupKey, fabricId, cutableWidth, greigeId, componentName } = req.body;

    if (!cutableWidth) {
      return res.status(400).json({
        success: false,
        message: 'cutableWidth is required',
      });
    }

    // Parse groupKey to get genericFabricName
    const parts = groupKey.split('-');
    const genericFabricName = parts[0];

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

        const validation = validateCutableWidth(
          Number(cutableWidth),
          greige,
          !!hasEmbroideryParts
        );

        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: validation.message,
            validationError: 'CUTABLE_WIDTH_OUT_OF_RANGE',
            greige: {
              greigeWidth: Number(greige.greigeWidth),
              expectedFinishedWidthMin: greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : null,
              expectedFinishedWidthMax: greige.expectedFinishedWidthMax ? Number(greige.expectedFinishedWidthMax) : null,
            },
          });
        }
      }
    }

    let targetFabricId = fabricId;

    // If no fabricId provided, find or create fabric_master
    if (!targetFabricId) {
      let fabric = await prisma.fabric_master.findFirst({
        where: greigeId ? {
          greigeId,
          genericFabricName,
        } : {
          genericFabricName,
          styleReference: styleId,
        },
      });

      if (!fabric) {
        // Create fabric_master for this width
        const greige = greigeId ? await prisma.greige_master.findUnique({
          where: { id: greigeId },
        }) : null;

        fabric = await prisma.fabric_master.create({
          data: {
            fabricCode: greigeId && greige
              ? `${greige.greigeCode}-CAD-${Date.now()}`
              : `CAD-${styleId.slice(0, 8)}-${Date.now()}`,
            fabricName: greigeId && greige
              ? `${genericFabricName} - ${greige.greigeName}`
              : `${genericFabricName} (CAD Planning)`,
            genericFabricName,
            greigeId: greigeId || null,
            actualWidth: greige?.greigeWidth || cutableWidth + 4, // Estimate
            isActive: true,
            isGeneric: true,
            styleReference: styleId,
            createdById: req.user?.userId || 'system',
          },
        });
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
      return res.status(400).json({
        success: false,
        message: `CAD entry for width ${cutableWidth}" already exists`,
        cadId: existing.id,
      });
    }

    // Create new CAD entry with printDirection from request body or default
    const { printDirection } = req.body;
    const newCad = await prisma.fabric_width_cad.create({
      data: {
        fabricId: targetFabricId,
        cutableWidth,
        widthUnit: 'inches',
        cadWastagePercent: 5,
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
  } catch (error: unknown) {
    logError('Error adding CAD width:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add CAD width',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete a CAD width entry
 * DELETE /api/styles/cad-planning/cad/:cadId
 */
export async function deleteCADWidth(req: Request, res: Response) {
  try {
    const { cadId } = req.params;

    // Check if CAD exists
    const cad = await prisma.fabric_width_cad.findUnique({
      where: { id: cadId },
      include: {
        styleFabrics: true,
      },
    });

    if (!cad) {
      return res.status(404).json({
        success: false,
        message: 'CAD record not found',
      });
    }

    // Don't delete if it's referenced by style_fabrics
    if (cad.styleFabrics.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete CAD that is assigned to style fabrics. Remove the assignment first.',
      });
    }

    // Delete the CAD (size breakdowns will cascade delete)
    await prisma.fabric_width_cad.delete({
      where: { id: cadId },
    });

    return res.json({
      success: true,
      message: 'CAD width deleted successfully',
    });
  } catch (error: unknown) {
    logError('Error deleting CAD width:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete CAD width',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get CAD group details for the CAD Edit page
 * GET /api/styles/:styleId/cad-planning/:groupKey/details
 *
 * Returns:
 * - Group info (genericFabricName, finishType, etc.)
 * - All CAD width options with size breakdowns
 * - Style variants (sizes) for pre-populating size breakdown
 * - Greige/fabric details
 */
export async function getCADGroupDetails(req: Request, res: Response) {
  try {
    const { styleId, groupKey } = req.params;

    // Parse groupKey
    const parts = groupKey.split('-');
    const genericFabricName = parts[0];
    const fabricFinishType = parts[1] === 'PLAIN' ? null : parts[1] as FabricFinishType;
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
                genericFabricName,
                fabricFinishType: fabricFinishType || null,
                ...(hasEmbroidery ? { hasEmbroidery: true } : {
                  OR: [
                    { hasEmbroidery: false },
                    { hasEmbroidery: { equals: false } },
                  ],
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
      return res.status(404).json({
        success: false,
        message: 'Style not found',
      });
    }

    // Get selected greige ID from style_fabrics
    const firstFabric = style.style_components
      .flatMap((c: typeof style.style_components[0]) => c.style_fabrics)
      .find((f: typeof style.style_components[0]['style_fabrics'][0]) => f.selectedGreigeId);

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
          genericFabricName,
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
          genericFabricName: {
            equals: genericFabricName,
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
      cadOptions = fabricMaster.widthCADs.map(cad => ({
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
        sizeBreakdowns: cad.sizeBreakdowns.map(sb => ({
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
    type StyleVariant = typeof style.style_variants[0];
    type SizeOption = { sizeId: string | null; sizeName: string; sortOrder: number };
    const sizeOptions = style.style_variants
      .filter((v: StyleVariant) => v.sizeName)
      .map((v: StyleVariant): SizeOption => ({
        sizeId: v.sizeId,
        sizeName: v.sizeName!,
        sortOrder: v.sortOrder,
      }))
      .filter((size: SizeOption, index: number, self: SizeOption[]) =>
        index === self.findIndex((s: SizeOption) => s.sizeName === size.sizeName)
      )
      .sort((a: SizeOption, b: SizeOption) => a.sortOrder - b.sortOrder);

    // Get embroidery details if applicable
    const embroidery = firstFabric?.embroidery ? {
      id: firstFabric.embroidery.id,
      embroideryCode: firstFabric.embroidery.embroideryCode,
      designName: firstFabric.embroidery.designName,
    } : null;

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
          genericFabricName,
          fabricFinishType: fabricFinishType || 'PLAIN',
          hasEmbroidery,
          embroidery,
          averagingMode,
        },
        greige: greigeDetails,
        fabric: fabricMaster ? {
          id: fabricMaster.id,
          fabricCode: fabricMaster.fabricCode,
          fabricName: fabricMaster.fabricName,
          actualWidth: fabricMaster.actualWidth ? Number(fabricMaster.actualWidth) : null,
        } : null,
        cadOptions,
        sizeOptions,
        // Suggest width based on greige or fabric
        suggestedWidth: greigeDetails
          ? (greigeDetails.defaultCutableWidth || greigeDetails.greigeWidth - 4)
          : (fabricMaster?.actualWidth ? Number(fabricMaster.actualWidth) - 2 : 54),
      },
    });
  } catch (error: unknown) {
    logError('Error fetching CAD group details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch CAD group details',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
  try {
    const { cadId } = req.params;
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
      return res.status(404).json({
        success: false,
        message: 'CAD record not found',
      });
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
        sizeBreakdowns: finalCad!.sizeBreakdowns.map(sb => ({
          id: sb.id,
          sizeName: sb.sizeName,
          sizeId: sb.sizeId,
          quantity: sb.quantity,
        })),
      },
    });
  } catch (error: unknown) {
    logError('Error updating CAD values:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update CAD values',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Set preferred CAD width for a fabric
 * PUT /api/styles/cad-planning/cad/:cadId/set-preferred
 */
export async function setPreferredCAD(req: Request, res: Response) {
  try {
    const { cadId } = req.params;

    // Get the CAD record
    const cad = await prisma.fabric_width_cad.findUnique({
      where: { id: cadId },
    });

    if (!cad) {
      return res.status(404).json({
        success: false,
        message: 'CAD record not found',
      });
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
  } catch (error: unknown) {
    logError('Error setting preferred CAD:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to set preferred CAD',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
  try {
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
      return res.status(404).json({
        success: false,
        message: 'Style not found',
      });
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
                  orderBy: [
                    { isPreferred: 'desc' },
                    { cutableWidth: 'desc' },
                  ],
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
          },
        },
      },
    });

    // Group CADs by fabric group (genericFabricName + finishType)
    const cadGroups: Record<string, {
      groupKey: string;
      genericFabricName: string;
      fabricFinishType: string;
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
    }> = {};

    for (const component of styleComponents) {
      for (const sf of component.style_fabrics) {
        const groupKey = `${sf.genericFabricName || 'Unknown'}-${sf.fabricFinishType || 'PLAIN'}${sf.hasEmbroidery ? '-EMB' : ''}`;

        if (!cadGroups[groupKey]) {
          cadGroups[groupKey] = {
            groupKey,
            genericFabricName: sf.genericFabricName || 'Unknown',
            fabricFinishType: sf.fabricFinishType || 'PLAIN',
            hasEmbroidery: sf.hasEmbroidery || false,
            embroidery: sf.embroidery ? {
              id: sf.embroidery.id,
              embroideryCode: sf.embroidery.embroideryCode,
              designName: sf.embroidery.designName,
            } : null,
            greige: sf.selectedGreige ? {
              id: sf.selectedGreige.id,
              greigeCode: sf.selectedGreige.greigeCode,
              greigeName: sf.selectedGreige.greigeName,
              greigeWidth: Number(sf.selectedGreige.greigeWidth),
            } : null,
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
            const existingIndex = cadGroups[groupKey].cadOptions.findIndex(c => c.id === cad.id);
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
    const groupsWithSelectedCAD = Object.values(cadGroups).filter(g => g.selectedCADId).length;
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
  } catch (error: unknown) {
    logError('Error fetching CAD history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch CAD history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// PATTERN PARTS API ENDPOINTS
// ============================================================================

/**
 * Get pattern parts assigned to a style fabric
 * GET /api/styles/:styleId/fabrics/:fabricId/pattern-parts
 */
export async function getStyleFabricPatternParts(req: Request, res: Response) {
  try {
    const { styleId, fabricId } = req.params;

    // Verify style and fabric exist
    const styleFabric = await prisma.style_fabrics.findFirst({
      where: {
        id: fabricId,
        style_components: {
          styleId: styleId,
        },
      },
      include: {
        style_components: true,
        stylePatternParts: {
          include: {
            patternPart: true,
          },
        },
      },
    });

    if (!styleFabric) {
      return res.status(404).json({
        success: false,
        message: 'Style fabric not found',
      });
    }

    // Get component pattern parts from component_master
    // Look up by componentType (which should match component_masters.name)
    const componentMaster = await prisma.component_masters.findFirst({
      where: {
        OR: [
          { name: styleFabric.style_components.componentType },
          { name: styleFabric.style_components.componentName },
        ],
        isActive: true,
      },
      include: {
        patternParts: {
          include: {
            patternPart: true,
          },
        },
      },
    });

    // Get available pattern parts from component master (for selection)
    const availableFromComponent = componentMaster?.patternParts.map((cpp: { patternPartId: string; quantity: number; patternPart: { name: string; code: string } }) => ({
      id: cpp.patternPartId,
      partName: cpp.patternPart.name,
      partCode: cpp.patternPart.code,
      quantity: cpp.quantity,
      isFromComponent: true,
    })) || [];

    // Get currently assigned pattern parts
    const assignedParts = styleFabric.stylePatternParts.map((spp) => ({
      id: spp.id,
      patternPartId: spp.patternPartId,
      partName: spp.patternPart.name,
      partCode: spp.patternPart.code,
      quantity: spp.quantity,
      goesToEmbroidery: spp.goesToEmbroidery,
      notes: spp.notes,
    }));

    return res.json({
      success: true,
      data: {
        styleFabricId: fabricId,
        componentId: styleFabric.componentId,
        componentName: styleFabric.style_components.componentName,
        componentType: styleFabric.style_components.componentType,
        availableFromComponent,
        assignedParts,
        hasEmbroideryParts: assignedParts.some((p) => p.goesToEmbroidery),
      },
    });
  } catch (error: unknown) {
    logError('Error fetching style fabric pattern parts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pattern parts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Assign pattern parts to a style fabric
 * POST /api/styles/:styleId/fabrics/:fabricId/pattern-parts
 * Body: { patternParts: [{ patternPartId, quantity?, goesToEmbroidery?, notes? }] }
 */
export async function assignPatternParts(req: Request, res: Response) {
  try {
    const { styleId, fabricId } = req.params;
    const { patternParts } = req.body;

    if (!patternParts || !Array.isArray(patternParts)) {
      return res.status(400).json({
        success: false,
        message: 'patternParts array is required',
      });
    }

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
      return res.status(404).json({
        success: false,
        message: 'Style fabric not found',
      });
    }

    // Delete existing assignments and create new ones
    await prisma.style_pattern_parts.deleteMany({
      where: { styleFabricId: fabricId },
    });

    // Create new assignments
    const createdParts = await prisma.style_pattern_parts.createMany({
      data: patternParts.map((part: {
        patternPartId: string;
        quantity?: number;
        goesToEmbroidery?: boolean;
        notes?: string;
      }) => ({
        styleFabricId: fabricId,
        patternPartId: part.patternPartId,
        quantity: part.quantity || 1,
        goesToEmbroidery: part.goesToEmbroidery || false,
        notes: part.notes || null,
      })),
    });

    // Fetch created parts with relations
    const assignedParts = await prisma.style_pattern_parts.findMany({
      where: { styleFabricId: fabricId },
      include: {
        patternPart: true,
      },
    });

    return res.json({
      success: true,
      message: `${createdParts.count} pattern parts assigned successfully`,
      data: {
        styleFabricId: fabricId,
        assignedParts: assignedParts.map((spp) => ({
          id: spp.id,
          patternPartId: spp.patternPartId,
          partName: spp.patternPart.name,
          partCode: spp.patternPart.code,
          quantity: spp.quantity,
          goesToEmbroidery: spp.goesToEmbroidery,
          notes: spp.notes,
        })),
        hasEmbroideryParts: assignedParts.some((p) => p.goesToEmbroidery),
      },
    });
  } catch (error: unknown) {
    logError('Error assigning pattern parts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign pattern parts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update a pattern part assignment (e.g., toggle embroidery flag)
 * PUT /api/styles/:styleId/pattern-parts/:partId
 * Body: { quantity?, goesToEmbroidery?, notes? }
 */
export async function updatePatternPartAssignment(req: Request, res: Response) {
  try {
    const { styleId, partId } = req.params;
    const { quantity, goesToEmbroidery, notes } = req.body;

    // Verify assignment exists and belongs to this style
    const existing = await prisma.style_pattern_parts.findFirst({
      where: {
        id: partId,
        styleFabric: {
          style_components: {
            styleId: styleId,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Pattern part assignment not found',
      });
    }

    // Build update data
    const updateData: Prisma.style_pattern_partsUpdateInput = {};
    if (quantity !== undefined) updateData.quantity = quantity;
    if (goesToEmbroidery !== undefined) updateData.goesToEmbroidery = goesToEmbroidery;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.style_pattern_parts.update({
      where: { id: partId },
      data: updateData,
      include: {
        patternPart: true,
      },
    });

    return res.json({
      success: true,
      message: 'Pattern part assignment updated successfully',
      data: {
        id: updated.id,
        patternPartId: updated.patternPartId,
        partName: updated.patternPart.name,
        partCode: updated.patternPart.code,
        quantity: updated.quantity,
        goesToEmbroidery: updated.goesToEmbroidery,
        notes: updated.notes,
      },
    });
  } catch (error: unknown) {
    logError('Error updating pattern part assignment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update pattern part assignment',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete a pattern part assignment
 * DELETE /api/styles/:styleId/pattern-parts/:partId
 */
export async function deletePatternPartAssignment(req: Request, res: Response) {
  try {
    const { styleId, partId } = req.params;

    // Verify assignment exists and belongs to this style
    const existing = await prisma.style_pattern_parts.findFirst({
      where: {
        id: partId,
        styleFabric: {
          style_components: {
            styleId: styleId,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Pattern part assignment not found',
      });
    }

    await prisma.style_pattern_parts.delete({
      where: { id: partId },
    });

    return res.json({
      success: true,
      message: 'Pattern part assignment deleted successfully',
    });
  } catch (error: unknown) {
    logError('Error deleting pattern part assignment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete pattern part assignment',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Bulk assign pattern parts from component definition
 * POST /api/styles/:styleId/fabrics/:fabricId/pattern-parts/from-component
 * Copies pattern parts from component_pattern_parts to style_pattern_parts
 */
export async function assignPatternPartsFromComponent(req: Request, res: Response) {
  try {
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
        style_components: true,
      },
    });

    if (!styleFabric) {
      return res.status(404).json({
        success: false,
        message: 'Style fabric not found',
      });
    }

    // Get component pattern parts from component_master
    const componentMaster = await prisma.component_masters.findFirst({
      where: {
        OR: [
          { name: styleFabric.style_components.componentType },
          { name: styleFabric.style_components.componentName },
        ],
        isActive: true,
      },
      include: {
        patternParts: {
          include: {
            patternPart: true,
          },
        },
        componentGroup: true,
      },
    });

    // Define a common structure for pattern parts from either source
    type PatternPartItem = {
      patternPartId: string;
      quantity: number;
      patternPart: {
        id: string;
        name: string;
        code: string;
      };
    };

    let componentParts: PatternPartItem[] = (componentMaster?.patternParts || []).map(pp => ({
      patternPartId: pp.patternPartId,
      quantity: pp.quantity,
      patternPart: {
        id: pp.patternPart.id,
        name: pp.patternPart.name,
        code: pp.patternPart.code,
      },
    }));

    // If no direct pattern parts, try to get pattern parts via component group
    if (componentParts.length === 0 && componentMaster?.componentGroup) {
      const groupPatternParts = await prisma.pattern_part_groups.findMany({
        where: {
          componentGroupId: componentMaster.componentGroup.id,
        },
        include: {
          patternPart: true,
        },
      });

      // Map to same structure
      componentParts = groupPatternParts.map(gpp => ({
        patternPartId: gpp.patternPartId,
        quantity: 1, // Default quantity when loading from group
        patternPart: {
          id: gpp.patternPart.id,
          name: gpp.patternPart.name,
          code: gpp.patternPart.code,
        },
      }));
    }

    if (componentParts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No pattern parts defined for this component (checked both component_pattern_parts and pattern_part_groups)',
      });
    }

    // Delete existing assignments
    await prisma.style_pattern_parts.deleteMany({
      where: { styleFabricId: fabricId },
    });

    // Create assignments from component definition
    await prisma.style_pattern_parts.createMany({
      data: componentParts.map((cpp: { patternPartId: string; quantity: number }) => ({
        styleFabricId: fabricId,
        patternPartId: cpp.patternPartId,
        quantity: cpp.quantity,
        goesToEmbroidery: false, // Default to false - user marks which go to embroidery
        notes: null,
      })),
    });

    // Fetch created parts
    const assignedParts = await prisma.style_pattern_parts.findMany({
      where: { styleFabricId: fabricId },
      include: {
        patternPart: true,
      },
    });

    return res.json({
      success: true,
      message: `${assignedParts.length} pattern parts copied from component`,
      data: {
        styleFabricId: fabricId,
        assignedParts: assignedParts.map((spp) => ({
          id: spp.id,
          patternPartId: spp.patternPartId,
          partName: spp.patternPart.name,
          partCode: spp.patternPart.code,
          quantity: spp.quantity,
          goesToEmbroidery: spp.goesToEmbroidery,
          notes: spp.notes,
        })),
        hasEmbroideryParts: false,
      },
    });
  } catch (error: unknown) {
    logError('Error copying pattern parts from component:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to copy pattern parts from component',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// EMBROIDERY CAD API ENDPOINTS
// ============================================================================

/**
 * Get embroidery CAD for a style fabric
 * GET /api/styles/:styleId/fabrics/:fabricId/embroidery-cad
 */
export async function getEmbroideryCad(req: Request, res: Response) {
  try {
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
      return res.status(404).json({
        success: false,
        message: 'Style fabric not found',
      });
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
        embroideryCad: embroideryCad ? {
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
          selectedWidth: embroideryCad.fabricWidthCad ? {
            id: embroideryCad.fabricWidthCad.id,
            cutableWidth: Number(embroideryCad.fabricWidthCad.cutableWidth),
          } : null,
          embroideryDesign: embroideryCad.embroidery ? {
            id: embroideryCad.embroidery.id,
            designName: embroideryCad.embroidery.designName,
            costPerMeter: embroideryCad.embroidery.costPerMeter ? Number(embroideryCad.embroidery.costPerMeter) : null,
          } : null,
        } : null,
      },
    });
  } catch (error: unknown) {
    logError('Error fetching embroidery CAD:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch embroidery CAD',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create or update embroidery CAD for a style fabric
 * POST /api/styles/:styleId/fabrics/:fabricId/embroidery-cad
 * Body: { fabricWidthCadId?, embroideryId?, cadMeters?, cadYards?, cadWastagePercent?,
 *         layerMarginMeters?, piecesPerMarker?, markerEfficiency?, printDirection?, notes?,
 *         sizeBreakdowns?: [{ sizeName, sizeId?, quantity }] }
 */
export async function createOrUpdateEmbroideryCad(req: Request, res: Response) {
  try {
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
      return res.status(404).json({
        success: false,
        message: 'Style fabric not found',
      });
    }

    if (styleFabric.stylePatternParts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No embroidery parts marked for this fabric. Mark pattern parts as "goes to embroidery" first.',
      });
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
      cadWastagePercent: cadWastagePercent !== undefined ? cadWastagePercent : 5,
      layerMarginMeters: layerMarginMeters !== undefined ? layerMarginMeters : (cadMeters ? getDefaultLayerMargin(cadMeters) : null),
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
  } catch (error: unknown) {
    logError('Error creating/updating embroidery CAD:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save embroidery CAD',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete embroidery CAD for a style fabric
 * DELETE /api/styles/:styleId/fabrics/:fabricId/embroidery-cad
 */
export async function deleteEmbroideryCad(req: Request, res: Response) {
  try {
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
      return res.status(404).json({
        success: false,
        message: 'Style fabric not found',
      });
    }

    // Check if embroidery CAD exists
    const embroideryCad = await prisma.embroidery_part_cad.findUnique({
      where: { styleFabricId: fabricId },
    });

    if (!embroideryCad) {
      return res.status(404).json({
        success: false,
        message: 'Embroidery CAD not found',
      });
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
  } catch (error: unknown) {
    logError('Error deleting embroidery CAD:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete embroidery CAD',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get total CAD for a style fabric (Main CAD + Embroidery CAD)
 * GET /api/styles/:styleId/fabrics/:fabricId/total-cad
 */
export async function getTotalFabricCad(req: Request, res: Response) {
  try {
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
      return res.status(404).json({
        success: false,
        message: 'Style fabric not found',
      });
    }

    // Get main CAD (selected fabric_width_cad)
    const mainCad = styleFabric.fabricCAD;

    // Get embroidery CAD if exists
    const embroideryCad = styleFabric.stylePatternParts.length > 0
      ? await prisma.embroidery_part_cad.findUnique({
          where: { styleFabricId: fabricId },
        })
      : null;

    // Calculate totals
    const mainCadMeters = mainCad?.cadMeters ? Number(mainCad.cadMeters) : 0;
    const mainWastage = mainCad?.cadWastagePercent ? Number(mainCad.cadWastagePercent) : 5;
    const mainEffective = mainCadMeters * (1 + mainWastage / 100);

    const embroideryCadMeters = embroideryCad?.cadMeters ? Number(embroideryCad.cadMeters) : 0;
    const embroideryWastage = embroideryCad?.cadWastagePercent ? Number(embroideryCad.cadWastagePercent) : 5;
    const embroideryEffective = embroideryCadMeters * (1 + embroideryWastage / 100);

    const totalCadMeters = mainCadMeters + embroideryCadMeters;
    const totalEffectiveMeters = mainEffective + embroideryEffective;

    return res.json({
      success: true,
      data: {
        styleFabricId: fabricId,
        mainCad: mainCad ? {
          cadId: mainCad.id,
          cadMeters: mainCadMeters,
          wastagePercent: mainWastage,
          effectiveMeters: mainEffective,
          cutableWidth: Number(mainCad.cutableWidth),
          printDirection: mainCad.printDirection,
        } : null,
        embroideryCad: embroideryCad ? {
          cadId: embroideryCad.id,
          cadMeters: embroideryCadMeters,
          wastagePercent: embroideryWastage,
          effectiveMeters: embroideryEffective,
          printDirection: embroideryCad.printDirection,
        } : null,
        totals: {
          totalCadMeters,
          totalEffectiveMeters,
          hasEmbroideryCad: !!embroideryCad,
        },
      },
    });
  } catch (error: unknown) {
    logError('Error fetching total fabric CAD:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch total fabric CAD',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
  try {
    const { styleId } = req.params;

    // Get style with all related data
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: true,
                embroidery: true,
                fabricCAD: {
                  include: {
                    sizeBreakdowns: true,
                    greige: true,
                    patternPart: true,
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
    });

    if (!style) {
      return res.status(404).json({
        success: false,
        message: 'Style not found',
      });
    }

    // Get available greiges for the style's fabrics
    const genericFabricNames = new Set<string>();
    style.style_components.forEach((comp: any) => {
      comp.style_fabrics.forEach((fabric: any) => {
        if (fabric.genericFabricName) {
          genericFabricNames.add(fabric.genericFabricName);
        }
      });
    });

    const availableGreiges = await prisma.greige_master.findMany({
      where: {
        genericFabricName: { in: Array.from(genericFabricNames) },
        isActive: true,
      },
      include: {
        defaultSupplier: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ genericFabricName: 'asc' }, { greigeName: 'asc' }],
    });

    // Query fabric stock for this style (for stock width integration)
    const fabricStock = await prisma.fabric_stock.findMany({
      where: {
        OR: [
          { originStyleId: styleId },
          { procurement: { orderedForStyleId: styleId } }
        ],
        status: 'AVAILABLE',
        quantityAvailable: { gt: 0 }
      },
      include: {
        fabricMaster: {
          include: { greige: true }
        },
        procurement: true
      },
      orderBy: { receivedDate: 'asc' }
    });

    // Build stock widths map by fabricId for CAD row matching
    const stockByFabricId = new Map<string, Array<{
      width: number;
      quantity: number;
      stockId: string;
      qualityGrade: string;
    }>>();

    fabricStock.forEach(stock => {
      const fabricId = stock.fabricId;
      if (!stockByFabricId.has(fabricId)) {
        stockByFabricId.set(fabricId, []);
      }
      stockByFabricId.get(fabricId)!.push({
        width: Number(stock.cutableWidth),
        quantity: Number(stock.quantityAvailable),
        stockId: stock.id,
        qualityGrade: stock.qualityGrade || 'A'
      });
    });

    // Query PRODUCTION CAD entries for these stock lots
    const stockIds = fabricStock.map(s => s.id);
    const productionCads = await prisma.fabric_width_cad.findMany({
      where: {
        styleFabric: {
          style_components: {
            styleId,
          },
        },
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
    productionCads.forEach(cad => {
      if (cad.fabricStockId) {
        productionCadByStock.set(cad.fabricStockId, {
          id: cad.id,
          approvalStatus: cad.approvalStatus,
        });
      }
    });

    // Build stock summary for banner display with PRODUCTION CAD info
    const stockSummary = fabricStock.map(stock => {
      const productionCad = productionCadByStock.get(stock.id);
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
        hasProductionCad: !!productionCad,
        productionCadId: productionCad?.id || null,
        productionCadStatus: productionCad?.approvalStatus || null,
      };
    });

    // Get component pattern parts (from component master definitions)
    // First, find component masters that match the componentNames from style_components
    const componentNames = style.style_components.map((c: any) => c.componentName);
    const componentMasters = await prisma.component_masters.findMany({
      where: {
        name: { in: componentNames },
      },
      select: { id: true, name: true },
    });

    // Create a map of componentName -> componentMasterId for quick lookup
    const componentNameToIdMap = new Map(componentMasters.map(cm => [cm.name, cm.id]));

    // Now get pattern parts using the component master IDs
    const componentMasterIds = componentMasters.map(cm => cm.id);
    const componentPatternParts = await prisma.component_pattern_parts.findMany({
      where: {
        componentId: { in: componentMasterIds },
      },
      include: {
        patternPart: true,
        component: { select: { id: true, name: true } },
      },
    });

    // Build CAD rows from existing data
    const cadRows: Array<{
      id: string;
      purpose: string | null;
      componentId: string;
      componentName: string;
      styleFabricId: string;
      partId: string | null;
      partCode: string | null;
      partName: string | null;
      fabricFinishType: string | null;
      isEmbroidery: boolean;
      genericGreigeName: string | null;
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
            const maxWidth = greige.expectedFinishedWidthMax ? Number(greige.expectedFinishedWidthMax) : Number(greige.greigeWidth) || 60;
            // Generate widths in 2-inch increments
            for (let w = minWidth; w <= maxWidth; w += 2) {
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
          const layerMargin = cad.layerMarginMeters ? Number(cad.layerMarginMeters) : (layerLength ? getDefaultLayerMargin(layerLength) : 0);
          // CAD Average = (layerLength + layerMargin) / piecesPerMarker
          const cadAverage = layerLength && totalPieces > 0 ? (layerLength + layerMargin) / totalPieces : null;

          // Handle "All Parts" case - check pattern part code or legacy marker in componentName
          const isAllParts = cad.patternPart?.code === ALL_PARTS_CODE ||
                            cad.componentName === ALL_PARTS_LEGACY_MARKER;

          // Get stock widths for this fabric (if any stock exists)
          const fabricId = styleFabric.fabric?.id || styleFabric.fabricId;
          const stockEntries = fabricId ? stockByFabricId.get(fabricId) || [] : [];
          const stockWidths = [...new Set(stockEntries.map(s => s.width))];

          // Parse combinedFabricIds if present (JSON array of styleFabricIds)
          let combinedFabricIds: string[] | null = null;
          if (cad.combinedFabricIds) {
            try {
              combinedFabricIds = JSON.parse(cad.combinedFabricIds);
            } catch {
              combinedFabricIds = null;
            }
          }

          cadRows.push({
            id: cad.id,
            purpose: cad.purpose,
            componentId: component.id,
            componentName: cad.isCombinedCutting && cad.combinedComponents
              ? cad.combinedComponents  // Use combined components string
              : component.componentName,
            styleFabricId: styleFabric.id,
            partId: cad.patternPartId,
            partCode: cad.patternPart?.code || (isAllParts ? ALL_PARTS_CODE : null),
            partName: cad.patternPart?.name || (isAllParts ? 'All Parts' : null),
            fabricFinishType: styleFabric.fabricFinishType,
            isEmbroidery: cad.isEmbroidery,
            genericGreigeName: styleFabric.genericFabricName,
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

    // Build components list for dropdown
    const components = style.style_components.map((comp: any) => {
      // Get the component master ID for this style component
      const componentMasterId = componentNameToIdMap.get(comp.componentName);

      return {
        id: comp.id,
        name: comp.componentName,
        type: comp.componentType,
        patternParts: componentMasterId
          ? componentPatternParts
              .filter((cpp: any) => cpp.componentId === componentMasterId)
              .map((cpp: any) => ({
                id: cpp.patternPart.id,
                name: cpp.patternPart.name,
                code: cpp.patternPart.code,
                goesToEmbroidery: false, // component_pattern_parts doesn't have this field
              }))
          : [],
        // Also include style pattern parts that have been assigned
        stylePatternParts: comp.style_fabrics.flatMap((sf: any) =>
          sf.stylePatternParts.map((spp: any) => ({
            id: spp.patternPart.id,
            name: spp.patternPart.name,
            code: spp.patternPart.code,
            goesToEmbroidery: spp.goesToEmbroidery,
          }))
        ),
        // Include style fabrics for add row functionality
        styleFabrics: comp.style_fabrics.map((sf: any) => ({
          id: sf.id,
          fabricFinishType: sf.fabricFinishType,
          genericFabricName: sf.genericFabricName,
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
        availableGreiges: availableGreiges.map(g => ({
          id: g.id,
          greigeName: g.greigeName,
          genericFabricName: g.genericFabricName,
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
  } catch (error: unknown) {
    logError('Error fetching CAD table data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch CAD table data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Add a new CAD row to the spreadsheet table
 * POST /api/styles/:styleId/cad-table/row
 */
export async function addCADTableRow(req: Request, res: Response) {
  try {
    const { styleId } = req.params;
    const {
      purpose = 'PLANNING', // Default to PLANNING (no stock required)
      componentId,
      styleFabricId,
      partId,
      fabricStockId, // Required for PRODUCTION purpose only
      // Note: isEmbroidery is intentionally NOT used from request body
      // We inherit embroidery status from the linked style_fabrics record
    } = req.body;

    // ===================================================================
    // PRODUCTION PURPOSE: Require fabric stock selection
    // Business Rule: Production CAD is possible only if we have fabric in
    // stock or fabric has been GRN'd. The width should be taken from stock.
    // ===================================================================
    let stockCutableWidth: number | null = null;
    let validatedStock: any = null;

    if (purpose === 'PRODUCTION') {
      if (!fabricStockId) {
        return res.status(400).json({
          success: false,
          message: 'PRODUCTION CAD requires fabric stock. Please select available stock or use PLANNING/COSTING purpose.',
          hint: 'For planning purposes, create a PLANNING or COSTING row first. Once stock is available, create a PRODUCTION row.',
        });
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
        return res.status(404).json({
          success: false,
          message: 'Selected fabric stock not found.',
        });
      }

      if (Number(validatedStock.quantityAvailable) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Selected stock has no available quantity. Please select a different stock or wait for GRN.',
        });
      }

      if (validatedStock.status !== 'AVAILABLE') {
        return res.status(400).json({
          success: false,
          message: `Selected stock is not available (status: ${validatedStock.status}). Please select an AVAILABLE stock.`,
        });
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
      return res.status(404).json({
        success: false,
        message: 'Style not found',
      });
    }

    // Find the style fabric
    let styleFabric = null;
    for (const comp of style.style_components) {
      const found = comp.style_fabrics.find(sf => sf.id === styleFabricId);
      if (found) {
        styleFabric = found;
        break;
      }
    }

    if (!styleFabric) {
      return res.status(404).json({
        success: false,
        message: 'Style fabric not found',
      });
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
        return res.status(404).json({
          success: false,
          message: 'Pattern part not found',
        });
      }
    }

    // Create new CAD entry linked to style fabric
    // fabricId is optional - will be set when greige is selected and fabric is determined
    // For "All Parts": if using the real pattern part, store the FK; if legacy marker, store in componentName
    // IMPORTANT: Inherit embroidery status from the linked style_fabrics record, not from request body
    //
    // PRODUCTION PURPOSE: Use width and greige from stock, link fabricStockId
    const newCad = await prisma.fabric_width_cad.create({
      data: {
        styleFabricId: styleFabricId, // Link to style fabric directly
        // For PRODUCTION: use fabric from stock; otherwise use style fabric's fabric if set
        fabricId: purpose === 'PRODUCTION' && validatedStock
          ? validatedStock.fabricId
          : (styleFabric.fabricId || undefined),
        // For PRODUCTION: use width from stock; otherwise start at 0 (set when greige selected)
        cutableWidth: purpose === 'PRODUCTION' && stockCutableWidth !== null
          ? stockCutableWidth
          : 0,
        purpose,
        // If "All Parts" pattern part exists, use its ID; otherwise fall back to legacy handling
        patternPartId: allPartsPatternPart ? allPartsPatternPart.id : (isAllParts ? undefined : (partId || undefined)),
        isEmbroidery: styleFabric.hasEmbroidery || false, // Use from styleFabric, not request body
        // Only store legacy marker if using legacy flow (no real pattern part)
        componentName: (isAllParts && !allPartsPatternPart) ? ALL_PARTS_LEGACY_MARKER : (patternPart?.name || undefined),
        printDirection: 'TWO_WAY',
        createdById: (req as any).user?.id || undefined,
        // PRODUCTION: Link to stock and use greige from fabric master
        fabricStockId: purpose === 'PRODUCTION' ? fabricStockId : undefined,
        greigeId: purpose === 'PRODUCTION' && validatedStock?.fabricMaster?.greigeId
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
    }) as any;

    logInfo(`Created new CAD row ${newCad.id} for style ${styleId}${isAllParts ? ' (All Parts)' : ''}`);

    // Check if the linked pattern part is "All Parts"
    const responseIsAllParts = newCad.patternPart?.code === ALL_PARTS_CODE ||
                               newCad.componentName === ALL_PARTS_LEGACY_MARKER;

    return res.status(201).json({
      success: true,
      data: {
        id: newCad.id,
        purpose: newCad.purpose,
        partId: newCad.patternPartId,
        partCode: newCad.patternPart?.code || (responseIsAllParts ? ALL_PARTS_CODE : null),
        partName: newCad.patternPart?.name || (responseIsAllParts ? 'All Parts' : newCad.componentName),
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
        stockInfo: purpose === 'PRODUCTION' && validatedStock ? {
          id: validatedStock.id,
          rollNumbers: validatedStock.rollNumbers,
          quantityAvailable: Number(validatedStock.quantityAvailable),
          qualityGrade: validatedStock.qualityGrade,
          cutableWidth: Number(validatedStock.cutableWidth),
        } : null,
      },
      message: purpose === 'PRODUCTION'
        ? `PRODUCTION CAD row created with stock (Width: ${stockCutableWidth}")`
        : 'CAD row created successfully',
    });
  } catch (error: unknown) {
    logError('Error adding CAD table row:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add CAD row',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Add a COMBINED CAD row from multiple style fabrics that share the same base fabric
 * POST /api/styles/:styleId/cad-table/combined-row
 * Body: { styleFabricIds: string[], purpose?: string }
 *
 * Validation rules for combining:
 * - All fabrics must have same genericFabricName
 * - All fabrics must have same fabricFinishType
 * - All fabrics must have same embroidery status (all plain OR all same embroideryId)
 */
export async function addCombinedCADRow(req: Request, res: Response) {
  try {
    const { styleId } = req.params;
    const { styleFabricIds, purpose = 'PLANNING', fabricStockId } = req.body; // Default to PLANNING (no stock required)

    // ===================================================================
    // PRODUCTION PURPOSE: Require fabric stock selection for combined rows
    // Business Rule: Production CAD is possible only if we have fabric in
    // stock or fabric has been GRN'd. The width should be taken from stock.
    // ===================================================================
    let stockCutableWidth: number | null = null;
    let validatedStock: any = null;

    if (purpose === 'PRODUCTION') {
      if (!fabricStockId) {
        return res.status(400).json({
          success: false,
          message: 'PRODUCTION combined CAD requires fabric stock. Please select available stock or use PLANNING/COSTING purpose.',
          hint: 'For planning purposes, create a PLANNING or COSTING row first. Once stock is available, create a PRODUCTION row.',
        });
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
        return res.status(404).json({
          success: false,
          message: 'Selected fabric stock not found.',
        });
      }

      if (Number(validatedStock.quantityAvailable) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Selected stock has no available quantity. Please select a different stock or wait for GRN.',
        });
      }

      if (validatedStock.status !== 'AVAILABLE') {
        return res.status(400).json({
          success: false,
          message: `Selected stock is not available (status: ${validatedStock.status}). Please select an AVAILABLE stock.`,
        });
      }

      // Use width from stock
      stockCutableWidth = Number(validatedStock.cutableWidth);
      logInfo(`PRODUCTION Combined CAD: Using width ${stockCutableWidth}" from stock ${fabricStockId}`);
    }

    // Validate input
    if (!styleFabricIds || !Array.isArray(styleFabricIds) || styleFabricIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 style fabrics are required for combined cutting',
      });
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
      return res.status(404).json({
        success: false,
        message: 'One or more style fabrics not found',
      });
    }

    // Extract component names for display
    const componentNames = styleFabrics
      .map(sf => sf.style_components?.componentName)
      .filter(Boolean);

    // Validate all fabrics share same base criteria
    const firstFabric = styleFabrics[0];
    const genericFabricName = firstFabric.genericFabricName;
    const fabricFinishType = firstFabric.fabricFinishType;
    const hasEmbroidery = firstFabric.hasEmbroidery;
    const embroideryId = firstFabric.embroideryId;

    for (const sf of styleFabrics) {
      if (sf.genericFabricName !== genericFabricName) {
        return res.status(400).json({
          success: false,
          message: `Cannot combine fabrics with different generic names: "${genericFabricName}" vs "${sf.genericFabricName}"`,
        });
      }
      if (sf.fabricFinishType !== fabricFinishType) {
        return res.status(400).json({
          success: false,
          message: `Cannot combine fabrics with different finish types: "${fabricFinishType}" vs "${sf.fabricFinishType}"`,
        });
      }
      if (sf.hasEmbroidery !== hasEmbroidery) {
        return res.status(400).json({
          success: false,
          message: 'Cannot combine plain and embroidered fabrics',
        });
      }
      if (hasEmbroidery && sf.embroideryId !== embroideryId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot combine fabrics with different embroidery designs',
        });
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
    const newCad = await prisma.fabric_width_cad.create({
      data: {
        styleFabricId: firstFabric.id, // Link to first fabric for FK
        // For PRODUCTION: use fabric from stock; otherwise use style fabric's fabric
        fabricId: purpose === 'PRODUCTION' && validatedStock
          ? validatedStock.fabricId
          : (firstFabric.fabric?.id || undefined),
        // For PRODUCTION: use width from stock; otherwise start at 0
        cutableWidth: purpose === 'PRODUCTION' && stockCutableWidth !== null
          ? stockCutableWidth
          : 0,
        purpose,
        patternPartId: allPartsPatternPart?.id || undefined,
        isEmbroidery: hasEmbroidery,
        componentName: 'Combined: ' + combinedComponents,
        printDirection: 'TWO_WAY',
        createdById: (req as any).user?.id || undefined,
        // Combined cutting fields
        isCombinedCutting: true,
        combinedFabricIds: combinedFabricIdsJson,
        combinedComponents: combinedComponents,
        // PRODUCTION: Link to stock and use greige from fabric master
        fabricStockId: purpose === 'PRODUCTION' ? fabricStockId : undefined,
        greigeId: purpose === 'PRODUCTION' && validatedStock?.fabricMaster?.greigeId
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
    }) as any;

    logInfo(`Created combined CAD row ${newCad.id} for style ${styleId} with ${styleFabrics.length} fabrics: ${combinedComponents}`);

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
        stockInfo: purpose === 'PRODUCTION' && validatedStock ? {
          id: validatedStock.id,
          rollNumbers: validatedStock.rollNumbers,
          quantityAvailable: Number(validatedStock.quantityAvailable),
          qualityGrade: validatedStock.qualityGrade,
          cutableWidth: Number(validatedStock.cutableWidth),
        } : null,
      },
      message: purpose === 'PRODUCTION'
        ? `PRODUCTION combined CAD row created with stock (Width: ${stockCutableWidth}")`
        : `Combined CAD row created for ${styleFabrics.length} components: ${combinedComponents}`,
    });
  } catch (error: unknown) {
    logError('Error adding combined CAD row:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add combined CAD row',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update a CAD row in the spreadsheet table
 * PUT /api/styles/:styleId/cad-table/row/:rowId
 */
export async function updateCADTableRow(req: Request, res: Response) {
  try {
    const { styleId, rowId } = req.params;
    const {
      purpose,
      partId,
      isEmbroidery,
      greigeId,
      cutableWidth,
      printDirection,
      sizeBreakdowns,
      cadMeters,
      piecesPerMarker,
      layerLengthMeters,
    } = req.body;

    // Find existing CAD
    const existingCad = await prisma.fabric_width_cad.findUnique({
      where: { id: rowId },
      include: {
        sizeBreakdowns: true,
        greige: true,
      },
    });

    if (!existingCad) {
      return res.status(404).json({
        success: false,
        message: 'CAD row not found',
      });
    }

    // If greige changed, validate the width
    let validatedWidth = cutableWidth;
    if (greigeId && greigeId !== existingCad.greigeId) {
      const greige = await prisma.greige_master.findUnique({
        where: { id: greigeId },
      });

      if (!greige) {
        return res.status(404).json({
          success: false,
          message: 'Greige not found',
        });
      }

      // If width not provided, default to min finished width
      if (!validatedWidth) {
        validatedWidth = greige.expectedFinishedWidthMin
          ? Number(greige.expectedFinishedWidthMin)
          : 44;
      }

      // Validate width against greige range
      const validation = validateCutableWidth(validatedWidth, greige, isEmbroidery ?? existingCad.isEmbroidery);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.message,
        });
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

    if (purpose !== undefined) updateData.purpose = purpose;
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
    if (validatedWidth !== undefined) updateData.cutableWidth = validatedWidth;
    if (printDirection !== undefined) updateData.printDirection = printDirection;
    // layerLengthMeters from frontend maps to cadMeters in DB
    if (effectiveLayerLength !== undefined) {
      updateData.cadMeters = effectiveLayerLength;
      updateData.layerMarginMeters = layerMarginMetersValue;
    }
    if (piecesPerMarker !== undefined) updateData.piecesPerMarker = piecesPerMarker;

    const updatedCad = await prisma.fabric_width_cad.update({
      where: { id: rowId },
      data: updateData,
      include: {
        sizeBreakdowns: true,
        greige: true,
        patternPart: true,
      },
    }) as any;

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

    const totalPieces = updatedBreakdowns.reduce((sum, sb) => sum + sb.quantity, 0);
    const finalCadMeters = updatedCad.cadMeters ? Number(updatedCad.cadMeters) : null;
    const finalLayerMargin = updatedCad.layerMarginMeters ? Number(updatedCad.layerMarginMeters) : (finalCadMeters ? getDefaultLayerMargin(finalCadMeters) : 0);
    // CAD Average = (layerLengthMeters + layerMargin) / piecesPerMarker
    const cadAverage = finalCadMeters && totalPieces > 0 ? (finalCadMeters + finalLayerMargin) / totalPieces : null;

    // Handle "All Parts" case in response (check both real pattern part and legacy marker)
    const responseIsAllParts = updatedCad.patternPart?.code === ALL_PARTS_CODE ||
                               updatedCad.componentName === ALL_PARTS_LEGACY_MARKER;

    logInfo(`Updated CAD row ${rowId} for style ${styleId}${responseIsAllParts ? ' (All Parts)' : ''}`);

    return res.json({
      success: true,
      data: {
        id: updatedCad.id,
        purpose: updatedCad.purpose,
        partId: updatedCad.patternPartId,
        partCode: updatedCad.patternPart?.code || (responseIsAllParts ? ALL_PARTS_CODE : null),
        partName: updatedCad.patternPart?.name || (responseIsAllParts ? 'All Parts' : updatedCad.componentName),
        isEmbroidery: updatedCad.isEmbroidery,
        greigeId: updatedCad.greigeId,
        greigeName: updatedCad.greige?.greigeName || null,
        cutableWidth: Number(updatedCad.cutableWidth),
        printDirection: updatedCad.printDirection,
        sizeBreakdowns: updatedBreakdowns.map(sb => ({
          sizeName: sb.sizeName,
          sizeId: sb.sizeId,
          quantity: sb.quantity,
        })),
        piecesPerMarker: updatedCad.piecesPerMarker,
        layerMarginMeters: updatedCad.layerMarginMeters ? Number(updatedCad.layerMarginMeters) : null,
        layerLengthMeters: finalCadMeters,
        cadAverage,
      },
      message: 'CAD row updated successfully',
    });
  } catch (error: unknown) {
    logError('Error updating CAD table row:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update CAD row',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete a CAD row from the spreadsheet table
 * DELETE /api/styles/:styleId/cad-table/row/:rowId
 */
export async function deleteCADTableRow(req: Request, res: Response) {
  try {
    const { styleId, rowId } = req.params;

    // Find existing CAD
    const existingCad = await prisma.fabric_width_cad.findUnique({
      where: { id: rowId },
      include: {
        styleFabrics: true,
      },
    });

    if (!existingCad) {
      return res.status(404).json({
        success: false,
        message: 'CAD row not found',
      });
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

    logInfo(`Deleted CAD row ${rowId} for style ${styleId}`);

    return res.json({
      success: true,
      message: 'CAD row deleted successfully',
    });
  } catch (error: unknown) {
    logError('Error deleting CAD table row:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete CAD row',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get available widths for a greige
 * GET /api/styles/cad-table/greige/:greigeId/widths
 */
export async function getGreigeWidths(req: Request, res: Response) {
  try {
    const { greigeId } = req.params;

    const greige = await prisma.greige_master.findUnique({
      where: { id: greigeId },
    });

    if (!greige) {
      return res.status(404).json({
        success: false,
        message: 'Greige not found',
      });
    }

    const minWidth = greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : 36;
    const maxWidth = greige.expectedFinishedWidthMax
      ? Number(greige.expectedFinishedWidthMax)
      : (greige.greigeWidth ? Number(greige.greigeWidth) : 60);

    // Generate widths in 2-inch increments
    const widths: number[] = [];
    for (let w = minWidth; w <= maxWidth; w += 2) {
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
  } catch (error: unknown) {
    logError('Error fetching greige widths:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch greige widths',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get CAD pattern parts for a style component
 * Returns pattern parts from CAD entries first, then remaining component master parts
 *
 * @route GET /api/styles/:styleId/components/:componentId/cad-pattern-parts
 */
export async function getCADPatternPartsForComponent(req: Request, res: Response) {
  try {
    const { styleId, componentId } = req.params;

    // 1. Get the component with style_fabrics, CAD rows, and stylePatternParts
    const component = await prisma.style_components.findUnique({
      where: { id: componentId },
      include: {
        style_fabrics: {
          include: {
            cadRows: {
              where: {
                patternPartId: { not: null },
              },
              include: {
                patternPart: true,
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
    });

    if (!component) {
      return res.status(404).json({
        success: false,
        message: 'Component not found',
      });
    }

    // Verify the component belongs to the specified style
    if (component.styleId !== styleId) {
      return res.status(400).json({
        success: false,
        message: 'Component does not belong to the specified style',
      });
    }

    // 2. Build a map of pattern part ID -> goesToEmbroidery from stylePatternParts
    const embroideryMap = new Map<string, boolean>();
    component.style_fabrics.forEach((fabric: {
      stylePatternParts: Array<{
        patternPartId: string;
        goesToEmbroidery?: boolean;
      }>;
    }) => {
      fabric.stylePatternParts.forEach((spp) => {
        if (spp.goesToEmbroidery) {
          embroideryMap.set(spp.patternPartId, true);
        }
      });
    });

    // 3. Get pattern parts from CAD entries (from cadRows with patternPartId)
    const cadPartIds = new Set<string>();
    const cadPatternParts: Array<{
      id: string;
      code: string;
      name: string;
      hasCAD: boolean;
      goesToEmbroidery: boolean;
      cadRowId?: string;
    }> = [];

    component.style_fabrics.forEach((fabric: {
      cadRows: Array<{
        id: string;
        patternPartId: string | null;
        patternPart: { id: string; code: string; name: string } | null;
      }>;
    }) => {
      fabric.cadRows.forEach((cadRow) => {
        if (cadRow.patternPartId && cadRow.patternPart && !cadPartIds.has(cadRow.patternPartId)) {
          cadPartIds.add(cadRow.patternPartId);
          cadPatternParts.push({
            id: cadRow.patternPart.id,
            code: cadRow.patternPart.code,
            name: cadRow.patternPart.name,
            hasCAD: true,
            goesToEmbroidery: embroideryMap.get(cadRow.patternPartId) || false,
            cadRowId: cadRow.id,
          });
        }
      });
    });

    // 4. Look up component master by name (not FK - uses componentType/componentName)
    const componentMaster = await prisma.component_masters.findFirst({
      where: {
        OR: [
          { name: component.componentType },
          { name: component.componentName },
        ],
        isActive: true,
      },
      include: {
        patternParts: {
          include: {
            patternPart: true,
          },
          orderBy: { patternPart: { sortOrder: 'asc' } },
        },
        componentGroup: true,
      },
    });

    // 5. Get remaining pattern parts from component master (not in CAD)
    const masterPatternParts: Array<{
      id: string;
      code: string;
      name: string;
      hasCAD: boolean;
      goesToEmbroidery: boolean;
    }> = [];

    if (componentMaster?.patternParts) {
      componentMaster.patternParts.forEach((pp: { patternPartId: string; patternPart: { id: string; code: string; name: string } }) => {
        if (!cadPartIds.has(pp.patternPartId)) {
          masterPatternParts.push({
            id: pp.patternPart.id,
            code: pp.patternPart.code,
            name: pp.patternPart.name,
            hasCAD: false,
            goesToEmbroidery: embroideryMap.get(pp.patternPartId) || false,
          });
        }
      });
    }

    // 6. If no direct pattern parts, try via component group
    if (masterPatternParts.length === 0 && componentMaster?.componentGroup) {
      const groupPatternParts = await prisma.pattern_part_groups.findMany({
        where: {
          componentGroupId: componentMaster.componentGroup.id,
        },
        include: {
          patternPart: true,
        },
      });

      groupPatternParts.forEach((gpp: { patternPartId: string; patternPart: { id: string; code: string; name: string } }) => {
        if (!cadPartIds.has(gpp.patternPartId)) {
          masterPatternParts.push({
            id: gpp.patternPart.id,
            code: gpp.patternPart.code,
            name: gpp.patternPart.name,
            hasCAD: false,
            goesToEmbroidery: embroideryMap.get(gpp.patternPartId) || false,
          });
        }
      });
    }

    return res.json({
      success: true,
      data: {
        styleId,
        componentId,
        componentName: component.componentName,
        cadPatternParts,
        masterPatternParts,
      },
    });
  } catch (error: unknown) {
    logError('Error fetching CAD pattern parts for component:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch CAD pattern parts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// CAD PURPOSES: PRODUCTION, PLANNING, COSTING
// ============================================

/**
 * Approve CAD Purpose (PRODUCTION, PLANNING, or COSTING)
 * POST /api/styles/:styleId/cad-table/row/:rowId/approve
 */
export async function approveCADPurpose(req: Request, res: Response) {
  try {
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
  } catch (error: unknown) {
    logError('Error approving CAD purpose:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve CAD',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Reject CAD Purpose
 * POST /api/styles/:styleId/cad-table/row/:rowId/reject
 */
export async function rejectCADPurpose(req: Request, res: Response) {
  try {
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
  } catch (error: unknown) {
    logError('Error rejecting CAD purpose:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject CAD',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create New Version of PLANNING CAD
 * POST /api/styles/:styleId/cad-table/planning/:rowId/create-version
 */
export async function createPlanningVersion(req: Request, res: Response) {
  try {
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

    // Verify it's PLANNING purpose
    if (baseCad.purpose !== 'PLANNING') {
      return res.status(400).json({
        success: false,
        message: 'Only PLANNING CAD supports versioning',
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
        purpose: 'PLANNING',
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
      message: `PLANNING CAD v${newVersion.version} created successfully`,
      data: {
        newCadId: newVersion.id,
        version: newVersion.version,
        baseCadId: baseCad.id,
        baseVersion: baseCad.version,
      },
    });
  } catch (error: unknown) {
    logError('Error creating PLANNING version:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create new PLANNING version',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Copy CAD Between Purposes (COSTING→PLANNING, PLANNING→PRODUCTION)
 * POST /api/styles/:styleId/cad-table/copy
 */
export async function copyCADPurpose(req: Request, res: Response) {
  try {
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

    // Validate copy direction
    const validCopyPaths = [
      { from: 'COSTING', to: 'PLANNING' },
      { from: 'PLANNING', to: 'PRODUCTION' },
    ];

    const isValidPath = validCopyPaths.some(
      (path) => path.from === sourceCad.purpose && path.to === targetPurpose
    );

    if (!isValidPath) {
      return res.status(400).json({
        success: false,
        message: `Invalid copy path: ${sourceCad.purpose} → ${targetPurpose}. Allowed: COSTING→PLANNING, PLANNING→PRODUCTION`,
      });
    }

    // Create new CAD with target purpose
    const newCad = await prisma.fabric_width_cad.create({
      data: {
        // Copy all fields
        fabricId: sourceCad.fabricId,
        styleFabricId: styleFabricId || sourceCad.styleFabricId,
        cutableWidth: sourceCad.cutableWidth,
        widthUnit: sourceCad.widthUnit,
        cadWastagePercent: sourceCad.cadWastagePercent,
        printDirection: sourceCad.printDirection,
        layerMarginMeters: sourceCad.layerMarginMeters,
        greigeId: sourceCad.greigeId,
        componentName: sourceCad.componentName,
        patternPartId: patternPartId || sourceCad.patternPartId,
        isEmbroidery: sourceCad.isEmbroidery,
        piecesPerMarker: sourceCad.piecesPerMarker,
        notes: `Copied from ${sourceCad.purpose} CAD`,
        createdById: userId,

        // Set target purpose
        purpose: targetPurpose,

        // Reset approval for new purpose
        approvalStatus: 'PENDING',
        approvedBy: null,
        approvedAt: null,
        approvalNotes: null,

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
      message: `CAD copied from ${sourceCad.purpose} to ${targetPurpose}`,
      data: {
        newCadId: newCad.id,
        sourceCadId: sourceCad.id,
        sourcePurpose: sourceCad.purpose,
        targetPurpose: newCad.purpose,
      },
    });
  } catch (error: unknown) {
    logError('Error copying CAD purpose:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to copy CAD',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Link PRODUCTION CAD to Fabric Stock
 * POST /api/styles/:styleId/cad-table/link-stock
 */
export async function linkCADToStock(req: Request, res: Response) {
  try {
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
  } catch (error: unknown) {
    logError('Error linking CAD to stock:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to link CAD to stock',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create PRODUCTION CAD from stock receipt
 * Allows creating new PRODUCTION CAD rows for new stock lots even after style is approved
 * POST /api/styles/:styleId/cad-planning/production-from-stock
 */
export async function createProductionCADFromStock(req: Request, res: Response) {
  try {
    const { styleId } = req.params;
    const {
      fabricStockId,
      styleFabricId,
      basedOnPlanningCadId,
      componentId,
      greigeId,
      patternPartId,
    } = req.body;
    const userId = (req as any).user?.userId;

    if (!fabricStockId) {
      return res.status(400).json({
        success: false,
        message: 'fabricStockId is required',
      });
    }

    // 1. Fetch fabric stock details
    const fabricStock = await prisma.fabric_stock.findUnique({
      where: { id: fabricStockId },
      include: {
        fabricMaster: {
          include: {
            greige: true,
          },
        },
        procurement: true,
      },
    });

    if (!fabricStock) {
      return res.status(404).json({
        success: false,
        message: 'Fabric stock not found',
      });
    }

    // 2. Find source CAD to copy from (PLANNING or existing PRODUCTION)
    let sourceCAD: any = null;

    if (basedOnPlanningCadId) {
      // Use the specified PLANNING CAD as source
      sourceCAD = await prisma.fabric_width_cad.findUnique({
        where: { id: basedOnPlanningCadId },
      });
    } else if (styleFabricId) {
      // Find the latest approved PLANNING CAD for this style-fabric
      sourceCAD = await prisma.fabric_width_cad.findFirst({
        where: {
          styleFabricId,
          purpose: 'PLANNING',
          approvalStatus: 'APPROVED',
        },
        orderBy: [
          { version: 'desc' },
          { approvedAt: 'desc' },
        ],
      });

      // If no PLANNING CAD, try to find any approved PRODUCTION CAD
      if (!sourceCAD) {
        sourceCAD = await prisma.fabric_width_cad.findFirst({
          where: {
            styleFabricId,
            purpose: 'PRODUCTION',
            approvalStatus: 'APPROVED',
          },
          orderBy: { approvedAt: 'desc' },
        });
      }
    }

    // 3. Get stock width
    const stockWidth = Number(fabricStock.cutableWidth);
    const planningWidth = sourceCAD ? Number(sourceCAD.cutableWidth) : null;

    // 4. Calculate variance
    let widthVariance: number | null = null;
    let variancePercent: number | null = null;

    if (planningWidth && stockWidth) {
      widthVariance = stockWidth - planningWidth;
      variancePercent = (widthVariance / planningWidth) * 100;
    }

    // 5. Determine greige and pattern part
    const finalGreigeId = greigeId || sourceCAD?.greigeId || fabricStock.fabricMaster?.greigeId;
    const finalPatternPartId = patternPartId || sourceCAD?.patternPartId;
    const finalStyleFabricId = styleFabricId || sourceCAD?.styleFabricId;

    // 6. Create new PRODUCTION CAD
    const newCAD = await prisma.fabric_width_cad.create({
      data: {
        // Core fields
        styleFabricId: finalStyleFabricId,
        fabricId: sourceCAD?.fabricId || fabricStock.fabricId,
        greigeId: finalGreigeId,
        patternPartId: finalPatternPartId,
        componentName: sourceCAD?.componentName,

        // Width from stock
        cutableWidth: stockWidth,
        widthUnit: 'inches',

        // Copy CAD metrics from source if available
        cadMeters: sourceCAD?.cadMeters || null,
        cadYards: sourceCAD?.cadYards || null,
        cadWastagePercent: sourceCAD?.cadWastagePercent || 5,
        layerMarginMeters: sourceCAD?.layerMarginMeters || null,
        markerEfficiency: sourceCAD?.markerEfficiency || null,
        printDirection: sourceCAD?.printDirection || 'TWO_WAY',

        // Purpose and status
        purpose: 'PRODUCTION',
        approvalStatus: 'PENDING',

        // Stock integration
        fabricStockId,
        procurementId: fabricStock.procurementId,

        // Variance tracking
        planningCadWidth: planningWidth,
        widthVariance,
        variancePercent,

        // Audit
        createdById: userId,
        notes: `Created from stock lot. Stock width: ${stockWidth}". ${planningWidth ? `Planning width: ${planningWidth}". Variance: ${widthVariance?.toFixed(2)}"` : ''}`,
      },
      include: {
        styleFabric: {
          include: {
            style_components: true,
          },
        },
        greige: true,
        fabricStock: true,
        patternPart: true,
      },
    });

    logInfo(`Created PRODUCTION CAD ${newCAD.id} from stock ${fabricStockId} for style ${styleId}`);

    return res.status(201).json({
      success: true,
      message: 'PRODUCTION CAD created from stock',
      data: {
        id: newCAD.id,
        cutableWidth: newCAD.cutableWidth,
        cadMeters: newCAD.cadMeters,
        purpose: newCAD.purpose,
        approvalStatus: newCAD.approvalStatus,
        fabricStockId: newCAD.fabricStockId,
        planningCadWidth: newCAD.planningCadWidth,
        widthVariance: newCAD.widthVariance,
        variancePercent: newCAD.variancePercent,
        styleFabric: newCAD.styleFabric,
        greige: newCAD.greige,
        patternPart: newCAD.patternPart,
      },
    });
  } catch (error: unknown) {
    logError('Error creating PRODUCTION CAD from stock:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create PRODUCTION CAD from stock',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get CAD order usage history for a style
 * Shows which orders used which PRODUCTION CAD widths
 * GET /api/styles/:styleId/cad-planning/order-history
 */
export async function getCADOrderHistory(req: Request, res: Response) {
  try {
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
  } catch (error: unknown) {
    logError('Error getting CAD order history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get CAD order history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
