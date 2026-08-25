import { POCategory } from '@prisma/client';
import prisma from '../config/database';
import { lookupRate, lookupLaceRate } from './processor-rate-v2.service';
import type { ProcessingTypeV2, PrintingTypeV2 } from '../types/processor-rate-v2.types';

// ============================================
// TYPES
// ============================================

export interface RateResolutionContext {
  poCategory: POCategory;
  styleId?: string;
  supplierId?: string;
  materialId?: string; // material_master.id (Int as string)
  fabricId?: string;
  greigeId?: string; // P1.7: For GREIGE category, query by greigeId when fabricId is null
  laceId?: string;
  serviceType?: string;
  costSheetId?: string;
  printingType?: string;
  // PROCESSING: meters the job will actually run — drives the quantity-slab match.
  // Without it the resolver cannot pick a slab and returns null (never an arbitrary card).
  quantityMeters?: number;
}

export interface RateResolutionResult {
  rate: number | null;
  source: string;
  lastPriceForStyle?: {
    rate: number;
    poNumber: string;
    poDate: Date;
  } | null;
}

// ============================================
// LEGACY BRIDGE: material_master (Int) → materials (UUID)
// ============================================

/**
 * Maps MaterialType to the corresponding legacy field in material_master
 * and the matching FK field in materials table.
 */
const MATERIAL_TYPE_FIELD_MAP: Record<string, { legacyField: string; materialsField: string }> = {
  LACE: { legacyField: 'legacyLaceId', materialsField: 'laceId' },
  BUTTON: { legacyField: 'legacyButtonId', materialsField: 'buttonId' },
  THREAD: { legacyField: 'legacyThreadId', materialsField: 'threadId' },
  ZIPPER: { legacyField: 'legacyZipperId', materialsField: 'zipperId' },
  ELASTIC: { legacyField: 'legacyElasticId', materialsField: 'elasticId' },
  LABEL: { legacyField: 'legacyLabelId', materialsField: 'labelId' },
  PACKAGING: { legacyField: 'legacyPackagingId', materialsField: 'packagingId' },
  MACHINE_PART: { legacyField: 'legacyMachinePartId', materialsField: 'machinePartId' },
  HOOK_EYE: { legacyField: 'legacyHookEyeId', materialsField: 'hookEyeId' },
  SNAP_BUTTON: { legacyField: 'legacySnapButtonId', materialsField: 'snapButtonId' },
  BUCKLE: { legacyField: 'legacyBuckleId', materialsField: 'buckleId' },
  BELT: { legacyField: 'legacyBeltId', materialsField: 'beltId' },
  VELCRO: { legacyField: 'legacyVelcroId', materialsField: 'velcroId' },
  DRAWSTRING: { legacyField: 'legacyDrawstringId', materialsField: 'drawstringId' },
  RIBBON: { legacyField: 'legacyRibbonId', materialsField: 'ribbonId' },
  SEQUIN: { legacyField: 'legacySequinId', materialsField: 'sequinId' },
  BEAD: { legacyField: 'legacyBeadId', materialsField: 'beadId' },
  MOTIF: { legacyField: 'legacyMotifId', materialsField: 'motifId' },
  INTERLINING: { legacyField: 'legacyInterliningId', materialsField: 'interliningId' },
  PADDING: { legacyField: 'legacyPaddingId', materialsField: 'paddingId' },
};

/**
 * Bridge function: Given a material_master Int ID, find the corresponding
 * materials UUID ID via the legacy*Id link fields.
 *
 * Flow: material_master.legacyButtonId → materials.buttonId → materials.id
 *
 * @returns materials.id (UUID) or null if no link exists
 */
async function getMaterialsIdFromLegacyInt(materialMasterId: number): Promise<string | null> {
  const master = await prisma.material_master.findUnique({
    where: { id: materialMasterId },
  });

  if (!master) return null;

  const mapping = MATERIAL_TYPE_FIELD_MAP[master.materialType];
  if (!mapping) return null;

  // Get the legacy ID (e.g., legacyButtonId = "uuid-123")
  const legacyId = (master as Record<string, unknown>)[mapping.legacyField] as string | null;
  if (!legacyId) return null;

  // Find materials entry where the FK matches (e.g., buttonId = "uuid-123")
  const materialsRecord = await prisma.materials.findFirst({
    where: { [mapping.materialsField]: legacyId },
    select: { id: true },
  });

  return materialsRecord?.id || null;
}

