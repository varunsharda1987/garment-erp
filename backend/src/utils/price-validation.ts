/**
 * Price Validation Utilities
 *
 * Shared validation functions for PO price validation.
 * Used by services that create POs programmatically (MRP, Cost Sheet, Service Requirements).
 */

export interface ItemWithPrice {
  unitPrice: number;
  [key: string]: unknown;
}

/**
 * Validates that a price is positive (greater than 0).
 * Throws an error if price is <= 0.
 *
 * @param price - The price to validate
 * @param context - Optional context for error message (e.g., item name, material code)
 * @throws Error if price is not positive
 */
export function validatePositivePrice(price: number, context?: string): void {
  if (price <= 0) {
    const contextMsg = context ? ` for ${context}` : '';
    throw new Error(`Unit price must be greater than 0${contextMsg}. Got: ${price}`);
  }
}

/**
 * Validates all items in an array have positive prices.
 * Throws an error listing all items with invalid prices.
 *
 * @param items - Array of items with unitPrice property
 * @param getItemName - Optional function to extract item name for error messages
 * @throws Error if any item has price <= 0
 */
export function validateAllItemPrices<T extends ItemWithPrice>(items: T[], getItemName?: (item: T) => string): void {
  const invalidItems = items.filter((item) => item.unitPrice <= 0);

  if (invalidItems.length > 0) {
    const itemNames = invalidItems.map((item, idx) => (getItemName ? getItemName(item) : `Item ${idx + 1}`)).join(', ');

    throw new Error(`Cannot create PO: ${invalidItems.length} item(s) have invalid price (must be > 0): ${itemNames}`);
  }
}

/**
 * Checks if all items have valid (positive) prices.
 * Does not throw - returns validation result.
 *
 * @param items - Array of items with unitPrice property
 * @returns Object with isValid flag and list of invalid items
 */
export function checkItemPrices<T extends ItemWithPrice>(
  items: T[]
): {
  isValid: boolean;
  invalidItems: T[];
  validItems: T[];
} {
  const validItems = items.filter((item) => item.unitPrice > 0);
  const invalidItems = items.filter((item) => item.unitPrice <= 0);

  return {
    isValid: invalidItems.length === 0,
    invalidItems,
    validItems,
  };
}
