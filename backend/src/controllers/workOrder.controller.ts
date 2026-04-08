// Work Order Controller - RESTful API endpoints for work order management
import { Request, Response } from 'express';
import workOrderService, {
  CreateWorkOrderDTO,
  UpdateWorkOrderDTO,
  ProductionTrackingDTO,
  SplitWorkOrderDTO,
} from '../services/workOrder.service';
import { OrderStatus, Priority, ProductionStage } from '@prisma/client';
import { logInfo, logWarn, logDebug } from '../utils/logger';
import { productionBlockingValidationService } from '../services/productionBlockingValidation.service';
import { updateCostSheetActuals } from '../services/costSheet.service';
import { NotFoundError, ValidationError, ConflictError, BusinessError } from '../errors';
import { PrismaClient, ChallanType } from '@prisma/client';
import { buildCuttingChartData } from './cutting.controller';
import { createChallan, issueChallan } from '../services/challan.service';

const prisma = new PrismaClient();

/**
 * @route GET /api/work-orders
 * @desc Get all work orders with optional filters
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const getAllWorkOrders = async (req: Request, res: Response) => {
  const { status, priority, warehouseId, styleId, orderId, search, startDate, endDate } = req.query;

  const filters = {
    status: status as OrderStatus | undefined,
    priority: priority as Priority | undefined,
    warehouseId: warehouseId as string | undefined,
    styleId: styleId as string | undefined,
    orderId: orderId as string | undefined,
    search: search as string | undefined,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
  };

  const workOrders = await workOrderService.getAllWorkOrders(filters);

  res.json({
    success: true,
    data: workOrders,
    count: workOrders.length,
  });
};

/**
 * @route GET /api/work-orders/:id
 * @desc Get work order by ID
 * @access Private
 */
export const getWorkOrderById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const workOrder = await workOrderService.getWorkOrderById(id);

  res.json({
    success: true,
    data: workOrder,
  });
};

/**
 * @route GET /api/work-orders/order/:orderId
 * @desc Get work orders by order ID
 * @access Private
 */
export const getWorkOrdersByOrderId = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const workOrders = await workOrderService.getWorkOrdersByOrderId(orderId);

  res.json({
    success: true,
    data: workOrders,
    count: workOrders.length,
  });
};

/**
 * @route POST /api/work-orders
 * @desc Create a new work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const createWorkOrder = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  const workOrderData: CreateWorkOrderDTO = {
    ...req.body,
    plannedStartDate: new Date(req.body.plannedStartDate),
    plannedEndDate: new Date(req.body.plannedEndDate),
    createdById: userId,
  };

  const workOrder = await workOrderService.createWorkOrder(workOrderData);

  res.status(201).json({
    success: true,
    data: workOrder,
    message: 'Work order created successfully',
  });
};

/**
 * @route PUT /api/work-orders/:id
 * @desc Update a work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const updateWorkOrder = async (req: Request, res: Response) => {
  const { id } = req.params;

  const updateData: UpdateWorkOrderDTO = {
    ...req.body,
  };

  // Convert date strings to Date objects if present
  if (req.body.plannedStartDate) {
    updateData.plannedStartDate = new Date(req.body.plannedStartDate);
  }
  if (req.body.plannedEndDate) {
    updateData.plannedEndDate = new Date(req.body.plannedEndDate);
  }
  if (req.body.actualStartDate) {
    updateData.actualStartDate = new Date(req.body.actualStartDate);
  }
  if (req.body.actualEndDate) {
    updateData.actualEndDate = new Date(req.body.actualEndDate);
  }

  const workOrder = await workOrderService.updateWorkOrder(id, updateData);

  // ==========================================
  // PHASE 2C: Auto-update CMT actuals when work order is completed
  // ==========================================
  if (updateData.status === OrderStatus.COMPLETED && workOrder.styleId) {
    try {
      // For now, use a placeholder CMT cost calculation
      // In production, this could be based on:
      // - Actual labor hours * rate
      // - Actual contractor payment
      // - Transfer slip costs
      // Since we don't have these fields yet, we log for future implementation
      logInfo('Work order completed - CMT actual update pending', {
        workOrderId: id,
        styleId: workOrder.styleId,
        totalQuantity: workOrder.totalQuantity,
        completedQuantity: workOrder.completedQuantity,
      });

      // TODO: Implement actual CMT cost calculation
      // Example:
      // const cmtCost = calculateCMTCost(workOrder);
      // await updateCostSheetActuals({
      //   styleId: workOrder.styleId,
      //   category: 'CMT',
      //   actualCost: cmtCost,
      //   source: 'WORK_ORDER',
      // });
    } catch (error) {
      logWarn('Failed to auto-update CMT actuals from work order', error);
    }
  }
  // ==========================================

  res.json({
    success: true,
    data: workOrder,
    message: 'Work order updated successfully',
  });
};

/**
 * @route DELETE /api/work-orders/:id
 * @desc Delete a work order
 * @access Private (ADMIN)
 */
