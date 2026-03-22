import api from '../lib/api';
import type {
  StockProductionOrder,
  CreateSPORequest,
  UpdateSPORequest,
  SPOQueryParams,
  PaginatedSPOs,
} from '@/types/stockProductionOrder.types';

const BASE_URL = '/stock-production-orders';

export async function getAllSPOs(params: SPOQueryParams = {}): Promise<PaginatedSPOs> {
  const response = await api.get(BASE_URL, { params });
  return response.data;
}

export async function getSPOById(id: string): Promise<StockProductionOrder> {
  const response = await api.get(`${BASE_URL}/${id}`);
  return response.data;
}

export async function searchSPOs(params: { search?: string; limit?: number }): Promise<StockProductionOrder[]> {
  const response = await api.get(`${BASE_URL}/search`, { params });
  return response.data;
}

export async function createSPO(data: CreateSPORequest): Promise<StockProductionOrder> {
  const response = await api.post(BASE_URL, data);
  return response.data;
}

export async function updateSPO(id: string, data: UpdateSPORequest): Promise<StockProductionOrder> {
  const response = await api.put(`${BASE_URL}/${id}`, data);
  return response.data;
}

export async function deleteSPO(id: string): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`);
}

export async function approveSPO(id: string): Promise<StockProductionOrder> {
  const response = await api.post(`${BASE_URL}/${id}/approve`);
  return response.data;
}

export async function generateWorkOrders(id: string): Promise<any> {
  const response = await api.post(`${BASE_URL}/${id}/generate-work-orders`);
  return response.data;
}
