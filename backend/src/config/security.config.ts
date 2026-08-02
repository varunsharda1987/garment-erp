// Security configuration constants

/**
 * Bcrypt cost factor (salt rounds).
 * Higher = more secure but slower. OWASP recommends 10+ for production.
 * Can be tuned via environment variable for performance testing.
 */
export const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