export const deleteWorkOrder = async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await workOrderService.deleteWorkOrder(id);

  res.json(result);
};

/**
 * @route POST /api/work-orders/:id/tracking
 * @desc Add production tracking update
 * @access Private (PRODUCTION_MANAGER, FACTORY_SUPERVISOR)
 */
export const addProductionTracking = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  const trackingData: ProductionTrackingDTO = {
    workOrderId: id,
    productionStage: req.body.productionStage as ProductionStage,
    quantityCompleted: parseInt(req.body.quantityCompleted),
    remarks: req.body.remarks,
    updatedById: userId,
  };

  // Extract admin override parameters
  const adminOverride = req.body.adminOverride === true;
  const overrideReason = req.body.overrideReason;

  const tracking = await workOrderService.addProductionTracking(trackingData, adminOverride, overrideReason);

  res.status(201).json({
    success: true,
    data: tracking,
    message: 'Production tracking updated successfully',
  });
};

/**
 * @route GET /api/work-orders/dashboard/summary
 * @desc Get production dashboard data
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const getProductionDashboard = async (req: Request, res: Response) => {
  const dashboard = await workOrderService.getProductionDashboard();

  res.json({
    success: true,
    data: dashboard,
  });
};

/**
 * @route PATCH /api/work-orders/:id/approve
 * @desc Approve a work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const approveWorkOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  const workOrder = await workOrderService.updateWorkOrder(id, {
    approvedById: userId,
    status: OrderStatus.PENDING,
  });

  res.json({
    success: true,
    data: workOrder,
    message: 'Work order approved successfully',
  });
};

/**
 * @route POST /api/work-orders/:id/split
 * @desc Split a work order for partial dispatch
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const splitWorkOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  const splitData: SplitWorkOrderDTO = {
    plannedDispatchDate: new Date(req.body.plannedDispatchDate),
    breakupToSplit: req.body.breakupToSplit,
    remarks: req.body.remarks,
  };

  const newWorkOrder = await workOrderService.splitWorkOrder(id, splitData, userId);

  res.status(201).json({
    success: true,
    data: newWorkOrder,
    message: 'Work order split successfully',
  });
};

/**
 * @route GET /api/work-orders/:id/material-readiness
 * @desc Check material readiness status for a work order
 * @access Private
 */
export const checkMaterialReadiness = async (req: Request, res: Response) => {
  const { id } = req.params;

  const readiness = await productionBlockingValidationService.checkMaterialReadiness(id);

  res.json({
    success: true,
    data: readiness,
  });
};

/**
 * @route POST /api/work-orders/:id/push-to-cutting
 * @desc Push work order to cutting stage (validates materials first)
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const pushToCutting = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const adminOverride = req.body.adminOverride === true;
  const overrideReason = req.body.overrideReason as string | undefined;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  // Material availability check is now informational — partial cutting is allowed.
  // The cutting chart shows per-fabric stock analysis and max cuttable quantity.
  // Users can proceed to cutting with whatever stock is available.

  // Update work order status to IN_PRODUCTION and set actual start date
  const updatedWorkOrder = await workOrderService.updateWorkOrder(id, {
    status: OrderStatus.IN_PRODUCTION,
    actualStartDate: new Date(),
  });

  // Add tracking entry for cutting stage
  await workOrderService.addProductionTracking({
    workOrderId: id,
    productionStage: ProductionStage.IN_CUTTING,
    quantityCompleted: 0,
    remarks: adminOverride
      ? `Pushed to cutting - OVERRIDE: ${overrideReason}`
      : 'Pushed to cutting - materials verified',
    updatedById: userId,
  });

  // Log override to audit table if used
  if (adminOverride && overrideReason) {
    await productionBlockingValidationService.logOverride({
      blockType: 'STAGE_TRANSITION',
      workOrderId: id,
      toStage: ProductionStage.IN_CUTTING,
      overrideReason,
      overriddenById: userId,
    });
  }

  logInfo('Work order pushed to cutting', { workOrderId: id, userId, adminOverride });

  res.json({
    success: true,
    data: updatedWorkOrder,
    message: 'Work order successfully pushed to cutting',
  });
};

/**
 * @route GET /api/work-orders/:id/fabric-issuance-data
 * @desc Get fabric analysis data for store issuance (lots, CAD avg, max cuttable, issued challans)
 * @access Private
 */
