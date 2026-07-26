/**
 * Cost Sheet PO Generation Service
 * Business logic for generating Purchase Orders from approved Cost Sheets
 */

import prisma from '../config/database';
import { getDerivedOnHand } from './helpers/derived-stock.helper';
import { generateAtomicPONumber } from '../utils/atomicCodeGenerator';
import { randomUUID } from 'crypto';
import { PurchaseOrderStatus, POCategory as PrismaPOCategory, POSource, Unit } from '@prisma/client';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';
// costing-23: decimal.js helpers for money accumulation (aliased — Prisma Decimal already imported above)
import { Decimal as CurrencyDecimal, roundToCent, addCurrency, multiplyCurrency } from '../utils/currency';
import { gstService } from './gst.service';
import { processorRateValidationService } from './processor-rate-validation.service';
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
 * Generate unique PO number (PO2607-0001) — delegates to the shared atomic PO
 * series so cost-sheet POs cannot collide with POs minted by other services.
 */
async function generatePONumber(): Promise<string> {
  return generateAtomicPONumber();
}

/**
 * Check if a trim type is size-independent
 */
function isSizeIndependentTrim(materialType: string): boolean {
  return SIZE_INDEPENDENT_TRIM_TYPES.includes(materialType.toUpperCase() as any);
}

/**
 * Validate that all items have positive prices
 * @throws Error if any item has unitPrice <= 0
 */
