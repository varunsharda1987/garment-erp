import { Request, Response } from 'express';
import { PrismaClient, Prisma, CADStatus, FabricFinishType } from '@prisma/client';
import { logError, logInfo } from '../utils/logger';

const prisma = new PrismaClient();

// Cutable width offsets from greige width (standard industry practice)
// NOTE: Auto-width generation has been disabled - users add widths manually on CAD Edit page
const CUTABLE_WIDTH_OFFSETS = [-2, -4, -6]; // inches reduction from greige width (kept for reference/calculation display)

// Layer margin defaults based on CAD length (meters)
function getDefaultLayerMargin(cadMeters: number): number {
  if (cadMeters <= 0) return 0.02;
  if (cadMeters <= 1) return 0.02; // 2 cm
  if (cadMeters <= 5) return 0.05; // 5 cm
  if (cadMeters <= 10) return 0.10; // 10 cm
  if (cadMeters <= 20) return 0.20; // 20 cm
  return 0.30; // 30 cm
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
  fabricId: string;
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

    // Get style with all fabric data
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
        const embroideryPart = fabric.hasEmbroidery && fabric.embroideryId
          ? `EMB-${fabric.embroideryId.substring(0, 8)}`
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
          greigePricePerMeter: selectedGreige.costPerMeter ? Number(selectedGreige.costPerMeter) : null,
        } : null,
        cadOptions,
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

    // Create new CAD entry
    const newCad = await prisma.fabric_width_cad.create({
      data: {
        fabricId: targetFabricId,
        cutableWidth,
        widthUnit: 'inches',
        cadWastagePercent: 5,
        layerMarginMeters: 0.05,
        greigeId: greigeId || null,
        componentName: componentName || null,
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
        fabricId: string;
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
