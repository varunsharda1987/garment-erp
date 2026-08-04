import prisma from '../config/database';
import { Prisma } from '@prisma/client';

/**
 * Seeded Sequence (race-safe)
 *
 * Like atomicCodeGenerator's nextSequence, but for prefixes whose first
 * value must be seeded from existing data (e.g. legacy codes already in a
 * table) instead of starting at 1.
 *
 * Uses PostgreSQL's INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING,
 * which is inherently atomic — no race conditions possible. Two concurrent
 * first-users of a prefix are guaranteed distinct values: the loser's
 * ON CONFLICT branch takes GREATEST(current + 1, seed + 1).
 */

/**
 * Get the next sequence number for a prefix, seeding from existing data on
 * first use.
 *
 * @param prefix - The sequence key (e.g. "FAB-ST-001", "FAB-STK")
 * @param seedFn - Returns the current numeric max from existing data; only
 *                 called when no code_sequences row exists for the prefix
 * @param tx     - Optional transaction client so the bump commits/rolls back
 *                 with the caller's transaction
 */
export async function nextSeededSequence(
  prefix: string,
  seedFn: () => Promise<number>,
  tx?: Prisma.TransactionClient
): Promise<number> {
  const client = tx ?? prisma;

  const existing = await client.$queryRaw<Array<{ lastValue: number }>>(
    Prisma.sql`SELECT "lastValue" FROM code_sequences WHERE prefix = ${prefix}`
  );

  if (existing.length > 0) {
    // Row exists: same atomic increment upsert as atomicCodeGenerator's nextSequence.
    const result = await client.$queryRaw<Array<{ lastValue: number }>>(
      Prisma.sql`
        INSERT INTO code_sequences (id, prefix, "lastValue", "updatedAt")
        VALUES (gen_random_uuid(), ${prefix}, 1, NOW())
        ON CONFLICT (prefix) DO UPDATE SET
          "lastValue" = code_sequences."lastValue" + 1,
          "updatedAt" = NOW()
        RETURNING "lastValue"
      `
    );
    return result[0].lastValue;
  }

  // First use for this prefix: seed from existing data, then claim atomically.
  // If two callers race past the SELECT above, the INSERT winner gets seed + 1
  // and the loser's ON CONFLICT gets GREATEST(seed + 1 + 1, seed + 1) — distinct.
  const seed = await seedFn();
  const result = await client.$queryRaw<Array<{ lastValue: number }>>(
    Prisma.sql`
      INSERT INTO code_sequences (id, prefix, "lastValue", "updatedAt")
      VALUES (gen_random_uuid(), ${prefix}, ${seed + 1}, NOW())
      ON CONFLICT (prefix) DO UPDATE SET
        "lastValue" = GREATEST(code_sequences."lastValue" + 1, EXCLUDED."lastValue"),
        "updatedAt" = NOW()
      RETURNING "lastValue"
    `
  );
  return result[0].lastValue;
}

/**
 * Preview the next value nextSeededSequence would return for a prefix,
 * WITHOUT writing anything (no row is created or incremented).
 *
 * Returns max(currentLastValue, seed) + 1. Concurrent writers may still
 * claim the previewed value first — use only for display purposes.
 */
export async function peekSeededSequence(prefix: string, seedFn: () => Promise<number>): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ lastValue: number }>>(
    Prisma.sql`SELECT "lastValue" FROM code_sequences WHERE prefix = ${prefix}`
  );
  const currentLastValue = rows.length > 0 ? Number(rows[0].lastValue) : 0;
  const seed = await seedFn();
  return Math.max(currentLastValue, seed) + 1;
}
