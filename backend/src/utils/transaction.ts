/**
 * Database Transaction Utilities
 *
 * Provides a clean wrapper for Prisma transactions to ensure
 * atomic operations and prevent partial writes.
 */
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logError, logDebug } from './logger';

/**
 * Transaction client type for use in transaction callbacks
 */
export type TransactionClient = Prisma.TransactionClient;

/**
 * Execute a function within a database transaction
 *
 * All database operations within the callback will be executed atomically.
 * If any operation fails, all changes are rolled back.
 *
 * @param fn - Function to execute within the transaction
 * @param options - Optional transaction settings
 * @returns Promise resolving to the function's return value
 *
 * @example
 * ```typescript
 * const result = await withTransaction(async (tx) => {
 *   const style = await tx.styles.create({ data: styleData });
 *   await tx.style_variants.createMany({ data: variants });
 *   return style;
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number; // Maximum time to wait for transaction lock (ms)
    timeout?: number; // Maximum time for transaction to complete (ms)
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await prisma.$transaction(fn, {
      maxWait: options?.maxWait ?? 5000, // 5 seconds default
      timeout: options?.timeout ?? 30000, // 30 seconds default
      isolationLevel: options?.isolationLevel,
    });

    logDebug(`Transaction completed in ${Date.now() - startTime}ms`);
    return result;
  } catch (error) {
    logError('Transaction failed:', error);
    throw error;
  }
}

/**
 * Execute multiple independent queries in a single transaction
 *
 * Use this when you have multiple operations that should all succeed or all fail,
 * but don't depend on each other's results.
 *
 * @param operations - Array of Prisma operations to execute
 * @returns Promise resolving to array of results
 *
 * @example
 * ```typescript
 * const [customers, styles] = await batchTransaction([
 *   prisma.customers.findMany(),
 *   prisma.styles.count(),
 * ]);
 * ```
 */
export async function batchTransaction<T extends Prisma.PrismaPromise<unknown>[]>(
  operations: [...T]
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const result = await prisma.$transaction(operations);
  return result as { [K in keyof T]: Awaited<T[K]> };
}

/**
 * Retry a transaction on serialization failures
 *
 * Some concurrent transactions may fail due to serialization conflicts.
 * This utility retries the transaction with exponential backoff.
 *
 * @param fn - Function to execute within the transaction
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise resolving to the function's return value
 */
export async function withRetryableTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(fn);
    } catch (error) {
      lastError = error as Error;

      // Check if it's a serialization failure (P2034)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        logDebug(`Transaction serialization failure, attempt ${attempt}/${maxRetries}`);

        if (attempt < maxRetries) {
          // Exponential backoff: 100ms, 200ms, 400ms, etc.
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError;
}

export default {
  withTransaction,
  batchTransaction,
  withRetryableTransaction,
};
