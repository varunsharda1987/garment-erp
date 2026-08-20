/**
 * Workflow AI actions (Phases B–D) — style, orders, purchase orders, work orders, GRN.
 *
 * These differ from master actions in one important way: the endpoints take UUIDs, while a
 * chat user speaks names ("customer Kasya", "style KF-1023"). Each action therefore has a
 * resolve() step that turns names into ids BEFORE the confirmation card is shown, so the
 * user confirms against a resolved, unambiguous record.
 */

import { z } from 'zod';
import type { ActionDefinition, Payload, ActionContext, StepResult } from '../ai-action-types';
import { internalFetch, resolveEntity } from '../ai-action-types';

// ── Style ────────────────────────────────────────────────────────────────────
// customerName is a free-text column on styles, NOT a foreign key — no resolution needed.
// The service rejects a missing customerName unless status is DRAFT, and status has no
// default, so the tool treats it as required.

const styleShape = z.object({
  buyerStyleRef: z.string().min(1).max(100),
  customerName: z.string().min(1).max(200),
  styleName: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  gender: z.string().max(50).optional(),
  description: z.string().max(1000).optional(),
});

const createStyle: ActionDefinition = {
  actionType: 'create_style',
  actionEntity: 'styles',
  label: 'Create Style',
  method: 'POST',
  path: '/api/styles',
  allowedRoles: ['ADMIN', 'MERCHANDISER'],
  toolSchema: styleShape,
  executionSchema: styleShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_style',
      description:
        "Create a style. Required: buyerStyleRef (the buyer's style code) and customerName. The style code is generated automatically.",
      parameters: {
        type: 'object',
        properties: {
          buyerStyleRef: { type: 'string', description: "The buyer's style code" },
          customerName: { type: 'string', description: 'Buyer/customer name as text' },
          styleName: { type: 'string' },
          category: { type: 'string', description: 'e.g. "Dress", "Top"' },
          gender: { type: 'string', description: 'e.g. "Girls", "Ladies"' },
          description: { type: 'string' },
        },
        required: ['buyerStyleRef', 'customerName'],
      },
    },
  },
  successMessage: (d) => `✅ Created style **${d.styleCode || d.buyerStyleRef}**. [Open it](/styles/${d.id})`,
};

// ── Sale order ───────────────────────────────────────────────────────────────
// Only customerId is required — items are deliberately added later on the detail page.

const saleOrderTool = z.object({
  customerName: z.string().min(1),
  buyerPoNumber: z.string().max(100).optional(),
  expectedDeliveryDate: z.string().max(30).optional(),
});

const saleOrderExec = z.object({
  customerId: z.string().uuid(),
  buyerPoNumber: z.string().max(100).optional(),
  expectedDeliveryDate: z.string().max(30).optional(),
});

const createSaleOrder: ActionDefinition = {
  actionType: 'create_sale_order',
  actionEntity: 'sale_orders',
  label: 'Create Sale Order',
  method: 'POST',
  path: '/api/sale-orders',
  allowedRoles: ['ADMIN', 'SALES', 'MERCHANDISER'],
  toolSchema: saleOrderTool,
  executionSchema: saleOrderExec,
  tool: {
    type: 'function',
    function: {
      name: 'create_sale_order',
      description:
        'Create a draft sale order for a customer. Required: customerName. Line items are added afterwards on the sale order page — do not ask for them here.',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string', description: 'Customer name or code' },
          buyerPoNumber: { type: 'string', description: "The buyer's PO number, if given" },
          expectedDeliveryDate: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['customerName'],
      },
    },
  },
  resolve: async (payload: Payload, ctx: ActionContext): Promise<StepResult> => {
    const customer = await resolveEntity(ctx, {
      listPath: '/api/customers',
      search: String(payload.customerName),
      entityLabel: 'Customer',
      nameFields: ['name', 'billingName'],
    });
    if (!customer.ok) return { ok: false, question: customer.question };

    const { customerName, ...rest } = payload;
    return {
      ok: true,
      payload: { ...rest, customerId: customer.entity.id },
      displayLines: [`Customer: ${customer.entity.display}`],
    };
  },
  successMessage: (d) =>
    `✅ Created sale order **${d.soNumber || d.orderNumber || ''}**. [Open it](/sale-orders/${d.id}) — add items there.`,
};

