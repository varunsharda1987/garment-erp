"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Stock Level Service - Manage current stock balances per material per warehouse
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const prisma = new client_1.PrismaClient();
class StockLevelService {
    /**
     * Get all stock levels with filters
     */
    async getAllStockLevels(filters) {
        const where = {};
        if (filters?.warehouseId) {
            where.warehouseId = filters.warehouseId;
        }
        if (filters?.materialId) {
            where.materialId = filters.materialId;
        }
        if (filters?.belowReorderLevel) {
            where.AND = [
                { reorderLevel: { not: null } },
                { quantity: { lte: prisma.stock_levels.fields.reorderLevel } },
            ];
        }
        if (filters?.search) {
            where.materials = {
                OR: [
                    { code: { contains: filters.search, mode: 'insensitive' } },
                    { name: { contains: filters.search, mode: 'insensitive' } },
                ],
            };
        }
        const stockLevels = await prisma.stock_levels.findMany({
            where,
            include: {
                materials: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true,
                        categoryId: true,
                        material_categories: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                warehouses: {
                    select: {
                        id: true,
                        warehouseCode: true,
                        warehouseName: true,
                        warehouseType: true,
                    },
                },
            },
            orderBy: { lastUpdated: 'desc' },
        });
        return stockLevels;
    }
    /**
     * Get stock level by ID
     */
    async getStockLevelById(id) {
        const stockLevel = await prisma.stock_levels.findUnique({
            where: { id },
            include: {
                materials: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        description: true,
                        unit: true,
                        reorderLevel: true,
                        material_categories: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                warehouses: {
                    select: {
                        id: true,
                        warehouseCode: true,
                        warehouseName: true,
                        warehouseType: true,
                        city: true,
                        state: true,
                    },
                },
            },
        });
        if (!stockLevel) {
            throw new Error(`Stock level not found with ID: ${id}`);
        }
        return stockLevel;
    }
    /**
     * Get stock level by material and warehouse
     */
    async getStockLevel(materialId, warehouseId) {
        const stockLevel = await prisma.stock_levels.findUnique({
            where: {
                materialId_warehouseId: {
                    materialId,
                    warehouseId,
                },
            },
            include: {
                materials: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true,
                    },
                },
                warehouses: {
                    select: {
                        id: true,
                        warehouseCode: true,
                        warehouseName: true,
                        warehouseType: true,
                    },
                },
            },
        });
        return stockLevel;
    }
    /**
     * Get stock levels by material (across all warehouses)
     */
    async getStockLevelsByMaterial(materialId) {
        const stockLevels = await prisma.stock_levels.findMany({
            where: { materialId },
            include: {
                warehouses: {
                    select: {
                        id: true,
                        warehouseCode: true,
                        warehouseName: true,
                        warehouseType: true,
                        city: true,
                    },
                },
            },
            orderBy: { quantity: 'desc' },
        });
        const totalQuantity = stockLevels.reduce((sum, level) => {
            return sum + parseFloat(level.quantity.toString());
        }, 0);
        const totalValue = stockLevels.reduce((sum, level) => {
            return sum + (level.stockValue ? parseFloat(level.stockValue.toString()) : 0);
        }, 0);
        return {
            stockLevels,
            totalQuantity,
            totalValue,
        };
    }
    /**
     * Get stock levels by warehouse
     */
    async getStockLevelsByWarehouse(warehouseId) {
        const stockLevels = await prisma.stock_levels.findMany({
            where: {
                warehouseId,
                quantity: { gt: 0 },
            },
            include: {
                materials: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true,
                        material_categories: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: { lastUpdated: 'desc' },
        });
        const totalValue = stockLevels.reduce((sum, level) => {
            return sum + (level.stockValue ? parseFloat(level.stockValue.toString()) : 0);
        }, 0);
        return {
            stockLevels,
            totalMaterials: stockLevels.length,
            totalValue,
        };
    }
    /**
     * Update stock level manually (for adjustments)
     */
    async updateStockLevel(id, data) {
        const existing = await prisma.stock_levels.findUnique({
            where: { id },
        });
        if (!existing) {
            throw new Error(`Stock level not found with ID: ${id}`);
        }
        // Calculate stock value if quantity or valuation rate changed
        let stockValue = existing.stockValue;
        const quantity = data.quantity ?? existing.quantity;
        const valuationRate = data.valuationRate ?? existing.valuationRate;
        if (data.quantity || data.valuationRate) {
            if (valuationRate) {
                stockValue = new library_1.Decimal(quantity.toString()).mul(valuationRate.toString());
            }
        }
        const stockLevel = await prisma.stock_levels.update({
            where: { id },
            data: {
                quantity: data.quantity,
                reorderLevel: data.reorderLevel,
                maxLevel: data.maxLevel,
                minLevel: data.minLevel,
                valuationRate: data.valuationRate,
                stockValue,
                lastUpdated: new Date(),
            },
            include: {
                materials: true,
                warehouses: true,
            },
        });
        return stockLevel;
    }
    /**
     * Increase stock level (internal use by stock movement service)
     */
    async increaseStock(materialId, warehouseId, quantity, unit, rate) {
        const existing = await this.getStockLevel(materialId, warehouseId);
        if (existing) {
            // Update existing stock level
            const newQuantity = new library_1.Decimal(existing.quantity.toString()).add(quantity.toString());
            // Update valuation rate using weighted average
            let newValuationRate = existing.valuationRate;
            let newStockValue = existing.stockValue;
            if (rate) {
                const oldValue = existing.stockValue
                    ? new library_1.Decimal(existing.stockValue.toString())
                    : new library_1.Decimal(0);
                const newValue = new library_1.Decimal(quantity.toString()).mul(rate.toString());
                const totalValue = oldValue.add(newValue);
                newValuationRate = totalValue.div(newQuantity);
                newStockValue = totalValue;
            }
            const updated = await prisma.stock_levels.update({
                where: { id: existing.id },
                data: {
                    quantity: newQuantity,
                    valuationRate: newValuationRate,
                    stockValue: newStockValue,
                    lastUpdated: new Date(),
                },
            });
            return updated;
        }
        else {
            // Create new stock level
            const stockValue = rate ? new library_1.Decimal(quantity.toString()).mul(rate.toString()) : null;
            const created = await prisma.stock_levels.create({
                data: {
                    materialId,
                    warehouseId,
                    quantity,
                    unit,
                    valuationRate: rate,
                    stockValue,
                },
            });
            return created;
        }
    }
    /**
     * Decrease stock level (internal use by stock movement service)
     */
    async decreaseStock(materialId, warehouseId, quantity) {
        const existing = await this.getStockLevel(materialId, warehouseId);
        if (!existing) {
            throw new Error('Stock level not found. Cannot decrease stock.');
        }
        const currentQty = new library_1.Decimal(existing.quantity.toString());
        const decreaseQty = new library_1.Decimal(quantity.toString());
        if (currentQty.lt(decreaseQty)) {
            throw new Error(`Insufficient stock. Available: ${currentQty}, Requested: ${decreaseQty}`);
        }
        const newQuantity = currentQty.sub(decreaseQty);
        // Update stock value proportionally
        let newStockValue = existing.stockValue;
        if (existing.stockValue && existing.valuationRate) {
            newStockValue = new library_1.Decimal(newQuantity.toString()).mul(existing.valuationRate.toString());
        }
        const updated = await prisma.stock_levels.update({
            where: { id: existing.id },
            data: {
                quantity: newQuantity,
                stockValue: newStockValue,
                lastUpdated: new Date(),
            },
        });
        return updated;
    }
    /**
     * Get materials below reorder level
     */
    async getMaterialsBelowReorderLevel(warehouseId) {
        const where = {
            reorderLevel: { not: null },
        };
        if (warehouseId) {
            where.warehouseId = warehouseId;
        }
        const stockLevels = await prisma.stock_levels.findMany({
            where,
            include: {
                materials: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true,
                        reorderLevel: true,
                        material_categories: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                warehouses: {
                    select: {
                        id: true,
                        warehouseCode: true,
                        warehouseName: true,
                    },
                },
            },
        });
        // Filter materials where current quantity <= reorder level
        const belowReorderLevel = stockLevels.filter((level) => {
            if (!level.reorderLevel)
                return false;
            return parseFloat(level.quantity.toString()) <= parseFloat(level.reorderLevel.toString());
        });
        return belowReorderLevel;
    }
    /**
     * Get stock aging report
     */
    async getStockAgingReport(warehouseId) {
        // This is a simplified version - in production, you'd track batch-wise aging
        const stockLevels = await prisma.stock_levels.findMany({
            where: {
                warehouseId,
                quantity: { gt: 0 },
            },
            include: {
                materials: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true,
                    },
                },
            },
            orderBy: { lastUpdated: 'asc' },
        });
        const now = new Date();
        const aging = stockLevels.map((level) => {
            const daysSinceUpdate = Math.floor((now.getTime() - level.lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
            let ageCategory = '0-30 days';
            if (daysSinceUpdate > 180)
                ageCategory = '180+ days';
            else if (daysSinceUpdate > 90)
                ageCategory = '90-180 days';
            else if (daysSinceUpdate > 60)
                ageCategory = '60-90 days';
            else if (daysSinceUpdate > 30)
                ageCategory = '30-60 days';
            return {
                ...level,
                daysSinceUpdate,
                ageCategory,
            };
        });
        return aging;
    }
    /**
     * Get stock valuation report
     */
    async getStockValuationReport(warehouseId) {
        const where = {
            quantity: { gt: 0 },
        };
        if (warehouseId) {
            where.warehouseId = warehouseId;
        }
        const stockLevels = await prisma.stock_levels.findMany({
            where,
            include: {
                materials: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true,
                        material_categories: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                warehouses: {
                    select: {
                        id: true,
                        warehouseCode: true,
                        warehouseName: true,
                        warehouseType: true,
                    },
                },
            },
            orderBy: { stockValue: 'desc' },
        });
        const totalValue = stockLevels.reduce((sum, level) => {
            return sum + (level.stockValue ? parseFloat(level.stockValue.toString()) : 0);
        }, 0);
        const totalQuantity = stockLevels.reduce((sum, level) => {
            return sum + parseFloat(level.quantity.toString());
        }, 0);
        return {
            stockLevels,
            totalValue,
            totalQuantity,
            totalMaterials: stockLevels.length,
        };
    }
}
exports.default = new StockLevelService();
