// Fabric Stock Service - Manage fabric stock with style associations
import { PrismaClient, Prisma } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

const prisma = new PrismaClient();

export interface CreateStyleStockDTO {
  styleId: string;
  fabricId: string;
  quantity: number;
  width: number;
  rollNumbers?: string;
  warehouseLocation?: string;
  qualityGrade?: 'A' | 'B' | 'DEFECT';
  purchaseCost?: number;
  receivedDate?: Date;
}

export interface CreateGenericGreigeStockDTO {
  greigeId: string;
  quantity: number;
  width: number;
  rollNumbers?: string;
  warehouseLocation?: string;
  purchaseCost?: number;
  receivedDate?: Date;
  supplierId?: string; // Optional supplier ID
}

export interface StyleFabricStock {
  fabricId: string;
  fabricCode: string;
  fabricName: string;
  componentName: string;
  requiredPerGarment: number;
  availableStock: number;
  reservedStock: number;
  canMakeGarments: number;
}

export interface FabricUsageByStyle {
  styleId: string;
  styleCode: string;
  styleName: string;
  componentName: string;
  cadMeters: number;
  stockAllocated: number;
  stockConsumed: number;
}

class FabricStockService {
  /**
   * Create style-specific fabric stock entry
   */
  async createStyleStock(data: CreateStyleStockDTO, userId: string) {
    try {
      // Validate style and fabric exist
      const style = await prisma.styles.findUnique({
        where: { id: data.styleId },
      });
      if (!style) {
        throw new Error(`Style with ID ${data.styleId} not found`);
      }

      const fabric = await prisma.fabric_master.findUnique({
        where: { id: data.fabricId },
      });
      if (!fabric) {
        throw new Error(`Fabric with ID ${data.fabricId} not found`);
      }

      // Create procurement record first
      const procurement = await prisma.fabric_procurement.create({
        data: {
          id: `PROC-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          procurementType: 'FINISHED',
          supplierId: 'STOCK_ENTRY', // Placeholder for stock entry
          fabricId: data.fabricId,
          quantityPurchased: new Prisma.Decimal(data.quantity),
          unit: 'meters',
          width: new Prisma.Decimal(data.width),
          ratePerUnit: data.purchaseCost
            ? new Prisma.Decimal(data.purchaseCost)
            : new Prisma.Decimal(0),
          totalCost: data.purchaseCost
            ? new Prisma.Decimal(data.quantity * data.purchaseCost)
            : new Prisma.Decimal(0),
          orderedForStyleId: data.styleId,
          isStockPurchase: false,
          status: 'RECEIVED',
          purchaseDate: data.receivedDate || new Date(),
          receivedDate: data.receivedDate || new Date(),
          createdById: userId,
        },
      });

      // Create fabric stock record
      const fabricStock = await prisma.fabric_stock.create({
        data: {
          id: `STOCK-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          fabricId: data.fabricId,
          width: new Prisma.Decimal(data.width),
          quantityAvailable: new Prisma.Decimal(data.quantity),
          quantityReserved: new Prisma.Decimal(0),
          quantityConsumed: new Prisma.Decimal(0),
          unit: 'meters',
          procurementId: procurement.id,
          originStyleId: data.styleId,
          originOrderId: null,
          status: 'AVAILABLE',
          stockType: 'PLANNED_STOCK',
          weightedAvgCost: data.purchaseCost
            ? new Prisma.Decimal(data.purchaseCost)
            : new Prisma.Decimal(0),
          purchaseCost: data.purchaseCost
            ? new Prisma.Decimal(data.purchaseCost)
            : new Prisma.Decimal(0),
          qualityGrade: data.qualityGrade || 'A',
          warehouseLocation: data.warehouseLocation || null,
          rollNumbers: data.rollNumbers || null,
          receivedDate: data.receivedDate || new Date(),
          agingDays: 0,
          createdById: userId,
        },
      });

      // Update material stock levels if fabric has material record
      const material = await prisma.materials.findFirst({
        where: {
          fabricId: data.fabricId,
          materialType: 'FINISHED_FABRIC',
        },
      });

      if (material) {
        await this.updateMaterialStockLevel(
          material.id,
          'DEFAULT_WAREHOUSE',
          data.quantity,
          data.purchaseCost
        );
      }

      return fabricStock;
    } catch (error: any) {
      logError('Error creating style stock:', error);
      throw new Error(`Failed to create style stock: ${error.message}`);
    }
  }