// ── Production order ─────────────────────────────────────────────────────────

const orderTool = z.object({
  customerName: z.string().min(1),
  styleCode: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  expectedDeliveryDate: z.string().min(4).max(30),
});

const orderExec = z.object({
  customerId: z.string().uuid(),
  expectedDeliveryDate: z.string().min(4).max(30),
  items: z
    .array(
      z.object({
        styleId: z.string().uuid(),
        totalQuantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
      })
    )
    .min(1),
});

const createOrder: ActionDefinition = {
  actionType: 'create_order',
  actionEntity: 'orders',
  label: 'Create Production Order',
  method: 'POST',
  path: '/api/orders',
  allowedRoles: ['ADMIN', 'SALES', 'MERCHANDISER', 'PRODUCTION_MANAGER'],
  toolSchema: orderTool,
  executionSchema: orderExec,
  tool: {
    type: 'function',
    function: {
      name: 'create_order',
      description:
        'Create a production order with ONE style line. Required: customerName, styleCode, quantity, unitPrice and expectedDeliveryDate. For multiple styles, create the order then add the other lines on the order page.',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string', description: 'Customer name or code' },
          styleCode: { type: 'string', description: 'Style code or buyer style reference' },
          quantity: { type: 'number', description: 'Total pieces for this style' },
          unitPrice: { type: 'number', description: 'Price per piece' },
          expectedDeliveryDate: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['customerName', 'styleCode', 'quantity', 'unitPrice', 'expectedDeliveryDate'],
      },
    },
  },
  resolve: async (payload: Payload, ctx: ActionContext): Promise<StepResult> => {
    const customer = await resolveEntity(ctx, {
      listPath: '/api/customers',
      search: String(payload.customerName),
      entityLabel: 'Customer',
      nameFields: ['name', 'billingName'],
    });
    if (!customer.ok) return { ok: false, question: customer.question };

    const style = await resolveEntity(ctx, {
      listPath: '/api/styles',
      search: String(payload.styleCode),
      entityLabel: 'Style',
      codeField: 'styleCode',
      nameFields: ['styleName', 'buyerStyleRef'],
    });
    if (!style.ok) return { ok: false, question: style.question };

    return {
      ok: true,
      payload: {
        customerId: customer.entity.id,
        expectedDeliveryDate: payload.expectedDeliveryDate,
        items: [
          {
            styleId: style.entity.id,
            totalQuantity: payload.quantity,
            unitPrice: payload.unitPrice,
          },
        ],
      },
      displayLines: [`Customer: ${customer.entity.display}`, `Style: ${style.entity.display}`],
    };
  },
  // Work orders are auto-created at order creation, but only for items that carry a
  // colour/size breakup — which a chat-created single-line order does not have yet.
  successMessage: (d) =>
    `✅ Created order **${d.orderNumber}**. [Open it](/orders/${d.id})\n\n` +
    `Next: add the colour/size breakup on the order page so work orders can be generated.`,
};

// ── Stock production order ───────────────────────────────────────────────────

const spoTool = z.object({
  styleCode: z.string().min(1),
  totalQuantity: z.number().int().positive(),
  targetDate: z.string().max(30).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  remarks: z.string().max(500).optional(),
});

const spoExec = z.object({
  styleId: z.string().uuid(),
  totalQuantity: z.number().int().positive(),
  targetDate: z.string().max(30).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  remarks: z.string().max(500).optional(),
});

