/**
 * Allocate a sent PO to running orders — /api/po-allocations (docs/plans/po-allocation-design.md §6.4–6.5, §7).
 *
 * These mirror `PoAllocationView` / `AllocatePoLinesResponse` / `UndoPoAllocationResponse` in
 * backend/src/services/helpers/po-allocation.helper.ts, camelCased by the API serializer. Dates arrive as ISO
 * strings. Every quantity is in the requirement's (stock) unit — the material's unit — except `orderedQty`,
 * which is in the PO line's own unit (a purchase unit such as GROSS).
 */

/** A PO in these statuses can take links — the same list the server allowlists */
export const LINKABLE_PO_STATUSES = ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'] as const;

/** How a line's receipts reach its links (receipt-allocation.helper `LineKind`) */
export type PoAllocationLineKind = 'lot-greige' | 'lot-lace' | 'untracked' | 'none' | 'pro-rata';

/** Where goods sit: our store, a processor (its supplier id), or a processor unit linked to no processor */
export interface PoAllocationPlace {
  /** 'STORE', 'UNPLACED', or the processor's supplier id */
  pool: string;
  name: string;
}

export interface PoAllocationDyer {
  id: string;
  name: string;
}

export interface PoAllocationLabel {
  id: string;
  code: string;
  name: string;
  type: string | null;
  category: string | null;
}

export interface PoAllocationMaterial {
  id: string;
  code: string;
  name: string;
  materialType: string;
  unit: string;
  label: PoAllocationLabel | null;
  size: string | null;
}

export interface PoAllocationLink {
  linkId: string;
  requirementId: string;
  requirementNumber: string;
  requirementStatus: string;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  customerName: string | null;
  styleCode: string | null;
  /** The order's expected delivery date */
  deliveryDate: string | null;
  requiredDate: string | null;
  /** The requirement's (stock) unit */
  unit: string;
  /** Rank on the line: a receipt fills links in this order */
  fillOrder: number | null;
  allocatedQty: number;
  /** Credited from what arrived */
  receivedQty: number;
  issuedQty: number;
  /** Goods held for it now */
  heldQty: number;
  /** Greige / lace lines: where its order is dyed */
  dyer: PoAllocationDyer | null;
  /** Greige / lace: cloth waits at another processor this order can no longer use (its dyer changed) */
  dyerMoved: boolean;
  /** Greige / lace: the line no longer delivers where this order is dyed */
  deliveryMismatch: boolean;
  /** The current BOM needs this much less than the link covers */
  surplusQty: number | null;
  canUndo: boolean;
  undoBlockedReason: string | null;
}

export interface PoAllocationCandidate {
  requirementId: string;
  requirementNumber: string;
  requirementStatus: string;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  customerName: string | null;
  styleCode: string | null;
  deliveryDate: string | null;
  requiredDate: string | null;
  unit: string;
  colorName: string | null;
  /** What it still needs bought (its shortfall) */
  needQty: number;
  allocatedFromStock: number;
  dyer: PoAllocationDyer | null;
  /** The default split (0 = not ticked) */
  suggestedQty: number;
  /** Of the suggestion, what comes from goods already here — held at once, and then it can't be undone */
  alreadyHereQty: number;
  /** The PO is expected after this order needs the goods */
  arrivesLate: boolean;
  linkable: boolean;
  blockedReason: string | null;
}

export interface PoAllocationLine {
  itemId: string;
  material: PoAllocationMaterial | null;
  colorName: string | null;
  /** The PO line's unit (a purchase unit such as GROSS, or the stock unit) */
  unit: string;
  stockUnitsPerUnit: number | null;
  /** The unit links, credits and holds are counted in — the material's */
  stockUnit: string | null;
  kind: PoAllocationLineKind;
  /** Greige / lace / greige lace: receipts fill by where the goods land */
  located: boolean;
  /** In the line's own unit */
  orderedQty: number;
  orderedStockQty: number;
  arrivedQty: number;
  /** Σ allocated over live links */
  linkedQty: number;
  receivedForOrdersQty: number;
  heldQty: number;
  /** Arrived and nobody's */
  plainQty: number;
  toComeQty: number;
  /** What more can be linked (a link with no processor) */
  freeToLink: number;
  /** Arrived, nobody's, and still physically there — a new link takes it first and holds it at once */
  arrivedFree: number;
  plainByPlace: Array<PoAllocationPlace & { qty: number }>;
  /** Greige / lace lines: where it delivers; null = to be advised (or not a located line) */
  deliversTo: PoAllocationPlace[] | null;
  pendingQcGrnNumber: string | null;
  linkable: boolean;
  blockedReason: string | null;
  /** In fill order */
  links: PoAllocationLink[];
  /** Earliest need first — the order the dialog lists and suggests in */
  candidates: PoAllocationCandidate[];
}

export interface PoAllocationView {
  po: {
    id: string;
    poNumber: string;
    status: string;
    poCategory: string | null;
    supplierName: string | null;
    expectedDeliveryDate: string;
    linkable: boolean;
    blockedReason: string | null;
  };
  lines: PoAllocationLine[];
  /** Running orders that need these lines' materials and are not linked (the page banner) */
  unlinkedOrderCount: number;
}

/** One ticked row of the Allocate dialog. `quantity` is in the requirement's (stock) unit. */
export interface PoAllocationInput {
  purchaseOrderItemId: string;
  requirementId: string;
  quantity: number;
}

export interface AllocatePoRequest {
  allocations: PoAllocationInput[];
}

export interface AllocatedPoLink {
  linkId: string;
  purchaseOrderItemId: string;
  requirementId: string;
  requirementNumber: string;
  orderNumber: string | null;
  quantity: number;
  /** Credited at once from goods already here and held for it — this link can no longer be undone */
  heldAtOnce: number;
}

/** A partly covered requirement: the uncovered balance became its own row, to be bought separately */
export interface PoAllocationSplit {
  requirementNumber: string;
  childNumber: string;
  balance: number;
}

/** POST /po-allocations/:poId */
export interface AllocatePoResponse {
  poId: string;
  poNumber: string;
  linked: AllocatedPoLink[];
  splits: PoAllocationSplit[];
  allocation: PoAllocationView;
}

/** DELETE /po-allocations/:poId/links/:linkId */
export interface UndoPoAllocationResponse {
  requirementNumber: string;
  /** The requirement's status after (PO_REQUIRED, PARTIAL_STOCK, FULFILLED_STOCK or CANCELLED) */
  newStatus: string;
  /** Balance rows folded back into it */
  foldedBack: string[];
  allocation: PoAllocationView;
}

/** One reason a row could not be linked (422 PO_ALLOCATION_REFUSED, `details.rows`) */
export interface PoAllocationRefusalRow {
  purchaseOrderItemId: string | null;
  requirementId: string | null;
  requirementNumber: string | null;
  reason: string;
}

/** The `details.code` values the allocation endpoints answer with */
export type PoAllocationErrorCode =
  | 'PO_ALLOCATION_REFUSED'
  | 'PO_ARRIVED_NOT_FREE'
  | 'PO_UNDO_REFUSED'
  | 'PO_LINE_OVER_ALLOCATED'
  | 'PO_ALLOCATION_CHANGED';
