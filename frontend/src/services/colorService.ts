/**
 * Color Master Service
 * Frontend API service for color master operations
 */

import api from '../lib/api';
import { logDebug } from '../lib/logger';
import type {
  ColorMaster,
  ColorSearchResult,
  ColorListParams,
  ColorSearchParams,
  ColorListResponse,
  ColorResponse,
  ColorSearchResponse,
  ColorFamiliesResponse,
  CreateColorRequest,
  UpdateColorRequest,
  ColorImportRow,
  ColorBulkImportResponse,
  ColorImportTemplateResponse,
} from '../types/color.types';

const API_PREFIX = '/colors';

/**
 * Color Service
 */
export const colorService = {
  /**
   * Get all colors with pagination and filters
   */
  async getAll(params?: ColorListParams): Promise<ColorListResponse> {
    logDebug('Fetching colors', { params });
    const response = await api.get<ColorListResponse>(API_PREFIX, { params });
    return response.data;
  },

  /**
   * Get single color by ID
   */
  async getById(id: string): Promise<ColorMaster> {
    const response = await api.get<ColorResponse>(`${API_PREFIX}/${id}`);
    return response.data.data;
  },

  /**
   * Create new color
   */
  async create(data: CreateColorRequest): Promise<ColorMaster> {
    logDebug('Creating color', { data });
    const response = await api.post<ColorResponse>(API_PREFIX, data);
    return response.data.data;
  },

  /**
   * Update color
   */
  async update(id: string, data: UpdateColorRequest): Promise<ColorMaster> {
    logDebug('Updating color', { id, data });
    const response = await api.put<ColorResponse>(`${API_PREFIX}/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete color (soft delete)
   */
  async delete(id: string): Promise<void> {
    logDebug('Deleting color', { id });
    await api.delete(`${API_PREFIX}/${id}`);
  },

  /**
   * Search colors (for dropdowns - minimal data)
   */
  async search(params?: ColorSearchParams): Promise<ColorSearchResult[]> {
    const response = await api.get<ColorSearchResponse>(`${API_PREFIX}/search`, { params });
    return response.data.data;
  },

  /**
   * Get color families (fixed list)
   */
  async getFamilies(): Promise<string[]> {
    const response = await api.get<ColorFamiliesResponse>(`${API_PREFIX}/families`);
    return response.data.data;
  },

  /**
   * Bulk import colors
   */
  async bulkImport(colors: ColorImportRow[]): Promise<ColorBulkImportResponse['data']> {
    logDebug('Bulk importing colors', { count: colors.length });
    const response = await api.post<ColorBulkImportResponse>(`${API_PREFIX}/bulk-import`, { colors });
    return response.data.data;
  },

  /**
   * Get import template
   */
  async getImportTemplate(): Promise<ColorImportTemplateResponse['data']> {
    const response = await api.get<ColorImportTemplateResponse>(`${API_PREFIX}/template`);
    return response.data.data;
  },
};

export default colorService;
