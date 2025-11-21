// Style Import Service - Frontend API calls

import api from '../lib/api';
import type { StyleImportResponse, ImportStatusResponse } from '../types/style-import.types';

// Re-export types for convenience
export type { StyleImportResponse, ImportStatusResponse } from '../types/style-import.types';

/**
 * Import styles from CSV/Excel file
 */
export async function importStyles(
  file: File,
  options?: {
    overwriteExisting?: boolean;
    skipDuplicates?: boolean;
  }
): Promise<StyleImportResponse> {
  const formData = new FormData();
  formData.append('file', file);

  if (options?.overwriteExisting) {
    formData.append('overwriteExisting', 'true');
  }
  if (options?.skipDuplicates) {
    formData.append('skipDuplicates', 'true');
  }

  const response = await api.post(`/styles/import`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Get import status
 */
export async function getImportStatus(batchId: string): Promise<ImportStatusResponse> {
  const response = await api.get(`/styles/import/${batchId}`);
  return response.data;
}

/**
 * Retry failed imports
 */
export async function retryImport(batchId: string): Promise<StyleImportResponse> {
  const response = await api.post(`/styles/import/${batchId}/retry`);
  return response.data;
}

/**
 * Download sample template
 */
export async function downloadTemplate(): Promise<Blob> {
  const response = await api.get(`/styles/import/template`, {
    responseType: 'blob',
  });
  return response.data;
}
