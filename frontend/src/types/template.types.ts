// Template Types for Import/Export Infrastructure

import type { ExportColumn } from './export.types';

export interface ExportTemplate {
  id: string;
  moduleName: string;
  templateName: string;
  description?: string;
  columnConfig: ExportColumn[];
  isDefault: boolean;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateDTO {
  moduleName: string;
  templateName: string;
  description?: string;
  columnConfig: ExportColumn[];
  isDefault?: boolean;
}

export interface UpdateTemplateDTO {
  templateName?: string;
  description?: string;
  columnConfig?: ExportColumn[];
  isDefault?: boolean;
}

export interface ModuleInfo {
  name: string;
  displayName: string;
}

export interface AvailableColumn {
  fieldName: string;
  displayName: string;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'email';
  required?: boolean;
}

export interface TemplateSelectorProps {
  module: string;
  value?: string;
  onChange: (templateId: string | undefined) => void;
  className?: string;
}
