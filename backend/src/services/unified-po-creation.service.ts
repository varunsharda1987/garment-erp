/**
 * Unified PO Creation Service
 *
 * Single source of truth for PO creation across all entry points:
 * - Direct PO creation (Manual)
 * - Cost Sheet PO generation
 * - MRP PO generation
 * - Service Requirements PO generation
 *
 * Features:
 * - Unified validation
 * - Duplicate detection
 * - Source tracking via po_source_links
 * - Consistent PO number generation
 * - Transaction-safe operations
 */

import { POCategory, POSource, PurchaseOrderStatus, ServiceType, Unit, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { generateUnifiedPONumberInTransaction } from '../utils/po-number-generator';

// ============================================
// Types & Interfaces
// ============================================

export interface UnifiedPOItemInput {
  // Material-based items (for material POs)
  materialId?: string;

  // Service-based items (for service POs, mutually exclusive with materialId)
  serviceType?: ServiceType;
  serviceDescription?: string;

  // Common fields
  orderedQuantity: number;
  unit: Unit;
  unitPrice: number;
  remarks?: string;

  // Source link quantities (for traceability)
  sourceQuantities?: {
    sourceId: string; // requirementId, costSheetItemId, or serviceRequirementId
    quantity: number;
  }[];
}

export interface UnifiedPOCreationInput {
  // Required fields
  supplierId: string;
  expectedDeliveryDate: Date;
  createdById: string;

  // Source tracking (required)
  source: POSource;

  // Category (required for filtering/reporting)
  poCategory: POCategory;

  // Items (at least one required)
  items: UnifiedPOItemInput[];

  // Optional fields
  paymentTerms?: string;
  remarks?: string;

  // Source-specific linking
  sourceLinks?: {
    // For COST_SHEET
    costSheetGenerationId?: string;

    // For MRP
    materialRequirementIds?: string[];
    mrpBatchId?: string;

    // For SERVICE_REQUIREMENT
    serviceRequirementIds?: string[];
    workOrderId?: string;

    // For PRODUCTION_RUN
    productionRunId?: string;
  };

  // Linked POs (for Processing -> Greige dependency)
  linkedGreigePOId?: string;
}

export interface UnifiedPOCreationOptions {
  skipDuplicateCheck?: boolean;
  allowDuplicates?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface DuplicatePOInfo {
  poId: string;
  poNumber: string;
  source: POSource | null;
  status: PurchaseOrderStatus;
  orderedQuantity: number;
  pendingQuantity: number;
  supplierId: string;
  supplierName?: string;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicates: {
    materialId: string;
    materialName?: string;
    existingPOs: DuplicatePOInfo[];
  }[];
}

export interface POSourceLinkData {
  id: string;
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  sourceType: POSource;
  costSheetGenerationId?: string;
  materialRequirementId?: string;
  serviceRequirementId?: string;
  productionRunId?: string;
  quantityLinked: number;
}

export interface UnifiedPOCreationResult {
  purchaseOrder: Prisma.purchase_ordersGetPayload<{
    include: {
      suppliers: true;
      purchase_order_items: {
        include: {
          materials: true;
        };
      };
    };
  }>;
  sourceLinks: POSourceLinkData[];
  duplicateWarnings?: DuplicateCheckResult;
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate PO creation input
 */
export async function validateUnifiedPOInput(input: UnifiedPOCreationInput): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Supplier validation
  const supplier = await prisma.suppliers.findUnique({
    where: { id: input.supplierId },
    select: { id: true, isActive: true, name: true },
  });

  if (!supplier) {
    errors.push({ field: 'supplierId', message: 'Supplier not found' });
  } else if (!supplier.isActive) {
    errors.push({ field: 'supplierId', message: `Supplier "${supplier.name}" is inactive` });
  }

  // 2. Items validation
  if (!input.items || input.items.length === 0) {
    errors.push({ field: 'items', message: 'At least one item is required' });
  }

  for (let i = 0; i < (input.items?.length || 0); i++) {
    const item = input.items[i];

    // Material or Service type required
    if (!item.materialId && !item.serviceType) {
      errors.push({
        field: `items[${i}]`,
        message: 'Either materialId or serviceType is required',
      });
    }

    // Cannot have both
    if (item.materialId && item.serviceType) {
      errors.push({
        field: `items[${i}]`,
        message: 'Cannot have both materialId and serviceType',
      });
    }

    // Validate materialId exists
    if (item.materialId) {
      const material = await prisma.materials.findUnique({
        where: { id: item.materialId },
        select: { id: true, name: true },
      });
      if (!material) {
        errors.push({
          field: `items[${i}].materialId`,
          message: `Material not found: ${item.materialId}`,
        });
      }
    }

    // Quantity validation
    if (item.orderedQuantity <= 0) {
      errors.push({
        field: `items[${i}].orderedQuantity`,
        message: 'Quantity must be positive',
      });
    }

    // Price validation
    if (item.unitPrice < 0) {
      errors.push({
        field: `items[${i}].unitPrice`,
        message: 'Unit price cannot be negative',
      });
    }
  }

  // 3. Source-specific validation
  if (input.source === 'MRP' && input.sourceLinks?.materialRequirementIds) {
    const requirements = await prisma.material_requirements.findMany({
      where: { id: { in: input.sourceLinks.materialRequirementIds } },
      select: { id: true, status: true },
    });

    const validStatuses = ['PO_REQUIRED', 'PARTIAL_STOCK'];
    for (const req of requirements) {
      if (req.status === 'SIZE_PENDING') {
        // Hard error, not a warning: a size-wise label carries its sizes in print. Ordering the
        // aggregate row buys labels whose sizes nobody has decided yet, and it permanently
        // protects that row from the recalculation that should have replaced it with per-size
        // lines — leaving the label planned twice.
        errors.push({
          field: 'sourceLinks.materialRequirementIds',
          message: `Requirement ${req.id} is awaiting the order's size breakdown — enter the sizes before ordering this label.`,
        });
      } else if (!validStatuses.includes(req.status)) {
        warnings.push({
          field: 'sourceLinks.materialRequirementIds',
          message: `Requirement ${req.id} has status "${req.status}" (expected: ${validStatuses.join(', ')})`,
        });
      }
    }
  }

  if (input.source === 'SERVICE_REQUIREMENT' && input.sourceLinks?.serviceRequirementIds) {
    const requirements = await prisma.work_order_service_requirements.findMany({
      where: { id: { in: input.sourceLinks.serviceRequirementIds } },
      select: { id: true, status: true },
    });

    const validStatuses = ['PENDING', 'IN_PROGRESS'];
    for (const req of requirements) {
      if (!validStatuses.includes(req.status)) {
        warnings.push({
          field: 'sourceLinks.serviceRequirementIds',
          message: `Service requirement ${req.id} has status "${req.status}" (expected: ${validStatuses.join(', ')})`,
        });
      }
    }
  }

  // 4. Category validation for source type
  // Phase 5a: purchase orders are MATERIAL-ONLY. Service/processing work is ordered as a
  // Job Work Order (generateServiceJWOs / MRP JWO path); the SERVICE_REQUIREMENT and
  // PRODUCTION_RUN sources are retired and every *_SERVICE / *PROCESSING category is blocked.
  const MATERIAL_CATEGORIES: POCategory[] = [
    'FABRIC',
    'GREIGE',
    'TRIMS',
    'THREAD',
    'LACE',
    'GREIGE_LACE',
    'GENERAL',
    'BUTTON',
    'ZIPPER',
    'ELASTIC',
    'LABEL',
    'PACKAGING',
    'MACHINE_PART',
    'OTHER_MATERIAL',
  ] as POCategory[];
  const categorySourceMap: Record<POSource, POCategory[]> = {
    MANUAL: MATERIAL_CATEGORIES,
    COST_SHEET: ['FABRIC', 'GREIGE', 'TRIMS', 'LACE', 'GREIGE_LACE'] as POCategory[],
    MRP: MATERIAL_CATEGORIES,
    SERVICE_REQUIREMENT: [], // retired — service work is a Job Work Order
    PRODUCTION_RUN: [], // retired — service work is a Job Work Order
  };

  if (input.source === 'SERVICE_REQUIREMENT' || input.source === 'PRODUCTION_RUN') {
    errors.push({
      field: 'source',
      message: `Source "${input.source}" is retired — service/processing work is ordered as a Job Work Order, purchase orders are material-only`,
    });
  }

  const allowedCategories = categorySourceMap[input.source];
  if (!allowedCategories.includes(input.poCategory)) {
    errors.push({
      field: 'poCategory',
      message: `Category "${input.poCategory}" is not allowed for source "${input.source}" — purchase orders are material-only; order service/processing work as a Job Work Order`,
    });
  }

  // 5. Linked Greige PO validation (for Processing POs)
  if (input.linkedGreigePOId) {
    const greigePO = await prisma.purchase_orders.findUnique({
      where: { id: input.linkedGreigePOId },
      select: { id: true, poCategory: true, status: true },
    });

    if (!greigePO) {
      errors.push({
        field: 'linkedGreigePOId',
        message: 'Linked Greige PO not found',
      });
    } else if (greigePO.poCategory !== 'GREIGE' && greigePO.poCategory !== 'GREIGE_LACE') {
      errors.push({
        field: 'linkedGreigePOId',
        message: `Linked PO must be GREIGE or GREIGE_LACE category, got "${greigePO.poCategory}"`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// Duplicate Detection
// ============================================

/**
 * Check for duplicate/overlapping POs for same materials
 * Returns active POs (not CANCELLED, not fully RECEIVED) for the same materials
 */
export async function checkForDuplicatePOs(
  materialIds: string[],
  excludePOIds?: string[]
): Promise<DuplicateCheckResult> {
  if (materialIds.length === 0) {
    return { hasDuplicates: false, duplicates: [] };
  }

  // Build purchase_orders filter
  const poFilter: Prisma.purchase_ordersWhereInput = {
    status: {
      notIn: ['CANCELLED', 'RECEIVED'],
    },
  };

  if (excludePOIds && excludePOIds.length > 0) {
    poFilter.id = { notIn: excludePOIds };
  }

  const whereClause: Prisma.purchase_order_itemsWhereInput = {
    materialId: { in: materialIds },
    purchase_orders: poFilter,
  };

  const existingItems = await prisma.purchase_order_items.findMany({
    where: whereClause,
    include: {
      purchase_orders: {
        select: {
          id: true,
          poNumber: true,
          poSource: true,
          status: true,
          supplierId: true,
          suppliers: {
            select: { name: true },
          },
        },
      },
      materials: {
        select: { name: true },
      },
    },
  });

  // Group by materialId
  const duplicateMap = new Map<
    string,
    {
      materialName?: string;
      items: typeof existingItems;
    }
  >();

  for (const item of existingItems) {
    if (!item.materialId) continue;

    const existing = duplicateMap.get(item.materialId) || {
      materialName: item.materials?.name,
      items: [],
    };
    existing.items.push(item);
    duplicateMap.set(item.materialId, existing);
  }

  const duplicates = Array.from(duplicateMap.entries()).map(([materialId, data]) => ({
    materialId,
    materialName: data.materialName,
    existingPOs: data.items.map((item) => ({
      poId: item.purchase_orders.id,
      poNumber: item.purchase_orders.poNumber,
      source: item.purchase_orders.poSource,
      status: item.purchase_orders.status,
      orderedQuantity: Number(item.orderedQuantity),
      pendingQuantity: Number(item.orderedQuantity) - Number(item.receivedQuantity),
      supplierId: item.purchase_orders.supplierId,
      supplierName: item.purchase_orders.suppliers?.name,
    })),
  }));

  return {
    hasDuplicates: duplicates.length > 0,
    duplicates,
  };
}

// ============================================
// Main PO Creation Function
// ============================================

/**
 * Create a unified PO with validation, duplicate detection, and source linking
 *
 * This is the single source of truth for PO creation.
 * All entry points should call this function.
 */
export async function createUnifiedPO(
  input: UnifiedPOCreationInput,
  options: UnifiedPOCreationOptions = {}
): Promise<UnifiedPOCreationResult> {
  // 1. Validate inputs
  const validation = await validateUnifiedPOInput(input);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
  }

  // 2. Check for duplicates (unless skipped)
  let duplicateWarnings: DuplicateCheckResult | undefined;
  if (!options.skipDuplicateCheck) {
    const materialIds = input.items.filter((i) => i.materialId).map((i) => i.materialId!);

    if (materialIds.length > 0) {
      duplicateWarnings = await checkForDuplicatePOs(materialIds);

      if (duplicateWarnings.hasDuplicates && !options.allowDuplicates) {
        const duplicateInfo = duplicateWarnings.duplicates
          .map((d) => `${d.materialName || d.materialId}: ${d.existingPOs.map((p) => p.poNumber).join(', ')}`)
          .join('; ');

        throw new Error(`Duplicate POs detected for materials: ${duplicateInfo}. Set allowDuplicates=true to proceed.`);
      }
    }
  }

  // 3. Create PO in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Generate PO number
    const poNumber = await generateUnifiedPONumberInTransaction(tx);

    // Determine initial status
    let initialStatus: PurchaseOrderStatus = 'DRAFT';
    if (input.linkedGreigePOId) {
      // Check if linked greige PO is received
      const greigePO = await tx.purchase_orders.findUnique({
        where: { id: input.linkedGreigePOId },
        select: { status: true },
      });

      if (greigePO?.status !== 'RECEIVED') {
        initialStatus = 'PENDING_GREIGE';
      }
    }

    // Calculate total amount
    let totalAmount = 0;
    for (const item of input.items) {
      totalAmount += item.orderedQuantity * item.unitPrice;
    }

    // Create PO header
    const po = await tx.purchase_orders.create({
      data: {
        id: randomUUID(),
        poNumber,
        supplierId: input.supplierId,
        expectedDeliveryDate: input.expectedDeliveryDate,
        status: initialStatus,
        poCategory: input.poCategory,
        poSource: input.source,
        linkedGreigePOId: input.linkedGreigePOId,
        costSheetGenerationId: input.sourceLinks?.costSheetGenerationId,
        mrpBatchId: input.sourceLinks?.mrpBatchId,
        serviceWorkOrderId: input.sourceLinks?.workOrderId,
        paymentTerms: input.paymentTerms,
        remarks: input.remarks,
        createdById: input.createdById,
        totalAmount,
      },
    });

    // Create PO items
    const createdItems: Array<{
      id: string;
      materialId: string | null;
      serviceType: ServiceType | null;
      orderedQuantity: Prisma.Decimal;
    }> = [];

    for (const item of input.items) {
      const totalPrice = item.orderedQuantity * item.unitPrice;

      const poItem = await tx.purchase_order_items.create({
        data: {
          id: randomUUID(),
          poId: po.id,
          materialId: item.materialId || null,
          serviceType: item.serviceType || null,
          serviceDescription: item.serviceDescription || null,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: 0,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice,
          remarks: item.remarks,
        },
      });

      createdItems.push({
        id: poItem.id,
        materialId: poItem.materialId,
        serviceType: poItem.serviceType,
        orderedQuantity: poItem.orderedQuantity,
      });
    }

    // Create source links based on source type
    const sourceLinks: POSourceLinkData[] = [];

    if (input.source === 'MRP' && input.sourceLinks?.materialRequirementIds) {
      // Link each requirement to corresponding PO item
      for (const reqId of input.sourceLinks.materialRequirementIds) {
        // Find the requirement to get materialId
        const req = await tx.material_requirements.findUnique({
          where: { id: reqId },
          select: { materialId: true, shortfall: true },
        });

        if (req) {
          // Find matching PO item by materialId
          const matchingItem = createdItems.find((item) => item.materialId === req.materialId);

          if (matchingItem) {
            const link = await tx.po_source_links.create({
              data: {
                id: randomUUID(),
                purchaseOrderId: po.id,
                purchaseOrderItemId: matchingItem.id,
                sourceType: 'MRP',
                materialRequirementId: reqId,
                quantityLinked: Number(matchingItem.orderedQuantity),
              },
            });

            sourceLinks.push({
              id: link.id,
              purchaseOrderId: po.id,
              purchaseOrderItemId: matchingItem.id,
              sourceType: 'MRP',
              materialRequirementId: reqId,
              quantityLinked: Number(link.quantityLinked),
            });

            // Also create legacy link in requirement_po_links for backward compatibility
            await tx.requirement_po_links.create({
              data: {
                id: randomUUID(),
                requirementId: reqId,
                purchaseOrderId: po.id,
                purchaseOrderItemId: matchingItem.id,
                allocatedQuantity: Number(matchingItem.orderedQuantity),
              },
            });
          }
        }
      }
    } else if (input.source === 'SERVICE_REQUIREMENT' && input.sourceLinks?.serviceRequirementIds) {
      // Link each service requirement to corresponding PO item
      for (const reqId of input.sourceLinks.serviceRequirementIds) {
        const req = await tx.work_order_service_requirements.findUnique({
          where: { id: reqId },
          select: { serviceType: true, quantityRequired: true },
        });

        if (req) {
          // Find matching PO item by serviceType
          const matchingItem = createdItems.find((item) => item.serviceType === req.serviceType);

          if (matchingItem) {
            const link = await tx.po_source_links.create({
              data: {
                id: randomUUID(),
                purchaseOrderId: po.id,
                purchaseOrderItemId: matchingItem.id,
                sourceType: 'SERVICE_REQUIREMENT',
                serviceRequirementId: reqId,
                quantityLinked: Number(req.quantityRequired),
              },
            });

            sourceLinks.push({
              id: link.id,
              purchaseOrderId: po.id,
              purchaseOrderItemId: matchingItem.id,
              sourceType: 'SERVICE_REQUIREMENT',
              serviceRequirementId: reqId,
              quantityLinked: Number(link.quantityLinked),
            });

            // Also create legacy link in service_requirement_po_links for backward compatibility
            await tx.service_requirement_po_links.create({
              data: {
                id: randomUUID(),
                serviceRequirementId: reqId,
                purchaseOrderItemId: matchingItem.id,
                quantityLinked: Number(req.quantityRequired),
              },
            });
          }
        }
      }
    } else if (input.source === 'COST_SHEET' && input.sourceLinks?.costSheetGenerationId) {
      // Create links for cost sheet items
      for (const item of createdItems) {
        const link = await tx.po_source_links.create({
          data: {
            id: randomUUID(),
            purchaseOrderId: po.id,
            purchaseOrderItemId: item.id,
            sourceType: 'COST_SHEET',
            costSheetGenerationId: input.sourceLinks.costSheetGenerationId,
            quantityLinked: Number(item.orderedQuantity),
          },
        });

        sourceLinks.push({
          id: link.id,
          purchaseOrderId: po.id,
          purchaseOrderItemId: item.id,
          sourceType: 'COST_SHEET',
          costSheetGenerationId: input.sourceLinks.costSheetGenerationId,
          quantityLinked: Number(link.quantityLinked),
        });
      }
    } else if (input.source === 'PRODUCTION_RUN' && input.sourceLinks?.productionRunId) {
      // Create links for production run service POs
      for (const item of createdItems) {
        const link = await tx.po_source_links.create({
          data: {
            id: randomUUID(),
            purchaseOrderId: po.id,
            purchaseOrderItemId: item.id,
            sourceType: 'PRODUCTION_RUN',
            productionRunId: input.sourceLinks.productionRunId,
            quantityLinked: Number(item.orderedQuantity),
          },
        });

        sourceLinks.push({
          id: link.id,
          purchaseOrderId: po.id,
          purchaseOrderItemId: item.id,
          sourceType: 'PRODUCTION_RUN',
          productionRunId: input.sourceLinks.productionRunId,
          quantityLinked: Number(link.quantityLinked),
        });
      }
    }

    return { po, sourceLinks };
  });

  // 4. Update source requirement statuses
  await updateSourceRequirementStatuses(input.source, input.sourceLinks, result.po.id);

  // 5. Fetch complete PO with relations
  const purchaseOrder = await prisma.purchase_orders.findUniqueOrThrow({
    where: { id: result.po.id },
    include: {
      suppliers: true,
      purchase_order_items: {
        include: {
          materials: true,
        },
      },
    },
  });

  return {
    purchaseOrder,
    sourceLinks: result.sourceLinks,
    duplicateWarnings,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Update source requirement statuses after PO creation
 */
async function updateSourceRequirementStatuses(
  source: POSource,
  sourceLinks?: UnifiedPOCreationInput['sourceLinks'],
  poId?: string
): Promise<void> {
  if (!sourceLinks || !poId) return;

  if (source === 'MRP' && sourceLinks.materialRequirementIds) {
    await prisma.material_requirements.updateMany({
      where: { id: { in: sourceLinks.materialRequirementIds } },
      data: { status: 'PO_GENERATED' },
    });
  }

  if (source === 'SERVICE_REQUIREMENT' && sourceLinks.serviceRequirementIds) {
    await prisma.work_order_service_requirements.updateMany({
      where: { id: { in: sourceLinks.serviceRequirementIds } },
      data: {
        status: 'PO_GENERATED',
        purchaseOrderId: poId,
      },
    });
  }
}

/**
 * Map material type to POCategory
 * Used when creating MRP POs to determine appropriate category
 */
export function mapMaterialTypeToPOCategory(materialType: string): POCategory {
  const mapping: Record<string, POCategory> = {
    FABRIC: 'FABRIC',
    GREIGE: 'GREIGE',
    LACE: 'LACE',
    GREIGE_LACE: 'GREIGE_LACE',
    BUTTON: 'TRIMS',
    THREAD: 'TRIMS',
    ELASTIC: 'TRIMS',
    LABEL: 'TRIMS',
    ZIPPER: 'TRIMS',
    PACKAGING: 'TRIMS',
    INTERLINING: 'TRIMS',
    TAPE: 'TRIMS',
    CORD: 'TRIMS',
    HOOK_EYE: 'TRIMS',
  };

  return mapping[materialType] || 'GENERAL';
}

/**
 * Map ServiceType to POCategory
 */
export function mapServiceTypeToPOCategory(serviceType: ServiceType): POCategory {
  const mapping: Record<ServiceType, POCategory> = {
    EMBROIDERY: 'EMBROIDERY_SERVICE',
    PRINTING: 'PROCESSING', // Printing handled at Order level as PROCESSING
    DYEING: 'PROCESSING', // Dyeing handled at Order level as PROCESSING
    WASHING: 'WASHING_SERVICE',
    FINISHING: 'FINISHING_SERVICE',
    CUTTING: 'CUTTING_SERVICE',
    STITCHING: 'STITCHING_SERVICE',
    HANDWORK: 'HANDWORK_SERVICE',
    SMOCKING: 'SMOCKING_SERVICE',
    TRANSPORTATION: 'TRANSPORTATION_SERVICE',
    OTHER: 'GENERAL',
  };

  return mapping[serviceType];
}

// Export default for convenience
export default {
  createUnifiedPO,
  validateUnifiedPOInput,
  checkForDuplicatePOs,
  mapMaterialTypeToPOCategory,
  mapServiceTypeToPOCategory,
};
