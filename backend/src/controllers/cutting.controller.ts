import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';

// ============================================
// Helper Functions
// ============================================

const transformCuttingBatch = (batch: any) => ({
  ...batch,
  actualFabricWidth: batch.actualFabricWidth ? Number(batch.actualFabricWidth) : null,
  cadAverageUsed: batch.cadAverageUsed ? Number(batch.cadAverageUsed) : null,
  cadWidthUsed: batch.cadWidthUsed ? Number(batch.cadWidthUsed) : null,
  fabricConsumed: batch.fabricConsumed ? Number(batch.fabricConsumed) : null,
  actualAverage: batch.actualAverage ? Number(batch.actualAverage) : null,
  varianceFromCad: batch.varianceFromCad ? Number(batch.varianceFromCad) : null,
  variancePercent: batch.variancePercent ? Number(batch.variancePercent) : null,
  wastageMeters: batch.wastageMeters ? Number(batch.wastageMeters) : null,
  wastagePercent: batch.wastagePercent ? Number(batch.wastagePercent) : null,
  workOrder: batch.workOrder
    ? {
        id: batch.workOrder.id,
        workOrderNumber: batch.workOrder.workOrderNumber,
        styleId: batch.workOrder.styleId,
        orderId: batch.workOrder.orderId,
        style: batch.workOrder.styles
          ? {
              id: batch.workOrder.styles.id,
              styleCode: batch.workOrder.styles.styleCode,
              styleName: batch.workOrder.styles.styleName,
            }
          : null,
        order: batch.workOrder.orders
          ? {
              id: batch.workOrder.orders.id,
              orderNumber: batch.workOrder.orders.orderNumber,
              customer: batch.workOrder.orders.customers
                ? {
                    id: batch.workOrder.orders.customers.id,
                    name: batch.workOrder.orders.customers.name,
                  }
                : null,
            }
          : null,
      }
    : null,
  component: batch.component
    ? {
        id: batch.component.id,
        componentName: batch.component.componentName,
        componentType: batch.component.componentType,
      }
    : null,
  fabricStock: batch.fabricStock
    ? {
        id: batch.fabricStock.id,
        rollNumbers: batch.fabricStock.rollNumbers || '',
        quantityAvailable: Number(batch.fabricStock.quantityAvailable),
        finishedWidth: Number(batch.fabricStock.finishedWidth),
        cutableWidth: Number(batch.fabricStock.cutableWidth),
        fabric: batch.fabricStock.fabricMaster
          ? {
              id: batch.fabricStock.fabricMaster.id,
              fabricCode: batch.fabricStock.fabricMaster.fabricCode,
              fabricName: batch.fabricStock.fabricMaster.fabricName,
            }
          : null,
      }
    : null,
  cuttingOperator: batch.cuttingOperator
    ? {
        id: batch.cuttingOperator.id,
        name: `${batch.cuttingOperator.firstName} ${batch.cuttingOperator.lastName}`,
      }
    : null,
  createdBy: batch.createdBy
    ? {
        id: batch.createdBy.id,
        name: `${batch.createdBy.firstName} ${batch.createdBy.lastName}`,
      }
    : null,
  skuOutputs: batch.skuOutputs?.map((sku: any) => ({
    ...sku,
    color: sku.color
      ? {
          id: sku.color.id,
          colorName: sku.color.colorName,
          colorCode: sku.color.colorCode,
        }
      : null,
    size: sku.size
      ? {
          id: sku.size.id,
          sizeName: sku.size.sizeName,
          sortOrder: sku.size.sortOrder,
        }
      : null,
  })),
  defects: batch.defects || [],
});

const generateBatchNumber = async (workOrderNumber: string, componentName?: string): Promise<string> => {
  const prefix = `CB-${workOrderNumber}`;
  const componentPart = componentName ? `-${componentName.substring(0, 3).toUpperCase()}` : '';

  // Get the count of existing batches for this work order
  const existingCount = await prisma.cutting_batches.count({
    where: {
      batchNumber: {
        startsWith: prefix,
      },
    },
  });

  const seq = (existingCount + 1).toString().padStart(3, '0');
  return `${prefix}${componentPart}-${seq}`;
};

// Include options for cutting batch queries
const batchIncludeOptions = {
  workOrder: {
    include: {
      styles: true,
      orders: {
        include: {
          customers: true,
        },
      },
    },
  },
  component: true,
  fabricStock: {
    include: {
      fabricMaster: true,
    },
  },
  cuttingOperator: true,
  createdBy: true,
  skuOutputs: {
    include: {
      color: true,
      size: true,
    },
  },
  defects: true,
};

// ============================================
// List Cutting Batches
// ============================================

