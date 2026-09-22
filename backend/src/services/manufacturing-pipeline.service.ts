/**
 * Manufacturing pipeline — what is actually in production, and what is stopping the rest.
 *
 * The Control Center was built as a pure exceptions inbox: seven alerts, a vendor table, a variance
 * watchtower. All of them answer "what went wrong". None answers "what is happening", so with an
 * empty pipeline the page rendered a confident green "All Clear!" while eight orders sat unable to
 * start cutting. An empty factory is not good news, and the page had no way to say so.
 *
 * This supplies the missing half: every open order item, the stage it is waiting to enter, and the
 * specific prerequisites standing in the way.
 *
 * Two rules it must not break:
 *
 * 1. **It does not decide prerequisites.** Every blocker comes from
 *    `productionBlockingValidation.service.ts` via `validateOrderItemForStage`. That file is the
 *    only authority on what a stage needs (CLAUDE.md), and a dashboard that re-derived the rules
 *    would drift from the gate that actually refuses the work — telling people they are ready when
 *    push-to-cutting will refuse them.
 * 2. **It is bounded.** Validation runs several queries per order, one of which walks BOM lines and
 *    asks for derived stock per line. Fine for the tens of orders this factory has; not fine
 *    unbounded. Hence PIPELINE_LIMIT and the `truncated` flag rather than an unbounded scan.
 */

import { ProductionStage } from '@prisma/client';
import prisma from '../config/database';
import { productionBlockingValidationService } from './productionBlockingValidation.service';
import { toDateInputValue } from '../utils/date';

/** Orders examined per call. Beyond this the response reports `truncated`. */
const PIPELINE_LIMIT = 50;

/** Statuses that mean an order is no longer trying to reach the production floor. */
const CLOSED_ORDER_STATUSES = ['CANCELLED', 'COMPLETED', 'DISPATCHED', 'SPLIT'] as const;

export interface PipelineBlocker {
  type: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface PipelineOrder {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  styleId: string | null;
  styleCode: string;
  styleName: string;
  buyerStyleRef: string | null;
  customerName: string | null;
  quantity: number;
  /** The stage this item is waiting to ENTER. */
  nextStage: ProductionStage;
  workOrderCount: number;
  expectedDeliveryDate: string | null;
  daysToDelivery: number | null;
  isBlocked: boolean;
  blockers: PipelineBlocker[];
  /** False before a work order exists — the garment test cannot be evaluated yet. */
  gptEvaluated: boolean;
}

export interface PipelineResponse {
  orders: PipelineOrder[];
  counts: {
    total: number;
    blocked: number;
    ready: number;
    running: number;
  };
  /** True when more open orders exist than PIPELINE_LIMIT — the list is a window, not the whole set. */
  truncated: boolean;
  generatedAt: string;
}

class ManufacturingPipelineService {
  async getPipeline(): Promise<PipelineResponse> {
    const openOrderFilter = {
      orders: { isActive: true, status: { notIn: [...CLOSED_ORDER_STATUSES] } },
    };

    const [total, items] = await Promise.all([
      prisma.order_items.count({ where: openOrderFilter }),
      prisma.order_items.findMany({
        where: openOrderFilter,
        select: {
          id: true,
          orderId: true,
          styleId: true,
          totalQuantity: true,
          orders: {
            select: {
              orderNumber: true,
              expectedDeliveryDate: true,
              customers: { select: { name: true } },
            },
          },
          styles: { select: { styleCode: true, styleName: true, buyerStyleRef: true } },
          _count: { select: { work_orders: true } },
        },
        // Soonest delivery first: the row most likely to hurt is the row at the top.
        orderBy: { orders: { expectedDeliveryDate: 'asc' } },
        take: PIPELINE_LIMIT,
      }),
    ]);

    const now = Date.now();

    const orders: PipelineOrder[] = await Promise.all(
      items.map(async (item) => {
        // With no work order the item is waiting to enter cutting; once one exists, cutting is
        // already under way and the gate that matters has been passed.
        const workOrderCount = item._count.work_orders;
        const nextStage: ProductionStage = ProductionStage.IN_CUTTING;

        const verdict =
          workOrderCount === 0
            ? await productionBlockingValidationService.validateOrderItemForStage(item.id, nextStage)
            : { isBlocked: false, blockers: [], gptEvaluated: false };

        const due = item.orders?.expectedDeliveryDate ?? null;

        return {
          orderItemId: item.id,
          orderId: item.orderId,
          orderNumber: item.orders?.orderNumber ?? '—',
          styleId: item.styleId,
          styleCode: item.styles?.styleCode ?? '—',
          styleName: item.styles?.styleName ?? '',
          buyerStyleRef: item.styles?.buyerStyleRef ?? null,
          customerName: item.orders?.customers?.name ?? null,
          quantity: item.totalQuantity,
          nextStage,
          workOrderCount,
          expectedDeliveryDate: due ? toDateInputValue(due) : null,
          daysToDelivery: due ? Math.ceil((due.getTime() - now) / 86_400_000) : null,
          isBlocked: verdict.isBlocked,
          blockers: verdict.blockers as PipelineBlocker[],
          gptEvaluated: verdict.gptEvaluated,
        };
      })
    );

    const running = orders.filter((o) => o.workOrderCount > 0).length;
    const blocked = orders.filter((o) => o.isBlocked).length;

    return {
      orders,
      counts: {
        total,
        blocked,
        ready: orders.length - blocked - running,
        running,
      },
      truncated: total > items.length,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const manufacturingPipelineService = new ManufacturingPipelineService();
export default manufacturingPipelineService;
