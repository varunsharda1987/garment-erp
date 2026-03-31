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
            // Generic trim masters
            hook_eye_master: true,
            snap_button_master: true,
            buckle_master: true,
            belt_master: true,
            velcro_master: true,
            drawstring_master: true,
            ribbon_master: true,
            sequin_master: true,
            bead_master: true,
            motif_master: true,
            interlining_master: true,
            padding_master: true,
            other_fastener_master: true,
            other_tape_master: true,
            other_decorative_master: true,
            other_functional_master: true,
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
    const canCreateCostSheet = hasCostingCadApproved || (hasRawMaterialCadApproved && hasFabricCostingComplete);

    if (!canCreateCostSheet && style.cadStatus !== 'APPROVED') {
      res.status(400).json({
        error: 'CAD not approved',
        message:
          'Either CAD for Costing must be approved, OR CAD for Raw Material must be approved with fabric costing complete',
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
        processingCost: cadRow.processingPricePerMeter
          ? parseFloat(cadRow.processingPricePerMeter.toString())
          : undefined,
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
          fabricName:
            cadRow.fabric?.fabricName || cadRow.greige?.greigeName || cadRow.componentName || 'Unknown Fabric',
          fabricWidth: fabricWidth,
          fabricAverage: fabricAverage,
          fabricRate: fabricRate,
          fabricTotal: fabricCost,
          fabricId: cadRow.fabricId || undefined,
          sourcingStrategy: cadRow.processorId ? 'GREIGE_PROCESSED' : 'READY_FABRIC',
          processorId: cadRow.processorId || undefined,
          greigeCost: cadRow.greigeCostPerMeter ? parseFloat(cadRow.greigeCostPerMeter.toString()) : undefined,
          processingCost: cadRow.processingPricePerMeter
            ? parseFloat(cadRow.processingPricePerMeter.toString())
            : undefined,
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
            styleFabric.unitPrice?.toString() || styleFabric.fabricCostPerMeter?.toString() || '0'
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

      // Get material name and price from appropriate master table (data-driven)
      let materialName = bom.componentName || 'Unknown';
      let masterPrice = 0;

      // Master relation → name/price field mapping (legacy + generic trims)
      const masterExtractors: Array<{ key: string; nameField: string; priceField: string }> = [
        { key: 'lace_master', nameField: 'laceName', priceField: 'pricePerMeter' },
        { key: 'button_master', nameField: 'buttonName', priceField: 'pricePerPiece' },
        { key: 'thread_master', nameField: 'threadName', priceField: 'pricePerCone' },
        { key: 'zipper_master', nameField: 'zipperName', priceField: 'pricePerPiece' },
        { key: 'elastic_master', nameField: 'elasticName', priceField: 'pricePerMeter' },
        { key: 'label_master', nameField: 'labelName', priceField: 'pricePerPiece' },
        { key: 'packaging_master', nameField: 'packagingName', priceField: 'pricePerPiece' },
        // Generic trim masters
        { key: 'hook_eye_master', nameField: 'hookEyeName', priceField: 'pricePerPair' },
        { key: 'snap_button_master', nameField: 'snapButtonName', priceField: 'pricePerPiece' },
        { key: 'buckle_master', nameField: 'buckleName', priceField: 'pricePerPiece' },
        { key: 'belt_master', nameField: 'beltName', priceField: 'pricePerPiece' },
        { key: 'velcro_master', nameField: 'velcroName', priceField: 'pricePerMeter' },
        { key: 'drawstring_master', nameField: 'drawstringName', priceField: 'pricePerMeter' },
        { key: 'ribbon_master', nameField: 'ribbonName', priceField: 'pricePerMeter' },
        { key: 'sequin_master', nameField: 'sequinName', priceField: 'pricePerMeter' },
        { key: 'bead_master', nameField: 'beadName', priceField: 'pricePerPack' },
        { key: 'motif_master', nameField: 'motifName', priceField: 'pricePerPiece' },
        { key: 'interlining_master', nameField: 'interliningName', priceField: 'pricePerMeter' },
        { key: 'padding_master', nameField: 'paddingName', priceField: 'pricePerPair' },
        { key: 'other_fastener_master', nameField: 'otherFastenerName', priceField: 'pricePerPiece' },
        { key: 'other_tape_master', nameField: 'otherTapeName', priceField: 'pricePerMeter' },
        { key: 'other_decorative_master', nameField: 'otherDecorativeName', priceField: 'pricePerPiece' },
        { key: 'other_functional_master', nameField: 'otherFunctionalName', priceField: 'pricePerPiece' },
      ];

      for (const ext of masterExtractors) {
        const master = (bom as any)[ext.key];
        if (master) {
          materialName = master[ext.nameField] || materialName;
          masterPrice = parseFloat(master[ext.priceField]?.toString() || '0');
          break;
        }
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
          materialType: bom.materialType,
          unit: bom.unit,
          // Pass through all FK IDs from style_material_bom
          materialId: bom.materialId || undefined,
          threadId: bom.threadId || undefined,
          buttonId: bom.buttonId || undefined,
          zipperId: bom.zipperId || undefined,
          elasticId: bom.elasticId || undefined,
          labelId: bom.labelId || undefined,
          packagingId: bom.packagingId || undefined,
          hookEyeId: bom.hookEyeId || undefined,
          snapButtonId: bom.snapButtonId || undefined,
          buckleId: bom.buckleId || undefined,
          beltId: bom.beltId || undefined,
          velcroId: bom.velcroId || undefined,
          drawstringId: bom.drawstringId || undefined,
          ribbonId: bom.ribbonId || undefined,
          sequinId: bom.sequinId || undefined,
          beadId: bom.beadId || undefined,
          motifId: bom.motifId || undefined,
          interliningId: bom.interliningId || undefined,
          paddingId: bom.paddingId || undefined,
          otherFastenerId: bom.otherFastenerId || undefined,
          otherTapeId: bom.otherTapeId || undefined,
          otherDecorativeId: bom.otherDecorativeId || undefined,
          otherFunctionalId: bom.otherFunctionalId || undefined,
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
          materialType: bom.materialType,
          unit: bom.unit,
          materialId: bom.materialId || undefined,
          threadId: bom.threadId || undefined,
          buttonId: bom.buttonId || undefined,
          zipperId: bom.zipperId || undefined,
          elasticId: bom.elasticId || undefined,
          labelId: bom.labelId || undefined,
          packagingId: bom.packagingId || undefined,
          hookEyeId: bom.hookEyeId || undefined,
          snapButtonId: bom.snapButtonId || undefined,
          buckleId: bom.buckleId || undefined,
          beltId: bom.beltId || undefined,
          velcroId: bom.velcroId || undefined,
          drawstringId: bom.drawstringId || undefined,
          ribbonId: bom.ribbonId || undefined,
          sequinId: bom.sequinId || undefined,
          beadId: bom.beadId || undefined,
          motifId: bom.motifId || undefined,
          interliningId: bom.interliningId || undefined,
          paddingId: bom.paddingId || undefined,
          otherFastenerId: bom.otherFastenerId || undefined,
          otherTapeId: bom.otherTapeId || undefined,
          otherDecorativeId: bom.otherDecorativeId || undefined,
          otherFunctionalId: bom.otherFunctionalId || undefined,
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
    const grandTotal =
      totalFabricCost + totalTrimsCost + totalEmbroideryMaterialCost + totalAccessoriesCost + totalProcessingCost;

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
        needsUserInput: ['Cutting Cost', 'Stitching Cost', 'Finishing Cost', 'Button Attachment Cost', 'Handwork Cost'],
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
