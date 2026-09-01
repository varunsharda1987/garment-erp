/**
 * Vendor Suggestion Service
 * Intelligent supplier recommendation system for material requirements
 *
 * Priority Algorithm:
 * 1. Preferred Supplier (HIGH confidence) - material_suppliers.isPreferred = true
 * 2. Last Ordered Supplier (MEDIUM confidence) - Recent purchase order history
 * 3. No Suggestion (LOW confidence) - Requires manual assignment
 */

import prisma from '../config/database';
import { SupplierCategory } from '@prisma/client';
import { logDebug, logInfo, logError } from '../utils/logger';
import { NotFoundError, BusinessError } from '../errors';

// ============================================
// MATERIAL TYPE INFERENCE HELPER
// ============================================

/**
 * Get effective materialType by checking linked master IDs first
 * This is important because materials may have materialType='FABRIC' but greigeId set,
 * meaning they're actually greige materials linked to greige_master
 *
 * Priority: greigeId → fabricId → laceId → materialType field
 */
export function getEffectiveMaterialType(material: {
  materialType?: string | null;
  greigeId?: string | null;
  fabricId?: string | null;
  laceId?: string | null;
}): string | undefined {
  // Priority: linked master IDs take precedence over materialType field
  if (material.greigeId) return 'GREIGE';
  if (material.fabricId) return 'FABRIC';
  if (material.laceId) return 'LACE';
  return material.materialType || undefined;
}

// ============================================
// MATERIAL TYPE → SUPPLIER CATEGORY MAPPING
// ============================================

/**
 * Maps material types to their corresponding supplier categories
 * Used to filter suppliers based on what materials they supply
 */
export function getSupplierCategoriesForMaterial(materialType: string | null): SupplierCategory[] {
  if (!materialType) return [];

  const mapping: Record<string, SupplierCategory[]> = {
    // Greige (raw fabric)
    GREIGE: [SupplierCategory.GREIGE_SUPPLIER],

    // Fabric (finished)
    FABRIC: [SupplierCategory.FABRIC_SUPPLIER],

    // Trims (all types)
    BUTTON: [SupplierCategory.TRIMS_SUPPLIER],
    ZIPPER: [SupplierCategory.TRIMS_SUPPLIER],
    ELASTIC: [SupplierCategory.TRIMS_SUPPLIER],
    HOOK_EYE: [SupplierCategory.TRIMS_SUPPLIER],
    SNAP_BUTTON: [SupplierCategory.TRIMS_SUPPLIER],
    BUCKLE: [SupplierCategory.TRIMS_SUPPLIER],
    BELT: [SupplierCategory.TRIMS_SUPPLIER],
    VELCRO: [SupplierCategory.TRIMS_SUPPLIER],
    DRAWSTRING: [SupplierCategory.TRIMS_SUPPLIER],
    RIBBON: [SupplierCategory.TRIMS_SUPPLIER],
    SEQUIN: [SupplierCategory.TRIMS_SUPPLIER],
    BEAD: [SupplierCategory.TRIMS_SUPPLIER],
    MOTIF: [SupplierCategory.TRIMS_SUPPLIER],
    INTERLINING: [SupplierCategory.TRIMS_SUPPLIER],
    PADDING: [SupplierCategory.TRIMS_SUPPLIER],
    OTHER_FASTENER: [SupplierCategory.TRIMS_SUPPLIER],
    TRIMS: [SupplierCategory.TRIMS_SUPPLIER],
    LABEL: [SupplierCategory.TRIMS_SUPPLIER],
    ACCESSORIES: [SupplierCategory.TRIMS_SUPPLIER],

    // Thread
    THREAD: [SupplierCategory.THREAD_SUPPLIER],

    // Lace
    LACE: [SupplierCategory.LACE_SUPPLIER],

    // Packaging
    PACKAGING: [SupplierCategory.PACKAGING_SUPPLIER],
  };

  return mapping[materialType] || [];
}

/**
 * Get all suppliers filtered by material type
 * Returns empty array if no matching category (shows all suppliers in frontend)
 */
