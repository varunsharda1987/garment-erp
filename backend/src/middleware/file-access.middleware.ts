/**
 * File Access Middleware
 *
 * Controls access to uploaded files. Can be configured to:
 * 1. Allow public access (default - backward compatible)
 * 2. Require authentication
 * 3. Require signed URLs
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';
import { verifySignedUrl } from '../services/signed-url.service';
import { logDebug, logWarn } from '../utils/logger';

// File access modes
export type FileAccessMode = 'public' | 'authenticated' | 'signed';

// Get access mode from environment (default: public for backward compatibility)
const FILE_ACCESS_MODE = (process.env.FILE_ACCESS_MODE as FileAccessMode) || 'public';

/**
 * Middleware to control file access
 *
 * Behavior based on FILE_ACCESS_MODE env variable:
 * - 'public': Anyone can access (default)
 * - 'authenticated': Requires valid JWT token
 * - 'signed': Requires valid signed URL
 */
export function fileAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Always allow OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  switch (FILE_ACCESS_MODE) {
    case 'public':
      // Allow all access
      next();
      break;

    case 'authenticated':
      verifyAuthenticatedAccess(req, res, next);
      break;

    case 'signed':
      verifySignedAccess(req, res, next);
      break;

    default:
      // Unknown mode, default to public
      logWarn(`Unknown FILE_ACCESS_MODE: ${FILE_ACCESS_MODE}, defaulting to public`);
      next();
  }
}

/**
 * Verify access using JWT token
 */
function verifyAuthenticatedAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check for token in Authorization header or query param
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string;

  const token = authHeader?.split(' ')[1] || queryToken;

  if (!token) {
    logDebug('File access denied: No token provided');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required to access this file',
    });
    return;
  }

  try {
    verifyToken(token);
    next();
  } catch {
    logDebug('File access denied: Invalid token');
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Verify access using signed URL
 */
function verifySignedAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { expires, signature } = req.query as { expires?: string; signature?: string };

  // No signature params - deny access
  if (!expires || !signature) {
    logDebug('File access denied: Missing signature params');
    res.status(403).json({
      error: 'Forbidden',
      message: 'Signed URL required to access this file',
    });
    return;
  }

  // Extract the file path without query params
  const filePath = req.path;

  const result = verifySignedUrl(filePath, expires, signature);

  if (!result.valid) {
    logDebug(`File access denied: ${result.reason}`);
    res.status(403).json({
      error: 'Forbidden',
      message: result.reason || 'Invalid signed URL',
    });
    return;
  }

  next();
}

/**
 * Create file access middleware with specific mode (override env)
 */
export function createFileAccessMiddleware(mode: FileAccessMode) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    switch (mode) {
      case 'public':
        next();
        break;
      case 'authenticated':
        verifyAuthenticatedAccess(req, res, next);
        break;
      case 'signed':
        verifySignedAccess(req, res, next);
        break;
      default:
        next();
    }
  };
}

export default fileAccessMiddleware;
