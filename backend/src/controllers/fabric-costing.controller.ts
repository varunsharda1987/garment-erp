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
import { NotFoundError, ValidationError, ForbiddenError } from '../errors';

/**
 * POST /api/fabric-costing/calculate
 * Calculate fabric cost with all sourcing options
 */
export async function calculateSingleFabricCost(req: Request, res: Response) {
  const { fabricId, cadMeters, width, orderQuantity, styleId } = req.body;

  // Validation
  if (!fabricId || !cadMeters || !width) {
    throw new ValidationError('Missing required fields: fabricId, cadMeters, width');
  }

  // BUG-FC6 fix: Add NaN guards for parseFloat/parseInt
  const parsedCadMeters = parseFloat(cadMeters);
  const parsedWidth = parseFloat(width);
  const parsedOrderQty = orderQuantity ? parseInt(orderQuantity, 10) : undefined;

  if (isNaN(parsedCadMeters) || isNaN(parsedWidth)) {
    throw new ValidationError('cadMeters and width must be valid numbers');
  }
  if (parsedOrderQty !== undefined && isNaN(parsedOrderQty)) {
    throw new ValidationError('orderQuantity must be a valid number');
  }

  const result = await calculateFabricCost({
    fabricId,
    cadMeters: parsedCadMeters,
    width: parsedWidth,
    orderQuantity: parsedOrderQty,
    styleId,
  });

  res.json(
    serialize({
      success: true,
      data: result,
    })
  );
}

/**
 * POST /api/fabric-costing/batch-calculate
 * Calculate costs for multiple fabrics
 */
