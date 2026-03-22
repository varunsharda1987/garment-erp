import { Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../errors';
import prisma from '../config/database';

// ============================================
// Issue to Stitching — Partial dispatch
// ============================================

// Issue cut pieces to stitching
export const issueToStitching = async (req: Request, res: Response) => {
  const { id } = req.params; // batch id
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { issuedToId, issueDate, remarks, skuOutputs } = req.body;

  if (!issuedToId || !skuOutputs || skuOutputs.length === 0) {
    throw new ValidationError('issuedToId and skuOutputs are required');
  }

  const batch = await prisma.cutting_batches.findUnique({
    where: { id },
    include: {
      workOrder: true,
      skuOutputs: true,
      transferSlips: {
        where: { isActive: true },
        include: { skuBreakdown: true },
      },
      additionalFabrics: {
        include: {
          fabricStock: {
            include: { fabricMaster: { select: { fabricName: true } } },
          },
          _count: { select: { lays: true } },
        },
      },
    },
  });

  if (!batch) {
    throw new NotFoundError('CuttingBatch', id);
  }

  // Validate all fabrics have at least one lay before issuing
  if (batch.additionalFabrics && batch.additionalFabrics.length > 0) {
    const uncutFabrics = batch.additionalFabrics.filter((af: any) => af._count.lays === 0);
    if (uncutFabrics.length > 0) {
      const names = uncutFabrics.map((af: any) => af.fabricStock?.fabricMaster?.fabricName || 'Unknown').join(', ');
      return res.status(400).json({
        error: `Cannot issue to stitching: ${names} has no lays recorded. All fabrics must be cut before issuing.`,
      });
    }
  }

  // Calculate already issued per SKU
  const issuedMap = new Map<string, number>();
  for (const slip of batch.transferSlips) {
    for (const sku of slip.skuBreakdown) {
      const key = `${sku.colorId}|${sku.sizeId}`;
      issuedMap.set(key, (issuedMap.get(key) || 0) + sku.quantity);
    }
  }

  // Validate quantities
  for (const output of skuOutputs) {
    const key = `${output.colorId}|${output.sizeId}`;
    const batchSku = batch.skuOutputs.find((s) => s.colorId === output.colorId && s.sizeId === output.sizeId);
    if (!batchSku) {
      return res.status(400).json({ error: `Invalid color/size combination` });
    }
    const alreadyIssued = issuedMap.get(key) || 0;
    const available = batchSku.goodPcs - alreadyIssued;
    if (output.quantity > available) {
      return res.status(400).json({
        error: `Cannot issue ${output.quantity} for size ${output.sizeId}. Only ${available} available.`,
      });
    }
  }

  // Generate slip number
  const today = new Date();
  const datePrefix = `TS-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
  const existingSlips = await prisma.transfer_slips.count({
    where: { slipNumber: { startsWith: datePrefix } },
  });
  const slipNumber = `${datePrefix}-${(existingSlips + 1).toString().padStart(4, '0')}`;

  const totalPieces = skuOutputs.reduce((sum: number, s: any) => sum + s.quantity, 0);

  const transferSlip = await prisma.transfer_slips.create({
    data: {
      slipNumber,
      transferDate: issueDate ? new Date(issueDate) : today,
      workOrderId: batch.workOrderId,
      fromStage: 'CUTTING',
      toStage: 'STITCHING',
      fromDepartment: 'Cutting',
      toDepartment: 'Stitching',
      totalGoodPieces: totalPieces,
      status: 'CREATED',
      cuttingBatchId: id,
      issuedToId,
      preparedById: userId,
      remarks,
      skuBreakdown: {
        create: skuOutputs.map((s: any) => ({
          colorId: s.colorId || null,
          sizeId: s.sizeId,
          quantity: s.quantity,
        })),
      },
    },
    include: {
      issuedTo: { select: { id: true, name: true } },
      skuBreakdown: {
        include: {
          color: { select: { id: true, colorName: true } },
          size: { select: { id: true, sizeName: true } },
        },
      },
    },
  });

  const issuedToContractor = transferSlip.issuedTo
    ? { id: transferSlip.issuedTo.id, name: transferSlip.issuedTo.name }
    : null;

  res.status(201).json({
    data: {
      id: transferSlip.id,
      slipNumber: transferSlip.slipNumber,
      issueDate: transferSlip.transferDate,
      issuedTo: issuedToContractor,
      totalPieces: transferSlip.totalGoodPieces,
      status: transferSlip.status,
      skuBreakdown: transferSlip.skuBreakdown,
    },
  });
};

// Get stitching issues summary for a batch
export const getStitchingIssues = async (req: Request, res: Response) => {
  const { id } = req.params; // batch id

  const batch = await prisma.cutting_batches.findUnique({
    where: { id },
    include: {
      skuOutputs: {
        include: {
          color: { select: { id: true, colorName: true } },
          size: { select: { id: true, sizeName: true, sortOrder: true } },
        },
      },
      transferSlips: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        include: {
          issuedTo: { select: { id: true, name: true } },
          preparedBy: { select: { id: true, firstName: true, lastName: true } },
          skuBreakdown: {
            include: {
              color: { select: { id: true, colorName: true } },
              size: { select: { id: true, sizeName: true } },
            },
          },
        },
      },
    },
  });

  if (!batch) {
    throw new NotFoundError('CuttingBatch', id);
  }

  // Calculate issued per SKU
  const issuedMap = new Map<string, number>();
  for (const slip of batch.transferSlips) {
    for (const sku of slip.skuBreakdown) {
      const key = `${sku.colorId}|${sku.sizeId}`;
      issuedMap.set(key, (issuedMap.get(key) || 0) + sku.quantity);
    }
  }

  // Build per-SKU summary
  const perSku = batch.skuOutputs
    .map((sku) => {
      const key = `${sku.colorId}|${sku.sizeId}`;
      const issuedQty = issuedMap.get(key) || 0;
      return {
        colorId: sku.colorId,
        sizeId: sku.sizeId,
        colorName: sku.color?.colorName || '',
        sizeName: sku.size?.sizeName || '',
        sortOrder: sku.size?.sortOrder || 0,
        goodPcs: sku.goodPcs,
        issuedQty,
        availableQty: sku.goodPcs - issuedQty,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Build issue history
  const issues = batch.transferSlips.map((slip: any) => ({
    id: slip.id,
    slipNumber: slip.slipNumber,
    issueDate: slip.transferDate,
    issuedTo: slip.issuedTo ? { id: slip.issuedTo.id, name: slip.issuedTo.name } : { id: '', name: 'Unknown' },
    preparedBy: slip.preparedBy
      ? { id: slip.preparedBy.id, name: `${slip.preparedBy.firstName} ${slip.preparedBy.lastName}` }
      : null,
    totalPieces: slip.totalGoodPieces,
    status: slip.status,
    remarks: slip.remarks,
    skuBreakdown: slip.skuBreakdown.map((s: any) => ({
      colorId: s.colorId,
      sizeId: s.sizeId,
      colorName: s.color?.colorName || '',
      sizeName: s.size?.sizeName || '',
      quantity: s.quantity,
    })),
  }));

  res.json({ data: { perSku, issues } });
};
