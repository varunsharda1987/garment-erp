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
                        // Include latest greige procurement to get last procured rate
                        fabricProcurements: {
                          where: {
                            procurementType: 'GREIGE',
                            status: { in: ['RECEIVED', 'PROCESSING', 'COMPLETED'] },
                          },
                          orderBy: {
                            purchaseDate: 'desc',
                          },
                          take: 1, // Only need the latest procurement
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
                fabricCAD: {
                  include: {
                    // Include greige selected in CAD Planning
                    greige: {
                      include: {
                        fabricProcurements: {
                          where: {
                            procurementType: 'GREIGE',
                            status: { in: ['RECEIVED', 'PROCESSING', 'COMPLETED'] },
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
                selectedGreige: {
                  include: {
                    // Include latest greige procurement for selectedGreige as well
                    fabricProcurements: {
                      where: {
                        procurementType: 'GREIGE',
                        status: { in: ['RECEIVED', 'PROCESSING', 'COMPLETED'] },
                      },
                      orderBy: {
                        purchaseDate: 'desc',
                      },
                      take: 1, // Only need the latest procurement
                      select: {
                        id: true,
                        ratePerUnit: true,
                        quantityPurchased: true,
                        purchaseDate: true,
                      },
                    },
                  },
                },
                // CAD rows from CAD Planning (linked via styleFabricId)
                cadRows: {
                  where: {
                    cadMeters: { not: null }, // Only include rows with CAD data
                  },
                  include: {
                    greige: {
                      include: {
                        fabricProcurements: {
                          where: {
                            procurementType: 'GREIGE',
                            status: { in: ['RECEIVED', 'PROCESSING', 'COMPLETED'] },
                          },
                          orderBy: { purchaseDate: 'desc' },
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
                    processor: {
                      select: {
                        id: true,
                        name: true,
                        code: true,
                      },
                    },
                  },
                  orderBy: { cutableWidth: 'asc' },
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
    // NEW: Create ONE ROW per CAD width variant from cadRows (instead of one row per styleFabric)
    const fabricsForCosting: any[] = [];

    for (const component of style.style_components || []) {
      for (const styleFabric of component.style_fabrics || []) {
        // Get ready fabric cost - prioritize stock cost over fabric_master cost
        const latestStock = styleFabric.fabric?.fabricStock?.[0];
        const readyFabricCost = latestStock?.weightedAvgCost
          ? Number(latestStock.weightedAvgCost)
          : styleFabric.fabric?.costPerMeter
            ? Number(styleFabric.fabric.costPerMeter)
            : null;

        // Base fabric data shared by all width variants
        const baseFabricData = {
          styleFabricId: styleFabric.id,
          fabricId: styleFabric.fabricId,
          fabricName: styleFabric.fabric?.fabricName || styleFabric.fabricName || styleFabric.genericFabricName || 'Unknown',
          genericFabricName: styleFabric.genericFabricName || styleFabric.fabric?.genericFabricName,
          componentId: component.id,
          componentName: component.componentName,
          finishType: styleFabric.fabricFinishType || styleFabric.fabric?.finishType || null,
          numberOfColors: styleFabric.numberOfColors || null,
          readyFabricCost,
          readyFabricCostSource: latestStock?.weightedAvgCost ? 'STOCK' : 'FABRIC_MASTER',
          stockAvailable: latestStock ? Number(latestStock.quantityAvailable) : null,
        };

        // Get CAD rows from CAD Planning (linked via styleFabricId)
        const cadRows = (styleFabric as any).cadRows || [];

        if (cadRows.length > 0) {
          // Create ONE ROW per CAD width variant
          for (const cadRow of cadRows) {
            // Get greige from this CAD row
            const greige = cadRow.greige || styleFabric.selectedGreige || styleFabric.fabric?.greige;
            const greigeProcurements = greige?.fabricProcurements || [];
            const latestGreigeProcurement = greigeProcurements[0];
            const greigeDefaultCost = greige?.costPerMeter ? Number(greige.costPerMeter) : null;
            const latestProcurementRate = latestGreigeProcurement?.ratePerUnit
              ? Number(latestGreigeProcurement.ratePerUnit)
              : null;

            let greigeCostPerMeter: number | null = null;
            let greigeCostSource: 'GREIGE_PROCUREMENT' | 'GREIGE_MASTER' = 'GREIGE_MASTER';

            if (latestProcurementRate !== null) {
              greigeCostPerMeter = latestProcurementRate;
              greigeCostSource = 'GREIGE_PROCUREMENT';
            } else if (greigeDefaultCost !== null) {
              greigeCostPerMeter = greigeDefaultCost;
              greigeCostSource = 'GREIGE_MASTER';
            }

            // Use stored cadAverage (per-piece consumption) directly from DB
            const cadMeters = cadRow.cadAverage ? Number(cadRow.cadAverage) : null;
            const width = cadRow.cutableWidth ? Number(cadRow.cutableWidth) : null;

            fabricsForCosting.push({
              // Use cadRow.id as the unique identifier for this row
              id: cadRow.id,
              ...baseFabricData,
              cadMeters, // Per-piece consumption from cadAverage
              width, // Cutable width for this variant
              purpose: cadRow.purpose || null, // PLANNING, COSTING, PRODUCTION
              greigeId: greige?.id || null,
              greigeName: greige?.greigeName || null,
              greigeCode: greige?.greigeCode || null,
              greigeDefaultCost,
              greigeStockCost: latestProcurementRate,
              greigeCostPerMeter,
              greigeCostSource,
              greigeStockAvailable: latestGreigeProcurement ? Number(latestGreigeProcurement.quantityPurchased) : null,
              // Include existing costing data from CAD row if available
              processorId: cadRow.processorId || null,
              processorName: cadRow.processor?.name || null,
              processorCode: cadRow.processor?.code || null,
              greigeCostPerMeterSaved: cadRow.greigeCostPerMeter ? Number(cadRow.greigeCostPerMeter) : null,
              transportCostPerMeter: cadRow.transportCostPerMeter ? Number(cadRow.transportCostPerMeter) : null,
              processingPricePerMeter: cadRow.processingPricePerMeter ? Number(cadRow.processingPricePerMeter) : null,
              shrinkagePercent: cadRow.shrinkagePercent ? Number(cadRow.shrinkagePercent) : null,
              shrinkageCostPerMeter: cadRow.shrinkageCostPerMeter ? Number(cadRow.shrinkageCostPerMeter) : null,
              screenCostPerMeter: cadRow.screenCostPerMeter ? Number(cadRow.screenCostPerMeter) : null,
              screenType: cadRow.screenType || null,
              totalCostPerMeter: cadRow.totalCostPerMeter ? Number(cadRow.totalCostPerMeter) : null,
              costInputMode: cadRow.costInputMode || null,
              isPreferred: cadRow.isPreferred || false,
              // No widthOptions needed since each row IS a width option
              widthOptions: [],
            });
          }
        } else {
          // Fallback: No CAD rows - create single row with legacy data
          const greige = styleFabric.fabricCAD?.greige || styleFabric.selectedGreige || styleFabric.fabric?.greige;
          const greigeProcurements = greige?.fabricProcurements || [];
          const latestGreigeProcurement = greigeProcurements[0];
          const greigeDefaultCost = greige?.costPerMeter ? Number(greige.costPerMeter) : null;
          const latestProcurementRate = latestGreigeProcurement?.ratePerUnit
            ? Number(latestGreigeProcurement.ratePerUnit)
            : null;

          let greigeCostPerMeter: number | null = null;
          let greigeCostSource: 'GREIGE_PROCUREMENT' | 'GREIGE_MASTER' = 'GREIGE_MASTER';

          if (latestProcurementRate !== null) {
            greigeCostPerMeter = latestProcurementRate;
            greigeCostSource = 'GREIGE_PROCUREMENT';
          } else if (greigeDefaultCost !== null) {
            greigeCostPerMeter = greigeDefaultCost;
            greigeCostSource = 'GREIGE_MASTER';
          }

          // Use legacy cadAverageMeters or fabricCAD
          let cadMeters: number | null = null;
          if (styleFabric.cadAverageMeters) {
            cadMeters = Number(styleFabric.cadAverageMeters);
          } else if (styleFabric.fabricCAD?.cadAverage) {
            cadMeters = Number(styleFabric.fabricCAD.cadAverage);
          }

          const width = styleFabric.fabricCAD?.cutableWidth
            ? Number(styleFabric.fabricCAD.cutableWidth)
            : styleFabric.cutableWidth
              ? Number(styleFabric.cutableWidth)
              : styleFabric.fabric?.cutableWidth
                ? Number(styleFabric.fabric.cutableWidth)
                : null;

          fabricsForCosting.push({
            id: styleFabric.id,
            ...baseFabricData,
            cadMeters,
            width,
            purpose: null,
            greigeId: greige?.id || null,
            greigeName: greige?.greigeName || null,
            greigeCode: greige?.greigeCode || null,
            greigeDefaultCost,
            greigeStockCost: latestProcurementRate,
            greigeCostPerMeter,
            greigeCostSource,
            greigeStockAvailable: latestGreigeProcurement ? Number(latestGreigeProcurement.quantityPurchased) : null,
            widthOptions: [],
          });
        }
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
      // Check what rate cards exist for this processor to provide helpful error messages
      const availableRates = await prisma.processor_rate_card.findMany({
        where: {
          processorId,
          processingType,
          isActive: true,
        },
        include: {
          greige: { select: { id: true, greigeName: true } },
          slab: { select: { id: true, slabLabel: true, minQuantity: true, maxQuantity: true } },
        },
        take: 10,
      });

      // Check if greige exists but with different printingType
      const greigeMatch = availableRates.find(rc => rc.greigeId === greigeId);
      const printTypeMatch = availableRates.find(rc => rc.printingType === printingType);

      // Get the requested greige name for error message
      const requestedGreige = await prisma.greige_master.findUnique({
        where: { id: greigeId },
        select: { greigeName: true },
      });

      let errorDetail = '';
      if (greigeMatch && !printTypeMatch) {
        errorDetail = `Greige found but not for ${printingType} printing type.`;
      } else if (!greigeMatch && printTypeMatch) {
        errorDetail = `No rate card for greige "${requestedGreige?.greigeName || greigeId}". `;
        if (availableRates.length > 0) {
          const availableGreiges = [...new Set(availableRates.map(rc => rc.greige?.greigeName))].filter(Boolean).slice(0, 3);
          errorDetail += `Available greiges: ${availableGreiges.join(', ')}`;
        }
      } else if (!greigeMatch && !printTypeMatch) {
        errorDetail = `No rate card for this processor/printing type combination.`;
      }

      return res.status(404).json({
        success: false,
        error: `No rate found for the given criteria. ${errorDetail}`,
        debug: {
          requestedGreigeId: greigeId,
          requestedGreigeName: requestedGreige?.greigeName,
          requestedPrintingType: printingType,
          quantityMeters: parseFloat(quantityMeters),
          availableGreiges: availableRates.map(rc => ({
            greigeId: rc.greigeId,
            greigeName: rc.greige?.greigeName,
            printingType: rc.printingType,
          })),
        },
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

    // Validate that cost values are non-negative
    for (const costing of fabricCostings) {
      const costFields = [
        costing.totalCostPerMeter,
        costing.greigeCostPerMeter,
        costing.transportCostPerMeter,
        costing.processingCostPerMeter,
        costing.shrinkageCostPerMeter,
        costing.screenCostPerMeter,
      ];
      for (const cost of costFields) {
        if (cost !== null && cost !== undefined && cost < 0) {
          return res.status(400).json({
            success: false,
            error: 'Cost values cannot be negative',
          });
        }
      }
    }

    // REPEAT ORDER DETECTION: Check if style has previous PRODUCTION costings
    // If yes, this is a repeat order - auto-upgrade all new costings to PRODUCTION mode
    const hasProductionCostings = await prisma.fabric_width_cad.findFirst({
      where: {
        costingStyleId: styleId,
        purpose: 'PRODUCTION',
        isLocked: true,
      },
    });

    const isRepeatOrder = !!hasProductionCostings;

    // Save each fabric costing to fabric_width_cad (upsert - create if not exists)
    const updates = await Promise.all(
      fabricCostings.map(async (costing: any) => {
        const fabricId = costing.fabricId;
        const cutableWidth = parseFloat(costing.cutableWidth);
        const componentName = costing.componentName || null;

        // Determine purpose: For repeat orders, auto-upgrade to PRODUCTION
        // Repeat orders skip PLANNING/COSTING workflow entirely
        // Mode names: COSTING (was PLANNING), RAW_MATERIAL_CALCULATION (was COSTING), PRODUCTION (unchanged)
        const effectivePurpose = isRepeatOrder ? 'PRODUCTION' : (costing.purpose || 'COSTING');

        // Prepare costing data
        const costingData = {
          styleFabricId: costing.styleFabricId || null, // Link to style_fabrics for proper grouping
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
          orderQuantityPcs: costing.orderQuantityPcs ? parseInt(costing.orderQuantityPcs) : null,
          cadMeters: costing.cadMeters ? parseFloat(costing.cadMeters) : null,
          purpose: effectivePurpose, // Auto-upgraded to PRODUCTION for repeat orders
          isLocked: isRepeatOrder, // Lock PRODUCTION costings for repeat orders
        };

        // If fabricWidthCadId is provided, update existing record
        if (costing.fabricWidthCadId) {
          return prisma.fabric_width_cad.update({
            where: { id: costing.fabricWidthCadId },
            data: costingData,
          });
        }

        // Upsert based on costingStyleId + componentName + styleFabricId + cutableWidth + purpose
        // (styleFabricId added for multi-fabric same-component support)
        return prisma.fabric_width_cad.upsert({
          where: {
            costingStyleId_componentName_styleFabricId_cutableWidth_purpose: {
              costingStyleId: styleId,
              componentName,
              styleFabricId: costing.styleFabricId || null,
              cutableWidth,
              purpose: effectivePurpose, // Use effective purpose (PRODUCTION for repeat orders)
            },
          },
          update: costingData,
          create: {
            fabricId: fabricId || null, // Optional - may be null for generic fabrics
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
        message: isRepeatOrder
          ? 'Repeat order detected - costings saved directly to PRODUCTION mode'
          : 'Fabric costing saved to fabric_width_cad successfully',
        updatedCount: updates.length,
        isRepeatOrder,
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

/**
 * GET /api/fabric-costing/options
 * Get all costing options with filtering - grouped by style and component
 */
export async function getCostingOptions(req: Request, res: Response) {
  try {
    const { customerId, styleId, processorId, status, purpose, page = '1', limit = '10' } = req.query;

    // Build filter for fabric_width_cad
    const where: any = {
      costingStyleId: { not: null }, // Only records with costing data
      totalCostPerMeter: { not: null }, // Only calculated costings
    };

    if (styleId) where.costingStyleId = styleId as string;
    if (processorId) where.processorId = processorId as string;
    if (status === 'APPROVED') where.approvalStatus = 'APPROVED';
    if (status === 'PENDING') {
      where.OR = [
        { approvalStatus: null },
        { approvalStatus: { not: 'APPROVED' } },
      ];
    }

    // Filter by workflow purpose
    if (purpose && purpose !== 'ALL') {
      where.purpose = purpose as string;
    }

    // If customerId filter, we need to join through brand_categories
    const styleFilter: any = customerId
      ? { brand_categories: { customerId: customerId as string } }
      : {};

    const options = await prisma.fabric_width_cad.findMany({
      where: {
        ...where,
        costingStyle: styleFilter,
      },
      include: {
        processor: { select: { id: true, name: true, code: true } },
        greige: { select: { id: true, greigeName: true, greigeCode: true } },
        costingStyle: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
            customerName: true,
            brand_categories: {
              select: {
                customerId: true,
                customer: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { costingStyleId: 'asc' },
        { componentName: 'asc' },
        { totalCostPerMeter: 'asc' },
      ],
    });

    // Group by style, then by component
    const groupedByStyle: Record<string, {
      style: {
        id: string;
        styleCode: string;
        styleName: string;
        customerName: string | null;
        customerId: string | null;
      };
      components: Record<string, any[]>;
    }> = {};

    for (const option of options) {
      const styleIdKey = option.costingStyleId!;
      const componentKey = option.componentName || 'Unknown';

      if (!groupedByStyle[styleIdKey]) {
        // Get customer info from brand_categories or use customerName field
        const brandCategory = option.costingStyle?.brand_categories;
        const customerName = brandCategory?.customer?.name || option.costingStyle?.customerName || null;
        const customerId = brandCategory?.customerId || null;

        groupedByStyle[styleIdKey] = {
          style: {
            id: styleIdKey,
            styleCode: option.costingStyle?.styleCode || '',
            styleName: option.costingStyle?.styleName || '',
            customerName,
            customerId,
          },
          components: {},
        };
      }

      if (!groupedByStyle[styleIdKey].components[componentKey]) {
        groupedByStyle[styleIdKey].components[componentKey] = [];
      }

      // Mark lowest cost option per component
      const isLowestCost = groupedByStyle[styleIdKey].components[componentKey].length === 0;

      groupedByStyle[styleIdKey].components[componentKey].push({
        id: option.id,
        styleFabricId: option.styleFabricId, // For grouping same-fabric different-properties
        fabricId: option.fabricId,
        greigeName: option.greige?.greigeName || null,
        greigeCode: option.greige?.greigeCode || null,
        cutableWidth: option.cutableWidth,
        processorId: option.processorId,
        processorName: option.processor?.name || null,
        processorCode: option.processor?.code || null,
        greigeCostPerMeter: option.greigeCostPerMeter,
        transportCostPerMeter: option.transportCostPerMeter,
        processingPricePerMeter: option.processingPricePerMeter,
        shrinkagePercent: option.shrinkagePercent,
        shrinkageCostPerMeter: option.shrinkageCostPerMeter,
        screenCostPerMeter: option.screenCostPerMeter,
        screenType: option.screenType,
        numberOfColors: option.numberOfColors,
        totalCostPerMeter: option.totalCostPerMeter,
        costInputMode: option.costInputMode,
        isPreferred: option.isPreferred,
        approvalStatus: option.approvalStatus,
        approvedBy: option.approvedBy,
        approvedAt: option.approvedAt,
        isLowestCost,
        orderQuantityPcs: option.orderQuantityPcs,
        cadMeters: option.cadMeters,
        purpose: option.purpose || 'COSTING', // Workflow mode (COSTING was formerly PLANNING)
        isLocked: option.isLocked || false,
        createdAt: option.createdAt,
        updatedAt: option.updatedAt,
      });
    }

    // Paginate by styles
    const styleIds = Object.keys(groupedByStyle);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIdx = (pageNum - 1) * limitNum;
    const paginatedStyleIds = styleIds.slice(startIdx, startIdx + limitNum);

    const paginatedData: typeof groupedByStyle = {};
    for (const sid of paginatedStyleIds) {
      paginatedData[sid] = groupedByStyle[sid];
    }

    // Get counts by purpose (for purpose tabs)
    const purposeCounts = await prisma.fabric_width_cad.groupBy({
      by: ['purpose'],
      where: {
        costingStyleId: { not: null },
        totalCostPerMeter: { not: null },
      },
      _count: { id: true },
    });

    // Mode names: COSTING (was PLANNING), RAW_MATERIAL_CALCULATION (was COSTING), PRODUCTION (unchanged)
    const purposeCountsFormatted = {
      all: purposeCounts.reduce((sum, c) => sum + c._count.id, 0),
      costing: purposeCounts.find(c => c.purpose === 'COSTING')?._count.id || 0,
      rawMaterialCalculation: purposeCounts.find(c => c.purpose === 'RAW_MATERIAL_CALCULATION')?._count.id || 0,
      production: purposeCounts.find(c => c.purpose === 'PRODUCTION')?._count.id || 0,
    };

    res.json(serialize({
      success: true,
      data: paginatedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalStyles: styleIds.length,
        totalPages: Math.ceil(styleIds.length / limitNum),
        totalOptions: options.length,
      },
      purposeCounts: purposeCountsFormatted,
    }));
  } catch (error: any) {
    console.error('Error getting costing options:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get costing options',
    });
  }
}

/**
 * POST /api/fabric-costing/option/:optionId/approve
 * Approve a costing option - marks it as preferred and unapproves others for same component
 */
export async function approveCostingOption(req: Request, res: Response) {
  try {
    const { optionId } = req.params;
    const userId = (req as any).user?.id || null; // From auth middleware

    // Get the option to find its component/style
    const option = await prisma.fabric_width_cad.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      return res.status(404).json({
        success: false,
        error: 'Costing option not found',
      });
    }

    // Prevent modifying locked PRODUCTION records
    if (option.isLocked) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify locked PRODUCTION costing option',
      });
    }

    if (!option.costingStyleId) {
      return res.status(400).json({
        success: false,
        error: 'Option missing style reference',
      });
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Mark other options of SAME STYLE FABRIC as ALTERNATE_APPROVED (instead of unapproving)
      // This allows multiple widths to be approved - one as primary per style fabric assignment, others as alternates
      // Key change: Group by styleFabricId so each fabric assignment (e.g., plain vs embroidered) can have its own approval
      await tx.fabric_width_cad.updateMany({
        where: {
          costingStyleId: option.costingStyleId,
          componentName: option.componentName,
          fabricId: option.fabricId,              // Same base fabric
          greigeId: option.greigeId,              // Same greige
          styleFabricId: option.styleFabricId,    // Same style fabric assignment (key for embroidery differentiation)
          patternPartId: option.patternPartId,    // Same pattern part
          id: { not: optionId },
          // Only mark as alternate if they have costing data
          totalCostPerMeter: { not: null },
        },
        data: {
          isPreferred: false,
          approvalStatus: 'ALTERNATE_APPROVED',
          // Keep existing approvedBy/approvedAt or set new ones
        },
      });

      // Also clear approval for options without costing data (same style fabric grouping)
      await tx.fabric_width_cad.updateMany({
        where: {
          costingStyleId: option.costingStyleId,
          componentName: option.componentName,
          fabricId: option.fabricId,              // Same base fabric
          greigeId: option.greigeId,              // Same greige
          styleFabricId: option.styleFabricId,    // Same style fabric assignment (key for embroidery differentiation)
          patternPartId: option.patternPartId,    // Same pattern part
          id: { not: optionId },
          totalCostPerMeter: null,
        },
        data: {
          isPreferred: false,
          approvalStatus: null,
        },
      });

      // Set this option as the PRIMARY approved option
      const updated = await tx.fabric_width_cad.update({
        where: { id: optionId },
        data: {
          isPreferred: true,
          approvalStatus: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
        },
        include: {
          processor: { select: { id: true, name: true, code: true } },
          greige: { select: { id: true, greigeName: true, greigeCode: true } },
        },
      });

      return updated;
    });

    res.json(serialize({
      success: true,
      data: result,
      message: 'Costing option approved successfully',
    }));
  } catch (error: any) {
    console.error('Error approving costing option:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve costing option',
    });
  }
}

/**
 * PATCH /api/fabric-costing/options/:optionId/unapprove
 * Unapprove a costing option - revert to Pending status
 */
export async function unapproveCostingOption(req: Request, res: Response) {
  try {
    const { optionId } = req.params;

    // Get the option first
    const option = await prisma.fabric_width_cad.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      return res.status(404).json({
        success: false,
        error: 'Costing option not found',
      });
    }

    // Prevent modifying locked PRODUCTION records
    if (option.isLocked) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify locked PRODUCTION costing option',
      });
    }

    // Update to remove approval status
    const updated = await prisma.fabric_width_cad.update({
      where: { id: optionId },
      data: {
        approvalStatus: null,
        approvedBy: null,
        approvedAt: null,
        isPreferred: false,
      },
    });

    return res.json({
      success: true,
      data: updated,
      message: 'Costing option unapproved successfully',
    });
  } catch (error: any) {
    console.error('Error unapproving costing option:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to unapprove costing option',
    });
  }
}

/**
 * DELETE /api/fabric-costing/option/:optionId
 * Delete a costing option
 */
export async function deleteCostingOption(req: Request, res: Response) {
  try {
    const { optionId } = req.params;

    // Check if option exists
    const option = await prisma.fabric_width_cad.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      return res.status(404).json({
        success: false,
        error: 'Costing option not found',
      });
    }

    // Prevent deleting locked PRODUCTION records
    if (option.isLocked) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete locked PRODUCTION costing option',
      });
    }

    await prisma.fabric_width_cad.delete({
      where: { id: optionId },
    });

    res.json(serialize({
      success: true,
      message: 'Costing option deleted successfully',
    }));
  } catch (error: any) {
    console.error('Error deleting costing option:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete costing option',
    });
  }
}

/**
 * GET /api/fabric-costing/style/:styleId/options
 * Get all costing options for a specific style - grouped by component
 */
export async function getStyleCostingOptions(req: Request, res: Response) {
  try {
    const { styleId } = req.params;

    const options = await prisma.fabric_width_cad.findMany({
      where: {
        costingStyleId: styleId,
        totalCostPerMeter: { not: null },
      },
      include: {
        processor: { select: { id: true, name: true, code: true } },
        greige: { select: { id: true, greigeName: true, greigeCode: true } },
        patternPart: { select: { id: true, code: true, name: true } },
        styleFabric: { select: { id: true, hasEmbroidery: true, fabricName: true } },
      },
      orderBy: [
        { componentName: 'asc' },
        { styleFabricId: 'asc' },
        { patternPartId: 'asc' },
        { totalCostPerMeter: 'asc' },
      ],
    });

    // Group by component + styleFabric (so each fabric assignment can be approved independently)
    // This allows same base fabric with different properties (e.g., embroidery) to be separate groups
    const groupedByComponent: Record<string, any[]> = {};

    for (const option of options) {
      // Create unique group key per style fabric assignment
      // If styleFabric has embroidery, append " - Embroidered" to differentiate
      const baseComponentName = option.componentName || 'Unknown';
      const hasEmbroidery = option.styleFabric?.hasEmbroidery || false;
      const componentKey = hasEmbroidery
        ? `${baseComponentName} - Embroidered`
        : baseComponentName;

      if (!groupedByComponent[componentKey]) {
        groupedByComponent[componentKey] = [];
      }

      // Mark lowest cost option per component
      const isLowestCost = groupedByComponent[componentKey].length === 0;

      groupedByComponent[componentKey].push({
        id: option.id,
        fabricId: option.fabricId,
        styleFabricId: option.styleFabricId,
        hasEmbroidery: option.styleFabric?.hasEmbroidery || false,
        styleFabricName: option.styleFabric?.fabricName || null,
        greigeName: option.greige?.greigeName || null,
        greigeCode: option.greige?.greigeCode || null,
        greigeId: option.greigeId,
        cutableWidth: option.cutableWidth,
        processorId: option.processorId,
        processorName: option.processor?.name || null,
        processorCode: option.processor?.code || null,
        patternPartId: option.patternPartId,
        patternPartCode: option.patternPart?.code || null,
        patternPartName: option.patternPart?.name || null,
        greigeCostPerMeter: option.greigeCostPerMeter,
        transportCostPerMeter: option.transportCostPerMeter,
        processingPricePerMeter: option.processingPricePerMeter,
        shrinkagePercent: option.shrinkagePercent,
        shrinkageCostPerMeter: option.shrinkageCostPerMeter,
        screenCostPerMeter: option.screenCostPerMeter,
        screenType: option.screenType,
        numberOfColors: option.numberOfColors,
        totalCostPerMeter: option.totalCostPerMeter,
        costInputMode: option.costInputMode,
        isPreferred: option.isPreferred,
        approvalStatus: option.approvalStatus,
        approvedBy: option.approvedBy,
        approvedAt: option.approvedAt,
        isLowestCost,
        orderQuantityPcs: option.orderQuantityPcs,
        cadMeters: option.cadMeters,
        createdAt: option.createdAt,
        updatedAt: option.updatedAt,
      });
    }

    // Count stats
    const totalOptions = options.length;
    const approvedCount = options.filter(o => o.approvalStatus === 'APPROVED').length;
    const componentCount = Object.keys(groupedByComponent).length;
    const allComponentsApproved = Object.values(groupedByComponent).every(
      opts => opts.some(o => o.approvalStatus === 'APPROVED')
    );

    res.json(serialize({
      success: true,
      data: groupedByComponent,
      summary: {
        totalOptions,
        approvedCount,
        componentCount,
        allComponentsApproved,
      },
    }));
  } catch (error: any) {
    console.error('Error getting style costing options:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get style costing options',
    });
  }
}

/**
 * POST /api/fabric-costing/option/:optionId/promote
 * Promote a costing option to the next workflow stage
 * PLANNING → COSTING → PRODUCTION
 * Creates a copy with the new purpose (original remains for audit)
 */
export async function promoteCostingOption(req: Request, res: Response) {
  try {
    const { optionId } = req.params;
    const { targetPurpose } = req.body;

    // Validate target purpose
    // Mode names: COSTING (was PLANNING), RAW_MATERIAL_CALCULATION (was COSTING), PRODUCTION (unchanged)
    const validPurposes = ['RAW_MATERIAL_CALCULATION', 'PRODUCTION'];
    if (!targetPurpose || !validPurposes.includes(targetPurpose)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid target purpose. Must be RAW_MATERIAL_CALCULATION or PRODUCTION.',
      });
    }

    // Get the option
    const option = await prisma.fabric_width_cad.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      return res.status(404).json({
        success: false,
        error: 'Costing option not found',
      });
    }

    // Check if option is approved (required for promotion)
    if (option.approvalStatus !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        error: 'Option must be approved before promotion',
      });
    }

    // Define valid transitions
    // Mode names: COSTING (was PLANNING) → RAW_MATERIAL_CALCULATION (was COSTING) → PRODUCTION
    const validPaths = [
      { from: 'COSTING', to: 'RAW_MATERIAL_CALCULATION' },
      { from: null, to: 'RAW_MATERIAL_CALCULATION' }, // Legacy records without purpose
      { from: 'RAW_MATERIAL_CALCULATION', to: 'PRODUCTION' },
    ];

    const currentPurpose = option.purpose || 'COSTING';
    const isValid = validPaths.some(
      p => (p.from === currentPurpose || (p.from === null && !option.purpose)) && p.to === targetPurpose
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: `Invalid transition: ${currentPurpose} → ${targetPurpose}`,
      });
    }

    // Create copy with new purpose (original remains for audit trail)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, ...data } = option;

    const promoted = await prisma.fabric_width_cad.create({
      data: {
        ...data,
        purpose: targetPurpose,
        approvalStatus: 'PENDING', // Needs approval in new stage
        approvedBy: null,
        approvedAt: null,
        isPreferred: false, // Reset preference in new stage
        isLocked: targetPurpose === 'PRODUCTION', // Lock PRODUCTION records
      },
      include: {
        processor: { select: { id: true, name: true, code: true } },
        greige: { select: { id: true, greigeName: true, greigeCode: true } },
      },
    });

    res.json(serialize({
      success: true,
      data: promoted,
      message: `Costing option promoted to ${targetPurpose} successfully`,
    }));
  } catch (error: any) {
    console.error('Error promoting costing option:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to promote costing option',
    });
  }
}

