// Import Service - API client for data import
import api from '../lib/api';
import { logApiError } from '../lib/logger';
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
    } catch (error: unknown) {
      logApiError('Import preview error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
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
    } catch (error: unknown) {
      logApiError('Import execute error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
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
        // Try to match filename with quotes first, then without
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          // Remove quotes if present
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Create blob and download
      // Use explicit MIME type based on format to ensure correct file type
      const mimeType = format === 'csv'
        ? 'text/csv;charset=utf-8;'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const blob = new Blob([response.data], {
        type: mimeType,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error: unknown) {
      logApiError('Download template error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        'Failed to download template'
      );
    }
  }
}

export default new ImportService();
