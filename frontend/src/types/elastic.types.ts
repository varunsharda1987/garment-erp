// Elastic types

// ============================================
// SUPPLIER INTERFACES (Multi-supplier support)
// ============================================

export interface ElasticSupplier {
  id: string;
  elasticId: string;
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string | null;
  pricePerMeter?: number | null;
  createdAt?: string;
  updatedAt?: string;
  supplier: {
    id: string;
    code: string;
    name: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    isActive: boolean;
  };
}

export interface ElasticSupplierInput {
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string;
  pricePerMeter?: number | string;
}

// ============================================
// ELASTIC INTERFACE
// ============================================

export interface Elastic {
  id: string;
  elasticCode: string;
  elasticName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  width?: number | null;
  stretchPercent?: number | null;
  color?: string | null;
  composition?: string | null;
  elasticType?: string | null;
  pricePerMeter?: number | null;
  image?: string | null;
  supplierId?: string | null;
  description?: string | null;
  // Note: styleCodes not supported - no elastic_style_associations table
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // Relationships (from API response)
  materialCode?: string;
  materialId?: string;
  supplierName?: string;
  supplierCodeRef?: string;

  // Multi-supplier support
  elasticSuppliers?: ElasticSupplier[];
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface ElasticFormData {
  elasticName: string;
  supplierCode?: string;
  buyerCode?: string;
  width?: number | string;
  stretchPercent?: number | string;
  color?: string;
  composition?: string;
  elasticType?: string;
  pricePerMeter?: number | string;
  supplierId?: string;
  description?: string;
  // Note: styleCodes not supported - no elastic_style_associations table
  suppliers?: ElasticSupplierInput[];
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateElasticRequest {
  elasticName: string;
  supplierCode?: string;
  buyerCode?: string;
  width?: number;
  stretchPercent?: number;
  color?: string;
  composition?: string;
  elasticType?: string;
  pricePerMeter?: number;
  supplierId?: string;
  description?: string;
  // Note: styleCodes not supported - no elastic_style_associations table
  suppliers?: ElasticSupplierInput[];
}

export interface UpdateElasticRequest extends Partial<CreateElasticRequest> {
  isActive?: boolean;
}

export interface ElasticListResponse {
  data: Elastic[];
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

export interface ElasticResponse {
  elastic: Elastic;
  material?: MaterialEntry;
  message?: string;
}

export interface BulkImportResult {
  success: boolean;
  row: number;
  elasticCode?: string;
  materialCode?: string;
  elasticName?: string;
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
  elasticName: string;
  supplierCode?: string;
  buyerCode?: string;
  width?: number;
  stretchPercent?: number;
  color?: string;
  composition?: string;
  elasticType?: string;
  pricePerMeter?: number;
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