/**
 * POST /api/fabric-costing/styles/costing-status
 * Get costing status for multiple styles at once
 * Returns: { styleId: { hasCosting, hasPending, hasApproved, hasProduction } }
 */
export async function getStylesCostingStatus(req: Request, res: Response) {
  try {
    const { styleIds } = req.body;

    if (!styleIds || !Array.isArray(styleIds) || styleIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: styleIds (array)',
      });
    }

    // Get costing status for each style
    const statusPromises = styleIds.map(async (styleId: string) => {
      const costings = await prisma.fabric_width_cad.findMany({
        where: {
          costingStyleId: styleId,
          totalCostPerMeter: { not: null },
        },
        select: {
          id: true,
          purpose: true,
          approvalStatus: true,
          isLocked: true,
        },
      });

      const hasCosting = costings.length > 0;
      const hasApproved = costings.some(c => c.approvalStatus === 'APPROVED' || c.approvalStatus === 'ALTERNATE_APPROVED');
      const hasProduction = costings.some(c => c.purpose === 'PRODUCTION' && c.isLocked);
      const hasPending = hasCosting && !hasApproved;

      return {
        styleId,
        status: {
          hasCosting,
          hasPending,
          hasApproved,
          hasProduction,
          costingCount: costings.length,
        },
      };
    });

    const results = await Promise.all(statusPromises);

    // Convert to object keyed by styleId
    const statusMap = results.reduce((acc, item) => {
      acc[item.styleId] = item.status;
      return acc;
    }, {} as Record<string, any>);

    res.json(serialize({
      success: true,
      data: statusMap,
    }));
  } catch (error: any) {
    console.error('Error getting styles costing status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get costing status',
    });
  }
}

