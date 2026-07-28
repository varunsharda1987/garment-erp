// Supplier types

// ============================================
// SUPPLIER CATEGORY ENUM
// ============================================

export const SupplierCategory = {
  FABRIC_SUPPLIER: 'FABRIC_SUPPLIER',
  GREIGE_SUPPLIER: 'GREIGE_SUPPLIER',
  TRIMS_SUPPLIER: 'TRIMS_SUPPLIER',
  THREAD_SUPPLIER: 'THREAD_SUPPLIER',
  PACKAGING_SUPPLIER: 'PACKAGING_SUPPLIER',
  LACE_SUPPLIER: 'LACE_SUPPLIER',
  DYEING_PRINTING: 'DYEING_PRINTING',
  EMBROIDERY: 'EMBROIDERY',
  HAND_WORK: 'HAND_WORK',
  SMOCKING: 'SMOCKING',
  CMT_UNIT: 'CMT_UNIT',
  FINISHING_CONTRACTOR: 'FINISHING_CONTRACTOR',
  STITCHING_CONTRACTOR: 'STITCHING_CONTRACTOR',
  WASHING: 'WASHING',
  DORI_PIPING_CONTRACTOR: 'DORI_PIPING_CONTRACTOR',
  MACHINE_PARTS_SUPPLIER: 'MACHINE_PARTS_SUPPLIER',
  OTHER_SERVICES: 'OTHER_SERVICES',
} as const;

export type SupplierCategory = (typeof SupplierCategory)[keyof typeof SupplierCategory];

