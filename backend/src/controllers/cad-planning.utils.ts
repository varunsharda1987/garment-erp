/**
 * Shared utilities, types, and constants for CAD Planning controllers.
 * Extracted from cad-planning.controller.ts to enable splitting into smaller files.
 */

import { Prisma } from '@prisma/client';
import prisma from '../config/database';

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
  if (layerLengthMeters <= 10) return 0.10; // 10 cm
  if (layerLengthMeters <= 20) return 0.20; // 20 cm
  return 0.30; // 30 cm
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
  const margin = layerMarginMeters || 0;
  return (cadMeters + margin) / piecesPerMarker;
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
        message: `Width cannot exceed greige width (${greigeWidth}")`
      };
    }
    return { valid: true };
  }

  // Non-embroidery: must be within finished width range
  if (minWidth !== null && cutableWidth < minWidth) {
    return {
      valid: false,
      message: `Width must be at least ${minWidth}" (min finished width from greige)`
    };
  }

  if (maxWidth !== null && cutableWidth > maxWidth) {
    return {
      valid: false,
      message: `Width cannot exceed ${maxWidth}" (max finished width from greige)`
    };
  }

  return { valid: true };
}

/**
 * Validates if CAD row can be modified based on approval status
 * @param cadId - The CAD entry ID to validate
 * @param operation - The operation being attempted ('update' or 'delete')
 * @throws Error if CAD is locked from modifications
 */
export async function validateCADModification(
  cadId: string,
  operation: 'update' | 'delete'
): Promise<void> {
  const cad = await prisma.fabric_width_cad.findUnique({
    where: { id: cadId },
    select: {
      id: true,
      approvalStatus: true,
      isLocked: true,
      purpose: true,
      approvedAt: true,
      approvedBy: true,
    },
  });

  if (!cad) {
    throw new Error('CAD entry not found');
  }

  // Check if CAD is approved
  if (cad.approvalStatus === 'APPROVED') {
    throw new Error(
      `Cannot ${operation} CAD entry: This CAD has been approved and is locked. ` +
      `Approved by: ${cad.approvedBy} on ${cad.approvedAt?.toLocaleString()}. ` +
      `To make changes, first reject the approval, make your changes, then resubmit for approval.`
    );
  }

  // Additional check for PRODUCTION CAD with isLocked flag
  if (cad.purpose === 'PRODUCTION' && cad.isLocked) {
    throw new Error(
      `Cannot ${operation} CAD entry: This is a locked PRODUCTION CAD. ` +
      `Production CADs cannot be modified after locking to maintain data integrity.`
    );
  }
}
