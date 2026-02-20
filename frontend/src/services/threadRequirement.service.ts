/**
 * Thread Requirement Service - Frontend API calls
 */

import api from '../lib/api';
import type {
  OrderThreadRequirement,
  CreateThreadRequirementDto,
  ThreadQuantityConversion,
  ThreadShortage,
  ThreadPly,
  ThreadPackagingType,
} from '../types/thread.types';

const BASE_URL = '/api';

// ==================== CRUD OPERATIONS ====================

export const createThreadRequirement = async (
  orderId: string,
  data: Omit<CreateThreadRequirementDto, 'orderId'>
): Promise<OrderThreadRequirement> => {
  const response = await api.post(
    `${BASE_URL}/orders/${orderId}/thread-requirements`,
    data
  );
  return response.data.data;
};

export const getThreadRequirements = async (
  orderId: string
): Promise<{
  requirements: OrderThreadRequirement[];
  summary: { totalLineItems: number; totalMeters: number; totalCost: number };
}> => {
  const response = await api.get(`${BASE_URL}/orders/${orderId}/thread-requirements`);
  return {
    requirements: response.data.data,
    summary: response.data.summary,
  };
};

export const updateThreadRequirement = async (
  orderId: string,
  id: string,
  data: Partial<OrderThreadRequirement>
): Promise<OrderThreadRequirement> => {
  const response = await api.put(
    `${BASE_URL}/orders/${orderId}/thread-requirements/${id}`,
    data
  );
  return response.data.data;
};

export const deleteThreadRequirement = async (orderId: string, id: string): Promise<void> => {
  await api.delete(`${BASE_URL}/orders/${orderId}/thread-requirements/${id}`);
};

// ==================== CONVERSIONS ====================

/**
 * Convert thread quantities (boxes ↔ units ↔ meters)
 * Uses proper routing: /api/materials/thread/convert
 */
export const convertThreadQuantity = async (
  ply: ThreadPly,
  packagingType: ThreadPackagingType,
  inputType: 'UNITS' | 'BOXES' | 'METERS',
  value: number
): Promise<ThreadQuantityConversion> => {
  const response = await api.post(`${BASE_URL}/materials/thread/convert`, {
    ply,
    packagingType,
    inputType,
    value,
  });
  return response.data.data;
};

// ==================== SHORTAGE DETECTION ====================

export const checkThreadShortages = async (
  orderId: string
): Promise<{
  shortages: ThreadShortage[];
  summary: { totalShortages: number; hasShortages: boolean };
}> => {
  const response = await api.post(
    `${BASE_URL}/orders/${orderId}/thread-requirements/check-shortage`
  );
  return {
    shortages: response.data.data,
    summary: response.data.summary,
  };
};

export default {
  createThreadRequirement,
  getThreadRequirements,
  updateThreadRequirement,
  deleteThreadRequirement,
  convertThreadQuantity,
  checkThreadShortages,
};
