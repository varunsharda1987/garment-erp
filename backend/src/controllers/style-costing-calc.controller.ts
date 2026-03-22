import { Request, Response } from 'express';
import prisma from '../config/database';
import { logInfo, logError, logWarn } from '../utils/logger';
import { costingService } from '../services/costing.service';
import { FabricDetail, TrimDetail, EmbroideryDetail, AccessoryDetail } from './style-costing.utils';

// ============================================================================
// CALCULATION OPERATIONS
// ============================================================================

/**
 * Auto-generate cost sheet from approved CAD data
 * POST /api/style-costing/generate/:styleId
 */
export const generateCostSheetFromStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get style with all related data
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: true,
                cadRows: {
                  where: {
                    purpose: 'COSTING',
                  },
                  orderBy: { updatedAt: 'desc' },
                  take: 1, // Get latest COSTING CAD
                },
              },
            },
          },
        },
        style_material_bom: {
          include: {
            lace_master: true,
            button_master: true,
            thread_master: true,
            zipper_master: true,
            elastic_master: true,
            label_master: true,
            packaging_master: true,
            machine_part_master: true,
            other_material_master: true,
          },
        },
        style_processes: true,
      },
    });

    if (!style) {
      res.status(404).json({ error: 'Style not found' });
      return;
    }

    // Validate CAD requirements for cost sheet creation
    // Path 1: CAD for COSTING purpose is approved
    const hasCostingCadApproved = await prisma.fabric_width_cad.findFirst({
      where: {
        costingStyleId: styleId,
        purpose: 'COSTING',
        approvalStatus: 'APPROVED',
      },
    });

    // Path 2: CAD for RAW_MATERIAL_CALCULATION is approved AND fabric costing is complete
    const hasRawMaterialCadApproved = await prisma.fabric_width_cad.findFirst({
      where: {
        costingStyleId: styleId,
        purpose: 'RAW_MATERIAL_CALCULATION',
        approvalStatus: 'APPROVED',
      },
    });

    // Check if fabric costing is complete (totalCostPerMeter is populated)
    const hasFabricCostingComplete = await prisma.fabric_width_cad.findFirst({
      where: {
        costingStyleId: styleId,
        purpose: 'COSTING',
        totalCostPerMeter: { not: null },
      },
    });

    // Allow if EITHER path is satisfied
    const canCreateCostSheet = hasCostingCadApproved ||
      (hasRawMaterialCadApproved && hasFabricCostingComplete);

    if (!canCreateCostSheet && style.cadStatus !== 'APPROVED') {
      res.status(400).json({
        error: 'CAD not approved',
        message: 'Either CAD for Costing must be approved, OR CAD for Raw Material must be approved with fabric costing complete',
        currentStatus: style.cadStatus,
        details: {
          costingCadApproved: !!hasCostingCadApproved,
          rawMaterialCadApproved: !!hasRawMaterialCadApproved,
          fabricCostingComplete: !!hasFabricCostingComplete,
        },
      });
      return;
    }

    // Check if cost sheet already exists - warn but still return preview data
    const existingCostSheet = await prisma.style_costing.findFirst({
      where: { styleId },
    });

    if (existingCostSheet) {
      logWarn(`Cost sheet already exists for style ${styleId}, returning preview only`);
    }

    // Fetch COSTING CAD data directly from fabric_width_cad by costingStyleId
    // This is where Fabric Costing saves data (not through styleFabricId)
    const costingCadRows = await prisma.fabric_width_cad.findMany({
      where: {
        costingStyleId: styleId,
        purpose: 'COSTING',
      },
      include: {
        fabric: { select: { fabricName: true } },
        greige: { select: { greigeName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Calculate fabric costs from COSTING CAD rows
    let totalFabricCost = 0;
    const fabricDetails: FabricDetail[] = [];

    // Group by componentName to avoid duplicates (take latest per component)
    const processedComponents = new Set<string>();

    for (const cadRow of costingCadRows) {
      const componentKey = cadRow.componentName || 'default';

      // Skip if we already processed this component (we have latest first)
      if (processedComponents.has(componentKey)) {
        continue;
      }
      processedComponents.add(componentKey);

      const fabricWidth = parseFloat(cadRow.cutableWidth?.toString() || '0');
      // Calculate CAD average (per-piece consumption) - NO fallback to cadMeters (layer length is useless for costing)
      let fabricAverage = 0;
      if (cadRow.cadAverage) {
        // Use stored cadAverage (per-piece consumption)
        fabricAverage = parseFloat(cadRow.cadAverage.toString());
      } else if (cadRow.cadMeters && cadRow.piecesPerMarker && cadRow.piecesPerMarker > 0) {
        // Calculate on-the-fly: (layerLength + margin) / pieces
        const layerLength = parseFloat(cadRow.cadMeters.toString());
        const layerMargin = cadRow.layerMarginMeters ? parseFloat(cadRow.layerMarginMeters.toString()) : 0;
        fabricAverage = (layerLength + layerMargin) / cadRow.piecesPerMarker;
      }
      // If neither available, fabricAverage stays 0 (will be skipped by the check below)
      const fabricRate = parseFloat(cadRow.totalCostPerMeter?.toString() || '0');

      // Skip if no meaningful data
      if (fabricAverage === 0 && fabricRate === 0) {
        logWarn(`CAD row ${cadRow.id} has no consumption or cost data - skipping`);
        continue;
      }

      const fabricCost = fabricAverage * fabricRate;
      totalFabricCost += fabricCost;

      fabricDetails.push({
        fabricName: cadRow.fabric?.fabricName || cadRow.greige?.greigeName || cadRow.componentName || 'Unknown Fabric',
        fabricWidth: fabricWidth,
        fabricAverage: fabricAverage,
        fabricRate: fabricRate,
        fabricTotal: fabricCost,
        fabricId: cadRow.fabricId || undefined,
        sourcingStrategy: cadRow.processorId ? 'GREIGE_PROCESSED' : 'READY_FABRIC',
        processorId: cadRow.processorId || undefined,
        greigeCost: cadRow.greigeCostPerMeter ? parseFloat(cadRow.greigeCostPerMeter.toString()) : undefined,
        processingCost: cadRow.processingPricePerMeter ? parseFloat(cadRow.processingPricePerMeter.toString()) : undefined,
      });
    }

    // Fallback 1: If no COSTING CAD rows found, try RAW_MATERIAL_CALCULATION mode
    // This allows users to skip COSTING mode and generate cost sheets from RAW_MATERIAL_CALCULATION data
    if (fabricDetails.length === 0) {
      logWarn(`No COSTING CAD data found for style ${styleId} - trying RAW_MATERIAL_CALCULATION`);

      const rmcCadRows = await prisma.fabric_width_cad.findMany({
        where: {
          costingStyleId: styleId,
          purpose: 'RAW_MATERIAL_CALCULATION',
        },
        include: {
          fabric: { select: { fabricName: true } },
          greige: { select: { greigeName: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      for (const cadRow of rmcCadRows) {
        const componentKey = cadRow.componentName || 'default';

        // Skip if we already processed this component (we have latest first)
        if (processedComponents.has(componentKey)) {
          continue;
        }
        processedComponents.add(componentKey);

        const fabricWidth = parseFloat(cadRow.cutableWidth?.toString() || '0');
        // Calculate CAD average (per-piece consumption) - NO fallback to cadMeters (layer length is useless for costing)
        let fabricAverage = 0;
        if (cadRow.cadAverage) {
          // Use stored cadAverage (per-piece consumption)
          fabricAverage = parseFloat(cadRow.cadAverage.toString());
        } else if (cadRow.cadMeters && cadRow.piecesPerMarker && cadRow.piecesPerMarker > 0) {
          // Calculate on-the-fly: (layerLength + margin) / pieces
          const layerLength = parseFloat(cadRow.cadMeters.toString());
          const layerMargin = cadRow.layerMarginMeters ? parseFloat(cadRow.layerMarginMeters.toString()) : 0;
          fabricAverage = (layerLength + layerMargin) / cadRow.piecesPerMarker;
        }
        // If neither available, fabricAverage stays 0 (will be skipped by the check below)
        const fabricRate = parseFloat(cadRow.totalCostPerMeter?.toString() || '0');

        // Skip if no meaningful data
        if (fabricAverage === 0 && fabricRate === 0) {
          logWarn(`RAW_MATERIAL_CALCULATION CAD row ${cadRow.id} has no consumption or cost data - skipping`);
          continue;
        }

        const fabricCost = fabricAverage * fabricRate;
        totalFabricCost += fabricCost;

        fabricDetails.push({
          fabricName: cadRow.fabric?.fabricName || cadRow.greige?.greigeName || cadRow.componentName || 'Unknown Fabric',
          fabricWidth: fabricWidth,
          fabricAverage: fabricAverage,
          fabricRate: fabricRate,
          fabricTotal: fabricCost,
          fabricId: cadRow.fabricId || undefined,
          sourcingStrategy: cadRow.processorId ? 'GREIGE_PROCESSED' : 'READY_FABRIC',
          processorId: cadRow.processorId || undefined,
          greigeCost: cadRow.greigeCostPerMeter ? parseFloat(cadRow.greigeCostPerMeter.toString()) : undefined,
          processingCost: cadRow.processingPricePerMeter ? parseFloat(cadRow.processingPricePerMeter.toString()) : undefined,
        });
      }
    }

    // Fallback 2: If still no CAD data, try legacy style_fabrics data
    if (fabricDetails.length === 0) {
      logWarn(`No CAD data found for style ${styleId} - falling back to style_fabrics`);

      for (const component of style.style_components) {
        for (const styleFabric of component.style_fabrics) {
          // Use deprecated cadAverageMeters field
          const fabricAverage = parseFloat(styleFabric.cadAverageMeters?.toString() || '0');

          if (fabricAverage === 0) {
            continue;
          }

          const fabricWidth = parseFloat(styleFabric.cutableWidth?.toString() || '0');
          const fabricRate = parseFloat(
            styleFabric.unitPrice?.toString() ||
            styleFabric.fabricCostPerMeter?.toString() ||
            '0'
          );

          const fabricCost = fabricAverage * fabricRate;
          totalFabricCost += fabricCost;

          fabricDetails.push({
            fabricName: styleFabric.fabric?.fabricName || styleFabric.fabricName || 'Unknown',
            fabricWidth: fabricWidth,
            fabricAverage: fabricAverage,
            fabricRate: fabricRate,
            fabricTotal: fabricCost,
          });
        }
      }
    }

    // Calculate material costs from BOM
    let totalTrimsCost = 0;
    let totalAccessoriesCost = 0;
    let totalEmbroideryMaterialCost = 0;
    const trimsDetails: TrimDetail[] = [];
    const accessoriesDetails: AccessoryDetail[] = [];
    const embroideryDetails: EmbroideryDetail[] = [];

    for (const bom of style.style_material_bom) {
      const quantity = parseFloat(bom.quantityPerGarment.toString());

      // Get material name and price from appropriate master table
      let materialName = 'Unknown';
      let masterPrice = 0;

      if (bom.lace_master) {
        materialName = bom.lace_master.laceName;
        masterPrice = parseFloat(bom.lace_master.pricePerMeter?.toString() || '0');
      } else if (bom.button_master) {
        materialName = bom.button_master.buttonName;
        masterPrice = parseFloat(bom.button_master.pricePerPiece?.toString() || '0');
      } else if (bom.thread_master) {
        materialName = bom.thread_master.threadName;
        masterPrice = parseFloat(bom.thread_master.pricePerCone?.toString() || '0');
      } else if (bom.zipper_master) {
        materialName = bom.zipper_master.zipperName;
        masterPrice = parseFloat(bom.zipper_master.pricePerPiece?.toString() || '0');
      } else if (bom.elastic_master) {
        materialName = bom.elastic_master.elasticName;
        masterPrice = parseFloat(bom.elastic_master.pricePerMeter?.toString() || '0');
      } else if (bom.label_master) {
        materialName = bom.label_master.labelName;
        masterPrice = parseFloat(bom.label_master.pricePerPiece?.toString() || '0');
      } else if (bom.packaging_master) {
        materialName = bom.packaging_master.packagingName;
        masterPrice = parseFloat(bom.packaging_master.pricePerPiece?.toString() || '0');
      }

      // Use BOM unitPrice if set, otherwise fallback to master price
      const unitPrice = parseFloat(bom.unitPrice?.toString() || '0') || masterPrice;
      const total = quantity * unitPrice;

      logInfo(`Processing BOM item: ${materialName}`, {
        quantity,
        unitPrice,
        masterPrice,
        total,
        usageCategory: bom.usageCategory,
        materialType: bom.materialType,
      });

      // Route to appropriate category based on usageCategory
      if (bom.usageCategory === 'GARMENT_TRIM') {
        trimsDetails.push({
          trimName: materialName,
          trimQuantity: quantity,
          trimRate: unitPrice,
          trimTotal: total,
        });
        totalTrimsCost += total;
      } else if (bom.usageCategory === 'PACKAGING') {
        accessoriesDetails.push({
          accessoryName: materialName,
          accessoryQuantity: quantity,
          accessoryRate: unitPrice,
          accessoryTotal: total,
        });
        totalAccessoriesCost += total;
      } else if (bom.usageCategory === 'VALUE_ADDITION') {
        // VALUE_ADDITION materials (special lace, embroidery materials) go to embroidery
        embroideryDetails.push({
          embroideryName: materialName,
          embroideryAverage: quantity,
          embroideryRate: unitPrice,
          embroideryTotal: total,
        });
        totalEmbroideryMaterialCost += total;
      } else {
        // Bug fix: Uncategorized materials default to trims to ensure nothing is lost
        logWarn(`BOM item "${materialName}" has no usageCategory (${bom.usageCategory}), defaulting to trims`);
        trimsDetails.push({
          trimName: materialName,
          trimQuantity: quantity,
          trimRate: unitPrice,
          trimTotal: total,
        });
        totalTrimsCost += total;
      }
    }

    // Calculate process costs
    let totalProcessingCost = 0;
    for (const process of style.style_processes) {
      if (process.estimatedCost) {
        totalProcessingCost += parseFloat(process.estimatedCost.toString());
      }
    }

    // Get number of components
    const numberOfComponents = style.style_components.length;

    // Get category from style (if available)
    const category = style.categoryId || '';
    const subCategory = '';

    // Ensure we have at least default thread trim
    if (trimsDetails.length === 0) {
      trimsDetails.push({
        trimName: 'Thread',
        trimQuantity: 0,
        trimRate: 0,
        trimTotal: 0,
      });
    }

    logInfo(`Cost sheet preview generated for style ${style.styleCode}`, {
      fabricCount: fabricDetails.length,
      trimsCount: trimsDetails.length,
      embroideryCount: embroideryDetails.length,
      accessoriesCount: accessoriesDetails.length,
      existingCostSheet: existingCostSheet ? existingCostSheet.id : null,
    });

    // Calculate total from all sources
    const grandTotal = totalFabricCost + totalTrimsCost + totalEmbroideryMaterialCost + totalAccessoriesCost + totalProcessingCost;

    // Return preview data WITHOUT creating in database
    // The frontend will use this to pre-fill the form, then user submits to actually create
    res.status(200).json({
      success: true,
      data: {
        // Basic Information for pre-fill
        numberOfComponents,
        category,
        subCategory,

        // Fabric details for pre-fill
        fabricDetails,
        fabricTotal: totalFabricCost,

        // Trims details for pre-fill
        trimsDetails,
        trimsTotal: totalTrimsCost,

        // Embroidery/Value Addition details for pre-fill
        embroideryDetails,
        embroideryTotal: totalEmbroideryMaterialCost,

        // Accessories/Packaging details for pre-fill
        accessoriesDetails,
        accessoriesTotal: totalAccessoriesCost,

        // Processing costs (for info)
        totalProcessingCost,

        // Defaults
        valueLossPercent: 2,
        markupPercent: 15,

        // Warning if cost sheet already exists
        existingCostSheetId: existingCostSheet?.id || null,
      },
      message: existingCostSheet
        ? 'Preview generated. Note: A cost sheet already exists for this style.'
        : 'Preview generated. Review and fill in CMT costs, then save.',
      summary: {
        autoCalculated: {
          fabricCost: totalFabricCost,
          trimsCost: totalTrimsCost,
          embroideryCost: totalEmbroideryMaterialCost,
          accessoriesCost: totalAccessoriesCost,
          processingCost: totalProcessingCost,
          total: grandTotal,
        },
        needsUserInput: [
          'Cutting Cost',
          'Stitching Cost',
          'Finishing Cost',
          'Button Attachment Cost',
          'Handwork Cost',
        ],
      },
    });
  } catch (error) {
    logError('Error generating cost sheet:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============================================================================
// BUDGET SUGGESTIONS FOR DIRECT PROCUREMENT
// ============================================================================

/**
 * Get budget suggestions for a style
 * Used when creating RAW_MATERIAL_CALCULATION or PRODUCTION cost sheets
 * without going through COSTING approval first
 * GET /api/style-costing/budget-suggestions/:styleId
 */
export const getBudgetSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;

    if (!styleId) {
      res.status(400).json({
        error: 'Style ID is required',
        message: 'Please provide a valid style ID',
      });
      return;
    }

    const suggestions = await costingService.getBudgetSuggestions(styleId);

    res.json({
      success: true,
      data: suggestions,
      message: 'Budget suggestions calculated successfully',
    });
  } catch (error) {
    logError('[getBudgetSuggestions] Error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Style not found',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
