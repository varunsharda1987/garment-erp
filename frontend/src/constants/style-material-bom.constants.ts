// Style Material BOM Constants
import type { MaterialType, MaterialUsageCategory } from '../types/style-material-bom.types';

// Helper const for material type display names
export const MaterialTypeLabels: Record<MaterialType, string> = {
  LACE: 'Lace',
  BUTTON: 'Button',
  THREAD: 'Thread',
  ZIPPER: 'Zipper',
  ELASTIC: 'Elastic',
  LABEL: 'Label',
  PACKAGING: 'Packaging',
};

// Helper const for usage category display names
export const UsageCategoryLabels: Record<MaterialUsageCategory, string> = {
  GARMENT_TRIM: 'Garment Trim',
  VALUE_ADDITION: 'Value Addition',
  PACKAGING: 'Packaging',
};

// Unit options
export const UnitOptions = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'meters', label: 'Meters' },
  { value: 'grams', label: 'Grams' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'cones', label: 'Cones' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'yards', label: 'Yards' },
];
