/**
 * Mini Marker Service
 * API service for CAD mini marker file attachments
 */
import api from '@/lib/api';
import type { MiniMarkerFile, MiniMarkersResponse, CadPurpose } from '@/types/cadFile.types';

export const miniMarkerService = {
  /**
   * Get all mini markers for a style (grouped by purpose)
   */
  getAll: async (styleId: string): Promise<MiniMarkersResponse> => {
    const response = await api.get(`/cad-planning/${styleId}/mini-markers`);
    return response.data.data;
  },

  /**
   * Get mini marker count for a style (for list page badge)
   */
  getCount: async (styleId: string): Promise<number> => {
    const response = await api.get(`/cad-planning/${styleId}/mini-marker-count`);
    return response.data.data.count;
  },

  /**
   * Upload a mini marker file
   */
  upload: async (styleId: string, file: File, purpose: CadPurpose): Promise<MiniMarkerFile> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);

    const response = await api.post(`/cad-planning/${styleId}/mini-markers`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  /**
   * Delete a mini marker file
   */
  delete: async (styleId: string, fileId: string): Promise<void> => {
    await api.delete(`/cad-planning/${styleId}/mini-markers/${fileId}`);
  },

  /**
   * Reorder mini markers within a purpose
   */
  reorder: async (styleId: string, purpose: CadPurpose, fileIds: string[]): Promise<MiniMarkerFile[]> => {
    const response = await api.post(`/cad-planning/${styleId}/mini-markers/reorder`, {
      purpose,
      fileIds,
    });
    return response.data.data;
  },
};
