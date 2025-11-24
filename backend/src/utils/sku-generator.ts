/**
 * SKU Generator Utility
 *
 * Generates SKUs following the pattern: {STYLE_CODE}{SIZE}
 * Example: ABC123M, ABC123XL, ABC123XXL
 */

import prisma from '../config/database';

/**
 * Generate SKU from style code and size
 * Pattern: {STYLE_CODE}{SIZE}
 *
 * @param styleCode - The style code (e.g., "ABC123", "KS-001")
 * @param sizeName - The size name (e.g., "M", "XL", "XXL")
 * @returns Generated SKU (e.g., "ABC123M", "ABC123XL")
 *
 * @example
 * generateSKU("ABC123", "M") // Returns "ABC123M"
 * generateSKU("KS-001", "XL") // Returns "KS001XL"
 */
export function generateSKU(styleCode: string, sizeName: string): string {
  // Remove any spaces, hyphens, and special chars from style code
  const cleanStyleCode = styleCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  // Remove any spaces and special chars from size
  const cleanSize = sizeName.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  return `${cleanStyleCode}${cleanSize}`;
}

/**
 * Generate SKU matrix for multiple sizes
 *
 * @param styleCode - The style code
 * @param sizes - Array of size names
 * @returns Array of objects containing size and generated SKU
 *
 * @example
 * generateSKUMatrix("ABC123", ["S", "M", "L"])
 * // Returns:
 * // [
 * //   { size: "S", sku: "ABC123S" },
 * //   { size: "M", sku: "ABC123M" },
 * //   { size: "L", sku: "ABC123L" }
 * // ]
 */
export function generateSKUMatrix(
  styleCode: string,
  sizes: string[]
): Array<{ size: string; sku: string }> {
  return sizes.map(size => ({
    size,
    sku: generateSKU(styleCode, size)
  }));
}

/**
 * Validate SKU format
 * SKU must be alphanumeric, 5-30 characters
 *
 * @param sku - The SKU to validate
 * @returns true if valid, false otherwise
 */
export function validateSKUFormat(sku: string): boolean {
  // Must be alphanumeric, 5-30 chars
  return /^[A-Z0-9]{5,30}$/i.test(sku);
}

/**
 * Check if SKU already exists in database
 *
 * @param sku - The SKU to check
 * @returns Promise<boolean> - true if SKU exists, false otherwise
 */
export async function checkSKUExists(sku: string): Promise<boolean> {
  try {
    const existing = await prisma.style_variants.findUnique({
      where: { sku }
    });
    return !!existing;
  } catch (error) {
    console.error('Error checking SKU existence:', error);
    throw error;
  }
}

/**
 * Check multiple SKUs for existence
 *
 * @param skus - Array of SKUs to check
 * @returns Promise<string[]> - Array of SKUs that already exist
 */
export async function checkMultipleSKUsExist(skus: string[]): Promise<string[]> {
  try {
    const existing = await prisma.style_variants.findMany({
      where: { sku: { in: skus } },
      select: { sku: true }
    });
    return existing.map(e => e.sku);
  } catch (error) {
    console.error('Error checking multiple SKUs:', error);
    throw error;
  }
}

/**
 * Default size order mapping for sorting
 */
export const SIZE_ORDER: Record<string, number> = {
  'XS': 0,
  'S': 1,
  'M': 2,
  'L': 3,
  'XL': 4,
  'XXL': 5,
  'XXXL': 6,
  '2XL': 5,  // Alias for XXL
  '3XL': 6,  // Alias for XXXL
};

/**
 * Default available sizes
 */
export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/**
 * Get sort order for a size
 *
 * @param sizeName - The size name
 * @returns Sort order number
 */
export function getSizeOrder(sizeName: string): number {
  return SIZE_ORDER[sizeName.toUpperCase()] ?? 999;
}
