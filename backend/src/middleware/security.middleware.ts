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
 *
 * BUG-AUTH11 fix: ARCHITECTURE LIMITATION - Per-Account Rate Limiting Not Implemented
 * ==================================================================================
 * Current behavior: Rate limiting is IP-based ONLY. This protects against brute force
 * from a single IP, but does NOT protect against distributed attacks where an attacker
 * uses multiple IPs to target a single account.
 *
 * Vulnerability: Attacker with 1000 IPs x 5 attempts each = 5000 attempts on one account
 *
 * To properly implement per-account rate limiting would require:
 * 1. Add to `users` table: failedLoginAttempts (Int), lockedUntil (DateTime?), lastFailedLogin (DateTime?)
 * 2. In auth.controller.ts login():
 *    - Check if account is locked (lockedUntil > now) BEFORE password check
 *    - On failed login: increment failedLoginAttempts, set lastFailedLogin
 *    - If failedLoginAttempts >= threshold: set lockedUntil = now + lockout duration
 *    - On successful login: reset failedLoginAttempts to 0, clear lockedUntil
 * 3. Add admin endpoint to unlock accounts manually
 * 4. Optional: progressive backoff (longer lockouts for repeated lockouts)
 *
 * Risk assessment: LOW for this internal LAN app (attackers need network access).
 * Higher priority for internet-facing deployments.
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
