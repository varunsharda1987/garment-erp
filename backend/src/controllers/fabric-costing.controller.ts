/**
 * Fabric Costing Controller
 * Handles API endpoints for fabric cost calculation with sourcing strategies
 */

import { Request, Response } from 'express';
import { calculateFabricCost } from '../services/fabric-cost-calculation.service';
import { lookupRate } from '../services/processor-rate-v2.service';
import { serialize } from '../utils/serializer';
import prisma from '../config/database';
import { ProcessingTypeV2, PrintingTypeV2 } from '../types/processor-rate-v2.types';

/**
 * POST /api/fabric-costing/calculate
 * Calculate fabric cost with all sourcing options
 */
export async function calculateSingleFabricCost(req: Request, res: Response) {
  try {
    const { fabricId, cadMeters, width, orderQuantity, styleId } = req.body;

    // Validation
    if (!fabricId || !cadMeters || !width) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fabricId, cadMeters, width',
      });
    }

    const result = await calculateFabricCost({
      fabricId,
      cadMeters: parseFloat(cadMeters),
      width: parseFloat(width),
      orderQuantity: orderQuantity ? parseInt(orderQuantity) : undefined,
      styleId,
    });

    res.json(serialize({
      success: true,
      data: result,
    }));
  } catch (error: any) {
    console.error('Error calculating fabric cost:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate fabric cost',
    });
  }
}

/**
 * POST /api/fabric-costing/batch-calculate
 * Calculate costs for multiple fabrics
 */
export async function calculateBatchFabricCost(req: Request, res: Response) {
  try {
    const { fabrics, orderQuantity, styleId } = req.body;

    if (!fabrics || !Array.isArray(fabrics) || fabrics.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid fabrics array',
      });
    }

    const results = await Promise.all(
      fabrics.map(async (fabric: any) => {
        try {
          return await calculateFabricCost({
            fabricId: fabric.fabricId,
            cadMeters: parseFloat(fabric.cadMeters),
            width: parseFloat(fabric.width),
            orderQuantity: orderQuantity ? parseInt(orderQuantity) : undefined,
            styleId,
          });
        } catch (error: any) {
          return {
            fabricId: fabric.fabricId,
            error: error.message,
            success: false,
          };
        }
      })
    );

    // Calculate totals
    const successfulResults = results.filter((r: any) => !r.error);
    const totalRecommendedCost = successfulResults.reduce(
      (sum: number, r: any) => sum + (r.recommendedCost || 0),
      0
    );
    const totalSavings = successfulResults.reduce(
      (sum: number, r: any) => sum + (r.savings || 0),
      0
    );

    res.json(serialize({
      success: true,
      data: {
        fabrics: results,
        summary: {
          totalFabrics: fabrics.length,
          successfulCalculations: successfulResults.length,
          failedCalculations: results.length - successfulResults.length,
          totalRecommendedCost,
          totalSavings,
        },
      },
    }));
  } catch (error: any) {
    console.error('Error in batch fabric cost calculation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate batch fabric costs',
    });
  }
}

/**
 * GET /api/fabric-costing/processors
 * Get all DYEING_PRINTING processors for dropdown selection
 */