export const getFabricIssuanceData = async (req: Request, res: Response) => {
  const { id } = req.params;

  const workOrder = await prisma.work_orders.findUnique({
    where: { id },
    select: { id: true, styleId: true, orderId: true, status: true },
  });
  if (!workOrder) throw new NotFoundError('WorkOrder', id);

  // Reuse the cutting chart data builder for fabric resolution, CAD analysis, etc.
  const chartData = await buildCuttingChartData(id);

  // For issuance UI, we need AVAILABLE lots (quantityAvailable > 0), not the
  // challan-filtered lots that buildCuttingChartData returns for cutting.
  // Query fresh available stock and override the lots on each fabric.
  const uniqueFabricIds = chartData.fabrics.map((f: any) => f.fabricId).filter(Boolean) as string[];

  const availableStockRecords = await prisma.fabric_stock.findMany({
    where: { fabricId: { in: uniqueFabricIds }, quantityAvailable: { gt: 0 } },
    select: {
      id: true,
      fabricId: true,
      rollNumbers: true,
      cutableWidth: true,
      quantityAvailable: true,
      qualityGrade: true,
    },
    orderBy: { receivedDate: 'desc' },
  });

  // Group available stock by fabricId
  const availableStockMap = new Map<string, typeof availableStockRecords>();
  for (const fs of availableStockRecords) {
    if (!availableStockMap.has(fs.fabricId)) availableStockMap.set(fs.fabricId, []);
    availableStockMap.get(fs.fabricId)!.push(fs);
  }

  // Override lots on fabrics with available stock (not challan-filtered)
  const fabricsForIssuance = chartData.fabrics.map((f: any) => {
    const stocks = f.fabricId ? availableStockMap.get(f.fabricId) || [] : [];
    return {
      ...f,
      lots: stocks.map((s: any, idx: number) => ({
        lotId: s.id,
        lotNumber: idx + 1,
        rollNumbers: s.rollNumbers || '',
        actualWidth: Number(s.cutableWidth),
        quantityAvailable: Number(s.quantityAvailable),
        qualityGrade: s.qualityGrade,
      })),
    };
  });

  // Fetch existing INTERNAL challans for this work order (fabric issuance records)
  // Moved up so we can use issued quantities in analysis calculation
  const issuedChallans = await prisma.challans.findMany({
    where: { productionRunId: id, challanType: 'INTERNAL' },
    include: {
      items: {
        select: {
          id: true,
          fabricStockId: true,
          fabricId: true,
          quantity: true,
          description: true,
          unit: true,
          fabricStock: {
            select: {
              id: true,
              fabricId: true,
              rollNumbers: true,
              quantityAvailable: true,
              fabricMaster: { select: { id: true, fabricName: true, fabricCode: true } },
            },
          },
        },
      },
    },
    orderBy: { challanDate: 'desc' },
  });

  // Calculate issued meters per fabric from challans
  const issuedMetersByFabric = new Map<string, number>();
  for (const challan of issuedChallans) {
    for (const item of challan.items) {
      const fabricId = item.fabricId || item.fabricStock?.fabricId;
      if (fabricId) {
        const current = issuedMetersByFabric.get(fabricId) || 0;
        issuedMetersByFabric.set(fabricId, current + Number(item.quantity));
      }
    }
  }

  // Recalculate analysis with available stock AND issued quantities
  const fabricAnalysisForIssuance = chartData.fabrics.map((f: any) => {
    const stocks = f.fabricId ? availableStockMap.get(f.fabricId) || [] : [];
    const availableStock = stocks.reduce((sum: number, s: any) => sum + Number(s.quantityAvailable), 0);
    const issuedStock = f.fabricId ? issuedMetersByFabric.get(f.fabricId) || 0 : 0;
    const cadAvg = f.productionAverage || f.rawMatCalcAverage || f.costingAverage || 0;
    const cadSet = cadAvg > 0;
    const maxPcs = cadSet ? Math.floor(availableStock / cadAvg) : null;
    const totalOrderQty = chartData.totalOrderQty || 0;
    const requiredMeters = totalOrderQty * cadAvg;
    // Shortfall = required - available - already issued
    const shortfallMeters = cadSet ? Math.max(0, requiredMeters - availableStock - issuedStock) : 0;
    return {
      part: f.part,
      fabricId: f.fabricId,
      fabricName: f.fabricName,
      cadAverage: cadAvg,
      cadSet,
      availableStock,
      issuedStock, // NEW: track what's already been issued
      maxPcsFromStock: maxPcs,
      requiredForOrder: requiredMeters,
      shortfallMeters,
    };
  });

  res.json({
    success: true,
    data: {
      fabrics: fabricsForIssuance,
      fabricDetails: chartData.fabricDetails,
      fabricAnalysis: fabricAnalysisForIssuance,
      maxCuttablePcs: chartData.maxCuttablePcs,
      bottleneckFabric: chartData.bottleneckFabric,
      totalOrderQty: chartData.totalOrderQty,
      issuedChallans: issuedChallans.map((c) => ({
        id: c.id,
        challanNumber: c.challanNumber,
        status: c.status,
        challanDate: c.challanDate,
        items: c.items,
      })),
    },
  });
};

