// Style Material BOM Service - Phase 2
import api from '../lib/api';
import type {
  MaterialType,
  MaterialSearchResponse,
  MaterialByCodeResponse,
  StyleBOMResponse,
  AddMaterialToBOMRequest,
  AddMaterialToBOMResponse,
  UpdateBOMItemRequest,
  UpdateBOMItemResponse,
  DeleteBOMItemResponse
} from '../types/style-material-bom.types';

/**
 * Search materials by type and query
 */
export const searchMaterials = async (
  type: MaterialType,
  query?: string,
  limit: number = 20
): Promise<MaterialSearchResponse> => {
  const params = new URLSearchParams({
    type,
    ...(query && { query }),
    limit: limit.toString()
  });

  const response = await api.get<MaterialSearchResponse>(
    `/styles/materials/search?${params.toString()}`
  );
  return response.data;
};

/**
 * Get material details by code
 */
export const getMaterialByCode = async (
  materialCode: string
): Promise<MaterialByCodeResponse> => {
  const response = await api.get<MaterialByCodeResponse>(
    `/styles/materials/by-code/${materialCode}`
  );
  return response.data;
};

/**
 * Get complete BOM for a style
 */
export const getStyleBOM = async (
  styleId: string
): Promise<StyleBOMResponse> => {
  const response = await api.get<StyleBOMResponse>(
    `/styles/${styleId}/bom`
  );
  return response.data;
};

/**
 * Add material to style BOM
 */
export const addMaterialToBOM = async (
  styleId: string,
  data: AddMaterialToBOMRequest
): Promise<AddMaterialToBOMResponse> => {
  const response = await api.post<AddMaterialToBOMResponse>(
    `/styles/${styleId}/materials`,
    data
  );
  return response.data;
};

/**
 * Update BOM item
 */
export const updateBOMItem = async (
  styleId: string,
  bomId: string,
  data: UpdateBOMItemRequest
): Promise<UpdateBOMItemResponse> => {
  const response = await api.put<UpdateBOMItemResponse>(
    `/styles/${styleId}/materials/${bomId}`,
    data
  );
  return response.data;
};

/**
 * Delete BOM item (soft delete)
 */
export const deleteBOMItem = async (
  styleId: string,
  bomId: string
): Promise<DeleteBOMItemResponse> => {
  const response = await api.delete<DeleteBOMItemResponse>(
    `/styles/${styleId}/materials/${bomId}`
  );
  return response.data;
};

/**
 * Calculate total cost for a material entry
 */
export const calculateMaterialCost = (
  quantity: number,
  unitPrice: number
): number => {
  return quantity * unitPrice;
};

/**
 * Format price with currency
 */
export const formatPrice = (price: string | number): string => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return '₹0.00';
  return `₹${numPrice.toFixed(2)}`;
};

/**
 * Parse price from string (handles Prisma Decimal)
 */
export const parsePrice = (price?: string | null): number => {
  if (!price) return 0;
  const parsed = parseFloat(price);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Get material type from code prefix
 */
export const getMaterialTypeFromCode = (code: string): MaterialType | null => {
  if (code.startsWith('LACE-')) return 'LACE';
  if (code.startsWith('BTN-')) return 'BUTTON';
  if (code.startsWith('THR-')) return 'THREAD';
  if (code.startsWith('ZIP-')) return 'ZIPPER';
  if (code.startsWith('ELA-')) return 'ELASTIC';
  if (code.startsWith('LBL-')) return 'LABEL';
  if (code.startsWith('PKG-')) return 'PACKAGING';
  return null;
};

/**
 * Validate material code format
 */
export const isValidMaterialCode = (code: string): boolean => {
  const pattern = /^(LACE|BTN|THR|ZIP|ELA|LBL|PKG)-\d{4}$/;
  return pattern.test(code);
};
