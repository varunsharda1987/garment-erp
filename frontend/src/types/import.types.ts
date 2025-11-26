// Import Types for Import/Export Infrastructure

export interface ImportColumn {
  fieldName: string;
  displayName: string;
  required?: boolean;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'email';
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  value?: any;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ImportError[];
  data?: any[];
}

export interface ImportPreviewProps {
  module: string;
  result: ImportResult | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: File) => Promise<ImportResult>;
  file: File | null;
}

export interface ImportButtonProps {
  module: string;
  onSuccess?: () => void;
  disabled?: boolean;
  className?: string;
}

export type ImportFormat = 'csv' | 'excel';
