/**
 * Mapping between Material Categories and Supplier Categories
 * This defines which supplier categories are relevant for each material category
 */

import { SupplierCategory } from '@/types/supplier.types';

// Material category name to supplier categories mapping
export const MATERIAL_SUPPLIER_MAPPING: Record<string, SupplierCategory[]> = {
  // TRIMS & NOTIONS
  'Closures': [
    SupplierCategory.TRIMS_SUPPLIER,
  ],
  'Labels & Tags': [
    SupplierCategory.TRIMS_SUPPLIER,
    SupplierCategory.PACKAGING_SUPPLIER,
  ],
  'Elastic & Tapes': [
    SupplierCategory.TRIMS_SUPPLIER,
  ],
  'Decorative': [
    SupplierCategory.TRIMS_SUPPLIER,
    SupplierCategory.LACE_SUPPLIER,
    SupplierCategory.EMBROIDERY,
    SupplierCategory.HAND_WORK,
  ],
  'Hardware': [
    SupplierCategory.TRIMS_SUPPLIER,
  ],

  // THREADS
  'Sewing Thread': [
    SupplierCategory.THREAD_SUPPLIER,
  ],
  'Embroidery Thread': [
    SupplierCategory.THREAD_SUPPLIER,
    SupplierCategory.EMBROIDERY,
  ],
  'Specialty Thread': [
    SupplierCategory.THREAD_SUPPLIER,
  ],

  // PACKAGING
  'Primary Packaging': [
    SupplierCategory.PACKAGING_SUPPLIER,
  ],
  'Secondary Packaging': [
    SupplierCategory.PACKAGING_SUPPLIER,
  ],
  'Labeling': [
    SupplierCategory.PACKAGING_SUPPLIER,
  ],
};

/**
 * Get relevant supplier categories for a material category
 * @param materialCategoryName - The name of the material category
 * @returns Array of relevant supplier categories
 */
export function getRelevantSupplierCategories(materialCategoryName: string): SupplierCategory[] {
  return MATERIAL_SUPPLIER_MAPPING[materialCategoryName] || [];
}

/**
 * Check if a supplier category is relevant for a material category
 * @param materialCategoryName - The name of the material category
 * @param supplierCategory - The supplier category to check
 * @returns True if the supplier category is relevant
 */
export function isSupplierRelevantForMaterial(
  materialCategoryName: string,
  supplierCategory: SupplierCategory
): boolean {
  const relevantCategories = getRelevantSupplierCategories(materialCategoryName);
  return relevantCategories.includes(supplierCategory);
}

/**
 * Check if any of a supplier's categories are relevant for a material category
 * @param materialCategoryName - The name of the material category
 * @param supplierCategories - Array of supplier categories to check
 * @returns True if any supplier category is relevant
 */
export function isSupplierCategoriesRelevantForMaterial(
  materialCategoryName: string,
  supplierCategories: SupplierCategory[]
): boolean {
  const relevantCategories = getRelevantSupplierCategories(materialCategoryName);
  return supplierCategories.some(cat => relevantCategories.includes(cat));
}
