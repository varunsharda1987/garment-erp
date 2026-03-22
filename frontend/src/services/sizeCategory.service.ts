import api from '@/lib/api';
import type {
  SizeCategory,
  SizeCategoryListResponse,
  CreateSizeCategoryRequest,
  UpdateSizeCategoryRequest,
} from '@/types/sizeCategory.types';

interface GetAllSizeCategoriesParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export const getAllSizeCategories = async (
  params: GetAllSizeCategoriesParams = {}
): Promise<SizeCategoryListResponse> => {
  const response = await api.get('/size-categories', { params });
  return response.data;
};

export const getSizeCategoryById = async (id: string): Promise<SizeCategory> => {
  const response = await api.get(`/size-categories/${id}`);
  return response.data;
};

export const createSizeCategory = async (data: CreateSizeCategoryRequest): Promise<SizeCategory> => {
  const response = await api.post('/size-categories', data);
  return response.data;
};

export const updateSizeCategory = async (id: string, data: UpdateSizeCategoryRequest): Promise<SizeCategory> => {
  const response = await api.put(`/size-categories/${id}`, data);
  return response.data;
};

export const deleteSizeCategory = async (id: string): Promise<void> => {
  await api.delete(`/size-categories/${id}`);
};
