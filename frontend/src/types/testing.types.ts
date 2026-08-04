// Mirror backend types for testing modules

export const TestTemplateType = {
  FPT: 'FPT',
  GPT: 'GPT',
} as const;
export type TestTemplateType = (typeof TestTemplateType)[keyof typeof TestTemplateType];

export const TestResult = {
  PENDING: 'PENDING',
  PASS: 'PASS',
  FAIL: 'FAIL',
  RETEST_REQUIRED: 'RETEST_REQUIRED',
  CONDITIONAL_PASS: 'CONDITIONAL_PASS',
} as const;
export type TestResult = (typeof TestResult)[keyof typeof TestResult];

// ============================================================================
// TESTING LABS
// ============================================================================

// BUG-TEST10 fix: This matches TestingLabResponse in backend (not raw TestingLab)
// Backend stores accreditations as JSON string in DB but transforms to string[]
// via formatLabResponse() before sending API response
export interface TestingLab {
  id: string;
  labCode: string;
  labName: string;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  averageTurnaroundDays: number;
  accreditations: string[]; // Parsed from JSON string by backend formatLabResponse()
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count?: {
    fabricTests: number;
    garmentTests: number;
    customerDefaults?: number;
  };
}

export interface CreateTestingLabInput {
  labCode: string;
  labName: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  averageTurnaroundDays?: number;
  accreditations?: string[];
  isActive?: boolean;
}

export type UpdateTestingLabInput = Partial<CreateTestingLabInput>;

// ============================================================================
// TEST TEMPLATES
// ============================================================================

export interface ToleranceRange {
  min?: number;
  max?: number;
  unit?: string;
}

export interface ToleranceRanges {
  gsm?: ToleranceRange;
  shrinkageLength?: ToleranceRange;
  shrinkageWidth?: ToleranceRange;
  [key: string]: ToleranceRange | undefined;
}

