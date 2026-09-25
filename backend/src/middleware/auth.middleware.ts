// Authentication + permission middleware
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { logWarn } from '../utils/logger';
import { PermissionService } from '../services/permission.service';
import { formatPermissionName, type PermissionKey } from '../config/permissions.config';

/**
 * Middleware to verify JWT token
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token required',
      });
      return;
    }

    // Verify token signature + expiry
    const decoded = verifyToken(token);

    // Re-validate the account against the DB so deactivation, un-approval, role changes,
    // and password changes (via tokenVersion) take effect immediately instead of persisting
    // for the token's (7-day) lifetime.
    // Fail-OPEN on infrastructure errors (DB unreachable/query error) so a transient DB blip
    // cannot lock every user out of the shared server; fail-CLOSED only when the DB explicitly
    // reports the user missing / inactive / unapproved / tokenVersion mismatch.
    try {
      const userId = decoded.userId || decoded.id;
      const dbUser = userId
        ? await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, role: true, isActive: true, isApproved: true, tokenVersion: true },
          })
        : null;

      if (!dbUser || !dbUser.isActive || !dbUser.isApproved) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Account is inactive, unapproved, or no longer exists',
        });
        return;
      }

      // BUG-AUTH2: Validate tokenVersion to invalidate sessions after password change.
      // If token was issued before a password change, tokenVersion will mismatch.
      // Skip check for tokens that don't have tokenVersion (backward compatibility).
      if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== dbUser.tokenVersion) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Session invalidated. Please log in again.',
        });
        return;
      }

      // Attach the user with the FRESH role from the DB (not the possibly-stale token role).
      req.user = { ...decoded, id: dbUser.id, userId: dbUser.id, role: dbUser.role };
    } catch (dbErr) {
      // Infra error while re-validating — do NOT lock users out; fall back to the valid token.
      logWarn('authenticateToken: DB re-validation failed, using token payload', {
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
      req.user = decoded;
    }

    next();
  } catch (error) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token',
    });
    return;
  }
};

// ---------------------------------------------------------------------------------------------
// Permission checks — the Permissions page (role_permissions table) is the ONLY source of truth.
//
// There is deliberately no `authorize(...roles)` any more. Role lists hardcoded at routes were
// never connected to the page (an admin could toggle a switch and nothing changed), drifted from
// the page's own defaults, and had been bypassed outright in "full access mode". A route now
// names the MODULE it belongs to; whether a role may write to that module is a row in the table.
//
// Reads (GET/HEAD/OPTIONS) stay open to every signed-in user by convention: pages look things up
// across modules (an order page fetches styles, customers, cost sheets), and the sidebar already
// hides modules the role lacks. What a permission gates is what the user can DO.
// ---------------------------------------------------------------------------------------------

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function denyUnauthenticated(res: Response): void {
  res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required',
  });
}

/**
 * Require the caller's role to hold `key` on the Permissions page. ADMIN always passes.
 *
 * The 403 body carries `code: 'PERMISSION_DENIED'` and the key so the client can say exactly
 * which switch to ask for. The message must never contain "token" or "expired" — the frontend
 * treats such 403s as a dead session and tries a token refresh.
 */
export const requirePermission = (key: PermissionKey) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      denyUnauthenticated(res);
      return;
    }
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }
    try {
      const allowed = await PermissionService.hasPermission(req.user.role as UserRole, key);
      if (!allowed) {
        res.status(403).json({
          error: 'Forbidden',
          code: 'PERMISSION_DENIED',
          permission: key,
          message: `Your role does not have access to ${formatPermissionName(key)}. Ask an administrator to enable it on the Permissions page.`,
        });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Pass when the caller's role holds ANY of `keys` (ADMIN always passes). For an action two
 * Permissions-page areas legitimately share — e.g. adding a weaver, named on a PO line
 * ('purchaseOrders') or, when only the delivery says, on a GRN line ('grn').
 */
export const requireAnyPermission = (...keys: PermissionKey[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      denyUnauthenticated(res);
      return;
    }
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }
    try {
      for (const key of keys) {
        if (await PermissionService.hasPermission(req.user.role as UserRole, key)) {
          next();
          return;
        }
      }
      res.status(403).json({
        error: 'Forbidden',
        code: 'PERMISSION_DENIED',
        permission: keys[0],
        message: `Your role does not have access to ${keys.map(formatPermissionName).join(' or ')}. Ask an administrator to enable it on the Permissions page.`,
      });
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Router-level form of `requirePermission`: gates POST/PUT/PATCH/DELETE, lets reads through.
 *
 *   router.use(authenticateToken);
 *   router.use(requirePermissionForWrites('orders'));
 */
export const requirePermissionForWrites = (key: PermissionKey) => {
  const check = requirePermission(key);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (READ_METHODS.has(req.method)) {
      next();
      return;
    }
    void check(req, res, next);
  };
};

/**
 * The hardcoded floor the Permissions page cannot lower: user/permission management, audit,
 * integrations settings, hard deletes, financial approvals. Not a switch on the page — an admin
 * who could toggle it off could lock everyone (including themselves) out of fixing it.
 */
export const requireAdmin = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      denyUnauthenticated(res);
      return;
    }
    if (req.user.role !== UserRole.ADMIN) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'ADMIN_ONLY',
        message: 'Only an administrator can do this.',
      });
      return;
    }
    next();
  };
};
