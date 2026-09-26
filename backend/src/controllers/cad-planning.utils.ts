/**
 * Shared utilities, types, and constants for CAD Planning controllers.
 * Extracted from cad-planning.controller.ts to enable splitting into smaller files.
 */

import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { BusinessError, NotFoundError } from '../errors';
import { toCurrency, addCurrency, divideCurrency, toNumber } from '../utils/currency'; // BUG-CAD8 fix
import { formatDateTime24 } from '../utils/date';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Code for the "All Parts" pattern part in the database */
export const ALL_PARTS_CODE = 'ALL_PARTS';

/** Legacy marker for backwards compatibility (stored in componentName for old rows) */
export const ALL_PARTS_LEGACY_MARKER = '__ALL_PARTS__';

/**
 * Cutable width offsets from greige width (standard industry practice)
 * NOTE: Auto-width generation has been disabled - users add widths manually on CAD Edit page
 */
export const CUTABLE_WIDTH_OFFSETS = [-2, -4, -6]; // inches reduction from greige width (kept for reference/calculation display)

// ============================================================================
// INTERFACES / TYPES
// ============================================================================

export interface WidthValidationResult {
  valid: boolean;
  message?: string;
}

/** Response types for CAD planning */
export interface FabricCADSummary {
  fabricId: string;
  fabricName: string;
  componentType: string;
  cadStatus: 'PENDING' | 'OPTIONS_GENERATED' | 'APPROVED';
  approvedCADId?: string;
  approvedWidth?: number;
  availableOptions: number;
}

export interface ComponentCADSummary {
  componentId: string;
  componentName: string;
  componentType: string;
  fabrics: FabricCADSummary[];
}