  /**
   * Create generic greige stock entry (not tied to any style)
   */
  async createGenericGreigeStock(data: CreateGenericGreigeStockDTO, userId: string) {
    try {
      // Validate greige exists
      const greige = await prisma.greige_master.findUnique({
        where: { id: data.greigeId },
      });
      if (!greige) {
        throw new Error(`Greige with ID ${data.greigeId} not found`);
      }

      // Get a default supplier if none provided (use first available supplier or create a generic one)
      let supplierId = data.supplierId;
      if (!supplierId) {
        // Try to find a generic "Stock Entry" supplier, or use the first active supplier
        const stockEntrySupplier = await prisma.suppliers.findFirst({
          where: {
            OR: [
              { code: 'STOCK-ENTRY' },
              { name: { contains: 'Stock Entry', mode: 'insensitive' } }
            ]
          }
        });

        if (stockEntrySupplier) {
          supplierId = stockEntrySupplier.id;
        } else {
          // If no supplier found, get any active supplier as a fallback
          const anySupplier = await prisma.suppliers.findFirst({
            where: { isActive: true }
          });

          if (!anySupplier) {
            throw new Error('No suppliers found in the system. Please create a supplier first.');
          }

          supplierId = anySupplier.id;
        }
      }

      // Create procurement record
      const procurement = await prisma.fabric_procurement.create({
        data: {
          id: `PROC-GRG-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          procurementType: 'GREIGE',
          supplierId: supplierId,
          greigeId: data.greigeId,
          quantityPurchased: new Prisma.Decimal(data.quantity),
          unit: 'meters',
          width: new Prisma.Decimal(data.width),
          ratePerUnit: data.purchaseCost
            ? new Prisma.Decimal(data.purchaseCost)
            : new Prisma.Decimal(0),
          totalCost: data.purchaseCost
            ? new Prisma.Decimal(data.quantity * data.purchaseCost)
            : new Prisma.Decimal(0),
          orderedForStyleId: null, // Generic, not style-specific
          isStockPurchase: true,
          processingRequired: false,
          status: 'RECEIVED',
          purchaseDate: data.receivedDate || new Date(),
          receivedDate: data.receivedDate || new Date(),
          createdById: userId,
        },
      });

      // Create or find a fabric_master entry for this greige (required for fabric_stock FK)
      // For raw greige, we create a "virtual" fabric entry with the greige specs
      let fabricMaster = await prisma.fabric_master.findFirst({
        where: {
          greigeId: data.greigeId,
          colorName: 'RAW', // Raw/unfinished greige
          finishType: 'GREIGE',
        },
      });

      if (!fabricMaster) {
        // Create a virtual fabric_master for this raw greige
        fabricMaster = await prisma.fabric_master.create({
          data: {
            id: `FAB-RAW-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            fabricCode: `${greige.greigeCode}-RAW`,
            fabricName: `${greige.greigeName} (Raw)`,
            greigeId: data.greigeId,
            colorName: 'RAW',
            finishType: 'GREIGE',
            actualWidth: new Prisma.Decimal(data.width),
            isGeneric: true,
            isActive: true,
            createdById: userId,
          },
        });
      }

      // Create fabric stock record (greige is stored in fabric_stock too)
      const fabricStock = await prisma.fabric_stock.create({
        data: {
          id: `STOCK-GRG-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          fabricId: fabricMaster.id, // Use the virtual fabric_master ID
          width: new Prisma.Decimal(data.width),
          quantityAvailable: new Prisma.Decimal(data.quantity),
          quantityReserved: new Prisma.Decimal(0),
          quantityConsumed: new Prisma.Decimal(0),
          unit: 'meters',
          procurementId: procurement.id,
          originStyleId: null, // Generic greige
          originOrderId: null,
          status: 'AVAILABLE',
          stockType: 'GENERIC',
          weightedAvgCost: data.purchaseCost
            ? new Prisma.Decimal(data.purchaseCost)
            : new Prisma.Decimal(0),
          purchaseCost: data.purchaseCost
            ? new Prisma.Decimal(data.purchaseCost)
            : new Prisma.Decimal(0),
          qualityGrade: 'A',
          warehouseLocation: data.warehouseLocation || null,
          rollNumbers: data.rollNumbers || null,
          receivedDate: data.receivedDate || new Date(),
          createdById: userId,
          agingDays: 0,
        },
      });

      return fabricStock;
    } catch (error: any) {
      logError('Error creating generic greige stock:', error);
      throw new Error(`Failed to create greige stock: ${error.message}`);
    }
  }

  /**
   * Get stock for a specific style (all fabrics)
   */
  async getStockByStyle(styleId: string): Promise<StyleFabricStock[]> {
    try {
      // Get all components and fabrics for this style
      const components = await prisma.style_components.findMany({
        where: { styleId },
        include: {
          style_fabrics: {
            include: {
              fabric: {
                include: {
                  fabricStock: {
                    where: {
                      status: 'AVAILABLE',
                    },
                  },
                },
              },
            },
          },
        },
      });

      const result: StyleFabricStock[] = [];

      for (const component of components) {
        for (const styleFabric of component.style_fabrics) {
          if (!styleFabric.fabric) continue;

          // Calculate total stock
          const totalAvailable = styleFabric.fabric.fabricStock.reduce(
            (sum, stock) => sum + Number(stock.quantityAvailable),
            0
          );

          const totalReserved = styleFabric.fabric.fabricStock.reduce(
            (sum, stock) => sum + Number(stock.quantityReserved),
            0
          );

          // Calculate how many garments can be made
          const requiredPerGarment = styleFabric.quantityNeeded
            ? Number(styleFabric.quantityNeeded)
            : 0;

          const canMakeGarments =
            requiredPerGarment > 0 ? Math.floor(totalAvailable / requiredPerGarment) : 0;

          result.push({
            fabricId: styleFabric.fabric.id,
            fabricCode: styleFabric.fabric.fabricCode,
            fabricName: styleFabric.fabric.fabricName,
            componentName: component.componentName,
            requiredPerGarment,
            availableStock: totalAvailable,
            reservedStock: totalReserved,
            canMakeGarments,
          });
        }
      }

      return result;
    } catch (error: any) {
      logError('Error getting stock by style:', error);
      throw new Error(`Failed to get stock for style: ${error.message}`);
    }
  }

  /**
   * Get available stock for a style (can make X garments)
   */
  async getAvailableStockForStyle(styleId: string) {
    const fabricStocks = await this.getStockByStyle(styleId);

    // The bottleneck fabric determines how many garments can be made
    const canMakeGarments = fabricStocks.length > 0
      ? Math.min(...fabricStocks.map((f) => f.canMakeGarments))
      : 0;

    return {
      canMakeGarments,
      fabricStocks,
      bottleneckFabric: fabricStocks.find(
        (f) => f.canMakeGarments === canMakeGarments
      ),
    };
  }

  /**
   * Get which styles use a specific fabric
   */
  async getStylesByFabric(fabricId: string): Promise<FabricUsageByStyle[]> {
    try {
      const styleFabrics = await prisma.style_fabrics.findMany({
        where: { fabricId },
        include: {
          style_components: {
            include: {
              styles: true,
            },
          },
        },
      });

      const result: FabricUsageByStyle[] = styleFabrics.map((sf) => ({
        styleId: sf.style_components.styleId,
        styleCode: sf.style_components.styles.styleCode,
        styleName: sf.style_components.styles.styleName,
        componentName: sf.style_components.componentName,
        cadMeters: sf.quantityNeeded ? Number(sf.quantityNeeded) : 0,
        stockAllocated: 0, // Will be calculated from allocations
        stockConsumed: 0,  // Will be calculated from allocations
      }));

      return result;
    } catch (error: any) {
      logError('Error getting styles by fabric:', error);
      throw new Error(`Failed to get styles for fabric: ${error.message}`);
    }
  }

  /**
   * Get fabrics used in a specific style
   */
  async getFabricsByStyle(styleId: string) {
    try {
      const components = await prisma.style_components.findMany({
        where: { styleId },
        include: {
          style_fabrics: {
            include: {
              fabric: {
                include: {
                  widthCADs: true,
                  greige: {
                    select: {
                      greigeCode: true,
                      greigeName: true,
                      composition: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return components.map((comp) => ({
        componentName: comp.componentName,
        componentType: comp.componentType,
        fabrics: comp.style_fabrics.map((sf) => ({
          fabricId: sf.fabric?.id,
          fabricCode: sf.fabric?.fabricCode,
          fabricName: sf.fabric?.fabricName,
          description: sf.fabric?.description,
          greige: sf.fabric?.greige,
          widthCADs: sf.fabric?.widthCADs,
          quantityNeeded: sf.quantityNeeded ? Number(sf.quantityNeeded) : 0,
        })),
      }));
    } catch (error: any) {
      logError('Error getting fabrics by style:', error);
      throw new Error(`Failed to get fabrics for style: ${error.message}`);
    }
  }

  /**
   * Get stock origin history for a fabric
   */
  async getStockOriginHistory(fabricId: string) {
    try {
      const stockRecords = await prisma.fabric_stock.findMany({
        where: { fabricId },
        include: {
          originStyle: {
            select: {
              styleCode: true,
              styleName: true,
              buyerName: true,
            },
          },
          originOrder: {
            select: {
              orderNumber: true,
            },
          },
          procurement: {
            select: {
              purchaseOrderNumber: true,
              supplierId: true,
              purchaseDate: true,
              ratePerUnit: true,
            },
          },
        },
        orderBy: { receivedDate: 'desc' },
      });

      return stockRecords.map((stock) => ({
        stockId: stock.id,
        quantity: Number(stock.quantityAvailable),
        reserved: Number(stock.quantityReserved),
        consumed: Number(stock.quantityConsumed),
        width: Number(stock.width),
        stockType: stock.stockType,
        originStyle: stock.originStyle,
        originOrder: stock.originOrder,
        procurement: stock.procurement,
        receivedDate: stock.receivedDate,
        qualityGrade: stock.qualityGrade,
        warehouseLocation: stock.warehouseLocation,
      }));
    } catch (error: any) {
      logError('Error getting stock origin history:', error);
      throw new Error(`Failed to get stock history: ${error.message}`);
    }
  }

  /**
   * Get generic greige stock available for future styles
   */
  async getGenericGreigeStock() {
    try {
      const greigeStock = await prisma.fabric_stock.findMany({
        where: {
          originStyleId: null,
          stockType: 'GENERIC',
          status: 'AVAILABLE',
          quantityAvailable: { gt: 0 },
        },
        include: {
          procurement: {
            include: {
              greigeMaster: {
                select: {
                  greigeCode: true,
                  greigeName: true,
                  composition: true,
                  yarnCount: true,
                  construction: true,
                  weaveType: true,
                },
              },
            },
          },
        },
        orderBy: { receivedDate: 'desc' },
      });

      return greigeStock.map((stock) => ({
        stockId: stock.id,
        greige: stock.procurement?.greigeMaster,
        quantity: Number(stock.quantityAvailable),
        width: Number(stock.width),
        cost: Number(stock.purchaseCost),
        receivedDate: stock.receivedDate,
        agingDays: stock.agingDays,
        warehouseLocation: stock.warehouseLocation,
        rollNumbers: stock.rollNumbers,
      }));
    } catch (error: any) {
      logError('Error getting generic greige stock:', error);
      throw new Error(`Failed to get greige stock: ${error.message}`);
    }
  }

  /**
   * Update material stock level (helper function)
   */
  private async updateMaterialStockLevel(
    materialId: string,
    warehouseId: string,
    quantityChange: number,
    valuationRate?: number
  ) {
    try {
      // Find or create stock level record
      const existing = await prisma.stock_levels.findFirst({
        where: {
          materialId,
          warehouseId,
        },
      });

      if (existing) {
        const newQuantity = Number(existing.quantity) + quantityChange;
        const newValue = valuationRate
          ? newQuantity * valuationRate
          : Number(existing.stockValue || 0);

        await prisma.stock_levels.update({
          where: { id: existing.id },
          data: {
            quantity: new Prisma.Decimal(newQuantity),
            valuationRate: valuationRate
              ? new Prisma.Decimal(valuationRate)
              : existing.valuationRate,
            stockValue: new Prisma.Decimal(newValue),
            lastUpdated: new Date(),
          },
        });
      } else {
        // Create new stock level record
        await prisma.stock_levels.create({
          data: {
            id: `SL-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            materialId,
            warehouseId,
            quantity: new Prisma.Decimal(quantityChange),
            unit: 'METER',
            valuationRate: valuationRate ? new Prisma.Decimal(valuationRate) : null,
            stockValue: valuationRate
              ? new Prisma.Decimal(quantityChange * valuationRate)
              : null,
            lastUpdated: new Date(),
          },
        });
      }
    } catch (error: any) {
      logError('Error updating material stock level:', error);
      // Don't throw error, just log it
    }
  }

  /**
   * Bulk create fabric stock for a style
   */
  async bulkCreateStyleStock(
    entries: CreateStyleStockDTO[],
    userId: string
  ) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as { fabricId: string; error: string }[],
    };

    for (const entry of entries) {
      try {
        await this.createStyleStock(entry, userId);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          fabricId: entry.fabricId,
          error: error.message,
        });
      }
    }

    return results;
  }
}

export default new FabricStockService();
