/**
 * Fabric Cost Calculation Service
 *
 * Implements THREE SOURCING STRATEGIES for fabric costing:
 * 1. STOCK_REUSE: Use existing fabric stock (Weighted Average Cost)
 * 2. READY_FABRIC: Purchase ready/finished fabric
 * 3. GREIGE_PROCESSED: Purchase raw greige and process it
 *
 * IMPORTANT NOTES:
 * - This service shows ALL three options for comparison
 * - Recommends the CHEAPEST option among available strategies
 * - Users can manually override to select a different strategy
 * - Stock WAC (Weighted Average Cost) is transactional but CORRECT for STOCK_REUSE strategy
 * - Latest procurement price is used for READY_FABRIC as historical market reference
 * - System does NOT automatically use stock - it's presented as an OPTION
 *
 * Returns all options for comparison and recommendation
 */

import prisma from '../config/database';
import { lookupRate, getAllDyeingPrintingProcessors } from './processor-rate-v2.service';
import type { ProcessingTypeV2, RateLookupResult } from '../types/processor-rate-v2.types';

export interface FabricCostOptions {
  fabricId: string;
  fabricName?: string; // Optional - will be fetched from database if not provided
  cadMeters: number;
  width: number;
  orderQuantity?: number;
  styleId?: string;
}

export interface StockOption {
  available: boolean;
  stockLotId: string | null;
  stockCost: number | null; // Weighted Average Cost
  quantityAvailable: number | null;
  warehouseLocation: string | null;
  originStyleId: string | null;
  originStyleName: string | null;
  totalCost: number | null;
  details: string;
  // Rate source info
  rateSource: 'STOCK_WAC' | null;
  lastUpdated: string | null; // ISO date when stock was last updated
}

export interface ReadyFabricOption {
  available: boolean;
  readyFabricCost: number | null;
  procurementId: string | null;
  supplierName: string | null;
  totalCost: number | null;
  details: string;
  // Rate source info
  rateSource: 'PROCUREMENT' | 'FABRIC_MASTER' | null;
  procurementDate: string | null; // ISO date of last procurement
  lastUpdated: string | null; // ISO date when rate was last updated
}

export interface GreigeProcessingOption {
  available: boolean;
  greigeCost: number | null;
  processingCost: number | null;
  processorId: string | null;
  processorName: string | null;
  rateCardId: string | null;
  processingType: string | null;
  slabLabel: string | null;
  totalCost: number | null;
  costBreakdown: {
    greigeCostPerMeter: number | null;
    processingCostPerMeter: number | null;
    totalPerMeter: number | null;
  };
  details: string;
  // Rate source info
  greigeRateSource: 'PROCUREMENT' | 'STOCK_WAC' | 'GREIGE_MASTER' | null;
  processingRateSource: 'RATE_CARD' | 'PROCESSOR_DEFAULT' | null;
  greigeProcurementDate: string | null;
  rateCardEffectiveDate: string | null;
  lastUpdated: string | null;
}

export interface FabricCostCalculationResult {
  fabricId: string;
  fabricName: string;
  cadMeters: number;
  width: number;

  // All sourcing options
  stockReuse: StockOption;
  readyFabric: ReadyFabricOption;
  greigeProcessing: GreigeProcessingOption;

  // Recommendation
  recommendedStrategy: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED' | 'NONE';
  recommendedCost: number | null;
  savings: number | null; // Savings vs most expensive option
  comparisonTable: {
    strategy: string;
    costPerMeter: number | null;
    totalCost: number | null;
    savings: number | null;
    available: boolean;
  }[];
}

/**
 * Calculate fabric cost with all sourcing options
 */
