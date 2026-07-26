import { Prisma } from '@prisma/client';
import { generateAtomicPONumber, generateAtomicPONumberInTx } from './atomicCodeGenerator';

/**
 * Unified PO Number Generator
 *
 * Single source of truth for generating purchase order numbers.
 * Format: PO{YY}{MM}-{NNNN} (e.g., PO2602-0001)
 *
 * Thin wrappers over the atomic sequence generator (code_sequences UPSERT),
 * so every PO-number producer (purchaseOrder.service, costSheetPOGeneration,
 * unified-po-creation, dyeing/printing controllers, MRP) shares one
 * collision-free series. The old findFirst-max+1 bodies raced under
 * concurrency and minted duplicate PO numbers.
 */

/**
 * Generate the next sequential PO number
 * Format: PO{YY}{MM}-{NNNN}
 *
 * @returns Promise<string> - Generated PO number (e.g., PO2602-0001)
 */
export async function generateUnifiedPONumber(): Promise<string> {
  return generateAtomicPONumber();
}

/**
 * Generate PO number within an existing transaction
 * Use this when creating PO as part of a larger transaction
 *
 * @param tx - Prisma transaction client
 * @returns Promise<string> - Generated PO number
 */
export async function generateUnifiedPONumberInTransaction(tx: Prisma.TransactionClient): Promise<string> {
  return generateAtomicPONumberInTx(tx);
}

/**
 * Validate PO number format
 *
 * @param poNumber - PO number to validate
 * @returns boolean - True if valid format
 */
export function validatePONumberFormat(poNumber: string): boolean {
  // Format: PO{YYMM}-{NNNN}
  const pattern = /^PO\d{4}-\d{4}$/;
  return pattern.test(poNumber);
}

/**
 * Extract year/month and sequence from PO number
 *
 * @param poNumber - PO number to parse
 * @returns Object with yearMonth and sequence, or null if invalid
 */
export function parsePONumber(poNumber: string): {
  yearMonth: string;
  year: string;
  month: string;
  sequence: number;
} | null {
  if (!validatePONumberFormat(poNumber)) {
    return null;
  }

  const yearMonth = poNumber.slice(2, 6); // "2602"
  const year = yearMonth.slice(0, 2); // "26"
  const month = yearMonth.slice(2, 4); // "02"
  const sequence = parseInt(poNumber.slice(7), 10); // 1

  return { yearMonth, year, month, sequence };
}
