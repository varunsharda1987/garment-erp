/**
 * Weighted Average Cost Service
 *
 * Implements weighted average costing for fabric inventory
 * Business Rule: Stock valuation uses weighted average cost method
 *
 * Formula: New WAC = (Existing Value + New Purchase Value) / (Existing Qty + New Qty)
 *
 * BUG-ELS5 fix: Uses decimal.js via currency utility to avoid floating point errors
 */

import { Prisma, StockEntryType } from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';
import { toCurrency, toNumber, roundToCent, calculateWeightedAverageCost as calcWAC } from '../utils/currency';

export class WeightedAverageCostService {
  /**
   * Calculate new weighted average cost (pure function for testing)
   *
   * BUG-ELS5 fix: Uses decimal.js to avoid floating point errors
   *
   * @param currentQty - Current stock quantity
   * @param currentAvgCost - Current weighted average cost
   * @param newQty - New quantity being added
   * @param newCost - Cost per unit of new stock
   * @returns New weighted average cost
   */
  static calculateNewAverageCost(currentQty: number, currentAvgCost: number, newQty: number, newCost: number): number {
    // If no current quantity, new cost becomes the average
    if (currentQty === 0) {
      return newCost;
    }

    // If no new quantity, return current average
    if (newQty === 0) {
      return currentAvgCost;
    }

    // BUG-ELS5 fix: Use decimal.js for precise calculation
    const result = calcWAC(currentQty, currentAvgCost, newQty, newCost);
    return toNumber(roundToCent(result));
  }

  /**
   * Calculate weighted average from array of transactions (pure function for testing)
   *
   * BUG-ELS5 fix: Uses decimal.js to avoid floating point errors
   *
   * @param transactions - Array of quantity and cost pairs
   * @returns Weighted average cost
   */
  static calculateWeightedAverageCost(transactions: Array<{ quantity: number; unitCost: number }>): number {
    if (transactions.length === 0) {
      return 0;
    }

    // BUG-ELS5 fix: Use decimal.js for precise calculation
    let totalValue = toCurrency(0);
    let totalQuantity = toCurrency(0);

    for (const txn of transactions) {
      totalValue = totalValue.plus(toCurrency(txn.quantity).times(toCurrency(txn.unitCost)));
      totalQuantity = totalQuantity.plus(toCurrency(txn.quantity));
    }

    if (totalQuantity.isZero()) {
      return 0;
    }

    return toNumber(roundToCent(totalValue.dividedBy(totalQuantity)));
  }

  /**
   * Calculate weighted average cost when receiving new stock
   *
   * @param fabricId - Fabric master ID
   * @param newQuantity - Quantity being received
   * @param newCost - Cost per unit of new stock
   * @returns New weighted average cost
   */
  static async calculateWeightedAverage(fabricId: string, newQuantity: number, newCost: number): Promise<number> {
    try {
      // Get current stock for this fabric
      const currentStock = await prisma.fabric_stock.aggregate({
        where: {
          fabricId,
          status: { in: ['AVAILABLE', 'RESERVED'] },
        },
        _sum: {
          quantityAvailable: true,
        },
        _avg: {
          weightedAvgCost: true,
        },
      });

      const existingQuantity = Number(currentStock._sum.quantityAvailable) || 0;
      const existingAvgCost = Number(currentStock._avg.weightedAvgCost) || 0;

      // Use the pure calculation function
      return this.calculateNewAverageCost(existingQuantity, existingAvgCost, newQuantity, newCost);
    } catch (error) {
      logError('Error calculating weighted average cost:', error);
      throw error;
    }
  }