const createStockProductionOrder: ActionDefinition = {
  actionType: 'create_stock_production_order',
  actionEntity: 'stock_production_orders',
  label: 'Create Stock Production Order',
  method: 'POST',
  path: '/api/stock-production-orders',
  allowedRoles: ['ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'],
  toolSchema: spoTool,
  executionSchema: spoExec,
  tool: {
    type: 'function',
    function: {
      name: 'create_stock_production_order',
      description:
        'Create a stock production order (producing for own stock, not against a customer order). Required: styleCode and totalQuantity.',
      parameters: {
        type: 'object',
        properties: {
          styleCode: { type: 'string', description: 'Style code or buyer style reference' },
          totalQuantity: { type: 'number', description: 'Total pieces to produce' },
          targetDate: { type: 'string', description: 'YYYY-MM-DD' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          remarks: { type: 'string' },
        },
        required: ['styleCode', 'totalQuantity'],
      },
    },
  },
  resolve: async (payload: Payload, ctx: ActionContext): Promise<StepResult> => {
    const style = await resolveEntity(ctx, {
      listPath: '/api/styles',
      search: String(payload.styleCode),
      entityLabel: 'Style',
      codeField: 'styleCode',
      nameFields: ['styleName', 'buyerStyleRef'],
    });
    if (!style.ok) return { ok: false, question: style.question };

    const { styleCode, ...rest } = payload;
    return {
      ok: true,
      payload: { ...rest, styleId: style.entity.id },
      displayLines: [`Style: ${style.entity.display}`],
    };
  },
  successMessage: (d) =>
    `✅ Created stock production order **${d.spoNumber || d.orderNumber || ''}**. [Open it](/stock-production-orders/${d.id})`,
};

// ── Purchase order ───────────────────────────────────────────────────────────

const UNITS = [
  'METER',
  'PIECE',
  'KILOGRAM',
  'SET',
  'YARD',
  'DOZEN',
  'GROSS',
  'TUBE',
  'CONE',
  'SPOOL',
  'BOX',
  'PAIR',
  'PACK',
  'GRAM',
  'LITER',
  'ROLL',
] as const;

const poTool = z.object({
  supplierName: z.string().min(1),
  materialName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(UNITS),
  unitPrice: z.number().positive(),
  expectedDeliveryDate: z.string().min(4).max(30),
});

const poExec = z.object({
  supplierId: z.string().uuid(),
  expectedDeliveryDate: z.string().min(4).max(30),
  items: z
    .array(
      z.object({
        materialId: z.string().min(1).max(100),
        orderedQuantity: z.number().positive(),
        unit: z.enum(UNITS),
        unitPrice: z.number().positive(),
      })
    )
    .min(1),
});

const createPurchaseOrder: ActionDefinition = {
  actionType: 'create_purchase_order',
  actionEntity: 'purchase_orders',
  label: 'Create Purchase Order',
  method: 'POST',
  path: '/api/purchase-orders',
  allowedRoles: ['ADMIN', 'PURCHASE', 'MERCHANDISER'],
  toolSchema: poTool,
  executionSchema: poExec,
  tool: {
    type: 'function',
    function: {
      name: 'create_purchase_order',
      description:
        'Create a purchase order with ONE material line. Required: supplierName, materialName, quantity, unit, unitPrice (must be greater than zero) and expectedDeliveryDate. For more lines, create the PO then add them on the PO page.',
      parameters: {
        type: 'object',
        properties: {
          supplierName: { type: 'string', description: 'Supplier name or code' },
          materialName: { type: 'string', description: 'Material name or code to buy' },
          quantity: { type: 'number' },
          unit: { type: 'string', enum: UNITS },
          unitPrice: { type: 'number', description: 'Rate per unit — must be greater than zero' },
          expectedDeliveryDate: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['supplierName', 'materialName', 'quantity', 'unit', 'unitPrice', 'expectedDeliveryDate'],
      },
    },
  },
  resolve: async (payload: Payload, ctx: ActionContext): Promise<StepResult> => {
    const supplier = await resolveEntity(ctx, {
      listPath: '/api/suppliers',
      search: String(payload.supplierName),
      entityLabel: 'Supplier',
    });
    if (!supplier.ok) return { ok: false, question: supplier.question };

    const material = await resolveEntity(ctx, {
      listPath: '/api/materials',
      search: String(payload.materialName),
      entityLabel: 'Material',
      nameFields: ['name', 'materialName'],
    });
    if (!material.ok) return { ok: false, question: material.question };

    return {
      ok: true,
      payload: {
        supplierId: supplier.entity.id,
        expectedDeliveryDate: payload.expectedDeliveryDate,
        items: [
          {
            materialId: material.entity.id,
            orderedQuantity: payload.quantity,
            unit: payload.unit,
            unitPrice: payload.unitPrice,
          },
        ],
      },
      displayLines: [`Supplier: ${supplier.entity.display}`, `Material: ${material.entity.display}`],
    };
  },
  successMessage: (d) => `✅ Created purchase order **${d.poNumber}**. [Open it](/procurement/purchase-orders/${d.id})`,
};

// ── Work orders from an order ────────────────────────────────────────────────
// The direct work-order endpoint needs a size-grid of UUIDs summing to the header
// quantity — not chat-elicitable. This endpoint derives the breakup from the order's
// own items instead, so it only works for orders whose items carry that breakup.

const woTool = z.object({
  orderNumber: z.string().min(1),
  plannedStartDate: z.string().max(30).optional(),
  plannedEndDate: z.string().max(30).optional(),
});

const woExec = z.object({
  plannedStartDate: z.string().max(30).optional(),
  plannedEndDate: z.string().max(30).optional(),
});

const createWorkOrdersFromOrder: ActionDefinition = {
  actionType: 'create_work_orders_from_order',
  actionEntity: 'work_orders',
  label: 'Generate Work Orders for an Order',
  method: 'POST',
  // orderId survives on the stored payload even though the BODY schema strips it
  path: (payload: Payload) => `/api/orders/${payload.orderId}/work-orders`,
  allowedRoles: ['ADMIN', 'PRODUCTION_MANAGER', 'MERCHANDISER'],
  toolSchema: woTool,
  executionSchema: woExec,
  tool: {
    type: 'function',
    function: {
      name: 'create_work_orders_from_order',
      description:
        'Generate work orders for an existing production order. Required: orderNumber. This only works when the order items already have a colour/size breakup — work orders are normally created automatically when the order is made, so use this to retry after adding the breakup.',
      parameters: {
        type: 'object',
        properties: {
          orderNumber: { type: 'string', description: 'The order number' },
          plannedStartDate: { type: 'string', description: 'YYYY-MM-DD' },
          plannedEndDate: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['orderNumber'],
      },
    },
  },
  resolve: async (payload: Payload, ctx: ActionContext): Promise<StepResult> => {
    const order = await resolveEntity(ctx, {
      listPath: '/api/orders',
      search: String(payload.orderNumber),
      entityLabel: 'Order',
      codeField: 'orderNumber',
      nameFields: ['orderNumber'],
    });
    if (!order.ok) return { ok: false, question: order.question };

    const { orderNumber, ...rest } = payload;
    return {
      ok: true,
      payload: { ...rest, orderId: order.entity.id },
      displayLines: [`Order: ${order.entity.display}`],
    };
  },
  // The endpoint answers 200 with per-item created/skipped/failed buckets
  successMessage: (d) => {
    const created = Array.isArray(d.created) ? d.created.length : 0;
    const skipped = Array.isArray(d.skipped) ? d.skipped.length : 0;
    const failed = Array.isArray(d.failed) ? (d.failed as Array<{ reason?: string }>) : [];

    if (created === 0 && failed.length > 0) {
      const reason = failed[0]?.reason || 'the order items have no colour/size breakup';
      return `⚠️ No work orders could be created — ${reason}. Add the colour/size breakup on the order page, then try again.`;
    }
    const parts = [`✅ Created ${created} work order(s)`];
    if (skipped) parts.push(`${skipped} already existed`);
    if (failed.length) parts.push(`${failed.length} failed`);
    return `${parts.join(', ')}. [Open work orders](/production/work-orders)`;
  },
};

// ── Receive a GRN against a PO ───────────────────────────────────────────────

const grnTool = z.object({
  poNumber: z.string().min(1),
  invoiceNumber: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});

const grnExec = z.object({
  poId: z.string().min(1),
  invoiceNumber: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        poItemId: z.string().min(1),
        materialId: z.string().min(1),
        receivedQuantity: z.number().positive(),
        acceptedQuantity: z.number().nonnegative(),
        rejectedQuantity: z.number().nonnegative(),
        unit: z.string().min(1),
      })
    )
    .min(1),
});