export async function getSuppliersByMaterialType(materialType: string | null): Promise<any[]> {
  const categories = getSupplierCategoriesForMaterial(materialType);

  if (categories.length === 0) {
    // No specific category - return all active suppliers
    return prisma.suppliers.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        supplierCategories: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // Filter by category
  return prisma.suppliers.findMany({
    where: {
      isActive: true,
      supplierCategories: { hasSome: categories },
    },
    select: {
      id: true,
      name: true,
      code: true,
      supplierCategories: true,
      isActive: true,
    },
    orderBy: { name: 'asc' },
  });
}

// ============================================
// TYPES
// ============================================

export interface VendorSuggestion {
  materialId: string;
  materialCode?: string;
  materialName?: string;
  materialType?: string;
  suggestedSupplierId: string | null;
  suggestedSupplierName?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives: SupplierAlternative[];
}

export interface SupplierAlternative {
  supplierId: string;
  supplierName: string;
  lastOrderDate?: Date;
  orderCount?: number;
  score?: number;
}

export interface BulkVendorAssignment {
  requirementId: string;
  supplierId: string;
}

export interface VendorSuggestionForRequirement {
  requirementId: string;
  materialId: string;
  materialCode?: string;
  materialName?: string;
  materialType?: string;
  currentSupplierId: string | null;
  suggestedSupplierId: string | null;
  suggestedSupplierName?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives: SupplierAlternative[];
}

// ============================================
// CORE SUGGESTION LOGIC
// ============================================

/**
 * Suggest vendor for a single material
 * Uses priority algorithm: Preferred → Recent Orders → None
 */
export async function suggestVendorForMaterial(materialId: string): Promise<VendorSuggestion> {
  logDebug('Suggesting vendor for material', { materialId });

  // Get material details including linked master IDs
  // Note: materials model uses 'code' and 'name', not 'materialCode'/'materialName'
  const material = await prisma.materials.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      code: true,
      name: true,
      materialType: true,
      greigeId: true, // For inferring effective materialType
      fabricId: true, // For inferring effective materialType
      laceId: true, // For inferring effective materialType
      suppliers: {
        where: { isActive: true },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ isPreferred: 'desc' }, { createdAt: 'desc' }],
      },
    },
  });

  if (!material) {
    throw new NotFoundError('Material', materialId);
  }

  // Priority 1: Check for preferred supplier
  const preferredSupplier = material.suppliers.find((s: any) => s.isPreferred && s.supplier.isActive);

  if (preferredSupplier) {
    logInfo('Found preferred supplier', {
      materialId,
      supplierId: preferredSupplier.supplierId,
    });

    return {
      materialId: material.id,
      materialCode: material.code || undefined,
      materialName: material.name || undefined,
      materialType: getEffectiveMaterialType(material),
      suggestedSupplierId: preferredSupplier.supplierId,
      suggestedSupplierName: preferredSupplier.supplier.name,
      confidence: 'high',
      reason: 'Preferred supplier',
      alternatives: material.suppliers
        .filter((s: any) => !s.isPreferred && s.supplier.isActive)
        .map((s: any) => ({
          supplierId: s.supplierId,
          supplierName: s.supplier.name,
        })),
    };
  }

  // Priority 2: Check recent purchase order history
  // Note: Relation is 'purchase_orders' (snake_case), not 'purchaseOrders'
  const recentPOs = await prisma.purchase_order_items.findMany({
    where: {
      materialId,
      purchase_orders: {
        // SHORT_CLOSED counts as history: the supplier really did deliver against that order.
        // Only CANCELLED (nothing happened) is excluded.
        status: {
          in: ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'SHORT_CLOSED'],
        },
      },
    },
    include: {
      purchase_orders: {
        include: {
          suppliers: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
        },
      },
    },
    orderBy: { purchase_orders: { createdAt: 'desc' } },
    take: 10, // Look at last 10 PO items
  });

  if (recentPOs.length > 0) {
    // Count supplier frequency
    const supplierCounts = new Map<string, { count: number; lastDate: Date; supplier: any }>();

    recentPOs.forEach((poItem: any) => {
      const supplier = poItem.purchase_orders.suppliers;
      const poDate = poItem.purchase_orders.createdAt; // Use PO's createdAt since items don't have it
      if (supplier && supplier.isActive) {
        const existing = supplierCounts.get(supplier.id);
        if (existing) {
          existing.count += 1;
          if (poDate > existing.lastDate) {
            existing.lastDate = poDate;
          }
        } else {
          supplierCounts.set(supplier.id, {
            count: 1,
            lastDate: poDate,
            supplier,
          });
        }
      }
    });

    if (supplierCounts.size > 0) {
      // Sort by frequency (count) and recency
      const sorted = Array.from(supplierCounts.entries())
        .map(([supplierId, data]) => ({
          supplierId,
          supplierName: data.supplier.name,
          orderCount: data.count,
          lastOrderDate: data.lastDate,
          score: data.count * 10 + (Date.now() - data.lastDate.getTime()) / (1000 * 60 * 60 * 24 * 365), // Frequency + recency score
        }))
        .sort((a, b) => b.orderCount - a.orderCount || b.lastOrderDate!.getTime() - a.lastOrderDate!.getTime());

      const mostUsed = sorted[0];

      logInfo('Found supplier from recent orders', {
        materialId,
        supplierId: mostUsed.supplierId,
        orderCount: mostUsed.orderCount,
      });

      return {
        materialId: material.id,
        materialCode: material.code || undefined,
        materialName: material.name || undefined,
        materialType: getEffectiveMaterialType(material),
        suggestedSupplierId: mostUsed.supplierId,
        suggestedSupplierName: mostUsed.supplierName,
        confidence: 'medium',
        reason: `Ordered from this supplier ${mostUsed.orderCount} time${mostUsed.orderCount > 1 ? 's' : ''} recently`,
        alternatives: sorted.slice(1, 4).map((s) => ({
          supplierId: s.supplierId,
          supplierName: s.supplierName,
          orderCount: s.orderCount,
          lastOrderDate: s.lastOrderDate,
        })),
      };
    }
  }

  // Priority 3: No suggestion available
  logDebug('No vendor suggestion available', { materialId });

  return {
    materialId: material.id,
    materialCode: material.code || undefined,
    materialName: material.name || undefined,
    materialType: getEffectiveMaterialType(material),
    suggestedSupplierId: null,
    confidence: 'low',
    reason: 'No historical data - manual assignment required',
    alternatives: material.suppliers
      .filter((s: any) => s.supplier.isActive)
      .map((s: any) => ({
        supplierId: s.supplierId,
        supplierName: s.supplier.name,
      })),
  };
}