  /**
   * Create stock receipt transaction with weighted average costing
   *
   * @param data - Stock receipt data
   * @returns Created stock record
   */
  static async receiveStock(data: {
    procurementId: string;
    fabricId: string;
    finishedWidth: number;
    cutableWidth?: number;
    quantityReceived: number;
    purchaseCost: number;
    qualityGrade?: string;
    originStyleId?: string;
    originOrderId?: string;
    warehouseLocation?: string;
    rackNumber?: string;
    rollNumbers?: string;
    userId: string;
  }) {
    try {
      // Calculate weighted average cost
      const weightedAvgCost = await this.calculateWeightedAverage(
        data.fabricId,
        data.quantityReceived,
        data.purchaseCost
      );

      // Get procurement details for origin tracking
      const procurement = await prisma.fabric_procurement.findUnique({
        where: { id: data.procurementId },
        select: {
          orderedForStyleId: true,
          orderedForOrderId: true,
          isStockPurchase: true,
        },
      });

      // Determine stock type
      let stockType: StockEntryType = 'PLANNED_STOCK';
      if (procurement?.isStockPurchase) {
        stockType = 'EXCESS_MOQ';
      }

      // costing-15: stock row and ledger row must commit together
      const stock = await prisma.$transaction(async (tx) => {
        const created = await tx.fabric_stock.create({
          data: {
            fabricId: data.fabricId,
            finishedWidth: data.finishedWidth,
            cutableWidth: data.cutableWidth || data.finishedWidth - 2,
            quantityAvailable: data.quantityReceived,
            quantityReserved: 0,
            quantityConsumed: 0,
            procurementId: data.procurementId,
            originStyleId: data.originStyleId || procurement?.orderedForStyleId || null,
            originOrderId: data.originOrderId || procurement?.orderedForOrderId || null,
            status: 'AVAILABLE',
            stockType,
            weightedAvgCost,
            purchaseCost: data.purchaseCost,
            qualityGrade: data.qualityGrade || 'A',
            receivedDate: new Date(),
            agingDays: 0,
            warehouseLocation: data.warehouseLocation,
            rackNumber: data.rackNumber,
            rollNumbers: data.rollNumbers,
            createdById: data.userId,
          },
        });

        await tx.fabric_stock_transaction.create({
          data: {
            stockId: created.id,
            transactionType: 'RECEIPT',
            quantity: data.quantityReceived,
            referenceType: 'PROCUREMENT',
            referenceId: data.procurementId,
            costPerUnit: data.purchaseCost,
            weightedAvgCost,
            totalValue: data.quantityReceived * data.purchaseCost,
            balanceAfter: data.quantityReceived,
            valueAfter: data.quantityReceived * weightedAvgCost,
            qualityGradeTo: data.qualityGrade || 'A',
            createdById: data.userId,
          },
        });

        return created;
      });

      return stock;
    } catch (error) {
      logError('Error receiving stock:', error);
      throw error;
    }
  }

  /**
   * Consume stock and update weighted average
   *
   * @param data - Stock consumption data
   * @returns Updated stock record
   */
  static async consumeStock(data: {
    stockId: string;
    quantity: number;
    allocationId?: string;
    actualCad?: number;
    piecesProduced?: number;
    userId: string;
  }) {
    try {
      // costing-15: guarded atomic decrement + ledger insert in one transaction —
      // prevents concurrent oversell and stock changes without a matching ledger row
      return await prisma.$transaction(async (tx) => {
        const stock = await tx.fabric_stock.findUnique({
          where: { id: data.stockId },
        });

        if (!stock) {
          throw new Error('Stock record not found');
        }

        // Atomic guarded update: only succeeds if enough stock remains at write time
        const updated = await tx.fabric_stock.updateMany({
          where: { id: data.stockId, quantityAvailable: { gte: data.quantity } },
          data: {
            quantityAvailable: { decrement: data.quantity },
            quantityConsumed: { increment: data.quantity },
            lastConsumedDate: new Date(),
          },
        });

        if (updated.count === 0) {
          throw new Error(
            `Insufficient stock. Available: ${Number(stock.quantityAvailable)}, Requested: ${data.quantity}`
          );
        }

        const updatedStock = await tx.fabric_stock.findUniqueOrThrow({
          where: { id: data.stockId },
        });

        const newBalance = Number(updatedStock.quantityAvailable);
        const weightedAvgCost = Number(stock.weightedAvgCost);

        await tx.fabric_stock_transaction.create({
          data: {
            stockId: data.stockId,
            transactionType: 'CONSUMPTION',
            quantity: data.quantity,
            referenceType: data.allocationId ? 'ALLOCATION' : 'MANUAL',
            referenceId: data.allocationId,
            costPerUnit: weightedAvgCost,
            weightedAvgCost,
            totalValue: data.quantity * weightedAvgCost,
            actualCad: data.actualCad,
            piecesProduced: data.piecesProduced,
            balanceAfter: newBalance,
            valueAfter: newBalance * weightedAvgCost,
            createdById: data.userId,
          },
        });

        return updatedStock;
      });
    } catch (error) {
      logError('Error consuming stock:', error);
      throw error;
    }
  }

  /**
   * Get weighted average cost for a specific fabric
   *
   * @param fabricId - Fabric master ID
   * @returns Current weighted average cost
   */
  static async getCurrentWeightedAverage(fabricId: string): Promise<number> {
    try {
      const result = await prisma.fabric_stock.aggregate({
        where: {
          fabricId,
          status: { in: ['AVAILABLE', 'RESERVED'] },
        },
        _avg: {
          weightedAvgCost: true,
        },
      });

      return Number(result._avg.weightedAvgCost) || 0;
    } catch (error) {
      logError('Error getting weighted average:', error);
      throw error;
    }
  }

