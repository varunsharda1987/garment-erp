import api from '../lib/api';
import type {
  BillOfMaterial,
  CreateBOMInput,
  UpdateBOMInput,
  BOMListFilters,
  BOMListResponse,
  MaterialRequirementsCalculation,
} from '../types/bom.types';

/**
 * Create a new Bill of Materials
 */
export const createBOM = async (data: CreateBOMInput): Promise<BillOfMaterial> => {
  const response = await api.post('/bom', data);
  return response.data.data;
};

/**
 * Get all BOMs with optional filtering
 */
export const getAllBOMs = async (filters?: BOMListFilters): Promise<BOMListResponse> => {
  const params = new URLSearchParams();

  if (filters?.styleId) params.append('styleId', filters.styleId);
  if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
  if (filters?.approved !== undefined) params.append('approved', String(filters.approved));
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const response = await api.get(`/bom?${params.toString()}`);
  return response.data;
};

/**
 * Get a single BOM by ID
 */
export const getBOMById = async (id: string): Promise<BillOfMaterial> => {
  const response = await api.get(`/bom/${id}`);
  return response.data.data;
};

/**
 * Get active BOM for a style
 */
export const getActiveBOMByStyle = async (styleId: string): Promise<BillOfMaterial> => {
  const response = await api.get(`/bom/style/${styleId}/active`);
  return response.data.data;
};

/**
 * Get all BOM versions for a style
 */
export const getBOMVersionsByStyle = async (styleId: string): Promise<BillOfMaterial[]> => {
  const response = await api.get(`/bom/style/${styleId}/versions`);
  return response.data.data;
};

/**
 * Update a BOM (only if not approved)
 */
export const updateBOM = async (id: string, data: UpdateBOMInput): Promise<BillOfMaterial> => {
  const response = await api.put(`/bom/${id}`, data);
  return response.data.data;
};

/**
 * Approve or reject a BOM
 */
export const approveBOM = async (id: string, approved: boolean): Promise<BillOfMaterial> => {
  const response = await api.patch(`/bom/${id}/approve`, { approved });
  return response.data.data;
};

/**
 * Delete (deactivate) a BOM
 */
export const deleteBOM = async (id: string): Promise<void> => {
  await api.delete(`/bom/${id}`);
};

/**
 * Calculate material requirements for an order quantity
 */
export const calculateMaterialRequirements = async (
  bomId: string,
  orderQuantity: number
): Promise<MaterialRequirementsCalculation> => {
  const response = await api.post(`/bom/${bomId}/calculate`, { orderQuantity });
  return response.data.data;
};

const bomService = {
  createBOM,
  getAllBOMs,
  getBOMById,
  getActiveBOMByStyle,
  getBOMVersionsByStyle,
  updateBOM,
  approveBOM,
  deleteBOM,
  calculateMaterialRequirements,
};

export default bomService;
