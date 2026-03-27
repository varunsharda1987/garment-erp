// Fabric Stock Service - Manage fabric stock with style associations
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

export interface CreateStyleStockDTO {
  styleId: string;
  fabricId: string;
  quantity: number;
  finishedWidth: number;
  cutableWidth: number;
  rollNumbers?: string;
  warehouseLocation?: string;
  qualityGrade?: 'A' | 'B' | 'DEFECT';
  purchaseCost?: number;
  receivedDate?: Date;
  patternPartId?: string;
  fabricFinishType?: 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW';
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

      // Create fabric stock record directly (no procurement record needed for manual stock entry)
      const fabricStock = await prisma.fabric_stock.create({
        data: {
          id: `STOCK-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          fabricId: data.fabricId,
          finishedWidth: new Prisma.Decimal(data.finishedWidth),
          cutableWidth: new Prisma.Decimal(data.cutableWidth),
          quantityAvailable: new Prisma.Decimal(data.quantity),
          quantityReserved: new Prisma.Decimal(0),
          quantityConsumed: new Prisma.Decimal(0),
          unit: 'meters',
          procurementId: null,
          originStyleId: data.styleId,
          originOrderId: null,
          status: 'AVAILABLE',
          stockType: 'PLANNED_STOCK',
          patternPartId: data.patternPartId || null,
          fabricFinishType: data.fabricFinishType || null,
          weightedAvgCost: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : new Prisma.Decimal(0),
          purchaseCost: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : new Prisma.Decimal(0),
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
        await this.updateMaterialStockLevel(material.id, 'DEFAULT_WAREHOUSE', data.quantity, data.purchaseCost);
      }

      return fabricStock;
    } catch (error: unknown) {
      logError('Error creating style stock:', error);
      throw new Error(`Failed to create style stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create generic greige stock entry (not tied to any style)
   * @deprecated Use GreigeStockService.createGreigeStock() instead.
   * This method creates proxy fabric_master records which pollutes the fabric master list.
   * Kept for backward compatibility during migration.
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
            OR: [{ code: 'STOCK-ENTRY' }, { name: { contains: 'Stock Entry', mode: 'insensitive' } }],
          },
        });

        if (stockEntrySupplier) {
          supplierId = stockEntrySupplier.id;
        } else {
          // If no supplier found, get any active supplier as a fallback
          const anySupplier = await prisma.suppliers.findFirst({
            where: { isActive: true },
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
          ratePerUnit: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : new Prisma.Decimal(0),
          totalCost: data.purchaseCost ? new Prisma.Decimal(data.quantity * data.purchaseCost) : new Prisma.Decimal(0),
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
          finishType: 'RAW',
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
            finishType: 'RAW',
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
          finishedWidth: new Prisma.Decimal(data.width),
          cutableWidth: new Prisma.Decimal(data.width - 2), // Default cutable = finished - 2
          quantityAvailable: new Prisma.Decimal(data.quantity),
          quantityReserved: new Prisma.Decimal(0),
          quantityConsumed: new Prisma.Decimal(0),
          unit: 'meters',
          procurementId: procurement.id,
          originStyleId: null, // Generic greige
          originOrderId: null,
          status: 'AVAILABLE',
          stockType: 'GENERIC',
          weightedAvgCost: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : new Prisma.Decimal(0),
          purchaseCost: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : new Prisma.Decimal(0),
          qualityGrade: 'A',
          warehouseLocation: data.warehouseLocation || null,
          rollNumbers: data.rollNumbers || null,
          receivedDate: data.receivedDate || new Date(),
          createdById: userId,
          agingDays: 0,
        },
      });

