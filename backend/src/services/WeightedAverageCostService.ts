/**
 * Weighted Average Cost Service
 *
 * Implements weighted average costing for fabric inventory
 * Business Rule: Stock valuation uses weighted average cost method
 *
 * Formula: New WAC = (Existing Value + New Purchase Value) / (Existing Qty + New Qty)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

const prisma = new PrismaClient();

export class WeightedAverageCostService {
  /**
   * Calculate new weighted average cost (pure function for testing)
   *
   * @param currentQty - Current stock quantity
   * @param currentAvgCost - Current weighted average cost
   * @param newQty - New quantity being added
   * @param newCost - Cost per unit of new stock
   * @returns New weighted average cost
   */
  static calculateNewAverageCost(
    currentQty: number,
    currentAvgCost: number,
    newQty: number,
    newCost: number
  ): number {
    // If no current quantity, new cost becomes the average
    if (currentQty === 0) {
      return newCost;
    }

    // If no new quantity, return current average
    if (newQty === 0) {
      return currentAvgCost;
    }

    const existingValue = currentQty * currentAvgCost;
    const newValue = newQty * newCost;
    const totalValue = existingValue + newValue;
    const totalQuantity = currentQty + newQty;

    return Math.round((totalValue / totalQuantity) * 100) / 100;
  }

  /**
   * Calculate weighted average from array of transactions (pure function for testing)
   *
   * @param transactions - Array of quantity and cost pairs
   * @returns Weighted average cost
   */
  static calculateWeightedAverageCost(
    transactions: Array<{ quantity: number; unitCost: number }>
  ): number {
    if (transactions.length === 0) {
      return 0;
    }

    let totalValue = 0;
    let totalQuantity = 0;

    for (const txn of transactions) {
      totalValue += txn.quantity * txn.unitCost;
      totalQuantity += txn.quantity;
    }

    if (totalQuantity === 0) {
      return 0;
    }

    return Math.round((totalValue / totalQuantity) * 100) / 100;
  }

  /**
   * Calculate weighted average cost when receiving new stock
   *
   * @param fabricId - Fabric master ID
   * @param newQuantity - Quantity being received
   * @param newCost - Cost per unit of new stock
   * @returns New weighted average cost
   */
  static async calculateWeightedAverage(
    fabricId: string,
    newQuantity: number,
    newCost: number
  ): Promise<number> {
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
      return this.calculateNewAverageCost(
        existingQuantity,
        existingAvgCost,
        newQuantity,
        newCost
      );
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
    width: number;
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
      let stockType = 'PLANNED_STOCK';
      if (procurement?.isStockPurchase) {
        stockType = 'EXCESS_MOQ';
      }

      // Create stock record
      const stock = await prisma.fabric_stock.create({
        data: {
          fabricId: data.fabricId,
          width: data.width,
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

      // Create transaction record
      await prisma.fabric_stock_transaction.create({
        data: {
          stockId: stock.id,
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
      const stock = await prisma.fabric_stock.findUnique({
        where: { id: data.stockId },
      });

      if (!stock) {
        throw new Error('Stock record not found');
      }

      const availableQty = Number(stock.quantityAvailable);

      if (availableQty < data.quantity) {
        throw new Error(`Insufficient stock. Available: ${availableQty}, Requested: ${data.quantity}`);
      }

      // Update stock quantities
      const updatedStock = await prisma.fabric_stock.update({
        where: { id: data.stockId },
        data: {
          quantityAvailable: availableQty - data.quantity,
          quantityConsumed: Number(stock.quantityConsumed) + data.quantity,
          lastConsumedDate: new Date(),
        },
      });

      // Create consumption transaction
      const newBalance = availableQty - data.quantity;
      const weightedAvgCost = Number(stock.weightedAvgCost);

      await prisma.fabric_stock_transaction.create({
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

      let totalQuantity = 0;
      let totalValue = 0;

      for (const stock of stocks) {
        const qty = Number(stock.quantityAvailable);
        const cost = Number(stock.weightedAvgCost);
        totalQuantity += qty;
        totalValue += qty * cost;
      }

      const weightedAvgCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

      return {
        fabricId,
        fabricCode: stocks[0]?.fabricMaster?.fabricCode,
        fabricName: stocks[0]?.fabricMaster?.fabricName,
        totalQuantity,
        totalValue,
        weightedAvgCost: Math.round(weightedAvgCost * 100) / 100,
        stockRecords: stocks.length,
        stocks: stocks.map(s => ({
          id: s.id,
          quantity: Number(s.quantityAvailable),
          cost: Number(s.weightedAvgCost),
          value: Number(s.quantityAvailable) * Number(s.weightedAvgCost),
          qualityGrade: s.qualityGrade,
          receivedDate: s.receivedDate,
          agingDays: s.agingDays,
        })),
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
      for (const [fId, fabricStocks] of fabricGroups.entries()) {
        let runningQuantity = 0;
        let runningValue = 0;

        for (const stock of fabricStocks) {
          const qty = Number(stock.quantityAvailable);
          const purchaseCost = Number(stock.purchaseCost);

          // Add to running totals
          runningValue += qty * purchaseCost;
          runningQuantity += qty;

          // Calculate new WAC
          const newWAC = runningQuantity > 0 ? runningValue / runningQuantity : 0;

          // Update stock record
          await prisma.fabric_stock.update({
            where: { id: stock.id },
            data: {
              weightedAvgCost: Math.round(newWAC * 100) / 100,
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
