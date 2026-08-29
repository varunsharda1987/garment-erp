/**
 * Order Item Costing Service
 * Handles order-level costing recalculation based on selected CAD width
 */

import prisma from '../config/database';
import { Prisma, order_item_costing } from '@prisma/client';
import { NotFoundError, ValidationError, BusinessError, InternalError } from '../errors';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';
import { addCurrency, roundToCent } from '../utils/currency';

// Types
export interface RecalculateCostingDTO {
  orderItemId: string;
  selectedCadId?: string; // If not provided, uses order item's selectedCadId
}

export interface OrderCostingResult {
  orderItemId: string;
  selectedCadId: string | null;
  cadMeters: number | null;
  cadWidth: number | null;
  fabricTotal: number;
  trimsTotal: number;
  cmtTotal: number;
  embroideryTotal: number;
  accessoriesTotal: number;
  processingTotal: number;
  overheadsTotal: number;
  totalCostPerPiece: number;
  sellingPricePerPiece: number | null;
  profitMargin: number | null;
  baseCostingId: string | null;
  isRecalculated: boolean;
}

interface FabricDetail {
  fabricName: string;
  fabricWidth: number;
  fabricAverage: number;
  fabricRate: number;
  fabricTotal: number;
}

interface TrimDetail {
  trimName: string;
  trimQuantity: number;
  trimRate: number;
  trimTotal: number;
}

interface EmbroideryDetail {
  embroideryName: string;
  embroideryAverage: number;
  embroideryRate: number;
  embroideryTotal: number;
}

interface AccessoryDetail {
  accessoryName: string;
  accessoryQuantity: number;
  accessoryRate: number;
  accessoryTotal: number;
}

class OrderCostingServiceClass {
  /**
   * Get order item costing by order item ID
   */
  async getByOrderItemId(orderItemId: string): Promise<order_item_costing | null> {
    return prisma.order_item_costing.findUnique({
      where: { orderItemId },
      include: {
        selectedCad: true,
        baseCosting: true,
      },
    });
  }

