// Lace Service - API calls for lace management
import api from '../lib/api';
import type {
  Lace,
  LaceFormData,
  LaceListResponse,
  LaceCostingOptionsResponse,
  CreateDyedLaceVariantRequest,
  CreateDyedLaceVariantResponse,
  LaceResponse,
  BulkImportResponse,
  BulkImportRow,
  TemplateResponse,
} from '../types/lace.types';

/**
 * Get all lace items with pagination and filters
 */
export const getAllLace = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  styleCode?: string;
  isGreige?: string; // 'true' or 'false' - filter by greige status
}): Promise<LaceListResponse> => {
  const { data } = await api.get<LaceListResponse>('/materials/lace', {
    params,
  });
  return data;
};

/**
 * Get lace by ID
 */
export const getLaceById = async (id: string): Promise<Lace> => {
  const { data } = await api.get<Lace>(`/materials/lace/${id}`);
  return data;
};

/**
 * Build FormData or JSON payload for lace create/update
 */
const buildLacePayload = (laceData: LaceFormData): FormData | Record<string, unknown> => {
  const hasImage = laceData.imageFile instanceof File;

  // Build the base payload
  const payload: Record<string, unknown> = {
    laceName: laceData.laceName,
    supplierCode: laceData.supplierCode,
    buyerCode: laceData.buyerCode,
    width: laceData.width ? Number(laceData.width) : undefined,
    design: laceData.design,
    color: laceData.color,
    composition: laceData.composition,
    laceType: laceData.laceType,
    description: laceData.description,
    pricePerMeter: laceData.pricePerMeter ? Number(laceData.pricePerMeter) : undefined,
    styleCodes: laceData.styleCodes || [],
    suppliers:
      laceData.suppliers?.map((s) => ({
        supplierId: s.supplierId,
        isPreferred: s.isPreferred,
        isActive: s.isActive,
        notes: s.notes,
        pricePerMeter: s.pricePerMeter ? Number(s.pricePerMeter) : undefined,
      })) || [],
    isGreige: laceData.isGreige || false,
    expectedShrinkagePercent: laceData.expectedShrinkagePercent ? Number(laceData.expectedShrinkagePercent) : undefined,
    costPerMeterGreige: laceData.costPerMeterGreige ? Number(laceData.costPerMeterGreige) : undefined,
    sourceGreigeLaceId: laceData.sourceGreigeLaceId || undefined,
  };

  if (!hasImage) {
    return payload;
  }

  // Build FormData for multipart upload
  const formData = new FormData();
  formData.append('image', laceData.imageFile as File);

  // Append other fields - arrays/objects as JSON strings
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value) || typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  });

  return formData;
};

/**
 * Create new lace
 */
export const createLace = async (laceData: LaceFormData): Promise<Lace> => {
  const payload = buildLacePayload(laceData);
  const isFormData = payload instanceof FormData;

  const { data } = await api.post<LaceResponse>('/materials/lace', payload, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
  });
  return data.lace;
};

/**
 * Update lace
 */
export const updateLace = async (id: string, laceData: LaceFormData): Promise<Lace> => {
  const payload = buildLacePayload(laceData);
  const isFormData = payload instanceof FormData;

  const { data } = await api.put<LaceResponse>(`/materials/lace/${id}`, payload, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
  });
  return data.lace;
};

/**
 * Create (or reuse) the dyed variant of a greige lace.
 *
 * The finished variant is the dyed lace's stock identity, so this is what lets one greige be
 * used as-is in one style and dyed in another. Deduped server-side on (greige, colour).
 */
export const createDyedLaceVariant = async (
  payload: CreateDyedLaceVariantRequest
): Promise<CreateDyedLaceVariantResponse> => {
  const { data } = await api.post<CreateDyedLaceVariantResponse>('/materials/lace/dyed-variant', payload);
  return data;
};

/**
 * Delete image from lace (without deleting the lace itself)
 */
export const deleteLaceImage = async (id: string): Promise<void> => {
  await api.delete(`/materials/lace/${id}/image`);
};

/**
 * Delete lace (hard delete with validation)
 */
export const deleteLace = async (id: string): Promise<void> => {
  await api.delete(`/materials/lace/${id}`);
};

/**
 * Bulk import lace items from Excel data
 */
export const bulkImportLace = async (data: BulkImportRow[], createStock?: boolean): Promise<BulkImportResponse> => {
  const { data: response } = await api.post<BulkImportResponse>('/materials/lace/bulk-import', { data, createStock });
  return response;
};

/**
 * Download template for bulk import
 */
export const downloadTemplate = async (): Promise<TemplateResponse> => {
  const { data } = await api.get<TemplateResponse>('/materials/lace/template');
  return data;
};

/**
 * Get greige (raw) lace items only - for dyeing/processing selection
 */
export const getGreigeLace = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<LaceListResponse> => {
  const { data } = await api.get<LaceListResponse>('/materials/lace/greige', {
    params,
  });
  return data;
};

/**
 * Get finished (ready-to-use) lace items only
 */
export const getFinishedLace = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  color?: string;
}): Promise<LaceListResponse> => {
  const { data } = await api.get<LaceListResponse>('/materials/lace/finished', {
    params,
  });
  return data;
};

/**
 * Get lace items for cost sheet selection.
 *
 * Includes GREIGE laces as well as finished ones, so a greige can be costed as-is (undyed)
 * or picked as the base for a dyed variant. Not paginated — returns { data, total }.
 */
export const getLaceForCosting = async (params?: { search?: string }): Promise<LaceCostingOptionsResponse> => {
  const { data } = await api.get<LaceCostingOptionsResponse>('/materials/lace/for-costing', {
    params,
  });
  return data;
};

// ============================================
// LACE COSTING CALCULATION
// ============================================

import type {
  LaceCostingRequest,
  LaceCostCalculationResult,
  BatchLaceCostingRequest,
  BatchLaceCostingResult,
} from '../types/laceCosting.types';

/**
 * Calculate lace cost with all sourcing options
 * Returns comparison of Stock Reuse, Ready Lace, and Greige + Processing
 */
export const calculateLaceCost = async (request: LaceCostingRequest): Promise<LaceCostCalculationResult> => {
  const { data } = await api.post<{ success: boolean; data: LaceCostCalculationResult }>(
    '/lace-costing/calculate',
    request
  );
  return data.data;
};

/**
 * Calculate costs for multiple lace items (batch)
 */
export const calculateBatchLaceCost = async (request: BatchLaceCostingRequest): Promise<BatchLaceCostingResult> => {
  const { data } = await api.post<{ success: boolean; data: BatchLaceCostingResult }>(
    '/lace-costing/batch-calculate',
    request
  );
  return data.data;
};
