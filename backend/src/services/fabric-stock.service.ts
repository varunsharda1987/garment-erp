// Fabric Stock Service - Manage fabric stock with style associations
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';
// BUG-GR9 fix: Use centralized quality grade default instead of hardcoding 'A'
import { DEFAULT_QUALITY_GRADE, getQualityGradeOrDefault } from '../constants/stock.constants';
import { systemSettingsService } from './system-settings.service';
// BUG-FAB5 fix: Use decimal.js for precise valuation calculations
import { toCurrency, multiplyCurrency, roundToCent, toNumber, Decimal } from '../utils/currency';

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

export interface StyleFabricStock {
  fabricId: string;
  fabricCode: string;
  fabricName: string;
  componentName: string;
  requiredPerGarment: number;
  availableStock: number;
  reservedStock: number;
  consumedStock: number;
  canMakeGarments: number;
}

// Valid status filter values for getStockByStyle
// Maps to Prisma StockStatus enum: AVAILABLE, RESERVED, EXHAUSTED, ISSUED, PENDING_RETURN
export type StockStatusFilter = 'AVAILABLE' | 'RESERVED' | 'EXHAUSTED' | 'ALL';

export interface FabricUsageByStyle {
  styleId: string;
  styleCode: string;
  buyerStyleRef: string | null;
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
  async createStyleStock(data: CreateStyleStockDTO, userId: string, outerTx?: any) {
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

      // The fabric_stock row and its stock_levels sync must be atomic — otherwise a crash after the create
      // leaves fabric_stock populated but stock_levels empty, so the Stock Levels page under-reports the
      // on-hand fabric (bug-hunt T1/F4).
      // Join a caller's transaction when supplied (e.g. receiveChallan) so this stock write commits/rolls
      // back with the caller; otherwise open our own (bug-hunt T1/F4).
      const run = async (tx: any) => {
        const created = await tx.fabric_stock.create({
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
            qualityGrade: getQualityGradeOrDefault(data.qualityGrade), // BUG-GR9 fix
            warehouseLocation: data.warehouseLocation || null,
            rollNumbers: data.rollNumbers || null,
            receivedDate: data.receivedDate || new Date(),
            agingDays: 0,
            createdById: userId,
          },
        });

        // Ensure materials record exists, then sync stock_levels — on the same tx
        const materialId = await ensureMaterialRecord(data.fabricId, 'FABRIC', tx);
        await syncStockLevelQuantity(materialId, data.quantity, undefined, 'METER', tx);
        return created;
      };
      const fabricStock = outerTx ? await run(outerTx) : await prisma.$transaction(run);

