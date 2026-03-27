/**
 * Color Master Types
 * Frontend type definitions for color master operations
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
  createdAt: string;
  updatedAt: string;
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

// ============================================
// Form Types
// ============================================

/**
 * Color form data for create/edit
 */
export interface ColorFormData {
  colorName: string;
  hexCode: string;
  colorFamily: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Create color request
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
 * Update color request
 */
export type UpdateColorRequest = Partial<CreateColorRequest>;

// ============================================
// Query Types
// ============================================

/**
 * Color list query parameters
 */
export interface ColorListParams {
  page?: number;
  limit?: number;
  search?: string;
  colorFamily?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Color search query parameters
 */
export interface ColorSearchParams {
  search?: string;
  colorFamily?: string;
  limit?: number;
}

// ============================================
// Response Types
// ============================================

/**
 * Pagination info
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Color list response
 */
export interface ColorListResponse {
  data: ColorMaster[];
  pagination: PaginationInfo;
}

/**
 * Single color response
 */
export interface ColorResponse {
  data: ColorMaster;
  message?: string;
}

/**
 * Color search response
 */
export interface ColorSearchResponse {
  data: ColorSearchResult[];
}

/**
 * Color families response
 */
export interface ColorFamiliesResponse {
  data: string[];
}

// ============================================
// Bulk Import Types
// ============================================

/**
 * Color import row
 */
export interface ColorImportRow {
  colorName: string;
  hexCode?: string;
  colorFamily?: string;
  description?: string;
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
 * Bulk import response
 */
export interface ColorBulkImportResponse {
  data: ColorBulkImportResult;
  message: string;
}

/**
 * Import template column info
 */
export interface ImportTemplateColumn {
  field: string;
  header: string;
  required: boolean;
  description: string;
}

/**
 * Import template response
 */
export interface ColorImportTemplateResponse {
  data: {
    columns: ImportTemplateColumn[];
    sampleData: ColorImportRow[];
  };
}
