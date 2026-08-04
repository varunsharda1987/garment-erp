import prisma from '../config/database';
import logger from '../utils/logger';
import { Prisma, ProductionStage, CADStatus, SampleStatus, OrderStatus } from '@prisma/client';
import { InternalError } from '../errors';

// Types for production status
interface ProductionStatusQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  brand?: string;
  customer?: string;
  status?: 'all' | 'running' | 'completed' | 'delayed' | 'attention';
  stage?: ProductionStage;
  cadStatus?: CADStatus;
  orderDateFrom?: string;
  orderDateTo?: string;
  deliveryDateFrom?: string;
  deliveryDateTo?: string;
  sortBy?: 'orderDate' | 'deliveryDate' | 'status' | 'progress' | 'orderValue';
  sortOrder?: 'asc' | 'desc';
}

interface BlockerInfo {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  daysStuck: number | null;
}

interface ActionInfo {
  label: string;
  route: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
}

class ProductionStatusService {
  /**
   * Get all production status items with pagination and filters
   */
  async getAll(options: ProductionStatusQueryOptions): Promise<any> {
    const {
      page = 1,
      limit = 20,
      search,
      brand,
      customer,
      status,
      stage,
      cadStatus,
      orderDateFrom,
      orderDateTo,
      deliveryDateFrom,
      deliveryDateTo,
      sortBy = 'orderDate',
      sortOrder = 'desc',
    } = options;

    const skip = (page - 1) * limit;

    try {
      // Build where clause for styles
      const styleWhere: Prisma.stylesWhereInput = {
        isActive: true,
      };

      if (search) {
        styleWhere.OR = [
          { styleCode: { contains: search, mode: 'insensitive' } },
          { styleName: { contains: search, mode: 'insensitive' } },
          { internalCode: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (brand) {
        styleWhere.brandName = { contains: brand, mode: 'insensitive' };
      }

      if (customer) {
        styleWhere.customerName = { contains: customer, mode: 'insensitive' };
      }

      if (cadStatus) {
        styleWhere.cadStatus = cadStatus;
      }

      // Get styles with related data
      const styles = await prisma.styles.findMany({
        where: styleWhere,
        include: {
          order_items: {
            include: {
              orders: {
                include: {
                  customers: true,
                },
              },
            },
          },
          work_orders: {
            include: {
              production_tracking: {
                orderBy: { updateDate: 'desc' },
                take: 1,
              },
            },
          },
          samples: {
            orderBy: { createdAt: 'desc' },
          },
          style_costing: true,
          order_boms: {
            where: { isActive: true },
            include: {
              items: true,
            },
          },
          brand_categories: true,
          // BUG-MFG19 fix: include quality_inspections for QC status display
          quality_inspections: {
            orderBy: { inspectionDate: 'desc' },
          },
        },
      });

      // Process each style to build production status
      let statusItems = styles.map((style) => this.buildProductionStatusItem(style));

      // Apply status filter
      if (status && status !== 'all') {
        statusItems = statusItems.filter((item) => {
          switch (status) {
            case 'running':
              return !item.isDelayed && item.overallProgress < 100 && item.overallProgress > 0;
            case 'completed':
              return item.overallProgress === 100;
            case 'delayed':
              return item.isDelayed;
            case 'attention':
              return item.blockers.length > 0;
            default:
              return true;
          }
        });
      }

      // Apply stage filter
      if (stage) {
        statusItems = statusItems.filter((item) => item.currentStage === stage);
      }

      // Apply date filters
      if (orderDateFrom || orderDateTo) {
        statusItems = statusItems.filter((item) => {
          if (!item.orders.earliestOrderDate) return false;
          const orderDate = new Date(item.orders.earliestOrderDate);
          if (orderDateFrom && orderDate < new Date(orderDateFrom)) return false;
          if (orderDateTo && orderDate > new Date(orderDateTo)) return false;
          return true;
        });
      }

      if (deliveryDateFrom || deliveryDateTo) {
        statusItems = statusItems.filter((item) => {
          if (!item.orders.latestDeliveryDate) return false;
          const deliveryDate = new Date(item.orders.latestDeliveryDate);
          if (deliveryDateFrom && deliveryDate < new Date(deliveryDateFrom)) return false;
          if (deliveryDateTo && deliveryDate > new Date(deliveryDateTo)) return false;
          return true;
        });
      }

      // Sort
      statusItems.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'orderDate':
            const dateA = a.orders.earliestOrderDate ? new Date(a.orders.earliestOrderDate).getTime() : 0;
            const dateB = b.orders.earliestOrderDate ? new Date(b.orders.earliestOrderDate).getTime() : 0;
            comparison = dateA - dateB;
            break;
          case 'deliveryDate':
            const delA = a.orders.latestDeliveryDate ? new Date(a.orders.latestDeliveryDate).getTime() : 0;
            const delB = b.orders.latestDeliveryDate ? new Date(b.orders.latestDeliveryDate).getTime() : 0;
            comparison = delA - delB;
            break;
          case 'progress':
            comparison = a.overallProgress - b.overallProgress;
            break;
          case 'orderValue':
            comparison = a.orders.totalValue - b.orders.totalValue;
            break;
          default:
            comparison = 0;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      // Calculate summary
      const summary = this.calculateSummary(statusItems);

      // Paginate
      const total = statusItems.length;
      const paginatedItems = statusItems.slice(skip, skip + limit);

      return {
        data: paginatedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary,
      };
    } catch (error) {
      logger.error('Production Status Service Error:', error);
      throw new InternalError('Failed to fetch production status');
    }
  }

  /**
   * Get summary statistics
   */
  async getSummary(): Promise<any> {
    try {
      const result = await this.getAll({ page: 1, limit: 10000 });
      return result.summary;
    } catch (error) {
      throw new InternalError('Failed to fetch production status summary');
    }
  }

  /**
   * Build production status item from style data
   */
  private buildProductionStatusItem(style: any): any {
    const now = new Date();

    // Aggregate order data
    const orders = style.order_items || [];
    const orderData = {
      totalQuantity: 0,
      totalValue: 0,
      earliestOrderDate: null as string | null,
      latestDeliveryDate: null as string | null,
      orderCount: 0,
    };

    const uniqueOrders = new Set<string>();
    orders.forEach((item: any) => {
      if (item.orders) {
        uniqueOrders.add(item.orders.id);
        orderData.totalQuantity += item.quantity || 0;
        orderData.totalValue += Number(item.totalPrice || 0);

        const orderDate = item.orders.orderDate;
        const deliveryDate = item.orders.expectedDeliveryDate;

        if (orderDate) {
          if (!orderData.earliestOrderDate || new Date(orderDate) < new Date(orderData.earliestOrderDate)) {
            orderData.earliestOrderDate = orderDate.toISOString();
          }
        }

        if (deliveryDate) {
          if (!orderData.latestDeliveryDate || new Date(deliveryDate) > new Date(orderData.latestDeliveryDate)) {
            orderData.latestDeliveryDate = deliveryDate.toISOString();
          }
        }
      }
    });
    orderData.orderCount = uniqueOrders.size;

    // Work order data
    const workOrders = style.work_orders || [];
    const workOrderData = {
      workOrderCount: workOrders.length,
      totalPlannedQuantity: workOrders.reduce((sum: number, wo: any) => sum + (wo.totalQuantity || 0), 0),
      totalCompletedQuantity: workOrders.reduce((sum: number, wo: any) => sum + (wo.completedQuantity || 0), 0),
    };

    // Determine current stage from latest production tracking
    let currentStage: ProductionStage = ProductionStage.ORDER_RECEIVED;
    let lastUpdatedDate: string | null = null;
    let piecesInStage = 0;

    workOrders.forEach((wo: any) => {
      if (wo.production_tracking && wo.production_tracking.length > 0) {
        const latestTracking = wo.production_tracking[0];
        if (!lastUpdatedDate || new Date(latestTracking.updateDate) > new Date(lastUpdatedDate)) {
          lastUpdatedDate = latestTracking.updateDate.toISOString();
          currentStage = latestTracking.productionStage;
          piecesInStage = latestTracking.quantityCompleted || 0;
        }
      }
    });

    // Calculate progress
    const overallProgress =
      workOrderData.totalPlannedQuantity > 0
        ? Math.round((workOrderData.totalCompletedQuantity / workOrderData.totalPlannedQuantity) * 100)
        : 0;

    // Calculate days to delivery
    let daysToDelivery: number | null = null;
    let isDelayed = false;
    if (orderData.latestDeliveryDate) {
      const deliveryDate = new Date(orderData.latestDeliveryDate);
      const diffTime = deliveryDate.getTime() - now.getTime();
      daysToDelivery = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isDelayed = daysToDelivery < 0 && overallProgress < 100;
    }

    // Build blockers
    const blockers = this.identifyBlockers(style, orderData, workOrderData, daysToDelivery);

    // Build suggested actions
    const suggestedActions = this.buildSuggestedActions(style, blockers);

    // Sample status
    const sampleStatus = this.buildSampleStatus(style.samples || []);

    // Material status (simplified - would need more data)
    const materialStatus = {
      fabricsOrdered: false,
      fabricsReceived: false,
      trimsOrdered: false,
      trimsReceived: false,
    };

    // Costing
    const costing = style.style_costing
      ? {
          totalCostPerPiece: Number(style.costPrice || 0),
          sellingPricePerPiece: Number(style.sellingPrice || 0),
          profitMargin:
            style.sellingPrice && style.costPrice
              ? ((Number(style.sellingPrice) - Number(style.costPrice)) / Number(style.sellingPrice)) * 100
              : null,
        }
      : null;

    // Stage breakdown — derive piece counts from currentStage
    const stageStr = currentStage as string;
    const stageBreakdown = {
      ordersReceived: orderData.orderCount,
      pendingCosting: style.style_costing ? 0 : 1,
      pendingGreige: stageStr === 'PENDING_GREIGE_ORDER' ? 1 : 0,
      trimsNotOrdered: stageStr === 'TRIMS_NOT_ORDERED' ? 1 : 0,
      inPrinting: stageStr === 'IN_PRINTING' ? piecesInStage : 0,
      inDying: stageStr === 'IN_DYING' ? piecesInStage : 0,
      inEmbroidery: stageStr === 'IN_EMBROIDERY' ? piecesInStage : 0,
      inSmocking: stageStr === 'IN_SMOCKING' ? piecesInStage : 0,
      inHandwork: stageStr === 'IN_HANDWORK' ? piecesInStage : 0,
      inCutting: stageStr === 'IN_CUTTING' ? piecesInStage : 0,
      inStitching: stageStr === 'IN_STITCHING' ? piecesInStage : 0,
      inFinishing: stageStr === 'IN_FINISHING' ? piecesInStage : 0,
      readyToShip: stageStr === 'READY_TO_SHIP' ? piecesInStage : 0,
      shipped: stageStr === 'SHIPPED' ? piecesInStage : 0,
      completed: stageStr === 'COMPLETED' ? piecesInStage : 0,
    };

    // BUG-MFG19 fix: corrected QC status display - read from actual quality_inspections data
    const inspectionStatus = this.buildInspectionStatus(style.quality_inspections || []);

    return {
      styleId: style.id,
      styleCode: style.styleCode,
      buyerStyleRef: style.buyerStyleRef ?? null,
      internalCode: style.internalCode,
      styleName: style.styleName,
      imageUrl: style.imageUrl || style.image,
      customerName: style.customerName,
      brandName: style.brandName,
      brandCategoryId: style.brandCategoryId,
      season: style.season,
      orders: orderData,
      cadStatus: style.cadStatus,
      approvedCadDate: style.approvedCadDate?.toISOString() || null,
      currentStage,
      piecesInStage,
      lastUpdatedDate,
      stageBreakdown,
      overallProgress,
      daysToDelivery,
      isDelayed,
      isOnTrack: !isDelayed && overallProgress > 0,
      blockers,
      suggestedActions,
      costing,
      materialStatus,
      workOrders: workOrderData,
      sampleStatus,
      inspectionStatus,
    };
  }

  /**
   * BUG-MFG19 fix: Build inspection status from quality_inspections data
   * Maps inspection types to the expected format for frontend display
   */
  private buildInspectionStatus(inspections: any[]): {
    fabricInspection: { completed: boolean; status: 'PASS' | 'FAIL' | 'PENDING' | null };
    inlineQC: { completed: boolean; status: 'PASS' | 'FAIL' | 'PENDING' | null };
    finalQC: { completed: boolean; status: 'PASS' | 'FAIL' | 'PENDING' | null };
  } {
    const findInspection = (types: string[]) => {
      // Find the most recent inspection matching any of the types
      const inspection = inspections.find((i: any) => types.includes(i.inspectionType));
      if (!inspection) {
        return { completed: false, status: null as 'PASS' | 'FAIL' | 'PENDING' | null };
      }
      // Map QualityStatus to the expected format
      let status: 'PASS' | 'FAIL' | 'PENDING' | null = null;
      if (inspection.status === 'PASS') {
        status = 'PASS';
      } else if (inspection.status === 'FAIL') {
        status = 'FAIL';
      } else if (inspection.status === 'CONDITIONAL_PASS') {
        // Treat conditional pass as pass for display purposes
        status = 'PASS';
      }
      return {
        completed: true,
        status,
      };
    };

    return {
      // Fabric inspection typically done before cutting (no specific type in quality_inspections, check FPT separately)
      // BUG-MFG20 fix: AQL here is just an inspection type label, not actual AQL sampling logic.
      // TODO: Implement full AQL calculation with lot size, sample size, accept/reject numbers per ISO 2859-1.
      fabricInspection: findInspection(['RANDOM', 'AQL']),
      // Inline/midline QC during production
      inlineQC: findInspection(['INLINE', 'MIDLINE']),
      // Final QC before dispatch
      finalQC: findInspection(['FINAL']),
    };
  }

  /**
   * Identify blockers for a style
   */
  private identifyBlockers(
    style: any,
    orderData: any,
    workOrderData: any,
    daysToDelivery: number | null
  ): BlockerInfo[] {
    const blockers: BlockerInfo[] = [];

    // CAD not approved
    if (style.cadStatus !== 'APPROVED') {
      blockers.push({
        type: 'CAD_NOT_APPROVED',
        severity: 'HIGH',
        message: 'CAD planning not approved',
        daysStuck: null,
      });
    }

    // Costing pending
    if (!style.style_costing) {
      blockers.push({
        type: 'COSTING_PENDING',
        severity: 'MEDIUM',
        message: 'Style costing not completed',
        daysStuck: null,
      });
    }

    // Delivery overdue
    if (daysToDelivery !== null && daysToDelivery < 0) {
      blockers.push({
        type: 'DELIVERY_OVERDUE',
        severity: 'HIGH',
        message: `Delivery overdue by ${Math.abs(daysToDelivery)} days`,
        daysStuck: Math.abs(daysToDelivery),
      });
    }

    // Check sample approvals
    const samples = style.samples || [];
    const fitSample = samples.find((s: any) => s.sampleType === 'FIT_SAMPLE');
    if (fitSample && fitSample.status !== 'APPROVED' && fitSample.status !== 'APPROVED_WITH_COMMENTS') {
      blockers.push({
        type: 'FIT_SAMPLE_NOT_APPROVED',
        severity: 'HIGH',
        message: 'Fit sample awaiting approval',
        daysStuck: fitSample.requestDate
          ? Math.floor((new Date().getTime() - new Date(fitSample.requestDate).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      });
    }

    return blockers;
  }

  /**
   * Build suggested actions based on blockers
   */
  private buildSuggestedActions(style: any, blockers: BlockerInfo[]): ActionInfo[] {
    const actions: ActionInfo[] = [];

    blockers.forEach((blocker) => {
      switch (blocker.type) {
        case 'CAD_NOT_APPROVED':
          actions.push({
            label: 'Review CAD Planning',
            route: `/styles/${style.id}/cad-planning`,
            priority: 'URGENT',
          });
          break;
        case 'COSTING_PENDING':
          actions.push({
            label: 'Complete Costing',
            route: `/styles/${style.id}/costing`,
            priority: 'HIGH',
          });
          break;
        case 'FIT_SAMPLE_NOT_APPROVED':
          actions.push({
            label: 'Follow up on Fit Sample',
            route: `/samples?styleId=${style.id}`,
            priority: 'HIGH',
          });
          break;
        case 'DELIVERY_OVERDUE':
          actions.push({
            label: 'Expedite Production',
            route: `/work-orders?styleId=${style.id}`,
            priority: 'URGENT',
          });
          break;
      }
    });

    return actions;
  }

  /**
   * Build sample status from samples
   */
  private buildSampleStatus(samples: any[]): any {
    const findSample = (type: string) => {
      const sample = samples.find((s) => s.sampleType === type);
      if (!sample) {
        return { exists: false, status: null, daysPending: null, sampleId: null };
      }

      const daysPending =
        sample.status !== 'APPROVED' && sample.status !== 'APPROVED_WITH_COMMENTS'
          ? Math.floor((new Date().getTime() - new Date(sample.requestDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;

      return {
        exists: true,
        status: sample.status,
        daysPending,
        sampleId: sample.id,
      };
    };

    return {
      fitSample: findSample('FIT_SAMPLE'),
      ppSample: findSample('PP_SAMPLE'),
      sizeSetSample: findSample('SIZE_SET_SAMPLE'),
      shipmentSample: findSample('SHIPMENT_SAMPLE'),
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(items: any[]): any {
    return {
      total: items.length,
      running: items.filter((i) => !i.isDelayed && i.overallProgress < 100 && i.overallProgress > 0).length,
      completed: items.filter((i) => i.overallProgress === 100).length,
      delayed: items.filter((i) => i.isDelayed).length,
      needsAttention: items.filter((i) => i.blockers.length > 0).length,
      totalOrderValue: items.reduce((sum, i) => sum + (i.orders.totalValue || 0), 0),
      totalPieces: items.reduce((sum, i) => sum + (i.orders.totalQuantity || 0), 0),
    };
  }
}

export const productionStatusService = new ProductionStatusService();
