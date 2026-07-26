import { Request, Response } from 'express';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';

// ============================================
// Atomic slip numbering (TS-YYYYMMDD-NNNN preserved)
// ============================================

/** Highest numeric suffix among codes shaped `${prefix}-<digits>` (the dash keeps the scope exact). */
const maxNumericSuffix = (codes: Array<string | null>, prefix: string): number => {
  let max = 0;
  for (const code of codes) {
    if (!code || !code.startsWith(`${prefix}-`)) continue;
    const suffix = code.slice(prefix.length + 1);
    if (/^\d+$/.test(suffix)) max = Math.max(max, parseInt(suffix, 10));
  }
  return max;
};

/**
 * Lazily seed the atomic sequence for a per-scope compound prefix (e.g. `TS-20260726`).
 * Static seeding (scripts/seed-code-sequences.ts) is impossible for prefixes that embed a date
 * scope, so before first use in a scope: if code_sequences has no row for the prefix but rows
 * already exist in the target table, initialize the sequence with their max numeric suffix
 * (idempotent GREATEST upsert, mirroring the seed script).
 */
const seedScopedSequenceIfMissing = async (prefix: string, findMaxSuffix: () => Promise<number>): Promise<void> => {
  const existing = await prisma.$queryRaw<Array<{ found: number }>>(
    Prisma.sql`SELECT 1 AS found FROM code_sequences WHERE prefix = ${prefix} LIMIT 1`
  );
  if (existing.length > 0) return;
  const max = await findMaxSuffix();
  if (max <= 0) return;
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO code_sequences (id, prefix, "lastValue", "updatedAt")
      VALUES (gen_random_uuid(), ${prefix}, ${max}, NOW())
      ON CONFLICT (prefix) DO UPDATE SET
        "lastValue" = GREATEST(code_sequences."lastValue", ${max}),
        "updatedAt" = NOW()
    `
  );
};

/** True when err is a Prisma P2002 unique violation whose target involves the given column. */
const isUniqueViolationOn = (err: unknown, column: string): boolean => {
  const e = err as { code?: string; meta?: { target?: unknown } } | null;
  if (!e || e.code !== 'P2002') return false;
  const target = e.meta?.target;
  const text = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return text.includes(column);
};

/**
 * Next transfer-slip number from the atomic per-day sequence; visible format preserved:
 * TS-YYYYMMDD-NNNN. finishing.controller.ts writes the same transfer_slips.slipNumber series
 * and MUST use this same `TS-<date>` sequence key so the series can't collide.
 */
const generateTransferSlipNumber = async (date: Date): Promise<string> => {
  const prefix = `TS-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  await seedScopedSequenceIfMissing(prefix, async () => {
    const rows = await prisma.transfer_slips.findMany({
      where: { slipNumber: { startsWith: `${prefix}-` } },
      select: { slipNumber: true },
    });
    return maxNumericSuffix(
      rows.map((r) => r.slipNumber),
      prefix
    );
  });
  return generateAtomicMasterCode(prefix, 4);
};

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
      throw new BusinessError(
        `Cannot issue to stitching: ${names} has no lays recorded. All fabrics must be cut before issuing.`
      );
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
      throw new ValidationError('Invalid color/size combination');
    }
    const alreadyIssued = issuedMap.get(key) || 0;
    const available = batchSku.goodPcs - alreadyIssued;
    if (output.quantity > available) {
      throw new ValidationError(
        `Cannot issue ${output.quantity} for size ${output.sizeId}. Only ${available} available.`
      );
    }
  }

  const today = new Date();
  const totalPieces = skuOutputs.reduce((sum: number, s: any) => sum + s.quantity, 0);

  // slipNumber is UNIQUE — if a pre-atomic row in today's scope still collides with the freshly
  // seeded sequence, retry with the next atomic number.
  const createSlipWithFreshNumber = async () => {
    for (let attempt = 1; ; attempt++) {
      const slipNumber = await generateTransferSlipNumber(today);
      try {
        return await prisma.transfer_slips.create({
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
      } catch (err) {
        if (isUniqueViolationOn(err, 'slipNumber') && attempt < 3) continue;
        throw err;
      }
    }
  };
  const transferSlip = await createSlipWithFreshNumber();

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
    message: 'Cutting issue created successfully',
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
