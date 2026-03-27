/**
 * Tech Specs Service
 * API service for style technical specifications
 */

import axios from 'axios';
import api from '../lib/api';
import type {
  TechSpecs,
  TechSpecsResponse,
  TechSpecsOptionsResponse,
  CreateUpdateTechSpecsDTO,
} from '../types/techSpecs.types';

export const techSpecsService = {
  /**
   * Get tech specs for a style
   */
  getByStyleId: async (styleId: string): Promise<TechSpecs | null> => {
    try {
      const response = await api.get<TechSpecsResponse>(`/styles/${styleId}/tech-specs`);
      return response.data.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Create or update tech specs for a style
   */
  save: async (styleId: string, data: CreateUpdateTechSpecsDTO): Promise<TechSpecs> => {
    const response = await api.post<TechSpecsResponse>(`/styles/${styleId}/tech-specs`, data);
    return response.data.data;
  },

  /**
   * Get dropdown options for tech specs
   */
  getOptions: async (): Promise<TechSpecsOptionsResponse['data']> => {
    const response = await api.get<TechSpecsOptionsResponse>('/styles/tech-specs/options');
    return response.data.data;
  },

  /**
   * Generate Tech Pack PDF
   */
  generateTechPackPDF: async (styleId: string): Promise<Blob> => {
    const response = await api.get(`/documents/styles/${styleId}/tech-pack-pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Download Tech Pack PDF
   */
  downloadTechPackPDF: async (styleId: string, styleCode: string): Promise<void> => {
    const blob = await techSpecsService.generateTechPackPDF(styleId);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TechPack_${styleCode}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export default techSpecsService;
