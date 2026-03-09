/**
 * MRP (Material Requirement Planning) Service
 * Handles material requirement calculations, stock allocation, and PO generation
 */

import { Prisma, MaterialRequirementStatus, RequirementSource, Unit, POSource, POCategory, PurchaseOrderStatus } from '@prisma/client';
import { generateCode } from '../utils/code-generator';
import prisma from '../config/database';
import {
  CalculateRequirementsInput,
  CalculatedRequirement,
  RequirementFilters,
  MaterialRequirementResponse,
  OrderRequirementsSummary,
  MRPDashboardStats,
  GeneratePOFromRequirementsRequest,
  CreateManualRequirementRequest,
  AllocateStockRequest,
  LinkRequirementToPORequest,
} from '../types/mrp.types';
import { materialService } from './material.service';

/**
 * Ensure a materials record exists for a fabric_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 * Handles legacy/imported fabrics that were created before the auto-creation logic.
 */
async function ensureMaterialForFabric(fabricId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { fabricId } });
    if (existing) return existing;

    const fabric = await prisma.fabric_master.findUnique({
      where: { id: fabricId },
      select: { id: true, fabricCode: true, fabricName: true, supplierId: true },
    });
    if (!fabric) {
      console.warn(`[MRP] fabric_master not found for fabricId: ${fabricId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: fabric.id, code: fabric.fabricCode, name: fabric.fabricName },
      'FABRIC'
    );
    console.log(`[MRP] Auto-created materials record for fabric: ${fabric.fabricCode} (${fabric.id})`);

    // Copy default supplier so vendor suggestion works
    if (fabric.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: fabric.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from fabric_master default supplier',
          },
        });
      } catch (_) { /* non-fatal */ }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { fabricId } });
      if (justCreated) return justCreated;
    }
    console.error(`[MRP] Failed to auto-create materials record for fabricId ${fabricId}:`, err);
    return null;
  }
}

/**
 * Ensure a materials record exists for a lace_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 */
async function ensureMaterialForLace(laceId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { laceId } });
    if (existing) return existing;

    const lace = await prisma.lace_master.findUnique({
      where: { id: laceId },
      select: { id: true, laceCode: true, laceName: true, supplierId: true },
    });
    if (!lace) {
      console.warn(`[MRP] lace_master not found for laceId: ${laceId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: lace.id, code: lace.laceCode, name: lace.laceName },
      'LACE'
    );
    console.log(`[MRP] Auto-created materials record for lace: ${lace.laceCode} (${lace.id})`);

    if (lace.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: lace.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from lace_master default supplier',
          },
        });
      } catch (_) { /* non-fatal */ }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { laceId } });
      if (justCreated) return justCreated;
    }
    console.error(`[MRP] Failed to auto-create materials record for laceId ${laceId}:`, err);
    return null;
  }
}

/**
 * Ensure a materials record exists for a greige_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 */