  /**
   * Get stock valuation report for a fabric
   *
   * @param fabricId - Fabric master ID
   * @returns Stock valuation details
   */
  static async getStockValuation(fabricId: string) {
    try {
      const stocks = await prisma.fabric_stock.findMany({
        where: {
          fabricId,
          status: { in: ['AVAILABLE', 'RESERVED'] },
        },
        include: {
          fabricMaster: {
            select: {
              fabricCode: true,
              fabricName: true,
            },
          },
        },
      });

      // BUG-ELS5 fix: Use decimal.js for precise valuation calculations
      let totalQuantityDec = toCurrency(0);
      let totalValueDec = toCurrency(0);

      for (const stock of stocks) {
        // BUG-ELS5 fix: Convert Prisma Decimal to number before using decimal.js
        const qty = toCurrency(Number(stock.quantityAvailable));
        const cost = toCurrency(Number(stock.weightedAvgCost));
        totalQuantityDec = totalQuantityDec.plus(qty);
        totalValueDec = totalValueDec.plus(qty.times(cost));
      }

      const totalQuantity = toNumber(totalQuantityDec);
      const totalValue = toNumber(roundToCent(totalValueDec));
      const weightedAvgCost = totalQuantityDec.isZero()
        ? 0
        : toNumber(roundToCent(totalValueDec.dividedBy(totalQuantityDec)));

      return {
        fabricId,
        fabricCode: stocks[0]?.fabricMaster?.fabricCode,
        fabricName: stocks[0]?.fabricMaster?.fabricName,
        totalQuantity,
        totalValue,
        weightedAvgCost,
        stockRecords: stocks.length,
        stocks: stocks.map((s) => {
          // BUG-ELS5 fix: Use decimal.js for per-stock value calculation
          const qty = toCurrency(Number(s.quantityAvailable));
          const cost = toCurrency(Number(s.weightedAvgCost));
          return {
            id: s.id,
            quantity: toNumber(qty),
            cost: toNumber(cost),
            value: toNumber(roundToCent(qty.times(cost))),
            qualityGrade: s.qualityGrade,
            receivedDate: s.receivedDate,
            agingDays: s.agingDays,
          };
        }),
      };
    } catch (error) {
      logError('Error getting stock valuation:', error);
      throw error;
    }
  }

  /**
   * Recalculate weighted average for all stock records
   * (Use for data corrections or migrations)
   *
   * @param fabricId - Optional fabric ID to recalculate specific fabric
   */
  static async recalculateAll(fabricId?: string) {
    try {
      const where = fabricId ? { fabricId } : {};

      const stocks = await prisma.fabric_stock.findMany({
        where,
        orderBy: { receivedDate: 'asc' },
      });

      // Group by fabric
      const fabricGroups = new Map<string, any[]>();

      for (const stock of stocks) {
        if (!fabricGroups.has(stock.fabricId)) {
          fabricGroups.set(stock.fabricId, []);
        }
        fabricGroups.get(stock.fabricId)!.push(stock);
      }

      let updated = 0;

      // Recalculate for each fabric
      // BUG-ELS5 fix: Use decimal.js for precise WAC recalculation
      for (const [fId, fabricStocks] of fabricGroups.entries()) {
        let runningQuantity = toCurrency(0);
        let runningValue = toCurrency(0);

        for (const stock of fabricStocks) {
          // BUG-ELS5 fix: Convert Prisma Decimal to number before using decimal.js
          const qty = toCurrency(Number(stock.quantityAvailable));
          const purchaseCost = toCurrency(Number(stock.purchaseCost));

          // Add to running totals
          runningValue = runningValue.plus(qty.times(purchaseCost));
          runningQuantity = runningQuantity.plus(qty);

          // Calculate new WAC
          const newWAC = runningQuantity.isZero() ? 0 : toNumber(roundToCent(runningValue.dividedBy(runningQuantity)));

          // Update stock record
          await prisma.fabric_stock.update({
            where: { id: stock.id },
            data: {
              weightedAvgCost: newWAC,
            },
          });

          updated++;
        }
      }

      return { updated };
    } catch (error) {
      logError('Error recalculating weighted averages:', error);
      throw error;
    }
  }
}

export default WeightedAverageCostService;
