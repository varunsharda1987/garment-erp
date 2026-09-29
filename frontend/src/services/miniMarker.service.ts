/**
 * Mini Marker Service
 * API service for CAD mini marker file attachments
 */
import api from '@/lib/api';
import type {
  MiniMarkerFile,
  MiniMarkersResponse,
  CadPurpose,
  CadRowMarker,
  MarkerDifference,
  MarkerImageResult,
  MarkerReading,
} from '@/types/cadFile.types';

/** Reading a marker takes 5–10 s on the server, longer when another is queued ahead */
const MARKER_READ_TIMEOUT = 120_000;

/** A save or approve refused by the marker rule — 409 CAD_MARKER_MISMATCH / 422 CAD_MARKER_IMAGE_REQUIRED */
export interface MarkerRefusal {
  code: 'CAD_MARKER_MISMATCH' | 'CAD_MARKER_IMAGE_REQUIRED';
  message: string;
  differences: MarkerDifference[];
}

export function markerRefusalFromError(error: unknown): MarkerRefusal | null {
  const res = (error as { response?: { data?: any } })?.response;
  const details = res?.data?.details ?? res?.data?.error?.details;
  const code = details?.code;
  if (code !== 'CAD_MARKER_MISMATCH' && code !== 'CAD_MARKER_IMAGE_REQUIRED') return null;
  return {
    code,
    message: res?.data?.message ?? 'The CAD image does not allow this',
    differences: Array.isArray(details.differences) ? details.differences : [],
  };
}

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

  /** Every CAD row of the style with its marker image state */
  getRowMarkers: async (styleId: string): Promise<CadRowMarker[]> => {
    const response = await api.get(`/cad-planning/${styleId}/row-markers`);
    return response.data.data;
  },

  /** Upload a CAD row's marker image — the server reads it before answering */
  attachToRow: async (styleId: string, rowId: string, file: File): Promise<MarkerImageResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/cad-planning/${styleId}/row/${rowId}/marker`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: MARKER_READ_TIMEOUT,
    });
    return response.data.data;
  },

  /** Use an image already uploaded for the style as the row's marker */
  linkToRow: async (styleId: string, rowId: string, fileId: string): Promise<MarkerImageResult> => {
    const response = await api.post(
      `/cad-planning/${styleId}/row/${rowId}/marker/link`,
      { fileId },
      { timeout: MARKER_READ_TIMEOUT }
    );
    return response.data.data;
  },

  /** Upload + read the corrected marker's image for Correct CAD (the row's image once the correction applies) */
  uploadForCorrection: async (
    styleId: string,
    rowId: string,
    file: File
  ): Promise<{ file: MiniMarkerFile; reading: MarkerReading }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/cad-planning/${styleId}/row/${rowId}/correction/marker`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: MARKER_READ_TIMEOUT,
    });
    return response.data.data;
  },

  /** Correct CAD with an image already uploaded for the style (read if it never was) */
  linkForCorrection: async (
    styleId: string,
    rowId: string,
    fileId: string
  ): Promise<{ file: MiniMarkerFile; reading: MarkerReading }> => {
    const response = await api.post(
      `/cad-planning/${styleId}/row/${rowId}/correction/marker/link`,
      { fileId },
      { timeout: MARKER_READ_TIMEOUT }
    );
    return response.data.data;
  },

  /** Read the row's marker image again */
  reread: async (styleId: string, rowId: string): Promise<MarkerImageResult> => {
    const response = await api.post(`/cad-planning/${styleId}/row/${rowId}/marker/reread`, undefined, {
      timeout: MARKER_READ_TIMEOUT,
    });
    return response.data.data;
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
