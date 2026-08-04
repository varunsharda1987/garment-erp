// JWT utility functions
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTPayload } from '../types/auth.types';

// Never fall back to a hard-coded default: a public, well-known signing key lets anyone
// forge a valid login token for any user. Fail loudly at startup instead (bug-hunt BH-0252).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not set. Refusing to start with an insecure default signing key — set JWT_SECRET in the environment.'
  );
}

// Access token expiry (kept at 7d for backward compatibility)
// Consider reducing to 15-30 min in a future release once frontend auto-refresh is stable
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Refresh token expiry (30 days)
export const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10);

/**
 * Generate a JWT access token
 *
 * BUG-AUTH2: Includes tokenVersion to invalidate all sessions on password change.
 * The auth middleware validates tokenVersion against the database.
 *
 * BUG-AUTH6: Works in conjunction with refresh tokens for session management.
 */
export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as string | number,
  } as jwt.SignOptions);
};

/**
 * Generate a cryptographically secure refresh token
 * Returns both the token string and its expiration date
 */
export const generateRefreshToken = (): { token: string; expiresAt: Date } => {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
  return { token, expiresAt };
};

/**
 * Verify and decode a JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Decode token without verification (useful for checking expired tokens)
 */
export const decodeToken = (token: string): JWTPayload | null => {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    return null;
  }
};