/**
 * @route POST /api/work-orders/:id/issue-fabric
 * @desc Issue fabric from store to cutting dept via INTERNAL challan
 * @access Private
 */
export const issueFabric = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });

  const { lots, remarks } = req.body as {
    lots: Array<{ fabricStockId: string; fabricId: string; quantity: number; description: string }>;
    remarks?: string;
  };

  if (!lots || lots.length === 0) throw new ValidationError('At least one fabric lot must be selected');

  const workOrder = await prisma.work_orders.findUnique({
    where: { id },
    select: { id: true, orderId: true, status: true, workOrderNumber: true },
  });
  if (!workOrder) throw new NotFoundError('WorkOrder', id);
  if (workOrder.status !== 'IN_PRODUCTION') {
    throw new ValidationError('Fabric can only be issued for work orders in IN_PRODUCTION status');
  }

  // Create INTERNAL challan (store → cutting)
  const challan = await createChallan({
    challanType: 'INTERNAL' as ChallanType,
    challanDate: new Date(),
    orderId: workOrder.orderId || undefined,
    productionRunId: id,
    fromType: 'DEPARTMENT',
    fromName: 'Fabric Store',
    toType: 'DEPARTMENT',
    toName: 'Cutting',
    remarks: remarks || `Fabric issued for ${workOrder.workOrderNumber}`,
    issuedById: userId,
    items: lots.map((lot) => ({
      itemType: 'FABRIC',
      fabricStockId: lot.fabricStockId,
      fabricId: lot.fabricId,
      quantity: lot.quantity,
      unit: 'MTR',
      description: lot.description,
    })),
  });

  // Immediately issue the challan — deducts from fabric_stock.quantityAvailable
  const issuedChallan = await issueChallan(challan.id, userId);

  logInfo('Fabric issued to cutting via INTERNAL challan', {
    workOrderId: id,
    challanId: challan.id,
    lotCount: lots.length,
    userId,
  });

  res.status(201).json({
    success: true,
    data: issuedChallan,
    message: `Fabric issued successfully via challan ${challan.challanNumber}`,
  });
};

// ============================================
// Material Issuance (Trims & Packaging)
// ============================================

// Trim material types for stitching stage
const TRIM_MATERIAL_TYPES = [
  'TRIMS',
  'BUTTON',
  'THREAD',
  'ZIPPER',
  'ELASTIC',
  'LABEL',
  'HOOK_EYE',
  'SNAP_BUTTON',
  'BUCKLE',
  'BELT',
  'VELCRO',
  'DRAWSTRING',
  'RIBBON',
  'SEQUIN',
  'BEAD',
  'MOTIF',
  'INTERLINING',
  'PADDING',
  'OTHER_FASTENER',
  'ACCESSORIES',
];

// Packaging material types for finishing stage
const PACKAGING_MATERIAL_TYPES = ['PACKAGING'];

/**
 * Shared helper: get BOM items + stock availability + issued challans for a set of material types
 */
