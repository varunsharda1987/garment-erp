/**
 * Status Transition State Machine
 *
 * Enforces valid status transitions for business entities.
 * Rules: Strict for normal users, admin can override with a logged reason.
 *
 * Usage:
 *   validateTransition('order', 'PENDING', 'IN_PRODUCTION', userRole)
 *   // → { valid: true } or { valid: false, message: '...' }
 *
 *   validateTransition('order', 'COMPLETED', 'PENDING', 'USER')
 *   // → { valid: false, message: 'Cannot change order from COMPLETED to PENDING. Valid: DISPATCHED' }
 *
 *   validateTransition('order', 'COMPLETED', 'PENDING', 'ADMIN')
 *   // → { valid: true, isAdminOverride: true }
 */

export type EntityType =
  | 'order'
  | 'purchaseOrder'
  | 'invoice'
  | 'challan'
  | 'saleOrder'
  | 'quotation'
  | 'materialRequirement';

export interface TransitionResult {
  valid: boolean;
  message?: string;
  isAdminOverride?: boolean;
}

// Map of entity → current status → allowed next statuses
const TRANSITIONS: Record<string, Record<string, string[]>> = {
  // BUG-WO7: 'order' entity used for both orders and work_orders (same OrderStatus enum)
  order: {
    PENDING: ['IN_PRODUCTION', 'CANCELLED', 'SPLIT'],
    IN_PRODUCTION: ['COMPLETED', 'CANCELLED'],
    COMPLETED: ['DISPATCHED'],
    DISPATCHED: ['COMPLETED'], // Allow rework: dispatched back to completed if quality issue
    CANCELLED: [], // Terminal state — no transitions (admin can override)
    SPLIT: [], // Terminal state for parent run
  },

  purchaseOrder: {
    DRAFT: ['SENT', 'CANCELLED'],
    SENT: ['ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
    ACKNOWLEDGED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
    PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
    RECEIVED: [], // Terminal
    CANCELLED: [], // Terminal
    PENDING_GREIGE: ['READY_FOR_PROCESSING', 'CANCELLED'],
    READY_FOR_PROCESSING: ['SENT', 'CANCELLED'],
  },

  invoice: {
    PENDING: ['PARTIALLY_PAID', 'PAID', 'OVERDUE'],
    PARTIALLY_PAID: ['PAID', 'OVERDUE'],
    PAID: [], // Terminal
    OVERDUE: ['PARTIALLY_PAID', 'PAID'], // Can be paid even when overdue
  },

  challan: {
    DRAFT: ['ISSUED', 'CANCELLED'],
    ISSUED: ['IN_TRANSIT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CANCELLED'],
    IN_TRANSIT: ['RECEIVED', 'PARTIALLY_RECEIVED'],
    RECEIVED: [], // Terminal
    PARTIALLY_RECEIVED: ['RECEIVED'],
    CANCELLED: [], // Terminal
  },

  // Landmine №2 note: sale-order PROGRESS states (allocation/dispatch tiers) are DERIVED
  // from item quantities by services/helpers/sale-order-status.helper.ts — allocation may
  // step down when stock is released, dispatch steps down only when dispatchedQty is
  // reduced (rejected delivery). This declaration documents the event transitions.
  saleOrder: {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'CANCELLED'],
    PARTIALLY_ALLOCATED: ['CONFIRMED', 'FULLY_ALLOCATED', 'PARTIALLY_DISPATCHED', 'CANCELLED'],
    FULLY_ALLOCATED: ['CONFIRMED', 'PARTIALLY_ALLOCATED', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'CANCELLED'],
    PARTIALLY_DISPATCHED: ['DISPATCHED', 'DELIVERED', 'CANCELLED'],
    DISPATCHED: ['PARTIALLY_DISPATCHED', 'DELIVERED'], // steps back only via rejected/returned delivery
    DELIVERED: [], // Terminal (POD confirmed)
    CANCELLED: [], // Terminal
  },

  quotation: {
    DRAFT: ['SENT'],
    SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
    ACCEPTED: [], // Terminal
    REJECTED: [], // Terminal
    EXPIRED: [], // Terminal
  },

  // MRP-24: material_requirements.status was a raw unguarded update — the API could move a
  // RECEIVED requirement back to PO_REQUIRED (making it re-orderable after goods had arrived)
  // with nothing to stop it. Mirrors MaterialRequirementStatus in schema.prisma.
  materialRequirement: {
    PENDING: ['PO_REQUIRED', 'PARTIAL_STOCK', 'FULFILLED_STOCK', 'CONVERTED', 'CANCELLED'],
    // Stock allocation can move either way while nothing has been ordered yet
    FULFILLED_STOCK: ['PARTIAL_STOCK', 'PO_REQUIRED', 'CONVERTED', 'CANCELLED'],
    PARTIAL_STOCK: ['PO_REQUIRED', 'FULFILLED_STOCK', 'PO_GENERATED', 'CONVERTED', 'CANCELLED'],
    PO_REQUIRED: ['PO_GENERATED', 'PARTIAL_STOCK', 'FULFILLED_STOCK', 'CONVERTED', 'CANCELLED'],
    // PO/JWO raised → sent → received. Back to PO_REQUIRED only via PO cancellation.
    PO_GENERATED: ['PO_SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'PO_REQUIRED', 'CANCELLED'],
    PO_SENT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'PO_REQUIRED', 'CANCELLED'],
    // Receipt reversal (negative GRN) legitimately walks these back
    PARTIALLY_RECEIVED: ['RECEIVED', 'PO_SENT', 'PARTIALLY_RECEIVED'],
    RECEIVED: ['PARTIALLY_RECEIVED'], // only a GRN reversal may undo a completed receipt
    CONVERTED: ['CANCELLED'], // the greige/processing children carry the plan now
    CANCELLED: [], // Terminal — recalculation revives by rewriting the row, not by transition
  },
};

