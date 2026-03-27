// Export Types for Import/Export Infrastructure

export interface ExportColumn {
  fieldName: string;
  displayName: string;
  format?: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  width?: number;
}

export interface ExportOptions {
  module: string;
  format: 'csv' | 'excel' | 'pdf';
  templateId?: string;
  filters?: Record<string, unknown>;
}

export interface ExportRequest {
  format: 'csv' | 'excel' | 'pdf';
  templateId?: string;
  filters?: Record<string, unknown>;
}

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export interface ExportButtonProps {
  module: string;
  filters?: Record<string, unknown>;
  disabled?: boolean;
  className?: string;
}
