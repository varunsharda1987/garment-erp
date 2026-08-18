/**
 * Currency Utility
 *
 * Safe currency calculations using decimal.js to avoid floating-point errors.
 * All currency values should use these utilities instead of raw parseFloat.
 */

import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';

// Configure Decimal.js for currency
Decimal.set({
  precision: 20, // High precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_UP, // Standard rounding for currency
});

// Unified type for all decimal inputs: primitives, decimal.js Decimal, or Prisma Decimal
type DecimalInput = string | number | Decimal | Prisma.Decimal | null | undefined;

/**
 * Parse a string/number/Prisma.Decimal into a Decimal for safe calculations.
 * Accepts Prisma Decimal directly so callsites don't need .toString() conversion.
 */
export function toCurrency(value: DecimalInput): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  // Prisma Decimal and decimal.js Decimal are compatible - both have toString()
  if (typeof value === 'object' && 'toString' in value) {
    try {
      return new Decimal(value.toString());
    } catch {
      return new Decimal(0);
    }
  }
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

/**
 * Format a Decimal value to a fixed number of decimal places for storage/display
 * @param value - Decimal or number to format
 * @param decimals - Number of decimal places (default 2 for currency)
 */
export function formatCurrency(value: Decimal | number, decimals: number = 2): string {
  const dec = value instanceof Decimal ? value : new Decimal(value);
  return dec.toFixed(decimals);
}

/**
 * Convert Decimal to number for storage (Prisma expects number for Float fields)
 * Use with caution - only for final storage, not intermediate calculations
 */
export function toNumber(value: Decimal): number {
  return value.toNumber();
}

/**
 * Add multiple currency values safely
 */
export function addCurrency(...values: DecimalInput[]): Decimal {
  return values.reduce((sum: Decimal, val) => sum.plus(toCurrency(val)), new Decimal(0));
}

/**
 * Subtract currency values safely (a - b - c - ...)
 */
export function subtractCurrency(initial: DecimalInput, ...values: DecimalInput[]): Decimal {
  return values.reduce((diff: Decimal, val) => diff.minus(toCurrency(val)), toCurrency(initial));
}

/**
 * Multiply currency values safely (a * b)
 */
export function multiplyCurrency(a: DecimalInput, b: DecimalInput): Decimal {
  return toCurrency(a).times(toCurrency(b));
}

/**
 * Divide currency values safely (a / b)
 * Returns 0 if divisor is 0
 */
export function divideCurrency(a: DecimalInput, b: DecimalInput): Decimal {
  const divisor = toCurrency(b);
  if (divisor.isZero()) {
    return new Decimal(0);
  }
  return toCurrency(a).dividedBy(divisor);
}

/**
 * Inflate a quantity by a shrinkage/wastage factor: quantity / (1 - shrinkagePercent/100).
 *
 * The bare `/ (1 - s/100)` form divides by ZERO when s = 100 (→ Infinity) and flips sign when
 * s > 100, silently corrupting fabric/greige costing. This guards the dangerous end (>= 100) —
 * NOT the harmless s = 0 that some call sites wrongly guarded instead. The pre-commit
 * "shrinkage-divide" guardrail steers raw divisions here (bug-hunt BH-0364/BH-0366).
 */
export function divideByShrinkage(quantity: DecimalInput, shrinkagePercent: DecimalInput): Decimal {
  const pct = toCurrency(shrinkagePercent);
  if (pct.gte(100) || pct.lt(0)) {
    throw new Error(`Invalid shrinkage percent ${pct.toString()}: must be >= 0 and < 100`);
  }
  const factor = new Decimal(1).minus(pct.dividedBy(100)); // 1 - s/100, always in (0, 1]
  return toCurrency(quantity).dividedBy(factor);
}

/**
 * Deflate a quantity by a shrinkage factor: quantity × (1 - shrinkagePercent/100).
 *
 * Inverse of divideByShrinkage — converts greige/input meters to expected finished
 * output meters (the quantity a processor bills for). Same validation window: the
 * dangerous end is s >= 100 (output would go to zero/negative), s = 0 is a no-op.
 */
