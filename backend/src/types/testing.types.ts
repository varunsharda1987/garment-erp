import { TestTemplateType, TestResult } from '@prisma/client';

// ============================================================================
// TESTING LABS
// ============================================================================

// BUG-TEST10 fix: Database entity type (raw Prisma shape)
// Note: accreditations is stored as JSON string in DB but transformed to string[]
// in API responses via formatLabResponse() in testingLabs.service.ts
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
  accreditations: string | null; // JSON array as string (DB storage format)
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

// BUG-TEST10 fix: API response type (after formatLabResponse transformation)
// Frontend should use this type for API responses
export interface TestingLabResponse {
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
  accreditations: string[]; // Parsed JSON array (API response format)
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
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
  accreditations?: string[]; // Will be JSON stringified
  isActive?: boolean;
}

export interface UpdateTestingLabInput {
  labCode?: string;
  labName?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  averageTurnaroundDays?: number;
  accreditations?: string[]; // Will be JSON stringified
  isActive?: boolean;
}

// ============================================================================
// TEST TEMPLATES
// ============================================================================

export interface TestTemplate {
  id: string;
  templateCode: string;
  templateName: string;
  templateType: TestTemplateType;
  requiredParams: string; // JSON array as string
  optionalParams: string | null; // JSON array as string
  toleranceRanges: string | null; // JSON object as string
  description: string | null;
  testingStandards: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToleranceRange {
  min?: number;
  max?: number;
  unit?: string; // "%" or "absolute"
}

export interface ToleranceRanges {
  gsm?: ToleranceRange;
  shrinkageLength?: ToleranceRange;
  shrinkageWidth?: ToleranceRange;
  [key: string]: ToleranceRange | undefined;
}

export interface CreateTestTemplateInput {
  templateCode: string;
  templateName: string;
  templateType: TestTemplateType;
  requiredParams: string[]; // Will be JSON stringified
  optionalParams?: string[]; // Will be JSON stringified
  toleranceRanges?: ToleranceRanges; // Will be JSON stringified
  description?: string;
  testingStandards?: string;
  isActive?: boolean;
}

export interface UpdateTestTemplateInput {
  templateCode?: string;
  templateName?: string;
  templateType?: TestTemplateType;
  requiredParams?: string[];
  optionalParams?: string[];
  toleranceRanges?: ToleranceRanges;
  description?: string;
  testingStandards?: string;
  isActive?: boolean;
}

// ============================================================================
// FABRIC PHYSICAL TESTS (FPT)
// ============================================================================

export interface FabricPhysicalTest {
  id: string;
  testNumber: string;

  // Fabric Linkage
  fabricId: string | null;
  fabricProcurementId: string | null;
  fabricStockLotId: string | null;
  styleId: string | null;
  customerId: string | null;

  // Test Sending
  sentToLabDate: Date | null;
  testingLabId: string | null;
  sampleQuantity: number | null;
  batchNumber: string | null;

  // Expected Parameters
  expectedGSM: number | null;
  expectedConstruction: string | null;
  expectedCount: string | null;
  toleranceGSM: number | null;

  // Test Results - Core
  testReportNumber: string | null;
  testResultReceivedDate: Date | null;
  testedGSM: number | null;
  gsmTestResult: TestResult | null;
  gsmVariance: number | null;
  testedConstruction: string | null;
  constructionTestResult: TestResult | null;
  testedCount: string | null;
  countTestResult: TestResult | null;

  // Additional Tests
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

  // Overall Status
  overallTestResult: TestResult;
  failureReason: string | null;
  remarks: string | null;

  // Retesting
  isRetest: boolean;
  originalTestId: string | null;
  retestReason: string | null;
  retestCount: number;

  // Approval
  approvedById: string | null;
  approvedDate: Date | null;
  adminOverride: boolean;
  overrideReason: string | null;

  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFabricPhysicalTestInput {
  // Fabric Linkage (at least one required)
  fabricId?: string;
  fabricProcurementId?: string;
  fabricStockLotId?: string;
  styleId?: string;
  customerId?: string;

  // Test Sending
  sentToLabDate?: Date;
  testingLabId?: string;
  sampleQuantity?: number;
  batchNumber?: string;

  // Expected Parameters
  expectedGSM?: number;
  expectedConstruction?: string;
  expectedCount?: string;
  toleranceGSM?: number;
}

export interface UpdateFabricPhysicalTestInput {
  // Test Sending
  sentToLabDate?: Date;
  testingLabId?: string;
  sampleQuantity?: number;
  batchNumber?: string;

  // Expected Parameters
  expectedGSM?: number;
  expectedConstruction?: string;
  expectedCount?: string;
  toleranceGSM?: number;

  // Test Results - Core
  testReportNumber?: string;
  testResultReceivedDate?: Date;
  testedGSM?: number;
  gsmTestResult?: TestResult;
  gsmVariance?: number;
  testedConstruction?: string;
  constructionTestResult?: TestResult;
  testedCount?: string;
  countTestResult?: TestResult;

  // Additional Tests
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

  // Overall Status
  overallTestResult?: TestResult;
  failureReason?: string;
  remarks?: string;

