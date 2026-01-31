/**
 * Season Service - API calls for season master operations
 */
import api from '../lib/api';
import type {
  SeasonMaster,
  SeasonListResponse,
  SeasonResponse,
  SeasonSearchResult,
  SeasonSearchResponse,
  SeasonTypesResponse,
  SeasonQueryParams,
  SeasonSearchParams,
  CreateSeasonRequest,
  UpdateSeasonRequest,
  GenerateSeasonsRequest,
  GenerateSeasonsResponse,
} from '../types/season.types';

const BASE_URL = '/seasons';

/**
 * Get all seasons with pagination and filters
 */
export const getAllSeasons = async (params?: SeasonQueryParams): Promise<SeasonListResponse> => {
  const { data } = await api.get<SeasonListResponse>(BASE_URL, { params });
  return data;
};

/**
 * Get season by ID
 */
export const getSeasonById = async (id: string): Promise<SeasonMaster> => {
  const { data } = await api.get<SeasonResponse>(`${BASE_URL}/${id}`);
  return data.data;
};

/**
 * Search seasons (for dropdowns - minimal data)
 */
export const searchSeasons = async (params?: SeasonSearchParams): Promise<SeasonSearchResult[]> => {
  const { data } = await api.get<SeasonSearchResponse>(`${BASE_URL}/search`, { params });
  return data.data;
};

/**
 * Get season types (fixed list)
 */
export const getSeasonTypes = async (): Promise<SeasonTypesResponse> => {
  const { data } = await api.get<SeasonTypesResponse>(`${BASE_URL}/types`);
  return data;
};

/**
 * Create a new season
 */
export const createSeason = async (request: CreateSeasonRequest): Promise<SeasonMaster> => {
  const { data } = await api.post<SeasonResponse>(BASE_URL, request);
  return data.data;
};

/**
 * Update a season
 */
export const updateSeason = async (id: string, request: UpdateSeasonRequest): Promise<SeasonMaster> => {
  const { data } = await api.put<SeasonResponse>(`${BASE_URL}/${id}`, request);
  return data.data;
};

/**
 * Delete a season (soft delete)
 */
export const deleteSeason = async (id: string): Promise<void> => {
  await api.delete(`${BASE_URL}/${id}`);
};

/**
 * Generate seasons for a year range
 */
export const generateSeasons = async (request: GenerateSeasonsRequest): Promise<GenerateSeasonsResponse> => {
  const { data } = await api.post<GenerateSeasonsResponse>(`${BASE_URL}/generate`, request);
  return data;
};

/**
 * Season service object (for compatibility with some components)
 */
export const seasonService = {
  getAll: getAllSeasons,
  getById: getSeasonById,
  search: searchSeasons,
  getTypes: getSeasonTypes,
  create: createSeason,
  update: updateSeason,
  delete: deleteSeason,
  generate: generateSeasons,
};

export default seasonService;
