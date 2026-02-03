/**
 * Cost Sheet PO Generation Service
 * Business logic for generating Purchase Orders from approved Cost Sheets
 */

import prisma from '../config/database';
import { randomUUID } from 'crypto';
import { PurchaseOrderStatus, POCategory as PrismaPOCategory } from '@prisma/client';
import { logInfo, logError, logDebug } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';
import {
  POCategory,
  GenerationStatus,
  SIZE_INDEPENDENT_TRIM_TYPES,
  MaterialRequirement,
  CalculatedRequirements,
  OrderQuantityResult,
  GenerateFabricPOInput,
  GenerateGreigePOInput,
  GenerateProcessingPOInput,
  GenerateTrimsPOInput,
  GeneratedPO,
  CostSheetPOGenerationResult,
  StockInfo,
} from '../types/costSheetPOGeneration.types';

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique PO number
 */
async function generatePONumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `PO${yearMonth.slice(2)}`;

  const lastPO = await prisma.purchase_orders.findFirst({
    where: {
      poNumber: { startsWith: prefix },
    },
    orderBy: { poNumber: 'desc' },
  });

  let sequence = 1;
  if (lastPO) {
    const lastSequence = parseInt(lastPO.poNumber.slice(-4)) || 0;
    sequence = lastSequence + 1;
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Check if a trim type is size-independent
 */
function isSizeIndependentTrim(materialType: string): boolean {
  return SIZE_INDEPENDENT_TRIM_TYPES.includes(materialType.toUpperCase() as any);
}

// ============================================
// Service Class
// ============================================

class CostSheetPOGenerationService {

  // ============================================
  // Requirement Calculation
  // ============================================

  /**
   * Calculate material requirements from cost sheet
   */
  async calculateRequirements(
    costSheetId: string,
    totalOrderQty: number
  ): Promise<CalculatedRequirements> {
    logDebug('Calculating requirements', { costSheetId, totalOrderQty });

    // Fetch cost sheet with related data
    const costSheet = await prisma.style_costing.findUnique({
      where: { id: costSheetId },
      include: {
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
          },
        },
        fabricItems: {
          include: {
            fabric: {
              select: {
                id: true,
                fabricCode: true,
                fabricName: true,
              },
            },
            processor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!costSheet) {
      throw new Error('Cost sheet not found');
    }

    if (costSheet.approvalStatus !== 'APPROVED') {
      throw new Error('Cost sheet must be approved before generating POs');
    }

    const fabricItems: MaterialRequirement[] = [];
    const greigeItems: MaterialRequirement[] = [];
    const trimsItems: MaterialRequirement[] = [];
    const processingItems: MaterialRequirement[] = [];

    // Process fabric items from style_costing_fabric_items
    for (const fabricItem of costSheet.fabricItems) {
      const consumptionPerUnit = Number(fabricItem.effectiveCad);
      const requiredQty = totalOrderQty * consumptionPerUnit;
      const stockInfo = await this.getStockInfoForMaterial(fabricItem.fabricId);

      const item: MaterialRequirement = {
        materialId: fabricItem.fabricId,
        materialCode: fabricItem.fabric.fabricCode,
        materialName: fabricItem.fabricName || fabricItem.fabric.fabricName,
        materialType: 'FABRIC',
        consumptionPerUnit,
        unit: 'METERS',
        requiredQty,
        availableStock: stockInfo.available,
        shortfall: Math.max(0, requiredQty - stockInfo.available),
        unitPrice: Number(fabricItem.costPerMeter),
        sourcingStrategy: fabricItem.sourcingStrategy as any,
        fabricWidth: Number(fabricItem.width),
      };

      if (fabricItem.sourcingStrategy === 'GREIGE_PROCESSED') {
        // Add greige item
        const greigeItem: MaterialRequirement = {
          ...item,
          materialType: 'GREIGE',
          unitPrice: Number(fabricItem.greigeCost || 0),
        };
        greigeItems.push(greigeItem);

        // Add processing item
        if (fabricItem.processorId) {
          const processingItem: MaterialRequirement = {
            ...item,
            materialType: 'PROCESSING',
            unitPrice: Number(fabricItem.processingCost || 0),
            processorId: fabricItem.processorId,
          };
          processingItems.push(processingItem);
        }
      } else if (fabricItem.sourcingStrategy === 'READY_FABRIC') {
        fabricItems.push(item);
      }
      // STOCK_REUSE items don't need PO generation
    }

    // Process trims from JSON trimsDetails
    const trimsDetails = (costSheet.trimsDetails as any[]) || [];
    for (const trim of trimsDetails) {
      // Skip size-dependent trims (like SIZE_LABEL)
      if (!isSizeIndependentTrim(trim.materialType || trim.type)) {
        continue;
      }

      const consumptionPerUnit = Number(trim.trimQuantity || trim.quantity || 1);
      const requiredQty = totalOrderQty * consumptionPerUnit;
      const materialId = trim.bomId || trim.materialId;

      if (!materialId) continue;

      const stockInfo = await this.getStockInfoForMaterial(materialId);

      trimsItems.push({
        materialId,
        materialCode: trim.trimCode || trim.code || '',
        materialName: trim.trimName || trim.name || '',
        materialType: trim.materialType || trim.type || 'TRIMS',
        consumptionPerUnit,
        unit: trim.unit || 'PCS',
        requiredQty,
        availableStock: stockInfo.available,
        shortfall: Math.max(0, requiredQty - stockInfo.available),
        unitPrice: Number(trim.trimRate || trim.rate || 0),
      });
    }

    return {
      fabricItems,
      greigeItems,
      trimsItems,
      processingItems,
      totalOrderQty,
      costSheetId,
      styleId: costSheet.styles.id,
      styleCode: costSheet.styles.styleCode,
    };
  }

  /**
   * Get stock info for a material
   */
  private async getStockInfoForMaterial(materialId: string): Promise<StockInfo> {
    const stockLevels = await prisma.stock_levels.findMany({
      where: { materialId },
    });

    const available = stockLevels.reduce((sum, level) => {
      return sum + Number(level.quantity || 0);
    }, 0);

    // Also check fabric_stock for fabric materials
    const fabricStock = await prisma.fabric_stock.findMany({
      where: { fabricId: materialId },
    });

    const fabricAvailable = fabricStock.reduce((sum, stock) => {
      return sum + Number(stock.quantityAvailable || 0);
    }, 0);

    return {
      materialId,
      available: available + fabricAvailable,
      reserved: 0, // TODO: Calculate reserved from existing requirements
      total: available + fabricAvailable,
      unit: 'UNITS',
    };
  }

  /**
   * Calculate order quantities with allowance
   */
  calculateOrderQuantities(
    requirements: MaterialRequirement[],
    defaultAllowancePercent: number = 3
  ): OrderQuantityResult[] {
    return requirements.map(req => {
      const allowancePercent = defaultAllowancePercent;
      const allowanceQty = req.shortfall * (allowancePercent / 100);
      const orderQty = req.shortfall + allowanceQty;
      const totalAmount = orderQty * req.unitPrice;

      return {
        materialId: req.materialId,
        materialName: req.materialName,
        unit: req.unit,
        requiredQty: req.requiredQty,
        availableStock: req.availableStock,
        shortfall: req.shortfall,
        allowancePercent,
        allowanceQty,
        orderQty,
        unitPrice: req.unitPrice,
        totalAmount,
        supplierId: req.supplierId,
      };
    });
  }

  // ============================================
  // PO Generation Methods
  // ============================================

  /**
   * Generate Fabric PO
   */
  async generateFabricPO(input: GenerateFabricPOInput): Promise<GeneratedPO> {
    logInfo('Generating Fabric PO', { costSheetId: input.costSheetId });

    // Validate supplier
    const supplier = await prisma.suppliers.findUnique({
      where: { id: input.supplierId },
    });
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    let totalAmount = 0;

    const itemsData = input.items.map(item => {
      const totalPrice = item.orderQty * item.unitPrice;
      totalAmount += totalPrice;

      return {
        id: randomUUID(),
        poId,
        materialId: item.materialId,
        orderedQuantity: item.orderQty,
        receivedQuantity: 0,
        unit: item.unit as any,
        unitPrice: item.unitPrice,
        totalPrice,
        remarks: item.remarks || `Allowance: ${item.allowancePercent}%`,
      };
    });

    // Get or create generation record
    let generation = await prisma.cost_sheet_po_generation.findFirst({
      where: {
        costSheetId: input.costSheetId,
        fabricPOId: null,
        greigePOId: null, // Mutual exclusion with Greige
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (!generation) {
      generation = await prisma.cost_sheet_po_generation.create({
        data: {
          id: randomUUID(),
          costSheetId: input.costSheetId,
          totalOrderQuantity: input.totalOrderQty,
          generatedById: input.userId,
          status: 'GENERATED',
          notes: input.notes,
        },
      });
    }

    // Create PO and items in transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.supplierId,
          expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: PurchaseOrderStatus.DRAFT,
          totalAmount,
          poCategory: 'FABRIC' as PrismaPOCategory,
          costSheetGenerationId: generation!.id,
          createdById: input.userId,
          remarks: `Generated from Cost Sheet PO Generation. Total Order Qty: ${input.totalOrderQty}`,
        },
      });

      await tx.purchase_order_items.createMany({
        data: itemsData,
      });

      return po;
    });

    // Update generation record
    await prisma.cost_sheet_po_generation.update({
      where: { id: generation.id },
      data: { fabricPOId: purchaseOrder.id },
    });

    logInfo('Fabric PO generated', { poId: purchaseOrder.id, poNumber });

    return {
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      poCategory: POCategory.FABRIC,
      status: purchaseOrder.status,
      supplierId: purchaseOrder.supplierId,
      supplierName: supplier.name,
      totalAmount: Number(purchaseOrder.totalAmount),
      itemCount: input.items.length,
    };
  }

  /**
   * Generate Greige PO
   */
  async generateGreigePO(input: GenerateGreigePOInput): Promise<GeneratedPO> {
    logInfo('Generating Greige PO', { costSheetId: input.costSheetId });

    // Validate supplier
    const supplier = await prisma.suppliers.findUnique({
      where: { id: input.supplierId },
    });
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    let totalAmount = 0;

    const itemsData = input.items.map(item => {
      const totalPrice = item.orderQty * item.unitPrice;
      totalAmount += totalPrice;

      return {
        id: randomUUID(),
        poId,
        materialId: item.materialId,
        orderedQuantity: item.orderQty,
        receivedQuantity: 0,
        unit: item.unit as any,
        unitPrice: item.unitPrice,
        totalPrice,
        remarks: item.remarks || `Greige for processing. Allowance: ${item.allowancePercent}%`,
      };
    });

    // Get or create generation record
    let generation = await prisma.cost_sheet_po_generation.findFirst({
      where: {
        costSheetId: input.costSheetId,
        greigePOId: null,
        fabricPOId: null, // Mutual exclusion with Fabric
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (!generation) {
      generation = await prisma.cost_sheet_po_generation.create({
        data: {
          id: randomUUID(),
          costSheetId: input.costSheetId,
          totalOrderQuantity: input.totalOrderQty,
          generatedById: input.userId,
          status: 'GENERATED',
          notes: input.notes,
        },
      });
    }

    // Create PO and items in transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.supplierId,
          expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: PurchaseOrderStatus.DRAFT,
          totalAmount,
          poCategory: 'GREIGE' as PrismaPOCategory,
          costSheetGenerationId: generation!.id,
          createdById: input.userId,
          remarks: `Greige PO for processing. Total Order Qty: ${input.totalOrderQty}`,
        },
      });

      await tx.purchase_order_items.createMany({
        data: itemsData,
      });

      return po;
    });

    // Update generation record
    await prisma.cost_sheet_po_generation.update({
      where: { id: generation.id },
      data: { greigePOId: purchaseOrder.id },
    });

    logInfo('Greige PO generated', { poId: purchaseOrder.id, poNumber });

    return {
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      poCategory: POCategory.GREIGE,
      status: purchaseOrder.status,
      supplierId: purchaseOrder.supplierId,
      supplierName: supplier.name,
      totalAmount: Number(purchaseOrder.totalAmount),
      itemCount: input.items.length,
    };
  }

  /**
   * Generate Processing PO
   */
  async generateProcessingPO(input: GenerateProcessingPOInput): Promise<GeneratedPO> {
    logInfo('Generating Processing PO', { costSheetId: input.costSheetId });

    // Validate processor
    const processor = await prisma.suppliers.findUnique({
      where: { id: input.processorId },
    });
    if (!processor) {
      throw new Error('Processor not found');
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    let totalAmount = 0;

    const itemsData = input.items.map(item => {
      const totalPrice = item.orderQty * item.unitPrice;
      totalAmount += totalPrice;

      return {
        id: randomUUID(),
        poId,
        materialId: item.materialId,
        orderedQuantity: item.orderQty,
        receivedQuantity: 0,
        unit: item.unit as any,
        unitPrice: item.unitPrice,
        totalPrice,
        remarks: item.remarks || `Processing: ${item.processType}. Allowance: ${item.allowancePercent}%`,
      };
    });

    // Find the generation record (should exist if Greige PO was created)
    let generation = await prisma.cost_sheet_po_generation.findFirst({
      where: {
        costSheetId: input.costSheetId,
        processingPOId: null,
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (!generation) {
      generation = await prisma.cost_sheet_po_generation.create({
        data: {
          id: randomUUID(),
          costSheetId: input.costSheetId,
          totalOrderQuantity: input.totalOrderQty,
          generatedById: input.userId,
          status: 'GENERATED',
          notes: input.notes,
        },
      });
    }

    // Create PO with PENDING_GREIGE status if linked to Greige PO
    const initialStatus = input.linkedGreigePOId
      ? PurchaseOrderStatus.PENDING_GREIGE
      : PurchaseOrderStatus.DRAFT;

    // Create PO and items in transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.processorId,
          expectedDeliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          status: initialStatus,
          totalAmount,
          poCategory: 'PROCESSING' as PrismaPOCategory,
          linkedGreigePOId: input.linkedGreigePOId,
          costSheetGenerationId: generation!.id,
          createdById: input.userId,
          remarks: `Processing PO. Total Order Qty: ${input.totalOrderQty}. Status: ${
            input.linkedGreigePOId ? 'Waiting for Greige' : 'Ready'
          }`,
        },
      });

      await tx.purchase_order_items.createMany({
        data: itemsData,
      });

      return po;
    });

    // Update generation record
    await prisma.cost_sheet_po_generation.update({
      where: { id: generation.id },
      data: { processingPOId: purchaseOrder.id },
    });

    logInfo('Processing PO generated', { poId: purchaseOrder.id, poNumber, status: initialStatus });

    return {
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      poCategory: POCategory.PROCESSING,
      status: purchaseOrder.status,
      supplierId: purchaseOrder.supplierId,
      supplierName: processor.name,
      totalAmount: Number(purchaseOrder.totalAmount),
      itemCount: input.items.length,
      linkedGreigePOId: input.linkedGreigePOId,
    };
  }

  /**
   * Generate Trims PO
   */
  async generateTrimsPO(input: GenerateTrimsPOInput): Promise<GeneratedPO> {
    logInfo('Generating Trims PO', { costSheetId: input.costSheetId });

    // Filter out size-dependent items (safety check)
    const validItems = input.items.filter(item =>
      isSizeIndependentTrim(item.materialType)
    );

    if (validItems.length === 0) {
      throw new Error('No size-independent trims to order');
    }

    // Validate supplier
    const supplier = await prisma.suppliers.findUnique({
      where: { id: input.supplierId },
    });
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    let totalAmount = 0;

    const itemsData = validItems.map(item => {
      const totalPrice = item.orderQty * item.unitPrice;
      totalAmount += totalPrice;

      return {
        id: randomUUID(),
        poId,
        materialId: item.materialId,
        orderedQuantity: item.orderQty,
        receivedQuantity: 0,
        unit: item.unit as any,
        unitPrice: item.unitPrice,
        totalPrice,
        remarks: item.remarks || `${item.materialType}. Allowance: ${item.allowancePercent}%`,
      };
    });

    // Get or create generation record
    let generation = await prisma.cost_sheet_po_generation.findFirst({
      where: {
        costSheetId: input.costSheetId,
        trimsPOId: null,
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (!generation) {
      generation = await prisma.cost_sheet_po_generation.create({
        data: {
          id: randomUUID(),
          costSheetId: input.costSheetId,
          totalOrderQuantity: input.totalOrderQty,
          generatedById: input.userId,
          status: 'GENERATED',
          notes: input.notes,
        },
      });
    }

    // Create PO and items in transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.supplierId,
          expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: PurchaseOrderStatus.DRAFT,
          totalAmount,
          poCategory: 'TRIMS' as PrismaPOCategory,
          costSheetGenerationId: generation!.id,
          createdById: input.userId,
          remarks: `Trims PO (Size-independent only). Total Order Qty: ${input.totalOrderQty}`,
        },
      });

      await tx.purchase_order_items.createMany({
        data: itemsData,
      });

      return po;
    });

    // Update generation record
    await prisma.cost_sheet_po_generation.update({
      where: { id: generation.id },
      data: { trimsPOId: purchaseOrder.id },
    });

    logInfo('Trims PO generated', { poId: purchaseOrder.id, poNumber });

    return {
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      poCategory: POCategory.TRIMS,
      status: purchaseOrder.status,
      supplierId: purchaseOrder.supplierId,
      supplierName: supplier.name,
      totalAmount: Number(purchaseOrder.totalAmount),
      itemCount: validItems.length,
    };
  }

  // ============================================
  // Status Update Methods
  // ============================================

  /**
   * Auto-update Processing PO status when Greige GRN is approved
   * Called from GRN service after approving a GRN for a Greige PO
   */
  async updateProcessingPOStatusOnGreigeGRN(greigePOId: string): Promise<void> {
    logInfo('Checking for Processing POs linked to Greige PO', { greigePOId });

    // Check if all ordered greige quantity has been received
    const greigePO = await prisma.purchase_orders.findUnique({
      where: { id: greigePOId },
      include: {
        purchase_order_items: true,
      },
    });

    if (!greigePO || greigePO.poCategory !== 'GREIGE') {
      return;
    }

    // Check if PO is fully received
    const fullyReceived = greigePO.purchase_order_items.every(
      item => item.receivedQuantity >= item.orderedQuantity
    );

    if (!fullyReceived) {
      logDebug('Greige PO not fully received yet', { greigePOId });
      return;
    }

    // Find and update linked Processing POs
    const processingPOs = await prisma.purchase_orders.findMany({
      where: {
        linkedGreigePOId: greigePOId,
        status: PurchaseOrderStatus.PENDING_GREIGE,
      },
    });

    for (const processingPO of processingPOs) {
      await prisma.purchase_orders.update({
        where: { id: processingPO.id },
        data: {
          status: PurchaseOrderStatus.READY_FOR_PROCESSING,
          remarks: `${processingPO.remarks || ''}\n[Auto-updated] Greige received - Ready for processing.`,
        },
      });

      logInfo('Processing PO status updated to READY_FOR_PROCESSING', {
        processingPOId: processingPO.id,
        greigePOId,
      });
    }
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get PO generation status for a cost sheet
   */
  async getGenerationStatus(costSheetId: string) {
    const generations = await prisma.cost_sheet_po_generation.findMany({
      where: { costSheetId },
      include: {
        generatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        purchaseOrders: {
          include: {
            suppliers: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { generatedAt: 'desc' },
    });

    return generations.map(gen => ({
      generationId: gen.id,
      costSheetId: gen.costSheetId,
      totalOrderQty: gen.totalOrderQuantity,
      generatedAt: gen.generatedAt,
      generatedBy: gen.generatedBy,
      status: gen.status as GenerationStatus,
      fabricPOId: gen.fabricPOId,
      greigePOId: gen.greigePOId,
      processingPOId: gen.processingPOId,
      trimsPOId: gen.trimsPOId,
      purchaseOrders: gen.purchaseOrders.map(po => ({
        id: po.id,
        poNumber: po.poNumber,
        poCategory: po.poCategory,
        status: po.status,
        totalAmount: Number(po.totalAmount),
        supplierName: po.suppliers.name,
        linkedGreigePOId: po.linkedGreigePOId,
      })),
    }));
  }

  /**
   * Get generation history for a cost sheet
   */
  async getGenerationHistory(costSheetId: string) {
    return this.getGenerationStatus(costSheetId);
  }
}

// Export singleton instance
export const costSheetPOGenerationService = new CostSheetPOGenerationService();
export default costSheetPOGenerationService;
