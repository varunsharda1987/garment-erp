/**
 * Cost Sheet PO Generation Service
 * Business logic for generating Purchase Orders from approved Cost Sheets
 */

import prisma from '../config/database';
import { randomUUID } from 'crypto';
import { PurchaseOrderStatus, POCategory as PrismaPOCategory, POSource } from '@prisma/client';
import { logInfo, logError, logDebug } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { gstService } from './gst.service';
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
  GenerateLacePOInput,
  GenerateGreigeLacePOInput,
  GenerateLaceProcessingPOInput,
  GeneratedPO,
  CostSheetPOGenerationResult,
  StockInfo,
  RateChangeWarning,
  LacePOGenerationValidation,
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
  async calculateRequirements(costSheetId: string, totalOrderQty: number): Promise<CalculatedRequirements> {
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
            greige: {
              select: {
                id: true,
                greigeCode: true,
                greigeName: true,
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
    // Lace items
    const laceItems: MaterialRequirement[] = [];
    const greigeLaceItems: MaterialRequirement[] = [];
    const laceProcessingItems: MaterialRequirement[] = [];

    // Process fabric items from style_costing_fabric_items
    for (const fabricItem of costSheet.fabricItems) {
      const consumptionPerUnit = Number(fabricItem.effectiveCad);
      const requiredQty = totalOrderQty * consumptionPerUnit;
      const stockInfo = fabricItem.fabricId
        ? await this.getStockInfoForMaterial(fabricItem.fabricId)
        : { available: 0 };

      const item: MaterialRequirement = {
        materialId: fabricItem.fabricId || fabricItem.greigeId || '',
        materialCode: fabricItem.fabric?.fabricCode || fabricItem.greige?.greigeCode || '',
        materialName: fabricItem.fabricName || fabricItem.fabric?.fabricName || fabricItem.greige?.greigeName || '',
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

    // Process lace items from style_costing_lace_items
    const laceItemsFromCostSheet = await prisma.style_costing_lace_items.findMany({
      where: { costingId: costSheetId },
      include: {
        lace: {
          select: {
            id: true,
            laceCode: true,
            laceName: true,
            isGreige: true,
            expectedShrinkagePercent: true,
          },
        },
        greigeLace: {
          select: {
            id: true,
            laceCode: true,
            laceName: true,
            expectedShrinkagePercent: true,
          },
        },
        processor: {
          select: {
            id: true,
            name: true,
          },
        },
        labDip: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    for (const laceItem of laceItemsFromCostSheet) {
      const consumptionPerUnit = Number(laceItem.effectiveQuantity);
      const requiredQty = totalOrderQty * consumptionPerUnit;
      const stockInfo = await this.getStockInfoForLace(laceItem.laceId);

      const item: MaterialRequirement = {
        materialId: laceItem.laceId,
        materialCode: laceItem.lace?.laceCode || '',
        materialName: laceItem.laceName || laceItem.lace?.laceName || '',
        materialType: 'LACE',
        consumptionPerUnit,
        unit: 'METERS',
        requiredQty,
        availableStock: stockInfo.available,
        shortfall: Math.max(0, requiredQty - stockInfo.available),
        unitPrice: Number(laceItem.costPerMeter),
        laceSourcingStrategy: laceItem.sourcingStrategy as any,
        greigeLaceId: laceItem.greigeLaceId || undefined,
        labDipId: laceItem.labDipId || undefined,
        labDipStatus: laceItem.labDip?.status,
        processorId: laceItem.processorId || undefined,
        expectedShrinkagePercent: laceItem.greigeLace
          ? Number(laceItem.greigeLace.expectedShrinkagePercent || 5)
          : undefined,
      };

      if (laceItem.sourcingStrategy === 'GREIGE_PROCESSED') {
        // Calculate greige quantity with shrinkage factor
        const shrinkage = Number(laceItem.greigeLace?.expectedShrinkagePercent || 5);
        const greigeRequiredQty = requiredQty / (1 - shrinkage / 100);

        // Add greige lace item
        const greigeLaceItem: MaterialRequirement = {
          ...item,
          materialId: laceItem.greigeLaceId || '',
          materialCode: laceItem.greigeLace?.laceCode || '',
          materialName: laceItem.greigeLace?.laceName || '',
          materialType: 'GREIGE_LACE',
          requiredQty: greigeRequiredQty,
          shortfall: Math.max(0, greigeRequiredQty - stockInfo.available),
          unitPrice: Number(laceItem.greigeCost || 0),
        };
        greigeLaceItems.push(greigeLaceItem);

        // Add lace processing item
        if (laceItem.processorId) {
          const laceProcessingItem: MaterialRequirement = {
            ...item,
            materialType: 'LACE_PROCESSING',
            requiredQty: greigeRequiredQty,
            shortfall: Math.max(0, greigeRequiredQty - stockInfo.available),
            unitPrice: Number(laceItem.processingCost || 0),
            processorId: laceItem.processorId,
          };
          laceProcessingItems.push(laceProcessingItem);
        }
      } else if (laceItem.sourcingStrategy === 'READY_LACE') {
        laceItems.push(item);
      }
      // STOCK_REUSE items don't need PO generation
    }

    return {
      fabricItems,
      greigeItems,
      trimsItems,
      processingItems,
      laceItems,
      greigeLaceItems,
      laceProcessingItems,
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
   * Get stock info for lace from lace_stock table
   */
  private async getStockInfoForLace(laceId: string): Promise<StockInfo> {
    const laceStock = await prisma.lace_stock.findMany({
      where: {
        laceId,
        status: 'AVAILABLE',
      },
    });

    const available = laceStock.reduce((sum, stock) => {
      return sum + Number(stock.quantityAvailable || 0);
    }, 0);

    const reserved = laceStock.reduce((sum, stock) => {
      return sum + Number(stock.quantityReserved || 0);
    }, 0);

    return {
      materialId: laceId,
      available,
      reserved,
      total: available + reserved,
      unit: 'METERS',
    };
  }

  /**
   * Calculate order quantities with allowance
   */
  calculateOrderQuantities(
    requirements: MaterialRequirement[],
    defaultAllowancePercent: number = 3
  ): OrderQuantityResult[] {
    return requirements.map((req) => {
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
    let subtotal = 0;
    let poTotalCgst = 0;
    let poTotalSgst = 0;
    let poTotalIgst = 0;

    // Determine interstate status
    const { isInterstate } = await gstService.isInterstatePO(input.supplierId);

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = item.orderQty * item.unitPrice;
        subtotal += totalPrice;

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst += gst.cgstAmount;
        poTotalSgst += gst.sgstAmount;
        poTotalIgst += gst.igstAmount;

        return {
          id: randomUUID(),
          poId,
          materialId: item.materialId,
          orderedQuantity: item.orderQty,
          receivedQuantity: 0,
          unit: item.unit as any,
          unitPrice: item.unitPrice,
          totalPrice,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks: item.remarks || `Allowance: ${item.allowancePercent}%`,
        };
      })
    );

    const totalTax = parseFloat((poTotalCgst + poTotalSgst + poTotalIgst).toFixed(2));
    const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

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
          subtotal: parseFloat(subtotal.toFixed(2)),
          totalCgst: parseFloat(poTotalCgst.toFixed(2)),
          totalSgst: parseFloat(poTotalSgst.toFixed(2)),
          totalIgst: parseFloat(poTotalIgst.toFixed(2)),
          totalTax,
          totalAmount,
          isInterstate,
          poCategory: 'FABRIC' as PrismaPOCategory,
          poSource: POSource.COST_SHEET,
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
    let subtotal = 0;
    let poTotalCgst = 0;
    let poTotalSgst = 0;
    let poTotalIgst = 0;

    const { isInterstate } = await gstService.isInterstatePO(input.supplierId);

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = item.orderQty * item.unitPrice;
        subtotal += totalPrice;

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst += gst.cgstAmount;
        poTotalSgst += gst.sgstAmount;
        poTotalIgst += gst.igstAmount;

        return {
          id: randomUUID(),
          poId,
          materialId: item.materialId,
          orderedQuantity: item.orderQty,
          receivedQuantity: 0,
          unit: item.unit as any,
          unitPrice: item.unitPrice,
          totalPrice,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks: item.remarks || `Greige for processing. Allowance: ${item.allowancePercent}%`,
        };
      })
    );

    const totalTax = parseFloat((poTotalCgst + poTotalSgst + poTotalIgst).toFixed(2));
    const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

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
          subtotal: parseFloat(subtotal.toFixed(2)),
          totalCgst: parseFloat(poTotalCgst.toFixed(2)),
          totalSgst: parseFloat(poTotalSgst.toFixed(2)),
          totalIgst: parseFloat(poTotalIgst.toFixed(2)),
          totalTax,
          totalAmount,
          isInterstate,
          poCategory: 'GREIGE' as PrismaPOCategory,
          poSource: POSource.COST_SHEET,
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
    let subtotal = 0;
    let poTotalCgst = 0;
    let poTotalSgst = 0;
    let poTotalIgst = 0;

    const { isInterstate } = await gstService.isInterstatePO(input.processorId);

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = item.orderQty * item.unitPrice;
        subtotal += totalPrice;

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst += gst.cgstAmount;
        poTotalSgst += gst.sgstAmount;
        poTotalIgst += gst.igstAmount;

        return {
          id: randomUUID(),
          poId,
          materialId: item.materialId,
          orderedQuantity: item.orderQty,
          receivedQuantity: 0,
          unit: item.unit as any,
          unitPrice: item.unitPrice,
          totalPrice,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks: item.remarks || `Processing: ${item.processType}. Allowance: ${item.allowancePercent}%`,
        };
      })
    );

    const totalTax = parseFloat((poTotalCgst + poTotalSgst + poTotalIgst).toFixed(2));
    const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

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
    const initialStatus = input.linkedGreigePOId ? PurchaseOrderStatus.PENDING_GREIGE : PurchaseOrderStatus.DRAFT;

    // Create PO and items in transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.processorId,
          expectedDeliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          status: initialStatus,
          subtotal: parseFloat(subtotal.toFixed(2)),
          totalCgst: parseFloat(poTotalCgst.toFixed(2)),
          totalSgst: parseFloat(poTotalSgst.toFixed(2)),
          totalIgst: parseFloat(poTotalIgst.toFixed(2)),
          totalTax,
          totalAmount,
          isInterstate,
          poCategory: 'PROCESSING' as PrismaPOCategory,
          poSource: POSource.COST_SHEET,
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
    const validItems = input.items.filter((item) => isSizeIndependentTrim(item.materialType));

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
    let subtotal = 0;
    let poTotalCgst = 0;
    let poTotalSgst = 0;
    let poTotalIgst = 0;

    const { isInterstate } = await gstService.isInterstatePO(input.supplierId);

    const itemsData = await Promise.all(
      validItems.map(async (item) => {
        const totalPrice = item.orderQty * item.unitPrice;
        subtotal += totalPrice;

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst += gst.cgstAmount;
        poTotalSgst += gst.sgstAmount;
        poTotalIgst += gst.igstAmount;

        return {
          id: randomUUID(),
          poId,
          materialId: item.materialId,
          orderedQuantity: item.orderQty,
          receivedQuantity: 0,
          unit: item.unit as any,
          unitPrice: item.unitPrice,
          totalPrice,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks: item.remarks || `${item.materialType}. Allowance: ${item.allowancePercent}%`,
        };
      })
    );

    const totalTax = parseFloat((poTotalCgst + poTotalSgst + poTotalIgst).toFixed(2));
    const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

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
          subtotal: parseFloat(subtotal.toFixed(2)),
          totalCgst: parseFloat(poTotalCgst.toFixed(2)),
          totalSgst: parseFloat(poTotalSgst.toFixed(2)),
          totalIgst: parseFloat(poTotalIgst.toFixed(2)),
          totalTax,
          totalAmount,
          isInterstate,
          poCategory: 'TRIMS' as PrismaPOCategory,
          poSource: POSource.COST_SHEET,
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
  // Lace PO Generation Methods
  // ============================================

  /**
   * Validate lace PO generation - checks lab dip approvals and rate changes
   */
  async validateLacePOGeneration(costSheetId: string): Promise<LacePOGenerationValidation> {
    const warnings: RateChangeWarning[] = [];
    const errors: string[] = [];
    const pendingLabDips: Array<{
      laceId: string;
      laceName: string;
      labDipId: string;
      status: string;
    }> = [];

    // Get lace items from cost sheet
    const laceItems = await prisma.style_costing_lace_items.findMany({
      where: { costingId: costSheetId },
      include: {
        lace: true,
        greigeLace: true,
        processor: true,
        labDip: true,
        rateCard: {
          include: {
            slab: true,
          },
        },
      },
    });

    for (const laceItem of laceItems) {
      if (laceItem.sourcingStrategy === 'GREIGE_PROCESSED') {
        // Check lab dip approval
        if (!laceItem.labDipId) {
          errors.push(`Lace "${laceItem.laceName}" requires lab dip approval but none is assigned`);
        } else if (laceItem.labDip?.status !== 'APPROVED') {
          pendingLabDips.push({
            laceId: laceItem.laceId,
            laceName: laceItem.laceName,
            labDipId: laceItem.labDipId,
            status: laceItem.labDip?.status || 'UNKNOWN',
          });
        }

        // Check for rate changes if processor is set
        if (laceItem.processorId && laceItem.greigeLaceId) {
          const currentRate = await prisma.processor_rate_card.findFirst({
            where: {
              processorId: laceItem.processorId,
              laceId: laceItem.greigeLaceId,
              processingType: 'DYEING',
            },
            include: {
              slab: true,
            },
            orderBy: { createdAt: 'desc' },
          });

          if (currentRate) {
            const costSheetRate = Number(laceItem.processingCost || 0);
            const currentRateValue = Number(currentRate.ratePerMeter || 0);

            if (currentRateValue !== costSheetRate && costSheetRate > 0) {
              const difference = currentRateValue - costSheetRate;
              const percentageChange = (difference / costSheetRate) * 100;

              warnings.push({
                laceId: laceItem.laceId,
                laceName: laceItem.laceName,
                processorId: laceItem.processorId,
                processorName: laceItem.processor?.name || '',
                costSheetRate,
                currentRate: currentRateValue,
                difference,
                percentageChange,
              });
            }
          }
        }
      }
    }

    return {
      isValid: errors.length === 0 && pendingLabDips.length === 0,
      warnings,
      errors,
      labDipValidation: {
        allApproved: pendingLabDips.length === 0,
        pending: pendingLabDips,
      },
    };
  }

  /**
   * Generate Ready Lace PO
   */
  async generateLacePO(input: GenerateLacePOInput): Promise<GeneratedPO> {
    logInfo('Generating Lace PO', { costSheetId: input.costSheetId });

    // Validate supplier
    const supplier = await prisma.suppliers.findUnique({
      where: { id: input.supplierId },
    });
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    let subtotal = 0;
    let poTotalCgst = 0;
    let poTotalSgst = 0;
    let poTotalIgst = 0;

    const { isInterstate } = await gstService.isInterstatePO(input.supplierId);

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = item.orderQty * item.unitPrice;
        subtotal += totalPrice;

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst += gst.cgstAmount;
        poTotalSgst += gst.sgstAmount;
        poTotalIgst += gst.igstAmount;

        return {
          id: randomUUID(),
          poId,
          materialId: item.materialId,
          orderedQuantity: item.orderQty,
          receivedQuantity: 0,
          unit: item.unit as any,
          unitPrice: item.unitPrice,
          totalPrice,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks: item.remarks || `Ready Lace. Allowance: ${item.allowancePercent}%`,
        };
      })
    );

    const totalTax = parseFloat((poTotalCgst + poTotalSgst + poTotalIgst).toFixed(2));
    const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

    // Get or create generation record
    let generation = await prisma.cost_sheet_po_generation.findFirst({
      where: {
        costSheetId: input.costSheetId,
        lacePOId: null,
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
          subtotal: parseFloat(subtotal.toFixed(2)),
          totalCgst: parseFloat(poTotalCgst.toFixed(2)),
          totalSgst: parseFloat(poTotalSgst.toFixed(2)),
          totalIgst: parseFloat(poTotalIgst.toFixed(2)),
          totalTax,
          totalAmount,
          isInterstate,
          poCategory: 'LACE' as PrismaPOCategory,
          poSource: POSource.COST_SHEET,
          costSheetGenerationId: generation!.id,
          createdById: input.userId,
          remarks: `Ready Lace PO. Total Order Qty: ${input.totalOrderQty}`,
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
      data: { lacePOId: purchaseOrder.id },
    });

    logInfo('Lace PO generated', { poId: purchaseOrder.id, poNumber });

    return {
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      poCategory: POCategory.LACE,
      status: purchaseOrder.status,
      supplierId: purchaseOrder.supplierId,
      supplierName: supplier.name,
      totalAmount: Number(purchaseOrder.totalAmount),
      itemCount: input.items.length,
    };
  }

  /**
   * Generate Greige Lace PO
   */
  async generateGreigeLacePO(input: GenerateGreigeLacePOInput): Promise<GeneratedPO> {
    logInfo('Generating Greige Lace PO', { costSheetId: input.costSheetId });

    // Validate supplier
    const supplier = await prisma.suppliers.findUnique({
      where: { id: input.supplierId },
    });
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    let subtotal = 0;
    let poTotalCgst = 0;
    let poTotalSgst = 0;
    let poTotalIgst = 0;

    const { isInterstate } = await gstService.isInterstatePO(input.supplierId);

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = item.orderQty * item.unitPrice;
        subtotal += totalPrice;

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst += gst.cgstAmount;
        poTotalSgst += gst.sgstAmount;
        poTotalIgst += gst.igstAmount;

        return {
          id: randomUUID(),
          poId,
          materialId: item.materialId,
          orderedQuantity: item.orderQty,
          receivedQuantity: 0,
          unit: item.unit as any,
          unitPrice: item.unitPrice,
          totalPrice,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks:
            item.remarks ||
            `Greige Lace for processing. Shrinkage: ${item.expectedShrinkagePercent || 5}%. Allowance: ${item.allowancePercent}%`,
        };
      })
    );

    const totalTax = parseFloat((poTotalCgst + poTotalSgst + poTotalIgst).toFixed(2));
    const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

    // Get or create generation record
    let generation = await prisma.cost_sheet_po_generation.findFirst({
      where: {
        costSheetId: input.costSheetId,
        greigeLacePOId: null,
        lacePOId: null, // Mutual exclusion with ready lace
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
          subtotal: parseFloat(subtotal.toFixed(2)),
          totalCgst: parseFloat(poTotalCgst.toFixed(2)),
          totalSgst: parseFloat(poTotalSgst.toFixed(2)),
          totalIgst: parseFloat(poTotalIgst.toFixed(2)),
          totalTax,
          totalAmount,
          isInterstate,
          poCategory: 'GREIGE_LACE' as PrismaPOCategory,
          poSource: POSource.COST_SHEET,
          costSheetGenerationId: generation!.id,
          createdById: input.userId,
          remarks: `Greige Lace PO for processing. Total Order Qty: ${input.totalOrderQty}`,
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
      data: { greigeLacePOId: purchaseOrder.id },
    });

    logInfo('Greige Lace PO generated', { poId: purchaseOrder.id, poNumber });

    return {
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      poCategory: POCategory.GREIGE_LACE,
      status: purchaseOrder.status,
      supplierId: purchaseOrder.supplierId,
      supplierName: supplier.name,
      totalAmount: Number(purchaseOrder.totalAmount),
      itemCount: input.items.length,
    };
  }

  /**
   * Generate Lace Processing PO
   */
  async generateLaceProcessingPO(input: GenerateLaceProcessingPOInput): Promise<GeneratedPO> {
    logInfo('Generating Lace Processing PO', { costSheetId: input.costSheetId });

    // Validate all lab dips are approved
    for (const item of input.items) {
      if (item.labDipId) {
        const labDip = await prisma.lace_lab_dip.findUnique({
          where: { id: item.labDipId },
        });
        if (!labDip || labDip.status !== 'APPROVED') {
          throw new Error(`Lab dip must be approved before generating processing PO. Lab dip ID: ${item.labDipId}`);
        }
      }
    }

    // Validate processor
    const processor = await prisma.suppliers.findUnique({
      where: { id: input.processorId },
    });
    if (!processor) {
      throw new Error('Processor not found');
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    let subtotal = 0;
    let poTotalCgst = 0;
    let poTotalSgst = 0;
    let poTotalIgst = 0;

    const { isInterstate } = await gstService.isInterstatePO(input.processorId);

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = item.orderQty * item.unitPrice;
        subtotal += totalPrice;

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst += gst.cgstAmount;
        poTotalSgst += gst.sgstAmount;
        poTotalIgst += gst.igstAmount;

        return {
          id: randomUUID(),
          poId,
          materialId: item.materialId,
          orderedQuantity: item.orderQty,
          receivedQuantity: 0,
          unit: item.unit as any,
          unitPrice: item.unitPrice,
          totalPrice,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks:
            item.remarks ||
            `Lace ${item.processType}. Lab Dip: ${item.labDipId || 'N/A'}. Allowance: ${item.allowancePercent}%`,
        };
      })
    );

    const totalTax = parseFloat((poTotalCgst + poTotalSgst + poTotalIgst).toFixed(2));
    const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

    // Find the generation record (should exist if Greige Lace PO was created)
    let generation = await prisma.cost_sheet_po_generation.findFirst({
      where: {
        costSheetId: input.costSheetId,
        laceProcessingPOId: null,
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

    // Create PO with PENDING_GREIGE status if linked to Greige Lace PO
    const initialStatus = input.linkedGreigeLacePOId ? PurchaseOrderStatus.PENDING_GREIGE : PurchaseOrderStatus.DRAFT;

    // Create PO and items in transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.processorId,
          expectedDeliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          status: initialStatus,
          subtotal: parseFloat(subtotal.toFixed(2)),
          totalCgst: parseFloat(poTotalCgst.toFixed(2)),
          totalSgst: parseFloat(poTotalSgst.toFixed(2)),
          totalIgst: parseFloat(poTotalIgst.toFixed(2)),
          totalTax,
          totalAmount,
          isInterstate,
          poCategory: 'LACE_PROCESSING' as PrismaPOCategory,
          poSource: POSource.COST_SHEET,
          linkedGreigePOId: input.linkedGreigeLacePOId,
          costSheetGenerationId: generation!.id,
          createdById: input.userId,
          remarks: `Lace Processing PO. Total Order Qty: ${input.totalOrderQty}. Status: ${
            input.linkedGreigeLacePOId ? 'Waiting for Greige Lace' : 'Ready'
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
      data: { laceProcessingPOId: purchaseOrder.id },
    });

    logInfo('Lace Processing PO generated', { poId: purchaseOrder.id, poNumber, status: initialStatus });

    return {
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      poCategory: POCategory.LACE_PROCESSING,
      status: purchaseOrder.status,
      supplierId: purchaseOrder.supplierId,
      supplierName: processor.name,
      totalAmount: Number(purchaseOrder.totalAmount),
      itemCount: input.items.length,
      linkedGreigePOId: input.linkedGreigeLacePOId,
    };
  }

  /**
   * Auto-update Lace Processing PO status when Greige Lace GRN is approved
   * Called from GRN service after approving a GRN for a Greige Lace PO
   */
  async updateLaceProcessingPOStatusOnGreigeLaceGRN(greigeLacePOId: string): Promise<void> {
    logInfo('Checking for Lace Processing POs linked to Greige Lace PO', { greigeLacePOId });

    // Check if all ordered greige lace quantity has been received
    const greigeLacePO = await prisma.purchase_orders.findUnique({
      where: { id: greigeLacePOId },
      include: {
        purchase_order_items: true,
      },
    });

    if (!greigeLacePO || greigeLacePO.poCategory !== 'GREIGE_LACE') {
      return;
    }

    // Check if PO is fully received
    const fullyReceived = greigeLacePO.purchase_order_items.every(
      (item) => item.receivedQuantity >= item.orderedQuantity
    );

    if (!fullyReceived) {
      logDebug('Greige Lace PO not fully received yet', { greigeLacePOId });
      return;
    }

    // Find and update linked Lace Processing POs
    const laceProcessingPOs = await prisma.purchase_orders.findMany({
      where: {
        linkedGreigePOId: greigeLacePOId,
        status: PurchaseOrderStatus.PENDING_GREIGE,
      },
    });

    for (const processingPO of laceProcessingPOs) {
      await prisma.purchase_orders.update({
        where: { id: processingPO.id },
        data: {
          status: PurchaseOrderStatus.READY_FOR_PROCESSING,
          remarks: `${processingPO.remarks || ''}\n[Auto-updated] Greige lace received - Ready for processing.`,
        },
      });

      logInfo('Lace Processing PO status updated to READY_FOR_PROCESSING', {
        laceProcessingPOId: processingPO.id,
        greigeLacePOId,
      });
    }
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
    const fullyReceived = greigePO.purchase_order_items.every((item) => item.receivedQuantity >= item.orderedQuantity);

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

    return generations.map((gen) => ({
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
      purchaseOrders: gen.purchaseOrders.map((po) => ({
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
