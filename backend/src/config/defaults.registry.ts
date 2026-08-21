/**
 * SYSTEM DEFAULTS REGISTRY — the single source of truth for every business default value.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  THIS IS THE ONLY FILE IN THE REPO WHERE A BUSINESS DEFAULT MAY BE AUTHORED.  │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * How the value reaches everything else:
 *
 *   defaults.registry.ts  (this file — the authored value)
 *         ├─ seeds ─────────→ system_settings row   ← the ONLY runtime override.
 *         │                                            Editable in Settings; once a row
 *         │                                            exists it WINS and is never
 *         │                                            overwritten by a deploy.
 *         ├─ served ────────→ GET /api/system-settings/defaults  (as ROWS, never a map)
 *         └─ read in code ──→ systemSettingsService.getNumberDefault('KEY') etc.
 *
 * RULES (enforced by scripts/hooks smart-check `hardcodedDefault` detector):
 *   1. Never pass a fallback literal at a call site. `getNumber(key, 5)` is gone —
 *      the fallback lives here, once. Call `getNumberDefault('KEY')` instead.
 *   2. Never add a Prisma `@default(...)` for a business value. A column default may
 *      only be the NEUTRAL value (0) on a NOT NULL column, as a structural NULL-guard.
 *   3. Never add a Zod `.default(N)` for a business value — it fills in a value the
 *      client never sent and cannot be overridden.
 *   4. Never re-type one of these numbers in a frontend component. Read it from
 *      `useDefaultSettings()` and gate on `isLoading`.
 *
 * Adding a key here automatically gives you: the DB seed, the accessor key type,
 * and an editable row in the Settings screen. No other file needs to change.
 */

export type DefaultDataType = 'NUMBER' | 'STRING' | 'BOOLEAN';

export interface SystemDefaultSpec {
  /** The authored default, stringified (system_settings.value is TEXT). */
  value: string;
  dataType: DefaultDataType;
  /** system_settings.category — also the coarse grouping key. */
  category: string;
  /** Heading this setting appears under in the Settings screen. */
  group: string;
  /** Human label shown in the Settings screen. */
  label: string;
  description: string;
  /** Inclusive bounds for NUMBER settings, used by the Settings input. */
  min?: number;
  max?: number;
  /** Unit suffix shown next to the input (e.g. '%', 'in', 'days', '₹'). */
  unit?: string;
}

