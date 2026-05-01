/**
 * Fabric Procurement Controller
 *
 * Handles fabric procurement operations including:
 * - Planning procurement based on order requirements
 * - Creating procurement orders (greige/finished)
 * - Tracking procurement status
 * - Recording receipts
 */

import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';

// ============================================
// Types for Fabric Procurement Controller
// ============================================

interface FabricRequirement {
  orderId: string;
  orderNumber: string;
  styleId: string;
  styleCode: string;
  materialType: string;
  greigeId: string | null;
  fabricId: string | null;
  fabricName: string | null | undefined;
  quantityRequired: number;
  existingStock: number;
  shortfall: number;
  suggestedProcurement: number;
  unit: string;
  estimatedCost: number;
}

// Validation schemas
const CreateProcurementSchema = z.object({
  procurementType: z.enum(['GREIGE', 'FINISHED']),
  purchaseOrderNumber: z.string().optional(),
  supplierId: z.string().uuid(),
  greigeId: z.string().uuid().optional(),
  fabricId: z.string().uuid().optional(),
  quantityPurchased: z.number().positive(),
  unit: z.string().default('meters'),
  width: z.number().positive(),
  ratePerUnit: z.number().positive(),
  totalCost: z.number().positive(),

  // Origin tracking
  orderedForStyleId: z.string().uuid().optional(),
  orderedForOrderId: z.string().uuid().optional(),
  isStockPurchase: z.boolean().default(false),

  // Processing details (for greige)
  processingRequired: z.boolean().default(false),
  processingType: z.string().optional(),
  processingColor: z.string().optional(),
  processedFabricId: z.string().uuid().optional(),
  processingMoq: z.number().optional(),

  expectedDelivery: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const UpdateProcurementSchema = z.object({
  status: z.enum(['ORDERED', 'CONFIRMED', 'IN_TRANSIT', 'RECEIVED', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
  receivedDate: z.string().datetime().optional(),
  actualQuantityReceived: z.number().positive().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/procurement
 * Get all fabric procurement records with filters
 */
export const getProcurements = async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 50,
    search,
    procurementType,
    status,
    supplierId,
    styleId,
    orderId,
    isStockPurchase,
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  // Build where clause
  const where: Prisma.fabric_procurementWhereInput = {};

  if (search) {
    where.OR = [{ purchaseOrderNumber: { contains: search as string, mode: 'insensitive' } }];
  }

  if (procurementType) {
    where.procurementType = procurementType as 'GREIGE' | 'FINISHED';
  }

  if (status) {
    where.status = status as string;
  }

  if (supplierId) {
    where.supplierId = supplierId as string;
  }

  if (styleId) {
    where.orderedForStyleId = styleId as string;
  }

  if (orderId) {
    where.orderedForOrderId = orderId as string;
  }

  if (isStockPurchase !== undefined) {
    where.isStockPurchase = isStockPurchase === 'true';
  }

  const [procurements, total] = await Promise.all([
    prisma.fabric_procurement.findMany({
      where,
      include: {
        greigeMaster: true,
        fabricMaster: true,
        processedFabric: true,
        supplier: true,
        styleOrigin: {
          select: { styleCode: true, styleName: true },
        },
        orderOrigin: {
          select: { orderNumber: true },
        },
        fabricStock: true,
        fabricProcessing: true,
      },
      orderBy: { purchaseDate: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.fabric_procurement.count({ where }),
  ]);

  res.json({
    success: true,
    data: procurements,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
};

/**
 * GET /api/procurement/:id
 * Get single procurement record by ID
 */
export const getProcurementById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const procurement = await prisma.fabric_procurement.findUnique({
    where: { id },
    include: {
      greigeMaster: true,
      fabricMaster: true,
      processedFabric: true,
      supplier: true,
      styleOrigin: true,
      orderOrigin: true,
      fabricStock: true,
      fabricProcessing: true,
      qualityInspections: true,
    },
  });

  if (!procurement) {
    throw new NotFoundError('Procurement record', id);
  }

  res.json({
    success: true,
    data: procurement,
  });
};

/**
 * POST /api/procurement
 * Create new fabric procurement order
 */
export const createProcurement = async (req: Request, res: Response) => {
  const validatedData = CreateProcurementSchema.parse(req.body);
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  // Validate procurement type matches provided IDs
  if (validatedData.procurementType === 'GREIGE' && !validatedData.greigeId) {
    throw new ValidationError('greigeId is required for GREIGE procurement');
  }

  if (validatedData.procurementType === 'FINISHED' && !validatedData.fabricId) {
    throw new ValidationError('fabricId is required for FINISHED procurement');
  }

  // Generate PO number if not provided
  const purchaseOrderNumber = validatedData.purchaseOrderNumber || `PO-${Date.now()}-${validatedData.procurementType}`;

  const procurement = await prisma.fabric_procurement.create({
    data: {
      ...validatedData,
      purchaseOrderNumber,
      expectedDelivery: validatedData.expectedDelivery ? new Date(validatedData.expectedDelivery) : undefined,
      createdById: userId,
    },
    include: {
      greigeMaster: true,
      fabricMaster: true,
      supplier: true,
      styleOrigin: true,
      orderOrigin: true,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Procurement order created successfully',
    data: procurement,
  });
};

/**
 * PUT /api/procurement/:id
 * Update procurement record (status, receipt, etc.)
 */
export const updateProcurement = async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = UpdateProcurementSchema.parse(req.body);

  const existing = await prisma.fabric_procurement.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Procurement record', id);
  }

  const procurement = await prisma.fabric_procurement.update({
    where: { id },
    data: {
      ...validatedData,
      receivedDate: validatedData.receivedDate ? new Date(validatedData.receivedDate) : undefined,
    },
    include: {
      greigeMaster: true,
      fabricMaster: true,
      supplier: true,
      fabricStock: true,
      fabricProcessing: true,
    },
  });

  res.json({
    success: true,
    message: 'Procurement updated successfully',
    data: procurement,
  });
};

/**
 * POST /api/procurement/plan
 * Plan procurement based on order requirements
 * Analyzes orders and suggests fabric procurement
 */
export const planProcurement = async (req: Request, res: Response) => {
  const { orderId, styleId } = req.body;

  if (!orderId && !styleId) {
    throw new ValidationError('Either orderId or styleId is required');
  }

  // Get order details with BOM
  const orders = await prisma.orders.findMany({
    where: orderId ? { id: orderId } : { order_items: { some: { styleId } } },
    include: {
      order_items: {
        include: {
          styles: {
            include: {
              order_boms: {
                include: {
                  items: {
                    where: {
                      materialType: { in: ['GREIGE', 'FABRIC'] },
                    },
                    include: {
                      material: {
                        include: {
                          greige_master: true,
                          fabric_master: {
                            include: {
                              greige: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Calculate fabric requirements
  const requirements: FabricRequirement[] = [];

  for (const order of orders) {
    for (const item of order.order_items) {
      if (!item.styles.order_boms || item.styles.order_boms.length === 0) {
        continue;
      }

      for (const bom of item.styles.order_boms) {
        for (const bomItem of bom.items) {
          const material = bomItem.material;

          if (!material || !['GREIGE', 'FABRIC'].includes(material.materialType)) {
            continue;
          }

          // Calculate quantity needed
          const quantityPerUnit = Number(bomItem.quantityPerGarment);
          const wastagePercent = Number(bomItem.wastagePercent) || 0; // No hardcoded default - 0 indicates not configured
          const orderQuantity = item.totalQuantity;

          const rawQuantity = quantityPerUnit * orderQuantity;
          const wastageQuantity = rawQuantity * (wastagePercent / 100);
          const totalQuantity = rawQuantity + wastageQuantity;

          // Check existing stock
          const availableStock = await prisma.fabric_stock.aggregate({
            where: {
              fabricId: material.fabricId || undefined,
              status: 'AVAILABLE',
            },
            _sum: {
              quantityAvailable: true,
            },
          });

          const existingQuantity = Number(availableStock._sum.quantityAvailable) || 0;
          const shortfall = Math.max(0, totalQuantity - existingQuantity);

          requirements.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            styleId: item.styles.id,
            styleCode: item.styles.styleCode,
            materialType: material.materialType,
            greigeId: material.greigeId,
            fabricId: material.fabricId,
            fabricName: material.fabric_master?.fabricName || material.greige_master?.greigeName,
            quantityRequired: totalQuantity,
            existingStock: existingQuantity,
            shortfall,
            suggestedProcurement: shortfall > 0 ? Math.ceil(shortfall) : 0,
            unit: bomItem.unit,
            estimatedCost: shortfall * Number(bomItem.unitPrice || 0),
          });
        }
      }
    }
  }

  res.json({
    success: true,
    data: {
      orders,
      requirements,
      summary: {
        totalOrders: orders.length,
        totalRequirements: requirements.length,
        totalShortfall: requirements.reduce((sum, r) => sum + r.shortfall, 0),
        totalEstimatedCost: requirements.reduce((sum, r) => sum + r.estimatedCost, 0),
      },
    },
  });
};

/**
 * DELETE /api/procurement/:id
 * Delete procurement record (only if not received)
 */
export const deleteProcurement = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.fabric_procurement.findUnique({
    where: { id },
    include: {
      fabricStock: true,
      fabricProcessing: true,
    },
  });

  if (!existing) {
    throw new NotFoundError('Procurement record', id);
  }

  // Prevent deletion if stock or processing exists
  if (existing.fabricStock.length > 0 || existing.fabricProcessing.length > 0) {
    throw new ValidationError('Cannot delete procurement with associated stock or processing records');
  }

  // Only allow deletion of pending/ordered status
  if (!['ORDERED', 'CONFIRMED', 'CANCELLED'].includes(existing.status)) {
    throw new ValidationError('Can only delete procurement orders that are ORDERED, CONFIRMED, or CANCELLED');
  }

  await prisma.fabric_procurement.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Procurement record deleted successfully',
  });
};
