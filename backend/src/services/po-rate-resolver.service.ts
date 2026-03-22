import { PrismaClient, POCategory } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// TYPES
// ============================================

export interface RateResolutionContext {
  poCategory: POCategory;
  styleId?: string;
  supplierId?: string;
  materialId?: string; // material_master.id (Int as string)
  fabricId?: string;
  laceId?: string;
  serviceType?: string;
  costSheetId?: string;
  printingType?: string;
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
  // Primary: Cost Sheet greigeCost
  if (ctx.costSheetId && ctx.fabricId) {
    const costingItem = await prisma.style_costing_fabric_items.findFirst({
      where: {
        costingId: ctx.costSheetId,
        fabricId: ctx.fabricId,
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
  // Primary: Processor Rate Card (filtered by printingType if available)
  if (ctx.supplierId) {
    const rateCard = await prisma.processor_rate_card.findFirst({
      where: {
        processorId: ctx.supplierId,
        isActive: true,
        ...(ctx.printingType ? { printingType: ctx.printingType as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: { ratePerMeter: true },
    });

    if (rateCard?.ratePerMeter && Number(rateCard.ratePerMeter) > 0) {
      return {
        rate: Number(rateCard.ratePerMeter),
        source: 'Processor Rate Card',
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

    // Fallback: material_supplier_mapping (Int-based, legacy)
    const materialIdNum = parseInt(ctx.materialId, 10);
    if (!isNaN(materialIdNum)) {
      const supplierMapping = await prisma.material_supplier_mapping.findFirst({
        where: {
          supplierId: ctx.supplierId,
          materialId: materialIdNum,
          isActive: true,
        },
        select: { supplierPrice: true },
      });

      if (supplierMapping?.supplierPrice && Number(supplierMapping.supplierPrice) > 0) {
        return {
          rate: Number(supplierMapping.supplierPrice),
          source: 'Supplier price (legacy)',
        };
      }
    }
  }

  // Fallback: Material Master pricePerUnit
  if (ctx.materialId) {
    const materialIdNum = parseInt(ctx.materialId, 10);
    if (!isNaN(materialIdNum)) {
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

  // Fallback: material_supplier_mapping (Int-based, legacy)
  if (ctx.supplierId && ctx.laceId) {
    const materialIdNum = parseInt(ctx.laceId, 10);
    if (!isNaN(materialIdNum)) {
      const supplierMapping = await prisma.material_supplier_mapping.findFirst({
        where: {
          supplierId: ctx.supplierId,
          materialId: materialIdNum,
          isActive: true,
        },
        select: { supplierPrice: true },
      });

      if (supplierMapping?.supplierPrice && Number(supplierMapping.supplierPrice) > 0) {
        return {
          rate: Number(supplierMapping.supplierPrice),
          source: 'Supplier price (legacy)',
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

  // Fallback: material_supplier_mapping (legacy Int-based)
  if (ctx.supplierId && ctx.materialId) {
    const materialIdNum = parseInt(ctx.materialId, 10);
    if (!isNaN(materialIdNum)) {
      const supplierMapping = await prisma.material_supplier_mapping.findFirst({
        where: {
          supplierId: ctx.supplierId,
          materialId: materialIdNum,
          isActive: true,
        },
        select: { supplierPrice: true },
      });

      if (supplierMapping?.supplierPrice && Number(supplierMapping.supplierPrice) > 0) {
        return {
          rate: Number(supplierMapping.supplierPrice),
          source: 'Supplier price (legacy)',
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
