/**
 * Order Thread Requirement Service
 *
 * Manages order-level thread requirements:
 * - CRUD operations for thread requirements
 * - Automatic quantity conversions
 * - Shortage detection
 * - Style-specific SKU generation
 */

import {
  PrismaClient,
  ThreadPly,
  ThreadMaterial,
  ThreadPackagingType,
  ThreadQuantityInput,
  ThreadRequirementStatus,
  Unit,
  POCategory,
  POSource,
} from '@prisma/client';
import { processThreadQuantityInput, calculateReorderQuantity } from './thread-conversion.service';
import { createUnifiedPO, UnifiedPOCreationInput } from './unified-po-creation.service';
import { materialService } from './material.service';

const prisma = new PrismaClient();

// ==================== TYPES ====================

export interface CreateThreadRequirementDto {
  orderId: string;
  threadId: string;
  packagingType: ThreadPackagingType;
  inputType: ThreadQuantityInput;
  unitsOrdered?: number;
  boxesOrdered?: number;
  unitPrice?: number;
  notes?: string;
}

export interface UpdateThreadRequirementDto {
  threadId?: string;
  packagingType?: ThreadPackagingType;
  inputType?: ThreadQuantityInput;
  unitsOrdered?: number;
  boxesOrdered?: number;
  unitPrice?: number;
  notes?: string;
}

export interface OrderThreadRequirement {
  id: string;
  orderId: string;
  threadId: string;
  threadName: string;
  threadCode: string;
  ply: ThreadPly;
  materialComposition: ThreadMaterial;
  colorId: string;
  colorName: string;
  packagingType: ThreadPackagingType;
  inputType: ThreadQuantityInput;
  unitsOrdered?: number;
  boxesOrdered?: number;
  totalUnits: number;
  totalBoxes: number;
  totalMeters: number;
  unitPrice?: number;
  totalCost?: number;
  status: ThreadRequirementStatus;
  supplierId?: string;
  supplierName?: string;
  poItemId?: string;
  orderNumber?: string;
  notes?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateThreadPOInput {
  requirementIds: string[];
  supplierId: string;
  expectedDeliveryDate: Date;
  createdById: string;
  remarks?: string;
}

export interface ThreadRequirementQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ThreadRequirementStatus;
  orderId?: string;
}

export interface ThreadShortage {
  threadId: string;
  threadCode: string;
  threadName: string;
  ply: ThreadPly;
  materialComposition: ThreadMaterial;
  colorName: string;
  packagingType: ThreadPackagingType;
  required: {
    units: number;
    boxes: number;
    meters: number;
  };
  available: {
    units: number;
    boxes: number;
    meters: number;
  };
  shortage: {
    units: number;
    boxes: number;
    meters: number;
  };
  suggestedReorder: {
    units: number;
    boxes: number;
  };
}

// ==================== CRUD OPERATIONS ====================

/**
 * Create a new thread requirement for an order
 */
export async function createThreadRequirement(data: CreateThreadRequirementDto): Promise<OrderThreadRequirement> {
  // Fetch thread details
  const thread = await prisma.thread_master.findUnique({
    where: { id: data.threadId },
    include: { colorMaster: true },
  });

  if (!thread) {
    throw new Error(`Thread not found: ${data.threadId}`);
  }

  // Validate thread has required fields
  if (!thread.ply || !thread.materialComposition) {
    throw new Error(
      `Thread ${thread.threadCode} is missing ply or materialComposition. Please update the thread master.`
    );
  }

  // Validate color
  if (!thread.colorId || !thread.colorMaster) {
    throw new Error(`Thread ${thread.threadCode} is missing color. Please update the thread master.`);
  }

  // Calculate conversions
  const conversion = await processThreadQuantityInput(
    {
      inputType: data.inputType,
      unitsOrdered: data.unitsOrdered,
      boxesOrdered: data.boxesOrdered,
    },
    thread.ply,
    data.packagingType
  );

  // Calculate cost if unit price provided
  const totalCost = data.unitPrice ? conversion.totalUnits * data.unitPrice : undefined;

  // Get next sort order
  const maxSortOrder = await prisma.order_thread_requirements.aggregate({
    where: { orderId: data.orderId },
    _max: { sortOrder: true },
  });
  const nextSortOrder = (maxSortOrder._max.sortOrder || 0) + 1;

  // Create requirement
  const requirement = await prisma.order_thread_requirements.create({
    data: {
      orderId: data.orderId,
      threadId: data.threadId,
      ply: thread.ply,
      materialComposition: thread.materialComposition,
      colorId: thread.colorId,
      colorName: thread.colorMaster.colorName,
      packagingType: data.packagingType,
      inputType: data.inputType,
      unitsOrdered: data.unitsOrdered,
      boxesOrdered: data.boxesOrdered,
      totalUnits: conversion.totalUnits,
      totalBoxes: conversion.totalBoxes,
      totalMeters: conversion.totalMeters,
      unitPrice: data.unitPrice,
      totalCost: totalCost,
      notes: data.notes,
      sortOrder: nextSortOrder,
    },
    include: {
      thread: true,
      colorMaster: true,
    },
  });

  return mapToOrderThreadRequirement(requirement);
}

