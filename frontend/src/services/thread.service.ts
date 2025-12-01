// Thread Service - API calls for thread management
import api from '../lib/api';
import type {
  Thread,
  ThreadFormData,
  ThreadListResponse,
  ThreadResponse,
  BulkImportResponse,
  BulkImportRow,
  TemplateResponse,
} from '../types/thread.types';

/**
 * Get all thread items with pagination and filters
 */
export const getAllThreads = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
}): Promise<ThreadListResponse> => {
  const { data } = await api.get<ThreadListResponse>('/materials/thread', {
    params,
  });
  return data;
};

/**
 * Get thread by ID
 */
export const getThreadById = async (id: string): Promise<Thread> => {
  const { data } = await api.get<Thread>(`/materials/thread/${id}`);
  return data;
};

/**
 * Create new thread
 */
export const createThread = async (threadData: ThreadFormData): Promise<Thread> => {
  // Convert string numbers to numbers
  const payload = {
    ...threadData,
    pricePerCone: threadData.pricePerCone ? Number(threadData.pricePerCone) : undefined,
  };

  const { data } = await api.post<ThreadResponse>('/materials/thread', payload);
  return data.thread;
};

/**
 * Update thread
 */
export const updateThread = async (id: string, threadData: ThreadFormData): Promise<Thread> => {
  // Convert string numbers to numbers
  const payload = {
    ...threadData,
    pricePerCone: threadData.pricePerCone ? Number(threadData.pricePerCone) : undefined,
  };

  const { data } = await api.put<ThreadResponse>(`/materials/thread/${id}`, payload);
  return data.thread;
};

/**
 * Delete thread (hard delete with validation)
 */
export const deleteThread = async (id: string): Promise<void> => {
  await api.delete(`/materials/thread/${id}`);
};

/**
 * Bulk import thread items from Excel data
 */
export const bulkImportThreads = async (
  data: BulkImportRow[],
  createStock?: boolean
): Promise<BulkImportResponse> => {
  const { data: response } = await api.post<BulkImportResponse>(
    '/materials/thread/bulk-import',
    { data, createStock }
  );
  return response;
};

/**
 * Download template for bulk import
 */
export const downloadTemplate = async (): Promise<TemplateResponse> => {
  const { data } = await api.get<TemplateResponse>('/materials/thread/template');
  return data;
};
