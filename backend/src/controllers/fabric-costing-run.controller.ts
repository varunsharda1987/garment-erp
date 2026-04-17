/**
 * Fabric Costing Run Controller
 * Handles API endpoints for managing costing runs (grouped CAD records)
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { serialize } from '../utils/serializer';
import { CadPurpose } from '@prisma/client';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';

/**
 * GET /api/fabric-costing-runs/style/:styleId
 * Get all costing runs for a style, optionally filtered by purpose
 */
export async function getRunsByStyle(req: Request, res: Response) {
  const { styleId } = req.params;
  const { purpose } = req.query;

  const runs = await prisma.fabric_costing_run.findMany({
    where: {
      styleId,
      ...(purpose && { purpose: purpose as CadPurpose }),
    },
    include: {
      fabricCads: {
        select: {
          id: true,
          componentName: true,
          cutableWidth: true,
          orderQuantityPcs: true,
          cadAverage: true,
          totalCostPerMeter: true,
          greigeId: true,
          greige: {
            select: {
              greigeCode: true,
              greigeName: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { runNumber: 'desc' },
  });

  // Transform to include per-garment costs
  const result = runs.map((run) => ({
    ...run,
    fabrics: run.fabricCads.map((cad) => ({
      ...cad,
      costPerGarment:
        cad.cadAverage && cad.totalCostPerMeter ? Number(cad.cadAverage) * Number(cad.totalCostPerMeter) : null,
    })),
  }));

  res.json(
    serialize({
      success: true,
      data: result,
    })
  );
}

/**
 * GET /api/fabric-costing-runs/:runId
 * Get a single costing run with all fabric details
 */
export async function getRunById(req: Request, res: Response) {
  const { runId } = req.params;

  const run = await prisma.fabric_costing_run.findUnique({
    where: { id: runId },
    include: {
      fabricCads: {
        select: {
          id: true,
          componentName: true,
          cutableWidth: true,
          orderQuantityPcs: true,
          cadAverage: true,
          totalCostPerMeter: true,
          greigeId: true,
          greigeCostPerMeter: true,
          processingPricePerMeter: true,
          shrinkageCostPerMeter: true,
          transportCostPerMeter: true,
          screenCostPerMeter: true,
          greige: {
            select: {
              greigeCode: true,
              greigeName: true,
            },
          },
          processor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      style: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          customerName: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!run) {
    throw new NotFoundError('Costing run', runId);
  }

  // Transform to include per-garment costs
  const result = {
    ...run,
    fabrics: run.fabricCads.map((cad) => ({
      ...cad,
      costPerGarment:
        cad.cadAverage && cad.totalCostPerMeter ? Number(cad.cadAverage) * Number(cad.totalCostPerMeter) : null,
    })),
  };

  res.json(
    serialize({
      success: true,
      data: result,
    })
  );
}

/**
 * POST /api/fabric-costing-runs/style/:styleId
 * Create a new costing run and link fabric CADs to it
 */
export async function createRun(req: Request, res: Response) {
  const { styleId } = req.params;
  const { purpose, fabricCadIds } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  if (!purpose) {
    throw new ValidationError('Purpose is required');
  }

  if (!fabricCadIds || !Array.isArray(fabricCadIds) || fabricCadIds.length === 0) {
    throw new ValidationError('At least one fabric CAD ID is required');
  }

  // Get next run number for this style+purpose
  const lastRun = await prisma.fabric_costing_run.findFirst({
    where: { styleId, purpose: purpose as CadPurpose },
    orderBy: { runNumber: 'desc' },
  });
  const runNumber = (lastRun?.runNumber ?? 0) + 1;

  // Create run and link fabrics in a transaction
  const run = await prisma.$transaction(async (tx) => {
    // Create the run
    const newRun = await tx.fabric_costing_run.create({
      data: {
        styleId,
        purpose: purpose as CadPurpose,
        runNumber,
        runName: `Run ${runNumber}`,
        createdById: userId,
        fabricCount: fabricCadIds.length,
      },
    });

    // Link fabric CADs to this run
    await tx.fabric_width_cad.updateMany({
      where: { id: { in: fabricCadIds } },
      data: { costingRunId: newRun.id },
    });

    // Calculate totals
    const cads = await tx.fabric_width_cad.findMany({
      where: { costingRunId: newRun.id },
    });

    const totalFabricCost = cads.reduce((sum, cad) => {
      const avg = cad.cadAverage ? Number(cad.cadAverage) : 0;
      const rate = cad.totalCostPerMeter ? Number(cad.totalCostPerMeter) : 0;
      return sum + avg * rate;
    }, 0);

    const isComplete = cads.every((c) => c.totalCostPerMeter !== null && c.cadAverage !== null);

    // Update run with calculated totals
    const updatedRun = await tx.fabric_costing_run.update({
      where: { id: newRun.id },
      data: { totalFabricCost, isComplete },
      include: {
        fabricCads: {
          select: {
            id: true,
            componentName: true,
            cutableWidth: true,
            orderQuantityPcs: true,
            cadAverage: true,
            totalCostPerMeter: true,
          },
        },
      },
    });

    return updatedRun;
  });

  // Transform response
  const result = {
    ...run,
    fabrics: run.fabricCads.map((cad) => ({
      ...cad,
      costPerGarment:
        cad.cadAverage && cad.totalCostPerMeter ? Number(cad.cadAverage) * Number(cad.totalCostPerMeter) : null,
    })),
  };

  res.status(201).json(
    serialize({
      success: true,
      data: result,
    })
  );
}

/**
 * DELETE /api/fabric-costing-runs/:runId
 * Delete a costing run (unlinks CADs, doesn't delete them)
 */
export async function deleteRun(req: Request, res: Response) {
  const { runId } = req.params;

  // Check if run exists
  const run = await prisma.fabric_costing_run.findUnique({
    where: { id: runId },
  });

  if (!run) {
    throw new NotFoundError('Costing run', runId);
  }

  // Unlink all fabric CADs and delete run in transaction
  await prisma.$transaction(async (tx) => {
    // Unlink all CADs from this run
    await tx.fabric_width_cad.updateMany({
      where: { costingRunId: runId },
      data: { costingRunId: null },
    });

    // Delete the run
    await tx.fabric_costing_run.delete({
      where: { id: runId },
    });
  });

  res.json({
    success: true,
    message: 'Costing run deleted successfully',
  });
}

/**
 * PATCH /api/fabric-costing-runs/:runId/recalculate
 * Recalculate totals for a costing run (after fabric changes)
 */
export async function updateRunTotals(req: Request, res: Response) {
  const { runId } = req.params;

  // Get run with its CADs
  const run = await prisma.fabric_costing_run.findUnique({
    where: { id: runId },
    include: {
      fabricCads: true,
    },
  });

  if (!run) {
    throw new NotFoundError('Costing run', runId);
  }

  // Recalculate totals
  const totalFabricCost = run.fabricCads.reduce((sum, cad) => {
    const avg = cad.cadAverage ? Number(cad.cadAverage) : 0;
    const rate = cad.totalCostPerMeter ? Number(cad.totalCostPerMeter) : 0;
    return sum + avg * rate;
  }, 0);

  const isComplete = run.fabricCads.every((c) => c.totalCostPerMeter !== null && c.cadAverage !== null);

  const fabricCount = run.fabricCads.length;

  // Update run
  const updatedRun = await prisma.fabric_costing_run.update({
    where: { id: runId },
    data: { totalFabricCost, isComplete, fabricCount },
    include: {
      fabricCads: {
        select: {
          id: true,
          componentName: true,
          cutableWidth: true,
          orderQuantityPcs: true,
          cadAverage: true,
          totalCostPerMeter: true,
        },
      },
    },
  });

  // Transform response
  const result = {
    ...updatedRun,
    fabrics: updatedRun.fabricCads.map((cad) => ({
      ...cad,
      costPerGarment:
        cad.cadAverage && cad.totalCostPerMeter ? Number(cad.cadAverage) * Number(cad.totalCostPerMeter) : null,
    })),
  };

  res.json(
    serialize({
      success: true,
      data: result,
    })
  );
}
