/**
 * Customer Size Category Preset Types
 *
 * Size category presets allow customers to define reusable size templates
 * that can be applied to styles and orders.
 */

import { SizeCategory } from './sizeCategory.types';

/**
 * Customer Size Category Preset
 */
export interface CustomerSizePreset {
  id: string;
  customerId: string;
  presetName: string;
  description?: string | null;
  sizeCategoryId: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // Relations (camelCase due to serializer)
  sizeCategory: SizeCategory;
}

/**
 * Create Customer Size Preset Request
 */
export interface CreateCustomerSizePresetRequest {
  presetName: string;
  description?: string;
  sizeCategoryId: string;
  isDefault?: boolean;
}

/**
 * Update Customer Size Preset Request
 */
export interface UpdateCustomerSizePresetRequest {
  presetName?: string;
  description?: string;
  sizeCategoryId?: string;
  isActive?: boolean;
}

/**
 * Clone Customer Size Preset Request
 */
export interface CloneCustomerSizePresetRequest {
  presetName: string;
}

/**
 * Customer Size Preset List Response
 */
export interface CustomerSizePresetListResponse {
  data: CustomerSizePreset[];
  total: number;
}
