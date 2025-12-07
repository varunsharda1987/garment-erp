// Thread types

// ============================================
// THREAD INTERFACE
// ============================================

export interface StyleAssociation {
  styleId: string;
  styleCode: string;
  styleName?: string;
  isPrimary: boolean;
}

export interface Thread {
  id: string;
  threadCode: string;
  threadName: string;
  supplierCode?: string | null;
  buyerCode?: string | null; // DEPRECATED: Use styleCodes instead
  threadCount?: string | null;
  color?: string | null;
  colorCode?: string | null;
  composition?: string | null;
  threadType?: string | null;
  coneSize?: string | null;
  pricePerCone?: number | null;
  image?: string | null;
  supplierId?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // Relationships (from API response)
  materialCode?: string;
  materialId?: string;
  supplierName?: string;
  supplierCodeRef?: string;

  // Style associations (many-to-many)
  styleCodes?: string[];
  styleAssociations?: StyleAssociation[];
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface ThreadFormData {
  threadName: string;
  supplierCode?: string;
  buyerCode?: string; // DEPRECATED: Use styleCodes instead
  threadCount?: string;
  color?: string;
  colorCode?: string;
  composition?: string;
  threadType?: string;
  coneSize?: string;
  pricePerCone?: number | string;
  supplierId?: string;
  description?: string;
  styleCodes?: string[]; // Style code associations
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateThreadRequest {
  threadName: string;
  supplierCode?: string;
  buyerCode?: string; // DEPRECATED
  threadCount?: string;
  color?: string;
  colorCode?: string;
  composition?: string;
  threadType?: string;
  coneSize?: string;
  pricePerCone?: number;
  supplierId?: string;
  description?: string;
  styleCodes?: string[]; // Style code associations
}

export interface UpdateThreadRequest extends Partial<CreateThreadRequest> {
  isActive?: boolean;
}

export interface ThreadListResponse {
  data: Thread[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MaterialEntry {
  id: string;
  code: string;
  name: string;
  materialType: string;
  unit: string;
  isActive: boolean;
}

export interface ThreadResponse {
  thread: Thread;
  material?: MaterialEntry;
  message?: string;
}

export interface BulkImportResult {
  success: boolean;
  row: number;
  threadCode?: string;
  materialCode?: string;
  threadName?: string;
  stockCreated?: boolean;
  error?: string;
}

export interface BulkImportResponse {
  results: BulkImportResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
  message: string;
}

export interface BulkImportRow {
  threadName: string;
  supplierCode?: string;
  buyerCode?: string;
  threadCount?: string;
  color?: string;
  colorCode?: string;
  composition?: string;
  threadType?: string;
  coneSize?: string;
  pricePerCone?: number;
  stockQuantity?: number;
  locationCode?: string;
}

export interface TemplateColumn {
  name: string;
  required: boolean;
  description: string;
}

export interface TemplateResponse {
  columns: TemplateColumn[];
  exampleData: BulkImportRow[];
}
