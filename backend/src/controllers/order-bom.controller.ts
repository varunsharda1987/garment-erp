/**
 * Order BOM Controller - Thin HTTP layer
 * Delegates all business logic to orderBomService
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { OrderBOMStatus } from '../types/order-bom.types';
import { orderBomService } from '../services/order-bom.service';
import workOrderService from '../services/workOrder.service';
import { logError } from '../utils/logger';
import { NotFoundError, UnauthorizedError, BusinessError } from '../errors';
import type { CreateFromCostSheetInput, UpdateOrderBOMInput, ChangeWidthInput } from '../schemas/orderBom.schema';

// ============================================
// VALIDATION SCHEMAS
// ============================================
// NOTE: Body validation lives in backend/src/schemas/orderBom.schema.ts and is
// applied at the route via validateBody() (see order-bom.routes.ts). Do NOT
// re-declare or re-parse body schemas here — req.body is already validated/typed.

const CopyFromOrderSchema = z.object({
  sourceOrderId: z.string().uuid('Invalid source order ID'),
  styleId: z.string().uuid('Invalid style ID'),
  orderItemId: z.string().uuid().optional(),
  adjustQuantity: z.number().int().positive().optional(),
});

// ============================================
// CONTROLLER METHODS
// ============================================

/**
 * Create Order BOM from approved Cost Sheet
 * POST /api/orders/:orderId/bom
 */
export const createFromCostSheet = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const validatedData = req.body as CreateFromCostSheetInput;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
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
  // end createFromCostSheet
};

/**
 * Copy Order BOM from previous order (repeat orders)
 * POST /api/orders/:orderId/bom/copy/:sourceOrderId
 */
export const copyFromPreviousOrder = async (req: Request, res: Response) => {
  const { orderId, sourceOrderId } = req.params;
  const validatedData = CopyFromOrderSchema.parse({
    ...req.body,
    sourceOrderId,
  });
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
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
  // end copyFromPreviousOrder
};

/**
 * Get Order BOM by order ID
 * GET /api/orders/:orderId/bom
 */
export const getByOrderId = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { styleId } = req.query;

  const bom = await orderBomService.getByOrderId(orderId, styleId as string);

  if (!bom) {
    throw new NotFoundError('Order BOM', 'this order');
  }

  res.json({
    success: true,
    data: bom,
  });
  // end getByOrderId
};

/**
 * Get Order BOM by ID with full details
 * GET /api/order-bom/:id
 */
export const getById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const bom = await orderBomService.getFullDetails(id);

  res.json({
    success: true,
    data: bom,
  });
  // end getById
};

/**
 * List all Order BOMs with filtering
 * GET /api/order-bom
 */
export const listOrderBOMs = async (req: Request, res: Response) => {
  const { orderId, styleId, status, isActive, page = '1', limit = '20' } = req.query;

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
  // end listOrderBOMs
};

/**
 * Update Order BOM items (only DRAFT status)
 * PUT /api/orders/:orderId/bom
 */
export const updateOrderBOM = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { styleId } = req.query;
  const validatedData = req.body as UpdateOrderBOMInput;

  // Get the active BOM for this order
  const existingBOM = await orderBomService.getByOrderId(orderId, styleId as string);

  if (!existingBOM) {
    throw new NotFoundError('Order BOM', 'this order');
  }

  const updatedBOM = await orderBomService.updateItems(existingBOM.id, {
    items: validatedData.items as any,
  });

  res.json({
    success: true,
    data: updatedBOM,
    message: 'Order BOM updated successfully',
  });
  // end updateOrderBOM
};

/**
 * Approve Order BOM
 * PATCH /api/orders/:orderId/bom/approve
 */
export const approveOrderBOM = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { styleId } = req.query;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  // Get the active BOM for this order
  const existingBOM = await orderBomService.getByOrderId(orderId, styleId as string);

  if (!existingBOM) {
    throw new NotFoundError('Order BOM', 'this order');
  }

  const approvedBOM = await orderBomService.approve(existingBOM.id, {
    approvedById: userId,
  });

  res.json({
    success: true,
    data: approvedBOM,
    message: 'Order BOM approved successfully',
  });
  // end approveOrderBOM
};

/**
 * Approve Order BOM and optionally calculate MRP
 * POST /api/orders/:orderId/bom/approve-and-calculate
 */