async function ensureMaterialForGreige(greigeId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { greigeId } });
    if (existing) return existing;

    const greige = await prisma.greige_master.findUnique({
      where: { id: greigeId },
      select: { id: true, greigeCode: true, greigeName: true, supplierId: true },
    });
    if (!greige) {
      console.warn(`[MRP] greige_master not found for greigeId: ${greigeId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: greige.id, code: greige.greigeCode, name: greige.greigeName },
      'GREIGE'
    );
    console.log(`[MRP] Auto-created materials record for greige: ${greige.greigeCode} (${greige.id})`);

    if (greige.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: greige.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from greige_master default supplier',
          },
        });
      } catch (_) { /* non-fatal */ }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { greigeId } });
      if (justCreated) return justCreated;
    }
    console.error(`[MRP] Failed to auto-create materials record for greigeId ${greigeId}:`, err);
    return null;
  }
}

/**
 * Normalize unit strings to valid Prisma Unit enum values
 * Maps common abbreviations and variations to standard enum values
 */
function normalizeUnit(unit: string | null | undefined): Unit {
  if (!unit) return Unit.PIECE; // Default fallback

  const normalized = unit.toUpperCase().trim();

  // Direct matches - check if already a valid Unit enum value
  if (Object.values(Unit).includes(normalized as Unit)) {
    return normalized as Unit;
  }

  // Common mappings for abbreviations and variations
  const unitMap: Record<string, Unit> = {
    'PCS': Unit.PIECE,
    'PC': Unit.PIECE,
    'PIECES': Unit.PIECE,
    'METERS': Unit.METER,
    'MTR': Unit.METER,
    'M': Unit.METER,
    'YARDS': Unit.YARD,
    'YD': Unit.YARD,
    'KG': Unit.KILOGRAM,
    'KGS': Unit.KILOGRAM,
    'KILOGRAMS': Unit.KILOGRAM,
    'DOZ': Unit.DOZEN,
    'DOZENS': Unit.DOZEN,
    'SETS': Unit.SET,
    'TUBES': Unit.TUBE,
    'CONES': Unit.CONE,
    'SPOOLS': Unit.SPOOL,
    'BOXES': Unit.BOX,
  };

  return unitMap[normalized] || Unit.PIECE; // Default to PIECE if unknown
}

/**
 * Determine POCategory from material types in a PO
 * Uses the majority material type to set category
 */
function determinePOCategoryFromMaterials(materials: Array<{ materialType: string | null }>): POCategory {
  const typeMapping: Record<string, POCategory> = {
    FABRIC: POCategory.FABRIC,
    GREIGE: POCategory.GREIGE,
    LACE: POCategory.LACE,
    GREIGE_LACE: POCategory.GREIGE_LACE,
    BUTTON: POCategory.TRIMS,
    THREAD: POCategory.TRIMS,
    ELASTIC: POCategory.TRIMS,
    LABEL: POCategory.TRIMS,
    ZIPPER: POCategory.TRIMS,
    PACKAGING: POCategory.TRIMS,
    INTERLINING: POCategory.TRIMS,
    TAPE: POCategory.TRIMS,
    CORD: POCategory.TRIMS,
    HOOK_EYE: POCategory.TRIMS,
  };

  // Count material types
  const typeCounts = new Map<POCategory, number>();
  for (const mat of materials) {
    const category = typeMapping[mat.materialType || ''] || POCategory.GENERAL;
    typeCounts.set(category, (typeCounts.get(category) || 0) + 1);
  }

  // Return the most common category
  let maxCount = 0;
  let dominantCategory: POCategory = POCategory.GENERAL;
  for (const [category, count] of typeCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = category;
    }
  }

  return dominantCategory;
}

/**
 * Generate a unique requirement number
 */
async function generateRequirementNumber(): Promise<string> {
  const today = new Date();
  const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `MR-${datePrefix}`;

  // Find the last requirement number with this prefix
  const lastRequirement = await prisma.material_requirements.findFirst({
    where: {
      requirementNumber: { startsWith: prefix },
    },
    orderBy: { requirementNumber: 'desc' },
  });

  let sequence = 1;
  if (lastRequirement) {
    const lastSequence = parseInt(lastRequirement.requirementNumber.split('-').pop() || '0', 10);
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
}

/**
 * Calculate material requirements from an order's BOM
 * Formula: totalRequired = orderQuantity × quantityPerUnit × (1 + wastagePercent/100)
 */
export async function calculateRequirementsFromOrder(
  input: CalculateRequirementsInput,
  userId: string
): Promise<{ created: number; updated: number; requirements: MaterialRequirementResponse[] }> {
  const { orderId, orderItemId, requiredDate, checkStock = true } = input;

  // Get order with items and their styles
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      order_items: {
        where: orderItemId ? { id: orderItemId } : undefined,
        include: {
          styles: true,
        },
      },
      orderBoms: {
        where: { isActive: true },
        include: {
          items: {
            include: {
              material: {
                include: {
                  suppliers: {
                    where: { isPreferred: true },
                    include: { supplier: true },
                  },
                },
              },
              fabric_master: true,
              lace_master: true,
              button_master: true,
              thread_master: true,
              zipper_master: true,
              elastic_master: true,
              label_master: true,
              packaging_master: true,
              rateCard: { select: { printingType: true } },
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  // Cancel existing non-final requirements for this order before recalculating
  // This prevents duplicate requirements when MRP is run multiple times
  await prisma.material_requirements.updateMany({
    where: {
      orderId,
      status: { notIn: ['RECEIVED', 'CANCELLED'] },
    },
    data: { status: 'CANCELLED' },
  });

  const calculatedRequirements: CalculatedRequirement[] = [];

  // Process each order item
  for (const orderItem of order.order_items) {
    const style = orderItem.styles;
    // Find the active order BOM for this style
    const bom = order.orderBoms.find((b: any) => b.styleId === style.id);

    if (!bom) {
      console.warn(`No active BOM found for style ${style.styleCode}`);
      continue;
    }

    // Process each BOM item
    for (const bomItem of bom.items) {
      const material = bomItem.material;

      // Allow items with specific master IDs even without materialId
      let hasFabric = !!(bomItem.materialType === 'FABRIC' && bomItem.fabricId);
      let hasLace = !!(bomItem.materialType === 'LACE' && bomItem.laceId);
      // GREIGE_PROCESSED: When sourcing strategy indicates greige + processing workflow
      const hasGreigeProcessing = bomItem.sourcingStrategy === 'GREIGE_PROCESSED' && bomItem.greigeId;
      // Other master types (thread, button, zipper, elastic, label, packaging)
      const hasSpecificMaster = bomItem.buttonId || bomItem.threadId || bomItem.zipperId
        || bomItem.elasticId || bomItem.labelId || bomItem.packagingId;

      // Fallback: resolve fabricId from style's own style_fabrics (set during CAD approval)
      if ((bomItem.materialType === 'FABRIC' || (bomItem.materialType === 'GREIGE' && !bomItem.greigeId))
          && !bomItem.fabricId && !material) {
        const styleComponents = await prisma.style_components.findMany({
          where: { styleId: style.id },
          select: { id: true },
        });
        if (styleComponents.length > 0) {
          const styleFabric = await prisma.style_fabrics.findFirst({
            where: {
              componentId: { in: styleComponents.map(c => c.id) },
              fabricId: { not: null },
            },
            select: { fabricId: true },
          });
          if (styleFabric?.fabricId) {
            // Patch BOM item for future calculations
            await prisma.order_bom_items.update({
              where: { id: bomItem.id },
              data: { fabricId: styleFabric.fabricId },
            });
            (bomItem as any).fabricId = styleFabric.fabricId;
            if (bomItem.materialType === 'FABRIC') hasFabric = true;
            console.log(`[MRP] Resolved fabricId for "${bomItem.componentName}" via style_fabrics → ${styleFabric.fabricId}`);
          }
        }
      }

      // Fallback: resolve laceId from style's material BOM lace references
      if (bomItem.materialType === 'LACE' && !bomItem.laceId && !material) {
        const laceBomItem = await prisma.style_material_bom.findFirst({
          where: {
            styleId: style.id,
            laceId: { not: null },
          },
          select: { laceId: true },
        });
        if (laceBomItem?.laceId) {
          await prisma.order_bom_items.update({
            where: { id: bomItem.id },
            data: { laceId: laceBomItem.laceId },
          });
          (bomItem as any).laceId = laceBomItem.laceId;
          hasLace = true;
          console.log(`[MRP] Resolved laceId for "${bomItem.componentName}" via style_material_bom → ${laceBomItem.laceId}`);
        }
      }

      // Skip only if truly no material info available
      if (!material && !hasFabric && !hasLace && !hasGreigeProcessing && !hasSpecificMaster) continue;

      const quantityPerUnit = Number(bomItem.quantityPerGarment);
      const wastagePercent = Number(bomItem.wastagePercent);
      const orderQuantity = orderItem.totalQuantity;

      // Calculate total required with wastage
      // Formula: totalRequired = orderQty × qtyPerUnit × (1 + wastage/100)
      const baseRequired = orderQuantity * quantityPerUnit;
      const wastageAmount = baseRequired * (wastagePercent / 100);
      const totalRequired = baseRequired + wastageAmount;

      // Get preferred supplier (only available if material relation exists)
      const preferredSupplier = material?.suppliers?.find((s: any) => s.isPreferred);

      // Check available stock if requested
      let availableStock = 0;
      let allocatedFromStock = 0;
      let shortfall = totalRequired;
      let status: MaterialRequirementStatus = MaterialRequirementStatus.PO_REQUIRED;

      if (checkStock) {
        // For FABRIC items with CAD width info, check fabric_stock with width filtering
        if (bomItem.materialType === 'FABRIC' && bomItem.fabricId && bomItem.fabricWidthInches) {
          const bomWidth = Number(bomItem.fabricWidthInches);

          // Check fabric_stock at the BOM-specified width (tolerance ±0.5 inches)
          const fabricStockAtWidth = await prisma.fabric_stock.aggregate({
            where: {
              fabricId: bomItem.fabricId,
              cutableWidth: { gte: bomWidth - 0.5, lte: bomWidth + 0.5 },
              status: 'AVAILABLE',
            },
            _sum: { quantityAvailable: true },
          });
          const stockAtBomWidth = Number(fabricStockAtWidth._sum?.quantityAvailable || 0);

          // Also check stock at ANY width for this fabric (for split scenarios)
          const fabricStockAnyWidth = await prisma.fabric_stock.aggregate({
            where: {
              fabricId: bomItem.fabricId,
              status: 'AVAILABLE',
            },
            _sum: { quantityAvailable: true },
          });
          const totalFabricStock = Number(fabricStockAnyWidth._sum?.quantityAvailable || 0);

          if (stockAtBomWidth >= totalRequired) {
            // Fully available at requested width
            availableStock = stockAtBomWidth;
            allocatedFromStock = totalRequired;
            shortfall = 0;
            status = MaterialRequirementStatus.FULFILLED_STOCK;
          } else if (stockAtBomWidth > 0) {
            // Partial stock at requested width
            availableStock = stockAtBomWidth;
            allocatedFromStock = stockAtBomWidth;
            shortfall = totalRequired - stockAtBomWidth;
            status = MaterialRequirementStatus.PARTIAL_STOCK;
          } else if (totalFabricStock > 0 && totalFabricStock < totalRequired) {
            // Stock exists but at different width — create split requirement
            // Main requirement: use stock at available width
            availableStock = totalFabricStock;
            allocatedFromStock = totalFabricStock;
            shortfall = totalRequired - totalFabricStock;
            status = MaterialRequirementStatus.PARTIAL_STOCK;
          }
          // else: no stock at all, defaults remain (PO_REQUIRED)

        } else if (bomItem.materialType === 'LACE' && bomItem.laceId) {
          // For LACE items, check lace_stock table
          const laceStockResult = await prisma.lace_stock.aggregate({
            where: {
              laceId: bomItem.laceId,
              status: 'AVAILABLE',
              quantityAvailable: { gt: 0 },
            },
            _sum: { quantityAvailable: true },
          });
          const totalLaceStock = Number(laceStockResult._sum?.quantityAvailable || 0);

          if (totalLaceStock >= totalRequired) {
            // Fully available from lace stock
            availableStock = totalLaceStock;
            allocatedFromStock = totalRequired;
            shortfall = 0;
            status = MaterialRequirementStatus.FULFILLED_STOCK;
          } else if (totalLaceStock > 0) {
            // Partial stock available
            availableStock = totalLaceStock;
            allocatedFromStock = totalLaceStock;
            shortfall = totalRequired - totalLaceStock;
            status = MaterialRequirementStatus.PARTIAL_STOCK;
          }
          // else: no stock at all, defaults remain (PO_REQUIRED)

        // Note: GREIGE stock checking requires schema changes (greigeId on order_bom_items)
        // Future: Check fabric_procurement for greige stock when sourcingStrategy === 'GREIGE_PROCESSED'

        } else if (material?.id) {
          // Non-fabric/non-lace or without specific IDs: use generic stock_levels
          const stockLevels = await prisma.stock_levels.aggregate({
            where: { materialId: material.id },
            _sum: { quantity: true },
          });
          availableStock = Number(stockLevels._sum?.quantity || 0);

          if (availableStock >= totalRequired) {
            allocatedFromStock = totalRequired;
            shortfall = 0;
            status = MaterialRequirementStatus.FULFILLED_STOCK;
          } else if (availableStock > 0) {
            allocatedFromStock = availableStock;
            shortfall = totalRequired - availableStock;
            status = MaterialRequirementStatus.PARTIAL_STOCK;
          }
        }
      }

      // Determine materialId - use material.id if available, otherwise look up by fabricId/laceId
      let effectiveMaterialId = material?.id;

      // For FABRIC items without materialId, look up or auto-create materials record by fabricId
      if (!effectiveMaterialId && hasFabric) {
        const fabricMaterial = await prisma.materials.findFirst({
          where: { fabricId: bomItem.fabricId }
        });
        if (fabricMaterial) {
          effectiveMaterialId = fabricMaterial.id;
        } else {
          // Auto-create materials record from fabric_master
          const created = await ensureMaterialForFabric(bomItem.fabricId!);
          if (created) {
            effectiveMaterialId = created.id;
          } else {
            console.warn(`[MRP] Cannot resolve materials record for fabric: ${bomItem.componentName} (fabricId: ${bomItem.fabricId}). Skipping.`);
            continue;
          }
        }
      }

      // For LACE items without materialId, look up or auto-create materials record by laceId
      if (!effectiveMaterialId && hasLace) {
        const laceMaterial = await prisma.materials.findFirst({
          where: { laceId: bomItem.laceId }
        });
        if (laceMaterial) {
          effectiveMaterialId = laceMaterial.id;
        } else {
          const created = await ensureMaterialForLace(bomItem.laceId!);
          if (created) {
            effectiveMaterialId = created.id;
          } else {
            console.warn(`[MRP] Cannot resolve materials record for lace: ${bomItem.componentName} (laceId: ${bomItem.laceId}). Skipping.`);
            continue;
          }
        }
      }

      // For GREIGE_PROCESSED items, look up or auto-create materials record by greigeId
      let greigeMaterialId: string | null = null;
      if (hasGreigeProcessing) {
        const greigeMaterial = await prisma.materials.findFirst({
          where: { greigeId: bomItem.greigeId }
        });
        if (greigeMaterial) {
          greigeMaterialId = greigeMaterial.id;
        } else {
          const created = await ensureMaterialForGreige(bomItem.greigeId!);
          if (created) {
            greigeMaterialId = created.id;
          } else {
            console.warn(`[MRP] Cannot resolve materials record for greige: ${bomItem.componentName} (greigeId: ${bomItem.greigeId}). Skipping.`);
            continue;
          }
        }
        // For GREIGE_PROCESSED, we also need the fabric material for the finished product reference
        if (!effectiveMaterialId && hasFabric) {
          const fabricMaterial = await prisma.materials.findFirst({
            where: { fabricId: bomItem.fabricId }
          });
          if (fabricMaterial) {
            effectiveMaterialId = fabricMaterial.id;
          } else {
            const created = await ensureMaterialForFabric(bomItem.fabricId!);
            if (created) {
              effectiveMaterialId = created.id;
            }
          }
        }
      }

      // For other master types (thread, button, zipper, elastic, label, packaging),
      // look up materials record by specific master ID
      if (!effectiveMaterialId && hasSpecificMaster) {
        const lookups: Array<{ field: string; value: string | null }> = [
          { field: 'buttonId', value: bomItem.buttonId },
          { field: 'threadId', value: bomItem.threadId },
          { field: 'zipperId', value: bomItem.zipperId },
          { field: 'elasticId', value: bomItem.elasticId },
          { field: 'labelId', value: bomItem.labelId },
          { field: 'packagingId', value: bomItem.packagingId },
        ];
        for (const lookup of lookups) {
          if (lookup.value) {
            const mat = await prisma.materials.findFirst({
              where: { [lookup.field]: lookup.value },
            });
            if (mat) {
              effectiveMaterialId = mat.id;
              break;
            }
          }
        }
        if (!effectiveMaterialId) {
          console.warn(`No materials record for: ${bomItem.componentName} (${bomItem.materialType}). Skipping MRP.`);
          continue;
        }
      }

      // For GREIGE_PROCESSED items without fabricId, use greigeMaterialId as effectiveMaterialId
      if (!effectiveMaterialId && hasGreigeProcessing && greigeMaterialId) {
        effectiveMaterialId = greigeMaterialId;
      }

      // Skip if we still couldn't determine materialId
      if (!effectiveMaterialId) {
        console.warn(`Cannot create requirement - no materialId for: ${bomItem.componentName}`);
        continue;
      }

      // For GREIGE_PROCESSED sourcing, create TWO requirements: GREIGE + PROCESSING
      if (hasGreigeProcessing && greigeMaterialId) {
        // Requirement 1: GREIGE material procurement
        calculatedRequirements.push({
          orderId,
          orderItemId: orderItem.id,
          materialId: greigeMaterialId, // Use greige material ID
          orderBomId: bom.id,
          orderQuantity,
          quantityPerUnit,
          wastagePercent,
          totalRequired,
          unit: normalizeUnit(bomItem.unit),
          availableStock,
          allocatedFromStock,
          shortfall,
          preferredSupplierId: preferredSupplier?.supplierId || null,
          status,
          requirementType: 'MATERIAL', // Standard material procurement
          // Fabric width tracking for split PO scenarios
          fabricWidth: bomItem.fabricWidthInches ? Number(bomItem.fabricWidthInches) : undefined,
          cadId: bomItem.selectedCadId || undefined,
          isGreigeRequirement: true, // Flag for creating linked processing requirement
          processorId: bomItem.processorId || null, // Store for processing requirement
          processingCost: bomItem.processingCost ? Number(bomItem.processingCost) : null,
        });

        // Requirement 2: PROCESSING requirement (linked to GREIGE)
        // This will be created AFTER the GREIGE requirement is saved (needs the ID)
        calculatedRequirements.push({
          orderId,
          orderItemId: orderItem.id,
          materialId: greigeMaterialId, // Same material reference for tracking
          orderBomId: bom.id,
          orderQuantity,
          quantityPerUnit,
          wastagePercent,
          totalRequired, // Same quantity needs processing
          unit: normalizeUnit(bomItem.unit),
          availableStock: 0, // Processing doesn't have stock
          allocatedFromStock: 0,
          shortfall: totalRequired, // Full amount needs processing
          preferredSupplierId: bomItem.processorId || null, // Processor becomes the "supplier"
          status: MaterialRequirementStatus.PO_REQUIRED, // Processing always needs PO
          requirementType: 'PROCESSING', // Processing service requirement
          processorId: bomItem.processorId || null,
          processingCost: bomItem.processingCost ? Number(bomItem.processingCost) : null,
          printingType: bomItem.rateCard?.printingType || null,
          // Fabric width tracking for split PO scenarios
          fabricWidth: bomItem.fabricWidthInches ? Number(bomItem.fabricWidthInches) : undefined,
          linkedGreigeMaterialId: greigeMaterialId, // Link to parent GREIGE requirement
        });
      } else {
        // Standard requirement (READY_FABRIC, STOCK_REUSE, or no sourcing strategy)
        calculatedRequirements.push({
          orderId,
          orderItemId: orderItem.id,
          materialId: effectiveMaterialId,
          orderBomId: bom.id,
          orderQuantity,
          quantityPerUnit,
          wastagePercent,
          totalRequired,
          unit: normalizeUnit(bomItem.unit),
          availableStock,
          allocatedFromStock,
          shortfall,
          preferredSupplierId: preferredSupplier?.supplierId || null,
          status,
          requirementType: 'MATERIAL', // Standard material procurement
          // Fabric width tracking for split PO scenarios
          fabricWidth: bomItem.fabricWidthInches ? Number(bomItem.fabricWidthInches) : undefined,
          cadId: bomItem.selectedCadId || undefined,
        });
      }
    }
  }

  // Upsert requirements
  // Process in two passes: first MATERIAL/GREIGE, then PROCESSING (to get linked IDs)
  let created = 0;
  let updated = 0;
  const savedRequirements: MaterialRequirementResponse[] = [];

  // Track GREIGE requirements by materialId for linking PROCESSING requirements
  const greigeRequirementIds: Map<string, string> = new Map();

  // First pass: Create/update MATERIAL requirements (including GREIGE)
  const materialReqs = calculatedRequirements.filter(req => req.requirementType === 'MATERIAL');
  const processingReqs = calculatedRequirements.filter(req => req.requirementType === 'PROCESSING');

  for (const req of materialReqs) {
    // Check if requirement already exists for this order item + material + requirementType
    const existing = await prisma.material_requirements.findFirst({
      where: {
        orderId: req.orderId,
        orderItemId: req.orderItemId,
        materialId: req.materialId,
        requirementType: req.requirementType || 'MATERIAL',
      },
    });

    let saved;
    if (existing) {
      // Update existing requirement
      saved = await prisma.material_requirements.update({
        where: { id: existing.id },
        data: {
          orderQuantity: req.orderQuantity,
          quantityPerUnit: req.quantityPerUnit,
          wastagePercent: req.wastagePercent,
          totalRequired: req.totalRequired,
          availableStock: req.availableStock,
          allocatedFromStock: req.allocatedFromStock,
          shortfall: req.shortfall,
          status: req.status,
          fabricWidth: req.fabricWidth,
          cadId: req.cadId,
          calculatedAt: new Date(),
        },
        include: getRequirementIncludes(),
      });
      updated++;
    } else {
      // Create new requirement
      const requirementNumber = await generateRequirementNumber();
      saved = await prisma.material_requirements.create({
        data: {
          requirementNumber,
          source: RequirementSource.SALES_ORDER,
          orderId: req.orderId,
          orderItemId: req.orderItemId,
          materialId: req.materialId,
          orderBomId: req.orderBomId,
          orderQuantity: req.orderQuantity,
          quantityPerUnit: req.quantityPerUnit,
          wastagePercent: req.wastagePercent,
          totalRequired: req.totalRequired,
          unit: req.unit as Unit,
          availableStock: req.availableStock,
          allocatedFromStock: req.allocatedFromStock,
          shortfall: req.shortfall,
          preferredSupplierId: req.preferredSupplierId,
          status: req.status,
          fabricWidth: req.fabricWidth,
          cadId: req.cadId,
          requirementType: req.requirementType || 'MATERIAL',
          requiredDate,
          createdById: userId,
        },
        include: getRequirementIncludes(),
      });
      created++;
    }

    // Track GREIGE requirements for linking to PROCESSING requirements
    if ((req as any).isGreigeRequirement && saved) {
      greigeRequirementIds.set(`${req.orderId}-${req.orderItemId}-${req.materialId}`, saved.id);
    }

    savedRequirements.push(mapToResponse(saved));
  }

  // Second pass: Create/update PROCESSING requirements with linked GREIGE IDs
  for (const req of processingReqs) {
    // Find the linked GREIGE requirement ID
    const linkedGreigeId = greigeRequirementIds.get(
      `${req.orderId}-${req.orderItemId}-${(req as any).linkedGreigeMaterialId || req.materialId}`
    );

    // Check if PROCESSING requirement already exists
    const existing = await prisma.material_requirements.findFirst({
      where: {
        orderId: req.orderId,
        orderItemId: req.orderItemId,
        materialId: req.materialId,
        requirementType: 'PROCESSING',
      },
    });

    let saved;
    if (existing) {
      // Update existing PROCESSING requirement
      saved = await prisma.material_requirements.update({
        where: { id: existing.id },
        data: {
          orderQuantity: req.orderQuantity,
          quantityPerUnit: req.quantityPerUnit,
          wastagePercent: req.wastagePercent,
          totalRequired: req.totalRequired,
          availableStock: 0,
          allocatedFromStock: 0,
          shortfall: req.shortfall,
          status: req.status,
          processorId: (req as any).processorId,
          processingCost: (req as any).processingCost,
          linkedRequirementId: linkedGreigeId || existing.linkedRequirementId,
          calculatedAt: new Date(),
        },
        include: getRequirementIncludes(),
      });
      updated++;
    } else {
      // Create new PROCESSING requirement
      const requirementNumber = await generateRequirementNumber();
      saved = await prisma.material_requirements.create({
        data: {
          requirementNumber,
          source: RequirementSource.SALES_ORDER,
          orderId: req.orderId,
          orderItemId: req.orderItemId,
          materialId: req.materialId,
          orderBomId: req.orderBomId,
          orderQuantity: req.orderQuantity,
          quantityPerUnit: req.quantityPerUnit,
          wastagePercent: req.wastagePercent,
          totalRequired: req.totalRequired,
          unit: req.unit as Unit,
          availableStock: 0,
          allocatedFromStock: 0,
          shortfall: req.shortfall,
          preferredSupplierId: (req as any).processorId, // Processor is the "supplier"
          status: req.status,
          requirementType: 'PROCESSING',
          processorId: (req as any).processorId,
          processingCost: (req as any).processingCost,
          printingType: (req as any).printingType || null,
          linkedRequirementId: linkedGreigeId,
          requiredDate,
          createdById: userId,
        },
        include: getRequirementIncludes(),
      });
      created++;
    }

    savedRequirements.push(mapToResponse(saved));
  }

  return { created, updated, requirements: savedRequirements };
}

/**
 * Create a manual material requirement (not from BOM)
 */
export async function createManualRequirement(
  data: CreateManualRequirementRequest,
  userId: string
): Promise<MaterialRequirementResponse> {
  const requirementNumber = await generateRequirementNumber();

  const requirement = await prisma.material_requirements.create({
    data: {
      requirementNumber,
      source: RequirementSource.MANUAL,
      materialId: data.materialId,
      orderQuantity: 1,
      quantityPerUnit: data.quantity,
      wastagePercent: 0,
      totalRequired: data.quantity,
      unit: data.unit as Unit,
      availableStock: 0,
      allocatedFromStock: 0,
      shortfall: data.quantity,
      preferredSupplierId: data.preferredSupplierId,
      status: MaterialRequirementStatus.PO_REQUIRED,
      requiredDate: new Date(data.requiredDate),
      createdById: userId,
    },
    include: getRequirementIncludes(),
  });

  return mapToResponse(requirement);
}

/**
 * Get requirements with filters and pagination
 */
export async function getRequirements(
  filters: RequirementFilters
): Promise<{ data: MaterialRequirementResponse[]; total: number }> {
  const {
    orderId,
    orderItemId,
    materialId,
    supplierId,
    styleId,
    status,
    source,
    requirementType,
    requiredDateFrom,
    requiredDateTo,
    hasShortfall,
    search,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;

  const where: Prisma.material_requirementsWhereInput = {};

  if (orderId) where.orderId = orderId;
  if (orderItemId) where.orderItemId = orderItemId;
  if (materialId) where.materialId = materialId;
  if (supplierId) where.preferredSupplierId = supplierId;
  if (styleId) where.order_items = { styleId };
  if (source) where.source = source;
  if (requirementType) where.requirementType = requirementType;

  if (status) {
    if (Array.isArray(status)) {
      where.status = { in: status };
    } else {
      where.status = status;
    }
  }

  if (requiredDateFrom || requiredDateTo) {
    where.requiredDate = {};
    if (requiredDateFrom) where.requiredDate.gte = new Date(requiredDateFrom);
    if (requiredDateTo) where.requiredDate.lte = new Date(requiredDateTo);
  }

  if (hasShortfall === true) {
    where.shortfall = { gt: 0 };
  } else if (hasShortfall === false) {
    where.shortfall = { lte: 0 };
  }

  if (search) {
    where.OR = [
      { requirementNumber: { contains: search, mode: 'insensitive' } },
      { materials: { code: { contains: search, mode: 'insensitive' } } },
      { materials: { name: { contains: search, mode: 'insensitive' } } },
      { orders: { orderNumber: { contains: search, mode: 'insensitive' } } },
      { order_items: { styles: { styleCode: { contains: search, mode: 'insensitive' } } } },
      { order_items: { styles: { styleName: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.material_requirements.findMany({
      where,
      include: getRequirementIncludes(),
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.material_requirements.count({ where }),
  ]);

  return {
    data: data.map(mapToResponse),
    total,
  };
}

/**
 * Get a single requirement by ID
 */
export async function getRequirementById(id: string): Promise<MaterialRequirementResponse | null> {
  const requirement = await prisma.material_requirements.findUnique({
    where: { id },
    include: getRequirementIncludes(),
  });

  return requirement ? mapToResponse(requirement) : null;
}

/**
 * Get distinct styles that have material requirements (for filter dropdown)
 */
export async function getDistinctRequirementStyles(requirementType?: string) {
  const where: Prisma.material_requirementsWhereInput = {
    orderItemId: { not: null },
    status: { not: 'CANCELLED' },
  };
  if (requirementType) where.requirementType = requirementType;

  const items = await prisma.material_requirements.findMany({
    where,
    select: {
      order_items: {
        select: {
          styleId: true,
          styles: { select: { styleCode: true, styleName: true } },
        },
      },
    },
    distinct: ['orderItemId'],
  });

  // Deduplicate by styleId (multiple order_items may reference the same style)
  const styleMap = new Map<string, { id: string; styleCode: string; styleName: string }>();
  for (const item of items) {
    if (item.order_items) {
      const { styleId, styles } = item.order_items;
      if (!styleMap.has(styleId)) {
        styleMap.set(styleId, {
          id: styleId,
          styleCode: styles.styleCode,
          styleName: styles.styleName,
        });
      }
    }
  }

  return Array.from(styleMap.values()).sort((a, b) => a.styleCode.localeCompare(b.styleCode));
}

/**
 * Get requirements summary for an order
 */
export async function getOrderRequirementsSummary(orderId: string): Promise<OrderRequirementsSummary> {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  const requirements = await prisma.material_requirements.findMany({
    where: { orderId },
    select: {
      status: true,
      totalRequired: true,
      shortfall: true,
    },
  });

  // Group by status
  const byStatus = Object.values(MaterialRequirementStatus).map((status) => {
    const matching = requirements.filter((r) => r.status === status);
    return {
      status,
      count: matching.length,
      totalQuantity: matching.reduce((sum, r) => sum + Number(r.totalRequired), 0),
    };
  }).filter((s) => s.count > 0);

  const totalShortfall = requirements.reduce((sum, r) => sum + Number(r.shortfall), 0);
  const requirementsNeedingPO = requirements.filter(
    (r) => r.status === MaterialRequirementStatus.PO_REQUIRED || r.status === MaterialRequirementStatus.PARTIAL_STOCK
  ).length;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalRequirements: requirements.length,
    byStatus,
    totalShortfall,
    requirementsNeedingPO,
  };
}

/**
 * Get MRP dashboard statistics
 */
export async function getDashboardStats(): Promise<MRPDashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter for MATERIAL-only requirements (excludes PROCESSING from material tab counts)
  const materialOnly = { requirementType: { not: 'PROCESSING' } };

  const [
    pendingCount,
    shortfallSum,
    needingPOCount,
    poInProgressCount,
    awaitingReceiptCount,
    overdueCount,
    processingCount,
    byMaterialType,
    bySupplier,
  ] = await Promise.all([
    // Total pending MATERIAL requirements
    prisma.material_requirements.count({
      where: {
        ...materialOnly,
        status: {
          in: [
            MaterialRequirementStatus.PENDING,
            MaterialRequirementStatus.PO_REQUIRED,
            MaterialRequirementStatus.PARTIAL_STOCK,
          ],
        },
      },
    }),
    // Total shortfall (all types)
    prisma.material_requirements.aggregate({
      where: { shortfall: { gt: 0 } },
      _sum: { shortfall: true },
    }),
    // MATERIAL requirements needing PO
    prisma.material_requirements.count({
      where: {
        ...materialOnly,
        status: {
          in: [MaterialRequirementStatus.PO_REQUIRED, MaterialRequirementStatus.PARTIAL_STOCK],
        },
      },
    }),
    // PO in progress (MATERIAL only)
    prisma.material_requirements.count({
      where: { ...materialOnly, status: MaterialRequirementStatus.PO_GENERATED },
    }),
    // Awaiting receipt (MATERIAL only)
    prisma.material_requirements.count({
      where: { ...materialOnly, status: MaterialRequirementStatus.PO_SENT },
    }),
    // Overdue requirements (all types)
    prisma.material_requirements.count({
      where: {
        requiredDate: { lt: today },
        status: {
          notIn: [MaterialRequirementStatus.RECEIVED, MaterialRequirementStatus.CANCELLED],
        },
      },
    }),
    // PROCESSING requirements count (for Outsourced Work tab)
    prisma.material_requirements.count({
      where: {
        requirementType: 'PROCESSING',
        status: { notIn: [MaterialRequirementStatus.RECEIVED, MaterialRequirementStatus.CANCELLED] },
      },
    }),
    // By material type
    prisma.$queryRaw`
      SELECT m."materialType", COUNT(*)::int as count, SUM(mr.shortfall)::float as shortfall
      FROM material_requirements mr
      JOIN materials m ON mr."materialId" = m.id
      WHERE mr.shortfall > 0
      GROUP BY m."materialType"
    ` as Promise<{ materialType: string; count: number; shortfall: number }[]>,
    // By supplier
    prisma.$queryRaw`
      SELECT
        s.id as "supplierId",
        s.name as "supplierName",
        COUNT(*)::int as "requirementCount",
        0::float as "totalValue"
      FROM material_requirements mr
      JOIN suppliers s ON mr."preferredSupplierId" = s.id
      WHERE mr.status IN ('PO_REQUIRED', 'PARTIAL_STOCK')
      GROUP BY s.id, s.name
      ORDER BY "requirementCount" DESC
      LIMIT 10
    ` as Promise<{ supplierId: string; supplierName: string; requirementCount: number; totalValue: number }[]>,
  ]);

  return {
    totalPendingRequirements: pendingCount,
    totalShortfall: Number(shortfallSum._sum.shortfall || 0),
    requirementsNeedingPO: needingPOCount,
    poInProgress: poInProgressCount,
    awaitingReceipt: awaitingReceiptCount,
    overdueRequirements: overdueCount,
    processingRequirementsCount: processingCount,
    byMaterialType: byMaterialType || [],
    bySupplier: bySupplier || [],
  };
}

/**
 * Allocate stock to a requirement
 */
export async function allocateStock(
  data: AllocateStockRequest,
  userId: string
): Promise<MaterialRequirementResponse> {
  const requirement = await prisma.material_requirements.findUnique({
    where: { id: data.requirementId },
  });

  if (!requirement) {
    throw new Error(`Requirement ${data.requirementId} not found`);
  }

  const newAllocated = Number(requirement.allocatedFromStock) + data.quantity;
  const newShortfall = Math.max(0, Number(requirement.totalRequired) - newAllocated);
  let newStatus = requirement.status;

  if (newShortfall === 0) {
    newStatus = MaterialRequirementStatus.FULFILLED_STOCK;
  } else if (newAllocated > 0) {
    newStatus = MaterialRequirementStatus.PARTIAL_STOCK;
  }

  const updated = await prisma.material_requirements.update({
    where: { id: data.requirementId },
    data: {
      allocatedFromStock: newAllocated,
      shortfall: newShortfall,
      status: newStatus,
    },
    include: getRequirementIncludes(),
  });

  return mapToResponse(updated);
}

/**
 * Generate a Purchase Order from requirements
 */
export async function generatePOFromRequirements(
  data: GeneratePOFromRequirementsRequest,
  userId: string
): Promise<{ purchaseOrder: any; linkedRequirements: number; totalItems: number }> {
  const { requirementIds, supplierId, expectedDeliveryDate, remarks, consolidate = true } = data;

  // Get all requirements
  const requirements = await prisma.material_requirements.findMany({
    where: {
      id: { in: requirementIds },
      status: { in: [MaterialRequirementStatus.PO_REQUIRED, MaterialRequirementStatus.PARTIAL_STOCK] },
    },
    include: {
      materials: true,
    },
  });

  if (requirements.length === 0) {
    throw new Error('No valid requirements found for PO generation');
  }

  // Look up supplier prices from material_supplier_mapping
  const materialIds = [...new Set(requirements.map(r => r.materialId))];
  const supplierPrices = await prisma.material_supplier_mapping.findMany({
    where: {
      materialId: { in: materialIds.map(id => parseInt(id, 10)) },
      supplierId,
      isActive: true,
    },
    select: { materialId: true, supplierPrice: true },
  });
  const priceMap = new Map(
    supplierPrices.map(sp => [String(sp.materialId), Number(sp.supplierPrice) || 0])
  );

  // Group by material if consolidating
  interface POItemData {
    materialId: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    requirementIds: string[];
    printingType?: string | null;
  }

  const poItems: POItemData[] = [];

  if (consolidate) {
    const materialGroups = new Map<string, POItemData>();

    for (const req of requirements) {
      const key = req.materialId;
      const existing = materialGroups.get(key);

      if (existing) {
        existing.quantity += Number(req.shortfall);
        existing.requirementIds.push(req.id);
      } else {
        materialGroups.set(key, {
          materialId: req.materialId,
          quantity: Number(req.shortfall),
          unit: req.unit,
          unitPrice: priceMap.get(req.materialId) || 0,
          requirementIds: [req.id],
          printingType: req.printingType || null,
        });
      }
    }

    poItems.push(...materialGroups.values());
  } else {
    for (const req of requirements) {
      poItems.push({
        materialId: req.materialId,
        quantity: Number(req.shortfall),
        unit: req.unit,
        unitPrice: priceMap.get(req.materialId) || 0,
        requirementIds: [req.id],
        printingType: req.printingType || null,
      });
    }
  }

  // Determine PO category from material types or requirement types
  const materialTypes = requirements.map((req) => ({
    materialType: req.materials?.materialType || null,
  }));
  let poCategory = determinePOCategoryFromMaterials(materialTypes);

  // Check if these are PROCESSING requirements
  const isProcessingRequirements = requirements.every(req => req.requirementType === 'PROCESSING');
  if (isProcessingRequirements) {
    poCategory = POCategory.PROCESSING;
  }

  // For PROCESSING requirements, find the linked GREIGE PO
  let linkedGreigePOId: string | null = null;
  if (isProcessingRequirements) {
    // Get the linked GREIGE requirement(s)
    const linkedGreigeReqIds = requirements
      .map(req => req.linkedRequirementId)
      .filter((id): id is string => id !== null);

    if (linkedGreigeReqIds.length > 0) {
      // Find the PO that was generated for the linked GREIGE requirement
      const greigePoLink = await prisma.requirement_po_links.findFirst({
        where: {
          requirementId: { in: linkedGreigeReqIds },
        },
        select: {
          purchaseOrderId: true,
        },
      });
      linkedGreigePOId = greigePoLink?.purchaseOrderId || null;
    }
  }

  // Determine initial status: PENDING_GREIGE for PROCESSING POs, DRAFT otherwise
  const initialStatus = isProcessingRequirements && linkedGreigePOId
    ? PurchaseOrderStatus.PENDING_GREIGE
    : PurchaseOrderStatus.DRAFT;

  // Create PO with items in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Generate PO number
    const poNumber = await generateCode('PO', 'purchase_orders', 'poNumber');

    // Calculate total
    const totalAmount = poItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    // Create Purchase Order
    const po = await tx.purchase_orders.create({
      data: {
        id: crypto.randomUUID(),
        poNumber,
        supplierId,
        expectedDeliveryDate: new Date(expectedDeliveryDate),
        status: initialStatus,
        poSource: POSource.MRP,
        poCategory,
        linkedGreigePOId,
        totalAmount,
        remarks: isProcessingRequirements && linkedGreigePOId
          ? `${remarks || ''}\n[Processing PO] Waiting for greige fabric receipt.`
          : remarks,
        createdById: userId,
      },
    });

    // Create PO items and links
    let linkedCount = 0;
    for (const item of poItems) {
      const poItem = await tx.purchase_order_items.create({
        data: {
          id: crypto.randomUUID(),
          poId: po.id,
          materialId: item.materialId,
          orderedQuantity: item.quantity,
          unit: item.unit as Unit,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          printingType: item.printingType || null,
        },
      });

      // Create links to requirements
      for (const reqId of item.requirementIds) {
        await tx.requirement_po_links.create({
          data: {
            requirementId: reqId,
            purchaseOrderId: po.id,
            purchaseOrderItemId: poItem.id,
            allocatedQuantity: item.quantity / item.requirementIds.length, // Split evenly
          },
        });

        // Update requirement status
        await tx.material_requirements.update({
          where: { id: reqId },
          data: { status: MaterialRequirementStatus.PO_GENERATED },
        });

        linkedCount++;
      }
    }

    return { po, linkedCount, itemCount: poItems.length };
  });

  return {
    purchaseOrder: {
      id: result.po.id,
      poNumber: result.po.poNumber,
      totalAmount: Number(result.po.totalAmount || 0),
    },
    linkedRequirements: result.linkedCount,
    totalItems: result.itemCount,
  };
}

/**
 * Link a requirement to an existing PO item
 */
export async function linkRequirementToPO(
  data: LinkRequirementToPORequest,
  userId: string
): Promise<MaterialRequirementResponse> {
  const { requirementId, purchaseOrderId, purchaseOrderItemId, allocatedQuantity } = data;

  // Verify requirement exists
  const requirement = await prisma.material_requirements.findUnique({
    where: { id: requirementId },
  });

  if (!requirement) {
    throw new Error(`Requirement ${requirementId} not found`);
  }

  // Create link
  await prisma.requirement_po_links.create({
    data: {
      requirementId,
      purchaseOrderId,
      purchaseOrderItemId,
      allocatedQuantity,
    },
  });

  // Update requirement status
  const updated = await prisma.material_requirements.update({
    where: { id: requirementId },
    data: { status: MaterialRequirementStatus.PO_GENERATED },
    include: getRequirementIncludes(),
  });

  return mapToResponse(updated);
}

/**
 * Update requirement status
 */
export async function updateRequirementStatus(
  id: string,
  status: MaterialRequirementStatus,
  userId: string
): Promise<MaterialRequirementResponse> {
  const updated = await prisma.material_requirements.update({
    where: { id },
    data: { status },
    include: getRequirementIncludes(),
  });

  return mapToResponse(updated);
}

/**
 * Cancel a requirement
 */
export async function cancelRequirement(id: string, userId: string): Promise<MaterialRequirementResponse> {
  const updated = await prisma.material_requirements.update({
    where: { id },
    data: { status: MaterialRequirementStatus.CANCELLED },
    include: getRequirementIncludes(),
  });

  return mapToResponse(updated);
}

/**
 * Update received quantity from GRN
 * Called when a GRN is created/updated to update the requirement status
 */
export async function updateReceivedQuantity(
  purchaseOrderItemId: string,
  receivedQuantity: number
): Promise<void> {
  // Find all links to this PO item
  const links = await prisma.requirement_po_links.findMany({
    where: { purchaseOrderItemId },
    include: { material_requirements: true },
  });

  for (const link of links) {
    const newReceived = Number(link.receivedQuantity) + receivedQuantity;
    const isFullyReceived = newReceived >= Number(link.allocatedQuantity);

    await prisma.$transaction([
      // Update link received quantity
      prisma.requirement_po_links.update({
        where: { id: link.id },
        data: { receivedQuantity: newReceived },
      }),
      // Update requirement status if fully received
      ...(isFullyReceived
        ? [
            prisma.material_requirements.update({
              where: { id: link.requirementId },
              data: { status: MaterialRequirementStatus.RECEIVED },
            }),
          ]
        : []),
    ]);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRequirementIncludes() {
  return {
    orders: {
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        customers: { select: { name: true } },
      },
    },
    order_items: {
      select: {
        id: true,
        styleId: true,
        totalQuantity: true,
        styles: { select: { styleCode: true, styleName: true } },
      },
    },
    materials: {
      select: {
        id: true,
        code: true,
        name: true,
        materialType: true,
      },
    },
    preferredSupplier: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
    processor: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
    createdBy: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    },
    requirement_po_links: {
      include: {
        purchase_orders: {
          select: {
            id: true,
            poNumber: true,
            status: true,
            supplierId: true,
          },
        },
        purchase_order_items: {
          select: {
            id: true,
            orderedQuantity: true,
            receivedQuantity: true,
            unitPrice: true,
          },
        },
      },
    },
  };
}

function mapToResponse(req: any): MaterialRequirementResponse {
  return {
    id: req.id,
    requirementNumber: req.requirementNumber,
    source: req.source,
    orderId: req.orderId,
    orderItemId: req.orderItemId,
    materialId: req.materialId,
    orderBomId: req.orderBomId,
    orderQuantity: req.orderQuantity,
    quantityPerUnit: Number(req.quantityPerUnit),
    wastagePercent: Number(req.wastagePercent),
    totalRequired: Number(req.totalRequired),
    unit: req.unit,
    availableStock: Number(req.availableStock),
    allocatedFromStock: Number(req.allocatedFromStock),
    shortfall: Number(req.shortfall),
    preferredSupplierId: req.preferredSupplierId,
    requirementType: req.requirementType || 'MATERIAL',
    processorId: req.processorId || null,
    processingCost: req.processingCost ? Number(req.processingCost) : null,
    printingType: req.printingType || null,
    linkedRequirementId: req.linkedRequirementId || null,
    status: req.status,
    requiredDate: req.requiredDate.toISOString(),
    calculatedAt: req.calculatedAt.toISOString(),
    createdById: req.createdById,
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
    order: req.orders
      ? {
          id: req.orders.id,
          orderNumber: req.orders.orderNumber,
          customerId: req.orders.customerId,
          customerName: req.orders.customers?.name,
        }
      : null,
    orderItem: req.order_items
      ? {
          id: req.order_items.id,
          styleId: req.order_items.styleId,
          styleCode: req.order_items.styles?.styleCode,
          styleName: req.order_items.styles?.styleName,
          totalQuantity: req.order_items.totalQuantity,
        }
      : null,
    material: req.materials
      ? {
          id: req.materials.id,
          code: req.materials.code,
          name: req.materials.name,
          materialType: req.materials.materialType,
        }
      : undefined,
    preferredSupplier: req.preferredSupplier
      ? {
          id: req.preferredSupplier.id,
          code: req.preferredSupplier.code,
          name: req.preferredSupplier.name,
        }
      : null,
    processor: req.processor
      ? {
          id: req.processor.id,
          code: req.processor.code,
          name: req.processor.name,
        }
      : null,
    createdBy: req.createdBy
      ? {
          id: req.createdBy.id,
          firstName: req.createdBy.firstName,
          lastName: req.createdBy.lastName,
        }
      : undefined,
    poLinks: req.requirement_po_links?.map((link: any) => ({
      id: link.id,
      requirementId: link.requirementId,
      purchaseOrderId: link.purchaseOrderId,
      purchaseOrderItemId: link.purchaseOrderItemId,
      allocatedQuantity: Number(link.allocatedQuantity),
      receivedQuantity: Number(link.receivedQuantity),
      createdAt: link.createdAt.toISOString(),
      purchaseOrder: link.purchase_orders
        ? {
            id: link.purchase_orders.id,
            poNumber: link.purchase_orders.poNumber,
            status: link.purchase_orders.status,
            supplierId: link.purchase_orders.supplierId,
          }
        : undefined,
      purchaseOrderItem: link.purchase_order_items
        ? {
            id: link.purchase_order_items.id,
            orderedQuantity: Number(link.purchase_order_items.orderedQuantity),
            receivedQuantity: Number(link.purchase_order_items.receivedQuantity),
            unitPrice: Number(link.purchase_order_items.unitPrice),
          }
        : undefined,
    })),
  };
}

/**
 * Group requirements by supplier for bulk PO generation
 * Returns requirements organized by their preferred supplier
 */
export async function groupRequirementsBySupplier(requirementIds: string[]): Promise<{
  groups: Map<string, MaterialRequirementResponse[]>;
  unassigned: MaterialRequirementResponse[];
  summary: {
    totalRequirements: number;
    totalSuppliers: number;
    unassignedCount: number;
  };
}> {
  console.log('[MRP] Grouping requirements by supplier', { count: requirementIds.length });

  // Get all requirements with supplier info
  const requirements = await prisma.material_requirements.findMany({
    where: {
      id: { in: requirementIds },
      status: { in: [MaterialRequirementStatus.PO_REQUIRED, MaterialRequirementStatus.PARTIAL_STOCK] },
    },
    include: getRequirementIncludes(),
  });

  if (requirements.length === 0) {
    return {
      groups: new Map(),
      unassigned: [],
      summary: {
        totalRequirements: 0,
        totalSuppliers: 0,
        unassignedCount: 0,
      },
    };
  }

  // Group by preferred supplier
  const groups = new Map<string, MaterialRequirementResponse[]>();
  const unassigned: MaterialRequirementResponse[] = [];

  for (const req of requirements) {
    const mapped = mapToResponse(req);

    if (req.preferredSupplierId) {
      const existing = groups.get(req.preferredSupplierId);
      if (existing) {
        existing.push(mapped);
      } else {
        groups.set(req.preferredSupplierId, [mapped]);
      }
    } else {
      unassigned.push(mapped);
    }
  }

  console.log('[MRP] Requirements grouped', {
    totalRequirements: requirements.length,
    totalSuppliers: groups.size,
    unassignedCount: unassigned.length,
  });

  return {
    groups,
    unassigned,
    summary: {
      totalRequirements: requirements.length,
      totalSuppliers: groups.size,
      unassignedCount: unassigned.length,
    },
  };
}

/**
 * Generate multiple Purchase Orders from grouped requirements
 * Creates one PO per supplier in a single transaction
 */
export async function generatePOsBySupplier(
  groups: Array<{
    supplierId: string;
    requirementIds: string[];
    expectedDeliveryDate: string;
    remarks?: string;
  }>,
  userId: string
): Promise<{
  purchaseOrders: Array<{ id: string; poNumber: string; supplierId: string; totalAmount: number }>;
  totalPOs: number;
  totalRequirements: number;
  errors: Array<{ supplierId: string; error: string }>;
}> {
  console.log('[MRP] Generating multiple POs from requirements', { groupCount: groups.length });

  const purchaseOrders: Array<{ id: string; poNumber: string; supplierId: string; totalAmount: number }> = [];
  const errors: Array<{ supplierId: string; error: string }> = [];
  let totalRequirements = 0;

  // Process each supplier group
  for (const group of groups) {
    try {
      // Validate supplier exists
      const supplier = await prisma.suppliers.findUnique({
        where: { id: group.supplierId },
      });

      if (!supplier || !supplier.isActive) {
        errors.push({
          supplierId: group.supplierId,
          error: 'Supplier not found or inactive',
        });
        continue;
      }

      // Generate PO for this supplier's requirements
      const result = await generatePOFromRequirements(
        {
          requirementIds: group.requirementIds,
          supplierId: group.supplierId,
          expectedDeliveryDate: group.expectedDeliveryDate,
          remarks: group.remarks,
          consolidate: true,
        },
        userId
      );

      purchaseOrders.push({
        id: result.purchaseOrder.id,
        poNumber: result.purchaseOrder.poNumber,
        supplierId: group.supplierId,
        totalAmount: result.purchaseOrder.totalAmount,
      });

      totalRequirements += result.linkedRequirements;

      console.log('[MRP] PO generated for supplier', {
        supplierId: group.supplierId,
        poNumber: result.purchaseOrder.poNumber,
        requirements: result.linkedRequirements,
      });
    } catch (error) {
      console.error('[MRP] Failed to generate PO for supplier', { supplierId: group.supplierId, error });
      errors.push({
        supplierId: group.supplierId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  console.log('[MRP] Bulk PO generation complete', {
    totalPOs: purchaseOrders.length,
    totalRequirements,
    errors: errors.length,
  });

  return {
    purchaseOrders,
    totalPOs: purchaseOrders.length,
    totalRequirements,
    errors,
  };
}

/**
 * Validate requirements for bulk PO generation
 * Checks that all requirements have suppliers assigned
 */
export async function validateBulkPOGeneration(requirementIds: string[]): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  requirementsWithoutSupplier: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requirementsWithoutSupplier: string[] = [];

  // Get all requirements
  const requirements = await prisma.material_requirements.findMany({
    where: { id: { in: requirementIds } },
    select: {
      id: true,
      requirementNumber: true,
      preferredSupplierId: true,
      status: true,
      shortfall: true,
    },
  });

  if (requirements.length === 0) {
    errors.push('No requirements found');
    return { valid: false, errors, warnings, requirementsWithoutSupplier };
  }

  if (requirements.length < requirementIds.length) {
    warnings.push(`${requirementIds.length - requirements.length} requirements not found`);
  }

  // Check each requirement
  for (const req of requirements) {
    // Check status
    if (req.status !== MaterialRequirementStatus.PO_REQUIRED && req.status !== MaterialRequirementStatus.PARTIAL_STOCK) {
      warnings.push(`Requirement ${req.requirementNumber} has status ${req.status} (not eligible for PO)`);
      continue;
    }

    // Check shortfall
    if (Number(req.shortfall) <= 0) {
      warnings.push(`Requirement ${req.requirementNumber} has no shortfall`);
      continue;
    }

    // Check supplier
    if (!req.preferredSupplierId) {
      requirementsWithoutSupplier.push(req.id);
      errors.push(`Requirement ${req.requirementNumber} has no supplier assigned`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    requirementsWithoutSupplier,
  };
}

export default {
  calculateRequirementsFromOrder,
  createManualRequirement,
  getRequirements,
  getRequirementById,
  getDistinctRequirementStyles,
  getOrderRequirementsSummary,
  getDashboardStats,
  allocateStock,
  generatePOFromRequirements,
  linkRequirementToPO,
  updateRequirementStatus,
  cancelRequirement,
  updateReceivedQuantity,
  groupRequirementsBySupplier,
  generatePOsBySupplier,
  validateBulkPOGeneration,
};
