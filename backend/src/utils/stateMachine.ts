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

export type EntityType = 'order' | 'purchaseOrder' | 'invoice' | 'challan' | 'saleOrder' | 'quotation';

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

  saleOrder: {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'CANCELLED'],
    PARTIALLY_ALLOCATED: ['FULLY_ALLOCATED', 'PARTIALLY_DISPATCHED', 'CANCELLED'],
    FULLY_ALLOCATED: ['PARTIALLY_DISPATCHED', 'DISPATCHED'],
    PARTIALLY_DISPATCHED: ['DISPATCHED'],
    DISPATCHED: [], // Terminal
    CANCELLED: [], // Terminal
  },

  quotation: {
    DRAFT: ['SENT'],
    SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
    ACCEPTED: [], // Terminal
    REJECTED: [], // Terminal
    EXPIRED: [], // Terminal
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