/**
 * Get all thread requirements for an order
 */
export async function getThreadRequirements(orderId: string): Promise<OrderThreadRequirement[]> {
  const requirements = await prisma.order_thread_requirements.findMany({
    where: { orderId },
    include: {
      thread: true,
      colorMaster: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  return requirements.map(mapToOrderThreadRequirement);
}

/**
 * Get a single thread requirement by ID
 */
export async function getThreadRequirement(id: string): Promise<OrderThreadRequirement | null> {
  const requirement = await prisma.order_thread_requirements.findUnique({
    where: { id },
    include: {
      thread: true,
      colorMaster: true,
    },
  });

  return requirement ? mapToOrderThreadRequirement(requirement) : null;
}

/**
 * Update a thread requirement
 */
export async function updateThreadRequirement(
  id: string,
  data: UpdateThreadRequirementDto
): Promise<OrderThreadRequirement> {
  const existing = await prisma.order_thread_requirements.findUnique({
    where: { id },
    include: { thread: true },
  });

  if (!existing) {
    throw new Error(`Thread requirement not found: ${id}`);
  }

  // If threadId changed, fetch new thread details
  // Note: thread_master doesn't have a colorMaster relation, so we fetch separately
  let thread: typeof existing.thread & { colorMasterData?: { colorName: string } | null } = existing.thread;
  if (data.threadId && data.threadId !== existing.threadId) {
    const newThread = await prisma.thread_master.findUnique({
      where: { id: data.threadId },
    });

    if (!newThread) {
      throw new Error(`Thread not found: ${data.threadId}`);
    }

    if (!newThread.ply || !newThread.materialComposition || !newThread.colorId) {
      throw new Error(`Thread ${newThread.threadCode} is missing required fields (ply, materialComposition, colorId)`);
    }

    // Fetch color_master separately since thread_master doesn't have the relation
    const colorMaster = newThread.colorId
      ? await prisma.color_master.findUnique({
          where: { id: newThread.colorId },
          select: { colorName: true },
        })
      : null;

    thread = { ...newThread, colorMasterData: colorMaster };
  }

  // Recalculate conversions if quantity or packaging changed
  let conversion = {
    totalUnits: parseFloat(existing.totalUnits.toString()),
    totalBoxes: parseFloat(existing.totalBoxes.toString()),
    totalMeters: parseFloat(existing.totalMeters.toString()),
  };

  const quantityChanged =
    data.inputType !== undefined ||
    data.unitsOrdered !== undefined ||
    data.boxesOrdered !== undefined ||
    data.packagingType !== undefined;

  if (quantityChanged) {
    const inputType = data.inputType || existing.inputType;
    const unitsOrdered =
      data.unitsOrdered !== undefined ? data.unitsOrdered : parseFloat(existing.unitsOrdered?.toString() || '0');
    const boxesOrdered =
      data.boxesOrdered !== undefined ? data.boxesOrdered : parseFloat(existing.boxesOrdered?.toString() || '0');
    const packagingType = data.packagingType || existing.packagingType;

    conversion = await processThreadQuantityInput(
      { inputType, unitsOrdered, boxesOrdered },
      thread.ply!,
      packagingType
    );
  }

  // Recalculate cost if unit price or quantity changed
  const unitPrice = data.unitPrice !== undefined ? data.unitPrice : parseFloat(existing.unitPrice?.toString() || '0');
  const totalCost = unitPrice > 0 ? conversion.totalUnits * unitPrice : undefined;

  // Update requirement
  const updated = await prisma.order_thread_requirements.update({
    where: { id },
    data: {
      ...(data.threadId && { threadId: data.threadId }),
      ...(data.threadId && thread.ply && { ply: thread.ply }),
      ...(data.threadId && thread.materialComposition && { materialComposition: thread.materialComposition }),
      ...(data.threadId && thread.colorId && { colorId: thread.colorId }),
      ...(data.threadId && thread.colorMasterData && { colorName: thread.colorMasterData.colorName }),
      ...(data.packagingType && { packagingType: data.packagingType }),
      ...(data.inputType && { inputType: data.inputType }),
      ...(data.unitsOrdered !== undefined && { unitsOrdered: data.unitsOrdered }),
      ...(data.boxesOrdered !== undefined && { boxesOrdered: data.boxesOrdered }),
      ...(quantityChanged && {
        totalUnits: conversion.totalUnits,
        totalBoxes: conversion.totalBoxes,
        totalMeters: conversion.totalMeters,
      }),
      ...(data.unitPrice !== undefined && { unitPrice: data.unitPrice }),
      ...((quantityChanged || data.unitPrice !== undefined) && { totalCost }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: {
      thread: true,
      colorMaster: true,
    },
  });

  return mapToOrderThreadRequirement(updated);
}

/**
 * Delete a thread requirement
 */
export async function deleteThreadRequirement(id: string): Promise<void> {
  await prisma.order_thread_requirements.delete({
    where: { id },
  });
}

// ==================== SHORTAGE DETECTION ====================

/**
 * Check stock shortages for all thread requirements in an order
 */
export async function checkShortages(orderId: string): Promise<ThreadShortage[]> {
  const requirements = await prisma.order_thread_requirements.findMany({
    where: { orderId },
    include: {
      thread: {
        include: {
          materials: true, // For stock lookup
        },
      },
      colorMaster: true,
    },
  });

  const shortages: ThreadShortage[] = [];

  for (const req of requirements) {
    // Get available stock
    // Note: This is a simplified version. In production, you'd sum across warehouses
    const materialId = req.thread.materials[0]?.id;
    let availableUnits = 0;

    if (materialId) {
      const stockLevels = await prisma.inventory_stock.findMany({
        where: { materialId },
      });

      availableUnits = stockLevels.reduce((sum, stock) => sum + parseFloat(stock.quantity.toString()), 0);
    }

    const requiredUnits = parseFloat(req.totalUnits.toString());
    const shortageUnits = Math.max(0, requiredUnits - availableUnits);

    if (shortageUnits > 0) {
      // Calculate shortage in all units
      const shortageBoxes =
        (shortageUnits / parseFloat(req.totalUnits.toString())) * parseFloat(req.totalBoxes.toString());
      const shortageMeters =
        (shortageUnits / parseFloat(req.totalUnits.toString())) * parseFloat(req.totalMeters.toString());

      // Calculate suggested reorder
      const suggestedBoxes = await calculateReorderQuantity(
        shortageUnits,
        req.ply,
        req.packagingType,
        0.1 // 10% buffer
      );

      shortages.push({
        threadId: req.threadId,
        threadCode: req.thread.threadCode,
        threadName: req.thread.threadName,
        ply: req.ply,
        materialComposition: req.materialComposition,
        colorName: req.colorName,
        packagingType: req.packagingType,
        required: {
          units: requiredUnits,
          boxes: parseFloat(req.totalBoxes.toString()),
          meters: parseFloat(req.totalMeters.toString()),
        },
        available: {
          units: availableUnits,
          boxes: (availableUnits / parseFloat(req.totalUnits.toString())) * parseFloat(req.totalBoxes.toString()),
          meters: (availableUnits / parseFloat(req.totalUnits.toString())) * parseFloat(req.totalMeters.toString()),
        },
        shortage: {
          units: shortageUnits,
          boxes: shortageBoxes,
          meters: shortageMeters,
        },
        suggestedReorder: {
          units: suggestedBoxes * (req.packagingType === 'SPOOL' && req.ply === 'THREE_PLY' ? 15 : 10), // Rough calculation
          boxes: suggestedBoxes,
        },
      });
    }
  }

  return shortages;
}

// ==================== SKU GENERATION ====================

/**
 * Generate style-specific SKU for a thread requirement
 * Pattern: THR-{StyleCode}-{Ply}-{Material}-{ColorCode}
 * Example: THR-NK201-3PLY-POLY-RED
 */
export async function generateStyleSpecificSKU(threadId: string, orderId: string): Promise<string> {
  const thread = await prisma.thread_master.findUnique({
    where: { id: threadId },
    include: { colorMaster: true },
  });

  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      order_items: {
        include: { styles: true },
        take: 1, // Get first style for SKU generation
      },
    },
  });

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const styleCode = order.order_items[0]?.styles?.styleCode || order.orderNumber;
  const plyLabel = thread.ply === 'THREE_PLY' ? '3PLY' : '2PLY';
  const materialLabel = thread.materialComposition === 'POLYESTER' ? 'POLY' : 'COTTON';
  const colorCode = thread.colorMaster?.colorCode || 'UNK';

  return `THR-${styleCode}-${plyLabel}-${materialLabel}-${colorCode}`;
}

// ==================== CROSS-ORDER QUERIES ====================

/**
 * Get all thread requirements across orders (for UnifiedRequirementsPage)
 */
export async function getAllRequirements(params: ThreadRequirementQueryParams) {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.orderId) {
    where.orderId = params.orderId;
  }

  if (params.search) {
    where.OR = [
      { thread: { threadCode: { contains: params.search, mode: 'insensitive' } } },
      { thread: { threadName: { contains: params.search, mode: 'insensitive' } } },
      { colorName: { contains: params.search, mode: 'insensitive' } },
      { order: { orderNumber: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  const [requirements, total] = await Promise.all([
    prisma.order_thread_requirements.findMany({
      where,
      include: {
        thread: true,
        colorMaster: true,
        order: { select: { id: true, orderNumber: true } },
        supplier: { select: { id: true, name: true } },
        poItem: { select: { id: true, poId: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.order_thread_requirements.count({ where }),
  ]);

  return {
    data: requirements.map(mapToOrderThreadRequirement),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get dashboard stats for thread requirements
 */
export async function getStats() {
  const [total, pending, poGenerated, received, cancelled] = await Promise.all([
    prisma.order_thread_requirements.count(),
    prisma.order_thread_requirements.count({ where: { status: 'PENDING' } }),
    prisma.order_thread_requirements.count({ where: { status: 'PO_GENERATED' } }),
    prisma.order_thread_requirements.count({ where: { status: 'RECEIVED' } }),
    prisma.order_thread_requirements.count({ where: { status: 'CANCELLED' } }),
  ]);

  return { total, pending, poGenerated, received, cancelled };
}

// ==================== PO GENERATION ====================

/**
 * Ensure a materials record exists for a thread_master entry (for PO linking)
 */
async function ensureMaterialForThread(threadId: string): Promise<string | null> {
  const existing = await prisma.materials.findFirst({ where: { threadId } });
  if (existing) return existing.id;

  const thread = await prisma.thread_master.findUnique({
    where: { id: threadId },
    select: { id: true, threadCode: true, threadName: true, supplierId: true },
  });
  if (!thread) return null;

  const material = await materialService.createFromMaster(
    { id: thread.id, code: thread.threadCode, name: thread.threadName },
    'THREAD'
  );

  return material.id;
}

/**
 * Map ThreadPackagingType to Unit enum for PO items
 */
function packagingTypeToUnit(packagingType: ThreadPackagingType): Unit {
  switch (packagingType) {
    case 'SPOOL':
      return 'SPOOL' as Unit;
    case 'CONE':
    case 'CONE_5K':
    case 'CONE_10K':
      return 'CONE' as Unit;
    case 'TUBE':
      return 'TUBE' as Unit;
    default:
      return 'PIECE' as Unit;
  }
}

/**
 * Generate PO from selected thread requirements
 * Each requirement row becomes one PO item
 */
export async function generatePOFromRequirements(input: GenerateThreadPOInput) {
  // Fetch all selected requirements
  const requirements = await prisma.order_thread_requirements.findMany({
    where: {
      id: { in: input.requirementIds },
      status: 'PENDING',
    },
    include: {
      thread: { include: { threadSuppliers: true } },
      order: { select: { orderNumber: true } },
    },
  });

  if (requirements.length === 0) {
    throw new Error('No pending thread requirements found for the given IDs');
  }

  // Validate supplier is valid for these threads
  const supplier = await prisma.suppliers.findUnique({
    where: { id: input.supplierId },
    select: { id: true, name: true, isActive: true },
  });

  if (!supplier || !supplier.isActive) {
    throw new Error('Supplier not found or inactive');
  }

  // Check supplier is linked to each thread via thread_suppliers
  for (const req of requirements) {
    const isLinked = req.thread.threadSuppliers.some((ts) => ts.supplierId === input.supplierId && ts.isActive);
    if (!isLinked) {
      throw new Error(
        `Supplier "${supplier.name}" is not linked to thread "${req.thread.threadCode}". ` +
          `Please add this supplier in the Thread Master first.`
      );
    }
  }

  // Build PO items — one per requirement row
  const poItems = [];
  for (const req of requirements) {
    const materialId = await ensureMaterialForThread(req.threadId);
    if (!materialId) {
      throw new Error(`Failed to resolve material for thread: ${req.thread.threadCode}`);
    }

    // Get supplier-specific price if available, otherwise use requirement's unitPrice
    const threadSupplier = req.thread.threadSuppliers.find((ts) => ts.supplierId === input.supplierId);
    const unitPrice =
      parseFloat(req.unitPrice?.toString() || '0') ||
      parseFloat(threadSupplier?.pricePerCone?.toString() || '0') ||
      parseFloat(req.thread.pricePerCone?.toString() || '0');

    const orderedQuantity = parseFloat(req.totalUnits.toString());
    const unit = packagingTypeToUnit(req.packagingType);

    poItems.push({
      materialId,
      orderedQuantity,
      unit,
      unitPrice,
      remarks:
        `${req.thread.threadCode} - ${req.colorName} ${req.ply} ${req.materialComposition} (${req.packagingType})` +
        (req.notes ? ` | ${req.notes}` : ''),
    });
  }

  // Create PO via unified service
  const poInput: UnifiedPOCreationInput = {
    supplierId: input.supplierId,
    expectedDeliveryDate: input.expectedDeliveryDate,
    createdById: input.createdById,
    source: 'MRP' as POSource,
    poCategory: 'THREAD' as POCategory,
    items: poItems,
    remarks:
      input.remarks || `Thread PO for orders: ${[...new Set(requirements.map((r) => r.order.orderNumber))].join(', ')}`,
  };

  const result = await createUnifiedPO(poInput);

  // Update requirement statuses and link PO items
  const poItemIds = result.purchaseOrder.purchase_order_items.map((item) => item.id);
  for (let i = 0; i < requirements.length; i++) {
    await prisma.order_thread_requirements.update({
      where: { id: requirements[i].id },
      data: {
        status: 'PO_GENERATED',
        supplierId: input.supplierId,
        poItemId: poItemIds[i] || null,
      },
    });
  }

  return {
    purchaseOrder: result.purchaseOrder,
    updatedRequirements: requirements.length,
  };
}

/**
 * Get suppliers available for a set of thread requirements
 * Returns suppliers that are linked to ALL threads in the selection
 */
export async function getAvailableSuppliers(requirementIds: string[]) {
  const requirements = await prisma.order_thread_requirements.findMany({
    where: { id: { in: requirementIds } },
    select: { threadId: true },
  });

  const threadIds = [...new Set(requirements.map((r) => r.threadId))];

  // Find suppliers linked to ALL threads
  const supplierCounts = await prisma.thread_suppliers.groupBy({
    by: ['supplierId'],
    where: {
      threadId: { in: threadIds },
      isActive: true,
    },
    _count: { supplierId: true },
    having: {
      supplierId: { _count: { equals: threadIds.length } },
    },
  });

  const supplierIds = supplierCounts.map((s) => s.supplierId);

  const suppliers = await prisma.suppliers.findMany({
    where: { id: { in: supplierIds }, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });

  return suppliers;
}

// ==================== HELPER FUNCTIONS ====================

function mapToOrderThreadRequirement(data: any): OrderThreadRequirement {
  return {
    id: data.id,
    orderId: data.orderId,
    threadId: data.threadId,
    threadName: data.thread?.threadName || '',
    threadCode: data.thread?.threadCode || '',
    ply: data.ply,
    materialComposition: data.materialComposition,
    colorId: data.colorId,
    colorName: data.colorName,
    packagingType: data.packagingType,
    inputType: data.inputType,
    unitsOrdered: data.unitsOrdered ? parseFloat(data.unitsOrdered.toString()) : undefined,
    boxesOrdered: data.boxesOrdered ? parseFloat(data.boxesOrdered.toString()) : undefined,
    totalUnits: parseFloat(data.totalUnits.toString()),
    totalBoxes: parseFloat(data.totalBoxes.toString()),
    totalMeters: parseFloat(data.totalMeters.toString()),
    unitPrice: data.unitPrice ? parseFloat(data.unitPrice.toString()) : undefined,
    totalCost: data.totalCost ? parseFloat(data.totalCost.toString()) : undefined,
    status: data.status,
    supplierId: data.supplierId || undefined,
    supplierName: data.supplier?.name || undefined,
    poItemId: data.poItemId || undefined,
    orderNumber: data.order?.orderNumber || undefined,
    notes: data.notes,
    sortOrder: data.sortOrder,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

// ==================== EXPORTS ====================

export default {
  createThreadRequirement,
  getThreadRequirements,
  getThreadRequirement,
  updateThreadRequirement,
  deleteThreadRequirement,
  checkShortages,
  generateStyleSpecificSKU,
  getAllRequirements,
  getStats,
  generatePOFromRequirements,
  getAvailableSuppliers,
};