  /**
   * Recalculate costing for an order item based on selected CAD
   * Uses the style's base costing as template but recalculates fabric costs based on selected CAD
   */
  async recalculate(data: RecalculateCostingDTO, tx?: Prisma.TransactionClient): Promise<OrderCostingResult> {
    logDebug('Recalculating order costing', { orderItemId: data.orderItemId });

    const db = tx ?? prisma;

    try {
      // Get order item with all required relations
      const orderItem = await db.order_items.findUnique({
        where: { id: data.orderItemId },
        include: {
          styles: {
            include: {
              // Only the current approved version — a bare include returned unspecified order and
              // could base recalculation on a superseded/unapproved sheet (bug-hunt orders-20)
              style_costing: {
                where: { isApproved: true, supersededById: null },
                orderBy: { version: 'desc' as const },
                take: 1,
              },
              style_components: {
                include: {
                  style_fabrics: {
                    include: {
                      fabric: true,
                      fabricCAD: true,
                      embroidery: true,
                    },
                  },
                },
              },
              style_material_bom: {
                include: {
                  lace_master: true,
                  button_master: true,
                  thread_master: true,
                  zipper_master: true,
                  elastic_master: true,
                  label_master: true,
                  packaging_master: true,
                },
              },
              style_processes: true,
            },
          },
          selectedCad: true,
          order_item_costing: true,
        },
      });

      if (!orderItem) {
        throw new NotFoundError('Order Item', data.orderItemId);
      }

      const style = orderItem.styles;
      if (!style) {
        throw new BusinessError('Order item not linked to a style');
      }

      // Determine which CAD to use
      const selectedCadId = data.selectedCadId || orderItem.selectedCadId;

      // Get the selected CAD details
      let selectedCad = null;
      if (selectedCadId) {
        selectedCad = await db.fabric_width_cad.findUnique({
          where: { id: selectedCadId },
        });
      }

      // Get base style costing (take the first/latest if multiple versions exist)
      const baseCosting = Array.isArray(style.style_costing) ? style.style_costing[0] : style.style_costing;

      // Calculate fabric costs based on selected CAD
      const { fabricTotal, cadMeters, cadWidth } = this.calculateFabricCostsWithCad(style, selectedCad);

      // Get other costs from base costing or calculate from style
      const trimsTotal = baseCosting ? Number(baseCosting.trimsTotal || 0) : this.calculateTrimsCost(style);

      const embroideryTotal = baseCosting
        ? Number(baseCosting.embroideryTotal || 0)
        : this.calculateEmbroideryCost(style, selectedCad);

      const accessoriesTotal = baseCosting ? Number(baseCosting.accessoriesTotal || 0) : 0;

      // Lace lives in its own sheet column (style_costing_lace_items rollup) and is part of
      // the sheet's subtotal — omitting it undercounted every lace-bearing order costing
      const laceTotal = baseCosting ? Number(baseCosting.laceTotal || 0) : 0;

      const cmtTotal = baseCosting ? Number(baseCosting.cmtTotal || 0) : 0;

      const processingTotal = baseCosting
        ? Number(baseCosting.totalProcessingCost || 0)
        : this.calculateProcessingCost(style);

      // Calculate overheads
      const overheadsTotal = baseCosting
        ? Number(baseCosting.adminOverhead || 0) +
          Number(baseCosting.factoryOverhead || 0) +
          Number(baseCosting.transportCost || 0) +
          Number(baseCosting.otherOverheads || 0)
        : 0;

      // Calculate total cost per piece via decimal.js — raw float math drifted vs the
      // cost-sheet module's Decimal math (bug-hunt orders-17)
      const subtotalDec = addCurrency(
        fabricTotal,
        trimsTotal,
        laceTotal,
        embroideryTotal,
        accessoriesTotal,
        cmtTotal,
        processingTotal,
        overheadsTotal
      );

      // Apply value loss and markup from base costing
      const valueLossPercent = baseCosting ? Number(baseCosting.valueLossPercent || 2) : 2;
      const markupPercent = baseCosting ? Number(baseCosting.markupPercent || 15) : 15;

      const valueLossAmountDec = subtotalDec.times(valueLossPercent).dividedBy(100);
      const totalAfterValueLossDec = subtotalDec.plus(valueLossAmountDec);
      const markupAmountDec = totalAfterValueLossDec.times(markupPercent).dividedBy(100);
      const totalCostPerPiece = roundToCent(totalAfterValueLossDec.plus(markupAmountDec)).toNumber();

      // Calculate selling price and margin if base costing has it
      let sellingPricePerPiece = null;
      let profitMargin = null;

      if (baseCosting?.sellingPricePerPiece) {
        sellingPricePerPiece = Number(baseCosting.sellingPricePerPiece);
        if (totalCostPerPiece > 0) {
          profitMargin = ((sellingPricePerPiece - totalCostPerPiece) / sellingPricePerPiece) * 100;
        }
      }

      // Upsert order item costing
      const upsertedCosting = await db.order_item_costing.upsert({
        where: { orderItemId: data.orderItemId },
        create: {
          orderItemId: data.orderItemId,
          selectedCadId: selectedCadId || null,
          cadMeters: cadMeters !== null ? new Prisma.Decimal(cadMeters) : null,
          cadWidth: cadWidth !== null ? new Prisma.Decimal(cadWidth) : null,
          fabricTotal: new Prisma.Decimal(fabricTotal),
          trimsTotal: new Prisma.Decimal(trimsTotal),
          cmtTotal: new Prisma.Decimal(cmtTotal),
          embroideryTotal: new Prisma.Decimal(embroideryTotal),
          accessoriesTotal: new Prisma.Decimal(accessoriesTotal),
          processingTotal: new Prisma.Decimal(processingTotal),
          overheadsTotal: new Prisma.Decimal(overheadsTotal),
          totalCostPerPiece: new Prisma.Decimal(totalCostPerPiece),
          sellingPricePerPiece: sellingPricePerPiece !== null ? new Prisma.Decimal(sellingPricePerPiece) : null,
          profitMargin: profitMargin !== null ? new Prisma.Decimal(profitMargin) : null,
          baseCostingId: baseCosting?.id || null,
          recalculatedAt: new Date(),
        },
        update: {
          selectedCadId: selectedCadId || null,
          cadMeters: cadMeters !== null ? new Prisma.Decimal(cadMeters) : null,
          cadWidth: cadWidth !== null ? new Prisma.Decimal(cadWidth) : null,
          fabricTotal: new Prisma.Decimal(fabricTotal),
          trimsTotal: new Prisma.Decimal(trimsTotal),
          cmtTotal: new Prisma.Decimal(cmtTotal),
          embroideryTotal: new Prisma.Decimal(embroideryTotal),
          accessoriesTotal: new Prisma.Decimal(accessoriesTotal),
          processingTotal: new Prisma.Decimal(processingTotal),
          overheadsTotal: new Prisma.Decimal(overheadsTotal),
          totalCostPerPiece: new Prisma.Decimal(totalCostPerPiece),
          sellingPricePerPiece: sellingPricePerPiece !== null ? new Prisma.Decimal(sellingPricePerPiece) : null,
          profitMargin: profitMargin !== null ? new Prisma.Decimal(profitMargin) : null,
          baseCostingId: baseCosting?.id || null,
          recalculatedAt: new Date(),
        },
      });

      logInfo('Order costing recalculated', {
        orderItemId: data.orderItemId,
        selectedCadId,
        totalCostPerPiece,
      });

      return {
        orderItemId: data.orderItemId,
        selectedCadId: selectedCadId || null,
        cadMeters,
        cadWidth,
        fabricTotal,
        trimsTotal,
        cmtTotal,
        embroideryTotal,
        accessoriesTotal,
        processingTotal,
        overheadsTotal,
        totalCostPerPiece,
        sellingPricePerPiece,
        profitMargin,
        baseCostingId: baseCosting?.id || null,
        isRecalculated: true,
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BusinessError) {
        throw error;
      }
      logError('Failed to recalculate order costing', error as Error);
      throw new InternalError('Failed to recalculate order costing');
    }
  }

