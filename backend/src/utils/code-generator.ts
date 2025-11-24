import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate next sequential code for any entity type
 * @param prefix - Code prefix (e.g., 'LACE', 'BTN', 'THR', 'STY')
 * @param tableName - Database table name (e.g., 'lace_master', 'button_master')
 * @param codeField - Column name for the code field (e.g., 'laceCode', 'buttonCode')
 * @param padding - Number of digits for padding (default: 4)
 * @returns Promise<string> - Generated code (e.g., 'LACE-0001')
 */
export async function generateCode(
  prefix: string,
  tableName: string,
  codeField: string,
  padding: number = 4
): Promise<string> {
  try {
    // Get the last code from the database by querying the specific table
    // Using raw query since we need dynamic table and column names
    const query = `
      SELECT "${codeField}"
      FROM "${tableName}"
      WHERE "${codeField}" LIKE '${prefix}-%'
      ORDER BY "${codeField}" DESC
      LIMIT 1
    `;

    const result = await prisma.$queryRawUnsafe<Array<{ [key: string]: string }>>(query);

    let nextNumber = 1;

    if (result && result.length > 0) {
      const lastCode = result[0][codeField];

      if (lastCode) {
        // Extract number from code (e.g., 'LACE-0005' -> '0005' -> 5)
        const match = lastCode.match(new RegExp(`${prefix}-(\\d+)$`));

        if (match && match[1]) {
          const lastNumber = parseInt(match[1], 10);
          nextNumber = lastNumber + 1;
        }
      }
    }

    // Pad the number with leading zeros
    const paddedNumber = nextNumber.toString().padStart(padding, '0');

    // Return formatted code
    return `${prefix}-${paddedNumber}`;
  } catch (error) {
    console.error(`Error generating code for ${tableName}:`, error);

    // Fallback: return a code with timestamp to ensure uniqueness
    const timestamp = Date.now().toString().slice(-padding);
    return `${prefix}-${timestamp}`;
  }
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
 * Generate batch of codes
 * Useful for bulk import to pre-generate all codes at once
 * @param prefix - Code prefix
 * @param tableName - Database table name
 * @param codeField - Column name for the code field
 * @param count - Number of codes to generate
 * @returns Promise<string[]> - Array of generated codes
 */
export async function generateBatchCodes(
  prefix: string,
  tableName: string,
  codeField: string,
  count: number
): Promise<string[]> {
  const codes: string[] = [];

  // Get the starting code
  const firstCode = await generateCode(prefix, tableName, codeField);
  const startNumber = extractCodeNumber(firstCode, prefix);

  if (startNumber === null) {
    throw new Error(`Invalid code format: ${firstCode}`);
  }

  // Generate batch
  for (let i = 0; i < count; i++) {
    const number = startNumber + i;
    const paddedNumber = number.toString().padStart(4, '0');
    codes.push(`${prefix}-${paddedNumber}`);
  }

  return codes;
}