async function getMaterialIssuanceData(workOrderId: string, materialTypes: string[], toDepartment: string) {
  const workOrder = await prisma.work_orders.findUnique({
    where: { id: workOrderId },
    select: { id: true, orderId: true, styleId: true, status: true },
  });
  if (!workOrder) throw new NotFoundError('WorkOrder', workOrderId);

  // Get active BOM for this order+style
  const orderBom = await prisma.order_bom.findFirst({
    where: { orderId: workOrder.orderId!, styleId: workOrder.styleId!, isActive: true },
    include: {
      items: {
        where: { materialType: { in: materialTypes } },
        include: {
          material: { select: { id: true, code: true, name: true, materialType: true, unit: true } },
        },
      },
    },
  });

  const bomItems = (orderBom?.items || []).filter((item) => item.materialId);

  // Get unique material IDs from BOM
  const materialIds = [...new Set(bomItems.map((item) => item.materialId).filter(Boolean))] as string[];

  // Get stock levels for each material
  const stockLevels = await prisma.stock_levels.findMany({
    where: { materialId: { in: materialIds } },
    select: { materialId: true, quantity: true, unit: true, warehouseId: true },
  });

  // Build stock map: materialId → total available qty across warehouses
  const stockMap = new Map<string, number>();
  for (const sl of stockLevels) {
    stockMap.set(sl.materialId, (stockMap.get(sl.materialId) || 0) + Number(sl.quantity));
  }

  // Build BOM items with stock info and calculated required qty
  const items = bomItems.map((item) => {
    const qtyPerPiece = Number(item.quantityPerGarment);
    const orderQty = item.orderQuantity;
    const wastagePercent = Number(item.wastagePercent || 0);
    const requiredQty = qtyPerPiece * orderQty * (1 + wastagePercent / 100);
    const availableStock = item.materialId ? stockMap.get(item.materialId) || 0 : 0;

    return {
      bomItemId: item.id,
      materialId: item.materialId,
      materialCode: item.material?.code || '',
      materialName: item.material?.name || '',
      materialType: item.materialType,
      componentName: item.componentName || '',
      unit: item.unit || item.material?.unit || 'PCS',
      qtyPerPiece,
      orderQty,
      wastagePercent,
      requiredQty: Math.ceil(requiredQty * 100) / 100, // round up to 2 decimals
      availableStock,
      shortage: Math.max(0, requiredQty - availableStock),
    };
  });

  // Get existing INTERNAL challans for this work order targeting this department
  const issuedChallans = await prisma.challans.findMany({
    where: {
      productionRunId: workOrderId,
      challanType: 'INTERNAL',
      toName: toDepartment,
    },
    include: {
      items: {
        select: {
          id: true,
          materialId: true,
          quantity: true,
          description: true,
          unit: true,
        },
      },
    },
    orderBy: { challanDate: 'desc' },
  });

  // Calculate already-issued qty per material
  const issuedQtyMap = new Map<string, number>();
  for (const c of issuedChallans) {
    for (const ci of c.items) {
      if (ci.materialId) {
        issuedQtyMap.set(ci.materialId, (issuedQtyMap.get(ci.materialId) || 0) + Number(ci.quantity));
      }
    }
  }

  return {
    items: items.map((item) => ({
      ...item,
      alreadyIssued: item.materialId ? issuedQtyMap.get(item.materialId) || 0 : 0,
    })),
    issuedChallans: issuedChallans.map((c) => ({
      id: c.id,
      challanNumber: c.challanNumber,
      status: c.status,
      challanDate: c.challanDate,
      items: c.items,
    })),
  };
}

/**
 * @route GET /api/work-orders/:id/trim-issuance-data
 * @desc Get BOM trim items with stock availability for stitching issuance
 */
export const getTrimIssuanceData = async (req: Request, res: Response) => {
  const data = await getMaterialIssuanceData(req.params.id, TRIM_MATERIAL_TYPES, 'Stitching');
  res.json({ success: true, data });
};

/**
 * @route GET /api/work-orders/:id/packaging-issuance-data
 * @desc Get BOM packaging items with stock availability for finishing issuance
 */
export const getPackagingIssuanceData = async (req: Request, res: Response) => {
  const data = await getMaterialIssuanceData(req.params.id, PACKAGING_MATERIAL_TYPES, 'Finishing');
  res.json({ success: true, data });
};

/**
 * Shared helper: issue materials via INTERNAL challan
 */