// ============================================
// RATE RESOLUTION
// ============================================

/**
 * Resolve rate for a PO based on category and context.
 * Returns the best rate and its source, following the hierarchy per category.
 */
export async function resolveRate(context: RateResolutionContext): Promise<RateResolutionResult> {
  const { poCategory } = context;

  switch (poCategory) {
    case 'FABRIC':
      return resolveFabricRate(context);
    case 'GREIGE':
      return resolveGreigeRate(context);
    case 'PROCESSING':
    case 'LACE_PROCESSING':
      return resolveProcessingRate(context);
    case 'TRIMS':
      return resolveTrimsRate(context);
    case 'LACE':
    case 'GREIGE_LACE':
      return resolveLaceRate(context);
    case 'EMBROIDERY_SERVICE':
    case 'SMOCKING_SERVICE':
    case 'STITCHING_SERVICE':
    case 'HANDWORK_SERVICE':
    case 'WASHING_SERVICE':
    case 'FINISHING_SERVICE':
    case 'CUTTING_SERVICE':
    case 'TRANSPORTATION_SERVICE':
      return resolveServiceRate(context);
    default:
      return resolveGeneralRate(context);
  }
}

// ============================================
// CATEGORY-SPECIFIC RESOLVERS
// ============================================

async function resolveFabricRate(ctx: RateResolutionContext): Promise<RateResolutionResult> {
  // Primary: Cost Sheet — readyFabricCost if set, else costPerMeter (per-meter rate entered by user)
  if (ctx.costSheetId && ctx.fabricId) {
    const costingItem = await prisma.style_costing_fabric_items.findFirst({
      where: {
        costingId: ctx.costSheetId,
        fabricId: ctx.fabricId,
      },
      select: { readyFabricCost: true, costPerMeter: true },
    });

    const costSheetRate =
      costingItem?.readyFabricCost && Number(costingItem.readyFabricCost) > 0
        ? Number(costingItem.readyFabricCost)
        : costingItem?.costPerMeter && Number(costingItem.costPerMeter) > 0
          ? Number(costingItem.costPerMeter)
          : null;

    if (costSheetRate) {
      return { rate: costSheetRate, source: 'Cost Sheet' };
    }
  }

  // Fallback: material_suppliers (UUID-based)
  if (ctx.supplierId && ctx.materialId) {
    const supplierRecord = await prisma.material_suppliers.findFirst({
      where: { materialId: ctx.materialId, supplierId: ctx.supplierId, isActive: true },
      select: { supplierPrice: true },
    });
    if (supplierRecord?.supplierPrice && Number(supplierRecord.supplierPrice) > 0) {
      return { rate: Number(supplierRecord.supplierPrice), source: 'Supplier price' };
    }
  }

  return { rate: null, source: 'Manual entry required' };
}

