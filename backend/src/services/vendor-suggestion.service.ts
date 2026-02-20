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
import { logDebug, logInfo, logError } from '../utils/logger';
import { NotFoundError, BusinessError } from '../errors';

// ============================================
// TYPES
// ============================================

export interface VendorSuggestion {
  materialId: string;
  materialCode?: string;
  materialName?: string;
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

  // Get material details
  // Note: materials model uses 'code' and 'name', not 'materialCode'/'materialName'
  const material = await prisma.materials.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      code: true,
      name: true,
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
        status: {
          in: ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED'],
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

  // Get all requirements with material details
  // Note: materials model uses 'code' and 'name', not 'materialCode'/'materialName'
  const requirements = await prisma.material_requirements.findMany({
    where: { id: { in: requirementIds } },
    include: {
      materials: {
        select: {
          id: true,
          code: true,
          name: true,
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
        materialCode: req.materials.code || undefined,
        materialName: req.materials.name || undefined,
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
  const autoAssignable = suggestions.filter(
    (s) => s.suggestedSupplierId && confidenceLevels.includes(s.confidence)
  );

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
