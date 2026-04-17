/**
 * Supplier-Material Type Mapping Utility
 *
 * Maps supplier categories to allowed material types for Stock In/Out workflows.
 * This eliminates redundant material type selection when the supplier's category
 * already determines what materials they can supply.
 */

import type { SupplierCategory } from '../types/supplier.types';

// Material types used in Stock In/Out forms
export type MaterialType =
  | 'MATERIAL'
  | 'GREIGE'
  | 'FABRIC'
  | 'LACE'
  | 'BUTTON'
  | 'THREAD'
  | 'ZIPPER'
  | 'ELASTIC'
  | 'LABEL'
  | 'PACKAGING'
  | 'LABEL_VARIANT';

/**
 * Maps supplier categories to allowed material types
 */
export const SUPPLIER_CATEGORY_TO_MATERIAL_TYPES: Record<SupplierCategory, MaterialType[]> = {
  GREIGE_SUPPLIER: ['GREIGE'],
  FABRIC_SUPPLIER: ['FABRIC'],
  LACE_SUPPLIER: ['LACE'],
  THREAD_SUPPLIER: ['THREAD'],
  PACKAGING_SUPPLIER: ['PACKAGING'],
  TRIMS_SUPPLIER: ['BUTTON', 'ZIPPER', 'ELASTIC', 'LABEL', 'LABEL_VARIANT', 'MATERIAL'],
  MACHINE_PARTS_SUPPLIER: ['MATERIAL'],
  // Processors/Services - don't supply materials directly
  DYEING_PRINTING: [],
  EMBROIDERY: [],
  HAND_WORK: [],
  SMOCKING: [],
  CMT_UNIT: [],
  FINISHING_CONTRACTOR: [],
  STITCHING_CONTRACTOR: [],
  WASHING: [],
  DORI_PIPING_CONTRACTOR: [],
  OTHER_SERVICES: [],
};

/**
 * Material supplier categories (suppliers that actually supply materials)
 * These are shown in Stock In/Out forms
 */
export const MATERIAL_SUPPLIER_CATEGORIES: SupplierCategory[] = [
  'GREIGE_SUPPLIER',
  'FABRIC_SUPPLIER',
  'LACE_SUPPLIER',
  'THREAD_SUPPLIER',
  'PACKAGING_SUPPLIER',
  'TRIMS_SUPPLIER',
  'MACHINE_PARTS_SUPPLIER',
];

/**
 * Processor/Service categories (don't supply materials)
 * These are hidden from Stock In/Out supplier lists
 */
export const PROCESSOR_CATEGORIES: SupplierCategory[] = [
  'DYEING_PRINTING',
  'EMBROIDERY',
  'HAND_WORK',
  'SMOCKING',
  'CMT_UNIT',
  'FINISHING_CONTRACTOR',
  'STITCHING_CONTRACTOR',
  'WASHING',
  'DORI_PIPING_CONTRACTOR',
  'OTHER_SERVICES',
];

/**
 * Get allowed material types for a supplier based on their categories
 * @param supplierCategories - Array of supplier's categories
 * @returns Array of unique material types the supplier can provide
 */
export function getAllowedMaterialTypes(supplierCategories: SupplierCategory[]): MaterialType[] {
  if (!supplierCategories || supplierCategories.length === 0) {
    return [];
  }

  const allowedTypes = new Set<MaterialType>();

  for (const category of supplierCategories) {
    const types = SUPPLIER_CATEGORY_TO_MATERIAL_TYPES[category] || [];
    for (const type of types) {
      allowedTypes.add(type);
    }
  }

  return Array.from(allowedTypes);
}

/**
 * Check if a material type is allowed for a supplier
 * @param supplierCategories - Array of supplier's categories
 * @param materialType - Material type to check
 * @returns true if the material type is allowed
 */
export function isMaterialTypeAllowed(supplierCategories: SupplierCategory[], materialType: MaterialType): boolean {
  const allowedTypes = getAllowedMaterialTypes(supplierCategories);
  return allowedTypes.includes(materialType);
}

/**
 * Check if a supplier is a material supplier (not a processor)
 * @param supplierCategories - Array of supplier's categories
 * @returns true if the supplier has at least one material supplier category
 */
export function isMaterialSupplier(supplierCategories: SupplierCategory[]): boolean {
  if (!supplierCategories || supplierCategories.length === 0) {
    return false;
  }

  return supplierCategories.some((cat) => MATERIAL_SUPPLIER_CATEGORIES.includes(cat));
}

/**
 * Get display label for material types based on supplier categories
 * @param supplierCategories - Array of supplier's categories
 * @returns Human-readable label describing what the supplier provides
 */
export function getSupplierMaterialLabel(supplierCategories: SupplierCategory[]): string {
  const allowedTypes = getAllowedMaterialTypes(supplierCategories);

  if (allowedTypes.length === 0) {
    return 'No materials (Processor/Service)';
  }

  if (allowedTypes.length === 1) {
    const labels: Record<MaterialType, string> = {
      GREIGE: 'Greige Fabric',
      FABRIC: 'Finished Fabric',
      LACE: 'Lace',
      BUTTON: 'Buttons',
      THREAD: 'Threads',
      ZIPPER: 'Zippers',
      ELASTIC: 'Elastics',
      LABEL: 'Labels',
      LABEL_VARIANT: 'Label Variants',
      PACKAGING: 'Packaging',
      MATERIAL: 'Other Materials',
    };
    return labels[allowedTypes[0]];
  }

  // Multiple types - summarize
  if (supplierCategories.includes('TRIMS_SUPPLIER')) {
    return 'Trims (Buttons, Zippers, Elastics, Labels, etc.)';
  }

  return `${allowedTypes.length} material types`;
}