/**
 * POST /api/fabric-costing/check-cad-status
 * Check which CAD rows already have costing data
 * Returns counts and details of new vs existing records
 */
export async function checkCADCostingStatus(req: Request, res: Response) {
  try {
    const { styleId, cadRowIds } = req.body;

    if (!styleId || !cadRowIds || !Array.isArray(cadRowIds)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: styleId, cadRowIds (array)',
      });
    }

    // Fetch CAD rows
    const cadRows = await prisma.fabric_width_cad.findMany({
      where: {
        id: { in: cadRowIds },
      },
      include: {
        greige: { select: { id: true, greigeName: true, greigeCode: true } },
      },
    });

    // Check which rows already have costing (costingStyleId is set)
    const existingRows: any[] = [];
    const newRows: any[] = [];

    for (const row of cadRows) {
      if (row.costingStyleId && row.totalCostPerMeter !== null) {
        existingRows.push({
          id: row.id,
          greigeId: row.greigeId,
          greigeName: row.greige?.greigeName || null,
          width: row.cutableWidth,
          totalCostPerMeter: row.totalCostPerMeter,
        });
      } else {
        newRows.push({
          id: row.id,
          greigeId: row.greigeId,
          greigeName: row.greige?.greigeName || null,
          width: row.cutableWidth,
        });
      }
    }

    res.json(serialize({
      success: true,
      data: {
        newCount: newRows.length,
        existingCount: existingRows.length,
        newRows,
        existingRows,
      },
    }));
  } catch (error: any) {
    console.error('Error checking CAD costing status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check CAD costing status',
    });
  }
}

