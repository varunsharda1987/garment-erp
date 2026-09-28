/**
 * /api/po-allocations — allocate a sent PO to running orders (docs/plans/po-allocation-design.md §6.5).
 * Every id here is a UUID: purchase_orders / purchase_order_items ids are written by code as UUIDs, and
 * material_requirements / requirement_po_links default to uuid().
 */
import { z } from 'zod';
import { formNumberRequired, toQueryList } from './common.schema';

/** One dialog can link at most this many rows — PO2609-0231 alone has 54 */
export const MAX_ALLOCATIONS_PER_REQUEST = 500;

const uuid = (what: string) => z.string().uuid(`Invalid ${what} ID`);

export const poAllocationParamSchema = z.object({
  poId: uuid('purchase order'),
});

export const poAllocationLinkParamSchema = z.object({
  poId: uuid('purchase order'),
  linkId: uuid('allocation'),
});

/**
 * GET ?itemIds= narrows the view to some lines (the Requirements page's Link). Send it repeated
 * (`?itemIds=a&itemIds=b`) or comma-separated — a UUID has no comma, so splitting cannot break one.
 * Blank means every line.
 */
const idList = (v: unknown): unknown => {
  const list = toQueryList(v);
  if (!Array.isArray(list)) return list;
  const ids = list
    .flatMap((s) => String(s).split(','))
    .map((s) => s.trim())
    .filter((s) => s !== '');
  return ids.length > 0 ? ids : undefined;
};

export const poAllocationQuerySchema = z.object({
  itemIds: z.preprocess(idList, z.array(uuid('PO line')).max(MAX_ALLOCATIONS_PER_REQUEST).optional()),
});

/**
 * POST — the Allocate dialog's ticked rows. `quantity` is in the requirement's (stock) unit; the typed
 * input posts a string, so it goes through formNumberRequired.
 */
export const allocatePoSchema = z.object({
  allocations: z
    .array(
      z.object({
        purchaseOrderItemId: uuid('PO line'),
        requirementId: uuid('requirement'),
        quantity: formNumberRequired(z.number().positive('Each order needs a quantity above 0')),
      })
    )
    .min(1, 'Tick at least one order to allocate to')
    .max(MAX_ALLOCATIONS_PER_REQUEST, `At most ${MAX_ALLOCATIONS_PER_REQUEST} orders can be allocated at once`),
});

export type PoAllocationParams = z.infer<typeof poAllocationParamSchema>;
export type PoAllocationLinkParams = z.infer<typeof poAllocationLinkParamSchema>;
export type PoAllocationQuery = z.infer<typeof poAllocationQuerySchema>;
export type AllocatePoInput = z.infer<typeof allocatePoSchema>;
