/**
 * Lace Cost Calculation Service
 *
 * Implements THREE SOURCING STRATEGIES for lace costing:
 * 1. STOCK_REUSE: Use existing lace stock (Weighted Average Cost)
 * 2. READY_LACE: Purchase ready/finished lace
 * 3. GREIGE_PROCESSED: Purchase greige lace and process (dye) it
 *
 * IMPORTANT NOTES:
 * - This service shows ALL three options for comparison
 * - Recommends the CHEAPEST option among available strategies
 * - Users can manually override to select a different strategy
 * - Lab dip approval is required for GREIGE_PROCESSED before bulk PO
 * - Shrinkage factor is applied when calculating greige lace requirements
 * - System does NOT automatically use stock - it's presented as an OPTION
 */

import prisma from '../config/database';
import { logWarn } from '../utils/logger';
import { lookupLaceRate } from './processor-rate-v2.service';
import { isLabDipApproved, getApprovedLabDipsForLace } from './laceLabDip.service';
import { toCurrency, multiplyCurrency, addCurrency, divideCurrency, percentOf, toNumber } from '../utils/currency'; // BUG-FAB12 fix

export interface LaceCostOptions {
  laceId: string;
  laceName?: string;
  quantityPerGarment: number; // Meters per garment
  orderQuantity?: number; // Number of garments
  wastagePercent?: number; // Required at runtime — calculateLaceCost throws if omitted (see guard below)
  styleId?: string;
  costSheetId?: string;
  // Pin the dyeing processor instead of letting the calculator pick the cheapest. Set when the
  // user chose a processor explicitly (e.g. while creating a dyed variant) — otherwise their
  // choice would be silently overridden by the cheapest-rate scan.
  processorId?: string;
}

export interface LaceStockOption {
  available: boolean;
  stockLotId: string | null;
  stockCost: number | null; // Weighted Average Cost per meter
  quantityAvailable: number | null;
  warehouseLocation: string | null;
  dyeLotNumber: string | null;
  originStyleId: string | null;
  originStyleCode: string | null;
  totalCost: number | null;
  details: string;
  rateSource: 'STOCK_WAC' | null;
  lastUpdated: string | null;
}

export interface ReadyLaceOption {
  available: boolean;
  readyLaceCost: number | null; // Cost per meter
  supplierId: string | null;
  supplierName: string | null;
  totalCost: number | null;
  details: string;
  // GREIGE_LACE_MASTER = a greige lace purchased and used as-is (undyed), priced from
  // costPerMeterGreige.
  rateSource: 'LACE_MASTER' | 'SUPPLIER_PRICE' | 'GREIGE_LACE_MASTER' | null;
  lastUpdated: string | null;
}

export interface GreigeLaceProcessingOption {
  available: boolean;
  greigeLaceId: string | null;
  greigeLaceName: string | null;
  // ⚠ These two are ORDER TOTALS (rate × greigeQuantityNeeded), NOT rates — they are what the
  // comparison UI shows. The comment here used to say "cost per meter", which sent an order
  // total into the ₹/m columns style_costing_lace_items.greigeCost / order_bom_items.greigeCost,
  // where MRP and the PO rate resolver read them as rates.
  // For a PER-METRE rate use costBreakdown.greigeCostPerMeter / processingCostPerMeter.
  greigeCost: number | null; // TOTAL for the order (₹), not ₹/m
  processingCost: number | null; // TOTAL for the order (₹), not ₹/m
  processorId: string | null;
  processorName: string | null;
  slabLabel: string | null;
  shrinkagePercent: number | null;
  greigeQuantityNeeded: number | null; // Accounts for shrinkage
  totalCost: number | null;
  costBreakdown: {
    greigeCostPerMeter: number | null;
    processingCostPerMeter: number | null;
    shrinkageFactor: number | null;
    effectiveCostPerMeter: number | null; // (greige + processing) / (1 - shrinkage%)
  };
  details: string;
  // Lab dip status
  labDipRequired: boolean;
  labDipId: string | null;
  labDipStatus: string | null;
  labDipApproved: boolean;
  // Rate sources
  greigeRateSource: 'GREIGE_LACE_MASTER' | 'PROCUREMENT' | null;
  processingRateSource: 'RATE_CARD' | null;
  lastUpdated: string | null;
}

