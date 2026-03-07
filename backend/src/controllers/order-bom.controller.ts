/**
 * Order BOM Controller - Thin HTTP layer
 * Delegates all business logic to orderBomService
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { OrderBOMStatus } from '../types/order-bom.types';
import { orderBomService } from '../services/order-bom.service';
import { logError } from '../utils/logger';
import { ValidationError, ConflictError, NotFoundError, BusinessError } from '../errors';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const MaterialTypeEnum = z.enum([
  'BUTTON',
  'THREAD',
  'ZIPPER',
  'LACE',
  'ELASTIC',
  'LABEL',
  'PACKAGING',
  'FABRIC',
  'GENERIC',
]);

const UsageCategoryEnum = z.enum([
  'GARMENT_TRIM',
  'PACKAGING',
  'VALUE_ADDITION',
  'FABRIC',
]);

const OrderBOMItemSchema = z.object({
  materialType: MaterialTypeEnum,
  materialId: z.string().uuid().optional(),
  buttonId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  zipperId: z.string().uuid().optional(),
  laceId: z.string().uuid().optional(),
  elasticId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  packagingId: z.string().uuid().optional(),
  fabricId: z.string().uuid().optional(),
  quantityPerGarment: z.number().nonnegative('Quantity must be non-negative'),
  orderQuantity: z.number().int().positive('Order quantity must be positive'),
  wastagePercent: z.number().min(0).max(100).optional(),
  unit: z.string().min(1, 'Unit is required'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  componentName: z.string().optional(),
  usageCategory: UsageCategoryEnum.optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

const CreateFromCostSheetSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  costSheetId: z.string().min(1, 'Cost sheet ID is required'),  // Cost sheets use CS-TIMESTAMP format, not UUID
  orderItemId: z.string().uuid().optional(),
});

const CopyFromOrderSchema = z.object({
  sourceOrderId: z.string().uuid('Invalid source order ID'),
  styleId: z.string().uuid('Invalid style ID'),
  orderItemId: z.string().uuid().optional(),
  adjustQuantity: z.number().int().positive().optional(),
});

const UpdateOrderBOMSchema = z.object({
  items: z.array(OrderBOMItemSchema).min(1, 'At least one BOM item is required'),
});

// ============================================
// CONTROLLER METHODS
// ============================================

/**
 * Create Order BOM from approved Cost Sheet
 * POST /api/orders/:orderId/bom
 */
export const createFromCostSheet = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const validatedData = CreateFromCostSheetSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const bom = await orderBomService.createFromCostSheet({
      orderId,
      styleId: validatedData.styleId,
      costSheetId: validatedData.costSheetId,
      orderItemId: validatedData.orderItemId,
      createdById: userId,
    });

    res.status(201).json({
      success: true,
      data: bom,
      message: `Order BOM version ${bom.version} created successfully`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to create Order BOM from Cost Sheet');
  }
};

/**
 * Copy Order BOM from previous order (repeat orders)
 * POST /api/orders/:orderId/bom/copy/:sourceOrderId
 */
export const copyFromPreviousOrder = async (req: Request, res: Response) => {
  try {
    const { orderId, sourceOrderId } = req.params;
    const validatedData = CopyFromOrderSchema.parse({
      ...req.body,
      sourceOrderId,
    });
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const bom = await orderBomService.copyFromPreviousOrder({
      targetOrderId: orderId,
      sourceOrderId: validatedData.sourceOrderId,
      styleId: validatedData.styleId,
      orderItemId: validatedData.orderItemId,
      adjustQuantity: validatedData.adjustQuantity,
      createdById: userId,
    });

    res.status(201).json({
      success: true,
      data: bom,
      message: `Order BOM copied from order ${sourceOrderId}`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to copy Order BOM');
  }
};

/**
 * Get Order BOM by order ID
 * GET /api/orders/:orderId/bom
 */
export const getByOrderId = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { styleId } = req.query;

    const bom = await orderBomService.getByOrderId(orderId, styleId as string);

    if (!bom) {
      return res.status(404).json({
        success: false,
        error: 'No active Order BOM found for this order',
      });
    }

    res.json({
      success: true,
      data: bom,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get Order BOM');
  }
};

/**
 * Get Order BOM by ID with full details
 * GET /api/order-bom/:id
 */
export const getById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bom = await orderBomService.getFullDetails(id);

    res.json({
      success: true,
      data: bom,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get Order BOM details');
  }
};

/**
 * List all Order BOMs with filtering
 * GET /api/order-bom
 */
export const listOrderBOMs = async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      styleId,
      status,
      isActive,
      page = '1',
      limit = '20',
    } = req.query;

    const result = await orderBomService.findAllWithFilters({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      orderId: orderId as string,
      styleId: styleId as string,
      status: status as OrderBOMStatus | undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    handleError(res, error, 'Failed to list Order BOMs');
  }
};

/**
 * Update Order BOM items (only DRAFT status)
 * PUT /api/orders/:orderId/bom
 */
export const updateOrderBOM = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { styleId } = req.query;
    const validatedData = UpdateOrderBOMSchema.parse(req.body);

    // Get the active BOM for this order
    const existingBOM = await orderBomService.getByOrderId(orderId, styleId as string);

    if (!existingBOM) {
      return res.status(404).json({
        success: false,
        error: 'No active Order BOM found for this order',
      });
    }

    const updatedBOM = await orderBomService.updateItems(existingBOM.id, {
      items: validatedData.items,
    });

    res.json({
      success: true,
      data: updatedBOM,
      message: 'Order BOM updated successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to update Order BOM');
  }
};