export async function calculateBatchFabricCost(req: Request, res: Response) {
  const { fabrics, orderQuantity, styleId } = req.body;

  if (!fabrics || !Array.isArray(fabrics) || fabrics.length === 0) {
    throw new ValidationError('Missing or invalid fabrics array');
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
  const totalRecommendedCost = successfulResults.reduce((sum: number, r: any) => sum + (r.recommendedCost || 0), 0);
  const totalSavings = successfulResults.reduce((sum: number, r: any) => sum + (r.savings || 0), 0);

  res.json(
    serialize({
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
    })
  );
}

/**
 * GET /api/fabric-costing/processors
 * Get all DYEING_PRINTING processors for dropdown selection
 */
export async function getProcessors(req: Request, res: Response) {
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

  res.json(
    serialize({
      success: true,
      data: processors,
    })
  );
}

/**
 * GET /api/fabric-costing/style/:styleId
 * Get fabrics from a style with greige data for fabric costing
 * Also includes existing fabric_width_cad records with saved costing data
 */
export async function getStyleFabrics(req: Request, res: Response) {
  const { styleId } = req.params;
  const { purpose } = req.query; // Filter by costing purpose (COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION)

  if (!styleId) {
    throw new ValidationError('styleId is required');
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
                        take: 1,
                        select: {
                          id: true,
                          ratePerUnit: true,
                          quantityPurchased: true,
                          purchaseDate: true,
                        },
                      },
                      // Include latest greige stock for direct stock entries
                      greigeStock: {
                        where: {
                          purchaseCost: { not: null },
                        },
                        orderBy: {
                          receivedDate: 'desc',
                        },
                        take: 1,
                        select: {
                          id: true,
                          purchaseCost: true,
                          receivedDate: true,
                        },
                      },
                      // Include finished fabrics for generic fabric stock badge fallback
                      finishedFabrics: {
                        select: {
                          colorMasterId: true,
                          colorName: true,
                          finishType: true,
                          fabricStock: {
                            select: {
                              weightedAvgCost: true,
                              quantityAvailable: true,
                              cutableWidth: true,
                            },
                          },
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
                  // Include ALL available stock lots: latest lot drives readyFabricCost,
                  // the full list drives total + per-width stock availability (MRP parity)
                  fabricStock: {
                    where: {
                      status: 'AVAILABLE',
                      quantityAvailable: { gt: 0 },
                    },
                    orderBy: {
                      receivedDate: 'desc',
                    },
                    select: {
                      id: true,
                      weightedAvgCost: true,
                      quantityAvailable: true,
                      cutableWidth: true,
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
                      greigeStock: {
                        where: {
                          purchaseCost: { not: null },
                        },
                        orderBy: {
                          receivedDate: 'desc',
                        },
                        take: 1,
                        select: {
                          id: true,
                          purchaseCost: true,
                          receivedDate: true,
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
                    take: 1,
                    select: {
                      id: true,
                      ratePerUnit: true,
                      quantityPurchased: true,
                      purchaseDate: true,
                    },
                  },
                  greigeStock: {
                    where: {
                      purchaseCost: { not: null },
                    },
                    orderBy: {
                      receivedDate: 'desc',
                    },
                    take: 1,
                    select: {
                      id: true,
                      purchaseCost: true,
                      receivedDate: true,
                    },
                  },
                  // BUG-GF4 fix: Include finished fabrics auto-created from this greige
                  finishedFabrics: {
                    where: { isActive: true },
                    select: {
                      id: true,
                      colorName: true,
                      colorMasterId: true,
                      finishType: true,
                      cutableWidth: true,
                      fabricStock: {
                        where: {
                          status: 'AVAILABLE',
                          quantityAvailable: { gt: 0 },
                        },
                        select: {
                          id: true,
                          weightedAvgCost: true,
                          quantityAvailable: true,
                          cutableWidth: true,
                        },
                      },
                    },
                  },
                },
              },
              // CAD rows from CAD Planning (linked via styleFabricId)
              cadRows: {
                where: {
                  AND: [
                    // Include rows with either stored cadAverage OR cadMeters (we can calculate from cadMeters)
                    {
                      OR: [{ cadAverage: { not: null } }, { cadMeters: { not: null } }],
                    },
                    // Filter by purpose if provided
                    // COSTING mode also shows legacy records with null purpose (backward compatibility)
                    ...(purpose
                      ? [
                          {
                            OR: [{ purpose: purpose as string }, ...(purpose === 'COSTING' ? [{ purpose: null }] : [])],
                          },
                        ]
                      : []),
                  ],
                },
                include: {
                  // Include size breakdowns to calculate cadAverage if not stored
                  sizeBreakdowns: {
                    select: {
                      sizeName: true,
                      quantity: true,
                    },
                  },
                  greige: {
                    select: {
                      id: true,
                      greigeName: true,
                      greigeCode: true,
                      costPerMeter: true,
                      averageShrinkagePercent: true, // For shrinkage fallback when no processor rate
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
                      greigeStock: {
                        where: {
                          purchaseCost: { not: null },
                        },
                        orderBy: { receivedDate: 'desc' },
                        take: 1,
                        select: {
                          id: true,
                          purchaseCost: true,
                          receivedDate: true,
                        },
                      },
                      // BUG-GF4 fix: Include finished fabrics auto-created from this greige
                      // so generic fabrics (no fabricId) can show stock from processed fabric
                      finishedFabrics: {
                        where: { isActive: true },
                        select: {
                          id: true,
                          colorName: true,
                          colorMasterId: true,
                          finishType: true,
                          cutableWidth: true,
                          fabricStock: {
                            where: {
                              status: 'AVAILABLE',
                              quantityAvailable: { gt: 0 },
                            },
                            select: {
                              id: true,
                              weightedAvgCost: true,
                              quantityAvailable: true,
                              cutableWidth: true,
                            },
                          },
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
              colorMaster: { select: { id: true, colorCode: true, colorName: true, hexCode: true } },
            },
          },
        },
      },
    },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  // Map to FabricForCosting format
  // NEW: Create ONE ROW per CAD width variant from cadRows (instead of one row per styleFabric)
  const fabricsForCosting: any[] = [];

  for (const component of style.style_components || []) {
    for (const styleFabric of component.style_fabrics || []) {
      // Get ready fabric cost - prioritize stock cost over fabric_master cost
      const availableLots = styleFabric.fabric?.fabricStock || [];
      const latestStock = availableLots[0]; // orderBy receivedDate desc → most recent lot
      const readyFabricCost = latestStock?.weightedAvgCost
        ? Number(latestStock.weightedAvgCost)
        : styleFabric.fabric?.costPerMeter
          ? Number(styleFabric.fabric.costPerMeter)
          : null;

      // Total available finished-fabric stock across ALL lots (display-only on the costing page)
      const stockAvailableTotal = availableLots.reduce(
        (sum: number, lot: { quantityAvailable: unknown }) => sum + Number(lot.quantityAvailable || 0),
        0
      );

      // Width-matched stock (±0.5" tolerance — same rule MRP uses when allocating fabric_stock),
      // plus quantity-weighted WAC of the matched lots. Suggestive only; allocation happens at MRP.
      // BUG-GF4 fix: For generic fabrics (no fabricId), fallback to greige's finishedFabrics stock
      const stockAtWidthFor = (
        width: number | null,
        greigeForFallback?: {
          finishedFabrics?: Array<{
            colorMasterId?: string | null;
            colorName?: string | null;
            finishType?: string | null;
            fabricStock?: Array<{
              weightedAvgCost?: unknown;
              quantityAvailable?: unknown;
              cutableWidth?: unknown;
            }>;
          }>;
        }
      ): { stockAtWidth: number | null; stockWacAtWidth: number | null } => {
        if (width == null) return { stockAtWidth: null, stockWacAtWidth: null };

        // Primary: use direct fabric stock (for fabrics with fabricId)
        let lotsToCheck = availableLots;

        // Fallback: for generic fabrics (no fabricId), aggregate stock from greige's finished fabrics
        // matching this style's color/finish
        if (availableLots.length === 0 && !styleFabric.fabricId && greigeForFallback?.finishedFabrics) {
          const sfColorId = styleFabric.colorMasterId;
          const sfColorName = styleFabric.fabricColor || (styleFabric as any).colorMaster?.colorName;
          const sfFinish = styleFabric.fabricFinishType;

          // Collect all matching finished fabric lots
          const fallbackLots: Array<{
            weightedAvgCost?: unknown;
            quantityAvailable?: unknown;
            cutableWidth?: unknown;
          }> = [];

          for (const ff of greigeForFallback.finishedFabrics) {
            // Match by colorMasterId if both have it, else by colorName, plus finishType
            const colorMatch =
              (sfColorId && ff.colorMasterId && sfColorId === ff.colorMasterId) ||
              (!sfColorId && !ff.colorMasterId && sfColorName && ff.colorName === sfColorName);
            const finishMatch = !sfFinish || !ff.finishType || sfFinish === ff.finishType;

            if (colorMatch && finishMatch && ff.fabricStock) {
              fallbackLots.push(...ff.fabricStock);
            }
          }
          lotsToCheck = fallbackLots as typeof availableLots;
        }

        if (lotsToCheck.length === 0) return { stockAtWidth: null, stockWacAtWidth: null };

        let qtySum = 0;
        let costQtySum = 0;
        let costQtyWeight = 0;
        for (const lot of lotsToCheck) {
          const lotWidth = lot.cutableWidth != null ? Number(lot.cutableWidth) : null;
          if (lotWidth == null || Math.abs(lotWidth - width) > 0.5) continue;
          const qty = Number(lot.quantityAvailable || 0);
          qtySum += qty;
          if (lot.weightedAvgCost != null) {
            costQtySum += qty * Number(lot.weightedAvgCost);
            costQtyWeight += qty;
          }
        }
        return {
          stockAtWidth: qtySum > 0 ? qtySum : null,
          stockWacAtWidth: costQtyWeight > 0 ? costQtySum / costQtyWeight : null,
        };
      };

      // Base fabric data shared by all width variants
      const baseFabricData = {
        styleFabricId: styleFabric.id,
        fabricId: styleFabric.fabricId,
        fabricName:
          styleFabric.fabric?.fabricName || styleFabric.fabricName || styleFabric.genericGreigeName || 'Unknown',
        genericGreigeName: styleFabric.genericGreigeName || styleFabric.fabric?.genericGreigeName,
        componentId: component.id,
        componentName: component.componentName,
        finishType: styleFabric.fabricFinishType || styleFabric.fabric?.finishType || null,
        // Design/Color for identification
        printDesign: styleFabric.printDesign || styleFabric.fabric?.printDesign || null,
        colorMasterId: styleFabric.colorMasterId || null,
        colorName: (styleFabric as any).colorMaster?.colorName || styleFabric.fabricColor || null,
        numberOfColors: styleFabric.numberOfColors || null,
        readyFabricCost,
        readyFabricCostSource: latestStock?.weightedAvgCost ? 'STOCK' : 'FABRIC_MASTER',
        // Total available across ALL lots (was: latest lot only — no consumers relied on that)
        stockAvailable: stockAvailableTotal > 0 ? stockAvailableTotal : null,
      };

      // Get CAD rows from CAD Planning (linked via styleFabricId)
      // Exclude rows superseded by a quantity-change clone: cloning keeps the
      // source row live, so returning both double-counts batch quantities in
      // the rate-slab lookup. Any row referenced as another returned row's
      // clonedFromCadId is an ancestor — only the tip of each chain survives.
      const allCadRows = (styleFabric as any).cadRows || [];
      const supersededIds = new Set(allCadRows.map((r: any) => r.clonedFromCadId).filter(Boolean));
      const cadRows = allCadRows.filter((r: any) => !supersededIds.has(r.id));

      if (cadRows.length > 0) {
        // Create ONE ROW per CAD width variant
        for (const cadRow of cadRows) {
          // Get greige from this CAD row
          const greige = cadRow.greige || styleFabric.selectedGreige || styleFabric.fabric?.greige;
          const greigeDefaultCost = greige?.costPerMeter ? Number(greige.costPerMeter) : null;

          // Get latest prices from both procurement and direct stock entry
          const greigeProcurements = greige?.fabricProcurements || [];
          const latestProcurement = greigeProcurements[0];
          const procurementRate = latestProcurement?.ratePerUnit ? Number(latestProcurement.ratePerUnit) : null;
          const procurementDate = latestProcurement?.purchaseDate ? new Date(latestProcurement.purchaseDate) : null;

          const greigeStockEntries = greige?.greigeStock || [];
          const latestStock = greigeStockEntries[0];
          const stockRate = latestStock?.purchaseCost ? Number(latestStock.purchaseCost) : null;
          const stockDate = latestStock?.receivedDate ? new Date(latestStock.receivedDate) : null;

          // Determine greige cost: use most recent price from either source
          let greigeCostPerMeter: number | null = null;
          let greigeCostSource: 'GREIGE_PROCUREMENT' | 'GREIGE_STOCK' | 'GREIGE_MASTER' = 'GREIGE_MASTER';

          if (procurementDate && stockDate) {
            // Both exist - use more recent
            if (procurementDate > stockDate) {
              greigeCostPerMeter = procurementRate;
              greigeCostSource = 'GREIGE_PROCUREMENT';
            } else {
              greigeCostPerMeter = stockRate;
              greigeCostSource = 'GREIGE_STOCK';
            }
          } else if (procurementRate !== null) {
            greigeCostPerMeter = procurementRate;
            greigeCostSource = 'GREIGE_PROCUREMENT';
          } else if (stockRate !== null) {
            greigeCostPerMeter = stockRate;
            greigeCostSource = 'GREIGE_STOCK';
          } else if (greigeDefaultCost !== null) {
            greigeCostPerMeter = greigeDefaultCost;
            greigeCostSource = 'GREIGE_MASTER';
          }

          // Calculate per-piece consumption (cadAverage)
          // Priority: 1) stored cadAverage, 2) calculate from cadMeters + size breakdowns
          let perPieceConsumption: number | null = null;
          if (cadRow.cadAverage) {
            perPieceConsumption = Number(cadRow.cadAverage);
          } else if (cadRow.cadMeters) {
            // Calculate from layer length and size breakdowns (same logic as CAD Planning)
            const layerLength = Number(cadRow.cadMeters);
            const layerMargin = cadRow.layerMarginMeters ? Number(cadRow.layerMarginMeters) : layerLength * 0.03; // Default 3% margin
            const sizeBreakdowns = cadRow.sizeBreakdowns || [];
            const totalPieces = sizeBreakdowns.reduce((sum: number, sb: any) => sum + (sb.quantity || 0), 0);
            if (totalPieces > 0) {
              perPieceConsumption = (layerLength + layerMargin) / totalPieces;
            }
          }
          const cadMeters = perPieceConsumption; // This is actually per-piece consumption, not layer length
          const width = cadRow.cutableWidth ? Number(cadRow.cutableWidth) : null;

          fabricsForCosting.push({
            // Use cadRow.id as the unique identifier for this row
            id: cadRow.id,
            ...baseFabricData,
            cadMeters, // Per-piece consumption from cadAverage
            width, // Cutable width for this variant
            ...stockAtWidthFor(width, greige), // stockAtWidth + stockWacAtWidth (display-only, MRP-consistent)
            purpose: cadRow.purpose || null, // PLANNING, COSTING, PRODUCTION
            greigeId: greige?.id || null,
            greigeName: greige?.greigeName || null,
            greigeCode: greige?.greigeCode || null,
            greigeDefaultCost,
            greigeStockCost: procurementRate,
            greigeCostPerMeter,
            greigeCostSource,
            greigeStockAvailable: latestProcurement ? Number(latestProcurement.quantityPurchased) : null,
            // Include existing costing data from CAD row if available
            processorId: cadRow.processorId || null,
            processorName: cadRow.processor?.name || null,
            processorCode: cadRow.processor?.code || null,
            greigeCostPerMeterSaved: cadRow.greigeCostPerMeter ? Number(cadRow.greigeCostPerMeter) : null,
            transportCostPerMeter: cadRow.transportCostPerMeter ? Number(cadRow.transportCostPerMeter) : null,
            processingPricePerMeter: cadRow.processingPricePerMeter ? Number(cadRow.processingPricePerMeter) : null,
            // Shrinkage: ONLY from processor rate card (no fallback to greige master)
            shrinkagePercent: cadRow.shrinkagePercent ? Number(cadRow.shrinkagePercent) : null,
            shrinkageCostPerMeter: cadRow.shrinkageCostPerMeter ? Number(cadRow.shrinkageCostPerMeter) : null,
            screenCostPerMeter: cadRow.screenCostPerMeter ? Number(cadRow.screenCostPerMeter) : null,
            screenType: cadRow.screenType || null,
            numberOfColors: cadRow.numberOfColors || null,
            totalCostPerMeter: cadRow.totalCostPerMeter ? Number(cadRow.totalCostPerMeter) : null,
            costInputMode: cadRow.costInputMode || null,
            isPreferred: cadRow.isPreferred || false,
            processingBatchGroupColorId: cadRow.processingBatchGroupColorId || null,
            // Order quantity for rate slab lookup (persisted from save)
            orderQuantityPcs: cadRow.orderQuantityPcs ?? null,
            // Creation timestamp for sorting by most recent
            createdAt: cadRow.createdAt || null,
            // No widthOptions needed since each row IS a width option
            widthOptions: [],
          });
        }
      } else if (!purpose) {
        // Only create fallback rows when no specific purpose filter is requested
        // If a purpose is specified (e.g., PRODUCTION) but no CAD rows exist for that purpose,
        // we should NOT show legacy data as a fallback - just skip this fabric entirely
        // Fallback: No CAD rows - create single row with legacy data
        const greige = styleFabric.fabricCAD?.greige || styleFabric.selectedGreige || styleFabric.fabric?.greige;
        const greigeDefaultCost = greige?.costPerMeter ? Number(greige.costPerMeter) : null;

        // Get latest prices from both procurement and direct stock entry
        const greigeProcurements = greige?.fabricProcurements || [];
        const latestProcurement = greigeProcurements[0];
        const procurementRate = latestProcurement?.ratePerUnit ? Number(latestProcurement.ratePerUnit) : null;
        const procurementDate = latestProcurement?.purchaseDate ? new Date(latestProcurement.purchaseDate) : null;

        const greigeStockEntries = greige?.greigeStock || [];
        const latestStock = greigeStockEntries[0];
        const stockRate = latestStock?.purchaseCost ? Number(latestStock.purchaseCost) : null;
        const stockDate = latestStock?.receivedDate ? new Date(latestStock.receivedDate) : null;

        // Determine greige cost: use most recent price from either source
        let greigeCostPerMeter: number | null = null;
        let greigeCostSource: 'GREIGE_PROCUREMENT' | 'GREIGE_STOCK' | 'GREIGE_MASTER' = 'GREIGE_MASTER';

        if (procurementDate && stockDate) {
          // Both exist - use more recent
          if (procurementDate > stockDate) {
            greigeCostPerMeter = procurementRate;
            greigeCostSource = 'GREIGE_PROCUREMENT';
          } else {
            greigeCostPerMeter = stockRate;
            greigeCostSource = 'GREIGE_STOCK';
          }
        } else if (procurementRate !== null) {
          greigeCostPerMeter = procurementRate;
          greigeCostSource = 'GREIGE_PROCUREMENT';
        } else if (stockRate !== null) {
          greigeCostPerMeter = stockRate;
          greigeCostSource = 'GREIGE_STOCK';
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
          ...stockAtWidthFor(width, greige as Parameters<typeof stockAtWidthFor>[1]),
          purpose: null,
          greigeId: greige?.id || null,
          greigeName: greige?.greigeName || null,
          greigeCode: greige?.greigeCode || null,
          greigeDefaultCost,
          greigeStockCost: procurementRate,
          greigeCostPerMeter,
          greigeCostSource,
          greigeStockAvailable: latestProcurement ? Number(latestProcurement.quantityPurchased) : null,
          widthOptions: [],
        });
      }
    }
  }

  res.json(
    serialize({
      success: true,
      data: {
        styleId: style.id,
        styleCode: style.styleCode,
        buyerStyleRef: style.buyerStyleRef,
        styleName: style.styleName,
        fabrics: fabricsForCosting,
      },
    })
  );
}

/**
 * POST /api/fabric-costing/lookup-rate
 * Lookup processor rate for a specific greige and quantity
 */
export async function lookupProcessorRate(req: Request, res: Response) {
  const { processorId, processingType, printingType, greigeId, quantityMeters } = req.body;

  // Validation
  if (!processorId || !processingType || !greigeId || !quantityMeters) {
    throw new ValidationError('Missing required fields: processorId, processingType, greigeId, quantityMeters');
  }

  // Validate processingType
  if (processingType !== 'DYEING' && processingType !== 'PRINTING') {
    throw new ValidationError('processingType must be DYEING or PRINTING');
  }

  // For PRINTING, printingType is required
  if (processingType === 'PRINTING' && !printingType) {
    throw new ValidationError('printingType is required when processingType is PRINTING');
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
    const greigeMatch = availableRates.find((rc) => rc.greigeId === greigeId);
    const printTypeMatch = availableRates.find((rc) => rc.printingType === printingType);

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
        const availableGreiges = [...new Set(availableRates.map((rc) => rc.greige?.greigeName))]
          .filter(Boolean)
          .slice(0, 3);
        errorDetail += `Available greiges: ${availableGreiges.join(', ')}`;
      }
    } else if (!greigeMatch && !printTypeMatch) {
      errorDetail = `No rate card for this processor/printing type combination.`;
    }

    throw new NotFoundError(`Rate for the given criteria. ${errorDetail}`);
  }

  res.json(
    serialize({
      success: true,
      data: result,
    })
  );
}

/**
 * POST /api/fabric-costing/save
 * Save fabric costing data to fabric_width_cad (preliminary costing before CAD approval)
 * After CAD approval, the selected width's cost will be copied to style_fabrics
 */
export async function saveFabricCosting(req: Request, res: Response) {
  const { styleId, fabricCostings } = req.body;

  if (!styleId || !fabricCostings || !Array.isArray(fabricCostings)) {
    throw new ValidationError('Missing required fields: styleId, fabricCostings');
  }

  // Define CAD-owned fields that CANNOT be modified by Fabric Costing
  // These fields are managed by CAD Planning module only
  // NOTE: purpose/purposeEnum are NOT in this list - users need to set workflow mode when saving
  const CAD_OWNED_FIELDS = [
    'cutableWidth',
    'cadMeters',
    'cadYards',
    'cadAverage',
    'cadWastagePercent',
    'markerEfficiency',
    'approvalStatus',
    'approvedBy',
    'approvedAt',
    'approvalNotes',
    'isPreferred',
    'copiedFromId',
    'piecesPerMarker',
    'markerLengthMeters',
    'layerMarginMeters',
    'printDirection',
    'isEmbroidery',
    'patternPartId',
    'componentName',
    'isLocked',
    'markerPlanFile',
  ];

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
        throw new ValidationError('Cost values cannot be negative');
      }
    }

    // NEW: Validate that no CAD-owned fields are being modified
    for (const field of CAD_OWNED_FIELDS) {
      if (costing.hasOwnProperty(field) && costing[field] !== undefined) {
        // Exception: Allow reading these fields, but not changing them
        // If fabricWidthCadId exists, check if value is being changed
        if (costing.fabricWidthCadId) {
          const existingRecord = await prisma.fabric_width_cad.findUnique({
            where: { id: costing.fabricWidthCadId },
            select: { [field]: true },
          });

          if (existingRecord && existingRecord[field] !== costing[field]) {
            throw new ForbiddenError(
              `Field '${field}' is managed by CAD Planning and cannot be modified in Fabric Costing. Please update this field in the CAD Planning module.`
            );
          }
        }
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

  // Save each fabric costing to fabric_width_cad
  const updates = await Promise.all(
    fabricCostings.map(async (costing: any) => {
      // CLONE MODE: When quantity changes, create new record instead of updating
      // Frontend sends cloneFromCadId (source record) without fabricWidthCadId (target record)
      if (costing.cloneFromCadId && !costing.fabricWidthCadId) {
        const sourceRecord = await prisma.fabric_width_cad.findUnique({
          where: { id: costing.cloneFromCadId },
        });

        if (!sourceRecord) {
          throw new Error(`Source CAD record ${costing.cloneFromCadId} not found for cloning.`);
        }

        // Create new record with cloned CAD data + new cost values
        return prisma.fabric_width_cad.create({
          data: {
            // Copy CAD-owned fields from source
            fabricId: sourceRecord.fabricId,
            cutableWidth: sourceRecord.cutableWidth,
            widthUnit: sourceRecord.widthUnit,
            cadMeters: sourceRecord.cadMeters,
            cadYards: sourceRecord.cadYards,
            cadWastagePercent: sourceRecord.cadWastagePercent,
            markerEfficiency: sourceRecord.markerEfficiency,
            componentName: sourceRecord.componentName,
            styleFabricId: sourceRecord.styleFabricId,
            patternPartId: sourceRecord.patternPartId,
            printDirection: sourceRecord.printDirection,
            isEmbroidery: sourceRecord.isEmbroidery,
            piecesPerMarker: sourceRecord.piecesPerMarker,
            markerLengthMeters: sourceRecord.markerLengthMeters,
            layerMarginMeters: sourceRecord.layerMarginMeters,
            cadAverage: sourceRecord.cadAverage,
            // Clone lineage tracking
            clonedFromCadId: costing.cloneFromCadId,
            // Costing-owned fields from request
            costingStyleId: styleId,
            // BUG-FC7 fix: sync purpose fields - always set both purpose and purposeEnum together
            purpose: costing.purpose || sourceRecord.purpose || 'COSTING',
            purposeEnum: (costing.purpose || sourceRecord.purpose || 'COSTING') as any,
            greigeId: costing.greigeId || sourceRecord.greigeId,
            greigeCostPerMeter: costing.greigeCostPerMeter ? parseFloat(costing.greigeCostPerMeter) : null,
            transportCostPerMeter: costing.transportCostPerMeter ? parseFloat(costing.transportCostPerMeter) : null,
            processingPricePerMeter: costing.processingCostPerMeter ? parseFloat(costing.processingCostPerMeter) : null,
            shrinkagePercent: costing.shrinkagePercent ? parseFloat(costing.shrinkagePercent) : null,
            shrinkageCostPerMeter: costing.shrinkageCostPerMeter ? parseFloat(costing.shrinkageCostPerMeter) : null,
            screenCostPerMeter: costing.screenCostPerMeter ? parseFloat(costing.screenCostPerMeter) : null,
            screenType: costing.screenType || null,
            totalCostPerMeter: costing.totalCostPerMeter ? parseFloat(costing.totalCostPerMeter) : null,
            processorId: costing.processorId || sourceRecord.processorId,
            numberOfColors: costing.numberOfColors ? parseInt(costing.numberOfColors) : null,
            costInputMode: costing.costInputMode || null,
            orderQuantityPcs: costing.orderQuantityPcs != null ? parseInt(costing.orderQuantityPcs) : null,
            processingBatchGroupColorId: costing.processingBatchGroupColorId || null,
            // New record starts as unapproved
            approvalStatus: null,
            isPreferred: false,
          },
        });
      }

      // UPDATE MODE: Normal update of existing CAD record
      if (!costing.fabricWidthCadId) {
        throw new Error(
          'Cannot create new CAD records from Fabric Costing. Please create CAD data in CAD Planning module first.'
        );
      }

      // Verify the CAD record exists
      const existingCad = await prisma.fabric_width_cad.findUnique({
        where: { id: costing.fabricWidthCadId },
      });

      if (!existingCad) {
        throw new Error(
          `CAD record ${costing.fabricWidthCadId} not found. Please create CAD data in CAD Planning module first.`
        );
      }

      // Prepare COST-ONLY data (fields owned by Fabric Costing)
      // BUG-FC7 fix: sync purpose fields - determine resolved purpose once, then set both fields
      const resolvedPurpose = costing.purpose || existingCad.purpose || 'COSTING';
      const costingData = {
        // Link to style for Options page (CRITICAL - without this, data won't appear on Options page)
        costingStyleId: styleId,
        // Workflow purpose mode (COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION)
        purpose: resolvedPurpose,
        purposeEnum: resolvedPurpose as any,
        // Fabric Costing ONLY updates these cost-related fields
        styleFabricId: costing.styleFabricId || existingCad.styleFabricId,
        greigeId: costing.greigeId || existingCad.greigeId,
        greigeCostPerMeter: costing.greigeCostPerMeter ? parseFloat(costing.greigeCostPerMeter) : null,
        transportCostPerMeter: costing.transportCostPerMeter ? parseFloat(costing.transportCostPerMeter) : null,
        processingPricePerMeter: costing.processingCostPerMeter ? parseFloat(costing.processingCostPerMeter) : null,
        shrinkagePercent: costing.shrinkagePercent ? parseFloat(costing.shrinkagePercent) : null,
        shrinkageCostPerMeter: costing.shrinkageCostPerMeter ? parseFloat(costing.shrinkageCostPerMeter) : null,
        screenCostPerMeter: costing.screenCostPerMeter ? parseFloat(costing.screenCostPerMeter) : null,
        screenType: costing.screenType || null, // ROTARY, FLATBELT, or TABLE
        totalCostPerMeter: costing.totalCostPerMeter ? parseFloat(costing.totalCostPerMeter) : null,
        processorId: costing.processorId || null,
        // MRP-48d: persist which rate card produced these numbers, so the chain
        // costing -> CAD -> cost sheet -> BOM -> MRP -> JWO carries the processor's committed
        // shrinkage (and, via the card's unique key, the process and print type) explicitly.
        rateCardId: costing.rateCardId || null,
        numberOfColors: costing.numberOfColors ? parseInt(costing.numberOfColors) : null,
        costInputMode: costing.costInputMode || null,
        orderQuantityPcs: costing.orderQuantityPcs != null ? parseInt(costing.orderQuantityPcs) : null,
        processingBatchGroupColorId: costing.processingBatchGroupColorId || null,
      };

      // Update existing CAD record with cost data only
      return prisma.fabric_width_cad.update({
        where: { id: costing.fabricWidthCadId },
        data: costingData,
      });
    })
  );

  res.json(
    serialize({
      success: true,
      data: {
        message: 'Fabric costing updated successfully',
        updatedCount: updates.length,
        isRepeatOrder: isRepeatOrder, // Include repeat order status for frontend
      },
    })
  );
}

/**
 * GET /api/fabric-costing/options
 * Get all costing options with filtering - grouped by style and component
 */
export async function getCostingOptions(req: Request, res: Response) {
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
    where.OR = [{ approvalStatus: null }, { approvalStatus: { not: 'APPROVED' } }];
  }

  // Filter by workflow purpose
  if (purpose && purpose !== 'ALL') {
    where.purpose = purpose as string;
  }

  // If customerId filter, we need to filter by BOTH brand_categories.customerId AND direct customerName
  // (some styles use brand_categories relation, others have customerName set directly)
  let styleFilter: any = {};
  if (customerId) {
    const customer = await prisma.customers.findUnique({
      where: { id: customerId as string },
      select: { name: true },
    });

    if (customer) {
      styleFilter = {
        OR: [{ brand_categories: { customerId: customerId as string } }, { customerName: customer.name }],
      };
    }
  }

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
          buyerStyleRef: true,
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
    orderBy: [{ costingStyleId: 'asc' }, { componentName: 'asc' }, { totalCostPerMeter: 'asc' }],
  });

  // Group by style, then by component
  const groupedByStyle: Record<
    string,
    {
      style: {
        id: string;
        styleCode: string;
        buyerStyleRef: string | null;
        styleName: string;
        customerName: string | null;
        customerId: string | null;
      };
      components: Record<string, any[]>;
    }
  > = {};

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
          buyerStyleRef: option.costingStyle?.buyerStyleRef ?? null,
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
      cadAverage: option.cadAverage, // Per-piece consumption for calculations
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
  // Apply same filters as main query, but WITHOUT the purpose filter (we want counts for all purposes)
  const purposeCountsWhere: any = {
    costingStyleId: { not: null },
    totalCostPerMeter: { not: null },
  };
  // Apply styleId filter if provided
  if (styleId) purposeCountsWhere.costingStyleId = styleId as string;
  // Apply processorId filter if provided
  if (processorId) purposeCountsWhere.processorId = processorId as string;
  // Apply status filter if provided
  if (status === 'APPROVED') purposeCountsWhere.approvalStatus = 'APPROVED';
  if (status === 'PENDING') {
    purposeCountsWhere.OR = [{ approvalStatus: null }, { approvalStatus: { not: 'APPROVED' } }];
  }
  // Note: customerId filter requires relation join which groupBy doesn't support directly
  // For accurate counts with customerId, we'd need to filter the options array instead
  // But for most use cases (styleId filter), this is sufficient

  const purposeCounts = await prisma.fabric_width_cad.groupBy({
    by: ['purpose'],
    where: purposeCountsWhere,
    _count: { id: true },
  });

  // Mode names: COSTING (was PLANNING), RAW_MATERIAL_CALCULATION (was COSTING), PRODUCTION (unchanged)
  const purposeCountsFormatted = {
    all: purposeCounts.reduce((sum, c) => sum + c._count.id, 0),
    costing: purposeCounts.find((c) => c.purpose === 'COSTING')?._count.id || 0,
    rawMaterialCalculation: purposeCounts.find((c) => c.purpose === 'RAW_MATERIAL_CALCULATION')?._count.id || 0,
    production: purposeCounts.find((c) => c.purpose === 'PRODUCTION')?._count.id || 0,
  };

  res.json(
    serialize({
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
    })
  );
}