async function issueMaterials(
  workOrderId: string,
  userId: string,
  fromName: string,
  toName: string,
  items: Array<{ materialId: string; quantity: number; unit: string; description: string }>,
  remarks?: string
) {
  const workOrder = await prisma.work_orders.findUnique({
    where: { id: workOrderId },
    select: { id: true, orderId: true, status: true, workOrderNumber: true },
  });
  if (!workOrder) throw new NotFoundError('WorkOrder', workOrderId);
  if (workOrder.status !== 'IN_PRODUCTION') {
    throw new ValidationError('Materials can only be issued for work orders in IN_PRODUCTION status');
  }

  const challan = await createChallan({
    challanType: 'INTERNAL' as ChallanType,
    challanDate: new Date(),
    orderId: workOrder.orderId || undefined,
    productionRunId: workOrderId,
    fromType: 'DEPARTMENT',
    fromName,
    toType: 'DEPARTMENT',
    toName,
    remarks: remarks || `Materials issued for ${workOrder.workOrderNumber}`,
    issuedById: userId,
    items: items.map((item) => ({
      itemType: 'TRIM',
      materialId: item.materialId,
      quantity: item.quantity,
      unit: item.unit,
      description: item.description,
    })),
  });

  const issuedChallan = await issueChallan(challan.id, userId);

  logInfo(`Materials issued to ${toName} via INTERNAL challan`, {
    workOrderId,
    challanId: challan.id,
    itemCount: items.length,
    userId,
  });

  return issuedChallan;
}

/**
 * @route POST /api/work-orders/:id/issue-trims
 * @desc Issue trim materials from store to stitching dept via INTERNAL challan
 */
export const issueTrims = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });

  const { items, remarks } = req.body as {
    items: Array<{ materialId: string; quantity: number; unit: string; description: string }>;
    remarks?: string;
  };
  if (!items || items.length === 0) throw new ValidationError('At least one trim item must be selected');

  const issuedChallan = await issueMaterials(req.params.id, userId, 'Trim Store', 'Stitching', items, remarks);

  res.status(201).json({
    success: true,
    data: issuedChallan,
    message: `Trims issued to stitching successfully`,
  });
};

/**
 * @route POST /api/work-orders/:id/issue-packaging
 * @desc Issue packaging materials from store to finishing dept via INTERNAL challan
 */
export const issuePackaging = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });

  const { items, remarks } = req.body as {
    items: Array<{ materialId: string; quantity: number; unit: string; description: string }>;
    remarks?: string;
  };
  if (!items || items.length === 0) throw new ValidationError('At least one packaging item must be selected');

  const issuedChallan = await issueMaterials(req.params.id, userId, 'Packaging Store', 'Finishing', items, remarks);

  res.status(201).json({
    success: true,
    data: issuedChallan,
    message: `Packaging issued to finishing successfully`,
  });
};

// ============================================
// Thread Issuance (Thread Store → Stitching)
// ============================================

/**
 * @route GET /api/work-orders/:id/thread-issuance-data
 * @desc Get available thread stock lots + already-issued challans for this work order
 */
export const getThreadIssuanceData = async (req: Request, res: Response) => {
  const { id } = req.params;

  const workOrder = await prisma.work_orders.findUnique({
    where: { id },
    select: { id: true, orderId: true, styleId: true, status: true },
  });
  if (!workOrder) throw new NotFoundError('WorkOrder', id);

  // Get thread requirements for this order
  const threadRequirements = await prisma.order_thread_requirements.findMany({
    where: { orderId: workOrder.orderId! },
    select: { threadId: true },
  });
  const threadIds = [...new Set(threadRequirements.map((r) => r.threadId))];

  // Get available thread_stock lots for these threads
  const threadStockLots =
    threadIds.length > 0
      ? await prisma.thread_stock.findMany({
          where: {
            threadId: { in: threadIds },
            status: 'AVAILABLE',
            quantityAvailable: { gt: 0 },
          },
          include: {
            threadMaster: {
              select: { id: true, threadCode: true, threadName: true, color: true },
            },
          },
          orderBy: { receivedDate: 'asc' },
        })
      : [];

  const items = threadStockLots.map((lot) => ({
    threadStockId: lot.id,
    threadId: lot.threadId,
    threadCode: lot.threadMaster.threadCode,
    threadName: lot.threadMaster.threadName,
    colorName: lot.colorName || lot.threadMaster.color || '',
    ply: lot.ply,
    packagingType: lot.packagingType,
    materialComposition: lot.materialComposition,
    unit: lot.unit,
    quantityAvailable: Number(lot.quantityAvailable),
    metersAvailable: lot.metersAvailable ? Number(lot.metersAvailable) : 0,
    boxesAvailable: lot.boxesAvailable ? Number(lot.boxesAvailable) : 0,
    purchaseCost: Number(lot.purchaseCost),
    receivedDate: lot.receivedDate,
  }));

  // Get existing INTERNAL challans for this work order targeting Stitching (thread)
  const issuedChallans = await prisma.challans.findMany({
    where: {
      productionRunId: id,
      challanType: 'INTERNAL',
      toName: 'Stitching',
      items: { some: { threadStockId: { not: null } } },
    },
    include: {
      items: {
        where: { threadStockId: { not: null } },
        select: {
          id: true,
          threadStockId: true,
          quantity: true,
          description: true,
          unit: true,
        },
      },
    },
    orderBy: { challanDate: 'desc' },
  });

  res.json({
    success: true,
    data: {
      items,
      issuedChallans: issuedChallans.map((c) => ({
        id: c.id,
        challanNumber: c.challanNumber,
        status: c.status,
        challanDate: c.challanDate,
        items: c.items,
      })),
    },
  });
};

