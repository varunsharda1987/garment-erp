import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { logInfo, logWarn } from '../utils/logger';
import { UnauthorizedError, NotFoundError, ValidationError, BusinessError } from '../errors';
import { systemSettingsService } from '../services/system-settings.service';
import {
  StyleCostingWhereInput,
  FabricDetail,
  TrimDetail,
  EmbroideryDetail,
  AccessoryDetail,
  FabricDetailSchema,
  TrimDetailSchema,
  EmbroideryDetailSchema,
  AccessoryDetailSchema,
  CreateCostSheetSchema,
  UpdateCostSheetSchema,
  parseJsonArray,
} from './style-costing.utils';

// ============================================================================
// Re-export from sub-controllers for backward compatibility
// ============================================================================
export { generateCostSheetFromStyle, getBudgetSuggestions } from './style-costing-calc.controller';
export {
  approveCostSheet,
  createCostSheetVersion,
  getCostSheetVersions,
  compareCostSheetVersions,
  copyCostSheetForProcurement,
  updateActuals,
  approveVariance,
} from './style-costing-approval.controller';

// ============================================================================
// CRUD CONTROLLER FUNCTIONS
// ============================================================================

/**
 * Create a new Cost Sheet for a style
 * POST /api/style-costing
 */
export const createCostSheet = async (req: Request, res: Response): Promise<void> => {
  const validatedData = CreateCostSheetSchema.parse(req.body);
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  // Check if style exists
  const style = await prisma.styles.findUnique({
    where: { id: validatedData.styleId },
  });

  if (!style) {
    throw new NotFoundError('Style', validatedData.styleId);
  }

  // Check if cost sheet already exists for this style IN THE SAME MODE
  // Different modes (COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION) can have their own cost sheets
  const existingCostSheet = await prisma.style_costing.findFirst({
    where: {
      styleId: validatedData.styleId,
      purpose: validatedData.purpose, // Only check within same mode
    },
  });

  // Generate width combination hash and description from fabric widths
  const fabricWidths = validatedData.fabricDetails
    .map((f) => f.fabricWidth)
    .filter((w) => w > 0)
    .sort((a, b) => a - b);
  const widthCombinationHash = fabricWidths.length > 0 ? fabricWidths.join('-') : 'default';
  const widthCombinationDescription =
    fabricWidths.length > 0 ? fabricWidths.map((w) => `${w}"`).join(' + ') : 'Default Width';

  // Check if a cost sheet with the same width combination already exists
  if (existingCostSheet) {
    const existingHash = (existingCostSheet as any).widthCombinationHash || 'default';
    if (existingHash === widthCombinationHash) {
      throw new BusinessError(
        `A cost sheet for width combination "${widthCombinationDescription}" already exists. Use update or create a new version.`
      );
    }
    // Different width combination - allow creation
  }

  // Calculate the next version for this style+purpose combination
  // Each mode has its own independent version sequence
  const maxVersionRecord = await prisma.style_costing.findFirst({
    where: {
      styleId: validatedData.styleId,
      purpose: validatedData.purpose,
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (maxVersionRecord?.version || 0) + 1;

  // Calculate totals from arrays (excluding items marked as Not Applicable)
  const fabricTotal = validatedData.fabricDetails
    .filter((f) => !f.isNotApplicable)
    .reduce((sum, f) => sum + f.fabricTotal, 0);
  const trimsTotal = validatedData.trimsDetails
    .filter((t) => !t.isNotApplicable)
    .reduce((sum, t) => sum + t.trimTotal, 0);
  const cmtTotal = Object.values(validatedData.cmtCosts).reduce((sum, c) => sum + c, 0);
  const embroideryTotal = validatedData.embroideryDetails
    .filter((e) => !e.isNotApplicable)
    .reduce((sum, e) => sum + e.embroideryTotal, 0);
  const accessoriesTotal = validatedData.accessoriesDetails
    .filter((a) => !a.isNotApplicable)
    .reduce((sum, a) => sum + a.accessoryTotal, 0);

  // Calculate subtotal (before value loss and markup)
  const subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal + accessoriesTotal;

  // Calculate value loss
  const valueLossAmount = (subtotal * validatedData.valueLossPercent) / 100;
  const totalAfterValueLoss = subtotal + valueLossAmount;

  // Calculate markup
  const markupAmount = (totalAfterValueLoss * validatedData.markupPercent) / 100;
  const totalProductCost = totalAfterValueLoss + markupAmount;

  // Calculate derived cost fields for display
  const totalMaterialCost = fabricTotal + trimsTotal + accessoriesTotal;
  const totalProcessingCost = embroideryTotal + cmtTotal;
  const totalCostPerPiece = totalProductCost; // Same as totalProductCost (per piece cost)
  const sellingPricePerPiece = totalProductCost; // Base selling price equals total cost

  // Generate unique ID for cost sheet
  const costSheetId = `CS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Create cost sheet
  const costSheet = await prisma.style_costing.create({
    data: {
      id: costSheetId,
      styleId: validatedData.styleId,
      purpose: validatedData.purpose, // Cost sheet purpose/mode
      version: nextVersion, // Version per (styleId, purpose) combination

      // Basic Information
      numberOfComponents: validatedData.numberOfComponents,
      category: validatedData.category,
      subCategory: validatedData.subCategory,

      // Fabric Details
      fabricDetails: JSON.parse(JSON.stringify(validatedData.fabricDetails)),
      fabricTotal,

      // Trims Details
      trimsDetails: JSON.parse(JSON.stringify(validatedData.trimsDetails)),
      trimsTotal,

      // CMT Costs
      cuttingCost: validatedData.cmtCosts.cuttingCost,
      stitchingCost: validatedData.cmtCosts.stitchingCost,
      finishingCost: validatedData.cmtCosts.finishingCost,
      buttonAttachmentCost: validatedData.cmtCosts.buttonAttachmentCost,
      handworkCmtCost: validatedData.cmtCosts.handworkCost,
      cmtTotal,

      // Embroidery Details
      embroideryDetails: JSON.parse(JSON.stringify(validatedData.embroideryDetails)),
      embroideryTotal,

      // Accessories Details
      accessoriesDetails: JSON.parse(JSON.stringify(validatedData.accessoriesDetails)),
      accessoriesTotal,

      // Value Loss
      valueLossPercent: validatedData.valueLossPercent,
      valueLossAmount,

      // Markup
      markupPercent: validatedData.markupPercent,
      markupAmount,

      // Calculated Totals
      subtotal,
      totalProductCost,
      totalMaterialCost,
      totalProcessingCost,
      totalCostPerPiece,
      sellingPricePerPiece,

      // Width Combination (for multi-width support)
      widthCombinationHash,
      widthCombinationDescription,

      // Additional
      notes: validatedData.notes,
      createdById: userId,

      // Closed Cost - Final agreed price with customer
      closedCost: validatedData.closedCost || null,
      closedCostNotes: validatedData.closedCostNotes || null,

      // Budget Fields (for direct procurement in RAW_MATERIAL_CALCULATION/PRODUCTION)
      ...(validatedData.enableBudgetTracking && {
        // Calculate budgets from totals if not explicitly provided
        fabricBudget: validatedData.fabricBudget ?? fabricTotal,
        trimsBudget: validatedData.trimsBudget ?? trimsTotal,
        cmtBudget: validatedData.cmtBudget ?? cmtTotal,
        embroideryBudget: validatedData.embroideryBudget ?? embroideryTotal,
        accessoriesBudget: validatedData.accessoriesBudget ?? accessoriesTotal,
        totalBudget: validatedData.totalBudget ?? totalProductCost,
        // Buffer percentages with defaults
        fabricBufferPercent: validatedData.fabricBufferPercent ?? 5.0,
        trimsBufferPercent: validatedData.trimsBufferPercent ?? 10.0,
        cmtBufferPercent: validatedData.cmtBufferPercent ?? 5.0,
        embroideryBufferPercent: validatedData.embroideryBufferPercent ?? 8.0,
        accessoriesBufferPercent: validatedData.accessoriesBufferPercent ?? 10.0,
      }),

      // Order Linking (optional)
      ...(validatedData.orderId && { orderId: validatedData.orderId }),
      ...(validatedData.orderItemId && { orderItemId: validatedData.orderItemId }),
    },
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          categoryId: true,
        },
      },
      users_style_costing_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Populate style_costing_fabric_items from fabric_width_cad (follows lace pattern)
  try {
    const cadRows = await prisma.fabric_width_cad.findMany({
      where: { costingStyleId: validatedData.styleId },
      include: {
        fabric: { select: { id: true, fabricName: true, greigeId: true } },
        greige: { select: { id: true, greigeName: true } },
        batchGroupColor: { select: { colorName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const seenComponents = new Set<string>();
    const fabricItemsToCreate: any[] = [];

    for (const cad of cadRows) {
      const key = cad.componentName || cad.styleFabricId || cad.id;
      if (seenComponents.has(key)) continue;
      seenComponents.add(key);

      // Match to fabricDetails JSON by index for rate/average
      const idx = fabricItemsToCreate.length;
      const jsonFabric = validatedData.fabricDetails[idx];
      if (!jsonFabric) continue;

      const cadAvg = jsonFabric.fabricAverage || 0;
      const cadRate = jsonFabric.fabricRate || 0;
      const wastage =
        cad.cadWastagePercent != null
          ? Number(cad.cadWastagePercent)
          : await systemSettingsService.getNumber('FABRIC_DEFAULT_WASTAGE_PERCENT', 0);
      const effectiveCad = cadAvg * (1 + wastage / 100);

      fabricItemsToCreate.push({
        costingId: costSheetId,
        fabricCADId: cad.id,
        fabricId: cad.fabricId || null,
        greigeId: cad.greigeId || cad.fabric?.greigeId || null,
        fabricName: jsonFabric.fabricName || cad.fabric?.fabricName || cad.greige?.greigeName || 'Unknown Fabric',
        colorName: cad.batchGroupColor?.colorName || null,
        width: cad.cutableWidth,
        cadMeters: cadAvg,
        cadWastagePercent: wastage,
        effectiveCad,
        costPerMeter: cadRate,
        totalCost: effectiveCad * cadRate,
        sourcingStrategy: cad.processorId ? 'GREIGE_PROCESSED' : 'READY_FABRIC',
        processorId: cad.processorId || null,
        greigeCost: cad.greigeCostPerMeter || null,
        processingCost: cad.processingPricePerMeter || null,
      });
    }

    if (fabricItemsToCreate.length > 0) {
      await prisma.style_costing_fabric_items.createMany({ data: fabricItemsToCreate });
      logInfo(`Created ${fabricItemsToCreate.length} fabric items for cost sheet ${costSheetId}`);
    }
  } catch (fabricItemError) {
    logWarn('Failed to populate fabric items (non-blocking):', fabricItemError);
  }

  // Populate style_costing_trim_items from trimsDetails JSON (relational source of truth)
  try {
    if (validatedData.trimsDetails && validatedData.trimsDetails.length > 0) {
      const trimItemsToCreate = validatedData.trimsDetails.map((trim) => ({
        costingId: costSheetId,
        trimName: trim.trimName,
        trimQuantity: trim.trimQuantity,
        trimRate: trim.trimRate,
        trimTotal: trim.trimTotal,
        unit: trim.unit || null,
        isNotApplicable: trim.isNotApplicable || false,
        materialType: trim.materialType || null,
        bomId: trim.bomId || null,
        // All 23 FK fields - only one will be populated based on materialType
        materialId: trim.materialId || null,
        threadId: trim.threadId || null,
        buttonId: trim.buttonId || null,
        zipperId: trim.zipperId || null,
        elasticId: trim.elasticId || null,
        labelId: trim.labelId || null,
        packagingId: trim.packagingId || null,
        hookEyeId: trim.hookEyeId || null,
        snapButtonId: trim.snapButtonId || null,
        buckleId: trim.buckleId || null,
        beltId: trim.beltId || null,
        velcroId: trim.velcroId || null,
        drawstringId: trim.drawstringId || null,
        ribbonId: trim.ribbonId || null,
        sequinId: trim.sequinId || null,
        beadId: trim.beadId || null,
        motifId: trim.motifId || null,
        interliningId: trim.interliningId || null,
        paddingId: trim.paddingId || null,
        otherFastenerId: trim.otherFastenerId || null,
        otherTapeId: trim.otherTapeId || null,
        otherDecorativeId: trim.otherDecorativeId || null,
        otherFunctionalId: trim.otherFunctionalId || null,
        // Generic fallback for NEW material types
        masterId: trim.masterId || null,
      }));
      await prisma.style_costing_trim_items.createMany({ data: trimItemsToCreate });
      logInfo(`Created ${trimItemsToCreate.length} trim items for cost sheet ${costSheetId}`);
    }
  } catch (trimItemError) {
    logWarn('Failed to populate trim items (non-blocking):', trimItemError);
  }

  // Populate style_costing_accessory_items from accessoriesDetails JSON (relational source of truth)
  try {
    if (validatedData.accessoriesDetails && validatedData.accessoriesDetails.length > 0) {
      const accessoryItemsToCreate = validatedData.accessoriesDetails.map((acc) => ({
        costingId: costSheetId,
        accessoryName: acc.accessoryName,
        accessoryQuantity: acc.accessoryQuantity,
        accessoryRate: acc.accessoryRate,
        accessoryTotal: acc.accessoryTotal,
        isNotApplicable: acc.isNotApplicable || false,
        materialType: acc.materialType || null,
        materialId: acc.materialId || null,
        labelId: acc.labelId || null,
        packagingId: acc.packagingId || null,
        // Generic fallback for NEW accessory types
        masterId: acc.masterId || null,
      }));
      await prisma.style_costing_accessory_items.createMany({ data: accessoryItemsToCreate });
      logInfo(`Created ${accessoryItemsToCreate.length} accessory items for cost sheet ${costSheetId}`);
    }
  } catch (accessoryItemError) {
    logWarn('Failed to populate accessory items (non-blocking):', accessoryItemError);
  }

  // Populate style_costing_lace_items from laceDetails JSON (if provided via main form)
  try {
    if (validatedData.laceDetails && validatedData.laceDetails.length > 0) {
      const laceItemsToCreate = validatedData.laceDetails.map((lace) => ({
        costingId: costSheetId,
        laceId: lace.laceId || '', // Required field
        laceName: lace.laceName,
        colorName: null,
        width: lace.laceWidth || null,
        quantityPerGarment: lace.laceAverage || 0,
        wastagePercent: 5, // Default
        effectiveQuantity: lace.laceAverage * 1.05, // With default wastage
        sourcingStrategy: lace.sourcingStrategy || 'READY_LACE',
        greigeCost: lace.greigeCost || null,
        processingCost: lace.processingCost || null,
        readyLaceCost: lace.laceRate || null,
        stockCost: null,
        costPerMeter: lace.laceRate || 0,
        totalCost: lace.laceTotal || 0,
        greigeLaceId: lace.greigeLaceId || null,
        processorId: lace.processorId || null,
        rateCardId: lace.rateCardId || null,
        stockLotId: null,
        procurementId: null,
        labDipId: null,
        labDipStatus: null,
        isManualOverride: false,
        overrideReason: null,
        notes: null,
      }));
      await prisma.style_costing_lace_items.createMany({ data: laceItemsToCreate });
      logInfo(`Created ${laceItemsToCreate.length} lace items for cost sheet ${costSheetId}`);
    }
  } catch (laceItemError) {
    logWarn('Failed to populate lace items (non-blocking):', laceItemError);
  }

  res.status(201).json({
    success: true,
    data: costSheet,
    message: 'Cost sheet created successfully',
  });
};

/**
 * Get all cost sheets with filtering and pagination
 * GET /api/style-costing
 */
export const getAllCostSheets = async (req: Request, res: Response): Promise<void> => {
  const { page = '1', limit = '10', search = '', approved = 'all' } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: StyleCostingWhereInput = {};

  // Search by style code or style name
  if (search) {
    where.styles = {
      OR: [
        { styleCode: { contains: search as string, mode: 'insensitive' } },
        { styleName: { contains: search as string, mode: 'insensitive' } },
      ],
    };
  }

  // Filter by approval status
  if (approved !== 'all') {
    if (approved === 'approved') {
      where.approvalStatus = 'APPROVED';
    } else if (approved === 'pending') {
      where.approvalStatus = 'PENDING';
    } else if (approved === 'rejected') {
      where.approvalStatus = 'REJECTED';
    } else if (approved === 'true') {
      // Legacy support for boolean filter
      where.isApproved = true;
    } else if (approved === 'false') {
      where.isApproved = false;
    }
  }

  // Get total count
  const total = await prisma.style_costing.count({ where });

  // Get cost sheets
  const costSheets = await prisma.style_costing.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { createdAt: 'desc' },
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          categoryId: true,
        },
      },
      users_style_costing_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      users_style_costing_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      // Include linked orders for tracking
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          orderDate: true,
        },
      },
      orderItem: {
        select: {
          id: true,
          orderId: true,
          totalQuantity: true,
          orders: {
            select: {
              orderNumber: true,
              status: true,
            },
          },
        },
      },
    },
  });

  res.json({
    success: true,
    data: costSheets,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get cost sheet by ID
 * GET /api/style-costing/:id
 */
export const getCostSheetById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const costSheet = await prisma.style_costing.findUnique({
    where: { id },
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          categoryId: true,
        },
      },
      users_style_costing_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users_style_costing_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!costSheet) {
    throw new NotFoundError('Cost sheet', id);
  }

  res.json({
    success: true,
    data: costSheet,
  });
};

/**
 * Get cost sheet by style ID
 * GET /api/style-costing/style/:styleId
 */
export const getCostSheetByStyle = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;

  const costSheet = await prisma.style_costing.findFirst({
    where: { styleId },
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          categoryId: true,
        },
      },
      users_style_costing_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users_style_costing_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!costSheet) {
    throw new NotFoundError('Cost sheet for style', styleId);
  }

  res.json({
    success: true,
    data: costSheet,
  });
};

/**
 * Get all cost sheets for a style grouped by width combination
 * GET /api/style-costing/style/:styleId/grouped
 * Returns all cost sheets for a style, grouped by width combination hash
 */
export const getCostSheetsGroupedByWidth = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;

  const costSheets = await prisma.style_costing.findMany({
    where: { styleId },
    orderBy: [{ widthCombinationHash: 'asc' }, { version: 'desc' }],
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          categoryId: true,
        },
      },
      users_style_costing_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users_style_costing_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Group by width combination
  const grouped: Record<
    string,
    {
      widthCombinationHash: string;
      widthCombinationDescription: string;
      costSheets: typeof costSheets;
    }
  > = {};

  for (const cs of costSheets) {
    const hash = (cs as any).widthCombinationHash || 'default';
    const desc = (cs as any).widthCombinationDescription || 'Default Width';

    if (!grouped[hash]) {
      grouped[hash] = {
        widthCombinationHash: hash,
        widthCombinationDescription: desc,
        costSheets: [],
      };
    }
    grouped[hash].costSheets.push(cs);
  }

  res.json({
    success: true,
    data: {
      styleId,
      widthCombinations: Object.values(grouped),
      totalCostSheets: costSheets.length,
      totalWidthCombinations: Object.keys(grouped).length,
    },
  });
};

/**
 * Update cost sheet
 * PUT /api/style-costing/:id
 * Note: Cannot update approved cost sheets
 */
export const updateCostSheet = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const validatedData = UpdateCostSheetSchema.parse(req.body);

  // Check if cost sheet exists
  const existingCostSheet = await prisma.style_costing.findUnique({
    where: { id },
  });

  if (!existingCostSheet) {
    throw new NotFoundError('Cost sheet', id);
  }

  // Cannot update approved cost sheets
  // Use approvalStatus if available (new enum), fallback to legacy isApproved
  const isApprovedCostSheet = (existingCostSheet as any).approvalStatus === 'APPROVED' || existingCostSheet.isApproved;

  if (isApprovedCostSheet) {
    throw new BusinessError('Cannot update approved cost sheet. Please create a new version if changes are needed.');
  }

  // If rejected, reset the status to pending on update (allows resubmission)
  const shouldResetToPending = (existingCostSheet as any).approvalStatus === 'REJECTED';

  // Get current or updated values - use JSON parse/stringify for safe type conversion
  const fabricDetails =
    validatedData.fabricDetails || parseJsonArray(existingCostSheet.fabricDetails, FabricDetailSchema, 'fabricDetails');
  const trimsDetails =
    validatedData.trimsDetails || parseJsonArray(existingCostSheet.trimsDetails, TrimDetailSchema, 'trimsDetails');
  const cmtCosts = validatedData.cmtCosts || {
    cuttingCost: Number(existingCostSheet.cuttingCost),
    stitchingCost: Number(existingCostSheet.stitchingCost),
    finishingCost: Number(existingCostSheet.finishingCost),
    buttonAttachmentCost: Number(existingCostSheet.buttonAttachmentCost),
    handworkCost: Number(existingCostSheet.handworkCmtCost),
  };
  const embroideryDetails =
    validatedData.embroideryDetails ||
    parseJsonArray(existingCostSheet.embroideryDetails, EmbroideryDetailSchema, 'embroideryDetails');
  const accessoriesDetails =
    validatedData.accessoriesDetails ||
    parseJsonArray(existingCostSheet.accessoriesDetails, AccessoryDetailSchema, 'accessoriesDetails');
  const valueLossPercent = validatedData.valueLossPercent ?? Number(existingCostSheet.valueLossPercent);
  const markupPercent = validatedData.markupPercent ?? Number(existingCostSheet.markupPercent);

  // Recalculate totals (excluding items marked as Not Applicable)
  const fabricTotal = fabricDetails
    .filter((f: FabricDetail) => !f.isNotApplicable)
    .reduce((sum: number, f: FabricDetail) => sum + (f.fabricTotal || 0), 0);
  const trimsTotal = trimsDetails
    .filter((t: TrimDetail) => !t.isNotApplicable)
    .reduce((sum: number, t: TrimDetail) => sum + (t.trimTotal || 0), 0);
  const cmtTotal = Object.values(cmtCosts).reduce((sum: number, c) => sum + ((c as number) || 0), 0);
  const embroideryTotal = embroideryDetails
    .filter((e: EmbroideryDetail) => !e.isNotApplicable)
    .reduce((sum: number, e: EmbroideryDetail) => sum + (e.embroideryTotal || 0), 0);
  const accessoriesTotal = accessoriesDetails
    .filter((a: AccessoryDetail) => !a.isNotApplicable)
    .reduce((sum: number, a: AccessoryDetail) => sum + (a.accessoryTotal || 0), 0);

  const subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal + accessoriesTotal;
  const valueLossAmount = (subtotal * valueLossPercent) / 100;
  const totalAfterValueLoss = subtotal + valueLossAmount;
  const markupAmount = (totalAfterValueLoss * markupPercent) / 100;
  const totalProductCost = totalAfterValueLoss + markupAmount;

  // Calculate derived cost fields for display
  const totalMaterialCost = fabricTotal + trimsTotal + accessoriesTotal;
  const totalProcessingCost = embroideryTotal + cmtTotal;
  const totalCostPerPiece = totalProductCost;
  const sellingPricePerPiece = totalProductCost;

  // Build update data
  const updateData: Prisma.style_costingUpdateInput = {
    // If previously rejected, reset to pending so it can be resubmitted for approval
    ...(shouldResetToPending && {
      approvalStatus: 'PENDING',
      rejectionNotes: null,
    }),
    // Update purpose/mode if provided
    ...(validatedData.purpose !== undefined && { purpose: validatedData.purpose }),
    ...(validatedData.numberOfComponents !== undefined && { numberOfComponents: validatedData.numberOfComponents }),
    ...(validatedData.category !== undefined && { category: validatedData.category }),
    ...(validatedData.subCategory !== undefined && { subCategory: validatedData.subCategory }),

    ...(validatedData.fabricDetails && { fabricDetails: JSON.parse(JSON.stringify(validatedData.fabricDetails)) }),
    fabricTotal,

    ...(validatedData.trimsDetails && { trimsDetails: JSON.parse(JSON.stringify(validatedData.trimsDetails)) }),
    trimsTotal,

    ...(validatedData.cmtCosts && {
      cuttingCost: cmtCosts.cuttingCost,
      stitchingCost: cmtCosts.stitchingCost,
      finishingCost: cmtCosts.finishingCost,
      buttonAttachmentCost: cmtCosts.buttonAttachmentCost,
      handworkCmtCost: cmtCosts.handworkCost,
    }),
    cmtTotal,

    ...(validatedData.embroideryDetails && {
      embroideryDetails: JSON.parse(JSON.stringify(validatedData.embroideryDetails)),
    }),
    embroideryTotal,

    ...(validatedData.accessoriesDetails && {
      accessoriesDetails: JSON.parse(JSON.stringify(validatedData.accessoriesDetails)),
    }),
    accessoriesTotal,

    ...(validatedData.valueLossPercent !== undefined && { valueLossPercent }),
    valueLossAmount,

    ...(validatedData.markupPercent !== undefined && { markupPercent }),
    markupAmount,

    subtotal,
    totalProductCost,
    totalMaterialCost,
    totalProcessingCost,
    totalCostPerPiece,
    sellingPricePerPiece,

    ...(validatedData.notes !== undefined && { notes: validatedData.notes }),

    // Closed Cost - Final agreed price with customer
    ...(validatedData.closedCost !== undefined && { closedCost: validatedData.closedCost }),
    ...(validatedData.closedCostNotes !== undefined && { closedCostNotes: validatedData.closedCostNotes }),
  };

  const updatedCostSheet = await prisma.style_costing.update({
    where: { id },
    data: updateData,
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          categoryId: true,
        },
      },
      users_style_costing_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Re-populate style_costing_fabric_items from fabric_width_cad on update
  try {
    const styleId = existingCostSheet.styleId;
    // Delete old fabric items
    await prisma.style_costing_fabric_items.deleteMany({ where: { costingId: id } });

    const cadRows = await prisma.fabric_width_cad.findMany({
      where: { costingStyleId: styleId },
      include: {
        fabric: { select: { id: true, fabricName: true, greigeId: true } },
        greige: { select: { id: true, greigeName: true } },
        batchGroupColor: { select: { colorName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const currentFabricDetails =
      validatedData.fabricDetails ||
      parseJsonArray(existingCostSheet.fabricDetails, FabricDetailSchema, 'fabricDetails');
    const seenComponents = new Set<string>();
    const fabricItemsToCreate: any[] = [];

    for (const cad of cadRows) {
      const key = cad.componentName || cad.styleFabricId || cad.id;
      if (seenComponents.has(key)) continue;
      seenComponents.add(key);

      const idx = fabricItemsToCreate.length;
      const jsonFabric = currentFabricDetails[idx];
      if (!jsonFabric) continue;

      const cadAvg = jsonFabric.fabricAverage || 0;
      const cadRate = jsonFabric.fabricRate || 0;
      const wastage =
        cad.cadWastagePercent != null
          ? Number(cad.cadWastagePercent)
          : await systemSettingsService.getNumber('FABRIC_DEFAULT_WASTAGE_PERCENT', 0);
      const effectiveCad = cadAvg * (1 + wastage / 100);

      fabricItemsToCreate.push({
        costingId: id,
        fabricCADId: cad.id,
        fabricId: cad.fabricId || null,
        greigeId: cad.greigeId || cad.fabric?.greigeId || null,
        fabricName: jsonFabric.fabricName || cad.fabric?.fabricName || cad.greige?.greigeName || 'Unknown Fabric',
        colorName: cad.batchGroupColor?.colorName || null,
        width: cad.cutableWidth,
        cadMeters: cadAvg,
        cadWastagePercent: wastage,
        effectiveCad,
        costPerMeter: cadRate,
        totalCost: effectiveCad * cadRate,
        sourcingStrategy: cad.processorId ? 'GREIGE_PROCESSED' : 'READY_FABRIC',
        processorId: cad.processorId || null,
        greigeCost: cad.greigeCostPerMeter || null,
        processingCost: cad.processingPricePerMeter || null,
      });
    }

    if (fabricItemsToCreate.length > 0) {
      await prisma.style_costing_fabric_items.createMany({ data: fabricItemsToCreate });
      logInfo(`Re-created ${fabricItemsToCreate.length} fabric items for cost sheet ${id}`);
    }
  } catch (fabricItemError) {
    logWarn('Failed to re-populate fabric items on update (non-blocking):', fabricItemError);
  }

  // Re-populate style_costing_trim_items from trimsDetails JSON
  try {
    // Delete existing trim items
    await prisma.style_costing_trim_items.deleteMany({ where: { costingId: id } });

    const currentTrimsDetails =
      validatedData.trimsDetails || parseJsonArray(existingCostSheet.trimsDetails, TrimDetailSchema, 'trimsDetails');

    if (currentTrimsDetails && currentTrimsDetails.length > 0) {
      const trimItemsToCreate = currentTrimsDetails.map((trim: any) => ({
        costingId: id,
        trimName: trim.trimName,
        trimQuantity: trim.trimQuantity,
        trimRate: trim.trimRate,
        trimTotal: trim.trimTotal,
        unit: trim.unit || null,
        isNotApplicable: trim.isNotApplicable || false,
        materialType: trim.materialType || null,
        bomId: trim.bomId || null,
        materialId: trim.materialId || null,
        threadId: trim.threadId || null,
        buttonId: trim.buttonId || null,
        zipperId: trim.zipperId || null,
        elasticId: trim.elasticId || null,
        labelId: trim.labelId || null,
        packagingId: trim.packagingId || null,
        hookEyeId: trim.hookEyeId || null,
        snapButtonId: trim.snapButtonId || null,
        buckleId: trim.buckleId || null,
        beltId: trim.beltId || null,
        velcroId: trim.velcroId || null,
        drawstringId: trim.drawstringId || null,
        ribbonId: trim.ribbonId || null,
        sequinId: trim.sequinId || null,
        beadId: trim.beadId || null,
        motifId: trim.motifId || null,
        interliningId: trim.interliningId || null,
        paddingId: trim.paddingId || null,
        otherFastenerId: trim.otherFastenerId || null,
        otherTapeId: trim.otherTapeId || null,
        otherDecorativeId: trim.otherDecorativeId || null,
        otherFunctionalId: trim.otherFunctionalId || null,
        // Generic fallback for NEW material types
        masterId: trim.masterId || null,
      }));
      await prisma.style_costing_trim_items.createMany({ data: trimItemsToCreate });
      logInfo(`Re-created ${trimItemsToCreate.length} trim items for cost sheet ${id}`);
    }
  } catch (trimItemError) {
    logWarn('Failed to re-populate trim items on update (non-blocking):', trimItemError);
  }

  // Re-populate style_costing_accessory_items from accessoriesDetails JSON
  try {
    // Delete existing accessory items
    await prisma.style_costing_accessory_items.deleteMany({ where: { costingId: id } });

    const currentAccessoriesDetails =
      validatedData.accessoriesDetails ||
      parseJsonArray(existingCostSheet.accessoriesDetails, AccessoryDetailSchema, 'accessoriesDetails');

    if (currentAccessoriesDetails && currentAccessoriesDetails.length > 0) {
      const accessoryItemsToCreate = currentAccessoriesDetails.map((acc: any) => ({
        costingId: id,
        accessoryName: acc.accessoryName,
        accessoryQuantity: acc.accessoryQuantity,
        accessoryRate: acc.accessoryRate,
        accessoryTotal: acc.accessoryTotal,
        isNotApplicable: acc.isNotApplicable || false,
        materialType: acc.materialType || null,
        materialId: acc.materialId || null,
        labelId: acc.labelId || null,
        packagingId: acc.packagingId || null,
        // Generic fallback for NEW accessory types
        masterId: acc.masterId || null,
      }));
      await prisma.style_costing_accessory_items.createMany({ data: accessoryItemsToCreate });
      logInfo(`Re-created ${accessoryItemsToCreate.length} accessory items for cost sheet ${id}`);
    }
  } catch (accessoryItemError) {
    logWarn('Failed to re-populate accessory items on update (non-blocking):', accessoryItemError);
  }

  // Re-populate style_costing_lace_items from laceDetails JSON (if provided)
  try {
    // Only re-create lace items if laceDetails was explicitly provided in update
    if (validatedData.laceDetails && validatedData.laceDetails.length > 0) {
      // Delete existing lace items
      await prisma.style_costing_lace_items.deleteMany({ where: { costingId: id } });

      const laceItemsToCreate = validatedData.laceDetails.map((lace: any) => ({
        costingId: id,
        laceId: lace.laceId || '',
        laceName: lace.laceName,
        colorName: null,
        width: lace.laceWidth || null,
        quantityPerGarment: lace.laceAverage || 0,
        wastagePercent: 5,
        effectiveQuantity: (lace.laceAverage || 0) * 1.05,
        sourcingStrategy: lace.sourcingStrategy || 'READY_LACE',
        greigeCost: lace.greigeCost || null,
        processingCost: lace.processingCost || null,
        readyLaceCost: lace.laceRate || null,
        stockCost: null,
        costPerMeter: lace.laceRate || 0,
        totalCost: lace.laceTotal || 0,
        greigeLaceId: lace.greigeLaceId || null,
        processorId: lace.processorId || null,
        rateCardId: lace.rateCardId || null,
        stockLotId: null,
        procurementId: null,
        labDipId: null,
        labDipStatus: null,
        isManualOverride: false,
        overrideReason: null,
        notes: null,
      }));
      await prisma.style_costing_lace_items.createMany({ data: laceItemsToCreate });
      logInfo(`Re-created ${laceItemsToCreate.length} lace items for cost sheet ${id}`);
    }
  } catch (laceItemError) {
    logWarn('Failed to re-populate lace items on update (non-blocking):', laceItemError);
  }

  res.json({
    success: true,
    data: updatedCostSheet,
    message: 'Cost sheet updated successfully',
  });
};

/**
 * Delete cost sheet (soft delete by setting as inactive)
 * DELETE /api/style-costing/:id
 * Note: Cannot delete approved cost sheets
 */
export const deleteCostSheet = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const costSheet = await prisma.style_costing.findUnique({
    where: { id },
  });

  if (!costSheet) {
    throw new NotFoundError('Cost sheet', id);
  }

  // Cannot delete approved cost sheets
  if (costSheet.isApproved) {
    throw new BusinessError(
      'Cannot delete approved cost sheet. Approved cost sheets cannot be deleted for audit purposes.'
    );
  }

  // Soft delete by removing the record (or you could add an isActive field)
  await prisma.style_costing.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Cost sheet deleted successfully',
  });
};
