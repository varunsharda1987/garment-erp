// Supplier types

// ============================================
// SUPPLIER CATEGORY ENUM
// ============================================

export const SupplierCategory = {
  FABRIC_SUPPLIER: 'FABRIC_SUPPLIER',
  TRIMS_SUPPLIER: 'TRIMS_SUPPLIER',
  THREAD_SUPPLIER: 'THREAD_SUPPLIER',
  PACKAGING_SUPPLIER: 'PACKAGING_SUPPLIER',
  DYEING_PRINTING: 'DYEING_PRINTING',
  EMBROIDERY: 'EMBROIDERY',
  HAND_WORK: 'HAND_WORK',
  CMT_UNIT: 'CMT_UNIT',
  OTHER_SERVICES: 'OTHER_SERVICES',
} as const;

export type SupplierCategory = typeof SupplierCategory[keyof typeof SupplierCategory];

export const SupplierCategoryLabels: Record<SupplierCategory, string> = {
  FABRIC_SUPPLIER: 'Fabric Supplier',
  TRIMS_SUPPLIER: 'Trims Supplier',
  THREAD_SUPPLIER: 'Thread Supplier',
  PACKAGING_SUPPLIER: 'Packaging Supplier',
  DYEING_PRINTING: 'Dyeing & Printing',
  EMBROIDERY: 'Embroidery',
  HAND_WORK: 'Hand Work',
  CMT_UNIT: 'CMT Unit',
  OTHER_SERVICES: 'Other Services',
};

// ============================================
// CATEGORY-SPECIFIC DATA TYPES
// ============================================

// 1. FABRIC SUPPLIER
// Note: Aligns with Greige Master and Finished Fabric Master modules
export interface FabricSupplierData {
  // Array of fabric IDs that this supplier can supply
  // Includes both greige fabrics (from greige_master) and finished fabrics (from fabrics table)
  fabricIds?: string[]; // IDs from greige_master and fabrics tables
  specialtyNotes?: string;
}

// 2. TRIMS SUPPLIER
export interface TrimsSupplierItem {
  itemName: string; // "Buttons", "Zippers", "Labels", etc.
  unit: string; // "Gross", "Pieces", "Meters", etc.
}

export interface TrimsSupplierData {
  items: TrimsSupplierItem[];
  customizationAvailable?: boolean;
  designColorMatching?: boolean;
  specialtyNotes?: string;
}

// 3. THREAD SUPPLIER
export interface ThreadSupplierData {
  threadTypes: string[]; // ["Sewing Thread", "Embroidery Thread", "Specialty Thread"]
  countRange?: string; // "40/2 to 120D"
  colors?: string; // "All colors available"
  specialtyNotes?: string;
}

// 4. PACKAGING SUPPLIER (Updated)
export interface PackagingSupplierItem {
  itemType: string; // "Polybags", "Hangtags", "RFID Stickers", "Price Tags", "Cartons", etc.
  customization: boolean;
}

export interface PackagingSupplierData {
  items: PackagingSupplierItem[];
  printingServices?: boolean;
  printingTechniques?: string[]; // ["Offset", "Digital", "Screen"]
  designServices?: boolean;
  rfidProgramming?: boolean;
  barcodeGeneration?: boolean;
  qualityCertifications?: string[]; // ["FSC", "Recyclable Materials"]
  specialtyNotes?: string;
}

// 5. OTHER SERVICES SUPPLIER
export interface OtherServicesData {
  services: string[]; // ["Quality Testing", "Sample Making", "Consulting", etc.]
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

// Union type for all category data
export type CategoryData =
  | FabricSupplierData
  | TrimsSupplierData
  | ThreadSupplierData
  | PackagingSupplierData
  | DyeingPrintingData
  | EmbroideryData
  | HandWorkData
  | CMTUnitData
  | OtherServicesData;

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