async function resolveGreigeRate(ctx: RateResolutionContext): Promise<RateResolutionResult> {
  // P1.7 fix: Query by greigeId OR fabricId — greige materials have greigeId set but fabricId null.
  // This fixes D1 where greige PO prices could never resolve from cost sheet.
  const lookupId = ctx.greigeId || ctx.fabricId;

  // Qty-rate audit 2026-08-24: this resolver had exactly two sources — the number typed on the
  // CAD row weeks earlier (via the cost sheet) and a supplier price that MRP's auto-created
  // material_suppliers rows never populate. The live signals the system already maintains were
  // read by NOTHING: greige_stock lots carry a per-lot purchaseCost, and greige_master.
  // lastPurchaseRate is refreshed on every greige GRN. Priority now:
  //   1. qty-weighted blend of AVAILABLE stock lots' purchaseCost (what the greige on the shelf
  //      actually cost; width-blind, mirroring MRP's stock netting)
  //   2. greige_master.lastPurchaseRate (most recent real purchase)
  //   3. Cost Sheet greigeCost (the costed snapshot)
  //   4. material_suppliers.supplierPrice
  if (ctx.greigeId) {
    const lots = await prisma.greige_stock.findMany({
      where: { greigeId: ctx.greigeId, status: 'AVAILABLE', quantityAvailable: { gt: 0 } },
      select: { purchaseCost: true, quantityAvailable: true },
    });
    let weightedValue = 0;
    let totalQty = 0;
    for (const lot of lots) {
      const cost = lot.purchaseCost != null ? Number(lot.purchaseCost) : 0;
      const qty = Number(lot.quantityAvailable);
      if (cost > 0 && qty > 0) {
        weightedValue += cost * qty;
        totalQty += qty;
      }
    }
    if (totalQty > 0) {
      return {
        rate: Math.round((weightedValue / totalQty) * 100) / 100,
        source: `Stock lots (qty-weighted avg of ${totalQty}m available)`,
      };
    }

    const master = await prisma.greige_master.findUnique({
      where: { id: ctx.greigeId },
      select: { lastPurchaseRate: true, lastPurchaseAt: true },
    });
    if (master?.lastPurchaseRate && Number(master.lastPurchaseRate) > 0) {
      return {
        rate: Number(master.lastPurchaseRate),
        source: `Last purchase${master.lastPurchaseAt ? ` (${master.lastPurchaseAt.toISOString().slice(0, 10)})` : ''}`,
      };
    }
  }

  // Cost Sheet greigeCost (the costed snapshot)
  if (ctx.costSheetId && lookupId) {
    // Try greigeId first (for actual greige fabrics), then fabricId (for finished fabrics)
    const costingItem = await prisma.style_costing_fabric_items.findFirst({
      where: {
        costingId: ctx.costSheetId,
        OR: [{ greigeId: lookupId }, { fabricId: lookupId }],
      },
      select: { greigeCost: true },
    });

    if (costingItem?.greigeCost && Number(costingItem.greigeCost) > 0) {
      return {
        rate: Number(costingItem.greigeCost),
        source: 'Cost Sheet (greigeCost)',
      };
    }
  }

  // Fallback: material_suppliers (UUID-based)
  if (ctx.supplierId && ctx.materialId) {
    const supplierRecord = await prisma.material_suppliers.findFirst({
      where: { materialId: ctx.materialId, supplierId: ctx.supplierId, isActive: true },
      select: { supplierPrice: true },
    });
    if (supplierRecord?.supplierPrice && Number(supplierRecord.supplierPrice) > 0) {
      return { rate: Number(supplierRecord.supplierPrice), source: 'Supplier price' };
    }
  }

  return { rate: null, source: 'Manual entry required' };
}

async function resolveProcessingRate(ctx: RateResolutionContext): Promise<RateResolutionResult> {
  // A processing rate is only meaningful for a specific (processor, greige/lace, quantity slab)
  // tuple — rate cards are keyed on all three. The old implementation here took the processor's
  // NEWEST card ignoring greige, slab and quantity, so it could quote greige B's top-slab rate
  // for greige A's 700m job. Without enough context to pick the right card we now return null,
  // which lets callers fall back to the costed snapshot instead of an arbitrary number.
  if (!ctx.supplierId || ctx.quantityMeters == null || ctx.quantityMeters <= 0) {
    return { rate: null, source: 'Manual entry required' };
  }

  if (ctx.greigeId) {
    const processingType: ProcessingTypeV2 = ctx.printingType ? 'PRINTING' : 'DYEING';
    const result = await lookupRate({
      processorId: ctx.supplierId,
      processingType,
      printingType: ctx.printingType as PrintingTypeV2 | undefined,
      greigeId: ctx.greigeId,
      quantityMeters: ctx.quantityMeters,
    });
    if (result && result.ratePerMeter > 0) {
      return {
        rate: result.ratePerMeter,
        source: `Processor Rate Card (${result.slabLabel || `${result.minQuantity}-${result.maxQuantity}m`})`,
      };
    }
    return { rate: null, source: 'Manual entry required' };
  }

  if (ctx.laceId) {
    const result = await lookupLaceRate({
      processorId: ctx.supplierId,
      laceId: ctx.laceId,
      quantityMeters: ctx.quantityMeters,
    });
    if (result && result.ratePerMeter > 0) {
      return {
        rate: result.ratePerMeter,
        source: `Processor Rate Card (${result.slab.label})`,
      };
    }
  }

  return { rate: null, source: 'Manual entry required' };
}

