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
 * Also includes existing fabric_width_cad records with saved costing data
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
                    greige: {
                      include: {
                        // Include greige procurement to get latest greige stock cost
                        fabricProcurements: {
                          where: {
                            procurementType: 'GREIGE',
                          },
                          orderBy: {
                            purchaseDate: 'desc',
                          },
                          take: 1, // Most recent greige procurement
                          select: {
                            id: true,
                            ratePerUnit: true,
                            quantityPurchased: true,
                            purchaseDate: true,
                          },
                        },
                      },
                    },
                    // Include all fabric_width_cad records for this fabric
                    widthCADs: {
                      include: {
                        greige: true,
                        processor: {
                          select: {
                            id: true,
                            name: true,
                            code: true,
                          },
                        },
                      },
                      orderBy: {
                        cutableWidth: 'asc',
                      },
                    },
                    // Include stock entries to get actual stock cost
                    fabricStock: {
                      where: {
                        status: 'AVAILABLE',
                        quantityAvailable: { gt: 0 },
                      },
                      orderBy: {
                        receivedDate: 'desc',
                      },
                      take: 1, // Most recent stock entry
                      select: {
                        id: true,
                        weightedAvgCost: true,
                        quantityAvailable: true,
                      },
                    },
                  },
                },
                fabricCAD: true,
                selectedGreige: {
                  include: {
                    // Include greige procurement for selectedGreige as well
                    fabricProcurements: {
                      where: {
                        procurementType: 'GREIGE',
                      },
                      orderBy: {
                        purchaseDate: 'desc',
                      },
                      take: 1,
                      select: {
                        id: true,
                        ratePerUnit: true,
                        quantityPurchased: true,
                        purchaseDate: true,
                      },
                    },
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
        error: 'Style not found',
      });
    }

    // Map to FabricForCosting format
    const fabricsForCosting: any[] = [];

    for (const component of style.style_components || []) {
      for (const styleFabric of component.style_fabrics || []) {
        // Determine greige reference - prefer selectedGreige, fallback to fabric.greige
        const greige = styleFabric.selectedGreige || styleFabric.fabric?.greige;

        // Get CAD meters - Priority: style_fabrics.cadAverageMeters → fabric_width_cad
        // style_fabrics.cadAverageMeters is PRIMARY (style-specific consumption set by user)
        const cadMeters = styleFabric.cadAverageMeters
          ? Number(styleFabric.cadAverageMeters)
          : styleFabric.fabricCAD?.cadMeters
            ? Number(styleFabric.fabricCAD.cadMeters)
            : null;

        // Get width from fabricCAD or cutableWidth
        const width = styleFabric.fabricCAD?.cutableWidth
          ? Number(styleFabric.fabricCAD.cutableWidth)
          : styleFabric.cutableWidth
            ? Number(styleFabric.cutableWidth)
            : styleFabric.fabric?.cutableWidth
              ? Number(styleFabric.fabric.cutableWidth)
              : null;

        // Get ready fabric cost - prioritize stock cost over fabric_master cost
        // If stock exists with available quantity, use its weightedAvgCost
        // Otherwise fall back to fabric_master.costPerMeter
        const latestStock = styleFabric.fabric?.fabricStock?.[0];
        const readyFabricCost = latestStock?.weightedAvgCost
          ? Number(latestStock.weightedAvgCost)
          : styleFabric.fabric?.costPerMeter
            ? Number(styleFabric.fabric.costPerMeter)
            : null;

        // Map fabric_width_cad records (includes costing breakdown)
        const widthOptions = (styleFabric.fabric?.widthCADs || []).map((cad: any) => ({
          id: cad.id,
          cutableWidth: Number(cad.cutableWidth),
          componentName: cad.componentName,
          cadMeters: cad.cadMeters ? Number(cad.cadMeters) : null,
          // Costing data
          greigeId: cad.greigeId,
          greigeName: cad.greige?.greigeName || null,
          greigeCode: cad.greige?.greigeCode || null,
          greigeCostPerMeter: cad.greigeCostPerMeter ? Number(cad.greigeCostPerMeter) : null,
          transportCostPerMeter: cad.transportCostPerMeter ? Number(cad.transportCostPerMeter) : null,
          processingPricePerMeter: cad.processingPricePerMeter ? Number(cad.processingPricePerMeter) : null,
          shrinkagePercent: cad.shrinkagePercent ? Number(cad.shrinkagePercent) : null,
          shrinkageCostPerMeter: cad.shrinkageCostPerMeter ? Number(cad.shrinkageCostPerMeter) : null,
          screenCostPerMeter: cad.screenCostPerMeter ? Number(cad.screenCostPerMeter) : null,
          screenType: cad.screenType || null,
          totalCostPerMeter: cad.totalCostPerMeter ? Number(cad.totalCostPerMeter) : null,
          processorId: cad.processorId,
          processorName: cad.processor?.name || null,
          processorCode: cad.processor?.code || null,
          numberOfColors: cad.numberOfColors,
          costInputMode: cad.costInputMode,
          costingStyleId: cad.costingStyleId,
          isPreferred: cad.isPreferred,
        }));

        // Get greige cost - prioritize procurement cost over greige_master cost
        // If greige was procured, use the latest procurement rate
        // Otherwise fall back to greige_master.costPerMeter
        const latestGreigeProcurement = greige?.fabricProcurements?.[0];
        const greigeStockCost = latestGreigeProcurement?.ratePerUnit
          ? Number(latestGreigeProcurement.ratePerUnit)
          : null;
        const greigeDefaultCost = greige?.costPerMeter ? Number(greige.costPerMeter) : null;

        // Determine which greige cost to use (stock takes priority)
        const greigeCostPerMeter = greigeStockCost || greigeDefaultCost;
        const greigeCostSource = greigeStockCost ? 'GREIGE_PROCUREMENT' : 'GREIGE_MASTER';

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
          greigeDefaultCost, // Master default cost (for reference)
          greigeStockCost, // Procurement cost (if available)
          greigeCostPerMeter, // Actual cost to use (stock → default)
          greigeCostSource, // Source indicator
          greigeStockAvailable: latestGreigeProcurement ? Number(latestGreigeProcurement.quantityPurchased) : null,
          numberOfColors: styleFabric.numberOfColors || null,
          // Ready fabric cost - prioritizes stock cost if available
          readyFabricCost,
          // Source of the ready fabric cost
          readyFabricCostSource: latestStock?.weightedAvgCost ? 'STOCK' : 'FABRIC_MASTER',
          // Stock availability info
          stockAvailable: latestStock ? Number(latestStock.quantityAvailable) : null,
          // Include all width options with their costing data
          widthOptions,
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
 * Save fabric costing data to fabric_width_cad (preliminary costing before CAD approval)
 * After CAD approval, the selected width's cost will be copied to style_fabrics
 */
export async function saveFabricCosting(req: Request, res: Response) {
  try {
    const { styleId, fabricCostings } = req.body;

    if (!styleId || !fabricCostings || !Array.isArray(fabricCostings)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: styleId, fabricCostings',
      });
    }

    // Save each fabric costing to fabric_width_cad (upsert - create if not exists)
    const updates = await Promise.all(
      fabricCostings.map(async (costing: any) => {
        const fabricId = costing.fabricId;
        const cutableWidth = parseFloat(costing.cutableWidth);
        const componentName = costing.componentName || null;

        // Prepare costing data
        const costingData = {
          greigeId: costing.greigeId || null,
          greigeCostPerMeter: costing.greigeCostPerMeter ? parseFloat(costing.greigeCostPerMeter) : null,
          transportCostPerMeter: costing.transportCostPerMeter ? parseFloat(costing.transportCostPerMeter) : null,
          processingPricePerMeter: costing.processingCostPerMeter ? parseFloat(costing.processingCostPerMeter) : null,
          shrinkagePercent: costing.shrinkagePercent ? parseFloat(costing.shrinkagePercent) : null,
          shrinkageCostPerMeter: costing.shrinkageCostPerMeter ? parseFloat(costing.shrinkageCostPerMeter) : null,
          screenCostPerMeter: costing.screenCostPerMeter ? parseFloat(costing.screenCostPerMeter) : null,
          screenType: costing.screenType || null, // ROTARY, FLATBELT, or TABLE
          totalCostPerMeter: costing.totalCostPerMeter ? parseFloat(costing.totalCostPerMeter) : null,
          processorId: costing.processorId || null,
          numberOfColors: costing.numberOfColors ? parseInt(costing.numberOfColors) : null,
          costInputMode: costing.costInputMode || null,
          costingStyleId: styleId,
        };

        // If fabricWidthCadId is provided, update existing record
        if (costing.fabricWidthCadId) {
          return prisma.fabric_width_cad.update({
            where: { id: costing.fabricWidthCadId },
            data: costingData,
          });
        }

        // Otherwise, upsert based on fabricId + cutableWidth + componentName
        return prisma.fabric_width_cad.upsert({
          where: {
            fabricId_cutableWidth_componentName: {
              fabricId,
              cutableWidth,
              componentName,
            },
          },
          update: costingData,
          create: {
            fabricId,
            cutableWidth,
            componentName,
            ...costingData,
          },
        });
      })
    );

    res.json(serialize({
      success: true,
      data: {
        message: 'Fabric costing saved to fabric_width_cad successfully',
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
