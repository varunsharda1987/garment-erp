import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { nextSeededSequence, peekSeededSequence } from './seeded-sequence';

/**
 * Style-Linked Fabric Code Generator
 *
 * Fabric codes are namespaced per style:
 *   - Style-linked: FAB-<styleCode>-NNN  (3-digit padding)
 *   - Stock (no style): FAB-STK-NNNN     (4-digit padding)
 *
 * The sequence for each prefix is race-safe (code_sequences upsert) and
 * self-seeding: on first use of a prefix, the current numeric max of
 * existing fabric_master codes under that prefix seeds the counter, so
 * legacy codes are never collided with.
 */

function resolvePrefix(styleCode?: string | null): { prefixKey: string; padding: number } {
  return styleCode ? { prefixKey: `FAB-${styleCode}`, padding: 3 } : { prefixKey: 'FAB-STK', padding: 4 };
}

/**
 * Numeric max of the trailing "-NNN" suffix among existing fabric_master
 * codes under the prefix (0 when none). [0-9] is used instead of \d to stay
 * immune to JS template-literal escape handling.
 */
function makeSeedFn(prefixKey: string, tx?: Prisma.TransactionClient): () => Promise<number> {
  const client = tx ?? prisma;
  return async () => {
    const rows = await client.$queryRaw<Array<{ max: number | null }>>(
      Prisma.sql`
        SELECT COALESCE(MAX((regexp_match("fabricCode", '-([0-9]+)$'))[1]::int), 0) AS max
        FROM fabric_master
        WHERE "fabricCode" LIKE ${prefixKey + '-%'}
      `
    );
    return Number(rows[0]?.max ?? 0);
  };
}

/**
 * Generate the next fabric code for a style (or the stock pool when no
 * styleCode is given). Race-safe; pass `tx` when already in a transaction.
 */
export async function generateStyleLinkedFabricCode(
  styleCode?: string | null,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const { prefixKey, padding } = resolvePrefix(styleCode);
  const n = await nextSeededSequence(prefixKey, makeSeedFn(prefixKey, tx), tx);
  return `${prefixKey}-${String(n).padStart(padding, '0')}`;
}

/**
 * Preview the next fabric code WITHOUT consuming it (display only —
 * a concurrent writer may still claim it first).
 */
export async function peekNextStyleLinkedFabricCode(styleCode?: string | null): Promise<string> {
  const { prefixKey, padding } = resolvePrefix(styleCode);
  const n = await peekSeededSequence(prefixKey, makeSeedFn(prefixKey));
  return `${prefixKey}-${String(n).padStart(padding, '0')}`;
}