export async function calculateFabricCost(options: FabricCostOptions): Promise<FabricCostCalculationResult> {
  const { fabricId, cadMeters, width, orderQuantity, styleId } = options;

  // Get fabric details
  const fabric = await prisma.fabric_master.findUnique({
    where: { id: fabricId },
    select: {
      id: true,
      fabricName: true,
      fabricCode: true,
      genericGreigeName: true,
      finishType: true,
      costPerMeter: true,
      greigeId: true,
      greige: {
        select: {
          id: true,
          greigeName: true,
          costPerMeter: true,
        },
      },
    },
  });

  if (!fabric) {
    throw new Error(`Fabric not found: ${fabricId}`);
  }

  const totalMetersNeeded = cadMeters * (orderQuantity || 1);

  // Option 1: Check stock availability
  const stockOption = await checkStockAvailability(fabricId, width, totalMetersNeeded, styleId);

  // Option 2: Check ready fabric cost
  const readyFabricOption = await getReadyFabricCost(fabricId, totalMetersNeeded, fabric);

  // Option 3: Calculate greige + processing
  const greigeProcessingOption = await calculateGreigeProcessingCost(fabricId, totalMetersNeeded, fabric);

  // Build comparison table
  const comparisonTable: {
    strategy: string;
    costPerMeter: number | null;
    totalCost: number | null;
    savings: number | null;
    available: boolean;
  }[] = [
    {
      strategy: 'Stock Reuse',
      costPerMeter: stockOption.stockCost,
      totalCost: stockOption.totalCost,
      savings: null,
      available: stockOption.available,
    },
    {
      strategy: 'Ready Fabric',
      costPerMeter: readyFabricOption.readyFabricCost,
      totalCost: readyFabricOption.totalCost,
      savings: null,
      available: readyFabricOption.available,
    },
    {
      strategy: 'Greige + Processing',
      costPerMeter: greigeProcessingOption.costBreakdown.totalPerMeter,
      totalCost: greigeProcessingOption.totalCost,
      savings: null,
      available: greigeProcessingOption.available,
    },
  ];

  // Calculate recommendation
  const availableOptions = comparisonTable.filter((opt) => opt.available && opt.totalCost !== null);

  let recommendedStrategy: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED' | 'NONE' = 'NONE';
  let recommendedCost: number | null = null;
  let savings: number | null = null;

  if (availableOptions.length > 0) {
    // Sort by total cost (ascending)
    availableOptions.sort((a, b) => (a.totalCost || 0) - (b.totalCost || 0));

    const cheapest = availableOptions[0];
    const mostExpensive = availableOptions[availableOptions.length - 1];

    recommendedCost = cheapest.totalCost;
    savings = (mostExpensive.totalCost || 0) - (cheapest.totalCost || 0);

    // Map strategy name to enum
    if (cheapest.strategy === 'Stock Reuse') recommendedStrategy = 'STOCK_REUSE';
    else if (cheapest.strategy === 'Ready Fabric') recommendedStrategy = 'READY_FABRIC';
    else if (cheapest.strategy === 'Greige + Processing') recommendedStrategy = 'GREIGE_PROCESSED';

    // Calculate savings for each option
    comparisonTable.forEach((opt) => {
      if (opt.available && opt.totalCost !== null) {
        opt.savings = (mostExpensive.totalCost || 0) - opt.totalCost;
      }
    });
  }

  return {
    fabricId,
    fabricName: fabric.fabricName,
    cadMeters,
    width,
    stockReuse: stockOption,
    readyFabric: readyFabricOption,
    greigeProcessing: greigeProcessingOption,
    recommendedStrategy,
    recommendedCost,
    savings,
    comparisonTable,
  };
}

/**
 * Check stock availability (priority: originStyleId match, then lowest WAC)
 */
async function checkStockAvailability(
  fabricId: string,
  width: number,
  quantityNeeded: number,
  styleId?: string
): Promise<StockOption> {
  const stockLots = await prisma.fabric_stock.findMany({
    where: {
      fabricId,
      status: 'AVAILABLE',
      quantityAvailable: { gte: quantityNeeded },
      OR: [{ finishedWidth: width }, { cutableWidth: width }],
    },
    include: {
      originStyle: {
        select: { id: true, styleName: true },
      },
    },
    orderBy: [
      { originStyleId: styleId ? 'asc' : 'desc' }, // Prefer same style
      { weightedAvgCost: 'asc' }, // Then lowest cost
    ],
    take: 1,
  });

  if (stockLots.length === 0) {
    return {
      available: false,
      stockLotId: null,
      stockCost: null,
      quantityAvailable: null,
      warehouseLocation: null,
      originStyleId: null,
      originStyleName: null,
      totalCost: null,
      details: 'No stock available for this fabric and width',
      rateSource: null,
      lastUpdated: null,
    };
  }

  const stock = stockLots[0];
  const wac = Number(stock.weightedAvgCost);
  const totalCost = wac * quantityNeeded;

  return {
    available: true,
    stockLotId: stock.id,
    stockCost: wac,
    quantityAvailable: Number(stock.quantityAvailable),
    warehouseLocation: stock.warehouseLocation,
    originStyleId: stock.originStyleId,
    originStyleName: stock.originStyle?.styleName || null,
    totalCost,
    details: `${Number(stock.quantityAvailable).toFixed(2)}m available @ ₹${wac}/m (WAC)${stock.originStyle ? ` from ${stock.originStyle.styleName}` : ''}`,
    rateSource: 'STOCK_WAC',
    lastUpdated: stock.updatedAt ? new Date(stock.updatedAt).toISOString() : null,
  };
}

/**
 * Get ready fabric cost from latest procurement or fabric_master
 */
