/**
 * Season Master Types
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
 * Season master entity
 *
 * NOTE: createdAt/updatedAt are Date objects from Prisma.
 * The API serializer converts them to ISO strings before sending to frontend.
 * Frontend types correctly use `string` for these fields.
 */
export interface SeasonMaster {
  id: string;
  code: string; // "SS26", "AW26"
  name: string; // "Spring/Summer 2026"
  year: number; // 2026
  seasonType: SeasonType; // "SS" or "AW"
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create season master request
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
 * Update season master request
 */
export interface UpdateSeasonRequest extends Partial<CreateSeasonRequest> {}

// ============================================
// Query Types
// ============================================

/**
 * Season query filters
 */
export interface SeasonQueryFilters {
  page?: string | number;
  limit?: string | number;
  search?: string;
  year?: string | number;
  seasonType?: SeasonType;
  isActive?: string | boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Prisma where clause for season queries
 */
export interface SeasonWhereClause {
  isActive?: boolean;
  year?: number;
  seasonType?: SeasonType;
  OR?: Array<Record<string, { contains: string; mode: 'insensitive' }>>;
}

// ============================================
// Response Types
// ============================================

/**
 * Paginated season list response
 */
export interface SeasonListResponse {
  seasons: SeasonMaster[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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
 * Generate seasons request (for bulk generation)
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
  created: number;
  skipped: number;
  seasons: SeasonMaster[];
}