interface PendingLine {
  poItemId: string;
  materialId: string | null;
  materialName?: string;
  unit: string;
  pendingQuantity: number;
}

const receiveGrnFull: ActionDefinition = {
  actionType: 'receive_grn_full',
  actionEntity: 'goods_receiving_notes',
  label: 'Receive All Pending Items on a PO',
  method: 'POST',
  path: '/api/grn',
  allowedRoles: ['ADMIN', 'INVENTORY', 'PURCHASE'],
  toolSchema: grnTool,
  executionSchema: grnExec,
  tool: {
    type: 'function',
    function: {
      name: 'receive_grn_full',
      description:
        'Receive ALL pending items on a purchase order in full (nothing rejected), creating a GRN. Required: poNumber. Use only when the user wants to receive everything still outstanding; for partial or rejected quantities they must use the GRN page.',
      parameters: {
        type: 'object',
        properties: {
          poNumber: { type: 'string', description: 'The purchase order number' },
          invoiceNumber: { type: 'string', description: "Supplier's invoice number, if given" },
          remarks: { type: 'string' },
        },
        required: ['poNumber'],
      },
    },
  },
  resolve: async (payload: Payload, ctx: ActionContext): Promise<StepResult> => {
    const po = await resolveEntity(ctx, {
      listPath: '/api/purchase-orders',
      search: String(payload.poNumber),
      entityLabel: 'Purchase order',
      codeField: 'poNumber',
      nameFields: ['poNumber'],
    });
    if (!po.ok) return { ok: false, question: po.question };

    const { poNumber, ...rest } = payload;
    return {
      ok: true,
      payload: { ...rest, poId: po.entity.id },
      displayLines: [`Purchase order: ${po.entity.display}`],
    };
  },
  // Build the item lines from what is actually still pending on the PO
  prepare: async (payload: Payload, ctx: ActionContext): Promise<StepResult> => {
    try {
      const { ok, body } = await internalFetch(
        `/api/grn/po/${payload.poId}/pending`,
        { method: 'GET' },
        ctx.authHeader
      );
      if (!ok) {
        return { ok: false, question: 'I could not read the pending items for that purchase order. Please try again.' };
      }

      const rows = Array.isArray(body.data) ? (body.data as unknown as PendingLine[]) : [];
      // The endpoint returns every PO line, including ones already received in full
      const pending = rows.filter((row) => row.materialId && Number(row.pendingQuantity) > 0);

      if (pending.length === 0) {
        return {
          ok: false,
          question: 'That purchase order has nothing pending — every item has already been received.',
        };
      }

      const items = pending.map((row) => ({
        poItemId: row.poItemId,
        materialId: row.materialId as string,
        receivedQuantity: Number(row.pendingQuantity),
        acceptedQuantity: Number(row.pendingQuantity),
        rejectedQuantity: 0,
        unit: row.unit,
      }));

      const displayLines = pending
        .slice(0, 8)
        .map((row) => `Receiving: ${row.materialName || 'item'} — ${row.pendingQuantity} ${row.unit}`);
      if (pending.length > 8) displayLines.push(`…and ${pending.length - 8} more line(s)`);

      return { ok: true, payload: { ...payload, items }, displayLines };
    } catch {
      return { ok: false, question: 'The pending-items lookup timed out. Please try again.' };
    }
  },
  successMessage: (d) => `✅ Created GRN **${d.grnNumber}**. [Open it](/procurement/grn/${d.id})`,
};

export const WORKFLOW_ACTIONS: ActionDefinition[] = [
  createStyle,
  createSaleOrder,
  createOrder,
  createStockProductionOrder,
  createPurchaseOrder,
  createWorkOrdersFromOrder,
  receiveGrnFull,
];