export const getAllCuttingBatches = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      workOrderId,
      componentId,
      fromDate,
      toDate,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: Prisma.cutting_batchesWhereInput = {};

    if (search) {
      where.OR = [
        { batchNumber: { contains: String(search), mode: 'insensitive' } },
        { workOrder: { workOrderNumber: { contains: String(search), mode: 'insensitive' } } },
        { workOrder: { styles: { styleCode: { contains: String(search), mode: 'insensitive' } } } },
        { workOrder: { styles: { styleName: { contains: String(search), mode: 'insensitive' } } } },
      ];
    }

    if (status) {
      where.status = status as any;
    }

    if (workOrderId) {
      where.workOrderId = String(workOrderId);
    }

    if (componentId) {
      where.componentId = String(componentId);
    }

    if (fromDate || toDate) {
      where.cuttingDate = {};
      if (fromDate) {
        where.cuttingDate.gte = new Date(String(fromDate));
      }
      if (toDate) {
        where.cuttingDate.lte = new Date(String(toDate));
      }
    }

    const [batches, total] = await Promise.all([
      prisma.cutting_batches.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: batchIncludeOptions,
      }),
      prisma.cutting_batches.count({ where }),
    ]);

    res.json({
      data: batches.map(transformCuttingBatch),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching cutting batches:', error);
    res.status(500).json({ error: 'Failed to fetch cutting batches' });
  }
};

// ============================================
// Get Single Cutting Batch
// ============================================

export const getCuttingBatchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const batch = await prisma.cutting_batches.findUnique({
      where: { id },
      include: {
        ...batchIncludeOptions,
        transferSlips: true,
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Cutting batch not found' });
    }

    res.json({ data: transformCuttingBatch(batch) });
  } catch (error) {
    console.error('Error fetching cutting batch:', error);
    res.status(500).json({ error: 'Failed to fetch cutting batch' });
  }
};

// ============================================
// Create Cutting Batch
// ============================================

export const createCuttingBatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const {
      workOrderId,
      componentId,
      cuttingDate,
      fabricStockId,
      actualFabricWidth,
      cadAverageUsed,
      cadWidthUsed,
      layersPerLay,
      numberOfLays,
      cuttingTableId,
      cuttingOperatorId,
      remarks,
      skuOutputs,
    } = req.body;

    // Get work order to generate batch number
    const workOrder = await prisma.work_orders.findUnique({
      where: { id: workOrderId },
      select: { workOrderNumber: true },
    });

    if (!workOrder) {
      return res.status(400).json({ error: 'Work order not found' });
    }

    // Get component name if provided
    let componentName: string | undefined;
    if (componentId) {
      const component = await prisma.style_components.findUnique({
        where: { id: componentId },
        select: { componentName: true },
      });
      componentName = component?.componentName;
    }

    const batchNumber = await generateBatchNumber(workOrder.workOrderNumber, componentName);

    const batch = await prisma.cutting_batches.create({
      data: {
        batchNumber,
        workOrderId,
        componentId,
        cuttingDate: new Date(cuttingDate),
        fabricStockId,
        actualFabricWidth,
        cadAverageUsed,
        cadWidthUsed: cadWidthUsed || actualFabricWidth,
        layersPerLay,
        numberOfLays,
        fabricConsumed: 0, // Will be updated when recording output
        cuttingTableId,
        cuttingOperatorId,
        status: 'PENDING',
        remarks,
        createdById: userId,
        skuOutputs: {
          create: skuOutputs?.map((sku: any) => ({
            colorId: sku.colorId,
            sizeId: sku.sizeId,
            orderQty: sku.orderQty || sku.plannedQty,
            extraAllowed: sku.extraAllowed || 0,
            maxCuttable: sku.maxCuttable || sku.orderQty || sku.plannedQty,
            toCut: sku.toCut || sku.plannedQty,
            cutQty: 0,
            rejectedQty: 0,
            goodPcs: 0,
          })) || [],
        },
      },
      include: batchIncludeOptions,
    });

    res.status(201).json({ data: transformCuttingBatch(batch) });
  } catch (error) {
    console.error('Error creating cutting batch:', error);
    res.status(500).json({ error: 'Failed to create cutting batch' });
  }
};

// ============================================
// Update Cutting Batch
// ============================================

export const updateCuttingBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if batch exists and is not completed
    const existing = await prisma.cutting_batches.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cutting batch not found' });
    }

    if (existing.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot update completed batch' });
    }

    const batch = await prisma.cutting_batches.update({
      where: { id },
      data: {
        ...updateData,
        cuttingDate: updateData.cuttingDate ? new Date(updateData.cuttingDate) : undefined,
      },
      include: batchIncludeOptions,
    });

    res.json({ data: transformCuttingBatch(batch) });
  } catch (error) {
    console.error('Error updating cutting batch:', error);
    res.status(500).json({ error: 'Failed to update cutting batch' });
  }
};

// ============================================
// Delete Cutting Batch
// ============================================

export const deleteCuttingBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if batch exists and is in PENDING status
    const existing = await prisma.cutting_batches.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cutting batch not found' });
    }

    if (existing.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only delete pending batches' });
    }

    await prisma.cutting_batches.delete({
      where: { id },
    });

    res.json({ message: 'Cutting batch deleted successfully' });
  } catch (error) {
    console.error('Error deleting cutting batch:', error);
    res.status(500).json({ error: 'Failed to delete cutting batch' });
  }
};

// ============================================
// Workflow Actions
// ============================================

// Start cutting batch (PENDING -> IN_PROGRESS)
export const startCuttingBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.cutting_batches.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cutting batch not found' });
    }

    if (existing.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only start pending batches' });
    }

    const batch = await prisma.cutting_batches.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
      include: batchIncludeOptions,
    });

    res.json({ data: transformCuttingBatch(batch) });
  } catch (error) {
    console.error('Error starting cutting batch:', error);
    res.status(500).json({ error: 'Failed to start cutting batch' });
  }
};

