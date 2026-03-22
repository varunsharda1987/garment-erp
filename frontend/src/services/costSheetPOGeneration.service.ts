/**
 * Cost Sheet PO Generation Service
 * API client for generating Purchase Orders from approved Cost Sheets
 */

import api from '../lib/api';
import type {
  CalculateRequirementsResponse,
  GeneratePOResponse,
  GenerationStatusResponse,
  GenerateFabricPORequest,
  GenerateGreigePORequest,
  GenerateProcessingPORequest,
  GenerateTrimsPORequest,
} from '../types/costSheetPOGeneration.types';

const BASE_URL = '/cost-sheet-po';

/**
 * Calculate material requirements from cost sheet
 */
export async function calculateRequirements(
  costSheetId: string,
  totalOrderQty: number
): Promise<CalculateRequirementsResponse> {
  const response = await api.get(`${BASE_URL}/calculate`, {
    params: { costSheetId, totalOrderQty },
  });
  return response.data;
}

/**
 * Generate Fabric PO
 */
export async function generateFabricPO(request: GenerateFabricPORequest): Promise<GeneratePOResponse> {
  const response = await api.post(`${BASE_URL}/generate/fabric`, request);
  return response.data;
}

/**
 * Generate Greige PO
 */
export async function generateGreigePO(request: GenerateGreigePORequest): Promise<GeneratePOResponse> {
  const response = await api.post(`${BASE_URL}/generate/greige`, request);
  return response.data;
}

/**
 * Generate Processing PO
 */
export async function generateProcessingPO(request: GenerateProcessingPORequest): Promise<GeneratePOResponse> {
  const response = await api.post(`${BASE_URL}/generate/processing`, request);
  return response.data;
}

/**
 * Generate Trims PO
 */
export async function generateTrimsPO(request: GenerateTrimsPORequest): Promise<GeneratePOResponse> {
  const response = await api.post(`${BASE_URL}/generate/trims`, request);
  return response.data;
}

/**
 * Get PO generation status for a cost sheet
 */
export async function getGenerationStatus(costSheetId: string): Promise<GenerationStatusResponse> {
  const response = await api.get(`${BASE_URL}/status/${costSheetId}`);
  return response.data;
}

/**
 * Get PO generation history for a cost sheet
 */
export async function getGenerationHistory(costSheetId: string): Promise<GenerationStatusResponse> {
  const response = await api.get(`${BASE_URL}/history/${costSheetId}`);
  return response.data;
}
