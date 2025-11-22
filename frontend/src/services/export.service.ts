// Export Service - API client for data export
import api from '../lib/api';
import { logApiError, logDebug } from '../lib/logger';
import type { ExportRequest } from '../types/export.types';

class ExportService {
  /**
   * Export data from a module
   * Downloads file directly to browser
   */
  async exportData(module: string, options: ExportRequest): Promise<void> {
    try {
      const response = await api.post(
        `/export/${module}`,
        options,
        {
          responseType: 'blob', // Important for file download
        }
      );

      // Extract filename from Content-Disposition header or generate one
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${module}_export_${new Date().toISOString().split('T')[0]}.${options.format}`;

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
      logApiError('Export error:', error);

      // Handle blob error responses
      if (error.response?.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || 'Export failed');
        } catch {
          throw new Error('Export failed');
        }
      }

      throw error;
    }
  }

  /**
   * Export to CSV format
   */
  async exportToCSV(
    module: string,
    templateId?: string,
    filters?: Record<string, any>
  ): Promise<void> {
    return this.exportData(module, {
      format: 'csv',
      templateId,
      filters,
    });
  }

  /**
   * Export to Excel format
   */
  async exportToExcel(
    module: string,
    templateId?: string,
    filters?: Record<string, any>
  ): Promise<void> {
    return this.exportData(module, {
      format: 'excel',
      templateId,
      filters,
    });
  }

  /**
   * Export to PDF format
   */
  async exportToPDF(
    module: string,
    templateId?: string,
    filters?: Record<string, any>
  ): Promise<void> {
    return this.exportData(module, {
      format: 'pdf',
      templateId,
      filters,
    });
  }
}

export default new ExportService();
