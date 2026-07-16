// JWT utility functions
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types/auth.types';

// Never fall back to a hard-coded default: a public, well-known signing key lets anyone
// forge a valid login token for any user. Fail loudly at startup instead (bug-hunt BH-0252).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not set. Refusing to start with an insecure default signing key — set JWT_SECRET in the environment.'
  );
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a JWT token
 */
export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as string | number,
  } as jwt.SignOptions);
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
