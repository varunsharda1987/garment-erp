/**
 * Line Sheet Service
 * API service for generating line sheets (PDF and Excel)
 */

import api from '../lib/api';

export interface LineSheetOptions {
  styleIds: string[];
  showWholesalePrice?: boolean;
  showRetailPrice?: boolean;
  buyerCompany?: string;
  buyerContact?: string;
  buyerEmail?: string;
  title?: string;
}

export const lineSheetService = {
  /**
   * Generate Line Sheet PDF
   */
  generatePDF: async (options: LineSheetOptions): Promise<Blob> => {
    const response = await api.post('/documents/line-sheet/pdf', options, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Generate Line Sheet Excel
   */
  generateExcel: async (options: LineSheetOptions): Promise<Blob> => {
    const response = await api.post('/documents/line-sheet/excel', options, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Download Line Sheet PDF
   */
  downloadPDF: async (options: LineSheetOptions, filename?: string): Promise<void> => {
    const blob = await lineSheetService.generatePDF(options);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `LineSheet_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Download Line Sheet Excel
   */
  downloadExcel: async (options: LineSheetOptions, filename?: string): Promise<void> => {
    const blob = await lineSheetService.generateExcel(options);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `LineSheet_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export default lineSheetService;
