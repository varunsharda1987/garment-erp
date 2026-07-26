import prisma from '../config/database';
import { Prisma } from '@prisma/client';

/**
 * Atomic Code Generator
 *
 * Uses PostgreSQL's INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING
 * which is inherently atomic — no race conditions possible.
 *
 * The `code_sequences` table stores the last-used sequence number
 * for each prefix. The UPSERT atomically creates or increments it.
 *
 * Replaces all individual `generateXxxNumber()` methods that used
 * the race-prone `findFirst → parse → increment` pattern.
 */

/**
 * Get the next sequence number for a given prefix, atomically.
 *
 * @param prefix - The code prefix (e.g., "PO2603", "ORD202603", "GRN2603")
 * @returns The next sequence number (1, 2, 3, ...)
 */
async function nextSequence(prefix: string): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ lastValue: number }>>(
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

/**
 * Same as nextSequence but works within an existing Prisma transaction.
 */
async function nextSequenceInTx(tx: Prisma.TransactionClient, prefix: string): Promise<number> {
  const result = await tx.$queryRaw<Array<{ lastValue: number }>>(
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

// ============================================
// Document Number Generators
// ============================================

/** PO number: PO2603-0001 */
export async function generateAtomicPONumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `PO${year}${month}`;
  const seq = await nextSequence(prefix);
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

/** PO number within a transaction */
export async function generateAtomicPONumberInTx(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `PO${year}${month}`;
  const seq = await nextSequenceInTx(tx, prefix);
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

/** Batch PO numbers within a transaction */
export async function generateAtomicBatchPONumbersInTx(tx: Prisma.TransactionClient, count: number): Promise<string[]> {
  if (count <= 0) return [];
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `PO${year}${month}`;

  const numbers: string[] = [];
  for (let i = 0; i < count; i++) {
    const seq = await nextSequenceInTx(tx, prefix);
    numbers.push(`${prefix}-${seq.toString().padStart(4, '0')}`);
  }
  return numbers;
}

/** Order number: ORD2026030001 */
export async function generateAtomicOrderNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `ORD${year}${month}`;
  const seq = await nextSequence(prefix);
  return `${prefix}${seq.toString().padStart(4, '0')}`;
}

/** GRN number: GRN2603-0001 */
export async function generateAtomicGRNNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `GRN${year}${month}`;
  const seq = await nextSequence(prefix);
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

/** Invoice number: INV2603-0001 */
export async function generateAtomicInvoiceNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `INV${year}${month}`;
  const seq = await nextSequence(prefix);
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

/** Credit note number: CN2603-0001 */
export async function generateAtomicCreditNoteNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `CN${year}${month}`;
  const seq = await nextSequence(prefix);
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

/** Debit note number: DN2603-0001 */
export async function generateAtomicDebitNoteNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `DN${year}${month}`;
  const seq = await nextSequence(prefix);
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

// NOTE: no challan wrapper here on purpose — challans use generateAtomicDocNumber('CH', tx)
// in challan.service.ts (the live series is CH{yy}{mm}-NNNN). A CHN wrapper previously existed
// but was never the live series and would have forked challan numbering if ever called.

/** Quotation number: QT2603-0001 */
export async function generateAtomicQuotationNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `QT${year}${month}`;
  const seq = await nextSequence(prefix);
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

/**
 * Generic monthly document number: `${docPrefix}${yy}${mm}-NNNN` (e.g. SO2607-0001).
 * The unified format for ALL document types (user-approved 2026-07-23). Pass `tx` when the
 * caller is already inside a transaction so the sequence bump commits/rolls back with it.
 * Sequence keys are per prefix+month, so every caller using the same docPrefix (e.g. two
 * services writing the same table) automatically shares one collision-free series.
 */
export async function generateAtomicDocNumber(docPrefix: string, tx?: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `${docPrefix}${year}${month}`;
  const seq = tx ? await nextSequenceInTx(tx, prefix) : await nextSequence(prefix);
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

/**
 * Generic code generator for master data (e.g., AGY-001, BTN-001)
 * Uses static prefixes (not date-based). The visible format (`PREFIX-NNN`) is preserved —
 * these are entity codes users already reference — so the sequence MUST be seeded from the
 * current max before first use (see scripts/seed-code-sequences.ts).
 */
export async function generateAtomicMasterCode(
  prefix: string,
  padding: number = 3,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const seq = tx ? await nextSequenceInTx(tx, prefix) : await nextSequence(prefix);
  return `${prefix}-${seq.toString().padStart(padding, '0')}`;
}

/**
 * Seed initial sequence values from existing data.
 * Call this once during migration to sync the code_sequences table
 * with existing document numbers in the database.
 */
export async function seedSequencesFromExistingData(): Promise<void> {
  const documentTypes = [
    { table: 'purchase_orders', field: 'poNumber', prefixPattern: /^PO(\d{4})-(\d{4})$/ },
    { table: 'orders', field: 'orderNumber', prefixPattern: /^ORD(\d{6})(\d{4})$/ },
    { table: 'goods_receiving_notes', field: 'grnNumber', prefixPattern: /^GRN(\d{4})-(\d{4})$/ },
    { table: 'invoices', field: 'invoiceNumber', prefixPattern: /^INV(\d{4})-(\d{4})$/ },
    { table: 'credit_notes', field: 'creditNoteNumber', prefixPattern: /^CN(\d{4})-(\d{4})$/ },
    { table: 'debit_notes', field: 'debitNoteNumber', prefixPattern: /^DN(\d{4})-(\d{4})$/ },
    { table: 'challans', field: 'challanNumber', prefixPattern: /^CHN(\d{4})-(\d{4})$/ },
    { table: 'quotations', field: 'quotationNumber', prefixPattern: /^QT(\d{4})-(\d{4})$/ },
  ];

  for (const dt of documentTypes) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ code: string }>>(
        `SELECT "${dt.field}" as code FROM "${dt.table}" ORDER BY "${dt.field}" DESC LIMIT 100`
      );

      const prefixMap = new Map<string, number>();
      for (const row of rows) {
        if (!row.code) continue;
        const match = row.code.match(dt.prefixPattern);
        if (match) {
          const prefix = row.code.slice(
            0,
            row.code.lastIndexOf('-') === -1 ? row.code.length - 4 : row.code.lastIndexOf('-')
          );
          const seq = parseInt(match[2] || match[1], 10);
          const current = prefixMap.get(prefix) || 0;
          if (seq > current) prefixMap.set(prefix, seq);
        }
      }

      for (const [prefix, lastValue] of prefixMap) {
        await prisma.$executeRaw(
          Prisma.sql`
            INSERT INTO code_sequences (id, prefix, "lastValue", "updatedAt")
            VALUES (gen_random_uuid(), ${prefix}, ${lastValue}, NOW())
            ON CONFLICT (prefix) DO UPDATE SET
              "lastValue" = GREATEST(code_sequences."lastValue", ${lastValue}),
              "updatedAt" = NOW()
          `
        );
      }
    } catch (error) {
      console.warn(`Could not seed sequences for ${dt.table}:`, error);
    }
  }
}