/**
 * Suggest vendors for multiple material requirements
 * Optimized batch processing
 */
export async function suggestVendorsForRequirements(
  requirementIds: string[]
): Promise<VendorSuggestionForRequirement[]> {
  logInfo('Suggesting vendors for requirements', { count: requirementIds.length });

  // Get all requirements with material details including linked master IDs
  // Note: materials model uses 'code' and 'name', not 'materialCode'/'materialName'
  const requirements = await prisma.material_requirements.findMany({
    where: { id: { in: requirementIds } },
    include: {
      materials: {
        select: {
          id: true,
          code: true,
          name: true,
          materialType: true,
          greigeId: true, // For inferring effective materialType
          fabricId: true, // For inferring effective materialType
          laceId: true, // For inferring effective materialType
        },
      },
    },
  });

  if (requirements.length === 0) {
    return [];
  }

  // Get suggestions for each unique material
  const uniqueMaterialIds = [...new Set(requirements.map((r) => r.materialId))];
  const materialSuggestions = new Map<string, VendorSuggestion>();

  for (const materialId of uniqueMaterialIds) {
    try {
      const suggestion = await suggestVendorForMaterial(materialId);
      materialSuggestions.set(materialId, suggestion);
    } catch (error) {
      logError('Failed to suggest vendor for material', { materialId, error });
      // Continue with other materials
    }
  }

  // Map suggestions to requirements
  const results: VendorSuggestionForRequirement[] = requirements.map((req: any) => {
    const suggestion = materialSuggestions.get(req.materialId);

    if (!suggestion) {
      return {
        requirementId: req.id,
        materialId: req.materialId,
        materialCode: req.materials?.code || undefined,
        materialName: req.materials?.name || undefined,
        materialType: req.materials ? getEffectiveMaterialType(req.materials) : undefined,
        currentSupplierId: req.preferredSupplierId,
        suggestedSupplierId: null,
        confidence: 'low' as const,
        reason: 'Failed to generate suggestion',
        alternatives: [],
      };
    }

    return {
      requirementId: req.id,
      materialId: req.materialId,
      materialCode: suggestion.materialCode,
      materialName: suggestion.materialName,
      materialType: suggestion.materialType,
      currentSupplierId: req.preferredSupplierId,
      suggestedSupplierId: suggestion.suggestedSupplierId,
      suggestedSupplierName: suggestion.suggestedSupplierName,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
      alternatives: suggestion.alternatives,
    };
  });

  logInfo('Generated vendor suggestions', {
    total: results.length,
    high: results.filter((r) => r.confidence === 'high').length,
    medium: results.filter((r) => r.confidence === 'medium').length,
    low: results.filter((r) => r.confidence === 'low').length,
  });

  return results;
}

