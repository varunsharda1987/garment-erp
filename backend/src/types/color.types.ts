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
 */
export interface UpdateColorRequest extends Partial<CreateColorRequest> {}

// ============================================
// Query Types
// ============================================

/**
 * Color query filters
 */
export interface ColorQueryFilters {
  page?: string | number;
  limit?: string | number;
  search?: string;
  colorFamily?: string;
  isActive?: string | boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Prisma where clause for color queries
 */
export interface ColorWhereClause {
  isActive?: boolean;
  colorFamily?: string;
  OR?: Array<Record<string, { contains: string; mode: 'insensitive' }>>;
}

// ============================================
// Response Types
// ============================================

/**
 * Paginated color list response
 */
export interface ColorListResponse {
  colors: ColorMaster[];
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