export async function getProcessors(req: Request, res: Response) {
  try {
    const processors = await prisma.suppliers.findMany({
      where: {
        supplierCategories: {
          has: 'DYEING_PRINTING',
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        rating: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json(serialize({
      success: true,
      data: processors,
    }));
  } catch (error: any) {
    console.error('Error fetching processors:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch processors',
    });
  }
}

/**
 * GET /api/fabric-costing/style/:styleId
 * Get fabrics from a style with greige data for fabric costing
 */
export async function getStyleFabrics(req: Request, res: Response) {
  try {
    const { styleId } = req.params;

    if (!styleId) {
      return res.status(400).json({
        success: false,
        error: 'styleId is required',
      });
    }

    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: {
                  include: {
                    greige: true,
                  },
                },
                fabricCAD: true,
                selectedGreige: true,
              },
            },
          },
        },
      },
    });

    if (!style) {
      return res.status(404).json({
        success: false,
        error: 'Style not found',
      });
    }

    // Map to FabricForCosting format
    const fabricsForCosting: any[] = [];

    for (const component of style.style_components || []) {
      for (const styleFabric of component.style_fabrics || []) {
        // Determine greige reference - prefer selectedGreige, fallback to fabric.greige
        const greige = styleFabric.selectedGreige || styleFabric.fabric?.greige;

        // Get CAD meters from fabricCAD or fallback to cadAverageMeters
        const cadMeters = styleFabric.fabricCAD?.cadMeters
          ? Number(styleFabric.fabricCAD.cadMeters)
          : styleFabric.cadAverageMeters
            ? Number(styleFabric.cadAverageMeters)
            : null;

        // Get width from fabricCAD or cutableWidth
        const width = styleFabric.fabricCAD?.cutableWidth
          ? Number(styleFabric.fabricCAD.cutableWidth)
          : styleFabric.cutableWidth
            ? Number(styleFabric.cutableWidth)
            : styleFabric.fabric?.cutableWidth
              ? Number(styleFabric.fabric.cutableWidth)
              : null;

        // Get ready fabric cost from fabric_master
        const readyFabricCost = styleFabric.fabric?.costPerMeter
          ? Number(styleFabric.fabric.costPerMeter)
          : null;

        fabricsForCosting.push({
          id: styleFabric.id,
          fabricId: styleFabric.fabricId,
          fabricName: styleFabric.fabric?.fabricName || styleFabric.fabricName || styleFabric.genericFabricName || 'Unknown',
          genericFabricName: styleFabric.genericFabricName || styleFabric.fabric?.genericFabricName,
          componentId: component.id,
          componentName: component.componentName,
          cadMeters,
          width,
          finishType: styleFabric.fabricFinishType || styleFabric.fabric?.finishType || null,
          greigeId: greige?.id || null,
          greigeName: greige?.greigeName || null,
          greigeCode: greige?.greigeCode || null,
          greigeDefaultCost: greige?.costPerMeter ? Number(greige.costPerMeter) : null,
          numberOfColors: styleFabric.numberOfColors || null,
          // Ready fabric cost from fabric_master (for direct purchase without processing)
          readyFabricCost,
        });
      }
    }

    res.json(serialize({
      success: true,
      data: {
        styleId: style.id,
        styleCode: style.styleCode,
        styleName: style.styleName,
        fabrics: fabricsForCosting,
      },
    }));
  } catch (error: any) {
    console.error('Error fetching style fabrics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch style fabrics',
    });
  }
}

/**
 * POST /api/fabric-costing/lookup-rate
 * Lookup processor rate for a specific greige and quantity
 */
export async function lookupProcessorRate(req: Request, res: Response) {
  try {
    const { processorId, processingType, printingType, greigeId, quantityMeters } = req.body;

    // Validation
    if (!processorId || !processingType || !greigeId || !quantityMeters) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: processorId, processingType, greigeId, quantityMeters',
      });
    }

    // Validate processingType
    if (processingType !== 'DYEING' && processingType !== 'PRINTING') {
      return res.status(400).json({
        success: false,
        error: 'processingType must be DYEING or PRINTING',
      });
    }

    // For PRINTING, printingType is required
    if (processingType === 'PRINTING' && !printingType) {
      return res.status(400).json({
        success: false,
        error: 'printingType is required when processingType is PRINTING',
      });
    }

    const result = await lookupRate({
      processorId,
      processingType: processingType as ProcessingTypeV2,
      printingType: printingType as PrintingTypeV2 | undefined,
      greigeId,
      quantityMeters: parseFloat(quantityMeters),
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No rate found for the given criteria',
      });
    }

    res.json(serialize({
      success: true,
      data: result,
    }));
  } catch (error: any) {
    console.error('Error looking up processor rate:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to lookup processor rate',
    });
  }
}

/**
 * POST /api/fabric-costing/save
 * Save fabric costing data for a style
 */
export async function saveFabricCosting(req: Request, res: Response) {
  try {
    const { styleId, orderQuantity, fabricCostings } = req.body;

    if (!styleId || !fabricCostings || !Array.isArray(fabricCostings)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: styleId, fabricCostings',
      });
    }

    // Update each style_fabric with costing data
    const updates = await Promise.all(
      fabricCostings.map(async (costing: any) => {
        return prisma.style_fabrics.update({
          where: { id: costing.styleFabricId },
          data: {
            // Store the calculated cost
            fabricCostPerMeter: costing.totalCostPerMeter ? parseFloat(costing.totalCostPerMeter) : null,
            unitPrice: costing.totalCostPerMeter ? parseFloat(costing.totalCostPerMeter) : null,
            // Update number of colors if provided
            numberOfColors: costing.numberOfColors || null,
          },
        });
      })
    );

    res.json(serialize({
      success: true,
      data: {
        message: 'Fabric costing saved successfully',
        updatedCount: updates.length,
      },
    }));
  } catch (error: any) {
    console.error('Error saving fabric costing:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save fabric costing',
    });
  }
}

export default {
  calculateSingleFabricCost,
  calculateBatchFabricCost,
  getProcessors,
  getStyleFabrics,
  lookupProcessorRate,
  saveFabricCosting,
};
