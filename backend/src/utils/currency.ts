/**
 * Currency Utility
 *
 * Safe currency calculations using decimal.js to avoid floating-point errors.
 * All currency values should use these utilities instead of raw parseFloat.
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for currency
Decimal.set({
  precision: 20, // High precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_UP, // Standard rounding for currency
});

/**
 * Parse a string/number into a Decimal for safe calculations
 */
export function toCurrency(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
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
export function addCurrency(...values: (string | number | null | undefined)[]): Decimal {
  return values.reduce((sum: Decimal, val) => sum.plus(toCurrency(val)), new Decimal(0));
}

/**
 * Subtract currency values safely (a - b - c - ...)
 */
export function subtractCurrency(
  initial: string | number | null | undefined,
  ...values: (string | number | null | undefined)[]
): Decimal {
  return values.reduce((diff: Decimal, val) => diff.minus(toCurrency(val)), toCurrency(initial));
}

/**
 * Multiply currency values safely (a * b)
 */
export function multiplyCurrency(
  a: string | number | null | undefined,
  b: string | number | null | undefined
): Decimal {
  return toCurrency(a).times(toCurrency(b));
}

/**
 * Divide currency values safely (a / b)
 * Returns 0 if divisor is 0
 */
export function divideCurrency(
  a: string | number | null | undefined,
  b: string | number | null | undefined
): Decimal {
  const divisor = toCurrency(b);
  if (divisor.isZero()) {
    return new Decimal(0);
  }
  return toCurrency(a).dividedBy(divisor);
}

/**
 * Calculate percentage (value * percentage / 100)
 */
export function percentOf(
  value: string | number | null | undefined,
  percentage: string | number | null | undefined
): Decimal {
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
export function compareCurrency(
  a: string | number | null | undefined,
  b: string | number | null | undefined
): number {
  return toCurrency(a).comparedTo(toCurrency(b));
}

/**
 * Check if currency value is zero
 */
export function isZero(value: string | number | null | undefined): boolean {
  return toCurrency(value).isZero();
}

/**
 * Check if currency value is negative
 */
export function isNegative(value: string | number | null | undefined): boolean {
  return toCurrency(value).isNegative();
}

/**
 * Get absolute value
 */
export function absCurrency(value: string | number | null | undefined): Decimal {
  return toCurrency(value).abs();
}

/**
 * Calculate total price (quantity * unit price)
 */
export function calculateTotal(
  quantity: string | number | null | undefined,
  unitPrice: string | number | null | undefined
): Decimal {
  return multiplyCurrency(quantity, unitPrice);
}

/**
 * Calculate price with tax
 */
export function calculatePriceWithTax(
  price: string | number | null | undefined,
  taxPercent: string | number | null | undefined
): Decimal {
  const priceVal = toCurrency(price);
  const taxAmount = percentOf(price, taxPercent);
  return priceVal.plus(taxAmount);
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(
  price: string | number | null | undefined,
  discountPercent: string | number | null | undefined
): Decimal {
  return percentOf(price, discountPercent);
}

/**
 * Calculate final price after discount
 */
export function calculatePriceAfterDiscount(
  price: string | number | null | undefined,
  discountPercent: string | number | null | undefined
): Decimal {
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
  existingQty: string | number | null | undefined,
  existingCost: string | number | null | undefined,
  newQty: string | number | null | undefined,
  newCost: string | number | null | undefined
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
export function sumByField<T>(
  items: T[],
  field: keyof T
): Decimal {
  return items.reduce((sum, item) => {
    const value = item[field] as unknown;
    return sum.plus(toCurrency(value as string | number | null | undefined));
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
