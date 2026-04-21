/**
 * Unified PO Controller
 *
 * Handles HTTP requests for unified PO operations:
 * - Create PO (unified across all sources)
 * - Check for duplicates
 * - Validate PO input
 * - Get PO statistics by source/category
 */

import { Request, Response } from 'express';
import logger from '../utils/logger';
import { UnauthorizedError, ValidationError, ConflictError } from '../errors';
import {
  createUnifiedPO,
  validateUnifiedPOInput,
  checkForDuplicatePOs,
  mapMaterialTypeToPOCategory,
  mapServiceTypeToPOCategory,
  UnifiedPOCreationInput,
} from '../services/unified-po-creation.service';
import {
  sendPO,
  acknowledgePO,
  cancelPO,
  getPOsBySource,
  getPOSourceStats,
} from '../services/po-status-manager.service';
import { POSource, POCategory, Unit, ServiceType, PurchaseOrderStatus } from '@prisma/client';

/**
 * POST /api/purchase-orders/unified
 * Create a unified PO from any source
 */
export async function createUnifiedPOController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const {
    supplierId,
    expectedDeliveryDate,
    source,
    poCategory,
    items,
    paymentTerms,
    remarks,
    sourceLinks,
    linkedGreigePOId,
    skipDuplicateCheck,
    allowDuplicates,
  } = req.body;

  // Validate required fields
  if (!supplierId) {
    throw new ValidationError('supplierId is required');
  }
  if (!expectedDeliveryDate) {
    throw new ValidationError('expectedDeliveryDate is required');
  }
  if (!source || !Object.values(POSource).includes(source)) {
    throw new ValidationError(`Invalid source. Must be one of: ${Object.values(POSource).join(', ')}`);
  }
  if (!poCategory || !Object.values(POCategory).includes(poCategory)) {
    throw new ValidationError(`Invalid poCategory. Must be one of: ${Object.values(POCategory).join(', ')}`);
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('At least one item is required');
  }

  // Validate items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.materialId && !item.serviceType) {
      throw new ValidationError(`Item ${i}: Either materialId or serviceType is required`);
    }
    if (!item.orderedQuantity || item.orderedQuantity <= 0) {
      throw new ValidationError(`Item ${i}: orderedQuantity must be positive`);
    }
    if (!item.unit || !Object.values(Unit).includes(item.unit)) {
      throw new ValidationError(`Item ${i}: Invalid unit`);
    }
    if (item.unitPrice === undefined || item.unitPrice < 0) {
      throw new ValidationError(`Item ${i}: unitPrice must be non-negative`);
    }
  }

  const input: UnifiedPOCreationInput = {
    supplierId,
    expectedDeliveryDate: new Date(expectedDeliveryDate),
    createdById: userId,
    source: source as POSource,
    poCategory: poCategory as POCategory,
    items: items.map((item: any) => ({
      materialId: item.materialId,
      serviceType: item.serviceType as ServiceType | undefined,
      serviceDescription: item.serviceDescription,
      orderedQuantity: item.orderedQuantity,
      unit: item.unit as Unit,
      unitPrice: item.unitPrice,
      remarks: item.remarks,
    })),
    paymentTerms,
    remarks,
    sourceLinks,
    linkedGreigePOId,
  };

  const result = await createUnifiedPO(input, {
    skipDuplicateCheck: skipDuplicateCheck || false,
    allowDuplicates: allowDuplicates || false,
  });

  res.status(201).json({
    success: true,
    data: {
      purchaseOrder: result.purchaseOrder,
      sourceLinks: result.sourceLinks,
      duplicateWarnings: result.duplicateWarnings,
    },
    message: 'Purchase order created successfully',
  });
}

/**
 * POST /api/purchase-orders/validate
 * Validate PO input without creating
 */
