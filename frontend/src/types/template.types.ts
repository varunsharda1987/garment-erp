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
  // BUG-ET5 fix: User relation returned by backend when template is fetched with include
  users?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
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

// bug-hunt: backend returns { value, label } not { name, displayName }
export interface ModuleInfo {
  value: string;
  label: string;
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
