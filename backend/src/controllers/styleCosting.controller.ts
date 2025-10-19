// Style Costing controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Create or update costing for a style
 * POST /api/styles/:styleId/costing
 */
export const createOrUpdateCosting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const {
      totalFabricCost,
      totalAccessoryCost,
      totalMaterialCost,
      printingCost,
      dyingCost,
      embroideryCost,
      handworkCost,
      totalProcessingCost,
      cuttingCost,
      stitchingCost,
      finishingCost,
      checkingCost,
      packingCost,
      totalProductionCost,
      overheadCost,
      profitMargin,
      totalCostPerPiece,
      sellingPricePerPiece,
      notes,
    } = req.body;

    // Check if costing already exists
    const existingCosting = await prisma.styleCosting.findUnique({
      where: { styleId },
    });

    let costing;
    if (existingCosting) {
      // Update existing costing
      costing = await prisma.styleCosting.update({
        where: { styleId },
        data: {
          totalFabricCost,
          totalAccessoryCost,
          totalMaterialCost,
          printingCost,
          dyingCost,
          embroideryCost,
          handworkCost,
          totalProcessingCost,
          cuttingCost,
          stitchingCost,
          finishingCost,
          checkingCost,
          packingCost,
          totalProductionCost,
          overheadCost,
          profitMargin,
          totalCostPerPiece,
          sellingPricePerPiece,
          notes,
        },
      });
    } else {
      // Create new costing
      costing = await prisma.styleCosting.create({
        data: {
          styleId,
          totalFabricCost: totalFabricCost || 0,
          totalAccessoryCost: totalAccessoryCost || 0,
          totalMaterialCost: totalMaterialCost || 0,
          printingCost: printingCost || 0,
          dyingCost: dyingCost || 0,
          embroideryCost: embroideryCost || 0,
          handworkCost: handworkCost || 0,
          totalProcessingCost: totalProcessingCost || 0,
          cuttingCost: cuttingCost || 0,
          stitchingCost: stitchingCost || 0,
          finishingCost: finishingCost || 0,
          checkingCost: checkingCost || 0,
          packingCost: packingCost || 0,
          totalProductionCost: totalProductionCost || 0,
          overheadCost: overheadCost || 0,
          profitMargin: profitMargin || 0,
          totalCostPerPiece: totalCostPerPiece || 0,
          sellingPricePerPiece: sellingPricePerPiece || 0,
          notes,
        },
      });
    }

    res.status(200).json({
      data: costing,
      message: 'Costing saved successfully',
    });
  } catch (error) {
    console.error('Create/update costing error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to save costing',
    });
  }
};

/**
 * Get costing for a style
 * GET /api/styles/:styleId/costing
 */
export const getCosting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;

    const costing = await prisma.styleCosting.findUnique({
      where: { styleId },
      include: {
        style: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
          },
        },
      },
    });

    if (!costing) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Costing not found for this style',
      });
      return;
    }

    res.status(200).json({ data: costing });
  } catch (error) {
    console.error('Get costing error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch costing',
    });
  }
};

/**
 * Auto-calculate costing from components
 * POST /api/styles/:styleId/costing/calculate
 */
export const calculateCosting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;

    // Get style with all components, fabrics, and accessories
    const style = await prisma.style.findUnique({
      where: { id: styleId },
      include: {
        components: {
          include: {
            fabrics: true,
            accessories: true,
          },
        },
        processes: true,
      },
    });

    if (!style) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Style not found',
      });
      return;
    }

    // Calculate fabric cost
    let totalFabricCost = 0;
    for (const component of style.components) {
      for (const fabric of component.fabrics) {
        if (fabric.cadAverageMeters && fabric.unitPrice) {
          const fabricCost = Number(fabric.cadAverageMeters) * Number(fabric.unitPrice);
          totalFabricCost += fabricCost;
        }
      }
    }

    // Calculate accessory cost
    let totalAccessoryCost = 0;
    for (const component of style.components) {
      for (const accessory of component.accessories) {
        if (accessory.quantityPerPiece && accessory.unitPrice) {
          const accessoryCost = Number(accessory.quantityPerPiece) * Number(accessory.unitPrice);
          totalAccessoryCost += accessoryCost;
        }
      }
    }

    // Total material cost
    const totalMaterialCost = totalFabricCost + totalAccessoryCost;

    // Calculate processing costs
    let printingCost = 0;
    let dyingCost = 0;
    let embroideryCost = 0;
    let handworkCost = 0;

    for (const process of style.processes) {
      const cost = Number(process.estimatedCost || 0);
      switch (process.processName.toLowerCase()) {
        case 'printing':
          printingCost += cost;
          break;
        case 'dying':
        case 'dyeing':
          dyingCost += cost;
          break;
        case 'embroidery':
          embroideryCost += cost;
          break;
        case 'handwork':
          handworkCost += cost;
          break;
      }
    }

    const totalProcessingCost = printingCost + dyingCost + embroideryCost + handworkCost;

    // Create or update costing
    const costing = await prisma.styleCosting.upsert({
      where: { styleId },
      create: {
        styleId,
        totalFabricCost,
        totalAccessoryCost,
        totalMaterialCost,
        printingCost,
        dyingCost,
        embroideryCost,
        handworkCost,
        totalProcessingCost,
        // Production costs can be set manually later
        cuttingCost: 0,
        stitchingCost: 0,
        finishingCost: 0,
        checkingCost: 0,
        packingCost: 0,
        totalProductionCost: 0,
        overheadCost: 0,
        profitMargin: 0,
        totalCostPerPiece: totalMaterialCost + totalProcessingCost,
        sellingPricePerPiece: 0,
      },
      update: {
        totalFabricCost,
        totalAccessoryCost,
        totalMaterialCost,
        printingCost,
        dyingCost,
        embroideryCost,
        handworkCost,
        totalProcessingCost,
        totalCostPerPiece: totalMaterialCost + totalProcessingCost,
      },
    });

    res.status(200).json({
      data: costing,
      message: 'Costing calculated successfully',
    });
  } catch (error) {
    console.error('Calculate costing error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to calculate costing',
    });
  }
};
