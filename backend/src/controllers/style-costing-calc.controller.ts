import { Request, Response } from 'express';
import prisma from '../config/database';
import { logInfo, logWarn } from '../utils/logger';
import { costingService } from '../services/costing.service';
import { FabricDetail, TrimDetail, EmbroideryDetail, AccessoryDetail } from './style-costing.utils';
import { UnauthorizedError, NotFoundError, ValidationError } from '../errors';
import { multiplyCurrency, addCurrency, toNumber, toCurrency, Decimal } from '../utils/currency'; // BUG-SMP5 fix

// ============================================================================
// CALCULATION OPERATIONS
// ============================================================================

/**
 * Auto-generate cost sheet from approved CAD data
 * POST /api/style-costing/generate/:styleId
 */
export const generateCostSheetFromStyle = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
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
    throw new NotFoundError('Style', styleId);
  }

  // Validate CAD requirements for cost sheet creation.
  // Two-owner split (2026-08-22), policy decision: these gates require BOTH approvals —
  // CAD-geometry approval (consumption is final) AND the costing PRICE approval with a
  // real price. A CAD-approved-but-unpriced row must never make a style look "ready to cost"
  // (that used to pre-fill ₹0 fabric rates).
  // Path 1: COSTING purpose fully approved
  const hasCostingCadApproved = await prisma.fabric_width_cad.findFirst({
    where: {
      costingStyleId: styleId,
      purpose: 'COSTING',
      approvalStatus: 'APPROVED', // allow-cad-approval: CAD half of the both-approvals gate
      costingApprovalStatus: { in: ['APPROVED', 'ALTERNATE_APPROVED'] },
      totalCostPerMeter: { not: null },
    },
  });

  // Path 2: RAW_MATERIAL_CALCULATION fully approved AND fabric costing is complete
  const hasRawMaterialCadApproved = await prisma.fabric_width_cad.findFirst({
    where: {
      costingStyleId: styleId,
      purpose: 'RAW_MATERIAL_CALCULATION',
      approvalStatus: 'APPROVED', // allow-cad-approval: CAD half of the both-approvals gate
      costingApprovalStatus: { in: ['APPROVED', 'ALTERNATE_APPROVED'] },
      totalCostPerMeter: { not: null },
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

  // Landmine №3 fix: the style-level cadStatus stamp is NO LONGER a bypass of the
  // row-level both-approvals gate — ~40 legacy styles carried the stamp with zero
  // approved rows, and this escape hatch let them generate ₹0-rate cost sheets.
  if (!canCreateCostSheet) {
    throw new ValidationError(
      'Cost sheet needs a fabric row that is BOTH CAD-approved (CAD Planning) and costing-approved with a price (Fabric Costing Options). Approve the CAD and the costing first.'
    );
  }

  // Check if cost sheet already exists - warn but still return preview data
  const existingCostSheet = await prisma.style_costing.findFirst({
    where: { styleId },
  });

  if (existingCostSheet) {
    logWarn(`Cost sheet already exists for style ${styleId}, returning preview only`);
  }

  // Fetch CAD data directly from fabric_width_cad by costingStyleId
  // Priority: COSTING > RAW_MATERIAL_CALCULATION (fallback if COSTING doesn't exist)
  let costingCadRows = await prisma.fabric_width_cad.findMany({
    where: {
      costingStyleId: styleId,
      purpose: 'COSTING',
      // Uncosted rows must not feed the preview — they rendered as ₹0 fabric lines
      totalCostPerMeter: { not: null },
    },
    include: {
      fabric: { select: { fabricName: true } },
      greige: { select: { greigeName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Fallback to RAW_MATERIAL_CALCULATION if no COSTING CAD exists
  // This allows cost sheet to work when only RM CAD is available
  if (costingCadRows.length === 0) {
    costingCadRows = await prisma.fabric_width_cad.findMany({
      where: {
        costingStyleId: styleId,
        purpose: 'RAW_MATERIAL_CALCULATION',
        // PRICE approval (two-owner split) — this fallback feeds cost-sheet numbers
        costingApprovalStatus: 'APPROVED',
        totalCostPerMeter: { not: null },
      },
      include: {
        fabric: { select: { fabricName: true } },
        greige: { select: { greigeName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (costingCadRows.length > 0) {
      logInfo(`Using RAW_MATERIAL_CALCULATION CAD as fallback for cost sheet (styleId: ${styleId})`);
    }
  }

  // Calculate fabric costs from COSTING CAD rows
  // BUG-SMP5 fix: use decimal.js for aggregation
  let totalFabricCostDec = new Decimal(0);
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

    // BUG-SMP5 fix: use decimal.js for precision
    const fabricCostDec = multiplyCurrency(fabricAverage, fabricRate);
    const fabricCost = toNumber(fabricCostDec);
    totalFabricCostDec = totalFabricCostDec.plus(fabricCostDec);

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
        // Last-resort fallback is deliberately approval-free, but uncosted rows still
        // must not contribute ₹0 lines
        totalCostPerMeter: { not: null },
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

      // BUG-SMP5 fix: use decimal.js for precision
      const fabricCostDec = multiplyCurrency(fabricAverage, fabricRate);
      const fabricCost = toNumber(fabricCostDec);
      totalFabricCostDec = totalFabricCostDec.plus(fabricCostDec);

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

        // BUG-SMP5 fix: use decimal.js for precision
        const fabricCostDec = multiplyCurrency(fabricAverage, fabricRate);
        const fabricCost = toNumber(fabricCostDec);
        totalFabricCostDec = totalFabricCostDec.plus(fabricCostDec);

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
  // BUG-SMP5 fix: use decimal.js for aggregation
  let totalTrimsCostDec = new Decimal(0);
  let totalAccessoriesCostDec = new Decimal(0);
  let totalEmbroideryMaterialCostDec = new Decimal(0);
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

    let masterFound = false;
    for (const ext of masterExtractors) {
      const master = (bom as any)[ext.key];
      if (master) {
        masterFound = true;
        materialName = master[ext.nameField] || materialName;
        masterPrice = parseFloat(master[ext.priceField]?.toString() || '0');
        break;
      }
    }

    // Orphan BOM rows (no master relation and no unified materialId) carry no name or price
    // to cost — emitting them created phantom ₹0 trim rows the user had to invent values for
    // (mirrors the CAD no-data skip above)
    if (!masterFound && !bom.materialId) {
      logWarn(`BOM item "${materialName}" has no linked material master - skipping in cost sheet generation`);
      continue;
    }

    // GARMENT_TRIM lace is represented by the dedicated Lace Costing section (the form extracts
    // it from the BOM into laceDetails with sourcing strategies) — emitting it as a trim too
    // double-counts the lace once laceTotal joined the sheet subtotal
    if (bom.materialType === 'LACE' && bom.usageCategory === 'GARMENT_TRIM') {
      continue;
    }

    // Use BOM unitPrice if set, otherwise fallback to master price
    const unitPrice = parseFloat(bom.unitPrice?.toString() || '0') || masterPrice;
    // BUG-SMP5 fix: use decimal.js for precision
    const totalDec = multiplyCurrency(quantity, unitPrice);
    const total = toNumber(totalDec);

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
      // BUG-SMP5 fix: aggregate with decimal.js
      totalTrimsCostDec = totalTrimsCostDec.plus(totalDec);
    } else if (bom.usageCategory === 'PACKAGING') {
      accessoriesDetails.push({
        accessoryName: materialName,
        accessoryQuantity: quantity,
        accessoryRate: unitPrice,
        accessoryTotal: total,
      });
      // BUG-SMP5 fix: aggregate with decimal.js
      totalAccessoriesCostDec = totalAccessoriesCostDec.plus(totalDec);
    } else if (bom.usageCategory === 'VALUE_ADDITION') {
      // VALUE_ADDITION materials (special lace, embroidery materials) go to embroidery
      embroideryDetails.push({
        embroideryName: materialName,
        embroideryAverage: quantity,
        embroideryRate: unitPrice,
        embroideryTotal: total,
      });
      // BUG-SMP5 fix: aggregate with decimal.js
      totalEmbroideryMaterialCostDec = totalEmbroideryMaterialCostDec.plus(totalDec);
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
      // BUG-SMP5 fix: aggregate with decimal.js
      totalTrimsCostDec = totalTrimsCostDec.plus(totalDec);
    }
  }

  // Calculate process costs
  // BUG-SMP5 fix: use decimal.js for aggregation
  let totalProcessingCostDec = new Decimal(0);
  for (const process of style.style_processes) {
    if (process.estimatedCost) {
      totalProcessingCostDec = totalProcessingCostDec.plus(toCurrency(process.estimatedCost.toString()));
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
  // BUG-SMP5 fix: use decimal.js for aggregation and convert to number for response
  const totalFabricCost = toNumber(totalFabricCostDec);
  const totalTrimsCost = toNumber(totalTrimsCostDec);
  const totalEmbroideryMaterialCost = toNumber(totalEmbroideryMaterialCostDec);
  const totalAccessoriesCost = toNumber(totalAccessoriesCostDec);
  const totalProcessingCost = toNumber(totalProcessingCostDec);
  const grandTotal = toNumber(
    addCurrency(totalFabricCost, totalTrimsCost, totalEmbroideryMaterialCost, totalAccessoriesCost, totalProcessingCost)
  );

  // Uncosted CAD rows are now excluded from the preview (they used to render as ₹0 fabric
  // lines). Surface which components were skipped so the omission is visible, not silent.
  const uncostedRows = await prisma.fabric_width_cad.findMany({
    where: {
      costingStyleId: styleId,
      purpose: { in: ['COSTING', 'RAW_MATERIAL_CALCULATION'] },
      totalCostPerMeter: null,
    },
    select: { componentName: true },
  });
  const skippedUncosted = [
    ...new Set(
      uncostedRows
        // same key convention as the pricing loops above ('default' for unnamed)
        .filter((r) => !processedComponents.has(r.componentName || 'default'))
        .map((r) => r.componentName || 'Unnamed component')
    ),
  ];
  const warnings =
    skippedUncosted.length > 0
      ? [
          `${skippedUncosted.length} component(s) have CAD data but no costing and were left out: ${skippedUncosted.join(', ')}. Save a fabric costing for them first.`,
        ]
      : [];

  // Return preview data WITHOUT creating in database
  // The frontend will use this to pre-fill the form, then user submits to actually create
  res.status(200).json({
    success: true,
    warnings,
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
  const { styleId } = req.params;

  if (!styleId) {
    throw new ValidationError('Style ID is required');
  }

  const suggestions = await costingService.getBudgetSuggestions(styleId);

  res.json({
    success: true,
    data: suggestions,
    message: 'Budget suggestions calculated successfully',
  });
};