/**
 * Bulk assign vendors to material requirements
 * Updates preferredSupplierId for multiple requirements in a transaction
 */
export async function bulkAssignVendors(assignments: BulkVendorAssignment[]): Promise<number> {
  logInfo('Bulk assigning vendors', { count: assignments.length });

  if (assignments.length === 0) {
    return 0;
  }

  // Validate all suppliers exist and are active
  const supplierIds = [...new Set(assignments.map((a) => a.supplierId))];
  const suppliers = await prisma.suppliers.findMany({
    where: { id: { in: supplierIds } },
    select: { id: true, isActive: true },
  });

  const activeSupplierIds = new Set(suppliers.filter((s) => s.isActive).map((s) => s.id));

  // Filter out assignments with inactive suppliers
  const validAssignments = assignments.filter((a) => activeSupplierIds.has(a.supplierId));

  if (validAssignments.length === 0) {
    throw new BusinessError('No active suppliers found in assignments');
  }

  // Perform bulk update in transaction
  let updatedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const assignment of validAssignments) {
      const result = await tx.material_requirements.updateMany({
        where: { id: assignment.requirementId },
        data: { preferredSupplierId: assignment.supplierId },
      });
      updatedCount += result.count;
    }
  });

  logInfo('Bulk vendor assignment complete', {
    requested: assignments.length,
    valid: validAssignments.length,
    updated: updatedCount,
  });

  return updatedCount;
}

/**
 * Auto-assign vendors using suggestions
 * Applies high and medium confidence suggestions automatically
 */
export async function autoAssignVendors(
  requirementIds: string[],
  minConfidence: 'high' | 'medium' = 'medium'
): Promise<{ assigned: number; skipped: number }> {
  logInfo('Auto-assigning vendors', { requirementIds: requirementIds.length, minConfidence });

  const suggestions = await suggestVendorsForRequirements(requirementIds);

  // Filter by confidence level
  const confidenceLevels = minConfidence === 'high' ? ['high'] : ['high', 'medium'];
  const autoAssignable = suggestions.filter((s) => s.suggestedSupplierId && confidenceLevels.includes(s.confidence));

  if (autoAssignable.length === 0) {
    return { assigned: 0, skipped: suggestions.length };
  }

  const assignments: BulkVendorAssignment[] = autoAssignable.map((s) => ({
    requirementId: s.requirementId,
    supplierId: s.suggestedSupplierId!,
  }));

  const assigned = await bulkAssignVendors(assignments);

  return {
    assigned,
    skipped: suggestions.length - autoAssignable.length,
  };
}

// ============================================
// PROCESSING REQUIREMENT PROCESSOR ASSIGNMENT
// ============================================

export interface ProcessingSuggestionForRequirement {
  requirementId: string;
  materialId: string;
  materialCode?: string;
  materialName?: string;
  currentProcessorId: string | null;
  currentProcessorName?: string;
  suggestedProcessorId: string | null;
  suggestedProcessorName?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives: Array<{ processorId: string; processorName: string; orderCount?: number }>;
}

export interface BulkProcessorAssignmentForProcessing {
  requirementId: string;
  processorId: string;
}

/**
 * Get suppliers that are processors (DYEING_PRINTING, WASHING, etc.)
 */
