/**
 * Season Master Types (Frontend)
 * Type definitions for season master operations
 */

// ============================================
// Season Type Constants
// ============================================

export const SEASON_TYPES = ['SS', 'AW'] as const;

export type SeasonType = (typeof SEASON_TYPES)[number];

export const SEASON_TYPE_NAMES: Record<SeasonType, string> = {
  SS: 'Spring/Summer',
  AW: 'Autumn/Winter',
};

// ============================================
// Season Master Types
// ============================================

/**
 * Season master entity (from API)
 */
export interface SeasonMaster {
  id: string;
  code: string; // "SS26", "AW26"
  name: string; // "Spring/Summer 2026"
  year: number; // 2026
  seasonType: SeasonType; // "SS" or "AW"
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create season request
 */
export interface CreateSeasonRequest {
  code: string;
  name: string;
  year: number;
  seasonType: SeasonType;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * Update season request
 */
export interface UpdateSeasonRequest {
  code?: string;
  name?: string;
  year?: number;
  seasonType?: SeasonType;
  sortOrder?: number;
  isActive?: boolean;
}

// ============================================
// Query Types
// ============================================

/**
 * Season query parameters
 */
export interface SeasonQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  year?: number;
  seasonType?: SeasonType;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Season search parameters (for dropdowns)
 */
export interface SeasonSearchParams {
  search?: string;
  year?: number;
  seasonType?: SeasonType;
  limit?: number;
}

// ============================================
// Response Types
// ============================================

/**
 * Paginated season list response
 */
export interface SeasonListResponse {
  data: SeasonMaster[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Single season response
 */
export interface SeasonResponse {
  data: SeasonMaster;
  message?: string;
}

/**
 * Season search result (minimal data for dropdowns)
 */
export interface SeasonSearchResult {
  id: string;
  code: string;
  name: string;
  year: number;
  seasonType: SeasonType;
}

/**
 * Season search response
 */
export interface SeasonSearchResponse {
  data: SeasonSearchResult[];
}

/**
 * Season type option (for type dropdown)
 */
export interface SeasonTypeOption {
  code: SeasonType;
  name: string;
}

/**
 * Season types response
 */
export interface SeasonTypesResponse {
  data: SeasonTypeOption[];
}

/**
 * Generate seasons request
 */
export interface GenerateSeasonsRequest {
  startYear: number;
  endYear: number;
  seasonTypes?: SeasonType[];
}

/**
 * Generate seasons response
 */
export interface GenerateSeasonsResponse {
  data: {
    created: number;
    skipped: number;
    seasons: SeasonMaster[];
  };
  message: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format season for display (short code only)
 * @example formatSeason(season) => "SS26"
 */
export function formatSeasonDisplay(season: SeasonMaster | SeasonSearchResult): string {
  return season.code;
}

/**
 * Get year options for season filter (last 5 years to next 5 years)
 */
export function getSeasonYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear - 3; year <= currentYear + 5; year++) {
    years.push(year);
  }
  return years;
}