  /**
   * Select CAD and recalculate costing in one operation
   * bug-hunt orders-21: CAD selection and the recalculated costing must land together —
   * a failure between the two writes left selectedCadId pointing at a CAD the stored
   * costing was never computed from.
   */
  async selectCadAndRecalculate(orderItemId: string, cadId: string): Promise<OrderCostingResult> {
    return prisma.$transaction(async (tx) => {
      // First update the order item's selected CAD
      await tx.order_items.update({
        where: { id: orderItemId },
        data: { selectedCadId: cadId },
      });

      // Then recalculate costing within the same transaction
      return this.recalculate({ orderItemId, selectedCadId: cadId }, tx);
    });
  }

  /**
   * Delete order item costing (reset to use style costing)
   */
  async delete(orderItemId: string): Promise<void> {
    const existing = await prisma.order_item_costing.findUnique({
      where: { orderItemId },
    });

    if (!existing) {
      return; // Nothing to delete
    }

    // bug-hunt orders-21: costing removal and CAD clear must land together —
    // a failure between the two writes left a dangling selectedCadId with no costing.
    await prisma.$transaction(async (tx) => {
      await tx.order_item_costing.delete({
        where: { orderItemId },
      });

      // Also clear the selected CAD from order item
      await tx.order_items.update({
        where: { id: orderItemId },
        data: { selectedCadId: null },
      });
    });

    logInfo('Order costing deleted', { orderItemId });
  }

