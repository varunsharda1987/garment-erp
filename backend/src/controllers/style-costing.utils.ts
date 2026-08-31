import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logWarn } from '../utils/logger';

// ============================================
// Types for Style Costing Controller
// ============================================

export type StyleCostingWhereInput = Prisma.style_costingWhereInput;

// Type definitions for JSON detail arrays
export interface FabricDetail {
  fabricName: string;
  fabricWidth: number;
  fabricAverage: number;
  fabricRate: number;
  fabricTotal: number;
  isNotApplicable?: boolean;
  fabricId?: string;
  /**
   * The fabric_width_cad row this line was costed against.
   *
   * Written back by the cost-sheet save so subsequent saves pair by explicit id instead of
   * inferring the pairing from names/widths. Optional because sheets saved before 2026-08-31
   * (and payloads from older clients) do not carry it.
   */
  fabricCADId?: string;
  sourcingStrategy?: string;
  processorId?: string;
  greigeCost?: number;
  processingCost?: number;
}

export interface TrimDetail {
  trimName: string;
  trimQuantity: number;
  trimRate: number;
  trimTotal: number;
  isNotApplicable?: boolean;
  // Metadata
  materialType?: string | null;
  unit?: string | null;
  bomId?: string | null;
  // Master FK fields (legacy) - allow null for Prisma compatibility
  materialId?: string | null;
  threadId?: string | null;
  buttonId?: string | null;
  zipperId?: string | null;
  elasticId?: string | null;
  labelId?: string | null;
  packagingId?: string | null;
  // Generic trim FK fields
  hookEyeId?: string | null;
  snapButtonId?: string | null;
  buckleId?: string | null;
  beltId?: string | null;
  velcroId?: string | null;
  drawstringId?: string | null;
  ribbonId?: string | null;
  sequinId?: string | null;
  beadId?: string | null;
  motifId?: string | null;
  interliningId?: string | null;
  paddingId?: string | null;
  otherFastenerId?: string | null;
  otherTapeId?: string | null;
  otherDecorativeId?: string | null;
  otherFunctionalId?: string | null;
  // Generic fallback for NEW material types
  masterId?: string | null;
}

export interface EmbroideryDetail {
  embroideryName: string;
  embroideryAverage: number;
  embroideryRate: number;
  embroideryTotal: number;
  isNotApplicable?: boolean;
}

