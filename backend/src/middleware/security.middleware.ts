import rateLimit from 'express-rate-limit';

/**
 * General rate limiter for all API endpoints
 * Development: 1000 requests per 15 minutes per IP
 * Production: 5000 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // 5000/15min suits an internal multi-user LAN tool whose SPA pages each fire 12-92 XHRs;
  // this global IP-based limiter runs before auth (app.ts) so it cannot be keyed per-user.
  max: process.env.NODE_ENV === 'production' ? 5000 : 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for authentication endpoints
 * Development: 100 login/register attempts per 15 minutes per IP (for E2E testing)
 * Production: 5 login/register attempts per 15 minutes per IP
 * Only counts failed attempts (skipSuccessfulRequests: true)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for sensitive operations
 * 10 requests per 15 minutes per IP
 */
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many requests for this operation, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