export interface TestTemplate {
  id: string;
  templateCode: string;
  templateName: string;
  templateType: TestTemplateType;
  requiredParams: string[];
  optionalParams: string[] | null;
  toleranceRanges: ToleranceRanges | null;
  description: string | null;
  testingStandards: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestTemplateInput {
  templateCode: string;
  templateName: string;
  templateType: TestTemplateType;
  requiredParams: string[];
  optionalParams?: string[];
  toleranceRanges?: ToleranceRanges;
  description?: string;
  testingStandards?: string;
  isActive?: boolean;
}

export type UpdateTestTemplateInput = Partial<CreateTestTemplateInput>;

// ============================================================================
// FABRIC PHYSICAL TESTS
// ============================================================================

export interface FabricPhysicalTest {
  id: string;
  testNumber: string;
  fabricId: string | null;
  fabricProcurementId: string | null;
  fabricStockLotId: string | null;
  styleId: string | null;
  customerId: string | null;
  sentToLabDate: string | null;
  testingLabId: string | null;
  sampleQuantity: number | null;
  batchNumber: string | null;
  expectedGSM: number | null;
  expectedConstruction: string | null;
  expectedCount: string | null;
  toleranceGSM: number | null;
  testReportNumber: string | null;
  testResultReceivedDate: string | null;
  testedGSM: number | null;
  gsmTestResult: TestResult | null;
  gsmVariance: number | null;
  testedConstruction: string | null;
  constructionTestResult: TestResult | null;
  testedCount: string | null;
  countTestResult: TestResult | null;
  tensileStrengthWarp: number | null;
  tensileStrengthWeft: number | null;
  tearStrengthWarp: number | null;
  tearStrengthWeft: number | null;
  shrinkageLength: number | null;
  shrinkageWidth: number | null;
  colorFastness: string | null;
  pilling: string | null;
  spirality: number | null;
  testReportUrl: string | null;
  overallTestResult: TestResult;
  failureReason: string | null;
  remarks: string | null;
  isRetest: boolean;
  originalTestId: string | null;
  retestReason: string | null;
  retestCount: number;
  approvedById: string | null;
  approvedDate: string | null;
  adminOverride: boolean;
  overrideReason: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFabricPhysicalTestInput {
  fabricId?: string;
  fabricProcurementId?: string;
  fabricStockLotId?: string;
  styleId?: string;
  customerId?: string;
  sentToLabDate?: string;
  testingLabId?: string;
  sampleQuantity?: number;
  batchNumber?: string;
  expectedGSM?: number;
  expectedConstruction?: string;
  expectedCount?: string;
  toleranceGSM?: number;
}

export interface UpdateFabricPhysicalTestInput {
  sentToLabDate?: string;
  testingLabId?: string;
  sampleQuantity?: number;
  batchNumber?: string;
  expectedGSM?: number;
  expectedConstruction?: string;
  expectedCount?: string;
  toleranceGSM?: number;
  testReportNumber?: string;
  testResultReceivedDate?: string;
  testedGSM?: number;
  gsmTestResult?: TestResult;
  gsmVariance?: number;
  testedConstruction?: string;
  constructionTestResult?: TestResult;
  testedCount?: string;
  countTestResult?: TestResult;
  tensileStrengthWarp?: number;
  tensileStrengthWeft?: number;
  tearStrengthWarp?: number;
  tearStrengthWeft?: number;
  shrinkageLength?: number;
  shrinkageWidth?: number;
  colorFastness?: string;
  pilling?: string;
  spirality?: number;
  testReportUrl?: string;
  overallTestResult?: TestResult;
  failureReason?: string;
  remarks?: string;
  adminOverride?: boolean;
  overrideReason?: string;
}

// ============================================================================
// GARMENT PHYSICAL TESTS
// ============================================================================

export interface GarmentPhysicalTest {
  id: string;
  testNumber: string;
  workOrderId: string;
  styleId: string;
  customerId: string | null;
  sizeId: string | null;
  colorId: string | null;
  sentToLabDate: string | null;
  testingLabId: string | null;
  sampleQuantity: number | null;
  prewashLength: number | null;
  prewashWidth: number | null;
  prewashChest: number | null;
  postwashLength: number | null;
  postwashWidth: number | null;
  postwashChest: number | null;
  lengthShrinkage: number | null;
  widthShrinkage: number | null;
  shrinkageTestResult: TestResult | null;
  seamStrength: number | null;
  seamTestResult: TestResult | null;
  colorFastnessWash: string | null;
  colorFastnessRub: string | null;
  colorFastnessLight: string | null;
  colorTestResult: TestResult | null;
  pilling: string | null;
  spirality: number | null;
  apparenceAfterWash: string | null;
  testReportUrl: string | null;
  overallTestResult: TestResult;
  failureReason: string | null;
  remarks: string | null;
  isRetest: boolean;
  originalTestId: string | null;
  retestReason: string | null;
  retestCount: number;
  buyerApprovalRequired: boolean;
  buyerApprovedDate: string | null;
  buyerApprovedBy: string | null;
  buyerRemarks: string | null;
  approvedById: string | null;
  approvedDate: string | null;
  adminOverride: boolean;
  overrideReason: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  workOrder?: { id: string; workOrderNumber: string } | null;
  style?: { id: string; styleCode: string; styleName: string; buyerStyleRef?: string | null } | null;
}

export interface CreateGarmentPhysicalTestInput {
  workOrderId: string;
  styleId: string;
  customerId?: string;
  sizeId?: string;
  colorId?: string;
  sentToLabDate?: string;
  testingLabId?: string;
  sampleQuantity?: number;
  buyerApprovalRequired?: boolean;
}

export interface UpdateGarmentPhysicalTestInput {
  sentToLabDate?: string;
  testingLabId?: string;
  sampleQuantity?: number;
  prewashLength?: number;
  prewashWidth?: number;
  prewashChest?: number;
  postwashLength?: number;
  postwashWidth?: number;
  postwashChest?: number;
  lengthShrinkage?: number;
  widthShrinkage?: number;
  shrinkageTestResult?: TestResult;
  seamStrength?: number;
  seamTestResult?: TestResult;
  colorFastnessWash?: string;
  colorFastnessRub?: string;
  colorFastnessLight?: string;
  colorTestResult?: TestResult;
  pilling?: string;
  spirality?: number;
  apparenceAfterWash?: string;
  testReportUrl?: string;
  overallTestResult?: TestResult;
  failureReason?: string;
  remarks?: string;
  buyerRemarks?: string;
  adminOverride?: boolean;
  overrideReason?: string;
}

// ============================================================================
// TESTING LAB STATS
// ============================================================================

export interface TestingLabStats {
  labId: string;
  labCode: string;
  labName: string;
  totalTests: number;
  completedTests: number;
  pendingTests: number;
  passedTests: number;
  failedTests: number;
  passRate: string;
  averageTurnaroundExpected: number;
  averageTurnaroundActual: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}