function validatePositivePrices(
  items: Array<{ unitPrice: number; materialId?: string; materialName?: string }>,
  poCategory: string
): void {
  const zeroPriceItems = items.filter((item) => item.unitPrice <= 0);
  if (zeroPriceItems.length > 0) {
    const names = zeroPriceItems.map((i) => i.materialName || i.materialId || 'Unknown').join(', ');
    throw new Error(
      `Cannot generate ${poCategory} PO: ${zeroPriceItems.length} item(s) have invalid price (must be > 0): ${names}. ` +
        `Please set prices for all items before generating PO.`
    );
  }
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
        // Include relational trim items (Phase 4 - single source of truth)
        trimItems: true,
        // Include relational accessory items
        accessoryItems: true,
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

      if (fabricItem.sourcingStrategy === 'GREIGE_PROCESSED') {
        // A greige-processed FABRIC must carry a greige_master FK (greigeId) and must NOT be keyed to a
        // lace master. This enforces the fabric/lace separation at the source — rather than relying on the
        // fabric and lace loops staying disjoint by convention — and turns a silent no-PO into a loud
        // error when the greige is missing (bug-hunt F4/F5).
        if ((fabricItem as any).greigeLaceId) {
          throw new Error(
            `Fabric "${fabricItem.fabricName || fabricItem.greige?.greigeName || fabricItem.greigeId}" is keyed to a ` +
              `greige-lace master (greigeLaceId); greige lace belongs on the lace section, not fabric.`
          );
        }
        if (!fabricItem.greigeId) {
          throw new Error(
            `Fabric "${fabricItem.fabricName || 'item'}" is marked greige-processed but no greige is selected. ` +
              `Select a greige before generating the purchase order.`
          );
        }
        // GREIGE_PROCESSED: check greige_stock (not fabric_stock)
        const greigeStockInfo = await this.getStockInfoForGreige(fabricItem.greigeId);

        const greigeItem: MaterialRequirement = {
          materialId: fabricItem.greigeId, // Use greigeId — this is what we're buying
          materialCode: fabricItem.greige?.greigeCode || '',
          materialName: fabricItem.fabricName || fabricItem.greige?.greigeName || '',
          materialType: 'GREIGE',
          consumptionPerUnit,
          unit: Unit.METER,
          requiredQty,
          availableStock: greigeStockInfo.available,
          shortfall: Math.max(0, requiredQty - greigeStockInfo.available),
          unitPrice: Number(fabricItem.greigeCost || 0),
          priceRequired: !Number(fabricItem.greigeCost),
          sourcingStrategy: fabricItem.sourcingStrategy as any,
          fabricWidth: Number(fabricItem.width),
        };
        greigeItems.push(greigeItem);

        // Add processing item
        if (fabricItem.processorId) {
          const processingItem: MaterialRequirement = {
            materialId: fabricItem.greigeId,
            materialCode: fabricItem.greige?.greigeCode || '',
            materialName: fabricItem.fabricName || fabricItem.greige?.greigeName || '',
            materialType: 'PROCESSING',
            consumptionPerUnit,
            unit: Unit.METER,
            requiredQty,
            availableStock: 0,
            shortfall: requiredQty,
            unitPrice: Number(fabricItem.processingCost || 0),
            priceRequired: !Number(fabricItem.processingCost),
            sourcingStrategy: fabricItem.sourcingStrategy as any,
            fabricWidth: Number(fabricItem.width),
            processorId: fabricItem.processorId,
          };
          processingItems.push(processingItem);
        }
      } else if (fabricItem.sourcingStrategy === 'READY_FABRIC' && fabricItem.fabricId) {
        // READY_FABRIC: check fabric_stock
        const stockInfo = await this.getStockInfoForMaterial(fabricItem.fabricId);

        const item: MaterialRequirement = {
          materialId: fabricItem.fabricId, // Use fabricId — this is what we're buying
          materialCode: fabricItem.fabric?.fabricCode || '',
          materialName: fabricItem.fabricName || fabricItem.fabric?.fabricName || '',
          materialType: 'FABRIC',
          consumptionPerUnit,
          unit: Unit.METER,
          requiredQty,
          availableStock: stockInfo.available,
          shortfall: Math.max(0, requiredQty - stockInfo.available),
          unitPrice: Number(fabricItem.costPerMeter),
          priceRequired: !Number(fabricItem.costPerMeter),
          sourcingStrategy: fabricItem.sourcingStrategy as any,
          fabricWidth: Number(fabricItem.width),
        };
        fabricItems.push(item);
      }
      // STOCK_REUSE items don't need PO generation
    }

    // Process trims: prefer relational trimItems, fall back to JSON for backwards compatibility
    const trimItemsRelational = (costSheet as any).trimItems || [];
    const trimsDetails =
      trimItemsRelational.length > 0
        ? trimItemsRelational.map((t: any) => ({
            trimName: t.trimName,
            trimRate: Number(t.trimRate) || 0,
            trimQuantity: Number(t.trimQuantity) || 0,
            materialType: t.materialType,
            materialId: t.materialId,
            bomId: t.bomId,
            unit: t.unit,
            // All FK fields preserved from relational
            threadId: t.threadId,
            buttonId: t.buttonId,
            zipperId: t.zipperId,
            elasticId: t.elasticId,
            labelId: t.labelId,
            packagingId: t.packagingId,
          }))
        : (costSheet.trimsDetails as any[]) || [];

    logDebug('[CostSheetPOGen] Processing trims', {
      source: trimItemsRelational.length > 0 ? 'relational' : 'JSON',
      count: trimsDetails.length,
    });

    for (const trim of trimsDetails) {
      // Skip size-dependent trims (like SIZE_LABEL)
      if (!isSizeIndependentTrim(trim.materialType || trim.type)) {
        continue;
      }

      const consumptionPerUnit = Number(trim.trimQuantity || trim.quantity || 1);
      const requiredQty = totalOrderQty * consumptionPerUnit;
      // Resolve materialId: prefer bomId, then materialId, then specific type FKs, then generic masterId
      const materialId =
        trim.bomId ||
        trim.materialId ||
        trim.threadId ||
        trim.buttonId ||
        trim.zipperId ||
        trim.elasticId ||
        trim.labelId ||
        trim.packagingId ||
        // Generic trim FK IDs
        trim.hookEyeId ||
        trim.snapButtonId ||
        trim.buckleId ||
        trim.beltId ||
        trim.velcroId ||
        trim.drawstringId ||
        trim.ribbonId ||
        trim.sequinId ||
        trim.beadId ||
        trim.motifId ||
        trim.interliningId ||
        trim.paddingId ||
        trim.otherFastenerId ||
        trim.otherTapeId ||
        trim.otherDecorativeId ||
        trim.otherFunctionalId ||
        // Generic fallback for new material types
        trim.masterId;

      if (!materialId) continue;

      const stockInfo = await this.getStockInfoForMaterial(materialId);

      trimsItems.push({
        materialId,
        materialCode: trim.trimCode || trim.code || '',
        materialName: trim.trimName || trim.name || '',
        materialType: trim.materialType || trim.type || 'TRIMS',
        consumptionPerUnit,
        unit: trim.unit || Unit.PIECE,
        requiredQty,
        availableStock: stockInfo.available,
        shortfall: Math.max(0, requiredQty - stockInfo.available),
        unitPrice: Number(trim.trimRate || trim.rate || 0),
        priceRequired: !Number(trim.trimRate || trim.rate),
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
        unit: Unit.METER,
        requiredQty,
        availableStock: stockInfo.available,
        shortfall: Math.max(0, requiredQty - stockInfo.available),
        unitPrice: Number(laceItem.costPerMeter),
        priceRequired: !Number(laceItem.costPerMeter),
        laceSourcingStrategy: laceItem.sourcingStrategy as any,
        greigeLaceId: laceItem.greigeLaceId || undefined,
        labDipId: laceItem.labDipId || undefined,
        labDipStatus: laceItem.labDip?.status,
        processorId: laceItem.processorId || undefined,
        expectedShrinkagePercent: laceItem.greigeLace?.expectedShrinkagePercent
          ? Number(laceItem.greigeLace.expectedShrinkagePercent)
          : undefined,
      };

      if (laceItem.sourcingStrategy === 'GREIGE_PROCESSED') {
        // A greige-processed LACE must carry a greige-lace master FK (greigeLaceId) and must NOT be keyed
        // to a fabric greige master. Enforces the fabric/lace separation at the source, prevents an
        // empty-materialId PO line, and surfaces the real cause instead of the misleading "shrinkage not
        // configured" error the missing relation would otherwise trigger below (bug-hunt F4/F5).
        if ((laceItem as any).greigeId) {
          throw new Error(
            `Lace "${laceItem.laceName || laceItem.laceId}" is keyed to a fabric greige master (greigeId); ` +
              `greige fabric belongs on the fabric section, not lace.`
          );
        }
        if (!laceItem.greigeLaceId) {
          throw new Error(
            `Lace "${laceItem.laceName || laceItem.laceId}" is marked greige-processed but no greige lace is selected. ` +
              `Select a greige lace before generating the purchase order.`
          );
        }
        // Calculate greige quantity with shrinkage factor
        if (!laceItem.greigeLace?.expectedShrinkagePercent) {
          throw new Error(
            `Shrinkage % not configured for greige lace "${laceItem.greigeLace?.laceName || laceItem.laceId}". ` +
              `Set expected shrinkage percentage before generating PO.`
          );
        }
        const shrinkage = Number(laceItem.greigeLace.expectedShrinkagePercent);
        // A shrinkage of 100% (or more) divides by zero/negative below -> Infinity/garbage into
        // the PO quantity. Fail loud on bad data instead (bug-hunt BH-0366/BH-0364).
        if (shrinkage >= 100) {
          throw new Error(
            `Invalid expected shrinkage ${shrinkage}% for greige lace "${laceItem.greigeLace?.laceName || laceItem.laceId}": ` +
              `must be below 100% (it divides the greige requirement).`
          );
        }
        const greigeRequiredQty = requiredQty / (1 - shrinkage / 100);

        // Add greige lace item
        const greigeLaceItem: MaterialRequirement = {
          ...item,
          materialId: laceItem.greigeLaceId, // guaranteed present by the guard above
          materialCode: laceItem.greigeLace?.laceCode || '',
          materialName: laceItem.greigeLace?.laceName || '',
          materialType: 'GREIGE_LACE',
          requiredQty: greigeRequiredQty,
          shortfall: Math.max(0, greigeRequiredQty - stockInfo.available),
          unitPrice: Number(laceItem.greigeCost || 0),
          priceRequired: !Number(laceItem.greigeCost),
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
            priceRequired: !Number(laceItem.processingCost),
            processorId: laceItem.processorId,
          };
          laceProcessingItems.push(laceProcessingItem);
        }
      } else if (laceItem.sourcingStrategy === 'READY_LACE') {
        laceItems.push(item);
      }
      // STOCK_REUSE items don't need PO generation
    }

    const allItems = [
      ...fabricItems,
      ...greigeItems,
      ...trimsItems,
      ...processingItems,
      ...laceItems,
      ...greigeLaceItems,
      ...laceProcessingItems,
    ];
    const hasZeroPriceItems = allItems.some((item) => item.priceRequired);

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
      hasZeroPriceItems,
    };
  }

  /**
   * Get stock info for a material
   */
  private async getStockInfoForMaterial(materialId: string): Promise<StockInfo> {
    // T2-1: derived on-hand (per-lot truth) instead of hand-maintained stock_levels.quantity.
    const available = await getDerivedOnHand(materialId);

    // Also check fabric_stock for fabric materials
    const fabricStock = await prisma.fabric_stock.findMany({
      where: { fabricId: materialId },
    });

    const fabricAvailable = fabricStock.reduce((sum, stock) => {
      return sum + Number(stock.quantityAvailable || 0);
    }, 0);

    // Calculate reserved quantity from fabric_stock.quantityReserved
    const fabricReserved = fabricStock.reduce((sum, stock) => {
      return sum + Number(stock.quantityReserved || 0);
    }, 0);

    // Also check stock_reservations for this material
    const stockReservations = await prisma.stock_reservations.findMany({
      where: {
        materialId,
        status: 'ACTIVE',
      },
    });

    const reservationReserved = stockReservations.reduce((sum, res) => {
      return sum + Number(res.reservedQuantity || 0) - Number(res.consumedQuantity || 0);
    }, 0);

    const totalReserved = fabricReserved + reservationReserved;

    return {
      materialId,
      available: available + fabricAvailable,
      reserved: totalReserved,
      total: available + fabricAvailable - totalReserved,
      unit: 'UNITS',
    };
  }

  /**
   * Get stock info for greige from greige_stock table
   */
  private async getStockInfoForGreige(greigeId: string): Promise<StockInfo> {
    const greigeStock = await prisma.greige_stock.findMany({
      where: {
        greigeId,
        status: 'AVAILABLE',
      },
    });

    const available = greigeStock.reduce((sum, stock) => {
      return sum + Number(stock.quantityAvailable || 0);
    }, 0);

    // Calculate reserved from greige_stock.quantityReserved
    const reserved = greigeStock.reduce((sum, stock) => {
      return sum + Number(stock.quantityReserved || 0);
    }, 0);

    return {
      materialId: greigeId,
      available,
      reserved,
      total: available - reserved,
      unit: Unit.METER,
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
      // costing-21: net availability is available MINUS reserved (matches greige/material siblings)
      total: available - reserved,
      unit: Unit.METER,
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
    // costing-23: accumulate money on decimal.js instead of raw floats
    let subtotal = new CurrencyDecimal(0);
    let poTotalCgst = new CurrencyDecimal(0);
    let poTotalSgst = new CurrencyDecimal(0);
    let poTotalIgst = new CurrencyDecimal(0);

    // Determine interstate status
    const { isInterstate } = await gstService.isInterstatePO(input.supplierId);

    // Validate all items have positive prices
    validatePositivePrices(input.items as any, 'FABRIC');

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = roundToCent(multiplyCurrency(item.orderQty, item.unitPrice)).toNumber();
        subtotal = subtotal.plus(totalPrice);

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst = poTotalCgst.plus(gst.cgstAmount);
        poTotalSgst = poTotalSgst.plus(gst.sgstAmount);
        poTotalIgst = poTotalIgst.plus(gst.igstAmount);

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

    // costing-23: header totals derived exactly from the already-rounded line values
    const subtotalRounded = roundToCent(subtotal).toNumber();
    const totalCgst = roundToCent(poTotalCgst).toNumber();
    const totalSgst = roundToCent(poTotalSgst).toNumber();
    const totalIgst = roundToCent(poTotalIgst).toNumber();
    const totalTax = addCurrency(totalCgst, totalSgst, totalIgst).toNumber();
    const totalAmount = addCurrency(subtotalRounded, totalTax).toNumber();

    // costing-13: get-or-create generation row, PO create, and link update all in ONE
    // transaction; the conditional updateMany guard makes a concurrent double-click fail
    // (rolling back its duplicate PO) instead of silently creating two live POs.
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      let generation = await tx.cost_sheet_po_generation.findFirst({
        where: {
          costSheetId: input.costSheetId,
          fabricPOId: null,
          greigePOId: null, // Mutual exclusion with Greige
        },
        orderBy: { generatedAt: 'desc' },
      });

      if (!generation) {
        generation = await tx.cost_sheet_po_generation.create({
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

      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.supplierId,
          expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: PurchaseOrderStatus.DRAFT,
          subtotal: subtotalRounded,
          totalCgst,
          totalSgst,
          totalIgst,
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

      const linked = await tx.cost_sheet_po_generation.updateMany({
        where: { id: generation!.id, fabricPOId: null },
        data: { fabricPOId: po.id },
      });
      if (linked.count === 0) {
        throw new Error(
          'A Fabric PO was already generated for this cost sheet (concurrent request). Refresh and check the generation status.'
        );
      }

      return po;
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
    // costing-23: accumulate money on decimal.js instead of raw floats
    let subtotal = new CurrencyDecimal(0);
    let poTotalCgst = new CurrencyDecimal(0);
    let poTotalSgst = new CurrencyDecimal(0);
    let poTotalIgst = new CurrencyDecimal(0);

    const { isInterstate } = await gstService.isInterstatePO(input.supplierId);

    // Validate all items have positive prices
    validatePositivePrices(input.items as any, 'GREIGE');

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = roundToCent(multiplyCurrency(item.orderQty, item.unitPrice)).toNumber();
        subtotal = subtotal.plus(totalPrice);

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst = poTotalCgst.plus(gst.cgstAmount);
        poTotalSgst = poTotalSgst.plus(gst.sgstAmount);
        poTotalIgst = poTotalIgst.plus(gst.igstAmount);

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

    // costing-23: header totals derived exactly from the already-rounded line values
    const subtotalRounded = roundToCent(subtotal).toNumber();
    const totalCgst = roundToCent(poTotalCgst).toNumber();
    const totalSgst = roundToCent(poTotalSgst).toNumber();
    const totalIgst = roundToCent(poTotalIgst).toNumber();
    const totalTax = addCurrency(totalCgst, totalSgst, totalIgst).toNumber();
    const totalAmount = addCurrency(subtotalRounded, totalTax).toNumber();

    // costing-13: generation get-or-create + PO create + link update in one guarded transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      let generation = await tx.cost_sheet_po_generation.findFirst({
        where: {
          costSheetId: input.costSheetId,
          greigePOId: null,
          fabricPOId: null, // Mutual exclusion with Fabric
        },
        orderBy: { generatedAt: 'desc' },
      });

      if (!generation) {
        generation = await tx.cost_sheet_po_generation.create({
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

      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.supplierId,
          expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: PurchaseOrderStatus.DRAFT,
          subtotal: subtotalRounded,
          totalCgst,
          totalSgst,
          totalIgst,
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

      const linked = await tx.cost_sheet_po_generation.updateMany({
        where: { id: generation!.id, greigePOId: null },
        data: { greigePOId: po.id },
      });
      if (linked.count === 0) {
        throw new Error(
          'A Greige PO was already generated for this cost sheet (concurrent request). Refresh and check the generation status.'
        );
      }

      return po;
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

    // Validate processor rates have not changed significantly since cost sheet creation
    // BLOCKS PO generation if rates have changed >=5%
    const rateValidation = await processorRateValidationService.validateCostSheetRates(input.costSheetId);

    if (rateValidation.requiresNewCostSheet) {
      const blockingItemNames = rateValidation.blockingItems
        .map((item) => `${item.itemName} (${item.percentageChange.toFixed(1)}% change)`)
        .join(', ');

      throw new Error(
        `RATES_OUTDATED: Processor rates have changed significantly since this cost sheet was created. ` +
          `${rateValidation.blockingItems.length} item(s) have rate changes ≥5%: ${blockingItemNames}. ` +
          `Please create a new cost sheet version with current rates before generating PO.`
      );
    }

    // Log warning if there are minor rate changes (but don't block)
    if (rateValidation.warningItems.length > 0) {
      logWarn('Processing PO generation proceeding with minor rate changes', {
        costSheetId: input.costSheetId,
        processorId: input.processorId,
        warningCount: rateValidation.warningItems.length,
      });
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    // costing-23: accumulate money on decimal.js instead of raw floats
    let subtotal = new CurrencyDecimal(0);
    let poTotalCgst = new CurrencyDecimal(0);
    let poTotalSgst = new CurrencyDecimal(0);
    let poTotalIgst = new CurrencyDecimal(0);

    const { isInterstate } = await gstService.isInterstatePO(input.processorId);

    // Validate all items have positive prices
    validatePositivePrices(input.items as any, 'PROCESSING');

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = roundToCent(multiplyCurrency(item.orderQty, item.unitPrice)).toNumber();
        subtotal = subtotal.plus(totalPrice);

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst = poTotalCgst.plus(gst.cgstAmount);
        poTotalSgst = poTotalSgst.plus(gst.sgstAmount);
        poTotalIgst = poTotalIgst.plus(gst.igstAmount);

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

    // costing-23: header totals derived exactly from the already-rounded line values
    const subtotalRounded = roundToCent(subtotal).toNumber();
    const totalCgst = roundToCent(poTotalCgst).toNumber();
    const totalSgst = roundToCent(poTotalSgst).toNumber();
    const totalIgst = roundToCent(poTotalIgst).toNumber();
    const totalTax = addCurrency(totalCgst, totalSgst, totalIgst).toNumber();
    const totalAmount = addCurrency(subtotalRounded, totalTax).toNumber();

    // Create PO with PENDING_GREIGE status if linked to Greige PO
    const initialStatus = input.linkedGreigePOId ? PurchaseOrderStatus.PENDING_GREIGE : PurchaseOrderStatus.DRAFT;

    // costing-13: generation get-or-create + PO create + link update in one guarded transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      let generation = await tx.cost_sheet_po_generation.findFirst({
        where: {
          costSheetId: input.costSheetId,
          processingPOId: null,
        },
        orderBy: { generatedAt: 'desc' },
      });

      if (!generation) {
        generation = await tx.cost_sheet_po_generation.create({
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

      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.processorId,
          expectedDeliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          status: initialStatus,
          subtotal: subtotalRounded,
          totalCgst,
          totalSgst,
          totalIgst,
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

      const linked = await tx.cost_sheet_po_generation.updateMany({
        where: { id: generation!.id, processingPOId: null },
        data: { processingPOId: po.id },
      });
      if (linked.count === 0) {
        throw new Error(
          'A Processing PO was already generated for this cost sheet (concurrent request). Refresh and check the generation status.'
        );
      }

      return po;
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

    // Validate all items have positive prices
    validatePositivePrices(validItems as any, 'TRIMS');

    // Validate supplier
    const supplier = await prisma.suppliers.findUnique({
      where: { id: input.supplierId },
    });
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    // costing-23: accumulate money on decimal.js instead of raw floats
    let subtotal = new CurrencyDecimal(0);
    let poTotalCgst = new CurrencyDecimal(0);
    let poTotalSgst = new CurrencyDecimal(0);
    let poTotalIgst = new CurrencyDecimal(0);

    const { isInterstate } = await gstService.isInterstatePO(input.supplierId);

    const itemsData = await Promise.all(
      validItems.map(async (item) => {
        const totalPrice = roundToCent(multiplyCurrency(item.orderQty, item.unitPrice)).toNumber();
        subtotal = subtotal.plus(totalPrice);

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst = poTotalCgst.plus(gst.cgstAmount);
        poTotalSgst = poTotalSgst.plus(gst.sgstAmount);
        poTotalIgst = poTotalIgst.plus(gst.igstAmount);

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

    // costing-23: header totals derived exactly from the already-rounded line values
    const subtotalRounded = roundToCent(subtotal).toNumber();
    const totalCgst = roundToCent(poTotalCgst).toNumber();
    const totalSgst = roundToCent(poTotalSgst).toNumber();
    const totalIgst = roundToCent(poTotalIgst).toNumber();
    const totalTax = addCurrency(totalCgst, totalSgst, totalIgst).toNumber();
    const totalAmount = addCurrency(subtotalRounded, totalTax).toNumber();

    // costing-13: generation get-or-create + PO create + link update in one guarded transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      let generation = await tx.cost_sheet_po_generation.findFirst({
        where: {
          costSheetId: input.costSheetId,
          trimsPOId: null,
        },
        orderBy: { generatedAt: 'desc' },
      });

      if (!generation) {
        generation = await tx.cost_sheet_po_generation.create({
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

      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.supplierId,
          expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: PurchaseOrderStatus.DRAFT,
          subtotal: subtotalRounded,
          totalCgst,
          totalSgst,
          totalIgst,
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

      const linked = await tx.cost_sheet_po_generation.updateMany({
        where: { id: generation!.id, trimsPOId: null },
        data: { trimsPOId: po.id },
      });
      if (linked.count === 0) {
        throw new Error(
          'A Trims PO was already generated for this cost sheet (concurrent request). Refresh and check the generation status.'
        );
      }

      return po;
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

    // Validate all items have positive prices
    validatePositivePrices(input.items as any, 'LACE');

    // Validate supplier
    const supplier = await prisma.suppliers.findUnique({
      where: { id: input.supplierId },
    });
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    // costing-23: accumulate money on decimal.js instead of raw floats
    let subtotal = new CurrencyDecimal(0);
    let poTotalCgst = new CurrencyDecimal(0);
    let poTotalSgst = new CurrencyDecimal(0);
    let poTotalIgst = new CurrencyDecimal(0);

    const { isInterstate } = await gstService.isInterstatePO(input.supplierId);

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = roundToCent(multiplyCurrency(item.orderQty, item.unitPrice)).toNumber();
        subtotal = subtotal.plus(totalPrice);

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst = poTotalCgst.plus(gst.cgstAmount);
        poTotalSgst = poTotalSgst.plus(gst.sgstAmount);
        poTotalIgst = poTotalIgst.plus(gst.igstAmount);

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

    // costing-23: header totals derived exactly from the already-rounded line values
    const subtotalRounded = roundToCent(subtotal).toNumber();
    const totalCgst = roundToCent(poTotalCgst).toNumber();
    const totalSgst = roundToCent(poTotalSgst).toNumber();
    const totalIgst = roundToCent(poTotalIgst).toNumber();
    const totalTax = addCurrency(totalCgst, totalSgst, totalIgst).toNumber();
    const totalAmount = addCurrency(subtotalRounded, totalTax).toNumber();

    // costing-13: generation get-or-create + PO create + link update in one guarded transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      let generation = await tx.cost_sheet_po_generation.findFirst({
        where: {
          costSheetId: input.costSheetId,
          lacePOId: null,
        },
        orderBy: { generatedAt: 'desc' },
      });

      if (!generation) {
        generation = await tx.cost_sheet_po_generation.create({
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

      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.supplierId,
          expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: PurchaseOrderStatus.DRAFT,
          subtotal: subtotalRounded,
          totalCgst,
          totalSgst,
          totalIgst,
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

      const linked = await tx.cost_sheet_po_generation.updateMany({
        where: { id: generation!.id, lacePOId: null },
        data: { lacePOId: po.id },
      });
      if (linked.count === 0) {
        throw new Error(
          'A Lace PO was already generated for this cost sheet (concurrent request). Refresh and check the generation status.'
        );
      }

      return po;
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

    // Validate all items have positive prices
    validatePositivePrices(input.items as any, 'GREIGE_LACE');

    // Validate supplier
    const supplier = await prisma.suppliers.findUnique({
      where: { id: input.supplierId },
    });
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    // costing-23: accumulate money on decimal.js instead of raw floats
    let subtotal = new CurrencyDecimal(0);
    let poTotalCgst = new CurrencyDecimal(0);
    let poTotalSgst = new CurrencyDecimal(0);
    let poTotalIgst = new CurrencyDecimal(0);

    const { isInterstate } = await gstService.isInterstatePO(input.supplierId);

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = roundToCent(multiplyCurrency(item.orderQty, item.unitPrice)).toNumber();
        subtotal = subtotal.plus(totalPrice);

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst = poTotalCgst.plus(gst.cgstAmount);
        poTotalSgst = poTotalSgst.plus(gst.sgstAmount);
        poTotalIgst = poTotalIgst.plus(gst.igstAmount);

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
            `Greige Lace for processing. Shrinkage: ${item.expectedShrinkagePercent ?? 'NOT SET'}%. Allowance: ${item.allowancePercent}%`,
        };
      })
    );

    // costing-23: header totals derived exactly from the already-rounded line values
    const subtotalRounded = roundToCent(subtotal).toNumber();
    const totalCgst = roundToCent(poTotalCgst).toNumber();
    const totalSgst = roundToCent(poTotalSgst).toNumber();
    const totalIgst = roundToCent(poTotalIgst).toNumber();
    const totalTax = addCurrency(totalCgst, totalSgst, totalIgst).toNumber();
    const totalAmount = addCurrency(subtotalRounded, totalTax).toNumber();

    // costing-13: generation get-or-create + PO create + link update in one guarded transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      let generation = await tx.cost_sheet_po_generation.findFirst({
        where: {
          costSheetId: input.costSheetId,
          greigeLacePOId: null,
          lacePOId: null, // Mutual exclusion with ready lace
        },
        orderBy: { generatedAt: 'desc' },
      });

      if (!generation) {
        generation = await tx.cost_sheet_po_generation.create({
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

      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.supplierId,
          expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: PurchaseOrderStatus.DRAFT,
          subtotal: subtotalRounded,
          totalCgst,
          totalSgst,
          totalIgst,
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

      const linked = await tx.cost_sheet_po_generation.updateMany({
        where: { id: generation!.id, greigeLacePOId: null },
        data: { greigeLacePOId: po.id },
      });
      if (linked.count === 0) {
        throw new Error(
          'A Greige Lace PO was already generated for this cost sheet (concurrent request). Refresh and check the generation status.'
        );
      }

      return po;
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

    // Validate all items have positive prices
    validatePositivePrices(input.items as any, 'LACE_PROCESSING');

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

    // Validate processor rates have not changed significantly since cost sheet creation
    // BLOCKS PO generation if rates have changed >=5%
    const rateValidation = await processorRateValidationService.validateCostSheetRates(input.costSheetId);

    if (rateValidation.requiresNewCostSheet) {
      const blockingItemNames = rateValidation.blockingItems
        .map((item) => `${item.itemName} (${item.percentageChange.toFixed(1)}% change)`)
        .join(', ');

      throw new Error(
        `RATES_OUTDATED: Processor rates have changed significantly since this cost sheet was created. ` +
          `${rateValidation.blockingItems.length} item(s) have rate changes ≥5%: ${blockingItemNames}. ` +
          `Please create a new cost sheet version with current rates before generating Lace Processing PO.`
      );
    }

    // Log warning if there are minor rate changes (but don't block)
    if (rateValidation.warningItems.length > 0) {
      logWarn('Lace Processing PO generation proceeding with minor rate changes', {
        costSheetId: input.costSheetId,
        processorId: input.processorId,
        warningCount: rateValidation.warningItems.length,
      });
    }

    const poNumber = await generatePONumber();
    const poId = randomUUID();
    // costing-23: accumulate money on decimal.js instead of raw floats
    let subtotal = new CurrencyDecimal(0);
    let poTotalCgst = new CurrencyDecimal(0);
    let poTotalSgst = new CurrencyDecimal(0);
    let poTotalIgst = new CurrencyDecimal(0);

    const { isInterstate } = await gstService.isInterstatePO(input.processorId);

    const itemsData = await Promise.all(
      input.items.map(async (item) => {
        const totalPrice = roundToCent(multiplyCurrency(item.orderQty, item.unitPrice)).toNumber();
        subtotal = subtotal.plus(totalPrice);

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          materialId: item.materialId,
          isInterstate,
        });
        poTotalCgst = poTotalCgst.plus(gst.cgstAmount);
        poTotalSgst = poTotalSgst.plus(gst.sgstAmount);
        poTotalIgst = poTotalIgst.plus(gst.igstAmount);

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

    // costing-23: header totals derived exactly from the already-rounded line values
    const subtotalRounded = roundToCent(subtotal).toNumber();
    const totalCgst = roundToCent(poTotalCgst).toNumber();
    const totalSgst = roundToCent(poTotalSgst).toNumber();
    const totalIgst = roundToCent(poTotalIgst).toNumber();
    const totalTax = addCurrency(totalCgst, totalSgst, totalIgst).toNumber();
    const totalAmount = addCurrency(subtotalRounded, totalTax).toNumber();

    // Create PO with PENDING_GREIGE status if linked to Greige Lace PO
    const initialStatus = input.linkedGreigeLacePOId ? PurchaseOrderStatus.PENDING_GREIGE : PurchaseOrderStatus.DRAFT;

    // costing-13: generation get-or-create + PO create + link update in one guarded transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      let generation = await tx.cost_sheet_po_generation.findFirst({
        where: {
          costSheetId: input.costSheetId,
          laceProcessingPOId: null,
        },
        orderBy: { generatedAt: 'desc' },
      });

      if (!generation) {
        generation = await tx.cost_sheet_po_generation.create({
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

      const po = await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: input.processorId,
          expectedDeliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          status: initialStatus,
          subtotal: subtotalRounded,
          totalCgst,
          totalSgst,
          totalIgst,
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

      const linked = await tx.cost_sheet_po_generation.updateMany({
        where: { id: generation!.id, laceProcessingPOId: null },
        data: { laceProcessingPOId: po.id },
      });
      if (linked.count === 0) {
        throw new Error(
          'A Lace Processing PO was already generated for this cost sheet (concurrent request). Refresh and check the generation status.'
        );
      }

      return po;
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

    // Check if PO is fully received. Number() is REQUIRED: these are Prisma Decimal objects, and >= on
    // them compares their STRING forms — lexicographic, so "95">="100" is true and "100">="20" is false
    // (bug-hunt costing-8: the gate flipped on digit count, not quantity).
    const fullyReceived = greigeLacePO.purchase_order_items.every(
      (item) => Number(item.receivedQuantity) >= Number(item.orderedQuantity)
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