/**
 * Validate a status transition.
 *
 * @param entityType - The type of entity (order, purchaseOrder, etc.)
 * @param fromStatus - Current status
 * @param toStatus - Desired new status
 * @param userRole - User's role ('ADMIN' gets override capability)
 * @returns TransitionResult with valid flag and optional message
 */
export function validateTransition(
  entityType: EntityType,
  fromStatus: string,
  toStatus: string,
  userRole?: string
): TransitionResult {
  // Same status — no-op, always valid
  if (fromStatus === toStatus) {
    return { valid: true };
  }

  const entityTransitions = TRANSITIONS[entityType];
  if (!entityTransitions) {
    return { valid: false, message: `Unknown entity type: ${entityType}` };
  }

  const allowedTargets = entityTransitions[fromStatus];
  if (!allowedTargets) {
    // Unknown current status — allow admin to override, block others
    if (userRole === 'ADMIN') {
      return { valid: true, isAdminOverride: true };
    }
    return {
      valid: false,
      message: `Unknown current status "${fromStatus}" for ${entityType}. Contact admin.`,
    };
  }

  // Check if transition is in allowed list
  if (allowedTargets.includes(toStatus)) {
    return { valid: true };
  }

  // Not allowed for normal users — check admin override
  if (userRole === 'ADMIN') {
    return { valid: true, isAdminOverride: true };
  }

  // Build helpful error message
  const allowedStr =
    allowedTargets.length > 0
      ? `Allowed transitions from ${fromStatus}: ${allowedTargets.join(', ')}`
      : `${fromStatus} is a terminal status with no further transitions`;

  return {
    valid: false,
    message: `Cannot change ${entityType} status from ${fromStatus} to ${toStatus}. ${allowedStr}. Admin can override.`,
  };
}

/**
 * Get all valid next statuses for a given entity and current status.
 */
export function getValidTransitions(entityType: EntityType, fromStatus: string): string[] {
  return TRANSITIONS[entityType]?.[fromStatus] || [];
}