  /**
   * Calculate fabric costs based on selected CAD
   * BUG-CS4 FIX: Improved matching logic to properly use the order's selected CAD
   */
  private calculateFabricCostsWithCad(
    style: any,
    selectedCad: any | null
  ): { fabricTotal: number; cadMeters: number | null; cadWidth: number | null } {
    let fabricTotal = 0;
    let cadMeters: number | null = null;
    let cadWidth: number | null = null;

    // If we have a selected CAD, use it for calculations
    if (selectedCad) {
      cadMeters = selectedCad.cadMeters ? parseFloat(selectedCad.cadMeters.toString()) : null;
      cadWidth = selectedCad.cutableWidth ? parseFloat(selectedCad.cutableWidth.toString()) : null;

      // Track if we found a matching fabric for the selected CAD
      let foundMatchingFabric = false;

      // Find the matching fabric and calculate cost
      for (const component of style.style_components || []) {
        for (const styleFabric of component.style_fabrics || []) {
          // BUG-CS4 FIX: Match using styleFabricId from the CAD record, not widthCADs relation
          // The widthCADs relation wasn't being loaded, causing all fabrics to use their own CAD
          // instead of the order's selected CAD
          const isMatchingFabric =
            selectedCad.styleFabricId === styleFabric.id || // CAD was created for this fabric
            styleFabric.fabricCADId === selectedCad.id; // Style fabric points to this CAD

          if (isMatchingFabric) {
            foundMatchingFabric = true;
            const fabricRate = parseFloat(styleFabric.unitPrice?.toString() || '0');
            const fabricCost = (cadMeters || 0) * fabricRate;
            fabricTotal += fabricCost;
          } else {
            // For other fabrics, use their own CAD
            const cad = styleFabric.fabricCAD;
            if (cad) {
              const meters = parseFloat(cad.cadMeters?.toString() || '0');
              const rate = parseFloat(styleFabric.unitPrice?.toString() || '0');
              fabricTotal += meters * rate;
            }
          }
        }
      }

      // If no fabric matched, it might be a CAD for a fabric not in the current style components
      // In that case, just use the selected CAD's meters with a default rate of 0
      // This ensures cadMeters/cadWidth are still returned even if fabricTotal is 0
      if (!foundMatchingFabric && cadMeters !== null) {
        // Log for debugging - selected CAD doesn't match any style fabric
        logWarn('calculateFabricCostsWithCad: Selected CAD does not match any style fabric', {
          selectedCadId: selectedCad.id,
          styleFabricId: selectedCad.styleFabricId,
          styleId: style.id,
        });
      }
    } else {
      // No selected CAD - use style's default fabric CADs
      for (const component of style.style_components || []) {
        for (const styleFabric of component.style_fabrics || []) {
          const cad = styleFabric.fabricCAD;
          if (cad) {
            const meters = parseFloat(cad.cadMeters?.toString() || '0');
            const rate = parseFloat(styleFabric.unitPrice?.toString() || '0');
            fabricTotal += meters * rate;
          }
        }
      }
    }

    return { fabricTotal, cadMeters, cadWidth };
  }

  /**
   * Calculate trims cost from style material BOM
   */
  private calculateTrimsCost(style: any): number {
    let total = 0;

    for (const bom of style.style_material_bom || []) {
      if (bom.usageCategory === 'GARMENT_TRIM') {
        const quantity = parseFloat(bom.quantityPerGarment?.toString() || '0');
        const unitPrice = parseFloat(bom.unitPrice?.toString() || '0');
        total += quantity * unitPrice;
      }
    }

    return total;
  }