  // Approval
  adminOverride?: boolean;
  overrideReason?: string;
}

export interface RetestFabricInput {
  originalTestId: string;
  retestReason: string;
  sentToLabDate?: Date;
  testingLabId?: string;
  sampleQuantity?: number;
}

export interface ApproveFabricTestInput {
  adminOverride?: boolean;
  overrideReason?: string;
}

// ============================================================================
// GARMENT PHYSICAL TESTS (GPT)
// ============================================================================

export interface GarmentPhysicalTest {
  id: string;
  testNumber: string;

  // Garment Linkage
  workOrderId: string;
  styleId: string;
  customerId: string | null;
  sizeId: string | null;
  colorId: string | null;

  // Test Sending
  sentToLabDate: Date | null;
  testingLabId: string | null;
  sampleQuantity: number | null;
  batchNumber: string | null;

  // Dimensional Stability (Shrinkage)
  prewashLength: number | null;
  prewashWidth: number | null;
  prewashChest: number | null;
  postwashLength: number | null;
  postwashWidth: number | null;
  postwashChest: number | null;
  lengthShrinkage: number | null;
  widthShrinkage: number | null;
  shrinkageTestResult: TestResult | null;

  // Seam Strength
  seamStrength: number | null;
  seamTestResult: TestResult | null;

  // Color Fastness
  colorFastnessWash: string | null;
  colorFastnessRub: string | null;
  colorFastnessLight: string | null;
  colorTestResult: TestResult | null;

  // Additional Tests
  pilling: string | null;
  spirality: number | null;
  apparenceAfterWash: string | null;
  testReportUrl: string | null;

  // Overall Status
  overallTestResult: TestResult;
  failureReason: string | null;
  remarks: string | null;

  // Retesting
  isRetest: boolean;
  originalTestId: string | null;
  retestReason: string | null;
  retestCount: number;

  // Buyer Approval (CRITICAL for GPT)
  buyerApprovalRequired: boolean;
  buyerApprovedDate: Date | null;
  buyerApprovedBy: string | null;
  buyerRemarks: string | null;

  // Admin Approval
  approvedById: string | null;
  approvedDate: Date | null;
  adminOverride: boolean;
  overrideReason: string | null;

  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGarmentPhysicalTestInput {
  workOrderId: string;
  styleId: string;
  customerId?: string;
  sizeId?: string;
  colorId?: string;

  // Test Sending
  sentToLabDate?: Date;
  testingLabId?: string;
  sampleQuantity?: number;
  batchNumber?: string;

  // Buyer approval config
  buyerApprovalRequired?: boolean;
}

export interface UpdateGarmentPhysicalTestInput {
  // Test Sending
  sentToLabDate?: Date;
  testingLabId?: string;
  sampleQuantity?: number;
  batchNumber?: string;

  // Dimensional Stability
  prewashLength?: number;
  prewashWidth?: number;
  prewashChest?: number;
  postwashLength?: number;
  postwashWidth?: number;
  postwashChest?: number;
  lengthShrinkage?: number;
  widthShrinkage?: number;
  shrinkageTestResult?: TestResult;

  // Seam Strength
  seamStrength?: number;
  seamTestResult?: TestResult;

  // Color Fastness
  colorFastnessWash?: string;
  colorFastnessRub?: string;
  colorFastnessLight?: string;
  colorTestResult?: TestResult;

  // Additional Tests
  pilling?: string;
  spirality?: number;
  apparenceAfterWash?: string;
  testReportUrl?: string;

  // Overall Status
  overallTestResult?: TestResult;
  failureReason?: string;
  remarks?: string;

  // Buyer Approval
  buyerRemarks?: string;

  // Admin Approval
  adminOverride?: boolean;
  overrideReason?: string;
}

export interface RetestGarmentInput {
  originalTestId: string;
  retestReason: string;
  sentToLabDate?: Date;
  testingLabId?: string;
  sampleQuantity?: number;
}

export interface ApproveGarmentTestInput {
  adminOverride?: boolean;
  overrideReason?: string;
}

export interface BuyerApproveGarmentTestInput {
  buyerRemarks?: string;
}

// ============================================================================
// QUERY OPTIONS
// ============================================================================

export interface TestingLabQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  city?: string;
  state?: string;
}

export interface TestTemplateQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  templateType?: TestTemplateType;
  isActive?: boolean;
}

export interface FabricPhysicalTestQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  styleId?: string;
  customerId?: string;
  testingLabId?: string;
  overallTestResult?: TestResult;
  sentDateFrom?: string;
  sentDateTo?: string;
  receivedDateFrom?: string;
  receivedDateTo?: string;
  isRetest?: boolean;
  pendingApproval?: boolean;
}

export interface GarmentPhysicalTestQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  workOrderId?: string;
  styleId?: string;
  customerId?: string;
  testingLabId?: string;
  overallTestResult?: TestResult;
  sentDateFrom?: string;
  sentDateTo?: string;
  receivedDateFrom?: string;
  receivedDateTo?: string;
  isRetest?: boolean;
  pendingApproval?: boolean;
  pendingBuyerApproval?: boolean;
}