export interface AccessoryDetail {
  accessoryName: string;
  accessoryQuantity: number;
  accessoryRate: number;
  accessoryTotal: number;
  isNotApplicable?: boolean;
  // Master FK fields - allow null for Prisma compatibility
  id?: string | null;
  labelId?: string | null;
  packagingId?: string | null;
  materialId?: string | null;
  materialType?: string | null;
  // Generic fallback for NEW accessory types
  masterId?: string | null;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const FabricDetailSchema = z
  .object({
    fabricName: z.string().min(1, 'Fabric name is required'),
    fabricWidth: z.number().nonnegative('Fabric width must be non-negative'),
    fabricAverage: z.number().nonnegative('Fabric average must be non-negative'),
    fabricRate: z.number().nonnegative('Fabric rate must be non-negative'),
    fabricTotal: z.number().nonnegative('Fabric total must be non-negative'),
    isNotApplicable: z.boolean().optional().default(false),
    // Explicit link to the fabric_width_cad row this line was costed against (see FabricDetail)
    fabricCADId: z.string().optional(),
    // Sourcing strategy fields (optional)
    fabricId: z.string().optional(),
    sourcingStrategy: z.enum(['STOCK_REUSE', 'READY_FABRIC', 'GREIGE_PROCESSED']).optional(),
    stockLotId: z.string().optional(),
    processorId: z.string().optional(),
    rateCardId: z.string().optional(),
    procurementId: z.string().optional(),
    greigeCost: z.number().optional(),
    processingCost: z.number().optional(),
    isManualOverride: z.boolean().optional(),
    overrideReason: z.string().optional(),
  })
  .refine((data) => data.isNotApplicable || (data.fabricRate > 0 && data.fabricAverage > 0), {
    message: 'Fabric rate and average must be > 0 unless marked as Not Applicable (N/A)',
    path: ['fabricRate'],
  });

// The 24 nullable master FK columns on style_costing_trim_items carry a DB CHECK constraint
// (num_nonnulls(...) <= 1, migration 20260723090000). Enforce the same rule at the API layer so a
// multi-FK payload fails as a clear 400 instead of a raw CHECK-violation 500 (bug-hunt costing-19).
const TRIM_MASTER_FK_FIELDS = [
  'materialId',
  'threadId',
  'buttonId',
  'zipperId',
  'elasticId',
  'labelId',
  'packagingId',
  'hookEyeId',
  'snapButtonId',
  'buckleId',
  'beltId',
  'velcroId',
  'drawstringId',
  'ribbonId',
  'sequinId',
  'beadId',
  'motifId',
  'interliningId',
  'paddingId',
  'otherFastenerId',
  'otherTapeId',
  'otherDecorativeId',
  'otherFunctionalId',
  'masterId',
] as const;

export const TrimDetailSchema = z
  .object({
    trimName: z.string().min(1, 'Trim name is required'),
    trimQuantity: z.number().nonnegative('Trim quantity must be non-negative'),
    trimRate: z.number().nonnegative('Trim rate must be non-negative'),
    trimTotal: z.number().nonnegative('Trim total must be non-negative'),
    isNotApplicable: z.boolean().optional().default(false),
    // BOM reference fields (optional)
    unit: z.string().optional(),
    bomId: z.string().optional(),
    materialType: z.string().optional(),
    // Master FK fields - needed for MRP material resolution
    materialId: z.string().uuid().optional().nullable(),
    threadId: z.string().uuid().optional().nullable(),
    buttonId: z.string().uuid().optional().nullable(),
    zipperId: z.string().uuid().optional().nullable(),
    elasticId: z.string().uuid().optional().nullable(),
    labelId: z.string().uuid().optional().nullable(),
    packagingId: z.string().uuid().optional().nullable(),
    hookEyeId: z.string().uuid().optional().nullable(),
    snapButtonId: z.string().uuid().optional().nullable(),
    buckleId: z.string().uuid().optional().nullable(),
    beltId: z.string().uuid().optional().nullable(),
    velcroId: z.string().uuid().optional().nullable(),
    drawstringId: z.string().uuid().optional().nullable(),
    ribbonId: z.string().uuid().optional().nullable(),
    sequinId: z.string().uuid().optional().nullable(),
    beadId: z.string().uuid().optional().nullable(),
    motifId: z.string().uuid().optional().nullable(),
    interliningId: z.string().uuid().optional().nullable(),
    paddingId: z.string().uuid().optional().nullable(),
    otherFastenerId: z.string().uuid().optional().nullable(),
    otherTapeId: z.string().uuid().optional().nullable(),
    otherDecorativeId: z.string().uuid().optional().nullable(),
    otherFunctionalId: z.string().uuid().optional().nullable(),
    // Generic fallback for NEW material types (no dedicated FK column needed)
    masterId: z.string().uuid().optional().nullable(),
  })
  .refine((data) => data.isNotApplicable || (data.trimRate > 0 && data.trimQuantity > 0), {
    message: 'Trim rate and quantity must be > 0 unless marked as Not Applicable (N/A)',
    path: ['trimRate'],
  })
  .superRefine((data, ctx) => {
    const setFks = TRIM_MASTER_FK_FIELDS.filter((field) => typeof data[field] === 'string' && data[field] !== '');
    if (setFks.length > 1) {
      ctx.addIssue({
        code: 'custom',
        message: `A trim item may reference at most one master FK, but ${setFks.length} were set: ${setFks.join(', ')}. Keep only one.`,
      });
    }
  });

export const EmbroideryDetailSchema = z
  .object({
    embroideryName: z.string().min(1, 'Embroidery name is required'),
    embroideryAverage: z.number().nonnegative('Embroidery average must be non-negative'),
    embroideryRate: z.number().nonnegative('Embroidery rate must be non-negative'),
    embroideryTotal: z.number().nonnegative('Embroidery total must be non-negative'),
    isNotApplicable: z.boolean().optional().default(false),
  })
  .refine((data) => data.isNotApplicable || (data.embroideryRate > 0 && data.embroideryAverage > 0), {
    message: 'Embroidery rate and average must be > 0 unless marked as Not Applicable (N/A)',
    path: ['embroideryRate'],
  });

export const AccessoryDetailSchema = z
  .object({
    accessoryName: z.string().min(1, 'Accessory name is required'),
    accessoryQuantity: z.number().nonnegative('Accessory quantity must be non-negative'),
    accessoryRate: z.number().nonnegative('Accessory rate must be non-negative'),
    accessoryTotal: z.number().nonnegative('Accessory total must be non-negative'),
    isNotApplicable: z.boolean().optional().default(false),
    // Master FK fields - needed for MRP material resolution
    id: z.string().uuid().optional(),
    labelId: z.string().uuid().optional().nullable(),
    packagingId: z.string().uuid().optional().nullable(),
    materialId: z.string().uuid().optional().nullable(),
    materialType: z.string().optional().nullable(),
    // Generic fallback for NEW accessory types
    masterId: z.string().uuid().optional().nullable(),
  })
  .refine((data) => data.isNotApplicable || (data.accessoryRate > 0 && data.accessoryQuantity > 0), {
    message: 'Accessory rate and quantity must be > 0 unless marked as Not Applicable (N/A)',
    path: ['accessoryRate'],
  });

/**
 * Safely parse a Prisma JSON column as a typed array using Zod validation.
 * Logs a warning if the stored data doesn't match the expected schema,
 * instead of silently double-casting (as unknown as Type[]).
 */
export function parseJsonArray<T>(value: unknown, schema: z.ZodType<T>, fieldName: string): T[] {
  if (!value || !Array.isArray(value)) {
    if (value !== null && value !== undefined) {
      logWarn(
        `[CostSheet] JSON column '${fieldName}' expected an array but got ${typeof value}. Returning empty array. This may indicate corrupted data — check the cost sheet record.`
      );
    }
    return [];
  }
  const results: T[] = [];
  for (let i = 0; i < value.length; i++) {
    const parsed = schema.safeParse(value[i]);
    if (parsed.success) {
      results.push(parsed.data);
    } else {
      logWarn(
        `[CostSheet] JSON column '${fieldName}' item[${i}] failed validation: ${parsed.error.issues.map((e) => e.message).join(', ')}. Item will be included as-is but may have invalid data.`
      );
      results.push(value[i] as T);
    }
  }
  return results;
}

export const CMTCostsSchema = z.object({
  cuttingCost: z.number().nonnegative('Cutting cost must be non-negative').default(0),
  stitchingCost: z.number().nonnegative('Stitching cost must be non-negative').default(0),
  finishingCost: z.number().nonnegative('Finishing cost must be non-negative').default(0),
  buttonAttachmentCost: z.number().nonnegative('Button attachment cost must be non-negative').default(0),
  handworkCost: z.number().nonnegative('Handwork cost must be non-negative').default(0),
  smockingCost: z.number().nonnegative('Smocking cost must be non-negative').default(0),
});

// Lace Detail Schema - for lace items in cost sheet.
// Field names are the style_costing_lace_items COLUMN names, which the frontend LaceDetail type
// (frontend/src/types/costSheet.types.ts) has always used. The original schema invented a parallel
// lace* naming (laceWidth/laceAverage/laceRate/laceTotal) that no client ever sent, so every
// lace-bearing cost sheet 400'd once route validation was enforced.
export const LaceDetailSchema = z
  .object({
    id: z.string().optional(),
    laceId: z.string().uuid('Lace master reference is required'),
    laceName: z.string().min(1, 'Lace name is required'),
    colorName: z.string().optional().nullable(),
    // Display metadata from the lace master; the DB column is nullable and masters without a
    // width send undefined.
    width: z.number().nonnegative('Lace width must be non-negative').optional().nullable(),
    quantityPerGarment: z.number().nonnegative('Lace quantity must be non-negative'),
    // The controller reads lace.wastagePercent; it was omitted here so validateBody stripped it and
    // lace wastage was silently lost (bug-hunt F5).
    wastagePercent: z.number().min(0).max(100).optional(),
    // Server recomputes effectiveQuantity from quantityPerGarment + wastagePercent; accepted so
    // the round-trip payload validates, but not trusted.
    effectiveQuantity: z.number().nonnegative().optional(),
    // Canonical value is GREIGE_PROCESSED — matches the frontend (LaceCostingRow/Section) and
    // the canonical LaceSourcingStrategyEnum.
    sourcingStrategy: z.enum(['STOCK_REUSE', 'READY_LACE', 'GREIGE_PROCESSED']).optional(),
    // Cost breakdown per sourcing strategy
    greigeCost: z.number().optional().nullable(),
    processingCost: z.number().optional().nullable(),
    readyLaceCost: z.number().optional().nullable(),
    stockCost: z.number().optional().nullable(),
    costPerMeter: z.number().nonnegative('Lace rate must be non-negative'),
    totalCost: z.number().nonnegative('Lace total must be non-negative'),
    // Source references - needed for PO generation and stock/lab-dip linkage
    greigeLaceId: z.string().uuid().optional().nullable(),
    processorId: z.string().uuid().optional().nullable(),
    rateCardId: z.string().uuid().optional().nullable(),
    stockLotId: z.string().optional().nullable(),
    procurementId: z.string().optional().nullable(),
    labDipId: z.string().optional().nullable(),
    isManualOverride: z.boolean().optional(),
    overrideReason: z.string().optional().nullable(),
    isNotApplicable: z.boolean().optional().default(false),
  })
  .refine((data) => data.isNotApplicable || (data.costPerMeter > 0 && data.quantityPerGarment > 0), {
    message: 'Lace rate and quantity must be > 0 unless marked as Not Applicable (N/A)',
    path: ['costPerMeter'],
  });

export const CreateCostSheetSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),

  // Cost Sheet Purpose/Mode
  purpose: z.enum(['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION']).default('COSTING'),

  // Basic Information
  numberOfComponents: z.number().int().positive().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),

  // Dynamic arrays
  fabricDetails: z.array(FabricDetailSchema).min(1, 'At least one fabric is required'),
  trimsDetails: z.array(TrimDetailSchema).min(1, 'At least one trim is required'),
  laceDetails: z.array(LaceDetailSchema).optional().default([]),
  cmtCosts: CMTCostsSchema,
  embroideryDetails: z.array(EmbroideryDetailSchema).default([]),
  accessoriesDetails: z.array(AccessoryDetailSchema).default([]),

  // Value Loss & Markup
  valueLossPercent: z.number().min(0).max(100, 'Value loss must be between 0-100%').default(2),
  markupPercent: z.number().min(0).max(100, 'Markup must be between 0-100%').default(15),

  // Additional fields
  notes: z.string().optional(),

  // Closed Cost - Final agreed price with customer (exclusive of tax)
  closedCost: z.number().positive('Closed cost must be positive').optional().nullable(),
  closedCostNotes: z.string().optional().nullable(),

  // ==========================================
  // Budget Fields (for RAW_MATERIAL_CALCULATION/PRODUCTION direct procurement)
  // ==========================================
  enableBudgetTracking: z.boolean().optional().default(false),
  fabricBudget: z.number().nonnegative('Fabric budget must be non-negative').optional(),
  trimsBudget: z.number().nonnegative('Trims budget must be non-negative').optional(),
  cmtBudget: z.number().nonnegative('CMT budget must be non-negative').optional(),
  embroideryBudget: z.number().nonnegative('Embroidery budget must be non-negative').optional(),
  accessoriesBudget: z.number().nonnegative('Accessories budget must be non-negative').optional(),
  totalBudget: z.number().nonnegative('Total budget must be non-negative').optional(),

  // Buffer Percentages (defaults applied if budget tracking enabled)
  fabricBufferPercent: z.number().min(0).max(100).optional(),
  trimsBufferPercent: z.number().min(0).max(100).optional(),
  cmtBufferPercent: z.number().min(0).max(100).optional(),
  embroideryBufferPercent: z.number().min(0).max(100).optional(),
  accessoriesBufferPercent: z.number().min(0).max(100).optional(),

  // Order Linking (optional - for direct procurement tracking)
  orderId: z.string().uuid('Invalid order ID').optional(),
  orderItemId: z.string().uuid('Invalid order item ID').optional(),
});