/**
 * POST /api/fabric-costing/option/:optionId/approve
 * Approve a costing option - marks it as preferred and unapproves others for same component
 */
export async function approveCostingOption(req: Request, res: Response) {
  const { optionId } = req.params;
  const userId = req.user?.userId || null; // From auth middleware

  // Get the option to find its component/style
  const option = await prisma.fabric_width_cad.findUnique({
    where: { id: optionId },
  });

  if (!option) {
    throw new NotFoundError('Costing option', optionId);
  }

  // Prevent modifying locked PRODUCTION records
  if (option.isLocked) {
    throw new ValidationError('Cannot modify locked PRODUCTION costing option');
  }

  if (!option.costingStyleId) {
    throw new ValidationError('Option missing style reference');
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
        fabricId: option.fabricId, // Same base fabric
        greigeId: option.greigeId, // Same greige
        styleFabricId: option.styleFabricId, // Same style fabric assignment (key for embroidery differentiation)
        patternPartId: option.patternPartId, // Same pattern part
        purpose: option.purpose, // Same workflow mode (COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION)
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
        fabricId: option.fabricId, // Same base fabric
        greigeId: option.greigeId, // Same greige
        styleFabricId: option.styleFabricId, // Same style fabric assignment (key for embroidery differentiation)
        patternPartId: option.patternPartId, // Same pattern part
        purpose: option.purpose, // Same workflow mode (COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION)
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

  res.json(
    serialize({
      success: true,
      data: result,
      message: 'Costing option approved successfully',
    })
  );
}

/**
 * PATCH /api/fabric-costing/options/:optionId/unapprove
 * Unapprove a costing option - revert to Pending status
 */
export async function unapproveCostingOption(req: Request, res: Response) {
  const { optionId } = req.params;

  // Get the option first
  const option = await prisma.fabric_width_cad.findUnique({
    where: { id: optionId },
  });

  if (!option) {
    throw new NotFoundError('Costing option', optionId);
  }

  // Prevent modifying locked PRODUCTION records
  if (option.isLocked) {
    throw new ValidationError('Cannot modify locked PRODUCTION costing option');
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
}

/**
 * DELETE /api/fabric-costing/option/:optionId
 * Delete a costing option
 */
export async function deleteCostingOption(req: Request, res: Response) {
  const { optionId } = req.params;

  // Check if option exists
  const option = await prisma.fabric_width_cad.findUnique({
    where: { id: optionId },
  });

  if (!option) {
    throw new NotFoundError('Costing option', optionId);
  }

  // Prevent deleting locked PRODUCTION records
  if (option.isLocked) {
    throw new ValidationError('Cannot delete locked PRODUCTION costing option');
  }

  await prisma.fabric_width_cad.delete({
    where: { id: optionId },
  });

  res.json(
    serialize({
      success: true,
      message: 'Costing option deleted successfully',
    })
  );
}

/**
 * GET /api/fabric-costing/style/:styleId/options
 * Get all costing options for a specific style - grouped by component
 */
export async function getStyleCostingOptions(req: Request, res: Response) {
  const { styleId } = req.params;
  const { purpose } = req.query; // Optional: filter by purpose (COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION)

  // Build where clause with optional purpose filter
  const where: any = {
    costingStyleId: styleId,
    totalCostPerMeter: { not: null },
  };

  // If purpose is provided, filter by it
  if (purpose && typeof purpose === 'string') {
    where.purpose = purpose;
  }

  let options = await prisma.fabric_width_cad.findMany({
    where,
    include: {
      processor: { select: { id: true, name: true, code: true } },
      greige: { select: { id: true, greigeName: true, greigeCode: true } },
      patternPart: { select: { id: true, code: true, name: true } },
      styleFabric: {
        select: {
          id: true,
          hasEmbroidery: true,
          fabricName: true,
          fabricFinishType: true,
          printDesign: true,
          colorMaster: { select: { colorName: true } },
        },
      },
    },
    orderBy: [
      { componentName: 'asc' },
      { styleFabricId: 'asc' },
      { patternPartId: 'asc' },
      { totalCostPerMeter: 'asc' },
    ],
  });

  // Fallback: If COSTING purpose requested but no results, try RAW_MATERIAL_CALCULATION
  // This allows cost sheet to work when only RM CAD is available
  if (options.length === 0 && purpose === 'COSTING') {
    options = await prisma.fabric_width_cad.findMany({
      where: {
        costingStyleId: styleId,
        totalCostPerMeter: { not: null },
        purpose: 'RAW_MATERIAL_CALCULATION',
        approvalStatus: 'APPROVED',
      },
      include: {
        processor: { select: { id: true, name: true, code: true } },
        greige: { select: { id: true, greigeName: true, greigeCode: true } },
        patternPart: { select: { id: true, code: true, name: true } },
        styleFabric: {
          select: {
            id: true,
            hasEmbroidery: true,
            fabricName: true,
            fabricFinishType: true,
            printDesign: true,
            colorMaster: { select: { colorName: true } },
          },
        },
      },
      orderBy: [
        { componentName: 'asc' },
        { styleFabricId: 'asc' },
        { patternPartId: 'asc' },
        { totalCostPerMeter: 'asc' },
      ],
    });
  }

  // Group by component + styleFabric (so each fabric assignment can be approved independently)
  // This allows same base fabric with different properties (e.g., embroidery) to be separate groups
  const groupedByComponent: Record<string, any[]> = {};

  for (const option of options) {
    // Create unique group key per style fabric assignment
    // Include design/color and embroidery to differentiate fabrics with same greige
    const baseComponentName = option.componentName || 'Unknown';
    const hasEmbroidery = option.styleFabric?.hasEmbroidery || false;
    const designColor = option.styleFabric?.printDesign || (option.styleFabric as any)?.colorMaster?.colorName || '';
    let componentKey = baseComponentName;
    if (designColor) componentKey += ` - ${designColor}`;
    if (hasEmbroidery) componentKey += ' - Embroidered';

    if (!groupedByComponent[componentKey]) {
      groupedByComponent[componentKey] = [];
    }

    // Mark lowest cost option per component
    const isLowestCost = groupedByComponent[componentKey].length === 0;

    groupedByComponent[componentKey].push({
      id: option.id,
      purpose: option.purpose, // Include purpose in response for mode-aware filtering
      isLocked: option.isLocked || false, // Locked PRODUCTION records (parity with GET /options)
      componentName: option.componentName || null, // Parity with frontend CostingOption type
      fabricId: option.fabricId,
      styleFabricId: option.styleFabricId,
      hasEmbroidery: option.styleFabric?.hasEmbroidery || false,
      styleFabricName: option.styleFabric?.fabricName || null,
      fabricFinishType: option.styleFabric?.fabricFinishType || null,
      printDesign: option.styleFabric?.printDesign || null,
      colorName: (option.styleFabric as any)?.colorMaster?.colorName || null,
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
      cadAverage: option.cadAverage, // Per-piece consumption (cadMeters / piecesPerMarker)
      createdAt: option.createdAt,
      updatedAt: option.updatedAt,
    });
  }

  // Count stats
  const totalOptions = options.length;
  const approvedCount = options.filter((o) => o.approvalStatus === 'APPROVED').length;
  const componentCount = Object.keys(groupedByComponent).length;
  const allComponentsApproved = Object.values(groupedByComponent).every((opts) =>
    opts.some((o) => o.approvalStatus === 'APPROVED')
  );

  res.json(
    serialize({
      success: true,
      data: groupedByComponent,
      summary: {
        totalOptions,
        approvedCount,
        componentCount,
        allComponentsApproved,
      },
    })
  );
}

/**
 * POST /api/fabric-costing/option/:optionId/promote
 * Promote a costing option to the next workflow stage
 * PLANNING -> COSTING -> PRODUCTION
 * Creates a copy with the new purpose (original remains for audit)
 */
export async function promoteCostingOption(req: Request, res: Response) {
  const { optionId } = req.params;
  const { targetPurpose } = req.body;

  // Validate target purpose
  // Mode names: COSTING (was PLANNING), RAW_MATERIAL_CALCULATION (was COSTING), PRODUCTION (unchanged)
  const validPurposes = ['RAW_MATERIAL_CALCULATION', 'PRODUCTION'];
  if (!targetPurpose || !validPurposes.includes(targetPurpose)) {
    throw new ValidationError('Invalid target purpose. Must be RAW_MATERIAL_CALCULATION or PRODUCTION.');
  }

  // Get the option
  const option = await prisma.fabric_width_cad.findUnique({
    where: { id: optionId },
  });

  if (!option) {
    throw new NotFoundError('Costing option', optionId);
  }

  // Check if option is approved (required for promotion)
  if (option.approvalStatus !== 'APPROVED') {
    throw new ValidationError('Option must be approved before promotion');
  }

  // Define valid transitions
  // Mode names: COSTING (was PLANNING) -> RAW_MATERIAL_CALCULATION (was COSTING) -> PRODUCTION
  const validPaths = [
    { from: 'COSTING', to: 'RAW_MATERIAL_CALCULATION' },
    { from: null, to: 'RAW_MATERIAL_CALCULATION' }, // Legacy records without purpose
    { from: 'RAW_MATERIAL_CALCULATION', to: 'PRODUCTION' },
  ];

  const currentPurpose = option.purpose || 'COSTING';
  const isValid = validPaths.some(
    (p) => (p.from === currentPurpose || (p.from === null && !option.purpose)) && p.to === targetPurpose
  );

  if (!isValid) {
    throw new ValidationError(`Invalid transition: ${currentPurpose} -> ${targetPurpose}`);
  }

  // Create copy with new purpose (original remains for audit trail)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt, updatedAt, ...data } = option;

  const promoted = await prisma.fabric_width_cad.create({
    data: {
      ...data,
      // BUG-FC7 fix: sync purpose fields - always set both purpose and purposeEnum together
      purpose: targetPurpose,
      purposeEnum: targetPurpose as any,
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

  res.json(
    serialize({
      success: true,
      data: promoted,
      message: `Costing option promoted to ${targetPurpose} successfully`,
    })
  );
}

/**
 * POST /api/fabric-costing/styles/costing-status
 * Get costing status for multiple styles at once
 * Returns: { styleId: { hasCosting, hasPending, hasApproved, hasProduction } }
 */
export async function getStylesCostingStatus(req: Request, res: Response) {
  const { styleIds } = req.body;

  if (!styleIds || !Array.isArray(styleIds) || styleIds.length === 0) {
    throw new ValidationError('Missing required field: styleIds (array)');
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
    const hasApproved = costings.some(
      (c) => c.approvalStatus === 'APPROVED' || c.approvalStatus === 'ALTERNATE_APPROVED'
    );
    const hasProduction = costings.some((c) => c.purpose === 'PRODUCTION' && c.isLocked);
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
  const statusMap = results.reduce(
    (acc, item) => {
      acc[item.styleId] = item.status;
      return acc;
    },
    {} as Record<string, any>
  );

  res.json(
    serialize({
      success: true,
      data: statusMap,
    })
  );
}

/**
 * POST /api/fabric-costing/check-cad-status
 * Check which CAD rows already have costing data
 * Returns counts and details of new vs existing records
 */
export async function checkCADCostingStatus(req: Request, res: Response) {
  const { styleId, cadRowIds } = req.body;

  if (!styleId || !cadRowIds || !Array.isArray(cadRowIds)) {
    throw new ValidationError('Missing required fields: styleId, cadRowIds (array)');
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

  res.json(
    serialize({
      success: true,
      data: {
        newCount: newRows.length,
        existingCount: existingRows.length,
        newRows,
        existingRows,
      },
    })
  );
}

/**
 * POST /api/fabric-costing/push-from-cad
 * Create fabric costing records from CAD rows
 * Fetches greige cost from latest procurement and initializes costing fields
 */
export async function pushFromCAD(req: Request, res: Response) {
  const { styleId, cadRowIds } = req.body;

  if (!styleId || !cadRowIds || !Array.isArray(cadRowIds)) {
    throw new ValidationError('Missing required fields: styleId, cadRowIds (array)');
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
              status: { in: ['RECEIVED', 'COMPLETED'] }, // Use received/completed procurements
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
    const totalCostPerMeter = greigeCostPerMeter !== null ? greigeCostPerMeter + transportCostPerMeter : null;

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
        // MRP-48: these were seeded to 0, which is not "unknown" — it silently prices the fabric
        // with NO shrinkage uplift and reads as a deliberate zero. Left null so the costing grid
        // shows the value as unresolved until a processor rate card supplies it.
        shrinkagePercent: null,
        shrinkageCostPerMeter: null,
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

  res.json(
    serialize({
      success: true,
      data: {
        created: createdRows.length,
        skipped: skippedRows.length,
        createdRows,
        skippedRows,
      },
    })
  );
}

/**
 * GET /api/fabric-costing/style/:styleId/validate
 * Validate if style has CAD data for fabric costing
 * Used to show warning banner if no CAD data exists
 */
export async function validateStyleCADData(req: Request, res: Response) {
  const { styleId } = req.params;
  const { purpose } = req.query;

  if (!styleId) {
    throw new ValidationError('Missing required parameter: styleId');
  }

  // Query CAD records linked through style_fabrics relationship
  // Note: costingStyleId is only set AFTER saving costing, so we must query via styleFabricId relationship
  const where: any = {
    styleFabric: {
      style_components: {
        styleId: styleId,
      },
    },
    // Only include records with actual CAD data
    OR: [{ cadMeters: { not: null } }, { cadAverage: { not: null } }],
  };

  // Filter by purpose if provided
  if (purpose && ['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION'].includes(purpose as string)) {
    where.purpose = purpose as string;
  }

  const cadRecords = await prisma.fabric_width_cad.findMany({
    where,
    select: {
      id: true,
      purpose: true,
      componentName: true,
      cutableWidth: true,
      approvalStatus: true,
      copiedFromId: true,
    },
  });

  const hasCADData = cadRecords.length > 0;

  res.json(
    serialize({
      success: true,
      data: {
        hasCADData,
        recordCount: cadRecords.length,
        records: cadRecords,
        message: hasCADData
          ? `Found ${cadRecords.length} CAD record(s) for this style`
          : 'No CAD data found. Please create CAD data in CAD Planning module first.',
      },
    })
  );
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
  validateStyleCADData,
};
