import { Request, Response } from 'express';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';
import { LAY_COVERAGE_SELECT, dedupeSkuRows, layCoverage, toLayBatchFabric } from './cutting.utils';
import { loadBatchSlipBalance } from '../services/helpers/cutting-slip.helper';
import { skuKey } from '../services/helpers/sku-colour.helper';

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
      additionalFabrics: {
        include: {
          fabricStock: {
            include: { fabricMaster: { select: { fabricName: true } } },
          },
        },
      },
    },
  });

  if (!batch) {
    throw new NotFoundError('CuttingBatch', id);
  }

  // Every fabric must have a lay before its pieces go to stitching — read through layCoverage. A lay saved for
  // a batch cut from one fabric carries no per-lot link, and counting only the legacy link refused every such
  // batch (CB-WO2609-0088-003, 2026-09-28).
  if (batch.additionalFabrics && batch.additionalFabrics.length > 0) {
    const lays = await prisma.cutting_lays.findMany({ where: { cuttingBatchId: id }, select: LAY_COVERAGE_SELECT });
    const { coveredBatchFabricIds } = layCoverage(batch.additionalFabrics.map(toLayBatchFabric), lays);
    const uncutFabrics = batch.additionalFabrics.filter((af) => !coveredBatchFabricIds.has(af.id));
    if (uncutFabrics.length > 0) {
      const names = [...new Set(uncutFabrics.map((af) => af.fabricStock?.fabricMaster?.fabricName || 'Unknown'))].join(
        ', '
      );
      throw new BusinessError(
        `Cannot issue to stitching: ${names} has no lays recorded. All fabrics must be cut before issuing.`
      );
    }
  }

  if (batch.status !== 'IN_PROGRESS' && batch.status !== 'COMPLETED') {
    throw new ValidationError('Pieces go to stitching from a batch that is in progress or completed');
  }

  // One row per colour + size; a blank colour is one value (sku-colour.helper) — the rows used to be
  // matched with ===, so a blank colour sent as undefined read as "Invalid color/size combination"
  const rows = dedupeSkuRows(
    (skuOutputs as Array<{ colorId?: string | null; sizeId: string; quantity: number }>).map((s) => ({
      colorId: s.colorId ?? null,
      sizeId: s.sizeId,
      quantity: Number(s.quantity) || 0,
    })),
    ['quantity']
  ).filter((r) => r.quantity > 0);
  if (rows.length === 0) {
    throw new ValidationError('Enter a quantity for at least one size');
  }

  const today = new Date();
  const totalPieces = rows.reduce((sum, r) => sum + r.quantity, 0);

  // Check what the batch has left and create the slip under one batch lock (cutting-slip.helper): a
  // batch may go to stitching on several slips, never more than its good pieces. slipNumber is UNIQUE —
  // if a pre-atomic row in today's scope still collides with the freshly seeded sequence, retry.
  const createSlip = (slipNumber: string) =>
    prisma.$transaction(async (tx) => {
      const loaded = await loadBatchSlipBalance(tx, id, { lock: true });
      const left = new Map((loaded?.balances ?? []).map((b) => [skuKey(b.colorId, b.sizeId), b]));
      const problems: Array<{ sizeId: string; asked: number; available: number | null }> = [];
      for (const row of rows) {
        const balance = left.get(skuKey(row.colorId, row.sizeId));
        if (!balance) problems.push({ sizeId: row.sizeId, asked: row.quantity, available: null });
        else if (row.quantity > balance.left) {
          problems.push({ sizeId: row.sizeId, asked: row.quantity, available: balance.left });
        }
      }
      if (problems.length > 0) {
        const sizes = await tx.size_options.findMany({
          where: { id: { in: problems.map((p) => p.sizeId) } },
          select: { id: true, sizeName: true },
        });
        const sizeName = new Map(sizes.map((z) => [z.id, z.sizeName]));
        throw new ValidationError(
          `Cannot issue to stitching — ${problems
            .map((p) =>
              p.available === null
                ? `${sizeName.get(p.sizeId) ?? p.sizeId} was not cut in this batch`
                : `${sizeName.get(p.sizeId) ?? p.sizeId}: ${p.asked} asked, only ${p.available} left`
            )
            .join('; ')}`
        );
      }

      return tx.transfer_slips.create({
        data: {
          slipNumber,
          transferDate: issueDate ? new Date(issueDate) : today,
          workOrderId: batch.workOrderId,
          componentId: batch.componentId,
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
            create: rows.map((r) => ({ colorId: r.colorId, sizeId: r.sizeId, quantity: r.quantity })),
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
    });

  let transferSlip: Awaited<ReturnType<typeof createSlip>> | undefined;
  for (let attempt = 1; !transferSlip; attempt++) {
    try {
      transferSlip = await createSlip(await generateTransferSlipNumber(today));
    } catch (err) {
      if (isUniqueViolationOn(err, 'slipNumber') && attempt < 3) continue;
      throw err;
    }
  }

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

  // Calculate issued per SKU (only slips to stitching; a blank colour is one value)
  const issuedMap = new Map<string, number>();
  for (const slip of batch.transferSlips) {
    if (slip.toStage !== 'STITCHING') continue;
    for (const sku of slip.skuBreakdown) {
      const key = skuKey(sku.colorId, sku.sizeId);
      issuedMap.set(key, (issuedMap.get(key) || 0) + sku.quantity);
    }
  }

  // Build per-SKU summary
  const perSku = batch.skuOutputs
    .map((sku) => {
      const key = skuKey(sku.colorId, sku.sizeId);
      const issuedQty = issuedMap.get(key) || 0;
      return {
        colorId: sku.colorId,
        sizeId: sku.sizeId,
        colorName: sku.color?.colorName || '',
        sizeName: sku.size?.sizeName || '',
        sortOrder: sku.size?.sortOrder || 0,
        goodPcs: sku.goodPcs,
        issuedQty,
        availableQty: Math.max(0, sku.goodPcs - issuedQty),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Build issue history
  const issues = batch.transferSlips.map((slip: any) => ({
    id: slip.id,
    slipNumber: slip.slipNumber,
    issueDate: slip.transferDate,
    // Generate Transfer Slip sends the batch without naming a contractor (stitching picks one)
    issuedTo: slip.issuedTo ? { id: slip.issuedTo.id, name: slip.issuedTo.name } : { id: '', name: 'Not assigned' },
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
