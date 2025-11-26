// Component Master Service - API calls for component master management
import api from '../lib/api';
import type {
  ComponentMaster,
  ComponentMasterFormData,
  ComponentMasterListResponse,
  ComponentMasterResponse,
  CategoriesResponse,
} from '../types/componentMaster.types';

/**
 * Get all component masters with pagination and filters
 */
export const getAllComponentMasters = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  componentCategory?: string;
  activeOnly?: boolean;
}): Promise<ComponentMasterListResponse> => {
  const { data } = await api.get<ComponentMasterListResponse>('/component-masters', {
    params,
  });
  return data;
};

/**
 * Get component master by ID
 */
export const getComponentMasterById = async (id: string): Promise<ComponentMaster> => {
  const { data } = await api.get<ComponentMasterResponse>(`/component-masters/${id}`);
  return data.data;
};

/**
 * Create new component master
 */
export const createComponentMaster = async (
  componentData: ComponentMasterFormData
): Promise<ComponentMaster> => {
  const { data } = await api.post<ComponentMasterResponse>('/component-masters', componentData);
  return data.data;
};

/**
 * Update component master
 */
export const updateComponentMaster = async (
  id: string,
  componentData: ComponentMasterFormData
): Promise<ComponentMaster> => {
  const { data } = await api.put<ComponentMasterResponse>(
    `/component-masters/${id}`,
    componentData
  );
  return data.data;
};

/**
 * Delete component master (soft delete)
 */
export const deleteComponentMaster = async (id: string): Promise<void> => {
  await api.delete(`/component-masters/${id}`);
};

/**
 * Get all categories
 */
export const getCategories = async (): Promise<string[]> => {
  const { data } = await api.get<CategoriesResponse>('/component-masters/categories');
  return data.data;
};