// Update schema must be TRULY partial: in Zod 4, .partial() does NOT suppress .default() values, so a
// plain CreateCostSheetSchema.partial() would inject purpose:'COSTING', markupPercent:15,
// valueLossPercent:2, empty detail arrays, etc. into every partial update — and since the route's
// validateBody REPLACES req.body with the parse result, those defaults would overwrite stored values.
// Strip every ZodDefault wrapper first so omitted fields stay undefined (adversarial-review finding on
// bug-hunt costing-2).
const stripDefault = (s: z.ZodTypeAny): z.ZodTypeAny => {
  if (s instanceof z.ZodDefault) {
    const inner = s as unknown as { removeDefault?: () => z.ZodTypeAny; unwrap?: () => z.ZodTypeAny };
    if (typeof inner.removeDefault === 'function') return inner.removeDefault();
    if (typeof inner.unwrap === 'function') return inner.unwrap();
  }
  return s;
};
// Typed via the plain partial (same field types); runtime uses the default-stripped shape.
const typedPartialForInference = CreateCostSheetSchema.partial().omit({ styleId: true });
export const UpdateCostSheetSchema = z
  .object(
    Object.fromEntries(
      Object.entries(CreateCostSheetSchema.shape).map(([k, v]) => [k, stripDefault(v as z.ZodTypeAny)])
    )
  )
  .partial()
  .omit({ styleId: true }) as typeof typedPartialForInference;

