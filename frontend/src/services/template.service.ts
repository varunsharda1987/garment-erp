// Template Service - API client for template management
import axios from 'axios';
import { logApiError } from '../lib/logger';
import type {
  ExportTemplate,
  CreateTemplateDTO,
  UpdateTemplateDTO,
  ModuleInfo,
  AvailableColumn,
} from '../types/template.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class TemplateService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a new export template
   */
  async createTemplate(data: CreateTemplateDTO): Promise<ExportTemplate> {
    try {
      const response = await axios.post<{ success: boolean; template: ExportTemplate }>(
        `${API_URL}/api/templates`,
        data,
        { headers: this.getAuthHeaders() }
      );

      return response.data.template;
    } catch (error: unknown) {
      logApiError('Create template error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        'Failed to create template'
      );
    }
  }

  /**
   * Get all templates for a module
   */
  async getTemplatesByModule(moduleName: string): Promise<ExportTemplate[]> {
    try {
      const response = await axios.get<{ success: boolean; templates: ExportTemplate[] }>(
        `${API_URL}/api/templates`,
        {
          params: { module: moduleName },
          headers: this.getAuthHeaders(),
        }
      );

      return response.data.templates;
    } catch (error: unknown) {
      logApiError('Get templates error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        'Failed to get templates'
      );
    }
  }

  /**
   * Get a single template by ID
   */
  async getTemplateById(id: string): Promise<ExportTemplate> {
    try {
      const response = await axios.get<{ success: boolean; template: ExportTemplate }>(
        `${API_URL}/api/templates/${id}`,
        { headers: this.getAuthHeaders() }
      );

      return response.data.template;
    } catch (error: unknown) {
      logApiError('Get template error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        'Failed to get template'
      );
    }
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, data: UpdateTemplateDTO): Promise<ExportTemplate> {
    try {
      const response = await axios.put<{ success: boolean; template: ExportTemplate }>(
        `${API_URL}/api/templates/${id}`,
        data,
        { headers: this.getAuthHeaders() }
      );

      return response.data.template;
    } catch (error: unknown) {
      logApiError('Update template error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        'Failed to update template'
      );
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      await axios.delete(
        `${API_URL}/api/templates/${id}`,
        { headers: this.getAuthHeaders() }
      );
    } catch (error: unknown) {
      logApiError('Delete template error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        'Failed to delete template'
      );
    }
  }

  /**
   * Get available modules
   */
  async getAvailableModules(): Promise<ModuleInfo[]> {
    try {
      const response = await axios.get<{ success: boolean; modules: ModuleInfo[] }>(
        `${API_URL}/api/templates/modules`,
        { headers: this.getAuthHeaders() }
      );

      return response.data.modules;
    } catch (error: unknown) {
      logApiError('Get modules error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        'Failed to get modules'
      );
    }
  }

  /**
   * Get available columns for a module
   */
  async getAvailableColumns(moduleName: string): Promise<AvailableColumn[]> {
    try {
      const response = await axios.get<{ success: boolean; columns: AvailableColumn[] }>(
        `${API_URL}/api/templates/columns/${moduleName}`,
        { headers: this.getAuthHeaders() }
      );

      return response.data.columns;
    } catch (error: unknown) {
      logApiError('Get columns error:', error);
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      throw new Error(
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        'Failed to get columns'
      );
    }
  }
}

export default new TemplateService();
