import { z } from 'zod';
import { TestTemplateType, TestResult } from '@prisma/client';
import { formNumber } from './common.schema';

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
// LAB RESULT FIELDS (shared by FPT and GPT create / retest / update)
// ============================================================================
//
// This file is named *.schemas.ts, so the smart-check's strict-number and schema/service parity
// detectors (which scan *.schema.ts) do NOT cover it. The result fields below are therefore made
// blank-safe here, by hand: an HTML input posts '' for a cleared box, and a strict z.number() or
// z.string().url() answers that with a 400 the merchant only sees as "Invalid request data".

/** Trimmed free text; a cleared input is "no value", not an empty string. */
const blankText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/** A date input's value, with '' meaning "not set" rather than an Invalid Date. */
const blankDate = z.preprocess((v) => (v === '' ? null : v), z.coerce.date().nullable().optional());

/** The lab's PDF / portal link. '' is "none", anything else must be a real URL. */
const reportUrl = z.preprocess((v) => (v === '' ? null : v), z.string().url().nullable().optional());

const testResult = z.nativeEnum(TestResult);

/** What the lab reported, common to both kinds of test. */
const labReportFields = {
  testReportNumber: blankText(100),
  testResultReceivedDate: blankDate,
  testReportUrl: reportUrl,
  overallTestResult: testResult.optional(),
  failureReason: blankText(500),
  remarks: blankText(1000),
};

/** The fabric readings a lab report carries. */
const fabricReadingFields = {
  testedGSM: formNumber(z.number().int().positive()),
  gsmTestResult: testResult.optional().nullable(),
  gsmVariance: formNumber(),
  testedConstruction: blankText(100),
  constructionTestResult: testResult.optional().nullable(),
  testedCount: blankText(50),
  countTestResult: testResult.optional().nullable(),
  tensileStrengthWarp: formNumber(z.number().positive()),
  tensileStrengthWeft: formNumber(z.number().positive()),
  tearStrengthWarp: formNumber(z.number().positive()),
  tearStrengthWeft: formNumber(z.number().positive()),
  shrinkageLength: formNumber(),
  shrinkageWidth: formNumber(),
  colorFastness: blankText(100),
  pilling: blankText(50),
  spirality: formNumber(),
};

/** The garment readings a lab report carries. */
const garmentReadingFields = {
  prewashLength: formNumber(z.number().positive()),
  prewashWidth: formNumber(z.number().positive()),
  prewashChest: formNumber(z.number().positive()),
  postwashLength: formNumber(z.number().positive()),
  postwashWidth: formNumber(z.number().positive()),
  postwashChest: formNumber(z.number().positive()),
  lengthShrinkage: formNumber(),
  widthShrinkage: formNumber(),
  shrinkageTestResult: testResult.optional().nullable(),
  seamStrength: formNumber(z.number().positive()),
  seamTestResult: testResult.optional().nullable(),
  colorFastnessWash: blankText(50),
  colorFastnessRub: blankText(50),
  colorFastnessLight: blankText(50),
  colorTestResult: testResult.optional().nullable(),
  pilling: blankText(50),
  spirality: formNumber(),
  apparenceAfterWash: blankText(200),
};

/**
 * The lab round (Test Requirement Form) a result came back against. Accepted on create and retest
 * only — never on update, so a recorded result is never re-pointed at another round. One test of
 * each kind per TRF (unique in the DB); the service answers a duplicate with a 409.
 */
const trfLink = { trfId: z.string().uuid().optional() };

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
    sentToLabDate: z.coerce.date().optional(),
    testingLabId: z.string().uuid().optional(),
    sampleQuantity: z.number().positive().optional(),
    batchNumber: z.string().max(100).optional(),

    // Expected Parameters
    expectedGSM: z.number().int().positive().optional(),
    expectedConstruction: z.string().max(100).optional(),
    expectedCount: z.string().max(50).optional(),
    toleranceGSM: z.number().optional(),

    // Recording a lab round's result is one POST, one row — no create-then-update window.
    ...trfLink,
    ...labReportFields,
    ...fabricReadingFields,
  })
  .refine((data) => data.fabricId || data.fabricProcurementId || data.fabricStockLotId || data.styleId || data.trfId, {
    message: 'At least one linkage (fabricId, fabricProcurementId, fabricStockLotId, styleId, or trfId) is required',
  });