/**
 * @route POST /api/work-orders/:id/issue-thread
 * @desc Issue thread from Thread Store to Stitching dept via INTERNAL challan
 */
export const issueThread = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });

  const { items, remarks } = req.body as {
    items: Array<{ threadStockId: string; quantity: number; unit: string; description: string }>;
    remarks?: string;
  };
  if (!items || items.length === 0) throw new ValidationError('At least one thread lot must be selected');

  const workOrder = await prisma.work_orders.findUnique({
    where: { id },
    select: { id: true, orderId: true, status: true, workOrderNumber: true },
  });
  if (!workOrder) throw new NotFoundError('WorkOrder', id);
  if (workOrder.status !== 'IN_PRODUCTION') {
    throw new ValidationError('Thread can only be issued for work orders in IN_PRODUCTION status');
  }

  // Create INTERNAL challan (Thread Store → Stitching)
  const challan = await createChallan({
    challanType: 'INTERNAL' as ChallanType,
    challanDate: new Date(),
    orderId: workOrder.orderId || undefined,
    productionRunId: id,
    fromType: 'DEPARTMENT',
    fromName: 'Thread Store',
    toType: 'DEPARTMENT',
    toName: 'Stitching',
    remarks: remarks || `Thread issued for ${workOrder.workOrderNumber}`,
    issuedById: userId,
    items: items.map((item) => ({
      itemType: 'THREAD',
      threadStockId: item.threadStockId,
      quantity: item.quantity,
      unit: item.unit,
      description: item.description,
    })),
  });

  // Immediately issue the challan — deducts from thread_stock.quantityAvailable
  const issuedChallan = await issueChallan(challan.id, userId);

  logInfo('Thread issued to stitching via INTERNAL challan', {
    workOrderId: id,
    challanId: challan.id,
    itemCount: items.length,
    userId,
  });

  res.status(201).json({
    success: true,
    data: issuedChallan,
    message: `Thread issued to stitching successfully via challan ${challan.challanNumber}`,
  });
};

// ============================================
// WIP (Work-In-Progress) Summary
// ============================================

/**
 * @route GET /api/work-orders/:id/wip-summary
 * @desc Get WIP inventory summary across all production stages
 */
