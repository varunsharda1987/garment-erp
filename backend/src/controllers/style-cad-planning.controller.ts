import { Request, Response } from 'express';
import { PrismaClient, Prisma, CADStatus } from '@prisma/client';
import { logError } from '../utils/logger';

const prisma = new PrismaClient();

// Common fabric widths for CAD generation
const COMMON_WIDTHS = [36, 44, 54, 58, 60, 72, 108];

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
  availableWidth: number;
  widthUnit: string;
  cadMeters: number;
  cadYards?: number;
  cadWastagePercent: number;
  markerEfficiency?: number;
  isPreferred: boolean;
  supplierAvailability?: string;
  priceDifferential?: number;
  notes?: string;
}

interface CADCostResult {
  cadId: string;
  availableWidth: number;
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
            approvedWidth: fabric.fabricCAD?.availableWidth ? Number(fabric.fabricCAD.availableWidth) : undefined,
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
 * Generate CAD options for a style's fabric
 * POST /api/styles/cad-planning/generate
 * Body: { styleId, genericFabricName, greigeId?, widths? }
 * Note: greigeId is optional. If not provided, creates a placeholder fabric for CAD planning.
 */
export async function generateCADOptions(req: Request, res: Response) {
  try {
    const { styleId, genericFabricName, greigeId, widths = COMMON_WIDTHS } = req.body;

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

    let fabric;
    let greige = null;

    if (greigeId) {
      // If greigeId is provided, use the existing greige-based logic
      greige = await prisma.greige_master.findUnique({
        where: { id: greigeId },
      });

      if (!greige) {
        return res.status(404).json({
          success: false,
          message: 'Greige fabric not found',
        });
      }

      // Find or create fabric_master for this greige
      fabric = await prisma.fabric_master.findFirst({
        where: {
          greigeId,
          genericFabricName,
        },
      });

      if (!fabric) {
        // Create a generic fabric entry for CAD planning
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
    } else {
      // No greigeId provided - create a style-specific placeholder fabric for CAD planning
      fabric = await prisma.fabric_master.findFirst({
        where: {
          genericFabricName,
          styleReference: styleId,
          isGeneric: true,
        },
      });

      if (!fabric) {
        // Create placeholder fabric for CAD planning without greige
        fabric = await prisma.fabric_master.create({
          data: {
            fabricCode: `CAD-${styleId.slice(0, 8)}-${Date.now()}`,
            fabricName: `${genericFabricName} (CAD Planning)`,
            genericFabricName,
            isActive: true,
            isGeneric: true,
            styleReference: styleId,
            createdById: req.user?.userId || 'system',
          },
        });
      }
    }

    // Generate CAD options for each width
    const options: CADOption[] = [];

    for (const width of widths) {
      // Check if CAD already exists for this width
      let cad = await prisma.fabric_width_cad.findFirst({
        where: {
          fabricId: fabric.id,
          availableWidth: width,
        },
      });

      if (!cad) {
        // Create placeholder CAD entry
        cad = await prisma.fabric_width_cad.create({
          data: {
            fabricId: fabric.id,
            availableWidth: width,
            widthUnit: 'inches',
            cadWastagePercent: 5, // Default 5% wastage
            isPreferred: width === 58, // Default prefer 58" width
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
        availableWidth: Number(cad.availableWidth),
        widthUnit: cad.widthUnit,
        cadMeters: cad.cadMeters ? Number(cad.cadMeters) : 0,
        cadYards: cad.cadYards ? Number(cad.cadYards) : undefined,
        cadWastagePercent: Number(cad.cadWastagePercent),
        markerEfficiency: cad.markerEfficiency ? Number(cad.markerEfficiency) : undefined,
        isPreferred: cad.isPreferred,
        supplierAvailability: cad.supplierAvailability || undefined,
        priceDifferential: cad.priceDifferential ? Number(cad.priceDifferential) : undefined,
        notes: cad.notes || undefined,
      });
    }

    // Update style status to IN_PROGRESS
    await prisma.styles.update({
      where: { id: styleId },
      data: { cadStatus: 'IN_PROGRESS' },
    });

    // Find recommended option (lowest cost, but needs fabric rate input)
    const recommendedOption = options.find((opt) => opt.isPreferred)?.cadId || options[0]?.cadId;

    return res.json({
      success: true,
      message: 'CAD options generated successfully',
      styleId,
      genericFabricName,
      greigeName: greige?.greigeName || null,
      options,
      recommendedOption,
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
      availableWidth: Number(cad.availableWidth),
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
 * Body: { cadMeters?, cadYards?, cadWastagePercent?, markerEfficiency?, notes? }
 */
export async function updateCADValues(req: Request, res: Response) {
  try {
    const { cadId } = req.params;
    const {
      cadMeters,
      cadYards,
      cadWastagePercent,
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
    if (cadMeters !== undefined) updateData.cadMeters = cadMeters;
    if (cadYards !== undefined) updateData.cadYards = cadYards;
    if (cadWastagePercent !== undefined) updateData.cadWastagePercent = cadWastagePercent;
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
      data: updated,
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
        fabricMasterId: fabric.fabricId,
        hasCAD: fabric.fabricCADId !== null,
        cadDetails: fabric.fabricCAD ? {
          cadId: fabric.fabricCAD.id,
          width: Number(fabric.fabricCAD.availableWidth),
          cadMeters: fabric.fabricCAD.cadMeters ? Number(fabric.fabricCAD.cadMeters) : null,
          wastagePercent: Number(fabric.fabricCAD.cadWastagePercent),
          markerEfficiency: fabric.fabricCAD.markerEfficiency ? Number(fabric.fabricCAD.markerEfficiency) : null,
        } : null,
        greigeDetails: fabric.fabric?.greige ? {
          greigeId: fabric.fabric.greigeId,
          greigeName: fabric.fabric.greige.greigeName,
          greigeWidth: Number(fabric.fabric.greige.greigeWidth),
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
