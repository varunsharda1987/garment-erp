import { PrismaClient, ChallanType, ChallanStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

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
}

export interface CreateChallanInput {
  challanType: ChallanType;
  challanDate?: Date;
  orderId?: string;
  productionRunId?: string;
  purchaseOrderId?: string;
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

async function generateChallanNumber(
  tx?: Prisma.TransactionClient
): Promise<string> {
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
        unit: input.unit || 'PCS',
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
            unit: item.unit || 'PCS',
            colorId: item.colorId,
            sizeId: item.sizeId,
            rate: item.rate,
            remarks: item.remarks,
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

export async function issueChallan(id: string) {
  return prisma.challans.update({
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
}

export async function getChallanById(id: string) {
  return prisma.challans.findUnique({
    where: { id },
    include: {
      items: true,
      order: { select: { id: true, orderNumber: true } },
      productionRun: { select: { id: true, workOrderNumber: true } },
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
        order: { select: { id: true, orderNumber: true } },
        productionRun: { select: { id: true, workOrderNumber: true } },
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

    const totalReceived = allItems.reduce(
      (sum, item) => sum + Number(item.receivedQty || 0),
      0
    );
    const totalExpected = allItems.reduce(
      (sum, item) => sum + Number(item.quantity),
      0
    );

    // Determine status
    const allReceived = allItems.every(
      (item) => item.receivedQty !== null && Number(item.receivedQty) >= Number(item.quantity)
    );
    const someReceived = allItems.some(
      (item) => item.receivedQty !== null && Number(item.receivedQty) > 0
    );

    let newStatus: ChallanStatus = 'IN_TRANSIT';
    if (allReceived) {
      newStatus = 'RECEIVED';
    } else if (someReceived) {
      newStatus = 'PARTIALLY_RECEIVED';
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
