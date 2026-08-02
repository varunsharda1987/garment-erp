/**
 * Math Utilities
 *
 * Safe math operations for the frontend, mirroring backend/src/utils/currency.ts patterns.
 */

/**
 * Inflate a quantity by a shrinkage/wastage factor: quantity / (1 - shrinkagePercent/100).
 *
 * The bare `/ (1 - s/100)` form divides by ZERO when s = 100 (-> Infinity) and flips sign when
 * s > 100, silently corrupting fabric/greige costing. This guards the dangerous end (>= 100).
 *
 * @param quantity - The base quantity to inflate
 * @param shrinkagePercent - Shrinkage percentage (0-99.99)
 * @returns Inflated quantity, or original quantity if shrinkage is 0 or invalid
 */
export function divideByShrinkage(quantity: number, shrinkagePercent: number): number {
  // If no shrinkage or invalid, return original
  if (shrinkagePercent <= 0 || shrinkagePercent >= 100) {
    // Log warning for invalid values >= 100 (these would cause Infinity or negative)
    if (shrinkagePercent >= 100) {
      console.warn(`Invalid shrinkage percent ${shrinkagePercent}: must be < 100. Returning original quantity.`);
    }
    return quantity;
  }

  const factor = 1 - shrinkagePercent / 100;
  return quantity / factor;
}

/**
 * Safe division that returns 0 if divisor is 0
 */
export function safeDivide(a: number, b: number): number {
  if (b === 0) return 0;
  return a / b;
}
