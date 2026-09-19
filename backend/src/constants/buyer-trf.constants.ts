/**
 * Buyer Test Requirement Form (TRF) — the print catalog.
 *
 * Every label, and the order it prints in, lives HERE and nowhere else. The doc-data
 * adapter, the prefill, and the frontend (via GET /api/buyer-trfs/form-options) all read
 * this file, so a label is never re-typed in a template or a React page.
 *
 * The labels are transcribed verbatim from the buyer's own Word form:
 *   Z:\1. Kashaya Fabs\...\TRF form\NEW TRF\
 *     Lifestyle International Pvt Ltd - Easy Buy TRF - 30 Mar 2026 (002) New.docx
 *
 * Verbatim means verbatim — the inconsistent casing ("inner Wear"), the en-dash in
 * "Laundering – 3 wash" versus the hyphen in "Dry cleaning - 1 Cycle", and the American
 * "Color"/"Fiber" spellings are all the buyer's. Do not tidy them: this sheet is read by
 * Intertek against Easybuy's own master, and a "corrected" label is a mismatch.
 *
 * The `code` values must stay in lockstep with the Prisma enums of the same name
 * (TrfTestCode, TrfBuyingDepartment, …). Changing a code is a migration.
 */

/* ────────────────────────────── Individual tests ────────────────────────────── */

/**
 * The 33 individual tests, in the three printed columns of the buyer's sheet.
 *
 * `column` is the printed column (1-3), and array order is the printed order within it.
 * The template renders a 3-column CSS grid, so both are load-bearing.
 *
 * Label length: the printed column is ~216px wide at 8.5px, so a label wraps past roughly
 * 46 characters. The longest here ("Dimensional Stability to Washing (Home Laundry)") is
 * exactly at that edge and is expected to wrap onto a second line — the grid handles it
 * with a hanging indent. Keep new labels under ~46 characters or check the page still
 * renders as ONE sheet (there is a page-count assertion in the tests for exactly this).
 */
export const TRF_TESTS = [
  // ── Column 1 — laundering & colour fastness ──
  { code: 'AFTER_HOME_LAUNDERING_3_WASH', label: 'After Home Laundering – 3 wash', column: 1 },
  { code: 'AFTER_DRY_CLEANING_1_CYCLE', label: 'After Dry cleaning - 1 Cycle', column: 1 },
  {
    code: 'DIM_STABILITY_WASHING',
    label: 'Dimensional Stability to Washing (Home Laundry)',
    column: 1,
  },
  { code: 'DIM_STABILITY_DRY_CLEANING', label: 'Dimensional Stability to Dry cleaning', column: 1 },
  { code: 'COLOR_FASTNESS_WASHING', label: 'Color Fastness to Washing', column: 1 },
  { code: 'COLOR_FASTNESS_DRY_CLEANING', label: 'Color Fastness to Dry cleaning', column: 1 },
  { code: 'COLOR_FASTNESS_RUBBING', label: 'Color Fastness to Rubbing / Crocking', column: 1 },
  { code: 'COLOR_FASTNESS_LIGHT', label: 'Color Fastness to Light', column: 1 },
  { code: 'COLOR_FASTNESS_PERSPIRATION', label: 'Color Fastness to Perspiration', column: 1 },
  { code: 'COLOR_FASTNESS_WATER', label: 'Color Fastness to Water', column: 1 },
  { code: 'COLOR_FASTNESS_SALIVA', label: 'Color Fastness to Saliva', column: 1 },

  // ── Column 2 — physical & composition ──
  { code: 'SEAM_SLIPPAGE_STRENGTH', label: 'Seam Slippage/Strength (Woven only)', column: 2 },
  { code: 'BURSTING_STRENGTH', label: 'Bursting Strength (Knit only)', column: 2 },
  { code: 'PILLING_RESISTANCE', label: 'Pilling Resistance', column: 2 },
  { code: 'ABRASION_RESISTANCE', label: 'Abrasion Resistance', column: 2 },
  { code: 'STRETCH_AND_RECOVERY', label: 'Stretch & Recovery', column: 2 },
  { code: 'FABRIC_WEIGHT', label: 'Fabric Weight', column: 2 },
  { code: 'YARN_COUNT', label: 'Yarn Count', column: 2 },
  { code: 'FABRIC_CONSTRUCTION', label: 'Fabric Construction', column: 2 },
  { code: 'FIBER_CONTENT', label: 'Fiber Content', column: 2 },
  { code: 'TENSILE_STRENGTH', label: 'Tensile Strength (Woven only)', column: 2 },
  { code: 'TEAR_STRENGTH', label: 'Tear Strength (Woven only)', column: 2 },

  // ── Column 3 — trims, chemical & safety ──
  { code: 'FLAMMABILITY', label: 'Flammability', column: 3 },
  { code: 'ZIPPER_PULL_STRENGTH', label: 'Zipper Pull strength', column: 3 },
  { code: 'SLIDER_LOCK_STRENGTH', label: 'Slider Lock strength', column: 3 },
  { code: 'BOTTOM_STOP_HOLDING_STRENGTH', label: 'Bottom stop holding strength', column: 3 },
  { code: 'TOP_STOP_HOLDING_STRENGTH', label: 'Top stop Holding strength', column: 3 },
  { code: 'LATERAL_STRENGTH_TESTING', label: 'Lateral Strength Testing', column: 3 },
  { code: 'PH_VALUE', label: 'pH Value', column: 3 },
  { code: 'FORMALDEHYDE_UV_VIS', label: 'Formaldehyde [UV Vis]', column: 3 },
  { code: 'ODOUR', label: 'Odour', column: 3 },
  { code: 'DYE_TRANSFER_STORAGE', label: 'Dye transfer Storage', column: 3 },
  {
    code: 'CORROSION_RESISTANCE_METAL_PARTS',
    label: 'Corrosion Resistance for Metal Parts',
    column: 3,
  },
] as const;