export const updateFabricPhysicalTestSchema = z.object({
  // Test Sending
  sentToLabDate: z.coerce.date().optional().nullable(),
  testingLabId: z.string().uuid().optional().nullable(),
  sampleQuantity: z.number().positive().optional().nullable(),
  batchNumber: z.string().max(100).optional().nullable(),

  // Expected Parameters
  expectedGSM: z.number().int().positive().optional().nullable(),
  expectedConstruction: z.string().max(100).optional().nullable(),
  expectedCount: z.string().max(50).optional().nullable(),
  toleranceGSM: z.number().optional().nullable(),

  // Test results. adminOverride / overrideReason are deliberately NOT here: an override is made
  // only through POST /:id/approve, which also records who approved it. Until 2026-09-23 a PUT
  // could set adminOverride with no approver — and an overridden test is skipped by the cutting gate.
  ...labReportFields,
  ...fabricReadingFields,
});

export const retestFabricSchema = z.object({
  originalTestId: z.string().uuid(),
  retestReason: z.string().min(1, 'Retest reason is required').max(500),
  sentToLabDate: z.coerce.date().optional(),
  testingLabId: z.string().uuid().optional(),
  sampleQuantity: z.number().positive().optional(),
  ...trfLink,
  ...labReportFields,
  ...fabricReadingFields,
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
  sentDateFrom: z.coerce.date().optional(),
  sentDateTo: z.coerce.date().optional(),
  receivedDateFrom: z.coerce.date().optional(),
  receivedDateTo: z.coerce.date().optional(),
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

export const createGarmentPhysicalTestSchema = z
  .object({
    /** The production run — absent for a sample's garment test (done on the PP sample before it is
     *  sent, when no work order exists yet). Then `trfId` (the sample's lab round) is required. */
    workOrderId: z.string().uuid().optional(),
    styleId: z.string().uuid(),
    customerId: z.string().uuid().optional(),
    sizeId: z.string().uuid().optional(),
    colorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID' }).optional(),

    // Test Sending
    sentToLabDate: z.coerce.date().optional(),
    testingLabId: z.string().uuid().optional(),
    sampleQuantity: z.number().positive().optional(),

    // Buyer approval config
    buyerApprovalRequired: z.boolean().optional().default(false),

    // Recording a lab round's result is one POST, one row.
    ...trfLink,
    ...labReportFields,
    ...garmentReadingFields,
  })
  // Mirrors the DB CHECK gpt_anchor_work_order_or_trf, so the API answers a readable 400 rather
  // than a 23514 surfacing as a 500.
  .refine((data) => data.workOrderId || data.trfId, {
    message: 'A garment test needs a work order or a test requirement form (lab round)',
    path: ['workOrderId'],
  });

export const updateGarmentPhysicalTestSchema = z.object({
  // Test Sending
  sentToLabDate: z.coerce.date().optional().nullable(),
  testingLabId: z.string().uuid().optional().nullable(),
  sampleQuantity: z.number().positive().optional().nullable(),

  // Test results — including testReportNumber / testResultReceivedDate, which this schema lacked
  // until 2026-09-23, so a GPT's lab report number was stripped and could never be stored.
  // adminOverride / overrideReason are NOT here: overrides go through POST /:id/approve only.
  ...labReportFields,
  ...garmentReadingFields,

  // Buyer Approval
  buyerRemarks: z.string().max(1000).optional().nullable(),
});

export const retestGarmentSchema = z.object({
  originalTestId: z.string().uuid(),
  retestReason: z.string().min(1, 'Retest reason is required').max(500),
  sentToLabDate: z.coerce.date().optional(),
  testingLabId: z.string().uuid().optional(),
  sampleQuantity: z.number().positive().optional(),
  ...trfLink,
  ...labReportFields,
  ...garmentReadingFields,
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
  sentDateFrom: z.coerce.date().optional(),
  sentDateTo: z.coerce.date().optional(),
  receivedDateFrom: z.coerce.date().optional(),
  receivedDateTo: z.coerce.date().optional(),
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

/**
 * The result columns a create / retest may write, taken from the schema fragments above so the
 * services cannot drift from what the API accepts (the schema/service parity check does not scan
 * this *.schemas.ts file — this list is that check, by construction).
 */
export const FABRIC_RESULT_KEYS = [...Object.keys(labReportFields), ...Object.keys(fabricReadingFields)] as const;
export const GARMENT_RESULT_KEYS = [...Object.keys(labReportFields), ...Object.keys(garmentReadingFields)] as const;
