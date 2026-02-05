/**
 * MRP (Material Requirement Planning) Service
 * Handles material requirement calculations, stock allocation, and PO generation
 */

import { Prisma, MaterialRequirementStatus, RequirementSource, Unit } from '@prisma/client';
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
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

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
      if (!material) continue;
      const quantityPerUnit = Number(bomItem.quantityPerGarment);
      const wastagePercent = Number(bomItem.wastagePercent);
      const orderQuantity = orderItem.totalQuantity;

      // Calculate total required with wastage
      // Formula: totalRequired = orderQty × qtyPerUnit × (1 + wastage/100)
      const baseRequired = orderQuantity * quantityPerUnit;
      const wastageAmount = baseRequired * (wastagePercent / 100);
      const totalRequired = baseRequired + wastageAmount;

      // Get preferred supplier
      const preferredSupplier = material.suppliers.find((s: any) => s.isPreferred);

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

        } else {
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

      calculatedRequirements.push({
        orderId,
        orderItemId: orderItem.id,
        materialId: material.id,
        orderBomId: bom.id,
        orderQuantity,
        quantityPerUnit,
        wastagePercent,
        totalRequired,
        unit: bomItem.unit,
        availableStock,
        allocatedFromStock,
        shortfall,
        preferredSupplierId: preferredSupplier?.supplierId || null,
        status,
        // Fabric width tracking for split PO scenarios
        fabricWidth: bomItem.fabricWidthInches ? Number(bomItem.fabricWidthInches) : undefined,
        cadId: bomItem.selectedCadId || undefined,
      });
    }
  }

  // Upsert requirements
  let created = 0;
  let updated = 0;
  const savedRequirements: MaterialRequirementResponse[] = [];

  for (const req of calculatedRequirements) {
    // Check if requirement already exists for this order item + material
    const existing = await prisma.material_requirements.findFirst({
      where: {
        orderId: req.orderId,
        orderItemId: req.orderItemId,
        materialId: req.materialId,
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
    status,
    source,
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
  if (source) where.source = source;

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

  const [
    pendingCount,
    shortfallSum,
    needingPOCount,
    poInProgressCount,
    awaitingReceiptCount,
    overdueCount,
    byMaterialType,
    bySupplier,
  ] = await Promise.all([
    // Total pending requirements
    prisma.material_requirements.count({
      where: {
        status: {
          in: [
            MaterialRequirementStatus.PENDING,
            MaterialRequirementStatus.PO_REQUIRED,
            MaterialRequirementStatus.PARTIAL_STOCK,
          ],
        },
      },
    }),
    // Total shortfall
    prisma.material_requirements.aggregate({
      where: { shortfall: { gt: 0 } },
      _sum: { shortfall: true },
    }),
    // Requirements needing PO
    prisma.material_requirements.count({
      where: {
        status: {
          in: [MaterialRequirementStatus.PO_REQUIRED, MaterialRequirementStatus.PARTIAL_STOCK],
        },
      },
    }),
    // PO in progress
    prisma.material_requirements.count({
      where: { status: MaterialRequirementStatus.PO_GENERATED },
    }),
    // Awaiting receipt
    prisma.material_requirements.count({
      where: { status: MaterialRequirementStatus.PO_SENT },
    }),
    // Overdue requirements
    prisma.material_requirements.count({
      where: {
        requiredDate: { lt: today },
        status: {
          notIn: [MaterialRequirementStatus.RECEIVED, MaterialRequirementStatus.CANCELLED],
        },
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

  // Group by material if consolidating
  interface POItemData {
    materialId: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    requirementIds: string[];
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
          unitPrice: 0, // Will be set from supplier price or manually
          requirementIds: [req.id],
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
        unitPrice: 0,
        requirementIds: [req.id],
      });
    }
  }

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
        status: 'DRAFT',
        totalAmount,
        remarks,
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
        styles: { select: { styleName: true } },
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

export default {
  calculateRequirementsFromOrder,
  createManualRequirement,
  getRequirements,
  getRequirementById,
  getOrderRequirementsSummary,
  getDashboardStats,
  allocateStock,
  generatePOFromRequirements,
  linkRequirementToPO,
  updateRequirementStatus,
  cancelRequirement,
  updateReceivedQuantity,
};