/**
 * Approve Order BOM
 * PATCH /api/orders/:orderId/bom/approve
 */
export const approveOrderBOM = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { styleId } = req.query;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Get the active BOM for this order
    const existingBOM = await orderBomService.getByOrderId(orderId, styleId as string);

    if (!existingBOM) {
      return res.status(404).json({
        success: false,
        error: 'No active Order BOM found for this order',
      });
    }

    const approvedBOM = await orderBomService.approve(existingBOM.id, {
      approvedById: userId,
    });

    res.json({
      success: true,
      data: approvedBOM,
      message: 'Order BOM approved successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to approve Order BOM');
  }
};

/**
 * Approve Order BOM and optionally calculate MRP
 * POST /api/orders/:orderId/bom/approve-and-calculate
 */
export const approveAndCalculateMRP = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { styleId, calculateMRP = true, calculateServices = true, requiredDate } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Get the active BOM for this order
    const existingBOM = await orderBomService.getByOrderId(orderId, styleId);

    if (!existingBOM) {
      return res.status(404).json({
        success: false,
        error: 'No active Order BOM found for this order',
      });
    }

    // Step 1: Approve BOM
    const approvedBOM = await orderBomService.approve(existingBOM.id, {
      approvedById: userId,
    });

    // Step 2: Optionally calculate MRP
    let mrpResult = null;
    let mrpError = null;

    if (calculateMRP) {
      try {
        const { calculateRequirementsFromOrder } = await import('../services/mrp.service');

        // Use requiredDate from request or default to order's expectedDeliveryDate
        const order = await import('../config/database').then(db =>
          db.default.orders.findUnique({
            where: { id: orderId },
            select: { expectedDeliveryDate: true },
          })
        );

        const finalRequiredDate = requiredDate || order?.expectedDeliveryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default: 30 days from now

        mrpResult = await calculateRequirementsFromOrder(
          {
            orderId,
            orderItemId: undefined, // Calculate for all items
            requiredDate: finalRequiredDate,
            checkStock: true,
          },
          userId
        );
      } catch (error) {
        // Log error but don't fail the approval
        logError('MRP calculation failed during BOM approval:', error);
        mrpError = error instanceof Error ? error.message : 'Failed to calculate MRP';
      }
    }

    // Step 3: Optionally calculate service requirements for all work orders
    let serviceResult = null;
    let serviceError = null;

    if (calculateServices) {
      try {
        const { calculateServicesForOrder } = await import(
          '../services/work-order-service-requirement.service'
        );

        serviceResult = await calculateServicesForOrder(orderId, userId);
      } catch (error) {
        logError('Service requirement calculation failed during BOM approval:', error);
        serviceError = error instanceof Error ? error.message : 'Failed to calculate service requirements';
      }
    }

    // Build response message
    const messageParts: string[] = ['Order BOM approved'];
    if (mrpResult) {
      messageParts.push(`${mrpResult.created + mrpResult.updated} material requirements calculated`);
    } else if (mrpError) {
      messageParts.push(`MRP calculation failed: ${mrpError}`);
    }
    if (serviceResult) {
      messageParts.push(`${serviceResult.totalServicesCreated} service requirements calculated for ${serviceResult.workOrdersProcessed} work order(s)`);
    } else if (serviceError) {
      messageParts.push(`Service calculation failed: ${serviceError}`);
    }

    res.json({
      success: true,
      data: {
        bom: approvedBOM,
        mrp: mrpResult,
        mrpCalculated: calculateMRP && mrpResult !== null,
        mrpError: mrpError,
        services: serviceResult,
        servicesCalculated: calculateServices && serviceResult !== null,
        serviceError: serviceError,
      },
      message: messageParts.join('. '),
    });
  } catch (error) {
    handleError(res, error, 'Failed to approve Order BOM and calculate MRP');
  }
};

/**
 * Calculate MRP for approved Order BOM (standalone trigger)
 * POST /api/orders/:orderId/bom/calculate-mrp
 */