// ============================================================================
// CAD row ↔ fabricDetails pairing
// ============================================================================

/**
 * The shape of a fabric_width_cad row this matcher needs. Deliberately structural so both the
 * create and update queries in styleCosting.controller.ts satisfy it without extra selects.
 */
export interface CadRowForPairing {
  id: string;
  fabricId?: string | null;
  greigeId?: string | null;
  cutableWidth?: Prisma.Decimal | number | null;
  fabric?: { fabricName?: string | null; greigeId?: string | null } | null;
  greige?: { greigeName?: string | null } | null;
}

export type FabricPairingMethod = 'fabricCADId' | 'id+width' | 'name+width' | 'id' | 'width' | 'name' | 'positional';

export interface FabricPairing<TCad extends CadRowForPairing> {
  cad: TCad;
  jsonFabric: FabricDetail;
  jsonIndex: number;
  method: FabricPairingMethod;
}

export interface FabricPairingResult<TCad extends CadRowForPairing> {
  pairings: FabricPairing<TCad>[];
  /** CAD rows left with no fabric line at all — these would silently vanish from the Order BOM. */
  unmatchedCads: TCad[];
  /** fabricDetails entries no CAD row claimed. */
  unusedFabricIndexes: number[];
  /** Human-readable problems for the API response; empty means every row paired unambiguously. */
  warnings: string[];
}

