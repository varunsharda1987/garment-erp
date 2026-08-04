/**
 * Greige Quantity Calculator
 *
 * P3: Shared formula for greige material requirements.
 * Formula: orderQty = need × (1 + wastage%/100) ÷ (1 − shrinkage%/100)
 *
 * Used by:
 * - MRP greige branch
 * - convert-to-greige
 * - PurchaseOrderForm (via API)
 */

import Decimal from 'decimal.js';
import { toCurrency, divideByShrinkage, percentOf } from './currency';

export interface GreigeQuantityInput {
  need: number;
  wastagePercent?: number | null;
  shrinkagePercent?: number | null;
}

export interface GreigeQuantityResult {
  quantity: number;
  withWastage: number;
  withShrinkage: number;
  warnings: string[];
  appliedWastage: number;
  appliedShrinkage: number;
}

/**
 * Calculate greige order quantity with wastage and shrinkage adjustments.
 *
 * Edge policy (P3):
 * - Invalid shrinkage (< 0 or >= 100): skip shrinkage, collect warning
 * - Null/undefined wastage: default to 0%
 * - Null/undefined shrinkage: default to 0% (no adjustment)
 * - Never abort — always return a usable quantity
 *
 * @param input - need, wastagePercent, shrinkagePercent
 * @returns quantity with breakdown and warnings
 */
export function calculateGreigeQuantity(input: GreigeQuantityInput): GreigeQuantityResult {
  const { need, wastagePercent, shrinkagePercent } = input;
  const warnings: string[] = [];

  // Start with the base need
  let quantity = toCurrency(need);

  // Apply wastage: need × (1 + wastage%/100)
  const wastage = wastagePercent ?? 0;
  const withWastage = quantity.plus(percentOf(quantity, wastage));
  quantity = withWastage;
  const appliedWastage = wastage;

  // Apply shrinkage: qty ÷ (1 − shrinkage%/100)
  let appliedShrinkage = 0;
  const shrinkage = shrinkagePercent ?? 0;

  if (shrinkage !== 0) {
    // Validate shrinkage range
    if (shrinkage < 0) {
      warnings.push(`Shrinkage ${shrinkage}% is negative — skipping shrinkage adjustment`);
    } else if (shrinkage >= 100) {
      warnings.push(`Shrinkage ${shrinkage}% is >= 100% — skipping shrinkage adjustment (would be infinite)`);
    } else {
      // Valid shrinkage — apply it
      try {
        quantity = divideByShrinkage(quantity, shrinkage);
        appliedShrinkage = shrinkage;
      } catch (err: any) {
        warnings.push(`Shrinkage calculation failed: ${err.message} — skipping`);
      }
    }
  }

  return {
    quantity: quantity.toDecimalPlaces(4).toNumber(),
    withWastage: withWastage.toDecimalPlaces(4).toNumber(),
    withShrinkage: quantity.toDecimalPlaces(4).toNumber(),
    warnings,
    appliedWastage,
    appliedShrinkage,
  };
}

/**
 * Validate shrinkage percent at greige-master save time.
 * Throws if out of range [0, 100).
 */
export function validateShrinkagePercent(shrinkagePercent: number | null | undefined): void {
  if (shrinkagePercent === null || shrinkagePercent === undefined) {
    return; // Null is OK — means "use system default" or "no shrinkage"
  }

  if (shrinkagePercent < 0) {
    throw new Error(`Shrinkage percent cannot be negative: ${shrinkagePercent}%`);
  }

  if (shrinkagePercent >= 100) {
    throw new Error(`Shrinkage percent must be less than 100%: ${shrinkagePercent}%`);
  }
}
