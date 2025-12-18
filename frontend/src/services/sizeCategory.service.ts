import axios from 'axios';
import type {
  SizeCategory,
  SizeCategoryListResponse,
  CreateSizeCategoryRequest,
  UpdateSizeCategoryRequest,
} from '@/types/sizeCategory.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface GetAllSizeCategoriesParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export const getAllSizeCategories = async (
  params: GetAllSizeCategoriesParams = {}
): Promise<SizeCategoryListResponse> => {
  const response = await axios.get(`${API_URL}/api/size-categories`, { params });
  return response.data;
};

export const getSizeCategoryById = async (id: string): Promise<SizeCategory> => {
  const response = await axios.get(`${API_URL}/api/size-categories/${id}`);
  return response.data;
};

export const createSizeCategory = async (
  data: CreateSizeCategoryRequest
): Promise<SizeCategory> => {
  const response = await axios.post(`${API_URL}/api/size-categories`, data);
  return response.data;
};

export const updateSizeCategory = async (
  id: string,
  data: UpdateSizeCategoryRequest
): Promise<SizeCategory> => {
  const response = await axios.put(`${API_URL}/api/size-categories/${id}`, data);
  return response.data;
};

export const deleteSizeCategory = async (id: string): Promise<void> => {
  await axios.delete(`${API_URL}/api/size-categories/${id}`);
};
