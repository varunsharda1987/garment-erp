import { generateAtomicMasterCode } from './atomicCodeGenerator';

/**
 * Generate next sequential code for any entity type
 *
 * Delegates to the atomic code_sequences UPSERT (see atomicCodeGenerator.ts); the old
 * table-max lookup was racy under concurrent creates. The visible format is unchanged
 * (e.g. 'LACE-0001') and sequences are seeded from each table's current max code.
 * The sequence is keyed by prefix alone, so every caller writing the same code column
 * (single create AND bulk import) shares one collision-free series.
 *
 * @param prefix - Code prefix (e.g., 'LACE', 'BTN', 'THR', 'STY')
 * @param _tableName - Database table name (unused; kept for call-site compatibility)
 * @param _codeField - Column name for the code field (unused; kept for call-site compatibility)
 * @param padding - Number of digits for padding (default: 4)
 * @returns Promise<string> - Generated code (e.g., 'LACE-0001')
 */
export async function generateCode(
  prefix: string,
  _tableName: string,
  _codeField: string,
  padding: number = 4
): Promise<string> {
  return generateAtomicMasterCode(prefix, padding);
}

/**
 * Generate material code from entity code
 * For materials linked to master tables, use the same code pattern
 * @param entityCode - The code from the master table (e.g., 'LACE-0001')
 * @returns string - Material code (same as entity code)
 */
export function generateMaterialCode(entityCode: string): string {
  return entityCode;
}

/**
 * Validate code format
 * @param code - Code to validate
 * @param prefix - Expected prefix
 * @returns boolean - True if valid
 */
export function validateCodeFormat(code: string, prefix: string): boolean {
  const pattern = new RegExp(`^${prefix}-\\d{4}$`);
  return pattern.test(code);
}

/**
 * Extract number from code
 * @param code - Code string (e.g., 'LACE-0001')
 * @param prefix - Code prefix
 * @returns number | null - Extracted number or null if invalid
 */
export function extractCodeNumber(code: string, prefix: string): number | null {
  const match = code.match(new RegExp(`^${prefix}-(\\d+)$`));
  return match && match[1] ? parseInt(match[1], 10) : null;
}

/**
 * Allocate a batch of codes
 * Useful for bulk import to pre-generate all codes at once. Draws each code from the
 * same atomic sequence used by single creates, so pre-generated bulk-import codes can
 * never collide with codes minted concurrently elsewhere.
 * @param prefix - Code prefix
 * @param tableName - Database table name (unused; kept for call-site compatibility)
 * @param codeField - Column name for the code field (unused; kept for call-site compatibility)
 * @param count - Number of codes to allocate
 * @returns Promise<string[]> - Array of generated codes
 */
export async function allocateBatchCodes(
  prefix: string,
  tableName: string,
  codeField: string,
  count: number
): Promise<string[]> {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(await generateCode(prefix, tableName, codeField));
  }
  return codes;
}
