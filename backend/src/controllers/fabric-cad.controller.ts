import { Request, Response } from 'express';
import prisma from '../config/database';
import { logInfo, logDebug } from '../utils/logger';
import { ValidationError, NotFoundError } from '../errors';
import { systemSettingsService } from '../services/system-settings.service';
import { multiplyCurrency, toNumber } from '../utils/currency'; // BUG-CAD8 fix

/**
 * Fabric Width CAD Controller
 * Manages CAD consumption data for different fabric widths
 */

// Get all CAD entries for a fabric
export const getCADsByFabricId = async (req: Request, res: Response) => {
  const { fabricId } = req.params;

  const cads = await prisma.fabric_width_cad.findMany({
    where: { fabricId },
    include: {
      fabric: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: {
      cutableWidth: 'asc',
    },
  });

  res.json(cads);
};

// Get single CAD entry by ID
export const getCADById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const cad = await prisma.fabric_width_cad.findUnique({
    where: { id },
    include: {
      fabric: {
        include: {
          greige: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!cad) {
    throw new NotFoundError('CAD entry', id);
  }

  res.json(cad);
};

// Create new CAD entry
export const createCAD = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    fabricId,
    cutableWidth,
    widthUnit = 'inches',
    cadMeters,
    cadYards,
    cadWastagePercent,
    markerEfficiency,
    isPreferred = false,
    supplierAvailability,
    priceDifferential,
    markerPlanFile,
    markerLengthMeters,
    piecesPerMarker,
    notes,
  } = req.body;

  // Resolve wastage default from system settings if not provided
  const resolvedCadWastagePercent =
    cadWastagePercent != null
      ? Number(cadWastagePercent)
      : await systemSettingsService.getNumber('FABRIC_DEFAULT_WASTAGE_PERCENT', 0);

  // Validate required fields
  if (!fabricId || !cutableWidth) {
    throw new ValidationError('Missing required fields: fabricId, cutableWidth');
  }

  // At least one CAD value required
  if (!cadMeters && !cadYards) {
    throw new ValidationError('At least one CAD value (meters or yards) is required');
  }

  // Check if fabric exists
  const fabric = await prisma.fabric_master.findUnique({
    where: { id: fabricId },
  });

  if (!fabric) {
    throw new ValidationError('Fabric master not found');
  }

  // Check for duplicate width
  const existingCAD = await prisma.fabric_width_cad.findFirst({
    where: {
      fabricId,
      cutableWidth: parseFloat(cutableWidth),
    },
  });

  if (existingCAD) {
    throw new ValidationError(`CAD entry already exists for ${cutableWidth}" width`);
  }

  // If this is marked as preferred, unset other preferred entries for this fabric
  if (isPreferred) {
    await prisma.fabric_width_cad.updateMany({
      where: {
        fabricId,
        isPreferred: true,
      },
      data: {
        isPreferred: false,
      },
    });
  }

  const cad = await prisma.fabric_width_cad.create({
    data: {
      fabricId,
      cutableWidth: parseFloat(cutableWidth),
      widthUnit,
      cadMeters: cadMeters ? parseFloat(cadMeters) : null,
      cadYards: cadYards ? parseFloat(cadYards) : null,
      cadWastagePercent: resolvedCadWastagePercent,
      markerEfficiency: markerEfficiency ? parseFloat(markerEfficiency) : null,
      isPreferred,
      supplierAvailability,
      priceDifferential: priceDifferential ? parseFloat(priceDifferential) : null,
      markerPlanFile,
      markerLengthMeters: markerLengthMeters ? parseFloat(markerLengthMeters) : null,
      piecesPerMarker: piecesPerMarker ? parseInt(piecesPerMarker) : null,
      notes,
      createdById: userId,
    },
    include: {
      fabric: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  res.status(201).json({ data: cad, message: 'Fabric CAD created successfully' });
};

// Update CAD entry
export const updateCAD = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    cutableWidth,
    widthUnit,
    cadMeters,
    cadYards,
    cadWastagePercent,
    markerEfficiency,
    isPreferred,
    supplierAvailability,
    priceDifferential,
    markerPlanFile,
    markerLengthMeters,
    piecesPerMarker,
    notes,
  } = req.body;

  // Check if CAD entry exists
  const existingCAD = await prisma.fabric_width_cad.findUnique({
    where: { id },
  });

  if (!existingCAD) {
    throw new NotFoundError('CAD entry', id);
  }

  // If updating width, check for duplicates
  if (cutableWidth && parseFloat(cutableWidth) !== parseFloat(existingCAD.cutableWidth.toString())) {
    const duplicateWidth = await prisma.fabric_width_cad.findFirst({
      where: {
        fabricId: existingCAD.fabricId,
        cutableWidth: parseFloat(cutableWidth),
      },
    });

    if (duplicateWidth) {
      throw new ValidationError(`CAD entry already exists for ${cutableWidth}" width`);
    }
  }

  // If setting as preferred, unset other preferred entries
  if (isPreferred === true && !existingCAD.isPreferred) {
    await prisma.fabric_width_cad.updateMany({
      where: {
        fabricId: existingCAD.fabricId,
        isPreferred: true,
        id: { not: id },
      },
      data: {
        isPreferred: false,
      },
    });
  }

  const updatedCAD = await prisma.fabric_width_cad.update({
    where: { id },
    data: {
      cutableWidth: cutableWidth ? parseFloat(cutableWidth) : undefined,
      widthUnit,
      cadMeters: cadMeters !== undefined ? (cadMeters ? parseFloat(cadMeters) : null) : undefined,
      cadYards: cadYards !== undefined ? (cadYards ? parseFloat(cadYards) : null) : undefined,
      cadWastagePercent: cadWastagePercent ? parseFloat(cadWastagePercent) : undefined,
      markerEfficiency:
        markerEfficiency !== undefined ? (markerEfficiency ? parseFloat(markerEfficiency) : null) : undefined,
      isPreferred: isPreferred !== undefined ? isPreferred : undefined,
      supplierAvailability,
      priceDifferential:
        priceDifferential !== undefined ? (priceDifferential ? parseFloat(priceDifferential) : null) : undefined,
      markerPlanFile,
      markerLengthMeters:
        markerLengthMeters !== undefined ? (markerLengthMeters ? parseFloat(markerLengthMeters) : null) : undefined,
      piecesPerMarker: piecesPerMarker !== undefined ? (piecesPerMarker ? parseInt(piecesPerMarker) : null) : undefined,
      notes,
    },
    include: {
      fabric: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  res.json(updatedCAD);
};

// Delete CAD entry
export const deleteCAD = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if CAD entry exists
  const existingCAD = await prisma.fabric_width_cad.findUnique({
    where: { id },
  });

  if (!existingCAD) {
    throw new NotFoundError('CAD entry', id);
  }

  await prisma.fabric_width_cad.delete({
    where: { id },
  });

  res.json({ message: 'CAD entry deleted successfully' });
};

// Set preferred width for a fabric
export const setPreferredWidth = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if CAD entry exists
  const existingCAD = await prisma.fabric_width_cad.findUnique({
    where: { id },
  });

  if (!existingCAD) {
    throw new NotFoundError('CAD entry', id);
  }

  // Unset all other preferred entries for this fabric
  await prisma.fabric_width_cad.updateMany({
    where: {
      fabricId: existingCAD.fabricId,
      isPreferred: true,
    },
    data: {
      isPreferred: false,
    },
  });

  // Set this one as preferred
  const updatedCAD = await prisma.fabric_width_cad.update({
    where: { id },
    data: {
      isPreferred: true,
    },
    include: {
      fabric: true,
    },
  });

  res.json(updatedCAD);
};

// Get cost comparison for different widths
export const getCostComparison = async (req: Request, res: Response) => {
  const { fabricId } = req.params;
  const { orderQuantity = 1000 } = req.query;

  const fabric = await prisma.fabric_master.findUnique({
    where: { id: fabricId as string },
    include: {
      widthCADs: {
        orderBy: {
          cutableWidth: 'asc',
        },
      },
    },
  });

  if (!fabric) {
    throw new NotFoundError('Fabric', fabricId);
  }

  const orderQty = parseInt(orderQuantity as string);
  // Note: Cost calculations removed - pricing now comes from procurement system
  // This endpoint now returns consumption/CAD data only

  // Calculate consumption for each width option
  const comparison = fabric.widthCADs.map((cad) => {
    const cadValue = parseFloat((cad.cadMeters || cad.cadYards || 0).toString());
    // BUG-CAD8 fix: use decimal.js for safe arithmetic
    const totalFabricRequired = toNumber(multiplyCurrency(cadValue, orderQty));

    return {
      width: parseFloat(cad.cutableWidth.toString()),
      isPreferred: cad.isPreferred,
      cadMeters: parseFloat((cad.cadMeters || 0).toString()),
      cadYards: parseFloat((cad.cadYards || 0).toString()),
      wastagePercent: parseFloat((cad.cadWastagePercent || 0).toString()),
      markerEfficiency: parseFloat((cad.markerEfficiency || 0).toString()),
      totalFabricRequired,
      supplierAvailability: cad.supplierAvailability,
      notes: cad.notes,
    };
  });

  // Find best option (lowest fabric consumption)
  const bestOption =
    comparison.length > 0
      ? comparison.reduce(
          (prev, current) => (current.totalFabricRequired < prev.totalFabricRequired ? current : prev),
          comparison[0]
        )
      : null;

  res.json({
    fabric: {
      id: fabric.id,
      fabricCode: fabric.fabricCode,
      fabricName: fabric.fabricName,
    },
    orderQuantity: orderQty,
    options: comparison,
    bestOption: bestOption
      ? {
          width: bestOption.width,
          fabricSaved: comparison
            .map((opt) =>
              opt.width === bestOption.width ? 0 : opt.totalFabricRequired - bestOption.totalFabricRequired
            )
            .reduce((a, b) => Math.max(a, b), 0),
        }
      : null,
  });
};

// Get CAD statistics
export const getCADStatistics = async (req: Request, res: Response) => {
  const totalCADs = await prisma.fabric_width_cad.count();

  // Most common widths
  const commonWidths = await prisma.$queryRaw<Array<{ available_width: number; count: bigint }>>`
    SELECT "cutableWidth" as available_width, COUNT(*) as count
    FROM fabric_width_cad
    GROUP BY "cutableWidth"
    ORDER BY count DESC
    LIMIT 10
  `;

  // Average marker efficiency
  const avgEfficiency = await prisma.fabric_width_cad.aggregate({
    where: {
      markerEfficiency: { not: null },
    },
    _avg: {
      markerEfficiency: true,
    },
  });

  res.json({
    totalCADEntries: totalCADs,
    averageMarkerEfficiency: avgEfficiency._avg.markerEfficiency,
    commonWidths: commonWidths.map((item) => ({
      width: parseFloat(item.available_width.toString()),
      count: Number(item.count),
    })),
  });
};