/**
 * POST /api/fabric-costing/push-from-cad
 * Create fabric costing records from CAD rows
 * Fetches greige cost from latest procurement and initializes costing fields
 */
export async function pushFromCAD(req: Request, res: Response) {
  try {
    const { styleId, cadRowIds } = req.body;

    if (!styleId || !cadRowIds || !Array.isArray(cadRowIds)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: styleId, cadRowIds (array)',
      });
    }

    // Fetch CAD rows with greige and procurement info
    const cadRows = await prisma.fabric_width_cad.findMany({
      where: {
        id: { in: cadRowIds },
      },
      include: {
        greige: {
          include: {
            fabricProcurements: {
              where: {
                status: { in: ['RECEIVED', 'COMPLETED'] } // Use received/completed procurements
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                ratePerUnit: true, // Correct field name from schema
                totalCost: true,
                quantityPurchased: true,
              },
            },
          },
        },
      },
    });

    const createdRows: any[] = [];
    const skippedRows: any[] = [];

    for (const row of cadRows) {
      // Skip if already has costing
      if (row.costingStyleId && row.totalCostPerMeter !== null) {
        skippedRows.push({
          id: row.id,
          reason: 'Already has costing data',
        });
        continue;
      }

      // Get greige cost from latest procurement
      const latestProcurement = row.greige?.fabricProcurements?.[0];
      const greigeCostPerMeter = latestProcurement?.ratePerUnit
        ? parseFloat(latestProcurement.ratePerUnit.toString())
        : null;
      // Note: transport cost is not tracked separately in fabric_procurement
      // It's included in the ratePerUnit or we default to 0
      const transportCostPerMeter = 0;

      // Calculate initial total (greige + transport, no processing yet)
      const totalCostPerMeter = greigeCostPerMeter !== null
        ? greigeCostPerMeter + transportCostPerMeter
        : null;

      // Update CAD row with costing fields
      const updated = await prisma.fabric_width_cad.update({
        where: { id: row.id },
        data: {
          costingStyleId: styleId,
          greigeCostPerMeter,
          transportCostPerMeter,
          totalCostPerMeter,
          // Initialize other costing fields
          processingPricePerMeter: 0,
          shrinkagePercent: 0,
          shrinkageCostPerMeter: 0,
          screenCostPerMeter: 0,
          costInputMode: 'BUILD_UP',
        },
      });

      createdRows.push({
        id: updated.id,
        greigeId: updated.greigeId,
        greigeCostPerMeter,
        transportCostPerMeter,
        totalCostPerMeter,
      });
    }

    res.json(serialize({
      success: true,
      data: {
        created: createdRows.length,
        skipped: skippedRows.length,
        createdRows,
        skippedRows,
      },
    }));
  } catch (error: any) {
    console.error('Error pushing CAD to fabric costing:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to push CAD to fabric costing',
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
  getCostingOptions,
  approveCostingOption,
  deleteCostingOption,
  getStyleCostingOptions,
  promoteCostingOption,
  getStylesCostingStatus,
  checkCADCostingStatus,
  pushFromCAD,
};