async function resolveTrimsRate(ctx: RateResolutionContext): Promise<RateResolutionResult> {
  // Primary: Supplier price via material_suppliers (UUID-based)
  if (ctx.supplierId && ctx.materialId) {
    const supplierRecord = await prisma.material_suppliers.findFirst({
      where: {
        materialId: ctx.materialId,
        supplierId: ctx.supplierId,
        isActive: true,
      },
      select: { supplierPrice: true },
    });

    if (supplierRecord?.supplierPrice && Number(supplierRecord.supplierPrice) > 0) {
      return {
        rate: Number(supplierRecord.supplierPrice),
        source: 'Supplier price',
      };
    }

    // Fallback: Bridge OLD→NEW system via legacyId link
    // If materialId is an Int (from material_master), find corresponding materials UUID
    const isIntegerId = /^\d+$/.test(ctx.materialId);
    if (isIntegerId) {
      const materialIdNum = parseInt(ctx.materialId, 10);
      const materialsId = await getMaterialsIdFromLegacyInt(materialIdNum);

      if (materialsId) {
        const bridgedSupplier = await prisma.material_suppliers.findFirst({
          where: {
            materialId: materialsId,
            supplierId: ctx.supplierId,
            isActive: true,
          },
          select: { supplierPrice: true },
        });

        if (bridgedSupplier?.supplierPrice && Number(bridgedSupplier.supplierPrice) > 0) {
          return {
            rate: Number(bridgedSupplier.supplierPrice),
            source: 'Supplier price (via legacy link)',
          };
        }
      }
    }
  }

  // Fallback: Material Master pricePerUnit
  // Only try if materialId is a pure integer (not UUID)
  if (ctx.materialId && /^\d+$/.test(ctx.materialId)) {
    const materialIdNum = parseInt(ctx.materialId, 10);
    const material = await prisma.material_master.findUnique({
      where: { id: materialIdNum },
      select: { pricePerUnit: true },
    });

    if (material?.pricePerUnit && Number(material.pricePerUnit) > 0) {
      return {
        rate: Number(material.pricePerUnit),
        source: 'Material Master (pricePerUnit)',
      };
    }
  }

  return { rate: null, source: 'Manual entry required' };
}

async function resolveLaceRate(ctx: RateResolutionContext): Promise<RateResolutionResult> {
  // Primary: Supplier price via material_suppliers (UUID-based)
  if (ctx.supplierId && ctx.materialId) {
    const supplierRecord = await prisma.material_suppliers.findFirst({
      where: {
        materialId: ctx.materialId,
        supplierId: ctx.supplierId,
        isActive: true,
      },
      select: { supplierPrice: true },
    });

    if (supplierRecord?.supplierPrice && Number(supplierRecord.supplierPrice) > 0) {
      return {
        rate: Number(supplierRecord.supplierPrice),
        source: 'Supplier price',
      };
    }
  }

  // Fallback: Bridge OLD→NEW system via legacyId link
  // If laceId is an Int (from material_master), find corresponding materials UUID
  if (ctx.supplierId && ctx.laceId && /^\d+$/.test(ctx.laceId)) {
    const materialIdNum = parseInt(ctx.laceId, 10);
    const materialsId = await getMaterialsIdFromLegacyInt(materialIdNum);

    if (materialsId) {
      const bridgedSupplier = await prisma.material_suppliers.findFirst({
        where: {
          materialId: materialsId,
          supplierId: ctx.supplierId,
          isActive: true,
        },
        select: { supplierPrice: true },
      });

      if (bridgedSupplier?.supplierPrice && Number(bridgedSupplier.supplierPrice) > 0) {
        return {
          rate: Number(bridgedSupplier.supplierPrice),
          source: 'Supplier price (via legacy link)',
        };
      }
    }
  }

  // Fallback: Cost Sheet
  if (ctx.costSheetId && ctx.laceId) {
    const costingItem = await prisma.style_costing_lace_items.findFirst({
      where: {
        costingId: ctx.costSheetId,
        laceId: ctx.laceId,
      },
      select: { readyLaceCost: true, greigeCost: true },
    });

    const cost = ctx.poCategory === 'GREIGE_LACE' ? costingItem?.greigeCost : costingItem?.readyLaceCost;

    if (cost && Number(cost) > 0) {
      return {
        rate: Number(cost),
        source: `Cost Sheet (${ctx.poCategory === 'GREIGE_LACE' ? 'greigeCost' : 'readyLaceCost'})`,
      };
    }
  }

  return { rate: null, source: 'Manual entry required' };
}