      return fabricStock;
    } catch (error: unknown) {
      logError('Error creating generic greige stock:', error);
      throw new Error(`Failed to create greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get stock for a specific style (all fabrics)
   */
  async getStockByStyle(styleId: string): Promise<StyleFabricStock[]> {
    try {
      // Get all components and their fabrics (including placeholders for CAD data)
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
              cadRows: {
                select: {
                  id: true,
                  purposeEnum: true,
                  purpose: true,
                  cadMeters: true,
                  cadAverage: true,
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      });

      const result: StyleFabricStock[] = [];

      for (const component of components) {
        // Collect all CAD rows across all style_fabrics in this component (including placeholders)
        const allCadRows: any[] = [];
        for (const sf of component.style_fabrics) {
          for (const cad of (sf as any).cadRows || []) {
            allCadRows.push(cad);
          }
        }

        // Only process style_fabrics that have a real fabric linked
        for (const styleFabric of component.style_fabrics) {
          if (!styleFabric.fabricId || !styleFabric.fabric) continue;

          // Calculate total stock
          const totalAvailable = styleFabric.fabric.fabricStock.reduce(
            (sum, stock) => sum + Number(stock.quantityAvailable),
            0
          );

          const totalReserved = styleFabric.fabric.fabricStock.reduce(
            (sum, stock) => sum + Number(stock.quantityReserved),
            0
          );

          // Resolve consumption: PRODUCTION → RAW_MATERIAL_CALCULATION → COSTING
          // Check both purposeEnum (enum) and purpose (string) fields
          const cadPriority = ['PRODUCTION', 'RAW_MATERIAL_CALCULATION', 'COSTING'];
          let requiredPerGarment = 0;

          // First check CAD rows on this specific style_fabric, then all component CAD rows
          const cadSources = [(styleFabric as any).cadRows || [], allCadRows];
          for (const cadRows of cadSources) {
            if (requiredPerGarment > 0) break;
            for (const purpose of cadPriority) {
              const cadRow = cadRows.find(
                (c: any) =>
                  (c.purposeEnum === purpose || c.purpose === purpose) &&
                  (Number(c.cadMeters) > 0 || Number(c.cadAverage) > 0)
              );
              if (cadRow) {
                requiredPerGarment = Number(cadRow.cadAverage) || Number(cadRow.cadMeters) || 0;
                break;
              }
            }
          }

          // Final fallback: style_fabrics.quantityNeeded
          if (requiredPerGarment === 0 && styleFabric.quantityNeeded) {
            requiredPerGarment = Number(styleFabric.quantityNeeded);
          }

          const canMakeGarments = requiredPerGarment > 0 ? Math.floor(totalAvailable / requiredPerGarment) : 0;

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
    } catch (error: unknown) {
      logError('Error getting stock by style:', error);
      throw new Error(`Failed to get stock for style: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available stock for a style (can make X garments)
   */
  async getAvailableStockForStyle(styleId: string) {
    const fabricStocks = await this.getStockByStyle(styleId);

    // The bottleneck fabric determines how many garments can be made
    const canMakeGarments = fabricStocks.length > 0 ? Math.min(...fabricStocks.map((f) => f.canMakeGarments)) : 0;

    return {
      canMakeGarments,
      fabricStocks,
      bottleneckFabric: fabricStocks.find((f) => f.canMakeGarments === canMakeGarments),
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
        stockConsumed: 0, // Will be calculated from allocations
      }));

      return result;
    } catch (error: unknown) {
      logError('Error getting styles by fabric:', error);
      throw new Error(`Failed to get styles for fabric: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          componentMaster: {
            include: {
              patternParts: {
                include: {
                  patternPart: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      sortOrder: true,
                    },
                  },
                },
              },
            },
          },
          style_fabrics: {
            where: { fabricId: { not: null } },
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
              stylePatternParts: {
                include: {
                  patternPart: {
                    select: { id: true, code: true, name: true },
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
        componentId: comp.id,
        patternParts: (comp.componentMaster?.patternParts || []).map((cpp) => ({
          id: cpp.patternPart.id,
          code: cpp.patternPart.code,
          name: cpp.patternPart.name,
          sortOrder: cpp.patternPart.sortOrder,
        })),
        fabrics: comp.style_fabrics.map((sf) => ({
          fabricId: sf.fabric?.id,
          fabricCode: sf.fabric?.fabricCode,
          fabricName: sf.fabric?.fabricName,
          description: sf.fabric?.description,
          greige: sf.fabric?.greige,
          widthCADs: sf.fabric?.widthCADs,
          quantityNeeded: sf.quantityNeeded ? Number(sf.quantityNeeded) : 0,
          fabricFinishType: sf.fabric?.finishType || sf.fabricFinishType || null,
          actualWidth: sf.fabric?.actualWidth ? Number(sf.fabric.actualWidth) : null,
          cutableWidth: sf.fabric?.cutableWidth ? Number(sf.fabric.cutableWidth) : null,
          allocatedPatternParts: ((sf as any).stylePatternParts || []).map((spp: any) => ({
            id: spp.patternPart.id,
            code: spp.patternPart.code,
            name: spp.patternPart.name,
          })),
        })),
      }));
    } catch (error: unknown) {
      logError('Error getting fabrics by style:', error);
      throw new Error(`Failed to get fabrics for style: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
              customerName: true,
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
        finishedWidth: Number(stock.finishedWidth),
        cutableWidth: Number(stock.cutableWidth),
        stockType: stock.stockType,
        originStyle: stock.originStyle,
        originOrder: stock.originOrder,
        procurement: stock.procurement,
        receivedDate: stock.receivedDate,
        qualityGrade: stock.qualityGrade,
        warehouseLocation: stock.warehouseLocation,
      }));
    } catch (error: unknown) {
      logError('Error getting stock origin history:', error);
      throw new Error(`Failed to get stock history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get generic greige stock available for future styles
   * @deprecated Use GreigeStockService.getGreigeStock() instead.
   * This method queries procurement records, not the dedicated greige_stock table.
   */
  async getGenericGreigeStock() {
    try {
      const greigeProcurements = await prisma.fabric_procurement.findMany({
        where: {
          procurementType: 'GREIGE',
          status: 'RECEIVED',
          orderedForStyleId: null, // Generic stock not tied to specific style
          quantityPurchased: { gt: 0 },
        },
        include: {
          greigeMaster: {
            select: {
              id: true,
              greigeCode: true,
              greigeName: true,
              composition: true,
              yarnCount: true,
              construction: true,
              weaveType: true,
            },
          },
        },
        orderBy: { receivedDate: 'desc' },
      });

      return greigeProcurements.map((procurement) => {
        const agingDays = procurement.receivedDate
          ? Math.floor((Date.now() - procurement.receivedDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          stockId: procurement.id,
          greigeId: procurement.greigeId || '',
          greige: procurement.greigeMaster,
          quantity: Number(procurement.quantityPurchased),
          width: Number(procurement.width),
          cost: Number(procurement.ratePerUnit),
          receivedDate: procurement.receivedDate,
          agingDays,
          warehouseLocation: null, // Greige procurements don't have warehouse location in schema
          rollNumbers: null,
        };
      });
    } catch (error: unknown) {
      logError('Error getting generic greige stock:', error);
      throw new Error(`Failed to get greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        const newValue = valuationRate ? newQuantity * valuationRate : Number(existing.stockValue || 0);

        await prisma.stock_levels.update({
          where: { id: existing.id },
          data: {
            quantity: new Prisma.Decimal(newQuantity),
            valuationRate: valuationRate ? new Prisma.Decimal(valuationRate) : existing.valuationRate,
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
            stockValue: valuationRate ? new Prisma.Decimal(quantityChange * valuationRate) : null,
            lastUpdated: new Date(),
          },
        });
      }
    } catch (error: unknown) {
      logError('Error updating material stock level:', error);
      // Don't throw error, just log it
    }
  }

  /**
   * Bulk create fabric stock for a style
   */
  async bulkCreateStyleStock(entries: CreateStyleStockDTO[], userId: string) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as { fabricId: string; error: string }[],
    };

    for (const entry of entries) {
      try {
        await this.createStyleStock(entry, userId);
        results.success++;
      } catch (error: unknown) {
        results.failed++;
        results.errors.push({
          fabricId: entry.fabricId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get greige stock summary for unified dashboard
   * @deprecated Use GreigeStockService.getGreigeStockSummary() instead.
   * This method queries procurement records, not the dedicated greige_stock table.
   */
  async getGreigeStockSummary() {
    try {
      const greigeProcurements = await prisma.fabric_procurement.findMany({
        where: {
          procurementType: 'GREIGE',
          status: 'RECEIVED',
          orderedForStyleId: null, // Generic stock only
          quantityPurchased: { gt: 0 },
        },
        select: {
          quantityPurchased: true,
          ratePerUnit: true,
          receivedDate: true,
          width: true,
        },
      });

      let totalMeters = 0;
      let totalValue = 0;
      let agingStockCount = 0;

      greigeProcurements.forEach((procurement) => {
        const quantity = Number(procurement.quantityPurchased);
        const cost = Number(procurement.ratePerUnit);

        totalMeters += quantity;
        totalValue += quantity * cost;

        const agingDays = procurement.receivedDate
          ? Math.floor((Date.now() - procurement.receivedDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        if (agingDays >= 180) {
          agingStockCount++;
        }
      });

      return {
        totalMeters: Math.round(totalMeters * 100) / 100,
        totalValue: Math.round(totalValue * 100) / 100,
        agingStockCount,
        totalItems: greigeProcurements.length,
      };
    } catch (error: unknown) {
      logError('Error getting greige stock summary:', error);
      throw new Error(
        `Failed to get greige stock summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export default new FabricStockService();
