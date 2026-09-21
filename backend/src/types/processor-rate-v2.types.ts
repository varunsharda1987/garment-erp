/**
 * Processor Rate Card V2 Types
 * Matrix-based rate card system for DYEING and PRINTING processors
 */

// Processing types supported in V2
export type ProcessingTypeV2 = 'DYEING' | 'PRINTING';

// Printing sub-types (only applicable when processingType is PRINTING)
export type PrintingTypeV2 = 'PIGMENT' | 'PROCIAN' | 'DISCHARGE' | 'PIGMENT_DISCHARGE';

// Screen/Machine types for printing (determines screen cost)
export type ScreenType = 'ROTARY' | 'FLATBELT' | 'TABLE';

// All valid printing types
export const PRINTING_TYPES: PrintingTypeV2[] = ['PIGMENT', 'PROCIAN', 'DISCHARGE', 'PIGMENT_DISCHARGE'];

// All valid screen types
export const SCREEN_TYPES: ScreenType[] = ['ROTARY', 'FLATBELT', 'TABLE'];

// Display labels for printing types
export const PRINTING_TYPE_LABELS: Record<PrintingTypeV2, string> = {
  PIGMENT: 'Pigment',
  PROCIAN: 'Procian',
  DISCHARGE: 'Discharge',
  PIGMENT_DISCHARGE: 'Pigment Discharge',
};

// Display labels for screen types
export const SCREEN_TYPE_LABELS: Record<ScreenType, string> = {
  ROTARY: 'Rotary',
  FLATBELT: 'Flat Belt',
  TABLE: 'Table',
};

// Default screen costs per screen (in ₹)
export const DEFAULT_SCREEN_COSTS: Record<ScreenType, number> = {
  ROTARY: 3000,
  FLATBELT: 1100,
  TABLE: 1000,
};

// Processor info for dropdowns
export interface ProcessorInfo {
  id: string;
  name: string;
  code: string;
  rating?: number;
}

// Slab definition (column header)
export interface SlabDefinition {
  id: string;
  slabOrder: number;
  minQuantity: number;
  maxQuantity: number;
  slabLabel: string;
  isActive: boolean;
}

// Slab input for create/update
export interface SlabInput {
  id?: string; // Existing slab ID (for update) or undefined (for create)
  slabOrder: number;
  minQuantity: number;
  maxQuantity: number;
  slabLabel?: string;
}

// Greige info for row population
export interface GreigeForRateCard {
  id: string;
  greigeCode: string;
  greigeName: string;
  genericGreigeName: string;
  composition: string;
  greigeWidth: number;
}

// Rate entry for saving
export interface RateEntry {
  greigeId: string;
  slabId: string;
  ratePerMeter: number | null; // null means no rate set
}

// Greige rate entry (for array format to avoid serializer UUID key corruption)
export interface GreigeRateEntry {
  slabId: string;
  ratePerMeter: number | null;
}

// Greige row in the matrix with rates
export interface GreigeRow {
  id: string;
  greigeCode: string;
  greigeName: string;
  genericGreigeName: string;
  rates: GreigeRateEntry[]; // Array format to avoid UUID key corruption by serializer
  shrinkagePercent?: number | null; // Shrinkage percentage for this greige at this processor
}

// Complete processor rate matrix
export interface ProcessorRateMatrix {
  processor: ProcessorInfo;
  processingType: ProcessingTypeV2;
  printingType?: PrintingTypeV2; // Only for PRINTING
  slabs: SlabDefinition[];
  greiges: GreigeRow[];
}

// Copy rates input
export interface CopyRatesInput {
  sourceProcessorId: string;
  targetProcessorId: string;
  processingType: ProcessingTypeV2;
  printingType?: PrintingTypeV2; // Required when processingType is PRINTING
  copySlabs: boolean;
  copyRates: boolean;
}

// Search filters for rate cards
export interface RateCardSearchFilters {
  processorId?: string;
  processingType?: ProcessingTypeV2;
  printingType?: PrintingTypeV2; // For PRINTING only
  greigeId?: string;
  isActive?: boolean;
}

