import { z } from 'zod';
import { TestTemplateType, TestResult } from '@prisma/client';

// Helper for validating IDs that can be UUID or CUID (color_master uses CUID)
const isValidIdFormat = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val);

// ============================================================================
// TESTING LABS SCHEMAS
// ============================================================================

export const createTestingLabSchema = z.object({
  labCode: z.string().min(1, 'Lab code is required').max(50),
  labName: z.string().min(1, 'Lab name is required').max(200),
  contactPerson: z.string().max(100).optional(),
  contactEmail: z.string().email('Invalid email format').optional(),
  contactPhone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  averageTurnaroundDays: z.number().int().min(1).max(60).optional().default(7),
  accreditations: z.array(z.string()).optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateTestingLabSchema = z.object({
  labCode: z.string().min(1).max(50).optional(),
  labName: z.string().min(1).max(200).optional(),
  contactPerson: z.string().max(100).optional().nullable(),
  contactEmail: z.string().email('Invalid email format').optional().nullable(),
  contactPhone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().max(10).optional().nullable(),
  averageTurnaroundDays: z.number().int().min(1).max(60).optional(),
  accreditations: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const testingLabQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val ? val === 'true' : undefined)),
  city: z.string().optional(),
  state: z.string().optional(),
});

// ============================================================================
// TEST TEMPLATES SCHEMAS
// ============================================================================

const toleranceRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional(),
});

export const createTestTemplateSchema = z.object({
  templateCode: z.string().min(1, 'Template code is required').max(50),
  templateName: z.string().min(1, 'Template name is required').max(200),
  templateType: z.nativeEnum(TestTemplateType),
  requiredParams: z.array(z.string()).min(1, 'At least one required parameter needed'),
  optionalParams: z.array(z.string()).optional(),
  toleranceRanges: z.record(z.string(), toleranceRangeSchema).optional(),
  description: z.string().max(1000).optional(),
  testingStandards: z.string().max(500).optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateTestTemplateSchema = z.object({
  templateCode: z.string().min(1).max(50).optional(),
  templateName: z.string().min(1).max(200).optional(),
  templateType: z.nativeEnum(TestTemplateType).optional(),
  requiredParams: z.array(z.string()).min(1).optional(),
  optionalParams: z.array(z.string()).optional().nullable(),
  toleranceRanges: z.record(z.string(), toleranceRangeSchema).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  testingStandards: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const testTemplateQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
  search: z.string().optional(),
  templateType: z.nativeEnum(TestTemplateType).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val ? val === 'true' : undefined)),
});

// ============================================================================
// FABRIC PHYSICAL TESTS SCHEMAS
// ============================================================================

export const createFabricPhysicalTestSchema = z
  .object({
    // Fabric Linkage (at least one required)
    fabricId: z.string().uuid().optional(),
    fabricProcurementId: z.string().uuid().optional(),
    fabricStockLotId: z.string().uuid().optional(),
    styleId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),

    // Test Sending
    sentToLabDate: z.string().datetime().optional(),
    testingLabId: z.string().uuid().optional(),
    sampleQuantity: z.number().positive().optional(),
    batchNumber: z.string().max(100).optional(),

    // Expected Parameters
    expectedGSM: z.number().int().positive().optional(),
    expectedConstruction: z.string().max(100).optional(),
    expectedCount: z.string().max(50).optional(),
    toleranceGSM: z.number().optional(),
  })
  .refine((data) => data.fabricId || data.fabricProcurementId || data.fabricStockLotId || data.styleId, {
    message: 'At least one linkage (fabricId, fabricProcurementId, fabricStockLotId, or styleId) is required',
  });

export const updateFabricPhysicalTestSchema = z.object({
  // Test Sending
  sentToLabDate: z.string().datetime().optional().nullable(),
  testingLabId: z.string().uuid().optional().nullable(),
  sampleQuantity: z.number().positive().optional().nullable(),
  batchNumber: z.string().max(100).optional().nullable(),

  // Expected Parameters
  expectedGSM: z.number().int().positive().optional().nullable(),
  expectedConstruction: z.string().max(100).optional().nullable(),
  expectedCount: z.string().max(50).optional().nullable(),
  toleranceGSM: z.number().optional().nullable(),

  // Test Results - Core
  testReportNumber: z.string().max(100).optional().nullable(),
  testResultReceivedDate: z.string().datetime().optional().nullable(),
  testedGSM: z.number().int().positive().optional().nullable(),
  gsmTestResult: z.nativeEnum(TestResult).optional().nullable(),
  gsmVariance: z.number().optional().nullable(),
  testedConstruction: z.string().max(100).optional().nullable(),
  constructionTestResult: z.nativeEnum(TestResult).optional().nullable(),
  testedCount: z.string().max(50).optional().nullable(),
  countTestResult: z.nativeEnum(TestResult).optional().nullable(),

  // Additional Tests
  tensileStrengthWarp: z.number().positive().optional().nullable(),
  tensileStrengthWeft: z.number().positive().optional().nullable(),
  tearStrengthWarp: z.number().positive().optional().nullable(),
  tearStrengthWeft: z.number().positive().optional().nullable(),
  shrinkageLength: z.number().optional().nullable(),
  shrinkageWidth: z.number().optional().nullable(),
  colorFastness: z.string().max(100).optional().nullable(),
  pilling: z.string().max(50).optional().nullable(),
  spirality: z.number().optional().nullable(),
  testReportUrl: z.string().url().optional().nullable(),

  // Overall Status
  overallTestResult: z.nativeEnum(TestResult).optional(),
  failureReason: z.string().max(500).optional().nullable(),
  remarks: z.string().max(1000).optional().nullable(),

  // Approval
  adminOverride: z.boolean().optional(),
  overrideReason: z.string().max(500).optional().nullable(),
});