export const SYSTEM_DEFAULTS = {
  // ──────────────────────────────────────────────────────────────────────────
  // Wastage / extra allowance
  //
  // All zero by decision: nothing is ever added to a requirement silently.
  // A wastage % is a deliberate entry, made per item on the BOM.
  // ──────────────────────────────────────────────────────────────────────────
  FABRIC_DEFAULT_WASTAGE_PERCENT: {
    value: '0',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Wastage',
    label: 'Fabric wastage',
    description: 'Applied to fabric quantities in CAD planning and BOM when not set on the item.',
    min: 0,
    max: 100,
    unit: '%',
  },
  GREIGE_DEFAULT_WASTAGE_PERCENT: {
    value: '0',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Wastage',
    label: 'Greige wastage',
    description: 'Applied to greige quantities in CAD planning and BOM when not set on the item.',
    min: 0,
    max: 100,
    unit: '%',
  },
  TRIM_DEFAULT_WASTAGE_PERCENT: {
    value: '0',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Wastage',
    label: 'Trim wastage',
    description: 'Applied to buttons, zippers, elastics and other trims when not set on the item.',
    min: 0,
    max: 100,
    unit: '%',
  },
  LACE_DEFAULT_WASTAGE_PERCENT: {
    value: '0',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Wastage',
    label: 'Lace wastage',
    description: 'Applied to lace quantities when not set on the item.',
    min: 0,
    max: 100,
    unit: '%',
  },
  LABEL_DEFAULT_EXTRA_PERCENT: {
    value: '0',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Wastage',
    label: 'Label extra',
    description: 'Extra allowance on labels and tags when not set on the item.',
    min: 0,
    max: 100,
    unit: '%',
  },
  CUTTING_DEFAULT_EXTRA_PERCENT: {
    value: '1',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Wastage',
    label: 'Cutting extra',
    description: 'Extra pieces cut above the order quantity, shown on the cutting chart.',
    min: 0,
    max: 100,
    unit: '%',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Costing
  // ──────────────────────────────────────────────────────────────────────────
  THREAD_DEFAULT_COST_PER_GARMENT: {
    value: '4',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Costing',
    label: 'Thread cost per garment',
    description: 'Used when the cost sheet does not specify a thread cost.',
    min: 0,
    unit: '₹',
  },
  COSTING_VALUE_LOSS_PERCENT: {
    value: '2',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Costing',
    label: 'Value loss',
    description: 'Default value-loss allowance on a new cost sheet.',
    min: 0,
    max: 100,
    unit: '%',
  },
  COSTING_MARKUP_PERCENT: {
    value: '15',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Costing',
    label: 'Markup',
    description: 'Default markup on a new cost sheet.',
    min: 0,
    max: 100,
    unit: '%',
  },
  COSTING_FABRIC_BUFFER_PERCENT: {
    value: '5',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Costing',
    label: 'Fabric buffer',
    description: 'Default fabric buffer on a new cost sheet.',
    min: 0,
    max: 100,
    unit: '%',
  },
  COSTING_TRIMS_BUFFER_PERCENT: {
    value: '10',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Costing',
    label: 'Trims buffer',
    description: 'Default trims buffer on a new cost sheet.',
    min: 0,
    max: 100,
    unit: '%',
  },
  COSTING_CMT_BUFFER_PERCENT: {
    value: '5',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Costing',
    label: 'CMT buffer',
    description: 'Default cut-make-trim buffer on a new cost sheet.',
    min: 0,
    max: 100,
    unit: '%',
  },
  COSTING_EMBROIDERY_BUFFER_PERCENT: {
    value: '8',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Costing',
    label: 'Embroidery buffer',
    description: 'Default embroidery buffer on a new cost sheet.',
    min: 0,
    max: 100,
    unit: '%',
  },
  COSTING_ACCESSORIES_BUFFER_PERCENT: {
    value: '10',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Costing',
    label: 'Accessories buffer',
    description: 'Default accessories buffer on a new cost sheet.',
    min: 0,
    max: 100,
    unit: '%',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Fabric & greige handling
  // ──────────────────────────────────────────────────────────────────────────
  GREIGE_CUTABLE_WIDTH_DEDUCTION_CM: {
    // NOTE: the key says _CM but the value IS AND ALWAYS WAS INCHES (historical
    // misnomer, kept so existing rows keep resolving). Read it only through
    // systemSettingsService.getCutableWidthDeductionInches().
    value: '2',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Fabric',
    label: 'Selvedge deduction',
    description:
      'Selvedge/pin-mark deduction in INCHES. Finished width − deduction = cutable width; cutable + deduction = the width to ask the processor for.',
    min: 0,
    unit: 'in',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Stock & quality
  // ──────────────────────────────────────────────────────────────────────────
  DEFAULT_QUALITY_GRADE: {
    value: 'A',
    dataType: 'STRING',
    category: 'DEFAULTS',
    group: 'Stock',
    label: 'Default quality grade',
    description: 'Grade stamped on new stock when none is given. One of A, B, DEFECT.',
  },
  STOCK_AGING_THRESHOLD_DAYS: {
    value: '180',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Stock',
    label: 'Stock aging threshold',
    description: 'Stock older than this is flagged as aged.',
    min: 1,
    unit: 'days',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Receiving & alerts
  // ──────────────────────────────────────────────────────────────────────────
  GRN_OVER_RECEIPT_TOLERANCE_PERCENT: {
    value: '10',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Receiving',
    label: 'Over-receipt tolerance',
    description: 'How much more than the ordered quantity a GRN may receive before it is blocked.',
    min: 0,
    max: 100,
    unit: '%',
  },
  VARIANCE_ALERT_THRESHOLD_PERCENT: {
    value: '5',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    group: 'Receiving',
    label: 'Variance alert threshold',
    description: 'Production variance above this raises a manufacturing alert.',
    min: 0,
    max: 100,
    unit: '%',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Processing rates
  // ──────────────────────────────────────────────────────────────────────────
  KAAJ_BUTTONHOLE_RATE_PER_UNIT: {
    value: '0.30',
    dataType: 'NUMBER',
    category: 'PROCESSING_RATES',
    group: 'Processing rates',
    label: 'Buttonhole rate',
    description: 'Default rate per buttonhole for outsourced kaaj work.',
    min: 0,
    unit: '₹',
  },
  KAAJ_BUTTON_RATE_PER_UNIT: {
    value: '0.30',
    dataType: 'NUMBER',
    category: 'PROCESSING_RATES',
    group: 'Processing rates',
    label: 'Button attach rate',
    description: 'Default rate per button attachment for outsourced kaaj work.',
    min: 0,
    unit: '₹',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // AI assistant
  // ──────────────────────────────────────────────────────────────────────────
  AI_KNOWLEDGE_ENABLED: {
    value: 'true',
    dataType: 'BOOLEAN',
    category: 'DEFAULTS',
    group: 'AI assistant',
    label: 'Knowledge guides enabled',
    description: 'Whether the in-app assistant answers from the ingested knowledge guides.',
  },
} as const satisfies Record<string, SystemDefaultSpec>;

/** Every valid setting key. Using an unregistered key is a compile error. */
export type SystemDefaultKey = keyof typeof SYSTEM_DEFAULTS;

/** Keys whose registered dataType is NUMBER — the only keys getNumberDefault accepts. */
export type NumberDefaultKey = {
  [K in SystemDefaultKey]: (typeof SYSTEM_DEFAULTS)[K]['dataType'] extends 'NUMBER' ? K : never;
}[SystemDefaultKey];

/** Keys whose registered dataType is STRING. */
export type StringDefaultKey = {
  [K in SystemDefaultKey]: (typeof SYSTEM_DEFAULTS)[K]['dataType'] extends 'STRING' ? K : never;
}[SystemDefaultKey];

/** Keys whose registered dataType is BOOLEAN. */
export type BooleanDefaultKey = {
  [K in SystemDefaultKey]: (typeof SYSTEM_DEFAULTS)[K]['dataType'] extends 'BOOLEAN' ? K : never;
}[SystemDefaultKey];

/** The registry as a list — used by the seeder and by the defaults endpoint. */
export const SYSTEM_DEFAULT_ENTRIES = Object.entries(SYSTEM_DEFAULTS).map(([key, spec]) => ({
  key: key as SystemDefaultKey,
  ...(spec as SystemDefaultSpec),
}));

/** The authored default for a key, before any user override is applied. */
export function registryValue(key: SystemDefaultKey): string {
  return SYSTEM_DEFAULTS[key].value;
}
