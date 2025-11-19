import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

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
        availableWidth: 'asc',
      },
    });

    res.json(cads);
  } catch (error: any) {
    console.error('Error fetching CADs:', error);
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
  } catch (error: any) {
    console.error('Error fetching CAD entry:', error);
    res.status(500).json({ error: 'Failed to fetch CAD entry' });
  }
};

// Create new CAD entry
export const createCAD = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const {
      fabricId,
      availableWidth,
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
    if (!fabricId || !availableWidth) {
      return res.status(400).json({
        error: 'Missing required fields: fabricId, availableWidth',
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
        availableWidth: parseFloat(availableWidth),
      },
    });

    if (existingCAD) {
      return res.status(400).json({
        error: `CAD entry already exists for ${availableWidth}" width`,
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
        availableWidth: parseFloat(availableWidth),
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
  } catch (error: any) {
    console.error('Error creating CAD entry:', error);
    res.status(500).json({ error: 'Failed to create CAD entry' });
  }
};

// Update CAD entry
export const updateCAD = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      availableWidth,
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
    if (availableWidth && parseFloat(availableWidth) !== parseFloat(existingCAD.availableWidth.toString())) {
      const duplicateWidth = await prisma.fabric_width_cad.findFirst({
        where: {
          fabricId: existingCAD.fabricId,
          availableWidth: parseFloat(availableWidth),
        },
      });

      if (duplicateWidth) {
        return res.status(400).json({
          error: `CAD entry already exists for ${availableWidth}" width`,
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
        availableWidth: availableWidth ? parseFloat(availableWidth) : undefined,
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
  } catch (error: any) {
    console.error('Error updating CAD entry:', error);
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
  } catch (error: any) {
    console.error('Error deleting CAD entry:', error);
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
  } catch (error: any) {
    console.error('Error setting preferred width:', error);
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
            availableWidth: 'asc',
          },
        },
      },
    });

    if (!fabric) {
      return res.status(404).json({ error: 'Fabric not found' });
    }

    const orderQty = parseInt(orderQuantity as string);
    const baseCostPerMeter = parseFloat(fabric.costPerMeter.toString());

    // Calculate cost for each width option
    const comparison = fabric.widthCADs.map(cad => {
      const costPerMeter = baseCostPerMeter + parseFloat((cad.priceDifferential || 0).toString());
      const cadValue = parseFloat((cad.cadMeters || cad.cadYards || 0).toString());
      const costPerGarment = cadValue * costPerMeter;
      const totalFabricRequired = cadValue * orderQty;
      const totalCost = totalFabricRequired * costPerMeter;

      return {
        width: parseFloat(cad.availableWidth.toString()),
        isPreferred: cad.isPreferred,
        cadMeters: parseFloat((cad.cadMeters || 0).toString()),
        cadYards: parseFloat((cad.cadYards || 0).toString()),
        wastagePercent: parseFloat((cad.cadWastagePercent || 0).toString()),
        markerEfficiency: parseFloat((cad.markerEfficiency || 0).toString()),
        costPerMeter,
        priceDifferential: parseFloat((cad.priceDifferential || 0).toString()),
        costPerGarment,
        totalFabricRequired,
        totalCost,
        supplierAvailability: cad.supplierAvailability,
        notes: cad.notes,
      };
    });

    // Find best option (lowest cost per garment)
    const bestOption = comparison.reduce((prev, current) =>
      current.costPerGarment < prev.costPerGarment ? current : prev
    , comparison[0]);

    res.json({
      fabric: {
        id: fabric.id,
        fabricCode: fabric.fabricCode,
        fabricName: fabric.fabricName,
        baseCostPerMeter,
      },
      orderQuantity: orderQty,
      options: comparison,
      bestOption: {
        width: bestOption.width,
        savings: comparison.map(opt =>
          opt.width === bestOption.width ? 0 : opt.totalCost - bestOption.totalCost
        ).reduce((a, b) => Math.max(a, b), 0),
      },
    });
  } catch (error: any) {
    console.error('Error calculating cost comparison:', error);
    res.status(500).json({ error: 'Failed to calculate cost comparison' });
  }
};

// Get CAD statistics
export const getCADStatistics = async (req: Request, res: Response) => {
  try {
    const totalCADs = await prisma.fabric_width_cad.count();

    // Most common widths
    const commonWidths = await prisma.$queryRaw<Array<{ available_width: number; count: bigint }>>`
      SELECT "availableWidth" as available_width, COUNT(*) as count
      FROM fabric_width_cad
      GROUP BY "availableWidth"
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
  } catch (error: any) {
    console.error('Error fetching CAD statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};
