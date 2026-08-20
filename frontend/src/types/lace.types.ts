// Lace types

// ============================================
// LACE SUPPLIER TYPES
// ============================================

export interface LaceSupplier {
  id: string;
  laceId: string;
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

export interface LaceSupplierInput {
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string;
  pricePerMeter?: number | string;
}

// ============================================
// STYLE ASSOCIATION TYPES
// ============================================

export interface StyleAssociation {
  styleId: string;
  styleCode: string;
  styleName?: string;
  isPrimary: boolean;
}

// ============================================
// LACE INTERFACE
// ============================================

export interface Lace {
  id: string;
  laceCode: string;
  laceName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  width?: number | null;
  design?: string | null;
  color?: string | null;
  composition?: string | null;
  laceType?: string | null;
  image?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // Greige lace fields
  isGreige: boolean;
  expectedShrinkagePercent?: number | null;
  costPerMeterGreige?: number | null;
  sourceGreigeLaceId?: string | null;
  finishedLaceId?: string | null;

  // Source greige lace relation (for finished lace)
  sourceGreigeLace?: {
    id: string;
    laceCode: string;
    laceName: string;
  } | null;

  // Processed lace tracking (for lace processed from greige)
  processedForStyleId?: string | null;
  processedForStyleCode?: string | null;
  processedForStyle?: {
    id: string;
    styleCode: string;
    styleName: string;
  } | null;

  // Finished laces derived from this greige
  finishedLaces?: {
    id: string;
    laceCode: string;
    laceName: string;
    color?: string | null;
    processedForStyleCode?: string | null;
  }[];

  // Relationships (from API response)
  materialCode?: string;
  materialId?: string;

  // Multi-supplier support. The serializer renames the lace_suppliers relation → `suppliers`,
  // so `suppliers` is the actual API key. `laceSuppliers` is kept (deprecated) only so existing
  // readers still type-check; new code should read `suppliers`.
  suppliers?: LaceSupplier[];
  /** @deprecated API returns `suppliers` (serializer renames laceSuppliers→suppliers). Read `suppliers`. */
  laceSuppliers?: LaceSupplier[];

  // Style associations (many-to-many - direct associations)
  styleCodes?: string[];
  styleNames?: string[];
  styleAssociations?: StyleAssociation[];

  // Cost sheet style associations (more authoritative)
  costingStyleCodes?: string[];
  costingStyleNames?: string[];
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface LaceFormData {
  laceName: string;
  supplierCode?: string;
  buyerCode?: string;
  width?: number | string;
  design?: string;
  color?: string;
  composition?: string;
  laceType?: string;
  description?: string;
  styleCodes?: string[]; // Style code associations
  suppliers?: LaceSupplierInput[]; // Multi-supplier support

  // Greige lace fields
  isGreige?: boolean;
  expectedShrinkagePercent?: number | string;
  costPerMeterGreige?: number | string;
  sourceGreigeLaceId?: string;

  // Image upload
  imageFile?: File; // For new uploads
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateLaceRequest {
  laceName: string;
  supplierCode?: string;
  buyerCode?: string;
  width?: number;
  design?: string;
  color?: string;
  composition?: string;
  laceType?: string;
  description?: string;
  styleCodes?: string[]; // Style code associations
  suppliers?: LaceSupplierInput[]; // Multi-supplier support

  // Greige lace fields
  isGreige?: boolean;
  expectedShrinkagePercent?: number;
  costPerMeterGreige?: number;
  sourceGreigeLaceId?: string;
}

export interface UpdateLaceRequest extends Partial<CreateLaceRequest> {
  isActive?: boolean;
}

export interface LaceListResponse {
  data: Lace[];
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

export interface LaceResponse {
  lace: Lace;
  material?: MaterialEntry;
  message?: string;
}

export interface BulkImportResult {
  success: boolean;
  row: number;
  laceCode?: string;
  materialCode?: string;
  laceName?: string;
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
  laceName: string;
  supplierCode?: string;
  buyerCode?: string;
  width?: number;
  design?: string;
  color?: string;
  composition?: string;
  laceType?: string;
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
