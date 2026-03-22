/**
 * Currency formatting utilities for Indian Rupees (INR)
 *
 * This module provides centralized currency formatting to ensure consistency
 * across the entire application. All monetary values should be formatted using
 * these utilities to prevent locale-related issues and ensure proper INR display.
 */

/**
 * Format a number as Indian Rupees (INR)
 *
 * Uses Intl.NumberFormat with 'en-IN' locale and 'INR' currency to ensure
 * consistent formatting regardless of browser/OS locale settings.
 *
 * @param amount - The amount to format (number, string, null, or undefined)
 * @param options - Optional formatting options
 * @param options.decimals - Number of decimal places (default: 2)
 * @param options.showSymbol - Whether to show the ₹ symbol (default: true)
 * @returns Formatted currency string (e.g., "₹1,23,456.78")
 *
 * @example
 * formatCurrency(123456.789) // "₹1,23,456.79"
 * formatCurrency(1234.5, { decimals: 0 }) // "₹1,235"
 * formatCurrency(1000, { showSymbol: false }) // "1,000.00"
 */
export const formatCurrency = (
  amount: number | string | null | undefined,
  options?: {
    decimals?: number;
    showSymbol?: boolean;
  }
): string => {
  // Handle null/undefined/empty string
  if (amount === null || amount === undefined || amount === '') {
    return '₹0.00';
  }

  // Convert to number if string
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Handle NaN
  if (isNaN(numAmount)) {
    return '₹0.00';
  }

  const decimals = options?.decimals ?? 2;
  const showSymbol = options?.showSymbol ?? true;

  // Format using Intl.NumberFormat with INR currency and en-IN locale
  // This ensures:
  // - Proper thousand separators (Indian lakh/crore system: 1,23,45,678)
  // - Rupee symbol (₹)
  // - Consistent formatting regardless of browser locale
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numAmount);

  // If showSymbol is false, remove the ₹ symbol
  return showSymbol ? formatted : formatted.replace('₹', '').trim();
};

/**
 * Format currency without decimal places (for large amounts)
 *
 * Convenience function for formatting whole rupee amounts like totals,
 * dashboard metrics, etc.
 *
 * @param amount - The amount to format
 * @returns Formatted currency string with no decimal places (e.g., "₹1,23,456")
 *
 * @example
 * formatCurrencyWhole(123456.789) // "₹1,23,457"
 * formatCurrencyWhole(229045) // "₹2,29,045"
 */
export const formatCurrencyWhole = (amount: number | string | null | undefined): string => {
  return formatCurrency(amount, { decimals: 0 });
};

/**
 * Format currency with a specific number of decimal places
 *
 * @param amount - The amount to format
 * @param decimals - Number of decimal places
 * @returns Formatted currency string
 *
 * @example
 * formatCurrencyWithDecimals(123.456, 3) // "₹123.456"
 */
export const formatCurrencyWithDecimals = (amount: number | string | null | undefined, decimals: number): string => {
  return formatCurrency(amount, { decimals });
};
