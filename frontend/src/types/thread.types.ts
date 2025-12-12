// Thread types

// ============================================
// PACKAGING TYPE ENUM
// ============================================

export type ThreadPackagingType = 'CONE' | 'TUBE';

// ============================================
// SUPPLIER INTERFACES (Multi-supplier support)
// ============================================

export interface ThreadSupplier {
  id: string;
  threadId: string;
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string | null;
  pricePerCone?: number | null;
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

export interface ThreadSupplierInput {
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string;
  pricePerCone?: number | string;
}

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
  buyerCode?: string | null;
  brand?: string | null;                    // Brand name
  packagingType?: ThreadPackagingType | null; // CONE or TUBE
  piecesPerBox?: number | null;             // 6 for Cone, 10 for Tube
  metersPerUnit?: number | null;            // Meters per cone/tube
  color?: string | null;
  colorCode?: string | null;
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

  // Multi-supplier support
  threadSuppliers?: ThreadSupplier[];
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface ThreadFormData {
  threadName: string;
  supplierCode?: string;
  buyerCode?: string;
  brand?: string;
  packagingType?: ThreadPackagingType;
  piecesPerBox?: number;
  metersPerUnit?: number | string;
  color?: string;
  colorCode?: string;
  coneSize?: string;
  pricePerCone?: number | string;
  supplierId?: string;
  description?: string;
  styleCodes?: string[]; // Style code associations
  suppliers?: ThreadSupplierInput[];
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateThreadRequest {
  threadName: string;
  supplierCode?: string;
  buyerCode?: string;
  brand?: string;
  packagingType?: ThreadPackagingType;
  piecesPerBox?: number;
  metersPerUnit?: number;
  color?: string;
  colorCode?: string;
  coneSize?: string;
  pricePerCone?: number;
  supplierId?: string;
  description?: string;
  styleCodes?: string[]; // Style code associations
  suppliers?: ThreadSupplierInput[];
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
  brand?: string;
  packagingType?: ThreadPackagingType;
  metersPerUnit?: number;
  color?: string;
  colorCode?: string;
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