// Record cutting output
export const recordCuttingOutput = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { skuOutputs, defects, fabricConsumed, remarks } = req.body;

    const existing = await prisma.cutting_batches.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cutting batch not found' });
    }

    if (existing.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Can only record output for in-progress batches' });
    }

    // Update SKU outputs and add defects in transaction
    await prisma.$transaction(async (tx) => {
      // Update SKU outputs
      for (const sku of skuOutputs) {
        if (sku.id) {
          await tx.cutting_batch_skus.update({
            where: { id: sku.id },
            data: {
              cutQty: sku.cutQty,
              rejectedQty: sku.rejectedQty || 0,
              goodPcs: sku.cutQty - (sku.rejectedQty || 0),
            },
          });
        }
      }

      // Add defects if any
      if (defects && defects.length > 0) {
        await tx.cutting_batch_defects.createMany({
          data: defects.map((d: any) => ({
            cuttingBatchId: id,
            colorId: d.colorId,
            sizeId: d.sizeId,
            defectType: d.defectType,
            defectQty: d.defectQty,
            remarks: d.remarks,
          })),
        });
      }

      // Update batch fabric consumed
      await tx.cutting_batches.update({
        where: { id },
        data: {
          fabricConsumed,
          remarks: remarks || undefined,
        },
      });
    });

    const batch = await prisma.cutting_batches.findUnique({
      where: { id },
      include: batchIncludeOptions,
    });

    res.json({ data: transformCuttingBatch(batch) });
  } catch (error) {
    console.error('Error recording cutting output:', error);
    res.status(500).json({ error: 'Failed to record cutting output' });
  }
};

// Complete cutting batch (IN_PROGRESS -> COMPLETED)
export const completeCuttingBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actualAverage, remarks } = req.body;

    const existing = await prisma.cutting_batches.findUnique({
      where: { id },
      include: {
        skuOutputs: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cutting batch not found' });
    }

    if (existing.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Can only complete in-progress batches' });
    }

    // Calculate total cut quantity
    const totalCut = existing.skuOutputs.reduce((sum: number, sku) => sum + sku.cutQty, 0);

    // Calculate actual average if not provided
    let calcActualAverage = actualAverage;
    if (!calcActualAverage && totalCut > 0 && Number(existing.fabricConsumed) > 0) {
      calcActualAverage = Number(existing.fabricConsumed) / totalCut;
    }

    // Calculate variance
    let varianceFromCad: number | null = null;
    let variancePercent: number | null = null;
    if (calcActualAverage && Number(existing.cadAverageUsed) > 0) {
      varianceFromCad = calcActualAverage - Number(existing.cadAverageUsed);
      variancePercent = (varianceFromCad / Number(existing.cadAverageUsed)) * 100;
    }

    const batch = await prisma.cutting_batches.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualAverage: calcActualAverage,
        varianceFromCad,
        variancePercent,
        remarks: remarks || existing.remarks,
      },
      include: batchIncludeOptions,
    });

    res.json({ data: transformCuttingBatch(batch) });
  } catch (error) {
    console.error('Error completing cutting batch:', error);
    res.status(500).json({ error: 'Failed to complete cutting batch' });
  }
};

// Put batch on hold
export const holdCuttingBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const existing = await prisma.cutting_batches.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cutting batch not found' });
    }

    if (existing.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot put completed batches on hold' });
    }

    const batch = await prisma.cutting_batches.update({
      where: { id },
      data: {
        status: 'ON_HOLD',
        remarks: reason,
      },
      include: batchIncludeOptions,
    });

    res.json({ data: transformCuttingBatch(batch) });
  } catch (error) {
    console.error('Error holding cutting batch:', error);
    res.status(500).json({ error: 'Failed to put cutting batch on hold' });
  }
};

// Resume cutting batch (ON_HOLD -> IN_PROGRESS)
export const resumeCuttingBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.cutting_batches.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cutting batch not found' });
    }

    if (existing.status !== 'ON_HOLD') {
      return res.status(400).json({ error: 'Can only resume batches that are on hold' });
    }

    const batch = await prisma.cutting_batches.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
      include: batchIncludeOptions,
    });

    res.json({ data: transformCuttingBatch(batch) });
  } catch (error) {
    console.error('Error resuming cutting batch:', error);
    res.status(500).json({ error: 'Failed to resume cutting batch' });
  }
};

// Cancel cutting batch
export const cancelCuttingBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const existing = await prisma.cutting_batches.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cutting batch not found' });
    }

    if (existing.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot cancel completed batches' });
    }

    const batch = await prisma.cutting_batches.update({
      where: { id },
      data: {
        status: 'ON_HOLD',
        remarks: reason ? `CANCELLED: ${reason}` : 'CANCELLED',
      },
      include: batchIncludeOptions,
    });

    res.json({ data: transformCuttingBatch(batch) });
  } catch (error) {
    console.error('Error cancelling cutting batch:', error);
    res.status(500).json({ error: 'Failed to cancel cutting batch' });
  }
};

