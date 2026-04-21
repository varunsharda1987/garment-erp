import { Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../errors';
import prisma from '../config/database';
import { recalculateBatchTotals } from './cutting.utils';

// ============================================
// Cutting Lays — Daily production input
// ============================================

// Add a cutting lay
export const addCuttingLay = async (req: Request, res: Response) => {
  const { id } = req.params; // batch id
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    layDate,
    layerLength, // fallback for single-fabric batches
    numberOfLayers,
    remarks,
    skuOutputs, // { colorId, sizeId, piecesPerLayer } OR legacy { pieces }
    fabricLengths, // [{ cuttingBatchFabricId, layerLength }] — per-fabric
    cuttingBatchFabricId, // legacy single-fabric field
  } = req.body;

  if (!layDate || !numberOfLayers || !skuOutputs || skuOutputs.length === 0) {
    throw new ValidationError('layDate, numberOfLayers, and skuOutputs are required');
  }

  const batch = await prisma.cutting_batches.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!batch) {
    throw new NotFoundError('CuttingBatch', id);
  }

  if (batch.status !== 'IN_PROGRESS') {
    throw new ValidationError('Can only add lays to in-progress batches');
  }

  // Get next lay number
  const maxLay = await prisma.cutting_lays.findFirst({
    where: { cuttingBatchId: id },
    orderBy: { layNumber: 'desc' },
    select: { layNumber: true },
  });
  const layNumber = (maxLay?.layNumber || 0) + 1;

  // pieces field = piecesPerLayer (same concept, kept as 'pieces' in DB)
  const layers = numberOfLayers || 1;
  const piecesPerLayerTotal = skuOutputs.reduce((sum: number, s: any) => sum + (s.piecesPerLayer || s.pieces || 0), 0);
  const totalPieces = piecesPerLayerTotal * layers;

  // Primary layer length for the lay record (first fabric or single value)
  const primaryLayerLength = fabricLengths?.[0]?.layerLength || layerLength || 0;

  // Create lay + per-fabric records + update totals in transaction
  const lay = await prisma.$transaction(async (tx) => {
    const newLay = await tx.cutting_lays.create({
      data: {
        cuttingBatchId: id,
        cuttingBatchFabricId: cuttingBatchFabricId || null,
        layDate: new Date(layDate),
        layNumber,
        layerLength: primaryLayerLength,
        numberOfLayers: layers,
        totalPieces,
        remarks,
        createdById: userId,
        skuOutputs: {
          create: skuOutputs.map((s: any) => ({
            colorId: s.colorId || null,
            sizeId: s.sizeId,
            pieces: s.piecesPerLayer || s.pieces, // store piecesPerLayer in pieces field
          })),
        },
      },
    });

    // Create per-fabric layer length records
    if (fabricLengths && fabricLengths.length > 0) {
      await tx.cutting_lay_fabrics.createMany({
        data: fabricLengths.map((fl: any) => ({
          cuttingLayId: newLay.id,
          cuttingBatchFabricId: fl.cuttingBatchFabricId,
          layerLength: fl.layerLength,
        })),
      });
    }

    // Recalculate batch totals
    await recalculateBatchTotals(tx, id);

    // Re-fetch with includes
    return tx.cutting_lays.findUnique({
      where: { id: newLay.id },
      include: {
        skuOutputs: {
          include: {
            color: { select: { id: true, colorName: true } },
            size: { select: { id: true, sizeName: true, sortOrder: true } },
          },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        layFabrics: {
          include: {
            batchFabric: {
              include: {
                fabricStock: {
                  include: { fabricMaster: { select: { id: true, fabricCode: true, fabricName: true } } },
                },
              },
            },
          },
        },
      },
    });
  });

  res.status(201).json({
    data: {
      ...lay,
      layerLength: Number(lay!.layerLength),
      createdBy: lay!.createdBy
        ? { id: lay!.createdBy.id, name: `${(lay!.createdBy as any).firstName} ${(lay!.createdBy as any).lastName}` }
        : null,
    },
    message: 'Cutting lay created successfully',
  });
};

// Get all lays for a batch
export const getCuttingLays = async (req: Request, res: Response) => {
  const { id } = req.params; // batch id

  const lays = await prisma.cutting_lays.findMany({
    where: { cuttingBatchId: id },
    orderBy: { layNumber: 'desc' },
    include: {
      skuOutputs: {
        include: {
          color: { select: { id: true, colorName: true } },
          size: { select: { id: true, sizeName: true, sortOrder: true } },
        },
      },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      batchFabric: {
        include: {
          fabricStock: {
            include: { fabricMaster: { select: { id: true, fabricCode: true, fabricName: true } } },
          },
        },
      },
      layFabrics: {
        include: {
          batchFabric: {
            include: {
              fabricStock: {
                include: { fabricMaster: { select: { id: true, fabricCode: true, fabricName: true } } },
              },
            },
          },
        },
      },
    },
  });

  res.json({
    data: lays.map((lay) => ({
      ...lay,
      layerLength: Number(lay.layerLength),
      createdBy: lay.createdBy
        ? { id: lay.createdBy.id, name: `${lay.createdBy.firstName} ${lay.createdBy.lastName}` }
        : null,
    })),
  });
};

// Delete a cutting lay (only latest)
export const deleteCuttingLay = async (req: Request, res: Response) => {
  const { id, layId } = req.params; // batch id, lay id

  const batch = await prisma.cutting_batches.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!batch) {
    throw new NotFoundError('CuttingBatch', id);
  }

  if (batch.status !== 'IN_PROGRESS') {
    throw new ValidationError('Can only delete lays from in-progress batches');
  }

  // Verify this is the latest lay
  const latestLay = await prisma.cutting_lays.findFirst({
    where: { cuttingBatchId: id },
    orderBy: { layNumber: 'desc' },
    select: { id: true },
  });

  if (!latestLay || latestLay.id !== layId) {
    throw new ValidationError('Can only delete the most recent lay');
  }

  await prisma.$transaction(async (tx) => {
    await tx.cutting_lays.delete({ where: { id: layId } });
    await recalculateBatchTotals(tx, id);
  });

  res.json({ message: 'Lay deleted successfully' });
};
