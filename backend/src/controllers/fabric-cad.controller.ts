import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Fabric Width CAD Controller
 * Manages CAD consumption data for different fabric widths
 */

// Get all CAD entries for a fabric
export const getCADsByFabricId = async (req: Request, res: Response) => {
  try {
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
  } catch (error: unknown) {
    logError('Error fetching CADs:', error);
    res.status(500).json({ error: 'Failed to fetch CAD entries' });
  }
};

// Get single CAD entry by ID
export const getCADById = async (req: Request, res: Response) => {
  try {
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
      return res.status(404).json({ error: 'CAD entry not found' });
    }

    res.json(cad);
  } catch (error: unknown) {
    logError('Error fetching CAD entry:', error);
    res.status(500).json({ error: 'Failed to fetch CAD entry' });
  }
};

// Create new CAD entry
export const createCAD = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const {
      fabricId,
      cutableWidth,
      widthUnit = 'inches',
      cadMeters,
      cadYards,
      cadWastagePercent = 5,
      markerEfficiency,
      isPreferred = false,
      supplierAvailability,
      priceDifferential,
      markerPlanFile,
      markerLengthMeters,
      piecesPerMarker,
      notes,
    } = req.body;

    // Validate required fields
    if (!fabricId || !cutableWidth) {
      return res.status(400).json({
        error: 'Missing required fields: fabricId, cutableWidth',
      });
    }

    // At least one CAD value required
    if (!cadMeters && !cadYards) {
      return res.status(400).json({
        error: 'At least one CAD value (meters or yards) is required',
      });
    }

    // Check if fabric exists
    const fabric = await prisma.fabric_master.findUnique({
      where: { id: fabricId },
    });

    if (!fabric) {
      return res.status(400).json({ error: 'Fabric master not found' });
    }

    // Check for duplicate width
    const existingCAD = await prisma.fabric_width_cad.findFirst({
      where: {
        fabricId,
        cutableWidth: parseFloat(cutableWidth),
      },
    });

    if (existingCAD) {
      return res.status(400).json({
        error: `CAD entry already exists for ${cutableWidth}" width`,
      });
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
        cadWastagePercent: parseFloat(cadWastagePercent),
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

    res.status(201).json(cad);
  } catch (error: unknown) {
    logError('Error creating CAD entry:', error);
    res.status(500).json({ error: 'Failed to create CAD entry' });
  }
};

// Update CAD entry
export const updateCAD = async (req: Request, res: Response) => {
  try {
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
      return res.status(404).json({ error: 'CAD entry not found' });
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
        return res.status(400).json({
          error: `CAD entry already exists for ${cutableWidth}" width`,
        });
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
        markerEfficiency: markerEfficiency !== undefined ? (markerEfficiency ? parseFloat(markerEfficiency) : null) : undefined,
        isPreferred: isPreferred !== undefined ? isPreferred : undefined,
        supplierAvailability,
        priceDifferential: priceDifferential !== undefined ? (priceDifferential ? parseFloat(priceDifferential) : null) : undefined,
        markerPlanFile,
        markerLengthMeters: markerLengthMeters !== undefined ? (markerLengthMeters ? parseFloat(markerLengthMeters) : null) : undefined,
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
  } catch (error: unknown) {
    logError('Error updating CAD entry:', error);
    res.status(500).json({ error: 'Failed to update CAD entry' });
  }
};

// Delete CAD entry
export const deleteCAD = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if CAD entry exists
    const existingCAD = await prisma.fabric_width_cad.findUnique({
      where: { id },
    });

    if (!existingCAD) {
      return res.status(404).json({ error: 'CAD entry not found' });
    }

    await prisma.fabric_width_cad.delete({
      where: { id },
    });

    res.json({ message: 'CAD entry deleted successfully' });
  } catch (error: unknown) {
    logError('Error deleting CAD entry:', error);
    res.status(500).json({ error: 'Failed to delete CAD entry' });
  }
};

// Set preferred width for a fabric
export const setPreferredWidth = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if CAD entry exists
    const existingCAD = await prisma.fabric_width_cad.findUnique({
      where: { id },
    });

    if (!existingCAD) {
      return res.status(404).json({ error: 'CAD entry not found' });
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
  } catch (error: unknown) {
    logError('Error setting preferred width:', error);
    res.status(500).json({ error: 'Failed to set preferred width' });
  }
};

// Get cost comparison for different widths
export const getCostComparison = async (req: Request, res: Response) => {
  try {
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
      return res.status(404).json({ error: 'Fabric not found' });
    }

    const orderQty = parseInt(orderQuantity as string);
    // Note: Cost calculations removed - pricing now comes from procurement system
    // This endpoint now returns consumption/CAD data only

    // Calculate consumption for each width option
    const comparison = fabric.widthCADs.map(cad => {
      const cadValue = parseFloat((cad.cadMeters || cad.cadYards || 0).toString());
      const totalFabricRequired = cadValue * orderQty;

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
    const bestOption = comparison.reduce((prev, current) =>
      current.totalFabricRequired < prev.totalFabricRequired ? current : prev
    , comparison[0]);

    res.json({
      fabric: {
        id: fabric.id,
        fabricCode: fabric.fabricCode,
        fabricName: fabric.fabricName,
      },
      orderQuantity: orderQty,
      options: comparison,
      bestOption: {
        width: bestOption.width,
        fabricSaved: comparison.map(opt =>
          opt.width === bestOption.width ? 0 : opt.totalFabricRequired - bestOption.totalFabricRequired
        ).reduce((a, b) => Math.max(a, b), 0),
      },
    });
  } catch (error: unknown) {
    logError('Error calculating cost comparison:', error);
    res.status(500).json({ error: 'Failed to calculate cost comparison' });
  }
};

// Get CAD statistics
export const getCADStatistics = async (req: Request, res: Response) => {
  try {
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
      commonWidths: commonWidths.map(item => ({
        width: parseFloat(item.available_width.toString()),
        count: Number(item.count),
      })),
    });
  } catch (error: unknown) {
    logError('Error fetching CAD statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};