export type TrfTestCodeValue = (typeof TRF_TESTS)[number]['code'];

/* ──────────────────────────── Buying department ──────────────────────────── */

/** The 6 department boxes on the top row of the buyer's Buying Dept. block. */
export const TRF_BUYING_DEPARTMENTS = [
  { code: 'KIDS_WEAR', label: 'Kids wear' },
  { code: 'MENS_WEAR', label: "Men's Wear" },
  { code: 'WOMENS_WEAR', label: "Women's Wear" },
  { code: 'INDIAN_WEAR', label: 'Indian wear' },
  { code: 'INNER_WEAR', label: 'inner Wear' }, // lowercase "i" is the buyer's, not a typo of ours
  { code: 'ACCESSORIES', label: 'Accessories' },
] as const;

export type TrfBuyingDepartmentValue = (typeof TRF_BUYING_DEPARTMENTS)[number]['code'];

/**
 * The 13 sub-boxes printed underneath the departments, in three columns.
 *
 * These are SCOPED TO A DEPARTMENT — that is what the three printed columns mean, and it
 * is the only reading under which the form makes sense: "Denim" appears twice on the
 * sheet, once in the Men's column and once in the Women's column. A single flat list
 * would collapse those two into one box and tick the wrong band.
 *
 * `department` therefore drives which sub-boxes the form offers once a department is
 * chosen, and the printed layout keeps all three columns visible as on the buyer's sheet.
 */
export const TRF_BUYING_SUB_CATEGORIES = [
  // Column 1 — Kids wear
  { code: 'KIDS_BOYS', label: 'Boys', department: 'KIDS_WEAR' },
  { code: 'KIDS_GIRLS', label: 'Girls', department: 'KIDS_WEAR' },
  { code: 'KIDS_INFANT', label: 'Infant', department: 'KIDS_WEAR' },
  { code: 'KIDS_AGE_2_8Y', label: '2-8 Years', department: 'KIDS_WEAR' },
  { code: 'KIDS_AGE_8_16Y', label: '8-16 Years', department: 'KIDS_WEAR' },

  // Column 2 — Men's Wear
  { code: 'MENS_CASUALS', label: 'Casuals', department: 'MENS_WEAR' },
  { code: 'MENS_DENIM', label: 'Denim', department: 'MENS_WEAR' },
  { code: 'MENS_POLO_TEES', label: 'Polo Tees', department: 'MENS_WEAR' },
  { code: 'MENS_URBAN_UTILITY', label: 'Urban Utility', department: 'MENS_WEAR' },

  // Column 3 — Women's Wear
  { code: 'WOMENS_DENIM', label: 'Denim', department: 'WOMENS_WEAR' },
  { code: 'WOMENS_NIGHT_WEAR', label: 'Night wear', department: 'WOMENS_WEAR' },
  { code: 'WOMENS_DRESS', label: 'Dress', department: 'WOMENS_WEAR' },
  { code: 'WOMENS_SMART', label: 'Smart', department: 'WOMENS_WEAR' },
] as const;