export const SupplierCategoryLabels: Record<SupplierCategory, string> = {
  FABRIC_SUPPLIER: 'Fabric Supplier',
  GREIGE_SUPPLIER: 'Greige Supplier',
  TRIMS_SUPPLIER: 'Trims Supplier',
  THREAD_SUPPLIER: 'Thread Supplier',
  PACKAGING_SUPPLIER: 'Packaging Supplier',
  LACE_SUPPLIER: 'Lace Supplier',
  DYEING_PRINTING: 'Dyeing & Printing',
  EMBROIDERY: 'Embroidery',
  HAND_WORK: 'Hand Work',
  SMOCKING: 'Smocking',
  CMT_UNIT: 'CMT Unit',
  FINISHING_CONTRACTOR: 'Finishing Contractor',
  STITCHING_CONTRACTOR: 'Stitching Contractor',
  WASHING: 'Washing',
  DORI_PIPING_CONTRACTOR: 'Dori/Piping Contractor',
  MACHINE_PARTS_SUPPLIER: 'Machine Parts Supplier',
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

// 5. LACE SUPPLIER
export interface LaceSupplierData {
  laceTypes: string[]; // ["Cotton Lace", "Polyester Lace", "Embroidered Lace", "Crochet Lace", etc.]
  widthRange?: string; // "1-6 inches"
  colorMatching?: boolean;
  customDesigns?: boolean;
  specialtyNotes?: string;
}

// 6. OTHER SERVICES SUPPLIER
export interface OtherServicesData {
  services: string[]; // ["Quality Testing", "Sample Making", "Consulting", etc.]
  specialtyNotes?: string;
}

// 7. DYEING & PRINTING SUPPLIER
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

// 8. EMBROIDERY SUPPLIER
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

// 9. HAND WORK SUPPLIER
export interface HandWorkData {
  handWorkTypes: string[]; // ["Beading", "Sequin", "Stone", "Mirror", "Zardozi", etc.]
  productionCapacityPiecesPerDay?: number;
  numberOfWorkers?: number;
  designComplexity?: 'Simple' | 'Medium' | 'Complex' | 'All';
  designDevelopment?: boolean;
  sampleDevelopment?: boolean;
  specialtyNotes?: string;
}

// 10. SMOCKING SUPPLIER
export interface SmockingData {
  smockingTypes: string[]; // ["English Smocking", "Honeycomb", "Cable", "Wave", "Diamond"]
  productionCapacityPiecesPerDay?: number;
  numberOfWorkers?: number;
  designComplexity?: 'Simple' | 'Medium' | 'Complex' | 'All';
  sampleDevelopment?: boolean;
  specialtyNotes?: string;
}

// 11. CMT UNIT SUPPLIER
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

// 12. FINISHING CONTRACTOR
export interface FinishingContractorData {
  finishingServices: string[]; // ["Pressing", "Steaming", "Folding", "Tagging", "Quality Check"]
  productionCapacityPiecesPerDay?: number;
  numberOfWorkers?: number;
  equipmentAvailable?: string[]; // ["Steam Press", "Vacuum Table", "Spotting Machine"]
  specialtyNotes?: string;
}

// 13. STITCHING CONTRACTOR
export interface StitchingContractorData {
  garmentTypes: string[]; // ["Shirts", "Pants", "Dresses", "Kurtas", etc.]
  productionCapacityPiecesPerDay?: number;
  machineCount: {
    singleNeedle?: number;
    overlock?: number;
    flatlock?: number;
    buttonHole?: number;
    buttonStitch?: number;
    kansai?: number;
    bartack?: number;
    other?: number;
  };
  numberOfWorkers?: number;
  specialtyNotes?: string;
}

// 14. WASHING CONTRACTOR
export interface WashingData {
  washTypes: string[]; // ["Stone Wash", "Acid Wash", "Enzyme Wash", "Normal Wash", "Bleach Wash"]
  productionCapacityPiecesPerDay?: number;
  machineCapacityKg?: number;
  numberOfMachines?: number;
  qualityCertifications?: string[]; // ["AZO Free", "GOTS"]
  specialtyNotes?: string;
}

// 15. DORI/PIPING CONTRACTOR
export interface DoriPipingContractorData {
  services: string[]; // ["Dori Making", "Piping", "Cord Making", "Bias Binding"]
  productionCapacityMetersPerDay?: number;
  colorMatching?: boolean;
  customSizes?: boolean;
  specialtyNotes?: string;
}

// 16. MACHINE PARTS SUPPLIER
export interface MachinePartsSupplierData {
  machineTypes: string[]; // ["Sewing Machine", "Overlock", "Cutting Machine", "Pressing Machine"]
  partCategories: string[]; // ["Needles", "Bobbins", "Motors", "Blades", "Belts"]
  brands?: string[]; // ["Juki", "Brother", "Singer", etc.]
  warrantyAvailable?: boolean;
  specialtyNotes?: string;
}

// Union type for all category data
export type CategoryData =
  | FabricSupplierData
  | TrimsSupplierData
  | ThreadSupplierData
  | PackagingSupplierData
  | LaceSupplierData
  | DyeingPrintingData
  | EmbroideryData
  | HandWorkData
  | SmockingData
  | CMTUnitData
  | FinishingContractorData
  | StitchingContractorData
  | WashingData
  | DoriPipingContractorData
  | MachinePartsSupplierData
  | OtherServicesData;

// ============================================
// GST & LOCATION INTERFACES
// ============================================

export interface SupplierGSTNumber {
  id: string;
  supplierId: string;
  stateId?: string | null;
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  state?: {
    id: string;
    stateName: string;
    stateCode: string;
  } | null;
}

export interface GstNumberInput {
  stateId?: string;
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string;
  billingCityId?: string;
  billingPincode?: string;
  isPrimary: boolean;
}

// ============================================
// MAIN SUPPLIER INTERFACE
// ============================================

export interface Supplier {
  id: string;
  code: string;
  name: string;
  supplierCategories: SupplierCategory[];
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  // Location Fields
  billingStateId?: string | null;
  billingCityId?: string | null;
  billingPincode?: string | null;
  shippingStateId?: string | null;
  shippingCityId?: string | null;
  shippingPincode?: string | null;
  shippingAddress?: string | null;
  // GST Numbers
  gstNumbers?: SupplierGSTNumber[];
  paymentTerms?: string | null;
  creditLimit?: number | null;
  creditDays?: number | null;
  rating?: number | null;
  categoryData?: CategoryData | null;
  // Bank Details
  bankName?: string | null;
  bankAccountNumber?: string | null;
  ifscCode?: string | null;
  // Location Relations
  billingState?: {
    id: string;
    stateName: string;
    stateCode: string;
  } | null;
  billingCity?: {
    id: string;
    cityName: string;
  } | null;
  shippingState?: {
    id: string;
    stateName: string;
    stateCode: string;
  } | null;
  shippingCity?: {
    id: string;
    cityName: string;
  } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  // Backend includes the creator via the `users` relation (suppliers.createdById);
  // the serializer keeps the key as `users`, so read that (not `createdBy`) - B04-08.
  users?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count?: {
    // Backend selects the three supplier-link relations separately (materialSuppliers +
    // greigeSuppliers + fabricSuppliers); the UI shows their sum as "Materials".
    materialSuppliers: number;
    greigeSuppliers: number;
    fabricSuppliers: number;
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
  supplierCategories: SupplierCategory[];
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  // Location fields
  billingStateId?: string;
  billingCityId?: string;
  billingPincode?: string;
  shippingStateId?: string;
  shippingCityId?: string;
  shippingPincode?: string;
  shippingAddress?: string;
  // GST Numbers
  gstNumbers?: GstNumberInput[];
  paymentTerms?: string;
  creditLimit?: number;
  creditDays?: number;
  rating?: number;
  categoryData?: CategoryData;
  // Bank Details
  bankName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
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