async function resolveServiceRate(ctx: RateResolutionContext): Promise<RateResolutionResult> {
  // Map PO category to cost sheet field
  const costSheetFieldMap: Record<string, string> = {
    CUTTING_SERVICE: 'cuttingCost',
    EMBROIDERY_SERVICE: 'embroideryWork',
    SMOCKING_SERVICE: 'smockingCost',
    STITCHING_SERVICE: 'stitchingCost',
    HANDWORK_SERVICE: 'handWork',
    WASHING_SERVICE: 'washingCost',
    FINISHING_SERVICE: 'finishingCost',
    TRANSPORTATION_SERVICE: 'transportCost',
  };

  const fieldName = costSheetFieldMap[ctx.poCategory];
  let rate: number | null = null;
  let source = 'Manual entry required';

  // Primary: Cost Sheet
  if (ctx.costSheetId && fieldName) {
    const costSheet = await prisma.style_costing.findUnique({
      where: { id: ctx.costSheetId },
      select: { [fieldName]: true } as any,
    });

    if (costSheet && (costSheet as any)[fieldName]) {
      const value = Number((costSheet as any)[fieldName]);
      if (value > 0) {
        rate = value;
        source = `Cost Sheet (${fieldName})`;
      }
    }
  }

  // Get last price for style (informational)
  const lastPrice = ctx.styleId ? await getLastPriceForStyle(ctx.styleId, ctx.poCategory) : null;

  return { rate, source, lastPriceForStyle: lastPrice };
}

async function resolveGeneralRate(ctx: RateResolutionContext): Promise<RateResolutionResult> {
  // Primary: material_suppliers (UUID-based)
  if (ctx.supplierId && ctx.materialId) {
    const supplierRecord = await prisma.material_suppliers.findFirst({
      where: { materialId: ctx.materialId, supplierId: ctx.supplierId, isActive: true },
      select: { supplierPrice: true },
    });
    if (supplierRecord?.supplierPrice && Number(supplierRecord.supplierPrice) > 0) {
      return { rate: Number(supplierRecord.supplierPrice), source: 'Supplier price' };
    }
  }

  // Fallback: Bridge OLD→NEW system via legacyId link
  // If materialId is an Int (from material_master), find corresponding materials UUID
  if (ctx.supplierId && ctx.materialId && /^\d+$/.test(ctx.materialId)) {
    const materialIdNum = parseInt(ctx.materialId, 10);
    const materialsId = await getMaterialsIdFromLegacyInt(materialIdNum);

    if (materialsId) {
      const bridgedSupplier = await prisma.material_suppliers.findFirst({
        where: {
          materialId: materialsId,
          supplierId: ctx.supplierId,
          isActive: true,
        },
        select: { supplierPrice: true },
      });

      if (bridgedSupplier?.supplierPrice && Number(bridgedSupplier.supplierPrice) > 0) {
        return {
          rate: Number(bridgedSupplier.supplierPrice),
          source: 'Supplier price (via legacy link)',
        };
      }
    }
  }

  return { rate: null, source: 'Manual entry required' };
}

// ============================================
// LAST PRICE LOOKUP
// ============================================

/**
 * Get the most recent PO price for a given style + PO category.
 * Useful as reference when creating production run service POs.
 */
export async function getLastPriceForStyle(
  styleId: string,
  poCategory: string
): Promise<{ rate: number; poNumber: string; poDate: Date } | null> {
  // Find recent POs for this style via work order → style link
  const recentPO = await prisma.purchase_orders.findFirst({
    where: {
      poCategory: poCategory as POCategory,
      serviceWorkOrder: {
        styleId,
      },
      status: { not: 'CANCELLED' },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      poNumber: true,
      poDate: true,
      purchase_order_items: {
        select: { unitPrice: true },
        take: 1,
      },
    },
  });

  if (recentPO?.purchase_order_items?.[0]?.unitPrice) {
    return {
      rate: Number(recentPO.purchase_order_items[0].unitPrice),
      poNumber: recentPO.poNumber,
      poDate: recentPO.poDate,
    };
  }

  return null;
}