function cadWidthOf(cad: CadRowForPairing): number | null {
  if (cad.cutableWidth === null || cad.cutableWidth === undefined) return null;
  const width = Number(cad.cutableWidth);
  return Number.isFinite(width) ? width : null;
}

function cadNameOf(cad: CadRowForPairing): string {
  return (cad.fabric?.fabricName || cad.greige?.greigeName || '').toLowerCase().trim();
}

function widthsMatch(cadWidth: number | null, jsonWidth: unknown): boolean {
  if (cadWidth === null) return false;
  const width = Number(jsonWidth);
  return Number.isFinite(width) && Math.abs(width - cadWidth) < 0.01;
}

function namesMatch(cadName: string, jsonName: unknown): boolean {
  const name = String(jsonName ?? '')
    .toLowerCase()
    .trim();
  if (!name || !cadName) return false;
  // Greige master names carry a construction suffix ("Viscose Staple 30x30 / 68x64 / 63\" (Super
  // Dyeing)") while the sheet stores the short name, so equality never matches on real data.
  return cadName === name || cadName.startsWith(name);
}

function idsMatch(cad: CadRowForPairing, jsonFabricId: unknown): boolean {
  if (!jsonFabricId) return false;
  return jsonFabricId === cad.fabricId || jsonFabricId === cad.greigeId;
}