export const approveAndCalculateMRP = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { styleId, calculateMRP = true, calculateServices = true, requiredDate } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  // Get the active BOM for this order
  const existingBOM = await orderBomService.getByOrderId(orderId, styleId);

  if (!existingBOM) {
    throw new NotFoundError('Order BOM', 'this order');
  }

  // Step 0: Pre-flight validation — warn if BOM items lack material linkages
  const mrpValidation = await orderBomService.validateForMRP(existingBOM.id);

  // Step 1: Approve BOM (always proceed, validation is informational)
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
      const order = await import('../config/database').then((db) =>
        db.default.orders.findUnique({
          where: { id: orderId },
          select: { expectedDeliveryDate: true },
        })
      );

      const finalRequiredDate =
        requiredDate || order?.expectedDeliveryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default: 30 days from now

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

  // Step 3: Auto-create work orders if none exist (Fix 14)
  let workOrdersCreated = 0;
  let workOrderError: string | null = null;

  if (calculateServices) {
    try {
      const db = (await import('../config/database')).default;

      // Get all order items for this order
      const orderForWO = await db.orders.findUnique({
        where: { id: orderId },
        include: {
          order_items: {
            select: {
              id: true,
              styleId: true,
            },
          },
        },
      });

      if (orderForWO?.order_items) {
        for (const item of orderForWO.order_items) {
          // Check if work order already exists for this order+style
          const existingWO = await db.work_orders.findFirst({
            where: { orderId, styleId: item.styleId },
          });

          if (!existingWO) {
            // Use createFromOrderItem which properly copies order_item_breakup → work_order_breakup
            await workOrderService.createFromOrderItem(item.id, orderId, {
              plannedStartDate: new Date(),
              plannedEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              priority: 'MEDIUM',
              createdById: userId,
            });
            workOrdersCreated++;
          }
        }
      }
    } catch (error) {
      logError('Auto work order creation failed during BOM approval:', error);
      workOrderError = error instanceof Error ? error.message : 'Failed to create work orders';
    }
  }

  // Step 4: Optionally calculate service requirements for all work orders (Fix 15)
  let serviceResult = null;
  let serviceError = null;

  if (calculateServices) {
    try {
      const { calculateServicesForOrder } = await import('../services/work-order-service-requirement.service');

      serviceResult = await calculateServicesForOrder(orderId, userId);
    } catch (error) {
      logError('Service requirement calculation failed during BOM approval:', error);
      serviceError = error instanceof Error ? error.message : 'Failed to calculate service requirements';
    }
  }

  // Build response message with skipped items awareness
  const messageParts: string[] = ['Order BOM approved'];
  const mrpSkipped = mrpResult?.skipped || [];

  if (mrpResult) {
    const totalCalc = mrpResult.created + mrpResult.updated;
    if (totalCalc > 0) {
      messageParts.push(`${totalCalc} material requirements calculated`);
    }
    if (mrpSkipped.length > 0) {
      messageParts.push(`${mrpSkipped.length} BOM item(s) skipped — missing material linkages`);
    }
    if (totalCalc === 0 && mrpSkipped.length > 0) {
      messageParts.push('No material requirements generated. Check BOM item material linkages.');
    }
  } else if (mrpError) {
    messageParts.push(`MRP calculation failed: ${mrpError}`);
  }
  if (workOrdersCreated > 0) {
    messageParts.push(`${workOrdersCreated} work order(s) auto-created`);
  }
  if (workOrderError) {
    messageParts.push(`Work order creation failed: ${workOrderError}`);
  }
  if (serviceResult) {
    messageParts.push(
      `${serviceResult.totalServicesCreated} service requirements calculated for ${serviceResult.workOrdersProcessed} work order(s)`
    );
  } else if (serviceError) {
    messageParts.push(`Service calculation failed: ${serviceError}`);
  }

  // Determine overall success: BOM always approved, but flag if MRP produced nothing
  const mrpHadIssues =
    calculateMRP && mrpResult && mrpResult.created === 0 && mrpResult.updated === 0 && mrpSkipped.length > 0;

  res.json({
    success: true, // BOM approval itself succeeded
    data: {
      bom: approvedBOM,
      mrp: mrpResult
        ? {
            created: mrpResult.created,
            updated: mrpResult.updated,
            requirements: mrpResult.requirements,
            skipped: mrpSkipped,
          }
        : null,
      mrpCalculated: calculateMRP && mrpResult !== null && mrpResult.created + mrpResult.updated > 0,
      mrpError: mrpError,
      mrpWarning: mrpHadIssues
        ? `All ${mrpSkipped.length} BOM items were skipped. Items need materialId, fabricId, laceId, greigeId, or trim master IDs linked before MRP can calculate requirements.`
        : null,
      mrpValidation: !mrpValidation.ready
        ? {
            ready: false,
            warnings: mrpValidation.warnings,
          }
        : undefined,
      workOrdersCreated,
      workOrderError,
      services: serviceResult,
      servicesCalculated: calculateServices && serviceResult !== null,
      serviceError: serviceError,
    },
    message: messageParts.join('. '),
  });
  // end approveAndCalculateMRP
};

/**
 * Calculate MRP for approved Order BOM (standalone trigger)
 * POST /api/orders/:orderId/bom/calculate-mrp
 */
