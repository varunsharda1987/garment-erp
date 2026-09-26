/**
 * Fabric Costing Run Controller
 * Handles API endpoints for managing costing runs (grouped CAD records)
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { serialize } from '../utils/serializer';
import { CadPurpose, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';
import { freezeRunItems, presentRunItem, RUN_ITEM_LIVE_INCLUDE } from '../services/helpers/costing-run-items.helper';

/**
 * A run's fabrics are its OWN frozen record (fabric_costing_run_items, 2026-09-26), not the CAD rows
 * that point at it: a row saved into a later run moves its costingRunId there, and a re-costed row
 * no longer says what the run was saved with. Totals, counts and the fabric list all come from items.
 */
const RUN_ITEMS_INCLUDE = {
  items: { include: RUN_ITEM_LIVE_INCLUDE, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.fabric_costing_runInclude;

type RunWithItems = Prisma.fabric_costing_runGetPayload<{ include: typeof RUN_ITEMS_INCLUDE }>;

/** A run as the API returns it: its frozen fabrics beside today's costing, totals from the frozen figures. */
function presentRun<T extends RunWithItems>(run: T) {
  const { items, ...rest } = run;
  const fabrics = items.map((item) => presentRunItem(item, run.id));
  return {
    ...rest,
    ...computeRunTotals(items),
    fabrics,
    /** Fabrics re-costed (or whose costing was removed) since this run was saved */
    changedCount: fabrics.filter((f) => f.change !== null).length,
    /** The run was saved before runs kept their own record; its lines were recorded later */
    backfilled: items.some((i) => i.backfilled),
  };
}

/**
 * costing-18: derive run totals at read time from the loaded fabricCads. The stored
 * totalFabricCost/isComplete/fabricCount columns are only refreshed by the optional
 * recalculate endpoint, so edits made via fabric-costing save would otherwise show stale totals.
 */
export function computeRunTotals(fabricCads: Array<{ cadAverage: unknown; totalCostPerMeter: unknown }>) {
  const totalFabricCost = fabricCads.reduce((sum, cad) => {
    const avg = cad.cadAverage ? Number(cad.cadAverage) : 0;
    const rate = cad.totalCostPerMeter ? Number(cad.totalCostPerMeter) : 0;
    return sum + avg * rate;
  }, 0);
  // A run with no linked CAD rows is NOT complete — every() on an empty array is true,
  // which made emptied runs display as "Complete" with 0 fabrics.
  const isComplete =
    fabricCads.length > 0 && fabricCads.every((c) => c.totalCostPerMeter !== null && c.cadAverage !== null);
  return { totalFabricCost, isComplete, fabricCount: fabricCads.length };
}

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
      ...RUN_ITEMS_INCLUDE,
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

  const result = runs.map(presentRun);

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
      ...RUN_ITEMS_INCLUDE,
      style: {
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
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

  const result = presentRun(run);

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

    // Point the rows at their latest run
    await tx.fabric_width_cad.updateMany({
      where: { id: { in: fabricCadIds } },
      data: { costingRunId: newRun.id },
    });

    // The run's own record: freeze each fabric's costing as it is now
    const frozen = await freezeRunItems(tx, newRun.id, fabricCadIds);
    if (frozen === 0) {
      throw new ValidationError(
        'None of the fabric rows sent exist any more. Save the costing again, then create the run.'
      );
    }

    const items = await tx.fabric_costing_run_items.findMany({ where: { runId: newRun.id } });
    const { totalFabricCost, isComplete, fabricCount } = computeRunTotals(items);

    return tx.fabric_costing_run.update({
      where: { id: newRun.id },
      data: { totalFabricCost, isComplete, fabricCount },
      include: RUN_ITEMS_INCLUDE,
    });
  });

  const result = presentRun(run);

  res.status(201).json(
    serialize({
      success: true,
      data: result,
      message: 'Fabric costing run created successfully',
    })
  );
}

/**
 * DELETE /api/fabric-costing-runs/:runId
 * Delete a costing run (unlinks CADs, doesn't delete them; its frozen items cascade)
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

  // Totals come from the run's frozen record — a run's figures do not follow later re-costing
  const run = await prisma.fabric_costing_run.findUnique({
    where: { id: runId },
    include: { items: true },
  });

  if (!run) {
    throw new NotFoundError('Costing run', runId);
  }

  const { totalFabricCost, isComplete, fabricCount } = computeRunTotals(run.items);

  const updatedRun = await prisma.fabric_costing_run.update({
    where: { id: runId },
    data: { totalFabricCost, isComplete, fabricCount },
    include: RUN_ITEMS_INCLUDE,
  });

  const result = presentRun(updatedRun);

  res.json(
    serialize({
      success: true,
      data: result,
    })
  );
}
