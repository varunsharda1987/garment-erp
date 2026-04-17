import prisma from '../config/database';
import { logger } from '../utils/logger';
import { Prisma, ProductionStage, CADStatus, SampleStatus, OrderStatus } from '@prisma/client';
import { InternalError } from '../errors';
import { systemSettingsService } from './system-settings.service';

// Types for order production status
interface OrderProductionStatusQueryOptions {
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
  styleId?: string;
  orderId?: string;
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

interface CadWidthOption {
  id: string;
  cutableWidth: number;
  cadMeters: number | null;
  cadWastagePercent: number;
  isSelected: boolean;
  isPreferred: boolean;
}

class OrderProductionStatusService {
  /**
   * Get all order-level production status items with pagination and filters
   */
  async getAll(options: OrderProductionStatusQueryOptions): Promise<any> {
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
      styleId,
      orderId,
    } = options;

    const skip = (page - 1) * limit;

    try {
      // Build where clause for order_items
      const orderItemWhere: Prisma.order_itemsWhereInput = {};

      // Style filters
      if (styleId) {
        orderItemWhere.styleId = styleId;
      }

      if (orderId) {
        orderItemWhere.orderId = orderId;
      }

      if (search) {
        orderItemWhere.OR = [
          { styles: { styleCode: { contains: search, mode: 'insensitive' } } },
          { styles: { styleName: { contains: search, mode: 'insensitive' } } },
          { styles: { internalCode: { contains: search, mode: 'insensitive' } } },
          { orders: { orderNumber: { contains: search, mode: 'insensitive' } } },
          { orders: { customers: { name: { contains: search, mode: 'insensitive' } } } },
        ];
      }

      if (brand) {
        orderItemWhere.styles = {
          ...(orderItemWhere.styles as Prisma.stylesWhereInput),
          brandName: { contains: brand, mode: 'insensitive' },
        };
      }

      if (customer) {
        orderItemWhere.orders = {
          customers: { name: { contains: customer, mode: 'insensitive' } },
        };
      }

      if (cadStatus) {
        orderItemWhere.styles = {
          ...(orderItemWhere.styles as Prisma.stylesWhereInput),
          cadStatus,
        };
      }

      // Date filters on orders
      if (orderDateFrom || orderDateTo) {
        orderItemWhere.orders = {
          ...(orderItemWhere.orders as Prisma.ordersWhereInput),
          orderDate: {
            ...(orderDateFrom && { gte: new Date(orderDateFrom) }),
            ...(orderDateTo && { lte: new Date(orderDateTo) }),
          },
        };
      }

      if (deliveryDateFrom || deliveryDateTo) {
        orderItemWhere.orders = {
          ...(orderItemWhere.orders as Prisma.ordersWhereInput),
          expectedDeliveryDate: {
            ...(deliveryDateFrom && { gte: new Date(deliveryDateFrom) }),
            ...(deliveryDateTo && { lte: new Date(deliveryDateTo) }),
          },
        };
      }

      // Get order items with related data
      const orderItems = await prisma.order_items.findMany({
        where: orderItemWhere,
        include: {
          orders: {
            include: {
              customers: true,
            },
          },
          styles: {
            include: {
              samples: {
                orderBy: { createdAt: 'desc' },
              },
              style_costing: true,
              brand_categories: true,
              style_components: {
                include: {
                  style_fabrics: {
                    include: {
                      fabricCAD: true,
                      fabric: {
                        include: {
                          widthCADs: true,
                        },
                      },
                    },
                  },
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
          selectedCad: true,
          order_item_costing: true,
          order_samples: {
            orderBy: { createdAt: 'desc' },
          },
          order_inspections: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      // Process each order item to build production status
      let statusItems = await Promise.all(orderItems.map((orderItem) => this.buildOrderStatusItem(orderItem)));

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

      // Sort
      statusItems.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'orderDate':
            const dateA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
            const dateB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
            comparison = dateA - dateB;
            break;
          case 'deliveryDate':
            const delA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
            const delB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
            comparison = delA - delB;
            break;
          case 'progress':
            comparison = a.overallProgress - b.overallProgress;
            break;
          case 'orderValue':
            comparison = Number(a.totalPrice) - Number(b.totalPrice);
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
      logger.error('Order Production Status Service Error:', error);
      throw new InternalError('Failed to fetch order production status');
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
      throw new InternalError('Failed to fetch order production status summary');
    }
  }

  /**
   * Select CAD width for an order item
   */
  async selectCad(orderItemId: string, cadId: string): Promise<any> {
    try {
      const updated = await prisma.order_items.update({
        where: { id: orderItemId },
        data: { selectedCadId: cadId },
        include: {
          selectedCad: true,
        },
      });
      return updated;
    } catch (error) {
      logger.error('Select CAD Error:', error);
      throw new InternalError('Failed to select CAD for order');
    }
  }

  /**
   * Toggle sample/inspection inheritance
   */
  async updateInheritance(
    orderItemId: string,
    data: { inheritStyleSamples?: boolean; inheritInspections?: boolean }
  ): Promise<any> {
    try {
      const updated = await prisma.order_items.update({
        where: { id: orderItemId },
        data,
      });
      return updated;
    } catch (error) {
      logger.error('Update Inheritance Error:', error);
      throw new InternalError('Failed to update inheritance settings');
    }
  }

  /**
   * Build order-level production status item
   */
  private async buildOrderStatusItem(orderItem: any): Promise<any> {
    const now = new Date();
    const order = orderItem.orders;
    const style = orderItem.styles;

    // Order info
    const orderDate = order?.orderDate?.toISOString() || null;
    const deliveryDate = order?.expectedDeliveryDate?.toISOString() || orderItem.deliveryDate?.toISOString() || null;

    // Work order data for this order item
    const workOrders = orderItem.work_orders || [];
    const workOrderData = {
      workOrderCount: workOrders.length,
      totalPlannedQuantity: workOrders.reduce((sum: number, wo: any) => sum + (wo.totalQuantity || 0), 0),
      totalCompletedQuantity: workOrders.reduce((sum: number, wo: any) => sum + (wo.completedQuantity || 0), 0),
    };

    // Determine current stage from latest production tracking
    let currentStage: ProductionStage = ProductionStage.ORDER_RECEIVED;
    let lastUpdatedDate: string | null = null;
    let piecesInStage = 0;
    let latestWorkOrderId: string | null = null;

    workOrders.forEach((wo: any) => {
      if (wo.production_tracking && wo.production_tracking.length > 0) {
        const latestTracking = wo.production_tracking[0];
        if (!lastUpdatedDate || new Date(latestTracking.updateDate) > new Date(lastUpdatedDate)) {
          lastUpdatedDate = latestTracking.updateDate.toISOString();
          currentStage = latestTracking.productionStage;
          piecesInStage = latestTracking.quantityCompleted || 0;
          latestWorkOrderId = wo.id;
        }
      } else if (!latestWorkOrderId && wo.id) {
        // If no work order has tracking yet, use the first one found
        latestWorkOrderId = wo.id;
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
    if (deliveryDate) {
      const delDate = new Date(deliveryDate);
      const diffTime = delDate.getTime() - now.getTime();
      daysToDelivery = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isDelayed = daysToDelivery < 0 && overallProgress < 100;
    }

    // Get available CAD widths from style
    const availableCadWidths = this.getAvailableCadWidths(style, orderItem.selectedCadId);

    // Determine sample status based on inheritance
    const sampleStatus = orderItem.inheritStyleSamples
      ? this.buildSampleStatus(style?.samples || [])
      : this.buildSampleStatus(orderItem.order_samples || []);

    // Determine inspection status based on inheritance
    const inspectionStatus = orderItem.inheritInspections
      ? this.buildInspectionStatusFromStyle(style)
      : this.buildInspectionStatusFromOrder(orderItem.order_inspections || []);

    // Build blockers
    const blockers = this.identifyBlockers(style, orderItem, workOrderData, daysToDelivery, sampleStatus);

    // Build suggested actions
    const suggestedActions = this.buildSuggestedActions(style, orderItem, blockers);

    // Costing - use order-specific if available, otherwise style
    const orderCosting = orderItem.order_item_costing;
    const styleCosting = style?.style_costing;
    const costing = orderCosting
      ? {
          totalCostPerPiece: Number(orderCosting.totalCostPerPiece || 0),
          sellingPricePerPiece: Number(orderCosting.sellingPricePerPiece || 0),
          profitMargin: orderCosting.profitMargin ? Number(orderCosting.profitMargin) : null,
          isRecalculated: true,
        }
      : styleCosting
        ? {
            totalCostPerPiece: Number(styleCosting.totalCostPerPiece || 0),
            sellingPricePerPiece: Number(styleCosting.sellingPricePerPiece || 0),
            profitMargin: styleCosting.profitMargin ? Number(styleCosting.profitMargin) : null,
            isRecalculated: false,
          }
        : null;

    // Stage breakdown — derive piece counts from currentStage
    const stageStr = currentStage as string;
    const stageBreakdown = {
      ordersReceived: 1,
      pendingCosting: styleCosting ? 0 : 1,
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

    // Material status from MRP requirements
    const materialStatus = await this.getMaterialStatus(orderItem.orderId);

    return {
      // Order Item Core
      orderItemId: orderItem.id,
      orderId: orderItem.orderId,
      orderNumber: order?.orderNumber || 'N/A',
      orderDate,
      deliveryDate,
      quantity: orderItem.totalQuantity || 0,
      unitPrice: Number(orderItem.unitPrice || 0),
      totalPrice: Number(orderItem.totalPrice || 0),

      // Customer
      customerId: order?.customerId || null,
      customerName: order?.customers?.name || null,

      // Style Reference
      styleId: style?.id || null,
      styleCode: style?.styleCode || 'N/A',
      styleName: style?.styleName || 'N/A',
      internalCode: style?.internalCode || null,
      imageUrl: style?.imageUrl || style?.image || null,
      brandName: style?.brandName || null,
      brandCategoryId: style?.brandCategoryId || null,
      season: style?.season || null,

      // CAD Status (order-specific)
      selectedCadId: orderItem.selectedCadId || null,
      selectedCadWidth: orderItem.selectedCad?.cutableWidth ? Number(orderItem.selectedCad.cutableWidth) : null,
      cadStatus: this.determineCadStatus(style, orderItem),
      availableCadWidths,

      // Production Tracking
      currentStage,
      piecesInStage,
      lastUpdatedDate,
      stageBreakdown,
      overallProgress,

      // Calculated Metrics
      daysToDelivery,
      isDelayed,
      isOnTrack: !isDelayed && overallProgress > 0,

      // Blockers & Actions
      blockers,
      suggestedActions,

      // Costing
      costing,

      // Material Status
      materialStatus,

      // Work Orders
      workOrders: workOrderData,
      latestWorkOrderId,

      // Inheritance Settings
      sampleInheritance: orderItem.inheritStyleSamples ? 'STYLE' : 'ORDER',
      inspectionInheritance: orderItem.inheritInspections ? 'STYLE' : 'ORDER',

      // Sample & Inspection Status
      sampleStatus,
      inspectionStatus,
    };
  }

  /**
   * Get available CAD widths from style's fabric components
   */
  private async getAvailableCadWidths(style: any, selectedCadId: string | null): Promise<CadWidthOption[]> {
    const cadWidths: CadWidthOption[] = [];
    const seenIds = new Set<string>();

    if (!style?.style_components) return cadWidths;

    const defaultWastage = await systemSettingsService.getNumber('FABRIC_DEFAULT_WASTAGE_PERCENT', 0);

    style.style_components.forEach((comp: any) => {
      if (!comp.style_fabrics) return;

      comp.style_fabrics.forEach((sf: any) => {
        // From fabricCAD (directly linked)
        if (sf.fabricCAD && !seenIds.has(sf.fabricCAD.id)) {
          seenIds.add(sf.fabricCAD.id);
          cadWidths.push({
            id: sf.fabricCAD.id,
            cutableWidth: Number(sf.fabricCAD.cutableWidth),
            cadMeters: sf.fabricCAD.cadMeters ? Number(sf.fabricCAD.cadMeters) : null,
            cadWastagePercent: Number(sf.fabricCAD.cadWastagePercent ?? defaultWastage),
            isSelected: sf.fabricCAD.id === selectedCadId,
            isPreferred: sf.fabricCAD.isPreferred || false,
          });
        }

        // From fabric.widthCADs (all available widths)
        if (sf.fabric?.widthCADs) {
          sf.fabric.widthCADs.forEach((cad: any) => {
            if (!seenIds.has(cad.id)) {
              seenIds.add(cad.id);
              cadWidths.push({
                id: cad.id,
                cutableWidth: Number(cad.cutableWidth),
                cadMeters: cad.cadMeters ? Number(cad.cadMeters) : null,
                cadWastagePercent: Number(cad.cadWastagePercent ?? defaultWastage),
                isSelected: cad.id === selectedCadId,
                isPreferred: cad.isPreferred || false,
              });
            }
          });
        }
      });
    });

    // Sort by cutableWidth descending (widest first)
    return cadWidths.sort((a, b) => b.cutableWidth - a.cutableWidth);
  }

  /**
   * Determine CAD status for order
   */
  private determineCadStatus(style: any, orderItem: any): 'PENDING' | 'SELECTED' | 'APPROVED' {
    if (orderItem.selectedCadId) {
      return 'SELECTED';
    }
    if (style?.cadStatus === 'APPROVED') {
      return 'APPROVED';
    }
    return 'PENDING';
  }

  /**
   * Get material readiness status from MRP requirements for an order
   */
  private async getMaterialStatus(orderId: string): Promise<{
    fabricsOrdered: boolean;
    fabricsReceived: boolean;
    trimsOrdered: boolean;
    trimsReceived: boolean;
  }> {
    const FABRIC_TYPES = ['FABRIC', 'GREIGE'];
    const defaultStatus = { fabricsOrdered: false, fabricsReceived: false, trimsOrdered: false, trimsReceived: false };

    try {
      const requirements = await prisma.material_requirements.findMany({
        where: {
          orderId,
          requirementType: 'MATERIAL',
          status: { not: 'CANCELLED' },
        },
        select: {
          status: true,
          materials: { select: { materialType: true } },
        },
      });

      if (requirements.length === 0) return defaultStatus;

      const fabricReqs = requirements.filter((r) => FABRIC_TYPES.includes(r.materials?.materialType || ''));
      const trimReqs = requirements.filter((r) => !FABRIC_TYPES.includes(r.materials?.materialType || ''));

      const PO_ORDERED_STATUSES = ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'];
      const RECEIVED_STATUSES = ['RECEIVED', 'FULFILLED_STOCK'];

      return {
        fabricsOrdered: fabricReqs.length > 0 && fabricReqs.some((r) => PO_ORDERED_STATUSES.includes(r.status)),
        fabricsReceived: fabricReqs.length > 0 && fabricReqs.every((r) => RECEIVED_STATUSES.includes(r.status)),
        trimsOrdered: trimReqs.length > 0 && trimReqs.some((r) => PO_ORDERED_STATUSES.includes(r.status)),
        trimsReceived: trimReqs.length > 0 && trimReqs.every((r) => RECEIVED_STATUSES.includes(r.status)),
      };
    } catch (err) {
      logger.error('Failed to get material status:', err);
      return defaultStatus;
    }
  }

  /**
   * Build sample status from samples array
   */
  private buildSampleStatus(samples: any[]): any {
    const findSample = (type: string) => {
      const sample = samples.find((s: any) => s.sampleType === type);
      if (!sample) {
        return { exists: false, status: null, daysPending: null, sampleId: null };
      }

      const daysPending =
        sample.status !== 'APPROVED' && sample.status !== 'APPROVED_WITH_COMMENTS'
          ? Math.floor(
              (new Date().getTime() - new Date(sample.requestDate || sample.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            )
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
   * Build inspection status from style (placeholder)
   */
  private buildInspectionStatusFromStyle(style: any): any {
    return {
      fabricInspection: { completed: false, status: null as 'PASS' | 'FAIL' | 'PENDING' | null },
      inlineQC: { completed: false, status: null as 'PASS' | 'FAIL' | 'PENDING' | null },
      finalQC: { completed: false, status: null as 'PASS' | 'FAIL' | 'PENDING' | null },
    };
  }

  /**
   * Build inspection status from order inspections
   */
  private buildInspectionStatusFromOrder(inspections: any[]): any {
    const findInspection = (type: string) => {
      const inspection = inspections.find((i: any) => i.inspectionType === type);
      if (!inspection) {
        return { completed: false, status: null as 'PASS' | 'FAIL' | 'PENDING' | null };
      }
      return {
        completed: inspection.inspectedAt != null,
        status: inspection.status as 'PASS' | 'FAIL' | 'PENDING' | null,
      };
    };

    return {
      fabricInspection: findInspection('FABRIC_QC'),
      inlineQC: findInspection('INLINE_QC'),
      finalQC: findInspection('FINAL_QC'),
    };
  }

  /**
   * Identify blockers for an order
   */
  private identifyBlockers(
    style: any,
    orderItem: any,
    workOrderData: any,
    daysToDelivery: number | null,
    sampleStatus: any
  ): BlockerInfo[] {
    const blockers: BlockerInfo[] = [];

    // CAD not selected for this order
    if (!orderItem.selectedCadId && style?.cadStatus !== 'APPROVED') {
      blockers.push({
        type: 'CAD_NOT_APPROVED',
        severity: 'HIGH',
        message: 'CAD planning not approved or selected',
        daysStuck: null,
      });
    }

    // Costing pending (no order costing and no style costing)
    if (!orderItem.order_item_costing && !style?.style_costing) {
      blockers.push({
        type: 'COSTING_PENDING',
        severity: 'MEDIUM',
        message: 'Costing not completed',
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
    if (
      sampleStatus.fitSample.exists &&
      sampleStatus.fitSample.status !== 'APPROVED' &&
      sampleStatus.fitSample.status !== 'APPROVED_WITH_COMMENTS'
    ) {
      blockers.push({
        type: 'FIT_SAMPLE_NOT_APPROVED',
        severity: 'HIGH',
        message: 'Fit sample awaiting approval',
        daysStuck: sampleStatus.fitSample.daysPending,
      });
    }

    if (
      sampleStatus.ppSample.exists &&
      sampleStatus.ppSample.status !== 'APPROVED' &&
      sampleStatus.ppSample.status !== 'APPROVED_WITH_COMMENTS'
    ) {
      blockers.push({
        type: 'PP_SAMPLE_NOT_APPROVED',
        severity: 'MEDIUM',
        message: 'PP sample awaiting approval',
        daysStuck: sampleStatus.ppSample.daysPending,
      });
    }

    return blockers;
  }

  /**
   * Build suggested actions based on blockers
   */
  private buildSuggestedActions(style: any, orderItem: any, blockers: BlockerInfo[]): ActionInfo[] {
    const actions: ActionInfo[] = [];

    blockers.forEach((blocker) => {
      switch (blocker.type) {
        case 'CAD_NOT_APPROVED':
          actions.push({
            label: 'Select CAD Width',
            route: `/styles/${style?.id}/cad-planning`,
            priority: 'URGENT',
          });
          break;
        case 'COSTING_PENDING':
          actions.push({
            label: 'Complete Costing',
            route: `/styles/${style?.id}/costing`,
            priority: 'HIGH',
          });
          break;
        case 'FIT_SAMPLE_NOT_APPROVED':
        case 'PP_SAMPLE_NOT_APPROVED':
          actions.push({
            label: 'Follow up on Sample',
            route: `/samples?styleId=${style?.id}`,
            priority: 'HIGH',
          });
          break;
        case 'DELIVERY_OVERDUE':
          actions.push({
            label: 'Expedite Production',
            route: `/work-orders?orderId=${orderItem.orderId}`,
            priority: 'URGENT',
          });
          break;
      }
    });

    return actions;
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
      totalOrderValue: items.reduce((sum, i) => sum + (Number(i.totalPrice) || 0), 0),
      totalPieces: items.reduce((sum, i) => sum + (i.quantity || 0), 0),
    };
  }
}

export const orderProductionStatusService = new OrderProductionStatusService();