export interface LaceCostCalculationResult {
  laceId: string;
  laceName: string;
  /** True when this lace master is greige (raw/undyed) — drives the "create dyed variant" flow. */
  isGreige: boolean;
  quantityPerGarment: number;
  wastagePercent: number;
  effectiveQuantity: number; // With wastage
  totalQuantityNeeded: number; // For order quantity

  // All sourcing options
  stockReuse: LaceStockOption;
  readyLace: ReadyLaceOption;
  greigeProcessing: GreigeLaceProcessingOption;

  // Recommendation
  recommendedStrategy: 'STOCK_REUSE' | 'READY_LACE' | 'GREIGE_PROCESSED' | 'NONE';
  recommendedCost: number | null;
  costPerMeter: number | null;
  costPerGarment: number | null;
  savings: number | null;
  comparisonTable: {
    strategy: string;
    costPerMeter: number | null;
    totalCost: number | null;
    savings: number | null;
    available: boolean;
    notes: string | null;
  }[];
}

/**
 * Calculate lace cost with all sourcing options
 */
export async function calculateLaceCost(options: LaceCostOptions): Promise<LaceCostCalculationResult> {
  const {
    laceId,
    quantityPerGarment,
    orderQuantity = 1,
    wastagePercent,
    styleId,
    costSheetId,
    processorId: preferredProcessorId,
  } = options;

  // Wastage percent is required - no hardcoded defaults
  if (wastagePercent === undefined || wastagePercent === null) {
    throw new Error('wastagePercent is required - no hardcoded defaults allowed');
  }

  // Get lace details
  const lace = await prisma.lace_master.findUnique({
    where: { id: laceId },
    select: {
      id: true,
      laceName: true,
      laceCode: true,
      color: true,
      width: true,
      pricePerMeter: true,
      isGreige: true,
      sourceGreigeLaceId: true,
      costPerMeterGreige: true,
      expectedShrinkagePercent: true,
      // Get source greige lace if this is a finished lace
      sourceGreigeLace: {
        select: {
          id: true,
          laceName: true,
          laceCode: true,
          costPerMeterGreige: true,
          expectedShrinkagePercent: true,
        },
      },
      // Get suppliers
      lace_suppliers: {
        where: { isPreferred: true, isActive: true },
        take: 1,
        select: {
          id: true,
          supplierId: true,
          pricePerMeter: true,
          supplier: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!lace) {
    throw new Error(`Lace not found: ${laceId}`);
  }

  // Calculate quantities
  // BUG-FAB12 fix: use decimal.js for precision
  const wastageFraction = toNumber(divideCurrency(wastagePercent, 100));
  const wastageMultiplier = toNumber(addCurrency(1, wastageFraction));
  const effectiveQuantity = toNumber(multiplyCurrency(quantityPerGarment, wastageMultiplier));
  const totalQuantityNeeded = toNumber(multiplyCurrency(effectiveQuantity, orderQuantity));

  // Option 1: Check stock availability
  const stockOption = await checkLaceStockAvailability(laceId, totalQuantityNeeded, styleId);

  // Option 2: Check ready lace cost
  const readyLaceOption = await getReadyLaceCost(laceId, totalQuantityNeeded, lace);

  // Option 3: Calculate greige + processing
  const greigeProcessingOption = await calculateGreigeLaceProcessingCost(
    laceId,
    totalQuantityNeeded,
    lace,
    costSheetId,
    preferredProcessorId
  );

  // Build comparison table
  const comparisonTable: LaceCostCalculationResult['comparisonTable'] = [
    {
      strategy: 'Stock Reuse',
      costPerMeter: stockOption.stockCost,
      totalCost: stockOption.totalCost,
      savings: null,
      available: stockOption.available,
      notes: stockOption.dyeLotNumber ? `Dye Lot: ${stockOption.dyeLotNumber}` : null,
    },
    {
      strategy: 'Ready Lace',
      costPerMeter: readyLaceOption.readyLaceCost,
      totalCost: readyLaceOption.totalCost,
      savings: null,
      available: readyLaceOption.available,
      notes: null,
    },
    {
      strategy: 'Greige + Dyeing',
      costPerMeter: greigeProcessingOption.costBreakdown.effectiveCostPerMeter,
      totalCost: greigeProcessingOption.totalCost,
      savings: null,
      available: greigeProcessingOption.available,
      notes:
        greigeProcessingOption.labDipRequired && !greigeProcessingOption.labDipApproved
          ? 'Lab dip approval required'
          : null,
    },
  ];

  // Calculate recommendation
  const availableOptions = comparisonTable.filter((opt) => opt.available && opt.totalCost !== null);

  let recommendedStrategy: LaceCostCalculationResult['recommendedStrategy'] = 'NONE';
  let recommendedCost: number | null = null;
  let costPerMeter: number | null = null;
  let costPerGarment: number | null = null;
  let savings: number | null = null;

  if (availableOptions.length > 0) {
    // Sort by total cost (ascending)
    availableOptions.sort((a, b) => (a.totalCost || 0) - (b.totalCost || 0));

    const cheapest = availableOptions[0];
    const mostExpensive = availableOptions[availableOptions.length - 1];

    recommendedCost = cheapest.totalCost;
    costPerMeter = cheapest.costPerMeter;
    costPerGarment = costPerMeter ? costPerMeter * effectiveQuantity : null;
    savings = (mostExpensive.totalCost || 0) - (cheapest.totalCost || 0);

    // Map strategy name to enum
    if (cheapest.strategy === 'Stock Reuse') recommendedStrategy = 'STOCK_REUSE';
    else if (cheapest.strategy === 'Ready Lace') recommendedStrategy = 'READY_LACE';
    else if (cheapest.strategy === 'Greige + Dyeing') recommendedStrategy = 'GREIGE_PROCESSED';

    // Calculate savings for each option
    comparisonTable.forEach((opt) => {
      if (opt.available && opt.totalCost !== null) {
        opt.savings = (mostExpensive.totalCost || 0) - opt.totalCost;
      }
    });
  }

  return {
    laceId,
    laceName: lace.laceName,
    isGreige: Boolean(lace.isGreige),
    quantityPerGarment,
    wastagePercent,
    effectiveQuantity,
    totalQuantityNeeded,
    stockReuse: stockOption,
    readyLace: readyLaceOption,
    greigeProcessing: greigeProcessingOption,
    recommendedStrategy,
    recommendedCost,
    costPerMeter,
    costPerGarment,
    savings,
    comparisonTable,
  };
}

/**
 * Check lace stock availability
 */
async function checkLaceStockAvailability(
  laceId: string,
  quantityNeeded: number,
  styleId?: string
): Promise<LaceStockOption> {
  const stockLots = await prisma.lace_stock.findMany({
    where: {
      laceId,
      status: 'AVAILABLE',
      quantityAvailable: { gte: quantityNeeded },
    },
    include: {
      originStyle: {
        select: { id: true, styleCode: true, styleName: true },
      },
    },
    orderBy: [
      // Prefer same style origin
      { originStyleId: styleId ? 'asc' : 'desc' },
      // Then oldest first (FIFO)
      { receivedDate: 'asc' },
      // Then lowest cost
      { weightedAvgCost: 'asc' },
    ],
    take: 1,
  });

  if (stockLots.length === 0) {
    // Check if any stock exists but insufficient quantity
    const partialStock = await prisma.lace_stock.aggregate({
      where: {
        laceId,
        status: 'AVAILABLE',
        quantityAvailable: { gt: 0 },
      },
      _sum: { quantityAvailable: true },
    });

    const availableQty = Number(partialStock._sum.quantityAvailable || 0);

    return {
      available: false,
      stockLotId: null,
      stockCost: null,
      quantityAvailable: availableQty > 0 ? availableQty : null,
      warehouseLocation: null,
      dyeLotNumber: null,
      originStyleId: null,
      originStyleCode: null,
      totalCost: null,
      details:
        availableQty > 0
          ? `Insufficient stock: ${availableQty.toFixed(2)}m available, need ${quantityNeeded.toFixed(2)}m`
          : 'No stock available for this lace',
      rateSource: null,
      lastUpdated: null,
    };
  }

  const stock = stockLots[0];
  const wac = Number(stock.weightedAvgCost);
  // BUG-FAB12 fix: use decimal.js for precision
  const totalCost = toNumber(multiplyCurrency(wac, quantityNeeded));

  return {
    available: true,
    stockLotId: stock.id,
    stockCost: wac,
    quantityAvailable: Number(stock.quantityAvailable),
    warehouseLocation: stock.warehouseLocation,
    dyeLotNumber: stock.dyeLotNumber,
    originStyleId: stock.originStyleId,
    originStyleCode: stock.originStyle?.styleCode || null,
    totalCost,
    details: `${Number(stock.quantityAvailable).toFixed(2)}m @ ₹${wac.toFixed(2)}/m (WAC)${stock.originStyle ? ` from ${stock.originStyle.styleCode}` : ''}${stock.dyeLotNumber ? ` [Lot: ${stock.dyeLotNumber}]` : ''}`,
    rateSource: 'STOCK_WAC',
    lastUpdated: stock.updatedAt ? new Date(stock.updatedAt).toISOString() : null,
  };
}

/**
 * Get ready lace cost
 */
async function getReadyLaceCost(laceId: string, quantityNeeded: number, lace: any): Promise<ReadyLaceOption> {
  // Priority: supplier price > lace_master pricePerMeter
  const preferredSupplier = lace.lace_suppliers?.[0];

  let cost: number | null = null;
  let supplierId: string | null = null;
  let supplierName: string | null = null;
  let rateSource: ReadyLaceOption['rateSource'] = null;
  let lastUpdated: string | null = null;

  if (preferredSupplier?.pricePerMeter) {
    cost = Number(preferredSupplier.pricePerMeter);
    supplierId = preferredSupplier.supplierId;
    supplierName = preferredSupplier.supplier?.name || null;
    rateSource = 'SUPPLIER_PRICE';
  } else if (lace.pricePerMeter) {
    cost = Number(lace.pricePerMeter);
    rateSource = 'LACE_MASTER';
    lastUpdated = lace.updatedAt ? new Date(lace.updatedAt).toISOString() : null;
  } else if (lace.isGreige && lace.costPerMeterGreige) {
    // Greige used AS-IS (undyed): its purchase price lives in costPerMeterGreige, not
    // pricePerMeter. Without this a greige lace reports "no ready price" and prices at 0.
    cost = Number(lace.costPerMeterGreige);
    rateSource = 'GREIGE_LACE_MASTER';
    lastUpdated = lace.updatedAt ? new Date(lace.updatedAt).toISOString() : null;
  }

  if (!cost) {
    return {
      available: false,
      readyLaceCost: null,
      supplierId: null,
      supplierName: null,
      totalCost: null,
      details: 'No ready lace price available',
      rateSource: null,
      lastUpdated: null,
    };
  }

  return {
    available: true,
    readyLaceCost: cost,
    supplierId,
    supplierName,
    // BUG-FAB12 fix: use decimal.js for precision
    totalCost: toNumber(multiplyCurrency(cost, quantityNeeded)),
    details: supplierName
      ? `₹${cost.toFixed(2)}/m from ${supplierName}`
      : rateSource === 'GREIGE_LACE_MASTER'
        ? `₹${cost.toFixed(2)}/m (greige rate — used as-is, undyed)`
        : `₹${cost.toFixed(2)}/m (Lace Master rate)`,
    rateSource,
    lastUpdated,
  };
}

/** One dyer's rate, resolved at the greige quantity they will actually process. */
interface ResolvedLaceRate {
  ratePerMeter: number;
  slabLabel: string;
  shrinkagePercent: number | null;
  greigeQuantity: number;
}

/**
 * Price a dyeing job on the GREIGE metres the dyer actually processes.
 *
 * Rate cards are banded by quantity, but the quantity that selects the band is only known after
 * the card's shrinkage is read: the dyer handles greige metres (finished ÷ (1 − shrinkage)), not
 * the finished metres the garment needs. Looking the rate up once at the finished quantity — as
 * this used to — can land a whole band too cheap (e.g. 900 finished metres picks the 500–1000
 * band while 1000 greige metres are actually processed), and that under-priced rate is then
 * frozen onto the cost sheet and every PO derived from it.
 *
 * So: look up once to learn the shrinkage, gross up, then look up again at the greige quantity.
 * A second pass is enough — the re-priced band is the one the dyer bills against, and its own
 * shrinkage is used for the final quantity so the two always agree.
 */
async function resolveLaceRateAtGreigeQuantity(
  processorId: string,
  greigeLaceId: string,
  finishedQuantity: number
): Promise<ResolvedLaceRate | null> {
  const assertUsableShrinkage = (percent: number): void => {
    // 100% (or more) makes the shrinkage divisor zero/negative — Infinity downstream.
    if (1 - percent / 100 <= 0) {
      throw new Error(
        `Invalid shrinkage ${percent}% on the processor rate card: must be below 100% (it is a divisor in costing).`
      );
    }
  };

  const first = await lookupLaceRate({ processorId, laceId: greigeLaceId, quantityMeters: finishedQuantity });
  if (!first) return null;

  if (first.shrinkagePercent === null) {
    // No shrinkage on the card: greige == finished, so the first band is already the right one.
    return {
      ratePerMeter: first.ratePerMeter,
      slabLabel: first.slab.label,
      shrinkagePercent: null,
      greigeQuantity: finishedQuantity,
    };
  }

  assertUsableShrinkage(first.shrinkagePercent);
  const greigeQuantity = toNumber(divideCurrency(finishedQuantity, 1 - first.shrinkagePercent / 100));

  const second = await lookupLaceRate({ processorId, laceId: greigeLaceId, quantityMeters: greigeQuantity });
  if (!second) {
    return {
      ratePerMeter: first.ratePerMeter,
      slabLabel: first.slab.label,
      shrinkagePercent: first.shrinkagePercent,
      greigeQuantity,
    };
  }

  const finalShrinkage = second.shrinkagePercent ?? first.shrinkagePercent;
  assertUsableShrinkage(finalShrinkage);
  return {
    ratePerMeter: second.ratePerMeter,
    slabLabel: second.slab.label,
    shrinkagePercent: finalShrinkage,
    greigeQuantity: toNumber(divideCurrency(finishedQuantity, 1 - finalShrinkage / 100)),
  };
}

/**
 * Calculate greige lace + processing cost
 */
async function calculateGreigeLaceProcessingCost(
  laceId: string,
  quantityNeeded: number,
  lace: any,
  costSheetId?: string,
  preferredProcessorId?: string
): Promise<GreigeLaceProcessingOption> {
  // Get greige lace reference
  // If lace itself is greige, use its own ID
  // If lace is finished, use its sourceGreigeLaceId
  let greigeLaceId: string | null = null;
  let greigeLace: any = null;

  if (lace.isGreige) {
    // This lace IS greige - cannot use greige+processing strategy
    // (you need a finished lace to know what color to dye)
    return {
      available: false,
      greigeLaceId: null,
      greigeLaceName: null,
      greigeCost: null,
      processingCost: null,
      processorId: null,
      processorName: null,
      slabLabel: null,
      shrinkagePercent: null,
      greigeQuantityNeeded: null,
      totalCost: null,
      costBreakdown: {
        greigeCostPerMeter: null,
        processingCostPerMeter: null,
        shrinkageFactor: null,
        effectiveCostPerMeter: null,
      },
      details: 'This is already a greige lace - select a finished lace to use greige+processing strategy',
      labDipRequired: false,
      labDipId: null,
      labDipStatus: null,
      labDipApproved: false,
      greigeRateSource: null,
      processingRateSource: null,
      lastUpdated: null,
    };
  }

  // Get greige source
  if (lace.sourceGreigeLaceId) {
    greigeLaceId = lace.sourceGreigeLaceId;
    greigeLace = lace.sourceGreigeLace;
  } else {
    // Try to find a greige lace with same type
    const potentialGreige = await prisma.lace_master.findFirst({
      where: {
        isGreige: true,
        isActive: true,
        laceType: lace.laceType,
        width: lace.width,
      },
      select: {
        id: true,
        laceName: true,
        laceCode: true,
        costPerMeterGreige: true,
        expectedShrinkagePercent: true,
      },
    });

    if (potentialGreige) {
      greigeLaceId = potentialGreige.id;
      greigeLace = potentialGreige;
    }
  }

  if (!greigeLaceId || !greigeLace) {
    return {
      available: false,
      greigeLaceId: null,
      greigeLaceName: null,
      greigeCost: null,
      processingCost: null,
      processorId: null,
      processorName: null,
      slabLabel: null,
      shrinkagePercent: null,
      greigeQuantityNeeded: null,
      totalCost: null,
      costBreakdown: {
        greigeCostPerMeter: null,
        processingCostPerMeter: null,
        shrinkageFactor: null,
        effectiveCostPerMeter: null,
      },
      details: 'No greige lace reference found for this finished lace',
      labDipRequired: false,
      labDipId: null,
      labDipStatus: null,
      labDipApproved: false,
      greigeRateSource: null,
      processingRateSource: null,
      lastUpdated: null,
    };
  }

  // Get greige cost
  const greigeCostPerMeter = greigeLace.costPerMeterGreige ? Number(greigeLace.costPerMeterGreige) : null;

  if (!greigeCostPerMeter) {
    return {
      available: false,
      greigeLaceId,
      greigeLaceName: greigeLace.laceName,
      greigeCost: null,
      processingCost: null,
      processorId: null,
      processorName: null,
      slabLabel: null,
      shrinkagePercent: null,
      greigeQuantityNeeded: null,
      totalCost: null,
      costBreakdown: {
        greigeCostPerMeter: null,
        processingCostPerMeter: null,
        shrinkageFactor: null,
        effectiveCostPerMeter: null,
      },
      details: 'No greige lace cost defined',
      labDipRequired: false,
      labDipId: null,
      labDipStatus: null,
      labDipApproved: false,
      greigeRateSource: null,
      processingRateSource: null,
      lastUpdated: null,
    };
  }

  // Shrinkage will be determined from processor rate card (set below after rate lookup)
  // Initial estimate for rate lookup quantity (will be recalculated after getting actual shrinkage)
  let shrinkagePercent: number | null = null;
  let shrinkageFactor = 1; // Default: no shrinkage for initial quantity estimate
  let greigeQuantityNeeded = quantityNeeded; // Will be recalculated after getting shrinkage from rate card

  // Check for an approved lab dip FOR THIS COLOUR. `lace` here is the finished variant being
  // costed, so its colour is the colour actually being dyed; passing it stops a different
  // colour's approved dip from being snapshotted onto this line.
  const approvedLabDips = await getApprovedLabDipsForLace(greigeLaceId, lace.color ?? null);
  let labDipId: string | null = null;
  let labDipStatus: string | null = null;
  let labDipApproved = false;
  let processorId: string | null = null;
  let processorName: string | null = null;

  // Prefer processor from approved lab dip
  if (approvedLabDips.length > 0) {
    const labDip = approvedLabDips[0];
    labDipId = labDip.id;
    labDipStatus = labDip.status;
    labDipApproved = labDip.status === 'APPROVED';
    processorId = labDip.processorId;
    processorName = labDip.processor?.name || null;
  }

  // An explicitly chosen processor outranks the cheapest-rate scan below. Without this the
  // user's pick was decorative — the scan silently replaced it with whoever was cheapest.
  // An approved dip for this colour still wins: that processor is the one the buyer signed off.
  if (preferredProcessorId && !labDipApproved) {
    const chosen = await prisma.suppliers.findUnique({
      where: { id: preferredProcessorId },
      select: { id: true, name: true },
    });
    if (chosen) {
      processorId = chosen.id;
      processorName = chosen.name;
    }
  }

  // Try to find processing rate and shrinkage from processor rate card
  let processingCostPerMeter: number | null = null;
  let slabLabel: string | null = null;

  if (processorId) {
    // Rate from the chosen processor (approved lab dip, or explicitly pinned), priced on the
    // greige metres they actually process.
    const resolved = await resolveLaceRateAtGreigeQuantity(processorId, greigeLaceId, quantityNeeded);

    if (resolved) {
      processingCostPerMeter = resolved.ratePerMeter;
      slabLabel = resolved.slabLabel;
      // Shrinkage comes from the processor rate card (ONLY source)
      if (resolved.shrinkagePercent !== null) {
        shrinkagePercent = resolved.shrinkagePercent;
        shrinkageFactor = 1 - shrinkagePercent / 100;
        greigeQuantityNeeded = resolved.greigeQuantity;
      }
    }
  }

  // No rate yet: shop around for the cheapest dyer.
  //
  // Only runs when the processor is still OURS TO CHOOSE. If the dyer is already fixed — by an
  // approved lab dip for this colour, or by an explicit pick — this scan must not run at all:
  // it used to take the cheapest dyer's rate AND shrinkage while leaving processorId on the
  // fixed dyer, quoting (and later purchasing) dyer A's work at dyer B's price, with dyer B's
  // shrinkage deciding how much greige to buy. A fixed dyer with no rate card is reported
  // unavailable below, which is the truthful answer.
  const processorIsFixed = labDipApproved || (Boolean(preferredProcessorId) && processorId === preferredProcessorId);
  if (!processingCostPerMeter && !processorIsFixed) {
    const dyeingProcessors = await prisma.suppliers.findMany({
      where: {
        supplierCategories: { has: 'DYEING_PRINTING' },
        isActive: true,
      },
      select: { id: true, name: true },
    });

    for (const processor of dyeingProcessors) {
      const resolved = await resolveLaceRateAtGreigeQuantity(processor.id, greigeLaceId, quantityNeeded);

      if (resolved && (!processingCostPerMeter || resolved.ratePerMeter < processingCostPerMeter)) {
        processingCostPerMeter = resolved.ratePerMeter;
        slabLabel = resolved.slabLabel;
        if (resolved.shrinkagePercent !== null) {
          shrinkagePercent = resolved.shrinkagePercent;
          shrinkageFactor = 1 - shrinkagePercent / 100;
          greigeQuantityNeeded = resolved.greigeQuantity;
        }
        // The scan only runs when the processor is ours to choose, so the winner always takes
        // the job — rate, shrinkage and dyer now always come from the same card.
        processorId = processor.id;
        processorName = processor.name;
      }
    }
  }

  // Shrinkage MUST be configured in processor rate card.
  // Checked AFTER the no-rate case below, because shrinkage lives ON the rate card: when no card
  // resolved at all, "configure shrinkage" is a misleading instruction — the card is the thing
  // that is missing.
  if (shrinkagePercent === null && processingCostPerMeter) {
    return {
      available: false,
      greigeLaceId,
      greigeLaceName: greigeLace.laceName,
      greigeCost: null,
      processingCost: null,
      processorId,
      processorName,
      slabLabel: null,
      shrinkagePercent: null,
      greigeQuantityNeeded: null,
      totalCost: null,
      costBreakdown: {
        greigeCostPerMeter,
        processingCostPerMeter: null,
        shrinkageFactor: null,
        effectiveCostPerMeter: null,
      },
      details: `Shrinkage % not configured in processor rate card for lace "${greigeLace.laceName}". Configure shrinkage in the processor rate card.`,
      labDipRequired: true,
      labDipId,
      labDipStatus,
      labDipApproved,
      greigeRateSource: null,
      processingRateSource: null,
      lastUpdated: null,
    };
  }

  if (!processingCostPerMeter) {
    return {
      available: false,
      greigeLaceId,
      greigeLaceName: greigeLace.laceName,
      greigeCost: greigeCostPerMeter * greigeQuantityNeeded,
      processingCost: null,
      processorId,
      processorName,
      slabLabel: null,
      shrinkagePercent,
      greigeQuantityNeeded,
      totalCost: null,
      costBreakdown: {
        greigeCostPerMeter,
        processingCostPerMeter: null,
        shrinkageFactor,
        effectiveCostPerMeter: null,
      },
      details: processorIsFixed
        ? `No rate card for ${processorName || 'the selected processor'} on this greige lace. ` +
          `${labDipApproved ? 'That dyer is fixed by the approved lab dip for this colour' : 'That dyer was chosen explicitly'}, ` +
          `so another dyer's rate cannot be used — add their rate card (with shrinkage %) to cost this option.`
        : 'No dyeing processor rate found for this greige lace',
      labDipRequired: true,
      labDipId,
      labDipStatus,
      labDipApproved,
      greigeRateSource: 'GREIGE_LACE_MASTER',
      processingRateSource: null,
      lastUpdated: null,
    };
  }

  // Calculate total costs
  // BUG-FAB12 fix: use decimal.js for precision
  const greigeTotalCost = toNumber(multiplyCurrency(greigeCostPerMeter, greigeQuantityNeeded));
  const processingTotalCost = toNumber(multiplyCurrency(processingCostPerMeter, greigeQuantityNeeded));
  const combinedCostPerMeter = toNumber(addCurrency(greigeCostPerMeter, processingCostPerMeter));
  const effectiveCostPerMeter = toNumber(divideCurrency(combinedCostPerMeter, shrinkageFactor));
  const totalCost = toNumber(multiplyCurrency(effectiveCostPerMeter, quantityNeeded));

  return {
    available: true,
    greigeLaceId,
    greigeLaceName: greigeLace.laceName,
    greigeCost: greigeTotalCost,
    processingCost: processingTotalCost,
    processorId,
    processorName,
    slabLabel,
    shrinkagePercent,
    greigeQuantityNeeded,
    totalCost,
    costBreakdown: {
      greigeCostPerMeter,
      processingCostPerMeter,
      shrinkageFactor,
      effectiveCostPerMeter,
    },
    details: `Greige: ₹${greigeCostPerMeter.toFixed(2)}/m + Dyeing: ₹${processingCostPerMeter.toFixed(2)}/m (${slabLabel}) = ₹${effectiveCostPerMeter.toFixed(2)}/m effective (${shrinkagePercent}% shrinkage)`,
    labDipRequired: true,
    labDipId,
    labDipStatus,
    labDipApproved,
    greigeRateSource: 'GREIGE_LACE_MASTER',
    processingRateSource: 'RATE_CARD',
    lastUpdated: null,
  };
}

/**
 * Calculate lace costs for multiple items (batch)
 */
export async function calculateBatchLaceCost(items: LaceCostOptions[]): Promise<{
  results: LaceCostCalculationResult[];
  summary: {
    totalItems: number;
    successfulCalculations: number;
    failedCalculations: number;
    totalRecommendedCost: number;
    totalSavings: number;
  };
}> {
  const results: LaceCostCalculationResult[] = [];
  let totalRecommendedCost = 0;
  let totalSavings = 0;
  let failedCount = 0;

  for (const item of items) {
    try {
      const result = await calculateLaceCost(item);
      results.push(result);

      if (result.recommendedCost) {
        totalRecommendedCost += result.recommendedCost;
      }
      if (result.savings) {
        totalSavings += result.savings;
      }
    } catch (error: any) {
      failedCount++;
      // Create error result
      results.push({
        laceId: item.laceId,
        laceName: item.laceName || 'Unknown',
        // Unknown on the error path — the lace was never loaded.
        isGreige: false,
        quantityPerGarment: item.quantityPerGarment,
        wastagePercent: item.wastagePercent ?? 0, // No hardcoded default - 0 indicates not configured
        effectiveQuantity: 0,
        totalQuantityNeeded: 0,
        stockReuse: {
          available: false,
          stockLotId: null,
          stockCost: null,
          quantityAvailable: null,
          warehouseLocation: null,
          dyeLotNumber: null,
          originStyleId: null,
          originStyleCode: null,
          totalCost: null,
          details: error.message,
          rateSource: null,
          lastUpdated: null,
        },
        readyLace: {
          available: false,
          readyLaceCost: null,
          supplierId: null,
          supplierName: null,
          totalCost: null,
          details: error.message,
          rateSource: null,
          lastUpdated: null,
        },
        greigeProcessing: {
          available: false,
          greigeLaceId: null,
          greigeLaceName: null,
          greigeCost: null,
          processingCost: null,
          processorId: null,
          processorName: null,
          slabLabel: null,
          shrinkagePercent: null,
          greigeQuantityNeeded: null,
          totalCost: null,
          costBreakdown: {
            greigeCostPerMeter: null,
            processingCostPerMeter: null,
            shrinkageFactor: null,
            effectiveCostPerMeter: null,
          },
          details: error.message,
          labDipRequired: false,
          labDipId: null,
          labDipStatus: null,
          labDipApproved: false,
          greigeRateSource: null,
          processingRateSource: null,
          lastUpdated: null,
        },
        recommendedStrategy: 'NONE',
        recommendedCost: null,
        costPerMeter: null,
        costPerGarment: null,
        savings: null,
        comparisonTable: [],
      });
    }
  }

  return {
    results,
    summary: {
      totalItems: items.length,
      successfulCalculations: items.length - failedCount,
      failedCalculations: failedCount,
      totalRecommendedCost,
      totalSavings,
    },
  };
}

/**
 * Check if greige+processing is available and approved for PO generation
 */
export async function validateGreigeProcessingForPO(costingItemId: string): Promise<{
  valid: boolean;
  labDipApproved: boolean;
  labDipId: string | null;
  message: string;
}> {
  const costingItem = await prisma.style_costing_lace_items.findUnique({
    where: { id: costingItemId },
    select: {
      sourcingStrategy: true,
      greigeLaceId: true,
      labDipId: true,
    },
  });

  if (!costingItem) {
    return {
      valid: false,
      labDipApproved: false,
      labDipId: null,
      message: 'Costing item not found',
    };
  }

  if (costingItem.sourcingStrategy !== 'GREIGE_PROCESSED') {
    return {
      valid: true,
      labDipApproved: true,
      labDipId: null,
      message: 'Lab dip not required for this sourcing strategy',
    };
  }

  if (!costingItem.labDipId) {
    return {
      valid: false,
      labDipApproved: false,
      labDipId: null,
      message: 'Lab dip required but not created yet',
    };
  }

  const approved = await isLabDipApproved(costingItem.labDipId);

  return {
    valid: approved,
    labDipApproved: approved,
    labDipId: costingItem.labDipId,
    message: approved
      ? 'Lab dip approved - ready for PO generation'
      : 'Lab dip must be approved before generating processing PO',
  };
}

export default {
  calculateLaceCost,
  calculateBatchLaceCost,
  validateGreigeProcessingForPO,
};
