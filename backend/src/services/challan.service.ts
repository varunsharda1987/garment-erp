import { ChallanType, ChallanStatus, Prisma, MovementType, Unit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { logWarn } from '../utils/logger';
import greigeStockService from './greige-stock.service';
import fabricStockService from './fabric-stock.service';
import stockMovementService from './stockMovement.service';
import { syncStockLevelQuantity } from './helpers/material-sync.helper';

// ============================================
// TYPES
// ============================================

export interface CreateChallanItemInput {
  itemType: string;
  materialId?: string;
  fabricId?: string;
  description: string;
  quantity: number;
  unit?: string;
  colorId?: string;
  sizeId?: string;
  rate?: number;
  remarks?: string;
  greigeStockId?: string;
  fabricStockId?: string;
  laceStockId?: string;
  threadStockId?: string;
  materialRequirementId?: string;
  serviceRequirementId?: string;
  foldLengthCm?: number;
  thanCount?: number;
  componentName?: string;
  colorName?: string;
}

export interface CreateChallanInput {
  challanType: ChallanType;
  challanDate?: Date;
  orderId?: string;
  productionRunId?: string;
  purchaseOrderId?: string;
  fabricProcessingId?: string;
  fromType: string;
  fromId?: string;
  fromName: string;
  toType: string;
  toId?: string;
  toName: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  lrNumber?: string;
  expectedDate?: Date;
  unit?: string;
  remarks?: string;
  issuedById: string;
  items: CreateChallanItemInput[];
}

export interface ChallanFilters {
  challanType?: ChallanType;
  status?: ChallanStatus;
  orderId?: string;
  productionRunId?: string;
  purchaseOrderId?: string;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ReceiveChallanInput {
  receivedById: string;
  receivedDate?: Date;
  items: {
    challanItemId: string;
    receivedQty: number;
    damagedQty?: number;
    remarks?: string;
  }[];
  remarks?: string;
}

// ============================================
// CHALLAN NUMBER GENERATION
// ============================================

async function generateChallanNumber(tx?: Prisma.TransactionClient): Promise<string> {
  const client = tx || prisma;
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `CH${year}${month}`;

  const lastChallan = await client.challans.findFirst({
    where: { challanNumber: { startsWith: prefix } },
    orderBy: { challanNumber: 'desc' },
    select: { challanNumber: true },
  });

  let sequence = 1;
  if (lastChallan?.challanNumber) {
    const parts = lastChallan.challanNumber.split('-');
    if (parts.length === 2) {
      const lastSequence = parseInt(parts[1], 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
}

// ============================================
// CRUD OPERATIONS
// ============================================

export async function createChallan(input: CreateChallanInput) {
  return prisma.$transaction(async (tx) => {
    const challanNumber = await generateChallanNumber(tx);

    const totalQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0);

    const challan = await tx.challans.create({
      data: {
        id: randomUUID(),
        challanNumber,
        challanType: input.challanType,
        challanDate: input.challanDate || new Date(),
        orderId: input.orderId,
        productionRunId: input.productionRunId,
        purchaseOrderId: input.purchaseOrderId,
        fabricProcessingId: input.fabricProcessingId,
        fromType: input.fromType,
        fromId: input.fromId,
        fromName: input.fromName,
        toType: input.toType,
        toId: input.toId,
        toName: input.toName,
        vehicleNumber: input.vehicleNumber,
        driverName: input.driverName,
        driverPhone: input.driverPhone,
        lrNumber: input.lrNumber,
        status: 'DRAFT',
        expectedDate: input.expectedDate,
        totalItems: input.items.length,
        totalQuantity,
        unit: input.unit || Unit.PIECE,
        remarks: input.remarks,
        issuedById: input.issuedById,
        items: {
          create: input.items.map((item) => ({
            id: randomUUID(),
            itemType: item.itemType,
            materialId: item.materialId,
            fabricId: item.fabricId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || Unit.PIECE,
            colorId: item.colorId,
            sizeId: item.sizeId,
            rate: item.rate,
            remarks: item.remarks,
            greigeStockId: item.greigeStockId,
            fabricStockId: item.fabricStockId,
            laceStockId: item.laceStockId,
            threadStockId: item.threadStockId,
            materialRequirementId: item.materialRequirementId,
            serviceRequirementId: item.serviceRequirementId,
            componentName: item.componentName || null,
            colorName: item.colorName || null,
            foldLengthCm: item.foldLengthCm,
            thanCount: item.thanCount,
          })),
        },
      },
      include: {
        items: true,
        order: { select: { id: true, orderNumber: true } },
        productionRun: { select: { id: true, workOrderNumber: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return challan;
  });
}

export async function issueChallan(id: string, userId?: string) {
  return prisma.$transaction(async (tx) => {
    // Fetch challan with items to check for stock links
    const existing = await tx.challans.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) throw new Error('Challan not found');
    if (existing.status !== 'DRAFT') throw new Error('Only DRAFT challans can be issued');

    // Auto-deduct stock for OUTWARD and INTERNAL challans based on stock type
    if (existing.challanType === 'OUTWARD' || existing.challanType === 'INTERNAL') {
      const effectiveUserId = userId || existing.issuedById;

      for (const item of existing.items) {
        const qty = Number(item.quantity);

        // 1. Greige stock deduction + transfer to processor warehouse
        if (item.greigeStockId) {
          // Get original stock details before consuming
          const originalStock = await tx.greige_stock.findUnique({
            where: { id: item.greigeStockId },
            include: { greige: true },
          });

          // Consume from source warehouse — pass the outer tx so the consumption rolls back with the
          // challan if issuance later fails (was on the global client → stock deducted with no challan; F4).
          await greigeStockService.consumeGreigeStock(item.greigeStockId, qty, effectiveUserId, tx);

          // If OUTWARD to a processor, create stock at processor's warehouse
          if (existing.challanType === 'OUTWARD' && existing.toType === 'SUPPLIER' && existing.toId && originalStock) {
            // Find processor's warehouse (linked by supplierId)
            const processorWarehouse = await tx.warehouses.findFirst({
              where: { supplierId: existing.toId },
            });

            if (processorWarehouse) {
              // Create new greige stock entry at processor's warehouse
              await tx.greige_stock.create({
                data: {
                  greigeId: originalStock.greigeId,
                  quantityAvailable: new Prisma.Decimal(qty),
                  quantityReserved: new Prisma.Decimal(0),
                  quantityConsumed: new Prisma.Decimal(0),
                  unit: originalStock.unit,
                  greigeWidth: originalStock.greigeWidth,
                  cutableWidth: originalStock.cutableWidth,
                  purchaseCost: originalStock.purchaseCost,
                  weightedAvgCost: originalStock.weightedAvgCost,
                  supplierId: originalStock.supplierId, // Preserve original supplier (who SOLD the greige)
                  processorId: existing.toId, // Track processor currently holding the stock
                  procurementId: originalStock.procurementId, // Preserve procurement link
                  sourceChallanId: existing.id,
                  sourceType: 'TRANSFER',
                  warehouseLocation: processorWarehouse.warehouseName,
                  qualityGrade: originalStock.qualityGrade,
                  receivedDate: new Date(),
                  status: 'AVAILABLE',
                  stockType: 'GENERIC',
                  createdById: effectiveUserId,
                },
              });

              // Create audit trail for the transfer
              await tx.greige_stock_transaction.create({
                data: {
                  stockId: item.greigeStockId,
                  transactionType: 'TRANSFER_OUT',
                  quantity: new Prisma.Decimal(-qty),
                  balanceAfter: new Prisma.Decimal(0), // Will be updated by consumeGreigeStock
                  referenceType: 'CHALLAN',
                  referenceId: existing.id,
                  notes: `Transferred to processor ${existing.toName} via challan ${existing.challanNumber}`,
                  performedById: effectiveUserId,
                },
              });
            }
          }
        }

        // 2. Fabric stock deduction
        if (item.fabricStockId) {
          const fabricStock = await tx.fabric_stock.findUnique({
            where: { id: item.fabricStockId },
          });
          if (!fabricStock) throw new Error(`Fabric stock ${item.fabricStockId} not found`);
          const newAvailable = Number(fabricStock.quantityAvailable) - qty;
          if (newAvailable < 0)
            throw new Error(
              `Insufficient fabric stock. Available: ${fabricStock.quantityAvailable}, Requested: ${qty}`
            );

          await tx.fabric_stock.update({
            where: { id: item.fabricStockId },
            data: {
              quantityAvailable: new Prisma.Decimal(newAvailable),
              quantityConsumed: new Prisma.Decimal(Number(fabricStock.quantityConsumed) + qty),
              lastConsumedDate: new Date(),
              status: newAvailable <= 0 ? 'EXHAUSTED' : 'AVAILABLE',
            },
          });

          // Sync stock_levels
          const fabMaterial = await tx.materials.findFirst({
            where: { fabricId: fabricStock.fabricId },
            select: { id: true },
          });
          if (fabMaterial) await syncStockLevelQuantity(fabMaterial.id, -qty, undefined, 'METER', tx);
        }

        // 3. Lace stock deduction
        if (item.laceStockId) {
          const laceStock = await tx.lace_stock.findUnique({
            where: { id: item.laceStockId },
          });
          if (!laceStock) throw new Error(`Lace stock ${item.laceStockId} not found`);
          const newAvailable = Number(laceStock.quantityAvailable) - qty;
          if (newAvailable < 0)
            throw new Error(`Insufficient lace stock. Available: ${laceStock.quantityAvailable}, Requested: ${qty}`);

          await tx.lace_stock.update({
            where: { id: item.laceStockId },
            data: {
              quantityAvailable: new Prisma.Decimal(newAvailable),
              quantityConsumed: new Prisma.Decimal(Number(laceStock.quantityConsumed) + qty),
              lastConsumedDate: new Date(),
              status: newAvailable <= 0 ? 'ISSUED' : 'AVAILABLE',
            },
          });

          // Audit trail
          await tx.lace_stock_transaction.create({
            data: {
              stockId: item.laceStockId,
              transactionType: 'CONSUMPTION',
              quantity: -qty,
              balanceAfter: newAvailable,
              referenceType: 'CHALLAN',
              referenceId: existing.id,
              notes: `Issued via challan ${existing.challanNumber}`,
              performedById: effectiveUserId,
            },
          });

          // Sync stock_levels
          if (laceStock.laceId) await syncStockLevelQuantity(laceStock.laceId, -qty, undefined, 'METER', tx);
        }

        // 4. Thread stock deduction
        if (item.threadStockId) {
          const threadStock = await tx.thread_stock.findUnique({
            where: { id: item.threadStockId },
          });
          if (!threadStock) throw new Error(`Thread stock ${item.threadStockId} not found`);
          const newAvailable = Number(threadStock.quantityAvailable) - qty;
          if (newAvailable < 0)
            throw new Error(
              `Insufficient thread stock. Available: ${threadStock.quantityAvailable}, Requested: ${qty}`
            );

          // Recalculate derived quantities from packaging specs
          const spec = await tx.thread_packaging_specs.findFirst({
            where: {
              ply: threadStock.ply || undefined,
              packagingType: threadStock.packagingType || undefined,
              isActive: true,
            },
          });
          const newMeters = spec ? newAvailable * Number(spec.metersPerUnit) : null;
          const newBoxes = spec && spec.unitsPerBox > 0 ? newAvailable / spec.unitsPerBox : null;

          await tx.thread_stock.update({
            where: { id: item.threadStockId },
            data: {
              quantityAvailable: new Prisma.Decimal(newAvailable),
              quantityConsumed: new Prisma.Decimal(Number(threadStock.quantityConsumed) + qty),
              metersAvailable: newMeters !== null ? new Prisma.Decimal(newMeters) : null,
              boxesAvailable: newBoxes !== null ? new Prisma.Decimal(newBoxes) : null,
              lastConsumedDate: new Date(),
              status: newAvailable <= 0 ? 'ISSUED' : 'AVAILABLE',
            },
          });

          // Audit trail
          await tx.thread_stock_transaction.create({
            data: {
              stockId: item.threadStockId,
              transactionType: 'CONSUMPTION',
              quantity: -qty,
              balanceAfter: newAvailable,
              referenceType: 'CHALLAN',
              referenceId: existing.id,
              notes: `Issued via challan ${existing.challanNumber}`,
              performedById: effectiveUserId,
            },
          });

          // Sync stock_levels
          if (threadStock.threadId) await syncStockLevelQuantity(threadStock.threadId, -qty, undefined, 'METER', tx);
        }

        // 5. General material (trims/accessories) — deduct via stock_movements + stock_levels
        if (item.materialId && !item.greigeStockId && !item.fabricStockId && !item.laceStockId && !item.threadStockId) {
          // Find default warehouse
          const warehouse = await tx.warehouses.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          });

          if (warehouse) {
            try {
              await stockMovementService.createStockOut(
                {
                  movementType: 'STOCK_OUT' as MovementType,
                  materialId: item.materialId,
                  warehouseId: warehouse.id,
                  quantity: new Decimal(qty),
                  unit: (item.unit || 'PIECE') as Unit,
                  referenceType: 'CHALLAN',
                  referenceId: existing.id,
                  referenceNumber: existing.challanNumber,
                  remarks: `Issued via challan ${existing.challanNumber}`,
                  performedById: effectiveUserId,
                },
                tx
              ); // pass the outer tx so the stock-out participates in the challan transaction (F4)
            } catch (err: any) {
              // Stock deduction failure must block challan issuance for ALL types
              // to prevent data inconsistency (challan ISSUED but stock not deducted)
              throw new Error(`Stock deduction failed for material ${item.materialId}: ${err.message}`);
            }
          }
        }

        // 5. Update service requirement status to IN_PROGRESS
        if (item.serviceRequirementId) {
          await tx.work_order_service_requirements.update({
            where: { id: item.serviceRequirementId },
            data: { status: 'IN_PROGRESS' },
          });
        }
      }
    }

    // Update fabric_processing status if linked
    if (existing.fabricProcessingId) {
      await tx.fabric_processing.update({
        where: { id: existing.fabricProcessingId },
        data: {
          processingStatus: 'SENT',
          sentDate: new Date(),
        },
      });
    }

    // Update challan status
    const challan = await tx.challans.update({
      where: { id },
      data: {
        status: 'ISSUED',
        issuedDate: new Date(),
      },
      include: {
        items: true,
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return challan;
  });
}

export async function getChallanById(id: string) {
  return prisma.challans.findUnique({
    where: { id },
    include: {
      items: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalQuantity: true,
          customers: { select: { id: true, name: true } },
        },
      },
      productionRun: {
        select: {
          id: true,
          workOrderNumber: true,
          totalQuantity: true,
          styles: { select: { id: true, styleCode: true, styleName: true } },
        },
      },
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          suppliers: { select: { id: true, name: true } },
        },
      },
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getChallans(filters: ChallanFilters) {
  const where: Prisma.challansWhereInput = {};

  if (filters.challanType) where.challanType = filters.challanType;
  if (filters.status) where.status = filters.status;
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.productionRunId) where.productionRunId = filters.productionRunId;
  if (filters.purchaseOrderId) where.purchaseOrderId = filters.purchaseOrderId;

  if (filters.fromDate || filters.toDate) {
    where.challanDate = {};
    if (filters.fromDate) where.challanDate.gte = filters.fromDate;
    if (filters.toDate) where.challanDate.lte = filters.toDate;
  }

  if (filters.search) {
    where.OR = [
      { challanNumber: { contains: filters.search, mode: 'insensitive' } },
      { fromName: { contains: filters.search, mode: 'insensitive' } },
      { toName: { contains: filters.search, mode: 'insensitive' } },
      { remarks: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [challans, total] = await Promise.all([
    prisma.challans.findMany({
      where,
      include: {
        items: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalQuantity: true,
            customers: { select: { id: true, name: true } },
          },
        },
        productionRun: {
          select: {
            id: true,
            workOrderNumber: true,
            totalQuantity: true,
            styles: { select: { id: true, styleCode: true, styleName: true } },
          },
        },
        purchaseOrder: { select: { id: true, poNumber: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    prisma.challans.count({ where }),
  ]);

  return { challans, total };
}

export async function receiveChallan(id: string, input: ReceiveChallanInput) {
  return prisma.$transaction(async (tx) => {
    // Fetch challan to check for processing link
    const existingChallan = await tx.challans.findUnique({
      where: { id },
      select: { challanType: true, fabricProcessingId: true, orderId: true },
    });

    // Update each item's received quantities
    for (const itemReceipt of input.items) {
      await tx.challan_items.update({
        where: { id: itemReceipt.challanItemId },
        data: {
          receivedQty: itemReceipt.receivedQty,
          damagedQty: itemReceipt.damagedQty || 0,
          remarks: itemReceipt.remarks,
        },
      });
    }

    // Calculate total received
    const allItems = await tx.challan_items.findMany({
      where: { challanId: id },
    });

    // Warn about items with null receivedQty — these are NOT "received 0", they are "not yet entered"
    const itemsWithNullReceivedQty = allItems.filter((item) => item.receivedQty === null);
    if (itemsWithNullReceivedQty.length > 0) {
      logWarn(
        `[Challan] ${itemsWithNullReceivedQty.length} item(s) have no receivedQty entered — stock will NOT be credited for these items. This may cause stock discrepancy.`
      );
    }

    const totalReceived = allItems.reduce(
      (sum, item) => sum + (item.receivedQty !== null ? Number(item.receivedQty) : 0),
      0
    );
    const totalExpected = allItems.reduce((sum, item) => sum + Number(item.quantity), 0);

    // Determine status
    const allReceived = allItems.every(
      (item) => item.receivedQty !== null && Number(item.receivedQty) >= Number(item.quantity)
    );
    const someReceived = allItems.some((item) => item.receivedQty !== null && Number(item.receivedQty) > 0);

    let newStatus: ChallanStatus = 'IN_TRANSIT';
    if (allReceived) {
      newStatus = 'RECEIVED';
    } else if (someReceived) {
      newStatus = 'PARTIALLY_RECEIVED';
    }

    // Auto-credit stock for INWARD challans
    if (existingChallan?.challanType === 'INWARD') {
      // Credit fabric/lace/material stock for each received item
      for (const item of allItems) {
        if (item.receivedQty === null) {
          logWarn(
            `[Challan] Skipping stock credit for item ${item.id} — receivedQty not entered. Stock will NOT be updated.`
          );
          continue;
        }
        const receivedQty = Number(item.receivedQty);
        if (receivedQty <= 0) continue;

        // Fabric stock credit (return to stock)
        if (item.fabricStockId) {
          const fabricStock = await tx.fabric_stock.findUnique({
            where: { id: item.fabricStockId },
            select: { fabricId: true },
          });
          await tx.fabric_stock.update({
            where: { id: item.fabricStockId },
            data: {
              quantityAvailable: { increment: receivedQty },
              status: 'AVAILABLE',
            },
          });

          // Sync stock_levels
          if (fabricStock?.fabricId) {
            const fabMat = await tx.materials.findFirst({
              where: { fabricId: fabricStock.fabricId },
              select: { id: true },
            });
            if (fabMat) await syncStockLevelQuantity(fabMat.id, receivedQty, undefined, 'METER', tx);
          }
        }

        // Lace stock credit (return to stock)
        if (item.laceStockId) {
          const laceStock = await tx.lace_stock.findUnique({
            where: { id: item.laceStockId },
            select: { laceId: true },
          });
          await tx.lace_stock.update({
            where: { id: item.laceStockId },
            data: {
              quantityAvailable: { increment: receivedQty },
              status: 'AVAILABLE',
            },
          });

          // Audit trail
          await tx.lace_stock_transaction.create({
            data: {
              stockId: item.laceStockId,
              transactionType: 'RETURN',
              quantity: receivedQty,
              balanceAfter: 0, // Will be approximate; actual balance computed at read time
              referenceType: 'CHALLAN',
              referenceId: id,
              notes: `Received via challan`,
              performedById: input.receivedById,
            },
          });

          // Sync stock_levels
          if (laceStock?.laceId) await syncStockLevelQuantity(laceStock.laceId, receivedQty, undefined, 'METER', tx);
        }

        // General material credit (trims/accessories) via stock_movements
        if (item.materialId && !item.fabricStockId && !item.laceStockId && !existingChallan.fabricProcessingId) {
          const warehouse = await tx.warehouses.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          });

          if (warehouse) {
            try {
              await stockMovementService.createStockIn({
                movementType: 'STOCK_IN' as MovementType,
                materialId: item.materialId,
                warehouseId: warehouse.id,
                quantity: new Decimal(receivedQty),
                unit: (item.unit || 'PIECE') as Unit,
                referenceType: 'CHALLAN',
                referenceId: id,
                remarks: `Received via challan`,
                performedById: input.receivedById,
              });
            } catch (err: any) {
              // Stock credit failure must block challan reception
              // to prevent data inconsistency (challan RECEIVED but stock not credited)
              throw new Error(`Stock credit failed for material ${item.materialId}: ${err.message}`);
            }
          }
        }

        // Update linked material requirement status
        if (item.materialRequirementId) {
          await tx.material_requirements.update({
            where: { id: item.materialRequirementId },
            data: { status: 'FULFILLED_STOCK' },
          });
        }

        // Update linked service requirement status
        if (item.serviceRequirementId) {
          const serviceReq = await tx.work_order_service_requirements.findUnique({
            where: { id: item.serviceRequirementId },
            select: { quantityRequired: true },
          });
          if (serviceReq) {
            const requiredQty = Number(serviceReq.quantityRequired);
            await tx.work_order_service_requirements.update({
              where: { id: item.serviceRequirementId },
              data: {
                status: receivedQty >= requiredQty ? 'COMPLETED' : 'IN_PROGRESS',
              },
            });
          }
        }
      }
    }

    // Auto-credit fabric stock for INWARD challans linked to processing
    if (existingChallan?.challanType === 'INWARD' && existingChallan.fabricProcessingId) {
      const processing = await tx.fabric_processing.findUnique({
        where: { id: existingChallan.fabricProcessingId },
        select: {
          finishedFabricId: true,
          greigeId: true,
          actualFinishedWidth: true,
          greigeCost: true,
          processingCost: true,
          costPerMeter: true,
        },
      });

      if (processing) {
        // Create fabric stock for each received item with fabric
        for (const item of allItems) {
          if (item.receivedQty === null) continue; // Already warned above
          const receivedQty = Number(item.receivedQty);
          if (receivedQty > 0 && (item.fabricId || processing.finishedFabricId)) {
            // Find the order's style for stock association (style is on order_items, not orders)
            let styleId: string | null = null;
            if (existingChallan.orderId) {
              const orderItem = await tx.order_items.findFirst({
                where: { orderId: existingChallan.orderId },
                select: { styleId: true },
              });
              styleId = orderItem?.styleId || null;
            }

            if (styleId) {
              const fabricId = item.fabricId || processing.finishedFabricId!;
              if (!processing.actualFinishedWidth) {
                throw new Error(
                  `Finished width not recorded for processing (greige ${processing.greigeId}). Update the processing record before receiving.`
                );
              }
              if (!processing.costPerMeter) {
                throw new Error(
                  `Processing cost per meter not set for processing (greige ${processing.greigeId}). Update the processing record before receiving.`
                );
              }
              const finishedWidth = Number(processing.actualFinishedWidth);
              const totalCost = Number(processing.costPerMeter);

              await fabricStockService.createStyleStock(
                {
                  styleId,
                  fabricId,
                  quantity: receivedQty,
                  finishedWidth,
                  cutableWidth: finishedWidth - 2, // Standard 2-inch margin
                  purchaseCost: totalCost,
                  fabricFinishType: 'DYED',
                },
                input.receivedById
              );
            }
          }
        }

        // Update fabric_processing status
        await tx.fabric_processing.update({
          where: { id: existingChallan.fabricProcessingId },
          data: {
            processingStatus: newStatus === 'RECEIVED' ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
            actualQuantityReceived: new Prisma.Decimal(totalReceived),
            actualReturnDate: newStatus === 'RECEIVED' ? new Date() : undefined,
          },
        });
      }
    }

    const challan = await tx.challans.update({
      where: { id },
      data: {
        status: newStatus,
        receivedQuantity: totalReceived,
        receivedDate: newStatus === 'RECEIVED' ? new Date() : undefined,
        receivedById: input.receivedById,
        remarks: input.remarks || undefined,
      },
      include: {
        items: true,
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return challan;
  });
}

export async function cancelChallan(id: string) {
  return prisma.challans.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
}

// ============================================
// GREIGE OUTWARD CHALLAN HELPER
// ============================================

export interface CreateGreigeOutwardChallanInput {
  materialRequirementId: string;
  fabricProcessingId: string;
  orderId?: string;
  userId: string;
}

export async function createGreigeOutwardChallan(input: CreateGreigeOutwardChallanInput) {
  return prisma.$transaction(async (tx) => {
    // 1. Look up the greige material requirement
    const requirement = await tx.material_requirements.findUnique({
      where: { id: input.materialRequirementId },
      include: {
        materials: {
          include: { greige_master: true },
        },
        processor: true,
      },
    });

    if (!requirement) throw new Error('Material requirement not found');

    // 2. Look up the processor (from fabric_processing)
    const processing = await tx.fabric_processing.findUnique({
      where: { id: input.fabricProcessingId },
      include: {
        processor: { select: { id: true, name: true } },
        greigeMaster: { select: { id: true, greigeCode: true, greigeName: true } },
      },
    });

    if (!processing) throw new Error('Fabric processing record not found');

    // 3. Find best available greige stock
    const greigeStocks = await tx.greige_stock.findMany({
      where: {
        greigeId: processing.greigeId,
        status: 'AVAILABLE',
        quantityAvailable: { gt: 0 },
      },
      orderBy: { quantityAvailable: 'desc' },
    });

    if (greigeStocks.length === 0) {
      throw new Error('No greige stock available for this greige');
    }

    const requiredQty = Number(requirement.totalRequired);

    // Allocate from available stocks (FIFO by largest available first)
    const itemsToCreate: CreateChallanItemInput[] = [];
    let remaining = requiredQty;

    for (const stock of greigeStocks) {
      if (remaining <= 0) break;
      const available = Number(stock.quantityAvailable);
      const allocate = Math.min(available, remaining);

      itemsToCreate.push({
        itemType: 'GREIGE',
        description: `${processing.greigeMaster.greigeName} (${processing.greigeMaster.greigeCode})`,
        quantity: allocate,
        unit: Unit.METER,
        greigeStockId: stock.id,
        materialRequirementId: input.materialRequirementId,
      });

      remaining -= allocate;
    }

    if (remaining > 0) {
      throw new Error(`Insufficient greige stock. Short by ${remaining} meters`);
    }

    // 4. Create the challan
    const challanNumber = await generateChallanNumber(tx);
    const totalQuantity = itemsToCreate.reduce((sum, item) => sum + item.quantity, 0);

    const challan = await tx.challans.create({
      data: {
        id: randomUUID(),
        challanNumber,
        challanType: 'OUTWARD',
        challanDate: new Date(),
        orderId: input.orderId || requirement.orderId,
        fabricProcessingId: input.fabricProcessingId,
        fromType: 'WAREHOUSE',
        fromName: 'Main Warehouse',
        toType: 'VENDOR',
        toId: processing.processorId,
        toName: processing.processor.name,
        status: 'DRAFT',
        totalItems: itemsToCreate.length,
        totalQuantity,
        unit: Unit.METER,
        remarks: `Greige outward for processing - ${processing.greigeMaster.greigeName}`,
        issuedById: input.userId,
        items: {
          create: itemsToCreate.map((item) => ({
            id: randomUUID(),
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || Unit.METER,
            greigeStockId: item.greigeStockId,
            materialRequirementId: item.materialRequirementId,
          })),
        },
      },
      include: {
        items: true,
        order: { select: { id: true, orderNumber: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return challan;
  });
}

// ============================================
// FABRIC RETURN CHALLAN (Cutting → Fabric Store)
// ============================================

export interface FabricReturnItem {
  fabricStockId: string;
  quantity: number;
  description: string;
}

export interface CreateFabricReturnInput {
  workOrderId: string;
  issuedById: string;
  items: FabricReturnItem[];
  remarks?: string;
}

/**
 * Creates a return challan for fabric going back from Cutting to Fabric Store.
 * The challan is created directly as RECEIVED and fabric stock is credited back.
 */
export async function createFabricReturnChallan(input: CreateFabricReturnInput) {
  return prisma.$transaction(async (tx) => {
    const challanNumber = await generateChallanNumber(tx);
    const totalQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0);

    const challan = await tx.challans.create({
      data: {
        id: randomUUID(),
        challanNumber,
        challanType: 'INTERNAL',
        challanDate: new Date(),
        productionRunId: input.workOrderId,
        fromType: 'DEPARTMENT',
        fromName: 'Cutting',
        toType: 'DEPARTMENT',
        toName: 'Fabric Store',
        status: 'RECEIVED',
        issuedDate: new Date(),
        receivedDate: new Date(),
        totalItems: input.items.length,
        totalQuantity,
        receivedQuantity: totalQuantity,
        unit: Unit.METER,
        remarks: input.remarks || 'Fabric return from cutting batch completion',
        issuedById: input.issuedById,
        receivedById: input.issuedById,
        items: {
          create: input.items.map((item) => ({
            id: randomUUID(),
            itemType: 'FABRIC',
            description: item.description,
            quantity: item.quantity,
            receivedQty: item.quantity,
            unit: Unit.METER,
            fabricStockId: item.fabricStockId,
          })),
        },
      },
      include: { items: true },
    });

    // Credit fabric stock for each returned item
    for (const item of input.items) {
      await tx.fabric_stock.update({
        where: { id: item.fabricStockId },
        data: {
          quantityAvailable: { increment: item.quantity },
          quantityConsumed: { decrement: item.quantity },
          status: 'AVAILABLE',
        },
      });
    }

    return challan;
  });
}

// ============================================
// QUICK ISSUE (Create + Issue in one step)
// ============================================

export async function quickIssueChallan(input: CreateChallanInput) {
  // Step 1: Create challan as DRAFT
  const challan = await createChallan(input);
  // Step 2: Immediately issue it (triggers stock deduction via issueChallan)
  const issuedChallan = await issueChallan(challan.id, input.issuedById);
  return issuedChallan;
}

// ============================================
// STATS
// ============================================

export async function getChallanStats(filters?: { orderId?: string; productionRunId?: string }) {
  const where: Prisma.challansWhereInput = {};
  if (filters?.orderId) where.orderId = filters.orderId;
  if (filters?.productionRunId) where.productionRunId = filters.productionRunId;

  const [byType, byStatus, total] = await Promise.all([
    prisma.challans.groupBy({
      by: ['challanType'],
      where,
      _count: { id: true },
    }),
    prisma.challans.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
    prisma.challans.count({ where }),
  ]);

  return {
    total,
    byType: byType.map((g) => ({ type: g.challanType, count: g._count.id })),
    byStatus: byStatus.map((g) => ({ status: g.status, count: g._count.id })),
  };
}
