import { UserRole } from '@prisma/client';
import { AppError, ValidationError } from '../errors';

/**
 * A request may ask to bypass a production gate (samples, tests, BOM, Production CAD) by sending
 * `adminOverride: true`. Until 2026-09-17 the work-order handlers honoured that flag from ANY
 * caller and only logged it when a reason happened to be sent — the sample handler checked the
 * role, this one did not (bug-hunt order-system T4-A). Resolve it here, once, the way the admin
 * floor does (`requireAdmin()` in auth.middleware: `UserRole.ADMIN` only, code ADMIN_ONLY).
 */
export const OVERRIDE_REASON_MIN_LENGTH = 10;

export interface AdminOverrideBody {
  adminOverride?: unknown;
  overrideReason?: unknown;
}

export interface ResolvedAdminOverride {
  adminOverride: boolean;
  overrideReason?: string;
}

export function resolveAdminOverride(
  user: { role?: string } | undefined,
  body: AdminOverrideBody
): ResolvedAdminOverride {
  if (body.adminOverride !== true) {
    return { adminOverride: false };
  }
  if (user?.role !== UserRole.ADMIN) {
    throw new AppError(403, 'ADMIN_ONLY', 'Only an administrator can override a production gate.');
  }
  const overrideReason = typeof body.overrideReason === 'string' ? body.overrideReason.trim() : '';
  if (overrideReason.length < OVERRIDE_REASON_MIN_LENGTH) {
    throw new ValidationError(
      `An override needs a written reason of at least ${OVERRIDE_REASON_MIN_LENGTH} characters — it is logged for audit.`
    );
  }
  return { adminOverride: true, overrideReason };
}