/**
 * Pair each deduplicated fabric_width_cad row with the fabricDetails entry it was costed from.
 *
 * Both cost-sheet endpoints MUST use this. They previously diverged — create matched by id/name
 * while update joined the two lists by array position — and because fabric_width_cad is read
 * `ORDER BY updatedAt DESC`, re-costing one width floated it to the front and the next save wrote
 * one fabric's metreage and rate onto the other's line. style_costing_fabric_items is the only
 * source Order-BOM trusts, so that swap reaches the greige PO while the sheet's own total (and
 * therefore the screen the merchandiser checks) stays unchanged.
 *
 * Matching is CONSUMING — a fabricDetails entry is claimed by at most one CAD row — and runs
 * strongest signal first: the explicit fabricCADId link, then identity+geometry, then
 * name+geometry, then each alone. Position is the last resort and is always reported, because on
 * live data (CAD fabricId NULL, short JSON names vs descriptive master names) an id/name-only
 * matcher silently degrades back into the positional join this exists to eliminate.
 */
export function matchFabricDetailsToCadRows<TCad extends CadRowForPairing>(
  cadRows: TCad[],
  fabricDetails: FabricDetail[]
): FabricPairingResult<TCad> {
  const pairings: FabricPairing<TCad>[] = [];
  const unmatchedCads: TCad[] = [];
  const warnings: string[] = [];
  const used = new Set<number>();

  const meta = cadRows.map((cad) => ({ cad, width: cadWidthOf(cad), name: cadNameOf(cad) }));

  /**
   * A leg may only claim a line whose width does not CONTRADICT the CAD row's own width.
   * Without this veto the identity-only legs cross widths: a 50" CAD row would claim the 52"
   * line, produce a row whose width/rateCard come from one option and whose metreage and rate
   * come from the other, and then stamp that pairing into fabricCADId permanently.
   */
  const widthCompatible = (width: number | null, jf: FabricDetail) =>
    width === null || jf.fabricWidth == null || widthsMatch(width, jf.fabricWidth);

  type Leg = { method: FabricPairingMethod; test: (m: (typeof meta)[number], jf: FabricDetail) => boolean };

  // Strongest discriminator first. Legs are resolved GLOBALLY (every CAD row is offered a leg
  // before any row is offered a weaker one) so a weak name-only claim can never pre-empt another
  // row's exact name+width claim — that pre-emption is a positional join wearing a better label.
  const LEGS: Leg[] = [
    { method: 'fabricCADId', test: (m, jf) => !!jf.fabricCADId && jf.fabricCADId === m.cad.id },
    { method: 'id+width', test: (m, jf) => idsMatch(m.cad, jf.fabricId) && widthsMatch(m.width, jf.fabricWidth) },
    {
      method: 'name+width',
      test: (m, jf) => namesMatch(m.name, jf.fabricName) && widthsMatch(m.width, jf.fabricWidth),
    },
    { method: 'id', test: (m, jf) => idsMatch(m.cad, jf.fabricId) && widthCompatible(m.width, jf) },
    { method: 'width', test: (m, jf) => widthsMatch(m.width, jf.fabricWidth) },
    { method: 'name', test: (m, jf) => namesMatch(m.name, jf.fabricName) && widthCompatible(m.width, jf) },
  ];

  const remaining = new Set(meta.map((_, i) => i));

  const describeCad = (m: (typeof meta)[number]) => `${m.name || 'Unnamed fabric'} @ ${m.width ?? '?'}"`;

  for (const leg of LEGS) {
    for (const cadIdx of [...remaining]) {
      const m = meta[cadIdx];
      const candidates: number[] = [];
      for (let i = 0; i < fabricDetails.length; i++) {
        if (!used.has(i) && leg.test(m, fabricDetails[i])) candidates.push(i);
      }
      if (candidates.length === 0) continue;

      const index = candidates[0];
      used.add(index);
      remaining.delete(cadIdx);
      pairings.push({ cad: m.cad, jsonFabric: fabricDetails[index], jsonIndex: index, method: leg.method });

      // Two lines were equally good under this leg, so the winner was decided by array order —
      // that is a guess, and a guess that gets frozen into fabricCADId. Say so.
      if (candidates.length > 1) {
        warnings.push(
          `${describeCad(m)} matched ${candidates.length} fabric lines equally well ` +
            `(${candidates.map((i) => `"${fabricDetails[i].fabricName}"`).join(', ')}); ` +
            `"${fabricDetails[index].fabricName}" was used. Check this line's average and rate.`
        );
      }
    }
  }

  // Last resort: the first unclaimed entry, in order. Never silent.
  for (const cadIdx of [...remaining]) {
    const m = meta[cadIdx];
    let index = -1;
    for (let i = 0; i < fabricDetails.length; i++) {
      if (!used.has(i)) {
        index = i;
        break;
      }
    }
    if (index >= 0) {
      used.add(index);
      remaining.delete(cadIdx);
      pairings.push({ cad: m.cad, jsonFabric: fabricDetails[index], jsonIndex: index, method: 'positional' });
      warnings.push(
        `Fabric line "${fabricDetails[index].fabricName}" could not be matched to a CAD row by fabric or width ` +
          `and was paired by position with the ${m.width ?? '?'}" option — verify its rate and average.`
      );
    } else {
      unmatchedCads.push(m.cad);
      remaining.delete(cadIdx);
    }
  }

  // Preserve the caller's CAD ordering in the result regardless of the leg in which each matched.
  const orderOf = new Map(cadRows.map((cad, i) => [cad, i]));
  pairings.sort((a, b) => (orderOf.get(a.cad) ?? 0) - (orderOf.get(b.cad) ?? 0));

  if (unmatchedCads.length > 0) {
    const describe = unmatchedCads
      .map((cad) => `${cadNameOf(cad) || 'Unnamed fabric'} @ ${cadWidthOf(cad) ?? '?'}"`)
      .join(', ');
    warnings.push(
      `${unmatchedCads.length} costed CAD row(s) have no cost line and were left out of the cost sheet: ${describe}.`
    );
  }

  const unusedFabricIndexes = fabricDetails.map((_, i) => i).filter((i) => !used.has(i));
  if (unusedFabricIndexes.length > 0) {
    const describe = unusedFabricIndexes.map((i) => `"${fabricDetails[i].fabricName}"`).join(', ');
    warnings.push(`${unusedFabricIndexes.length} fabric line(s) matched no CAD row: ${describe}.`);
  }

  return { pairings, unmatchedCads, unusedFabricIndexes, warnings };
}
