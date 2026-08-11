import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { generateAtomicMasterCode } from './atomicCodeGenerator';

// ============================================
// Atomic scoped numbering helpers
// Shared by dyeing/printing controllers (job work + lab dip numbers) and the
// MRP → JWO bridge in mrp.service. Extracted from the duplicated copies in
// dyeing.controller.ts / printing.controller.ts.
// ============================================

/** Highest numeric suffix among codes shaped `${prefix}-<digits>` (the dash keeps the scope exact). */
export const maxNumericSuffix = (codes: Array<string | null>, prefix: string): number => {
  let max = 0;
  for (const code of codes) {
    if (!code || !code.startsWith(`${prefix}-`)) continue;
    const suffix = code.slice(prefix.length + 1);
    if (/^\d+$/.test(suffix)) max = Math.max(max, parseInt(suffix, 10));
  }
  return max;
};

/**
 * Lazily seed the atomic sequence for a per-scope compound prefix (e.g. `LDD-{styleCode}`).
 * Static seeding (scripts/seed-code-sequences.ts) is impossible for prefixes that embed a style
 * scope, so before first use in a scope: if code_sequences has no row for the prefix but rows
 * already exist in the target table, initialize the sequence with their max numeric suffix
 * (idempotent GREATEST upsert, mirroring the seed script).
 */
export const seedScopedSequenceIfMissing = async (
  prefix: string,
  findMaxSuffix: () => Promise<number>
): Promise<void> => {
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

/**
 * Per-process job number prefixes. DYEING/PRINTING keep their historical DJ/PJ codes
 * (existing sequences must not fork); every other process type gets its own prefix so
 * numbers are recognizable at a glance. Unknown/future types fall back to JW.
 */
const PROCESS_PREFIX: Record<string, string> = {
  DYEING: 'DJ',
  PRINTING: 'PJ',
  EMBROIDERY: 'EJ',
  WASHING: 'WJ',
  FINISHING: 'FJ',
  CUTTING: 'CJ',
  STITCHING: 'TJ',
  HANDWORK: 'HJ',
  SMOCKING: 'MJ',
  KAAJ_BUTTON: 'KJ',
  TRANSPORTATION: 'RJ',
};

/**
 * Generate a job work number — atomic per-style sequence; visible format preserved:
 * {prefix}-{styleCode}-NNN (DJ dyeing, PJ printing, KJ kaaj-button, ... JW fallback).
 * All writers of job_work_orders.jobWorkNumber MUST use this identical
 * `${processPrefix}-${styleCode}` key scheme.
 */
export const generateJobWorkNumber = async (processType: string, styleCode: string): Promise<string> => {
  const prefix = `${PROCESS_PREFIX[processType] || 'JW'}-${styleCode}`;
  await seedScopedSequenceIfMissing(prefix, async () => {
    const rows = await prisma.job_work_orders.findMany({
      where: { jobWorkNumber: { startsWith: `${prefix}-` } },
      select: { jobWorkNumber: true },
    });
    return maxNumericSuffix(
      rows.map((r) => r.jobWorkNumber),
      prefix
    );
  });
  return generateAtomicMasterCode(prefix, 3);
};
