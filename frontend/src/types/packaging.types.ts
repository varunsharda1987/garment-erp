// Packaging types

// ============================================
// PACKAGING TYPES (Common packaging types in garment industry)
// ============================================

export const PACKAGING_TYPES = [
  // Bags & Covers
  { value: 'Poly Bag', description: 'Polyethylene/polypropylene bags for individual garment packing' },
  { value: 'Zip Lock Bag', description: 'Resealable plastic bags with zipper closure' },
  { value: 'Garment Cover', description: 'Plastic or fabric covers for hanging garments' },
  { value: 'Dust Cover', description: 'Protective covers to prevent dust accumulation' },
  // Boxes & Cartons
  { value: 'Carton Box', description: 'Corrugated cardboard boxes for bulk shipping' },
  { value: 'Gift Box', description: 'Premium retail packaging boxes' },
  { value: 'Shoe Box', description: 'Boxes for footwear packaging' },
  { value: 'Inner Box', description: 'Smaller boxes that go inside master cartons' },
  // Hangers
  { value: 'Plastic Hanger', description: 'Standard plastic clothes hanger' },
  { value: 'Wooden Hanger', description: 'Premium wooden clothes hanger' },
  { value: 'Velvet Hanger', description: 'Non-slip velvet-coated hanger' },
  { value: 'Clip Hanger', description: 'Hanger with clips for pants/skirts' },
  { value: 'Wire Hanger', description: 'Basic wire hanger' },
  // Tapes & Stickers
  { value: 'Packing Tape', description: 'Adhesive tape for sealing cartons' },
  { value: 'Barcode Sticker', description: 'Barcode labels for inventory tracking' },
  { value: 'Size Sticker', description: 'Size indicator stickers' },
  // Other
  { value: 'Tissue Paper', description: 'Wrapping tissue for delicate items' },
  { value: 'Silica Gel', description: 'Moisture absorber packets' },
  { value: 'Insert Card', description: 'Cardboard inserts for shape retention' },
  { value: 'Other', description: 'Custom/other packaging type' },
] as const;

// ============================================
// SUPPLIER INPUT TYPE
// ============================================

export interface PackagingSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerPiece?: number | string;
}

export interface PackagingSupplier {
  id: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string | null;
  pricePerPiece?: number | null;
}

// ============================================
// PACKAGING INTERFACE
// ============================================

export interface Packaging {
  id: string;
  packagingCode: string;
  packagingName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  customerId?: string | null; // Link to customer - makes packaging customer-specific
  brandCategoryId?: string | null; // Link to specific brand within customer
  packagingType?: string | null;
  size?: string | null;
  material?: string | null;
  thickness?: string | null; // e.g., "40 microns", "3 ply"
  printDetails?: string | null;
  pricePerPiece?: number | null;
  pricePerHundred?: number | null;
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
  customer?: {
    id: string;
    code: string;
    name: string;
  } | null;
  brandCategory?: {
    id: string;
    brandName: string;
    category: string;
    subCategory?: string | null;
  } | null;

  // Multi-supplier support
  packagingSuppliers?: PackagingSupplier[];
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface PackagingFormData {
  packagingName: string;
  supplierCode?: string;
  buyerCode?: string;
  customerId?: string; // Link to customer
  brandCategoryId?: string; // Link to specific brand within customer
  packagingType?: string;
  size?: string;
  material?: string;
  thickness?: string; // e.g., "40 microns", "3 ply"
  printDetails?: string;
  pricePerPiece?: number | string;
  pricePerHundred?: number | string;
  supplierId?: string;
  description?: string;
  suppliers?: PackagingSupplierInput[]; // Multi-supplier support
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreatePackagingRequest {
  packagingName: string;
  supplierCode?: string;
  buyerCode?: string;
  customerId?: string; // Link to customer
  brandCategoryId?: string; // Link to specific brand within customer
  packagingType?: string;
  size?: string;
  material?: string;
  thickness?: string; // e.g., "40 microns", "3 ply"
  printDetails?: string;
  pricePerPiece?: number;
  pricePerHundred?: number;
  supplierId?: string;
  description?: string;
  suppliers?: PackagingSupplierInput[]; // Multi-supplier support
}

export interface UpdatePackagingRequest extends Partial<CreatePackagingRequest> {
  isActive?: boolean;
}

export interface PackagingListResponse {
  data: Packaging[];
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

export interface PackagingResponse {
  packaging: Packaging;
  material?: MaterialEntry;
  message?: string;
}

export interface BulkImportResult {
  success: boolean;
  row: number;
  packagingCode?: string;
  materialCode?: string;
  packagingName?: string;
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
  packagingName: string;
  supplierCode?: string;
  buyerCode?: string;
  packagingType?: string;
  size?: string;
  material?: string;
  thickness?: string; // e.g., "40 microns", "3 ply"
  printDetails?: string;
  pricePerPiece?: number;
  pricePerHundred?: number;
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
