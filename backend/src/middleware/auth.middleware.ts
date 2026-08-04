// Authentication middleware
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { logWarn } from '../utils/logger';

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

/**
 * Middleware to check if user has required role
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
      });
      return;
    }

    next();
  };
};
