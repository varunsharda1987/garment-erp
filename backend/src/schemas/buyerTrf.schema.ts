/**
 * Buyer Test Requirement Form (TRF) — request validation.
 *
 * Single source of truth for what the API accepts. Enum values come from
 * ./generated/prisma-enums (regenerated from schema.prisma) rather than being re-typed here,
 * which is what keeps the enum-drift check meaningful.
 *
 * Note there is no numeric body field on this module, deliberately: `fabricWeightGsm` is a
 * string because the greige holds ranges ("140-150") as often as a number ("122 GSM"). If a
 * real numeric field is ever added it must use formNumber() from ./common.schema — an
 * optional z.number() 400s on every save once an HTML input posts "" for a cleared box.
 */

import { z } from 'zod';
import {
  TrfStatusEnum,
  TrfPackageTypeEnum,
  TrfSampleStageEnum,
  TrfFinishTypeEnum,
  TrfServiceLevelEnum,
  TrfBuyingDepartmentEnum,
  TrfBuyingSubCategoryEnum,
  TrfTestCodeEnum,
} from './generated/prisma-enums';

/** Trimmed free text that treats a cleared input as "no value" rather than an empty string. */
const text = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/**
 * The printed identity block. Every one of these is pre-filled by buildPrefill() and then
 * editable — the merchant corrects what the ERP got wrong (most often fibre content, which we
 * hold as "100% Viscose" and Easybuy want as "100% RAYON") before printing.
 */
const identityFields = {
  sampleDescription: text(),
  endUse: text(),
  boNumber: text(),
  styleNo: text(),
  buyerStyleRef: text(),
  colour: text(),
  fibreContent: text(),
  ageRangeCategory: text(),
  orderNumber: text(),
  fabricWeightGsm: text(100),
  yarnCount: text(100),
  construction: text(100),
  season: text(100),
  manufacturerName: text(),
  brandName: text(),
  fabricSupplierName: text(),
  vendorCode: text(100),
  dyeingHouse: text(),
  processingHouse: text(),
  washCareCode: text(100),
  merchandiserName: text(),
  merchandiserEmail: text(),
  applicantContact: text(),
  applicantPhone: text(50),
  applicantEmail: text(),
  previousReportNo: text(),
  remarks: z.string().trim().max(2000).nullable().optional(),
};

/**
 * The tick groups.
 *
 * The four Boolean fields are `.nullable()` on purpose: null means neither YES nor NO was
 * ticked, and the sheet then prints two empty boxes for someone to complete by hand. Coercing
 * them to false would make the form assert a "NO" the merchant never chose.
 */
const tickFields = {
  packageType: TrfPackageTypeEnum.optional(),
  sampleStage: TrfSampleStageEnum.optional(),
  finishType: TrfFinishTypeEnum.optional(),
  serviceRequired: TrfServiceLevelEnum.optional(),
  buyingSubCategories: z.array(TrfBuyingSubCategoryEnum).max(13).optional(),
  selectedTests: z.array(TrfTestCodeEnum).max(33).optional(),
  reportDeliveryService: z.boolean().nullable().optional(),
  returnRemainedSample: z.boolean().nullable().optional(),
  contrastTrimUsed: z.boolean().nullable().optional(),
  setsPackingDifferentColour: z.boolean().nullable().optional(),
};

/**
 * Links that are context, not anchors.
 *
 * `sampleId` — the Sample Tracker sample this lab round was submitted for (one TRF per round; the
 * service checks the sample belongs to the same style and buyer). `greigeId` — the fabric the printed
 * fabric block came from; buildPrefill() derives it and it is what lets a wash-care code typed on the
 * form be remembered against (buyer, fabric). It was missing from this schema until 2026-09-23, so it
 * was silently dropped on every save and that remembering never happened.
 */
const linkFields = {
  sampleId: z.string().uuid().nullable().optional(),
  greigeId: z.string().uuid().nullable().optional(),
};

/**
 * Exactly one anchor: the work order the sample came out of, OR the buyer order it is for.
 *
 * Mirrored by the DB constraint buyer_trf_anchor_xor. This refine exists so the API answers a
 * readable 400 instead of letting Postgres raise a 23514 that surfaces as a 500.
 */
function refineAnchor(data: { workOrderId?: string | null; saleOrderId?: string | null }, ctx: z.RefinementCtx): void {
  const count = (data.workOrderId ? 1 : 0) + (data.saleOrderId ? 1 : 0);
  if (count === 1) return;

  ctx.addIssue({
    code: 'custom',
    path: ['workOrderId'],
    message:
      count === 0
        ? 'A TRF must be linked to either a work order or a sale order'
        : 'A TRF can be linked to a work order or a sale order, not both',
  });
}