export async function getProcessorSuppliers(): Promise<any[]> {
  return prisma.suppliers.findMany({
    where: {
      isActive: true,
      supplierCategories: {
        hasSome: [SupplierCategory.DYEING_PRINTING, SupplierCategory.WASHING, SupplierCategory.FINISHING_CONTRACTOR],
      },
    },
    select: {
      id: true,
      name: true,
      code: true,
      supplierCategories: true,
      isActive: true,
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Suggest processor for a single PROCESSING requirement's material
 * Priority: Processor Rate Card → Recent PROCESSING POs → None
 */
async function suggestProcessorForMaterial(
  materialId: string,
  currentProcessorId: string | null
): Promise<{
  suggestedProcessorId: string | null;
  suggestedProcessorName?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives: Array<{ processorId: string; processorName: string; orderCount?: number }>;
}> {
  // Get the material to find linked greige/lace
  const material = await prisma.materials.findUnique({
    where: { id: materialId },
    select: { greigeId: true, laceId: true },
  });

  // Priority 1: Check processor_rate_card for matching greige/lace
  if (material?.greigeId) {
    const rateCard = await prisma.processor_rate_card.findFirst({
      where: {
        greigeId: material.greigeId,
        isActive: true,
        processor: { isActive: true },
      },
      include: {
        processor: { select: { id: true, name: true } },
      },
    });

    if (rateCard) {
      return {
        suggestedProcessorId: rateCard.processorId,
        suggestedProcessorName: rateCard.processor.name,
        confidence: 'high',
        reason: 'From processor rate card',
        alternatives: [],
      };
    }
  }

  if (material?.laceId) {
    const rateCard = await prisma.processor_rate_card.findFirst({
      where: {
        laceId: material.laceId,
        isActive: true,
        processor: { isActive: true },
      },
      include: {
        processor: { select: { id: true, name: true } },
      },
    });

    if (rateCard) {
      return {
        suggestedProcessorId: rateCard.processorId,
        suggestedProcessorName: rateCard.processor.name,
        confidence: 'high',
        reason: 'From processor rate card',
        alternatives: [],
      };
    }
  }

  // Priority 2: Recent PROCESSING POs
  const recentPOs = await prisma.purchase_orders.findMany({
    where: {
      poCategory: { in: ['PROCESSING', 'LACE_PROCESSING'] },
      status: { in: ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED'] },
    },
    include: {
      suppliers: { select: { id: true, name: true, isActive: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (recentPOs.length > 0) {
    const supplierCounts = new Map<string, { count: number; supplier: any }>();

    recentPOs.forEach((po: any) => {
      const supplier = po.suppliers;
      if (supplier?.isActive) {
        const existing = supplierCounts.get(supplier.id);
        if (existing) {
          existing.count += 1;
        } else {
          supplierCounts.set(supplier.id, { count: 1, supplier });
        }
      }
    });

    if (supplierCounts.size > 0) {
      const sorted = Array.from(supplierCounts.entries())
        .map(([id, data]) => ({
          processorId: id,
          processorName: data.supplier.name,
          orderCount: data.count,
        }))
        .sort((a, b) => b.orderCount - a.orderCount);

      return {
        suggestedProcessorId: sorted[0].processorId,
        suggestedProcessorName: sorted[0].processorName,
        confidence: 'medium',
        reason: `Used in ${sorted[0].orderCount} recent processing PO(s)`,
        alternatives: sorted.slice(1, 4),
      };
    }
  }

  // Priority 3: If there's a current processor, keep it as suggestion
  if (currentProcessorId) {
    const processor = await prisma.suppliers.findUnique({
      where: { id: currentProcessorId },
      select: { id: true, name: true },
    });
    if (processor) {
      return {
        suggestedProcessorId: processor.id,
        suggestedProcessorName: processor.name,
        confidence: 'medium',
        reason: 'Currently assigned processor',
        alternatives: [],
      };
    }
  }

  return {
    suggestedProcessorId: null,
    confidence: 'low',
    reason: 'No processor history - manual assignment required',
    alternatives: [],
  };
}

/**
 * Suggest processors for multiple PROCESSING material requirements
 */
export async function suggestProcessorsForProcessingRequirements(
  requirementIds: string[]
): Promise<ProcessingSuggestionForRequirement[]> {
  logInfo('Suggesting processors for processing requirements', { count: requirementIds.length });

  const requirements = await prisma.material_requirements.findMany({
    where: {
      id: { in: requirementIds },
      requirementType: 'PROCESSING',
    },
    include: {
      materials: {
        select: { id: true, code: true, name: true },
      },
      processor: {
        select: { id: true, code: true, name: true },
      },
    },
  });

  if (requirements.length === 0) return [];

  const results: ProcessingSuggestionForRequirement[] = [];

  for (const req of requirements) {
    try {
      const suggestion = await suggestProcessorForMaterial(req.materialId, req.processorId || null);

      results.push({
        requirementId: req.id,
        materialId: req.materialId,
        materialCode: (req as any).materials?.code || undefined,
        materialName: (req as any).materials?.name || undefined,
        currentProcessorId: req.processorId || null,
        currentProcessorName: (req as any).processor?.name || undefined,
        ...suggestion,
      });
    } catch (error) {
      logError('Failed to suggest processor for requirement', { requirementId: req.id, error });
      results.push({
        requirementId: req.id,
        materialId: req.materialId,
        materialCode: (req as any).materials?.code || undefined,
        materialName: (req as any).materials?.name || undefined,
        currentProcessorId: req.processorId || null,
        currentProcessorName: (req as any).processor?.name || undefined,
        suggestedProcessorId: null,
        confidence: 'low',
        reason: 'Failed to generate suggestion',
        alternatives: [],
      });
    }
  }

  return results;
}

/**
 * Bulk assign processors to PROCESSING material requirements
 * Updates processorId (NOT preferredSupplierId)
 */
export async function bulkAssignProcessorsToProcessingRequirements(
  assignments: BulkProcessorAssignmentForProcessing[]
): Promise<number> {
  logInfo('Bulk assigning processors to processing requirements', { count: assignments.length });

  if (assignments.length === 0) return 0;

  // Validate processors exist and are active
  const processorIds = [...new Set(assignments.map((a) => a.processorId))];
  const processors = await prisma.suppliers.findMany({
    where: { id: { in: processorIds } },
    select: { id: true, isActive: true },
  });

  const activeProcessorIds = new Set(processors.filter((p) => p.isActive).map((p) => p.id));
  const validAssignments = assignments.filter((a) => activeProcessorIds.has(a.processorId));

  if (validAssignments.length === 0) {
    throw new BusinessError('No active processors found in assignments');
  }

  let updatedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const assignment of validAssignments) {
      const result = await tx.material_requirements.updateMany({
        where: {
          id: assignment.requirementId,
          requirementType: 'PROCESSING', // Safety guard
        },
        data: { processorId: assignment.processorId },
      });
      updatedCount += result.count;
    }
  });

  logInfo('Bulk processor assignment complete', {
    requested: assignments.length,
    valid: validAssignments.length,
    updated: updatedCount,
  });

  return updatedCount;
}

/**
 * Auto-assign processors to PROCESSING requirements using suggestions
 */
export async function autoAssignProcessorsToProcessingRequirements(
  requirementIds: string[],
  minConfidence: 'high' | 'medium' = 'medium'
): Promise<{ assigned: number; skipped: number }> {
  logInfo('Auto-assigning processors to processing requirements', { count: requirementIds.length, minConfidence });

  const suggestions = await suggestProcessorsForProcessingRequirements(requirementIds);

  const confidenceLevels = minConfidence === 'high' ? ['high'] : ['high', 'medium'];
  const autoAssignable = suggestions.filter((s) => s.suggestedProcessorId && confidenceLevels.includes(s.confidence));

  if (autoAssignable.length === 0) {
    return { assigned: 0, skipped: suggestions.length };
  }

  const assignments: BulkProcessorAssignmentForProcessing[] = autoAssignable.map((s) => ({
    requirementId: s.requirementId,
    processorId: s.suggestedProcessorId!,
  }));

  const assigned = await bulkAssignProcessorsToProcessingRequirements(assignments);

  return {
    assigned,
    skipped: suggestions.length - autoAssignable.length,
  };
}