      return fabricStock;
    } catch (error: unknown) {
      logError('Error creating style stock:', error);
      throw new Error(`Failed to create style stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get stock for a specific style (all fabrics)
   * @param styleId - The style ID
   * @param statusFilter - Filter by stock status: AVAILABLE, RESERVED, EXHAUSTED, or ALL (default: AVAILABLE)
   */
  async getStockByStyle(styleId: string, statusFilter: StockStatusFilter = 'AVAILABLE'): Promise<StyleFabricStock[]> {
    try {
      // Build status filter condition
      // Cast to Prisma StockStatus enum type
      const statusCondition =
        statusFilter === 'ALL'
          ? {}
          : { status: statusFilter as 'AVAILABLE' | 'RESERVED' | 'EXHAUSTED' | 'ISSUED' | 'PENDING_RETURN' };

      // Get all components and their fabrics (including placeholders for CAD data)
      const components = await prisma.style_components.findMany({
        where: { styleId },
        include: {
          style_fabrics: {
            include: {
              fabric: {
                include: {
                  fabricStock: {
                    where: statusCondition,
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
                  fabricStockId: true,
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      });

      // Also get PRODUCTION CAD records that link directly to fabric_stock (for when fabricId differs)
      const productionCads = await prisma.fabric_width_cad.findMany({
        where: {
          styleFabric: { style_components: { styleId } },
          purpose: 'PRODUCTION',
          fabricStockId: { not: null },
        },
        include: {
          fabricStock: {
            include: {
              fabricMaster: true,
            },
          },
          styleFabric: {
            include: {
              style_components: true,
            },
          },
        },
      });

      // Build a map of styleFabricId -> PRODUCTION CAD stock (for stock with different fabricId)
      const productionStockMap = new Map<
        string,
        {
          available: number;
          reserved: number;
          consumed: number;
          fabricCode: string;
          fabricName: string;
        }
      >();

      for (const cad of productionCads) {
        if (!cad.fabricStock || !cad.styleFabricId) continue;
        const stock = cad.fabricStock;
        const existing = productionStockMap.get(cad.styleFabricId);

        if (existing) {
          existing.available += Number(stock.quantityAvailable);
          existing.reserved += Number(stock.quantityReserved);
          existing.consumed += Number(stock.quantityConsumed);
        } else {
          productionStockMap.set(cad.styleFabricId, {
            available: Number(stock.quantityAvailable),
            reserved: Number(stock.quantityReserved),
            consumed: Number(stock.quantityConsumed),
            fabricCode: stock.fabricMaster?.fabricCode || '',
            fabricName: stock.fabricMaster?.fabricName || '',
          });
        }
      }

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

          // Calculate total stock from style_fabrics.fabric.fabricStock
          let totalAvailable = styleFabric.fabric.fabricStock.reduce(
            (sum, stock) => sum + Number(stock.quantityAvailable),
            0
          );

          let totalReserved = styleFabric.fabric.fabricStock.reduce(
            (sum, stock) => sum + Number(stock.quantityReserved),
            0
          );

          let totalConsumed = styleFabric.fabric.fabricStock.reduce(
            (sum, stock) => sum + Number(stock.quantityConsumed),
            0
          );

          // Also include stock from PRODUCTION CAD that links to stock with different fabricId
          const productionStock = productionStockMap.get(styleFabric.id);
          if (productionStock) {
            totalAvailable += productionStock.available;
            totalReserved += productionStock.reserved;
            totalConsumed += productionStock.consumed;
          }

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

          // Use production stock fabric info if available and style fabric stock is empty
          const fabricCode =
            productionStock && totalAvailable === productionStock.available
              ? productionStock.fabricCode || styleFabric.fabric.fabricCode
              : styleFabric.fabric.fabricCode;
          const fabricName =
            productionStock && totalAvailable === productionStock.available
              ? productionStock.fabricName || styleFabric.fabric.fabricName
              : styleFabric.fabric.fabricName;

          result.push({
            fabricId: styleFabric.fabric.id,
            fabricCode,
            fabricName,
            componentName: component.componentName,
            requiredPerGarment,
            availableStock: totalAvailable,
            reservedStock: totalReserved,
            consumedStock: totalConsumed,
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
   * @param styleId - The style ID
   * @param statusFilter - Filter by stock status: AVAILABLE, RESERVED, CONSUMED, or ALL (default: AVAILABLE)
   */
  async getAvailableStockForStyle(styleId: string, statusFilter: StockStatusFilter = 'AVAILABLE') {
    const fabricStocks = await this.getStockByStyle(styleId, statusFilter);

    // The bottleneck fabric determines how many garments can be made
    const canMakeGarments = fabricStocks.length > 0 ? Math.min(...fabricStocks.map((f) => f.canMakeGarments)) : 0;

    return {
      canMakeGarments,
      fabricStocks,
      bottleneckFabric: fabricStocks.find((f) => f.canMakeGarments === canMakeGarments),
      statusFilter, // Include filter in response for frontend reference
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

      // Aggregate allocated/consumed meters per style from allocations drawn
      // against stock of THIS fabric.
      const allocationSums = await prisma.fabric_stock_allocation.groupBy({
        by: ['styleId'],
        where: { fabricStock: { fabricId } },
        _sum: { quantityAllocated: true, quantityConsumed: true },
      });
      const allocationByStyle = new Map(
        allocationSums.map((a) => [
          a.styleId,
          {
            allocated: a._sum.quantityAllocated ? Number(a._sum.quantityAllocated) : 0,
            consumed: a._sum.quantityConsumed ? Number(a._sum.quantityConsumed) : 0,
          },
        ])
      );

      const result: FabricUsageByStyle[] = styleFabrics.map((sf) => {
        const alloc = allocationByStyle.get(sf.style_components.styleId);
        return {
          styleId: sf.style_components.styleId,
          styleCode: sf.style_components.styles.styleCode,
          buyerStyleRef: sf.style_components.styles.buyerStyleRef ?? null,
          styleName: sf.style_components.styles.styleName,
          componentName: sf.style_components.componentName,
          cadMeters: sf.quantityNeeded ? Number(sf.quantityNeeded) : 0,
          stockAllocated: alloc?.allocated ?? 0,
          stockConsumed: alloc?.consumed ?? 0,
        };
      });

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
      const [components, unlinkedFabricsRaw] = await Promise.all([
        prisma.style_components.findMany({
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
        }),
        prisma.style_fabrics.findMany({
          where: {
            fabricId: null,
            style_components: { styleId },
          },
          include: {
            style_components: {
              select: { id: true, componentName: true },
            },
          },
        }),
      ]);

      const mappedComponents = components.map((comp) => ({
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

      const unlinkedFabrics = unlinkedFabricsRaw.map((sf) => ({
        fabricName: sf.fabricName || 'Unknown Fabric',
        componentName: sf.style_components?.componentName || 'Unknown Component',
        componentId: sf.style_components?.id || null,
        finishType: sf.fabricFinishType || null,
      }));

      return {
        components: mappedComponents,
        unlinkedFabrics,
      };
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

      // BUG-FAB5 fix: Use decimal.js for precise valuation calculations
      let totalMeters = new Decimal(0);
      let totalValue = new Decimal(0);
      let agingStockCount = 0;

      greigeProcurements.forEach((procurement) => {
        const quantity = toCurrency(procurement.quantityPurchased);
        const cost = toCurrency(procurement.ratePerUnit);

        totalMeters = totalMeters.plus(quantity);
        totalValue = totalValue.plus(multiplyCurrency(quantity, cost));

        const agingDays = procurement.receivedDate
          ? Math.floor((Date.now() - procurement.receivedDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        if (agingDays >= 180) {
          agingStockCount++;
        }
      });

      return {
        totalMeters: toNumber(roundToCent(totalMeters)),
        totalValue: toNumber(roundToCent(totalValue)),
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

  /**
   * Bring ready fabric held at a processor's unit back into one of OUR stores (direct-to-processor plan,
   * Phase 4b). Call inside the transaction that files the INWARD challan (helpers/held-stock-doors.helper).
   * The unit lot gives up the metres and a NEW store lot takes them; the ledger moves unit → store. With
   * `alreadyDrawnByJobId` (fabric a job drew where it lay, back unprocessed) the unit lot is not touched.
   */
  async bringHeldLotToStore(
    tx: Prisma.TransactionClient,
    p: {
      stockId: string;
      quantity: number;
      storeWarehouseId: string;
      inwardChallanId: string;
      inwardChallanNumber: string;
      broughtOn: Date;
      userId: string;
      alreadyDrawnByJobId?: string;
      /**
       * Moving to ANOTHER processor (Phase 4c): `storeWarehouseId` is that processor's unit, and the new
       * lot keeps the original arrival date — the one-year clock does not restart on a move.
       */
      toProcessorId?: string | null;
    }
  ): Promise<{ storeLotId: string; remainingAtProcessor: number }> {
    const lot = await tx.fabric_stock.findUnique({
      where: { id: p.stockId },
      include: {
        fabricMaster: { select: { fabricCode: true } },
        warehouse: { select: { warehouseName: true, supplier: { select: { name: true } } } },
      },
    });
    if (!lot) throw new Error('Fabric stock not found');
    const store = await tx.warehouses.findUnique({
      where: { id: p.storeWarehouseId },
      select: { warehouseName: true },
    });
    const holder = lot.warehouse?.supplier?.name ?? lot.warehouse?.warehouseName ?? 'the processor';
    const materialId = await ensureMaterialRecord(lot.fabricId, 'FABRIC', tx);
    const qty = p.quantity;
    const wac = Number(lot.weightedAvgCost);
    const value = (q: number) => new Prisma.Decimal(toNumber(roundToCent(multiplyCurrency(q, wac))));
    let remainingAtProcessor = Number(lot.quantityAvailable);

    if (!p.alreadyDrawnByJobId) {
      const moved = await tx.fabric_stock.updateMany({
        where: { id: p.stockId, quantityAvailable: { gte: qty } },
        data: { quantityAvailable: { decrement: qty }, lastConsumedDate: p.broughtOn },
      });
      if (moved.count === 0)
        throw new Error(
          `Only ${Number(lot.quantityAvailable)} m of ${lot.fabricMaster?.fabricCode ?? 'this fabric'} is at ${holder}.`
        );
      remainingAtProcessor = toNumber(toCurrency(Number(lot.quantityAvailable)).minus(qty));
      await tx.fabric_stock_transaction.create({
        data: {
          stockId: p.stockId,
          transactionType: 'TRANSFER_OUT',
          quantity: new Prisma.Decimal(qty),
          referenceType: 'CHALLAN',
          referenceId: p.inwardChallanId,
          costPerUnit: new Prisma.Decimal(wac),
          weightedAvgCost: new Prisma.Decimal(wac),
          totalValue: value(qty),
          balanceAfter: new Prisma.Decimal(remainingAtProcessor),
          valueAfter: value(remainingAtProcessor),
          notes: `Brought back from ${holder} to ${store?.warehouseName ?? 'our store'} — inward challan ${p.inwardChallanNumber}`,
          createdById: p.userId,
        },
      });
      if (lot.warehouseId) await syncStockLevelQuantity(materialId, -qty, lot.warehouseId, 'METER', tx);
    }

    const storeLot = await tx.fabric_stock.create({
      data: {
        fabricId: lot.fabricId,
        finishedWidth: lot.finishedWidth,
        cutableWidth: lot.cutableWidth,
        quantityAvailable: new Prisma.Decimal(qty),
        unit: lot.unit,
        procurementId: lot.procurementId,
        originStyleId: lot.originStyleId,
        originOrderId: lot.originOrderId,
        status: 'AVAILABLE',
        stockType: lot.stockType,
        weightedAvgCost: lot.weightedAvgCost,
        purchaseCost: lot.purchaseCost,
        qualityGrade: lot.qualityGrade,
        warehouseId: p.storeWarehouseId,
        warehouseLocation: store?.warehouseName ?? null,
        rollNumbers: lot.rollNumbers,
        receivedDate: p.toProcessorId ? lot.receivedDate : p.broughtOn,
        patternPartId: lot.patternPartId,
        fabricFinishType: lot.fabricFinishType,
        needsEmbroidery: lot.needsEmbroidery,
        weaverId: lot.weaverId,
        weaverMix: lot.weaverMix ?? undefined,
        createdById: p.userId,
      },
      select: { id: true },
    });
    await tx.fabric_stock_transaction.create({
      data: {
        stockId: storeLot.id,
        transactionType: 'TRANSFER_IN',
        quantity: new Prisma.Decimal(qty),
        referenceType: 'CHALLAN',
        referenceId: p.inwardChallanId,
        costPerUnit: new Prisma.Decimal(wac),
        weightedAvgCost: new Prisma.Decimal(wac),
        totalValue: value(qty),
        balanceAfter: new Prisma.Decimal(qty),
        valueAfter: value(qty),
        notes: `Back from ${holder}${p.alreadyDrawnByJobId ? ' unprocessed' : ''} — inward challan ${p.inwardChallanNumber}`,
        createdById: p.userId,
      },
    });
    await syncStockLevelQuantity(materialId, qty, p.storeWarehouseId, 'METER', tx);
    return { storeLotId: storeLot.id, remainingAtProcessor };
  }
}

export default new FabricStockService();