export function applyShrinkageLoss(quantity: DecimalInput, shrinkagePercent: DecimalInput): Decimal {
  const pct = toCurrency(shrinkagePercent);
  if (pct.gte(100) || pct.lt(0)) {
    throw new Error(`Invalid shrinkage percent ${pct.toString()}: must be >= 0 and < 100`);
  }
  const factor = new Decimal(1).minus(pct.dividedBy(100)); // 1 - s/100, always in (0, 1]
  return toCurrency(quantity).times(factor);
}

/**
 * Calculate percentage (value * percentage / 100)
 */
export function percentOf(value: DecimalInput, percentage: DecimalInput): Decimal {
  return toCurrency(value).times(toCurrency(percentage)).dividedBy(100);
}

/**
 * Round to nearest cent (2 decimal places)
 */
export function roundToCent(value: Decimal | number): Decimal {
  const dec = value instanceof Decimal ? value : new Decimal(value);
  return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Compare two currency values
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareCurrency(a: DecimalInput, b: DecimalInput): number {
  return toCurrency(a).comparedTo(toCurrency(b));
}

/**
 * Check if currency value is zero
 */
export function isZero(value: DecimalInput): boolean {
  return toCurrency(value).isZero();
}

/**
 * Check if currency value is negative
 */
export function isNegative(value: DecimalInput): boolean {
  return toCurrency(value).isNegative();
}

/**
 * Get absolute value
 */
export function absCurrency(value: DecimalInput): Decimal {
  return toCurrency(value).abs();
}

/**
 * Calculate total price (quantity * unit price)
 */
export function calculateTotal(quantity: DecimalInput, unitPrice: DecimalInput): Decimal {
  return multiplyCurrency(quantity, unitPrice);
}

/**
 * Calculate price with tax
 */
export function calculatePriceWithTax(price: DecimalInput, taxPercent: DecimalInput): Decimal {
  const priceVal = toCurrency(price);
  const taxAmount = percentOf(price, taxPercent);
  return priceVal.plus(taxAmount);
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(price: DecimalInput, discountPercent: DecimalInput): Decimal {
  return percentOf(price, discountPercent);
}

/**
 * Calculate final price after discount
 */
export function calculatePriceAfterDiscount(price: DecimalInput, discountPercent: DecimalInput): Decimal {
  const priceVal = toCurrency(price);
  const discountAmount = percentOf(price, discountPercent);
  return priceVal.minus(discountAmount);
}

/**
 * Calculate weighted average cost
 * @param existingQty - Existing quantity
 * @param existingCost - Existing weighted average cost
 * @param newQty - New quantity being added
 * @param newCost - Cost of new items
 */
export function calculateWeightedAverageCost(
  existingQty: DecimalInput,
  existingCost: DecimalInput,
  newQty: DecimalInput,
  newCost: DecimalInput
): Decimal {
  const qty1 = toCurrency(existingQty);
  const cost1 = toCurrency(existingCost);
  const qty2 = toCurrency(newQty);
  const cost2 = toCurrency(newCost);

  const totalQty = qty1.plus(qty2);
  if (totalQty.isZero()) {
    return new Decimal(0);
  }

  const totalValue = qty1.times(cost1).plus(qty2.times(cost2));
  return totalValue.dividedBy(totalQty);
}

/**
 * Sum an array of objects by a numeric field
 */
export function sumByField<T>(items: T[], field: keyof T): Decimal {
  return items.reduce((sum, item) => {
    const value = item[field] as unknown;
    return sum.plus(toCurrency(value as DecimalInput));
  }, new Decimal(0));
}

// Export Decimal class for advanced usage
export { Decimal };

export default {
  toCurrency,
  formatCurrency,
  toNumber,
  addCurrency,
  subtractCurrency,
  multiplyCurrency,
  divideCurrency,
  applyShrinkageLoss,
  percentOf,
  roundToCent,
  compareCurrency,
  isZero,
  isNegative,
  absCurrency,
  calculateTotal,
  calculatePriceWithTax,
  calculateDiscount,
  calculatePriceAfterDiscount,
  calculateWeightedAverageCost,
  sumByField,
  Decimal,
};