export interface StyleCADSummary {
  styleId: string;
  styleCode: string;
  styleName: string;
  customerName: string;
  brandName: string;
  imageUrl?: string;
  cadStatus: string;
  components: ComponentCADSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface CADOption {
  cadId: string;
  fabricId: string | null;
  fabricName: string;
  greigeId?: string;
  greigeName?: string;
  cutableWidth: number;
  widthUnit: string;
  cadMeters: number | null;
  cadYards?: number;
  cadWastagePercent: number;
  layerMarginMeters: number;
  markerEfficiency?: number;
  isPreferred: boolean;
  supplierAvailability?: string;
  processingPricePerMeter?: number;
  componentName?: string;
  notes?: string;
}

export interface CADCostResult {
  cadId: string;
  cutableWidth: number;
  cadConsumption: number;
  wastagePercent: number;
  effectiveConsumption: number;
  fabricRate: number;
  totalCost: number;
  costPerMeter: number;
  unit: 'meters' | 'yards';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Layer margin defaults based on layer length (meters)
 */
export function getDefaultLayerMargin(layerLengthMeters: number): number {
  if (layerLengthMeters <= 0) return 0.02;
  if (layerLengthMeters <= 1) return 0.02; // 2 cm
  if (layerLengthMeters <= 5) return 0.05; // 5 cm
  if (layerLengthMeters <= 10) return 0.1; // 10 cm
  if (layerLengthMeters <= 20) return 0.2; // 20 cm
  return 0.3; // 30 cm
}

/**
 * Calculate CAD Average (per-piece consumption)
 * Formula: (cadMeters + layerMarginMeters) / piecesPerMarker
 * @param cadMeters - Layer/marker length in meters
 * @param layerMarginMeters - Cutting margin between layers in meters
 * @param piecesPerMarker - Number of pieces per marker
 * @returns CAD average per piece, or null if can't be calculated
 */
export function calculateCadAverage(
  cadMeters: number | null | undefined,
  layerMarginMeters: number | null | undefined,
  piecesPerMarker: number | null | undefined
): number | null {
  if (!cadMeters || !piecesPerMarker || piecesPerMarker <= 0) {
    return null;
  }
  // BUG-CAD8 fix: use decimal.js for safe arithmetic
  const totalMeters = addCurrency(cadMeters, layerMarginMeters || 0);
  return toNumber(divideCurrency(totalMeters, piecesPerMarker));
}

/**
 * A CAD row's marker → its average, the way the CAD Planning spreadsheet computes it: the layer margin is
 * the default for the layer length, and the pieces are the size breakdown's total. The spreadsheet save
 * and the Correct CAD flow both call this, so a correction can never compute a different average from
 * the same marker.
 */
export function cadAverageFromMarker(
  layerLengthMeters: number | null | undefined,
  sizeBreakdowns: Array<{ quantity: number }> | null | undefined,
  storedLayerMarginMeters?: number | null
): { layerMarginMeters: number | null; piecesPerMarker: number; cadAverage: number | null } {
  const pieces = (sizeBreakdowns ?? []).reduce((sum, sb) => sum + (Number(sb.quantity) || 0), 0);
  const layer = layerLengthMeters ? Number(layerLengthMeters) : null;
  const margin = storedLayerMarginMeters ?? (layer ? getDefaultLayerMargin(layer) : null);
  return { layerMarginMeters: margin, piecesPerMarker: pieces, cadAverage: calculateCadAverage(layer, margin, pieces) };
}

/**
 * The width a CAD row starts at when a greige is picked and no width was typed.
 * Business rules: 63" greige → 52", 48" greige → 40", otherwise the greige's min finished width.
 */
export function defaultCutableWidthForGreige(greige: {
  greigeWidth: number | Prisma.Decimal | null;
  expectedFinishedWidthMin: number | Prisma.Decimal | null;
}): number {
  const greigeWidth = greige.greigeWidth ? Number(greige.greigeWidth) : null;
  if (greigeWidth && greigeWidth >= 63) return 52;
  if (greigeWidth && greigeWidth >= 48) return 40;
  return greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : 44;
}

/**
 * Should a CAD row update write the greige default width?
 *
 * The CAD table saves only the fields that changed, so a save that omits the width is NOT a
 * request to clear it. Deciding on the request alone reset every typed width (41.5" → 40") on the
 * next size/layer-length save. The default applies only when no width was sent AND either the
 * greige is changing, the width was explicitly cleared, or the row has no width yet.
 */
export function shouldApplyDefaultCutableWidth(args: {
  requestWidth: number | null | undefined;
  requestGreigeId: string | null | undefined;
  existingGreigeId: string | null;
  existingWidth: number | Prisma.Decimal | null;
}): boolean {
  const { requestWidth, requestGreigeId, existingGreigeId, existingWidth } = args;
  const effectiveGreigeId = requestGreigeId !== undefined ? requestGreigeId : existingGreigeId;
  if (!effectiveGreigeId) return false;
  if (requestWidth !== undefined && requestWidth !== null && requestWidth !== 0) return false;

  const greigeChanging = !!requestGreigeId && requestGreigeId !== existingGreigeId;
  const widthCleared = requestWidth === null || requestWidth === 0;
  // Number(): a Prisma Decimal is an object, so a bare truthiness check never sees a stored 0
  const rowHasNoWidth = !existingWidth || Number(existingWidth) === 0;
  return greigeChanging || widthCleared || rowHasNoWidth;
}

/**
 * Validate cutable width against greige's finished width range
 * @param cutableWidth - The width to validate
 * @param greige - The greige master record
 * @param hasEmbroideryParts - If true, allows any width up to greige width
 * @returns Validation result with message if invalid
 */
export function validateCutableWidth(
  cutableWidth: number,
  greige: {
    greigeWidth: number | Prisma.Decimal | null;
    expectedFinishedWidthMin: number | Prisma.Decimal | null;
    expectedFinishedWidthMax: number | Prisma.Decimal | null;
  } | null,
  hasEmbroideryParts: boolean = false
): WidthValidationResult {
  if (!greige) {
    return { valid: true }; // No greige = no validation
  }

  const greigeWidth = greige.greigeWidth ? Number(greige.greigeWidth) : null;
  const minWidth = greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : null;
  const maxWidth = greige.expectedFinishedWidthMax ? Number(greige.expectedFinishedWidthMax) : null;

  // If embroidery parts, allow any width up to greige width
  if (hasEmbroideryParts) {
    if (greigeWidth && cutableWidth > greigeWidth) {
      return {
        valid: false,
        message: `Width cannot exceed greige width (${greigeWidth}")`,
      };
    }
    return { valid: true };
  }

  // Non-embroidery: must be within finished width range
  if (minWidth !== null && cutableWidth < minWidth) {
    return {
      valid: false,
      message: `Width must be at least ${minWidth}" (min finished width from greige)`,
    };
  }

  if (maxWidth !== null && cutableWidth > maxWidth) {
    return {
      valid: false,
      message: `Width cannot exceed ${maxWidth}" (max finished width from greige)`,
    };
  }

  return { valid: true };
}

/** Stock allocations that are finished with their Production CAD — they no longer hold it. */
const SETTLED_ALLOCATION_STATUSES = ['RELEASED', 'RETURNED'] as const;

/**
 * Validates if CAD row can be modified based on approval status
 * @param cadId - The CAD entry ID to validate
 * @param operation - The operation being attempted ('update' or 'delete')
 * @throws Error if CAD is locked from modifications
 */
export async function validateCADModification(cadId: string, operation: 'update' | 'delete'): Promise<void> {
  const cad = await prisma.fabric_width_cad.findUnique({
    where: { id: cadId },
    select: {
      id: true,
      approvalStatus: true, // allow-cad-approval: this IS the CAD-side lock
      costingApprovalStatus: true,
      approvedAt: true,
      approvedBy: true,
      _count: {
        select: {
          costingFabricItems: true,
          orderBomItems: true,
          order_items: true,
          order_item_costings: true,
          // A Production CAD's stock reservation (approve reserves the lot, cutting consumes it)
          stockAllocations: { where: { allocationStatus: { notIn: [...SETTLED_ALLOCATION_STATUSES] } } },
        },
      },
    },
  });

  if (!cad) {
    throw new NotFoundError('CAD entry', cadId);
  }

  // Every one of these links is ON DELETE SET NULL, so deleting the row BLANKS them with no error:
  // the cost sheet loses the CAD its price came from and the order BOM inherits "no CAD". That is
  // how ESSKY085LS's approved sheet and BOM (and EBEW-001's sheet) lost theirs in Aug 2026 — which
  // later stopped the dyed fabric finding its style slot and hid the sheet from the drift sweep.
  if (operation === 'delete') {
    const refs = [
      [cad._count.costingFabricItems, 'cost sheet line'],
      [cad._count.orderBomItems, 'order BOM line'],
      [cad._count.order_items, 'order line'],
      [cad._count.order_item_costings, 'order costing'],
      [cad._count.stockAllocations, 'fabric stock reservation'],
    ]
      .filter(([n]) => (n as number) > 0)
      .map(([n, label]) => `${n} ${label}${(n as number) > 1 ? 's' : ''}`);
    if (refs.length > 0) {
      throw new BusinessError(
        `Cannot delete CAD entry: ${refs.join(', ')} still use it. ` +
          `Create a new version of the cost sheet (or order BOM) on another CAD row first, then delete this one.`
      );
    }
  }

  // Check if CAD is approved
  if (cad.approvalStatus === 'APPROVED') {
    throw new BusinessError(
      `Cannot ${operation} CAD entry: This CAD has been approved and is locked. ` +
        `Approved by: ${cad.approvedBy} on ${formatDateTime24(cad.approvedAt)}. ` +
        `To make changes, first reject the approval, make your changes, then resubmit for approval.`
    );
  }

  // Two-owner split: a row whose PRICE is approved is locked from the CAD side too —
  // editing cutableWidth/cadMeters (or deleting the row and cascading its size breakdowns)
  // would silently invalidate or destroy an approved costing.
  if (cad.costingApprovalStatus === 'APPROVED' || cad.costingApprovalStatus === 'ALTERNATE_APPROVED') {
    throw new BusinessError(
      `Cannot ${operation} CAD entry: This row has an approved costing built on its geometry. ` +
        `Unapprove the costing on the Fabric Costing Options page first, then make CAD changes.`
    );
  }

  // There is no "costed PRODUCTION CAD" lock any more (2026-09-25). A Production CAD is a lot's
  // marker and is never costed; the price and `isLocked` only ever came from Fabric Costing →
  // Promote to Production, which is retired. That rule outlived its purpose and left rejected,
  // unused rows nobody could edit or delete (IP00138, LNG279). What protects a Production CAD
  // is what protects every row above: its approval, and what still uses it.
}
