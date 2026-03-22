// Material Service - API calls for material management
import api from '../lib/api';
import type {
  Material,
  MaterialCategory,
  CategoryHierarchy,
  CreateMaterialRequest,
  UpdateMaterialRequest,
  CreateCategoryRequest,
  MaterialListResponse,
  MaterialResponse,
  CategoryListResponse,
} from '../types/material.types';

/**
 * Get all materials with pagination and filters
 */
export const getAllMaterials = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  supplierId?: string;
  materialTypes?: string;
  unit?: string;
}): Promise<MaterialListResponse> => {
  const { data } = await api.get<MaterialListResponse>('/materials', {
    params,
  });
  return data;
};

/**
 * Get material by ID
 */
export const getMaterialById = async (id: string): Promise<Material> => {
  const { data } = await api.get<MaterialResponse>(`/materials/${id}`);
  return data.data;
};

/**
 * Create new material
 */
export const createMaterial = async (materialData: CreateMaterialRequest): Promise<Material> => {
  const { data } = await api.post<MaterialResponse>('/materials', materialData);
  return data.data;
};

/**
 * Update material
 */
export const updateMaterial = async (id: string, materialData: UpdateMaterialRequest): Promise<Material> => {
  const { data } = await api.put<MaterialResponse>(`/materials/${id}`, materialData);
  return data.data;
};

/**
 * Delete material (soft delete)
 */
export const deleteMaterial = async (id: string): Promise<void> => {
  await api.delete(`/materials/${id}`);
};

/**
 * Get all material categories
 */
export const getAllCategories = async (parentId?: string): Promise<MaterialCategory[]> => {
  const { data } = await api.get<CategoryListResponse>('/materials/categories', {
    params: parentId ? { parentId } : undefined,
  });
  return data.data;
};

/**
 * Get category hierarchy (parents with children)
 */
export const getCategoryHierarchy = async (): Promise<CategoryHierarchy[]> => {
  const { data } = await api.get<{ data: CategoryHierarchy[] }>('/materials/categories/hierarchy');
  return data.data;
};

/**
 * Get parent categories only
 */
export const getParentCategories = async (): Promise<MaterialCategory[]> => {
  const categories = await getAllCategories();
  return categories.filter((cat) => cat.level === 1);
};

/**
 * Get child categories by parent ID
 */
export const getChildCategories = async (parentId: string): Promise<MaterialCategory[]> => {
  return getAllCategories(parentId);
};

/**
 * Create material category
 */
export const createCategory = async (categoryData: CreateCategoryRequest): Promise<MaterialCategory> => {
  const { data } = await api.post<{ data: MaterialCategory }>('/materials/categories', categoryData);
  return data.data;
};
