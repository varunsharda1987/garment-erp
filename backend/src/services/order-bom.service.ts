/**
 * Order BOM (Bill of Materials) Service
 * Business logic for Order-level BOM management
 *
 * Order BOM is created after Cost Sheet approval and contains
 * order-specific quantities and prices for MRP & Production.
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { Prisma, order_bom, OrderBOMStatus } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError, BusinessError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter } from '../types/prisma.types';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateOrderBOMInput,
  CreateOrderBOMFromCostSheetInput,
  CopyOrderBOMInput,
  UpdateOrderBOMInput,
  ApproveOrderBOMInput,
  OrderBOMQueryFilters,
  OrderBOMItemInput,
  OrderBOMMaterialRequirement,
  OrderBOMCalculationSummary,
} from '../types/order-bom.types';

// ============================================
// Types
// ============================================

export interface OrderBOMQueryOptions extends PaginationOptions {
  orderId?: string;
  styleId?: string;
  status?: OrderBOMStatus;
  isActive?: boolean;
}

// ============================================
// Service
// ============================================

class OrderBOMServiceClass extends BaseService<order_bom, CreateOrderBOMInput, UpdateOrderBOMInput> {
  protected readonly modelName = 'order_bom';
  protected readonly entityName = 'Order BOM';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.order_bom;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return {
      items: {
        include: {
          material: true,
          button_master: true,
          thread_master: true,
          zipper_master: true,
          lace_master: true,
          elastic_master: true,
          label_master: true,
          packaging_master: true,
          fabric_master: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalQuantity: true,
          status: true,
        },
      },
      style: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
        },
      },
      users_order_bom_createdByIdTousers: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      users_order_bom_approvedByIdTousers: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    };
  }

  protected getListIncludes(): IncludeConfig {
    return {
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalQuantity: true,
        },
      },
      style: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    };
  }

  // ============================================
  // Create Methods
  // ============================================

  /**
   * Create Order BOM from approved Cost Sheet
   * This is the primary method for creating Order BOM
   */
  async createFromCostSheet(input: CreateOrderBOMFromCostSheetInput): Promise<order_bom> {
    logDebug('Creating Order BOM from Cost Sheet', {
      orderId: input.orderId,
      styleId: input.styleId,
      costSheetId: input.costSheetId,
    });

    // Validate order exists
    const order = await this.prisma.orders.findUnique({
      where: { id: input.orderId },
      include: {
        order_items: {
          where: { styleId: input.styleId },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order', input.orderId);
    }

    // Validate cost sheet exists and is approved
    const costSheet = await this.prisma.style_costing.findUnique({
      where: { id: input.costSheetId },
      include: {
        styles: true,
      },
    });

    if (!costSheet) {
      throw new NotFoundError('Cost Sheet', input.costSheetId);
    }

    if (costSheet.approvalStatus !== 'APPROVED') {
      throw new BusinessError('Cost Sheet must be approved before creating Order BOM');
    }

    // Get style's material BOM for quantities
    const styleMaterialBOM = await this.prisma.style_material_bom.findMany({
      where: {
        styleId: input.styleId,
        isActive: true,
      },
      include: {
        lace_master: true,
        button_master: true,
        thread_master: true,
        zipper_master: true,
        elastic_master: true,
        label_master: true,
        packaging_master: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Get order quantity for this style
    const orderItem = order.order_items.find((item) => item.styleId === input.styleId);
    const orderQuantity = orderItem?.totalQuantity || order.totalQuantity;

    // Get next version number
    const latestBOM = await this.prisma.order_bom.findFirst({
      where: {
        orderId: input.orderId,
        styleId: input.styleId,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latestBOM ? latestBOM.version + 1 : 1;

    // Parse cost sheet details for prices
    const fabricDetails = costSheet.fabricDetails as unknown as Array<{
      fabricName?: string;
      fabricRate?: number;
      fabricAverage?: number;
      fabricTotal?: number;
      fabricId?: string;
    }> || [];

    const trimsDetails = costSheet.trimsDetails as unknown as Array<{
      trimName?: string;
      trimRate?: number;
      trimQuantity?: number;
      trimTotal?: number;
      bomId?: string;
      materialType?: string;
    }> || [];

    const accessoriesDetails = costSheet.accessoriesDetails as unknown as Array<{
      accessoryName?: string;
      accessoryRate?: number;
      accessoryQuantity?: number;
      accessoryTotal?: number;
    }> || [];

    // Build BOM items from style material BOM + cost sheet prices
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bomItems: any[] = [];

    // Add trim items from style_material_bom
    for (const material of styleMaterialBOM) {
      // Find matching price from cost sheet
      const trimPrice = trimsDetails.find(
        (t) => t.bomId === material.id || t.trimName?.toLowerCase() === this.getMaterialName(material)?.toLowerCase()
      );

      const quantityPerGarment = Number(material.quantityPerGarment) || 0;
      const totalQuantity = quantityPerGarment * orderQuantity;
      const wastagePercent = 5; // Default wastage
      const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
      const unitPrice = trimPrice?.trimRate || Number(material.unitPrice) || 0;
      const totalCost = totalWithWastage * unitPrice;

      bomItems.push({
        id: uuidv4(),
        orderBomId: '', // Will be set in transaction
        materialType: material.materialType || 'GENERIC',
        materialId: material.materialId,
        buttonId: material.buttonId,
        threadId: material.threadId,
        zipperId: material.zipperId,
        laceId: material.laceId,
        elasticId: material.elasticId,
        labelId: material.labelId,
        packagingId: material.packagingId,
        quantityPerGarment,
        orderQuantity,
        totalQuantity,
        wastagePercent,
        totalWithWastage,
        unit: material.unit || 'pcs',
        unitPrice,
        totalCost,
        componentName: material.componentName,
        usageCategory: material.usageCategory,
        notes: material.notes,
        sortOrder: material.sortOrder || 0,
      });
    }

    // Add fabric items from cost sheet
    for (let i = 0; i < fabricDetails.length; i++) {
      const fabric = fabricDetails[i];
      const quantityPerGarment = fabric.fabricAverage || 0;
      const totalQuantity = quantityPerGarment * orderQuantity;
      const wastagePercent = 5;
      const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
      const unitPrice = fabric.fabricRate || 0;
      const totalCost = totalWithWastage * unitPrice;

      bomItems.push({
        id: uuidv4(),
        orderBomId: '', // Will be set in transaction
        materialType: 'FABRIC',
        fabricId: fabric.fabricId || null,
        quantityPerGarment,
        orderQuantity,
        totalQuantity,
        wastagePercent,
        totalWithWastage,
        unit: 'METER',
        unitPrice,
        totalCost,
        componentName: fabric.fabricName || `Fabric ${i + 1}`,
        usageCategory: 'FABRIC',
        sortOrder: i,
      });
    }

    // Add lace items from style_costing_lace_items (relational table)
    const laceItems = await this.prisma.style_costing_lace_items.findMany({
      where: { costingId: input.costSheetId },
      include: {
        lace: true,
        greigeLace: true,
        processor: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (let i = 0; i < laceItems.length; i++) {
      const laceItem = laceItems[i];
      const quantityPerGarment = Number(laceItem.quantityPerGarment) || 0;
      const totalQuantity = quantityPerGarment * orderQuantity;
      const wastagePercent = Number(laceItem.wastagePercent) || 5;
      const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
      const unitPrice = Number(laceItem.costPerMeter) || 0;
      const totalCost = totalWithWastage * unitPrice;

      bomItems.push({
        id: uuidv4(),
        orderBomId: '', // Will be set in transaction
        materialType: 'LACE',
        laceId: laceItem.laceId,
        quantityPerGarment,
        orderQuantity,
        totalQuantity,
        wastagePercent,
        totalWithWastage,
        unit: 'METER',
        unitPrice,
        totalCost,
        componentName: laceItem.laceName || laceItem.lace?.laceName || `Lace ${i + 1}`,
        usageCategory: 'LACE',
        notes: laceItem.notes || (laceItem.sourcingStrategy ? `Sourcing: ${laceItem.sourcingStrategy}` : undefined),
        sortOrder: fabricDetails.length + i,
        // Pass sourcing info for later reference
        sourcingStrategy: laceItem.sourcingStrategy,
        greigeLaceId: laceItem.greigeLaceId,
        processorId: laceItem.processorId,
        labDipId: laceItem.labDipId,
      });
    }

    // Calculate total material cost
    const totalMaterialCost = bomItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);

    // Create Order BOM in transaction
    const orderBOM = await this.prisma.$transaction(async (tx) => {
      // Deactivate previous BOMs for this order/style
      await tx.order_bom.updateMany({
        where: {
          orderId: input.orderId,
          styleId: input.styleId,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Create new Order BOM
      const newBOM = await tx.order_bom.create({
        data: {
          id: uuidv4(),
          orderId: input.orderId,
          orderItemId: input.orderItemId || orderItem?.id,
          styleId: input.styleId,
          version: nextVersion,
          isActive: true,
          status: 'DRAFT',
          totalMaterialCost,
          sourceCostSheetId: input.costSheetId,
          createdById: input.createdById,
        },
      });

      // Create BOM items
      if (bomItems.length > 0) {
        await tx.order_bom_items.createMany({
          data: bomItems.map((item) => ({
            ...item,
            orderBomId: newBOM.id,
          })),
        });
      }

      // Return with includes
      return tx.order_bom.findUnique({
        where: { id: newBOM.id },
        include: this.getDefaultIncludes(),
      });
    });

    logInfo('Order BOM created from Cost Sheet', {
      id: orderBOM?.id,
      orderId: input.orderId,
      styleId: input.styleId,
      version: nextVersion,
      itemCount: bomItems.length,
    });

    return orderBOM as order_bom;
  }

  /**
   * Copy Order BOM from a previous order (for repeat orders)
   */
  async copyFromPreviousOrder(input: CopyOrderBOMInput): Promise<order_bom> {
    logDebug('Copying Order BOM from previous order', {
      targetOrderId: input.targetOrderId,
      sourceOrderId: input.sourceOrderId,
      styleId: input.styleId,
    });

    // Get source order BOM
    const sourceBOM = await this.prisma.order_bom.findFirst({
      where: {
        orderId: input.sourceOrderId,
        styleId: input.styleId,
        isActive: true,
      },
      include: {
        items: true,
      },
    });

    if (!sourceBOM) {
      throw new NotFoundError('Source Order BOM for order', input.sourceOrderId);
    }

    // Get target order
    const targetOrder = await this.prisma.orders.findUnique({
      where: { id: input.targetOrderId },
      include: {
        order_items: {
          where: { styleId: input.styleId },
        },
      },
    });

    if (!targetOrder) {
      throw new NotFoundError('Target Order', input.targetOrderId);
    }

    const targetOrderItem = targetOrder.order_items.find((item) => item.styleId === input.styleId);
    const newOrderQuantity = input.adjustQuantity || targetOrderItem?.totalQuantity || targetOrder.totalQuantity;

    // Get next version
    const latestBOM = await this.prisma.order_bom.findFirst({
      where: {
        orderId: input.targetOrderId,
        styleId: input.styleId,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latestBOM ? latestBOM.version + 1 : 1;

    // Recalculate items with new order quantity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newItems = sourceBOM.items.map((item: any) => {
      const quantityPerGarment = Number(item.quantityPerGarment);
      const totalQuantity = quantityPerGarment * newOrderQuantity;
      const wastagePercent = Number(item.wastagePercent) || 0;
      const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
      const unitPrice = Number(item.unitPrice);
      const totalCost = totalWithWastage * unitPrice;

      return {
        id: uuidv4(),
        orderBomId: '', // Will be set in transaction
        materialType: item.materialType,
        materialId: item.materialId,
        buttonId: item.buttonId,
        threadId: item.threadId,
        zipperId: item.zipperId,
        laceId: item.laceId,
        elasticId: item.elasticId,
        labelId: item.labelId,
        packagingId: item.packagingId,
        fabricId: item.fabricId,
        quantityPerGarment,
        orderQuantity: newOrderQuantity,
        totalQuantity,
        wastagePercent,
        totalWithWastage,
        unit: item.unit,
        unitPrice,
        totalCost,
        componentName: item.componentName,
        usageCategory: item.usageCategory,
        notes: item.notes,
        sortOrder: item.sortOrder,
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalMaterialCost = newItems.reduce((sum: number, item: any) => sum + item.totalCost, 0);

    // Create in transaction
    const newBOM = await this.prisma.$transaction(async (tx) => {
      // Deactivate previous BOMs
      await tx.order_bom.updateMany({
        where: {
          orderId: input.targetOrderId,
          styleId: input.styleId,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Create new Order BOM
      const bom = await tx.order_bom.create({
        data: {
          id: uuidv4(),
          orderId: input.targetOrderId,
          orderItemId: input.orderItemId || targetOrderItem?.id,
          styleId: input.styleId,
          version: nextVersion,
          isActive: true,
          status: 'DRAFT',
          totalMaterialCost,
          sourceCostSheetId: sourceBOM.sourceCostSheetId,
          copiedFromOrderId: input.sourceOrderId,
          createdById: input.createdById,
        },
      });

      // Create items
      if (newItems.length > 0) {
        await tx.order_bom_items.createMany({
          data: newItems.map((item) => ({
            ...item,
            orderBomId: bom.id,
          })),
        });
      }

      return tx.order_bom.findUnique({
        where: { id: bom.id },
        include: this.getDefaultIncludes(),
      });
    });

    logInfo('Order BOM copied from previous order', {
      id: newBOM?.id,
      targetOrderId: input.targetOrderId,
      sourceOrderId: input.sourceOrderId,
      version: nextVersion,
    });

    return newBOM as order_bom;
  }

  /**
   * Create a new BOM version with fabric width changes
   * Used when a fabric needs to be ordered at a different width (different CAD consumption & costing)
   */
  async createVersionWithWidthChange(input: {
    orderBomId: string;
    fabricItemChanges: Array<{
      bomItemId: string;
      newCadId: string;
    }>;
    userId: string;
  }): Promise<order_bom> {
    logDebug('Creating BOM version with width change', {
      orderBomId: input.orderBomId,
      changes: input.fabricItemChanges.length,
    });

    // Load current BOM with items
    const currentBOM = await this.prisma.order_bom.findUnique({
      where: { id: input.orderBomId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!currentBOM) {
      throw new NotFoundError('Order BOM', input.orderBomId);
    }

    if (currentBOM.status === 'LOCKED') {
      throw new BusinessError('Cannot change width on a LOCKED Order BOM');
    }

    // Build a map of bomItemId → newCadId
    const changeMap = new Map(
      input.fabricItemChanges.map((c) => [c.bomItemId, c.newCadId])
    );

    // Fetch all referenced CAD records
    const cadIds = input.fabricItemChanges.map((c) => c.newCadId);
    const cadRecords = await this.prisma.fabric_width_cad.findMany({
      where: { id: { in: cadIds } },
    });
    const cadMap = new Map(cadRecords.map((c) => [c.id, c]));

    // Validate all CAD records exist and have cadAverage
    for (const change of input.fabricItemChanges) {
      const cad = cadMap.get(change.newCadId);
      if (!cad) {
        throw new NotFoundError('CAD Width Record', change.newCadId);
      }
      if (!cad.cadAverage) {
        throw new ValidationError(`CAD record ${change.newCadId} has no cadAverage (consumption) calculated`);
      }
    }

    // Get next version
    const latestBOM = await this.prisma.order_bom.findFirst({
      where: {
        orderId: currentBOM.orderId,
        styleId: currentBOM.styleId,
      },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latestBOM?.version || currentBOM.version) + 1;

    // Build new items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newItems: any[] = currentBOM.items.map((item: any) => {
      const newCadId = changeMap.get(item.id);

      if (newCadId) {
        // This fabric item has a width change
        const cad = cadMap.get(newCadId)!;
        const newCadAverage = Number(cad.cadAverage);
        const newWidth = Number(cad.cutableWidth);
        const orderQuantity = item.orderQuantity;
        const totalQuantity = newCadAverage * orderQuantity;
        const wastagePercent = Number(item.wastagePercent) || 0;
        const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
        // Use CAD's totalCostPerMeter if available, otherwise keep existing unitPrice
        const unitPrice = cad.totalCostPerMeter ? Number(cad.totalCostPerMeter) : Number(item.unitPrice);
        const totalCost = totalWithWastage * unitPrice;

        return {
          id: uuidv4(),
          orderBomId: '', // Set in transaction
          materialType: item.materialType,
          materialId: item.materialId,
          buttonId: item.buttonId,
          threadId: item.threadId,
          zipperId: item.zipperId,
          laceId: item.laceId,
          elasticId: item.elasticId,
          labelId: item.labelId,
          packagingId: item.packagingId,
          fabricId: item.fabricId,
          quantityPerGarment: newCadAverage,
          orderQuantity,
          totalQuantity,
          wastagePercent,
          totalWithWastage,
          unit: item.unit,
          unitPrice,
          totalCost,
          componentName: item.componentName,
          usageCategory: item.usageCategory,
          notes: item.notes,
          sortOrder: item.sortOrder,
          // New CAD-linked fields
          selectedCadId: newCadId,
          fabricWidthInches: newWidth,
          cadAverageSnapshot: newCadAverage,
        };
      } else {
        // Unchanged item — copy as-is
        return {
          id: uuidv4(),
          orderBomId: '', // Set in transaction
          materialType: item.materialType,
          materialId: item.materialId,
          buttonId: item.buttonId,
          threadId: item.threadId,
          zipperId: item.zipperId,
          laceId: item.laceId,
          elasticId: item.elasticId,
          labelId: item.labelId,
          packagingId: item.packagingId,
          fabricId: item.fabricId,
          quantityPerGarment: Number(item.quantityPerGarment),
          orderQuantity: item.orderQuantity,
          totalQuantity: Number(item.totalQuantity),
          wastagePercent: Number(item.wastagePercent) || 0,
          totalWithWastage: item.totalWithWastage ? Number(item.totalWithWastage) : null,
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          totalCost: Number(item.totalCost),
          componentName: item.componentName,
          usageCategory: item.usageCategory,
          notes: item.notes,
          sortOrder: item.sortOrder,
          selectedCadId: item.selectedCadId,
          fabricWidthInches: item.fabricWidthInches ? Number(item.fabricWidthInches) : null,
          cadAverageSnapshot: item.cadAverageSnapshot ? Number(item.cadAverageSnapshot) : null,
        };
      }
    });

    const totalMaterialCost = newItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);

    // Create new BOM version in transaction
    const newBOM = await this.prisma.$transaction(async (tx) => {
      // Deactivate current BOM
      await tx.order_bom.update({
        where: { id: currentBOM.id },
        data: { isActive: false },
      });

      // Create new version
      const bom = await tx.order_bom.create({
        data: {
          id: uuidv4(),
          orderId: currentBOM.orderId,
          orderItemId: currentBOM.orderItemId,
          styleId: currentBOM.styleId,
          version: nextVersion,
          isActive: true,
          status: 'DRAFT',
          totalMaterialCost,
          sourceCostSheetId: currentBOM.sourceCostSheetId,
          copiedFromOrderId: currentBOM.copiedFromOrderId,
          createdById: input.userId,
        },
      });

      // Create items
      if (newItems.length > 0) {
        await tx.order_bom_items.createMany({
          data: newItems.map((item) => ({
            ...item,
            orderBomId: bom.id,
          })),
        });
      }

      return tx.order_bom.findUnique({
        where: { id: bom.id },
        include: this.getDefaultIncludes(),
      });
    });

    logInfo('Order BOM version created with width change', {
      id: newBOM?.id,
      orderId: currentBOM.orderId,
      version: nextVersion,
      changedFabrics: input.fabricItemChanges.length,
    });

    return newBOM as order_bom;
  }

  // ============================================
  // Read Methods
  // ============================================

  /**
   * Get Order BOM by order ID
   */
  async getByOrderId(orderId: string, styleId?: string): Promise<order_bom | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      orderId,
      isActive: true,
    };

    if (styleId) {
      where.styleId = styleId;
    }

    const bom = await this.prisma.order_bom.findFirst({
      where,
      include: this.getDefaultIncludes(),
      orderBy: { version: 'desc' },
    });

    return bom ? this.transformBOM(bom) : null;
  }

  /**
   * Find all Order BOMs with filters
   */
  async findAllWithFilters(options: OrderBOMQueryOptions): Promise<PaginatedResult<order_bom>> {
    const { page = 1, limit = 20, search, sortBy, sortOrder, ...filters } = options;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filters.orderId) {
      where.orderId = filters.orderId;
    }

    if (filters.styleId) {
      where.styleId = filters.styleId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [boms, total] = await Promise.all([
      this.prisma.order_bom.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        include: this.getListIncludes(),
      }),
      this.prisma.order_bom.count({ where }),
    ]);

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: boms.map((bom: any) => this.transformBOM(bom)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get full details of an Order BOM
   */
  async getFullDetails(id: string): Promise<order_bom> {
    const bom = await this.prisma.order_bom.findUnique({
      where: { id },
      include: this.getDefaultIncludes(),
    });

    if (!bom) {
      throw new NotFoundError('Order BOM', id);
    }

    return this.transformBOM(bom);
  }

  // ============================================
  // Update Methods
  // ============================================

  /**
   * Update Order BOM items (only if DRAFT status)
   */
  async updateItems(id: string, data: UpdateOrderBOMInput): Promise<order_bom> {
    logDebug('Updating Order BOM items', { id });

    const currentBOM = await this.prisma.order_bom.findUnique({
      where: { id },
    });

    if (!currentBOM) {
      throw new NotFoundError('Order BOM', id);
    }

    if (currentBOM.status !== 'DRAFT') {
      throw new BusinessError('Can only update Order BOM in DRAFT status');
    }

    if (!data.items || data.items.length === 0) {
      throw new ValidationError('At least one BOM item is required');
    }

    // Recalculate totals
    const totalMaterialCost = data.items.reduce((sum, item) => {
      const totalQuantity = item.quantityPerGarment * item.orderQuantity;
      const totalWithWastage = totalQuantity * (1 + (item.wastagePercent || 0) / 100);
      return sum + totalWithWastage * item.unitPrice;
    }, 0);

    // Update in transaction
    const updatedBOM = await this.prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.order_bom_items.deleteMany({
        where: { orderBomId: id },
      });

      // Update BOM
      await tx.order_bom.update({
        where: { id },
        data: {
          totalMaterialCost,
        },
      });

      // Create new items
      await tx.order_bom_items.createMany({
        data: data.items!.map((item, index) => {
          const totalQuantity = item.quantityPerGarment * item.orderQuantity;
          const totalWithWastage = totalQuantity * (1 + (item.wastagePercent || 0) / 100);
          const totalCost = totalWithWastage * item.unitPrice;

          return {
            id: uuidv4(),
            orderBomId: id,
            materialType: item.materialType,
            materialId: item.materialId,
            buttonId: item.buttonId,
            threadId: item.threadId,
            zipperId: item.zipperId,
            laceId: item.laceId,
            elasticId: item.elasticId,
            labelId: item.labelId,
            packagingId: item.packagingId,
            fabricId: item.fabricId,
            quantityPerGarment: item.quantityPerGarment,
            orderQuantity: item.orderQuantity,
            totalQuantity,
            wastagePercent: item.wastagePercent || 0,
            totalWithWastage,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalCost,
            componentName: item.componentName,
            usageCategory: item.usageCategory,
            notes: item.notes,
            sortOrder: item.sortOrder || index,
          };
        }),
      });

      return tx.order_bom.findUnique({
        where: { id },
        include: this.getDefaultIncludes(),
      });
    });

    logInfo('Order BOM updated', { id });
    return this.transformBOM(updatedBOM!);
  }

  /**
   * Approve Order BOM (changes status to APPROVED)
   */
  async approve(id: string, input: ApproveOrderBOMInput): Promise<order_bom> {
    logDebug('Approving Order BOM', { id });

    const bom = await this.prisma.order_bom.findUnique({
      where: { id },
    });

    if (!bom) {
      throw new NotFoundError('Order BOM', id);
    }

    if (bom.status !== 'DRAFT') {
      throw new BusinessError('Can only approve Order BOM in DRAFT status');
    }

    // Check if parent order is cancelled
    const order = await this.prisma.orders.findUnique({
      where: { id: bom.orderId },
      select: { status: true },
    });

    if (order?.status === 'CANCELLED') {
      throw new BusinessError('Cannot approve BOM for a cancelled order');
    }

    const updatedBOM = await this.prisma.order_bom.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: input.approvedById,
        approvedAt: new Date(),
      },
      include: this.getDefaultIncludes(),
    });

    logInfo('Order BOM approved', { id });
    return this.transformBOM(updatedBOM);
  }

  /**
   * Lock Order BOM for production (changes status to LOCKED)
   */
  async lock(id: string): Promise<order_bom> {
    logDebug('Locking Order BOM for production', { id });

    const bom = await this.prisma.order_bom.findUnique({
      where: { id },
    });

    if (!bom) {
      throw new NotFoundError('Order BOM', id);
    }

    if (bom.status !== 'APPROVED') {
      throw new BusinessError('Can only lock APPROVED Order BOM');
    }

    // Check if parent order is cancelled
    const order = await this.prisma.orders.findUnique({
      where: { id: bom.orderId },
      select: { status: true },
    });

    if (order?.status === 'CANCELLED') {
      throw new BusinessError('Cannot lock BOM for a cancelled order');
    }

    const updatedBOM = await this.prisma.order_bom.update({
      where: { id },
      data: {
        status: 'LOCKED',
      },
      include: this.getDefaultIncludes(),
    });

    logInfo('Order BOM locked for production', { id });
    return this.transformBOM(updatedBOM);
  }

  /**
   * Deactivate Order BOM
   */
  async deactivate(id: string): Promise<void> {
    logDebug('Deactivating Order BOM', { id });

    const bom = await this.prisma.order_bom.findUnique({
      where: { id },
    });

    if (!bom) {
      throw new NotFoundError('Order BOM', id);
    }

    if (bom.status === 'LOCKED') {
      throw new BusinessError('Cannot deactivate LOCKED Order BOM');
    }

    await this.prisma.order_bom.update({
      where: { id },
      data: { isActive: false },
    });

    logInfo('Order BOM deactivated', { id });
  }

  /**
   * Cleanup: Deactivate all BOMs for cancelled orders
   * This is a one-time cleanup for orders that were cancelled before the cascade fix
   */
  async cleanupBomsForCancelledOrders(): Promise<{ deactivatedCount: number }> {
    logDebug('Running cleanup for BOMs of cancelled orders');

    // Find all active BOMs where the parent order is cancelled
    const result = await this.prisma.order_bom.updateMany({
      where: {
        isActive: true,
        orders: {
          status: 'CANCELLED',
        },
      },
      data: { isActive: false },
    });

    logInfo('Cleanup completed: deactivated BOMs for cancelled orders', {
      deactivatedCount: result.count,
    });

    return { deactivatedCount: result.count };
  }

  // ============================================
  // Calculation Methods
  // ============================================

  /**
   * Calculate material requirements from Order BOM
   */
  async calculateRequirements(id: string): Promise<OrderBOMCalculationSummary> {
    const bom = await this.prisma.order_bom.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            material: true,
            button_master: true,
            thread_master: true,
            zipper_master: true,
            lace_master: true,
            elastic_master: true,
            label_master: true,
            packaging_master: true,
            fabric_master: true,
          },
        },
      },
    });

    if (!bom) {
      throw new NotFoundError('Order BOM', id);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requirements: OrderBOMMaterialRequirement[] = bom.items.map((item: any) => {
      const quantityPerGarment = Number(item.quantityPerGarment);
      const orderQuantity = item.orderQuantity;
      const baseQuantity = quantityPerGarment * orderQuantity;
      const wastagePercent = Number(item.wastagePercent) || 0;
      const wastageQuantity = baseQuantity * (wastagePercent / 100);
      const totalQuantity = baseQuantity + wastageQuantity;
      const unitPrice = Number(item.unitPrice);
      const totalCost = totalQuantity * unitPrice;

      // Get material name and code
      const materialInfo = this.getMaterialInfo(item);

      return {
        materialType: item.materialType,
        materialName: materialInfo.name,
        materialCode: materialInfo.code,
        quantityPerGarment,
        orderQuantity,
        baseQuantity,
        wastagePercent,
        wastageQuantity,
        totalQuantity,
        unit: item.unit,
        unitPrice,
        totalCost,
      };
    });

    // Group by category
    const byCategory: { [category: string]: { itemCount: number; totalCost: number } } = {};
    for (const req of requirements) {
      const category = bom.items.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (i: any) => this.getMaterialInfo(i).code === req.materialCode
      )?.usageCategory || 'OTHER';

      if (!byCategory[category]) {
        byCategory[category] = { itemCount: 0, totalCost: 0 };
      }
      byCategory[category].itemCount++;
      byCategory[category].totalCost += req.totalCost;
    }

    return {
      totalItems: requirements.length,
      totalMaterialCost: requirements.reduce((sum, req) => sum + req.totalCost, 0),
      requirements,
      byCategory,
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private getMaterialName(material: {
    materialType?: string | null;
    lace_master?: { laceName?: string } | null;
    button_master?: { buttonName?: string } | null;
    thread_master?: { threadName?: string } | null;
    zipper_master?: { zipperName?: string } | null;
    elastic_master?: { elasticName?: string } | null;
    label_master?: { labelName?: string } | null;
    packaging_master?: { packagingName?: string } | null;
  }): string | null {
    switch (material.materialType) {
      case 'LACE':
        return material.lace_master?.laceName || null;
      case 'BUTTON':
        return material.button_master?.buttonName || null;
      case 'THREAD':
        return material.thread_master?.threadName || null;
      case 'ZIPPER':
        return material.zipper_master?.zipperName || null;
      case 'ELASTIC':
        return material.elastic_master?.elasticName || null;
      case 'LABEL':
        return material.label_master?.labelName || null;
      case 'PACKAGING':
        return material.packaging_master?.packagingName || null;
      default:
        return null;
    }
  }

  private getMaterialInfo(item: {
    materialType: string;
    material?: { name?: string; code?: string } | null;
    button_master?: { buttonName?: string; buttonCode?: string } | null;
    thread_master?: { threadName?: string; threadCode?: string } | null;
    zipper_master?: { zipperName?: string; zipperCode?: string } | null;
    lace_master?: { laceName?: string; laceCode?: string } | null;
    elastic_master?: { elasticName?: string; elasticCode?: string } | null;
    label_master?: { labelName?: string; labelCode?: string } | null;
    packaging_master?: { packagingName?: string; packagingCode?: string } | null;
    fabric_master?: { fabricName?: string; fabricCode?: string } | null;
  }): { name: string; code: string } {
    switch (item.materialType) {
      case 'BUTTON':
        return {
          name: item.button_master?.buttonName || 'Unknown Button',
          code: item.button_master?.buttonCode || '',
        };
      case 'THREAD':
        return {
          name: item.thread_master?.threadName || 'Unknown Thread',
          code: item.thread_master?.threadCode || '',
        };
      case 'ZIPPER':
        return {
          name: item.zipper_master?.zipperName || 'Unknown Zipper',
          code: item.zipper_master?.zipperCode || '',
        };
      case 'LACE':
        return {
          name: item.lace_master?.laceName || 'Unknown Lace',
          code: item.lace_master?.laceCode || '',
        };
      case 'ELASTIC':
        return {
          name: item.elastic_master?.elasticName || 'Unknown Elastic',
          code: item.elastic_master?.elasticCode || '',
        };
      case 'LABEL':
        return {
          name: item.label_master?.labelName || 'Unknown Label',
          code: item.label_master?.labelCode || '',
        };
      case 'PACKAGING':
        return {
          name: item.packaging_master?.packagingName || 'Unknown Packaging',
          code: item.packaging_master?.packagingCode || '',
        };
      case 'FABRIC':
        return {
          name: item.fabric_master?.fabricName || 'Unknown Fabric',
          code: item.fabric_master?.fabricCode || '',
        };
      default:
        return {
          name: item.material?.name || 'Unknown Material',
          code: item.material?.code || '',
        };
    }
  }

  private transformBOM(bom: unknown): order_bom {
    const bomData = bom as {
      totalMaterialCost?: unknown;
      items?: Array<{
        quantityPerGarment?: unknown;
        totalQuantity?: unknown;
        wastagePercent?: unknown;
        totalWithWastage?: unknown;
        unitPrice?: unknown;
        totalCost?: unknown;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };

    return {
      ...bomData,
      totalMaterialCost: bomData.totalMaterialCost ? Number(bomData.totalMaterialCost) : null,
      items: bomData.items?.map((item) => ({
        ...item,
        quantityPerGarment: Number(item.quantityPerGarment),
        totalQuantity: Number(item.totalQuantity),
        wastagePercent: item.wastagePercent ? Number(item.wastagePercent) : null,
        totalWithWastage: item.totalWithWastage ? Number(item.totalWithWastage) : null,
        unitPrice: Number(item.unitPrice),
        totalCost: Number(item.totalCost),
      })),
    } as unknown as order_bom;
  }
}

// Export singleton instance
export const orderBomService = new OrderBOMServiceClass();
