// Label types

// ============================================
// LABEL CATEGORY ENUM
// ============================================

export type LabelCategory = 'SEWN_IN' | 'HANGTAG' | 'PRICE_TAG';

export const LABEL_CATEGORIES: { value: LabelCategory; label: string; description: string }[] = [
  { value: 'SEWN_IN', label: 'Sewn-in Label', description: 'Care labels, size labels sewn into garment (used in Trims)' },
  { value: 'HANGTAG', label: 'Hangtag', description: 'Removable hangtags attached for retail (used in Accessories)' },
  { value: 'PRICE_TAG', label: 'Price Tag', description: 'Price tags (used in Accessories)' },
];

/**
 * Get the correct terminology for a label category
 * - SEWN_IN uses "Label"
 * - HANGTAG uses "Hangtag"
 * - PRICE_TAG uses "Price Tag"
 */
export function getLabelCategoryTerm(category: LabelCategory | string | undefined): string {
  if (!category) return 'Label';

  switch (category) {
    case 'SEWN_IN':
      return 'Label';
    case 'HANGTAG':
      return 'Hangtag';
    case 'PRICE_TAG':
      return 'Price Tag';
    default:
      return 'Label';
  }
}

/**
 * Get the plural form of the label category term
 */
export function getLabelCategoryTermPlural(category: LabelCategory | string | undefined): string {
  if (!category) return 'Labels';

  switch (category) {
    case 'SEWN_IN':
      return 'Labels';
    case 'HANGTAG':
      return 'Hangtags';
    case 'PRICE_TAG':
      return 'Price Tags';
    default:
      return 'Labels';
  }
}

// ============================================
// LABEL TYPES (Common label types in garment industry)
// ============================================

export const LABEL_TYPES = [
  // Sewn-in Labels
  { value: 'Main Label', category: 'SEWN_IN', description: 'Main brand label sewn into garment' },
  { value: 'Washcare Label', category: 'SEWN_IN', description: 'Washing/care instructions label' },
  { value: 'Size Label', category: 'SEWN_IN', description: 'Size indicator label (S, M, L, XL, etc.)' },
  { value: 'Main Cum Size Label', category: 'SEWN_IN', description: 'Combined main label with size (brand + size info)' },
  { value: 'Brand Label', category: 'SEWN_IN', description: 'Brand/logo label sewn into garment' },
  { value: 'Loop Tag', category: 'SEWN_IN', description: 'Folded loop label for hanging or brand display' },
  { value: 'Traceability Label', category: 'SEWN_IN', description: 'Traceability/tracking label with unique ID or QR code' },
  { value: 'Barcode Label', category: 'SEWN_IN', description: 'Barcode label for inventory/POS scanning' },
  { value: 'Country of Origin', category: 'SEWN_IN', description: 'Made in [Country] label' },
  { value: 'Composition Label', category: 'SEWN_IN', description: 'Fabric composition/content label' },
  // Hangtags & Price Tags
  { value: 'Hangtag', category: 'HANGTAG', description: 'Removable retail display tag' },
  { value: 'Price Tag', category: 'PRICE_TAG', description: 'Price display tag' },
  // Other
  { value: 'Other', category: 'SEWN_IN', description: 'Custom/other label type' },
] as const;

// ============================================
// SUPPLIER INTERFACES (Multi-supplier support)
// ============================================

export interface LabelSupplier {
  id: string;
  labelId: string;
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string | null;
  pricePerPiece?: number | null;
  pricePerHundred?: number | null;
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

export interface LabelSupplierInput {
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string;
  pricePerPiece?: number | string;
  pricePerHundred?: number | string;
}

// ============================================
// LABEL INTERFACE
// ============================================

export interface Label {
  id: string;
  labelCode: string;
  labelName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  customerId?: string | null;  // Link to customer - makes label customer-specific
  brandCategoryId?: string | null; // Link to specific brand within customer
  labelCategory?: LabelCategory;
  labelType?: string | null;
  size?: string | null;
  content?: string | null;
  fabricContent?: string | null;        // Fabric composition (e.g., "100% Cotton")
  washcareInstructions?: string | null; // Care instructions (e.g., "Machine wash cold")
  printMethod?: string | null;
  material?: string | null;
  color?: string | null;
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
  labelSuppliers?: LabelSupplier[];

  // Size variants support
  sizeVariants?: Array<{
    id: string;
    size: string;
    sizeCategoryId?: string | null;
    stockQuantity: number;
    isActive: boolean;
    material?: {
      id: string;
      code: string;
      name: string;
      stock_levels?: Array<{
        quantity: number;
        warehouseId: string;
        warehouses: {
          code: string;
          name: string;
        };
      }>;
    };
  }>;
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface LabelFormData {
  labelName: string;
  supplierCode?: string;
  buyerCode?: string;
  customerId?: string;  // Link to customer
  brandCategoryId?: string; // Link to specific brand within customer
  labelCategory?: LabelCategory | string;
  labelType?: string;
  size?: string;
  sizeCategoryId?: string; // Size category for auto-generating variants
  generateSizeVariants?: boolean; // Flag to generate size variants
  content?: string;
  fabricContent?: string;        // Fabric composition (e.g., "100% Cotton")
  washcareInstructions?: string; // Care instructions (e.g., "Machine wash cold")
  printMethod?: string;
  material?: string;
  color?: string;
  pricePerPiece?: number | string;
  pricePerHundred?: number | string;
  supplierId?: string;
  description?: string;
  suppliers?: LabelSupplierInput[];
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateLabelRequest {
  labelName: string;
  supplierCode?: string;
  buyerCode?: string;
  customerId?: string;  // Link to customer
  brandCategoryId?: string; // Link to specific brand within customer
  labelCategory?: LabelCategory | string;
  labelType?: string;
  size?: string;
  sizeCategoryId?: string; // Size category for auto-generating variants
  generateSizeVariants?: boolean; // Flag to generate size variants
  content?: string;
  fabricContent?: string;        // Fabric composition (e.g., "100% Cotton")
  washcareInstructions?: string; // Care instructions (e.g., "Machine wash cold")
  printMethod?: string;
  material?: string;
  color?: string;
  pricePerPiece?: number;
  pricePerHundred?: number;
  supplierId?: string;
  description?: string;
  suppliers?: LabelSupplierInput[];
}

export interface UpdateLabelRequest extends Partial<CreateLabelRequest> {
  isActive?: boolean;
}

export interface LabelListResponse {
  data: Label[];
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

export interface LabelResponse {
  label: Label;
  material?: MaterialEntry;
  message?: string;
}

export interface BulkImportResult {
  success: boolean;
  row: number;
  labelCode?: string;
  materialCode?: string;
  labelName?: string;
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
  labelName: string;
  supplierCode?: string;
  buyerCode?: string;
  labelType?: string;
  size?: string;
  content?: string;
  fabricContent?: string;        // Fabric composition (e.g., "100% Cotton")
  washcareInstructions?: string; // Care instructions (e.g., "Machine wash cold")
  printMethod?: string;
  material?: string;
  color?: string;
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