export async function validatePOInputController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { supplierId, expectedDeliveryDate, source, poCategory, items, sourceLinks, linkedGreigePOId } = req.body;

  const input: UnifiedPOCreationInput = {
    supplierId,
    expectedDeliveryDate: new Date(expectedDeliveryDate || Date.now()),
    createdById: userId,
    source: source as POSource,
    poCategory: poCategory as POCategory,
    items: (items || []).map((item: any) => ({
      materialId: item.materialId,
      serviceType: item.serviceType as ServiceType | undefined,
      serviceDescription: item.serviceDescription,
      orderedQuantity: item.orderedQuantity || 0,
      unit: item.unit as Unit,
      unitPrice: item.unitPrice || 0,
      remarks: item.remarks,
    })),
    sourceLinks,
    linkedGreigePOId,
  };

  const result = await validateUnifiedPOInput(input);

  res.json({
    success: true,
    data: result,
  });
}

/**
 * POST /api/purchase-orders/check-duplicates
 * Check for duplicate POs for given materials
 */
export async function checkDuplicatesController(req: Request, res: Response) {
  const { materialIds, excludePOIds } = req.body;

  if (!materialIds || !Array.isArray(materialIds)) {
    throw new ValidationError('materialIds array is required');
  }

  const result = await checkForDuplicatePOs(materialIds, excludePOIds);

  res.json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/purchase-orders/by-source
 * Get POs filtered by source type
 */
export async function getPOsBySourceController(req: Request, res: Response) {
  const { source } = req.params;
  const { status, supplierId, fromDate, toDate, limit, offset } = req.query;

  if (!source || !Object.values(POSource).includes(source as POSource)) {
    throw new ValidationError(`Invalid source. Must be one of: ${Object.values(POSource).join(', ')}`);
  }

  const result = await getPOsBySource(source as POSource, {
    status: status as PurchaseOrderStatus | undefined,
    supplierId: supplierId as string,
    fromDate: fromDate ? new Date(fromDate as string) : undefined,
    toDate: toDate ? new Date(toDate as string) : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    offset: offset ? parseInt(offset as string, 10) : undefined,
  });

  res.json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/purchase-orders/stats
 * Get PO statistics by source, category, and status
 */
export async function getPOStatsController(req: Request, res: Response) {
  const result = await getPOSourceStats();

  res.json({
    success: true,
    data: result,
  });
}

/**
 * PATCH /api/purchase-orders/:id/send
 * Send PO to supplier
 */
export async function sendPOController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { id } = req.params;

  const result = await sendPO(id, userId);

  res.json({
    success: true,
    data: result,
  });
}

/**
 * PATCH /api/purchase-orders/:id/acknowledge
 * Acknowledge PO receipt
 */
export async function acknowledgePOController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { id } = req.params;

  const result = await acknowledgePO(id, userId);

  res.json({
    success: true,
    data: result,
  });
}

/**
 * PATCH /api/purchase-orders/:id/cancel
 * Cancel PO
 */
export async function cancelPOController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new ValidationError('Cancellation reason is required');
  }

  const result = await cancelPO(id, reason, userId);

  res.json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/purchase-orders/category-mapping/material/:materialType
 * Get recommended POCategory for a material type
 */
export async function getMaterialCategoryMappingController(req: Request, res: Response) {
  const { materialType } = req.params;

  const category = mapMaterialTypeToPOCategory(materialType);

  res.json({
    success: true,
    data: {
      materialType,
      recommendedCategory: category,
    },
  });
}

/**
 * GET /api/purchase-orders/category-mapping/service/:serviceType
 * Get recommended POCategory for a service type
 */
export async function getServiceCategoryMappingController(req: Request, res: Response) {
  const { serviceType } = req.params;

  if (!Object.values(ServiceType).includes(serviceType as ServiceType)) {
    throw new ValidationError(`Invalid serviceType. Must be one of: ${Object.values(ServiceType).join(', ')}`);
  }

  const category = mapServiceTypeToPOCategory(serviceType as ServiceType);

  res.json({
    success: true,
    data: {
      serviceType,
      recommendedCategory: category,
    },
  });
}

export default {
  createUnifiedPOController,
  validatePOInputController,
  checkDuplicatesController,
  getPOsBySourceController,
  getPOStatsController,
  sendPOController,
  acknowledgePOController,
  cancelPOController,
  getMaterialCategoryMappingController,
  getServiceCategoryMappingController,
};
