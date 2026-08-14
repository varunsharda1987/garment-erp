// Formatting utility functions

/**
 * Format a physical quantity for display.
 *
 * Quantities reach the frontend as Prisma Decimals serialised through Number(), so a value can
 * arrive as 1234.5670000000002. Rendering one raw (or through a bare toLocaleString(), which
 * defaults to 3 decimals and no fixed floor) produced a different number format in every column.
 * This trims float noise, keeps thousands separators, and never invents precision.
 *
 * @param value    quantity to format
 * @param unit     optional unit appended after a space (e.g. "MTR")
 * @param decimals maximum decimals to show, default 2; trailing zeros are dropped
 */
export function formatQuantity(value: number | string | null | undefined, unit?: string | null, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === null || num === undefined || Number.isNaN(num)) return unit ? `0 ${unit}` : '0';

  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Format material type enum to display name
 */
export function formatMaterialType(type: string): string {
  const mapping: Record<string, string> = {
    THREAD: 'Thread',
    BUTTON: 'Button',
    ZIPPER: 'Zipper',
    ELASTIC: 'Elastic',
    LACE: 'Lace',
    LABEL: 'Label',
    PACKAGING: 'Packaging',
    MACHINE_PART: 'Machine Parts',
    OTHER: 'Other Materials',
    GREIGE: 'Greige',
    FABRIC: 'Fabric',
  };
  return mapping[type] || type;
}