export const calculateMRPStandalone = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { styleId, requiredDate } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  // Get the active BOM for this order
  const existingBOM = await orderBomService.getByOrderId(orderId, styleId);

  if (!existingBOM) {
    throw new NotFoundError('Order BOM', 'this order');
  }

  // Ensure BOM is approved
  if (existingBOM.status !== 'APPROVED' && existingBOM.status !== 'LOCKED') {
    throw new BusinessError('Order BOM must be approved before calculating MRP');
  }

  // Calculate MRP
  const { calculateRequirementsFromOrder } = await import('../services/mrp.service');

  // Use requiredDate from request or default to order's expectedDeliveryDate
  const order = await import('../config/database').then((db) =>
    db.default.orders.findUnique({
      where: { id: orderId },
      select: { expectedDeliveryDate: true },
    })
  );

  const finalRequiredDate =
    requiredDate || order?.expectedDeliveryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const mrpResult = await calculateRequirementsFromOrder(
    {
      orderId,
      orderItemId: undefined, // Calculate for all items
      requiredDate: finalRequiredDate,
      checkStock: true,
    },
    userId
  );

  const totalCalc = mrpResult.created + mrpResult.updated;
  const skipped = mrpResult.skipped || [];
  const messageParts = [
    `${totalCalc} material requirements calculated (${mrpResult.created} created, ${mrpResult.updated} updated)`,
  ];
  if (skipped.length > 0) {
    messageParts.push(`${skipped.length} BOM item(s) skipped — missing material linkages`);
  }

  res.json({
    success: true,
    data: mrpResult,
    message: messageParts.join('. '),
    ...(totalCalc === 0 && skipped.length > 0
      ? {
          warning: `All BOM items were skipped. Check material linkages (materialId, fabricId, laceId, greigeId, or trim master IDs).`,
        }
      : {}),
  });
  // end calculateMRPStandalone
};

/**
 * Lock Order BOM for production
 * PATCH /api/orders/:orderId/bom/lock
 */
export const lockOrderBOM = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { styleId } = req.query;

  // Get the active BOM for this order
  const existingBOM = await orderBomService.getByOrderId(orderId, styleId as string);

  if (!existingBOM) {
    throw new NotFoundError('Order BOM', 'this order');
  }

  const lockedBOM = await orderBomService.lock(existingBOM.id);

  res.json({
    success: true,
    data: lockedBOM,
    message: 'Order BOM locked for production',
  });
  // end lockOrderBOM
};

/**
 * Calculate material requirements from Order BOM
 * GET /api/orders/:orderId/bom/requirements
 */
export const calculateRequirements = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { styleId } = req.query;

  // Get the active BOM for this order
  const existingBOM = await orderBomService.getByOrderId(orderId, styleId as string);

  if (!existingBOM) {
    throw new NotFoundError('Order BOM', 'this order');
  }

  const requirements = await orderBomService.calculateRequirements(existingBOM.id);

  res.json({
    success: true,
    data: requirements,
  });
  // end calculateRequirements
};

/**
 * Deactivate Order BOM
 * DELETE /api/orders/:orderId/bom
 */
export const deactivateOrderBOM = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { styleId } = req.query;

  // Get the active BOM for this order
  const existingBOM = await orderBomService.getByOrderId(orderId, styleId as string);

  if (!existingBOM) {
    throw new NotFoundError('Order BOM', 'this order');
  }

  await orderBomService.deactivate(existingBOM.id);

  res.json({
    success: true,
    message: 'Order BOM deactivated successfully',
  });
  // end deactivateOrderBOM
};

/**
 * Change fabric width on Order BOM (creates new version)
 * POST /api/order-bom/:id/change-width
 * Body validated at the route by validateBody(changeWidthSchema) — see orderBom.schema.ts
 */
export const changeWidth = async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = req.body as ChangeWidthInput;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  // BUG-ORD10 fix: standardized user ID property to createdById
  const newBom = await orderBomService.createVersionWithWidthChange({
    orderBomId: id,
    fabricItemChanges: validatedData.fabricItemChanges,
    createdById: userId,
  });

  res.status(201).json({
    success: true,
    data: newBom,
    message: `New BOM version ${newBom.version} created with updated fabric width`,
  });
  // end changeWidth
};

/**
 * Cleanup BOMs for cancelled orders
 * POST /api/order-bom/cleanup-cancelled
 */
export const cleanupCancelledOrderBOMs = async (req: Request, res: Response) => {
  const result = await orderBomService.cleanupBomsForCancelledOrders();

  res.json({
    success: true,
    data: result,
    message: `Cleanup complete: ${result.deactivatedCount} BOM(s) deactivated for cancelled orders`,
  });
  // end cleanupCancelledOrderBOMs
};