async function getReadyFabricCost(fabricId: string, quantityNeeded: number, fabric: any): Promise<ReadyFabricOption> {
  // Try to get latest procurement rate
  const latestProcurement = await prisma.fabric_procurement.findFirst({
    where: {
      fabricId,
      procurementType: 'FINISHED',
      status: { in: ['RECEIVED', 'COMPLETED'] },
    },
    include: {
      supplier: {
        select: { id: true, name: true },
      },
    },
    orderBy: { purchaseDate: 'desc' },
    take: 1,
  });

  let cost: number | null = null;
  let procurementId: string | null = null;
  let supplierName: string | null = null;
  let details = '';
  let rateSource: 'PROCUREMENT' | 'FABRIC_MASTER' | null = null;
  let procurementDate: string | null = null;
  let lastUpdated: string | null = null;

  if (latestProcurement) {
    cost = Number(latestProcurement.ratePerUnit);
    procurementId = latestProcurement.id;
    supplierName = latestProcurement.supplier.name;
    rateSource = 'PROCUREMENT';
    procurementDate = latestProcurement.purchaseDate ? new Date(latestProcurement.purchaseDate).toISOString() : null;
    lastUpdated = latestProcurement.updatedAt ? new Date(latestProcurement.updatedAt).toISOString() : null;
    details = `Latest procurement: ₹${cost}/m from ${supplierName}`;
  } else if (fabric.costPerMeter) {
    cost = Number(fabric.costPerMeter);
    rateSource = 'FABRIC_MASTER';
    lastUpdated = fabric.updatedAt ? new Date(fabric.updatedAt).toISOString() : null;
    details = `Fabric master rate: ₹${cost}/m`;
  } else {
    return {
      available: false,
      readyFabricCost: null,
      procurementId: null,
      supplierName: null,
      totalCost: null,
      details: 'No ready fabric cost available',
      rateSource: null,
      procurementDate: null,
      lastUpdated: null,
    };
  }

  return {
    available: true,
    readyFabricCost: cost,
    procurementId,
    supplierName,
    totalCost: cost * quantityNeeded,
    details,
    rateSource,
    procurementDate,
    lastUpdated,
  };
}

/**
 * Calculate greige + processing cost
 * Uses V2 rate lookup with direct greigeId reference
 */
