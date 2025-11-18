// Import Service - API client for data import
import api from '../lib/api';
import type { ImportResult, ImportFormat } from '../types/import.types';

class ImportService {
  /**
   * Preview import data (first 100 rows with validation)
   */
  async previewImport(module: string, file: File): Promise<ImportResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post<{ success: boolean; preview: ImportResult }>(
        `/import/${module}/preview`,
        formData
      );

      return response.data.preview;
    } catch (error: any) {
      console.error('Import preview error:', error);
      throw new Error(
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Failed to preview import'
      );
    }
  }

  /**
   * Execute import after validation
   */
  async executeImport(module: string, file: File): Promise<ImportResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post<{
        success: boolean;
        message: string;
        summary: {
          totalRows: number;
          validRows: number;
          invalidRows: number;
          importedRows: number;
        };
      }>(
        `/import/${module}/execute`,
        formData
      );

      // Transform backend response to ImportResult format
      return {
        success: response.data.success,
        totalRows: response.data.summary.totalRows,
        validRows: response.data.summary.validRows,
        invalidRows: response.data.summary.invalidRows,
        errors: [],
      };
    } catch (error: any) {
      console.error('Import execute error:', error);
      throw new Error(
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Failed to execute import'
      );
    }
  }

  /**
   * Download import template for a module
   */
  async downloadTemplate(module: string, format: ImportFormat = 'excel'): Promise<void> {
    try {
      const response = await api.get(
        `/import/${module}/template`,
        {
          params: { format },
          responseType: 'blob',
        }
      );

      // Extract filename or generate one
      const contentDisposition = response.headers['content-disposition'];
      const extension = format === 'csv' ? 'csv' : 'xlsx';
      let filename = `${module}_import_template.${extension}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = new Blob([response.data], {
        type: response.headers['content-type'],
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error: any) {
      console.error('Download template error:', error);
      throw new Error(
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Failed to download template'
      );
    }
  }
}

export default new ImportService();