export const retestFabricSchema = z.object({
  originalTestId: z.string().uuid(),
  retestReason: z.string().min(1, 'Retest reason is required').max(500),
  sentToLabDate: z.string().datetime().optional(),
  testingLabId: z.string().uuid().optional(),
  sampleQuantity: z.number().positive().optional(),
});

export const approveFabricTestSchema = z
  .object({
    adminOverride: z.boolean().optional().default(false),
    overrideReason: z.string().max(500).optional(),
  })
  .refine((data) => !data.adminOverride || (data.adminOverride && data.overrideReason), {
    message: 'Override reason is required when admin override is true',
    path: ['overrideReason'],
  });

export const fabricPhysicalTestQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
  search: z.string().optional(),
  styleId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  testingLabId: z.string().uuid().optional(),
  overallTestResult: z.nativeEnum(TestResult).optional(),
  sentDateFrom: z.string().datetime().optional(),
  sentDateTo: z.string().datetime().optional(),
  receivedDateFrom: z.string().datetime().optional(),
  receivedDateTo: z.string().datetime().optional(),
  isRetest: z
    .string()
    .optional()
    .transform((val) => (val ? val === 'true' : undefined)),
  pendingApproval: z
    .string()
    .optional()
    .transform((val) => (val ? val === 'true' : undefined)),
});

// ============================================================================
// GARMENT PHYSICAL TESTS SCHEMAS
// ============================================================================

export const createGarmentPhysicalTestSchema = z.object({
  workOrderId: z.string().uuid(),
  styleId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  sizeId: z.string().uuid().optional(),
  colorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID' }).optional(),

  // Test Sending
  sentToLabDate: z.string().datetime().optional(),
  testingLabId: z.string().uuid().optional(),
  sampleQuantity: z.number().positive().optional(),
  batchNumber: z.string().max(100).optional(),

  // Buyer approval config
  buyerApprovalRequired: z.boolean().optional().default(false),
});

export const updateGarmentPhysicalTestSchema = z.object({
  // Test Sending
  sentToLabDate: z.string().datetime().optional().nullable(),
  testingLabId: z.string().uuid().optional().nullable(),
  sampleQuantity: z.number().positive().optional().nullable(),
  batchNumber: z.string().max(100).optional().nullable(),

  // Dimensional Stability
  prewashLength: z.number().positive().optional().nullable(),
  prewashWidth: z.number().positive().optional().nullable(),
  prewashChest: z.number().positive().optional().nullable(),
  postwashLength: z.number().positive().optional().nullable(),
  postwashWidth: z.number().positive().optional().nullable(),
  postwashChest: z.number().positive().optional().nullable(),
  lengthShrinkage: z.number().optional().nullable(),
  widthShrinkage: z.number().optional().nullable(),
  shrinkageTestResult: z.nativeEnum(TestResult).optional().nullable(),

  // Seam Strength
  seamStrength: z.number().positive().optional().nullable(),
  seamTestResult: z.nativeEnum(TestResult).optional().nullable(),

  // Color Fastness
  colorFastnessWash: z.string().max(50).optional().nullable(),
  colorFastnessRub: z.string().max(50).optional().nullable(),
  colorFastnessLight: z.string().max(50).optional().nullable(),
  colorTestResult: z.nativeEnum(TestResult).optional().nullable(),

  // Additional Tests
  pilling: z.string().max(50).optional().nullable(),
  spirality: z.number().optional().nullable(),
  fabricWeight: z.number().positive().optional().nullable(),
  appearance: z.string().max(200).optional().nullable(),
  testReportUrl: z.string().url().optional().nullable(),

  // Overall Status
  overallTestResult: z.nativeEnum(TestResult).optional(),
  failureReason: z.string().max(500).optional().nullable(),
  remarks: z.string().max(1000).optional().nullable(),

  // Buyer Approval
  buyerRemarks: z.string().max(1000).optional().nullable(),

  // Admin Approval
  adminOverride: z.boolean().optional(),
  overrideReason: z.string().max(500).optional().nullable(),
});

export const retestGarmentSchema = z.object({
  originalTestId: z.string().uuid(),
  retestReason: z.string().min(1, 'Retest reason is required').max(500),
  sentToLabDate: z.string().datetime().optional(),
  testingLabId: z.string().uuid().optional(),
  sampleQuantity: z.number().positive().optional(),
});

export const approveGarmentTestSchema = z
  .object({
    adminOverride: z.boolean().optional().default(false),
    overrideReason: z.string().max(500).optional(),
  })
  .refine((data) => !data.adminOverride || (data.adminOverride && data.overrideReason), {
    message: 'Override reason is required when admin override is true',
    path: ['overrideReason'],
  });

export const buyerApproveGarmentTestSchema = z.object({
  buyerRemarks: z.string().max(1000).optional(),
});

export const garmentPhysicalTestQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
  search: z.string().optional(),
  workOrderId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  testingLabId: z.string().uuid().optional(),
  overallTestResult: z.nativeEnum(TestResult).optional(),
  sentDateFrom: z.string().datetime().optional(),
  sentDateTo: z.string().datetime().optional(),
  receivedDateFrom: z.string().datetime().optional(),
  receivedDateTo: z.string().datetime().optional(),
  isRetest: z
    .string()
    .optional()
    .transform((val) => (val ? val === 'true' : undefined)),
  pendingApproval: z
    .string()
    .optional()
    .transform((val) => (val ? val === 'true' : undefined)),
  pendingBuyerApproval: z
    .string()
    .optional()
    .transform((val) => (val ? val === 'true' : undefined)),
});
// Schema validation fix
