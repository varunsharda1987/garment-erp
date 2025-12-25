/**
 * Processor Rate Card Types
 */

export interface ProcessorRateCard {
  id: string;
  processorId: string;
  processorName?: string;
  processor?: {
    id: string;
    name: string;
    code: string;
  };
  processingType: string; // DYEING, PRINTING, WASHING, FINISHING, EMBROIDERY
  fabricCategory: string; // COTTON, POLYESTER, SILK, BLEND, etc.
  genericFabricName: string | null;
  minQuantityMeters: number;
  maxQuantityMeters: number;
  ratePerMeter: number;
  setupCharge: number | null;
  minimumCharge: number | null;
  turnaroundDays: number | null;
  conditions: string | null;
  priority: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessorRateResult {
  id: string;
  processorId: string;
  processorName: string;
  processingType: string;
  fabricCategory: string;
  genericFabricName: string | null;
  minQuantityMeters: number;
  maxQuantityMeters: number;
  ratePerMeter: number;
  setupCharge: number | null;
  minimumCharge: number | null;
  turnaroundDays: number | null;
  conditions: string | null;
  priority: number;
  totalCost: number;
  effectiveCostPerMeter: number;
}

export interface ProcessorRateQuery {
  processorId?: string;
  processingType: string;
  fabricCategory: string;
  quantityMeters: number;
  genericFabricName?: string;
}

export interface ProcessorInfo {
  id: string;
  name: string;
  code: string;
  rating?: number;
}
