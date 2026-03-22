/**
 * Order Thread Requirement Service
 *
 * Manages order-level thread requirements:
 * - CRUD operations for thread requirements
 * - Automatic quantity conversions
 * - Shortage detection
 * - Style-specific SKU generation
 */

import { PrismaClient, ThreadPly, ThreadMaterial, ThreadPackagingType, ThreadQuantityInput } from '@prisma/client';
import { processThreadQuantityInput, calculateReorderQuantity } from './thread-conversion.service';

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
  notes?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
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

// ==================== HELPER FUNCTIONS ====================

function mapToOrderThreadRequirement(data: any): OrderThreadRequirement {
  return {
    id: data.id,
    orderId: data.orderId,
    threadId: data.threadId,
    threadName: data.thread.threadName,
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
};