async function calculateGreigeProcessingCost(
  fabricId: string,
  quantityNeeded: number,
  fabric: any
): Promise<GreigeProcessingOption> {
  // Check if fabric has greige reference
  if (!fabric.greigeId || !fabric.greige) {
    return {
      available: false,
      greigeCost: null,
      processingCost: null,
      processorId: null,
      processorName: null,
      rateCardId: null,
      processingType: null,
      slabLabel: null,
      totalCost: null,
      costBreakdown: {
        greigeCostPerMeter: null,
        processingCostPerMeter: null,
        totalPerMeter: null,
      },
      details: 'No greige reference found for this fabric',
      greigeRateSource: null,
      processingRateSource: null,
      greigeProcurementDate: null,
      rateCardEffectiveDate: null,
      lastUpdated: null,
    };
  }

  // Get greige cost with priority: procurement → stock → greige_master
  // 1. First try latest procurement
  const latestGreigeProcurement = await prisma.fabric_procurement.findFirst({
    where: {
      greigeId: fabric.greigeId,
      procurementType: 'GREIGE',
      status: { in: ['RECEIVED', 'PROCESSING', 'COMPLETED'] },
    },
    orderBy: { purchaseDate: 'desc' },
  });

  // 2. If no procurement, check greige stock for valuation rate (WAC)
  // Greige stock is tracked via materials table with greigeId reference
  const greigeStockLevel = await prisma.stock_levels.findFirst({
    where: {
      materials: {
        greigeId: fabric.greigeId,
        materialType: 'GREIGE',
      },
      quantity: { gt: 0 },
      valuationRate: { not: null },
    },
    orderBy: { valuationRate: 'asc' },
  });

  // 3. Priority: procurement rate → stock valuation rate → greige master default cost
  let greigeCostPerMeter: number | null = null;
  let greigeRateSource: 'PROCUREMENT' | 'STOCK_WAC' | 'GREIGE_MASTER' | null = null;
  let greigeProcurementDate: string | null = null;
  let greigeLastUpdated: string | null = null;

  if (latestGreigeProcurement) {
    greigeCostPerMeter = Number(latestGreigeProcurement.ratePerUnit);
    greigeRateSource = 'PROCUREMENT';
    greigeProcurementDate = latestGreigeProcurement.purchaseDate
      ? new Date(latestGreigeProcurement.purchaseDate).toISOString()
      : null;
    greigeLastUpdated = latestGreigeProcurement.updatedAt
      ? new Date(latestGreigeProcurement.updatedAt).toISOString()
      : null;
  } else if (greigeStockLevel?.valuationRate) {
    greigeCostPerMeter = Number(greigeStockLevel.valuationRate);
    greigeRateSource = 'STOCK_WAC';
    greigeLastUpdated = greigeStockLevel.lastUpdated ? new Date(greigeStockLevel.lastUpdated).toISOString() : null;
  } else if (fabric.greige.costPerMeter) {
    greigeCostPerMeter = Number(fabric.greige.costPerMeter);
    greigeRateSource = 'GREIGE_MASTER';
    greigeLastUpdated = fabric.greige.updatedAt ? new Date(fabric.greige.updatedAt).toISOString() : null;
  }

  if (!greigeCostPerMeter) {
    return {
      available: false,
      greigeCost: null,
      processingCost: null,
      processorId: null,
      processorName: null,
      rateCardId: null,
      processingType: null,
      slabLabel: null,
      totalCost: null,
      costBreakdown: {
        greigeCostPerMeter: null,
        processingCostPerMeter: null,
        totalPerMeter: null,
      },
      details: 'No greige cost available',
      greigeRateSource: null,
      processingRateSource: null,
      greigeProcurementDate: null,
      rateCardEffectiveDate: null,
      lastUpdated: null,
    };
  }

  // Determine processing type from finish type
  const processingType = mapFinishTypeToProcessing(fabric.finishType);

  if (!processingType) {
    return {
      available: false,
      greigeCost: greigeCostPerMeter * quantityNeeded,
      processingCost: null,
      processorId: null,
      processorName: null,
      rateCardId: null,
      processingType: null,
      slabLabel: null,
      totalCost: null,
      costBreakdown: {
        greigeCostPerMeter,
        processingCostPerMeter: null,
        totalPerMeter: null,
      },
      details: 'Cannot determine processing type',
      greigeRateSource,
      processingRateSource: null,
      greigeProcurementDate,
      rateCardEffectiveDate: null,
      lastUpdated: greigeLastUpdated,
    };
  }

  // Get all DYEING/PRINTING processors to find the best rate
  const processors = await getAllDyeingPrintingProcessors();

  // Find the best rate across all processors using V2 lookup (direct greigeId reference)
  let bestRate: RateLookupResult | null = null;

  for (const processor of processors) {
    const rate = await lookupRate({
      processorId: processor.id,
      processingType: processingType as ProcessingTypeV2,
      greigeId: fabric.greigeId,
      quantityMeters: quantityNeeded,
    });

    if (rate && (!bestRate || rate.ratePerMeter < bestRate.ratePerMeter)) {
      bestRate = rate;
    }
  }

  if (!bestRate) {
    return {
      available: false,
      greigeCost: greigeCostPerMeter * quantityNeeded,
      processingCost: null,
      processorId: null,
      processorName: null,
      rateCardId: null,
      processingType,
      slabLabel: null,
      totalCost: null,
      costBreakdown: {
        greigeCostPerMeter,
        processingCostPerMeter: null,
        totalPerMeter: null,
      },
      details: `No processor rate found for ${processingType} of ${fabric.greige.greigeName || 'greige'}`,
      greigeRateSource,
      processingRateSource: null,
      greigeProcurementDate,
      rateCardEffectiveDate: null,
      lastUpdated: greigeLastUpdated,
    };
  }

  const processingCostPerMeter = bestRate.ratePerMeter;
  const totalPerMeter = greigeCostPerMeter + processingCostPerMeter;
  const totalCost = totalPerMeter * quantityNeeded;

  // Use greige last updated as the reference date
  const rateCardEffectiveDate: string | null = null;
  const lastUpdated = greigeLastUpdated;

  return {
    available: true,
    greigeCost: greigeCostPerMeter * quantityNeeded,
    processingCost: bestRate.totalCost,
    processorId: bestRate.processorId,
    processorName: bestRate.processorName,
    rateCardId: bestRate.id,
    processingType,
    slabLabel: bestRate.slabLabel,
    totalCost,
    costBreakdown: {
      greigeCostPerMeter,
      processingCostPerMeter,
      totalPerMeter,
    },
    details: `Greige: ₹${greigeCostPerMeter}/m + ${processingType}: ₹${processingCostPerMeter.toFixed(2)}/m from ${bestRate.processorName} (${bestRate.slabLabel}) = ₹${totalPerMeter.toFixed(2)}/m`,
    greigeRateSource,
    processingRateSource: 'RATE_CARD',
    greigeProcurementDate,
    rateCardEffectiveDate,
    lastUpdated,
  };
}

/**
 * Map fabric finish type to processing type
 * V2 only supports DYEING and PRINTING
 */
function mapFinishTypeToProcessing(finishType: string | null): ProcessingTypeV2 | null {
  if (!finishType) return null;

  const mapping: { [key: string]: ProcessingTypeV2 | null } = {
    DYED: 'DYEING',
    PRINTED: 'PRINTING',
    YARN_DYED: 'DYEING',
    RAW: null,
  };

  return mapping[finishType] || null;
}

export default {
  calculateFabricCost,
};
