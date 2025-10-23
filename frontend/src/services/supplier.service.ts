// Supplier Service - API calls for supplier management
import apiClient from '../lib/api';
import type {
  Supplier,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  SupplierListResponse,
  SupplierResponse,
} from '../types/supplier.types';

/**
 * Get all suppliers with pagination and filters
 */
export const getAllSuppliers = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  rating?: number;
}): Promise<SupplierListResponse> => {
  const { data } = await apiClient.get<SupplierListResponse>('/suppliers', {
    params,
  });
  return data;
};

/**
 * Get supplier by ID
 */
export const getSupplierById = async (id: string): Promise<Supplier> => {
  const { data } = await apiClient.get<SupplierResponse>(`/suppliers/${id}`);
  return data.data;
};

/**
 * Create new supplier
 */
export const createSupplier = async (
  supplierData: CreateSupplierRequest
): Promise<Supplier> => {
  const { data } = await apiClient.post<SupplierResponse>('/suppliers', supplierData);
  return data.data;
};

/**
 * Update supplier
 */
export const updateSupplier = async (
  id: string,
  supplierData: UpdateSupplierRequest
): Promise<Supplier> => {
  const { data } = await apiClient.put<SupplierResponse>(`/suppliers/${id}`, supplierData);
  return data.data;
};

/**
 * Delete supplier (soft delete)
 */
export const deleteSupplier = async (id: string): Promise<void> => {
  await apiClient.delete(`/suppliers/${id}`);
};
