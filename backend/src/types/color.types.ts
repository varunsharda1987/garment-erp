/**
 * Color Master Types
 * Type definitions for color master operations
 */

// ============================================
// Color Family Constants
// ============================================

export const COLOR_FAMILIES = [
  'Reds',
  'Blues',
  'Greens',
  'Yellows',
  'Oranges',
  'Purples',
  'Pinks',
  'Browns',
  'Neutrals',
  'Prints',
  'Metallics',
] as const;

export type ColorFamily = (typeof COLOR_FAMILIES)[number];

// ============================================
// Color Master Types
// ============================================

/**
 * Color master entity
 */
export interface ColorMaster {
  id: string;
  colorCode: string;
  colorName: string;
  hexCode: string | null;
  colorFamily: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create color master request
 * @deprecated BACKEND ONLY: Not used in backend - service uses Zod-inferred CreateColorInput from color.schema.ts.
 *             This interface is kept for reference but may be removed in a future cleanup.
 *             Frontend has its own CreateColorRequest in frontend/src/types/color.types.ts.
 */
export interface CreateColorRequest {
  colorName: string;
  hexCode?: string | null;
  colorFamily?: string | null;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

/**
 * Update color master request
 * @deprecated BACKEND ONLY: Not used in backend - service uses Zod-inferred UpdateColorInput from color.schema.ts.
 *             This interface is kept for reference but may be removed in a future cleanup.
 *             Frontend has its own UpdateColorRequest in frontend/src/types/color.types.ts.
 */
export interface UpdateColorRequest extends Partial<CreateColorRequest> {}

// ============================================
// Response Types
// ============================================

/**
 * Paginated color list response
 * BUG-COL2 Fix: Changed key from 'colors' to 'data' to match controller response
 * @deprecated BACKEND ONLY: Not used in backend - controller returns inline object structure.
 *             This interface is kept for documentation but may be removed in a future cleanup.
 *             Frontend has its own ColorListResponse in frontend/src/types/color.types.ts.
 */
export interface ColorListResponse {
  data: ColorMaster[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Color search result (minimal data for dropdowns)
 */
export interface ColorSearchResult {
  id: string;
  colorCode: string;
  colorName: string;
  hexCode: string | null;
  colorFamily: string | null;
}

/**
 * Bulk import result
 */
export interface ColorBulkImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    colorName: string;
    error: string;
  }>;
}

/**
 * Bulk import row data
 */
export interface ColorImportRow {
  colorName: string;
  hexCode?: string;
  colorFamily?: string;
  description?: string;
}
