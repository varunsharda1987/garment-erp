/**
 * Processor Rate Card V2 Types
 * Matrix-based rate card system for DYEING and PRINTING processors
 */

// Processing types supported in V2
export type ProcessingTypeV2 = 'DYEING' | 'PRINTING';

// Printing sub-types (only applicable when processingType is PRINTING)
export type PrintingTypeV2 = 'PIGMENT' | 'PROCIAN' | 'DISCHARGE' | 'PIGMENT_DISCHARGE';

// All valid printing types
export const PRINTING_TYPES: PrintingTypeV2[] = ['PIGMENT', 'PROCIAN', 'DISCHARGE', 'PIGMENT_DISCHARGE'];

// Display labels for printing types
export const PRINTING_TYPE_LABELS: Record<PrintingTypeV2, string> = {
  PIGMENT: 'Pigment',
  PROCIAN: 'Procian',
  DISCHARGE: 'Discharge',
  PIGMENT_DISCHARGE: 'Pigment Discharge',
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

// Slab input for create/update (used locally before saving)
export interface SlabInput {
  id?: string; // Existing slab ID (for update) or undefined (for create)
  slabOrder: number;
  minQuantity: number;
  maxQuantity: number;
  slabLabel?: string;
  isNew?: boolean; // Local flag for newly added slabs
}

// Greige info for row population
export interface GreigeForRateCard {
  id: string;
  greigeCode: string;
  greigeName: string;
  genericGreigeName: string;
  composition: string;
  greigeWidth: number;
  averageShrinkagePercent?: number | null; // Default shrinkage from greige master
}

// Rate entry for saving
export interface RateEntry {
  greigeId: string;
  slabId: string;
  ratePerMeter: number | null; // null means no rate set
}

// Greige rate entry from API (array format)
export interface GreigeRateEntry {
  slabId: string;
  ratePerMeter: number | null;
}

// Greige row from API (uses array format to avoid serializer UUID key corruption)
export interface GreigeRowFromAPI {
  id: string;
  greigeCode: string;
  greigeName: string;
  genericGreigeName: string;
  rates: GreigeRateEntry[]; // Array format from API
  shrinkagePercent?: number | null; // Shrinkage percentage for this greige at this processor (with fallback to averageShrinkagePercent)
  averageShrinkagePercent?: number | null; // Default shrinkage from greige master
}

// Greige row in the matrix with rates (local format for editing)
export interface GreigeRow {
  id: string;
  greigeCode: string;
  greigeName: string;
  genericGreigeName: string;
  rates: Record<string, number | null>; // slabId -> rate (local format for easy editing)
  shrinkagePercent?: number | null; // Shrinkage percentage for this greige at this processor (with fallback to averageShrinkagePercent)
  averageShrinkagePercent?: number | null; // Default shrinkage from greige master (read-only, for placeholder display)
  isNew?: boolean; // Local flag for newly added rows
}

// Convert API format to local format
export function convertGreigeFromAPI(greige: GreigeRowFromAPI): GreigeRow {
  const rates: Record<string, number | null> = {};
  for (const entry of greige.rates) {
    rates[entry.slabId] = entry.ratePerMeter;
  }
  return {
    id: greige.id,
    greigeCode: greige.greigeCode,
    greigeName: greige.greigeName,
    genericGreigeName: greige.genericGreigeName,
    rates,
    shrinkagePercent: greige.shrinkagePercent ?? null,
    averageShrinkagePercent: greige.averageShrinkagePercent ?? null,
  };
}

// Complete processor rate matrix from API
export interface ProcessorRateMatrixFromAPI {
  processor: ProcessorInfo;
  processingType: ProcessingTypeV2;
  printingType?: PrintingTypeV2; // Only for PRINTING
  slabs: SlabDefinition[];
  greiges: GreigeRowFromAPI[];
}

// Complete processor rate matrix (local format)
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

// Shrinkage entry for saving (one per greige, shared across slabs)
export interface ShrinkageEntry {
  greigeId: string;
  shrinkagePercent: number | null;
}

// Save matrix request
export interface SaveMatrixRequest {
  processingType: ProcessingTypeV2;
  printingType?: PrintingTypeV2; // Required when processingType is PRINTING
  slabs: SlabInput[];
  rates: RateEntry[];
  shrinkages?: ShrinkageEntry[]; // Shrinkage values per greige
  deletedGreigeIds?: string[];
}

// Local state for editing
export interface ProcessorRateCardState {
  // Selection
  processingType: ProcessingTypeV2;
  printingType: PrintingTypeV2; // Current printing sub-type (only used when processingType is PRINTING)
  selectedProcessorId: string | null;

  // Data from API
  processors: ProcessorInfo[];
  originalMatrix: ProcessorRateMatrix | null;

  // Edited state
  slabs: SlabInput[];
  greiges: GreigeRow[];
  deletedGreigeIds: string[];

  // UI State
  loading: boolean;
  saving: boolean;
  hasUnsavedChanges: boolean;

  // Modals
  isAddGreigeModalOpen: boolean;
  isCopyModalOpen: boolean;
}

// ============================================
// Lace Rate Card Types
// ============================================

// Material type for rate card (fabric vs lace)
export type MaterialTypeV2 = 'FABRIC' | 'LACE';

// Greige lace info for row population
export interface GreigeLaceForRateCard {
  id: string;
  code: string;
  name: string;
  width: number | null;
  composition: string | null;
  laceType?: string | null;
  expectedShrinkagePercent: number | null;
  costPerMeterGreige: number | null;
}

// Lace rate entry for saving
export interface LaceRateEntry {
  laceId: string;
  slabId: string;
  ratePerMeter: number;
}

// Lace row in the rate matrix (for display)
export interface LaceRow {
  laceId: string;
  laceName: string;
  laceCode: string;
  width: number | null;
  composition: string | null;
  expectedShrinkagePercent: number | null;
  costPerMeterGreige: number | null;
  rates: Record<string, number | null>; // slabId -> rate
  isNew?: boolean; // Local flag for newly added rows
}

// Lace rate entry from API (array format)
// BUG-PRC1 fix: Backend sends rates as Record<string, number | null>, not array
// Old interface kept for backwards compatibility during migration
export interface LaceRateEntryFromAPI {
  slabId: string;
  ratePerMeter: number | null;
}

// Lace row from API - rates is Record keyed by slabId, not array
export interface LaceRowFromAPI {
  laceId: string;
  laceName: string;
  laceCode: string;
  width: number | null;
  composition: string | null;
  expectedShrinkagePercent: number | null;
  costPerMeterGreige: number | null;
  rates: Record<string, number | null>; // BUG-PRC1 fix: was LaceRateEntryFromAPI[]
}

// Convert lace API format to local format (now a passthrough since types match)
export function convertLaceFromAPI(lace: LaceRowFromAPI): LaceRow {
  return {
    laceId: lace.laceId,
    laceName: lace.laceName,
    laceCode: lace.laceCode,
    width: lace.width,
    composition: lace.composition,
    expectedShrinkagePercent: lace.expectedShrinkagePercent,
    costPerMeterGreige: lace.costPerMeterGreige,
    rates: lace.rates, // Already Record<string, number | null>
  };
}

// Lace slab info (simplified for display)
export interface LaceSlabInfo {
  id: string;
  slabLabel: string;
  minQuantity: number;
  maxQuantity: number;
  slabOrder: number;
}

// Lace rate matrix from API
export interface LaceRateMatrixFromAPI {
  processor: ProcessorInfo;
  processingType: 'DYEING';
  slabs: LaceSlabInfo[];
  laces: LaceRowFromAPI[];
}

// Lace rate matrix (local format)
export interface LaceRateMatrix {
  processor: ProcessorInfo;
  processingType: 'DYEING';
  slabs: LaceSlabInfo[];
  laces: LaceRow[];
}

// Save lace matrix request
export interface SaveLaceMatrixRequest {
  slabs: SlabInput[];
  rates: LaceRateEntry[];
  deletedLaceIds?: string[];
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