// Generate transfer slip
export const generateTransferSlip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const batch = await prisma.cutting_batches.findUnique({
      where: { id },
      include: {
        workOrder: true,
        skuOutputs: true,
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Cutting batch not found' });
    }

    if (batch.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Can only generate transfer slip for completed batches' });
    }

    // Generate slip number
    const today = new Date();
    const datePrefix = `TS-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
    const existingSlips = await prisma.transfer_slips.count({
      where: {
        slipNumber: { startsWith: datePrefix },
      },
    });
    const slipNumber = `${datePrefix}-${(existingSlips + 1).toString().padStart(4, '0')}`;

    // Calculate total quantity
    const totalGoodPieces = batch.skuOutputs.reduce((sum: number, sku) => sum + sku.goodPcs, 0);

    // Create transfer slip
    const transferSlip = await prisma.transfer_slips.create({
      data: {
        slipNumber,
        transferDate: today,
        workOrderId: batch.workOrderId,
        componentId: batch.componentId,
        fromStage: 'CUTTING',
        toStage: 'STITCHING',
        fromDepartment: 'Cutting',
        toDepartment: 'Stitching',
        totalGoodPieces,
        status: 'CREATED',
        cuttingBatchId: id,
        preparedById: userId,
        skuBreakdown: {
          create: batch.skuOutputs
            .filter((sku) => sku.goodPcs > 0)
            .map((sku) => ({
              colorId: sku.colorId,
              sizeId: sku.sizeId,
              quantity: sku.goodPcs,
            })),
        },
      },
    });

    res.json({
      data: {
        transferSlipId: transferSlip.id,
        slipNumber: transferSlip.slipNumber,
      },
    });
  } catch (error) {
    console.error('Error generating transfer slip:', error);
    res.status(500).json({ error: 'Failed to generate transfer slip' });
  }
};

// ============================================
// Summary Endpoints
// ============================================

export const getSummary = async (req: Request, res: Response) => {
  try {
    const [statusCounts, totals, byWorkOrder] = await Promise.all([
      // Status counts
      prisma.cutting_batches.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      // Total fabric consumed
      prisma.cutting_batches.aggregate({
        _sum: {
          fabricConsumed: true,
          layersPerLay: true,
          numberOfLays: true,
        },
      }),
      // By work order
      prisma.cutting_batches.groupBy({
        by: ['workOrderId'],
        _count: { id: true },
      }),
    ]);

    // Get work order details
    const workOrderIds = byWorkOrder.map((wo) => wo.workOrderId);
    const workOrders = await prisma.work_orders.findMany({
      where: { id: { in: workOrderIds } },
      include: { styles: true },
    });

    const workOrderMap = new Map(workOrders.map((wo) => [wo.id, wo]));

    // Calculate total cut pieces
    const skuTotals = await prisma.cutting_batch_skus.aggregate({
      _sum: {
        cutQty: true,
        toCut: true,
      },
    });

    res.json({
      data: {
        total: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
        pending: statusCounts.find((s) => s.status === 'PENDING')?._count.id || 0,
        inProgress: statusCounts.find((s) => s.status === 'IN_PROGRESS')?._count.id || 0,
        completed: statusCounts.find((s) => s.status === 'COMPLETED')?._count.id || 0,
        onHold: statusCounts.find((s) => s.status === 'ON_HOLD')?._count.id || 0,
        totalPcsPlanned: Number(skuTotals._sum?.toCut || 0),
        totalPcsCut: Number(skuTotals._sum?.cutQty || 0),
        totalFabricConsumed: Number(totals._sum?.fabricConsumed || 0),
        byWorkOrder: byWorkOrder.map((wo) => {
          const workOrder = workOrderMap.get(wo.workOrderId);
          return {
            workOrderId: wo.workOrderId,
            workOrderNumber: workOrder?.workOrderNumber || 'Unknown',
            styleName: workOrder?.styles?.styleName || 'Unknown',
            batchCount: wo._count.id,
          };
        }),
      },
    });
  } catch (error) {
    console.error('Error fetching cutting summary:', error);
    res.status(500).json({ error: 'Failed to fetch cutting summary' });
  }
};

export const getSummaryByWorkOrder = async (req: Request, res: Response) => {
  try {
    const { workOrderId } = req.params;

    const [statusCounts, totals, batches] = await Promise.all([
      prisma.cutting_batches.groupBy({
        by: ['status'],
        where: { workOrderId },
        _count: { id: true },
      }),
      prisma.cutting_batches.aggregate({
        where: { workOrderId },
        _sum: {
          fabricConsumed: true,
        },
      }),
      prisma.cutting_batches.findMany({
        where: { workOrderId },
        include: {
          skuOutputs: true,
        },
      }),
    ]);

    const totalCut = batches.reduce(
      (sum, batch) => sum + batch.skuOutputs.reduce((s, sku) => s + sku.cutQty, 0),
      0
    );

    const totalPlanned = batches.reduce(
      (sum, batch) => sum + batch.skuOutputs.reduce((s, sku) => s + sku.toCut, 0),
      0
    );

    res.json({
      data: {
        total: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
        pending: statusCounts.find((s) => s.status === 'PENDING')?._count.id || 0,
        inProgress: statusCounts.find((s) => s.status === 'IN_PROGRESS')?._count.id || 0,
        completed: statusCounts.find((s) => s.status === 'COMPLETED')?._count.id || 0,
        onHold: statusCounts.find((s) => s.status === 'ON_HOLD')?._count.id || 0,
        totalPcsPlanned: totalPlanned,
        totalPcsCut: totalCut,
        totalFabricConsumed: Number(totals._sum?.fabricConsumed || 0),
        byWorkOrder: [],
      },
    });
  } catch (error) {
    console.error('Error fetching cutting summary by work order:', error);
    res.status(500).json({ error: 'Failed to fetch cutting summary' });
  }
};

// Get available work orders for cutting
export const getAvailableWorkOrders = async (req: Request, res: Response) => {
  try {
    const workOrders = await prisma.work_orders.findMany({
      where: {
        status: {
          in: ['IN_PRODUCTION', 'PENDING'],
        },
      },
      include: {
        styles: {
          include: {
            style_components: {
              include: {
                style_fabrics: {
                  select: {
                    id: true,
                    fabricId: true,
                    fabricName: true,
                    componentId: true,
                  },
                },
              },
            },
          },
        },
        work_order_breakup: {
          include: {
            color_options: { select: { id: true, colorName: true } },
          },
        },
        cutting_batches: {
          include: {
            skuOutputs: true,
          },
        },
      },
    });

    const result = workOrders.map((wo) => {
      const cutQty = wo.cutting_batches.reduce(
        (sum, batch) => sum + batch.skuOutputs.reduce((s, sku) => s + sku.goodPcs, 0),
        0
      );

      // Collect unique fabricIds from style_components → style_fabrics
      const fabricIds = [
        ...new Set(
          wo.styles?.style_components?.flatMap((c: any) =>
            c.style_fabrics?.map((sf: any) => sf.fabricId).filter(Boolean) || []
          ) || []
        ),
      ];

      // Collect unique colors from work_order_breakup
      const colors = [
        ...new Map(
          wo.work_order_breakup
            ?.filter((b: any) => b.color_options)
            .map((b: any) => [b.color_options.id, { id: b.color_options.id, colorName: b.color_options.colorName }])
        ).values(),
      ];

      // Collect components
      const components = wo.styles?.style_components?.map((c: any) => ({
        id: c.id,
        componentName: c.componentName,
        componentType: c.componentType,
      })) || [];

      return {
        id: wo.id,
        workOrderNumber: wo.workOrderNumber,
        styleId: wo.styleId,
        styleCode: wo.styles?.styleCode || '',
        styleName: wo.styles?.styleName || '',
        orderQty: wo.totalQuantity,
        cutQty,
        pendingQty: wo.totalQuantity - cutQty,
        fabricIds,
        colors,
        components,
      };
    }).filter((wo) => wo.pendingQty > 0);

    res.json({ data: result });
  } catch (error) {
    console.error('Error fetching available work orders:', error);
    res.status(500).json({ error: 'Failed to fetch available work orders' });
  }
};

// Get available fabric stock for cutting
export const getAvailableFabricStock = async (req: Request, res: Response) => {
  try {
    const { fabricId } = req.params;

    const stock = await prisma.fabric_stock.findMany({
      where: {
        fabricId,
        quantityAvailable: { gt: 0 },
      },
      select: {
        id: true,
        rollNumbers: true,
        quantityAvailable: true,
        finishedWidth: true,
        cutableWidth: true,
        qualityGrade: true,
        weightedAvgCost: true,
        fabricMaster: {
          select: { id: true, fabricCode: true, fabricName: true },
        },
      },
    });

    res.json({
      data: stock.map((s) => ({
        id: s.id,
        rollNumbers: s.rollNumbers || '',
        quantityAvailable: Number(s.quantityAvailable),
        finishedWidth: Number(s.finishedWidth),
        cutableWidth: Number(s.cutableWidth),
        qualityGrade: s.qualityGrade,
        weightedAvgCost: Number(s.weightedAvgCost),
        fabricName: s.fabricMaster?.fabricName || '',
      })),
    });
  } catch (error) {
    console.error('Error fetching available fabric stock:', error);
    res.status(500).json({ error: 'Failed to fetch available fabric stock' });
  }
};

// ============================================
// Cutting Chart Data — Shared aggregation
// ============================================

export async function buildCuttingChartData(workOrderId: string, colorId?: string) {

    // 1. Fetch work order with all related data
    const workOrder = await prisma.work_orders.findUnique({
      where: { id: workOrderId },
      include: {
        orders: {
          include: {
            customers: { select: { id: true, name: true, brandNames: true } },
          },
        },
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
            imageUrl: true,
            brandName: true,
          },
        },
        work_order_breakup: {
          include: {
            color_options: { select: { id: true, colorName: true, colorCode: true } },
            size_options: { select: { id: true, sizeName: true, sortOrder: true } },
          },
        },
        cutting_batches: {
          select: {
            id: true,
            batchNumber: true,
            status: true,
            skuOutputs: {
              select: { cutQty: true, goodPcs: true, colorId: true },
            },
          },
        },
      },
    });

    if (!workOrder) {
      throw new Error('Work order not found');
    }

    // 2. Resolve breakup data — use work_order_breakup, or backfill from order_item_breakup
    let breakupData = workOrder.work_order_breakup as Array<{
      id: string;
      colorId: string | null;
      sizeId: string;
      plannedQuantity: number;
      completedQuantity: number;
      color_options: { id: string; colorName: string; colorCode: string | null } | null;
      size_options: { id: string; sizeName: string; sortOrder: number };
    }>;

    // Backfill: if work_order_breakup is empty, try order_item_breakup
    if (breakupData.length === 0 && workOrder.orderItemId) {
      const orderItem = await prisma.order_items.findUnique({
        where: { id: workOrder.orderItemId },
        include: {
          order_item_breakup: {
            include: {
              color_options: { select: { id: true, colorName: true, colorCode: true } },
              size_options: { select: { id: true, sizeName: true, sortOrder: true } },
            },
          },
        },
      });
      if (orderItem?.order_item_breakup?.length) {
        breakupData = orderItem.order_item_breakup.map((b) => ({
          id: b.id,
          colorId: b.colorId,
          sizeId: b.sizeId,
          plannedQuantity: b.quantity,
          completedQuantity: 0,
          color_options: b.color_options,
          size_options: b.size_options,
        }));
      }
    }

    // Filter breakup by colorId if provided
    let breakup = breakupData;
    if (colorId) {
      breakup = breakup.filter((b) => b.colorId === colorId);
    }

    // Get unique colors from breakup
    const uniqueColors = [
      ...new Map(
        breakupData
          .filter((b) => b.color_options)
          .map((b) => [b.color_options!.id, b.color_options!])
      ).values(),
    ];

    // Build size breakdown for the selected color
    const sizes = breakup
      .filter((b) => b.size_options)
      .map((b) => ({
        sizeId: b.sizeId,
        sizeName: b.size_options.sizeName,
        sortOrder: b.size_options.sortOrder,
        orderQty: b.plannedQuantity,
        completedQty: b.completedQuantity,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // Use workOrder.totalQuantity as the authoritative order qty
    const totalOrderQty = workOrder.totalQuantity;

    // Calculate ratios
    const sizesWithRatio = sizes.map((s) => ({
      ...s,
      ratio: totalOrderQty > 0 ? Math.round((s.orderQty / totalOrderQty) * 100) : 0,
    }));

    // 3. Fetch CAD rows for the style — search all 3 linking paths
    const cadRows = await prisma.fabric_width_cad.findMany({
      where: {
        OR: [
          { costingStyleId: workOrder.styleId },
          { styleFabric: { style_components: { styleId: workOrder.styleId } } },
          { styleCosting: { styleId: workOrder.styleId } },
        ],
      },
      select: {
        id: true,
        componentName: true,
        purpose: true,
        purposeEnum: true,
        cutableWidth: true,
        cadMeters: true,
        cadAverage: true,
        fabricId: true,
        fabric: {
          select: { id: true, fabricCode: true, fabricName: true },
        },
        batchGroupColor: {
          select: { id: true, colorName: true },
        },
        styleFabric: {
          select: { fabricId: true, fabricName: true, fabricColor: true, cutableWidth: true },
        },
        costingFabricItems: {
          select: {
            id: true,
            width: true,
            cadMeters: true,
            costPerMeter: true,
            colorName: true,
          },
        },
      },
    });

    // Group CAD rows by componentName (= "Part")
    const partMap = new Map<string, {
      part: string;
      fabricId: string | null;
      fabricName: string;
      fabricCode: string;
      costingWidth: number | null;
      costingAverage: number | null;
      rawMatCalcWidth: number | null;
      rawMatCalcAverage: number | null;
      productionWidth: number | null;
      productionAverage: number | null;
      fabricColor: string | null;
    }>();

    for (const cad of cadRows) {
      const partKey = cad.componentName || 'Main';
      // Resolve fabricId: direct → styleFabric fallback
      const resolvedFabricId = cad.fabricId || cad.styleFabric?.fabricId || null;
      const resolvedFabricName = cad.fabric?.fabricName || cad.styleFabric?.fabricName || '';
      const resolvedFabricCode = cad.fabric?.fabricCode || '';
      // Color priority: batch group color → costing item color → style fabric color
      const resolvedColor = cad.batchGroupColor?.colorName
        || cad.costingFabricItems?.[0]?.colorName
        || cad.styleFabric?.fabricColor
        || null;

      if (!partMap.has(partKey)) {
        partMap.set(partKey, {
          part: partKey,
          fabricId: resolvedFabricId,
          fabricName: resolvedFabricName,
          fabricCode: resolvedFabricCode,
          costingWidth: null,
          costingAverage: null,
          rawMatCalcWidth: null,
          rawMatCalcAverage: null,
          productionWidth: null,
          productionAverage: null,
          fabricColor: resolvedColor,
        });
      }

      const entry = partMap.get(partKey)!;
      const width = cad.cutableWidth ? Number(cad.cutableWidth) : null;
      const avg = cad.cadAverage ? Number(cad.cadAverage) : null;

      const cadPurpose = cad.purposeEnum || cad.purpose;
      switch (cadPurpose) {
        case 'COSTING':
          entry.costingWidth = width;
          entry.costingAverage = avg;
          break;
        case 'RAW_MATERIAL_CALCULATION':
          entry.rawMatCalcWidth = width;
          entry.rawMatCalcAverage = avg;
          break;
        case 'PRODUCTION':
          entry.productionWidth = width;
          entry.productionAverage = avg;
          break;
      }

      // Update fabricId if not set
      if (!entry.fabricId && resolvedFabricId) {
        entry.fabricId = resolvedFabricId;
        entry.fabricName = resolvedFabricName;
        entry.fabricCode = resolvedFabricCode;
      }
      // Update color if not set
      if (!entry.fabricColor && resolvedColor) {
        entry.fabricColor = resolvedColor;
      }
    }

    // 3b. Enrich from order_bom_items (fabric requirements for this order)
    if (workOrder.orderId) {
      const orderBom = await prisma.order_bom.findFirst({
        where: { orderId: workOrder.orderId, styleId: workOrder.styleId, isActive: true },
        include: {
          items: {
            where: { materialType: { in: ['GREIGE_FABRIC', 'FINISHED_FABRIC'] } },
            select: {
              fabricId: true,
              componentName: true,
              totalWithWastage: true,
              sourcingStrategy: true,
              fabric_master: { select: { id: true, fabricCode: true, fabricName: true } },
            },
          },
        },
      });

      if (orderBom?.items) {
        for (const bomItem of orderBom.items) {
          if (!bomItem.fabricId) continue;

          // Match by fabricId first to avoid duplicates from mismatched componentName keys
          let matched = false;
          for (const [, entry] of partMap.entries()) {
            if (entry.fabricId && entry.fabricId === bomItem.fabricId) {
              // Same fabric already exists — enrich if missing data
              if (!entry.fabricName && bomItem.fabric_master?.fabricName) {
                entry.fabricName = bomItem.fabric_master.fabricName;
              }
              if (!entry.fabricCode && bomItem.fabric_master?.fabricCode) {
                entry.fabricCode = bomItem.fabric_master.fabricCode;
              }
              matched = true;
              break;
            }
          }

          if (!matched) {
            // No fabricId match — try enriching "Main" entry if it has no fabricId
            const mainEntry = partMap.get('Main');
            if (mainEntry && !mainEntry.fabricId) {
              mainEntry.fabricId = bomItem.fabricId;
              mainEntry.fabricName = bomItem.fabric_master?.fabricName || '';
              mainEntry.fabricCode = bomItem.fabric_master?.fabricCode || '';
              matched = true;
            }
          }

          if (!matched) {
            // Only add new entry if this fabricId doesn't exist anywhere in partMap
            const fabricIdExists = Array.from(partMap.values()).some(e => e.fabricId === bomItem.fabricId);
            if (!fabricIdExists) {
              const partKey = bomItem.componentName || 'Main';
              partMap.set(partKey, {
                part: partKey,
                fabricId: bomItem.fabricId,
                fabricName: bomItem.fabric_master?.fabricName || '',
                fabricCode: bomItem.fabric_master?.fabricCode || '',
                costingWidth: null,
                costingAverage: null,
                rawMatCalcWidth: null,
                rawMatCalcAverage: null,
                productionWidth: null,
                productionAverage: null,
                fabricColor: null,
              });
            }
          }
        }
      }
    }

    // 3c. Fallback to style_fabrics if partMap still has no fabricId entries
    const hasFabricIds = Array.from(partMap.values()).some(f => f.fabricId);
    if (!hasFabricIds) {
      const styleFabrics = await prisma.style_fabrics.findMany({
        where: { style_components: { styleId: workOrder.styleId } },
        select: {
          fabricId: true,
          fabricName: true,
          fabricColor: true,
          style_components: { select: { componentName: true } },
        },
      });
      for (const sf of styleFabrics) {
        if (!sf.fabricId) continue;

        // Match by fabricId first to avoid duplicates
        let matched = false;
        for (const [, entry] of partMap.entries()) {
          if (entry.fabricId && entry.fabricId === sf.fabricId) {
            // Same fabric — enrich color if missing
            if (!entry.fabricColor && sf.fabricColor) entry.fabricColor = sf.fabricColor;
            if (!entry.fabricName && sf.fabricName) entry.fabricName = sf.fabricName;
            matched = true;
            break;
          }
        }

        if (!matched) {
          // Try enriching "Main" entry if it has no fabricId
          const mainEntry = partMap.get('Main');
          if (mainEntry && !mainEntry.fabricId) {
            mainEntry.fabricId = sf.fabricId;
            mainEntry.fabricName = sf.fabricName || '';
            if (!mainEntry.fabricColor) mainEntry.fabricColor = sf.fabricColor || null;
            matched = true;
          }
        }

        if (!matched) {
          // Only add if this fabricId doesn't exist anywhere in partMap
          const fabricIdExists = Array.from(partMap.values()).some(e => e.fabricId === sf.fabricId);
          if (!fabricIdExists) {
            const partKey = sf.style_components?.componentName || 'Main';
            partMap.set(partKey, {
              part: partKey,
              fabricId: sf.fabricId,
              fabricName: sf.fabricName || '',
              fabricCode: '',
              costingWidth: null,
              costingAverage: null,
              rawMatCalcWidth: null,
              rawMatCalcAverage: null,
              productionWidth: null,
              productionAverage: null,
              fabricColor: sf.fabricColor || null,
            });
          }
        }
      }
    }

    const fabrics = Array.from(partMap.values());

    // 4. For each unique fabricId, get PO ordered qty, GRN received qty, and fabric stock lots
    const uniqueFabricIds = [...new Set(fabrics.map((f) => f.fabricId).filter(Boolean))] as string[];

    // Get materials that link to these fabrics (materials.fabricId → purchase_order_items)
    const materialsWithFabric = await prisma.materials.findMany({
      where: { fabricId: { in: uniqueFabricIds } },
      select: {
        id: true,
        fabricId: true,
        purchase_order_items: {
          select: {
            id: true,
            orderedQuantity: true,
            receivedQuantity: true,
            grn_items: {
              select: {
                acceptedQuantity: true,
              },
            },
          },
        },
      },
    });

    // Build fabric ordered/received maps
    const fabricOrderedMap = new Map<string, number>();
    const fabricReceivedMap = new Map<string, number>();
    for (const mat of materialsWithFabric) {
      if (!mat.fabricId) continue;
      const ordered = mat.purchase_order_items.reduce(
        (sum, poi) => sum + Number(poi.orderedQuantity),
        0
      );
      const received = mat.purchase_order_items.reduce(
        (sum, poi) => sum + poi.grn_items.reduce(
          (gSum, gi) => gSum + Number(gi.acceptedQuantity), 0
        ),
        0
      );
      fabricOrderedMap.set(
        mat.fabricId,
        (fabricOrderedMap.get(mat.fabricId) || 0) + ordered
      );
      fabricReceivedMap.set(
        mat.fabricId,
        (fabricReceivedMap.get(mat.fabricId) || 0) + received
      );
    }

    // Get fabric stock lots for each fabricId
    const fabricStockRecords = await prisma.fabric_stock.findMany({
      where: {
        fabricId: { in: uniqueFabricIds },
        quantityAvailable: { gt: 0 },
      },
      select: {
        id: true,
        fabricId: true,
        rollNumbers: true,
        cutableWidth: true,
        quantityAvailable: true,
        qualityGrade: true,
        plannedCad: true,
        actualCad: true,
      },
      orderBy: { receivedDate: 'desc' },
    });

    const fabricStockMap = new Map<string, typeof fabricStockRecords>();
    for (const fs of fabricStockRecords) {
      if (!fabricStockMap.has(fs.fabricId)) {
        fabricStockMap.set(fs.fabricId, []);
      }
      fabricStockMap.get(fs.fabricId)!.push(fs);
    }

    // 5. Build fabric details array (per part)
    const fabricDetails = fabrics.map((f) => {
      const ordered = f.fabricId ? (fabricOrderedMap.get(f.fabricId) || 0) : 0;
      const received = f.fabricId ? (fabricReceivedMap.get(f.fabricId) || 0) : 0;
      const stocks = f.fabricId ? (fabricStockMap.get(f.fabricId) || []) : [];
      const cutableQty = stocks.reduce((sum, s) => sum + Number(s.quantityAvailable), 0);

      return {
        part: f.part,
        fabric: f.fabricName,
        fabricId: f.fabricId,
        fabricOrdered: ordered,
        fabricReceived: received,
        cutableQty,
        extraShortage: received - ordered,
      };
    });

    // 6. Build fabrics with lot details
    const fabricsWithLots = fabrics.map((f) => {
      const stocks = f.fabricId ? (fabricStockMap.get(f.fabricId) || []) : [];
      return {
        ...f,
        lots: stocks.map((s, idx) => ({
          lotId: s.id,
          lotNumber: idx + 1,
          rollNumbers: s.rollNumbers || '',
          actualWidth: Number(s.cutableWidth),
          quantityAvailable: Number(s.quantityAvailable),
          qualityGrade: s.qualityGrade,
        })),
      };
    });

    // 7. Existing batches for this WO (optionally filter by color)
    let existingBatches = workOrder.cutting_batches.map((b) => {
      const totalCut = b.skuOutputs.reduce((sum, s) => sum + s.cutQty, 0);
      return {
        id: b.id,
        batchNumber: b.batchNumber,
        status: b.status,
        totalCut,
      };
    });

    // Get selected color name
    const selectedColor = colorId
      ? uniqueColors.find((c) => c.id === colorId)
      : null;

    // 8. Build response
    const chartData = {
      // Header Info
      buyer: workOrder.orders?.customers?.name || '',
      brand: workOrder.styles?.brandName || workOrder.orders?.customers?.brandNames || '',
      style: workOrder.styles?.styleCode || '',
      styleName: workOrder.styles?.styleName || '',
      styleImage: workOrder.styles?.imageUrl || '',
      workOrderNumber: workOrder.workOrderNumber,
      workOrderId: workOrder.id,
      orderQty: workOrder.totalQuantity,
      color: selectedColor?.colorName || 'All Colors',
      colorId: colorId || null,
      cuttingDate: new Date().toISOString().split('T')[0],

      // Available colors for this work order
      availableColors: uniqueColors.map((c) => ({
        id: c.id,
        colorName: c.colorName,
        colorCode: c.colorCode,
      })),

      // Size Breakdown
      sizes: sizesWithRatio,
      totalOrderQty,

      // Fabric Details (per part)
      fabricDetails,

      // Fabrics & CAD (per part with lot details)
      fabrics: fabricsWithLots,

      // Existing batches
      existingBatches,
    };

    return chartData;
}

// ============================================
// Cutting Chart Data Endpoint
// ============================================

export const getCuttingChartData = async (req: Request, res: Response) => {
  try {
    const { workOrderId } = req.params;
    const { colorId } = req.query;
    const chartData = await buildCuttingChartData(workOrderId, colorId as string | undefined);
    res.json({ data: chartData });
  } catch (error) {
    console.error('Error fetching cutting chart data:', error);
    res.status(500).json({ error: 'Failed to fetch cutting chart data' });
  }
};
