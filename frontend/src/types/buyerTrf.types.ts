/**
 * Buyer Test Requirement Form (TRF) — frontend types.
 *
 * camelCase throughout, matching the serialized API response, and mirroring
 * backend/src/schemas/buyerTrf.schema.ts field for field. A name that drifts from the Zod
 * schema is a field the API silently strips.
 */

export type TrfStatus = 'DRAFT' | 'ISSUED' | 'SENT_TO_LAB' | 'CLOSED';
export type TrfPackageType = 'KNIT' | 'WOVEN' | 'RETEST';
export type TrfSampleStage = 'PP' | 'SHIPMENT';
export type TrfFinishType = 'REGULAR_FINISH' | 'PEACH_FINISH' | 'GARMENT_WASH' | 'OTHER_DYE';
export type TrfServiceLevel = 'REGULAR' | 'EXPRESS' | 'SAME_DAY';

export interface BuyerTrf {
  id: string;
  trfNumber: string;
  trfDate: string;
  status: TrfStatus;

  /** Exactly one of these two is set. */
  workOrderId: string | null;
  saleOrderId: string | null;

  styleId: string;
  customerId: string;
  testingLabId: string | null;

  sampleDescription: string | null;
  endUse: string | null;
  boNumber: string | null;
  styleNo: string | null;
  buyerStyleRef: string | null;
  colour: string | null;
  fibreContent: string | null;
  ageRangeCategory: string | null;
  orderNumber: string | null;
  fabricWeightGsm: string | null;
  yarnCount: string | null;
  construction: string | null;
  season: string | null;
  manufacturerName: string | null;
  brandName: string | null;
  fabricSupplierName: string | null;
  vendorCode: string | null;
  dyeingHouse: string | null;
  processingHouse: string | null;
  washCareCode: string | null;
  merchandiserName: string | null;
  merchandiserEmail: string | null;
  applicantContact: string | null;
  applicantPhone: string | null;
  applicantEmail: string | null;

  packageType: TrfPackageType;
  previousReportNo: string | null;
  sampleStage: TrfSampleStage;
  finishType: TrfFinishType;
  buyingDepartment: string;
  buyingSubCategories: string[];
  selectedTests: string[];
  serviceRequired: TrfServiceLevel;

  /** Tri-state: null means neither YES nor NO was ticked, and the printed form leaves both
   *  boxes empty for a hand tick. Not the same as false, which is a real "NO". */
  reportDeliveryService: boolean | null;
  returnRemainedSample: boolean | null;
  contrastTrimUsed: boolean | null;
  setsPackingDifferentColour: boolean | null;

  remarks: string | null;
  printCount: number;
  lastPrintedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  style?: { id: string; styleCode: string; styleName: string } | null;
  customer?: { id: string; name: string; code: string } | null;
  testingLab?: { id: string; labName: string; labCode: string } | null;
  workOrder?: { id: string; workOrderNumber: string } | null;
  saleOrder?: { id: string; saleOrderNumber: string; buyerPoNumber: string | null } | null;
}

export type CreateBuyerTrfInput = Partial<Omit<BuyerTrf, 'id' | 'trfNumber' | 'createdAt' | 'updatedAt'>> & {
  styleId: string;
  buyingDepartment: string;
};

export type UpdateBuyerTrfInput = Partial<CreateBuyerTrfInput>;

export interface BuyerTrfQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: TrfStatus;
  styleId?: string;
  customerId?: string;
  sampleStage?: TrfSampleStage;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** What buildPrefill() derived, what it could not, and where each value came from. */
export interface BuyerTrfPrefill {
  values: Partial<BuyerTrf>;
  /** Printed labels of fields with no value — shown as a warning, and hatched on the sheet. */
  missingFields: string[];
  /** field → human description of the source, e.g. "greige Viscose Crepe 30×30". */
  sources: Record<string, string>;
}

/** Labels and print order, served from the backend catalogue so they are never re-typed here. */
export interface TrfOption {
  code: string;
  label: string;
}
export interface TrfTestOption extends TrfOption {
  column: 1 | 2 | 3;
}
export interface TrfSubCategoryOption extends TrfOption {
  department: string;
}

export interface TrfFormOptions {
  tests: TrfTestOption[];
  buyingDepartments: TrfOption[];
  buyingSubCategories: TrfSubCategoryOption[];
  finishTypes: TrfOption[];
  packageTypes: TrfOption[];
  sampleStages: TrfOption[];
  serviceLevels: TrfOption[];
  easybuyDefaults: Record<string, string | boolean>;
}

export interface PaginatedBuyerTrfs {
  data: BuyerTrf[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
