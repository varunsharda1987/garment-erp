import api from '../lib/api';
import type {
  ComponentGroup,
  CreateComponentGroupInput,
  UpdateComponentGroupInput,
  ComponentGroupListResponse,
  ComponentGroupResponse,
  ReorderComponentGroupsInput,
} from '../types/componentGroup.types';

const BASE_URL = '/component-groups';

export const componentGroupService = {
  /**
   * Get all component groups with pagination
   */
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<ComponentGroupListResponse> {
    const response = await api.get<ComponentGroupListResponse>(BASE_URL, { params });
    return response.data;
  },

  /**
   * Get component group by ID
   */
  async getById(id: string): Promise<ComponentGroup> {
    const response = await api.get<ComponentGroupResponse>(`${BASE_URL}/${id}`);
    return response.data.data;
  },

  /**
   * Get component group by code
   */
  async getByCode(code: string): Promise<ComponentGroup> {
    const response = await api.get<ComponentGroupResponse>(`${BASE_URL}/code/${code}`);
    return response.data.data;
  },

  /**
   * Create a new component group
   */
  async create(data: CreateComponentGroupInput): Promise<ComponentGroup> {
    const response = await api.post<ComponentGroupResponse>(BASE_URL, data);
    return response.data.data;
  },

  /**
   * Update component group
   */
  async update(id: string, data: UpdateComponentGroupInput): Promise<ComponentGroup> {
    const response = await api.put<ComponentGroupResponse>(`${BASE_URL}/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete component group (soft delete)
   */
  async delete(id: string): Promise<void> {
    await api.delete(`${BASE_URL}/${id}`);
  },

  /**
   * Reorder component groups
   */
  async reorder(data: ReorderComponentGroupsInput): Promise<void> {
    await api.post(`${BASE_URL}/reorder`, data);
  },
};

export default componentGroupService;
