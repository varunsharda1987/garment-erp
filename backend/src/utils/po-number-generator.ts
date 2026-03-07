import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Unified PO Number Generator
 *
 * Single source of truth for generating purchase order numbers.
 * Format: PO{YY}{MM}-{NNNN} (e.g., PO2602-0001)
 *
 * This consolidates the 3 different implementations that existed:
 * 1. purchaseOrder.service.ts - generatePONumber() method
 * 2. costSheetPOGeneration.service.ts - generatePONumber() function
 * 3. generateCode('PO', ...) utility
 *
 * Uses database transaction to prevent race conditions and ensure
 * unique sequential numbers within each month.
 */

/**
 * Generate the next sequential PO number
 * Format: PO{YY}{MM}-{NNNN}
 *
 * @returns Promise<string> - Generated PO number (e.g., PO2602-0001)
 *
 * @example
 * const poNumber = await generateUnifiedPONumber();
 * // Returns: "PO2602-0023" (for Feb 2026, sequence 23)
 */
export async function generateUnifiedPONumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits (e.g., "26")
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 2-digit month (e.g., "02")
  const prefix = `PO${year}${month}`; // e.g., "PO2602"

  // Use transaction to ensure atomicity and prevent race conditions
  return await prisma.$transaction(async (tx) => {
    // Find the last PO number with the current month prefix
    const lastPO = await tx.purchase_orders.findFirst({
      where: {
        poNumber: { startsWith: prefix },
      },
      orderBy: { poNumber: 'desc' },
      select: { poNumber: true },
    });

    let sequence = 1;

    if (lastPO?.poNumber) {
      // Extract sequence number from format PO{YYMM}-{NNNN}
      const parts = lastPO.poNumber.split('-');
      if (parts.length === 2) {
        const lastSequence = parseInt(parts[1], 10);
        if (!isNaN(lastSequence)) {
          sequence = lastSequence + 1;
        }
      }
    }

    // Format: PO2602-0001
    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  });
}

/**
 * Generate PO number within an existing transaction
 * Use this when creating PO as part of a larger transaction
 *
 * @param tx - Prisma transaction client
 * @returns Promise<string> - Generated PO number
 */
export async function generateUnifiedPONumberInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `PO${year}${month}`;

  // Find the last PO number with the current month prefix
  const lastPO = await tx.purchase_orders.findFirst({
    where: {
      poNumber: { startsWith: prefix },
    },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });

  let sequence = 1;

  if (lastPO?.poNumber) {
    const parts = lastPO.poNumber.split('-');
    if (parts.length === 2) {
      const lastSequence = parseInt(parts[1], 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
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

/**
 * Generate a batch of PO numbers for bulk operations
 * Useful when creating multiple POs in one transaction
 *
 * @param count - Number of PO numbers to generate
 * @returns Promise<string[]> - Array of sequential PO numbers
 */
export async function generateBatchPONumbers(count: number): Promise<string[]> {
  if (count <= 0) return [];

  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `PO${year}${month}`;

  return await prisma.$transaction(async (tx) => {
    const lastPO = await tx.purchase_orders.findFirst({
      where: {
        poNumber: { startsWith: prefix },
      },
      orderBy: { poNumber: 'desc' },
      select: { poNumber: true },
    });

    let startSequence = 1;

    if (lastPO?.poNumber) {
      const parts = lastPO.poNumber.split('-');
      if (parts.length === 2) {
        const lastSequence = parseInt(parts[1], 10);
        if (!isNaN(lastSequence)) {
          startSequence = lastSequence + 1;
        }
      }
    }

    const poNumbers: string[] = [];
    for (let i = 0; i < count; i++) {
      poNumbers.push(`${prefix}-${(startSequence + i).toString().padStart(4, '0')}`);
    }

    return poNumbers;
  });
}

/**
 * Generate batch PO numbers within an existing transaction
 *
 * @param tx - Prisma transaction client
 * @param count - Number of PO numbers to generate
 * @returns Promise<string[]> - Array of sequential PO numbers
 */
export async function generateBatchPONumbersInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  count: number
): Promise<string[]> {
  if (count <= 0) return [];

  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `PO${year}${month}`;

  const lastPO = await tx.purchase_orders.findFirst({
    where: {
      poNumber: { startsWith: prefix },
    },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });

  let startSequence = 1;

  if (lastPO?.poNumber) {
    const parts = lastPO.poNumber.split('-');
    if (parts.length === 2) {
      const lastSequence = parseInt(parts[1], 10);
      if (!isNaN(lastSequence)) {
        startSequence = lastSequence + 1;
      }
    }
  }

  const poNumbers: string[] = [];
  for (let i = 0; i < count; i++) {
    poNumbers.push(`${prefix}-${(startSequence + i).toString().padStart(4, '0')}`);
  }

  return poNumbers;
}
