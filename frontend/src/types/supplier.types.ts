// Supplier types

// ============================================
// SUPPLIER CATEGORY ENUM
// ============================================

export const SupplierCategory = {
  FABRIC_SUPPLIER: 'FABRIC_SUPPLIER',
  TRIMS_ACCESSORIES: 'TRIMS_ACCESSORIES',
  DYEING_PRINTING: 'DYEING_PRINTING',
  EMBROIDERY: 'EMBROIDERY',
  HAND_WORK: 'HAND_WORK',
  CMT_UNIT: 'CMT_UNIT',
  PACKAGING: 'PACKAGING',
} as const;

export type SupplierCategory = typeof SupplierCategory[keyof typeof SupplierCategory];

export const SupplierCategoryLabels: Record<SupplierCategory, string> = {
  FABRIC_SUPPLIER: 'Fabric Supplier',
  TRIMS_ACCESSORIES: 'Trims & Accessories',
  DYEING_PRINTING: 'Dyeing & Printing',
  EMBROIDERY: 'Embroidery',
  HAND_WORK: 'Hand Work',
  CMT_UNIT: 'CMT Unit',
  PACKAGING: 'Packaging',
};

// ============================================
// CATEGORY-SPECIFIC DATA TYPES
// ============================================

// 1. FABRIC SUPPLIER
export interface FabricSupplierData {
  fabricCategories: {
    greige: boolean;
    ready: boolean;
  };
  greigeFabricTypes?: string[]; // ["Cotton 40x40", "Polyester", etc.]
  readyFabricTypes?: string[]; // ["Printed Cotton", "Dyed Polyester", etc.]
  widthRangeFrom?: number; // inches
  widthRangeTo?: number; // inches
  gsmRangeFrom?: number;
  gsmRangeTo?: number;
  qualityCertifications?: string[]; // ["GOTS", "OEKO-TEX", "BCI"]
  specialtyNotes?: string;
}

// 2. TRIMS & ACCESSORIES SUPPLIER
export interface TrimsAccessoriesItem {
  itemName: string; // "Buttons", "Thread", etc.
  unit: string; // "Gross", "Pieces", "Tubes", "Cones", etc.
}

export interface TrimsAccessoriesData {
  items: TrimsAccessoriesItem[];
  customizationAvailable?: boolean;
  designColorMatching?: boolean;
  specialtyNotes?: string;
}

// 3. DYEING & PRINTING SUPPLIER
export interface DyeingPrintingData {
  services: {
    dyeing: boolean;
    printing: boolean;
  };
  dyeingTechniques?: string[]; // ["Piece Dyeing", "Yarn Dyeing", etc.]
  printingTechniques?: string[]; // ["Digital", "Screen", "Block", etc.]
  productionCapacityMetersPerDay?: number;
  colorMatching?: boolean;
  pantoneMatching?: boolean;
  sampleDevelopment?: boolean;
  qualityCertifications?: string[]; // ["AZO Free", "GOTS", "OEKO-TEX"]
  specialtyNotes?: string;
}

// 4. EMBROIDERY SUPPLIER
export interface EmbroideryData {
  embroideryTypes: string[]; // ["Machine", "Computerized", "Hand", "Zari", "Stone", "Aari"]
  productionCapacityPiecesPerDay?: number;
  numberOfMachines?: number;
  stitchCountFrom?: number;
  stitchCountTo?: number;
  designComplexity?: 'Simple' | 'Medium' | 'Complex' | 'All';
  designDevelopment?: boolean;
  punchingServices?: boolean;
  sampleDevelopment?: boolean;
  specialtyNotes?: string;
}

// 5. HAND WORK SUPPLIER
export interface HandWorkData {
  handWorkTypes: string[]; // ["Beading", "Sequin", "Stone", "Mirror", "Zardozi", etc.]
  productionCapacityPiecesPerDay?: number;
  numberOfWorkers?: number;
  designComplexity?: 'Simple' | 'Medium' | 'Complex' | 'All';
  designDevelopment?: boolean;
  sampleDevelopment?: boolean;
  specialtyNotes?: string;
}

// 6. CMT UNIT SUPPLIER
export interface CMTUnitData {
  garmentCategories: string[]; // ["Western Wear - Men", "Ethnic Wear - Women", etc.]
  productionCapacityPiecesPerDay?: number;
  machineCount: {
    singleNeedle?: number;
    overlock?: number;
    flatlock?: number;
    buttonHole?: number;
    buttonStitch?: number;
    other?: number;
  };
  numberOfWorkers?: number;
  factoryAreaSqFt?: number;
  qualityCertifications?: string[]; // ["ISO 9001", "WRAP", "SA8000"]
  inspectionServices?: boolean;
  packagingServices?: boolean;
  specialtyNotes?: string;
}

// 7. PACKAGING SUPPLIER
export interface PackagingItem {
  itemType: string; // "Polybags", "Hangtags", "RFID Stickers", "Price Tags", etc.
  customization: boolean;
}

export interface PackagingData {
  items: PackagingItem[];
  printingServices?: boolean;
  printingTechniques?: string[]; // ["Offset", "Digital", "Screen"]
  designServices?: boolean;
  rfidProgramming?: boolean;
  barcodeGeneration?: boolean;
  qualityCertifications?: string[]; // ["FSC", "Recyclable Materials"]
  specialtyNotes?: string;
}

// Union type for all category data
export type CategoryData =
  | FabricSupplierData
  | TrimsAccessoriesData
  | DyeingPrintingData
  | EmbroideryData
  | HandWorkData
  | CMTUnitData
  | PackagingData;

// ============================================
// MAIN SUPPLIER INTERFACE
// ============================================

export interface Supplier {
  id: string;
  code: string;
  name: string;
  supplierCategory: SupplierCategory;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstNumber?: string | null;
  paymentTerms?: string | null;
  creditLimit?: number | null;
  creditDays?: number | null;
  rating?: number | null;
  categoryData?: CategoryData | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count?: {
    materials: number;
    purchaseOrders: number;
    goodsReceivingNotes: number;
  };
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export type CreateSupplierRequest = {
  code: string;
  name: string;
  supplierCategory: SupplierCategory;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  paymentTerms?: string;
  creditLimit?: number;
  creditDays?: number;
  rating?: number;
  categoryData?: CategoryData;
};

export type UpdateSupplierRequest = Partial<CreateSupplierRequest>;

export interface SupplierListResponse {
  data: Supplier[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SupplierResponse {
  data: Supplier;
  message?: string;
}
