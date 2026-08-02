// Zipper types

// ============================================
// SUPPLIER INTERFACES (Multi-supplier support)
// ============================================

export interface ZipperSupplier {
  id: string;
  zipperId: string;
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string | null;
  pricePerPiece?: number | null;
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

export interface ZipperSupplierInput {
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string;
  pricePerPiece?: number | string;
}

// ============================================
// ZIPPER INTERFACE
// ============================================

export interface Zipper {
  id: string;
  zipperCode: string;
  zipperName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  length?: number | null;
  teethType?: string | null;
  color?: string | null;
  colorId?: string | null; // bug-hunt: added for ColorPicker pre-selection
  brand?: string | null;
  sliderType?: string | null;
  tapeWidth?: number | null;
  pricePerPiece?: number | null;
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
  styleCodes?: string[]; // BUG-MM6 fix: added styleCodes field

  // Multi-supplier support
  zipperSuppliers?: ZipperSupplier[];
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface ZipperFormData {
  zipperName: string;
  supplierCode?: string;
  buyerCode?: string;
  length?: number | string;
  teethType?: string;
  color?: string;
  brand?: string;
  sliderType?: string;
  tapeWidth?: number | string;
  pricePerPiece?: number | string;
  supplierId?: string;
  description?: string;
  suppliers?: ZipperSupplierInput[];
  styleCodes?: string[]; // BUG-MM6 fix
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateZipperRequest {
  zipperName: string;
  supplierCode?: string;
  buyerCode?: string;
  length?: number;
  teethType?: string;
  color?: string;
  brand?: string;
  sliderType?: string;
  tapeWidth?: number;
  pricePerPiece?: number;
  supplierId?: string;
  description?: string;
  suppliers?: ZipperSupplierInput[];
  styleCodes?: string[]; // BUG-MM6 fix
}

export interface UpdateZipperRequest extends Partial<CreateZipperRequest> {
  isActive?: boolean;
}

export interface ZipperListResponse {
  data: Zipper[];
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

export interface ZipperResponse {
  zipper: Zipper;
  material?: MaterialEntry;
  message?: string;
}

export interface BulkImportResult {
  success: boolean;
  row: number;
  zipperCode?: string;
  materialCode?: string;
  zipperName?: string;
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
  zipperName: string;
  supplierCode?: string;
  buyerCode?: string;
  length?: number;
  teethType?: string;
  color?: string;
  brand?: string;
  sliderType?: string;
  tapeWidth?: number;
  pricePerPiece?: number;
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