export const calculateMRPStandalone = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { styleId, requiredDate } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Get the active BOM for this order
    const existingBOM = await orderBomService.getByOrderId(orderId, styleId);

    if (!existingBOM) {
      return res.status(404).json({
        success: false,
        error: 'No active Order BOM found for this order',
      });
    }

    // Ensure BOM is approved
    if (existingBOM.status !== 'APPROVED' && existingBOM.status !== 'LOCKED') {
      return res.status(422).json({
        success: false,
        error: 'Order BOM must be approved before calculating MRP',
      });
    }

    // Calculate MRP
    const { calculateRequirementsFromOrder } = await import('../services/mrp.service');

    // Use requiredDate from request or default to order's expectedDeliveryDate
    const order = await import('../config/database').then(db =>
      db.default.orders.findUnique({
        where: { id: orderId },
        select: { expectedDeliveryDate: true },
      })
    );

    const finalRequiredDate = requiredDate || order?.expectedDeliveryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const mrpResult = await calculateRequirementsFromOrder(
      {
        orderId,
        orderItemId: undefined, // Calculate for all items
        requiredDate: finalRequiredDate,
        checkStock: true,
      },
      userId
    );

    res.json({
      success: true,
      data: mrpResult,
      message: `${mrpResult.created + mrpResult.updated} material requirements calculated (${mrpResult.created} created, ${mrpResult.updated} updated)`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to calculate MRP');
  }
};

/**
 * Lock Order BOM for production
 * PATCH /api/orders/:orderId/bom/lock
 */
export const lockOrderBOM = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { styleId } = req.query;

    // Get the active BOM for this order
    const existingBOM = await orderBomService.getByOrderId(orderId, styleId as string);

    if (!existingBOM) {
      return res.status(404).json({
        success: false,
        error: 'No active Order BOM found for this order',
      });
    }

    const lockedBOM = await orderBomService.lock(existingBOM.id);

    res.json({
      success: true,
      data: lockedBOM,
      message: 'Order BOM locked for production',
    });
  } catch (error) {
    handleError(res, error, 'Failed to lock Order BOM');
  }
};

/**
 * Calculate material requirements from Order BOM
 * GET /api/orders/:orderId/bom/requirements
 */
export const calculateRequirements = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { styleId } = req.query;

    // Get the active BOM for this order
    const existingBOM = await orderBomService.getByOrderId(orderId, styleId as string);

    if (!existingBOM) {
      return res.status(404).json({
        success: false,
        error: 'No active Order BOM found for this order',
      });
    }

    const requirements = await orderBomService.calculateRequirements(existingBOM.id);

    res.json({
      success: true,
      data: requirements,
    });
  } catch (error) {
    handleError(res, error, 'Failed to calculate material requirements');
  }
};

/**
 * Deactivate Order BOM
 * DELETE /api/orders/:orderId/bom
 */
export const deactivateOrderBOM = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { styleId } = req.query;

    // Get the active BOM for this order
    const existingBOM = await orderBomService.getByOrderId(orderId, styleId as string);

    if (!existingBOM) {
      return res.status(404).json({
        success: false,
        error: 'No active Order BOM found for this order',
      });
    }

    await orderBomService.deactivate(existingBOM.id);

    res.json({
      success: true,
      message: 'Order BOM deactivated successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to deactivate Order BOM');
  }
};

/**
 * Change fabric width on Order BOM (creates new version)
 * POST /api/order-bom/:id/change-width
 */
const ChangeWidthSchema = z.object({
  fabricItemChanges: z.array(
    z.object({
      bomItemId: z.string().uuid('Invalid BOM item ID'),
      newCadId: z.string().uuid('Invalid CAD ID'),
    })
  ).min(1, 'At least one fabric item change is required'),
});

export const changeWidth = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = ChangeWidthSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const newBom = await orderBomService.createVersionWithWidthChange({
      orderBomId: id,
      fabricItemChanges: validatedData.fabricItemChanges,
      userId,
    });

    res.status(201).json({
      success: true,
      data: newBom,
      message: `New BOM version ${newBom.version} created with updated fabric width`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to change fabric width');
  }
};

/**
 * Cleanup BOMs for cancelled orders
 * POST /api/order-bom/cleanup-cancelled
 */
export const cleanupCancelledOrderBOMs = async (req: Request, res: Response) => {
  try {
    const result = await orderBomService.cleanupBomsForCancelledOrders();

    res.json({
      success: true,
      data: result,
      message: `Cleanup complete: ${result.deactivatedCount} BOM(s) deactivated for cancelled orders`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to cleanup BOMs for cancelled orders');
  }
};

// ============================================
// ERROR HANDLER
// ============================================

function handleError(res: Response, error: unknown, defaultMessage: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.issues.map((e: z.ZodIssue) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  if (error instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      error: error.message,
    });
  }

  if (error instanceof BusinessError) {
    return res.status(422).json({
      success: false,
      error: error.message,
    });
  }

  if (error instanceof ConflictError) {
    return res.status(409).json({
      success: false,
      error: error.message,
    });
  }

  logError(`${defaultMessage}:`, error);
  return res.status(500).json({
    success: false,
    error: defaultMessage,
  });
}