  /**
   * Calculate embroidery cost
   */
  private calculateEmbroideryCost(style: any, selectedCad: any | null): number {
    let total = 0;

    for (const component of style.style_components || []) {
      for (const styleFabric of component.style_fabrics || []) {
        if (styleFabric.hasEmbroidery && styleFabric.embroidery) {
          // Use selected CAD meters if available, otherwise use fabric's CAD
          let meters = 0;
          if (selectedCad && selectedCad.cadMeters) {
            meters = parseFloat(selectedCad.cadMeters.toString());
          } else if (styleFabric.fabricCAD?.cadMeters) {
            meters = parseFloat(styleFabric.fabricCAD.cadMeters.toString());
          }

          const rate = styleFabric.embroidery.costPerMeter
            ? parseFloat(styleFabric.embroidery.costPerMeter.toString())
            : 0;

          total += meters * rate;
        }
      }
    }

    return total;
  }

  /**
   * Calculate processing cost from style processes
   */
  private calculateProcessingCost(style: any): number {
    let total = 0;

    for (const process of style.style_processes || []) {
      if (process.estimatedCost) {
        total += parseFloat(process.estimatedCost.toString());
      }
    }

    return total;
  }

  /**
   * Get costing comparison between style base and order-specific
   */
  async getCostingComparison(orderItemId: string): Promise<{
    base: any | null;
    orderSpecific: any | null;
    difference: number | null;
    percentDifference: number | null;
  }> {
    const orderItem = await prisma.order_items.findUnique({
      where: { id: orderItemId },
      include: {
        styles: {
          include: {
            // Current approved version only (bug-hunt orders-20)
            style_costing: {
              where: { isApproved: true, supersededById: null },
              orderBy: { version: 'desc' as const },
              take: 1,
            },
          },
        },
        order_item_costing: true,
      },
    });

    if (!orderItem) {
      throw new NotFoundError('Order Item', orderItemId);
    }

    const base = Array.isArray(orderItem.styles?.style_costing)
      ? orderItem.styles.style_costing[0]
      : orderItem.styles?.style_costing;
    const orderSpecific = orderItem.order_item_costing;

    let difference = null;
    let percentDifference = null;

    if (base && orderSpecific) {
      const baseCost = Number(base.totalCostPerPiece || 0);
      const orderCost = Number(orderSpecific.totalCostPerPiece || 0);
      difference = orderCost - baseCost;
      if (baseCost > 0) {
        percentDifference = ((orderCost - baseCost) / baseCost) * 100;
      }
    }

    return {
      base: base
        ? {
            id: base.id,
            totalCostPerPiece: Number(base.totalCostPerPiece),
            fabricTotal: Number(base.fabricTotal),
            trimsTotal: Number(base.trimsTotal),
            cmtTotal: Number(base.cmtTotal),
            embroideryTotal: Number(base.embroideryTotal),
            accessoriesTotal: Number(base.accessoriesTotal),
            sellingPricePerPiece: base.sellingPricePerPiece ? Number(base.sellingPricePerPiece) : null,
            profitMargin: base.profitMargin ? Number(base.profitMargin) : null,
          }
        : null,
      orderSpecific: orderSpecific
        ? {
            id: orderSpecific.id,
            totalCostPerPiece: Number(orderSpecific.totalCostPerPiece),
            fabricTotal: Number(orderSpecific.fabricTotal),
            trimsTotal: Number(orderSpecific.trimsTotal),
            cmtTotal: Number(orderSpecific.cmtTotal),
            embroideryTotal: Number(orderSpecific.embroideryTotal),
            accessoriesTotal: Number(orderSpecific.accessoriesTotal),
            cadMeters: orderSpecific.cadMeters ? Number(orderSpecific.cadMeters) : null,
            cadWidth: orderSpecific.cadWidth ? Number(orderSpecific.cadWidth) : null,
            sellingPricePerPiece: orderSpecific.sellingPricePerPiece
              ? Number(orderSpecific.sellingPricePerPiece)
              : null,
            profitMargin: orderSpecific.profitMargin ? Number(orderSpecific.profitMargin) : null,
            recalculatedAt: orderSpecific.recalculatedAt,
          }
        : null,
      difference,
      percentDifference,
    };
  }
}

export const orderCostingService = new OrderCostingServiceClass();
