import { Request, Response } from 'express';
import { PrismaClient, Prisma, CADStatus } from '@prisma/client';
import { logError, logInfo } from '../utils/logger';

const prisma = new PrismaClient();

// Cutable width offsets from greige width (standard industry practice)
const CUTABLE_WIDTH_OFFSETS = [-2, -4, -6]; // inches reduction from greige width

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

      // Log if no greige found for this generic name
      if (availableGreiges.length === 0 && group.genericFabricName) {
        missingGreigeNames.push(group.genericFabricName);
        logInfo(`No greige found for genericFabricName: "${group.genericFabricName}"`);
      }

      // Get CAD options if greige is selected
      let cadOptions: any[] = [];
      if (group.selectedGreigeId) {
        // Find fabric_master for this greige
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
      }

      // Get selected greige details
      const selectedGreige = group.selectedGreigeId
        ? availableGreiges.find(g => g.id === group.selectedGreigeId)
        : null;

      fabricGroups.push({
        groupKey: group.groupKey,
        genericFabricName: group.genericFabricName,
        fabricFinishType: group.fabricFinishType,
        hasEmbroidery: group.hasEmbroidery,
        embroidery: group.embroidery,
        components: group.components,
        fabrics: group.fabrics,
        averagingMode: group.averagingMode,
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

    // Use defaultCutableWidth from greige, or calculate from greigeWidth - 4" (industry standard)
    const greigeWidth = Number(greige.greigeWidth);
    const defaultCutableWidth = greige.defaultCutableWidth
      ? Number(greige.defaultCutableWidth)
      : greigeWidth - 4; // Default: 4 inches less than greige width

    // Generate CAD entries (single width per component)
    const componentsToProcess = averagingMode === 'SEPARATE' ? componentNames : [null];

    for (const componentName of componentsToProcess) {
      let cad = await prisma.fabric_width_cad.findFirst({
        where: {
          fabricId: fabric.id,
          cutableWidth: defaultCutableWidth,
          componentName: componentName || null,
        },
      });

      if (!cad) {
        await prisma.fabric_width_cad.create({
          data: {
            fabricId: fabric.id,
            cutableWidth: defaultCutableWidth,
            widthUnit: 'inches',
            cadWastagePercent: 5,
            layerMarginMeters: 0.05,
            greigeId,
            componentName: componentName || null,
            isPreferred: true,
            createdById: req.user?.userId || 'system',
          },
        });
      }
    }

    return res.json({
      success: true,
      message: 'Greige selected and CAD options generated',
      data: {
        greigeId,
        greigeName: greige.greigeName,
        greigeWidth: greigeWidth,
        defaultCutableWidth,
        averagingMode,
        fabricsUpdated: fabricIds.length,
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