// Rate lookup query (for fabric costing)
export interface RateLookupQuery {
  processorId?: string; // Optional - if not provided, SYSTEM_DEFAULT rates will be used
  processingType: ProcessingTypeV2;
  printingType?: PrintingTypeV2; // Required when processingType is PRINTING
  greigeId: string;
  quantityMeters: number;
}

// Rate lookup result
export interface RateLookupResult {
  id: string;
  processorId: string;
  processorName: string;
  processingType: ProcessingTypeV2;
  printingType?: PrintingTypeV2; // Only for PRINTING
  greigeId: string;
  greigeName: string;
  slabId: string;
  slabLabel: string;
  minQuantity: number;
  maxQuantity: number;
  ratePerMeter: number;
  totalCost: number;
  shrinkagePercent?: number | null; // Shrinkage percentage for this greige at this processor
  screenCostPerScreen?: number | null; // Screen cost per screen (PRINTING only) - fixed cost per color screen
}

// ============================================
// Missing-rate diagnosis
// ============================================

/**
 * Why a rate lookup found nothing.
 *
 * Ordered from "nothing is set up" to "almost set up" — the FIRST condition that matches is
 * the one worth telling the operator about, because fixing it is what unblocks them.
 */
export type MissingRateCode =
  | 'NO_SLABS' // processor has no quantity slabs for this processing type
  | 'NO_RATES_AT_ALL' // no rate cards at all for this processor + processing type
  | 'NO_GREIGE_RATE' // nothing rated for this greige
  | 'NO_PRINTING_TYPE_RATE' // greige is rated, but not for the requested printing type
  | 'NO_SLAB_RATE'; // greige (+ printing type) rated, but not in this quantity's slab

/**
 * The answer to "why can't this row be costed". `message` is written for the operator and is
 * shown verbatim; the rest is context so the UI can deep-link the Rate Card page.
 */
export interface MissingRateExplanation {
  code: MissingRateCode;
  message: string;
  processorId: string | null;
  processorName: string | null;
  processingType: ProcessingTypeV2;
  printingType: PrintingTypeV2 | null;
  greigeId: string;
  greigeName: string | null;
  quantityMeters: number;
  /** The slab the quantity fell into. Null only when the processor has no slabs at all. */
  slabLabel: string | null;
  /** Up to a few greiges this processor DOES rate, so the operator can spot a wrong pick. */
  availableGreiges: string[];
  /** Printing types this processor DOES rate for this greige. */
  availablePrintingTypes: PrintingTypeV2[];
}

// Shrinkage entry for saving (one per greige, shared across slabs)
export interface ShrinkageEntry {
  greigeId: string;
  shrinkagePercent: number | null;
}

// Bulk save matrix request
export interface SaveMatrixRequest {
  slabs: SlabInput[];
  rates: RateEntry[];
  shrinkages?: ShrinkageEntry[]; // Shrinkage values per greige
  deletedGreigeIds?: string[];
}

// ============================================
// Summary Dashboard Types
// ============================================

// Statistics for a single processing type (DYEING or PRINTING)
export interface ProcessorTypeStats {
  slabCount: number;
  greigeCount: number; // Greiges with rates configured
  totalRateCount: number; // Total rate entries
  coverage: number; // Percentage of matrix filled (0-100)
  minRate?: number;
  maxRate?: number;
  slabRanges?: string[]; // e.g., ["0-500m", "500-2000m"]
}

// Summary for a single processor
export interface ProcessorSummary {
  id: string;
  name: string;
  code: string;
  dyeing: ProcessorTypeStats;
  printing: ProcessorTypeStats;
  status: 'NOT_CONFIGURED' | 'PARTIAL' | 'COMPLETE';
  lastUpdatedAt?: string;
}

// Complete summary response
export interface ProcessorRateCardSummary {
  processors: ProcessorSummary[];
  totals: {
    totalProcessors: number;
    configuredProcessors: number;
    completeProcessors: number;
    totalGreigeCount: number;
  };
  processingTypeSummary: {
    DYEING: {
      totalSlabs: number;
      totalRates: number;
      processorsConfigured: number;
      averageCoverage: number;
    };
    PRINTING: {
      totalSlabs: number;
      totalRates: number;
      processorsConfigured: number;
      averageCoverage: number;
    };
  };
}