export type TrfBuyingSubCategoryValue = (typeof TRF_BUYING_SUB_CATEGORIES)[number]['code'];

/* ─────────────────────────── Single-choice groups ─────────────────────────── */

/** Finish Type — the buyer's own vocabulary. NOT our FabricFinishType
 *  (DYED/PRINTED/YARN_DYED/RAW), which is a colouration axis, not a finish. */
export const TRF_FINISH_TYPES = [
  { code: 'REGULAR_FINISH', label: 'Regular Finish' },
  { code: 'PEACH_FINISH', label: 'Peach Finish' },
  { code: 'GARMENT_WASH', label: 'Garment Wash' },
  { code: 'OTHER_DYE', label: 'Other Dye' },
] as const;

export const TRF_PACKAGE_TYPES = [
  { code: 'KNIT', label: 'Knit Garment Package' },
  { code: 'WOVEN', label: 'Woven Garment Package' },
  { code: 'RETEST', label: 'Retest' },
] as const;

export const TRF_SAMPLE_STAGES = [
  { code: 'PP', label: 'PP' },
  { code: 'SHIPMENT', label: 'SHIPMENT' },
] as const;

export const TRF_SERVICE_LEVELS = [
  { code: 'REGULAR', label: 'Regular (3  Working Days)' },
  { code: 'EXPRESS', label: 'Express (2 Working Day: 48 hours)*' },
  { code: 'SAME_DAY', label: 'Same day*' },
] as const;

/* ───────────────────────────── Fixed printed text ───────────────────────────── */

/**
 * "BO No" is a Buying Order number Easybuy does not use. The owner confirmed it always
 * prints "Not required" for this buyer, so it is a default rather than a lookup — the
 * column stays editable in case another buyer ever needs a real value.
 */
export const TRF_BO_NUMBER_NOT_REQUIRED = 'Not required';

/* ──────────────────────────────── Buyer defaults ──────────────────────────────── */

/**
 * What a new Easybuy TRF starts as, per the owner (2026-09-19). Every one of these is
 * editable on the form — they are a starting point, never enforced server-side.
 *
 * Applied by buyerTrfService.buildPrefill() when the resolved customer is Easybuy. Match
 * on the customer's id or code, never on the display name: `styles.customerName` is a free
 * string and "Easybuy"/"EasyBuy"/"Easy Buy" would all have to be guessed at.
 */
export const EASYBUY_TRF_DEFAULTS = {
  packageType: 'WOVEN',
  sampleStage: 'PP',
  finishType: 'GARMENT_WASH',
  buyingDepartment: 'WOMENS_WEAR',
  serviceRequired: 'EXPRESS',
  reportDeliveryService: true,
  returnRemainedSample: true,
  brandName: 'Easybuy',
  boNumber: TRF_BO_NUMBER_NOT_REQUIRED,
} as const;

/* ─────────────────────────────────── Helpers ─────────────────────────────────── */

/** The tests of one printed column, in printed order. Used by the template. */
export function trfTestsInColumn(column: 1 | 2 | 3) {
  return TRF_TESTS.filter((t) => t.column === column);
}

/** Sub-categories belonging to one department. Drives the form's dependent picker. */
export function trfSubCategoriesForDepartment(department: TrfBuyingDepartmentValue) {
  return TRF_BUYING_SUB_CATEGORIES.filter((s) => s.department === department);
}

/**
 * Everything the frontend needs to render the form without re-typing a single label.
 * Served by GET /api/buyer-trfs/form-options.
 */
export function buildTrfFormOptions() {
  return {
    tests: TRF_TESTS,
    buyingDepartments: TRF_BUYING_DEPARTMENTS,
    buyingSubCategories: TRF_BUYING_SUB_CATEGORIES,
    finishTypes: TRF_FINISH_TYPES,
    packageTypes: TRF_PACKAGE_TYPES,
    sampleStages: TRF_SAMPLE_STAGES,
    serviceLevels: TRF_SERVICE_LEVELS,
    easybuyDefaults: EASYBUY_TRF_DEFAULTS,
  };
}