export const createBuyerTrfSchema = z
  .object({
    styleId: z.string().uuid('Select a style'),
    /** Resolved server-side when omitted — styles.customerId is null on every style, so the
     *  buyer comes from the anchor or from the denormalized styles.customerName. */
    customerId: z.string().uuid().optional(),
    workOrderId: z.string().uuid().nullable().optional(),
    saleOrderId: z.string().uuid().nullable().optional(),
    testingLabId: z.string().uuid().nullable().optional(),

    trfDate: z.coerce.date().optional(),
    status: TrfStatusEnum.optional(),

    /** Required: there is no sensible default department, and a blank one prints a form the
     *  lab will reject. The frontend pre-selects Easybuy's WOMENS_WEAR. */
    buyingDepartment: TrfBuyingDepartmentEnum,

    ...linkFields,
    ...identityFields,
    ...tickFields,
  })
  .superRefine(refineAnchor);

/**
 * Update.
 *
 * The anchor rule cannot be fully checked here — a patch that sets only `saleOrderId` is valid
 * or invalid depending on whether `workOrderId` is already set on the stored row, and Zod
 * cannot see that row. So this catches only what is decidable from the payload alone (both
 * sent, or both explicitly cleared); buyerTrfService.update() re-checks the merged result.
 */
export const updateBuyerTrfSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    workOrderId: z.string().uuid().nullable().optional(),
    saleOrderId: z.string().uuid().nullable().optional(),
    testingLabId: z.string().uuid().nullable().optional(),

    trfDate: z.coerce.date().optional(),
    status: TrfStatusEnum.optional(),
    buyingDepartment: TrfBuyingDepartmentEnum.optional(),

    ...linkFields,
    ...identityFields,
    ...tickFields,
  })
  .superRefine((data, ctx) => {
    const sentWork = data.workOrderId !== undefined;
    const sentSale = data.saleOrderId !== undefined;
    if (!sentWork && !sentSale) return; // anchor untouched — the service checks the merged row

    if (sentWork && sentSale) refineAnchor(data, ctx);
  });

export const buyerTrfQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  search: z.string().trim().optional(),
  status: TrfStatusEnum.optional(),
  styleId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  testingLabId: z.string().uuid().optional(),
  /** The lab rounds of one Sample Tracker sample. */
  sampleId: z.string().uuid().optional(),
  sampleStage: TrfSampleStageEnum.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sortBy: z.enum(['trfNumber', 'trfDate', 'createdAt', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Query for GET /buyer-trfs/prefill — the same anchor rule as create.
 *
 * `sampleId` pre-ticks the sample stage from the sample's type. `retestOfTrfId` starts the next lab
 * round: the previous TRF's printed values are carried over (hand edits included) and the sheet is
 * switched to RETEST with the previous round's report number.
 */
export const buyerTrfPrefillQuerySchema = z
  .object({
    styleId: z.string().uuid('Select a style'),
    workOrderId: z.string().uuid().optional(),
    saleOrderId: z.string().uuid().optional(),
    sampleId: z.string().uuid().optional(),
    retestOfTrfId: z.string().uuid().optional(),
  })
  .superRefine(refineAnchor);

export type CreateBuyerTrfInput = z.infer<typeof createBuyerTrfSchema>;
export type UpdateBuyerTrfInput = z.infer<typeof updateBuyerTrfSchema>;
export type BuyerTrfQueryInput = z.infer<typeof buyerTrfQuerySchema>;
export type BuyerTrfPrefillQueryInput = z.infer<typeof buyerTrfPrefillQuerySchema>;

/**
 * The columns update() may write, and the ONLY list it iterates.
 *
 * Kept next to the schema so the two cannot drift: a field added to updateBuyerTrfSchema but
 * missing from the service's Prisma `data` block is accepted by the API and silently ignored —
 * the exact bug the schema↔service update-parity check exists to catch. With ~40 columns,
 * hand-listing them twice was the likeliest way for that to happen here.
 */
export const BUYER_TRF_UPDATABLE_FIELDS = [
  'customerId',
  'workOrderId',
  'saleOrderId',
  'testingLabId',
  'trfDate',
  'status',
  'buyingDepartment',
  ...Object.keys(linkFields),
  ...Object.keys(identityFields),
  ...Object.keys(tickFields),
] as const;
