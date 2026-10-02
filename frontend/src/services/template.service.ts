// Template Service - API client for template management
import api from '@/lib/api';
import { logApiError } from '../lib/logger';
import type {
  ExportTemplate,
  CreateTemplateDTO,
  UpdateTemplateDTO,
  ModuleInfo,
  AvailableColumn,
} from '../types/template.types';

class TemplateService {
  /**
   * Create a new export template
   */
  async createTemplate(data: CreateTemplateDTO): Promise<ExportTemplate> {
    try {
      const response = await api.post<{ success: boolean; template: ExportTemplate }>('/templates', data);
      return response.data.template;
    } catch (error: unknown) {
      logApiError('Create template error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message || axiosError.response?.data?.error || 'Failed to create template',
        { cause: error }
      );
    }
  }

  /**
   * Get all templates for a module
   */
  async getTemplatesByModule(moduleName: string): Promise<ExportTemplate[]> {
    try {
      const response = await api.get<{ success: boolean; templates: ExportTemplate[] }>('/templates', {
        params: { module: moduleName },
      });
      return response.data.templates;
    } catch (error: unknown) {
      logApiError('Get templates error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message || axiosError.response?.data?.error || 'Failed to get templates',
        { cause: error }
      );
    }
  }

  /**
   * Get a single template by ID
   */
  async getTemplateById(id: string): Promise<ExportTemplate> {
    try {
      const response = await api.get<{ success: boolean; template: ExportTemplate }>(`/templates/${id}`);
      return response.data.template;
    } catch (error: unknown) {
      logApiError('Get template error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message || axiosError.response?.data?.error || 'Failed to get template',
        { cause: error }
      );
    }
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, data: UpdateTemplateDTO): Promise<ExportTemplate> {
    try {
      const response = await api.put<{ success: boolean; template: ExportTemplate }>(`/templates/${id}`, data);
      return response.data.template;
    } catch (error: unknown) {
      logApiError('Update template error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message || axiosError.response?.data?.error || 'Failed to update template',
        { cause: error }
      );
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      await api.delete(`/templates/${id}`);
    } catch (error: unknown) {
      logApiError('Delete template error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message || axiosError.response?.data?.error || 'Failed to delete template',
        { cause: error }
      );
    }
  }

  /**
   * Get available modules
   */
  async getAvailableModules(): Promise<ModuleInfo[]> {
    try {
      const response = await api.get<{ success: boolean; modules: ModuleInfo[] }>('/templates/modules');
      return response.data.modules;
    } catch (error: unknown) {
      logApiError('Get modules error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message || axiosError.response?.data?.error || 'Failed to get modules',
        { cause: error }
      );
    }
  }

  /**
   * Get available columns for a module
   */
  async getAvailableColumns(moduleName: string): Promise<AvailableColumn[]> {
    try {
      const response = await api.get<{ success: boolean; columns: AvailableColumn[] }>(
        `/templates/columns/${moduleName}`
      );
      return response.data.columns;
    } catch (error: unknown) {
      logApiError('Get columns error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message || axiosError.response?.data?.error || 'Failed to get columns',
        { cause: error }
      );
    }
  }
}

export default new TemplateService();