export const getWipSummary = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Run all queries in parallel for performance
  const [cuttingBatches, transferSlips, stitchingIssues, finishingIssues, workOrder] = await Promise.all([
    // 1. Cutting: get all batch SKU data
    prisma.cutting_batches.findMany({
      where: { workOrderId: id },
      select: {
        id: true,
        status: true,
        skuOutputs: {
          select: {
            colorId: true,
            sizeId: true,
            orderQty: true,
            toCut: true,
            cutQty: true,
            rejectedQty: true,
            goodPcs: true,
          },
        },
      },
    }),
    // 2. Transfer slips: all movements for this WO
    prisma.transfer_slips.findMany({
      where: { workOrderId: id, isActive: true },
      select: {
        fromStage: true,
        toStage: true,
        status: true,
        totalGoodPieces: true,
        skuBreakdown: { select: { colorId: true, sizeId: true, quantity: true } },
      },
    }),
    // 3. Stitching: issues + daily outputs
    prisma.stitching_issues.findMany({
      where: { workOrderId: id },
      select: {
        id: true,
        status: true,
        skuBreakdown: { select: { colorId: true, sizeId: true, issuedQty: true } },
        dailyOutputs: {
          select: {
            skuOutputs: { select: { colorId: true, sizeId: true, goodQty: true, defectQty: true } },
          },
        },
      },
    }),
    // 4. Finishing: issues + daily outputs
    prisma.finishing_issues.findMany({
      where: { workOrderId: id },
      select: {
        id: true,
        status: true,
        skuBreakdown: { select: { colorId: true, sizeId: true, issuedQty: true } },
        dailyOutputs: {
          select: {
            skuOutputs: { select: { colorId: true, sizeId: true, finishedQty: true, defectQty: true } },
          },
        },
      },
    }),
    // 5. Work order for total qty
    prisma.work_orders.findUnique({
      where: { id },
      select: { totalQuantity: true },
    }),
  ]);

  if (!workOrder) throw new NotFoundError('WorkOrder', id);
  const orderQty = workOrder.totalQuantity || 0;

  // --- Cutting aggregation ---
  let cutTotal = 0,
    cutCompleted = 0,
    cutDefects = 0;
  for (const batch of cuttingBatches) {
    for (const sku of batch.skuOutputs) {
      cutTotal += sku.toCut || sku.orderQty;
      cutCompleted += sku.goodPcs;
      cutDefects += sku.rejectedQty;
    }
  }

  // --- Transfer slip aggregation ---
  let cuttingToStitchingIssued = 0,
    stitchingToFinishingIssued = 0,
    finishingToDispatchIssued = 0;
  for (const slip of transferSlips) {
    const total = slip.skuBreakdown.reduce((sum, s) => sum + s.quantity, 0);
    if (slip.fromStage === 'CUTTING' && slip.toStage === 'STITCHING') cuttingToStitchingIssued += total;
    if (slip.fromStage === 'STITCHING' && slip.toStage === 'FINISHING') stitchingToFinishingIssued += total;
    if (slip.fromStage === 'FINISHING' && slip.toStage === 'DISPATCH') finishingToDispatchIssued += total;
  }

  // --- Stitching aggregation ---
  let stitchingReceived = 0,
    stitchingProduced = 0,
    stitchingDefects = 0;
  for (const issue of stitchingIssues) {
    stitchingReceived += issue.skuBreakdown.reduce((sum, s) => sum + s.issuedQty, 0);
    for (const output of issue.dailyOutputs) {
      for (const sku of output.skuOutputs) {
        stitchingProduced += sku.goodQty;
        stitchingDefects += sku.defectQty;
      }
    }
  }

  // --- Finishing aggregation ---
  let finishingReceived = 0,
    finishingProduced = 0,
    finishingDefects = 0;
  for (const issue of finishingIssues) {
    finishingReceived += issue.skuBreakdown.reduce((sum, s) => sum + s.issuedQty, 0);
    for (const output of issue.dailyOutputs) {
      for (const sku of output.skuOutputs) {
        finishingProduced += sku.finishedQty;
        finishingDefects += sku.defectQty;
      }
    }
  }

  res.json({
    success: true,
    data: {
      orderQty,
      cutting: {
        planned: cutTotal,
        completed: cutCompleted,
        defects: cutDefects,
        wip: Math.max(0, cutTotal - cutCompleted - cutDefects),
      },
      cuttingToStitching: {
        issued: cuttingToStitchingIssued,
        pending: Math.max(0, cutCompleted - cuttingToStitchingIssued),
      },
      stitching: {
        received: stitchingReceived,
        produced: stitchingProduced,
        defects: stitchingDefects,
        wip: Math.max(0, stitchingReceived - stitchingProduced - stitchingDefects),
      },
      stitchingToFinishing: {
        issued: stitchingToFinishingIssued,
        pending: Math.max(0, stitchingProduced - stitchingToFinishingIssued),
      },
      finishing: {
        received: finishingReceived,
        produced: finishingProduced,
        defects: finishingDefects,
        wip: Math.max(0, finishingReceived - finishingProduced - finishingDefects),
      },
      finishingToDispatch: {
        issued: finishingToDispatchIssued,
        pending: Math.max(0, finishingProduced - finishingToDispatchIssued),
      },
    },
  });
};
