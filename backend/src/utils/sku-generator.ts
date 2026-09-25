/**
 * SKU Generator Utility
 *
 * Generates SKUs following the pattern: {STYLE_CODE}{SIZE}
 * Example: ABC123M, ABC123XL, ABC123XXL
 */

import prisma from '../config/database';
import logger from './logger';

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
export function generateSKUMatrix(styleCode: string, sizes: string[]): Array<{ size: string; sku: string }> {
  return sizes.map((size) => ({
    size,
    sku: generateSKU(styleCode, size),
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
      where: { sku },
    });
    return !!existing;
  } catch (error) {
    logger.error('Error checking SKU existence:', error);
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
      select: { sku: true },
    });
    return existing.map((e) => e.sku);
  } catch (error) {
    logger.error('Error checking multiple SKUs:', error);
    throw error;
  }
}

// ── Size order: BEGIN — byte-identical in backend/src/utils/sku-generator.ts and
// frontend/src/utils/sku-generator.ts (unit/size-order.test.ts asserts it) ──

/**
 * Size order — the ONE rule for how sizes read: XS → XXXL, never alphabetically.
 * Every writer of `size_options.sortOrder` / `style_variants.sortOrder` stores `getSizeOrder()`,
 * and a screen that only has size NAMES (a draft sale-order line) sorts with `compareSizes()`.
 */
export const SIZE_ORDER: Record<string, number> = {
  XXS: -1,
  XS: 0,
  S: 1,
  M: 2,
  L: 3,
  XL: 4,
  XXL: 5,
  XXXL: 6,
  '2XL': 5, // Alias for XXL
  '3XL': 6, // Alias for XXXL
  '4XL': 7,
  '5XL': 8,
  // Kids sizes
  '2Y': 10,
  '3Y': 11,
  '4Y': 12,
  '5Y': 13,
  '6Y': 14,
  '7Y': 15,
  '8Y': 16,
  '9Y': 17,
  '10Y': 18,
  '11Y': 19,
  '12Y': 20,
  '14Y': 21,
  '16Y': 22,
  // Free size
  FREE: 50,
  'FREE SIZE': 50,
  FREESIZE: 50,
};

/** Rank of a size SIZE_ORDER does not know and that is not a plain number: after every known one. */
const UNKNOWN_SIZE_ORDER = 999;

/**
 * Get sort order for a size
 *
 * A plain number (waist 28, 30, 32…) ranks 100 + n so numbers read numerically, not as text.
 *
 * @param sizeName - The size name
 * @returns Sort order number
 */
export function getSizeOrder(sizeName: string): number {
  const key = sizeName.trim().toUpperCase();
  const known = SIZE_ORDER[key];
  if (known !== undefined) return known;
  if (/^\d+$/.test(key)) return 100 + Number(key);
  return UNKNOWN_SIZE_ORDER;
}

/** Comparator for size names: by `getSizeOrder`, then alphabetically between equal ranks. */
export function compareSizes(a: string, b: string): number {
  return getSizeOrder(a) - getSizeOrder(b) || a.localeCompare(b);
}

// ── Size order: END ──

/**
 * Default available sizes
 */
export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
